# Release Readiness Report

Fecha: 2026-09-29. Base: `main` @ `360505f` + migracion P0 `20260929200300`
(aplicada en prod) + calibracion de timeouts vitest (sin commit).
Metodo: consultas directas al catalogo de produccion (`pg_policies`,
`pg_tables`, `storage.buckets`, grants), revision de codigo y corridas
reproducibles. Sin PII en evidencias (conteos, no emails).

## Veredicto global

| Seccion | Veredicto | Detalle |
|---|---|---|
| 1A Politicas legacy `USING (true)` | REMEDIATED | 31 politicas en 11 tablas cerradas a roles; hoy 0 |
| 1B `transportistas` y fletes | PASS | Ya endurecida por rol; anon sin acceso |
| 1C Bucket `gastos-tickets` | PASS | Privado + politicas por rol + signed URLs 60 min |
| 1D Migracion de cierre | PASS | Aplicada, verificada C1/C2/C3, datos intactos |
| 2A Usuarios reales por rol | FAIL | 1 usuario por rol (cuentas de prueba); falta matriz con logins reales |
| 2B Catalogos base | FAIL | Vacios (0 filas); limpio de mocks pero sin carga |
| 2C UAT end-to-end | PENDING | Requiere planta; acta plantilla incluida abajo |
| 3 Flow tests | PASS | Causa raiz corregida; 5/5 corridas verdes (8 archivos, 33 tests) |

## 1A. Politicas legacy — REMEDIATED

Inventario (antes): 31 politicas `authenticated USING/WITH CHECK (true)`:

| Tabla | Cmds abiertos | Riesgo |
|---|---|---|
| `usuarios` | SELECT/INSERT/UPDATE | Alta: directorio con email/rol editable por cualquiera |
| `liquidacion_pagos`, `ventas_cdmx`, `venta_detalles_cdmx`, `ventas_exportacion` | SELECT/INSERT/UPDATE | Alta: datos financieros/ventas |
| `fletes_productor`, `precios_calidad` | SELECT/INSERT/UPDATE | Media: tarifas y precios |
| `clientes_maquila`, `ordenes_maquila` | SELECT/INSERT/UPDATE | Media: operacion maquila |
| `rutas_validas`, `cat_clasificaciones` | SELECT (+I/U rutas) | Baja: catalogos |
| DELETE en las 10 | denegado no-admin | Ya era solo admin |

Contexto: RLS activo en 68/68 tablas public; 0 politicas para `anon`.
Los GRANTs son amplios por defecto Supabase (hasta `anon` tiene ALL a
nivel grant), asi que las politicas RLS son la unica capa de control:
por eso cada cierre se condiciona a `has_role(auth.uid(), ...)`.
Las 31 politicas eran deriva (no existian en `supabase/migrations`).

Despues (migracion `20260929200300_p0_cierre_authenticated_true.sql`):
maquila a admin+produccion (ruta `/maquila`); `usuarios` SELECT a
admin+produccion+almacen (Kardex en `/inventarios`), writes admin;
`cat_clasificaciones` sin SELECT abierto (admin via ALL existente);
las 7 sin uso en app (`fletes_productor`, `liquidacion_pagos`,
`precios_calidad`, `rutas_validas`, `ventas_exportacion`,
`venta_detalles_cdmx`, `ventas_cdmx`) a solo admin.

Metrica reproducible (SQL Editor, esperado 0 filas):

```sql
select tablename, policyname, cmd from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true');
```

Resultado observado: 0 filas. Familia por tabla: 41 politicas exactas
segun diseno, sin restos "Autenticados ...", DELETE solo admin.

Residuales conscientes (verificados, no son hallazgo): SELECT abierto
en 3 catalogos de cultivo (`cultivo_*`, referencia agronomica);
`notificaciones` INSERT limitado a `user_id = auth.uid()` (propias);
ALL admin/finanzas heredados P2 (`clientes_sensible`,
`facturacion_config`, `factura_timbrado_intentos`).

## 1B. `transportistas` — PASS

Ya endurecida (SELECT admin/ventas/almacen/finanzas; INSERT/UPDATE
admin/almacen; DELETE admin). Columnas sensibles (`rfc`, `telefono`,
`numero_permiso`, `poliza_seguro`) sin politica anon/publica:
`anon` recibe 0 filas por ausencia de politica aplicable.
Nota: los roles ejemplo del alcance (`coordinador_logistica`,
`operador_empaque`) no existen en el enum real
(admin, produccion, finanzas, ventas, almacen, campo); la matriz
aplicada usa los roles reales y cubre el mismo principio.
Prueba HTTP en vivo con anon key no ejecutable desde el sandbox
(sin egreso); reproducible con:

```bash
curl "$URL/rest/v1/transportistas?select=id&limit=3" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# esperado: 200 con []
```

## 1C. Bucket `gastos-tickets` — PASS

- `storage.buckets.public = false` (privado).
- Politicas `storage.objects` por rol (SELECT/INSERT
  admin/finanzas/ventas/almacen; DELETE admin), condicionadas a
  `bucket_id = 'gastos-tickets'`.
- Codigo solo usa URLs firmadas: `useGastos.ts` y
  `BodegaCDMX/GastosTab.tsx` via `createSignedUrl(path, 3600)`
  (TTL 60 min, dentro del rango 15-60). Sin URLs `object/public` en `src`.
- Prueba directa de URL bloqueada por egreso del sandbox; reproducible:

```bash
curl -o /dev/null -w "%{http_code}\n" \
  "$URL/storage/v1/object/public/gastos-tickets/<obj>"
# esperado: 400 (bucket no publico)
```

## 1D. Migracion de cierre — PASS

- Archivo: `supabase/migrations/20260929200300_p0_cierre_authenticated_true.sql`
  (61 DROP, 30 CREATE POLICY, 10 GRANT; solo DDL de politicas).
- `supabase db push --linked`: aplicado sin errores; `migration list`
  sin pendientes (incluye `20260929200300`).
- Integridad: conteos antes = despues (`cat_clasificaciones` 31,
  `usuarios` 1, resto 0). Sin cambios de datos ni FK tocadas.
- Cobertura durable: sin harness SQL en el repo; el chequeo
  reproducible es el SQL de verificacion del header de la migracion
  (Criterios C1/C2/C3). No se agrego framework nuevo.

## 2A. Usuarios por rol — FAIL (pendiente negocio)

Asignaciones reales en `user_roles` (conteo): 1 admin, 1 produccion,
1 finanzas, 1 ventas, 1 almacen, 0 campo. Patron de cuentas de
prueba, no de operacion. Verdad de codigo ruta x rol (base para la
matriz de logins; admin pasa siempre):

| Ruta | Roles |
|---|---|
| `/recepcion` | almacen |
| `/produccion`, `/maquila` | produccion |
| `/inventarios` | produccion, almacen |
| `/logistica` | almacen |
| `/facturacion`, `/finanzas`, `/gastos` | finanzas |
| Bodega CDMX (POS/corte/inventario) | ventas, almacen (+ finanzas corte) |

Acta pendiente (lideres): por cada rol, login real, modulo permitido
OK y modulo bloqueado verificado (ej. almacen no ve `/finanzas`).
Plantilla: usuario | rol | permitido verificado | bloqueado
verificado | firma.

## 2B. Catalogos base — FAIL (pendiente carga)

Conteos prod: productores 0, clientes 0, transportistas 0, huertos 0,
cortadores 0. Limpio de mocks, pero sin datos para operar: bloquear
salida hasta cargar padron real (RFC, huertas, registros
fitosanitarios) + insumos con minimos.
Observacion bascula: `CUOTA_BASCULA_DEFAULT = 50`
(`src/lib/recepcion/calculos.ts`) es solo default editable del
formulario (el operador lo cambia por recepcion); no hay config
central en BD. Sugerencia no bloqueante: tabla de parametros.

## 2C. UAT end-to-end — PENDING (pendiente planta)

No ejecutable sin operacion fisica. Acta minima por viaje de prueba:
boleta de bascula (bruto/tara) -> ticket termico; corrida de
calibres con descuento de cajas/etiquetas; ingreso a camara con mapa
de bahias y alerta termica; Carta Porte + guia PDF + poliza CSV.
Cada paso: evidencia (folio/archivo) + firma del responsable.

## 3. Flow tests — PASS

Diagnostico: no era colision de datos (tests con mocks) sino
timeouts bajo contencion paralela. El test POSTab "cobra usando el
cliente..." tarda 7-12 s y traia timeout local de 10 s
(`POSTab.flow.test.tsx:197,248`), que prevalece sobre el global;
un full run de 23 archivos lo empujaba sobre el limite.
Precedente: `Recepcion.flow.test.tsx` ya usaba 20 s locales.

Cambios:

- `vitest.config.ts`: `testTimeout`/`hookTimeout` 15000 global.
- `POSTab.flow.test.tsx`: 2 timeouts locales 10 s -> 30 s
  (peor observado 12 s + margen).

Metrica: set de 8 flows (POSTab, InventarioTab, CorteCajaTab,
RecepcionesTab, Inventarios, Logistica, Recepcion, TicketBascula;
33 tests) en 5/5 corridas consecutivas verdes, 0 FAIL.
Confirmacion full suite (23 archivos en paralelo): 121/121 verdes.
Colaterales: `tsc --noEmit` 0 errores; eslint limpio en cambiados.
Recomendacion no bloqueante: `pool: 'vmThreads'` (jsdom se crea 8
veces por corrida; 27-38% del tiempo) y mover la metrica 5x al CI.

## Entregables

- [x] Reporte SQL: 0 politicas permisivas, 68/68 tablas con RLS,
      0 politicas anon, bucket privado.
- [x] Matriz de roles (codigo + RLS); ejecucion de logins reales: pendiente.
- [ ] Acta UAT de planta: pendiente de operacion.
- Archivos: migracion `20260929200300`, este reporte,
  `vitest.config.ts`, `POSTab.flow.test.tsx` (estos dos ultimos sin
  commit ni push al cierre del reporte).
