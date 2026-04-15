# Phase 3 — Mosaic Shader

**Phase goal**: Implement the WebGL mosaic effect — a fragment shader masked by the hand polygon — so the app visibly matches the TouchDesigner reference screenshot at `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png`.

**Authority**: [DISCOVERY.md](../../DISCOVERY.md) overrides everything. D5 (hand polygon from landmarks 0/4/8/12/16/20), D9 (mosaic defaults and ranges), D18 (ogl + full-stretch canvas), D27 (mirror at display only — landmarks in unmirrored space), D37 (FrameContext shape) are the controlling decisions.

**Prior state (end of Phase 2)**:
- `src/engine/registry.ts` + `src/engine/manifest.ts` — effect registry types and `registerEffect/getEffect/listEffects`
- `src/engine/paramStore.ts` — plain-object store with `getState / setState / subscribe`
- `src/effects/handTrackingMosaic/grid.ts` — seeded column-width + row-height generator; exports `generateColumnWidths`, `generateRowWidths`, `buildGridLayout` (normalized cumulative breakpoints in [0,1], length = count, last element = 1.0)
- `src/effects/handTrackingMosaic/gridRenderer.ts` — 2D-canvas grid-line overlay
- `src/effects/handTrackingMosaic/blobRenderer.ts` — 5 dotted-circle fingertip blobs + `x: 0.xxx y: 0.xxx` labels
- `src/effects/handTrackingMosaic/manifest.ts` — manifest with a **no-op** `render()` (returns after clearing)
- `src/engine/renderLoop.ts` — `requestVideoFrameCallback`-driven loop already dispatches `FrameContext` to the effect

Phase 3 replaces the no-op `create(gl).render()` with a real mosaic pipeline.

---

## Task Overview

| Task | Title | Complexity | Max Iter |
|---|---|---|---|
| 3.1 | ogl renderer bootstrap + video texture | Medium | 20 |
| 3.2 | Mosaic fragment shader GLSL ES 3.0 | Medium | 20 |
| 3.3 | Hand polygon → active cells (winding number) | Medium | 20 |
| 3.4 | Effect `render()` wire-up + uniform upload | High | 30 |
| 3.5 | Context-loss recovery + cleanup | Medium | 20 |
| 3.R | Phase 3 regression — visual fidelity gate vs reference | High | 30 |

---

## Dependency Graph (within phase)

```
3.1 ─┬─> 3.2 ──┐
     │        │
     └─> 3.3 ──┼──> 3.4 ──> 3.5 ──> 3.R
              (3.4 consumes 3.1 + 3.2 + 3.3)
```

External dependencies (already complete):
- Phase 1: `useCamera`, `handLandmarker`, `renderLoop`, `Stage.tsx` mount
- Phase 2: registry, paramStore, grid, blobRenderer, manifest (no-op render)

---

## Skills every Phase 3 agent MUST read

1. `.claude/skills/prp-task-ralph-loop/SKILL.md` — task anatomy, 4-level validation, Ralph protocol
2. `.claude/skills/hand-tracker-fx-architecture/SKILL.md` — folder structure, data flow, FrameContext
3. `.claude/skills/ogl-webgl-mosaic/SKILL.md` — the load-bearing skill for THIS phase; covers the shader, region math, context loss, and ogl gotchas
4. `.claude/skills/mediapipe-hand-landmarker/SKILL.md` — only for Tasks 3.3 / 3.4 (landmark schema, unmirrored-space invariant)
5. `.claude/skills/vitest-unit-testing-patterns/SKILL.md` — for writing L2 tests with a stubbed WebGL2 context
6. `.claude/skills/playwright-e2e-webcam/SKILL.md` — for Task 3.R and L4 steps of every task

---

## Research the agent should keep open

- `.claude/orchestration-hand-tracker-fx/research/rendering-pipeline.md` — library choice + render architecture
- `.claude/orchestration-hand-tracker-fx/research/ogl-mosaic-impl.md` — ogl 1.0.11 confirmations (the `Texture.texture` handle, `Program.remove()`, etc.)
- `.claude/orchestration-hand-tracker-fx/research/hand-tracking.md` — landmark indices, normalized-UV semantics, pinch/centroid sources
- `.claude/orchestration-hand-tracker-fx/research/mediapipe-impl.md` — the specific HandLandmarker output shape

---

## Definition of Done for Phase 3

- [ ] All six task files have all four validation levels green: `pnpm biome check src/`, `pnpm tsc --noEmit`, `pnpm vitest run`, `pnpm build`, `pnpm test:e2e -- --grep "Task 3."`
- [ ] `pnpm preview` served build visibly shows the mosaic effect inside the hand-bounded polygon
- [ ] Side-by-side screenshot comparison artifact at `reports/phase-3-visual-composite.png` ticks the checklist in task-3-R.md
- [ ] No console errors, no unhandled rejections, no WebGL warnings in dev tools
- [ ] Context loss (triggered via `WEBGL_lose_context`) recovers the full pipeline
- [ ] `track.stop()` and `gl.deleteTexture` are called in every teardown path; StrictMode double-mount does not leak GPU resources

---

## Reference screenshot

Every visual task in Phase 3 MUST open `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` and compare against it.

Key visual contract (for easy reference):

- Dark theme only (D12)
- Seeded, non-uniform column widths (D4) — 12 columns × 8 rows default
- 5 dotted-circle fingertip blobs with `x: 0.xxx  y: 0.xxx` labels next to each (D6, D7)
- Mosaic pixelation inside the hand-bounded polygon, quantized to grid cells (D5)
- `<` / `>` chevrons at screen edges (not drawn by Phase 3 — lives in Phase 4)
- Full-viewport stretched canvas (no letterboxing; D18)
- Mirror mode ON by default (CSS `scaleX(-1)` on display canvases; landmarks stay unmirrored per D27)
