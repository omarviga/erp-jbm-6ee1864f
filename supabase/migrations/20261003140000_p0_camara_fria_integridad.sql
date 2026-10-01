-- P0 cámara fría: integridad de inventario + trazabilidad kardex.
--
-- 1. public.camara_fria: CHECK cantidad_disponible/cantidad_cajas >= 0.
--    Hoy no existe (solo bodega_cdmx lo tiene) y los fallbacks cliente
--    read-modify-write podían dejar negativos silenciosos.
-- 2. public.trasladar_a_camara_fria: la rama ELSE/suma solo incrementaba
--    cantidad_disponible y nunca cantidad_cajas (descuadre total vs
--    disponible). Además 20260320130000 revirtió por accidente las
--    validaciones de 20260309113000 (FOR UPDATE, destino piso_empaque,
--    cantidad válida). Esta definición fusiona: gate por rol (harden) +
--    validaciones restauradas + suma de ambas columnas.
-- 3. public.inventario_kardex: columnas produccion_id/camara_fria_id con FK
--    ON DELETE SET NULL (bitácora append-only: sobrevive al borrado del
--    origen) + CHECK de signo por tipo_movimiento. Los 4 RPCs de cámara
--    ahora pueblan ambas columnas.
--
-- Nota de despliegue: si algún ADD CONSTRAINT falla, hay filas legacy que
-- violan la regla (negativos o signos invertidos). Conciliar esas filas
-- primero y reintentar; no omitir el constraint.
-- Pendiente (fuera de P0): ligar kardex envio_cdmx con su transferencia
-- (transferencias_bodega se crea después del insert de kardex).

-- =========================
-- 1) CHECKs camara_fria
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'camara_fria_disponible_no_negativo') THEN
    ALTER TABLE public.camara_fria
      ADD CONSTRAINT camara_fria_disponible_no_negativo CHECK (cantidad_disponible >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'camara_fria_cajas_no_negativo') THEN
    ALTER TABLE public.camara_fria
      ADD CONSTRAINT camara_fria_cajas_no_negativo CHECK (cantidad_cajas >= 0);
  END IF;
END
$$;

-- =========================
-- 2) Kardex: FKs + signo
-- =========================
ALTER TABLE public.inventario_kardex ADD COLUMN IF NOT EXISTS produccion_id UUID;
ALTER TABLE public.inventario_kardex ADD COLUMN IF NOT EXISTS camara_fria_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_kardex_produccion_id_fkey') THEN
    ALTER TABLE public.inventario_kardex
      ADD CONSTRAINT inventario_kardex_produccion_id_fkey
      FOREIGN KEY (produccion_id) REFERENCES public.produccion(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_kardex_camara_fria_id_fkey') THEN
    ALTER TABLE public.inventario_kardex
      ADD CONSTRAINT inventario_kardex_camara_fria_id_fkey
      FOREIGN KEY (camara_fria_id) REFERENCES public.camara_fria(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_kardex_cantidad_signo_check') THEN
    ALTER TABLE public.inventario_kardex
      ADD CONSTRAINT inventario_kardex_cantidad_signo_check CHECK (
        (tipo_movimiento IN ('entrada_produccion', 'traslado_interno') AND cantidad > 0)
        OR (tipo_movimiento IN ('salida_venta', 'envio_cdmx', 'baja_merma') AND cantidad < 0)
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS inventario_kardex_produccion_id_idx ON public.inventario_kardex(produccion_id);
CREATE INDEX IF NOT EXISTS inventario_kardex_camara_fria_id_idx ON public.inventario_kardex(camara_fria_id);

-- =========================
-- 3) trasladar_a_camara_fria (fix + validaciones restauradas)
-- =========================
DROP FUNCTION IF EXISTS public.trasladar_a_camara_fria(UUID, UUID, NUMERIC, UUID);
CREATE OR REPLACE FUNCTION public.trasladar_a_camara_fria(
  p_produccion_id UUID,
  p_lote_id UUID,
  p_cantidad NUMERIC,
  p_usuario_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_destino_actual destino_produccion;
  v_cantidad_actual INTEGER;
  v_camara_id UUID;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT destino, cantidad_cajas
  INTO v_destino_actual, v_cantidad_actual
  FROM public.produccion
  WHERE id = p_produccion_id
  FOR UPDATE;

  IF v_destino_actual IS NULL THEN
    RAISE EXCEPTION 'Producción no encontrada para traslado interno.';
  END IF;

  IF v_destino_actual <> 'piso_empaque' THEN
    RAISE EXCEPTION 'El lote no está en Piso Empaque, destino actual: %.', v_destino_actual;
  END IF;

  IF p_cantidad <= 0 OR p_cantidad > v_cantidad_actual THEN
    RAISE EXCEPTION 'Cantidad inválida para traslado. Disponible: % cajas.', v_cantidad_actual;
  END IF;

  UPDATE public.produccion
  SET destino = 'camara_fria'
  WHERE id = p_produccion_id;

  SELECT id INTO v_camara_id
  FROM public.camara_fria
  WHERE produccion_id = p_produccion_id
  FOR UPDATE;

  IF v_camara_id IS NULL THEN
    INSERT INTO public.camara_fria (produccion_id, cantidad_cajas, cantidad_disponible)
    VALUES (p_produccion_id, p_cantidad::INTEGER, p_cantidad::INTEGER)
    RETURNING id INTO v_camara_id;
  ELSE
    UPDATE public.camara_fria
    SET cantidad_cajas = cantidad_cajas + p_cantidad,
        cantidad_disponible = cantidad_disponible + p_cantidad,
        updated_at = now()
    WHERE id = v_camara_id;
  END IF;

  INSERT INTO public.inventario_kardex (
    lote_id, produccion_id, camara_fria_id, tipo_movimiento, cantidad,
    ubicacion_origen, ubicacion_destino, usuario_id
  ) VALUES (
    p_lote_id, p_produccion_id, v_camara_id, 'traslado_interno', p_cantidad,
    'piso_empaque', 'camara_fria', p_usuario_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trasladar_a_camara_fria(UUID, UUID, NUMERIC, UUID) TO authenticated;

-- =========================
-- 4) registrar_baja_merma (kardex ligado + guard de fila inexistente)
-- =========================
DROP FUNCTION IF EXISTS public.registrar_baja_merma(UUID, UUID, NUMERIC, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.registrar_baja_merma(
  p_registro_camara_id UUID,
  p_lote_id UUID,
  p_cantidad_mermada NUMERIC,
  p_motivo TEXT,
  p_usuario_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_actual NUMERIC;
  v_produccion_id UUID;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT cantidad_disponible, produccion_id INTO v_stock_actual, v_produccion_id
  FROM public.camara_fria
  WHERE id = p_registro_camara_id
  FOR UPDATE;

  IF v_stock_actual IS NULL THEN
    RAISE EXCEPTION 'Registro de cámara fría no encontrado.';
  END IF;

  IF v_stock_actual < p_cantidad_mermada THEN
    RAISE EXCEPTION 'Stock insuficiente. Intentas mermar % cajas, pero solo hay % disponibles.', p_cantidad_mermada, v_stock_actual;
  END IF;

  UPDATE public.camara_fria
  SET cantidad_disponible = cantidad_disponible - p_cantidad_mermada,
      updated_at = now()
  WHERE id = p_registro_camara_id;

  INSERT INTO public.inventario_kardex (
    lote_id, produccion_id, camara_fria_id, tipo_movimiento, cantidad,
    ubicacion_origen, motivo, usuario_id
  ) VALUES (
    p_lote_id, v_produccion_id, p_registro_camara_id, 'baja_merma', -p_cantidad_mermada,
    'camara_fria', p_motivo, p_usuario_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_baja_merma(UUID, UUID, NUMERIC, TEXT, UUID) TO authenticated;

-- =========================
-- 5) registrar_envio_cdmx (kardex ligado)
-- =========================
DROP FUNCTION IF EXISTS public.registrar_envio_cdmx(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.registrar_envio_cdmx(
    p_registro_camara_id UUID,
    p_lote_id UUID,
    p_cantidad_enviar NUMERIC,
    p_precio_base_congelado NUMERIC,
    p_referencia_viaje TEXT,
    p_usuario_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stock_actual NUMERIC;
    v_presentacion_id UUID;
    v_produccion_id UUID;
    v_transferencia_id UUID;
    v_folio TEXT;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

    SELECT cf.cantidad_disponible, p.presentacion_id, cf.produccion_id
    INTO v_stock_actual, v_presentacion_id, v_produccion_id
    FROM public.camara_fria cf
    JOIN public.produccion p ON p.id = cf.produccion_id
    WHERE cf.id = p_registro_camara_id
    FOR UPDATE;

    IF v_stock_actual IS NULL THEN
        RAISE EXCEPTION 'Registro de cámara fría no encontrado.';
    END IF;

    IF v_stock_actual < p_cantidad_enviar THEN
        RAISE EXCEPTION 'Stock insuficiente. Intentas enviar % cajas, pero solo hay % disponibles.', p_cantidad_enviar, v_stock_actual;
    END IF;

    IF v_presentacion_id IS NULL THEN
        RAISE EXCEPTION 'El lote no tiene presentación configurada; no se puede crear la transferencia.';
    END IF;

    UPDATE public.camara_fria
    SET cantidad_disponible = cantidad_disponible - p_cantidad_enviar,
        updated_at = NOW()
    WHERE id = p_registro_camara_id;

    INSERT INTO public.inventario_kardex (
        lote_id, produccion_id, camara_fria_id, tipo_movimiento, cantidad,
        ubicacion_origen, ubicacion_destino, usuario_id
    ) VALUES (
        p_lote_id, v_produccion_id, p_registro_camara_id, 'envio_cdmx', -p_cantidad_enviar,
        'camara_fria', 'en_transito_cdmx', p_usuario_id
    );

    v_folio := format('TR-%s-%s', to_char(now(), 'YYMMDD'), substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

    INSERT INTO public.transferencias_bodega (
        folio,
        origen,
        destino,
        estado,
        chofer,
        notas_salida
    ) VALUES (
        v_folio,
        'michoacan',
        'cdmx',
        'en_transito',
        'Pendiente',
        p_referencia_viaje
    )
    RETURNING id INTO v_transferencia_id;

    INSERT INTO public.transferencia_detalles (
        transferencia_id,
        presentacion_id,
        cantidad_enviada,
        precio_base
    ) VALUES (
        v_transferencia_id,
        v_presentacion_id,
        p_cantidad_enviar::INTEGER,
        p_precio_base_congelado
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_envio_cdmx(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID) TO authenticated;

-- =========================
-- 6) registrar_envio_cdmx_transporte_directo (kardex ligado)
-- =========================
DROP FUNCTION IF EXISTS public.registrar_envio_cdmx_transporte_directo(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.registrar_envio_cdmx_transporte_directo(
  p_produccion_id UUID,
  p_lote_id UUID,
  p_cantidad_enviar NUMERIC,
  p_precio_base_congelado NUMERIC,
  p_referencia_viaje TEXT,
  p_usuario_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_destino_actual destino_produccion;
  v_cantidad_cajas INTEGER;
  v_presentacion_id UUID;
  v_transferencia_id UUID;
  v_folio TEXT;
  v_camara_id UUID;
  v_stock_actual NUMERIC;
  v_origen_kardex TEXT;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'produccion'::app_role)
    OR public.has_role(auth.uid(), 'almacen'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT destino, cantidad_cajas, presentacion_id
  INTO v_destino_actual, v_cantidad_cajas, v_presentacion_id
  FROM public.produccion
  WHERE id = p_produccion_id
  FOR UPDATE;

  IF v_destino_actual IS NULL THEN
    RAISE EXCEPTION 'Producción no encontrada.';
  END IF;

  IF v_destino_actual NOT IN ('piso_empaque', 'transporte_directo', 'camara_fria') THEN
    RAISE EXCEPTION 'Destino actual (%) no soportado para envío a CDMX.', v_destino_actual;
  END IF;

  IF v_presentacion_id IS NULL THEN
    RAISE EXCEPTION 'El lote no tiene presentación configurada.';
  END IF;

  SELECT id, cantidad_disponible INTO v_camara_id, v_stock_actual
  FROM public.camara_fria
  WHERE produccion_id = p_produccion_id
  FOR UPDATE;

  IF v_camara_id IS NULL THEN
    INSERT INTO public.camara_fria (produccion_id, cantidad_cajas, cantidad_disponible)
    VALUES (p_produccion_id, v_cantidad_cajas, v_cantidad_cajas)
    RETURNING id, cantidad_disponible INTO v_camara_id, v_stock_actual;
  END IF;

  IF p_cantidad_enviar <= 0 OR p_cantidad_enviar > v_stock_actual THEN
    RAISE EXCEPTION 'Stock insuficiente para envío. Disponible: % cajas.', v_stock_actual;
  END IF;

  UPDATE public.produccion
  SET destino = 'camara_fria'
  WHERE id = p_produccion_id;

  UPDATE public.camara_fria
  SET cantidad_disponible = cantidad_disponible - p_cantidad_enviar,
      updated_at = now()
  WHERE id = v_camara_id;

  v_origen_kardex := CASE
    WHEN v_destino_actual = 'camara_fria' THEN 'camara_fria'
    WHEN v_destino_actual = 'piso_empaque' THEN 'piso_empaque'
    ELSE 'transporte_directo'
  END;

  INSERT INTO public.inventario_kardex (
    lote_id, produccion_id, camara_fria_id, tipo_movimiento, cantidad,
    ubicacion_origen, ubicacion_destino, usuario_id
  ) VALUES (
    p_lote_id, p_produccion_id, v_camara_id, 'envio_cdmx', -p_cantidad_enviar,
    v_origen_kardex, 'en_transito_cdmx', p_usuario_id
  );

  v_folio := format('TR-%s-%s', to_char(now(), 'YYMMDD'), substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  INSERT INTO public.transferencias_bodega (
    folio, origen, destino, estado, chofer, notas_salida
  ) VALUES (
    v_folio, 'michoacan', 'cdmx', 'en_transito', 'Pendiente', p_referencia_viaje
  ) RETURNING id INTO v_transferencia_id;

  INSERT INTO public.transferencia_detalles (
    transferencia_id, presentacion_id, cantidad_enviada, precio_base
  ) VALUES (
    v_transferencia_id, v_presentacion_id, p_cantidad_enviar::INTEGER, p_precio_base_congelado
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_envio_cdmx_transporte_directo(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID) TO authenticated;
