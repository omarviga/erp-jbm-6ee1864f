# Regla Técnica: Peso Neto como Única Base de Cálculo

Fecha: 2026-05-06  
Estado: Vigente

## Regla

En JBM ERP, el único peso válido para cálculos operativos y financieros es `peso_neto`.

Aplica para:
- Recepción (subtotal y total a pagar)
- Cuentas por pagar (CxP)
- Liquidaciones
- Producción (kilos disponibles y porcentaje usado)
- Reportes derivados de pago por kilo

## Estado de `peso_pagable`

`peso_pagable` queda **deprecated** para lógica nueva.

- No debe usarse en nuevos cálculos.
- No debe usarse para UI de control operativo.
- Si existe en base de datos por compatibilidad histórica, su valor debe mantenerse alineado con `peso_neto` durante la transición.

## Motivo

Evitar discrepancias entre módulos y asegurar que el peso pagado, procesado y reportado sea el mismo en todo el sistema.
