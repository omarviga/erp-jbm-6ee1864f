---
name: reviewing-code
description: Revisa y corrige código en el proyecto actual. Identifica errores lógicos, de estilo, vulnerabilidades de seguridad y problemas de rendimiento. Úsalo cuando el usuario pida "revisar", "corregir", "refactorizar" o "auditar" el código.
---
# Skill para Revisión y Corrección de Código

## Cuándo usar este skill
- Cuando el usuario solicita una revisión general o específica de un archivo.
- Al encontrar errores de ejecución o advertencias del linter.
- Para mejorar la mantenibilidad y legibilidad del código.

## Flujo de trabajo

1.  **Análisis Estático (Plan)**
    - [ ] Listar archivos relevantes.
    - [ ] Leer el contenido de los archivos sospechosos.
    - [ ] Identificar patrones de error comunes (ej. falta de manejo de errores, dependencias circulares).
2.  **Verificación de Herramientas (Validate)**
    - [ ] Comprobar si existen linter/testers (`eslint`, `vitest`).
    - [ ] Verificar si `node_modules` está instalado.
3.  **Corrección (Execute)**
    - [ ] Aplicar correcciones incrementales.
    - [ ] Documentar los cambios realizados.

## Instrucciones

### Criterios de Revisión
- **Correctitud**: ¿Funciona según lo esperado? ¿Maneja errores de red?
- **Seguridad**: ¿Hay exposición de credenciales? ¿Falta validación de entrada (Zod)?
- **Rendimiento**: ¿Hay re-renders innecesarios? ¿Queries pesadas?
- **Estándares**: ¿Sigue las convenciones del proyecto (Shadcn, Tailwind)?

### Manejo de Entorno (Windows)
- Siempre usar `npm run <script>` o `npx <command>`.
- Si `node_modules` falta, notificar al usuario antes de instalar.

## Recursos
- [.agent/skills/creating-skills/](file:///c:/Users/oviey/jbm-cloud-main/.agent/skills/creating-skills/)
