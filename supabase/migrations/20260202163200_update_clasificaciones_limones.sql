-- Migration: Actualizar catálogo de clasificaciones con limones JBM
-- Descripción: Reemplaza las clasificaciones anteriores con las clasificaciones reales de limones
-- Author: Sistema
-- Date: 2026-02-02

-- 1. Limpiamos la tabla (Borra los registros anteriores)
TRUNCATE TABLE public.cat_clasificaciones RESTART IDENTITY CASCADE;

-- 2. Insertamos la clasificación real de JBM LIMONES

INSERT INTO public.cat_clasificaciones (nombre_producto, calibre, codigo_interno, orden_visual)
VALUES 
  -- LIMÓN VERDE (CAJAS)
  ('Limón Verde', '4', 'LVER-04', 10),
  ('Limón Verde', 'X', 'LVER-10', 20),
  ('Limón Verde', 'XX', 'LVER-20', 30),
  ('Limón Verde', 'XXX', 'LVER-30', 40),
  ('Limón Verde', 'EXTRA', 'LVER-EX', 50),
  ('Limón Verde', 'SUPER', 'LVER-SU', 60),

  -- LIMÓN ALIMONADO (CAJAS)
  ('Limón Alimonado', '4', 'LALI-04', 70),
  ('Limón Alimonado', 'X', 'LALI-10', 80),
  ('Limón Alimonado', 'XX', 'LALI-20', 90),
  ('Limón Alimonado', 'XXX', 'LALI-30', 100),
  ('Limón Alimonado', 'EXTRA', 'LALI-EX', 110),
  ('Limón Alimonado', 'SUPER', 'LALI-SU', 120),

  -- LIMÓN AMARILLO (CAJAS)
  ('Limón Amarillo', 'X', 'LAMA-10', 130),
  ('Limón Amarillo', 'XX', 'LAMA-20', 140),
  ('Limón Amarillo', 'XXX', 'LAMA-30', 150),
  ('Limón Amarillo', 'EXTRA', 'LAMA-EX', 160),
  ('Limón Amarillo', 'SUPER', 'LAMA-SU', 170),

  -- LIMÓN ECONÓMICO (CAJAS)
  ('Limón Económico', 'X', 'LECO-10', 180),
  ('Limón Económico', 'XX', 'LECO-20', 190),
  ('Limón Económico', 'XXX', 'LECO-30', 200),
  ('Limón Económico', 'EXTRA', 'LECO-EX', 210),
  ('Limón Económico', 'SUPER', 'LECO-SU', 220),

  -- ARPILLAS (SACKS)
  ('Arpilla Verde', 'Grande', 'ARP-VER-G', 230),
  ('Arpilla Verde', 'Mediano', 'ARP-VER-M', 240),
  ('Arpilla Verde', 'Chico', 'ARP-VER-C', 250),

  ('Arpilla Alimonado', 'Grande', 'ARP-ALI-G', 260),
  ('Arpilla Alimonado', 'Mediano', 'ARP-ALI-M', 270),
  ('Arpilla Alimonado', 'Chico', 'ARP-ALI-C', 280),

  ('Arpilla Económico', 'Grande', 'ARP-ECO-G', 290),
  ('Arpilla Económico', 'Mediano', 'ARP-ECO-M', 300),
  ('Arpilla Económico', 'Chico', 'ARP-ECO-C', 310);

-- Verificación: Mostrar conteo de registros insertados
DO $$
DECLARE
  total_records INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_records FROM public.cat_clasificaciones;
  RAISE NOTICE 'Total de clasificaciones insertadas: %', total_records;
END $$;
