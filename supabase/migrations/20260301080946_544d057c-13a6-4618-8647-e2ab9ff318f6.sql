-- Add new tipo_insumo values for cera and caja_carton
ALTER TYPE public.tipo_insumo ADD VALUE IF NOT EXISTS 'cera';
ALTER TYPE public.tipo_insumo ADD VALUE IF NOT EXISTS 'caja_carton';