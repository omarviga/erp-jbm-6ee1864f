-- Add missing columns to 'lotes' table for receiver functionality
ALTER TABLE public.lotes 
ADD COLUMN IF NOT EXISTS folio_fisico TEXT,
ADD COLUMN IF NOT EXISTS zona_asignada TEXT,
ADD COLUMN IF NOT EXISTS costo_bascula DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS peso_pagable DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS kilos_merma DECIMAL(12,2) DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN public.lotes.folio_fisico IS 'Folio del ticket físico de la báscula';
COMMENT ON COLUMN public.lotes.zona_asignada IS 'Zona de destino asignada al lote';
COMMENT ON COLUMN public.lotes.costo_bascula IS 'Costo del servicio de báscula aplicado al lote';
COMMENT ON COLUMN public.lotes.peso_pagable IS 'Kilos netos pagables descontando merma';
COMMENT ON COLUMN public.lotes.kilos_merma IS 'Kilos descontados por defectos de calidad';
