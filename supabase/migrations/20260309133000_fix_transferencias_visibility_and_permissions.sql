-- Ajuste de permisos para garantizar visibilidad y seguimiento de envíos CDMX
-- Problema: políticas demasiado restrictivas bloqueaban consulta/creación de transferencias

-- transferencias_bodega
DROP POLICY IF EXISTS "Admin y Ventas pueden ver transferencias" ON public.transferencias_bodega;
DROP POLICY IF EXISTS "Solo Admin puede crear transferencias" ON public.transferencias_bodega;
DROP POLICY IF EXISTS "Solo Admin puede actualizar transferencias" ON public.transferencias_bodega;

CREATE POLICY "Roles operativos pueden ver transferencias"
ON public.transferencias_bodega
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  )
);

CREATE POLICY "Roles operativos pueden crear transferencias"
ON public.transferencias_bodega
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
);

CREATE POLICY "Admin y almacen pueden actualizar transferencias"
ON public.transferencias_bodega
FOR UPDATE
TO authenticated
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

-- transferencia_detalles
DROP POLICY IF EXISTS "Ver detalles de transferencias" ON public.transferencia_detalles;
DROP POLICY IF EXISTS "Admin puede gestionar detalles transferencia" ON public.transferencia_detalles;

CREATE POLICY "Roles operativos pueden ver detalles transferencias"
ON public.transferencia_detalles
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  )
);

CREATE POLICY "Roles operativos pueden crear detalles transferencias"
ON public.transferencia_detalles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
);

CREATE POLICY "Admin y almacen pueden actualizar detalles transferencias"
ON public.transferencia_detalles
FOR UPDATE
TO authenticated
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

-- inventario_bodega_cdmx (solo lectura)
DROP POLICY IF EXISTS "Ver inventario CDMX" ON public.inventario_bodega_cdmx;

CREATE POLICY "Roles operativos pueden ver inventario CDMX"
ON public.inventario_bodega_cdmx
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  )
);
