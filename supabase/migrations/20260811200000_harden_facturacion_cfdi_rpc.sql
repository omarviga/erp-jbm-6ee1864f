-- Blindar facturacion CFDI contra configuracion ausente
-- El RPC crear_factura_borrador_cfdi accedia a v_config.emisor_* y
-- v_cliente_sensible.* sin comprobar FOUND. Si no existe una fila activa en
-- facturacion_config o una fila en clientes_sensible, PL/pgSQL lanza
-- "record has not been assigned yet" y la factura nunca se crea.
-- Ahora los valores emisor/receptor se resuelven con subconsultas escalares
-- (NULL-safe) y generar_folio_factura() siempre devuelve serie 'F' como fallback.

CREATE OR REPLACE FUNCTION public.generar_folio_factura()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_serie TEXT := 'F';
BEGIN
  SELECT serie_facturas
  INTO v_serie
  FROM public.facturacion_config
  WHERE activo = true
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_serie IS NULL OR trim(v_serie) = '' THEN
    v_serie := 'F';
  END IF;

  RETURN format(
    '%s-%s-%s',
    v_serie,
    to_char(now(), 'YYYYMMDD'),
    lpad((floor(random() * 100000))::INT::TEXT, 5, '0')
  );
END;
$$;

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
  v_cliente_nombre TEXT;
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
  v_receptor_nombre TEXT;
  v_receptor_rfc TEXT;
  v_receptor_regimen TEXT;
  v_receptor_cp TEXT;
  v_receptor_email TEXT;
  v_receptor_direccion TEXT;
  v_emisor_nombre TEXT;
  v_emisor_rfc TEXT;
  v_emisor_regimen TEXT;
  v_lugar_expedicion TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La factura debe incluir conceptos';
  END IF;

  SELECT nombre
  INTO v_cliente_nombre
  FROM public.clientes
  WHERE id = p_cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  SELECT
    COALESCE(NULLIF(trim(cs.razon_social), ''), v_cliente_nombre),
    cs.rfc,
    cs.regimen_fiscal,
    cs.codigo_postal,
    cs.email,
    cs.direccion
  INTO v_receptor_nombre, v_receptor_rfc, v_receptor_regimen, v_receptor_cp, v_receptor_email, v_receptor_direccion
  FROM public.clientes_sensible cs
  WHERE cs.id = p_cliente_id;

  IF NOT FOUND THEN
    v_receptor_nombre := v_cliente_nombre;
  END IF;

  SELECT
    c.emisor_nombre,
    c.emisor_rfc,
    c.emisor_regimen_fiscal,
    c.codigo_postal_expedicion
  INTO v_emisor_nombre, v_emisor_rfc, v_emisor_regimen, v_lugar_expedicion
  FROM public.facturacion_config c
  WHERE c.activo = true
  ORDER BY c.updated_at DESC
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
    v_receptor_nombre,
    v_receptor_rfc,
    v_receptor_regimen,
    v_receptor_cp,
    v_receptor_email,
    v_receptor_direccion,
    v_emisor_nombre,
    v_emisor_rfc,
    v_emisor_regimen,
    v_lugar_expedicion
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
