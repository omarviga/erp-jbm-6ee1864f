DROP FUNCTION IF EXISTS public.registrar_envio_cdmx(UUID, UUID, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.registrar_envio_cdmx(
    p_registro_camara_id UUID,
    p_lote_id UUID,
    p_cantidad_enviar NUMERIC,
    p_precio_base_congelado NUMERIC,
    p_referencia_viaje TEXT,
    p_chofer TEXT,
    p_placas TEXT,
    p_usuario_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_stock_actual NUMERIC;
    v_presentacion_id UUID;
    v_transferencia_id UUID;
    v_folio TEXT;
BEGIN
    SELECT cf.cantidad_disponible, p.presentacion_id
    INTO v_stock_actual, v_presentacion_id
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
        lote_id, tipo_movimiento, cantidad, ubicacion_origen, ubicacion_destino, usuario_id
    ) VALUES (
        p_lote_id, 'envio_cdmx', -p_cantidad_enviar, 'camara_fria', 'en_transito_cdmx', p_usuario_id
    );

    v_folio := format('TR-%s-%s', to_char(now(), 'YYMMDD'), substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

    INSERT INTO public.transferencias_bodega (
        folio,
        origen,
        destino,
        estado,
        chofer,
        placas,
        notas_salida
    ) VALUES (
        v_folio,
        'michoacan',
        'cdmx',
        'en_transito',
        NULLIF(trim(p_chofer), ''),
        NULLIF(trim(p_placas), ''),
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

GRANT EXECUTE ON FUNCTION public.registrar_envio_cdmx(UUID, UUID, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID) TO authenticated;
