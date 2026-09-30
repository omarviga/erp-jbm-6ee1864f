# Regla Técnica: Cancelación de Tickets con Trazabilidad

Fecha: 2026-09-30
Estado: Vigente

## Regla

Un ticket se cancela individualmente, sin afectar los demás del productor.
La cancelación es irreversible desde la app y queda auditada.

## Condiciones (validadas en el RPC `cancelar_ticket`)

1. El ticket no está liquidado (sin renglón en `liquidacion_lotes`).
2. Su nota CxP no tiene pagos aplicados (`monto_pagado = 0` y sin
   renglones en `abono_asignaciones`).
3. Su fruta no entró a producción.
4. Motivo obligatorio (mínimo 5 caracteres).

Roles autorizados: admin, finanzas, almacen.

## Efectos

- Renglón append-only en `ticket_cancelaciones` (lote, motivo, usuario,
  fecha). Sin UPDATE/DELETE por RLS: el registro es inmutable.
- La nota CxP pasa a `estado = 'cancelado'` con saldo 0; conserva
  `monto_total`/`monto_pagado` como histórico.
- El trigger `sync_cxp_from_lote` nunca resucita una nota cancelada.
- Las consultas de Finanzas excluyen `estado = 'cancelado'` (CxP) y los
  lotes con renglón en `ticket_cancelaciones` (reportes por lote).

## Entrada en UI

Pestaña CxP de Finanzas → detalle de notas del productor → "Cancelar nota"
(visible solo cuando la nota no tiene pagos aplicados).
