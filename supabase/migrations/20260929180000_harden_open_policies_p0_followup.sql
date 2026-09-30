-- Cierre P0 (seguimiento): elimina las políticas abiertas restantes en tablas
-- sensibles y restaura la familia role-based donde hubo regresión.
--
-- Hallazgos que cierra (estado efectivo tras aplicar las migraciones en orden):
-- 1. public.transportistas: 20260810120000 reintrodujo
--    "Enable all for authenticated users" FOR ALL USING (true), revirtiendo el
--    endurecimiento de 20260313. Se elimina y se recrea la familia role-based.
-- 2. public.produccion: conserva "Authenticated users can view/insert" abiertas;
--    solo UPDATE se endureció (20260812, admin/produccion). Se cierran view/insert
--    y se amplía UPDATE a almacen: los flujos de cámara fría en Inventarios
--    actualizan produccion.destino directo (useCamaraFria) y la RPC
--    trasladar_a_camara_fria ya admite almacen.
-- 3. public.camara_fria: conserva view/insert/update abiertas. Se endurecen a
--    admin/produccion/almacen (+finanzas en lectura por trazabilidad y expediente).
-- 4. public.guias_salida / public.guia_detalles: conservan view/insert/update
--    abiertas. Solo las usa Logística (admin/almacen).
--
-- Roles por tabla (alineado a docs/ROLE_ACCESS_MATRIX.md y uso real en src/):
--   transportistas : SELECT admin/ventas/almacen/finanzas, INSERT+UPDATE admin/almacen
--   produccion     : SELECT admin/produccion/almacen/finanzas, INSERT admin/produccion,
--                    UPDATE admin/produccion/almacen
--   camara_fria    : SELECT admin/produccion/almacen/finanzas, INSERT+UPDATE admin/produccion/almacen
--   guias_salida, guia_detalles : SELECT+INSERT+UPDATE admin/almacen
--   DELETE en todas: solo admin (la app no borra en estas tablas).
--
-- Verificación sugerida tras aplicar (SQL Editor de Supabase):
--   select tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('transportistas','produccion','camara_fria','guias_salida','guia_detalles')
--   order by tablename, policyname;
-- Criterio: ninguna política con qual o with_check = 'true'.

-- =========================
-- TRANSPORTISTAS
-- =========================
ALTER TABLE public.transportistas ENABLE ROW LEVEL SECURITY;

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
-- PRODUCCION
-- =========================
ALTER TABLE public.produccion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view produccion" ON public.produccion;
DROP POLICY IF EXISTS "Authenticated users can insert produccion" ON public.produccion;
DROP POLICY IF EXISTS "Role-based view produccion" ON public.produccion;
DROP POLICY IF EXISTS "Role-based insert produccion" ON public.produccion;
DROP POLICY IF EXISTS "Role-based update produccion" ON public.produccion;
DROP POLICY IF EXISTS "Admin can delete produccion" ON public.produccion;

CREATE POLICY "Role-based view produccion" ON public.produccion
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Role-based insert produccion" ON public.produccion
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
  )
);

CREATE POLICY "Role-based update produccion" ON public.produccion
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Admin can delete produccion" ON public.produccion
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- =========================
-- CAMARA_FRIA
-- =========================
ALTER TABLE public.camara_fria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view camara_fria" ON public.camara_fria;
DROP POLICY IF EXISTS "Authenticated users can insert camara_fria" ON public.camara_fria;
DROP POLICY IF EXISTS "Authenticated users can update camara_fria" ON public.camara_fria;
DROP POLICY IF EXISTS "Role-based view camara_fria" ON public.camara_fria;
DROP POLICY IF EXISTS "Role-based insert camara_fria" ON public.camara_fria;
DROP POLICY IF EXISTS "Role-based update camara_fria" ON public.camara_fria;
DROP POLICY IF EXISTS "Admin can delete camara_fria" ON public.camara_fria;

CREATE POLICY "Role-based view camara_fria" ON public.camara_fria
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

CREATE POLICY "Role-based insert camara_fria" ON public.camara_fria
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Role-based update camara_fria" ON public.camara_fria
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'produccion'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Admin can delete camara_fria" ON public.camara_fria
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- =========================
-- GUIAS_SALIDA
-- =========================
ALTER TABLE public.guias_salida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view guias_salida" ON public.guias_salida;
DROP POLICY IF EXISTS "Authenticated users can insert guias_salida" ON public.guias_salida;
DROP POLICY IF EXISTS "Authenticated users can update guias_salida" ON public.guias_salida;
DROP POLICY IF EXISTS "Role-based view guias_salida" ON public.guias_salida;
DROP POLICY IF EXISTS "Role-based insert guias_salida" ON public.guias_salida;
DROP POLICY IF EXISTS "Role-based update guias_salida" ON public.guias_salida;
DROP POLICY IF EXISTS "Admin can delete guias_salida" ON public.guias_salida;

CREATE POLICY "Role-based view guias_salida" ON public.guias_salida
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Role-based insert guias_salida" ON public.guias_salida
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Role-based update guias_salida" ON public.guias_salida
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

CREATE POLICY "Admin can delete guias_salida" ON public.guias_salida
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- =========================
-- GUIA_DETALLES
-- =========================
ALTER TABLE public.guia_detalles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view guia_detalles" ON public.guia_detalles;
DROP POLICY IF EXISTS "Authenticated users can insert guia_detalles" ON public.guia_detalles;
DROP POLICY IF EXISTS "Role-based view guia_detalles" ON public.guia_detalles;
DROP POLICY IF EXISTS "Role-based insert guia_detalles" ON public.guia_detalles;
DROP POLICY IF EXISTS "Role-based update guia_detalles" ON public.guia_detalles;
DROP POLICY IF EXISTS "Admin can delete guia_detalles" ON public.guia_detalles;

CREATE POLICY "Role-based view guia_detalles" ON public.guia_detalles
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Role-based insert guia_detalles" ON public.guia_detalles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Role-based update guia_detalles" ON public.guia_detalles
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

CREATE POLICY "Admin can delete guia_detalles" ON public.guia_detalles
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);
