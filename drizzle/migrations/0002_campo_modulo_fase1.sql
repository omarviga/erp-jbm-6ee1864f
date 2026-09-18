-- ============ Catálogo de cultivos ============
CREATE TABLE IF NOT EXISTS public.cultivos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cultivos_catalogo TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cultivos_catalogo TO authenticated;
GRANT ALL ON public.cultivos_catalogo TO service_role;
ALTER TABLE public.cultivos_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cultivos visibles autenticados" ON public.cultivos_catalogo
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin administra cultivos" ON public.cultivos_catalogo
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.cultivos_catalogo (nombre) VALUES ('Limón')
  ON CONFLICT (nombre) DO NOTHING;

-- ============ Huertos: campos adicionales (aditivo) ============
ALTER TABLE public.huertos
  ADD COLUMN IF NOT EXISTS productor_id UUID REFERENCES public.productores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cultivo_id UUID REFERENCES public.cultivos_catalogo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variedad TEXT,
  ADD COLUMN IF NOT EXISTS municipio TEXT,
  ADD COLUMN IF NOT EXISTS fecha_plantacion DATE,
  ADD COLUMN IF NOT EXISTS poligono JSONB,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notas TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_huertos_productor ON public.huertos(productor_id);

-- ============ Vínculo usuario -> productor (acceso externo limitado) ============
CREATE TABLE IF NOT EXISTS public.productor_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  productor_id UUID NOT NULL REFERENCES public.productores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (productor_id, user_id)
);
GRANT SELECT ON public.productor_usuarios TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.productor_usuarios TO authenticated;
GRANT ALL ON public.productor_usuarios TO service_role;
ALTER TABLE public.productor_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario ve su vinculo productor" ON public.productor_usuarios
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin administra vinculos productor" ON public.productor_usuarios
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Funciones de acceso ============
CREATE OR REPLACE FUNCTION public.es_personal_campo(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'campo')
    OR public.has_role(_user_id, 'produccion')
    OR public.has_role(_user_id, 'almacen')
  );
$$;

CREATE OR REPLACE FUNCTION public.puede_ver_huerto(_user_id UUID, _huerto_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.es_personal_campo(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.productor_usuarios pu
      JOIN public.huertos h ON h.productor_id = pu.productor_id
      WHERE pu.user_id = _user_id AND h.id = _huerto_id
    )
  );
$$;

-- Ampliar visibilidad de huertos: báscula/campo y productores vinculados
CREATE POLICY "Campo y productor ven huertos" ON public.huertos
  FOR SELECT USING (public.puede_ver_huerto(auth.uid(), id));
CREATE POLICY "Campo captura huertos" ON public.huertos
  FOR INSERT WITH CHECK (public.es_personal_campo(auth.uid()));
CREATE POLICY "Campo edita huertos" ON public.huertos
  FOR UPDATE USING (public.es_personal_campo(auth.uid()));

-- ============ Lotes de campo (secciones del huerto) ============
CREATE TABLE IF NOT EXISTS public.huerto_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huerto_id UUID NOT NULL REFERENCES public.huertos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  superficie_ha NUMERIC,
  poligono JSONB,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_huerto_lotes_huerto ON public.huerto_lotes(huerto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.huerto_lotes TO authenticated;
GRANT ALL ON public.huerto_lotes TO service_role;
ALTER TABLE public.huerto_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver secciones de huerto" ON public.huerto_lotes
  FOR SELECT USING (public.puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Capturar secciones de huerto" ON public.huerto_lotes
  FOR INSERT WITH CHECK (public.es_personal_campo(auth.uid()));
CREATE POLICY "Editar secciones de huerto" ON public.huerto_lotes
  FOR UPDATE USING (public.es_personal_campo(auth.uid()));
CREATE POLICY "Admin borra secciones de huerto" ON public.huerto_lotes
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============ Bitácora de labores ============
CREATE TABLE IF NOT EXISTS public.campo_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huerto_id UUID NOT NULL REFERENCES public.huertos(id) ON DELETE CASCADE,
  huerto_lote_id UUID REFERENCES public.huerto_lotes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  insumo TEXT,
  dosis TEXT,
  responsable TEXT,
  costo NUMERIC NOT NULL DEFAULT 0,
  notas TEXT,
  usuario_id UUID,
  cliente_uuid UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campo_eventos_huerto_fecha ON public.campo_eventos(huerto_id, fecha DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campo_eventos TO authenticated;
GRANT ALL ON public.campo_eventos TO service_role;
ALTER TABLE public.campo_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver labores de campo" ON public.campo_eventos
  FOR SELECT USING (public.puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Capturar labores de campo" ON public.campo_eventos
  FOR INSERT WITH CHECK (public.puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Editar labores de campo" ON public.campo_eventos
  FOR UPDATE USING (public.es_personal_campo(auth.uid()) OR usuario_id = auth.uid());
CREATE POLICY "Admin borra labores de campo" ON public.campo_eventos
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============ Monitoreos ============
CREATE TABLE IF NOT EXISTS public.campo_monitoreos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huerto_id UUID NOT NULL REFERENCES public.huertos(id) ON DELETE CASCADE,
  huerto_lote_id UUID REFERENCES public.huerto_lotes(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_hallazgo TEXT NOT NULL,
  severidad TEXT NOT NULL DEFAULT 'baja',
  notas TEXT,
  fotos TEXT[] NOT NULL DEFAULT '{}',
  clasificacion_ia JSONB,
  usuario_id UUID,
  cliente_uuid UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campo_monitoreos_huerto_fecha ON public.campo_monitoreos(huerto_id, fecha DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campo_monitoreos TO authenticated;
GRANT ALL ON public.campo_monitoreos TO service_role;
ALTER TABLE public.campo_monitoreos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver monitoreos" ON public.campo_monitoreos
  FOR SELECT USING (public.puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Capturar monitoreos" ON public.campo_monitoreos
  FOR INSERT WITH CHECK (public.puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Editar monitoreos" ON public.campo_monitoreos
  FOR UPDATE USING (public.es_personal_campo(auth.uid()) OR usuario_id = auth.uid());
CREATE POLICY "Admin borra monitoreos" ON public.campo_monitoreos
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============ Estimaciones de cosecha ============
CREATE TABLE IF NOT EXISTS public.campo_estimaciones_cosecha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huerto_id UUID NOT NULL REFERENCES public.huertos(id) ON DELETE CASCADE,
  fecha_estimada DATE NOT NULL,
  volumen_estimado_kg NUMERIC NOT NULL,
  fuente TEXT NOT NULL DEFAULT 'manual',
  notas TEXT,
  usuario_id UUID,
  cliente_uuid UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campo_estimaciones_huerto ON public.campo_estimaciones_cosecha(huerto_id, fecha_estimada DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campo_estimaciones_cosecha TO authenticated;
GRANT ALL ON public.campo_estimaciones_cosecha TO service_role;
ALTER TABLE public.campo_estimaciones_cosecha ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver estimaciones" ON public.campo_estimaciones_cosecha
  FOR SELECT USING (public.puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Capturar estimaciones" ON public.campo_estimaciones_cosecha
  FOR INSERT WITH CHECK (public.puede_ver_huerto(auth.uid(), huerto_id));
CREATE POLICY "Editar estimaciones" ON public.campo_estimaciones_cosecha
  FOR UPDATE USING (public.es_personal_campo(auth.uid()) OR usuario_id = auth.uid());
CREATE POLICY "Admin borra estimaciones" ON public.campo_estimaciones_cosecha
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============ updated_at en huertos ============
DROP TRIGGER IF EXISTS trg_huertos_updated_at ON public.huertos;
CREATE TRIGGER trg_huertos_updated_at
  BEFORE UPDATE ON public.huertos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();