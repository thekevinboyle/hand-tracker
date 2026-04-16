---
iteration: 1
max_iterations: 20
plan_path: ".claude/orchestration-hand-tracker-fx/tasks/phase-3/task-3-1.md"
input_type: "plan"
started_at: "2026-04-16T00:00:00.000Z"
---

# PRP Ralph Loop State — Task 3.1

## Codebase Patterns

- `src/engine/renderer.ts` is new. MIRROR paramStore.ts module shape: named exports, JSDoc on public API, no default export, no React, no classes (pure factories).
- ogl 1.0.11 types live at `node_modules/ogl/types/core/*.d.ts`. `Renderer` accepts `webgl: number` (INTEGER 2 for WebGL 2, not boolean). `Texture` accepts `ImageRepresentation` (includes `HTMLVideoElement`). Texture has no destroy() — Phase 3.5 will call `gl.deleteTexture(texture.texture)`.
- FrameContext.videoTexture is typed `WebGLTexture | null` already (src/engine/types.ts). Null is valid before first upload — effect.render() must tolerate it.
- `src/tracking/errors.ts` exports `WebGLUnavailableError` — reuse if the renderer throws on context-creation failure.
- Dev hook gate: `src/engine/devHooks.ts` uses `import.meta.env.DEV || MODE === 'test' || VITE_EXPOSE_DEV_HOOK === '1'`. Add `__engine.getVideoTextureHandle` here, NOT as a flat prop.
- Existing Stage.tsx owns the webgl-canvas ref; App.tsx owns the render-loop lifetime. The renderer ALSO needs to be owned by Stage (or App) so it can tear down under StrictMode double-invoke. Prior art in App.tsx effect.
- The render loop calls onFrame(ctx) per tick. For Task 3.1 to deliver "live webcam stretched across the WebGL canvas", Stage or App must call uploadVideoFrame + renderer.render({}) each frame — but 3.1 does NOT build a Program/Mesh (that's 3.2/3.4). Absent a Mesh, `renderer.render({})` with no scene draws nothing — so the canvas clears. That's consistent with the task's "default ogl clear is visible until Task 3.4 binds the mesh" success definition.
- Unit tests mock `ogl` via `vi.mock('ogl', ...)`. Mirror paramStore.test.ts strategy. Do not hit real WebGL in L2.
- E2E spec prefix MUST be literal `Task 3.1:` for `--grep "Task 3.1:"` to resolve. Spec lives at `tests/e2e/task-3-1.spec.ts` (or `phase-3-task-3-1`, follow nearest existing naming).

## Current Task

Execute task file at plan_path and iterate until all 4 validation levels exit 0.

## Plan Reference

.claude/orchestration-hand-tracker-fx/tasks/phase-3/task-3-1.md

## Instructions

1. Create `src/engine/renderer.ts` with four named-export factories per skill.
2. Create `src/engine/renderer.test.ts` — mock ogl, cover the 5 key assertions in the blueprint.
3. Wire renderer into Stage.tsx (or App.tsx — whichever owns the lifecycle). Expose `getVideoTextureHandle` via devHooks.
4. Call uploadVideoFrame each frame from the render-loop onFrame path.
5. Write `tests/e2e/task-3-1.spec.ts`.
6. Run L1→L2→L3→L4; fix at source; commit; merge; archive.

## Progress Log

## Iteration 1 — 2026-04-16T00:00:00.000Z

### Completed this iteration
- Orientation: read task-3-1.md, ogl-webgl-mosaic skill, paramStore.ts (mirror), tracking/errors.ts, engine module listing, ogl 1.0.11 type defs.
- Created task list (6 subtasks).
- Decision: renderer lifecycle + video texture upload live in Stage.tsx useEffect (owns webgl-canvas ref). App.tsx reads `stageRef.current.videoTexture` and threads it into the render-loop's onFrame — the `uploadVideoFrame` call happens in onFrame, BEFORE `effect.render(ctx)`. FrameContext.videoTexture is populated from the Stage ref.

### Validation Status
- L1: not yet run
- L2: not yet run
- L3: not yet run
- L4: not yet run

### Learnings
- ogl Triangle/Program/Mesh setup is Task 3.2/3.4 scope. For 3.1 the WebGL canvas just clears. Stage must create renderer + texture; App threads the `.texture` handle into FrameContext each frame.

### Next Steps
- Write renderer.ts + tests.
- Integrate in Stage.tsx + devHooks + App.tsx onFrame.
- E2E spec + L1-L4 iteration.

---
