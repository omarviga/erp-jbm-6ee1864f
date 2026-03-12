CREATE TABLE IF NOT EXISTS public.gastos_cdmx (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  categoria public.categoria_gasto NOT NULL DEFAULT 'otros',
  concepto TEXT NOT NULL,
  monto DECIMAL(12,2) NOT NULL DEFAULT 0,
  proveedor TEXT,
  numero_ticket TEXT,
  notas TEXT,
  imagen_url TEXT,
  usuario_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gastos_cdmx_fecha ON public.gastos_cdmx(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_cdmx_categoria ON public.gastos_cdmx(categoria);
CREATE INDEX IF NOT EXISTS idx_gastos_cdmx_usuario ON public.gastos_cdmx(usuario_id);

DROP TRIGGER IF EXISTS update_gastos_cdmx_updated_at ON public.gastos_cdmx;
CREATE TRIGGER update_gastos_cdmx_updated_at
BEFORE UPDATE ON public.gastos_cdmx
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.gastos_cdmx ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver gastos CDMX" ON public.gastos_cdmx;
DROP POLICY IF EXISTS "Insertar gastos CDMX" ON public.gastos_cdmx;
DROP POLICY IF EXISTS "Actualizar gastos CDMX" ON public.gastos_cdmx;
DROP POLICY IF EXISTS "Eliminar gastos CDMX" ON public.gastos_cdmx;

CREATE POLICY "Ver gastos CDMX"
ON public.gastos_cdmx FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'finanzas'::app_role)
);

CREATE POLICY "Insertar gastos CDMX"
ON public.gastos_cdmx FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'finanzas'::app_role)
);

CREATE POLICY "Actualizar gastos CDMX"
ON public.gastos_cdmx FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'finanzas'::app_role)
);

CREATE POLICY "Eliminar gastos CDMX"
ON public.gastos_cdmx FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'finanzas'::app_role)
);

INSERT INTO public.gastos_cdmx (
  id,
  fecha,
  categoria,
  concepto,
  monto,
  proveedor,
  numero_ticket,
  notas,
  imagen_url,
  usuario_id,
  created_at,
  updated_at
)
SELECT
  g.id,
  COALESCE(g.fecha, g.created_at),
  g.categoria,
  g.concepto,
  g.monto,
  g.proveedor,
  g.numero_ticket,
  TRIM(REGEXP_REPLACE(COALESCE(g.notas, ''), '\[CC:CDMX\]\s*', '', 'gi')),
  g.imagen_url,
  g.usuario_id,
  g.created_at,
  g.updated_at
FROM public.gastos g
WHERE COALESCE(g.notas, '') ILIKE '%[CC:CDMX]%'
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.gastos_cdmx IS 'Gastos exclusivos de la operación Bodega CDMX';
