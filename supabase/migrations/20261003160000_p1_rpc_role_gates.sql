-- P1 roles: gates por rol en RPC SECURITY DEFINER + higiene de grants.
--
-- Hallazgo (barrido neto de supabase/migrations): las 55 tablas creadas
-- tienen RLS + políticas y las 60 políticas permisivas históricas fueron
-- dadas de baja; el frente abierto restante son RPC DEFINER sin gate:
--  1. crear_factura_borrador_cfdi: sin gate; crea facturas CFDI. Único
--     llamador: useFacturacion (/facturacion -> finanzas). Gate admin/finanzas.
--     La llamada anidada a evaluar_factura_para_timbrado (admin/finanzas/
--     ventas) sigue pasando para esos roles.
--  2. siguiente_folio_recepcion: solo exigía auth.uid() NOT NULL. Único
--     llamador: useRecepcion (/recepcion -> almacen). Gate admin/almacen.
--  3. generar_folio_factura, sync_cxp_from_lote, sync_cxp_after_liquidacion:
--     solo uso interno/trigger, sin llamadores en app. Se revoca EXECUTE
--     (los triggers siguen disparando; DEFINER corre como owner).
--  4. Higiene de grants en los 2 anteriores + procesar_venta_cdmx (ambas
--     firmas, ya con gate): REVOKE FROM PUBLIC, anon y GRANT explícito a
--     authenticated + service_role.
-- Verificado y NO tocado: procesar_venta_cdmx ya tiene gate (la firma de
-- 3 args delega en la de 4, que exige admin/ventas); recalcular_saldo_
-- productor ya tiene REVOKE FROM PUBLIC ("uso interno"). Nota: venta exige
-- admin/ventas aunque la ruta admite almacen/finanzas; si un cajero con
-- esos roles debe cobrar, es decisión de producto (no ampliado aquí).
--
-- Verificación sugerida tras aplicar (SQL Editor):
--   select grantee, privilege_type from information_schema.routine_privileges
--   where specific_schema='public' and routine_name in
--   ('crear_factura_borrador_cfdi','siguiente_folio_recepcion',
--    'generar_folio_factura','sync_cxp_from_lote',
--    'sync_cxp_after_liquidacion','procesar_venta_cdmx');

-- =========================
-- 1) crear_factura_borrador_cfdi: gate admin/finanzas
-- =========================
DROP FUNCTION IF EXISTS public.crear_factura_borrador_cfdi(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID);
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
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

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

REVOKE ALL ON FUNCTION public.crear_factura_borrador_cfdi(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_factura_borrador_cfdi(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID) TO authenticated, service_role;

-- =========================
-- 2) siguiente_folio_recepcion: gate admin/almacen
-- =========================
DROP FUNCTION IF EXISTS public.siguiente_folio_recepcion();
CREATE OR REPLACE FUNCTION public.siguiente_folio_recepcion()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anio TEXT := to_char(now(), 'YYYY');
  v_seq  INTEGER;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COALESCE(
           MAX(NULLIF(regexp_replace(l.folio_recepcion, '^REC-[0-9]{4}-', ''), '')::INTEGER),
           0
         ) + 1
    INTO v_seq
  FROM public.lotes l
  WHERE l.folio_recepcion LIKE 'REC-' || v_anio || '-%';

  RETURN 'REC-' || v_anio || '-' || lpad(v_seq::TEXT, 3, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.siguiente_folio_recepcion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siguiente_folio_recepcion() TO authenticated, service_role;

-- =========================
-- 3) Uso interno/trigger: sin EXECUTE para clientes
-- =========================
REVOKE ALL ON FUNCTION public.generar_folio_factura() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.generar_folio_factura() IS
  'Uso interno: solo la invoca crear_factura_borrador_cfdi. No expuesta a la API.';

REVOKE ALL ON FUNCTION public.sync_cxp_from_lote() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.sync_cxp_from_lote() IS
  'Trigger trg_sync_cxp_from_lote (lotes). No invocable directo.';

REVOKE ALL ON FUNCTION public.sync_cxp_after_liquidacion() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.sync_cxp_after_liquidacion() IS
  'Trigger trg_sync_cxp_after_liquidacion (liquidacion_lotes). No invocable directo.';

-- =========================
-- 4) Higiene de grants en venta POS (ya con gate)
-- =========================
REVOKE ALL ON FUNCTION public.procesar_venta_cdmx(JSONB, TEXT, DECIMAL, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procesar_venta_cdmx(JSONB, TEXT, DECIMAL, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.procesar_venta_cdmx(JSONB, TEXT, DECIMAL) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procesar_venta_cdmx(JSONB, TEXT, DECIMAL) TO authenticated, service_role;
