-- P2: alinear RLS con la matriz oficial rol x modulo x accion.
--
-- Parte A: abrir lecturas/escrituras que cada ruta necesita y hoy niega
-- (flujos rotos o degradados para su rol primario; ver docs/ROLE_ACCESS_MATRIX.md):
--  1. huertos, cortadores SELECT + almacen (Recepcion lee catalogos).
--  2. lote_cortadores SELECT + INSERT + almacen (Recepcion registra cortadores).
--  3. productores SELECT + INSERT + almacen (/productores admite almacen;
--     NuevoProductorDialog vive en el flujo de Recepcion). UPDATE sigue
--     admin/finanzas y el front lo restringe igual.
--  4. clientes SELECT + almacen (Logistica muestra clientes en guias y
--     combos; sin esto van vacios). Nota: expone el maestro de clientes
--     (incl. saldo_deudor) a almacen; clientes_sensible sigue admin/finanzas.
--  5. registro_temperaturas SELECT + produccion (pestana Camara Fría).
--  6. stock_molino SELECT + almacen (crear transferencia CDMX lo lista).
--  7. tickets_pos_cdmx SELECT + almacen (corte concilia tickets vs pagos).
--  8. ventas SELECT + almacen (resumen/conciliacion/auditoria del corte).
--  9. auditoria_inventario_cdmx SELECT + ventas/almacen (resumen de granel
--     del corte; antes solo admin pero la seccion se muestra a todos).
--
-- Parte B: cerrar writes sobrantes al convenio P2 (DELETE solo admin;
-- ventas en facturacion solo lectura). Seguro: el front no hace DELETE ni
-- UPDATE directos sobre estas tablas y los RPC son SECURITY DEFINER
-- (no pasan por RLS):
--  10. ventas, venta_detalles: fuera ALL de ventas (conserva
--      view/insert/update role-based para ventas).
--  11. pagos_clientes: fuera ALL de ventas y finanzas (conserva
--      view/insert para ambos; el UPDATE directo, sin uso, desaparece).
--  12. anticipos, liquidacion_lotes: fuera ALL de finanzas (conserva
--      view/insert/update role-based en anticipos; view/insert en
--      liquidacion_lotes; el UPDATE directo sin uso desaparece ahi).
--  13. facturas, factura_detalles: fuera ALL admin/finanzas/ventas;
--      ventas queda solo lectura (las Role-based admin/finanzas ya existen).
--  14. factura_eventos: fuera ALL; familia explicita SELECT
--      admin/finanzas/ventas, INSERT+UPDATE admin/finanzas, DELETE admin.
--
-- Residuales conscientes (no se tocan; ver matriz doc):
--  - factura_timbrado_intentos y facturacion_config: ALL admin/finanzas.
--  - clientes_sensible: ALL admin/finanzas.
--  - "Admin full access X": redundantes con las per-comando pero inocuas.
--
-- Grants: el repo casi no trae GRANTs de tabla (viven aplicados en remoto);
-- se agregan los de las operaciones ampliadas para que la migracion sea
-- autocontenida en ambientes frescos. Idempotentes en prod.
--
-- Verificacion sugerida tras aplicar (SQL Editor):
--   select tablename, policyname, cmd
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('huertos','cortadores','lote_cortadores',
--       'productores','clientes','registro_temperaturas','stock_molino',
--       'tickets_pos_cdmx','ventas','venta_detalles','pagos_clientes',
--       'anticipos','liquidacion_lotes','facturas','factura_detalles',
--       'factura_eventos','auditoria_inventario_cdmx')
--   order by tablename, cmd, policyname;
-- Criterio: existen las politicas nuevas, no quedan ALL de ventas/finanzas
-- en el grupo B (salvo residuales), y DELETE solo lo cubre admin.

-- =========================
-- HUERTOS: +almacen SELECT
-- =========================
ALTER TABLE public.huertos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Role-based view huertos" ON public.huertos;

CREATE POLICY "Role-based view huertos" ON public.huertos
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

GRANT SELECT ON public.huertos TO authenticated;

-- =========================
-- CORTADORES: +almacen SELECT
-- =========================
ALTER TABLE public.cortadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Role-based view cortadores" ON public.cortadores;

CREATE POLICY "Role-based view cortadores" ON public.cortadores
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

GRANT SELECT ON public.cortadores TO authenticated;

-- =========================
-- LOTE_CORTADORES: +almacen SELECT + INSERT
-- =========================
ALTER TABLE public.lote_cortadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Role-based view lote_cortadores" ON public.lote_cortadores;
DROP POLICY IF EXISTS "Role-based insert lote_cortadores" ON public.lote_cortadores;

CREATE POLICY "Role-based view lote_cortadores" ON public.lote_cortadores
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Role-based insert lote_cortadores" ON public.lote_cortadores
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

GRANT SELECT, INSERT ON public.lote_cortadores TO authenticated;

-- =========================
-- PRODUCTORES: +almacen SELECT + INSERT
-- =========================
ALTER TABLE public.productores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Role-based view productores" ON public.productores;
DROP POLICY IF EXISTS "Role-based insert productores" ON public.productores;

CREATE POLICY "Role-based view productores" ON public.productores
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Role-based insert productores" ON public.productores
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

GRANT SELECT, INSERT ON public.productores TO authenticated;

-- =========================
-- CLIENTES: +almacen SELECT
-- =========================
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clientes can view by role" ON public.clientes;

CREATE POLICY "Clientes can view by role" ON public.clientes
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

GRANT SELECT ON public.clientes TO authenticated;

-- =========================
-- REGISTRO_TEMPERATURAS: +produccion SELECT
-- =========================
ALTER TABLE public.registro_temperaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Role-based view registro_temperaturas" ON public.registro_temperaturas;

CREATE POLICY "Role-based view registro_temperaturas" ON public.registro_temperaturas
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
);

GRANT SELECT ON public.registro_temperaturas TO authenticated;

-- =========================
-- STOCK_MOLINO: +almacen SELECT
-- =========================
ALTER TABLE public.stock_molino ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Role-based view stock_molino" ON public.stock_molino;

CREATE POLICY "Role-based view stock_molino" ON public.stock_molino
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

GRANT SELECT ON public.stock_molino TO authenticated;

-- =========================
-- TICKETS_POS_CDMX: +almacen SELECT
-- =========================
ALTER TABLE public.tickets_pos_cdmx ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin y ventas pueden ver tickets POS CDMX" ON public.tickets_pos_cdmx;

CREATE POLICY "Roles operativos pueden ver tickets POS CDMX" ON public.tickets_pos_cdmx
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

GRANT SELECT ON public.tickets_pos_cdmx TO authenticated;

-- =========================
-- VENTAS: +almacen SELECT; fuera ALL de ventas
-- =========================
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ventas can manage ventas" ON public.ventas;
DROP POLICY IF EXISTS "Role-based view ventas" ON public.ventas;

CREATE POLICY "Role-based view ventas" ON public.ventas
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

GRANT SELECT ON public.ventas TO authenticated;

-- =========================
-- AUDITORIA_INVENTARIO_CDMX: +ventas/almacen SELECT
-- =========================
ALTER TABLE public.auditoria_inventario_cdmx ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin puede ver auditoría" ON public.auditoria_inventario_cdmx;

CREATE POLICY "Roles operativos pueden ver auditoría CDMX" ON public.auditoria_inventario_cdmx
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

GRANT SELECT ON public.auditoria_inventario_cdmx TO authenticated;

-- =========================
-- VENTA_DETALLES: fuera ALL de ventas
-- =========================
ALTER TABLE public.venta_detalles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ventas can manage venta_detalles" ON public.venta_detalles;

-- =========================
-- PAGOS_CLIENTES: fuera ALL de ventas y finanzas
-- =========================
ALTER TABLE public.pagos_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ventas can manage pagos_clientes" ON public.pagos_clientes;
DROP POLICY IF EXISTS "Finanzas can manage pagos_clientes" ON public.pagos_clientes;

-- =========================
-- ANTICIPOS: fuera ALL de finanzas
-- =========================
ALTER TABLE public.anticipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finanzas can manage anticipos" ON public.anticipos;

-- =========================
-- LIQUIDACION_LOTES: fuera ALL de finanzas
-- =========================
ALTER TABLE public.liquidacion_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finanzas can manage liquidacion_lotes" ON public.liquidacion_lotes;

-- =========================
-- FACTURAS: ventas solo lectura
-- =========================
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Facturas role access" ON public.facturas;
DROP POLICY IF EXISTS "Ventas can view facturas" ON public.facturas;

CREATE POLICY "Ventas can view facturas" ON public.facturas
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'ventas'::app_role)
);

GRANT SELECT ON public.facturas TO authenticated;

-- =========================
-- FACTURA_DETALLES: ventas solo lectura
-- =========================
ALTER TABLE public.factura_detalles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Factura detalles role access" ON public.factura_detalles;
DROP POLICY IF EXISTS "Ventas can view factura_detalles" ON public.factura_detalles;

CREATE POLICY "Ventas can view factura_detalles" ON public.factura_detalles
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'ventas'::app_role)
);

GRANT SELECT ON public.factura_detalles TO authenticated;

-- =========================
-- FACTURA_EVENTOS: familia explicita
-- =========================
ALTER TABLE public.factura_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Factura eventos role access" ON public.factura_eventos;
DROP POLICY IF EXISTS "Role-based view factura_eventos" ON public.factura_eventos;
DROP POLICY IF EXISTS "Role-based insert factura_eventos" ON public.factura_eventos;
DROP POLICY IF EXISTS "Role-based update factura_eventos" ON public.factura_eventos;
DROP POLICY IF EXISTS "Admin can delete factura_eventos" ON public.factura_eventos;

CREATE POLICY "Role-based view factura_eventos" ON public.factura_eventos
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  )
);

CREATE POLICY "Role-based insert factura_eventos" ON public.factura_eventos
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Role-based update factura_eventos" ON public.factura_eventos
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

CREATE POLICY "Admin can delete factura_eventos" ON public.factura_eventos
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.factura_eventos TO authenticated;
