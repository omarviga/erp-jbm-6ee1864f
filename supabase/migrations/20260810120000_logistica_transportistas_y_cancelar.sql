-- Asegurar que la tabla transportistas exista (idempotente)
CREATE TABLE IF NOT EXISTS public.transportistas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    rfc TEXT,
    placas TEXT,
    numero_permiso TEXT,
    telefono TEXT,
    tipo_permiso TEXT,
    seguro_responsabilidad_civil BOOLEAN DEFAULT false,
    poliza_seguro TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transportistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.transportistas;
CREATE POLICY "Enable all for authenticated users" ON public.transportistas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Columnas para estado y datos de la carta porte en guias_salida
ALTER TABLE public.guias_salida ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'generada';
ALTER TABLE public.guias_salida ADD COLUMN IF NOT EXISTS folio TEXT;
ALTER TABLE public.guias_salida ADD COLUMN IF NOT EXISTS lugar_origen TEXT;
ALTER TABLE public.guias_salida ADD COLUMN IF NOT EXISTS lugar_destino TEXT;
ALTER TABLE public.guias_salida ADD COLUMN IF NOT EXISTS peso_total DECIMAL(12,2) DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guias_salida' AND column_name = 'transportista_id') THEN
        ALTER TABLE public.guias_salida ADD COLUMN transportista_id UUID REFERENCES public.transportistas(id);
    END IF;
END $$;
