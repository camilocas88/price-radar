# Loop de ingeniería

Todo agente (Codex o Claude) sigue este ciclo: **ticket → contrato → implementación → pruebas → revisión → validación → commit → handoff**.

## Antes de cambiar código

1. Crea o reclama un ticket `docs/engineering/tasks/T-###.md` con objetivo, dueño, módulos permitidos y aceptación.
2. Lee el ticket y los contratos afectados. No modifiques módulos asignados a otro agente.
3. Trabaja en `feature/<ticket>-<resumen>`; commits Conventional Commits, pequeños y verificables.

## Gates obligatorios

- Contrato: tipos/API acordados antes de tocar módulos compartidos.
- Calidad: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` antes de cerrar.
- Handoff: dejar evidencia de comandos, resultado, archivos, riesgos y siguiente paso en el ticket.
- Revisión: otro agente revisa la interfaz y los cambios de dominio antes de fusionar a `main`.

## Propiedad inicial

- Codex: integración, arquitectura, CI, documentación y revisión.
- Claude: tickets aislados de UI, dominio, datos o pruebas según el ticket.
- No hay scraping prohibido: solo APIs autorizadas, feeds públicos, datos estructurados o enlaces aportados por usuarios.
