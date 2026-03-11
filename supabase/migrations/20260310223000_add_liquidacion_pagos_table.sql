CREATE TABLE IF NOT EXISTS public.liquidacion_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id UUID NOT NULL REFERENCES public.liquidaciones(id) ON DELETE CASCADE,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  forma_pago public.forma_pago NOT NULL,
  referencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liquidacion_pagos_liquidacion_id
  ON public.liquidacion_pagos(liquidacion_id);

ALTER TABLE public.liquidacion_pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access liquidacion_pagos" ON public.liquidacion_pagos;
DROP POLICY IF EXISTS "Finanzas can manage liquidacion_pagos" ON public.liquidacion_pagos;

CREATE POLICY "Admin full access liquidacion_pagos"
ON public.liquidacion_pagos FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Finanzas can manage liquidacion_pagos"
ON public.liquidacion_pagos FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'finanzas'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'finanzas'));
