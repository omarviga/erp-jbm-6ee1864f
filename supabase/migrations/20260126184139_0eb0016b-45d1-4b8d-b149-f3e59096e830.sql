-- Tighten access controls for sensitive tables flagged by scanner
-- 1) Ensure RLS is enabled and enforced even for table owners
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidaciones FORCE ROW LEVEL SECURITY;

-- 2) Replace policies with explicit authenticated-only role scoping (defense-in-depth)
-- clientes
DROP POLICY IF EXISTS "Admin can delete clientes" ON public.clientes;
DROP POLICY IF EXISTS "Role-based insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Role-based update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Role-based view clientes" ON public.clientes;

CREATE POLICY "Clientes can view by role"
ON public.clientes
FOR SELECT
TO authenticated
USING (
  (auth.uid() IS NOT NULL)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Clientes can insert by role"
ON public.clientes
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() IS NOT NULL)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  )
);

CREATE POLICY "Clientes can update by role"
ON public.clientes
FOR UPDATE
TO authenticated
USING (
  (auth.uid() IS NOT NULL)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  )
)
WITH CHECK (
  (auth.uid() IS NOT NULL)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  )
);

CREATE POLICY "Clientes admin can delete"
ON public.clientes
FOR DELETE
TO authenticated
USING (
  (auth.uid() IS NOT NULL)
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- liquidaciones
DROP POLICY IF EXISTS "Admin can delete liquidaciones" ON public.liquidaciones;
DROP POLICY IF EXISTS "Admin full access liquidaciones" ON public.liquidaciones;
DROP POLICY IF EXISTS "Finanzas can manage liquidaciones" ON public.liquidaciones;
DROP POLICY IF EXISTS "Role-based insert liquidaciones" ON public.liquidaciones;
DROP POLICY IF EXISTS "Role-based update liquidaciones" ON public.liquidaciones;
DROP POLICY IF EXISTS "Role-based view liquidaciones" ON public.liquidaciones;

CREATE POLICY "Liquidaciones can view by role"
ON public.liquidaciones
FOR SELECT
TO authenticated
USING (
  (auth.uid() IS NOT NULL)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Liquidaciones can insert by role"
ON public.liquidaciones
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() IS NOT NULL)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Liquidaciones can update by role"
ON public.liquidaciones
FOR UPDATE
TO authenticated
USING (
  (auth.uid() IS NOT NULL)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
)
WITH CHECK (
  (auth.uid() IS NOT NULL)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Liquidaciones admin can delete"
ON public.liquidaciones
FOR DELETE
TO authenticated
USING (
  (auth.uid() IS NOT NULL)
  AND has_role(auth.uid(), 'admin'::app_role)
);
