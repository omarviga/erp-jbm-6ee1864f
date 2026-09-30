-- ==========================================================
-- UNIFICACION DEL TOTAL: TICKET = CxP = LIQUIDACION
--
-- Fuente unica de verdad: el ticket. Recepcion captura precio y tasa
-- manualmente y quedan congelados; Finanzas lee, no recalcula.
--
-- Decisiones de negocio (2026-09-30):
--   1. Solo existen dos deducciones al productor: deduccion operativa
--      por kilo (tasa capturada en el ticket) y costo de bascula.
--   2. Lo que se cobra en el ticket es lo que se registra en la
--      liquidacion: el trigger CxP y el sync de saldos restaban solo
--      la bascula e ignoraban la maniobra. Se corrigen.
--
-- Idempotente: seguro de ejecutar varias veces.
-- Las notas CxP ya pagadas NO se tocan (montos congelados historicos).
-- ==========================================================

-- ----------------------------------------------------------
-- 1) TRIGGER CxP: total = subtotal - bascula(liquidacion) - maniobra
--    (antes ignoraba la maniobra y siempre restaba la bascula)
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
    -- (saldo 0) y se conserva el historico ligado a abonos.
    UPDATE public.cuentas_por_pagar c
    SET saldo_pendiente = 0,
        estado = 'pagado',
        updated_at = now()
    WHERE c.lote_id = NEW.id;
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

DROP TRIGGER IF EXISTS trg_sync_cxp_from_lote ON public.lotes;
CREATE TRIGGER trg_sync_cxp_from_lote
  AFTER INSERT OR UPDATE OF es_cosecha_propia, estado_calidad, precio_pactado_kg,
                             costo_bascula, bascula_forma_pago, cuota_maniobra_kg,
                             cuota_maniobra_total, peso_neto, peso_pagable, productor_id,
                             numero_lote, fecha_recepcion
  ON public.lotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cxp_from_lote();

-- ----------------------------------------------------------
-- 2) SYNC DE SALDO DEL PRODUCTOR: misma formula del ticket
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
    GREATEST(0,
      (COALESCE(l.peso_pagable, l.peso_neto, 0) * COALESCE(l.precio_pactado_kg, 0))
      - CASE
          WHEN COALESCE(l.bascula_forma_pago, 'liquidacion') = 'liquidacion'
          THEN COALESCE(l.costo_bascula, 0)
          ELSE 0
        END
      - COALESCE(
          l.cuota_maniobra_total,
          ROUND(COALESCE(l.peso_neto, 0) * COALESCE(l.cuota_maniobra_kg, 0), 2),
          0
        )
    )
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
-- 3) BACKFILL: recalcula SOLO notas pendientes de lotes que califican.
--    Notas pagadas y saldos ya aplicados quedan congelados.
-- ----------------------------------------------------------
UPDATE public.cuentas_por_pagar c
SET monto_total = sub.importe,
    saldo_pendiente = GREATEST(0, sub.importe - COALESCE(c.monto_pagado, 0)),
    estado = CASE
               WHEN GREATEST(0, sub.importe - COALESCE(c.monto_pagado, 0)) <= 0.009 THEN 'pagado'
               ELSE 'pendiente'
             END,
    updated_at = now()
FROM (
  SELECT
    l.id AS lote_id,
    GREATEST(0,
      (COALESCE(l.peso_pagable, l.peso_neto, 0) * COALESCE(l.precio_pactado_kg, 0))
      - CASE
          WHEN COALESCE(l.bascula_forma_pago, 'liquidacion') = 'liquidacion'
          THEN COALESCE(l.costo_bascula, 0)
          ELSE 0
        END
      - COALESCE(
          l.cuota_maniobra_total,
          ROUND(COALESCE(l.peso_neto, 0) * COALESCE(l.cuota_maniobra_kg, 0), 2),
          0
        )
    ) AS importe
  FROM public.lotes l
  WHERE l.es_cosecha_propia IS DISTINCT FROM true
    AND COALESCE(LOWER(l.estado_calidad), 'aceptado') <> 'rechazado'
    AND COALESCE(l.precio_pactado_kg, 0) > 0
    AND l.productor_id IS NOT NULL
) sub
WHERE c.lote_id = sub.lote_id
  AND c.estado = 'pendiente';

-- Resync de saldos por productor con la misma formula (sin chequeo de rol:
-- corre con los privilegios del owner de la migracion).
UPDATE public.productores p
SET saldo_pendiente = COALESCE(sub.total, 0)
FROM (
  SELECT
    l.productor_id,
    COALESCE(SUM(
      GREATEST(0,
        (COALESCE(l.peso_pagable, l.peso_neto, 0) * COALESCE(l.precio_pactado_kg, 0))
        - CASE
            WHEN COALESCE(l.bascula_forma_pago, 'liquidacion') = 'liquidacion'
            THEN COALESCE(l.costo_bascula, 0)
            ELSE 0
          END
        - COALESCE(
            l.cuota_maniobra_total,
            ROUND(COALESCE(l.peso_neto, 0) * COALESCE(l.cuota_maniobra_kg, 0), 2),
            0
          )
      )
    ), 0) AS total
  FROM public.lotes l
  WHERE COALESCE(LOWER(l.estado_calidad), 'aceptado') <> 'rechazado'
    AND NOT EXISTS (
      SELECT 1 FROM public.liquidacion_lotes ll
      WHERE ll.lote_id = l.id
    )
  GROUP BY l.productor_id
) sub
WHERE p.id = sub.productor_id;
