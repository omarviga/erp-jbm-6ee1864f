-- ==========================================================
-- NORMALIZA EL CHECK CONSTRAINT DE ESTADO EN cuentas_por_pagar
--
-- La app solo escribe 'pendiente' y 'pagado' en la columna
-- estado (sync_cxp_from_lote, sync_cxp_after_liquidacion y
-- aplicar_pago_cxp). El constraint preexistente en la base
-- (creado manualmente y no versionado en migraciones)
-- rechazaba uno de estos valores, lo que rompia la aplicacion
-- de pagos parciales en CxP con el error:
--   new row for relation "cuentas_por_pagar" violates check
--   constraint "cuentas_por_pagar_estado_check"
--
-- Se reemplaza por un conjunto que cubre los estados usados
-- por la aplicacion y deja margen para cancelaciones futuras.
-- ==========================================================

ALTER TABLE public.cuentas_por_pagar
  DROP CONSTRAINT IF EXISTS cuentas_por_pagar_estado_check;

ALTER TABLE public.cuentas_por_pagar
  ADD CONSTRAINT cuentas_por_pagar_estado_check
  CHECK (estado IN ('pendiente', 'pagado', 'cancelado', 'rechazado', 'liquidado', 'en_proceso'));
