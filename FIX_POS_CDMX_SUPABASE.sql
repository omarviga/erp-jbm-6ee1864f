-- Fix consolidado para POS CDMX
-- Objetivo:
-- 1. Separar ventas POS CDMX del modulo general
-- 2. Evitar inserciones en pagos_clientes con cliente_id NULL
-- 3. Hacer atomica la venta para no dejar registros parciales
-- 4. Mantener compatibilidad con la firma de 4 parametros usada por el frontend

CREATE TABLE IF NOT EXISTS public.ventas_cdmx (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_venta TEXT UNIQUE NOT NULL,
  fecha_venta TIMESTAMPTZ NOT NULL DEFAULT now(),
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  metodo_pago public.forma_pago NOT NULL,
  pagado BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE TABLE IF NOT EXISTS public.venta_detalles_cdmx (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES public.ventas_cdmx(id) ON DELETE CASCADE,
  inventario_id UUID REFERENCES public.inventario_bodega_cdmx(id),
  descripcion TEXT NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ventas_cdmx_created_at ON public.ventas_cdmx(created_at);
CREATE INDEX IF NOT EXISTS idx_ventas_cdmx_fecha_venta ON public.ventas_cdmx(fecha_venta);
CREATE INDEX IF NOT EXISTS idx_ventas_cdmx_metodo_pago ON public.ventas_cdmx(metodo_pago);
CREATE INDEX IF NOT EXISTS idx_venta_detalles_cdmx_venta_id ON public.venta_detalles_cdmx(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_detalles_cdmx_inventario_id ON public.venta_detalles_cdmx(inventario_id);

ALTER TABLE public.ventas_cdmx ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_detalles_cdmx ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver ventas CDMX" ON public.ventas_cdmx;
DROP POLICY IF EXISTS "Insertar ventas CDMX solo por funcion" ON public.ventas_cdmx;
DROP POLICY IF EXISTS "Actualizar ventas CDMX solo admin" ON public.ventas_cdmx;
DROP POLICY IF EXISTS "Eliminar ventas CDMX solo admin" ON public.ventas_cdmx;
DROP POLICY IF EXISTS "Ver detalle ventas CDMX" ON public.venta_detalles_cdmx;
DROP POLICY IF EXISTS "Insertar detalle ventas CDMX solo por funcion" ON public.venta_detalles_cdmx;
DROP POLICY IF EXISTS "Actualizar detalle ventas CDMX solo admin" ON public.venta_detalles_cdmx;
DROP POLICY IF EXISTS "Eliminar detalle ventas CDMX solo admin" ON public.venta_detalles_cdmx;

CREATE POLICY "Ver ventas CDMX"
ON public.ventas_cdmx FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ventas'::app_role)
);

CREATE POLICY "Insertar ventas CDMX solo por funcion"
ON public.ventas_cdmx FOR INSERT
WITH CHECK (false);

CREATE POLICY "Actualizar ventas CDMX solo admin"
ON public.ventas_cdmx FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Eliminar ventas CDMX solo admin"
ON public.ventas_cdmx FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Ver detalle ventas CDMX"
ON public.venta_detalles_cdmx FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ventas'::app_role)
);

CREATE POLICY "Insertar detalle ventas CDMX solo por funcion"
ON public.venta_detalles_cdmx FOR INSERT
WITH CHECK (false);

CREATE POLICY "Actualizar detalle ventas CDMX solo admin"
ON public.venta_detalles_cdmx FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Eliminar detalle ventas CDMX solo admin"
ON public.venta_detalles_cdmx FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.ventas_cdmx (
  id,
  numero_venta,
  fecha_venta,
  total,
  metodo_pago,
  pagado,
  notas,
  created_at
)
SELECT
  v.id,
  v.numero_venta,
  COALESCE(v.fecha_venta, v.created_at),
  v.total,
  COALESCE(
    (
      SELECT pc.forma_pago
      FROM public.pagos_clientes pc
      WHERE pc.venta_id = v.id
      ORDER BY pc.created_at DESC
      LIMIT 1
    ),
    CASE
      WHEN LOWER(COALESCE(v.notas, '')) LIKE '%transfer%' THEN 'transferencia'::public.forma_pago
      WHEN LOWER(COALESCE(v.notas, '')) LIKE '%cheque%' THEN 'cheque'::public.forma_pago
      ELSE 'efectivo'::public.forma_pago
    END
  ),
  COALESCE(v.pagado, true),
  v.notas,
  v.created_at
FROM public.ventas v
WHERE v.tipo = 'pos_cdmx'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.venta_detalles_cdmx (
  id,
  venta_id,
  descripcion,
  cantidad,
  precio_unitario,
  created_at
)
SELECT
  vd.id,
  vd.venta_id,
  vd.descripcion,
  vd.cantidad,
  vd.precio_unitario,
  vd.created_at
FROM public.venta_detalles vd
INNER JOIN public.ventas v ON v.id = vd.venta_id
WHERE v.tipo = 'pos_cdmx'
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.pagos_clientes pc
USING public.ventas v
WHERE pc.venta_id = v.id
  AND v.tipo = 'pos_cdmx';

DELETE FROM public.ventas v
WHERE v.tipo = 'pos_cdmx'
  AND EXISTS (
    SELECT 1
    FROM public.ventas_cdmx vc
    WHERE vc.id = v.id
  );

CREATE OR REPLACE FUNCTION public.calcular_efectivo_teorico_corte(
  p_fecha_inicio TIMESTAMPTZ,
  p_fecha_fin TIMESTAMPTZ
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_efectivo_teorico DECIMAL := 0;
BEGIN
  SELECT COALESCE(SUM(v.total), 0)
  INTO v_efectivo_teorico
  FROM public.ventas_cdmx v
  WHERE v.created_at >= p_fecha_inicio
    AND v.created_at < p_fecha_fin
    AND v.metodo_pago = 'efectivo';

  RETURN v_efectivo_teorico;
END;
$$;

CREATE OR REPLACE FUNCTION public.procesar_venta_cdmx(
  p_items JSONB,
  p_metodo_pago TEXT,
  p_monto_total DECIMAL
)
RETURNS TABLE(
  success BOOLEAN,
  mensaje TEXT,
  venta_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_venta_id UUID;
  v_item JSONB;
  v_inventario_id UUID;
  v_cantidad INTEGER;
  v_precio_venta DECIMAL;
  v_precio_base DECIMAL;
  v_cantidad_disponible INTEGER;
  v_presentacion_nombre TEXT;
  v_numero_venta TEXT;
  v_validated_item RECORD;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role)) THEN
    RETURN QUERY SELECT false, 'No autorizado'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'La venta no contiene productos para procesar';
    END IF;

    CREATE TEMP TABLE IF NOT EXISTS tmp_venta_cdmx_validada (
      inventario_id UUID NOT NULL,
      cantidad INTEGER NOT NULL,
      precio_venta DECIMAL NOT NULL,
      precio_base DECIMAL NOT NULL,
      cantidad_disponible INTEGER NOT NULL,
      presentacion_nombre TEXT NOT NULL
    ) ON COMMIT DROP;

    TRUNCATE TABLE tmp_venta_cdmx_validada;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_inventario_id := NULLIF(v_item->>'inventario_id', '')::UUID;
      v_cantidad := NULLIF(v_item->>'cantidad', '')::INTEGER;
      v_precio_venta := NULLIF(v_item->>'precio_venta', '')::DECIMAL;

      IF v_inventario_id IS NULL THEN
        RAISE EXCEPTION 'Uno de los productos no tiene inventario asociado';
      END IF;

      IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
        RAISE EXCEPTION 'Cantidad invalida para inventario %', v_inventario_id;
      END IF;

      IF v_precio_venta IS NULL OR v_precio_venta <= 0 THEN
        RAISE EXCEPTION 'Precio de venta invalido para inventario %', v_inventario_id;
      END IF;

      SELECT i.precio_base, i.cantidad_disponible, p.nombre
      INTO v_precio_base, v_cantidad_disponible, v_presentacion_nombre
      FROM public.inventario_bodega_cdmx i
      JOIN public.presentaciones p ON i.presentacion_id = p.id
      WHERE i.id = v_inventario_id
      FOR UPDATE OF i;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventario CDMX no encontrado para el producto solicitado';
      END IF;

      IF v_precio_venta < v_precio_base THEN
        RAISE EXCEPTION 'Precio de venta ($%) menor al precio base ($%) para %',
          v_precio_venta,
          v_precio_base,
          v_presentacion_nombre;
      END IF;

      IF v_cantidad > v_cantidad_disponible THEN
        RAISE EXCEPTION 'Stock insuficiente para %. Disponible: %, solicitado: %',
          v_presentacion_nombre,
          v_cantidad_disponible,
          v_cantidad;
      END IF;

      INSERT INTO tmp_venta_cdmx_validada (
        inventario_id,
        cantidad,
        precio_venta,
        precio_base,
        cantidad_disponible,
        presentacion_nombre
      ) VALUES (
        v_inventario_id,
        v_cantidad,
        v_precio_venta,
        v_precio_base,
        v_cantidad_disponible,
        v_presentacion_nombre
      );
    END LOOP;

    v_numero_venta := 'VCDMX-' || TO_CHAR(clock_timestamp(), 'YYMMDD-HH24MISSMS');

    INSERT INTO public.ventas_cdmx (
      numero_venta,
      fecha_venta,
      total,
      metodo_pago,
      pagado,
      notas,
      created_by
    ) VALUES (
      v_numero_venta,
      NOW(),
      p_monto_total,
      p_metodo_pago::public.forma_pago,
      true,
      'Pago: ' || p_metodo_pago,
      auth.uid()
    ) RETURNING id INTO v_venta_id;

    FOR v_validated_item IN
      SELECT *
      FROM tmp_venta_cdmx_validada
    LOOP
      UPDATE public.inventario_bodega_cdmx
      SET cantidad_disponible = cantidad_disponible - v_validated_item.cantidad
      WHERE id = v_validated_item.inventario_id;

      INSERT INTO public.auditoria_inventario_cdmx (
        inventario_id,
        tipo_movimiento,
        cantidad,
        cantidad_antes,
        cantidad_despues,
        referencia_id,
        referencia_tipo,
        usuario_id
      ) VALUES (
        v_validated_item.inventario_id,
        'salida',
        v_validated_item.cantidad,
        v_validated_item.cantidad_disponible,
        v_validated_item.cantidad_disponible - v_validated_item.cantidad,
        v_venta_id,
        'venta',
        auth.uid()
      );

      INSERT INTO public.venta_detalles_cdmx (
        venta_id,
        inventario_id,
        descripcion,
        cantidad,
        precio_unitario
      ) VALUES (
        v_venta_id,
        v_validated_item.inventario_id,
        v_validated_item.presentacion_nombre,
        v_validated_item.cantidad,
        v_validated_item.precio_venta
      );
    END LOOP;

    RETURN QUERY SELECT true, 'Venta procesada exitosamente'::TEXT, v_venta_id;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT false, SQLERRM::TEXT, NULL::UUID;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.procesar_venta_cdmx(
  p_items JSONB,
  p_metodo_pago TEXT,
  p_monto_total DECIMAL,
  p_cliente_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  mensaje TEXT,
  venta_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.procesar_venta_cdmx(p_items, p_metodo_pago, p_monto_total);
END;
$$;

COMMENT ON TABLE public.ventas_cdmx IS 'Ventas exclusivas del POS de Bodega CDMX';
COMMENT ON TABLE public.venta_detalles_cdmx IS 'Detalle de ventas del POS de Bodega CDMX';
COMMENT ON FUNCTION public.procesar_venta_cdmx(JSONB, TEXT, DECIMAL)
IS 'Procesa venta del POS CDMX en tablas separadas, validando todo antes de afectar inventario';
COMMENT ON FUNCTION public.procesar_venta_cdmx(JSONB, TEXT, DECIMAL, UUID)
IS 'Wrapper compatible con cliente opcional para el POS CDMX separado';
