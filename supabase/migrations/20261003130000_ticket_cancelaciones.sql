-- ==========================================================
-- CANCELACION DE TICKETS CON TRAZABILIDAD
--
-- Regla de negocio: un ticket se cancela individualmente, sin afectar
-- los demas del productor. La cancelacion queda registrada (quien,
-- cuando, por que) y es irreversible desde la app.
--
-- Condiciones para cancelar (validadas en el RPC):
--   1. El ticket no esta liquidado (sin renglon en liquidacion_lotes).
--   2. Su nota CxP no tiene pagos aplicados (monto_pagado = 0 y sin
--      renglones en abono_asignaciones).
--   3. Su fruta no entro a produccion.
--   4. Motivo obligatorio (>= 5 caracteres).
--
-- Efectos:
--   - Renglon append-only en ticket_cancelaciones (sin UPDATE/DELETE).
--   - La nota CxP pasa a estado 'cancelado' con saldo 0. Se conserva
--     monto_total/monto_pagado como historico.
--   - El trigger sync_cxp_from_lote NUNCA resucita una nota cancelada.
--
-- Idempotente: seguro de ejecutar varias veces.
-- ==========================================================

-- ----------------------------------------------------------
-- 1) TABLA DE AUDITORIA (append-only)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_cancelaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES public.lotes(id) ON DELETE RESTRICT UNIQUE,
  motivo TEXT NOT NULL CHECK (char_length(btrim(motivo)) >= 5),
  cancelado_por UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_cancelaciones_lote
  ON public.ticket_cancelaciones (lote_id);

ALTER TABLE public.ticket_cancelaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cancel_role_view" ON public.ticket_cancelaciones;
CREATE POLICY "cancel_role_view" ON public.ticket_cancelaciones
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'finanzas'::app_role)
     OR has_role(auth.uid(), 'almacen'::app_role)
     OR has_role(auth.uid(), 'produccion'::app_role))
  );

DROP POLICY IF EXISTS "cancel_role_insert" ON public.ticket_cancelaciones;
CREATE POLICY "cancel_role_insert" ON public.ticket_cancelaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'finanzas'::app_role)
     OR has_role(auth.uid(), 'almacen'::app_role))
  );

-- Sin politicas de UPDATE/DELETE: el registro es inmutable.

GRANT SELECT, INSERT ON public.ticket_cancelaciones TO authenticated;

-- ----------------------------------------------------------
-- 2) RPC DE CANCELACION
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.cancelar_ticket(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.cancelar_ticket(
  p_lote_id UUID,
  p_motivo TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_motivo TEXT := btrim(COALESCE(p_motivo, ''));
  v_cxp_id UUID := NULL;
  v_pagado NUMERIC := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol admin, finanzas o almacen.';
  END IF;

  IF p_lote_id IS NULL THEN
    RAISE EXCEPTION 'lote_id es requerido';
  END IF;

  IF char_length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'El motivo de cancelacion es obligatorio (minimo 5 caracteres).';
  END IF;

  PERFORM 1 FROM public.lotes WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El ticket no existe.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.ticket_cancelaciones WHERE lote_id = p_lote_id) THEN
    RAISE EXCEPTION 'El ticket ya esta cancelado.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.liquidacion_lotes WHERE lote_id = p_lote_id) THEN
    RAISE EXCEPTION 'El ticket ya fue liquidado y no se puede cancelar.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.produccion WHERE lote_id = p_lote_id) THEN
    RAISE EXCEPTION 'La fruta del ticket ya entro a produccion y no se puede cancelar.';
  END IF;

  SELECT id, COALESCE(monto_pagado, 0)
    INTO v_cxp_id, v_pagado
    FROM public.cuentas_por_pagar
    WHERE lote_id = p_lote_id;

  IF v_cxp_id IS NOT NULL THEN
    IF v_pagado > 0 THEN
      RAISE EXCEPTION 'La nota ya tiene pagos aplicados y no se puede cancelar.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.abono_asignaciones WHERE cxp_id = v_cxp_id) THEN
      RAISE EXCEPTION 'La nota ya tiene pagos aplicados y no se puede cancelar.';
    END IF;
  END IF;

  INSERT INTO public.ticket_cancelaciones (lote_id, motivo, cancelado_por)
  VALUES (p_lote_id, v_motivo, auth.uid());

  IF v_cxp_id IS NOT NULL THEN
    UPDATE public.cuentas_por_pagar
    SET estado = 'cancelado',
        saldo_pendiente = 0,
        updated_at = now()
    WHERE id = v_cxp_id;
  END IF;

  RETURN json_build_object('lote_id', p_lote_id, 'cxp_id', v_cxp_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_ticket(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------
-- 3) BLINDAJE: el trigger CxP nunca resucita notas canceladas
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
  v_maniobra NUMERIC;
BEGIN
  -- Rechazados o sin precio o cosecha propia: no generan nota CxP.
  IF NOT (NEW.es_cosecha_propia IS DISTINCT FROM true)
     OR COALESCE(LOWER(NEW.estado_calidad), 'aceptado') = 'rechazado'
     OR COALESCE(NEW.precio_pactado_kg, 0) <= 0
     OR NEW.productor_id IS NULL THEN
    -- Si ya existe una nota y dejo de calificar, se marca como pagada
    -- (saldo 0) y se conserva el historico ligado a abonos. Las notas
    -- canceladas se respetan: conservan su estado.
    UPDATE public.cuentas_por_pagar c
    SET saldo_pendiente = 0,
        estado = 'pagado',
        updated_at = now()
    WHERE c.lote_id = NEW.id
      AND c.estado IS DISTINCT FROM 'cancelado';
    RETURN NEW;
  END IF;

  v_kilos_netos   := COALESCE(NEW.peso_neto, 0);
  v_kilos_pagables := COALESCE(NEW.peso_pagable, NEW.peso_neto, 0);
  v_precio         := COALESCE(NEW.precio_pactado_kg, 0);
  -- La bascula solo descuenta cuando se cobra en liquidacion; en efectivo
  -- se registra el ingreso pero no reduce lo que se le paga al productor.
  v_bascula_descontada := CASE
    WHEN COALESCE(NEW.bascula_forma_pago, 'liquidacion') = 'liquidacion'
    THEN COALESCE(NEW.costo_bascula, 0)
    ELSE 0
  END;
  -- Snapshot del ticket; si un lote viejo solo trae la tarifa, se deriva.
  v_maniobra := COALESCE(
    NEW.cuota_maniobra_total,
    ROUND(v_kilos_netos * COALESCE(NEW.cuota_maniobra_kg, 0), 2),
    0
  );
  v_importe := GREATEST(0, (v_kilos_pagables * v_precio) - v_bascula_descontada - v_maniobra);

  -- Upsert de la nota (las canceladas quedan congeladas).
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
    updated_at       = now()
  WHERE cuentas_por_pagar.estado IS DISTINCT FROM 'cancelado';

  RETURN NEW;
END;
$$;
