# Plan: Guía de Usuario JBM ERP — multi-formato, por rol, con capturas reales

## Objetivo

Producir una guía de usuario detallada del sistema JBM ERP, dividida por **rol de usuario**, entregada en tres formatos:

1. **PDF** descargable (`/mnt/documents/Guia_Usuario_JBM_ERP.pdf`)
2. **DOCX** editable (`/mnt/documents/Guia_Usuario_JBM_ERP.docx`)
3. **Página interna** dentro del ERP en `/ayuda` (accesible desde el sidebar)

Cada módulo se documenta con: propósito, quién lo usa, pantallas (capturas reales), flujo paso a paso, reglas de negocio críticas y errores comunes.

## Roles cubiertos

Basados en `AppSidebar.tsx`, `BodegaCDMX/index.tsx` y `useAuth`:

1. **Administrador (admin_owner)** — visión global, configuración, gestión de usuarios, dashboard de rentabilidad.
2. **Báscula / Recepción** — captura de tickets de entrada, generación de deuda a productores.
3. **Producción / Empaque** — clasificación por calibre, generación de cajas y lotes.
4. **Inventarios / Cámara fría / Logística** — control de stock, traslados, envíos a CDMX.
5. **Bodega CDMX (cdmx_operator)** — recepciones, POS, corte de caja, gastos locales.
6. **Finanzas / Cuentas por pagar** — gastos, pagos a productores, conciliación, facturación.
7. **Productores (referencia)** — cómo se reflejan sus saldos y estados de cuenta.

## Estructura del documento (idéntica en PDF y DOCX)

```text
Portada
Tabla de contenidos
1. Introducción al sistema JBM ERP
   - Qué es, arquitectura general, navegación, login
   - Mapa de roles y permisos
2. Guía por Rol
   2.1 Administrador
   2.2 Báscula / Recepción
   2.3 Producción
   2.4 Inventarios / Cámara fría / Logística
   2.5 Bodega CDMX (POS, Recepciones, Inventario, Corte, Gastos, Rentabilidad)
   2.6 Finanzas y Facturación
3. Reglas de negocio críticas
   - Doble precio (precio_base vs precio_venta)
   - Cotejo ciego de transferencias
   - Calibres oficiales (V-4, V-5, V-X, V-XX, V-XXX, V-EXT, AL-*, AM-*)
   - Cuentas por pagar a productores (4 fases)
   - Corte de caja y efectivo teórico
4. Flujos end-to-end
   - Compra → Producción → Inventario → Envío CDMX → Venta POS → Corte
   - Pago a productores
5. Errores comunes y solución
6. Glosario
```

## Captura de pantallas (con browser tool)

Recorrido autenticado en preview, una captura por pantalla principal:

- `/login`, `/` (Dashboard), `/recepcion`, `/produccion`, `/inventarios` (tabs Cámara, Enviar a CDMX), `/logistica`, `/bodega-cdmx` (cada sub-pestaña: POS, Recepciones, Inventario, Corte, Gastos, Dashboard), `/facturacion`, `/finanzas`, `/gastos`, `/maquila`, `/insumos`, `/reportes`, `/productores`, `/admin/usuarios`, `/configuracion`.

Las imágenes se guardan en `/tmp/guia/` y se embeben en PDF/DOCX como base64/binario.

## Generación de los 3 entregables

### A. PDF
- Script Python con `reportlab` (Platypus): portada, TOC, secciones por rol, tablas de reglas, imágenes con caption. QA visual con `pdftoppm` página por página antes de entregar.

### B. DOCX
- Script Node con `docx` (docx-js): mismo contenido, estilos Heading1/2/3, tablas con `WidthType.DXA`, imágenes con `ImageRun type:"png"`, listas con `LevelFormat.BULLET`. Validación post-generación.

### C. Página `/ayuda` dentro del ERP
- Nueva ruta `/ayuda` protegida (cualquier rol autenticado).
- Componente `src/pages/Ayuda.tsx` con:
  - Layout estándar (`MainLayout` + `AppSidebar`).
  - Buscador por palabra clave.
  - Sidebar interno con índice (acordeón por rol).
  - Render del contenido en Markdown desde `src/content/guia-usuario.ts` (mismo texto que PDF/DOCX, fuente única de verdad).
  - Botones "Descargar PDF" y "Descargar DOCX" que apuntan a `/docs/Guia_Usuario_JBM_ERP.pdf` y `.docx` (copiados a `public/docs/`).
- Entrada nueva en `AppSidebar.tsx` ("Ayuda / Guía") visible para todos los roles.
- Botón "Ayuda" también en el sidebar de Bodega CDMX (`BodegaCDMX/index.tsx`).

## Detalles técnicos

- **Fuente única de contenido**: `src/content/guia-usuario.ts` exporta secciones como `{ id, titulo, rol, markdown }`. Los scripts de PDF y DOCX leen este mismo módulo (vía `tsx` o export a JSON intermedio en `/tmp/guia/contenido.json`) para garantizar que los tres formatos digan exactamente lo mismo.
- **Capturas**: nombradas `pant-<modulo>.png` en `/tmp/guia/` y copiadas a `public/docs/img/` para la página interna.
- **Estilo visual**: portada con paleta JBM (`#1E5128` verde corporativo, `#2ECC71` verde lima), logo `src/assets/logo-jbm.png`.
- **Tamaño**: PDF estimado 40–60 páginas; DOCX equivalente; página `/ayuda` con render lazy por sección.
- **QA obligatorio**: tras generar PDF y DOCX, conversión a imágenes y revisión página por página de overflow, cortes y placeholders.

## Orden de ejecución

1. Recorrer el preview autenticado y capturar todas las pantallas a `/tmp/guia/`.
2. Redactar el contenido en `src/content/guia-usuario.ts` (fuente única).
3. Generar PDF con `reportlab` → QA visual → `/mnt/documents/` y `public/docs/`.
4. Generar DOCX con `docx-js` → validar → `/mnt/documents/` y `public/docs/`.
5. Crear página `/ayuda` con buscador, índice y botones de descarga; añadir entradas en sidebars.
6. Entrega final con `<lov-artifact>` para PDF y DOCX, y enlace a la página `/ayuda` dentro del ERP.

## Fuera de alcance

- No se modifican módulos existentes ni reglas de negocio.
- No se traduce a otros idiomas (solo español).
- No se generan videos ni tutoriales interactivos.
