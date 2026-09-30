-- ==========================================================
-- NORMALIZA CUALQUIER CHECK CONSTRAINT DE ESTADO EN cuentas_por_pagar
--
-- La app solo escribe 'pendiente' y 'pagado' en la columna
-- estado (sync_cxp_from_lote, sync_cxp_after_liquidacion y
-- aplicar_pago_cxp). La base de datos real tiene un constraint
-- preexistente (creado manualmente, no versionado en migraciones)
-- que rechazaba estos valores, rompiendo la aplicacion de pagos
-- con el error:
--   new row for relation "cuentas_por_pagar" violates check
--   constraint "cuentas_por_pagar_estado_check"
--
-- Esta version es robusta: en lugar de asumir el nombre exacto
-- del constraint, localiza dinamicamente TODOS los check
-- constraints que referencian la columna estado y los elimina,
-- para luego recrear uno unico con el conjunto completo de
-- estados usados por la aplicacion.
--
-- Idempotente: seguro de ejecutar varias veces.
-- ==========================================================

-- 1) Elimina cualquier check constraint sobre la columna estado,
--    sin importar su nombre (cubre cuentas_por_pagar_estado_check,
--    cuentas_por_pagar_estado_check1, u otros creados manualmente).
DO $$
DECLARE
  v_con_name TEXT;
BEGIN
  FOR v_con_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN LATERAL (
      SELECT unnest(con.conkey) AS attnum
    ) c ON TRUE
    JOIN pg_attribute att
      ON att.attrelid = rel.oid AND att.attnum = c.attnum
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'cuentas_por_pagar'
      AND con.contype = 'c'
      AND att.attname = 'estado'
  LOOP
    EXECUTE format('ALTER TABLE public.cuentas_por_pagar DROP CONSTRAINT %I', v_con_name);
    RAISE NOTICE 'Constraint eliminado: %', v_con_name;
  END LOOP;
END;
$$;

-- 2) Recrea un unico constraint con el conjunto completo de estados.
--    (el DROP previo cubre el caso de re-ejecucion si el loop no
--    encontro el constraint por nombre generico).
ALTER TABLE public.cuentas_por_pagar
  DROP CONSTRAINT IF EXISTS cuentas_por_pagar_estado_check;

ALTER TABLE public.cuentas_por_pagar
  ADD CONSTRAINT cuentas_por_pagar_estado_check
  CHECK (estado IN ('pendiente', 'pagado', 'cancelado', 'rechazado', 'liquidado', 'en_proceso'));
