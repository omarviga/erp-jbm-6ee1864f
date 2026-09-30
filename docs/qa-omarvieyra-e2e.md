# Prueba funcional integral por módulos (usuario: omarvieyra@hotnail.com)

Fecha: 2026-03-10

## Resultado general
No fue posible ejecutar pruebas autenticadas por módulo porque el inicio de sesión falló con las credenciales proporcionadas.

## Evidencia de autenticación
- Intento de login en `/login` con:
  - correo: `omarvieyra@hotnail.com`
  - contraseña: `Romaesoj21`
- Resultado en UI: **"Correo o contraseña incorrectos"**.
- URL posterior al intento: `http://127.0.0.1:4173/login` (sin sesión activa).

Captura:
- `browser:/tmp/codex_browser_invocations/2aa755ce93fae2ec/artifacts/artifacts/e2e/login-attempt.png`

## Rutas verificadas (sin sesión)
Se intentó navegación a módulos principales, pero al no autenticarse se redirecciona a login o se bloquea el acceso:
- `/recepcion`
- `/produccion`
- `/inventarios`
- `/ventas`
- `/finanzas`
- `/logistica`
- `/facturacion`
- `/configuracion`
- `/bodega-cdmx`
- `/productores`

## Siguiente paso requerido para completar la prueba "módulo por módulo"
1. Confirmar credenciales válidas del usuario de pruebas (posible typo en dominio de correo).
2. Repetir barrido E2E autenticado en cada módulo y documentar:
   - carga de listados,
   - creación/edición mínima,
   - permisos por rol,
   - errores de red/RLS.
