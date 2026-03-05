
-- =============================================
-- FIX 1: Restrict ventas role from modifying financial fields on clientes
-- =============================================

-- Drop the existing overly-permissive update policy
DROP POLICY IF EXISTS "Clientes can update by role" ON public.clientes;

-- Admin/Finanzas: unrestricted update
CREATE POLICY "Admin finanzas can update clientes"
ON public.clientes FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role)))
WITH CHECK (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role)));

-- Ventas: can update but a trigger will block financial field changes
CREATE POLICY "Ventas can update non-financial clientes"
ON public.clientes FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'ventas'::app_role))
WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'ventas'::app_role));

-- Trigger to block ventas from changing financial fields
CREATE OR REPLACE FUNCTION public.protect_clientes_financial_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If saldo_deudor or dias_credito is being changed, require admin or finanzas role
  IF (OLD.saldo_deudor IS DISTINCT FROM NEW.saldo_deudor OR OLD.dias_credito IS DISTINCT FROM NEW.dias_credito) THEN
    IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role)) THEN
      RAISE EXCEPTION 'No autorizado: solo admin o finanzas pueden modificar campos financieros de clientes';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_clientes_financial
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_clientes_financial_fields();

-- =============================================
-- FIX 2: Add role check and search_path to process_sale_with_inventory
-- =============================================

CREATE OR REPLACE FUNCTION public.process_sale_with_inventory(p_cliente_id uuid, p_monto_total numeric, p_metodo_pago text, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- SECURITY: Validate caller has appropriate role
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado: requiere rol admin o ventas';
  END IF;

  -- INPUT VALIDATION
  IF p_monto_total <= 0 THEN
    RAISE EXCEPTION 'Monto total debe ser positivo';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La lista de productos no puede estar vacía';
  END IF;

  -- 1. Generate Sale Number
  v_numero_venta := 'V-' || TO_CHAR(NOW(), 'YYMMDDHH24MI') || '-' || FLOOR(RANDOM() * 1000)::TEXT;

  -- 2. Create Sale Record
  INSERT INTO public.ventas (
    numero_venta, cliente_id, tipo, total, pagado, notas
  ) VALUES (
    v_numero_venta, p_cliente_id, 'pos_cdmx', p_monto_total, true, 'Pago: ' || p_metodo_pago
  ) RETURNING id INTO v_venta_id;

  -- 3. Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_presentacion_id := (v_item->>'presentacion_id')::UUID;
    v_cantidad_solicitada := (v_item->>'cantidad')::INTEGER;
    v_precio := (v_item->>'precio')::DECIMAL;
    v_cantidad_pendiente := v_cantidad_solicitada;

    -- Validate item data
    IF v_cantidad_solicitada <= 0 THEN
      RAISE EXCEPTION 'Cantidad debe ser positiva para producto %', v_presentacion_id;
    END IF;
    IF v_precio < 0 THEN
      RAISE EXCEPTION 'Precio no puede ser negativo para producto %', v_presentacion_id;
    END IF;

    -- Get product name
    SELECT nombre INTO v_nombre_producto FROM public.presentaciones WHERE id = v_presentacion_id;
    IF v_nombre_producto IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado: %', v_presentacion_id;
    END IF;

    -- 4. FIFO Inventory Deduction
    FOR v_lote_stock IN 
      SELECT cf.id, cf.cantidad_disponible 
      FROM public.camara_fria cf
      JOIN public.produccion p ON cf.produccion_id = p.id
      WHERE p.presentacion_id = v_presentacion_id
      AND cf.cantidad_disponible > 0
      ORDER BY cf.fecha_ingreso ASC
    LOOP
      DECLARE
        v_tomar_de_lote INTEGER;
      BEGIN
        v_tomar_de_lote := LEAST(v_cantidad_pendiente, v_lote_stock.cantidad_disponible);
        
        UPDATE public.camara_fria
        SET cantidad_disponible = cantidad_disponible - v_tomar_de_lote,
            updated_at = NOW()
        WHERE id = v_lote_stock.id;

        v_cantidad_pendiente := v_cantidad_pendiente - v_tomar_de_lote;

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
      venta_id, descripcion, cantidad, precio_unitario
    ) VALUES (
      v_venta_id, v_nombre_producto, v_cantidad_solicitada, v_precio
    );

  END LOOP;

  RETURN v_venta_id;
END;
$function$;
