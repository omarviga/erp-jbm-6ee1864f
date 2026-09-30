-- Function to process a sale and deduct inventory using FIFO strategy
CREATE OR REPLACE FUNCTION public.process_sale_with_inventory(
  p_cliente_id UUID,
  p_monto_total DECIMAL,
  p_metodo_pago TEXT,
  p_items JSONB -- Array of objects: { "presentacion_id": uuid, "cantidad": int, "precio": decimal }
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venta_id UUID;
  v_item JSONB;
  v_presentacion_id UUID;
  v_cantidad_solicitada INTEGER;
  v_cantidad_pendiente INTEGER;
  v_precio DECIMAL;
  v_lote_stock RECORD;
  v_numero_venta TEXT;
  v_nombre_producto TEXT;
BEGIN
  -- 1. Generate Sale Number (Simple timestamp based for now, can be improved)
  v_numero_venta := 'V-' || TO_CHAR(NOW(), 'YYMMDDHH24MI') || '-' || FLOOR(RANDOM() * 1000)::TEXT;

  -- 2. Create Sale Record
  INSERT INTO public.ventas (
    numero_venta,
    cliente_id,
    tipo,
    total,
    pagado,
    notas
  ) VALUES (
    v_numero_venta,
    p_cliente_id,
    'pos_cdmx',
    p_monto_total,
    true, -- POS sales are paid immediately
    'Pago: ' || p_metodo_pago
  ) RETURNING id INTO v_venta_id;

  -- 3. Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_presentacion_id := (v_item->>'presentacion_id')::UUID;
    v_cantidad_solicitada := (v_item->>'cantidad')::INTEGER;
    v_precio := (v_item->>'precio')::DECIMAL;
    v_cantidad_pendiente := v_cantidad_solicitada;
    
    -- Get product name for detail record
    SELECT nombre INTO v_nombre_producto FROM public.presentaciones WHERE id = v_presentacion_id;

    -- 4. FIFO Inventory Deduction
    -- Find available stock in Cold Room for this presentation, ordered by entry date (oldest first)
    FOR v_lote_stock IN 
      SELECT cf.id, cf.cantidad_disponible 
      FROM public.camara_fria cf
      JOIN public.produccion p ON cf.produccion_id = p.id
      WHERE p.presentacion_id = v_presentacion_id
      AND cf.cantidad_disponible > 0
      ORDER BY cf.fecha_ingreso ASC
    LOOP
      -- Calculate how much to take from this batch
      DECLARE
        v_tomar_de_lote INTEGER;
      BEGIN
        v_tomar_de_lote := LEAST(v_cantidad_pendiente, v_lote_stock.cantidad_disponible);
        
        -- Update stock
        UPDATE public.camara_fria
        SET cantidad_disponible = cantidad_disponible - v_tomar_de_lote,
            updated_at = NOW()
        WHERE id = v_lote_stock.id;

        -- Decrease pending amount
        v_cantidad_pendiente := v_cantidad_pendiente - v_tomar_de_lote;

        -- If satisfied, exit loop
        IF v_cantidad_pendiente <= 0 THEN
          EXIT;
        END IF;
      END;
    END LOOP;

    -- 5. Validate sufficient stock
    IF v_cantidad_pendiente > 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto: %. Faltan % unidades.', v_nombre_producto, v_cantidad_pendiente;
    END IF;

    -- 6. Create Detail Record
    INSERT INTO public.venta_detalles (
      venta_id,
      descripcion,
      cantidad,
      precio_unitario
    ) VALUES (
      v_venta_id,
      v_nombre_producto,
      v_cantidad_solicitada,
      v_precio
    );

  END LOOP;

  RETURN v_venta_id;
END;
$$;
