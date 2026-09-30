-- P1 (seguimiento remediación): kardex por rol + notificaciones sin suplantación.
--
-- 1. public.inventario_kardex: la lectura estaba abierta a todo `authenticated`
--    (20260309124500). Solo la usan los flujos de Inventarios
--    (useKardexLote, useCamaraFria, useCrearTransferenciaCDMX), así que se
--    restringe a admin/almacen/produccion. Además NO existía política INSERT
--    (con RLS habilitado, los inserts directos desde esos flujos se deniegan),
--    por lo que se agrega INSERT para los mismos roles + GRANTs faltantes.
--    No hay política UPDATE a propósito: el kardex es bitácora append-only.
--    DELETE queda solo admin (la app no borra kardex).
-- 2. public.notificaciones: el INSERT permitía a cualquier autenticado crear
--    notificaciones PARA CUALQUIER user_id (suplantación dirigida). Ahora solo
--    propias (user_id = auth.uid()) o broadcast (user_id IS NULL, el default
--    del helper crearNotificacion). SELECT/UPDATE/DELETE no cambian.
--    Residual conocido: el broadcast sigue abierto a cualquier autenticado;
--    si aparece spam, agregar gate por rol o columna created_by.
--
-- Verificación sugerida tras aplicar (SQL Editor):
--   select tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename in ('inventario_kardex','notificaciones')
--   order by tablename, policyname;

-- =========================
-- INVENTARIO_KARDEX
-- =========================
ALTER TABLE public.inventario_kardex ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view inventario_kardex" ON public.inventario_kardex;
DROP POLICY IF EXISTS "Role-based view inventario_kardex" ON public.inventario_kardex;
DROP POLICY IF EXISTS "Role-based insert inventario_kardex" ON public.inventario_kardex;
DROP POLICY IF EXISTS "Admin can delete inventario_kardex" ON public.inventario_kardex;

CREATE POLICY "Role-based view inventario_kardex" ON public.inventario_kardex
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
);

CREATE POLICY "Role-based insert inventario_kardex" ON public.inventario_kardex
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
);

CREATE POLICY "Admin can delete inventario_kardex" ON public.inventario_kardex
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

GRANT SELECT, INSERT, DELETE ON public.inventario_kardex TO authenticated;

-- =========================
-- NOTIFICACIONES
-- =========================
DROP POLICY IF EXISTS "Sistema puede crear notificaciones" ON public.notificaciones;

CREATE POLICY "Sistema puede crear notificaciones"
ON public.notificaciones
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (user_id IS NULL OR user_id = auth.uid())
);
