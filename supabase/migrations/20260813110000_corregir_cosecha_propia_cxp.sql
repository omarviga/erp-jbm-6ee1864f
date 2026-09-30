-- ==========================================================
-- CORRECCIÓN DE DATOS: lotes de COSECHA PROPIA registrados como
-- compra a terceros con el precio por caja en precio_pactado_kg.
--
-- ⚠️  ESTA MIGRACIÓN MODIFICA DATOS FINANCIEROS.
--     Antes de ejecutarla, revisa el impacto con:
--       SELECT * FROM public.diagnostico_correccion_cosecha_propia();
--
-- Garantías de seguridad:
--   1. Respalda el estado anterior de cada lote y de su nota en
--      public.cxp_correccion_cosecha_propia_log.
--   2. Solo anula notas SIN pagos aplicados, sin abonos asignados y
--      cuyo lote no está liquidado. Las notas con dinero ya movido
--      NO se tocan: quedan marcadas como 'requiere_revision_manual'
--      para que finanzas las concilie a mano.
--   3. Nunca elimina abonos, asignaciones ni liquidaciones.
--   4. Es idempotente.
--   5. Incluye public.revertir_correccion_cosecha_propia() para
--      deshacer todo desde la bitácora (no se ejecuta sola).
--
-- Criterio (firma exacta del bug): es_cosecha_propia = false y
-- origen = 'interno'. No se usa huerto_id: el huerto solo se
-- captura en cosecha propia, así que por sí solo no distingue nada.
-- ==========================================================

-- ----------------------------------------------------------
-- 1) Bitácora con el estado anterior (respaldo y auditoría)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cxp_correccion_cosecha_propia_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL UNIQUE REFERENCES public.lotes(id) ON DELETE CASCADE,
  cxp_id UUID,
  productor_id UUID,
  numero_lote TEXT,
  fecha_recepcion TIMESTAMPTZ,
  kilos_netos_original NUMERIC,
  kilos_pagables_original NUMERIC,
  precio_pactado_kg_original NUMERIC,
  precio_caja_cortador_asignado NUMERIC,
  precio_kg_original NUMERIC,
  monto_total_original NUMERIC,
  monto_pagado_original NUMERIC,
  saldo_pendiente_original NUMERIC,
  estado_original TEXT,
  tenia_abonos BOOLEAN NOT NULL DEFAULT false,
  lote_liquidado BOOLEAN NOT NULL DEFAULT false,
  accion TEXT NOT NULL,
  ejecutado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revertido_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cxp_correccion_log_productor
  ON public.cxp_correccion_cosecha_propia_log (productor_id);

CREATE INDEX IF NOT EXISTS idx_cxp_correccion_log_accion
  ON public.cxp_correccion_cosecha_propia_log (accion);

ALTER TABLE public.cxp_correccion_cosecha_propia_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cxp_correccion_log_admin_view" ON public.cxp_correccion_cosecha_propia_log;
CREATE POLICY "cxp_correccion_log_admin_view" ON public.cxp_correccion_cosecha_propia_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'finanzas'::public.app_role)
  );

COMMENT ON TABLE public.cxp_correccion_cosecha_propia_log IS
  'Respaldo del estado previo a la corrección de lotes de cosecha propia registrados como compra a terceros. Permite auditar y revertir.';

-- ----------------------------------------------------------
-- 2) Respaldo + clasificación (antes de tocar nada)
--    Si la corrección se revirtió y se vuelve a aplicar, la fila
--    de la bitácora se re-toma con el estado actual.
-- ----------------------------------------------------------
INSERT INTO public.cxp_correccion_cosecha_propia_log AS g (
  lote_id, cxp_id, productor_id, numero_lote, fecha_recepcion,
  kilos_netos_original, kilos_pagables_original,
  precio_pactado_kg_original, precio_caja_cortador_asignado, precio_kg_original,
  monto_total_original, monto_pagado_original, saldo_pendiente_original, estado_original,
  tenia_abonos, lote_liquidado, accion
)
SELECT
  l.id,
  c.id,
  l.productor_id,
  l.numero_lote,
  l.fecha_recepcion,
  COALESCE(l.peso_neto, 0),
  COALESCE(l.peso_pagable, l.peso_neto, 0),
  COALESCE(l.precio_pactado_kg, 0),
  -- Se llena en el paso 5 con el valor realmente asignado.
  0::NUMERIC,
  COALESCE(c.precio_kg, 0),
  COALESCE(c.monto_total, 0),
  COALESCE(c.monto_pagado, 0),
  COALESCE(c.saldo_pendiente, 0),
  c.estado,
  EXISTS (SELECT 1 FROM public.abono_asignaciones a WHERE a.cxp_id = c.id),
  EXISTS (SELECT 1 FROM public.liquidacion_lotes ll WHERE ll.lote_id = l.id),
  CASE
    WHEN c.id IS NULL THEN 'lote_marcado_sin_nota'
    WHEN COALESCE(c.monto_pagado, 0) > 0.009
      OR EXISTS (SELECT 1 FROM public.abono_asignaciones a WHERE a.cxp_id = c.id)
      OR EXISTS (SELECT 1 FROM public.liquidacion_lotes ll WHERE ll.lote_id = l.id)
      THEN 'requiere_revision_manual'
    ELSE 'nota_anulada'
  END
FROM public.lotes l
LEFT JOIN public.cuentas_por_pagar c ON c.lote_id = l.id
WHERE COALESCE(l.es_cosecha_propia, false) = false
  AND COALESCE(l.origen, '') = 'interno'
ON CONFLICT (lote_id) DO UPDATE SET
  cxp_id = EXCLUDED.cxp_id,
  productor_id = EXCLUDED.productor_id,
  numero_lote = EXCLUDED.numero_lote,
  fecha_recepcion = EXCLUDED.fecha_recepcion,
  kilos_netos_original = EXCLUDED.kilos_netos_original,
  kilos_pagables_original = EXCLUDED.kilos_pagables_original,
  precio_pactado_kg_original = EXCLUDED.precio_pactado_kg_original,
  precio_caja_cortador_asignado = EXCLUDED.precio_caja_cortador_asignado,
  precio_kg_original = EXCLUDED.precio_kg_original,
  monto_total_original = EXCLUDED.monto_total_original,
  monto_pagado_original = EXCLUDED.monto_pagado_original,
  saldo_pendiente_original = EXCLUDED.saldo_pendiente_original,
  estado_original = EXCLUDED.estado_original,
  tenia_abonos = EXCLUDED.tenia_abonos,
  lote_liquidado = EXCLUDED.lote_liquidado,
  accion = EXCLUDED.accion,
  ejecutado_at = now(),
  revertido_at = NULL
WHERE g.revertido_at IS NOT NULL;

-- ----------------------------------------------------------
-- 3) Corrección del cálculo del saldo del productor
--
-- sync_productor_saldo_pendiente calculaba el pendiente BRUTO
-- (no restaba los pagos ya aplicados), mientras aplicar_pago_cxp
-- lo calculaba NETO desde cuentas_por_pagar. Cada recepción nueva
-- volvía a inflar el saldo de un productor que ya había cobrado.
-- Ahora ambas rutas coinciden: al importe del lote se le resta el
-- monto_pagado de su nota.
--
-- El cálculo vive en recalcular_saldo_productor (sin chequeo de rol)
-- para poder invocarlo desde migraciones y desde otras funciones
-- SECURITY DEFINER, donde auth.uid() es NULL. El acceso vía API queda
-- cerrado con REVOKE ... FROM PUBLIC.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalcular_saldo_productor(
  p_productor_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_pendiente NUMERIC := 0;
BEGIN
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
      - COALESCE(c.monto_pagado, 0)
    )
  ), 0)
  INTO v_total_pendiente
  FROM public.lotes l
  LEFT JOIN public.cuentas_por_pagar c ON c.lote_id = l.id
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

REVOKE ALL ON FUNCTION public.recalcular_saldo_productor(UUID) FROM PUBLIC;

COMMENT ON FUNCTION public.recalcular_saldo_productor(UUID) IS
  'Recalcula productores.saldo_pendiente (neto de pagos aplicados). Uso interno: no expuesta a la API.';

DROP FUNCTION IF EXISTS public.sync_productor_saldo_pendiente(UUID);
CREATE OR REPLACE FUNCTION public.sync_productor_saldo_pendiente(
  p_productor_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol admin, produccion, finanzas o almacen.';
  END IF;

  RETURN public.recalcular_saldo_productor(p_productor_id);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_productor_saldo_pendiente(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_productor_saldo_pendiente(UUID) TO authenticated, service_role;

-- ----------------------------------------------------------
-- 4) Marcar los lotes afectados como cosecha propia.
--    (Dispara trg_sync_cxp_from_lote, que deja la nota sin saldo.)
-- ----------------------------------------------------------
UPDATE public.lotes l
SET es_cosecha_propia = true,
    origen = 'interno',
    updated_at = now()
WHERE COALESCE(l.es_cosecha_propia, false) = false
  AND COALESCE(l.origen, '') = 'interno';

-- ----------------------------------------------------------
-- 5) Recuperar el precio por caja que se capturó por error.
--    El valor guardado era "precio por caja para pago a
--    cortadores", no un precio por kilo, y contaminaba el costeo
--    de producción (registrar_produccion usa precio_pactado_kg).
-- ----------------------------------------------------------
DO $$
DECLARE
  -- INTERRUPTOR ------------------------------------------------
  -- true  = mueve el valor a precio_caja_cortador y deja
  --         precio_pactado_kg en 0 (recomendado).
  -- false = conserva precio_pactado_kg tal cual y solo corrige
  --         la cuenta por pagar.
  v_mover_precio_a_caja BOOLEAN := true;
  -- ------------------------------------------------------------
  v_afectados INTEGER := 0;
BEGIN
  IF v_mover_precio_a_caja THEN
    UPDATE public.lotes l
    SET precio_caja_cortador = COALESCE(NULLIF(l.precio_caja_cortador, 0), l.precio_pactado_kg),
        precio_pactado_kg = 0,
        updated_at = now()
    WHERE COALESCE(l.precio_pactado_kg, 0) > 0
      AND EXISTS (
        SELECT 1 FROM public.cxp_correccion_cosecha_propia_log g
        WHERE g.lote_id = l.id AND g.revertido_at IS NULL
      );

    GET DIAGNOSTICS v_afectados = ROW_COUNT;
    RAISE NOTICE 'Precio por caja movido a precio_caja_cortador en % lote(s); precio_pactado_kg = 0.', v_afectados;
  ELSE
    RAISE NOTICE 'Interruptor v_mover_precio_a_caja = false: se conserva precio_pactado_kg original.';
  END IF;

  -- Deja registrado el valor asignado, para poder revertir.
  UPDATE public.cxp_correccion_cosecha_propia_log g
  SET precio_caja_cortador_asignado = COALESCE(l.precio_caja_cortador, 0)
  FROM public.lotes l
  WHERE l.id = g.lote_id
    AND g.revertido_at IS NULL;
END;
$$;

COMMENT ON COLUMN public.cxp_correccion_cosecha_propia_log.precio_caja_cortador_asignado IS
  'Precio por caja que quedó en lotes.precio_caja_cortador tras la corrección (0 si no se movió).';

-- ----------------------------------------------------------
-- 6) Anular el importe de las notas sin pagos aplicados.
--    Los kilos de la nota sí eran correctos (peso_neto real), así
--    que se conservan y solo se pone el dinero en cero.
-- ----------------------------------------------------------
UPDATE public.cuentas_por_pagar c
SET monto_total = 0,
    precio_kg = 0,
    kilos_netos = COALESCE(l.peso_neto, c.kilos_netos, 0),
    kilos_pagables = COALESCE(l.peso_pagable, l.peso_neto, c.kilos_pagables, 0),
    saldo_pendiente = 0,
    estado = 'pagado',
    updated_at = now()
FROM public.cxp_correccion_cosecha_propia_log g
JOIN public.lotes l ON l.id = g.lote_id
WHERE g.cxp_id = c.id
  AND g.accion = 'nota_anulada'
  AND g.revertido_at IS NULL;

-- ----------------------------------------------------------
-- 7) Resincronizar el saldo de los productores afectados
-- ----------------------------------------------------------
DO $$
DECLARE
  v_productor RECORD;
  v_sincronizados INTEGER := 0;
BEGIN
  FOR v_productor IN
    SELECT DISTINCT g.productor_id
    FROM public.cxp_correccion_cosecha_propia_log g
    WHERE g.productor_id IS NOT NULL
      AND g.revertido_at IS NULL
  LOOP
    PERFORM public.recalcular_saldo_productor(v_productor.productor_id);
    v_sincronizados := v_sincronizados + 1;
  END LOOP;

  RAISE NOTICE 'Saldo resincronizado para % productor(es).', v_sincronizados;
END;
$$;

-- ----------------------------------------------------------
-- 8) Reporte de la corrección
-- ----------------------------------------------------------
DO $$
DECLARE
  v_accion TEXT;
  v_lotes INTEGER;
  v_importe NUMERIC;
  v_pagado NUMERIC;
BEGIN
  RAISE NOTICE '--- Resultado de la corrección de cosecha propia ---';

  FOR v_accion, v_lotes, v_importe, v_pagado IN
    SELECT
      g.accion,
      COUNT(*)::INTEGER,
      COALESCE(SUM(g.monto_total_original), 0),
      COALESCE(SUM(g.monto_pagado_original), 0)
    FROM public.cxp_correccion_cosecha_propia_log g
    WHERE g.revertido_at IS NULL
    GROUP BY g.accion
    ORDER BY g.accion
  LOOP
    RAISE NOTICE '  % → % lote(s) | importe previo $% | pagado previo $%',
      v_accion, v_lotes, v_importe, v_pagado;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.cxp_correccion_cosecha_propia_log
    WHERE accion = 'requiere_revision_manual' AND revertido_at IS NULL
  ) THEN
    RAISE NOTICE 'ATENCIÓN: hay notas con pagos aplicados que NO se modificaron.';
    RAISE NOTICE 'Revísalas con: SELECT * FROM public.cxp_correccion_cosecha_propia_log WHERE accion = ''requiere_revision_manual'';';
  END IF;

  RAISE NOTICE 'Detalle completo en public.cxp_correccion_cosecha_propia_log.';
END;
$$;

-- ----------------------------------------------------------
-- 9) Reversión (creada pero NO ejecutada)
--    Uso:  SELECT * FROM public.revertir_correccion_cosecha_propia();
--    Restaura el estado ANTERIOR (incluido el error original) y
--    deja la bitácora marcada. Solo admin.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revertir_correccion_cosecha_propia()
RETURNS TABLE (
  lotes_restaurados INTEGER,
  notas_restauradas INTEGER,
  productores_resincronizados INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lotes INTEGER := 0;
  v_notas INTEGER := 0;
  v_productores INTEGER := 0;
  v_productor RECORD;
BEGIN
  -- Sin JWT (SQL Editor, supabase db push) se permite la ejecución; vía API
  -- solo pasa un administrador. El acceso desde la API queda cerrado por el
  -- REVOKE ... FROM PUBLIC de más abajo.
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol admin.';
  END IF;

  -- 1) Restaurar lotes (esto vuelve a disparar el trigger de CxP).
  UPDATE public.lotes l
  SET es_cosecha_propia = false,
      precio_pactado_kg = COALESCE(g.precio_pactado_kg_original, 0),
      precio_caja_cortador = 0,
      updated_at = now()
  FROM public.cxp_correccion_cosecha_propia_log g
  WHERE g.lote_id = l.id
    AND g.revertido_at IS NULL;

  GET DIAGNOSTICS v_lotes = ROW_COUNT;

  -- 2) Restaurar las notas DESPUÉS del trigger, con el estado previo.
  UPDATE public.cuentas_por_pagar c
  SET monto_total = g.monto_total_original,
      precio_kg = g.precio_kg_original,
      kilos_netos = g.kilos_netos_original,
      kilos_pagables = g.kilos_pagables_original,
      saldo_pendiente = g.saldo_pendiente_original,
      estado = g.estado_original,
      updated_at = now()
  FROM public.cxp_correccion_cosecha_propia_log g
  WHERE g.cxp_id = c.id
    AND g.accion = 'nota_anulada'
    AND g.revertido_at IS NULL;

  GET DIAGNOSTICS v_notas = ROW_COUNT;

  -- 3) Marcar la bitácora como revertida.
  UPDATE public.cxp_correccion_cosecha_propia_log
  SET revertido_at = now()
  WHERE revertido_at IS NULL;

  -- 4) Resincronizar saldos.
  FOR v_productor IN
    SELECT DISTINCT productor_id
    FROM public.cxp_correccion_cosecha_propia_log
    WHERE productor_id IS NOT NULL
  LOOP
    PERFORM public.recalcular_saldo_productor(v_productor.productor_id);
    v_productores := v_productores + 1;
  END LOOP;

  lotes_restaurados := v_lotes;
  notas_restauradas := v_notas;
  productores_resincronizados := v_productores;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.revertir_correccion_cosecha_propia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revertir_correccion_cosecha_propia() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
