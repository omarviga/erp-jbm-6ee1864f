-- ==========================================================
-- FIX FINANZAS: PERMISOS DE RECEPCION (rol almacen)
--
-- El flujo Recepcion -> CxP -> Finanzas estaba roto por dos
-- causas de permisos:
--
--   1. sync_productor_saldo_pendiente se invoca en cada guardado
--      de lote desde Recepcion (rol almacen), pero la version de
--      agosto lo restringio a admin/finanzas, lanzando
--      'No autorizado' y haciendo fallar el guardado del lote.
--      Se restaura el chequeo de rol que incluye almacen
--      (comportamiento original de marzo 2026).
--
--   2. Las politicas RLS de public.lotes no incluian al rol
--      almacen en INSERT/UPDATE, por lo que un usuario de
--      Recepcion ni siquiera podia guardar lotes.
--
-- Idempotente: seguro de ejecutar varias veces.
-- ==========================================================

-- ----------------------------------------------------------
-- 1) sync_productor_saldo_pendiente con rol almacen habilitado
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.sync_productor_saldo_pendiente(UUID);
CREATE OR REPLACE FUNCTION public.sync_productor_saldo_pendiente(
  p_productor_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_pendiente NUMERIC := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol admin, produccion, finanzas o almacen.';
  END IF;

  IF p_productor_id IS NULL THEN
    RAISE EXCEPTION 'productor_id es requerido';
  END IF;

  SELECT COALESCE(SUM(
    GREATEST(0, (COALESCE(l.peso_pagable, l.peso_neto, 0) * COALESCE(l.precio_pactado_kg, 0)) - COALESCE(l.costo_bascula, 0))
  ), 0)
  INTO v_total_pendiente
  FROM public.lotes l
  WHERE l.productor_id = p_productor_id
    AND COALESCE(LOWER(l.estado_calidad), 'aceptado') <> 'rechazado'
    AND NOT EXISTS (
      SELECT 1 FROM public.liquidacion_lotes ll
      WHERE ll.lote_id = l.id
    );

  UPDATE public.productores
  SET saldo_pendiente = v_total_pendiente
  WHERE id = p_productor_id;

  RETURN v_total_pendiente;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_productor_saldo_pendiente(UUID) TO authenticated;

-- ----------------------------------------------------------
-- 2) RLS de public.lotes: habilitar rol almacen (Recepcion)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Role-based view lotes" ON public.lotes;
CREATE POLICY "Role-based view lotes" ON public.lotes
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'produccion'::app_role)
     OR has_role(auth.uid(), 'finanzas'::app_role)
     OR has_role(auth.uid(), 'almacen'::app_role))
  );

DROP POLICY IF EXISTS "Role-based insert lotes" ON public.lotes;
CREATE POLICY "Role-based insert lotes" ON public.lotes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'produccion'::app_role)
     OR has_role(auth.uid(), 'almacen'::app_role))
  );

DROP POLICY IF EXISTS "Role-based update lotes" ON public.lotes;
CREATE POLICY "Role-based update lotes" ON public.lotes
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'produccion'::app_role)
     OR has_role(auth.uid(), 'finanzas'::app_role)
     OR has_role(auth.uid(), 'almacen'::app_role))
  );

-- DELETE: solo admin (sin cambios)
DROP POLICY IF EXISTS "Admin can delete lotes" ON public.lotes;
CREATE POLICY "Admin can delete lotes" ON public.lotes
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));
