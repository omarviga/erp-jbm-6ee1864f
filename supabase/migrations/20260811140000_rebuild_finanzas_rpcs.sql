-- ==========================================================
-- RECONSTRUCCION DE FINANZAS: RPCs TRANSACCIONALES Y ROBUSTOS
--
-- Objetivo: que TODAS las operaciones de dinero pasen por
-- funciones SECURITY DEFINER (las ejecuta el dueno de la BD,
-- por lo que no dependen de politicas RLS fragiles en las
-- tablas) y que NUNCA enmascaren el error real.
--
-- Las funciones se recrean con DROP+CREATE para garantizar que
-- la version desplegada en la BD coincida 1:1 con este repo.
-- Idempotente: seguro de ejecutar varias veces.
-- ==========================================================

-- ----------------------------------------------------------
-- 1) sync_productor_saldo_pendiente
--    Recalcula el saldo pendiente de un productor sumando solo
--    los lotes no liquidados y no rechazados.
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
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol admin o finanzas.';
  END IF;

  IF p_productor_id IS NULL THEN
    RAISE EXCEPTION 'productor_id es requerido';
  END IF;

  SELECT COALESCE(SUM(
    GREATEST(0, (COALESCE(l.peso_pagable, l.peso_neto, 0) * COALESCE(l.precio_pactado_kg, 0)) - COALESCE(l.costo_bascula, 0))
  ), 0)
  INTO v_total_pendiente
  FROM public.lotes l
  WHERE l.productor_id = p_productor_id
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
-- 2) registrar_adelanto_productor
--    Registra un adelanto/pago al productor (simple, sin notas).
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_adelanto_productor(UUID, NUMERIC, public.forma_pago, TEXT);
CREATE OR REPLACE FUNCTION public.registrar_adelanto_productor(
  p_productor_id UUID,
  p_monto NUMERIC,
  p_forma_pago public.forma_pago DEFAULT 'efectivo',
  p_referencia TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  mensaje TEXT,
  adelanto_id UUID,
  saldo_anticipos NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_productor RECORD;
  v_adelanto_id UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finanzas'::public.app_role)) THEN
    RETURN QUERY SELECT false, 'No autorizado. Se requiere rol admin o finanzas.'::TEXT, NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  IF p_productor_id IS NULL THEN
    RETURN QUERY SELECT false, 'productor_id es requerido'::TEXT, NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  IF COALESCE(p_monto, 0) <= 0 THEN
    RETURN QUERY SELECT false, 'El monto debe ser mayor a cero'::TEXT, NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  SELECT id, nombre, COALESCE(saldo_anticipos, 0) AS saldo_anticipos
  INTO v_productor
  FROM public.productores
  WHERE id = p_productor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Productor no encontrado'::TEXT, NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  INSERT INTO public.anticipos (
    productor_id, monto, forma_pago, referencia
  ) VALUES (
    p_productor_id, p_monto, p_forma_pago, NULLIF(BTRIM(p_referencia), '')
  )
  RETURNING id INTO v_adelanto_id;

  UPDATE public.productores
  SET saldo_anticipos = COALESCE(saldo_anticipos, 0) + p_monto
  WHERE id = p_productor_id
  RETURNING saldo_anticipos INTO saldo_anticipos;

  RETURN QUERY SELECT true, 'Adelanto registrado exitosamente'::TEXT, v_adelanto_id, saldo_anticipos;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_adelanto_productor(UUID, NUMERIC, public.forma_pago, TEXT) TO authenticated;

-- ----------------------------------------------------------
-- 3) aplicar_pago_cxp
--    Aplica un pago parcial de CxP a N notas seleccionadas.
--    Crea el abono, lo asigna (primero a la nota mas antigua)
--    y actualiza saldos/estados de cuentas_por_pagar.
--    TODO dentro de una sola transaccion.
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.aplicar_pago_cxp(UUID, UUID[], NUMERIC, public.forma_pago, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.aplicar_pago_cxp(
  p_productor_id UUID,
  p_cxp_ids UUID[],
  p_monto NUMERIC,
  p_forma_pago public.forma_pago DEFAULT 'efectivo',
  p_referencia TEXT DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  mensaje TEXT,
  abono_id UUID,
  nuevo_saldo_productor NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_abono_id UUID;
  v_saldo_seleccionado NUMERIC := 0;
  v_restante NUMERIC;
  v_cxp RECORD;
  v_nuevo_saldo NUMERIC := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finanzas'::public.app_role)) THEN
    RETURN QUERY SELECT false, 'No autorizado. Se requiere rol admin o finanzas.'::TEXT, NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  IF p_productor_id IS NULL THEN
    RETURN QUERY SELECT false, 'productor_id es requerido'::TEXT, NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  IF COALESCE(array_length(p_cxp_ids, 1), 0) = 0 THEN
    RETURN QUERY SELECT false, 'Selecciona al menos una nota para aplicar el pago'::TEXT, NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  IF COALESCE(p_monto, 0) <= 0 THEN
    RETURN QUERY SELECT false, 'El monto debe ser mayor a cero'::TEXT, NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Suma del saldo pendiente de las notas seleccionadas (solo del productor)
  SELECT COALESCE(SUM(c.saldo_pendiente), 0)
  INTO v_saldo_seleccionado
  FROM public.cuentas_por_pagar c
  WHERE c.id = ANY(p_cxp_ids)
    AND c.productor_id = p_productor_id;

  IF v_saldo_seleccionado + 0.009 < p_monto THEN
    RETURN QUERY SELECT false, 'El monto del pago supera el saldo pendiente de las notas seleccionadas'::TEXT, NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Verificacion de que todas las notas pertenezcan al productor
  IF EXISTS (
    SELECT 1
    FROM UNNEST(p_cxp_ids) AS nid(id)
    LEFT JOIN public.cuentas_por_pagar c ON c.id = nid.id
    WHERE c.id IS NULL OR c.productor_id <> p_productor_id
  ) THEN
    RETURN QUERY SELECT false, 'Una o más notas no pertenecen al productor o no existen'::TEXT, NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  -- 1) Crear el abono
  INSERT INTO public.abonos_productor (
    productor_id, monto, metodo_pago, referencia, notas, usuario_id
  ) VALUES (
    p_productor_id,
    p_monto,
    p_forma_pago::TEXT,
    NULLIF(BTRIM(p_referencia), ''),
    'Aplicación parcial a las notas seleccionadas desde CxP',
    p_usuario_id
  )
  RETURNING id INTO v_abono_id;

  -- 2) Asignar el abono a las notas (mas antigua primero)
  v_restante := p_monto;
  FOR v_cxp IN
    SELECT c.id, c.saldo_pendiente
    FROM public.cuentas_por_pagar c
    WHERE c.id = ANY(p_cxp_ids)
      AND c.productor_id = p_productor_id
      AND c.saldo_pendiente > 0.009
    ORDER BY COALESCE(c.fecha_ticket, c.created_at) ASC, c.numero_lote ASC
    FOR UPDATE
  LOOP
    IF v_restante <= 0.009 THEN
      EXIT;
    END IF;

    DECLARE
      v_aplicar NUMERIC;
      v_nuevo_pagado NUMERIC;
      v_nuevo_saldo NUMERIC;
    BEGIN
      v_aplicar := LEAST(v_restante, v_cxp.saldo_pendiente);
      v_nuevo_pagado := COALESCE(v_aplicar, 0);
      v_nuevo_saldo := GREATEST(0, v_cxp.saldo_pendiente - v_aplicar);

      UPDATE public.cuentas_por_pagar
      SET monto_pagado = COALESCE(monto_pagado, 0) + v_nuevo_pagado,
          saldo_pendiente = v_nuevo_saldo,
          estado = CASE WHEN v_nuevo_saldo <= 0.009 THEN 'pagado' ELSE 'pendiente' END,
          updated_at = now()
      WHERE id = v_cxp.id;

      INSERT INTO public.abono_asignaciones (abono_id, cxp_id, monto_aplicado)
      VALUES (v_abono_id, v_cxp.id, v_nuevo_pagado);

      v_restante := v_restante - v_aplicar;
    END;
  END LOOP;

  IF v_restante > 0.009 THEN
    RAISE EXCEPTION 'No fue posible aplicar el monto completo a las notas seleccionadas';
  END IF;

  -- 3) Nuevo saldo total del productor
  SELECT COALESCE(SUM(c.saldo_pendiente), 0)
  INTO v_nuevo_saldo
  FROM public.cuentas_por_pagar c
  WHERE c.productor_id = p_productor_id;

  RETURN QUERY SELECT true, 'Pago aplicado correctamente'::TEXT, v_abono_id, v_nuevo_saldo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aplicar_pago_cxp(UUID, UUID[], NUMERIC, public.forma_pago, TEXT, UUID) TO authenticated;

-- ----------------------------------------------------------
-- 4) procesar_liquidacion_productor
--    Liquidacion semanal completa de lotes de un productor.
--    Izquierda el error real visible ante cualquier fallo.
-- ----------------------------------------------------------
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

  INSERT INTO public.liquidacion_lotes (liquidacion_id, lote_id)
  SELECT v_liquidacion_id, UNNEST(p_lote_ids)
  ON CONFLICT (lote_id) DO NOTHING;

  GET DIAGNOSTICS v_insertados = ROW_COUNT;

  IF v_insertados <> v_lotes_count THEN
    RAISE EXCEPTION 'Un lote seleccionado ya fue liquidado por otro proceso. Reintenta con la lista actualizada.';
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