-- P2 cierre: portar al repo la deriva campo aplicada solo en prod (SQL Editor).
--
-- Objetos que existen en prod pero en ninguna migracion del repo:
--  Tablas (9): productor_usuarios, huerto_lotes, campo_eventos,
--    campo_monitoreos, campo_estimaciones_cosecha, huerto_clima_diario,
--    riego_eventos, huerto_balance_hidrico, riego_recomendaciones.
--  Funciones (4): es_personal_campo, puede_ver_huerto,
--    fase_a_derivar_geometria, update_updated_at_column (public).
--  Triggers (2) sobre huerto_lotes, indices idx_*/uq_*,
--  politicas RLS de esas tablas + 3 politicas campo sobre huertos.
--
-- Fuente: catalogos de prod (information_schema/pg_*), 2026-09-29.
-- FKs entrantes verificadas: ninguna fuera del cluster.
-- El front aun no consume estas tablas; el port es paridad repo<->prod
-- (ambientes frescos, auditoria) sin cambio de comportamiento en prod:
-- todo es IF NOT EXISTS / OR REPLACE / DROP IF EXISTS + CREATE.
-- Orden: tablas -> funciones -> triggers/indices -> RLS/politicas/grants
-- (las politicas usan los helpers y puede_ver_huerto usa las tablas).
--
-- Verificacion (SQL Editor):
--   select count(*) from pg_tables
--   where schemaname = 'public' and tablename in ('productor_usuarios',
--     'huerto_lotes','campo_eventos','campo_monitoreos',
--     'campo_estimaciones_cosecha','huerto_clima_diario','riego_eventos',
--     'huerto_balance_hidrico','riego_recomendaciones');  -- 9
--   select count(*) from pg_proc
--   where pronamespace = 'public'::regnamespace and proname in
--     ('es_personal_campo','puede_ver_huerto',
--      'fase_a_derivar_geometria','update_updated_at_column');  -- 4

-- Extensiones (no-op si ya existen; Supabase las ubica en extensions).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- =========================
-- TABLAS
-- =========================
CREATE TABLE IF NOT EXISTS public.productor_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  productor_id uuid NOT NULL REFERENCES public.productores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT productor_usuarios_productor_id_user_id_key UNIQUE (productor_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.huerto_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huerto_id uuid NOT NULL REFERENCES public.huertos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  superficie_ha numeric,
  poligono jsonb,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  centroide_lat numeric,
  centroide_lon numeric,
  sistema_riego text,
  caudal_riego_m3_ha numeric,
  profundidad_radicular_m numeric,
  coef_agotamiento_p numeric,
  cc numeric,
  pmp numeric,
  eficiencia_riego numeric,
  activo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  poligono_geom extensions.geometry(Polygon, 4326),
  superficie_calculada_ha numeric,
  poligono_valido boolean
);

CREATE TABLE IF NOT EXISTS public.campo_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huerto_id uuid NOT NULL REFERENCES public.huertos(id) ON DELETE CASCADE,
  huerto_lote_id uuid REFERENCES public.huerto_lotes(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  insumo text,
  dosis text,
  responsable text,
  costo numeric NOT NULL DEFAULT 0,
  notas text,
  usuario_id uuid,
  cliente_uuid uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campo_eventos_cliente_uuid_key UNIQUE (cliente_uuid)
);

CREATE TABLE IF NOT EXISTS public.campo_monitoreos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huerto_id uuid NOT NULL REFERENCES public.huertos(id) ON DELETE CASCADE,
  huerto_lote_id uuid REFERENCES public.huerto_lotes(id) ON DELETE SET NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  tipo_hallazgo text NOT NULL,
  severidad text NOT NULL DEFAULT 'baja',
  notas text,
  fotos text[] NOT NULL DEFAULT '{}',
  clasificacion_ia jsonb,
  usuario_id uuid,
  cliente_uuid uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campo_monitoreos_cliente_uuid_key UNIQUE (cliente_uuid)
);

CREATE TABLE IF NOT EXISTS public.campo_estimaciones_cosecha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huerto_id uuid NOT NULL REFERENCES public.huertos(id) ON DELETE CASCADE,
  fecha_estimada date NOT NULL,
  volumen_estimado_kg numeric NOT NULL,
  fuente text NOT NULL DEFAULT 'manual',
  notas text,
  usuario_id uuid,
  cliente_uuid uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campo_estimaciones_cosecha_cliente_uuid_key UNIQUE (cliente_uuid)
);

CREATE TABLE IF NOT EXISTS public.huerto_clima_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huerto_id uuid NOT NULL REFERENCES public.huertos(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  temp_max numeric,
  temp_min numeric,
  temp_media numeric,
  precipitacion_mm numeric,
  humedad_relativa numeric,
  viento_max numeric,
  et0_mm numeric NOT NULL,
  fuente text NOT NULL DEFAULT 'open-meteo',
  lat_consulta numeric,
  lon_consulta numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT huerto_clima_diario_uk UNIQUE (huerto_id, fecha),
  CONSTRAINT huerto_clima_et0_chk CHECK (et0_mm >= 0 AND et0_mm <= 30),
  CONSTRAINT huerto_clima_fuente_chk CHECK (fuente IN ('open-meteo', 'nasa-power', 'sensor', 'manual')),
  CONSTRAINT huerto_clima_precip_chk CHECK (precipitacion_mm IS NULL OR precipitacion_mm >= 0)
);

CREATE TABLE IF NOT EXISTS public.riego_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huerto_id uuid NOT NULL REFERENCES public.huertos(id) ON DELETE CASCADE,
  huerto_lote_id uuid REFERENCES public.huerto_lotes(id) ON DELETE SET NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  lamina_mm numeric NOT NULL,
  duracion_horas numeric,
  metodo text,
  responsable text,
  notas text,
  cliente_uuid uuid,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT riego_eventos_cliente_uuid_key UNIQUE (cliente_uuid),
  CONSTRAINT riego_eventos_lamina_chk CHECK (lamina_mm >= 0 AND lamina_mm <= 1000)
);

CREATE TABLE IF NOT EXISTS public.huerto_balance_hidrico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huerto_id uuid NOT NULL REFERENCES public.huertos(id) ON DELETE CASCADE,
  huerto_lote_id uuid REFERENCES public.huerto_lotes(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  et0_mm numeric,
  kc numeric,
  etapa_fenologica text,
  etc_mm numeric,
  lluvia_mm numeric NOT NULL DEFAULT 0,
  riego_mm numeric NOT NULL DEFAULT 0,
  agua_previa_mm numeric,
  agua_disponible_mm numeric,
  taw_mm numeric,
  raw_mm numeric,
  agotamiento_mm numeric,
  estado text NOT NULL DEFAULT 'sin_datos',
  fuente_clima text,
  es_estimado boolean NOT NULL DEFAULT true,
  algoritmo_version text NOT NULL DEFAULT 'fao56-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT huerto_balance_estado_chk CHECK (estado IN ('sin_necesidad', 'proxima', 'urgente', 'sin_datos')),
  CONSTRAINT huerto_balance_no_negativo_chk CHECK (
    lluvia_mm >= 0 AND riego_mm >= 0
    AND (agua_disponible_mm IS NULL OR agua_disponible_mm >= 0)
    AND (taw_mm IS NULL OR taw_mm >= 0)
  )
);

CREATE TABLE IF NOT EXISTS public.riego_recomendaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huerto_id uuid NOT NULL REFERENCES public.huertos(id) ON DELETE CASCADE,
  huerto_lote_id uuid REFERENCES public.huerto_lotes(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  estado text NOT NULL,
  lamina_neta_mm numeric,
  lamina_bruta_mm numeric,
  duracion_horas numeric,
  caudal_usado numeric,
  duracion_calculable boolean NOT NULL DEFAULT false,
  et0_mm numeric,
  kc numeric,
  etapa_fenologica text,
  etc_mm numeric,
  lluvia_mm numeric,
  riego_mm numeric,
  agua_disponible_mm numeric,
  taw_mm numeric,
  raw_mm numeric,
  agotamiento_mm numeric,
  entradas jsonb NOT NULL,
  algoritmo_version text NOT NULL DEFAULT 'fao56-v1',
  kc_validado boolean NOT NULL DEFAULT false,
  generado_por text NOT NULL DEFAULT 'worker',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT riego_reco_estado_chk CHECK (estado IN ('sin_necesidad', 'proxima', 'urgente', 'sin_datos')),
  CONSTRAINT riego_reco_lamina_chk CHECK (lamina_neta_mm IS NULL OR lamina_neta_mm >= 0),
  CONSTRAINT riego_reco_duracion_chk CHECK (
    (duracion_calculable AND duracion_horas IS NOT NULL AND caudal_usado IS NOT NULL)
    OR (NOT duracion_calculable)
  )
);

-- =========================
-- FUNCIONES (texto de pg_get_functiondef en prod)
-- =========================
CREATE OR REPLACE FUNCTION public.es_personal_campo(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'campo')
    OR public.has_role(_user_id, 'produccion')
    OR public.has_role(_user_id, 'almacen')
  );
$function$;

CREATE OR REPLACE FUNCTION public.puede_ver_huerto(_user_id uuid, _huerto_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND (
    public.es_personal_campo(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.productor_usuarios pu
      JOIN public.huertos h ON h.productor_id = pu.productor_id
      WHERE pu.user_id = _user_id AND h.id = _huerto_id
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.fase_a_derivar_geometria()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_geom extensions.geometry;
  v_valida BOOLEAN;
BEGIN
  IF NEW.poligono IS NULL THEN
    NEW.poligono_geom := NULL;
    NEW.poligono_valido := NULL;
    NEW.superficie_calculada_ha := NULL;
    RETURN NEW;
  END IF;

  -- Solo recalcular si el polígono cambió (o es INSERT).
  IF TG_OP = 'UPDATE' AND NEW.poligono IS NOT DISTINCT FROM OLD.poligono THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_geom := extensions.ST_SetSRID(
                extensions.ST_GeomFromGeoJSON(NEW.poligono::text), 4326);

    v_valida := extensions.ST_IsValid(v_geom);
    NEW.poligono_valido := v_valida;

    IF v_valida THEN
      NEW.poligono_geom := v_geom;
      -- ST_Area sobre geography devuelve m2; a hectáreas.
      NEW.superficie_calculada_ha := ROUND(
        (extensions.ST_Area(v_geom::extensions.geography) / 10000)::numeric, 4);
      NEW.centroide_lat := ROUND(extensions.ST_Y(extensions.ST_Centroid(v_geom))::numeric, 7);
      NEW.centroide_lon := ROUND(extensions.ST_X(extensions.ST_Centroid(v_geom))::numeric, 7);
    ELSE
      -- Polígono autointersectado u otro defecto: se conserva pero se marca.
      NEW.poligono_geom := v_geom;
      NEW.superficie_calculada_ha := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- GeoJSON no interpretable. No se bloquea el guardado.
    NEW.poligono_geom := NULL;
    NEW.poligono_valido := false;
    NEW.superficie_calculada_ha := NULL;
  END;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- =========================
-- INDICES
-- =========================
CREATE INDEX IF NOT EXISTS idx_campo_estimaciones_huerto ON public.campo_estimaciones_cosecha USING btree (huerto_id, fecha_estimada DESC);
CREATE INDEX IF NOT EXISTS idx_campo_eventos_huerto_fecha ON public.campo_eventos USING btree (huerto_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_campo_monitoreos_huerto_fecha ON public.campo_monitoreos USING btree (huerto_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_huerto_clima_huerto_fecha ON public.huerto_clima_diario USING btree (huerto_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_huerto_lotes_huerto ON public.huerto_lotes USING btree (huerto_id);
CREATE INDEX IF NOT EXISTS idx_huerto_lotes_poligono_geom ON public.huerto_lotes USING gist (poligono_geom);
CREATE INDEX IF NOT EXISTS idx_riego_eventos_huerto_fecha ON public.riego_eventos USING btree (huerto_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_riego_eventos_lote ON public.riego_eventos USING btree (huerto_lote_id);
CREATE INDEX IF NOT EXISTS idx_balance_estado ON public.huerto_balance_hidrico USING btree (estado, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_balance_huerto_fecha ON public.huerto_balance_hidrico USING btree (huerto_id, fecha DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_balance_huerto_lote_fecha ON public.huerto_balance_hidrico USING btree (huerto_id, COALESCE(huerto_lote_id, '00000000-0000-0000-0000-000000000000'::uuid), fecha);
CREATE INDEX IF NOT EXISTS idx_reco_estado_fecha ON public.riego_recomendaciones USING btree (estado, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_reco_huerto_fecha ON public.riego_recomendaciones USING btree (huerto_id, fecha DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reco_huerto_lote_fecha ON public.riego_recomendaciones USING btree (huerto_id, COALESCE(huerto_lote_id, '00000000-0000-0000-0000-000000000000'::uuid), fecha);

-- =========================
-- TRIGGERS huerto_lotes
-- =========================
DROP TRIGGER IF EXISTS trg_huerto_lotes_geometria ON public.huerto_lotes;
CREATE TRIGGER trg_huerto_lotes_geometria
BEFORE INSERT OR UPDATE ON public.huerto_lotes
FOR EACH ROW EXECUTE FUNCTION public.fase_a_derivar_geometria();

DROP TRIGGER IF EXISTS trg_huerto_lotes_updated_at ON public.huerto_lotes;
CREATE TRIGGER trg_huerto_lotes_updated_at
BEFORE UPDATE ON public.huerto_lotes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- RLS + POLITICAS + GRANTS
-- =========================
ALTER TABLE public.productor_usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin administra vinculos productor" ON public.productor_usuarios;
DROP POLICY IF EXISTS "Usuario ve su vinculo productor" ON public.productor_usuarios;
CREATE POLICY "Admin administra vinculos productor" ON public.productor_usuarios
FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Usuario ve su vinculo productor" ON public.productor_usuarios
FOR SELECT TO public
USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
GRANT ALL ON public.productor_usuarios TO anon, authenticated, service_role;

ALTER TABLE public.huerto_lotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin borra secciones de huerto" ON public.huerto_lotes;
DROP POLICY IF EXISTS "Capturar secciones de huerto" ON public.huerto_lotes;
DROP POLICY IF EXISTS "Ver secciones de huerto" ON public.huerto_lotes;
DROP POLICY IF EXISTS "Editar secciones de huerto" ON public.huerto_lotes;
CREATE POLICY "Admin borra secciones de huerto" ON public.huerto_lotes
FOR DELETE TO public
USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Capturar secciones de huerto" ON public.huerto_lotes
FOR INSERT TO public
WITH CHECK (es_personal_campo(auth.uid()));
CREATE POLICY "Ver secciones de huerto" ON public.huerto_lotes
FOR SELECT TO public
USING (puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Editar secciones de huerto" ON public.huerto_lotes
FOR UPDATE TO public
USING (es_personal_campo(auth.uid()));
GRANT ALL ON public.huerto_lotes TO anon, authenticated, service_role;

ALTER TABLE public.campo_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin borra labores de campo" ON public.campo_eventos;
DROP POLICY IF EXISTS "Capturar labores de campo" ON public.campo_eventos;
DROP POLICY IF EXISTS "Ver labores de campo" ON public.campo_eventos;
DROP POLICY IF EXISTS "Editar labores de campo" ON public.campo_eventos;
CREATE POLICY "Admin borra labores de campo" ON public.campo_eventos
FOR DELETE TO public
USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Capturar labores de campo" ON public.campo_eventos
FOR INSERT TO public
WITH CHECK (puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Ver labores de campo" ON public.campo_eventos
FOR SELECT TO public
USING (puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Editar labores de campo" ON public.campo_eventos
FOR UPDATE TO public
USING (es_personal_campo(auth.uid()) OR (usuario_id = auth.uid()));
GRANT ALL ON public.campo_eventos TO anon, authenticated, service_role;

ALTER TABLE public.campo_monitoreos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin borra monitoreos" ON public.campo_monitoreos;
DROP POLICY IF EXISTS "Capturar monitoreos" ON public.campo_monitoreos;
DROP POLICY IF EXISTS "Ver monitoreos" ON public.campo_monitoreos;
DROP POLICY IF EXISTS "Editar monitoreos" ON public.campo_monitoreos;
CREATE POLICY "Admin borra monitoreos" ON public.campo_monitoreos
FOR DELETE TO public
USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Capturar monitoreos" ON public.campo_monitoreos
FOR INSERT TO public
WITH CHECK (puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Ver monitoreos" ON public.campo_monitoreos
FOR SELECT TO public
USING (puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Editar monitoreos" ON public.campo_monitoreos
FOR UPDATE TO public
USING (es_personal_campo(auth.uid()) OR (usuario_id = auth.uid()));
GRANT ALL ON public.campo_monitoreos TO anon, authenticated, service_role;

ALTER TABLE public.campo_estimaciones_cosecha ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin borra estimaciones" ON public.campo_estimaciones_cosecha;
DROP POLICY IF EXISTS "Capturar estimaciones" ON public.campo_estimaciones_cosecha;
DROP POLICY IF EXISTS "Ver estimaciones" ON public.campo_estimaciones_cosecha;
DROP POLICY IF EXISTS "Editar estimaciones" ON public.campo_estimaciones_cosecha;
CREATE POLICY "Admin borra estimaciones" ON public.campo_estimaciones_cosecha
FOR DELETE TO public
USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Capturar estimaciones" ON public.campo_estimaciones_cosecha
FOR INSERT TO public
WITH CHECK (puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Ver estimaciones" ON public.campo_estimaciones_cosecha
FOR SELECT TO public
USING (puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Editar estimaciones" ON public.campo_estimaciones_cosecha
FOR UPDATE TO public
USING (es_personal_campo(auth.uid()) OR (usuario_id = auth.uid()));
GRANT ALL ON public.campo_estimaciones_cosecha TO anon, authenticated, service_role;

ALTER TABLE public.huerto_clima_diario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Personal campo captura clima" ON public.huerto_clima_diario;
DROP POLICY IF EXISTS "Ver clima de huerto" ON public.huerto_clima_diario;
CREATE POLICY "Personal campo captura clima" ON public.huerto_clima_diario
FOR INSERT TO public
WITH CHECK (es_personal_campo(auth.uid()));
CREATE POLICY "Ver clima de huerto" ON public.huerto_clima_diario
FOR SELECT TO public
USING (puede_ver_huerto(auth.uid(), huerto_id));
GRANT ALL ON public.huerto_clima_diario TO anon, authenticated, service_role;

ALTER TABLE public.riego_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin borra eventos de riego" ON public.riego_eventos;
DROP POLICY IF EXISTS "Capturar eventos de riego" ON public.riego_eventos;
DROP POLICY IF EXISTS "Ver eventos de riego" ON public.riego_eventos;
DROP POLICY IF EXISTS "Editar eventos de riego" ON public.riego_eventos;
CREATE POLICY "Admin borra eventos de riego" ON public.riego_eventos
FOR DELETE TO public
USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Capturar eventos de riego" ON public.riego_eventos
FOR INSERT TO public
WITH CHECK (puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Ver eventos de riego" ON public.riego_eventos
FOR SELECT TO public
USING (puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Editar eventos de riego" ON public.riego_eventos
FOR UPDATE TO public
USING (es_personal_campo(auth.uid()) OR (usuario_id = auth.uid()));
GRANT ALL ON public.riego_eventos TO anon, authenticated, service_role;

ALTER TABLE public.huerto_balance_hidrico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver balance de huerto" ON public.huerto_balance_hidrico;
CREATE POLICY "Ver balance de huerto" ON public.huerto_balance_hidrico
FOR SELECT TO public
USING (puede_ver_huerto(auth.uid(), huerto_id));
GRANT ALL ON public.huerto_balance_hidrico TO anon, authenticated, service_role;

ALTER TABLE public.riego_recomendaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver recomendaciones de huerto" ON public.riego_recomendaciones;
CREATE POLICY "Ver recomendaciones de huerto" ON public.riego_recomendaciones
FOR SELECT TO public
USING (puede_ver_huerto(auth.uid(), huerto_id));
GRANT ALL ON public.riego_recomendaciones TO anon, authenticated, service_role;

-- Politicas campo sobre huertos (tabla existente en el repo).
DROP POLICY IF EXISTS "Campo captura huertos" ON public.huertos;
DROP POLICY IF EXISTS "Campo y productor ven huertos" ON public.huertos;
DROP POLICY IF EXISTS "Campo edita huertos" ON public.huertos;
CREATE POLICY "Campo captura huertos" ON public.huertos
FOR INSERT TO public
WITH CHECK (es_personal_campo(auth.uid()));
CREATE POLICY "Campo y productor ven huertos" ON public.huertos
FOR SELECT TO public
USING (puede_ver_huerto(auth.uid(), id));
CREATE POLICY "Campo edita huertos" ON public.huertos
FOR UPDATE TO public
USING (es_personal_campo(auth.uid()));
