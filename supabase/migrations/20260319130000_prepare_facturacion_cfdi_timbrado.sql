-- Preparar estructura de facturacion para CFDI 4.0 / timbrado real

-- 1) Datos fiscales sensibles del cliente
ALTER TABLE public.clientes_sensible
  ADD COLUMN IF NOT EXISTS rfc TEXT,
  ADD COLUMN IF NOT EXISTS razon_social TEXT,
  ADD COLUMN IF NOT EXISTS regimen_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS codigo_postal TEXT,
  ADD COLUMN IF NOT EXISTS uso_cfdi_default TEXT,
  ADD COLUMN IF NOT EXISTS metodo_pago_default TEXT,
  ADD COLUMN IF NOT EXISTS forma_pago_default TEXT,
  ADD COLUMN IF NOT EXISTS pais TEXT DEFAULT 'MEX';

-- 2) Configuracion del emisor y PAC
CREATE TABLE IF NOT EXISTS public.facturacion_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activo BOOLEAN NOT NULL DEFAULT true,
  serie_facturas TEXT NOT NULL DEFAULT 'F',
  emisor_nombre TEXT,
  emisor_rfc TEXT,
  emisor_regimen_fiscal TEXT,
  codigo_postal_expedicion TEXT,
  certificado_csd_no TEXT,
  certificado_cer_url TEXT,
  llave_privada_key_url TEXT,
  llave_privada_passphrase TEXT,
  pac_proveedor TEXT,
  pac_api_url TEXT,
  pac_modo TEXT NOT NULL DEFAULT 'sandbox',
  pac_usuario TEXT,
  pac_password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.facturacion_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Facturacion config role select" ON public.facturacion_config;
CREATE POLICY "Facturacion config role select"
ON public.facturacion_config
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

DROP POLICY IF EXISTS "Facturacion config role write" ON public.facturacion_config;
CREATE POLICY "Facturacion config role write"
ON public.facturacion_config
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

GRANT ALL ON public.facturacion_config TO authenticated;
GRANT ALL ON public.facturacion_config TO service_role;

-- 3) Crear tablas base de facturacion si aun no existen
CREATE TABLE IF NOT EXISTS public.facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  fecha_emision TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_vencimiento TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'borrador',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  iva DECIMAL(12,2) NOT NULL DEFAULT 0,
  ieps DECIMAL(12,2) NOT NULL DEFAULT 0,
  retenciones DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  metodo_pago TEXT,
  uso_cfdi TEXT,
  forma_pago TEXT,
  notas TEXT,
  terminos TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.factura_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  producto_id UUID,
  descripcion TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 0,
  precio_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
  unidad TEXT NOT NULL DEFAULT 'Caja',
  iva_aplicable BOOLEAN DEFAULT true,
  ieps_aplicable DECIMAL(5,2) DEFAULT 0,
  descuento DECIMAL(5,2) DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factura_detalles ENABLE ROW LEVEL SECURITY;

-- 4) Completar tabla facturas con campos fiscales y de timbrado
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS venta_origen_id UUID REFERENCES public.ventas(id),
  ADD COLUMN IF NOT EXISTS version_cfdi TEXT NOT NULL DEFAULT '4.0',
  ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS tipo_cambio NUMERIC(12,6),
  ADD COLUMN IF NOT EXISTS lugar_expedicion TEXT,
  ADD COLUMN IF NOT EXISTS exportacion TEXT NOT NULL DEFAULT '01',
  ADD COLUMN IF NOT EXISTS estado_timbrado TEXT NOT NULL DEFAULT 'borrador',
  ADD COLUMN IF NOT EXISTS timbrado_listo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultima_validacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receptor_nombre TEXT,
  ADD COLUMN IF NOT EXISTS receptor_rfc TEXT,
  ADD COLUMN IF NOT EXISTS receptor_regimen_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS receptor_codigo_postal TEXT,
  ADD COLUMN IF NOT EXISTS receptor_email TEXT,
  ADD COLUMN IF NOT EXISTS receptor_direccion TEXT,
  ADD COLUMN IF NOT EXISTS emisor_nombre TEXT,
  ADD COLUMN IF NOT EXISTS emisor_rfc TEXT,
  ADD COLUMN IF NOT EXISTS emisor_regimen_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS uuid_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS fecha_timbrado TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pac_proveedor TEXT,
  ADD COLUMN IF NOT EXISTS xml_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS xml_payload JSONB,
  ADD COLUMN IF NOT EXISTS pac_respuesta JSONB,
  ADD COLUMN IF NOT EXISTS pac_error TEXT;

CREATE INDEX IF NOT EXISTS idx_facturas_cliente_id ON public.facturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado_timbrado ON public.facturas(estado_timbrado);
CREATE INDEX IF NOT EXISTS idx_facturas_timbrado_listo ON public.facturas(timbrado_listo);

-- 5) Completar detalle con claves SAT y objeto de impuesto
ALTER TABLE public.factura_detalles
  ADD COLUMN IF NOT EXISTS clave_producto_sat TEXT,
  ADD COLUMN IF NOT EXISTS clave_unidad_sat TEXT,
  ADD COLUMN IF NOT EXISTS objeto_impuesto TEXT NOT NULL DEFAULT '02',
  ADD COLUMN IF NOT EXISTS importe NUMERIC(12,2);

-- 6) Auditoria de facturas / timbrado
CREATE TABLE IF NOT EXISTS public.factura_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.factura_timbrado_intentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  proveedor_pac TEXT,
  exito BOOLEAN NOT NULL DEFAULT false,
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.factura_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factura_timbrado_intentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Factura eventos role access" ON public.factura_eventos;
CREATE POLICY "Factura eventos role access"
ON public.factura_eventos
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

DROP POLICY IF EXISTS "Factura timbrado intentos role access" ON public.factura_timbrado_intentos;
CREATE POLICY "Factura timbrado intentos role access"
ON public.factura_timbrado_intentos
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

GRANT ALL ON public.factura_eventos TO authenticated;
GRANT ALL ON public.factura_eventos TO service_role;
GRANT ALL ON public.factura_timbrado_intentos TO authenticated;
GRANT ALL ON public.factura_timbrado_intentos TO service_role;

-- 7) Reemplazar politicas laxas si la migracion original ya corrio
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.facturas;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.factura_detalles;

DROP POLICY IF EXISTS "Facturas role access" ON public.facturas;
CREATE POLICY "Facturas role access"
ON public.facturas
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

DROP POLICY IF EXISTS "Factura detalles role access" ON public.factura_detalles;
CREATE POLICY "Factura detalles role access"
ON public.factura_detalles
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

-- 8) Folio de factura
CREATE OR REPLACE FUNCTION public.generar_folio_factura()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_serie TEXT := 'F';
BEGIN
  SELECT COALESCE(serie_facturas, 'F')
  INTO v_serie
  FROM public.facturacion_config
  WHERE activo = true
  ORDER BY updated_at DESC
  LIMIT 1;

  RETURN format(
    '%s-%s-%s',
    v_serie,
    to_char(now(), 'YYYYMMDD'),
    lpad((floor(random() * 100000))::INT::TEXT, 5, '0')
  );
END;
$$;

-- 9) Evaluacion de factura lista para timbrado
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

-- 10) Crear factura borrador con snapshot fiscal listo para PAC
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

-- 11) Registrar respuesta del PAC / timbrado real
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
