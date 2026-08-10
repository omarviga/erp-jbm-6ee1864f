WITH presentaciones_objetivo AS (
  SELECT id, nombre
  FROM public.presentaciones
  WHERE lower(nombre) IN (
    lower('Caja Reja 20 kg'),
    lower('Arpilla 16 kg'),
    lower('Arpilla 18 kg'),
    lower('Arpilla 26 kg')
  )
),
inventario_semilla AS (
  SELECT
    id AS presentacion_id,
    CASE
      WHEN lower(nombre) = lower('Caja Reja 20 kg') THEN 12
      WHEN lower(nombre) = lower('Arpilla 16 kg') THEN 20
      WHEN lower(nombre) = lower('Arpilla 18 kg') THEN 18
      WHEN lower(nombre) = lower('Arpilla 26 kg') THEN 10
      ELSE 0
    END AS cantidad_disponible,
    CASE
      WHEN lower(nombre) = lower('Caja Reja 20 kg') THEN 210.00
      WHEN lower(nombre) = lower('Arpilla 16 kg') THEN 145.00
      WHEN lower(nombre) = lower('Arpilla 18 kg') THEN 160.00
      WHEN lower(nombre) = lower('Arpilla 26 kg') THEN 230.00
      ELSE 0
    END AS precio_base,
    CASE
      WHEN lower(nombre) = lower('Caja Reja 20 kg') THEN 290.00
      WHEN lower(nombre) = lower('Arpilla 16 kg') THEN 199.00
      WHEN lower(nombre) = lower('Arpilla 18 kg') THEN 225.00
      WHEN lower(nombre) = lower('Arpilla 26 kg') THEN 315.00
      ELSE 0
    END AS precio_venta
  FROM presentaciones_objetivo
)
INSERT INTO public.inventario_bodega_cdmx (
  presentacion_id,
  cantidad_disponible,
  precio_base,
  precio_venta,
  fecha_ingreso
)
SELECT
  inventario_semilla.presentacion_id,
  inventario_semilla.cantidad_disponible,
  inventario_semilla.precio_base,
  inventario_semilla.precio_venta,
  now()
FROM inventario_semilla
WHERE inventario_semilla.cantidad_disponible > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.inventario_bodega_cdmx inventario_existente
    WHERE inventario_existente.presentacion_id = inventario_semilla.presentacion_id
  );
