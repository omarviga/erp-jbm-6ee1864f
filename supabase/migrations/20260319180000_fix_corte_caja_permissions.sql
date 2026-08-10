DROP POLICY IF EXISTS "Admin puede ver cortes de caja" ON public.cortes_caja_bodega;
DROP POLICY IF EXISTS "Admin puede crear cortes de caja" ON public.cortes_caja_bodega;
DROP POLICY IF EXISTS "Admin puede actualizar cortes de caja" ON public.cortes_caja_bodega;

CREATE POLICY "Admin ventas y almacen pueden ver cortes de caja"
ON public.cortes_caja_bodega
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ventas'::app_role)
  OR has_role(auth.uid(), 'almacen'::app_role)
);

CREATE POLICY "Admin ventas y almacen pueden crear cortes de caja"
ON public.cortes_caja_bodega
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ventas'::app_role)
  OR has_role(auth.uid(), 'almacen'::app_role)
);

CREATE POLICY "Admin ventas y almacen pueden actualizar cortes de caja"
ON public.cortes_caja_bodega
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ventas'::app_role)
  OR has_role(auth.uid(), 'almacen'::app_role)
);
