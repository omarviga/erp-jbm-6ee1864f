# Módulo de Campo — Fase 1 (limón)

## Situación actual verificada

- Ya existe una tabla de **huertos** con nombre, ubicación (texto) y hectáreas, administrada desde Configuración. No tiene productor asociado, cultivo, variedad, fecha de plantación ni mapa.
- Cada recepción de báscula ya guarda el huerto (`lotes.huerto_id`), pero el selector de huerto **solo aparece cuando la entrada se marca como cosecha propia**. Las compras a terceros quedan sin huerto de origen.
- No existe nada de bitácora de labores, monitoreos ni estimaciones de cosecha.
- Las tablas que menciona el brief (`batches`, `company_settings`, `cold_storage_settings`) no existen en este sistema; la recepción vive en `lotes`. El plan se ajusta a la estructura real.
- El bug de la cuota de báscula queda fuera de este plan, como se acordó.

## Lo que se construye

### 1. Huertos con ficha completa y mapa

Se amplía el huerto existente (sin perder los ya registrados) con: productor asociado, cultivo, variedad, municipio, superficie, fecha de plantación y **polígono dibujado sobre mapa**. Se añade además la opción de dividir un huerto en **lotes de campo** (secciones con su propio polígono y superficie), opcional.

Pantalla nueva **Campo → Huertos**: listado con buscador, alta/edición con mapa para dibujar el contorno, y ficha de huerto.

### 2. Bitácora de labores

Registro por huerto (y opcionalmente por sección) de: riego, fertilización, aplicación fitosanitaria, poda y monitoreo. Cada registro guarda fecha, insumo y dosis, responsable, costo y notas.

Listado con filtros por tipo y rango de fechas, y alta rápida pensada para celular (botones grandes, pocos campos obligatorios).

### 3. Monitoreos con fotos

Inspecciones con tipo de hallazgo, severidad, notas y fotos de evidencia guardadas de forma privada. Se deja reservado un campo para la clasificación automática de la Fase 2, sin usarse todavía.

### 4. Estimaciones de cosecha

Captura por huerto de fecha estimada de corte y volumen esperado. La ficha del huerto muestra la estimación vigente.

### 5. Cierre del ciclo con báscula

En Recepción, el selector de huerto pasa a estar **disponible también para compras a terceros**, filtrado por el productor elegido, y sigue siendo obligatorio solo en cosecha propia. Así cada camión queda ligado a su huerto de origen.

### 6. Ficha de huerto

Vista única por huerto: mapa, datos generales, últimas labores, estimación vigente y el historial de recepciones ya ligadas (folio, fecha, kilos), con el acumulado de kilos recibidos de ese huerto.

### 7. Captura sin señal

Las altas de labores, monitoreos y estimaciones se guardan en el propio teléfono cuando no hay internet y se envían automáticamente al recuperar señal. Indicador visible de "pendientes por sincronizar" y reintento manual. Las fotos también se conservan mientras no haya conexión.

### 8. Accesos

- Capataz / personal de campo: captura de labores, monitoreos y estimaciones.
- Personal de empacadora: lo anterior más asociación en Recepción y consulta de historial.
- Productor externo: acceso limitado de solo lectura y captura sobre **sus** huertos únicamente.

## Detalles técnicos

- Migraciones **aditivas**: nuevas columnas nulables en `huertos`, nuevas tablas `cultivos_catalogo`, `huerto_lotes`, `campo_eventos`, `campo_monitoreos`, `campo_estimaciones_cosecha`. Sin cambios destructivos en `lotes` (`huerto_id` ya existe).
- Polígonos en GeoJSON (columna `jsonb`), mapa con Leaflet + Leaflet-Draw.
- RLS por rol; el acceso del productor se resuelve con un vínculo usuario→productor y política que limita a sus huertos. Se siembra `cultivos_catalogo` con limón (papaya, aguacate y fresa quedan listos pero fuera de alcance).
- Fotos en un bucket privado con URLs firmadas, siguiendo el patrón ya usado para tickets de gastos.
- Cola offline en IndexedDB con reintento, siguiendo el patrón del flujo de báscula.
- Nueva sección "Campo" en el menú, con rutas protegidas por rol.

## Fuera de alcance

Multi-tenant, otros cultivos, cualquier capa de IA/satelital, nómina a destajo, y el bug de cuota de báscula.

## Piloto

Dimensionado para 10 a 50 huertos y varios capataces/productores.
