INSERT INTO public.presentaciones (nombre, peso_kg, tipo, activa)
SELECT 'Caja Reja 20 kg', 20.0, 'caja', true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.presentaciones
  WHERE lower(nombre) = lower('Caja Reja 20 kg')
);

INSERT INTO public.presentaciones (nombre, peso_kg, tipo, activa)
SELECT 'Arpilla 16 kg', 16.0, 'arpilla', true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.presentaciones
  WHERE lower(nombre) = lower('Arpilla 16 kg')
);

INSERT INTO public.presentaciones (nombre, peso_kg, tipo, activa)
SELECT 'Arpilla 18 kg', 18.0, 'arpilla', true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.presentaciones
  WHERE lower(nombre) = lower('Arpilla 18 kg')
);

INSERT INTO public.presentaciones (nombre, peso_kg, tipo, activa)
SELECT 'Arpilla 26 kg', 26.0, 'arpilla', true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.presentaciones
  WHERE lower(nombre) = lower('Arpilla 26 kg')
);
