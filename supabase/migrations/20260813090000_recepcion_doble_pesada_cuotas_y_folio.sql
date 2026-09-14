-- ==========================================================
-- RECEPCIÓN: DOBLE PESADA, TRANSPORTE, VARIEDAD, CUOTAS Y
-- FOLIO CONSECUTIVO OFICIAL (REC-YYYY-NNN)
--
-- Motivo: el módulo de Recepción no persistía huerto_id ni los
-- cortadores del lote, no distinguía cosecha propia en
-- es_cosecha_propia (lo que generaba notas de CxP infladas con
-- precios por caja tratados como precio por kilo), y no existía
-- forma de registrar transporte (chofer / placas / rejas),
-- variedad del fruto, cuota de maniobra ni el cobro de báscula
-- liquidado en efectivo contra descontado de la liquidación.
--
-- Regla vigente (docs/PESO_NETO_RULE.md): peso_neto es la única
-- base de cálculo. En esta BD peso_neto es una columna GENERATED
-- (peso_bruto - peso_tara), por lo que la tara de rejas/tarimas
-- se suma dentro de peso_tara y se conserva el desglose en
-- tara_rejas_kg para el ticket.
--
-- Idempotente: seguro de ejecutar varias veces.
-- ==========================================================

-- ----------------------------------------------------------
-- 1) Columnas nuevas en public.lotes
-- ----------------------------------------------------------
ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS folio_recepcion      TEXT,
  ADD COLUMN IF NOT EXISTS variedad             TEXT,
  ADD COLUMN IF NOT EXISTS chofer               TEXT,
  ADD COLUMN IF NOT EXISTS placas               TEXT,
  ADD COLUMN IF NOT EXISTS rejas                INTEGER,
  ADD COLUMN IF NOT EXISTS tara_rejas_kg        NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bascula_forma_pago   TEXT NOT NULL DEFAULT 'liquidacion',
  ADD COLUMN IF NOT EXISTS cuota_maniobra_kg    NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cuota_maniobra_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_caja_cortador NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pago_cortadores_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peso_bruto_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS peso_tara_at         TIMESTAMPTZ;

COMMENT ON COLUMN public.lotes.folio_recepcion IS 'Folio consecutivo oficial de recepción (REC-YYYY-NNN)';
COMMENT ON COLUMN public.lotes.tara_rejas_kg IS 'Desglose informativo de la tara de rejas/tarimas incluida dentro de peso_tara';
COMMENT ON COLUMN public.lotes.bascula_forma_pago IS 'efectivo = se cobró al momento; liquidacion = se descuenta del pago al productor';
COMMENT ON COLUMN public.lotes.cuota_maniobra_kg IS 'Cuota operativa por kilo (descarga/estiba/patio)';
COMMENT ON COLUMN public.lotes.precio_caja_cortador IS 'Precio por caja de referencia para el pago a cortadores (cosecha propia)';
COMMENT ON COLUMN public.lotes.peso_bruto_at IS 'Marca de tiempo de la primera pesada (camión cargado)';
COMMENT ON COLUMN public.lotes.peso_tara_at IS 'Marca de tiempo de la segunda pesada (vehículo vacío)';

-- Restricciones de integridad (idempotentes)
ALTER TABLE public.lotes DROP CONSTRAINT IF EXISTS lotes_bascula_forma_pago_check;
ALTER TABLE public.lotes ADD CONSTRAINT lotes_bascula_forma_pago_check
  CHECK (bascula_forma_pago IN ('efectivo', 'liquidacion'));

ALTER TABLE public.lotes DROP CONSTRAINT IF EXISTS lotes_rejas_check;
ALTER TABLE public.lotes ADD CONSTRAINT lotes_rejas_check
  CHECK (rejas IS NULL OR rejas >= 0);

ALTER TABLE public.lotes DROP CONSTRAINT IF EXISTS lotes_montos_no_negativos_check;
ALTER TABLE public.lotes ADD CONSTRAINT lotes_montos_no_negativos_check
  CHECK (
    COALESCE(costo_bascula, 0) >= 0
    AND COALESCE(cuota_maniobra_kg, 0) >= 0
    AND COALESCE(tara_rejas_kg, 0) >= 0
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_lotes_folio_recepcion_unique
  ON public.lotes (folio_recepcion)
  WHERE folio_recepcion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lotes_folio_fisico
  ON public.lotes (folio_fisico);

CREATE INDEX IF NOT EXISTS idx_lotes_variedad
  ON public.lotes (variedad);

-- ----------------------------------------------------------
-- 2) Folio consecutivo oficial
--    Formato: REC-<año>-<consecutivo de 3 dígitos>
-- ----------------------------------------------------------
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
  IF auth.uid() IS NULL THEN
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

GRANT EXECUTE ON FUNCTION public.siguiente_folio_recepcion() TO authenticated;

-- ----------------------------------------------------------
-- 3) CxP: la cuota de maniobra reduce el importe y la báscula
--    solo se descuenta cuando se liquidó contra el lote.
--    Retrocompatible: filas historicas tienen 0 / 'liquidacion'.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_cxp_from_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_importe NUMERIC;
  v_kilos_netos NUMERIC;
  v_kilos_pagables NUMERIC;
  v_precio NUMERIC;
  v_bascula_descontada NUMERIC;
BEGIN
  -- Rechazados, sin precio, cosecha propia o sin productor: no generan nota CxP.
  IF NEW.es_cosecha_propia IS TRUE
     OR COALESCE(LOWER(NEW.estado_calidad), 'aceptado') = 'rechazado'
     OR COALESCE(NEW.precio_pactado_kg, 0) <= 0
     OR NEW.productor_id IS NULL THEN
    -- Si ya existe una nota y dejo de calificar, se marca como pagada
    -- (saldo 0) y se conserva el historico ligado a abonos.
    UPDATE public.cuentas_por_pagar c
    SET saldo_pendiente = 0,
        estado = 'pagado',
        updated_at = now()
    WHERE c.lote_id = NEW.id;
    RETURN NEW;
  END IF;

  v_kilos_netos     := COALESCE(NEW.peso_neto, 0);
  v_kilos_pagables  := COALESCE(NEW.peso_pagable, NEW.peso_neto, 0);
  v_precio          := COALESCE(NEW.precio_pactado_kg, 0);
  v_bascula_descontada := CASE
                            WHEN COALESCE(NEW.bascula_forma_pago, 'liquidacion') = 'liquidacion'
                              THEN COALESCE(NEW.costo_bascula, 0)
                            ELSE 0
                          END;

  v_importe := GREATEST(
    0,
    round(
      (v_kilos_pagables * v_precio)
      - v_bascula_descontada
      - COALESCE(NEW.cuota_maniobra_total, 0),
      2
    )
  );

  -- Upsert de la nota
  INSERT INTO public.cuentas_por_pagar (
    lote_id, productor_id, numero_lote, fecha_ticket,
    kilos_netos, kilos_pagables, precio_kg,
    monto_total, monto_pagado, saldo_pendiente, estado, updated_at
  )
  VALUES (
    NEW.id, NEW.productor_id, NEW.numero_lote, NEW.fecha_recepcion,
    v_kilos_netos, v_kilos_pagables, v_precio,
    v_importe, 0, v_importe, 'pendiente', now()
  )
  ON CONFLICT (lote_id) DO UPDATE SET
    productor_id     = EXCLUDED.productor_id,
    numero_lote      = EXCLUDED.numero_lote,
    fecha_ticket     = EXCLUDED.fecha_ticket,
    kilos_netos      = EXCLUDED.kilos_netos,
    kilos_pagables   = EXCLUDED.kilos_pagables,
    precio_kg        = EXCLUDED.precio_kg,
    monto_total      = EXCLUDED.monto_total,
    saldo_pendiente  = GREATEST(0, EXCLUDED.monto_total - COALESCE(cuentas_por_pagar.monto_pagado, 0)),
    estado           = CASE
                         WHEN GREATEST(0, EXCLUDED.monto_total - COALESCE(cuentas_por_pagar.monto_pagado, 0)) <= 0.009 THEN 'pagado'
                         ELSE 'pendiente'
                       END,
    updated_at       = now();

  RETURN NEW;
END;
$$;

-- Se agregan las columnas nuevas a la lista del trigger para que
-- editar la maniobra o la forma de pago recalcule la nota.
DROP TRIGGER IF EXISTS trg_sync_cxp_from_lote ON public.lotes;
CREATE TRIGGER trg_sync_cxp_from_lote
  AFTER INSERT OR UPDATE OF es_cosecha_propia, estado_calidad, precio_pactado_kg,
                             costo_bascula, bascula_forma_pago, cuota_maniobra_total,
                             peso_neto, peso_pagable, productor_id,
                             numero_lote, fecha_recepcion
  ON public.lotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cxp_from_lote();

-- ----------------------------------------------------------
-- 4) Saldo del productor alineado con cuentas_por_pagar:
--    excluye cosecha propia y respeta maniobra / forma de pago.
-- ----------------------------------------------------------
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
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol admin, produccion, finanzas o almacen.';
  END IF;

  IF p_productor_id IS NULL THEN
    RAISE EXCEPTION 'productor_id es requerido';
  END IF;

  SELECT COALESCE(SUM(
    GREATEST(
      0,
      round(
        (COALESCE(l.peso_pagable, l.peso_neto, 0) * COALESCE(l.precio_pactado_kg, 0))
        - CASE
            WHEN COALESCE(l.bascula_forma_pago, 'liquidacion') = 'liquidacion'
              THEN COALESCE(l.costo_bascula, 0)
            ELSE 0
          END
        - COALESCE(l.cuota_maniobra_total, 0),
        2
      )
    )
  ), 0)
  INTO v_total_pendiente
  FROM public.lotes l
  WHERE l.productor_id = p_productor_id
    AND COALESCE(l.es_cosecha_propia, false) = false
    AND COALESCE(LOWER(l.estado_calidad), 'aceptado') <> 'rechazado'
    AND NOT EXISTS (
      SELECT 1 FROM public.liquidacion_lotes ll
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
-- 5) registrar_recepcion: alta transaccional del lote
--    (lote + cortadores + CxP) con folio consecutivo.
--    Reemplaza el insert suelto desde el frontend.
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
  v_precio_caja NUMERIC := COALESCE(NULLIF(p_datos->>'precio_caja_cortador', '')::NUMERIC, 0);
  v_rejas INTEGER := NULLIF(p_datos->>'rejas', '')::INTEGER;
  v_estado_calidad TEXT := COALESCE(NULLIF(p_datos->>'estado_calidad', ''), 'aceptado');
  v_origen TEXT := COALESCE(NULLIF(p_datos->>'origen', ''), 'externo');
  v_es_propia BOOLEAN := COALESCE((p_datos->>'es_cosecha_propia')::BOOLEAN, v_origen = 'interno');

  v_bruto_at TIMESTAMPTZ := COALESCE(NULLIF(p_datos->>'peso_bruto_at', '')::TIMESTAMPTZ, now());
  v_tara_at TIMESTAMPTZ := NULLIF(p_datos->>'peso_tara_at', '')::TIMESTAMPTZ;

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

  -- La tara de rejas/tarimas forma parte de peso_tara porque
  -- peso_neto es una columna generada (peso_bruto - peso_tara).
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
    cuota_maniobra_kg, cuota_maniobra_total,
    folio_fisico, folio_recepcion, variedad, chofer, placas, rejas,
    calidad_defectos, origen, estado_calidad, notas,
    peso_pagable, kilos_merma, numero_lote, fecha_recepcion, estado,
    usuario_id, peso_bruto_at, peso_tara_at
  ) VALUES (
    v_productor_id, v_huerto_id, v_es_propia,
    v_peso_bruto, v_tara_total, v_tara_rejas,
    v_precio, v_precio_caja, 0,
    COALESCE(NULLIF(p_datos->>'zona_asignada', ''), 'linea_produccion'),
    v_bascula, v_forma_pago,
    v_maniobra_kg, v_maniobra_total,
    COALESCE(p_datos->>'folio_fisico', ''),
    v_folio,
    NULLIF(p_datos->>'variedad', ''),
    NULLIF(p_datos->>'chofer', ''),
    NULLIF(p_datos->>'placas', ''),
    v_rejas,
    v_defectos, v_origen, v_estado_calidad, COALESCE(p_datos->>'notas', ''),
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

GRANT EXECUTE ON FUNCTION public.registrar_recepcion(JSONB) TO authenticated;

-- ----------------------------------------------------------
-- 6) Recargar el cache de esquema de PostgREST para que las
--    columnas y RPC nuevas queden visibles de inmediato.
-- ----------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------
-- 7) DIAGNÓSTICO (solo lectura, no modifica nada)
--
-- Lotes de cosecha propia guardados por la version anterior del
-- formulario: quedaron con es_cosecha_propia = false y con el
-- precio por caja escrito en precio_pactado_kg, lo que genera
-- notas de CxP infladas. Revisar antes de decidir una correccion:
--
-- SELECT l.id, l.numero_lote, l.fecha_recepcion, l.origen,
--        l.precio_pactado_kg, l.peso_neto, l.huerto_id,
--        c.monto_total, c.estado
-- FROM public.lotes l
-- LEFT JOIN public.cuentas_por_pagar c ON c.lote_id = l.id
-- WHERE l.es_cosecha_propia IS NOT TRUE
--   AND l.huerto_id IS NOT NULL
--   AND COALESCE(l.precio_pactado_kg, 0) > 0
-- ORDER BY l.fecha_recepcion DESC;
-- ----------------------------------------------------------
