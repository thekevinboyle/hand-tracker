# Task 3.3: Derive Active Cells from the Hand Polygon (Winding Number)

**Phase**: 3 — Mosaic Shader
**Branch**: `task/3-3-hand-polygon-active-cells`
**Commit prefix**: `Task 3.3:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20
**Blocked by**: Task 3.2 (imports `MAX_REGIONS` from `./shader`), Task 2.3 (imports grid generators)
**Dependencies**: 3.2, 2.3

---

## Goal

**Feature Goal**: Convert a MediaPipe `NormalizedLandmark[]` into a capped list of UV-space rectangles representing the grid cells whose centers fall inside the hand polygon (landmarks 0, 4, 8, 12, 16, 20), with `regionPadding` cell-sized outward inflation — so Task 3.4 can upload up to 96 `vec4(x1, y1, x2, y2)` entries to the fragment shader.

**Deliverable**: `src/effects/handTrackingMosaic/region.ts` (new) exporting `polygonFromLandmarks`, `expandPolygon`, `pointInPolygon`, `computeActiveRegions`. `src/effects/handTrackingMosaic/region.test.ts` (new) with fixtures covering convex/concave polygons, padding edges, cap enforcement, and null-landmark short-circuit.

**Success Definition**: `pnpm vitest run src/effects/handTrackingMosaic/region.test.ts` exits 0 with all fixture-driven assertions; `pnpm tsc --noEmit` exits 0; Task 3.4 (downstream) imports `computeActiveRegions` and produces non-zero `rects.length` for a frame containing visible landmarks.

---

## User Persona

**Target User**: Creative technologist, indirect — they see the mosaic appear only in cells the hand covers.

**Use Case**: Every rVFC frame, the renderLoop calls `computeActiveRegions(landmarks, videoW, videoH, columnEdges, rowEdges, regionPadding)` and uploads the result to the shader. The function is in the hot path and MUST be allocation-light.

**User Journey**:
1. User lifts their hand in front of the camera
2. MediaPipe emits 21 landmarks
3. `polygonFromLandmarks` picks out the 6 hull landmarks (wrist + 5 fingertips)
4. `expandPolygon` inflates them outward by `regionPadding * avgCellSize` pixels
5. `computeActiveRegions` tests each grid-cell center against the polygon via winding number
6. Task 3.4 uploads the returned rects as `uRegions` — shader mosaics only those cells

**Pain Points Addressed**: Without this task, the shader's `uRegionCount` stays 0 and `fragColor = mix(original, mosaicColor, 0) === original` — the mosaic never appears.

---

## Why

- Satisfies D5 — hand polygon from landmarks `{0, 4, 8, 12, 16, 20}`, region padding in cells
- Satisfies D27 — landmark coords are in UNMIRRORED video space; this module does NOT apply any mirror flip
- Satisfies D37 — reads `FrameContext.landmarks` (null-safe)
- Unlocks Task 3.4 (uniform upload), Task 3.R (visual gate)
- Winding-number PIP handles the CONCAVE between-finger regions correctly — a cross-product / half-plane test would misclassify cells between splayed fingers

---

## What

- `polygonFromLandmarks(landmarks, videoW, videoH)` → `[number, number][]` (6 pixel-space points, in landmark-order) or `null` if `landmarks` is null/empty
- `expandPolygon(poly, paddingPx)` → `[number, number][]` using centroid-push inflation
- `pointInPolygon(px, py, poly)` → `boolean` via winding-number algorithm (concave-safe)
- `computeActiveRegions(landmarks, videoW, videoH, columnEdges, rowEdges, regionPadding)` → `Rect[]` capped at `MAX_REGIONS` (imported from `./shader`)
- `Rect` type: `{ x1: number; y1: number; x2: number; y2: number }` in UV space (0..1)
- Deterministic ordering — row-major scan — so Task 3.4 uniform uploads are stable frame-to-frame for cache-friendliness

### NOT Building (scope boundary)

- Shader (Task 3.2)
- Renderer bootstrap (Task 3.1)
- Program / uniform upload (Task 3.4)
- Grid generator (`columnEdges`, `rowEdges` come from Task 2.3 `grid.ts`)
- Pinch / centroid modulation sources (Phase 4, Task 4.1)

### Success Criteria

- [ ] `src/effects/handTrackingMosaic/region.ts` exports `Rect`, `polygonFromLandmarks`, `expandPolygon`, `pointInPolygon`, `computeActiveRegions`
- [ ] `pnpm biome check src/effects/handTrackingMosaic/region.ts src/effects/handTrackingMosaic/region.test.ts` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run src/effects/handTrackingMosaic/region.test.ts` exits 0
- [ ] All fixtures pass:
  - Null landmarks → `[]`
  - Empty landmarks → `[]`
  - Simple square polygon in the middle → cells only within the square flagged
  - Concave hand polygon (splayed fingers) → cells between fingers NOT flagged
  - `regionPadding = 1` → at least one cell outside the raw polygon now flagged
  - 96-cap enforced when hand covers the whole grid
- [ ] Hot-path allocation budget: at most ONE array allocation per call (the `Rect[]` result)

---

## All Needed Context

```yaml
files:
  - path: src/effects/handTrackingMosaic/grid.ts
    why: Consumer-of-its-output — Task 2.3 exports `generateColumnWidths(seed, count, variance)` and `generateRowWidths(seed, count, variance)` returning NORMALIZED cumulative breakpoints of length `count` (last element === 1.0, no leading 0). This task's `computeActiveRegions` expects edges of length `count + 1` with a leading 0 — the caller (Task 3.4) prepends 0 before passing edges in.
    gotcha: Task 3.4 prepends 0 to the grid output and multiplies by videoW/videoH before calling `computeActiveRegions`. Do NOT call `computeColumnEdges` / `computeRowEdges` — those symbols do not exist; use `generateColumnWidths` / `generateRowWidths`.

  - path: src/effects/handTrackingMosaic/shader.ts
    why: Imports MAX_REGIONS (96) — MUST match shader #define
    gotcha: Do not hard-code 96 in this file; import from './shader' so they cannot drift

  - path: src/engine/paramStore.ts
    why: MIRROR module shape — pure functions, named exports, JSDoc
    gotcha: No React, no closures with hidden state; every function is a pure mapping

  - path: src/effects/handTrackingMosaic/grid.test.ts
    why: MIRROR test structure — fixture-driven describe/it blocks
    gotcha: Uses the same seeded RNG patterns; no real WebGL / DOM needed

urls:
  - url: https://en.wikipedia.org/wiki/Point_in_polygon#Winding_number_algorithm
    why: Winding-number algorithm for concave-safe point-in-polygon
    critical: "Use the Dan Sunday form — tracks upward/downward crossings via cross product; robust to concavity and holes"

  - url: https://developers.google.com/mediapipe/solutions/vision/hand_landmarker
    why: MediaPipe HandLandmarker landmark indices
    critical: "Landmark 0 = wrist, 4 = thumb tip, 8 = index tip, 12 = middle tip, 16 = ring tip, 20 = pinky tip. Normalized coords in [0, 1] with (0, 0) at top-left"

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - ogl-webgl-mosaic
  - mediapipe-hand-landmarker
  - vitest-unit-testing-patterns

discovery:
  - D5: Hand polygon from landmarks {0, 4, 8, 12, 16, 20}; regionPadding in cells
  - D27: Landmarks in unmirrored space; no flip in this module
  - D37: FrameContext.landmarks is NormalizedLandmark[] | null
```

### Current Codebase Tree (relevant subset)

```
src/
  effects/
    handTrackingMosaic/
      grid.ts              # Task 2.3 — exports generateColumnWidths / generateRowWidths / buildGridLayout (cumulative breakpoints in [0,1])
      grid.test.ts         # MIRROR target for test shape
      shader.ts            # Task 3.2 — exports MAX_REGIONS
      manifest.ts
  tracking/
    handLandmarker.ts      # provides NormalizedLandmark[] (from '@mediapipe/tasks-vision')
```

### Desired Codebase Tree

```
src/
  effects/
    handTrackingMosaic/
      region.ts            # NEW — pure point-in-polygon + region derivation
      region.test.ts       # NEW — fixtures for convex, concave, padded, capped, null cases
```

### Known Gotchas

```typescript
// CRITICAL: Landmarks are in UNMIRRORED video-pixel space (D27) after multiplying
// by videoW/videoH. Do NOT apply any `1 - x` flip here. The display canvas
// does the mirror via CSS `scaleX(-1)`.

// CRITICAL: MediaPipe Y increases DOWNWARD (normalized; origin top-left).
// The winding-number algorithm below is orientation-agnostic — it does NOT
// care about Y-axis direction. Do NOT flip Y.

// CRITICAL: The hand polygon is NON-CONVEX (concave between splayed fingers).
// Half-plane / cross-product "all same sign" tests WILL misclassify between-finger
// cells. Use winding number (Dan Sunday form).

// CRITICAL: MAX_REGIONS cap must be enforced at collection time, not just
// in the shader. Uploading 97+ vec4s overruns the uniform array. Break out of
// BOTH the row and column loops when `rects.length >= MAX_REGIONS`.

// CRITICAL: Centroid-push inflation works for near-convex hand shapes but is
// NOT a general polygon-offset algorithm. Do NOT use this for arbitrary polygons.
// For Hand Tracker FX it is sufficient and cheap.

// CRITICAL: Edge case — landmarks can be empty (hand not detected) or contain
// fewer than 21 points. Always guard: `if (!landmarks || landmarks.length < 21) return null/[];`

// CRITICAL: Hot-path allocation. This function runs at 30 fps. Do NOT:
//   - allocate intermediate arrays inside the inner loop
//   - use Array.prototype.map on primitive arrays in the hot path
// DO:
//   - push directly into the result array
//   - pre-compute avgCellW / avgCellH once
//   - use a plain `for` loop, not `for...of` on primitive arrays (v8 megamorphic)

// CRITICAL: TypeScript strict. Guard landmarks[idx] with noUncheckedIndexedAccess
// (on per PHASES.md). Use:
//   const lm = landmarks[idx];
//   if (!lm) continue;   // or explicit throw — this is a contract violation
// or destructure after a single early-return guard that all 6 indices exist.

// CRITICAL: Import MAX_REGIONS from './shader', not a local literal. If the
// shader cap ever changes, both must move together — single source of truth.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/effects/handTrackingMosaic/region.ts
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { MAX_REGIONS } from './shader';

/** UV-space axis-aligned rectangle, packed as (x1, y1, x2, y2). */
export type Rect = {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
};

/** Hand polygon landmark indices per D5. */
export const POLY_LANDMARK_INDICES = [0, 4, 8, 12, 16, 20] as const;
```

### Full Reference Implementation — copy-paste ready

Paste this verbatim into `src/effects/handTrackingMosaic/region.ts`. This is the authoritative reference algorithm; Ralph may tighten types or JSDoc but must NOT change the math.

```typescript
// src/effects/handTrackingMosaic/region.ts

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { MAX_REGIONS } from './shader';

/** UV-space axis-aligned rectangle, packed as (x1, y1, x2, y2). */
export type Rect = {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
};

/** Hand polygon landmark indices per D5 (wrist + 5 fingertips). */
export const POLY_LANDMARK_INDICES = [0, 4, 8, 12, 16, 20] as const;

/** Re-export for callers who want the cap without importing from shader. */
export const REGION_CAP: number = MAX_REGIONS;

/**
 * Extract the 6-point hand hull in pixel space.
 * Landmarks are in UNMIRRORED normalized coords (D27); this function multiplies
 * by videoW/videoH to get pixel-space points. No mirror flip.
 */
export function polygonFromLandmarks(
  landmarks: readonly NormalizedLandmark[] | null,
  videoW: number,
  videoH: number,
): [number, number][] | null {
  if (!landmarks || landmarks.length < 21) return null;
  const poly: [number, number][] = [];
  for (const idx of POLY_LANDMARK_INDICES) {
    const lm = landmarks[idx];
    if (!lm) return null;
    poly.push([lm.x * videoW, lm.y * videoH]);
  }
  return poly;
}

/**
 * Centroid-push inflation — each vertex is moved outward along the
 * centroid-to-vertex ray by `paddingPx` pixels. Sufficient for near-convex hand
 * shapes; NOT a general polygon-offset algorithm.
 */
export function expandPolygon(
  poly: readonly [number, number][],
  paddingPx: number,
): [number, number][] {
  if (paddingPx <= 0 || poly.length === 0) {
    return poly.map(([x, y]) => [x, y] as [number, number]);
  }
  let sx = 0;
  let sy = 0;
  for (const [x, y] of poly) {
    sx += x;
    sy += y;
  }
  const cx = sx / poly.length;
  const cy = sy / poly.length;
  const out: [number, number][] = [];
  for (const [x, y] of poly) {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    out.push([x + (dx / len) * paddingPx, y + (dy / len) * paddingPx]);
  }
  return out;
}

/**
 * Winding-number point-in-polygon test (Dan Sunday form).
 *
 * Robust to concave polygons — correctly excludes between-finger cells for
 * splayed hand shapes. Orientation-agnostic (works for both clockwise and
 * counter-clockwise vertex orders).
 *
 * Returns true when the point is strictly inside the polygon.
 *
 * Complexity: O(n) per call where n is poly.length. For Hand Tracker FX n === 6.
 */
export function pointInPolygon(
  px: number,
  py: number,
  poly: readonly [number, number][],
): boolean {
  let wn = 0;
  const n = poly.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    if (!a || !b) continue; // noUncheckedIndexedAccess guard
    const [x0, y0] = a;
    const [x1, y1] = b;
    // Edge from (x0, y0) to (x1, y1).
    if (y0 <= py) {
      if (y1 > py) {
        // Upward crossing — is px strictly left of the edge?
        const cross = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0);
        if (cross > 0) wn++;
      }
    } else if (y1 <= py) {
      // Downward crossing — is px strictly right of the edge?
      const cross = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0);
      if (cross < 0) wn--;
    }
  }
  return wn !== 0;
}

/**
 * Produce up to MAX_REGIONS (96) UV-space rectangles covering the grid cells
 * whose centers fall inside the expanded hand polygon.
 *
 * Ordering is row-major (top-to-bottom, left-to-right) and deterministic —
 * a stable input produces byte-identical output frame-to-frame.
 *
 * Allocation budget: exactly ONE array allocation (the `Rect[]` result) plus
 * the intermediate `expandPolygon` allocation when paddingPx > 0.
 */
export function computeActiveRegions(
  landmarks: readonly NormalizedLandmark[] | null,
  videoW: number,
  videoH: number,
  /** columnEdges in PIXEL space; length = columnCount + 1 (monotonically increasing). */
  columnEdges: readonly number[],
  /** rowEdges in PIXEL space; length = rowCount + 1 (monotonically increasing). */
  rowEdges: readonly number[],
  /** Padding in grid cells (D5). */
  regionPadding: number,
): Rect[] {
  const raw = polygonFromLandmarks(landmarks, videoW, videoH);
  if (!raw) return [];

  const colCount = columnEdges.length - 1;
  const rowCount = rowEdges.length - 1;
  if (colCount < 1 || rowCount < 1) return [];

  const avgCellW = videoW / colCount;
  const avgCellH = videoH / rowCount;
  const paddingPx = Math.max(0, regionPadding) * Math.max(avgCellW, avgCellH);
  const poly = paddingPx > 0 ? expandPolygon(raw, paddingPx) : raw;

  const rects: Rect[] = [];

  for (let row = 0; row < rowCount; row++) {
    if (rects.length >= MAX_REGIONS) break;
    const rowA = rowEdges[row];
    const rowB = rowEdges[row + 1];
    if (rowA === undefined || rowB === undefined) continue;
    const cy = (rowA + rowB) * 0.5;

    for (let col = 0; col < colCount; col++) {
      if (rects.length >= MAX_REGIONS) break;
      const colA = columnEdges[col];
      const colB = columnEdges[col + 1];
      if (colA === undefined || colB === undefined) continue;
      const cx = (colA + colB) * 0.5;

      if (pointInPolygon(cx, cy, poly)) {
        rects.push({
          x1: colA / videoW,
          y1: rowA / videoH,
          x2: colB / videoW,
          y2: rowB / videoH,
        });
      }
    }
  }

  return rects;
}
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/effects/handTrackingMosaic/region.ts
  - IMPLEMENT: exactly as above — Rect type, POLY_LANDMARK_INDICES, polygonFromLandmarks, expandPolygon, pointInPolygon, computeActiveRegions
  - MIRROR: src/engine/paramStore.ts (module shape — named exports only)
  - NAMING: camelCase functions; PascalCase types
  - GOTCHA: `for...of` over primitive pairs is acceptable (arrays of length 6); in the inner grid loop use plain `for` with indices for v8 hot-path predictability
  - GOTCHA: noUncheckedIndexedAccess means every `arr[i]` is `T | undefined`; handle with early-continue or early-return
  - VALIDATE: pnpm biome check src/effects/handTrackingMosaic/region.ts && pnpm tsc --noEmit

Task 2: CREATE src/effects/handTrackingMosaic/region.test.ts
  - IMPLEMENT: Vitest fixtures:
      * it('polygonFromLandmarks returns null for null input')
      * it('polygonFromLandmarks returns null for <21 landmarks')
      * it('polygonFromLandmarks picks indices {0, 4, 8, 12, 16, 20} and multiplies by video size')
      * it('pointInPolygon handles convex square') — {(0,0),(10,0),(10,10),(0,10)}, test (5,5) === true, (-1,5) === false
      * it('pointInPolygon handles concave polygon') — C-shape or hand-like spread, assert a between-finger point returns false
      * it('expandPolygon with paddingPx === 0 returns a deep copy')
      * it('expandPolygon inflates vertices outward from centroid')
      * it('computeActiveRegions returns [] when landmarks is null')
      * it('computeActiveRegions flags only cells with centers inside the polygon')
          Fixture: 4x4 uniform grid, polygon covers top-left quadrant, expect 4 rects
      * it('computeActiveRegions with regionPadding=1 expands active set')
      * it('computeActiveRegions caps at MAX_REGIONS when hand covers whole grid')
          Fixture: 12x12 = 144 cells, polygon covers whole frame, expect rects.length === 96
      * it('computeActiveRegions produces stable row-major ordering')
          Call twice with identical input, expect deep-equal output
  - MIRROR: src/effects/handTrackingMosaic/grid.test.ts (describe/it conventions)
  - GOTCHA: Mock NormalizedLandmark with a simple object `{ x, y, z, visibility, presence }`; do NOT import MediaPipe types at test time if tree-shaking becomes a problem — re-declare a local test helper
  - VALIDATE: pnpm vitest run src/effects/handTrackingMosaic/region.test.ts

Task 3: CREATE tests/e2e/task-3-3.spec.ts
  - IMPLEMENT: describe('Task 3.3: hand polygon → active cells', ...):
      * Launch with --use-fake-device-for-media-stream
      * Inject a deterministic landmark fixture via `window.__handTracker.setFakeLandmarks([...])`
      * Call `window.__handTracker.computeActiveRegions()` (dev hook)
      * Assert returned array length > 0 and every rect has x1 < x2, y1 < y2, values in [0, 1]
  - NAMING: `Task 3.3:` prefix on describe
  - GOTCHA: The dev hook is guarded by import.meta.env.DEV; add it to src/engine/devHooks.ts
  - VALIDATE: pnpm test:e2e --grep "Task 3.3:"
```

### Integration Points

```yaml
CONSUMERS:
  - Task 3.4 imports: `import { computeActiveRegions, type Rect } from './region'`
  - No other consumer

UPSTREAM:
  - columnEdges / rowEdges come from grid.ts (Task 2.3) after being multiplied by videoW/videoH
  - landmarks come from handLandmarker.ts (Task 1.4) via renderLoop's FrameContext

DEV_HOOK:
  - src/engine/devHooks.ts adds:
      setFakeLandmarks(lms: NormalizedLandmark[]): void
      computeActiveRegions(): Rect[]
  - guard: import.meta.env.DEV
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm biome check src/effects/handTrackingMosaic/region.ts src/effects/handTrackingMosaic/region.test.ts
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/effects/handTrackingMosaic/region.test.ts
pnpm vitest run
```

### Level 3 — Integration

```bash
pnpm build
```

### Level 4 — E2E

```bash
pnpm test:e2e --grep "Task 3.3:"
```

---

## Final Validation Checklist

### Technical

- [ ] All 4 levels exit 0
- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm vitest run` — all tests pass
- [ ] `pnpm build` — production build succeeds

### Feature

- [ ] Concave fixture: cells between splayed fingers are NOT flagged
- [ ] Cap fixture: exactly 96 rects returned when the polygon covers all 144 cells of a 12×12 grid
- [ ] Padding fixture: `regionPadding = 1` produces at least 1 additional cell vs `regionPadding = 0`
- [ ] Determinism: calling with identical inputs produces deeply-equal outputs
- [ ] Null landmarks: returns `[]` (does not throw)

### Code Quality

- [ ] No `any` types
- [ ] MAX_REGIONS imported from `./shader` (not a local literal)
- [ ] Hot-path allocation budget: at most 1 result array + 1 expanded-polygon array per call
- [ ] MIRROR pattern: module shape matches `paramStore.ts`; test shape matches `grid.test.ts`

---

## Anti-Patterns

- Do not use a cross-product / half-plane test — it misclassifies concave regions (between-finger cells)
- Do not flip x or y — landmarks are in unmirrored space per D27
- Do not hard-code `96` — import `MAX_REGIONS` from `./shader`
- Do not allocate inside the inner grid loop — push directly into the result array
- Do not use `Array.prototype.some`/`filter` in the hot path — plain `for` loops only
- Do not call MediaPipe in this file — it receives `NormalizedLandmark[]` from `FrameContext`
- Do not consume raw normalized coords without multiplying by videoW/videoH — the polygon is in pixel space
- Do not forget `noUncheckedIndexedAccess` — `landmarks[idx]` is `T | undefined`
- Do not throw on missing landmarks — return `[]` for graceful degradation in the render loop
- Do not return the same `Rect[]` reference twice — each call allocates a fresh array (callers may mutate)

---

## No Prior Knowledge Test

- [ ] Every file path in `All Needed Context` exists (grid.ts, shader.ts, paramStore.ts, grid.test.ts)
- [ ] Every URL in `urls:` is reachable
- [ ] Every D-number cited exists in DISCOVERY.md (D5, D27, D37)
- [ ] Implementation tasks topologically sorted — impl → test → e2e
- [ ] Validation Loop commands are copy-paste runnable
- [ ] Upstream modules exist: `grid.ts` (Task 2.3), `shader.ts` (Task 3.2), `handLandmarker.ts` (Task 1.4)
- [ ] Depends on Task 3.2 (MAX_REGIONS from ./shader) and Task 2.3 (grid generators); does not require renderer (3.1), render wire-up (3.4), or context loss (3.5)

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/ogl-webgl-mosaic/SKILL.md
.claude/skills/mediapipe-hand-landmarker/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
