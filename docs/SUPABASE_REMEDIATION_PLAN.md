# Plan de Remediacion Supabase

Fecha: 2026-03-13

## Prioridad P0

### 1. Cerrar politicas legacy con acceso total a `authenticated`

Fuente principal:
- [20260117162601_58c72984-0d2a-40fc-8aa1-878fa929ae6c.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260117162601_58c72984-0d2a-40fc-8aa1-878fa929ae6c.sql#L345)

Problema:
- muchas tablas quedaron con `SELECT`, `INSERT` o `UPDATE` habilitados a cualquier usuario autenticado con `USING (true)` o `WITH CHECK (true)`

Riesgo:
- sobreexposicion de datos
- modificaciones no autorizadas en modulos legacy

Accion:
- crear una migracion de endurecimiento que reemplace politicas abiertas por politicas por rol
- empezar por tablas sensibles:
  - `ventas`
  - `venta_detalles`
  - `pagos_clientes`
  - `clientes`
  - `produccion`
  - `camara_fria`
  - `guias_salida`
  - `guia_detalles`

### 2. Endurecer `facturas`, `factura_detalles` y `transportistas`

Fuente:
- [20260202140000_logistica_facturacion_schema.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260202140000_logistica_facturacion_schema.sql#L68)

Problema:
- las tres tablas usan `FOR ALL TO authenticated USING (true)`

Riesgo:
- cualquier usuario autenticado podria leer y modificar facturacion o catalogo de transportistas

Accion:
- dividir politicas en `SELECT`, `INSERT`, `UPDATE`, `DELETE`
- sugerencia de alcance:
  - `admin` y `finanzas`: lectura/escritura en `facturas` y `factura_detalles`
  - `ventas`: solo lectura o acciones controladas si de verdad se necesitan
  - `transportistas`: `admin` y logistica/ventas segun operacion real

### 3. Revisar storage publico de tickets/evidencias

Fuente:
- [20260309033821_43fd723e-a557-4f50-90de-9af533c9233c.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309033821_43fd723e-a557-4f50-90de-9af533c9233c.sql#L59)

Problema:
- el bucket `gastos-tickets` se crea como publico
- la politica de lectura esta pensada para `authenticated`, pero el bucket publico puede hacer eso irrelevante

Riesgo:
- exposicion de tickets, comprobantes o evidencias internas

Accion:
- confirmar si de verdad debe ser publico
- si no, cambiar bucket a privado y usar URLs firmadas
- separar evidencias operativas de comprobantes financieros si conviene

## Prioridad P1

### 4. Auditar grants ejecutables de RPC criticos

Funciones criticas localizadas en:
- [20260309040512_a7ed14e8-d583-4ea7-b324-04f50b6bd985.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309040512_a7ed14e8-d583-4ea7-b324-04f50b6bd985.sql#L136)
- [20260309040512_a7ed14e8-d583-4ea7-b324-04f50b6bd985.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309040512_a7ed14e8-d583-4ea7-b324-04f50b6bd985.sql#L274)
- [20260312150000_add_tickets_pos_cdmx_table.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260312150000_add_tickets_pos_cdmx_table.sql#L32)

Funciones:
- `procesar_recepcion_transferencia`
- `calcular_efectivo_teorico_corte`
- `procesar_venta_cdmx`

Accion:
- ejecutar consulta real sobre `information_schema.routine_privileges`
- documentar que roles/usuarios pueden ejecutar cada RPC
- confirmar que no haya grants heredados o ausentes

### 5. Revisar notificaciones y otros objetos de sistema

Fuentes:
- [20260309045429_eda699d2-57e0-440a-967b-d25dc310ed82.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309045429_eda699d2-57e0-440a-967b-d25dc310ed82.sql)
- [20260309061506_879f338e-0076-458e-af8e-8600568ca0ad.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309061506_879f338e-0076-458e-af8e-8600568ca0ad.sql)

Accion:
- confirmar que las politicas de notificaciones no dejan crear registros desde clientes no deseados
- verificar que los cambios de refuerzo posteriores sean los efectivos

### 6. Revisar acceso a `inventario_kardex`

Fuente:
- [20260309124500_enable_kardex_read_for_authenticated.sql](/C:/Users/oviey/erp-jbm-6ee1864f/supabase/migrations/20260309124500_enable_kardex_read_for_authenticated.sql#L5)

Problema:
- lectura abierta para `authenticated`

Accion:
- decidir si cualquier rol autenticado debe ver kardex completo
- si no, limitar a `admin`, `almacen`, `produccion`

## Prioridad P2

### 7. Consolidar estrategia de roles por modulo

Hoy se ve mezcla de criterios entre:
- `admin`
- `ventas`
- `almacen`
- `produccion`
- `finanzas`

Accion:
- definir matriz oficial rol x modulo x accion
- usar esa matriz para alinear politicas y RPCs

## Entregables sugeridos

### Migracion A: `hardening_legacy_rls.sql`

Objetivo:
- cerrar tablas legacy abiertas

### Migracion B: `lock_down_facturacion_transportistas.sql`

Objetivo:
- sustituir `FOR ALL TO authenticated USING (true)` por politicas por rol

### Migracion C: `secure_storage_tickets.sql`

Objetivo:
- privatizar bucket o separar acceso firmado

## Consulta minima para ejecutar en produccion

```sql
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
order by tablename, policyname;

select routine_name, privilege_type, grantee
from information_schema.routine_privileges
where specific_schema = 'public'
order by routine_name, grantee;
```

## Criterio de cierre

La auditoria se considera cerrada cuando:

- no existan politicas sensibles con `USING (true)` o `WITH CHECK (true)` para modulos criticos
- `facturas` y `transportistas` ya no esten abiertos a todo `authenticated`
- el acceso a storage quede explicitamente decidido
- RPCs criticos tengan grants verificados
