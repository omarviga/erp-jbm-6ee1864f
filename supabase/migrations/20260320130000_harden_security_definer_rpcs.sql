-- ==========================================================
-- Endurecimiento de funciones SECURITY DEFINER.
--
-- Motivo: las funciones SECURITY DEFINER ejecutan con los
--   privilegios del definidor y pueden BYPASSEAR RLS. Cualquier
--   usuario autenticado podía invocarlas aunque no tuviera el
--   rol de negocio requerido (p. ej. mermar inventario, marcar
--   una factura como "timbrada" o recalcular saldos).
--
-- Cambios:
--   1. Agregar SET search_path = public a las funciones que
--      no lo tenían (evita secuestro de search_path).
--   2. Validar rol con public.has_role(auth.uid(), ...) usando
--      los mismos roles que permiten la operación equivalente
--      vía políticas RLS / patrón de procesar_venta_cdmx.
-- ==========================================================

-- ----------------------------------------------------------
-- 1) trasladar_a_camara_fria (admin / produccion / almacen)
--    Sin SET search_path; escribe en camara_fria e
--    inventario_kardex. Roles = política INSERT camara_fria.
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.trasladar_a_camara_fria(UUID, UUID, NUMERIC, UUID);
CREATE OR REPLACE FUNCTION public.trasladar_a_camara_fria(
  p_produccion_id UUID,
  p_lote_id UUID,
  p_cantidad NUMERIC,
  p_usuario_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.trasladar_a_camara_fria(UUID, UUID, NUMERIC, UUID) TO authenticated;

-- ----------------------------------------------------------
-- 2) registrar_baja_merma (admin / produccion / almacen)
--    Sin SET search_path; reduce stock de camara_fria.
-- ----------------------------------------------------------
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
SET search_path = public
AS $$
DECLARE
  v_stock_actual NUMERIC;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.registrar_baja_merma(UUID, UUID, NUMERIC, TEXT, UUID) TO authenticated;

-- ----------------------------------------------------------
-- 3) registrar_envio_cdmx (admin / produccion / almacen)
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_envio_cdmx(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.registrar_envio_cdmx(
    p_registro_camara_id UUID,
    p_lote_id UUID,
    p_cantidad_enviar NUMERIC,
    p_precio_base_congelado NUMERIC,
    p_referencia_viaje TEXT,
    p_usuario_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stock_actual NUMERIC;
    v_presentacion_id UUID;
    v_transferencia_id UUID;
    v_folio TEXT;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

    SELECT cf.cantidad_disponible, p.presentacion_id
    INTO v_stock_actual, v_presentacion_id
    FROM public.camara_fria cf
    JOIN public.produccion p ON p.id = cf.produccion_id
    WHERE cf.id = p_registro_camara_id
    FOR UPDATE;

    IF v_stock_actual IS NULL THEN
        RAISE EXCEPTION 'Registro de cámara fría no encontrado.';
    END IF;

    IF v_stock_actual < p_cantidad_enviar THEN
        RAISE EXCEPTION 'Stock insuficiente. Intentas enviar % cajas, pero solo hay % disponibles.', p_cantidad_enviar, v_stock_actual;
    END IF;

    IF v_presentacion_id IS NULL THEN
        RAISE EXCEPTION 'El lote no tiene presentación configurada; no se puede crear la transferencia.';
    END IF;

    UPDATE public.camara_fria
    SET cantidad_disponible = cantidad_disponible - p_cantidad_enviar,
        updated_at = NOW()
    WHERE id = p_registro_camara_id;

    INSERT INTO public.inventario_kardex (
        lote_id, tipo_movimiento, cantidad, ubicacion_origen, ubicacion_destino, usuario_id
    ) VALUES (
        p_lote_id, 'envio_cdmx', -p_cantidad_enviar, 'camara_fria', 'en_transito_cdmx', p_usuario_id
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

GRANT EXECUTE ON FUNCTION public.registrar_envio_cdmx(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID) TO authenticated;

-- ----------------------------------------------------------
-- 4) registrar_envio_cdmx_transporte_directo
--    (admin / produccion / almacen)
-- ----------------------------------------------------------
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
SET search_path = public
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
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.registrar_envio_cdmx_transporte_directo(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID) TO authenticated;

-- ----------------------------------------------------------
-- 5) sync_productor_saldo_pendiente (admin / produccion / finanzas)
--    Se invoca desde recepción de lotes (produccion) y desde
--    RPCs de finanzas.
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.sync_productor_saldo_pendiente(UUID);
CREATE OR REPLACE FUNCTION public.sync_productor_saldo_pendiente(
  p_productor_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_pendiente NUMERIC := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

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

-- ----------------------------------------------------------
-- 6) calcular_efectivo_teorico_corte (admin / ventas / finanzas)
--    Usado por la pantalla de corte de caja CDMX (ventas).
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.calcular_efectivo_teorico_corte(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.calcular_efectivo_teorico_corte(
  p_fecha_inicio TIMESTAMPTZ,
  p_fecha_fin TIMESTAMPTZ
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_efectivo_teorico DECIMAL := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'ventas'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Sumar todas las ventas en efectivo del periodo
  -- Solo considera ventas tipo 'pos_cdmx'
  SELECT COALESCE(SUM(v.total), 0)
  INTO v_efectivo_teorico
  FROM public.ventas v
  WHERE v.tipo = 'pos_cdmx'
  AND v.created_at >= p_fecha_inicio
  AND v.created_at < p_fecha_fin
  AND EXISTS (
    SELECT 1 FROM public.pagos_clientes pc
    WHERE pc.venta_id = v.id
    AND pc.forma_pago = 'efectivo'
  );

  RETURN v_efectivo_teorico;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_efectivo_teorico_corte(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ----------------------------------------------------------
-- 7) evaluar_factura_para_timbrado (admin / finanzas / ventas)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluar_factura_para_timbrado(p_factura_id UUID)
RETURNS TABLE(lista BOOLEAN, faltantes TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura public.facturas%ROWTYPE;
  v_config public.facturacion_config%ROWTYPE;
  v_faltantes TEXT[] := ARRAY[]::TEXT[];
  v_items_count INTEGER := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
    OR public.has_role(auth.uid(), 'ventas'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT *
  INTO v_factura
  FROM public.facturas
  WHERE id = p_factura_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  SELECT *
  INTO v_config
  FROM public.facturacion_config
  WHERE activo = true
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    v_faltantes := array_append(v_faltantes, 'configuracion_emisor');
  ELSE
    IF COALESCE(NULLIF(trim(v_config.emisor_nombre), ''), '') = '' THEN
      v_faltantes := array_append(v_faltantes, 'emisor_nombre');
    END IF;
    IF COALESCE(NULLIF(trim(v_config.emisor_rfc), ''), '') = '' THEN
      v_faltantes := array_append(v_faltantes, 'emisor_rfc');
    END IF;
    IF COALESCE(NULLIF(trim(v_config.emisor_regimen_fiscal), ''), '') = '' THEN
      v_faltantes := array_append(v_faltantes, 'emisor_regimen_fiscal');
    END IF;
    IF COALESCE(NULLIF(trim(v_config.codigo_postal_expedicion), ''), '') = '' THEN
      v_faltantes := array_append(v_faltantes, 'codigo_postal_expedicion');
    END IF;
    IF COALESCE(NULLIF(trim(v_config.pac_proveedor), ''), '') = '' THEN
      v_faltantes := array_append(v_faltantes, 'pac_proveedor');
    END IF;
  END IF;

  IF COALESCE(NULLIF(trim(v_factura.receptor_nombre), ''), '') = '' THEN
    v_faltantes := array_append(v_faltantes, 'receptor_nombre');
  END IF;
  IF COALESCE(NULLIF(trim(v_factura.receptor_rfc), ''), '') = '' THEN
    v_faltantes := array_append(v_faltantes, 'receptor_rfc');
  END IF;
  IF COALESCE(NULLIF(trim(v_factura.receptor_regimen_fiscal), ''), '') = '' THEN
    v_faltantes := array_append(v_faltantes, 'receptor_regimen_fiscal');
  END IF;
  IF COALESCE(NULLIF(trim(v_factura.receptor_codigo_postal), ''), '') = '' THEN
    v_faltantes := array_append(v_faltantes, 'receptor_codigo_postal');
  END IF;
  IF COALESCE(NULLIF(trim(v_factura.uso_cfdi), ''), '') = '' THEN
    v_faltantes := array_append(v_faltantes, 'uso_cfdi');
  END IF;
  IF COALESCE(NULLIF(trim(v_factura.forma_pago), ''), '') = '' THEN
    v_faltantes := array_append(v_faltantes, 'forma_pago');
  END IF;
  IF COALESCE(NULLIF(trim(v_factura.metodo_pago), ''), '') = '' THEN
    v_faltantes := array_append(v_faltantes, 'metodo_pago');
  END IF;

  SELECT COUNT(*)
  INTO v_items_count
  FROM public.factura_detalles
  WHERE factura_id = p_factura_id;

  IF v_items_count = 0 THEN
    v_faltantes := array_append(v_faltantes, 'conceptos');
  END IF;

  lista := COALESCE(array_length(v_faltantes, 1), 0) = 0;
  faltantes := v_faltantes;

  UPDATE public.facturas
  SET
    timbrado_listo = lista,
    ultima_validacion = now(),
    estado_timbrado = CASE
      WHEN lista AND estado_timbrado IN ('borrador', 'error_timbrado') THEN 'pendiente_timbrado'
      WHEN NOT lista AND estado_timbrado = 'pendiente_timbrado' THEN 'borrador'
      ELSE estado_timbrado
    END,
    updated_at = now()
  WHERE id = p_factura_id;

  RETURN NEXT;
END;
$$;

-- ----------------------------------------------------------
-- 8) crear_factura_borrador_cfdi (admin / finanzas)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_factura_borrador_cfdi(
  p_cliente_id UUID,
  p_fecha_vencimiento TIMESTAMPTZ,
  p_uso_cfdi TEXT,
  p_forma_pago TEXT,
  p_metodo_pago TEXT,
  p_moneda TEXT,
  p_notas TEXT,
  p_terminos TEXT,
  p_items JSONB,
  p_folio TEXT DEFAULT NULL,
  p_venta_origen_id UUID DEFAULT NULL
)
RETURNS TABLE(factura_id UUID, folio TEXT, estado_timbrado TEXT, timbrado_listo BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente public.clientes%ROWTYPE;
  v_cliente_sensible public.clientes_sensible%ROWTYPE;
  v_config public.facturacion_config%ROWTYPE;
  v_factura_id UUID;
  v_folio TEXT;
  v_item JSONB;
  v_cantidad NUMERIC;
  v_precio NUMERIC;
  v_descuento NUMERIC;
  v_ieps_pct NUMERIC;
  v_importe NUMERIC;
  v_subtotal NUMERIC := 0;
  v_iva NUMERIC := 0;
  v_ieps NUMERIC := 0;
  v_descuentos NUMERIC := 0;
  v_total NUMERIC := 0;
  v_lista BOOLEAN := false;
  v_faltantes TEXT[];
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La factura debe incluir conceptos';
  END IF;

  SELECT *
  INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  SELECT *
  INTO v_cliente_sensible
  FROM public.clientes_sensible
  WHERE id = p_cliente_id;

  SELECT *
  INTO v_config
  FROM public.facturacion_config
  WHERE activo = true
  ORDER BY updated_at DESC
  LIMIT 1;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_cantidad := COALESCE((v_item->>'cantidad')::NUMERIC, 0);
    v_precio := COALESCE((v_item->>'precio_unitario')::NUMERIC, 0);
    v_descuento := COALESCE((v_item->>'descuento')::NUMERIC, 0);
    v_ieps_pct := COALESCE((v_item->>'ieps_aplicable')::NUMERIC, 0);
    v_importe := round(v_cantidad * v_precio * (1 - (v_descuento / 100)), 2);

    v_subtotal := v_subtotal + v_importe;
    v_descuentos := v_descuentos + round(v_cantidad * v_precio * (v_descuento / 100), 2);

    IF COALESCE((v_item->>'iva_aplicable')::BOOLEAN, true) THEN
      v_iva := v_iva + round(v_importe * 0.16, 2);
    END IF;

    IF v_ieps_pct > 0 THEN
      v_ieps := v_ieps + round(v_importe * (v_ieps_pct / 100), 2);
    END IF;
  END LOOP;

  v_total := v_subtotal + v_iva + v_ieps;
  v_folio := COALESCE(NULLIF(trim(p_folio), ''), public.generar_folio_factura());

  INSERT INTO public.facturas (
    folio,
    cliente_id,
    venta_origen_id,
    fecha_vencimiento,
    status,
    subtotal,
    iva,
    ieps,
    total,
    metodo_pago,
    uso_cfdi,
    forma_pago,
    moneda,
    notas,
    terminos,
    receptor_nombre,
    receptor_rfc,
    receptor_regimen_fiscal,
    receptor_codigo_postal,
    receptor_email,
    receptor_direccion,
    emisor_nombre,
    emisor_rfc,
    emisor_regimen_fiscal,
    lugar_expedicion
  )
  VALUES (
    v_folio,
    p_cliente_id,
    p_venta_origen_id,
    p_fecha_vencimiento,
    'borrador',
    round(v_subtotal, 2),
    round(v_iva, 2),
    round(v_ieps, 2),
    round(v_total, 2),
    p_metodo_pago,
    p_uso_cfdi,
    p_forma_pago,
    COALESCE(NULLIF(trim(p_moneda), ''), 'MXN'),
    p_notas,
    p_terminos,
    COALESCE(NULLIF(trim(v_cliente_sensible.razon_social), ''), v_cliente.nombre),
    v_cliente_sensible.rfc,
    v_cliente_sensible.regimen_fiscal,
    v_cliente_sensible.codigo_postal,
    v_cliente_sensible.email,
    v_cliente_sensible.direccion,
    v_config.emisor_nombre,
    v_config.emisor_rfc,
    v_config.emisor_regimen_fiscal,
    v_config.codigo_postal_expedicion
  )
  RETURNING id INTO v_factura_id;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_cantidad := COALESCE((v_item->>'cantidad')::NUMERIC, 0);
    v_precio := COALESCE((v_item->>'precio_unitario')::NUMERIC, 0);
    v_descuento := COALESCE((v_item->>'descuento')::NUMERIC, 0);
    v_importe := round(v_cantidad * v_precio * (1 - (v_descuento / 100)), 2);

    INSERT INTO public.factura_detalles (
      factura_id,
      producto_id,
      descripcion,
      cantidad,
      precio_unitario,
      unidad,
      iva_aplicable,
      ieps_aplicable,
      descuento,
      subtotal,
      importe,
      clave_producto_sat,
      clave_unidad_sat,
      objeto_impuesto
    )
    VALUES (
      v_factura_id,
      NULLIF(v_item->>'producto_id', '')::UUID,
      COALESCE(v_item->>'descripcion', 'Concepto sin descripcion'),
      COALESCE((v_item->>'cantidad')::INTEGER, 0),
      round(v_precio, 2),
      COALESCE(v_item->>'unidad', 'Caja'),
      COALESCE((v_item->>'iva_aplicable')::BOOLEAN, true),
      COALESCE((v_item->>'ieps_aplicable')::NUMERIC, 0),
      round(v_descuento, 2),
      round(v_importe, 2),
      round(v_importe, 2),
      v_item->>'clave_producto_sat',
      v_item->>'clave_unidad_sat',
      COALESCE(v_item->>'objeto_impuesto', '02')
    );
  END LOOP;

  INSERT INTO public.factura_eventos (factura_id, tipo_evento, payload)
  VALUES (
    v_factura_id,
    'factura_creada',
    jsonb_build_object(
      'folio', v_folio,
      'cliente_id', p_cliente_id,
      'total', round(v_total, 2)
    )
  );

  SELECT lista, faltantes
  INTO v_lista, v_faltantes
  FROM public.evaluar_factura_para_timbrado(v_factura_id);

  INSERT INTO public.factura_eventos (factura_id, tipo_evento, payload)
  VALUES (
    v_factura_id,
    'validacion_timbrado',
    jsonb_build_object(
      'lista', v_lista,
      'faltantes', COALESCE(to_jsonb(v_faltantes), '[]'::jsonb)
    )
  );

  factura_id := v_factura_id;
  folio := v_folio;
  estado_timbrado := CASE WHEN v_lista THEN 'pendiente_timbrado' ELSE 'borrador' END;
  timbrado_listo := v_lista;
  RETURN NEXT;
END;
$$;

-- ----------------------------------------------------------
-- 9) registrar_resultado_timbrado_factura (admin / finanzas)
--    Crítico: marca una factura como timbrada con UUID fiscal.
--    Solo finanzas/admin deben poder hacerlo.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_resultado_timbrado_factura(
  p_factura_id UUID,
  p_proveedor_pac TEXT,
  p_exito BOOLEAN,
  p_uuid_fiscal TEXT DEFAULT NULL,
  p_xml_url TEXT DEFAULT NULL,
  p_pdf_url TEXT DEFAULT NULL,
  p_request_payload JSONB DEFAULT NULL,
  p_response_payload JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS public.facturas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura public.facturas%ROWTYPE;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO public.factura_timbrado_intentos (
    factura_id,
    proveedor_pac,
    exito,
    request_payload,
    response_payload,
    error_message
  )
  VALUES (
    p_factura_id,
    p_proveedor_pac,
    p_exito,
    p_request_payload,
    p_response_payload,
    p_error_message
  );

  UPDATE public.facturas
  SET
    pac_proveedor = p_proveedor_pac,
    estado_timbrado = CASE WHEN p_exito THEN 'timbrada' ELSE 'error_timbrado' END,
    uuid_fiscal = CASE WHEN p_exito THEN p_uuid_fiscal ELSE uuid_fiscal END,
    fecha_timbrado = CASE WHEN p_exito THEN now() ELSE fecha_timbrado END,
    xml_url = COALESCE(p_xml_url, xml_url),
    pdf_url = COALESCE(p_pdf_url, pdf_url),
    pac_respuesta = COALESCE(p_response_payload, pac_respuesta),
    pac_error = CASE WHEN p_exito THEN NULL ELSE p_error_message END,
    status = CASE WHEN p_exito THEN 'enviada' ELSE status END,
    updated_at = now()
  WHERE id = p_factura_id
  RETURNING *
  INTO v_factura;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  INSERT INTO public.factura_eventos (factura_id, tipo_evento, payload)
  VALUES (
    p_factura_id,
    CASE WHEN p_exito THEN 'timbrado_exitoso' ELSE 'timbrado_error' END,
    jsonb_build_object(
      'proveedor_pac', p_proveedor_pac,
      'uuid_fiscal', p_uuid_fiscal,
      'xml_url', p_xml_url,
      'pdf_url', p_pdf_url,
      'error', p_error_message
    )
  );

  RETURN v_factura;
END;
$$;

