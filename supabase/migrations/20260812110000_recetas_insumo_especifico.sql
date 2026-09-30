-- ==========================================================
-- Recetas con insumo específico + guardar_receta RPC.
--
-- Motivo: para distinguir p. ej. "Tarima estufada (exportación)"
-- vs "Tarima nacional" (mismo tipo_insumo 'tarima'), cada detalle
-- de receta puede apuntar a un insumo concreto (insumo_id). Si
-- insumo_id es NULL se mantiene el comportamiento por tipo.
-- ==========================================================

-- 1) insumo_id en receta_detalles (NULL = resolver por tipo)
ALTER TABLE public.receta_detalles
  ADD COLUMN IF NOT EXISTS insumo_id UUID REFERENCES public.insumos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_receta_detalles_insumo_id
  ON public.receta_detalles (insumo_id);

-- ----------------------------------------------------------
-- 2) registrar_produccion: priorizar insumo específico
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
        SELECT insumo_tipo, cantidad, base, insumo_id
        FROM public.receta_detalles
        WHERE receta_id = v_receta_id
      LOOP
        v_requerido := CASE
          WHEN v_detalle.base = 'por_pallet' THEN ceil(p_cantidad_cajas / v_cajas_por_pallet) * v_detalle.cantidad
          ELSE p_cantidad_cajas * v_detalle.cantidad
        END;

        IF v_detalle.insumo_id IS NOT NULL THEN
          -- Insumo específico (ej. tarima estufada exportación)
          SELECT id, cantidad_disponible, costo_unitario, nombre, tipo
          INTO v_insumo
          FROM public.insumos
          WHERE id = v_detalle.insumo_id
          FOR UPDATE;
        ELSE
          -- Resolver por tipo (primer insumo del tipo con más stock)
          SELECT id, cantidad_disponible, costo_unitario, nombre, tipo
          INTO v_insumo
          FROM public.insumos
          WHERE tipo = v_detalle.insumo_tipo
          ORDER BY cantidad_disponible DESC
          LIMIT 1
          FOR UPDATE;
        END IF;

        IF v_insumo.id IS NULL THEN
          v_error := v_error || jsonb_build_object(
            'insumoNombre', COALESCE(v_detalle.insumo_tipo::TEXT, v_detalle.insumo_id::TEXT),
            'error', 'No hay insumo registrado para este concepto'
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
-- 3) guardar_receta: upsert de receta + reemplazo de detalles,
--    atómico. Solo admin. Cada detalle debe apuntar a un insumo
--    específico (insumo_id); insumo_tipo se completa del insumo.
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.guardar_receta(calidad_limon, UUID, BOOLEAN, JSONB);

CREATE OR REPLACE FUNCTION public.guardar_receta(
  p_calidad calidad_limon,
  p_presentacion_id UUID,
  p_activa BOOLEAN DEFAULT true,
  p_detalles JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receta_id UUID;
  v_detalle JSONB;
  v_insumo_id UUID;
  v_insumo_tipo tipo_insumo;
  v_cantidad NUMERIC;
  v_base TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_calidad IS NULL THEN
    RAISE EXCEPTION 'calidad es requerida';
  END IF;

  -- Upsert receta por (presentacion_id, calidad), incluye default (presentacion_id NULL)
  SELECT id INTO v_receta_id
  FROM public.recetas
  WHERE calidad = p_calidad
    AND presentacion_id IS NOT DISTINCT FROM p_presentacion_id
  LIMIT 1;

  IF v_receta_id IS NULL THEN
    INSERT INTO public.recetas (presentacion_id, calidad, activa)
    VALUES (p_presentacion_id, p_calidad, COALESCE(p_activa, true))
    RETURNING id INTO v_receta_id;
  ELSE
    UPDATE public.recetas
    SET activa = COALESCE(p_activa, true),
        updated_at = now()
    WHERE id = v_receta_id;
  END IF;

  DELETE FROM public.receta_detalles WHERE receta_id = v_receta_id;

  FOR v_detalle IN
    SELECT value FROM jsonb_array_elements(p_detalles)
  LOOP
    v_insumo_id := NULLIF(v_detalle->>'insumo_id', '')::UUID;

    IF v_insumo_id IS NULL THEN
      RAISE EXCEPTION 'Cada concepto de la receta debe referenciar un insumo específico';
    END IF;

    SELECT tipo INTO v_insumo_tipo
    FROM public.insumos
    WHERE id = v_insumo_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insumo no encontrado: %', v_insumo_id;
    END IF;

    v_cantidad := COALESCE((v_detalle->>'cantidad')::NUMERIC, 1);
    v_base := COALESCE(NULLIF(v_detalle->>'base', ''), 'por_caja');

    IF v_cantidad <= 0 OR v_base NOT IN ('por_caja', 'por_pallet') THEN
      CONTINUE;
    END IF;

    INSERT INTO public.receta_detalles (receta_id, insumo_id, insumo_tipo, cantidad, base)
    VALUES (v_receta_id, v_insumo_id, v_insumo_tipo, v_cantidad, v_base);
  END LOOP;

  RETURN v_receta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guardar_receta(calidad_limon, UUID, BOOLEAN, JSONB) TO authenticated;
