-- Recalcula la cuenta por pagar de un productor en base a lotes no liquidados
-- Evita inconsistencias por RLS en actualizaciones directas desde frontend

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
  IF p_productor_id IS NULL THEN
    RAISE EXCEPTION 'productor_id es requerido';
  END IF;

  SELECT COALESCE(SUM(
    GREATEST(
      0,
      (COALESCE(l.peso_pagable, l.peso_neto, 0) * COALESCE(l.precio_pactado_kg, 0)) - COALESCE(l.costo_bascula, 0)
    )
  ), 0)
  INTO v_total_pendiente
  FROM public.lotes l
  WHERE l.productor_id = p_productor_id
    AND COALESCE(LOWER(l.estado_calidad), 'aceptado') <> 'rechazado'
    AND NOT EXISTS (
      SELECT 1
      FROM public.liquidacion_lotes ll
      WHERE ll.lote_id = l.id
    );

  UPDATE public.productores
  SET saldo_pendiente = v_total_pendiente
  WHERE id = p_productor_id;

  RETURN v_total_pendiente;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_productor_saldo_pendiente(UUID) TO authenticated;

-- Backfill rápido para corregir productores ya afectados
DO $$
DECLARE
  v_productor_id UUID;
BEGIN
  FOR v_productor_id IN
    SELECT DISTINCT productor_id
    FROM public.lotes
    WHERE productor_id IS NOT NULL
  LOOP
    PERFORM public.sync_productor_saldo_pendiente(v_productor_id);
  END LOOP;
END;
$$;
