# Lista de features

El backlog vive en un archivo por feature: [`features/F-###.json`](features/). Así dos agentes pueden actualizar features distintos sin editar una lista central. `npm run features:list` compone la lista y `npm run features:check` valida su estructura y relaciones.

## Estados

| Estado | Significado |
| --- | --- |
| `pending` | Priorizado, sin dueño ni cambios iniciados. |
| `claiming` | Un agente creó ticket y rama; está publicando la draft PR de reclamo. Estado transitorio. |
| `in_progress` | Draft PR publicada; dueño, ticket, rama y módulos visibles. |
| `blocked` | El dueño documentó el bloqueo y el siguiente paso en el ticket. |
| `in_review` | Código y gates terminados; PR abierta para revisión ajena. |
| `done` | PR abierta, gates y revisión ajena aprobados, handoff completo. Espera merge humano. |
| `merged` | El humano fusionó la PR a `main`; el código quedó integrado. |

`done` ocurre **antes** del merge. `merged` no significa que una dependencia externa ya esté operativa: registra la integración del código. Las limitaciones externas permanecen en `roadmap_note` y en un feature de seguimiento.

## Reclamar y coordinar

1. Actualiza `main` desde `origin/main` y consulta `npm run features:list`, los tickets y las PR abiertas (`gh pr list`). Un feature reclamado en una PR aún no aparecerá en `main` hasta el merge.
2. Reclama solo un feature `pending`. Crea `T-###`, una rama `feature/t-###-resumen` y cambia **su único JSON** a `claiming` con `owner`, `ticket`, `branch` y `allowed_modules`. Publica la rama y abre una **draft PR de reclamo** de inmediato; el título debe incluir `F-###` y `T-###` para que los demás agentes vean la asignación remota. Registra la URL de la PR y pasa a `in_progress`.
3. No trabajes sobre módulos de otro feature activo. Enumera rutas exactas en `allowed_modules` para que el validador detecte reclamaciones duplicadas. Si un contrato compartido debe cambiar, acuerda ese contrato en los tickets antes de editarlo. Usa un worktree o checkout aislado por agente; nunca compartas el mismo working tree entre agentes simultáneos.
4. Mantén ticket y JSON al día. Si un bloqueo impide avanzar, usa `blocked` y explica condición y siguiente paso. Al reanudar, vuelve a `in_progress`.
5. Tras implementar y pasar los cuatro gates, cambia a `in_review`. Cuando otro agente revise los cambios de interfaz/dominio, deje evidencia y el handoff esté completo, cambia a `done` en la PR. Solo el humano fusiona a `main`; el workflow posterior comprueba el merge en GitHub y actualiza el feature a `merged` mediante un commit de metadatos.

La última transición no debe hacerse anticipadamente. El workflow `sync-merged-features.yml` corre tras pushes a `main`, comprueba en GitHub que cada PR de un feature `done` fue fusionada **a `main`**, proviene de su rama y modificó su JSON, y registra número, fecha y commit antes de escribir `merged`. También recupera registros `done` anteriores; no marca PR fusionadas a ramas intermedias ni PR ajenas al feature. Si el job falla, el estado permanece `done` y se puede reejecutar manualmente desde Actions. El commit automático solo cambia JSON de features; no aprueba ni fusiona PR. Como los pushes hechos con `GITHUB_TOKEN` no disparan otro CI, el propio job corre los gates antes de publicar.

Crear tickets, ramas, worktrees, commits y PR es trabajo autónomo de los agentes. No se solicita aprobación humana para esas acciones; el único acto reservado al humano es autorizar y ejecutar el merge.

## Campos

`id`, `name`, `title`, `description`, `plan`, `acceptance`, `sdd`, `status` y `roadmap_note` siguen el ejemplo de backlog. `sdd: true` exige contrato escrito en el ticket antes de cambiar módulos compartidos. `owner`, `ticket`, `branch`, `pr`, `depends_on`, `allowed_modules`, `reviewed_by` y `evidence` aportan coordinación y trazabilidad. Los módulos permitidos se fijan al reclamar, no son una reserva mientras el feature esté `pending`.

Los registros F-001 y F-002 documentan trabajo anterior a este protocolo y tienen `legacy_record: true`; el validador limita esa excepción a esos dos IDs. Los datos no disponibles quedan en `null` o vacíos en vez de inventarse. Para nuevos features, `merged` exige PR, revisión ajena y evidencia de los cuatro gates; confirmar que el merge ocurrió sigue siendo una verificación contra GitHub, no algo que el JSON local pueda demostrar por sí solo.
