# Matriz de Acceso por Rol (JBM ERP)

Fecha: 2026-05-06  
Estado: Vigente

## Objetivo
Definir de forma explícita qué módulos puede usar cada rol implementado en el sistema y cómo se alinea con los nombres operativos de la guía de usuario.

## Equivalencia de Roles (Guía -> Sistema)

| Guía operativa | Rol técnico en sistema |
| --- | --- |
| `admin_owner` | `admin` |
| `bascula` | `almacen` |
| `almacen / logistica` | `almacen` |
| `cdmx_operator` | `ventas` |
| `produccion` | `produccion` |
| `finanzas` | `finanzas` |

## Matriz de Módulos por Rol

| Módulo / Ruta | admin | almacen | produccion | finanzas | ventas |
| --- | --- | --- | --- | --- | --- |
| Dashboard `/` | Si | Si | Si | Si | Si |
| Recepción `/recepcion` | Si | Si | No | No | No |
| Producción `/produccion` | Si | No | Si | No | No |
| Inventarios `/inventarios` | Si | Si | Si | No | No |
| Logística `/logistica` | Si | Si | No | No | No |
| Bodega CDMX `/bodega-cdmx` | Si | Si | No | Si | Si |
| Facturación `/facturacion` | Si | No | No | Si | No |
| Finanzas `/finanzas` | Si | No | No | Si | No |
| Insumos `/insumos` | Si | Si | Si | No | No |
| Reportes `/reportes` | Si | No | No | Si | No |
| Productores `/productores` | Si | Si | No | Si | No |
| Configuración `/configuracion` | Si | No | No | No | No |
| Lote Expediente `/lotes/:loteId` | Si | Si | Si | Si | No |
| Maquila `/maquila` | Si | No | Si | No | No |
| Gastos `/gastos` | Si | No | No | Si | No |
| Gestión de Usuarios `/admin/usuarios` | Si | No | No | No | No |
| Ayuda `/ayuda` | Si | Si | Si | Si | Si |

## Notas de implementación

- La restricción por ruta se aplica en `ProtectedRoute` con `allowedRoles`.
- El menú lateral filtra módulos por rol para evitar accesos visuales incorrectos.
- `admin` conserva acceso total.
- Por acuerdo operativo, no se aplica validación de flujo ciego como requisito de cumplimiento.
