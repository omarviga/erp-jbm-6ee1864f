---
name: creating-skills
description: Genera y estructura nuevas habilidades (skills) para el agente Antigravity siguiendo estándares técnicos estrictos. Úsalo cuando necesites automatizar tareas recurrentes o añadir nuevas capacidades lógicas al sistema.
---
# Skill para Creación de Skills

## Cuándo usar este skill
- Cuando el usuario solicite una nueva funcionalidad automatizada.
- Para estandarizar la lógica de herramientas personalizadas.
- Al expandir las capacidades del agente en áreas específicas (p. ej., despliegue, auditoría, migraciones).

## Flujo de trabajo

1.  **Planificación (Planning)**
    - [ ] Definir el nombre en gerundio (ej. `auditing-code`).
    - [ ] Identificar disparadores y palabras clave.
2.  **Validación de Estructura (Validation)**
    - [ ] Comprobar si existe la carpeta `.agent/skills/<skill-name>`.
    - [ ] Verificar que no existan nombres duplicados o conflictivos.
3.  **Ejecución (Execute)**
    - [ ] Crear el directorio del skill.
    - [ ] Generar `SKILL.md` con el frontmatter YAML obligatorio.
    - [ ] (Opcional) Crear carpetas `scripts/`, `examples/` o `resources/`.

## Instrucciones

### Estándares de Nombre
- Máximo 64 caracteres.
- Solo minúsculas, números y guiones.
- Sin palabras prohibidas ("claude", "anthropic").

### Estándares de Contenido
- **Gerundio en Name**: Siempre terminar en `-ing` (o equivalente en inglés/lógica del sistema).
- **Tercera Persona**: Descripción objetiva (ej. "Valida configuraciones de red...").

### Manejo de Errores
- Si un script falla, intenta ejecutar con `--help`.
- Si el YAML es inválido, el sistema ignorará el skill.

## Recursos
- [.agent/skills/](file:///c:/Users/oviey/jbm-cloud-main/.agent/skills/)
