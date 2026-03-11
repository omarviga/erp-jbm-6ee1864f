-- Hace atomica la venta del POS CDMX para evitar registros parciales
-- y mantiene la separacion en tablas propias de CDMX.

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

COMMENT ON FUNCTION public.procesar_venta_cdmx(JSONB, TEXT, DECIMAL)
IS 'Procesa venta del POS CDMX en tablas separadas, validando todo antes de afectar inventario';

COMMENT ON FUNCTION public.procesar_venta_cdmx(JSONB, TEXT, DECIMAL, UUID)
IS 'Wrapper compatible con cliente opcional para el POS CDMX separado';
