-- Production hardening for legacy RLS policies.
-- Replaces broad authenticated access with explicit role-based policies
-- for critical commercial and facturation tables.

-- =========================
-- CLIENTES
-- =========================
DROP POLICY IF EXISTS "Authenticated users can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Role-based view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Role-based insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Role-based update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admin can delete clientes" ON public.clientes;

CREATE POLICY "Role-based view clientes" ON public.clientes
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Role-based insert clientes" ON public.clientes
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  )
);

CREATE POLICY "Admin can delete clientes" ON public.clientes
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Keep UPDATE controlled by later hardening policies:
-- "Admin finanzas can update clientes"
-- "Ventas can update non-financial clientes"

-- =========================
-- VENTAS
-- =========================
DROP POLICY IF EXISTS "Authenticated users can view ventas" ON public.ventas;
DROP POLICY IF EXISTS "Authenticated users can insert ventas" ON public.ventas;
DROP POLICY IF EXISTS "Authenticated users can update ventas" ON public.ventas;
DROP POLICY IF EXISTS "Role-based view ventas" ON public.ventas;
DROP POLICY IF EXISTS "Role-based insert ventas" ON public.ventas;
DROP POLICY IF EXISTS "Role-based update ventas" ON public.ventas;
DROP POLICY IF EXISTS "Admin can delete ventas" ON public.ventas;

CREATE POLICY "Role-based view ventas" ON public.ventas
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Role-based insert ventas" ON public.ventas
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  )
);

CREATE POLICY "Role-based update ventas" ON public.ventas
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Admin can delete ventas" ON public.ventas
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- =========================
-- VENTA_DETALLES
-- =========================
DROP POLICY IF EXISTS "Authenticated users can view venta_detalles" ON public.venta_detalles;
DROP POLICY IF EXISTS "Authenticated users can insert venta_detalles" ON public.venta_detalles;
DROP POLICY IF EXISTS "Role-based view venta_detalles" ON public.venta_detalles;
DROP POLICY IF EXISTS "Role-based insert venta_detalles" ON public.venta_detalles;
DROP POLICY IF EXISTS "Admin can delete venta_detalles" ON public.venta_detalles;

CREATE POLICY "Role-based view venta_detalles" ON public.venta_detalles
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Role-based insert venta_detalles" ON public.venta_detalles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  )
);

CREATE POLICY "Admin can delete venta_detalles" ON public.venta_detalles
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- =========================
-- PAGOS_CLIENTES
-- =========================
DROP POLICY IF EXISTS "Authenticated users can view pagos_clientes" ON public.pagos_clientes;
DROP POLICY IF EXISTS "Authenticated users can insert pagos_clientes" ON public.pagos_clientes;
DROP POLICY IF EXISTS "Role-based view pagos_clientes" ON public.pagos_clientes;
DROP POLICY IF EXISTS "Role-based insert pagos_clientes" ON public.pagos_clientes;
DROP POLICY IF EXISTS "Admin can delete pagos_clientes" ON public.pagos_clientes;

CREATE POLICY "Role-based view pagos_clientes" ON public.pagos_clientes
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Role-based insert pagos_clientes" ON public.pagos_clientes
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Admin can delete pagos_clientes" ON public.pagos_clientes
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

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
    OR has_role(auth.uid(), 'ventas'::app_role)
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
    OR has_role(auth.uid(), 'ventas'::app_role)
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
