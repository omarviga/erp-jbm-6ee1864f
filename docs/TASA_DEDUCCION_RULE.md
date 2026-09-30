# Regla Técnica: El Ticket es la Fuente Única de Verdad

Fecha: 2026-09-30
Estado: Vigente (sustituye la tasa fija en código y el cargo fijo por boleta)

## Regla

Recepción captura y congela; Finanzas lee, no recalcula.

- El basculero captura manualmente en cada ticket el precio ($/kg) y la tasa
  de deducción operativa ($/kg) del día. No hay catálogo ni tasa en código.
- Al guardar, esos valores quedan congelados en el ticket
  (`precio_pactado_kg`, `cuota_maniobra_kg`, `cuota_maniobra_total`,
  `costo_bascula`, `bascula_forma_pago`).
- Finanzas liquida leyendo los valores congelados del ticket. Está prohibido
  usar fórmula propia con tasas distintas a las del ticket.

## Únicas dos deducciones al productor

1. Deducción operativa: `kilos_netos × tasa capturada en el ticket`.
2. Costo de báscula del ticket (default $30, editable por el operador en
   captura; solo descuenta cuando su forma de pago es `liquidacion`).

No existe ningún tercer cobro fijo por boleta.

## Historial

- $0.04/kg (4 centavos): tasa de 2023 (ej. semana #6 del 6–11 feb 2023).
- $0.40/kg: tasa actual 2026 (ej. ticket REC-00005).
- Cada ticket conserva la tasa con la que se capturó; el historial vive en
  los tickets, no en un catálogo.

## Fórmula única (ticket = CxP = liquidación)

`total = kilos × precio − báscula(liquidación) − deducción operativa`
