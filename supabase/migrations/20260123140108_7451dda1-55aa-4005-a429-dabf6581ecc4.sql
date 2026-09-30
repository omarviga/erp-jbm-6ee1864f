
-- =====================================================
-- SECURITY FIX: Add explicit auth.uid() IS NOT NULL checks
-- to all RLS policies for defense-in-depth
-- =====================================================

-- Drop existing policies and recreate with explicit auth checks

-- PRODUCTORES
DROP POLICY IF EXISTS "Role-based view productores" ON public.productores;
DROP POLICY IF EXISTS "Role-based insert productores" ON public.productores;
DROP POLICY IF EXISTS "Role-based update productores" ON public.productores;
DROP POLICY IF EXISTS "Admin can delete productores" ON public.productores;

CREATE POLICY "Role-based view productores" ON public.productores
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Role-based insert productores" ON public.productores
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Role-based update productores" ON public.productores
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Admin can delete productores" ON public.productores
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- HUERTOS
DROP POLICY IF EXISTS "Role-based view huertos" ON public.huertos;
DROP POLICY IF EXISTS "Role-based insert huertos" ON public.huertos;
DROP POLICY IF EXISTS "Role-based update huertos" ON public.huertos;
DROP POLICY IF EXISTS "Admin can delete huertos" ON public.huertos;

CREATE POLICY "Role-based view huertos" ON public.huertos
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Role-based insert huertos" ON public.huertos
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Role-based update huertos" ON public.huertos
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Admin can delete huertos" ON public.huertos
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- CORTADORES
DROP POLICY IF EXISTS "Role-based view cortadores" ON public.cortadores;
DROP POLICY IF EXISTS "Role-based insert cortadores" ON public.cortadores;
DROP POLICY IF EXISTS "Role-based update cortadores" ON public.cortadores;
DROP POLICY IF EXISTS "Admin can delete cortadores" ON public.cortadores;

CREATE POLICY "Role-based view cortadores" ON public.cortadores
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Role-based insert cortadores" ON public.cortadores
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Role-based update cortadores" ON public.cortadores
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Admin can delete cortadores" ON public.cortadores
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- LOTES
DROP POLICY IF EXISTS "Role-based view lotes" ON public.lotes;
DROP POLICY IF EXISTS "Role-based insert lotes" ON public.lotes;
DROP POLICY IF EXISTS "Role-based update lotes" ON public.lotes;
DROP POLICY IF EXISTS "Admin can delete lotes" ON public.lotes;

CREATE POLICY "Role-based view lotes" ON public.lotes
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Role-based insert lotes" ON public.lotes
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Role-based update lotes" ON public.lotes
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Admin can delete lotes" ON public.lotes
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- LOTE_CORTADORES
DROP POLICY IF EXISTS "Role-based view lote_cortadores" ON public.lote_cortadores;
DROP POLICY IF EXISTS "Role-based insert lote_cortadores" ON public.lote_cortadores;
DROP POLICY IF EXISTS "Admin can delete lote_cortadores" ON public.lote_cortadores;

CREATE POLICY "Role-based view lote_cortadores" ON public.lote_cortadores
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Role-based insert lote_cortadores" ON public.lote_cortadores
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Admin can delete lote_cortadores" ON public.lote_cortadores
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- PRESENTACIONES
DROP POLICY IF EXISTS "Role-based view presentaciones" ON public.presentaciones;
DROP POLICY IF EXISTS "Role-based insert presentaciones" ON public.presentaciones;
DROP POLICY IF EXISTS "Admin can delete presentaciones" ON public.presentaciones;

CREATE POLICY "Role-based view presentaciones" ON public.presentaciones
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role) OR has_role(auth.uid(), 'ventas'::app_role))
);

CREATE POLICY "Role-based insert presentaciones" ON public.presentaciones
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Admin can delete presentaciones" ON public.presentaciones
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- PRODUCCION
DROP POLICY IF EXISTS "Role-based view produccion" ON public.produccion;
DROP POLICY IF EXISTS "Role-based insert produccion" ON public.produccion;
DROP POLICY IF EXISTS "Admin can delete produccion" ON public.produccion;

CREATE POLICY "Role-based view produccion" ON public.produccion
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role) OR has_role(auth.uid(), 'ventas'::app_role))
);

CREATE POLICY "Role-based insert produccion" ON public.produccion
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Admin can delete produccion" ON public.produccion
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- CAMARA_FRIA
DROP POLICY IF EXISTS "Role-based view camara_fria" ON public.camara_fria;
DROP POLICY IF EXISTS "Role-based insert camara_fria" ON public.camara_fria;
DROP POLICY IF EXISTS "Role-based update camara_fria" ON public.camara_fria;
DROP POLICY IF EXISTS "Admin can delete camara_fria" ON public.camara_fria;

CREATE POLICY "Role-based view camara_fria" ON public.camara_fria
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role) OR has_role(auth.uid(), 'almacen'::app_role) OR has_role(auth.uid(), 'ventas'::app_role))
);

CREATE POLICY "Role-based insert camara_fria" ON public.camara_fria
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Role-based update camara_fria" ON public.camara_fria
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Admin can delete camara_fria" ON public.camara_fria
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- REGISTRO_TEMPERATURAS
DROP POLICY IF EXISTS "Role-based view registro_temperaturas" ON public.registro_temperaturas;
DROP POLICY IF EXISTS "Role-based insert registro_temperaturas" ON public.registro_temperaturas;
DROP POLICY IF EXISTS "Admin can delete registro_temperaturas" ON public.registro_temperaturas;

CREATE POLICY "Role-based view registro_temperaturas" ON public.registro_temperaturas
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Role-based insert registro_temperaturas" ON public.registro_temperaturas
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Admin can delete registro_temperaturas" ON public.registro_temperaturas
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- STOCK_MOLINO
DROP POLICY IF EXISTS "Role-based view stock_molino" ON public.stock_molino;
DROP POLICY IF EXISTS "Role-based insert stock_molino" ON public.stock_molino;
DROP POLICY IF EXISTS "Role-based update stock_molino" ON public.stock_molino;
DROP POLICY IF EXISTS "Admin can delete stock_molino" ON public.stock_molino;

CREATE POLICY "Role-based view stock_molino" ON public.stock_molino
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role) OR has_role(auth.uid(), 'ventas'::app_role))
);

CREATE POLICY "Role-based insert stock_molino" ON public.stock_molino
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Role-based update stock_molino" ON public.stock_molino
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Admin can delete stock_molino" ON public.stock_molino
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- INSUMOS
DROP POLICY IF EXISTS "Role-based view insumos" ON public.insumos;
DROP POLICY IF EXISTS "Role-based insert insumos" ON public.insumos;
DROP POLICY IF EXISTS "Role-based update insumos" ON public.insumos;
DROP POLICY IF EXISTS "Admin can delete insumos" ON public.insumos;

CREATE POLICY "Role-based view insumos" ON public.insumos
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

CREATE POLICY "Role-based insert insumos" ON public.insumos
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Role-based update insumos" ON public.insumos
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Admin can delete insumos" ON public.insumos
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- INSUMO_MOVIMIENTOS
DROP POLICY IF EXISTS "Role-based view insumo_movimientos" ON public.insumo_movimientos;
DROP POLICY IF EXISTS "Role-based insert insumo_movimientos" ON public.insumo_movimientos;
DROP POLICY IF EXISTS "Admin can delete insumo_movimientos" ON public.insumo_movimientos;

CREATE POLICY "Role-based view insumo_movimientos" ON public.insumo_movimientos
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Role-based insert insumo_movimientos" ON public.insumo_movimientos
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Admin can delete insumo_movimientos" ON public.insumo_movimientos
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- CLIENTES
DROP POLICY IF EXISTS "Role-based view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Role-based insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Role-based update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admin can delete clientes" ON public.clientes;

CREATE POLICY "Role-based view clientes" ON public.clientes
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Role-based insert clientes" ON public.clientes
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role))
);

CREATE POLICY "Role-based update clientes" ON public.clientes
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role))
);

CREATE POLICY "Admin can delete clientes" ON public.clientes
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- VENTAS
DROP POLICY IF EXISTS "Role-based view ventas" ON public.ventas;
DROP POLICY IF EXISTS "Role-based insert ventas" ON public.ventas;
DROP POLICY IF EXISTS "Role-based update ventas" ON public.ventas;
DROP POLICY IF EXISTS "Admin can delete ventas" ON public.ventas;

CREATE POLICY "Role-based view ventas" ON public.ventas
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Role-based insert ventas" ON public.ventas
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role))
);

CREATE POLICY "Role-based update ventas" ON public.ventas
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Admin can delete ventas" ON public.ventas
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- VENTA_DETALLES
DROP POLICY IF EXISTS "Role-based view venta_detalles" ON public.venta_detalles;
DROP POLICY IF EXISTS "Role-based insert venta_detalles" ON public.venta_detalles;
DROP POLICY IF EXISTS "Admin can delete venta_detalles" ON public.venta_detalles;

CREATE POLICY "Role-based view venta_detalles" ON public.venta_detalles
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Role-based insert venta_detalles" ON public.venta_detalles
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role))
);

CREATE POLICY "Admin can delete venta_detalles" ON public.venta_detalles
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- PAGOS_CLIENTES
DROP POLICY IF EXISTS "Role-based view pagos_clientes" ON public.pagos_clientes;
DROP POLICY IF EXISTS "Role-based insert pagos_clientes" ON public.pagos_clientes;
DROP POLICY IF EXISTS "Admin can delete pagos_clientes" ON public.pagos_clientes;

CREATE POLICY "Role-based view pagos_clientes" ON public.pagos_clientes
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Role-based insert pagos_clientes" ON public.pagos_clientes
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Admin can delete pagos_clientes" ON public.pagos_clientes
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- GUIAS_SALIDA
DROP POLICY IF EXISTS "Role-based view guias_salida" ON public.guias_salida;
DROP POLICY IF EXISTS "Role-based insert guias_salida" ON public.guias_salida;
DROP POLICY IF EXISTS "Role-based update guias_salida" ON public.guias_salida;
DROP POLICY IF EXISTS "Admin can delete guias_salida" ON public.guias_salida;

CREATE POLICY "Role-based view guias_salida" ON public.guias_salida
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Role-based insert guias_salida" ON public.guias_salida
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Role-based update guias_salida" ON public.guias_salida
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Admin can delete guias_salida" ON public.guias_salida
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- GUIA_DETALLES
DROP POLICY IF EXISTS "Role-based view guia_detalles" ON public.guia_detalles;
DROP POLICY IF EXISTS "Role-based insert guia_detalles" ON public.guia_detalles;
DROP POLICY IF EXISTS "Admin can delete guia_detalles" ON public.guia_detalles;

CREATE POLICY "Role-based view guia_detalles" ON public.guia_detalles
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Role-based insert guia_detalles" ON public.guia_detalles
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
);

CREATE POLICY "Admin can delete guia_detalles" ON public.guia_detalles
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- ANTICIPOS
DROP POLICY IF EXISTS "Role-based view anticipos" ON public.anticipos;
DROP POLICY IF EXISTS "Role-based insert anticipos" ON public.anticipos;
DROP POLICY IF EXISTS "Role-based update anticipos" ON public.anticipos;
DROP POLICY IF EXISTS "Admin can delete anticipos" ON public.anticipos;

CREATE POLICY "Role-based view anticipos" ON public.anticipos
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Role-based insert anticipos" ON public.anticipos
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Role-based update anticipos" ON public.anticipos
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Admin can delete anticipos" ON public.anticipos
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- LIQUIDACIONES
DROP POLICY IF EXISTS "Role-based view liquidaciones" ON public.liquidaciones;
DROP POLICY IF EXISTS "Role-based insert liquidaciones" ON public.liquidaciones;
DROP POLICY IF EXISTS "Admin can delete liquidaciones" ON public.liquidaciones;

CREATE POLICY "Role-based view liquidaciones" ON public.liquidaciones
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Role-based insert liquidaciones" ON public.liquidaciones
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Admin can delete liquidaciones" ON public.liquidaciones
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- LIQUIDACION_LOTES
DROP POLICY IF EXISTS "Role-based view liquidacion_lotes" ON public.liquidacion_lotes;
DROP POLICY IF EXISTS "Role-based insert liquidacion_lotes" ON public.liquidacion_lotes;
DROP POLICY IF EXISTS "Admin can delete liquidacion_lotes" ON public.liquidacion_lotes;

CREATE POLICY "Role-based view liquidacion_lotes" ON public.liquidacion_lotes
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Role-based insert liquidacion_lotes" ON public.liquidacion_lotes
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Admin can delete liquidacion_lotes" ON public.liquidacion_lotes
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- USER_ROLES (special case - admin only for management, but users can view their own)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can delete roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (
  auth.uid() IS NOT NULL AND auth.uid() = user_id
);

CREATE POLICY "Admin can view all roles" ON public.user_roles
FOR SELECT USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can insert roles" ON public.user_roles
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update roles" ON public.user_roles
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can delete roles" ON public.user_roles
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);
