ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS operador_bascula TEXT,
  ADD COLUMN IF NOT EXISTS cuota_maniobra_concepto TEXT;