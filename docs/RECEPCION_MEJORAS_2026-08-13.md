# Recepción: correcciones y mejoras (2026-08-13)

## Cómo aplicar las migraciones

Archivos, en orden:

1. `supabase/migrations/20260813090000_recepcion_doble_pesada_cuotas_y_folio.sql`
   — columnas de transporte/cuotas, folio consecutivo y `registrar_recepcion`
   (**ya aplicada**).
2. `supabase/migrations/20260813100000_diagnostico_correccion_cosecha_propia.sql`
   — solo lectura: crea `diagnostico_correccion_cosecha_propia()`.
3. `supabase/migrations/20260813110000_corregir_cosecha_propia_cxp.sql`
   — corrección de datos con respaldo y reversión.
4. `supabase/migrations/20260813120000_recepcion_operador_y_concepto_cargo.sql`
   — `operador_bascula`, `cuota_maniobra_concepto` y variedad única.

Todas son idempotentes y retrocompatibles.

```bash
# CLI de Supabase
supabase db push

# O pegar cada archivo en el panel → SQL Editor
```

La app funciona **sin** las migraciones 2-4: `useRecepcion` detecta que la RPC
esperada no está desplegada y guarda por la ruta de respaldo (con un aviso
visible en pantalla).

## Rediseño del formulario (2026-08-13, segunda iteración)

Cambios pedidos por operación:

- **Se eliminó el bloque de transporte** (chofer, placas del camión y
  rejas/huacales) y la tara de rejas. Ahora se captura una sola **tara del
  vehículo**.
- **Se eliminó el selector de variedad**: en Michoacán solo se trabaja limón
  mexicano, así que se registra automáticamente (`VARIEDAD_UNICA`).
- **El huerto solo aparece en cosecha propia**; en compra a terceros el campo ya
  no existe y `huerto_id` se guarda en `NULL`.
- **Se agregó el operador de báscula** responsable (se sugiere desde la sesión y
  se recuerda en el navegador) y el **concepto del cargo** por kilo.
- **Se eliminó el asistente por pasos**: todo el flujo quedó en una sola
  pantalla, en el orden operativo (origen → pesaje → calidad → báscula → cargos
  → resumen → operador → guardar), con dos acciones: **Guardar e imprimir
  directo** y **Guardar boleta**.
- El **resumen en tiempo real** muestra el desglose completo y el **precio neto
  efectivo real** (`total a liquidar ÷ kilos netos`), la métrica de
  transparencia para el productor.

Las columnas `chofer`, `placas`, `rejas` y `tara_rejas_kg` **se conservan en la
base** (no se eliminan datos); simplemente dejan de capturarse y quedan en
`NULL` / `0`.

## Qué se corrigió

| # | Problema | Corrección |
|---|----------|------------|
| 1 | `huerto_id` nunca se guardaba: el operador lo seleccionaba y se descartaba | Se persiste en la RPC y en la ruta de respaldo |
| 2 | Las cajas por cortador se capturaban pero no se guardaban | `registrar_recepcion` inserta en `lote_cortadores` (esa tabla solo permite INSERT a admin/producción por RLS, por eso se hace desde la RPC `SECURITY DEFINER`) |
| 3 | `peso_neto` (columna GENERATED) nunca se aprovechaba y `formData.placas` era código muerto | `peso_neto` se usa como base de pago |
| 4 | **Cosecha propia se guardaba con `es_cosecha_propia = false` y el precio por caja escrito en `precio_pactado_kg`** | Ahora `es_cosecha_propia = true`, el precio por caja va a `precio_caja_cortador` y `precio_pactado_kg` queda como costo opcional de costeo |
| 5 | El paso 2 se titulaba "Detalles de Pesaje y Precio" pero solo tenía el slider de defectos | Un solo flujo lineal de captura |
| 6 | La tarjeta del paso previo se veía deshabilitada (`opacity-60 grayscale`) pero sus campos seguían editables | Ya no hay pasos: todo es visible y editable a la vez |
| 7 | No existía pantalla de revisión previa al ingreso | Checklist de cierre en el panel lateral + resumen en tiempo real |
| 8 | El historial de precios estaba hardcodeado (3 valores fijos de enero 2026) | Se consultan los últimos lotes reales del productor, con promedio, rango y variación |
| 9 | `calcularResumenRecepcion` y `obtenerCostoBasculaConfigurado` se importaban sin usarse | Cálculo único en `src/lib/recepcion/calculos.ts`, con pruebas |

## Qué se agregó

- **Pesaje de báscula**: 1ª pesada (camión cargado), 2ª pesada (vehículo vacío) y
  peso neto automático, con marca de tiempo en `peso_bruto_at` / `peso_tara_at`.
- **Cuota de báscula con forma de cobro**: `efectivo` (se cobra al momento y **no**
  se descuenta de la liquidación) o `liquidacion`.
- **Cargo operativo por kilo** con tarifa ($0.40/kg por omisión) y concepto.
- **Precio neto efectivo real** (`total a liquidar ÷ kilos netos`), la métrica de
  transparencia que ve el productor.
- **Folio consecutivo oficial** `REC-2026-001` con bloqueo `pg_advisory_xact_lock`
  para evitar consecutivos duplicados en recepciones simultáneas.
- **Operador de báscula responsable** en la boleta y en la trazabilidad.
- **Boleta/ticket 80 mm** con membrete institucional, ambos folios, trazabilidad
  por QR, desglose de deducciones y firmas de operador y productor/chofer.
- **Disponibilidad inmediata en producción**: al guardar se muestra el lote
  creado con acceso directo a su expediente y al módulo de Producción.

## Cambios de esquema

Columnas nuevas en `lotes` (migración `20260813090000`): `folio_recepcion`,
`bascula_forma_pago`, `cuota_maniobra_kg`, `cuota_maniobra_total`,
`precio_caja_cortador`, `pago_cortadores_total`, `peso_bruto_at`, `peso_tara_at`,
`variedad`, y las de transporte `chofer`, `placas`, `rejas`, `tara_rejas_kg`
(estas últimas ya no se capturan desde la interfaz).

Columnas nuevas en `lotes` (migración `20260813120000`): `operador_bascula` y
`cuota_maniobra_concepto`.

> `peso_neto` es `GENERATED (peso_bruto - peso_tara)`. Nunca se envía en un
> INSERT: se calcula en la base a partir del bruto y la tara.

Funciones:

- `siguiente_folio_recepcion()` — solo lectura, para la vista previa del folio.
- `registrar_recepcion(JSONB)` — alta atómica: lote + cortadores + recálculo de CxP.
- `sync_cxp_from_lote()` y `sync_productor_saldo_pendiente()` — ahora restan la
  cuota de maniobra y solo descuentan la báscula cuando su forma de pago es
  `liquidacion`. También se alineó el saldo del productor para que excluya la
  cosecha propia, igual que `cuentas_por_pagar`.

## Corrección de datos: cosecha propia registrada como compra

Archivos:

1. `supabase/migrations/20260813100000_diagnostico_correccion_cosecha_propia.sql`
   (solo lectura: crea una función de consulta y reporta el impacto)
2. `supabase/migrations/20260813110000_corregir_cosecha_propia_cxp.sql`
   (aplica la corrección con respaldo y reversión)

> La consulta comentada al final de `20260813090000` usaba
> `huerto_id IS NOT NULL` como criterio. **Es incorrecta**: el huerto solo se
> captura en cosecha propia, así que por sí solo no distingue nada. El criterio
> vigente es `es_cosecha_propia = false AND origen = 'interno'`, implementado en
> `diagnostico_correccion_cosecha_propia()`.

### Antes de aplicar

```sql
SELECT * FROM public.diagnostico_correccion_cosecha_propia();
SELECT clasificacion, COUNT(*), SUM(monto_total) AS importe_inflado
FROM public.diagnostico_correccion_cosecha_propia()
GROUP BY clasificacion;
```

### Qué hace la corrección

1. **Respalda** el estado previo de cada lote y de su nota en
   `cxp_correccion_cosecha_propia_log` (incluye importes, saldos y estado).
2. **Marca los lotes** como `es_cosecha_propia = true`. Al hacerlo, el trigger
   `trg_sync_cxp_from_lote` deja la nota en saldo 0.
3. **Recupera el precio por caja** que se capturó en `precio_pactado_kg`,
   moviéndolo a `precio_caja_cortador` y dejando el precio por kilo en 0, para
   que el costeo de producción no siga usando un valor por caja como si fuera
   por kilo.
   Interruptor al inicio del paso 5: `v_mover_precio_a_caja BOOLEAN := true`.
   Ponlo en `false` para conservar `precio_pactado_kg` tal cual.
4. **Anula el importe** de las notas que **no** tienen pagos aplicados: pone
   `monto_total = 0`, `precio_kg = 0` y `saldo_pendiente = 0`. Los kilos de la
   nota se conservan porque siempre fueron correctos (peso neto real).
5. **No toca** las notas con pagos ya aplicados, con abonos asignados o de lotes
   liquidados: quedan marcadas como `requiere_revision_manual` para que finanzas
   las concilie a mano.
6. **Resincroniza** `productores.saldo_pendiente`.

### Incluye una corrección de cálculo

`sync_productor_saldo_pendiente` calculaba el pendiente **bruto** (sin restar
los pagos ya aplicados), mientras `aplicar_pago_cxp` lo calculaba **neto** desde
`cuentas_por_pagar`. Cada recepción nueva volvía a inflar el saldo de un
productor que ya había cobrado.

Ahora el cálculo se hace en `recalcular_saldo_productor` (sin chequeo de rol,
para poder invocarlo desde migraciones donde `auth.uid()` es NULL) y
`sync_productor_saldo_pendiente` solo valida el rol y delega. Las tres rutas
—sincronización, aplicación de pagos y liquidación— coinciden.

**Efecto visible:** los productores que ya recibieron pagos verán su
`saldo_pendiente` bajar al valor real. Es el comportamiento correcto.

### Verificación

```sql
-- Debe devolver 0 filas
SELECT * FROM public.diagnostico_correccion_cosecha_propia();

-- Detalle de lo corregido
SELECT accion, COUNT(*), SUM(monto_total_original) AS importe_previo
FROM public.cxp_correccion_cosecha_propia_log
GROUP BY accion;
```

### Reversión

```sql
SELECT * FROM public.revertir_correccion_cosecha_propia();
```

Restaura el estado anterior **incluido el error original** (fue solo una
creación de función: no se ejecuta sola). Tras revertir, el log queda marcado y
una nueva aplicación de la migración vuelve a tomar el respaldo del estado
actual.

### No se pudo recuperar

Las cajas de los cortadores de esos lotes nunca se guardaron (`lote_cortadores`
quedó vacío) y `pago_cortadores_total` quedó en 0. Ese dato hay que capturarlo
de nuevo desde las boletas físicas si se necesita el pago retroactivo.

