-- Evita sobreventa en POS CDMX bloqueando la fila de inventario antes de descontar existencias.

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
  v_cliente_id_final UUID;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role)) THEN
    RETURN QUERY SELECT false, 'No autorizado'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  v_cliente_id_final := p_cliente_id;

  IF v_cliente_id_final IS NULL THEN
    SELECT id INTO v_cliente_id_final
    FROM public.clientes
    WHERE LOWER(TRIM(nombre)) IN ('público en general', 'publico en general')
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_cliente_id_final IS NULL THEN
    RETURN QUERY SELECT false, 'No existe cliente válido para registrar la venta POS'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  v_numero_venta := 'VCDMX-' || TO_CHAR(NOW(), 'YYMMDD-HH24MISS');

  INSERT INTO public.ventas (
    numero_venta,
    cliente_id,
    tipo,
    total,
    pagado,
    notas
  ) VALUES (
    v_numero_venta,
    v_cliente_id_final,
    'pos_cdmx',
    p_monto_total,
    true,
    'Pago: ' || p_metodo_pago
  ) RETURNING id INTO v_venta_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_inventario_id := (v_item->>'inventario_id')::UUID;
    v_cantidad := (v_item->>'cantidad')::INTEGER;
    v_precio_venta := (v_item->>'precio_venta')::DECIMAL;

    SELECT i.precio_base, i.cantidad_disponible, p.nombre
    INTO v_precio_base, v_cantidad_disponible, v_presentacion_nombre
    FROM public.inventario_bodega_cdmx i
    JOIN public.presentaciones p ON i.presentacion_id = p.id
    WHERE i.id = v_inventario_id
    FOR UPDATE;

    IF v_precio_base IS NULL THEN
      RETURN QUERY SELECT false,
        format('No existe el inventario seleccionado para %s', COALESCE(v_inventario_id::TEXT, 'N/D'))::TEXT,
        NULL::UUID;
      RETURN;
    END IF;

    IF v_precio_venta < v_precio_base THEN
      RETURN QUERY SELECT false,
        format('Precio de venta ($%s) menor al precio base ($%s) para %s', v_precio_venta, v_precio_base, v_presentacion_nombre)::TEXT,
        NULL::UUID;
      RETURN;
    END IF;

    IF v_cantidad > v_cantidad_disponible THEN
      RETURN QUERY SELECT false,
        format('Stock insuficiente para %s. Disponible: %s, Solicitado: %s', v_presentacion_nombre, v_cantidad_disponible, v_cantidad)::TEXT,
        NULL::UUID;
      RETURN;
    END IF;

    UPDATE public.inventario_bodega_cdmx
    SET cantidad_disponible = cantidad_disponible - v_cantidad
    WHERE id = v_inventario_id;

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
      v_inventario_id,
      'salida',
      v_cantidad,
      v_cantidad_disponible,
      v_cantidad_disponible - v_cantidad,
      v_venta_id,
      'venta',
      auth.uid()
    );

    INSERT INTO public.venta_detalles (
      venta_id,
      descripcion,
      cantidad,
      precio_unitario
    ) VALUES (
      v_venta_id,
      v_presentacion_nombre,
      v_cantidad,
      v_precio_venta
    );
  END LOOP;

  INSERT INTO public.pagos_clientes (
    cliente_id,
    venta_id,
    monto,
    forma_pago
  ) VALUES (
    v_cliente_id_final,
    v_venta_id,
    p_monto_total,
    p_metodo_pago::forma_pago
  );

  RETURN QUERY SELECT true, 'Venta procesada exitosamente'::TEXT, v_venta_id;
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
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.procesar_venta_cdmx(p_items, p_metodo_pago, p_monto_total, NULL::UUID);
END;
$$;
