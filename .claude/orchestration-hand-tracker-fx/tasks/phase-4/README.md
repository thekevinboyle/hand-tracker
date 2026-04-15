# Phase 4 — Modulation, Presets, Record, A11y

**Phase goal**: X/Y modulation drives params live; presets + chevron cycler work; Record → webm download; reduced-motion honored.

**Source authority**: `.claude/orchestration-hand-tracker-fx/PHASES.md` (Phase 4 section) + DISCOVERY.md D11, D13–D15, D19–D21, D25–D30, D42.

---

## Task Index

| Task | Title | Complexity | Max Ralph | Primary D-numbers |
|------|-------|------------|-----------|-------------------|
| [4.1](task-4-1.md) | ModulationRoute evaluator + default routes | Medium | 20 | D13, D14, D15, D18, D20, D21 |
| [4.2](task-4-2.md) | CubicBezier blade + modulation panel UI | Medium | 20 | D14, D19, D20 |
| [4.3](task-4-3.md) | Preset schema + localStorage + import/export | Medium | 20 | D20, D21, D29, D30 |
| [4.4](task-4-4.md) | Preset chevron cycler + ArrowLeft/Right | Medium | 20 | D11, D30 |
| [4.5](task-4-5.md) | Record → MediaRecorder → .webm download | Medium | 20 | D28, D31, D35 |
| [4.6](task-4-6.md) | `prefers-reduced-motion` handling | Low | 10 | D3, D26 |
| [4.R](task-4-R.md) | Phase 4 regression (full flow, preview build) | High | 30 | D21, D26, D28, D29, D30, D42 |

---

## Dependency Graph

```
4.1 ──┬─► 4.2  (modulation UI reads ModulationRoute type)
      └─► 4.6  (reducedMotion bypasses applyModulation at the call site)

4.1 ──► 4.3  (preset schema contains modulationRoutes)

4.3 ──► 4.4  (cycler reads the preset list)
4.3 ◄── 4.4  (PresetActions calls presetCycler.refresh after save/delete)

4.5  independent (consumes Phase 3 top canvas ref only)
4.6  independent of 4.2/4.3/4.4/4.5

4.R  depends on ALL 4.1–4.6 being green
```

Recommended execution order (serial):
1. **4.1** — evaluator must land first; it's imported by 4.2, 4.3, 4.6.
2. **4.6** — trivial, depends only on 4.1; land it early to avoid late-phase a11y surprises.
3. **4.2** — modulation panel UI.
4. **4.3** — presets CRUD + DEFAULT_PRESET.
5. **4.4** — cycler + keybindings (depends on 4.3 list).
6. **4.5** — recording (independent; could also go earlier in parallel).
7. **4.R** — regression last, after all L1/L2/L3 of 4.1–4.6 are green.

Parallelization opportunity: 4.5 is independent of 4.1/4.6/4.2/4.3/4.4 and can be run by a second agent in a worktree (per `using-git-worktrees` skill).

---

## Shared Conventions

- **Branch**: `task/4-N-<kebab>` from `main`, merge via fast-forward after all 4 validation levels green.
- **Commit prefix**: `Task 4.N: <description>` + `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` trailer (D40).
- **Validation**: every task must pass all four levels (L1 biome+tsc, L2 vitest, L3 build, L4 e2e). Tasks that are pure utilities declare L4 N/A and defer to 4.R.
- **No new dependencies** beyond what is explicitly listed in each task's blueprint:
  - 4.1 — `bezier-easing` + `@types/bezier-easing` (first introduction).
  - All others — zero new deps.
- **Test env**: Vitest with `environment: 'jsdom'` (required for presets tests, PresetBar tests, useRecorder tests).

---

## Cross-Task Gotchas

- **paramStore.replace() does NOT refresh Tweakpane.** Any task that programmatically mutates paramStore (4.3 preset load, 4.4 cycler) must have its caller invoke `paneRef.current?.refresh()`. The hot render loop must NOT call refresh per frame (too expensive).
- **modulationStore is the single source of truth for routes.** Never duplicate into React state. 4.2 (panel) and 4.3 (preset load) both write via `setRoutes()` / `upsertRoute()`; 4.4 does not modify routes directly.
- **`window.__test__` hook is required for 4.R** and must be gated behind `import.meta.env.DEV || MODE === 'test'`. Production builds must not ship it.
- **Reduced-motion runtime toggle** (4.6) applies to the modulation call site in `renderer.ts`. The evaluator (4.1) stays pure — never add a "paused" flag to `applyModulation`.
- **MediaRecorder codec fallback chain** (4.5): vp9 → vp8 → plain `video/webm`. Safari 17 and older Chromiums may reject vp9.
- **ArrowLeft/Right key binding scope** (4.4): attached to `window` with a target-type guard. Tweakpane number inputs must NOT have their arrow keys stolen.

---

## D29 Preset Schema (referenced by 4.3 and 4.R)

```typescript
export type Preset = {
  version: 1
  name: string
  effectId: 'handTrackingMosaic'
  params: ParamState
  modulationRoutes: ModulationRoute[]
  createdAt: string  // ISO 8601
}
```

Storage key: `hand-tracker-fx:presets:v1`
Validation: manual `isValidPreset(p: unknown): p is Preset` guard (no zod).
Import of `version: 2` files is REJECTED, not migrated.

---

## D13 Default Modulation Routes (referenced by 4.1 and 4.R)

```typescript
export const DEFAULT_MODULATION_ROUTES: ModulationRoute[] = [
  {
    id: 'default-x-tileSize',
    enabled: true,
    source: 'landmark[8].x',
    targetParam: 'mosaic.tileSize',
    inputRange: [0, 1],
    outputRange: [4, 64],
    curve: 'linear',
  },
  {
    id: 'default-y-columnCount',
    enabled: true,
    source: 'landmark[8].y',
    targetParam: 'grid.columnCount',
    inputRange: [0, 1],
    outputRange: [4, 20],
    curve: 'linear',
  },
]
```

At `landmark[8].x = 0.5` → `tileSize ≈ 34`. At `y = 0.5` → `columnCount = 12`.

---

## D28 Record Behavior (referenced by 4.5 and 4.R)

- Source: `canvas.captureStream(30)` on the TOP composited canvas (Canvas 2D overlay).
- Codec: `video/webm;codecs=vp9` → fallback `video/webm;codecs=vp8` → fallback `video/webm`.
- No audio, no duration cap, blob held in memory.
- Filename: `hand-tracker-fx-{ISO-timestamp-with-colons-replaced-by-hyphens}.webm`.

---

## D26 Reduced-Motion Behavior (referenced by 4.6 and 4.R)

- `window.matchMedia('(prefers-reduced-motion: reduce)')` with `addEventListener('change', ...)`.
- When `matches === true`: render loop skips `applyModulation()` at the caller — params hold current authored state.
- When `matches === false`: modulation resumes on next frame.
- NO pause button (D3 excluded).
- Video + grid + blobs continue rendering in both modes.

---

## Phase Exit Criteria (D42)

Phase 4 merges to `main` only when:

- [ ] Every task file 4.1–4.6 has a green Ralph completion report at `.claude/PRPs/reports/task-4-N-report.md`
- [ ] Task 4.R regression passes with all six screenshots
- [ ] `pnpm build && pnpm preview` serves the app without console errors
- [ ] `pnpm vitest run` full suite green (Phases 1–4 aggregated)
- [ ] Manual human spot-check: open preview, grant camera, move hand, save a preset, cycle, record a 5s clip, toggle OS Reduce Motion, verify behavior in the checklist above.

On green: merge all `task/4-*` branches into `main` via fast-forward, then proceed to Phase 5 (Deploy + Comprehensive E2E).
