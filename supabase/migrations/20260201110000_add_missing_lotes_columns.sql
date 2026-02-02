-- Add missing columns to 'lotes' table
ALTER TABLE public.lotes 
ADD COLUMN IF NOT EXISTS calidad_defectos DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'externo',
ADD COLUMN IF NOT EXISTS estado_calidad TEXT DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users(id);

-- Add comments for clarity
COMMENT ON COLUMN public.lotes.calidad_defectos IS 'Porcentaje de defectos de calidad (0-100)';
COMMENT ON COLUMN public.lotes.origen IS 'Origen del lote: externo (compra) o interno (propio)';
COMMENT ON COLUMN public.lotes.estado_calidad IS 'Estado de calidad: pendiente, aceptado, rechazado, observado';
