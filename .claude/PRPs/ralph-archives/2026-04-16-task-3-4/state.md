---
iteration: 1
max_iterations: 30
plan_path: ".claude/orchestration-hand-tracker-fx/tasks/phase-3/task-3-4.md"
input_type: "plan"
started_at: "2026-04-16T03:00:00.000Z"
---

# PRP Ralph Loop State — Task 3.4

## Codebase Patterns
- Manifest signature `create(gl): EffectInstance` is pinned (D36) — renderer + texture come via module-scoped brokers, not a new `deps` param. `videoTextureRef.ts` already exists (Task 3.1); add a parallel `rendererRef.ts` and have Stage.tsx set both in the same useEffect.
- Existing `manifest.ts` module-scope pattern: `let lastBlobCount = 0; export function __getLastBlobCount()`. Mirror for `lastRegionCount`.
- `grid.ts` returns cumulative breakpoints of length = count WITHOUT leading 0. `computeActiveRegions` wants edges of length = count + 1 WITH leading 0. Prepend 0 at the call site.
- `uResolution` must be physical pixels (renderer.gl.canvas.width/height) — never CSS.
- ogl uniform cache invalidation: reassigning the SAME Float32Array doesn't trigger upload; wrap a fresh view over the same buffer each frame.
- `renderer.render({ scene: mesh })` no camera → skips matrix uniforms (correct for full-screen Triangle).
- Effect owns renderer.render() — renderLoop does NOT call it separately.

## Progress Log

## Iteration 1 — 2026-04-16T03:00:00.000Z
- Orientation complete; plan: rendererRef → render.ts → render.test.ts → manifest rewrite → devHooks expose → E2E → L1-L4.

---
