-- Fix financial_data_weak_protection: Add explicit auth.uid() IS NOT NULL checks
-- This ensures authentication is always required before role checks

-- Drop existing policies for financial tables and recreate with explicit auth checks

-- ANTICIPOS table
DROP POLICY IF EXISTS "Finanzas can manage anticipos" ON public.anticipos;
DROP POLICY IF EXISTS "Admin full access anticipos" ON public.anticipos;

CREATE POLICY "Admin full access anticipos"
ON public.anticipos FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Finanzas can manage anticipos"
ON public.anticipos FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'finanzas'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'finanzas'));

-- LIQUIDACIONES table
DROP POLICY IF EXISTS "Finanzas can manage liquidaciones" ON public.liquidaciones;
DROP POLICY IF EXISTS "Admin full access liquidaciones" ON public.liquidaciones;

CREATE POLICY "Admin full access liquidaciones"
ON public.liquidaciones FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Finanzas can manage liquidaciones"
ON public.liquidaciones FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'finanzas'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'finanzas'));

-- LIQUIDACION_LOTES table
DROP POLICY IF EXISTS "Finanzas can manage liquidacion_lotes" ON public.liquidacion_lotes;
DROP POLICY IF EXISTS "Admin full access liquidacion_lotes" ON public.liquidacion_lotes;

CREATE POLICY "Admin full access liquidacion_lotes"
ON public.liquidacion_lotes FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Finanzas can manage liquidacion_lotes"
ON public.liquidacion_lotes FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'finanzas'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'finanzas'));

-- PAGOS_CLIENTES table
DROP POLICY IF EXISTS "Finanzas can manage pagos_clientes" ON public.pagos_clientes;
DROP POLICY IF EXISTS "Ventas can manage pagos_clientes" ON public.pagos_clientes;
DROP POLICY IF EXISTS "Admin full access pagos_clientes" ON public.pagos_clientes;

CREATE POLICY "Admin full access pagos_clientes"
ON public.pagos_clientes FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Finanzas can manage pagos_clientes"
ON public.pagos_clientes FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'finanzas'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'finanzas'));

CREATE POLICY "Ventas can manage pagos_clientes"
ON public.pagos_clientes FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'ventas'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'ventas'));

-- VENTAS table
DROP POLICY IF EXISTS "Ventas can manage ventas" ON public.ventas;
DROP POLICY IF EXISTS "Admin full access ventas" ON public.ventas;

CREATE POLICY "Admin full access ventas"
ON public.ventas FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Ventas can manage ventas"
ON public.ventas FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'ventas'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'ventas'));

-- VENTA_DETALLES table
DROP POLICY IF EXISTS "Ventas can manage venta_detalles" ON public.venta_detalles;
DROP POLICY IF EXISTS "Admin full access venta_detalles" ON public.venta_detalles;

CREATE POLICY "Admin full access venta_detalles"
ON public.venta_detalles FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Ventas can manage venta_detalles"
ON public.venta_detalles FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'ventas'))
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'ventas'));