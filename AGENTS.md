# Loop de ingeniería

Todo agente (Codex o Claude) sigue este ciclo: **ticket → contrato → implementación → pruebas → revisión → validación → commit → handoff**.

## Antes de cambiar código

1. Consulta `docs/engineering/FEATURES.md`, `npm run features:list` y las PR abiertas. Reclama un feature `pending` y crea su ticket `docs/engineering/tasks/T-###.md` con objetivo, dueño, módulos permitidos y aceptación. Publica una draft PR de reclamo para que otros agentes vean el trabajo en curso.
2. Lee el ticket y los contratos afectados. No modifiques módulos asignados a otro agente.
3. Trabaja en `feature/<ticket>-<resumen>`; commits Conventional Commits, pequeños y verificables.
4. Si varios agentes trabajan a la vez, cada uno usa un worktree o checkout aislado y edita solo su archivo `docs/engineering/features/F-###.json` y sus módulos asignados.

Los agentes crean por su cuenta tickets, ramas, worktrees, commits y PR; esas acciones no requieren aprobación humana del flujo de ingeniería. El humano interviene únicamente para autorizar y ejecutar el merge de la PR.

## Gates obligatorios

- Contrato: tipos/API acordados antes de tocar módulos compartidos.
- Calidad: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` antes de cerrar.
- Handoff: dejar evidencia de comandos, resultado, archivos, riesgos y siguiente paso en el ticket.
- Revisión: otro agente revisa la interfaz y los cambios de dominio antes de fusionar a `main`.
- PR de handoff: al terminar cada ticket, el agente crea una Pull Request (PR) desde su rama de trabajo, con el ticket, evidencia de los gates, riesgos y siguiente paso enlazados.
- Estado: `in_review` al abrir la revisión; `done` solo después de gates, revisión ajena y handoff, siempre antes del merge; `merged` solo tras el merge humano. `npm run features:check` valida el registro.
- Autoridad de merge: ningún agente puede aprobar ni fusionar una PR. Solo el humano propietario del repositorio puede hacer merge a `main` después de la revisión requerida.

## Propiedad inicial

- Codex: integración, arquitectura, CI, documentación y revisión.
- Claude: tickets aislados de UI, dominio, datos o pruebas según el ticket.
- No hay scraping prohibido: solo APIs autorizadas, feeds públicos, datos estructurados o enlaces aportados por usuarios.
