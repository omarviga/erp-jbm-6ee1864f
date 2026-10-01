-- P0 CxP: referencia obligatoria server-side en aplicar_pago_cxp.
--
-- La UI (Finanzas.tsx vía validarAbono) ya exige referencia para cheque y
-- transferencia, pero el RPC aceptaba NULL por cualquier vía directa,
-- dejando pagos no trazables. Se agrega el gate con el mismo estilo de
-- retorno (fila success=false) que el resto de validaciones. Único
-- llamador: handleRegistrarAdelantoCxp, que ya envía la referencia.

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

  IF p_forma_pago IN ('cheque', 'transferencia') AND NULLIF(BTRIM(p_referencia), '') IS NULL THEN
    RETURN QUERY SELECT false, 'La referencia es obligatoria para cheque y transferencia'::TEXT, NULL::UUID, NULL::NUMERIC;
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
