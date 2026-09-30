-- ==========================================================
-- Integración insumos <-> producción.
--
-- Objetivo:
--   1. Trazabilidad: vincular consumo de insumos a producción
--      (insumo_movimientos.produccion_id).
--   2. Recetas (BOM) configurables por presentación/calidad
--      (recetas + receta_detalles), reemplazando las reglas
--      hardcodeadas del cliente (insumoDeductionService.ts).
--   3. Costeo real: costo de fruta (lote) + costo de insumos
--      por producción (produccion.costo_*).
--   4. Registrar producción de forma ATÓMICA (RPC SECURITY
--      DEFINER) para no dejar producción sin insumos en caso
--      de fallo parcial.
--   5. Fix RLS: el rol finanzas (ComprasTab en /finanzas) debe
--      poder leer/insertar/actualizar insumos e insumo_movimientos.
--   6. Policy UPDATE en produccion (admin / produccion).
-- ==========================================================

-- ----------------------------------------------------------
-- 1) Trazabilidad: produccion_id en insumo_movimientos
-- ----------------------------------------------------------
ALTER TABLE public.insumo_movimientos
  ADD COLUMN IF NOT EXISTS produccion_id UUID REFERENCES public.produccion(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_insumo_movimientos_produccion_id
  ON public.insumo_movimientos (produccion_id);

-- ----------------------------------------------------------
-- 2) CHECK constraint en tipo_movimiento
--    (la BD comentaba 'entrada'|'salida'|'ajuste' pero el
--    frontend usa 'devolucion'; se normalizan los 4 valores)
-- ----------------------------------------------------------
ALTER TABLE public.insumo_movimientos
  DROP CONSTRAINT IF EXISTS insumo_movimientos_tipo_movimiento_check;

ALTER TABLE public.insumo_movimientos
  ADD CONSTRAINT insumo_movimientos_tipo_movimiento_check
  CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste', 'devolucion'));

-- ----------------------------------------------------------
-- 3) Costos y updated_at en produccion
-- ----------------------------------------------------------
ALTER TABLE public.produccion
  ADD COLUMN IF NOT EXISTS costo_fruta DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_insumos DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_por_caja DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_produccion_updated_at ON public.produccion;
CREATE TRIGGER update_produccion_updated_at
  BEFORE UPDATE ON public.produccion
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------
-- 4) Recetas (BOM)
--    presentacion_id NULL = receta por defecto para la calidad.
--    Resolución: (presentacion_id, calidad) exacta > por defecto.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id UUID REFERENCES public.presentaciones(id) ON DELETE CASCADE,
  calidad calidad_limon NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT recetas_presentacion_calidad_unique UNIQUE (presentacion_id, calidad)
);

-- Solo una receta por defecto por calidad (presentacion_id NULL)
CREATE UNIQUE INDEX IF NOT EXISTS recetas_default_calidad_unique
  ON public.recetas (calidad) WHERE presentacion_id IS NULL;

CREATE TABLE IF NOT EXISTS public.receta_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id UUID NOT NULL REFERENCES public.recetas(id) ON DELETE CASCADE,
  insumo_tipo tipo_insumo NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
  base TEXT NOT NULL DEFAULT 'por_caja' CHECK (base IN ('por_caja', 'por_pallet')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT receta_detalles_receta_tipo_unique UNIQUE (receta_id, insumo_tipo)
);

-- ----------------------------------------------------------
-- 5) Trazabilidad / costeo por producción
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produccion_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produccion_id UUID NOT NULL REFERENCES public.produccion(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  cantidad NUMERIC(10,2) NOT NULL,
  costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_total DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * costo_unitario) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produccion_insumos_produccion_id
  ON public.produccion_insumos (produccion_id);
CREATE INDEX IF NOT EXISTS idx_produccion_insumos_insumo_id
  ON public.produccion_insumos (insumo_id);

-- ----------------------------------------------------------
-- 6) RLS + políticas
-- ----------------------------------------------------------
ALTER TABLE public.recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receta_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produccion_insumos ENABLE ROW LEVEL SECURITY;

-- recetas
DROP POLICY IF EXISTS "Role-based view recetas" ON public.recetas;
CREATE POLICY "Role-based view recetas" ON public.recetas
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

DROP POLICY IF EXISTS "Admin insert recetas" ON public.recetas;
CREATE POLICY "Admin insert recetas" ON public.recetas
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admin update recetas" ON public.recetas;
CREATE POLICY "Admin update recetas" ON public.recetas
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admin delete recetas" ON public.recetas;
CREATE POLICY "Admin delete recetas" ON public.recetas
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- receta_detalles
DROP POLICY IF EXISTS "Role-based view receta_detalles" ON public.receta_detalles;
CREATE POLICY "Role-based view receta_detalles" ON public.receta_detalles
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

DROP POLICY IF EXISTS "Admin insert receta_detalles" ON public.receta_detalles;
CREATE POLICY "Admin insert receta_detalles" ON public.receta_detalles
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admin update receta_detalles" ON public.receta_detalles;
CREATE POLICY "Admin update receta_detalles" ON public.receta_detalles
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admin delete receta_detalles" ON public.receta_detalles;
CREATE POLICY "Admin delete receta_detalles" ON public.receta_detalles
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- produccion_insumos (solo lectura directa; la escritura la hace
-- el RPC registrar_produccion que es SECURITY DEFINER)
DROP POLICY IF EXISTS "Role-based view produccion_insumos" ON public.produccion_insumos;
CREATE POLICY "Role-based view produccion_insumos" ON public.produccion_insumos
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role) OR has_role(auth.uid(), 'produccion'::app_role) OR has_role(auth.uid(), 'ventas'::app_role))
);

-- ----------------------------------------------------------
-- 7) Fix RLS finanzas (ComprasTab vive en /finanzas)
--    Se agrega 'finanzas' a SELECT/INSERT/UPDATE de insumos y
--    SELECT/INSERT de insumo_movimientos.
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Role-based view insumos" ON public.insumos;
CREATE POLICY "Role-based view insumos" ON public.insumos
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role) OR has_role(auth.uid(), 'produccion'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

DROP POLICY IF EXISTS "Role-based insert insumos" ON public.insumos;
CREATE POLICY "Role-based insert insumos" ON public.insumos
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

DROP POLICY IF EXISTS "Role-based update insumos" ON public.insumos;
CREATE POLICY "Role-based update insumos" ON public.insumos
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

DROP POLICY IF EXISTS "Role-based view insumo_movimientos" ON public.insumo_movimientos;
CREATE POLICY "Role-based view insumo_movimientos" ON public.insumo_movimientos
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

DROP POLICY IF EXISTS "Role-based insert insumo_movimientos" ON public.insumo_movimientos;
CREATE POLICY "Role-based insert insumo_movimientos" ON public.insumo_movimientos
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

-- ----------------------------------------------------------
-- 8) Policy UPDATE en produccion (admin / produccion)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Role-based update produccion" ON public.produccion;
CREATE POLICY "Role-based update produccion" ON public.produccion
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'produccion'::app_role))
);

-- ----------------------------------------------------------
-- 9) RPC registrar_produccion
--    Insert producción + side-effects (cámara fría / molino) +
--    deducción de insumos según receta + costeo, TODO en una
--    transacción atómica con bloqueo FOR UPDATE de stock.
--    Roles: admin / produccion (mismas políticas INSERT produccion).
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_produccion(
  UUID, calibre_limon, color_limon, calidad_limon, UUID, INTEGER, NUMERIC, destino_produccion
);

CREATE OR REPLACE FUNCTION public.registrar_produccion(
  p_lote_id UUID,
  p_calibre calibre_limon,
  p_color color_limon,
  p_calidad calidad_limon,
  p_presentacion_id UUID,
  p_cantidad_cajas INTEGER,
  p_peso_total_kg NUMERIC,
  p_destino destino_produccion
)
RETURNS TABLE(
  produccion_id UUID,
  deducciones JSONB,
  errores JSONB,
  costo_fruta NUMERIC,
  costo_insumos NUMERIC,
  costo_total NUMERIC,
  costo_por_caja NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_produccion_id UUID;
  v_lote_precio NUMERIC := 0;
  v_receta_id UUID;
  v_detalle RECORD;
  v_insumo RECORD;
  v_requerido NUMERIC;
  v_restar NUMERIC;
  v_cajas_por_pallet NUMERIC := 56;
  v_deducido JSONB := '[]'::JSONB;
  v_error JSONB := '[]'::JSONB;
  v_total_insumos NUMERIC := 0;
  v_costo_fruta NUMERIC := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_lote_id IS NULL THEN
    RAISE EXCEPTION 'lote_id es requerido';
  END IF;

  SELECT COALESCE(precio_pactado_kg, 0)
  INTO v_lote_precio
  FROM public.lotes
  WHERE id = p_lote_id;

  INSERT INTO public.produccion (
    lote_id, calibre, color, calidad, presentacion_id, cantidad_cajas, peso_total_kg, destino
  ) VALUES (
    p_lote_id, p_calibre, p_color, p_calidad, p_presentacion_id, p_cantidad_cajas, p_peso_total_kg, p_destino
  )
  RETURNING id INTO v_produccion_id;

  IF p_destino = 'camara_fria' THEN
    INSERT INTO public.camara_fria (produccion_id, cantidad_cajas, cantidad_disponible)
    VALUES (v_produccion_id, p_cantidad_cajas, p_cantidad_cajas);
  END IF;

  IF p_destino = 'molino' THEN
    INSERT INTO public.stock_molino (lote_id, peso_kg, peso_disponible)
    VALUES (p_lote_id, p_peso_total_kg, p_peso_total_kg);
  END IF;

  -- Deducción de insumos según receta (BOM)
  IF p_calidad <> 'industria' AND p_cantidad_cajas > 0 THEN
    SELECT id INTO v_receta_id
    FROM public.recetas
    WHERE activa = true
      AND calidad = p_calidad
      AND (presentacion_id = p_presentacion_id OR (p_presentacion_id IS NULL AND presentacion_id IS NULL))
    ORDER BY presentacion_id NULLS LAST
    LIMIT 1;

    IF v_receta_id IS NOT NULL THEN
      FOR v_detalle IN
        SELECT insumo_tipo, cantidad, base
        FROM public.receta_detalles
        WHERE receta_id = v_receta_id
      LOOP
        v_requerido := CASE
          WHEN v_detalle.base = 'por_pallet' THEN ceil(p_cantidad_cajas / v_cajas_por_pallet) * v_detalle.cantidad
          ELSE p_cantidad_cajas * v_detalle.cantidad
        END;

        SELECT id, cantidad_disponible, costo_unitario, nombre, tipo
        INTO v_insumo
        FROM public.insumos
        WHERE tipo = v_detalle.insumo_tipo
        ORDER BY cantidad_disponible DESC
        LIMIT 1
        FOR UPDATE;

        IF v_insumo.id IS NULL THEN
          v_error := v_error || jsonb_build_object(
            'insumoNombre', v_detalle.insumo_tipo,
            'error', 'No hay insumo registrado de este tipo'
          );
          CONTINUE;
        END IF;

        v_restar := LEAST(v_requerido, v_insumo.cantidad_disponible);

        IF v_restar > 0 THEN
          UPDATE public.insumos
          SET cantidad_disponible = cantidad_disponible - v_restar
          WHERE id = v_insumo.id;

          INSERT INTO public.insumo_movimientos (
            insumo_id, tipo_movimiento, cantidad, referencia, produccion_id
          ) VALUES (
            v_insumo.id, 'salida', -v_restar, 'Consumo por producción', v_produccion_id
          );

          INSERT INTO public.produccion_insumos (
            produccion_id, insumo_id, cantidad, costo_unitario
          ) VALUES (
            v_produccion_id, v_insumo.id, v_restar, COALESCE(v_insumo.costo_unitario, 0)
          );

          v_total_insumos := v_total_insumos + (v_restar * COALESCE(v_insumo.costo_unitario, 0));

          v_deducido := v_deducido || jsonb_build_object(
            'insumoNombre', v_insumo.nombre,
            'cantidadDescontada', v_restar
          );
        END IF;

        IF v_requerido > v_insumo.cantidad_disponible THEN
          v_error := v_error || jsonb_build_object(
            'insumoNombre', v_insumo.nombre,
            'faltante', (v_requerido - v_insumo.cantidad_disponible)
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  v_costo_fruta := round(COALESCE(p_peso_total_kg, 0) * v_lote_precio, 2);

  UPDATE public.produccion
  SET costo_fruta = v_costo_fruta,
      costo_insumos = round(v_total_insumos, 2),
      costo_total = round(v_costo_fruta + v_total_insumos, 2),
      costo_por_caja = CASE
        WHEN p_cantidad_cajas > 0 THEN round((v_costo_fruta + v_total_insumos) / p_cantidad_cajas, 2)
        ELSE 0
      END
  WHERE id = v_produccion_id;

  produccion_id := v_produccion_id;
  deducciones := v_deducido;
  errores := v_error;
  costo_fruta := v_costo_fruta;
  costo_insumos := round(v_total_insumos, 2);
  costo_total := round(v_costo_fruta + v_total_insumos, 2);
  costo_por_caja := CASE
    WHEN p_cantidad_cajas > 0 THEN round((v_costo_fruta + v_total_insumos) / p_cantidad_cajas, 2)
    ELSE 0
  END;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_produccion(
  UUID, calibre_limon, color_limon, calidad_limon, UUID, INTEGER, NUMERIC, destino_produccion
) TO authenticated;

-- ----------------------------------------------------------
-- 10) RPC registrar_entrada_insumos_compra
--     Alta/actualización de insumos desde una compra (OCR),
--     atómico. p_insumos = [{nombre, tipo_insumo, cantidad,
--     precio_unitario}]. Roles: admin / almacen / finanzas.
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_entrada_insumos_compra(JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.registrar_entrada_insumos_compra(
  p_insumos JSONB,
  p_referencia TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_insumo_id UUID;
  v_nombre TEXT;
  v_tipo tipo_insumo;
  v_cantidad NUMERIC;
  v_precio NUMERIC;
  v_resultado JSONB := '{"actualizados": [], "creados": [], "errores": []}'::JSONB;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_insumos IS NULL OR jsonb_typeof(p_insumos) <> 'array' OR jsonb_array_length(p_insumos) = 0 THEN
    RAISE EXCEPTION 'No hay insumos válidos para guardar';
  END IF;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_insumos)
  LOOP
    v_nombre := trim(COALESCE(v_item->>'nombre', ''));
    v_tipo := (v_item->>'tipo_insumo')::tipo_insumo;
    v_cantidad := COALESCE((v_item->>'cantidad')::NUMERIC, 0);
    v_precio := COALESCE((v_item->>'precio_unitario')::NUMERIC, 0);

    IF v_nombre = '' OR v_tipo IS NULL OR v_cantidad <= 0 THEN
      CONTINUE;
    END IF;

    -- Buscar existente por nombre o por tipo
    SELECT id INTO v_insumo_id
    FROM public.insumos
    WHERE lower(nombre) = lower(v_nombre)
       OR tipo = v_tipo
    ORDER BY CASE WHEN lower(nombre) = lower(v_nombre) THEN 0 ELSE 1 END
    LIMIT 1
    FOR UPDATE;

    IF v_insumo_id IS NOT NULL THEN
      UPDATE public.insumos
      SET cantidad_disponible = cantidad_disponible + v_cantidad,
          costo_unitario = v_precio
      WHERE id = v_insumo_id;

      v_resultado := jsonb_set(
        v_resultado,
        '{actualizados}',
        v_resultado->'actualizados' || jsonb_build_object('insumo_id', v_insumo_id, 'nombre', v_nombre, 'cantidad', v_cantidad)
      );
    ELSE
      INSERT INTO public.insumos (nombre, tipo, cantidad_disponible, cantidad_minima, costo_unitario)
      VALUES (v_nombre, v_tipo, v_cantidad, 10, v_precio)
      RETURNING id INTO v_insumo_id;

      v_resultado := jsonb_set(
        v_resultado,
        '{creados}',
        v_resultado->'creados' || jsonb_build_object('insumo_id', v_insumo_id, 'nombre', v_nombre, 'cantidad', v_cantidad)
      );
    END IF;

    INSERT INTO public.insumo_movimientos (insumo_id, tipo_movimiento, cantidad, referencia)
    VALUES (
      v_insumo_id,
      'entrada',
      v_cantidad,
      COALESCE(NULLIF(trim(p_referencia), ''), 'Compra de insumos')
    );
  END LOOP;

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_entrada_insumos_compra(JSONB, TEXT) TO authenticated;

-- ----------------------------------------------------------
-- 11) Seed de recetas por defecto (reglas que antes vivían
--     hardcodeadas en insumoDeductionService.ts).
--     - primera / segunda: tarima 1/pallet, fleje 4/pallet,
--       esquinero 4/pallet, cera 1/caja.
--     - industria: sin receta (no hay descuento).
--     CAJAS_POR_PALLET = 56 (constante del RPC).
-- ----------------------------------------------------------
INSERT INTO public.recetas (calidad)
SELECT 'primera'
WHERE NOT EXISTS (SELECT 1 FROM public.recetas WHERE calidad = 'primera' AND presentacion_id IS NULL);

INSERT INTO public.recetas (calidad)
SELECT 'segunda'
WHERE NOT EXISTS (SELECT 1 FROM public.recetas WHERE calidad = 'segunda' AND presentacion_id IS NULL);

INSERT INTO public.receta_detalles (receta_id, insumo_tipo, cantidad, base)
SELECT r.id, 'tarima', 1, 'por_pallet'
FROM public.recetas r
WHERE r.presentacion_id IS NULL AND r.calidad IN ('primera', 'segunda')
  AND NOT EXISTS (SELECT 1 FROM public.receta_detalles d WHERE d.receta_id = r.id AND d.insumo_tipo = 'tarima');

INSERT INTO public.receta_detalles (receta_id, insumo_tipo, cantidad, base)
SELECT r.id, 'fleje', 4, 'por_pallet'
FROM public.recetas r
WHERE r.presentacion_id IS NULL AND r.calidad IN ('primera', 'segunda')
  AND NOT EXISTS (SELECT 1 FROM public.receta_detalles d WHERE d.receta_id = r.id AND d.insumo_tipo = 'fleje');

INSERT INTO public.receta_detalles (receta_id, insumo_tipo, cantidad, base)
SELECT r.id, 'esquinero', 4, 'por_pallet'
FROM public.recetas r
WHERE r.presentacion_id IS NULL AND r.calidad IN ('primera', 'segunda')
  AND NOT EXISTS (SELECT 1 FROM public.receta_detalles d WHERE d.receta_id = r.id AND d.insumo_tipo = 'esquinero');

INSERT INTO public.receta_detalles (receta_id, insumo_tipo, cantidad, base)
SELECT r.id, 'cera', 1, 'por_caja'
FROM public.recetas r
WHERE r.presentacion_id IS NULL AND r.calidad IN ('primera', 'segunda')
  AND NOT EXISTS (SELECT 1 FROM public.receta_detalles d WHERE d.receta_id = r.id AND d.insumo_tipo = 'cera');
