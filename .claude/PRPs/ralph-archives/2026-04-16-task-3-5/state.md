---
iteration: 1
max_iterations: 20
plan_path: ".claude/orchestration-hand-tracker-fx/tasks/phase-3/task-3-5.md"
input_type: "plan"
started_at: "2026-04-16T04:00:00.000Z"
---

# PRP Ralph Loop State — Task 3.5

## Codebase Patterns
- Renderer SURVIVES context loss per task file ("we reuse the existing canvas + existing gl"). Only Texture + Program + Mesh + rVFC need re-init on restore.
- e.preventDefault() in webglcontextlost MUST be synchronous — ungated async breaks webglcontextrestored.
- Stage.tsx currently inlines renderer + texture creation in one useEffect. Refactor: extract `mountTexture(gl)` inner closure so both initial mount AND restore can call it.
- App.tsx's render-loop effect depends on `[state, videoEl]`. Add `textureGen` — when Stage signals restore, bump `textureGen` so App tears down + rebuilds effectInstance with the new texture.
- getExtension('WEBGL_lose_context') returns null on rare hardware — treat as absent, do NOT throw.

## Progress Log
## Iteration 1 — 2026-04-16T04:00:00.000Z — orientation
- Plan: renderer.ts helpers → unit tests → Stage refactor + onTextureRecreated prop → App state bump → devHooks force APIs → E2E → L1-L4.

---
