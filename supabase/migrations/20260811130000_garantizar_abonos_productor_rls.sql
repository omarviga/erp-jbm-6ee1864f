-- ==========================================================
-- GARANTIZAR ABONOS DE PRODUCTORES (pago parcial CxP)
--
-- Las tablas abonos_productor y abono_asignaciones ya existen
-- en la BD (los tipos JS fueron generados desde el esquema real),
-- pero no hay migracion que garantice sus permisos/RLS para el
-- rol de Finanzas. Esto hace que el INSERT de "Aplicar pago
-- parcial" falle silenciosamente por ROW LEVEL SECURITY.
--
-- Esta migracion es IDEMPOTENTE y segura de ejecutar varias veces:
--   - Crea las tablas solo si no existen (no toca las existentes).
--   - Habilita RLS y crea politicas admin/finanzas.
--   - Otorga los permisos minimos al rol authenticated.
-- ==========================================================

-- 1. TABLA DE ABONOS (adelantos / pagos parciales a productores)
CREATE TABLE IF NOT EXISTS public.abonos_productor (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  productor_id    UUID NOT NULL REFERENCES public.productores(id) ON DELETE CASCADE,
  monto           NUMERIC(14,2) NOT NULL,
  metodo_pago     TEXT NOT NULL DEFAULT 'efectivo',
  referencia      TEXT,
  comprobante_url TEXT,
  notas           TEXT,
  usuario_id      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abonos_productor_productor ON public.abonos_productor(productor_id);
CREATE INDEX IF NOT EXISTS idx_abonos_productor_metodo ON public.abonos_productor(metodo_pago);

-- 2. TABLA DE ASIGNACIONES (que monto de un abono cubre cada nota CxP)
CREATE TABLE IF NOT EXISTS public.abono_asignaciones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abono_id       UUID NOT NULL REFERENCES public.abonos_productor(id) ON DELETE CASCADE,
  cxp_id         UUID NOT NULL REFERENCES public.cuentas_por_pagar(id) ON DELETE CASCADE,
  monto_aplicado NUMERIC(14,2) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abono_asignaciones_abono ON public.abono_asignaciones(abono_id);
CREATE INDEX IF NOT EXISTS idx_abono_asignaciones_cxp ON public.abono_asignaciones(cxp_id);

-- 3. RLS: solo admin/finanzas pueden ver y registrar abonos
ALTER TABLE public.abonos_productor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abono_asignaciones ENABLE ROW LEVEL SECURITY;

-- ABONOS_PRODUCTOR
DROP POLICY IF EXISTS "abonos_role_view" ON public.abonos_productor;
CREATE POLICY "abonos_role_view" ON public.abonos_productor
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  );

DROP POLICY IF EXISTS "abonos_role_insert" ON public.abonos_productor;
CREATE POLICY "abonos_role_insert" ON public.abonos_productor
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  );

DROP POLICY IF EXISTS "abonos_role_update" ON public.abonos_productor;
CREATE POLICY "abonos_role_update" ON public.abonos_productor
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  );

-- ABONO_ASIGNACIONES
DROP POLICY IF EXISTS "abono_asig_role_view" ON public.abono_asignaciones;
CREATE POLICY "abono_asig_role_view" ON public.abono_asignaciones
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  );

DROP POLICY IF EXISTS "abono_asig_role_insert" ON public.abono_asignaciones;
CREATE POLICY "abono_asig_role_insert" ON public.abono_asignaciones
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  );

-- 4. GRANTS minimos al rol authenticated
GRANT SELECT, INSERT, UPDATE ON public.abonos_productor TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.abono_asignaciones TO authenticated;