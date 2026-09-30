-- ==========================================================
-- RECEPCIÓN: OPERADOR DE BÁSCULA Y CONCEPTO DEL CARGO
--
-- Cambios de operación solicitados:
--   * Se elimina el bloque de transporte (chofer, placas,
--     rejas/huacales) y la tara de rejas: la recepción captura
--     una sola tara del vehículo.
--   * Se elimina el selector de variedad: en Michoacán solo se
--     trabaja Limón Mexicano, así que se fija como constante.
--   * El huerto solo aplica a cosecha propia.
--   * Se agrega el operador de báscula responsable (trazabilidad).
--   * El cargo por kilo lleva concepto (ej. "Servicios operativos
--     y maniobra").
--
-- Las columnas de transporte de la migración anterior se conservan
-- (no se eliminan datos); simplemente dejan de capturarse desde la
-- interfaz y quedan en NULL / 0.
--
-- Idempotente: seguro de ejecutar varias veces.
-- ==========================================================

-- ----------------------------------------------------------
-- 1) Columnas nuevas en public.lotes
-- ----------------------------------------------------------
ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS operador_bascula        TEXT,
  ADD COLUMN IF NOT EXISTS cuota_maniobra_concepto TEXT;

COMMENT ON COLUMN public.lotes.operador_bascula IS
  'Nombre del operador de báscula responsable de la recepción (trazabilidad).';
COMMENT ON COLUMN public.lotes.cuota_maniobra_concepto IS
  'Concepto del cargo operativo por kilo (ej. Servicios operativos y maniobra).';

-- ----------------------------------------------------------
-- 2) Variedad única de trabajo
--    En la zona solo se recibe Limón Mexicano. Se completa el dato
--    en los lotes históricos que lo tengan vacío para que los
--    reportes por variedad sean consistentes. No sobrescribe
--    valores ya capturados.
-- ----------------------------------------------------------
UPDATE public.lotes
SET variedad = 'Limón Mexicano'
WHERE variedad IS NULL
   OR BTRIM(variedad) = '';

-- ----------------------------------------------------------
-- 3) registrar_recepcion: se agregan operador_bascula y
--    cuota_maniobra_concepto al alta transaccional.
--    El resto de la lógica queda igual.
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_recepcion(JSONB);

CREATE OR REPLACE FUNCTION public.registrar_recepcion(p_datos JSONB)
RETURNS TABLE (
  lote_id UUID,
  folio_recepcion TEXT,
  numero_lote TEXT,
  peso_neto NUMERIC,
  subtotal NUMERIC,
  costo_bascula NUMERIC,
  bascula_forma_pago TEXT,
  cuota_maniobra_total NUMERIC,
  total_liquidar NUMERIC,
  saldo_pendiente_productor NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote_id UUID;
  v_folio TEXT;
  v_numero_lote TEXT;
  v_anio TEXT := to_char(now(), 'YYYY');
  v_seq INTEGER;
  v_intentos INTEGER := 0;

  v_productor_id UUID := NULLIF(p_datos->>'productor_id', '')::UUID;
  v_huerto_id UUID := NULLIF(p_datos->>'huerto_id', '')::UUID;
  v_peso_bruto NUMERIC := COALESCE(NULLIF(p_datos->>'peso_bruto', '')::NUMERIC, 0);
  v_tara_vehiculo NUMERIC := COALESCE(NULLIF(p_datos->>'peso_tara', '')::NUMERIC, 0);
  v_tara_rejas NUMERIC := COALESCE(NULLIF(p_datos->>'tara_rejas_kg', '')::NUMERIC, 0);
  v_precio NUMERIC := COALESCE(NULLIF(p_datos->>'precio_pactado_kg', '')::NUMERIC, 0);
  v_defectos NUMERIC := COALESCE(NULLIF(p_datos->>'calidad_defectos', '')::NUMERIC, 0);
  v_bascula NUMERIC := COALESCE(NULLIF(p_datos->>'costo_bascula', '')::NUMERIC, 0);
  v_forma_pago TEXT := COALESCE(NULLIF(p_datos->>'bascula_forma_pago', ''), 'liquidacion');
  v_maniobra_kg NUMERIC := COALESCE(NULLIF(p_datos->>'cuota_maniobra_kg', '')::NUMERIC, 0);
  v_maniobra_concepto TEXT := COALESCE(
    NULLIF(BTRIM(p_datos->>'cuota_maniobra_concepto'), ''),
    'Servicios operativos y maniobra'
  );
  v_operador TEXT := NULLIF(BTRIM(p_datos->>'operador_bascula'), '');
  v_variedad TEXT := COALESCE(NULLIF(BTRIM(p_datos->>'variedad'), ''), 'Limón Mexicano');
  v_precio_caja NUMERIC := COALESCE(NULLIF(p_datos->>'precio_caja_cortador', '')::NUMERIC, 0);
  v_rejas INTEGER := NULLIF(p_datos->>'rejas', '')::INTEGER;
  v_estado_calidad TEXT := COALESCE(NULLIF(p_datos->>'estado_calidad', ''), 'aceptado');
  v_origen TEXT := COALESCE(NULLIF(p_datos->>'origen', ''), 'externo');
  v_es_propia BOOLEAN := COALESCE((p_datos->>'es_cosecha_propia')::BOOLEAN, v_origen = 'interno');

  v_bruto_at TIMESTAMPTZ := COALESCE(NULLIF(p_datos->>'peso_bruto_at', '')::TIMESTAMPTZ, now());
  v_tara_at TIMESTAMPTZ := COALESCE(NULLIF(p_datos->>'peso_tara_at', '')::TIMESTAMPTZ, now());

  v_tara_total NUMERIC;
  v_peso_neto NUMERIC;
  v_subtotal NUMERIC;
  v_maniobra_total NUMERIC;
  v_pago_cortadores NUMERIC := 0;
  v_bascula_descontada NUMERIC;
  v_total NUMERIC;
  v_cortador JSONB;
  v_cajas INTEGER;
  v_saldo NUMERIC := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol admin, almacen o produccion.';
  END IF;

  IF v_productor_id IS NULL THEN
    RAISE EXCEPTION 'productor_id es requerido';
  END IF;

  IF v_es_propia AND v_huerto_id IS NULL THEN
    RAISE EXCEPTION 'huerto_id es requerido para cosecha propia';
  END IF;

  IF v_peso_bruto <= 0 THEN
    RAISE EXCEPTION 'peso_bruto debe ser mayor a cero';
  END IF;

  IF v_tara_vehiculo < 0 OR v_tara_rejas < 0 OR v_precio < 0
     OR v_bascula < 0 OR v_maniobra_kg < 0 OR v_precio_caja < 0 THEN
    RAISE EXCEPTION 'Los pesos y los importes no pueden ser negativos';
  END IF;

  IF v_forma_pago NOT IN ('efectivo', 'liquidacion') THEN
    RAISE EXCEPTION 'bascula_forma_pago invalida: %', v_forma_pago;
  END IF;

  IF v_estado_calidad NOT IN ('aceptado', 'observado') THEN
    RAISE EXCEPTION 'No se puede registrar un lote con dictamen %', v_estado_calidad;
  END IF;

  -- La tara de rejas forma parte de peso_tara porque peso_neto es
  -- una columna generada (peso_bruto - peso_tara). Con el flujo
  -- nuevo llega en 0 y la tara total es la del vehículo.
  v_tara_total := v_tara_vehiculo + v_tara_rejas;
  v_peso_neto := v_peso_bruto - v_tara_total;

  IF v_peso_neto <= 0 THEN
    RAISE EXCEPTION 'Peso neto invalido: la tara total (%) es mayor o igual al peso bruto (%)',
      v_tara_total, v_peso_bruto;
  END IF;

  v_subtotal := round(v_peso_neto * v_precio, 2);
  v_maniobra_total := round(v_peso_neto * v_maniobra_kg, 2);
  v_bascula_descontada := CASE WHEN v_forma_pago = 'liquidacion' THEN v_bascula ELSE 0 END;
  v_total := GREATEST(0, round(v_subtotal - v_bascula_descontada - v_maniobra_total, 2));

  -- Folio consecutivo. El bloqueo evita que dos recepciones
  -- simultaneas tomen el mismo consecutivo.
  PERFORM pg_advisory_xact_lock(hashtext('jbm_folio_recepcion_' || v_anio));

  LOOP
    v_intentos := v_intentos + 1;

    SELECT COALESCE(
             MAX(NULLIF(regexp_replace(l.folio_recepcion, '^REC-[0-9]{4}-', ''), '')::INTEGER),
             0
           ) + 1
      INTO v_seq
    FROM public.lotes l
    WHERE l.folio_recepcion LIKE 'REC-' || v_anio || '-%';

    v_folio := 'REC-' || v_anio || '-' || lpad(v_seq::TEXT, 3, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.lotes l WHERE l.folio_recepcion = v_folio
    ) OR v_intentos >= 25;
  END LOOP;

  v_numero_lote := COALESCE(
    NULLIF(p_datos->>'numero_lote', ''),
    'L-' || right((extract(epoch FROM clock_timestamp()) * 1000)::BIGINT::TEXT, 6)
        || '-' || lpad((floor(random() * 1000))::INT::TEXT, 3, '0')
  );

  INSERT INTO public.lotes (
    productor_id, huerto_id, es_cosecha_propia,
    peso_bruto, peso_tara, tara_rejas_kg,
    precio_pactado_kg, precio_caja_cortador, pago_cortadores_total,
    zona_asignada, costo_bascula, bascula_forma_pago,
    cuota_maniobra_kg, cuota_maniobra_total, cuota_maniobra_concepto,
    folio_fisico, folio_recepcion, variedad, chofer, placas, rejas,
    calidad_defectos, origen, estado_calidad, notas, operador_bascula,
    peso_pagable, kilos_merma, numero_lote, fecha_recepcion, estado,
    usuario_id, peso_bruto_at, peso_tara_at
  ) VALUES (
    v_productor_id, v_huerto_id, v_es_propia,
    v_peso_bruto, v_tara_total, v_tara_rejas,
    v_precio, v_precio_caja, 0,
    COALESCE(NULLIF(p_datos->>'zona_asignada', ''), 'linea_produccion'),
    v_bascula, v_forma_pago,
    v_maniobra_kg, v_maniobra_total, v_maniobra_concepto,
    COALESCE(p_datos->>'folio_fisico', ''),
    v_folio,
    v_variedad,
    NULLIF(p_datos->>'chofer', ''),
    NULLIF(p_datos->>'placas', ''),
    v_rejas,
    v_defectos, v_origen, v_estado_calidad, COALESCE(p_datos->>'notas', ''),
    v_operador,
    round(v_peso_neto, 2), round(v_peso_neto * v_defectos / 100.0, 2),
    v_numero_lote, now(), 'pendiente',
    auth.uid(), v_bruto_at, v_tara_at
  )
  RETURNING id INTO v_lote_id;

  -- Cortadores (solo cosecha propia). lote_cortadores solo permite
  -- INSERT a admin/produccion por RLS, por eso se escribe aqui.
  IF jsonb_typeof(p_datos->'cortadores') = 'array' THEN
    FOR v_cortador IN SELECT value FROM jsonb_array_elements(p_datos->'cortadores')
    LOOP
      v_cajas := COALESCE(NULLIF(v_cortador->>'cajas', '')::INTEGER, 0);

      IF v_cajas > 0 AND NULLIF(v_cortador->>'id', '') IS NOT NULL THEN
        INSERT INTO public.lote_cortadores (lote_id, cortador_id, cajas_recolectadas)
        VALUES (v_lote_id, (v_cortador->>'id')::UUID, v_cajas);

        v_pago_cortadores := v_pago_cortadores + (v_cajas * v_precio_caja * 0.30);
      END IF;
    END LOOP;

    IF v_pago_cortadores > 0 THEN
      UPDATE public.lotes
      SET pago_cortadores_total = round(v_pago_cortadores, 2)
      WHERE id = v_lote_id;
    END IF;
  END IF;

  -- CxP: un error aqui nunca debe bloquear el registro del lote.
  BEGIN
    v_saldo := public.sync_productor_saldo_pendiente(v_productor_id);
  EXCEPTION WHEN OTHERS THEN
    v_saldo := 0;
    RAISE WARNING 'No se pudo recalcular el saldo pendiente del productor %: %',
      v_productor_id, SQLERRM;
  END;

  lote_id := v_lote_id;
  folio_recepcion := v_folio;
  numero_lote := v_numero_lote;
  peso_neto := round(v_peso_neto, 2);
  subtotal := v_subtotal;
  costo_bascula := v_bascula;
  bascula_forma_pago := v_forma_pago;
  cuota_maniobra_total := v_maniobra_total;
  total_liquidar := v_total;
  saldo_pendiente_productor := v_saldo;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_recepcion(JSONB) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
