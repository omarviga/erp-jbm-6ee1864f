ALTER TABLE public.liquidaciones
ADD COLUMN IF NOT EXISTS saldo_pendiente_liq DECIMAL(12,2) NOT NULL DEFAULT 0;

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
  v_total_lotes_no_liquidados NUMERIC := 0;
  v_total_liquidaciones_pendientes NUMERIC := 0;
  v_total_pendiente NUMERIC := 0;
BEGIN
  IF p_productor_id IS NULL THEN
    RAISE EXCEPTION 'productor_id es requerido';
  END IF;

  SELECT COALESCE(SUM(
    GREATEST(
      0,
      (COALESCE(l.peso_pagable, l.peso_neto, 0) * COALESCE(l.precio_pactado_kg, 0)) - COALESCE(l.costo_bascula, 0)
    )
  ), 0)
  INTO v_total_lotes_no_liquidados
  FROM public.lotes l
  WHERE l.productor_id = p_productor_id
    AND COALESCE(LOWER(l.estado_calidad), 'aceptado') <> 'rechazado'
    AND NOT EXISTS (
      SELECT 1
      FROM public.liquidacion_lotes ll
      WHERE ll.lote_id = l.id
    );

  SELECT COALESCE(SUM(COALESCE(liq.saldo_pendiente_liq, 0)), 0)
  INTO v_total_liquidaciones_pendientes
  FROM public.liquidaciones liq
  WHERE liq.productor_id = p_productor_id;

  v_total_pendiente := v_total_lotes_no_liquidados + v_total_liquidaciones_pendientes;

  UPDATE public.productores
  SET saldo_pendiente = v_total_pendiente
  WHERE id = p_productor_id;

  RETURN v_total_pendiente;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_productor_saldo_pendiente(UUID) TO authenticated;
