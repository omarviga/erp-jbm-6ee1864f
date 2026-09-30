-- ==========================================================
-- POBLAR AUTOMATICAMENTE LA TABLA 'cuentas_por_pagar'
-- Las notas (CxP) se derivan de los lotes de compra a terceros
-- (es_cosecha_propia = false) con precio pactado.
--
-- Incluye:
--   1. Creacion de la tabla si no existe
--   2. Trigger que mantiene las notas en sync con lotes
--   3. Trigger que marca como pagadas las notas liquidadas
--   4. Backfill de lotes existentes
-- ==========================================================

-- 1. TABLA (si no existe ya en el entorno)
CREATE TABLE IF NOT EXISTS public.cuentas_por_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES public.lotes(id) ON DELETE CASCADE UNIQUE NOT NULL,
  productor_id UUID REFERENCES public.productores(id),
  numero_lote TEXT,
  fecha_ticket TIMESTAMPTZ,
  kilos_netos NUMERIC(12,2) DEFAULT 0,
  kilos_pagables NUMERIC(12,2) DEFAULT 0,
  precio_kg NUMERIC(10,2) DEFAULT 0,
  monto_total NUMERIC(12,2) DEFAULT 0,
  monto_pagado NUMERIC(12,2) DEFAULT 0,
  saldo_pendiente NUMERIC(12,2) DEFAULT 0,
  estado TEXT DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuentas_por_pagar_productor ON public.cuentas_por_pagar(productor_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_por_pagar_estado ON public.cuentas_por_pagar(estado);

-- Asegura una restriccion unica sobre lote_id (requerida por ON CONFLICT).
-- Si la tabla ya fue creada con UNIQUE(lote_id), no se duplica.
CREATE UNIQUE INDEX IF NOT EXISTS cuentas_por_pagar_lote_id_key ON public.cuentas_por_pagar(lote_id);

-- 1b. RLS: roles admin/finanzas pueden leer y actualizar notas CxP.
ALTER TABLE public.cuentas_por_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cxp_role_view" ON public.cuentas_por_pagar;
CREATE POLICY "cxp_role_view" ON public.cuentas_por_pagar
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  );

DROP POLICY IF EXISTS "cxp_role_update" ON public.cuentas_por_pagar;
CREATE POLICY "cxp_role_update" ON public.cuentas_por_pagar
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  );

DROP POLICY IF EXISTS "cxp_role_insert" ON public.cuentas_por_pagar;
CREATE POLICY "cxp_role_insert" ON public.cuentas_por_pagar
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  );

-- 2. FUNCION DE SYNC DESDE LOTE
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
  v_importe        := GREATEST(0, (v_kilos_pagables * v_precio) - COALESCE(NEW.costo_bascula, 0));

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
                             costo_bascula, peso_neto, peso_pagable, productor_id,
                             numero_lote, fecha_recepcion
  ON public.lotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cxp_from_lote();

-- 3. MARCA COMO PAGADAS LAS NOTAS LIQUIDADAS
CREATE OR REPLACE FUNCTION public.sync_cxp_after_liquidacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.cuentas_por_pagar c
  SET saldo_pendiente = 0,
      monto_pagado    = c.monto_total,
      estado          = 'pagado',
      updated_at      = now()
  WHERE c.lote_id = NEW.lote_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cxp_after_liquidacion ON public.liquidacion_lotes;
CREATE TRIGGER trg_sync_cxp_after_liquidacion
  AFTER INSERT ON public.liquidacion_lotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cxp_after_liquidacion();

-- 4. BACKFILL DE LOTES EXISTENTES
-- 4.1 Marcamos como pagadas las notas de lotes ya liquidados
UPDATE public.cuentas_por_pagar c
SET saldo_pendiente = 0,
    monto_pagado    = c.monto_total,
    estado          = 'pagado',
    updated_at      = now()
WHERE c.estado <> 'pagado'
  AND EXISTS (
    SELECT 1 FROM public.liquidacion_lotes ll
    WHERE ll.lote_id = c.lote_id
  );

-- 4.2 Insertamos las notas de lotes pendientes que falten
INSERT INTO public.cuentas_por_pagar (
  lote_id, productor_id, numero_lote, fecha_ticket,
  kilos_netos, kilos_pagables, precio_kg,
  monto_total, monto_pagado, saldo_pendiente, estado
)
SELECT
  l.id,
  l.productor_id,
  l.numero_lote,
  l.fecha_recepcion,
  COALESCE(l.peso_neto, 0),
  COALESCE(l.peso_pagable, l.peso_neto, 0),
  COALESCE(l.precio_pactado_kg, 0),
  GREATEST(0, (COALESCE(l.peso_pagable, l.peso_neto, 0) * COALESCE(l.precio_pactado_kg, 0)) - COALESCE(l.costo_bascula, 0)),
  0,
  GREATEST(0, (COALESCE(l.peso_pagable, l.peso_neto, 0) * COALESCE(l.precio_pactado_kg, 0)) - COALESCE(l.costo_bascula, 0)),
  'pendiente'
FROM public.lotes l
WHERE l.es_cosecha_propia IS DISTINCT FROM true
  AND COALESCE(LOWER(l.estado_calidad), 'aceptado') <> 'rechazado'
  AND COALESCE(l.precio_pactado_kg, 0) > 0
  AND l.productor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.liquidacion_lotes ll
    WHERE ll.lote_id = l.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.cuentas_por_pagar c
    WHERE c.lote_id = l.id
  );

-- Resumen para el usuario
SELECT
  (SELECT COUNT(*)::int FROM public.cuentas_por_pagar) AS total_notas_cxp,
  (SELECT COUNT(*)::int FROM public.cuentas_por_pagar WHERE estado = 'pendiente' AND saldo_pendiente > 0) AS notas_pendientes,
  (SELECT COUNT(*)::int FROM public.cuentas_por_pagar WHERE estado = 'pagado') AS notas_pagadas;