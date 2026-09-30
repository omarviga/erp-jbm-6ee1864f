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
  v_cantidad_cajas INTEGER;
  v_presentacion_id UUID;
  v_transferencia_id UUID;
  v_folio TEXT;
  v_camara_id UUID;
BEGIN
  SELECT cantidad_cajas, presentacion_id
  INTO v_cantidad_cajas, v_presentacion_id
  FROM public.produccion
  WHERE id = p_produccion_id
    AND destino = 'transporte_directo'
  FOR UPDATE;

  IF v_cantidad_cajas IS NULL THEN
    RAISE EXCEPTION 'Lote no disponible en Directo a Transporte.';
  END IF;

  IF p_cantidad_enviar != v_cantidad_cajas THEN
    RAISE EXCEPTION 'Para Directo a Transporte debes enviar el lote completo (% cajas).', v_cantidad_cajas;
  END IF;

  UPDATE public.produccion
  SET destino = 'camara_fria'
  WHERE id = p_produccion_id;

  INSERT INTO public.camara_fria (produccion_id, cantidad_cajas, cantidad_disponible)
  VALUES (p_produccion_id, p_cantidad_enviar::INTEGER, p_cantidad_enviar::INTEGER)
  ON CONFLICT (produccion_id)
  DO UPDATE SET
    cantidad_disponible = public.camara_fria.cantidad_disponible + EXCLUDED.cantidad_disponible,
    updated_at = now()
  RETURNING id INTO v_camara_id;

  UPDATE public.camara_fria
  SET cantidad_disponible = cantidad_disponible - p_cantidad_enviar,
      updated_at = now()
  WHERE id = v_camara_id;

  INSERT INTO public.inventario_kardex (
    lote_id, tipo_movimiento, cantidad, ubicacion_origen, ubicacion_destino, usuario_id
  ) VALUES (
    p_lote_id, 'envio_cdmx', -p_cantidad_enviar, 'transporte_directo', 'en_transito_cdmx', p_usuario_id
  );

  v_folio := format('TR-%s-%s', to_char(now(), 'YYMMDD'), substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  INSERT INTO public.transferencias_bodega (
    folio,
    origen,
    destino,
    estado,
    chofer,
    notas_salida
  ) VALUES (
    v_folio,
    'michoacan',
    'cdmx',
    'en_transito',
    'Pendiente',
    p_referencia_viaje
  )
  RETURNING id INTO v_transferencia_id;

  INSERT INTO public.transferencia_detalles (
    transferencia_id,
    presentacion_id,
    cantidad_enviada,
    precio_base
  ) VALUES (
    v_transferencia_id,
    v_presentacion_id,
    p_cantidad_enviar::INTEGER,
    p_precio_base_congelado
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_envio_cdmx_transporte_directo(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID) TO authenticated;
