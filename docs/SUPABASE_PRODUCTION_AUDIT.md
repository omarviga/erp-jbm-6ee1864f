# Auditoria Supabase para Produccion

Fecha: 2026-03-13

## Objetivo

Este documento resume el estado actual de Supabase para salida a produccion y los puntos que conviene cerrar antes del go-live.

## Hallazgos

### 1. Base general de RLS muy abierta en tablas historicas

En la migracion inicial [20260117162601_58c72984-0d2a-40fc-8aa1-878fa929ae6c.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260117162601_58c72984-0d2a-40fc-8aa1-878fa929ae6c.sql) se habilita RLS, pero muchas politicas permiten `SELECT/INSERT/UPDATE` a `authenticated` con `USING (true)` o `WITH CHECK (true)`.

Impacto:
- cualquier usuario autenticado puede tener mas alcance del deseado si no hubo endurecimiento posterior tabla por tabla
- el riesgo mas importante no es CDMX, sino tablas legacy del core

Accion requerida:
- levantar un inventario final de politicas efectivas por tabla critica
- confirmar especialmente `ventas`, `venta_detalles`, `pagos_clientes`, `produccion`, `camara_fria`, `insumos`, `guias_salida`, `guia_detalles`

### 2. Clientes ya tiene endurecimiento parcial, pero debe verificarse politica efectiva final

Hay ajustes posteriores en:
- [20260126184139_0eb0016b-45d1-4b8d-b149-f3e59096e830.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260126184139_0eb0016b-45d1-4b8d-b149-f3e59096e830.sql)
- [20260201121000_secure_clientes.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260201121000_secure_clientes.sql)
- [20260305231340_4e17b276-3d3e-4089-9a6f-8e6cd1530cd2.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260305231340_4e17b276-3d3e-4089-9a6f-8e6cd1530cd2.sql)

Accion requerida:
- validar con consultas reales que `ventas` no puede modificar datos financieros sensibles
- validar que solo roles correctos ven `clientes_sensible`

### 3. Facturacion y transportistas siguen demasiado abiertos

En [20260202140000_logistica_facturacion_schema.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260202140000_logistica_facturacion_schema.sql) `transportistas`, `facturas` y `factura_detalles` quedaron con politica de `ALL` para `authenticated`.

Impacto:
- cualquier usuario autenticado podria leer y modificar registros de facturacion/logistica si no hay otra capa compensatoria

Accion requerida:
- reemplazar esa politica por acceso por rol
- separar al menos `SELECT` de `INSERT/UPDATE/DELETE`

Prioridad:
- alta

### 4. CDMX esta mejor endurecido que el resto

La capa CDMX tiene politicas especificas en:
- [20260309040512_a7ed14e8-d583-4ea7-b324-04f50b6bd985.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309040512_a7ed14e8-d583-4ea7-b324-04f50b6bd985.sql)
- [20260309133000_fix_transferencias_visibility_and_permissions.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309133000_fix_transferencias_visibility_and_permissions.sql)
- [20260312150000_add_tickets_pos_cdmx_table.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260312150000_add_tickets_pos_cdmx_table.sql)

Puntos favorables:
- `inventario_bodega_cdmx` solo lectura por rol
- escrituras sensibles forzadas por funciones
- `tickets_pos_cdmx` solo visible para admin/ventas
- `procesar_venta_cdmx` valida rol dentro de la funcion

Accion requerida:
- validar que operadores de caja usen rol `ventas`
- validar que almacen/produccion no puedan ver tickets POS si eso no es deseado

### 5. Recepcion de transferencias ya fuerza autenticacion, pero necesita verificacion de permisos reales

`procesar_recepcion_transferencia` fue reforzada en:
- [20260309061506_879f338e-0076-458e-af8e-8600568ca0ad.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309061506_879f338e-0076-458e-af8e-8600568ca0ad.sql)

Accion requerida:
- probar con usuarios de `almacen`, `produccion`, `ventas` y `admin`
- confirmar exactamente quien puede ejecutar recepcion y quien solo puede consultar

### 6. Tickets de gastos/evidencias pueden ser demasiado publicos

En [20260309033821_43fd723e-a557-4f50-90de-9af533c9233c.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309033821_43fd723e-a557-4f50-90de-9af533c9233c.sql) aparece politica tipo `Anyone can view tickets`.

Impacto:
- si el bucket contiene comprobantes sensibles, la exposicion puede ser mayor a la deseada

Accion requerida:
- verificar si el bucket realmente debe ser publico
- si no, mover a acceso firmado o por rol

Prioridad:
- alta si hay documentos fiscales o evidencias internas

### 7. Falta evidencia explicita de grants finales para todos los RPC criticos

Se observan grants para varios RPC operativos, por ejemplo en:
- [20260309090000_add_inventario_rpc.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309090000_add_inventario_rpc.sql)
- [20260309093000_add_registrar_envio_cdmx_rpc.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309093000_add_registrar_envio_cdmx_rpc.sql)
- [20260309101500_add_envio_cdmx_transporte_directo_rpc.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309101500_add_envio_cdmx_transporte_directo_rpc.sql)
- [20260309143000_add_sync_productor_saldo_pendiente_rpc.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309143000_add_sync_productor_saldo_pendiente_rpc.sql)

Accion requerida:
- confirmar grants efectivos de `procesar_venta_cdmx`, `procesar_recepcion_transferencia` y `calcular_efectivo_teorico_corte`
- documentar lista final de RPC productivos y roles esperados

## Semaforo actual

- Verde:
  - modulo CDMX principal
  - tickets POS separados
  - corte y recepcion con reglas endurecidas
- Amarillo:
  - grants y RLS efectivos deben auditarse en entorno real
  - storage/tickets necesita confirmacion
- Rojo:
  - politicas legacy demasiado abiertas en tablas historicas
  - facturacion/logistica con `ALL` para `authenticated`

## Checklist tecnico antes de go-live

- listar politicas efectivas con:
  - `select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check from pg_policies order by tablename, policyname;`
- listar funciones `SECURITY DEFINER` con:
  - `select n.nspname as schema, p.proname as function_name, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by p.proname;`
- listar grants ejecutables con:
  - `select routine_name, privilege_type, grantee from information_schema.routine_privileges where specific_schema = 'public' order by routine_name, grantee;`
- probar manualmente login con roles:
  - `admin`
  - `ventas`
  - `almacen`
  - `produccion`
  - `finanzas`
- confirmar acceso real a:
  - `clientes`
  - `clientes_sensible`
  - `facturas`
  - `transportistas`
  - `ventas`
  - `pagos_clientes`
  - `tickets_pos_cdmx`
  - `inventario_bodega_cdmx`
  - `transferencias_bodega`

## Recomendacion final

No haria go-live pleno sin antes cerrar:
1. reemplazo de politicas `authenticated + true` en tablas legacy sensibles
2. endurecimiento de `facturas`, `factura_detalles` y `transportistas`
3. validacion final de storage para tickets/evidencias
