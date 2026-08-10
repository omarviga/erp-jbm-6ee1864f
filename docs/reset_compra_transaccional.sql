-- Reset transaccional de compras de terceros sin borrar catalogos maestros.
-- Preserva: productores, clientes, huertos, cortadores, presentaciones, insumos.
--
-- Alcance:
-- - lotes de terceros (es_cosecha_propia = false)
-- - su cadena operativa: lote_cortadores, produccion, camara_fria,
--   registro_temperaturas, stock_molino
-- - detalle logistico derivado: guia_detalles ligados a stock/camara de esos lotes
-- - liquidacion_lotes asociados
-- - liquidaciones que queden sin lotes asociados
-- - inventario_kardex, solo si la tabla existe
--
-- No toca por defecto:
-- - productores
-- - clientes
-- - ventas / venta_detalles / pagos_clientes
-- - transferencias CDMX e inventario_bodega_cdmx
-- - anticipos (se deja un bloque opcional al final)
--
-- Uso recomendado:
-- 1. Ejecuta completo tal cual y revisa los NOTICE y los conteos.
-- 2. Si el resultado es correcto, cambia el ROLLBACK final por COMMIT.

BEGIN;

-- =============================================
-- 1. Seleccion de lotes objetivo
-- =============================================
CREATE TEMP TABLE tmp_target_lotes AS
SELECT id, productor_id, numero_lote
FROM public.lotes
WHERE es_cosecha_propia = false;

CREATE TEMP TABLE tmp_target_produccion AS
SELECT p.id
FROM public.produccion p
JOIN tmp_target_lotes tl ON tl.id = p.lote_id;

CREATE TEMP TABLE tmp_target_camara AS
SELECT cf.id
FROM public.camara_fria cf
JOIN tmp_target_produccion tp ON tp.id = cf.produccion_id;

CREATE TEMP TABLE tmp_target_stock_molino AS
SELECT sm.id
FROM public.stock_molino sm
JOIN tmp_target_lotes tl ON tl.id = sm.lote_id;

CREATE TEMP TABLE tmp_target_liquidaciones AS
SELECT DISTINCT ll.liquidacion_id AS id
FROM public.liquidacion_lotes ll
JOIN tmp_target_lotes tl ON tl.id = ll.lote_id;

CREATE TEMP TABLE tmp_target_productores AS
SELECT DISTINCT productor_id
FROM tmp_target_lotes
WHERE productor_id IS NOT NULL;

-- =============================================
-- 2. Preview de impacto
-- =============================================
SELECT 'lotes_objetivo' AS tabla, COUNT(*)::bigint AS registros FROM tmp_target_lotes
UNION ALL
SELECT 'lote_cortadores', COUNT(*) FROM public.lote_cortadores WHERE lote_id IN (SELECT id FROM tmp_target_lotes)
UNION ALL
SELECT 'produccion', COUNT(*) FROM public.produccion WHERE lote_id IN (SELECT id FROM tmp_target_lotes)
UNION ALL
SELECT 'camara_fria', COUNT(*) FROM public.camara_fria WHERE id IN (SELECT id FROM tmp_target_camara)
UNION ALL
SELECT 'registro_temperaturas', COUNT(*) FROM public.registro_temperaturas WHERE camara_fria_id IN (SELECT id FROM tmp_target_camara)
UNION ALL
SELECT 'stock_molino', COUNT(*) FROM public.stock_molino WHERE id IN (SELECT id FROM tmp_target_stock_molino)
UNION ALL
SELECT 'guia_detalles', COUNT(*) FROM public.guia_detalles
WHERE camara_fria_id IN (SELECT id FROM tmp_target_camara)
   OR stock_molino_id IN (SELECT id FROM tmp_target_stock_molino)
UNION ALL
SELECT 'liquidacion_lotes', COUNT(*) FROM public.liquidacion_lotes WHERE lote_id IN (SELECT id FROM tmp_target_lotes)
UNION ALL
SELECT 'liquidaciones_con_lotes_objetivo', COUNT(*) FROM tmp_target_liquidaciones
ORDER BY tabla;

DO $$
DECLARE
  v_kardex_count bigint;
BEGIN
  IF to_regclass('public.inventario_kardex') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.inventario_kardex
      WHERE lote_id IN (SELECT id FROM tmp_target_lotes)
    $sql$
    INTO v_kardex_count;

    RAISE NOTICE 'inventario_kardex: % registros objetivo', v_kardex_count;
  ELSE
    RAISE NOTICE 'inventario_kardex: tabla no existe en este entorno, se omitira.';
  END IF;
END $$;

-- =============================================
-- 3. Borrado en orden seguro
-- =============================================

-- 3.1 Detalles logisticos que bloquean stock/camara
DELETE FROM public.guia_detalles
WHERE camara_fria_id IN (SELECT id FROM tmp_target_camara)
   OR stock_molino_id IN (SELECT id FROM tmp_target_stock_molino);

-- 3.2 Registros financieros ligados a lotes
DELETE FROM public.liquidacion_lotes
WHERE lote_id IN (SELECT id FROM tmp_target_lotes);

DELETE FROM public.liquidaciones l
WHERE l.id IN (SELECT id FROM tmp_target_liquidaciones)
  AND NOT EXISTS (
    SELECT 1
    FROM public.liquidacion_lotes ll
    WHERE ll.liquidacion_id = l.id
  );

-- 3.3 Cadena operativa opcional
DO $$
BEGIN
  IF to_regclass('public.inventario_kardex') IS NOT NULL THEN
    EXECUTE $sql$
      DELETE FROM public.inventario_kardex
      WHERE lote_id IN (SELECT id FROM tmp_target_lotes)
    $sql$;
  END IF;
END $$;

DELETE FROM public.lote_cortadores
WHERE lote_id IN (SELECT id FROM tmp_target_lotes);

DELETE FROM public.lotes
WHERE id IN (SELECT id FROM tmp_target_lotes);

-- =============================================
-- 4. Verificacion posterior
-- =============================================
SELECT 'lotes_restantes_objetivo' AS chequeo, COUNT(*)::bigint AS registros
FROM public.lotes
WHERE id IN (SELECT id FROM tmp_target_lotes)
UNION ALL
SELECT 'liquidacion_lotes_restantes', COUNT(*)
FROM public.liquidacion_lotes
WHERE lote_id IN (SELECT id FROM tmp_target_lotes)
UNION ALL
SELECT 'guia_detalles_restantes', COUNT(*)
FROM public.guia_detalles
WHERE camara_fria_id IN (SELECT id FROM tmp_target_camara)
   OR stock_molino_id IN (SELECT id FROM tmp_target_stock_molino)
ORDER BY chequeo;

DO $$
DECLARE
  v_kardex_remaining bigint;
BEGIN
  IF to_regclass('public.inventario_kardex') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.inventario_kardex
      WHERE lote_id IN (SELECT id FROM tmp_target_lotes)
    $sql$
    INTO v_kardex_remaining;

    RAISE NOTICE 'inventario_kardex_restante: %', v_kardex_remaining;
  END IF;
END $$;

-- =============================================
-- 5. Opcional: anticipos de productores involucrados
-- =============================================
-- Si tambien quieres resetear anticipos financieros de los productores
-- involucrados en estos lotes, descomenta esta sentencia antes del COMMIT:
--
-- DELETE FROM public.anticipos
-- WHERE productor_id IN (SELECT productor_id FROM tmp_target_productores);

ROLLBACK;
-- Sustituye por COMMIT cuando hayas validado los conteos.
