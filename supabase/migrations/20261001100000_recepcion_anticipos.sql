-- Recepción: pago al productor (pendiente / anticipo / total).
-- Fecha: 2026-10-01. Idempotente y aditiva.
--
-- El monto pagado en recepción viaja como anticipos del lote y Finanzas
-- lo amortiza en la liquidación de la boleta. "Pago total" guarda anticipos
-- por el total estimado; el remanente se ajusta en liquidación con las
-- deducciones operativas ($30/boleta + $0.04/kg).
-- Nota: registrar_recepcion(JSONB) debe mapear las claves nuevas
-- "tipo_pago_recepcion" y "anticipos" (claves desconocidas se ignoran).

alter table public.lotes
  add column if not exists tipo_pago_recepcion text not null default 'pendiente'
    check (tipo_pago_recepcion in ('pendiente', 'anticipo', 'total'));

alter table public.lotes
  add column if not exists anticipos numeric(14, 2) not null default 0
    check (anticipos >= 0);

create index if not exists ix_lotes_anticipos
  on public.lotes (productor_id) where anticipos > 0;
