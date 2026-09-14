# Recepción: correcciones y mejoras (2026-08-13)

## Cómo aplicar la migración

Archivo: `supabase/migrations/20260813090000_recepcion_doble_pesada_cuotas_y_folio.sql`

Es idempotente y retrocompatible. Dos opciones:

```bash
# Opción A: CLI de Supabase
supabase db push

# Opción B: panel de Supabase → SQL Editor → pegar el contenido del archivo
```

Al final del archivo hay un bloque **DIAGNÓSTICO (solo lectura)** con una consulta
para revisar los lotes afectados por el bug de CxP descrito abajo. No modifica nada.

La app funciona **sin** la migración: `useRecepcion` detecta que la RPC no está
desplegada y guarda por la ruta de respaldo (con un aviso visible en pantalla).
Al aplicarla se habilitan folio consecutivo, transporte, cuotas y cortadores.

## Qué se corrigió

| # | Problema | Corrección |
|---|----------|------------|
| 1 | `huerto_id` nunca se guardaba: el operador lo seleccionaba y se descartaba | Se persiste en la RPC y en la ruta de respaldo |
| 2 | Las cajas por cortador se capturaban pero no se guardaban | `registrar_recepcion` inserta en `lote_cortadores` (esa tabla solo permite INSERT a admin/producción por RLS, por eso se hace desde la RPC `SECURITY DEFINER`) |
| 3 | `peso_neto` (columna GENERATED) nunca se aprovechaba y `formData.placas` era código muerto | `peso_neto` se usa como base de pago y el transporte (chofer, placas, rejas) se captura y persiste |
| 4 | **Cosecha propia se guardaba con `es_cosecha_propia = false` y el precio por caja escrito en `precio_pactado_kg`** | Ahora `es_cosecha_propia = true`, el precio por caja va a `precio_caja_cortador` y `precio_pactado_kg` queda como costo opcional de costeo |
| 5 | El paso 2 se titulaba "Detalles de Pesaje y Precio" pero solo tenía el slider de defectos | Asistente real de 4 pasos según el flujo operativo |
| 6 | La tarjeta del paso previo se veía deshabilitada (`opacity-60 grayscale`) pero sus campos seguían editables | El stepper indica el avance real y se puede regresar a cualquier paso completado |
| 7 | No existía pantalla de revisión previa al ingreso | Paso 4 con revisión completa, bloqueantes y advertencias |
| 8 | El historial de precios estaba hardcodeado (3 valores fijos de enero 2026) | Se consultan los últimos lotes reales del productor, con promedio, rango y variación |
| 9 | `calcularResumenRecepcion` y `obtenerCostoBasculaConfigurado` se importaban sin usarse | Cálculo único en `src/lib/recepcion/calculos.ts`, con pruebas |

## Qué se agregó

- **Doble pesada**: 1ª pesada (camión cargado) y 2ª pesada (vehículo vacío) con
  marca de tiempo en `peso_bruto_at` / `peso_tara_at`, más la tara de rejas/tarimas.
- **Cuota de báscula con forma de cobro**: `efectivo` (se cobra al momento y **no**
  se descuenta de la liquidación) o `liquidacion`.
- **Cuota de maniobra por kilo** (descarga, estiba, patio).
- **Folio consecutivo oficial** `REC-2026-001` con bloqueo `pg_advisory_xact_lock`
  para evitar consecutivos duplicados en recepciones simultáneas.
- **Variedad de la fruta**, localidad del huerto y aviso de folio físico duplicado.
- **Boleta/ticket 80 mm** con membrete institucional, ambos folios, trazabilidad
  por QR, desglose de deducciones y firmas de operador y productor/chofer.
- **Disponibilidad inmediata en producción**: al confirmar se muestra el lote
  creado con acceso directo a su expediente y al módulo de Producción.

## Cambios de esquema

Columnas nuevas en `lotes`: `folio_recepcion`, `variedad`, `chofer`, `placas`,
`rejas`, `tara_rejas_kg`, `bascula_forma_pago`, `cuota_maniobra_kg`,
`cuota_maniobra_total`, `precio_caja_cortador`, `pago_cortadores_total`,
`peso_bruto_at`, `peso_tara_at`.

> `peso_neto` es `GENERATED (peso_bruto - peso_tara)`. Por eso la tara de rejas se
> suma **dentro** de `peso_tara` y `tara_rejas_kg` queda solo como desglose para el
> ticket. Nunca se envía `peso_neto` en un INSERT.

Funciones:

- `siguiente_folio_recepcion()` — solo lectura, para la vista previa del folio.
- `registrar_recepcion(JSONB)` — alta atómica: lote + cortadores + recálculo de CxP.
- `sync_cxp_from_lote()` y `sync_productor_saldo_pendiente()` — ahora restan la
  cuota de maniobra y solo descuentan la báscula cuando su forma de pago es
  `liquidacion`. También se alineó el saldo del productor para que excluya la
  cosecha propia, igual que `cuentas_por_pagar`.

## Pendiente: decisiones de datos

La versión anterior guardaba la cosecha propia como compra a terceros, con el
precio por caja en `precio_pactado_kg`. El trigger `trg_sync_cxp_from_lote` creó
notas en `cuentas_por_pagar` con importe `kilos × precio_por_caja`, muy por encima
del valor real.

**No se corrigió automáticamente** porque el ajuste afecta saldos y abonos ya
registrados. Usa la consulta de diagnóstico del final de la migración para medir el
impacto y decide si hace falta una migración correctiva (marcar esos lotes como
`es_cosecha_propia = true` y recalcular sus notas CxP).
