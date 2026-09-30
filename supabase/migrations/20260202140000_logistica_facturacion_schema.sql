-- Add Transportistas table
CREATE TABLE IF NOT EXISTS public.transportistas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    rfc TEXT,
    placas TEXT,
    numero_permiso TEXT,
    telefono TEXT,
    tipo_permiso TEXT, -- federal, estatal, internacional
    seguro_responsabilidad_civil BOOLEAN DEFAULT false,
    poliza_seguro TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enhance guias_salida with transportista link
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guias_salida' AND column_name = 'transportista_id') THEN
        ALTER TABLE public.guias_salida ADD COLUMN transportista_id UUID REFERENCES public.transportistas(id);
    END IF;
END $$;

-- Create Facturas table
CREATE TABLE IF NOT EXISTS public.facturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio TEXT UNIQUE NOT NULL,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id),
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_vencimiento TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'borrador', -- borrador, enviada, pagada, vencida, cancelada
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva DECIMAL(12,2) NOT NULL DEFAULT 0,
    ieps DECIMAL(12,2) NOT NULL DEFAULT 0,
    retenciones DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    metodo_pago TEXT, -- transferencia, efectivo, tarjeta, cheque, credito, por_definir
    uso_cfdi TEXT, -- G01, G02, G03, P01
    forma_pago TEXT, -- Pago en una sola exhibición, Pago en parcialidades
    notas TEXT,
    terminos TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create Factura Detalles table
CREATE TABLE IF NOT EXISTS public.factura_detalles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_id UUID NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
    producto_id UUID, -- Opcional, puede ser referencia a camara_fria o produccion si se requiere trazabilidad
    descripcion TEXT NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 0,
    precio_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
    unidad TEXT NOT NULL DEFAULT 'Caja',
    iva_aplicable BOOLEAN DEFAULT true,
    ieps_aplicable DECIMAL(5,2) DEFAULT 0,
    descuento DECIMAL(5,2) DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transportistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factura_detalles ENABLE ROW LEVEL SECURITY;

-- Policies (Allow all for authenticated for now, keeping it simple as per other tables)
CREATE POLICY "Enable all for authenticated users" ON public.transportistas FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.facturas FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.factura_detalles FOR ALL TO authenticated USING (true);
