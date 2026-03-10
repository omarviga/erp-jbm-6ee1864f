# Prueba funcional módulo por módulo — Omar Vieyra

Fecha: 2026-03-10
Ambiente: local (`http://127.0.0.1:4173`)

## Hallazgo inicial de acceso
- Con el correo proporcionado `omarvieyra@hotnail.com` el sistema rechaza login: **"Correo o contraseña incorrectos"**.
- Con `omarvieyra@hotmail.com` + `Romaesoj21` el login **sí** entra y permite navegar módulos.

## Resultado por módulo (sesión autenticada)
- Dashboard (`/`): PASS (carga inicial OK)
- Recepción (`/recepcion`): PASS (carga inicial OK)
- Producción (`/produccion`): PASS (carga inicial OK)
- Inventarios (`/inventarios`): PASS (carga inicial OK)
- Ventas (`/ventas`): PASS (carga inicial OK)
- Finanzas (`/finanzas`): PASS (carga inicial OK)
- Logística (`/logistica`): PASS (carga inicial OK)
- Facturación (`/facturacion`): PASS (carga inicial OK)
- Configuración (`/configuracion`): PASS (carga inicial OK)
- Bodega CDMX (`/bodega-cdmx`): PASS (carga inicial OK)
- Productores (`/productores`): PASS (carga inicial OK)

> Nota: esta corrida validó **carga y navegación inicial** de cada módulo. No cubre todavía flujos profundos transaccionales por módulo (crear/editar/procesar fin a fin).

## Evidencias (capturas)
### Parte 1
- Dashboard: `browser:/tmp/codex_browser_invocations/0b8142fe79b90cfb/artifacts/artifacts/modcheck/part1-01-Dashboard.png`
- Recepción: `browser:/tmp/codex_browser_invocations/0b8142fe79b90cfb/artifacts/artifacts/modcheck/part1-02-Recepcion.png`
- Producción: `browser:/tmp/codex_browser_invocations/0b8142fe79b90cfb/artifacts/artifacts/modcheck/part1-03-Produccion.png`
- Inventarios: `browser:/tmp/codex_browser_invocations/0b8142fe79b90cfb/artifacts/artifacts/modcheck/part1-04-Inventarios.png`
- Ventas: `browser:/tmp/codex_browser_invocations/0b8142fe79b90cfb/artifacts/artifacts/modcheck/part1-05-Ventas.png`
- Finanzas: `browser:/tmp/codex_browser_invocations/0b8142fe79b90cfb/artifacts/artifacts/modcheck/part1-06-Finanzas.png`

### Parte 2
- Logística: `browser:/tmp/codex_browser_invocations/4f257ed475472edd/artifacts/artifacts/modcheck/part2-01-Logistica.png`
- Facturación: `browser:/tmp/codex_browser_invocations/4f257ed475472edd/artifacts/artifacts/modcheck/part2-02-Facturacion.png`
- Configuración: `browser:/tmp/codex_browser_invocations/4f257ed475472edd/artifacts/artifacts/modcheck/part2-03-Configuracion.png`
- Bodega CDMX: `browser:/tmp/codex_browser_invocations/4f257ed475472edd/artifacts/artifacts/modcheck/part2-04-BodegaCDMX.png`
- Productores: `browser:/tmp/codex_browser_invocations/4f257ed475472edd/artifacts/artifacts/modcheck/part2-05-Productores.png`
