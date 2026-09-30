-- =============================================
-- ROLE-BASED RLS POLICIES MIGRATION
-- Replace permissive policies with role-based access control
-- =============================================

-- ACCESS MATRIX:
-- Admin: Full access to all tables
-- Produccion: lotes, produccion, camara_fria, registro_temperaturas, cortadores, huertos, presentaciones, lote_cortadores, stock_molino
-- Finanzas: productores, anticipos, liquidaciones, liquidacion_lotes, pagos_clientes, clientes, lotes (read)
-- Ventas: ventas, venta_detalles, guias_salida, guia_detalles, clientes (read), camara_fria (read), stock_molino (read)
-- Almacen: insumos, insumo_movimientos, camara_fria, stock_molino

-- =============================================
-- 1. PRODUCTORES TABLE (Financial data - Admin, Finanzas only)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view productores" ON public.productores;
DROP POLICY IF EXISTS "Authenticated users can insert productores" ON public.productores;
DROP POLICY IF EXISTS "Authenticated users can update productores" ON public.productores;

CREATE POLICY "Role-based view productores" ON public.productores
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Role-based insert productores" ON public.productores
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Role-based update productores" ON public.productores
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Admin can delete productores" ON public.productores
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 2. ANTICIPOS TABLE (Financial - Admin, Finanzas only)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view anticipos" ON public.anticipos;
DROP POLICY IF EXISTS "Authenticated users can insert anticipos" ON public.anticipos;
DROP POLICY IF EXISTS "Authenticated users can update anticipos" ON public.anticipos;

CREATE POLICY "Role-based view anticipos" ON public.anticipos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Role-based insert anticipos" ON public.anticipos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Role-based update anticipos" ON public.anticipos
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Admin can delete anticipos" ON public.anticipos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 3. LIQUIDACIONES TABLE (Financial - Admin, Finanzas only)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view liquidaciones" ON public.liquidaciones;
DROP POLICY IF EXISTS "Authenticated users can insert liquidaciones" ON public.liquidaciones;

CREATE POLICY "Role-based view liquidaciones" ON public.liquidaciones
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Role-based insert liquidaciones" ON public.liquidaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Admin can delete liquidaciones" ON public.liquidaciones
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 4. LIQUIDACION_LOTES TABLE (Financial - Admin, Finanzas only)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view liquidacion_lotes" ON public.liquidacion_lotes;
DROP POLICY IF EXISTS "Authenticated users can insert liquidacion_lotes" ON public.liquidacion_lotes;

CREATE POLICY "Role-based view liquidacion_lotes" ON public.liquidacion_lotes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Role-based insert liquidacion_lotes" ON public.liquidacion_lotes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Admin can delete liquidacion_lotes" ON public.liquidacion_lotes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 5. PAGOS_CLIENTES TABLE (Financial - Admin, Finanzas only)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view pagos_clientes" ON public.pagos_clientes;
DROP POLICY IF EXISTS "Authenticated users can insert pagos_clientes" ON public.pagos_clientes;

CREATE POLICY "Role-based view pagos_clientes" ON public.pagos_clientes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Role-based insert pagos_clientes" ON public.pagos_clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Admin can delete pagos_clientes" ON public.pagos_clientes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 6. CLIENTES TABLE (Finanzas modify, Ventas read)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can update clientes" ON public.clientes;

CREATE POLICY "Role-based view clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas') OR 
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Role-based insert clientes" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Role-based update clientes" ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Admin can delete clientes" ON public.clientes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 7. CORTADORES TABLE (Production - Admin, Produccion only)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view cortadores" ON public.cortadores;
DROP POLICY IF EXISTS "Authenticated users can insert cortadores" ON public.cortadores;
DROP POLICY IF EXISTS "Authenticated users can update cortadores" ON public.cortadores;

CREATE POLICY "Role-based view cortadores" ON public.cortadores
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion')
  );

CREATE POLICY "Role-based insert cortadores" ON public.cortadores
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion')
  );

CREATE POLICY "Role-based update cortadores" ON public.cortadores
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion')
  );

CREATE POLICY "Admin can delete cortadores" ON public.cortadores
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 8. HUERTOS TABLE (Production - Admin, Produccion only)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view huertos" ON public.huertos;
DROP POLICY IF EXISTS "Authenticated users can insert huertos" ON public.huertos;
DROP POLICY IF EXISTS "Authenticated users can update huertos" ON public.huertos;

CREATE POLICY "Role-based view huertos" ON public.huertos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion')
  );

CREATE POLICY "Role-based insert huertos" ON public.huertos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion')
  );

CREATE POLICY "Role-based update huertos" ON public.huertos
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion')
  );

CREATE POLICY "Admin can delete huertos" ON public.huertos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 9. LOTES TABLE (Production modify, Finanzas read for liquidations)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view lotes" ON public.lotes;
DROP POLICY IF EXISTS "Authenticated users can insert lotes" ON public.lotes;
DROP POLICY IF EXISTS "Authenticated users can update lotes" ON public.lotes;

CREATE POLICY "Role-based view lotes" ON public.lotes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion') OR 
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Role-based insert lotes" ON public.lotes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion')
  );

CREATE POLICY "Role-based update lotes" ON public.lotes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion') OR
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Admin can delete lotes" ON public.lotes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 10. LOTE_CORTADORES TABLE (Production - Admin, Produccion)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view lote_cortadores" ON public.lote_cortadores;
DROP POLICY IF EXISTS "Authenticated users can insert lote_cortadores" ON public.lote_cortadores;

CREATE POLICY "Role-based view lote_cortadores" ON public.lote_cortadores
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion')
  );

CREATE POLICY "Role-based insert lote_cortadores" ON public.lote_cortadores
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion')
  );

CREATE POLICY "Admin can delete lote_cortadores" ON public.lote_cortadores
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 11. PRODUCCION TABLE (Production - Admin, Produccion)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view produccion" ON public.produccion;
DROP POLICY IF EXISTS "Authenticated users can insert produccion" ON public.produccion;

CREATE POLICY "Role-based view produccion" ON public.produccion
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion') OR
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Role-based insert produccion" ON public.produccion
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion')
  );

CREATE POLICY "Admin can delete produccion" ON public.produccion
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 12. PRESENTACIONES TABLE (Production - Admin, Produccion)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view presentaciones" ON public.presentaciones;
DROP POLICY IF EXISTS "Authenticated users can insert presentaciones" ON public.presentaciones;

CREATE POLICY "Role-based view presentaciones" ON public.presentaciones
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion') OR
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Role-based insert presentaciones" ON public.presentaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion')
  );

CREATE POLICY "Admin can delete presentaciones" ON public.presentaciones
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 13. CAMARA_FRIA TABLE (Production, Almacen, Ventas read)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view camara_fria" ON public.camara_fria;
DROP POLICY IF EXISTS "Authenticated users can insert camara_fria" ON public.camara_fria;
DROP POLICY IF EXISTS "Authenticated users can update camara_fria" ON public.camara_fria;

CREATE POLICY "Role-based view camara_fria" ON public.camara_fria
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion') OR
    public.has_role(auth.uid(), 'almacen') OR
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Role-based insert camara_fria" ON public.camara_fria
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion') OR
    public.has_role(auth.uid(), 'almacen')
  );

CREATE POLICY "Role-based update camara_fria" ON public.camara_fria
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion') OR
    public.has_role(auth.uid(), 'almacen')
  );

CREATE POLICY "Admin can delete camara_fria" ON public.camara_fria
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 14. REGISTRO_TEMPERATURAS TABLE (Production, Almacen)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view registro_temperaturas" ON public.registro_temperaturas;
DROP POLICY IF EXISTS "Authenticated users can insert registro_temperaturas" ON public.registro_temperaturas;

CREATE POLICY "Role-based view registro_temperaturas" ON public.registro_temperaturas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion') OR
    public.has_role(auth.uid(), 'almacen')
  );

CREATE POLICY "Role-based insert registro_temperaturas" ON public.registro_temperaturas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion') OR
    public.has_role(auth.uid(), 'almacen')
  );

CREATE POLICY "Admin can delete registro_temperaturas" ON public.registro_temperaturas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 15. STOCK_MOLINO TABLE (Production, Almacen, Ventas read)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view stock_molino" ON public.stock_molino;
DROP POLICY IF EXISTS "Authenticated users can insert stock_molino" ON public.stock_molino;
DROP POLICY IF EXISTS "Authenticated users can update stock_molino" ON public.stock_molino;

CREATE POLICY "Role-based view stock_molino" ON public.stock_molino
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion') OR
    public.has_role(auth.uid(), 'almacen') OR
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Role-based insert stock_molino" ON public.stock_molino
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion') OR
    public.has_role(auth.uid(), 'almacen')
  );

CREATE POLICY "Role-based update stock_molino" ON public.stock_molino
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'produccion') OR
    public.has_role(auth.uid(), 'almacen')
  );

CREATE POLICY "Admin can delete stock_molino" ON public.stock_molino
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 16. INSUMOS TABLE (Almacen - Admin, Almacen)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view insumos" ON public.insumos;
DROP POLICY IF EXISTS "Authenticated users can insert insumos" ON public.insumos;
DROP POLICY IF EXISTS "Authenticated users can update insumos" ON public.insumos;

CREATE POLICY "Role-based view insumos" ON public.insumos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'almacen') OR
    public.has_role(auth.uid(), 'produccion')
  );

CREATE POLICY "Role-based insert insumos" ON public.insumos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'almacen')
  );

CREATE POLICY "Role-based update insumos" ON public.insumos
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'almacen')
  );

CREATE POLICY "Admin can delete insumos" ON public.insumos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 17. INSUMO_MOVIMIENTOS TABLE (Almacen)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view insumo_movimientos" ON public.insumo_movimientos;
DROP POLICY IF EXISTS "Authenticated users can insert insumo_movimientos" ON public.insumo_movimientos;

CREATE POLICY "Role-based view insumo_movimientos" ON public.insumo_movimientos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'almacen')
  );

CREATE POLICY "Role-based insert insumo_movimientos" ON public.insumo_movimientos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'almacen')
  );

CREATE POLICY "Admin can delete insumo_movimientos" ON public.insumo_movimientos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 18. VENTAS TABLE (Ventas - Admin, Ventas)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view ventas" ON public.ventas;
DROP POLICY IF EXISTS "Authenticated users can insert ventas" ON public.ventas;
DROP POLICY IF EXISTS "Authenticated users can update ventas" ON public.ventas;

CREATE POLICY "Role-based view ventas" ON public.ventas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'ventas') OR
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Role-based insert ventas" ON public.ventas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Role-based update ventas" ON public.ventas
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Admin can delete ventas" ON public.ventas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 19. VENTA_DETALLES TABLE (Ventas)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view venta_detalles" ON public.venta_detalles;
DROP POLICY IF EXISTS "Authenticated users can insert venta_detalles" ON public.venta_detalles;

CREATE POLICY "Role-based view venta_detalles" ON public.venta_detalles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'ventas') OR
    public.has_role(auth.uid(), 'finanzas')
  );

CREATE POLICY "Role-based insert venta_detalles" ON public.venta_detalles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Admin can delete venta_detalles" ON public.venta_detalles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 20. GUIAS_SALIDA TABLE (Ventas - Admin, Ventas)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view guias_salida" ON public.guias_salida;
DROP POLICY IF EXISTS "Authenticated users can insert guias_salida" ON public.guias_salida;
DROP POLICY IF EXISTS "Authenticated users can update guias_salida" ON public.guias_salida;

CREATE POLICY "Role-based view guias_salida" ON public.guias_salida
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Role-based insert guias_salida" ON public.guias_salida
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Role-based update guias_salida" ON public.guias_salida
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Admin can delete guias_salida" ON public.guias_salida
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 21. GUIA_DETALLES TABLE (Ventas)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view guia_detalles" ON public.guia_detalles;
DROP POLICY IF EXISTS "Authenticated users can insert guia_detalles" ON public.guia_detalles;

CREATE POLICY "Role-based view guia_detalles" ON public.guia_detalles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Role-based insert guia_detalles" ON public.guia_detalles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'ventas')
  );

CREATE POLICY "Admin can delete guia_detalles" ON public.guia_detalles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 22. USER_ROLES TABLE (Admin only for management)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view user_roles" ON public.user_roles;

-- Users can view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR
    public.has_role(auth.uid(), 'admin')
  );

-- Only admin can manage roles
CREATE POLICY "Admin can insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update user_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));