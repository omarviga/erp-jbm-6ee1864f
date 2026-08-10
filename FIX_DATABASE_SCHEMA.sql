-- ==========================================================
-- FINAL FIX: ADD ALL MISSING COLUMNS TO 'lotes' TABLE
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- ==========================================================

ALTER TABLE public.lotes 
ADD COLUMN IF NOT EXISTS calidad_defectos DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'externo',
ADD COLUMN IF NOT EXISTS estado_calidad TEXT DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS folio_fisico TEXT,
ADD COLUMN IF NOT EXISTS zona_asignada TEXT DEFAULT 'anden_descarga',
ADD COLUMN IF NOT EXISTS costo_bascula DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS peso_pagable DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS kilos_merma DECIMAL(12,2) DEFAULT 0;

-- Comments for documentation
COMMENT ON COLUMN public.lotes.calidad_defectos IS 'Porcentaje de defectos de calidad detectados';
COMMENT ON COLUMN public.lotes.origen IS 'Origen del lote (externo/interno)';
COMMENT ON COLUMN public.lotes.estado_calidad IS 'Estado de aprobación de calidad';
COMMENT ON COLUMN public.lotes.usuario_id IS 'ID del usuario que registró la recepción';
COMMENT ON COLUMN public.lotes.folio_fisico IS 'Folio del ticket físico de la báscula';
COMMENT ON COLUMN public.lotes.zona_asignada IS 'Zona de destino asignada al lote';
COMMENT ON COLUMN public.lotes.costo_bascula IS 'Costo del servicio de báscula aplicado al lote';
COMMENT ON COLUMN public.lotes.peso_pagable IS 'Kilos netos pagables descontando merma';
COMMENT ON COLUMN public.lotes.kilos_merma IS 'Kilos descontados por defectos de calidad';
