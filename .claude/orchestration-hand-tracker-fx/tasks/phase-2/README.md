# Phase 2 — Engine + Overlay

**Goal**: Effect registry + paramStore + Tweakpane panel live. Grid overlay and dotted-fingertip blobs rendering over the raw webcam. **No mosaic shader yet** — that is Phase 3.

> **Scaffold layout note**: The project uses a flat `src/` layout; there is NO `src/app/` subfolder. `src/main.tsx` is the entry point. Any task file that says `src/app/main.tsx` is a stale reference — treat it as `src/main.tsx`.

**Reference screenshot**: `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png`

**Top authority**: `.claude/orchestration-hand-tracker-fx/DISCOVERY.md`. D4, D6, D7, D9, D13, D14, D19, D20, D36, D37, D38 are the controlling decisions for this phase.

---

## Tasks

| ID | Title | Complexity | Max Iter | Branch | Key deliverable |
|---|---|---|---|---|---|
| 2.1 | Effect manifest + registry types | Low | 10 | `task/2-1-effect-registry-types` | `src/engine/manifest.ts` + `src/engine/registry.ts` |
| 2.2 | paramStore + buildPaneFromManifest | Medium | 20 | `task/2-2-param-store-build-pane` | `src/engine/paramStore.ts` + `src/engine/buildPaneFromManifest.ts` + `src/ui/Panel.tsx` |
| 2.3 | Seeded grid generator + 2D overlay rendering | Medium | 20 | `task/2-3-grid-generator-overlay` | `src/effects/handTrackingMosaic/grid.ts` + `gridRenderer.ts` |
| 2.4 | Dotted-circle blobs + xy labels | Medium | 20 | `task/2-4-blob-renderer` | `src/effects/handTrackingMosaic/blobRenderer.ts` |
| 2.5 | `handTrackingMosaic` manifest + registration | Low | 10 | `task/2-5-mosaic-manifest` | `src/effects/handTrackingMosaic/manifest.ts` + `index.ts` |
| 2.R | Phase 2 regression | Medium | 20 | `task/2-R-phase-2-regression` | L1–L4 green on `pnpm preview` build |

**Total**: 6 tasks.

---

## Dependency Graph

```
                     ┌─ 2.1 manifest/registry types ─┐
                     │                               │
                     ▼                               ▼
           2.2 paramStore + Panel          2.3 grid + gridRenderer
                     │                               │
                     │                               │
                     └──────────────┬────────────────┘
                                    │
                                    ▼
                         2.4 blob renderer (needs 2.3 for overlay ctx + 1.4 landmarks)
                                    │
                                    ▼
                         2.5 mosaic manifest (noop render; registers effect)
                                    │
                                    ▼
                         2.R regression (all of Phase 2 + pnpm preview)
```

Task 2.1 has no intra-phase dependencies (only Phase 1 scaffold). Tasks 2.2 and 2.3 can technically run in parallel after 2.1, but the Ralph loop executes sequentially. Task 2.4 depends on 2.3 (shares 2D overlay ctx conventions). Task 2.5 depends on 2.1, 2.3, 2.4. Task 2.R depends on all of the above.

---

## Phase Entry Assumptions (from Phase 1)

Phase 1 (Tasks 1.1–1.R) must be complete before Phase 2 begins. Specifically:

- `src/camera/useCamera.ts` exports the 8-state hook (1.2)
- `src/tracking/handLandmarker.ts` initializes the MediaPipe singleton and exposes `Landmark[]` per frame (1.4)
- `src/engine/renderLoop.ts` drives the frame loop via `requestVideoFrameCallback` and exposes a `FrameContext` shape matching D37 (1.5)
- `src/ui/Stage.tsx` mounts the `<video>` + two stacked canvases (WebGL bottom, Canvas 2D top) with mirror CSS (1.6)
- Scaffold invariants: `pnpm check` exits 0, Biome v2 only, TypeScript strict, pnpm, React 19 + Vite 8 SPA

If any of the above is missing, complete Phase 1 before running Phase 2 Ralph.

---

## What Phase 2 Does NOT Build

- Mosaic WebGL shader (Phase 3)
- Hand-polygon → active-cell mask (Phase 3)
- Modulation routes UI + evaluator (Phase 4 — types sketched in 2.1 for forward compat, not wired)
- Preset save/load/cycler (Phase 4 — the Preset page stub may exist but no persistence)
- MediaRecorder + record button (Phase 4)
- Reduced-motion gating (Phase 4)
- Vercel deploy + CSP headers (Phase 5)
- All 8 error-state UI cards (most in Phase 1; `MODEL_LOAD_FAIL`/`NO_WEBGL` in Phase 3/5)

---

## Validation Contract (per task)

Every task in this phase ships with all 4 levels. The exact runnable commands live inside each task file. Scoped to this phase:

- **L1**: `pnpm lint <paths> && pnpm typecheck` → zero errors
- **L2**: `pnpm vitest run <unit-test-file>` → all tests pass
- **L3**: `pnpm build` → production build exits 0
- **L4**: `pnpm test:e2e -- --grep "Task 2.N:"` → all matching Playwright specs pass

The Ralph loop self-heals until all four exit 0. The regression task (2.R) re-runs all four against a fresh `pnpm build && pnpm preview` serve.

---

## Skills Used Across Phase 2

Read once on entry, re-read per task as the task file dictates:

- `.claude/skills/hand-tracker-fx-architecture/SKILL.md`
- `.claude/skills/prp-task-ralph-loop/SKILL.md`
- `.claude/skills/tweakpane-params-presets/SKILL.md`
- `.claude/skills/ogl-webgl-mosaic/SKILL.md` (for coordinate-space conventions)
- `.claude/skills/vitest-unit-testing-patterns/SKILL.md`
- `.claude/skills/playwright-e2e-webcam/SKILL.md`

---

## DISCOVERY Decisions Satisfied in Phase 2

| D-number | Summary | Task(s) |
|---|---|---|
| D4 | Procedural grid with `seed`, `columnCount`, `rowCount`, `widthVariance` + Randomize button | 2.3, 2.5 |
| D6 | Fingertip landmarks (4, 8, 12, 16, 20) render as dotted-circle blobs | 2.4 |
| D7 | Coord label format `x: 0.xxx  y: 0.xxx` (3 decimals, normalized) | 2.4 |
| D9 | Mosaic param defaults + ranges (declared in manifest, not yet rendered) | 2.5 |
| D13 | Default modulation sources (declared via `modulationSources` in manifest only) | 2.5 |
| D19 | Tweakpane 4 + Essentials plugin, plain paramStore | 2.2 |
| D20 | `paramStore` is a plain object; React only for UI chrome | 2.2 |
| D36 | EffectManifest/EffectInstance shape; global `effectRegistry` | 2.1, 2.5 |
| D37 | FrameContext shape passed to effects per frame | 2.1, 2.5 |
| D38 | Folder layout under `src/effects/` and `src/engine/` | 2.1–2.5 |

---

## Exit Criteria for Phase 2

- All 6 task files in this phase emit `<promise>COMPLETE</promise>`
- Task 2.R regression passes with `pnpm preview` serving production build
- Manual Playwright MCP walkthrough:
  - Panel visible, grid drawn over webcam with seeded non-uniform column widths
  - Changing `grid.columnCount` in panel re-renders the grid live
  - 5 dotted blobs visible with `x: 0.xxx  y: 0.xxx` labels when a hand is detected (fake Y4M → 0 blobs; real hand → 5)
  - No console errors, no unhandled rejections, no stream leaks in StrictMode
- Next phase (Phase 3) can start: the WebGL canvas is still clearing to black (no mosaic) because `handTrackingMosaic.create()` ships a noop `render()`.
