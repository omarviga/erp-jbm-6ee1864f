ALTER TABLE public.inventario_bodega_cdmx
  ALTER COLUMN cantidad_disponible TYPE DECIMAL(12,2)
  USING cantidad_disponible::DECIMAL(12,2);

ALTER TABLE public.auditoria_inventario_cdmx
  ALTER COLUMN cantidad TYPE DECIMAL(12,2)
  USING cantidad::DECIMAL(12,2),
  ALTER COLUMN cantidad_antes TYPE DECIMAL(12,2)
  USING cantidad_antes::DECIMAL(12,2),
  ALTER COLUMN cantidad_despues TYPE DECIMAL(12,2)
  USING cantidad_despues::DECIMAL(12,2);

ALTER TABLE public.venta_detalles
  DROP COLUMN subtotal;

ALTER TABLE public.venta_detalles
  ALTER COLUMN cantidad TYPE DECIMAL(12,2)
  USING cantidad::DECIMAL(12,2);

ALTER TABLE public.venta_detalles
  ADD COLUMN subtotal DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED;

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
  v_cantidad DECIMAL(12,2);
  v_precio_venta DECIMAL(10,2);
  v_precio_base DECIMAL(10,2);
  v_cantidad_disponible DECIMAL(12,2);
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
    v_cantidad := (v_item->>'cantidad')::DECIMAL;
    v_precio_venta := (v_item->>'precio_venta')::DECIMAL;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RETURN QUERY SELECT false, 'La cantidad de venta debe ser mayor a cero'::TEXT, NULL::UUID;
      RETURN;
    END IF;

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

CREATE OR REPLACE FUNCTION public.convertir_presentacion_a_granel_cdmx(
  p_presentacion_id UUID,
  p_cajas DECIMAL,
  p_precio_venta_kg DECIMAL DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  mensaje TEXT,
  presentacion_granel_id UUID,
  kilos_convertidos DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_presentacion RECORD;
  v_granel_id UUID;
  v_existencia_total DECIMAL(12,2);
  v_cajas_pendientes DECIMAL(12,2);
  v_total_kilos DECIMAL(12,2) := 0;
  v_fila_inventario RECORD;
  v_cajas_a_convertir DECIMAL(12,2);
  v_kilos_generados DECIMAL(12,2);
  v_precio_base_kg DECIMAL(10,2);
  v_precio_venta_final_kg DECIMAL(10,2);
  v_inventario_granel_id UUID;
  v_nombre_granel TEXT;
BEGIN
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  ) THEN
    RETURN QUERY SELECT false, 'No autorizado para convertir producto a granel'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  IF p_cajas IS NULL OR p_cajas <= 0 OR p_cajas <> trunc(p_cajas) THEN
    RETURN QUERY SELECT false, 'La apertura a granel debe hacerse por cajas completas'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  SELECT id, nombre, tipo, peso_kg
  INTO v_presentacion
  FROM public.presentaciones
  WHERE id = p_presentacion_id;

  IF v_presentacion.id IS NULL THEN
    RETURN QUERY SELECT false, 'La presentación origen no existe'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  IF LOWER(v_presentacion.tipo) LIKE '%granel%' THEN
    RETURN QUERY SELECT false, 'La presentación ya es granel'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  IF LOWER(v_presentacion.tipo) LIKE '%arpilla%' THEN
    RETURN QUERY SELECT false, 'Solo se pueden abrir cajas para venta a granel'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  IF COALESCE(v_presentacion.peso_kg, 0) <= 0 THEN
    RETURN QUERY SELECT false, 'La presentación origen no tiene peso válido para convertir'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cantidad_disponible), 0)
  INTO v_existencia_total
  FROM public.inventario_bodega_cdmx
  WHERE presentacion_id = p_presentacion_id
    AND cantidad_disponible > 0;

  IF v_existencia_total < p_cajas THEN
    RETURN QUERY SELECT false,
      format('No hay suficientes cajas para convertir. Disponible: %s, solicitado: %s', v_existencia_total, p_cajas)::TEXT,
      NULL::UUID,
      0::DECIMAL;
    RETURN;
  END IF;

  v_nombre_granel := 'Limon a granel';

  INSERT INTO public.presentaciones (nombre, peso_kg, tipo, activa)
  SELECT v_nombre_granel, 1.0, 'granel', true
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.presentaciones
    WHERE LOWER(nombre) = LOWER(v_nombre_granel)
  )
  RETURNING id INTO v_granel_id;

  IF v_granel_id IS NULL THEN
    SELECT id
    INTO v_granel_id
    FROM public.presentaciones
    WHERE LOWER(nombre) = LOWER(v_nombre_granel)
    LIMIT 1;
  END IF;

  v_cajas_pendientes := p_cajas;

  FOR v_fila_inventario IN
    SELECT id, transferencia_id, cantidad_disponible, precio_base, precio_venta
    FROM public.inventario_bodega_cdmx
    WHERE presentacion_id = p_presentacion_id
      AND cantidad_disponible > 0
    ORDER BY fecha_ingreso ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_cajas_pendientes <= 0;

    v_cajas_a_convertir := LEAST(v_cajas_pendientes, v_fila_inventario.cantidad_disponible);
    v_kilos_generados := ROUND(v_cajas_a_convertir * v_presentacion.peso_kg, 2);
    v_precio_base_kg := ROUND(v_fila_inventario.precio_base / NULLIF(v_presentacion.peso_kg, 0), 2);
    v_precio_venta_final_kg := GREATEST(
      COALESCE(p_precio_venta_kg, ROUND(v_fila_inventario.precio_venta / NULLIF(v_presentacion.peso_kg, 0), 2)),
      v_precio_base_kg
    );

    UPDATE public.inventario_bodega_cdmx
    SET cantidad_disponible = cantidad_disponible - v_cajas_a_convertir
    WHERE id = v_fila_inventario.id;

    INSERT INTO public.auditoria_inventario_cdmx (
      inventario_id,
      tipo_movimiento,
      cantidad,
      cantidad_antes,
      cantidad_despues,
      referencia_tipo,
      motivo,
      usuario_id
    ) VALUES (
      v_fila_inventario.id,
      'ajuste',
      v_cajas_a_convertir,
      v_fila_inventario.cantidad_disponible,
      v_fila_inventario.cantidad_disponible - v_cajas_a_convertir,
      'ajuste_manual',
      'Apertura de cajas para venta a granel',
      auth.uid()
    );

    INSERT INTO public.inventario_bodega_cdmx (
      presentacion_id,
      transferencia_id,
      cantidad_disponible,
      precio_base,
      precio_venta,
      fecha_ingreso
    ) VALUES (
      v_granel_id,
      v_fila_inventario.transferencia_id,
      v_kilos_generados,
      v_precio_base_kg,
      v_precio_venta_final_kg,
      now()
    ) RETURNING id INTO v_inventario_granel_id;

    INSERT INTO public.auditoria_inventario_cdmx (
      inventario_id,
      tipo_movimiento,
      cantidad,
      cantidad_antes,
      cantidad_despues,
      referencia_tipo,
      motivo,
      usuario_id
    ) VALUES (
      v_inventario_granel_id,
      'entrada',
      v_kilos_generados,
      0,
      v_kilos_generados,
      'ajuste_manual',
      format('Conversión a granel desde %s', v_presentacion.nombre),
      auth.uid()
    );

    v_total_kilos := v_total_kilos + v_kilos_generados;
    v_cajas_pendientes := v_cajas_pendientes - v_cajas_a_convertir;
  END LOOP;

  IF v_cajas_pendientes > 0 THEN
    RETURN QUERY SELECT false, 'No fue posible completar la conversión por concurrencia de inventario'::TEXT, NULL::UUID, v_total_kilos;
    RETURN;
  END IF;

  RETURN QUERY SELECT true,
    format('%s cajas convertidas a %s kg de granel', p_cajas, v_total_kilos)::TEXT,
    v_granel_id,
    v_total_kilos;
END;
$$;

COMMENT ON FUNCTION public.convertir_presentacion_a_granel_cdmx IS 'Abre cajas del inventario CDMX y las convierte en kilos para venta a granel.';

CREATE OR REPLACE FUNCTION public.registrar_merma_granel_cdmx(
  p_presentacion_id UUID,
  p_kilos DECIMAL,
  p_motivo TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  mensaje TEXT,
  kilos_mermados DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_presentacion RECORD;
  v_existencia_total DECIMAL(12,2);
  v_kilos_pendientes DECIMAL(12,2);
  v_fila_inventario RECORD;
  v_kilos_a_mermar DECIMAL(12,2);
BEGIN
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
  ) THEN
    RETURN QUERY SELECT false, 'No autorizado para registrar merma de granel'::TEXT, 0::DECIMAL;
    RETURN;
  END IF;

  IF p_kilos IS NULL OR p_kilos <= 0 THEN
    RETURN QUERY SELECT false, 'Los kilos de merma deben ser mayores a cero'::TEXT, 0::DECIMAL;
    RETURN;
  END IF;

  IF COALESCE(TRIM(p_motivo), '') = '' THEN
    RETURN QUERY SELECT false, 'Debes indicar el motivo de la merma'::TEXT, 0::DECIMAL;
    RETURN;
  END IF;

  SELECT id, nombre, tipo
  INTO v_presentacion
  FROM public.presentaciones
  WHERE id = p_presentacion_id;

  IF v_presentacion.id IS NULL THEN
    RETURN QUERY SELECT false, 'La presentación de granel no existe'::TEXT, 0::DECIMAL;
    RETURN;
  END IF;

  IF LOWER(v_presentacion.tipo) NOT LIKE '%granel%' THEN
    RETURN QUERY SELECT false, 'La merma solo aplica a inventario granel'::TEXT, 0::DECIMAL;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cantidad_disponible), 0)
  INTO v_existencia_total
  FROM public.inventario_bodega_cdmx
  WHERE presentacion_id = p_presentacion_id
    AND cantidad_disponible > 0;

  IF v_existencia_total < p_kilos THEN
    RETURN QUERY SELECT false,
      format('No hay suficiente inventario granel. Disponible: %s kg, solicitado: %s kg', v_existencia_total, p_kilos)::TEXT,
      0::DECIMAL;
    RETURN;
  END IF;

  v_kilos_pendientes := p_kilos;

  FOR v_fila_inventario IN
    SELECT id, cantidad_disponible
    FROM public.inventario_bodega_cdmx
    WHERE presentacion_id = p_presentacion_id
      AND cantidad_disponible > 0
    ORDER BY fecha_ingreso ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_kilos_pendientes <= 0;

    v_kilos_a_mermar := LEAST(v_kilos_pendientes, v_fila_inventario.cantidad_disponible);

    UPDATE public.inventario_bodega_cdmx
    SET cantidad_disponible = cantidad_disponible - v_kilos_a_mermar
    WHERE id = v_fila_inventario.id;

    INSERT INTO public.auditoria_inventario_cdmx (
      inventario_id,
      tipo_movimiento,
      cantidad,
      cantidad_antes,
      cantidad_despues,
      referencia_tipo,
      motivo,
      usuario_id
    ) VALUES (
      v_fila_inventario.id,
      'ajuste',
      v_kilos_a_mermar,
      v_fila_inventario.cantidad_disponible,
      v_fila_inventario.cantidad_disponible - v_kilos_a_mermar,
      'ajuste_manual',
      'Merma granel: ' || TRIM(p_motivo),
      auth.uid()
    );

    v_kilos_pendientes := v_kilos_pendientes - v_kilos_a_mermar;
  END LOOP;

  IF v_kilos_pendientes > 0 THEN
    RETURN QUERY SELECT false, 'No fue posible completar la merma por concurrencia de inventario'::TEXT, p_kilos - v_kilos_pendientes;
    RETURN;
  END IF;

  RETURN QUERY SELECT true,
    format('Merma registrada por %s kg en %s', p_kilos, v_presentacion.nombre)::TEXT,
    p_kilos;
END;
$$;

COMMENT ON FUNCTION public.registrar_merma_granel_cdmx IS 'Registra baja por merma sobre inventario granel en CDMX.';
