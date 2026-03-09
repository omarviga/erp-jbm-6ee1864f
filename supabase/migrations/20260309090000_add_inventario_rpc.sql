CREATE TABLE IF NOT EXISTS public.inventario_kardex (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES public.lotes(id) ON DELETE CASCADE,
  tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('entrada_produccion', 'traslado_interno', 'salida_venta', 'envio_cdmx', 'baja_merma')),
  cantidad NUMERIC NOT NULL,
  ubicacion_origen TEXT,
  ubicacion_destino TEXT,
  motivo TEXT,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventario_kardex ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS camara_fria_produccion_id_unique_idx ON public.camara_fria(produccion_id);

DROP FUNCTION IF EXISTS public.trasladar_a_camara_fria(UUID, UUID, NUMERIC, UUID);
CREATE OR REPLACE FUNCTION public.trasladar_a_camara_fria(
  p_produccion_id UUID,
  p_lote_id UUID,
  p_cantidad NUMERIC,
  p_usuario_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.produccion
  SET destino = 'camara_fria', created_at = created_at
  WHERE id = p_produccion_id AND destino = 'piso_empaque';

  INSERT INTO public.camara_fria (produccion_id, cantidad_cajas, cantidad_disponible)
  VALUES (p_produccion_id, p_cantidad::INTEGER, p_cantidad::INTEGER)
  ON CONFLICT (produccion_id)
  DO UPDATE SET
    cantidad_disponible = public.camara_fria.cantidad_disponible + EXCLUDED.cantidad_disponible,
    updated_at = now();

  INSERT INTO public.inventario_kardex (
    lote_id, tipo_movimiento, cantidad, ubicacion_origen, ubicacion_destino, usuario_id
  ) VALUES (
    p_lote_id, 'traslado_interno', p_cantidad, 'piso_empaque', 'camara_fria', p_usuario_id
  );
END;
$$;

DROP FUNCTION IF EXISTS public.registrar_baja_merma(UUID, UUID, NUMERIC, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.registrar_baja_merma(
  p_registro_camara_id UUID,
  p_lote_id UUID,
  p_cantidad_mermada NUMERIC,
  p_motivo TEXT,
  p_usuario_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock_actual NUMERIC;
BEGIN
  SELECT cantidad_disponible INTO v_stock_actual
  FROM public.camara_fria
  WHERE id = p_registro_camara_id
  FOR UPDATE;

  IF v_stock_actual < p_cantidad_mermada THEN
    RAISE EXCEPTION 'Stock insuficiente. Intentas mermar % cajas, pero solo hay % disponibles.', p_cantidad_mermada, v_stock_actual;
  END IF;

  UPDATE public.camara_fria
  SET cantidad_disponible = cantidad_disponible - p_cantidad_mermada,
      updated_at = now()
  WHERE id = p_registro_camara_id;

  INSERT INTO public.inventario_kardex (
    lote_id, tipo_movimiento, cantidad, ubicacion_origen, motivo, usuario_id
  ) VALUES (
    p_lote_id, 'baja_merma', -p_cantidad_mermada, 'camara_fria', p_motivo, p_usuario_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trasladar_a_camara_fria(UUID, UUID, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_baja_merma(UUID, UUID, NUMERIC, TEXT, UUID) TO authenticated;
