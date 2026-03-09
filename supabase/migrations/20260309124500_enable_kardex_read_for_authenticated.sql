-- Permite consultar trazabilidad de inventario (kardex) desde el cliente autenticado.
ALTER TABLE public.inventario_kardex ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view inventario_kardex" ON public.inventario_kardex;
CREATE POLICY "Authenticated users can view inventario_kardex"
ON public.inventario_kardex
FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON public.inventario_kardex TO authenticated;
