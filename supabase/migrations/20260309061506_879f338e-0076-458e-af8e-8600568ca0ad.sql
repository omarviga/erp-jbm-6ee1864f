
-- 1. Make gastos-tickets bucket private
UPDATE storage.buckets SET public = false WHERE id = 'gastos-tickets';

-- 2. Fix notificaciones INSERT policy: replace WITH CHECK (true) with authenticated check
DROP POLICY IF EXISTS "Sistema puede crear notificaciones" ON public.notificaciones;
CREATE POLICY "Sistema puede crear notificaciones"
  ON public.notificaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Fix procesar_recepcion_transferencia: add role check and force auth.uid()
CREATE OR REPLACE FUNCTION public.procesar_recepcion_transferencia(
  p_transferencia_id uuid, p_detalles jsonb, p_recibido_por uuid
)
RETURNS TABLE(success boolean, mensaje text, tiene_discrepancias boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_detalle JSONB;
  v_presentacion_id UUID;
  v_cantidad_recibida INTEGER;
  v_precio_venta DECIMAL;
  v_precio_base DECIMAL;
  v_notas_diferencia TEXT;
  v_tiene_discrepancias BOOLEAN := false;
  v_estado_transferencia TEXT;
BEGIN
  -- SECURITY: Role check
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role)) THEN
    RETURN QUERY SELECT false, 'No autorizado: requiere rol admin o almacen'::TEXT, false;
    RETURN;
  END IF;

  -- SECURITY: Force p_recibido_por to actual caller
  p_recibido_por := auth.uid();

  -- Validate transfer exists and is in transit
  SELECT estado INTO v_estado_transferencia
  FROM public.transferencias_bodega
  WHERE id = p_transferencia_id;

  IF v_estado_transferencia IS NULL THEN
    RETURN QUERY SELECT false, 'Transferencia no encontrada'::TEXT, false;
    RETURN;
  END IF;

  IF v_estado_transferencia != 'en_transito' THEN
    RETURN QUERY SELECT false, 'Transferencia ya fue procesada'::TEXT, false;
    RETURN;
  END IF;

  -- Process each detail
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_presentacion_id := (v_detalle->>'presentacion_id')::UUID;
    v_cantidad_recibida := (v_detalle->>'cantidad_recibida')::INTEGER;
    v_precio_venta := (v_detalle->>'precio_venta')::DECIMAL;
    v_notas_diferencia := v_detalle->>'notas_diferencia';

    SELECT precio_base INTO v_precio_base
    FROM public.transferencia_detalles
    WHERE transferencia_id = p_transferencia_id
    AND presentacion_id = v_presentacion_id;

    IF v_precio_venta < v_precio_base THEN
      RETURN QUERY SELECT false, 
        format('Precio de venta ($%s) no puede ser menor al precio base ($%s)', v_precio_venta, v_precio_base)::TEXT, 
        false;
      RETURN;
    END IF;

    UPDATE public.transferencia_detalles
    SET 
      cantidad_recibida = v_cantidad_recibida,
      precio_venta = v_precio_venta,
      notas_diferencia = v_notas_diferencia
    WHERE transferencia_id = p_transferencia_id
    AND presentacion_id = v_presentacion_id;

    IF v_cantidad_recibida != (SELECT cantidad_enviada FROM public.transferencia_detalles 
                                WHERE transferencia_id = p_transferencia_id 
                                AND presentacion_id = v_presentacion_id) THEN
      v_tiene_discrepancias := true;
    END IF;

    INSERT INTO public.inventario_bodega_cdmx (
      presentacion_id, transferencia_id, cantidad_disponible,
      precio_base, precio_venta, fecha_ingreso
    ) VALUES (
      v_presentacion_id, p_transferencia_id, v_cantidad_recibida,
      v_precio_base, v_precio_venta, now()
    );

    INSERT INTO public.auditoria_inventario_cdmx (
      inventario_id, tipo_movimiento, cantidad, cantidad_antes,
      cantidad_despues, referencia_id, referencia_tipo, motivo, usuario_id
    )
    SELECT id, 'entrada', v_cantidad_recibida, 0, v_cantidad_recibida,
      p_transferencia_id, 'transferencia', 'Recepción de transferencia', p_recibido_por
    FROM public.inventario_bodega_cdmx
    WHERE transferencia_id = p_transferencia_id
    AND presentacion_id = v_presentacion_id;
  END LOOP;

  UPDATE public.transferencias_bodega
  SET 
    estado = CASE WHEN v_tiene_discrepancias THEN 'con_discrepancia' ELSE 'recibido' END,
    fecha_recepcion = now(),
    recibido_por = p_recibido_por
  WHERE id = p_transferencia_id;

  RETURN QUERY SELECT true, 'Recepción procesada exitosamente'::TEXT, v_tiene_discrepancias;
END;
$$;
