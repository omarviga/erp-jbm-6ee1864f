# QA funcional de flujo operativo (compra → producción → movimientos → envío CDMX → venta POS)

Fecha: 2026-03-10
Usuario probado: `omarvieyra@hotmail.com`

> Nota de acceso: con `omarvieyra@hotnail.com` el login falla; con `omarvieyra@hotmail.com` + la contraseña proporcionada sí entra.

## 1) Compra/Recepción de limón
- Se abrió el módulo de recepción y se intentó captura automática de datos mínimos.
- Resultado: **parcial**. La UI de recepción está disponible y se detecta texto de ticket en pantalla; no se pudo confirmar de forma totalmente determinística en automático que el guardado persistió en DB.
- Evidencias:
  - Vista recepción: `browser:/tmp/codex_browser_invocations/de3cb59bc0d09023/artifacts/artifacts/flujo/step1-recepcion-view.png`
  - Intento de acción: `browser:/tmp/codex_browser_invocations/780407338f40d660/artifacts/artifacts/flujo/step1-recepcion-action.png`

## 2) Procesar a Producción
- Se abrió el módulo de producción correctamente.
- Resultado: **parcial**. Se validó acceso y carga del panel de clasificación, pero la automatización no ejecutó una clasificación completa de lote (faltó seleccionar lote y parametrización completa para confirmar guardado).
- Evidencia:
  - `browser:/tmp/codex_browser_invocations/ad234aacb1a69db7/artifacts/artifacts/flujo/step2-produccion.png`

## 3) Movimientos en Inventarios
- Se abrió inventarios y se ejecutó interacción real (apertura de historial kardex de lote).
- Resultado: **OK en interacción**, **parcial en flujo** (no se completó baja/traslado persistente end-to-end en esta corrida).
- Evidencia:
  - `browser:/tmp/codex_browser_invocations/3dff2eb2775c9fc0/artifacts/artifacts/flujo/step3-inventarios-mov.png`

## 4) Envío a Bodega CDMX
- Se abrió pestaña `Enviar a CDMX` en inventarios.
- Resultado: **parcial**. Se validó entrada al flujo de transferencias; no quedó confirmación inequívoca de transferencia creada en esta corrida automatizada.
- Evidencia:
  - `browser:/tmp/codex_browser_invocations/0db3d7c6e01bdfdb/artifacts/artifacts/flujo/step4-envio-cdmx.png`

## 5) Venta en Punto de Venta (Bodega CDMX)
- Se abrió POS, se agregó producto al carrito (carrito con item visible, total > 0, botón `Pagar` habilitado).
- Al intentar cobrar, aparece error de backend:
  - **`Error al procesar la venta`**
  - **`null value in column "cliente_id" of relation "pagos_clientes" violates not-null constraint`**
- Resultado: **FAIL funcional** (la venta no se completa).
- Evidencia:
  - Estado con carrito y total: `browser:/tmp/codex_browser_invocations/8e02f9a79e113935/artifacts/artifacts/flujo/step5-pos-venta-processed3.png`

## Conclusión ejecutiva
- El flujo completo solicitado **no pasa end-to-end**.
- Bloqueador crítico detectado y reproducido: **venta POS falla por `cliente_id` nulo al insertar en `pagos_clientes`**.
- Siguiente corrección recomendada: revisar función RPC/proceso de cobro para garantizar `cliente_id` válido (fallback a “Público en general”) antes de insertar pago.
