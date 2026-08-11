-- ==========================================================
-- ENDURECER 'procesar_liquidacion_productor'
--
-- Motivo: la version desplegada en la BD envuelve el proceso y
-- devuelve un mensaje generico ("No se logró registrar liquidación"),
-- lo que impide saber la causa real del fallo.
--
-- Esta migracion reescribe la funcion para:
--   1. Coincidir 1:1 con la firma/parametros que usa el frontend.
--   2. Validar cada lote (pertenencia al productor, no rechazado,
--      no liquidado previamente) con mensajes precisos.
--   3. NO enmascarar errores: si algo inesperado sucede, el mensaje
--      real de PostgreSQL se muestra tal cual (visible en el toast).
--   4. Mantener la exclusion de doble liquidacion (indice unico).
--   5. Sincronizar saldo pendiente y notas CxP via triggers.
-- ==========================================================

-- Conserva la exclusion de doble liquidacion
CREATE UNIQUE INDEX IF NOT EXISTS liquidacion_lotes_lote_id_unique_idx
  ON public.liquidacion_lotes (lote_id);

DROP FUNCTION IF EXISTS public.procesar_liquidacion_productor(UUID, UUID[], NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, public.forma_pago, TEXT);

CREATE OR REPLACE FUNCTION public.procesar_liquidacion_productor(
  p_productor_id UUID,
  p_lote_ids UUID[],
  p_total_kilos NUMERIC,
  p_precio_por_kg NUMERIC,
  p_deduccion_corte NUMERIC DEFAULT 0,
  p_deduccion_flete NUMERIC DEFAULT 0,
  p_deduccion_anticipo NUMERIC DEFAULT 0,
  p_total_pagar NUMERIC DEFAULT 0,
  p_forma_pago public.forma_pago DEFAULT 'cheque',
  p_referencia_pago TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  mensaje TEXT,
  liquidacion_id UUID,
  saldo_anticipos NUMERIC,
  saldo_pendiente NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_productor RECORD;
  v_lote_id UUID;
  v_liquidacion_id UUID;
  v_lotes_count INTEGER := 0;
  v_insertados INTEGER := 0;
BEGIN
  -- Autorizacion por rol (admin / finanzas)
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finanzas'::public.app_role)) THEN
    RETURN QUERY SELECT false, 'No autorizado. Se requiere rol admin o finanzas.'::TEXT, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  IF p_productor_id IS NULL THEN
    RETURN QUERY SELECT false, 'productor_id es requerido'::TEXT, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  IF COALESCE(array_length(p_lote_ids, 1), 0) = 0 THEN
    RETURN QUERY SELECT false, 'Debes enviar al menos un lote'::TEXT, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  IF COALESCE(p_total_pagar, 0) < 0 THEN
    RETURN QUERY SELECT false, 'El total a pagar no puede ser negativo'::TEXT, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  SELECT id, nombre, COALESCE(saldo_anticipos, 0) AS saldo_anticipos
  INTO v_productor
  FROM public.productores
  WHERE id = p_productor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Productor no encontrado'::TEXT, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  IF COALESCE(p_deduccion_anticipo, 0) > COALESCE(v_productor.saldo_anticipos, 0) THEN
    RETURN QUERY SELECT false, 'La amortizacion excede el saldo de anticipos'::TEXT, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Validacion previa de cada lote (pertenencia, estado, no liquidado)
  FOREACH v_lote_id IN ARRAY p_lote_ids
  LOOP
    PERFORM 1
    FROM public.lotes l
    WHERE l.id = v_lote_id
      AND l.productor_id = p_productor_id
      AND COALESCE(LOWER(l.estado_calidad), 'aceptado') <> 'rechazado'
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN QUERY SELECT false, format('El lote %s no existe, no pertenece al productor o esta rechazado', v_lote_id)::TEXT, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.liquidacion_lotes ll
      WHERE ll.lote_id = v_lote_id
    ) THEN
      RETURN QUERY SELECT false, format('El lote %s ya fue liquidado', v_lote_id)::TEXT, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    v_lotes_count := v_lotes_count + 1;
  END LOOP;

  INSERT INTO public.liquidaciones (
    productor_id,
    fecha_liquidacion,
    total_kilos,
    precio_por_kg,
    deduccion_corte,
    deduccion_flete,
    deduccion_anticipo,
    total_pagar,
    forma_pago,
    referencia_pago
  ) VALUES (
    p_productor_id,
    NOW(),
    COALESCE(p_total_kilos, 0),
    COALESCE(p_precio_por_kg, 0),
    COALESCE(p_deduccion_corte, 0),
    COALESCE(p_deduccion_flete, 0),
    COALESCE(p_deduccion_anticipo, 0),
    COALESCE(p_total_pagar, 0),
    p_forma_pago,
    NULLIF(BTRIM(p_referencia_pago), '')
  )
  RETURNING id INTO v_liquidacion_id;

  -- Insercion defensiva: ante cualquier carrera, no reintenta liquidar
  -- un lote ya asignado (ON CONFLICT DO NOTHING). El ciclo previo ya
  -- garantiza que todos estaban libres.
  INSERT INTO public.liquidacion_lotes (liquidacion_id, lote_id)
  SELECT v_liquidacion_id, UNNEST(p_lote_ids)
  ON CONFLICT (lote_id) DO NOTHING;

  GET DIAGNOSTICS v_insertados = ROW_COUNT;

  IF v_insertados <> v_lotes_count THEN
    RAISE EXCEPTION 'Un lote seleccionado ya fue liquidado en otro proceso. Reintenta con la lista actualizada.';
  END IF;

  UPDATE public.productores
  SET saldo_anticipos = GREATEST(0, COALESCE(saldo_anticipos, 0) - COALESCE(p_deduccion_anticipo, 0))
  WHERE id = p_productor_id
  RETURNING productores.saldo_anticipos INTO saldo_anticipos;

  saldo_pendiente := public.sync_productor_saldo_pendiente(p_productor_id);

  RETURN QUERY SELECT true, format('Liquidacion procesada con %s lote(s)', v_lotes_count)::TEXT, v_liquidacion_id, saldo_anticipos, saldo_pendiente;
END;
$$;

GRANT EXECUTE ON FUNCTION public.procesar_liquidacion_productor(UUID, UUID[], NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, public.forma_pago, TEXT) TO authenticated;