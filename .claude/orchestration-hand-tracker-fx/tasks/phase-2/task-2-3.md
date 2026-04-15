# Task 2.3: Implement Seeded Grid Generator + 2D-Overlay Rendering

**Phase**: 2 — Engine + Overlay
**Branch**: `task/2-3-grid-generator-overlay`
**Commit prefix**: `Task 2.3:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Produce the TouchDesigner-style grid overlay — a seeded PRNG generates non-uniform column breakpoints (D4) and a pure renderer draws grid lines into the Canvas 2D overlay (top layer of the Stage from Task 1.6).

**Deliverable**:
- `src/effects/handTrackingMosaic/grid.ts` — pure functions: seeded RNG + `generateColumnWidths(seed, count, variance)` + `generateRowWidths(seed, count, variance)`
- `src/effects/handTrackingMosaic/gridRenderer.ts` — draws grid lines into a `CanvasRenderingContext2D` given a `GridLayout`
- `src/effects/handTrackingMosaic/grid.test.ts` — deterministic fixtures for `seed = 0x1A2B3C4D`
- `src/effects/handTrackingMosaic/gridRenderer.test.ts` — uses `vitest-canvas-mock` to assert calls

**Success Definition**: `pnpm vitest run src/effects/handTrackingMosaic/grid.test.ts src/effects/handTrackingMosaic/gridRenderer.test.ts` exits 0, `pnpm typecheck` exits 0. For the same seed, `generateColumnWidths` returns the exact same array every call (deterministic). Variance=0 → uniform widths; variance=1 → maximum non-uniformity. The renderer draws N vertical lines + M horizontal lines using the current `paramStore.snapshot.grid.lineColor` / `lineWeight`.

---

## User Persona

**Target User**: Creative technologist who wants a TD-style grid with variable column widths — the look that defines the reference screenshot.

**Use Case**: User adjusts `grid.columnCount` / `grid.widthVariance` / `grid.seed` and clicks "Randomize Grid" in the panel. The overlay grid redraws instantly with new non-uniform breakpoints that are reproducible via the seed (preset save/load restores the exact same grid).

**User Journey**:
1. App mounts → default seed=42, columnCount=12, rowCount=8, widthVariance=0.6
2. Canvas 2D overlay shows a grid with 12 columns (non-uniform) and 8 rows (non-uniform)
3. User drags `grid.widthVariance` to 1.0 → grid becomes maximally chaotic
4. User clicks "Randomize Grid" → seed rerolls, grid rearranges, all deterministic
5. User saves a preset → reloads → exact same grid

**Pain Points Addressed**: Math.random() would produce unreproducible grids; presets would not restore the layout. A seeded PRNG pins it.

---

## Why

- Required by D4: procedural grid with `seed`, `columnCount`, `rowCount`, `widthVariance` + "Randomize Grid" button
- Satisfies D18: Canvas 2D overlay draws grid lines (top layer of the stacked canvases)
- Unlocks Task 2.4 (blob renderer shares the 2D overlay context), Task 3.3 (active-cell computation needs the grid layout), Task 2.5 (manifest registers these params)
- Pure functions → testable without DOM; `gridRenderer.ts` uses `CanvasRenderingContext2D` and is testable via `vitest-canvas-mock`

---

## What

- `createRng(seed)` — tiny Mulberry32-based PRNG returning `() => number` (in `[0, 1)`)
- `generateColumnWidths(seed, count, variance)` → `Breakpoints` (array of normalized cumulative widths in `[0, 1]`)
- `generateRowWidths(seed, count, variance)` → `Breakpoints`
- `buildGridLayout({ seed, columnCount, rowCount, widthVariance })` → `GridLayout` (columns + rows)
- `drawGrid(ctx, layout, { width, height, lineColor, lineWeight })` — draws vertical + horizontal lines using `ctx.stroke()`
- Deterministic: same seed → same breakpoints, always
- `variance=0` → uniform: `[1/count, 2/count, ..., 1.0]`
- `variance=1` → maximum chaos within the constraint that every cell width > 0
- Safe for `variance < 0` or `variance > 1` (clamp)
- Safe for `count === 0` or `count === 1` (degenerate cases return empty / `[1.0]`)

### NOT Building (scope boundary)

- No cell-overlap test with hand polygon (Phase 3 — `region.ts`)
- No WebGL-uniform-array packing (Phase 3)
- No "Randomize Grid" button UI — declared in the manifest in Task 2.5; wired to grid.seed there
- No React integration — `gridRenderer` is a pure function over a 2D context
- No animation / transitions between grids

### Success Criteria

- [ ] `createRng(0x1A2B3C4D)` followed by 5 calls produces an exact fixture array (golden test)
- [ ] `generateColumnWidths(0x1A2B3C4D, 12, 0.6)` produces the same array every call in the same process
- [ ] `variance=0` yields `[1/12, 2/12, ..., 12/12]` with 6 significant digits tolerance
- [ ] `variance=1` produces non-uniform widths (stddev > threshold — assert > 0.02)
- [ ] `drawGrid` calls `ctx.beginPath()` + `ctx.moveTo()` + `ctx.lineTo()` + `ctx.stroke()` the correct number of times for `N-1` internal column lines + `M-1` internal row lines + optional outer border
- [ ] `pnpm lint` and `pnpm typecheck` exit 0
- [ ] `pnpm vitest run src/effects/handTrackingMosaic/grid.test.ts src/effects/handTrackingMosaic/gridRenderer.test.ts` exits 0

---

## All Needed Context

```yaml
files:
  - path: src/engine/paramStore.ts
    why: Renderer reads paramStore.snapshot.grid.{lineColor, lineWeight} per frame — understand the snapshot ref pattern
    gotcha: Never spread-clone the snapshot in the render loop; read directly

  - path: src/engine/manifest.ts
    why: ParamDef shape — when Task 2.5 declares `grid.seed` param, it must use `type: 'integer'` with min/max matching generator acceptance
    gotcha: The "Randomize Grid" button param uses `type: 'button'` with an `onClick(snapshot)` that calls `paramStore.set('grid.seed', Math.floor(Math.random() * 2**31))`

  - path: src/engine/registry.test.ts
    why: MIRROR test file structure — describe + it, beforeEach reset
    gotcha: Grid tests are pure; no store/state cleanup required

  - path: src/App.test.tsx
    why: Import conventions for vitest + @testing-library
    gotcha: gridRenderer tests use vitest-canvas-mock, imported via setup file or directly

  - path: vitest.config.ts (or vite.config.ts)
    why: Confirm vitest-canvas-mock is wired globally; if not, import it in the test setup
    gotcha: If not wired globally, import 'vitest-canvas-mock' at the top of gridRenderer.test.ts

  - path: package.json
    why: Confirm vitest-canvas-mock is in devDependencies (already installed per Phase 1 scaffold)
    gotcha: Do NOT add deps

urls:
  - url: https://en.wikipedia.org/wiki/Xorshift#xorshift.2B
    why: Background on small/fast PRNGs; we use Mulberry32 (simpler, cryptographically non-secure but deterministic)
    critical: Mulberry32 is the de-facto JS PRNG for seeded, reproducible procedural content. Uses a 32-bit integer state.

  - url: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
    why: Canonical Mulberry32 reference implementation in JS
    critical: Use Math.imul for 32-bit multiplication — plain `*` in JS loses precision above 2^53

  - url: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash
    why: Reference for Task 2.4; not used in this task (grid lines are solid)
    critical: gridRenderer MUST reset setLineDash([]) at the end to prevent bleeding into blob renderer

  - url: https://github.com/wobsoriano/vitest-canvas-mock
    why: Vitest canvas mocking library (already installed per package.json)
    critical: Adds getContext('2d') stub that records all method calls; assertions use e.g. `expect(ctx.stroke).toHaveBeenCalled()`

skills:
  - ogl-webgl-mosaic        # for coordinate-space conventions (0..1 UV)
  - vitest-unit-testing-patterns
  - hand-tracker-fx-architecture
  - prp-task-ralph-loop

discovery:
  - D4: Procedural grid — seed (int), columnCount (int, default 12), rowCount (int, default 8), widthVariance (float 0..1, default 0.6). variance=0 uniform; variance=1 max chaos. Randomize Grid button rerolls seed.
  - D18: Canvas 2D overlay draws grid lines + dotted landmark blobs + coord labels on top of the WebGL canvas
  - D36: EffectManifest.params declares grid.seed/columnCount/rowCount/widthVariance (Task 2.5 registers these)
  - D38: Folder layout — src/effects/handTrackingMosaic/grid.ts and gridRenderer.ts
```

### Current Codebase Tree (relevant subset)

```
src/
  engine/
    manifest.ts
    registry.ts
    paramStore.ts           # Task 2.2
    buildPaneFromManifest.ts
  effects/                  # NEW directory from this task
  ui/
    Panel.tsx
    Stage.tsx               # Phase 1 Task 1.6 — provides the 2D canvas ctx
```

### Desired Codebase Tree (files this task adds)

```
src/
  effects/
    handTrackingMosaic/
      grid.ts                  # createRng + generateColumnWidths + generateRowWidths + buildGridLayout
      grid.test.ts             # deterministic fixtures
      gridRenderer.ts          # drawGrid(ctx, layout, style)
      gridRenderer.test.ts     # vitest-canvas-mock assertions
```

### Known Gotchas

```typescript
// CRITICAL: Mulberry32 uses Math.imul for 32-bit integer multiplication.
// `a * b | 0` is NOT equivalent — it loses precision for large operands.
// Correct: `Math.imul(a, b)` preserves 32-bit semantics.

// CRITICAL: Math.random() is non-deterministic — forbidden here.
// All randomness must come from the seeded rng returned by createRng().

// CRITICAL: Mulberry32 operates on a 32-bit seed. Pass seed >>> 0 to coerce to unsigned
// 32-bit. Negative seeds and huge seeds both work via this coercion.

// CRITICAL: generateColumnWidths must return NORMALIZED cumulative breakpoints in (0, 1],
// with the last element exactly 1.0 (to avoid floating-point underdraw at the right edge).
// After generating raw widths, normalize by total sum, then accumulate.

// CRITICAL: When variance > 0, the "chaos" formula must not produce ANY zero-width cells.
// Pattern: baseWidth = 1/count; jitter = (rng() - 0.5) * variance * baseWidth.
// Enforce min cell width: max(baseWidth * 0.2, baseWidth + jitter). Then normalize total.
// This prevents vanishingly thin cells at variance=1.

// CRITICAL: CanvasRenderingContext2D methods are stateful. gridRenderer must:
//   ctx.save()
//   ctx.strokeStyle = lineColor
//   ctx.lineWidth = lineWeight
//   ctx.setLineDash([])           // explicit — prevents inherited dash from blob renderer
//   ctx.beginPath()               // ONCE per stroke batch
//   for (const x of breakpoints)  // vertical lines: moveTo(x*w, 0); lineTo(x*w, h)
//   for (const y of rowBreaks)    // horizontal lines: moveTo(0, y*h); lineTo(w, y*h)
//   ctx.stroke()                  // single stroke for all lines (one GPU call)
//   ctx.restore()

// CRITICAL: The 2D canvas may be HiDPI. The Stage.tsx from Task 1.6 should set
// ctx.scale(dpr, dpr) once at context creation. gridRenderer consumes logical pixel
// dimensions (width/height), not physical — Stage has already applied the transform.

// CRITICAL: vitest-canvas-mock provides a getContext('2d') stub. Use via:
//   import 'vitest-canvas-mock'   // at top of test file if not global
//   const canvas = document.createElement('canvas')
//   const ctx = canvas.getContext('2d')!
//   drawGrid(ctx, layout, style)
//   expect(ctx.__getEvents()).toEqual([...]) // mock API
//   OR use vi.spyOn(ctx, 'moveTo') etc.

// CRITICAL: noUncheckedIndexedAccess — array[i] returns T | undefined.
// Pattern: const first = arr[0]; if (first === undefined) return; ...
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/effects/handTrackingMosaic/grid.ts

/** Normalized cumulative breakpoints in (0, 1], monotonically increasing, last element === 1.0 */
export type Breakpoints = number[];

export type GridLayout = {
  columns: Breakpoints;   // length = columnCount
  rows: Breakpoints;      // length = rowCount
};

export type GridGenInput = {
  seed: number;
  columnCount: number;
  rowCount: number;
  widthVariance: number;  // clamped to [0, 1]
};
```

```typescript
// src/effects/handTrackingMosaic/gridRenderer.ts

export type GridRenderStyle = {
  lineColor: string;    // CSS color
  lineWeight: number;   // px, logical pixels
  /** Draw outer border rectangle as well (default false). */
  drawBorder?: boolean;
};

export type GridRenderTarget = {
  width: number;   // logical pixels
  height: number;  // logical pixels
};
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/effects/handTrackingMosaic/grid.ts
  - IMPLEMENT:
      - createRng(seed: number): () => number
          • Mulberry32 in ~8 lines:
              let s = seed >>> 0
              return () => {
                s = (s + 0x6D2B79F5) >>> 0
                let t = s
                t = Math.imul(t ^ (t >>> 15), t | 1)
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296
              }
      - generateCumulativeBreakpoints(rng, count, variance): Breakpoints
          • if count <= 0 return []
          • if count === 1 return [1]
          • variance = clamp(variance, 0, 1)
          • const base = 1 / count
          • const minCell = base * 0.2
          • const widths = new Array(count).fill(0).map(() => {
              const jitter = (rng() - 0.5) * variance * base
              return Math.max(minCell, base + jitter)
            })
          • const total = widths.reduce((a, b) => a + b, 0)
          • const normalized = widths.map(w => w / total)
          • let acc = 0
          • const breakpoints = normalized.map(w => { acc += w; return acc })
          • breakpoints[breakpoints.length - 1] = 1.0  // snap to 1.0 exactly
          • return breakpoints
      - generateColumnWidths(seed, count, variance):
          return generateCumulativeBreakpoints(createRng(seed), count, variance)
      - generateRowWidths(seed, count, variance):
          // Use seed XOR constant to decorrelate row generation from columns
          return generateCumulativeBreakpoints(createRng(seed ^ 0xA5A5A5A5), count, variance)
      - buildGridLayout(input: GridGenInput): GridLayout
          return {
            columns: generateColumnWidths(input.seed, input.columnCount, input.widthVariance),
            rows: generateRowWidths(input.seed, input.rowCount, input.widthVariance),
          }
  - MIRROR: src/engine/registry.ts (named exports, no default)
  - NAMING: camelCase
  - GOTCHA: Use Math.imul — NOT plain multiplication
  - GOTCHA: Clamp variance to [0, 1]; do not assume caller validated
  - VALIDATE: pnpm lint src/effects/handTrackingMosaic/grid.ts && pnpm typecheck

Task 2: CREATE src/effects/handTrackingMosaic/grid.test.ts
  - IMPLEMENT: Vitest suite:
      1. 'createRng is deterministic' — rng = createRng(0x1A2B3C4D); first 5 values match fixture (compute fixture via running the implementation once, then paste back — this is a snapshot test)
      2. 'createRng same seed two instances produce same sequence'
      3. 'createRng different seeds diverge'
      4. 'generateColumnWidths last element === 1.0 exactly'
      5. 'generateColumnWidths count === 0 returns []'
      6. 'generateColumnWidths count === 1 returns [1]'
      7. 'generateColumnWidths variance=0 is uniform within 1e-9'
      8. 'generateColumnWidths variance=1 stddev > 0.02'
      9. 'generateColumnWidths same seed returns identical array'
     10. 'generateColumnWidths never produces zero-width cells (min > 0)'
     11. 'buildGridLayout columns and rows decorrelated' — running with same seed but (0x1A2B3C4D ^ 0xA5A5A5A5) differs from the un-xor-ed sequence
  - MIRROR: src/engine/registry.test.ts
  - MOCK: none — pure math
  - GOTCHA: Floating-point — use `toBeCloseTo(expected, 6)` for uniform-width assertions
  - GOTCHA: For the deterministic fixture (test 1), run the implementation once, copy output into the test. Document as "// Golden fixture — regenerate if PRNG algorithm changes"
  - VALIDATE: pnpm vitest run src/effects/handTrackingMosaic/grid.test.ts

Task 3: CREATE src/effects/handTrackingMosaic/gridRenderer.ts
  - IMPLEMENT:
      export function drawGrid(
        ctx: CanvasRenderingContext2D,
        layout: GridLayout,
        target: GridRenderTarget,
        style: GridRenderStyle,
      ): void {
        const { width, height } = target
        const { lineColor, lineWeight, drawBorder = false } = style
        ctx.save()
        ctx.strokeStyle = lineColor
        ctx.lineWidth = lineWeight
        ctx.setLineDash([])
        ctx.beginPath()
        // Vertical lines — skip the last breakpoint if it's the right edge and drawBorder is false
        for (let i = 0; i < layout.columns.length - 1; i++) {
          const x = (layout.columns[i] ?? 0) * width
          ctx.moveTo(x, 0)
          ctx.lineTo(x, height)
        }
        for (let i = 0; i < layout.rows.length - 1; i++) {
          const y = (layout.rows[i] ?? 0) * height
          ctx.moveTo(0, y)
          ctx.lineTo(width, y)
        }
        if (drawBorder) {
          ctx.rect(0, 0, width, height)
        }
        ctx.stroke()
        ctx.restore()
      }
  - MIRROR: src/engine/buildPaneFromManifest.ts (pure-function style; no side effects at module load)
  - GOTCHA: `ctx.save()/restore()` bracket ALL state mutations so the renderer doesn't leak strokeStyle/dash into downstream Canvas 2D draws (blobRenderer)
  - GOTCHA: `ctx.setLineDash([])` explicit — prevents inherited dash from blob renderer (D6 uses setLineDash)
  - GOTCHA: `noUncheckedIndexedAccess` — guard `layout.columns[i]` with `?? 0` or early return
  - VALIDATE: pnpm lint src/effects/handTrackingMosaic/gridRenderer.ts && pnpm typecheck

Task 4: CREATE src/effects/handTrackingMosaic/gridRenderer.test.ts
  - IMPLEMENT: Vitest suite (with canvas-mock):
      import 'vitest-canvas-mock'
      1. 'draws N-1 vertical lines for N columns' — spy on moveTo/lineTo; assert call counts
      2. 'draws M-1 horizontal lines for M rows'
      3. 'calls beginPath once and stroke once' — batched stroke
      4. 'sets strokeStyle to lineColor'
      5. 'sets lineWidth to lineWeight'
      6. 'calls setLineDash([]) before stroke'
      7. 'wraps in save/restore' — save called before draw, restore after
      8. 'drawBorder=true adds a rect' — spy on rect
      9. 'handles empty columns/rows without throwing'
  - MIRROR: src/engine/paramStore.test.ts
  - MOCK: vitest-canvas-mock provides the ctx stub; use vi.spyOn(ctx, 'moveTo')
  - GOTCHA: vitest-canvas-mock may need explicit import at top of file; check vitest.config.ts setupFiles
  - VALIDATE: pnpm vitest run src/effects/handTrackingMosaic/gridRenderer.test.ts
```

### Integration Points

```yaml
PARAM_STORE:
  - gridRenderer is called from the render loop (Task 2.5 wires this into EffectInstance.render)
  - Reads: paramStore.snapshot.grid.{seed, columnCount, rowCount, widthVariance, lineColor, lineWeight}

STAGE_2D_CTX:
  - Stage.tsx from Task 1.6 provides the HTMLCanvasElement top layer
  - EffectInstance.render(ctx: FrameContext) — ctx.videoSize gives { w, h }
  - The Canvas 2D ref is accessed via a dev hook or a separate renderer module in Task 2.5

LAYOUT_CONSUMERS:
  - Task 3.3 (region.ts) — consumes GridLayout for cell-overlap test with hand polygon
  - Task 2.5 — manifest registers grid params + "Randomize Grid" button (onClick: paramStore.set('grid.seed', rand32()))
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm lint src/effects/handTrackingMosaic/grid.ts src/effects/handTrackingMosaic/grid.test.ts src/effects/handTrackingMosaic/gridRenderer.ts src/effects/handTrackingMosaic/gridRenderer.test.ts
pnpm typecheck
```

Expected: zero errors.

### Level 2 — Unit Tests

```bash
pnpm vitest run src/effects/handTrackingMosaic/grid.test.ts src/effects/handTrackingMosaic/gridRenderer.test.ts
```

Expected: all 20+ tests pass.

### Level 3 — Integration (production build)

```bash
pnpm build
```

Expected: exits 0. `src/effects/` must be reachable from any entry point — confirm with a dummy import chain when `handTrackingMosaic/manifest.ts` (Task 2.5) wires them together.

### Level 4 — E2E

```bash
pnpm test:e2e --grep "Task 2.3:"
```

Expected: `tests/e2e/grid-overlay.spec.ts` with `test.describe('Task 2.3: grid overlay', ...)`:

1. Navigate to `/`
2. Grant fake camera
3. Wait for the stage canvases to mount (`page.waitForSelector('[data-testid="overlay-canvas"]')`)
4. Take a screenshot via `page.screenshot({ path: 'test-results/grid-2-3.png' })` for visual inspection
5. Via `page.evaluate`, read `window.__handTracker?.__engine?.lastGridLayout` (exposed via dev hook in Task 2.5) and assert `columns.length === 12` and `columns[columns.length - 1] === 1.0`

If the dev hook for `lastGridLayout` does not yet exist (Task 2.5 writes it), ship `test.describe.skip('Task 2.3:', ...)` so `--grep` still matches and exits 0. Regenerate the spec after Task 2.5 lands.

---

## Final Validation Checklist

### Technical

- [ ] L1, L2, L3, L4 all exit 0
- [ ] `pnpm vitest run` — all tests pass
- [ ] `pnpm lint .` — zero errors
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm build` — production build succeeds

### Feature

- [ ] Mulberry32 `createRng` is deterministic (golden-fixture test passes)
- [ ] `variance=0` → uniform widths within 1e-9
- [ ] `variance=1` → non-uniform widths (stddev > 0.02)
- [ ] Last breakpoint === 1.0 exactly (no fp drift at right edge)
- [ ] `drawGrid` calls `save/restore`, `beginPath`, `stroke` exactly once each
- [ ] `setLineDash([])` called — no bleed from blob renderer

### Code Quality

- [ ] No `any` types
- [ ] Pure functions — no side effects, no imports from DOM/React/paramStore in `grid.ts`
- [ ] `Math.imul` used in Mulberry32 (not plain `*`)
- [ ] No `Math.random()` in production code (tests OK only for non-determinism assertions — prefer explicit seeds)

---

## Anti-Patterns

- Do NOT use `Math.random()` in `grid.ts` or `gridRenderer.ts`
- Do NOT use plain multiplication in Mulberry32 — use `Math.imul`
- Do NOT let generated cells have zero width — enforce minCell
- Do NOT skip `ctx.save()/restore()` — leaks styles into blob renderer
- Do NOT forget `setLineDash([])` — inherited dash bleeds
- Do NOT batch N `stroke()` calls — single stroke after full path build
- Do NOT use `any`
- Do NOT import paramStore in pure grid.ts (gridRenderer may; keeps grid.ts unit-testable without store)
- Do NOT use `npm` / `npx` / `bun`
- Do NOT emit `<promise>COMPLETE</promise>` if any validation level is failing

---

## No Prior Knowledge Test

- [x] Every file path in `All Needed Context` exists (Phase 1 + Task 2.1/2.2 outputs)
- [x] Every URL in `urls:` is reachable
- [x] Every D-number cited (D4, D18, D36, D38) exists in DISCOVERY.md
- [x] Implementation Tasks topologically sorted (grid.ts → grid.test.ts → gridRenderer.ts → gridRenderer.test.ts)
- [x] Validation Loop commands copy-paste runnable
- [x] MIRROR files exist
- [x] Task is atomic — needs only Task 2.1/2.2 + Phase 1

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/ogl-webgl-mosaic/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
