DROP FUNCTION IF EXISTS public.trasladar_a_camara_fria(UUID, UUID, NUMERIC, UUID);
CREATE OR REPLACE FUNCTION public.trasladar_a_camara_fria(
  p_produccion_id UUID,
  p_lote_id UUID,
  p_cantidad NUMERIC,
  p_usuario_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_destino_actual destino_produccion;
  v_cantidad_actual INTEGER;
  v_camara_id UUID;
BEGIN
  SELECT destino, cantidad_cajas
  INTO v_destino_actual, v_cantidad_actual
  FROM public.produccion
  WHERE id = p_produccion_id
  FOR UPDATE;

  IF v_destino_actual IS NULL THEN
    RAISE EXCEPTION 'Producción no encontrada para traslado interno.';
  END IF;

  IF v_destino_actual <> 'piso_empaque' THEN
    RAISE EXCEPTION 'El lote no está en Piso Empaque, destino actual: %.', v_destino_actual;
  END IF;

  IF p_cantidad <= 0 OR p_cantidad > v_cantidad_actual THEN
    RAISE EXCEPTION 'Cantidad inválida para traslado. Disponible: % cajas.', v_cantidad_actual;
  END IF;

  UPDATE public.produccion
  SET destino = 'camara_fria'
  WHERE id = p_produccion_id;

  SELECT id INTO v_camara_id
  FROM public.camara_fria
  WHERE produccion_id = p_produccion_id
  FOR UPDATE;

  IF v_camara_id IS NULL THEN
    INSERT INTO public.camara_fria (produccion_id, cantidad_cajas, cantidad_disponible)
    VALUES (p_produccion_id, p_cantidad::INTEGER, p_cantidad::INTEGER);
  ELSE
    UPDATE public.camara_fria
    SET cantidad_disponible = cantidad_disponible + p_cantidad,
        updated_at = now()
    WHERE id = v_camara_id;
  END IF;

  INSERT INTO public.inventario_kardex (
    lote_id, tipo_movimiento, cantidad, ubicacion_origen, ubicacion_destino, usuario_id
  ) VALUES (
    p_lote_id, 'traslado_interno', p_cantidad, 'piso_empaque', 'camara_fria', p_usuario_id
  );
END;
$$;

DROP FUNCTION IF EXISTS public.registrar_envio_cdmx_transporte_directo(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.registrar_envio_cdmx_transporte_directo(
  p_produccion_id UUID,
  p_lote_id UUID,
  p_cantidad_enviar NUMERIC,
  p_precio_base_congelado NUMERIC,
  p_referencia_viaje TEXT,
  p_usuario_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_destino_actual destino_produccion;
  v_cantidad_cajas INTEGER;
  v_presentacion_id UUID;
  v_transferencia_id UUID;
  v_folio TEXT;
  v_camara_id UUID;
  v_stock_actual NUMERIC;
  v_origen_kardex TEXT;
BEGIN
  SELECT destino, cantidad_cajas, presentacion_id
  INTO v_destino_actual, v_cantidad_cajas, v_presentacion_id
  FROM public.produccion
  WHERE id = p_produccion_id
  FOR UPDATE;

  IF v_destino_actual IS NULL THEN
    RAISE EXCEPTION 'Producción no encontrada.';
  END IF;

  IF v_destino_actual NOT IN ('piso_empaque', 'transporte_directo', 'camara_fria') THEN
    RAISE EXCEPTION 'Destino actual (%) no soportado para envío a CDMX.', v_destino_actual;
  END IF;

  IF v_presentacion_id IS NULL THEN
    RAISE EXCEPTION 'El lote no tiene presentación configurada.';
  END IF;

  SELECT id, cantidad_disponible INTO v_camara_id, v_stock_actual
  FROM public.camara_fria
  WHERE produccion_id = p_produccion_id
  FOR UPDATE;

  IF v_camara_id IS NULL THEN
    INSERT INTO public.camara_fria (produccion_id, cantidad_cajas, cantidad_disponible)
    VALUES (p_produccion_id, v_cantidad_cajas, v_cantidad_cajas)
    RETURNING id, cantidad_disponible INTO v_camara_id, v_stock_actual;
  END IF;

  IF p_cantidad_enviar <= 0 OR p_cantidad_enviar > v_stock_actual THEN
    RAISE EXCEPTION 'Stock insuficiente para envío. Disponible: % cajas.', v_stock_actual;
  END IF;

  UPDATE public.produccion
  SET destino = 'camara_fria'
  WHERE id = p_produccion_id;

  UPDATE public.camara_fria
  SET cantidad_disponible = cantidad_disponible - p_cantidad_enviar,
      updated_at = now()
  WHERE id = v_camara_id;

  v_origen_kardex := CASE
    WHEN v_destino_actual = 'camara_fria' THEN 'camara_fria'
    WHEN v_destino_actual = 'piso_empaque' THEN 'piso_empaque'
    ELSE 'transporte_directo'
  END;

  INSERT INTO public.inventario_kardex (
    lote_id, tipo_movimiento, cantidad, ubicacion_origen, ubicacion_destino, usuario_id
  ) VALUES (
    p_lote_id, 'envio_cdmx', -p_cantidad_enviar, v_origen_kardex, 'en_transito_cdmx', p_usuario_id
  );

  v_folio := format('TR-%s-%s', to_char(now(), 'YYMMDD'), substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  INSERT INTO public.transferencias_bodega (
    folio, origen, destino, estado, chofer, notas_salida
  ) VALUES (
    v_folio, 'michoacan', 'cdmx', 'en_transito', 'Pendiente', p_referencia_viaje
  ) RETURNING id INTO v_transferencia_id;

  INSERT INTO public.transferencia_detalles (
    transferencia_id, presentacion_id, cantidad_enviada, precio_base
  ) VALUES (
    v_transferencia_id, v_presentacion_id, p_cantidad_enviar::INTEGER, p_precio_base_congelado
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trasladar_a_camara_fria(UUID, UUID, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_envio_cdmx_transporte_directo(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID) TO authenticated;
