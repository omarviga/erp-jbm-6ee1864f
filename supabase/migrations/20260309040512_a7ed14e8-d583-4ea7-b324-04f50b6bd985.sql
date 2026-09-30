-- =====================================================
-- FASE 1: SISTEMA DE TRANSFERENCIAS CDMX
-- =====================================================

-- 1. Crear tabla de transferencias de Michoacán a CDMX
CREATE TABLE IF NOT EXISTS public.transferencias_bodega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL UNIQUE,
  origen TEXT NOT NULL DEFAULT 'michoacan',
  destino TEXT NOT NULL DEFAULT 'cdmx',
  fecha_salida TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_recepcion TIMESTAMPTZ,
  estado TEXT NOT NULL DEFAULT 'en_transito' CHECK (estado IN ('en_transito', 'recibido', 'con_discrepancia')),
  chofer TEXT,
  placas TEXT,
  notas_salida TEXT,
  notas_recepcion TEXT,
  recibido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Crear tabla de detalle de transferencias
CREATE TABLE IF NOT EXISTS public.transferencia_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id UUID NOT NULL REFERENCES public.transferencias_bodega(id) ON DELETE CASCADE,
  presentacion_id UUID NOT NULL REFERENCES public.presentaciones(id),
  precio_base DECIMAL(10,2) NOT NULL CHECK (precio_base >= 0),
  precio_venta DECIMAL(10,2), -- Lo establece CDMX al recibir
  cantidad_enviada INTEGER NOT NULL CHECK (cantidad_enviada >= 0),
  cantidad_recibida INTEGER CHECK (cantidad_recibida >= 0),
  diferencia INTEGER GENERATED ALWAYS AS (COALESCE(cantidad_recibida, 0) - cantidad_enviada) STORED,
  notas_diferencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Validación: precio_venta debe ser >= precio_base
  CONSTRAINT precio_venta_valido CHECK (precio_venta IS NULL OR precio_venta >= precio_base),
  
  -- Unique constraint para evitar duplicados
  UNIQUE(transferencia_id, presentacion_id)
);

-- 3. Crear tabla de inventario CDMX (bodega)
CREATE TABLE IF NOT EXISTS public.inventario_bodega_cdmx (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id UUID NOT NULL REFERENCES public.presentaciones(id),
  transferencia_id UUID REFERENCES public.transferencias_bodega(id),
  cantidad_disponible INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
  precio_base DECIMAL(10,2) NOT NULL CHECK (precio_base >= 0),
  precio_venta DECIMAL(10,2) NOT NULL CHECK (precio_venta >= precio_base),
  fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Crear tabla de cortes de caja CDMX
CREATE TABLE IF NOT EXISTS public.cortes_caja_bodega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL UNIQUE,
  fecha_corte TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_inicio TIMESTAMPTZ NOT NULL, -- Fecha del último corte exitoso
  fecha_fin TIMESTAMPTZ NOT NULL,    -- Fecha actual del corte
  
  -- Montos calculados automáticamente
  efectivo_teorico DECIMAL(12,2) NOT NULL DEFAULT 0,
  efectivo_fisico DECIMAL(12,2), -- Lo ingresa el encargado SIN VER el teórico
  diferencia DECIMAL(12,2) GENERATED ALWAYS AS (COALESCE(efectivo_fisico, 0) - efectivo_teorico) STORED,
  
  -- Ventas totales del periodo
  total_ventas DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_efectivo DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_tarjeta DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_transferencia DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- Estado del corte
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado', 'auditado')),
  cerrado_por UUID REFERENCES auth.users(id),
  notas TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Auditoría de movimientos de inventario CDMX
CREATE TABLE IF NOT EXISTS public.auditoria_inventario_cdmx (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id UUID NOT NULL REFERENCES public.inventario_bodega_cdmx(id),
  tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste')),
  cantidad INTEGER NOT NULL,
  cantidad_antes INTEGER NOT NULL,
  cantidad_despues INTEGER NOT NULL,
  referencia_id UUID, -- ID de venta o transferencia
  referencia_tipo TEXT CHECK (referencia_tipo IN ('venta', 'transferencia', 'ajuste_manual')),
  motivo TEXT,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

CREATE INDEX idx_transferencias_estado ON public.transferencias_bodega(estado);
CREATE INDEX idx_transferencias_fecha_salida ON public.transferencias_bodega(fecha_salida);
CREATE INDEX idx_transferencia_detalles_transferencia ON public.transferencia_detalles(transferencia_id);
CREATE INDEX idx_transferencia_detalles_presentacion ON public.transferencia_detalles(presentacion_id);
CREATE INDEX idx_inventario_cdmx_presentacion ON public.inventario_bodega_cdmx(presentacion_id);
CREATE INDEX idx_inventario_cdmx_transferencia ON public.inventario_bodega_cdmx(transferencia_id);
CREATE INDEX idx_cortes_caja_fecha ON public.cortes_caja_bodega(fecha_corte);
CREATE INDEX idx_cortes_caja_estado ON public.cortes_caja_bodega(estado);
CREATE INDEX idx_auditoria_inventario ON public.auditoria_inventario_cdmx(inventario_id, created_at);

-- =====================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE TRIGGER update_transferencias_bodega_updated_at
  BEFORE UPDATE ON public.transferencias_bodega
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventario_bodega_cdmx_updated_at
  BEFORE UPDATE ON public.inventario_bodega_cdmx
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cortes_caja_bodega_updated_at
  BEFORE UPDATE ON public.cortes_caja_bodega
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNCIÓN: PROCESAR RECEPCIÓN DE TRANSFERENCIA
-- =====================================================

CREATE OR REPLACE FUNCTION public.procesar_recepcion_transferencia(
  p_transferencia_id UUID,
  p_detalles JSONB, -- Array de {presentacion_id, cantidad_recibida, precio_venta, notas_diferencia}
  p_recibido_por UUID
)
RETURNS TABLE(
  success BOOLEAN,
  mensaje TEXT,
  tiene_discrepancias BOOLEAN
) 
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
  -- Validar que la transferencia existe y está en tránsito
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

  -- Procesar cada detalle
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_presentacion_id := (v_detalle->>'presentacion_id')::UUID;
    v_cantidad_recibida := (v_detalle->>'cantidad_recibida')::INTEGER;
    v_precio_venta := (v_detalle->>'precio_venta')::DECIMAL;
    v_notas_diferencia := v_detalle->>'notas_diferencia';

    -- Obtener precio_base del detalle de transferencia
    SELECT precio_base INTO v_precio_base
    FROM public.transferencia_detalles
    WHERE transferencia_id = p_transferencia_id
    AND presentacion_id = v_presentacion_id;

    -- Validar que precio_venta >= precio_base
    IF v_precio_venta < v_precio_base THEN
      RETURN QUERY SELECT false, 
        format('Precio de venta ($%s) no puede ser menor al precio base ($%s)', v_precio_venta, v_precio_base)::TEXT, 
        false;
      RETURN;
    END IF;

    -- Actualizar detalle de transferencia
    UPDATE public.transferencia_detalles
    SET 
      cantidad_recibida = v_cantidad_recibida,
      precio_venta = v_precio_venta,
      notas_diferencia = v_notas_diferencia
    WHERE transferencia_id = p_transferencia_id
    AND presentacion_id = v_presentacion_id;

    -- Si hay diferencia, marcar discrepancia
    IF v_cantidad_recibida != (SELECT cantidad_enviada FROM public.transferencia_detalles 
                                WHERE transferencia_id = p_transferencia_id 
                                AND presentacion_id = v_presentacion_id) THEN
      v_tiene_discrepancias := true;
    END IF;

    -- Insertar en inventario CDMX (usando FIFO: cada recepción es un lote separado)
    INSERT INTO public.inventario_bodega_cdmx (
      presentacion_id,
      transferencia_id,
      cantidad_disponible,
      precio_base,
      precio_venta,
      fecha_ingreso
    ) VALUES (
      v_presentacion_id,
      p_transferencia_id,
      v_cantidad_recibida,
      v_precio_base,
      v_precio_venta,
      now()
    );

    -- Registrar en auditoría
    INSERT INTO public.auditoria_inventario_cdmx (
      inventario_id,
      tipo_movimiento,
      cantidad,
      cantidad_antes,
      cantidad_despues,
      referencia_id,
      referencia_tipo,
      motivo,
      usuario_id
    )
    SELECT 
      id,
      'entrada',
      v_cantidad_recibida,
      0,
      v_cantidad_recibida,
      p_transferencia_id,
      'transferencia',
      'Recepción de transferencia',
      p_recibido_por
    FROM public.inventario_bodega_cdmx
    WHERE transferencia_id = p_transferencia_id
    AND presentacion_id = v_presentacion_id;

  END LOOP;

  -- Actualizar estado de la transferencia
  UPDATE public.transferencias_bodega
  SET 
    estado = CASE WHEN v_tiene_discrepancias THEN 'con_discrepancia' ELSE 'recibido' END,
    fecha_recepcion = now(),
    recibido_por = p_recibido_por
  WHERE id = p_transferencia_id;

  RETURN QUERY SELECT true, 'Recepción procesada exitosamente'::TEXT, v_tiene_discrepancias;
END;
$$;

-- =====================================================
-- FUNCIÓN: CALCULAR EFECTIVO TEÓRICO PARA CORTE
-- =====================================================

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
  -- Sumar todas las ventas en efectivo del periodo
  -- Solo considera ventas tipo 'pos_cdmx'
  SELECT COALESCE(SUM(v.total), 0)
  INTO v_efectivo_teorico
  FROM public.ventas v
  WHERE v.tipo = 'pos_cdmx'
  AND v.created_at >= p_fecha_inicio
  AND v.created_at < p_fecha_fin
  AND EXISTS (
    SELECT 1 FROM public.pagos_clientes pc
    WHERE pc.venta_id = v.id
    AND pc.forma_pago = 'efectivo'
  );

  RETURN v_efectivo_teorico;
END;
$$;

-- =====================================================
-- FUNCIÓN: PROCESAR VENTA CDMX CON VALIDACIÓN DE PRECIOS
-- =====================================================

CREATE OR REPLACE FUNCTION public.procesar_venta_cdmx(
  p_items JSONB, -- [{inventario_id, cantidad, precio_venta}]
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
BEGIN
  -- Validar rol del usuario
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ventas'::app_role)) THEN
    RETURN QUERY SELECT false, 'No autorizado'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Generar número de venta
  v_numero_venta := 'VCDMX-' || TO_CHAR(NOW(), 'YYMMDD-HH24MISS');

  -- Crear registro de venta
  INSERT INTO public.ventas (
    numero_venta,
    tipo,
    total,
    pagado,
    notas
  ) VALUES (
    v_numero_venta,
    'pos_cdmx',
    p_monto_total,
    true,
    'Pago: ' || p_metodo_pago
  ) RETURNING id INTO v_venta_id;

  -- Procesar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_inventario_id := (v_item->>'inventario_id')::UUID;
    v_cantidad := (v_item->>'cantidad')::INTEGER;
    v_precio_venta := (v_item->>'precio_venta')::DECIMAL;

    -- Obtener datos del inventario
    SELECT 
      precio_base,
      cantidad_disponible,
      p.nombre
    INTO v_precio_base, v_cantidad_disponible, v_presentacion_nombre
    FROM public.inventario_bodega_cdmx i
    JOIN public.presentaciones p ON i.presentacion_id = p.id
    WHERE i.id = v_inventario_id;

    -- Validación 1: Precio de venta >= precio base
    IF v_precio_venta < v_precio_base THEN
      RETURN QUERY SELECT false, 
        format('Precio de venta ($%s) menor al precio base ($%s) para %s', 
               v_precio_venta, v_precio_base, v_presentacion_nombre)::TEXT,
        NULL::UUID;
      RETURN;
    END IF;

    -- Validación 2: Stock disponible
    IF v_cantidad > v_cantidad_disponible THEN
      RETURN QUERY SELECT false,
        format('Stock insuficiente para %s. Disponible: %s, Solicitado: %s',
               v_presentacion_nombre, v_cantidad_disponible, v_cantidad)::TEXT,
        NULL::UUID;
      RETURN;
    END IF;

    -- Descontar inventario
    UPDATE public.inventario_bodega_cdmx
    SET cantidad_disponible = cantidad_disponible - v_cantidad
    WHERE id = v_inventario_id;

    -- Registrar auditoría
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

    -- Crear detalle de venta
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

  -- Registrar pago
  INSERT INTO public.pagos_clientes (
    cliente_id,
    venta_id,
    monto,
    forma_pago
  ) VALUES (
    NULL, -- Venta directa sin cliente
    v_venta_id,
    p_monto_total,
    p_metodo_pago::forma_pago
  );

  RETURN QUERY SELECT true, 'Venta procesada exitosamente'::TEXT, v_venta_id;
END;
$$;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas nuevas
ALTER TABLE public.transferencias_bodega ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencia_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_bodega_cdmx ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cortes_caja_bodega ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_inventario_cdmx ENABLE ROW LEVEL SECURITY;

-- TRANSFERENCIAS: Admin y Ventas pueden ver, solo Admin puede crear
CREATE POLICY "Admin y Ventas pueden ver transferencias"
ON public.transferencias_bodega FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ventas'::app_role) OR
  has_role(auth.uid(), 'almacen'::app_role)
);

CREATE POLICY "Solo Admin puede crear transferencias"
ON public.transferencias_bodega FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Solo Admin puede actualizar transferencias"
ON public.transferencias_bodega FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- TRANSFERENCIA DETALLES
CREATE POLICY "Ver detalles de transferencias"
ON public.transferencia_detalles FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ventas'::app_role) OR
  has_role(auth.uid(), 'almacen'::app_role)
);

CREATE POLICY "Admin puede gestionar detalles transferencia"
ON public.transferencia_detalles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- INVENTARIO CDMX: Solo lectura para ventas
CREATE POLICY "Ver inventario CDMX"
ON public.inventario_bodega_cdmx FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ventas'::app_role) OR
  has_role(auth.uid(), 'almacen'::app_role)
);

CREATE POLICY "Solo funciones pueden modificar inventario CDMX"
ON public.inventario_bodega_cdmx FOR INSERT
WITH CHECK (false); -- Solo via funciones SECURITY DEFINER

CREATE POLICY "Solo funciones pueden actualizar inventario CDMX"
ON public.inventario_bodega_cdmx FOR UPDATE
USING (false); -- Solo via funciones SECURITY DEFINER

-- CORTES DE CAJA: Solo Admin puede ver y gestionar
CREATE POLICY "Admin puede ver cortes de caja"
ON public.cortes_caja_bodega FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin puede crear cortes de caja"
ON public.cortes_caja_bodega FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin puede actualizar cortes de caja"
ON public.cortes_caja_bodega FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- AUDITORÍA: Solo lectura para admin
CREATE POLICY "Admin puede ver auditoría"
ON public.auditoria_inventario_cdmx FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE public.transferencias_bodega IS 'Transferencias de inventario de Michoacán a CDMX';
COMMENT ON TABLE public.transferencia_detalles IS 'Detalle de productos en cada transferencia con cotejo de cantidades';
COMMENT ON TABLE public.inventario_bodega_cdmx IS 'Inventario físico en bodega CDMX con precios base y venta';
COMMENT ON TABLE public.cortes_caja_bodega IS 'Cortes de caja ciegos de la bodega CDMX';
COMMENT ON TABLE public.auditoria_inventario_cdmx IS 'Auditoría de todos los movimientos de inventario en CDMX';
COMMENT ON FUNCTION public.procesar_recepcion_transferencia IS 'Procesa la recepción de transferencia con cotejo ciego';
COMMENT ON FUNCTION public.calcular_efectivo_teorico_corte IS 'Calcula el efectivo teórico para un corte de caja';
COMMENT ON FUNCTION public.procesar_venta_cdmx IS 'Procesa venta CDMX con validación de precios y actualización de inventario';