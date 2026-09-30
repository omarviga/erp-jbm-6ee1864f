-- Reconcile effective production RLS state after audit queries.
-- 1. Remove overlapping clientes policies that broaden access via OR semantics.
-- 2. Remove remaining permissive ALL policies on facturation/logistics tables.
-- 3. Recreate explicit role-based policies where needed.

-- =========================
-- CLIENTES
-- =========================
-- Keep the stricter "Clientes * strict" family as source of truth in production.
DROP POLICY IF EXISTS "Role-based view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Role-based insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Role-based update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admin can delete clientes" ON public.clientes;

-- =========================
-- TRANSPORTISTAS
-- =========================
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.transportistas;
DROP POLICY IF EXISTS "Role-based view transportistas" ON public.transportistas;
DROP POLICY IF EXISTS "Role-based insert transportistas" ON public.transportistas;
DROP POLICY IF EXISTS "Role-based update transportistas" ON public.transportistas;
DROP POLICY IF EXISTS "Admin can delete transportistas" ON public.transportistas;

CREATE POLICY "Role-based view transportistas" ON public.transportistas
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Role-based insert transportistas" ON public.transportistas
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Role-based update transportistas" ON public.transportistas
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Admin can delete transportistas" ON public.transportistas
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- =========================
-- FACTURAS
-- =========================
-- Preserve existing owner policies and add role-based admin/finanzas access.
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.facturas;
DROP POLICY IF EXISTS "Role-based view facturas" ON public.facturas;
DROP POLICY IF EXISTS "Role-based insert facturas" ON public.facturas;
DROP POLICY IF EXISTS "Role-based update facturas" ON public.facturas;
DROP POLICY IF EXISTS "Admin can delete facturas" ON public.facturas;

CREATE POLICY "Role-based view facturas" ON public.facturas
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Role-based insert facturas" ON public.facturas
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Role-based update facturas" ON public.facturas
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Admin can delete facturas" ON public.facturas
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- =========================
-- FACTURA_DETALLES
-- =========================
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.factura_detalles;
DROP POLICY IF EXISTS "Role-based view factura_detalles" ON public.factura_detalles;
DROP POLICY IF EXISTS "Role-based insert factura_detalles" ON public.factura_detalles;
DROP POLICY IF EXISTS "Role-based update factura_detalles" ON public.factura_detalles;
DROP POLICY IF EXISTS "Admin can delete factura_detalles" ON public.factura_detalles;

CREATE POLICY "Role-based view factura_detalles" ON public.factura_detalles
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Role-based insert factura_detalles" ON public.factura_detalles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Role-based update factura_detalles" ON public.factura_detalles
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Admin can delete factura_detalles" ON public.factura_detalles
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);
