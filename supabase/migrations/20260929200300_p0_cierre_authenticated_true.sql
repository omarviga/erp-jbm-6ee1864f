-- P0: cerrar 31 politicas legacy "Autenticados ..." con USING/WITH CHECK (true).
--
-- Hallazgo (catologo prod, pg_policies): 11 tablas concedian SELECT/INSERT/
-- UPDATE a cualquier usuario autenticado, sin importar su rol:
--  cat_clasificaciones (SELECT) + clientes_maquila, fletes_productor,
--  liquidacion_pagos, ordenes_maquila, precios_calidad, rutas_validas,
--  usuarios, venta_detalles_cdmx, ventas_cdmx, ventas_exportacion
--  (SELECT + INSERT + UPDATE cada una).
-- Estas politicas no existen en supabase/migrations: se aplicaron directo
-- en prod (deriva). Esta migracion las reemplaza en codigo versionado.
--
-- Mapeo de roles (verificado contra rutas y hooks del front):
--  1-2. clientes_maquila, ordenes_maquila: SELECT/INSERT/UPDATE
--      admin+produccion. Ruta /maquila (allowedRoles ["produccion"],
--      admin pasa siempre); hook useMaquila hace select/insert/update,
--      nunca DELETE (el DELETE sigue admin via "Admin borra ...").
--  3. usuarios: SELECT admin+produccion+almacen (Kardex en /inventarios,
--      allowedRoles ["produccion","almacen"], lee nombre/email por
--      auth_user_id). INSERT/UPDATE solo admin: la tabla expone email/rol
--      y el alta real de roles vive en user_roles (AdminUsuarios).
--  4. cat_clasificaciones: se elimina el SELECT abierto; admin queda
--      cubierto por el ALL existente. Sin uso en el front.
--  5-11. fletes_productor, liquidacion_pagos, precios_calidad,
--      rutas_validas, ventas_exportacion, venta_detalles_cdmx,
--      ventas_cdmx: sin ninguna referencia en src ni edge functions
--      (solo tipos generados). Minimo privilegio: SELECT/INSERT/UPDATE
--      solo admin; reabrir deliberadamente si un modulo las adopta.
--      El DELETE de las 10 ya es admin ("Admin borra ...") y se conserva.
--
-- Seguro: solo DDL de politicas (DROP/CREATE POLICY); no toca datos ni
-- llaves foraneas. Los RPC SECURITY DEFINER no pasan por RLS.
-- Convencion de nombres P2: "Role-based <cmd> <tabla>", "Admin can ...".
--
-- Verificacion sugerida tras aplicar (SQL Editor):
--   -- Criterio 1: cero politicas permisivas (esperado: 0 filas)
--   select tablename, policyname, cmd
--   from pg_policies
--   where schemaname = 'public'
--     and (qual = 'true' or with_check = 'true');
--   -- Criterio 2: familia esperada por tabla (reemplazos presentes,
--   -- "Autenticados ..." ausentes, DELETE solo admin)
--   select tablename, policyname, cmd
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('cat_clasificaciones','clientes_maquila',
--       'fletes_productor','liquidacion_pagos','ordenes_maquila',
--       'precios_calidad','rutas_validas','usuarios',
--       'venta_detalles_cdmx','ventas_cdmx','ventas_exportacion')
--   order by tablename, cmd, policyname;
--   -- Criterio 3: conteos sin cambio (antes: clasificaciones 31,
--   -- usuarios 1, resto 0)
--   select 'cat_clasificaciones' t, count(*) from cat_clasificaciones
--   union all select 'clientes_maquila', count(*) from clientes_maquila
--   union all select 'fletes_productor', count(*) from fletes_productor
--   union all select 'liquidacion_pagos', count(*) from liquidacion_pagos
--   union all select 'ordenes_maquila', count(*) from ordenes_maquila
--   union all select 'precios_calidad', count(*) from precios_calidad
--   union all select 'rutas_validas', count(*) from rutas_validas
--   union all select 'usuarios', count(*) from usuarios
--   union all select 'venta_detalles_cdmx', count(*) from venta_detalles_cdmx
--   union all select 'ventas_cdmx', count(*) from ventas_cdmx
--   union all select 'ventas_exportacion', count(*) from ventas_exportacion
--   order by 1;

-- =========================
-- CLIENTES_MAQUILA: admin+produccion
-- =========================
ALTER TABLE public.clientes_maquila ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen clientes_maquila" ON public.clientes_maquila;
DROP POLICY IF EXISTS "Autenticados insertan clientes_maquila" ON public.clientes_maquila;
DROP POLICY IF EXISTS "Autenticados editan clientes_maquila" ON public.clientes_maquila;
DROP POLICY IF EXISTS "Role-based view clientes_maquila" ON public.clientes_maquila;
DROP POLICY IF EXISTS "Role-based insert clientes_maquila" ON public.clientes_maquila;
DROP POLICY IF EXISTS "Role-based update clientes_maquila" ON public.clientes_maquila;

CREATE POLICY "Role-based view clientes_maquila" ON public.clientes_maquila
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
);

CREATE POLICY "Role-based insert clientes_maquila" ON public.clientes_maquila
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
);

CREATE POLICY "Role-based update clientes_maquila" ON public.clientes_maquila
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
);

GRANT SELECT, INSERT, UPDATE ON public.clientes_maquila TO authenticated;

-- =========================
-- ORDENES_MAQUILA: admin+produccion
-- =========================
ALTER TABLE public.ordenes_maquila ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen ordenes_maquila" ON public.ordenes_maquila;
DROP POLICY IF EXISTS "Autenticados insertan ordenes_maquila" ON public.ordenes_maquila;
DROP POLICY IF EXISTS "Autenticados editan ordenes_maquila" ON public.ordenes_maquila;
DROP POLICY IF EXISTS "Role-based view ordenes_maquila" ON public.ordenes_maquila;
DROP POLICY IF EXISTS "Role-based insert ordenes_maquila" ON public.ordenes_maquila;
DROP POLICY IF EXISTS "Role-based update ordenes_maquila" ON public.ordenes_maquila;

CREATE POLICY "Role-based view ordenes_maquila" ON public.ordenes_maquila
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
);

CREATE POLICY "Role-based insert ordenes_maquila" ON public.ordenes_maquila
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
);

CREATE POLICY "Role-based update ordenes_maquila" ON public.ordenes_maquila
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
);

GRANT SELECT, INSERT, UPDATE ON public.ordenes_maquila TO authenticated;

-- =========================
-- USUARIOS: SELECT operativo, writes admin
-- =========================
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Autenticados insertan usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Autenticados editan usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Role-based view usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Admin can insert usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Admin can update usuarios" ON public.usuarios;

CREATE POLICY "Role-based view usuarios" ON public.usuarios
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Admin can insert usuarios" ON public.usuarios
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update usuarios" ON public.usuarios
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

GRANT SELECT, INSERT, UPDATE ON public.usuarios TO authenticated;

-- =========================
-- CAT_CLASIFICACIONES: fuera SELECT abierto (admin via ALL)
-- =========================
ALTER TABLE public.cat_clasificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clasificaciones visibles autenticados" ON public.cat_clasificaciones;

-- =========================
-- FLETES_PRODUCTOR: solo admin (sin uso en app)
-- =========================
ALTER TABLE public.fletes_productor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen fletes_productor" ON public.fletes_productor;
DROP POLICY IF EXISTS "Autenticados insertan fletes_productor" ON public.fletes_productor;
DROP POLICY IF EXISTS "Autenticados editan fletes_productor" ON public.fletes_productor;
DROP POLICY IF EXISTS "Admin can view fletes_productor" ON public.fletes_productor;
DROP POLICY IF EXISTS "Admin can insert fletes_productor" ON public.fletes_productor;
DROP POLICY IF EXISTS "Admin can update fletes_productor" ON public.fletes_productor;

CREATE POLICY "Admin can view fletes_productor" ON public.fletes_productor
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can insert fletes_productor" ON public.fletes_productor
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update fletes_productor" ON public.fletes_productor
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

GRANT SELECT, INSERT, UPDATE ON public.fletes_productor TO authenticated;

-- =========================
-- LIQUIDACION_PAGOS: solo admin (sin uso en app)
-- =========================
ALTER TABLE public.liquidacion_pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen liquidacion_pagos" ON public.liquidacion_pagos;
DROP POLICY IF EXISTS "Autenticados insertan liquidacion_pagos" ON public.liquidacion_pagos;
DROP POLICY IF EXISTS "Autenticados editan liquidacion_pagos" ON public.liquidacion_pagos;
DROP POLICY IF EXISTS "Admin can view liquidacion_pagos" ON public.liquidacion_pagos;
DROP POLICY IF EXISTS "Admin can insert liquidacion_pagos" ON public.liquidacion_pagos;
DROP POLICY IF EXISTS "Admin can update liquidacion_pagos" ON public.liquidacion_pagos;

CREATE POLICY "Admin can view liquidacion_pagos" ON public.liquidacion_pagos
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can insert liquidacion_pagos" ON public.liquidacion_pagos
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update liquidacion_pagos" ON public.liquidacion_pagos
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

GRANT SELECT, INSERT, UPDATE ON public.liquidacion_pagos TO authenticated;

-- =========================
-- PRECIOS_CALIDAD: solo admin (sin uso en app)
-- =========================
ALTER TABLE public.precios_calidad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen precios_calidad" ON public.precios_calidad;
DROP POLICY IF EXISTS "Autenticados insertan precios_calidad" ON public.precios_calidad;
DROP POLICY IF EXISTS "Autenticados editan precios_calidad" ON public.precios_calidad;
DROP POLICY IF EXISTS "Admin can view precios_calidad" ON public.precios_calidad;
DROP POLICY IF EXISTS "Admin can insert precios_calidad" ON public.precios_calidad;
DROP POLICY IF EXISTS "Admin can update precios_calidad" ON public.precios_calidad;

CREATE POLICY "Admin can view precios_calidad" ON public.precios_calidad
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can insert precios_calidad" ON public.precios_calidad
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update precios_calidad" ON public.precios_calidad
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

GRANT SELECT, INSERT, UPDATE ON public.precios_calidad TO authenticated;

-- =========================
-- RUTAS_VALIDAS: solo admin (sin uso en app)
-- =========================
ALTER TABLE public.rutas_validas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen rutas_validas" ON public.rutas_validas;
DROP POLICY IF EXISTS "Autenticados insertan rutas_validas" ON public.rutas_validas;
DROP POLICY IF EXISTS "Autenticados editan rutas_validas" ON public.rutas_validas;
DROP POLICY IF EXISTS "Admin can view rutas_validas" ON public.rutas_validas;
DROP POLICY IF EXISTS "Admin can insert rutas_validas" ON public.rutas_validas;
DROP POLICY IF EXISTS "Admin can update rutas_validas" ON public.rutas_validas;

CREATE POLICY "Admin can view rutas_validas" ON public.rutas_validas
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can insert rutas_validas" ON public.rutas_validas
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update rutas_validas" ON public.rutas_validas
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

GRANT SELECT, INSERT, UPDATE ON public.rutas_validas TO authenticated;

-- =========================
-- VENTAS_EXPORTACION: solo admin (sin uso en app)
-- =========================
ALTER TABLE public.ventas_exportacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen ventas_exportacion" ON public.ventas_exportacion;
DROP POLICY IF EXISTS "Autenticados insertan ventas_exportacion" ON public.ventas_exportacion;
DROP POLICY IF EXISTS "Autenticados editan ventas_exportacion" ON public.ventas_exportacion;
DROP POLICY IF EXISTS "Admin can view ventas_exportacion" ON public.ventas_exportacion;
DROP POLICY IF EXISTS "Admin can insert ventas_exportacion" ON public.ventas_exportacion;
DROP POLICY IF EXISTS "Admin can update ventas_exportacion" ON public.ventas_exportacion;

CREATE POLICY "Admin can view ventas_exportacion" ON public.ventas_exportacion
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can insert ventas_exportacion" ON public.ventas_exportacion
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update ventas_exportacion" ON public.ventas_exportacion
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

GRANT SELECT, INSERT, UPDATE ON public.ventas_exportacion TO authenticated;

-- =========================
-- VENTA_DETALLES_CDMX: solo admin (sin uso en app)
-- =========================
ALTER TABLE public.venta_detalles_cdmx ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen venta_detalles_cdmx" ON public.venta_detalles_cdmx;
DROP POLICY IF EXISTS "Autenticados insertan venta_detalles_cdmx" ON public.venta_detalles_cdmx;
DROP POLICY IF EXISTS "Autenticados editan venta_detalles_cdmx" ON public.venta_detalles_cdmx;
DROP POLICY IF EXISTS "Admin can view venta_detalles_cdmx" ON public.venta_detalles_cdmx;
DROP POLICY IF EXISTS "Admin can insert venta_detalles_cdmx" ON public.venta_detalles_cdmx;
DROP POLICY IF EXISTS "Admin can update venta_detalles_cdmx" ON public.venta_detalles_cdmx;

CREATE POLICY "Admin can view venta_detalles_cdmx" ON public.venta_detalles_cdmx
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can insert venta_detalles_cdmx" ON public.venta_detalles_cdmx
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update venta_detalles_cdmx" ON public.venta_detalles_cdmx
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

GRANT SELECT, INSERT, UPDATE ON public.venta_detalles_cdmx TO authenticated;

-- =========================
-- VENTAS_CDMX: solo admin (sin uso en app)
-- =========================
ALTER TABLE public.ventas_cdmx ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen ventas_cdmx" ON public.ventas_cdmx;
DROP POLICY IF EXISTS "Autenticados insertan ventas_cdmx" ON public.ventas_cdmx;
DROP POLICY IF EXISTS "Autenticados editan ventas_cdmx" ON public.ventas_cdmx;
DROP POLICY IF EXISTS "Admin can view ventas_cdmx" ON public.ventas_cdmx;
DROP POLICY IF EXISTS "Admin can insert ventas_cdmx" ON public.ventas_cdmx;
DROP POLICY IF EXISTS "Admin can update ventas_cdmx" ON public.ventas_cdmx;

CREATE POLICY "Admin can view ventas_cdmx" ON public.ventas_cdmx
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can insert ventas_cdmx" ON public.ventas_cdmx
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update ventas_cdmx" ON public.ventas_cdmx
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

GRANT SELECT, INSERT, UPDATE ON public.ventas_cdmx TO authenticated;
