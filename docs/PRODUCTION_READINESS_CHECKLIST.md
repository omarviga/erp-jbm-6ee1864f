# Checklist de Salida a Produccion

Fecha base: 2026-03-13

## 1. Infraestructura

- confirmar proyecto Supabase de produccion separado del de pruebas
- revisar `SUPABASE_URL`, `SUPABASE_ANON_KEY` y secretos del deploy
- validar dominio final, HTTPS y headers basicos
- confirmar backup automatico y responsable de restauracion
- validar acceso de administradores al panel de Supabase y hosting

## 2. Base de datos

- aplicar todas las migraciones pendientes
- documentar version exacta liberada
- exportar snapshot previo a salida
- ejecutar auditoria de politicas descrita en [SUPABASE_PRODUCTION_AUDIT.md](/C:/Users/oviey/erp-jbm-6ee1864f/docs/SUPABASE_PRODUCTION_AUDIT.md)
- validar buckets y politicas de storage

## 3. Roles y usuarios

- crear usuarios reales por area
- asignar rol correcto a cada usuario
- probar login individual con:
  - admin
  - ventas
  - almacen
  - produccion
  - finanzas
- desactivar cuentas temporales o de prueba

## 4. Catalogos base

- presentaciones activas
- clientes base, incluyendo `Público en general`
- transportistas
- productores, huertos y cortadores vigentes
- conceptos de gastos y clasificaciones necesarias

## 5. UAT por modulo

### POS CDMX

- buscar producto con stock
- cambiar cliente
- cobrar en efectivo
- cobrar en transferencia
- bloquear venta por precio debajo del minimo
- verificar ticket en bitacora `tickets_pos_cdmx`
- validar reimpresion y preview

### Corte de Caja CDMX

- abrir corte con ventas del periodo
- verificar resumen por metodo de pago
- revisar auditoria ligera
- revisar conciliacion tickets vs pagos
- cerrar corte cuadrado
- confirmar registro en `cortes_caja_bodega`

### Recepciones CDMX

- abrir transferencia en transito
- confirmar recepcion sin discrepancias
- confirmar recepcion con discrepancias y evidencia
- validar bloqueo si falta foto
- revisar inventario actualizado

### Inventario CDMX

- verificar visibilidad para admin
- verificar ocultamiento de costo para operador
- confirmar promedios y cajas disponibles

### Facturacion

- emitir factura completa
- cancelar factura
- validar permisos por rol

### Finanzas

- registrar gasto
- consultar resumen
- generar impresion/reporte

### Logistica

- generar guia
- consultar historial
- validar datos SAT y transportista

## 6. Operacion y soporte

- definir responsable de primer nivel
- definir a quien escalar errores de Supabase
- preparar canal de incidencias
- documentar horario de monitoreo de primera semana
- dejar procedimiento simple para:
  - reimpresion de ticket
  - ajuste operativo permitido
  - reporte de discrepancia
  - respaldo de evidencia

## 7. Monitoreo de salida

Primeras 72 horas:

- revisar errores frontend cada 2-4 horas
- revisar fallos de RPC en Supabase
- revisar inserciones de:
  - `ventas`
  - `pagos_clientes`
  - `tickets_pos_cdmx`
  - `transferencias_bodega`
  - `cortes_caja_bodega`
- confirmar que no existan tickets huerfanos ni pagos descuadrados

## 8. Comandos de validacion antes de liberar

```sh
npm run lint
npm test
npm run build
```

## 9. Criterio de go-live

La app se considera lista para produccion cuando:

- `lint`, `test` y `build` estan en verde
- no hay migraciones pendientes
- roles reales ya fueron probados
- UAT critica por modulo fue firmada
- auditoria Supabase quedo en amarillo controlado o verde
- existe backup valido y responsable de soporte
