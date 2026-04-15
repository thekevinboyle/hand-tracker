# Task 2.4: Implement Dotted-Circle Blobs + xy Coordinate Labels

**Phase**: 2 — Engine + Overlay
**Branch**: `task/2-4-blob-renderer`
**Commit prefix**: `Task 2.4:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Render 5 dotted-circle blobs on the fingertip landmarks (D6: indices 4, 8, 12, 16, 20) with adjacent `x: 0.xxx  y: 0.xxx` normalized coordinate labels (D7) into the Canvas 2D overlay.

**Deliverable**:
- `src/effects/handTrackingMosaic/blobRenderer.ts` — pure function over `CanvasRenderingContext2D` + `Landmark[]` + style
- `src/effects/handTrackingMosaic/blobRenderer.test.ts` — vitest-canvas-mock tests asserting setLineDash, arc, and fillText calls
- Additionally expose a `data-testid` on any DOM element produced OR a `window.__handTracker.getLandmarkBlobCount()` dev hook so E2E can count blobs

**Success Definition**: `pnpm vitest run src/effects/handTrackingMosaic/blobRenderer.test.ts` exits 0, `pnpm typecheck` exits 0. When a 21-landmark array is passed, exactly 5 dotted circles are drawn at positions matching landmarks [4], [8], [12], [16], [20]. When `landmarks === null`, no draws happen. Each blob has an adjacent text label formatted `x: 0.xxx  y: 0.xxx` (3 decimals, normalized, space-separated). `setLineDash` is used to create the dotted effect and reset afterward.

---

## User Persona

**Target User**: Creative technologist whose hand moves in front of the camera; they see dotted circles on each fingertip with live coordinate readouts — the distinctive look from the reference screenshot.

**Use Case**: Each frame the render loop calls `blobRenderer.drawLandmarkBlobs(ctx, landmarks, size, style)`. 5 dotted blobs appear at the fingertips, each labeled with normalized (x, y). When the hand leaves the frame, blobs disappear.

**User Journey**:
1. App running, hand visible → 5 blobs on fingertips with live coordinate labels
2. User moves index finger → `landmark[8]` moves, blob follows, label updates (`x: 0.373  y: 0.287`)
3. Hand leaves frame → `landmarks === null` → blobs disappear
4. User toggles `input.showLandmarks: false` in the panel → blobs hidden immediately

**Pain Points Addressed**: Without this, the app has no visual feedback that hand tracking is working; the reference look is missing entirely.

---

## Why

- Required by D6: fingertip landmarks 4, 8, 12, 16, 20 only (5 per hand, 1 hand per D8)
- Required by D7: label format `x: 0.373  y: 0.287` (normalized, 3 decimals, two-space separator)
- Satisfies D18: Canvas 2D overlay handles grid + blobs + labels on top of WebGL canvas
- Integrates with Task 1.4 (landmarks arrive from MediaPipe), Task 2.3 (shares the 2D ctx), Task 2.5 (manifest declares `input.showLandmarks`, `input.mirrorMode`)
- Unlocks visible evidence that Phase 1 + Phase 2 are working end-to-end — without this, the screen looks broken

---

## What

- `drawLandmarkBlobs(ctx, landmarks, target, style, opts)` — pure function
- Reads a specific fingertip-index subset: `const FINGERTIP_INDICES = [4, 8, 12, 16, 20] as const`
- Each blob:
  - Circle radius = `style.blobRadius` (default 14 logical px)
  - Stroke style = `style.strokeColor` (default `#00ff88`)
  - `setLineDash([2, 3])` for the dotted effect
  - `lineWidth` = `style.strokeWidth` (default 2)
- Each label:
  - Positioned at `(cx + radius + 6, cy + 4)` — right of the blob with 6 px gap
  - Font = `style.labelFont` (default `'11px monospace'`)
  - Fill style = `style.labelColor` (default `#00ff88`)
  - Text = `x: ${x.toFixed(3)}  y: ${y.toFixed(3)}` (exactly two spaces between x and y per D7 reading)
- Coordinates are NORMALIZED (0..1) — scale to logical pixels by `target.width` / `target.height`
- Mirror handling: landmarks are in the UNMIRRORED frame (D27). If `opts.mirror === true`, flip x: `drawX = target.width - cx`.
- `landmarks === null` → early return, no draws, no state changes
- `landmarks.length < 21` → defensively skip any fingertip index beyond bounds
- `opts.showLandmarks === false` → early return

### NOT Building (scope boundary)

- No wrist / knuckle rendering — ONLY fingertips (D6)
- No second hand (D8)
- No skeleton line rendering (connecting fingertips) — reference screenshot does not show this
- No React integration — pure function over ctx
- No animations / trails / motion blur
- No internationalization of the label format (always `x:` / `y:`)

### Success Criteria

- [ ] `drawLandmarkBlobs(ctx, 21-landmark-array, target, style, {...})` draws exactly 5 circles
- [ ] `drawLandmarkBlobs(ctx, null, ...)` performs zero draws
- [ ] `drawLandmarkBlobs(ctx, [], ...)` performs zero draws
- [ ] `setLineDash([2, 3])` is called before the first arc; `setLineDash([])` is called at the end to reset
- [ ] Each label matches format `/^x: \d\.\d{3}  y: \d\.\d{3}$/` exactly
- [ ] Label positioned at blob center + (radius + 6, 4)
- [ ] `opts.mirror === true` flips x correctly
- [ ] `pnpm lint` and `pnpm typecheck` exit 0
- [ ] `pnpm vitest run src/effects/handTrackingMosaic/blobRenderer.test.ts` exits 0 with 8+ tests

---

## All Needed Context

```yaml
files:
  - path: src/effects/handTrackingMosaic/gridRenderer.ts
    why: MIRROR this file's function signature + save/restore/setLineDash pattern
    gotcha: gridRenderer calls setLineDash([]) to avoid inheriting dash from blobRenderer — this is the other side of that contract. Our renderer MUST also restore dash to [] at end.

  - path: src/effects/handTrackingMosaic/gridRenderer.test.ts
    why: MIRROR — vitest-canvas-mock usage, vi.spyOn patterns
    gotcha: vitest-canvas-mock may record arc() calls but not fillText by default — verify with a smoke test before writing assertions

  - path: src/engine/manifest.ts
    why: Landmark type is exported from here (Task 2.1)
    gotcha: Landmark = { x: number; y: number; z: number; visibility?: number } — normalized 0..1

  - path: src/engine/paramStore.ts
    why: input.showLandmarks and input.mirrorMode are read from paramStore (via Task 2.5 wiring)
    gotcha: blobRenderer does NOT import paramStore — it receives opts via args. Keeps the renderer pure and testable.

  - path: src/App.tsx
    why: Coding conventions — named exports, no 'use client'
    gotcha: This task touches no React

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash
    why: Dotted circle pattern — `ctx.setLineDash([2, 3])` = 2px dash, 3px gap
    critical: setLineDash mutates ctx state. MUST reset to `[]` after the blob loop, OR use save/restore.

  - url: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/arc
    why: ctx.arc(x, y, radius, 0, Math.PI * 2) — draws a full circle
    critical: Must call ctx.beginPath() before each arc if you want each circle stroked independently. For batched stroke, accumulate all arcs in one path.

  - url: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText
    why: ctx.fillText(text, x, y) — draws text at baseline (bottom of text)
    critical: textBaseline defaults to 'alphabetic' — add textBaseline='top' or offset y by font-height to align with blob center

  - url: https://google.github.io/mediapipe/solutions/hands.html
    why: Landmark indices — 4=thumb tip, 8=index tip, 12=middle tip, 16=ring tip, 20=pinky tip
    critical: 21 landmarks total per hand, normalized (0..1). Confirmed in D6.

  - url: https://github.com/wobsoriano/vitest-canvas-mock
    why: Canvas mock — records method calls for assertions
    critical: Imported globally via vitest.config.ts setupFiles OR per-file. Check the config.

skills:
  - ogl-webgl-mosaic        # coordinate space conventions
  - vitest-unit-testing-patterns
  - hand-tracker-fx-architecture
  - prp-task-ralph-loop

discovery:
  - D6: Fingertip landmarks 4, 8, 12, 16, 20 render as dotted-circle blobs (5 per hand)
  - D7: Coordinate label format — "x: 0.373  y: 0.287" (normalized, 3 decimals)
  - D8: One hand; numHands=1 in MediaPipe
  - D18: Canvas 2D overlay draws blobs + labels on top of WebGL canvas
  - D27: Landmarks are in UNMIRRORED frame; mirror applied only to display (CSS or blob x-flip here)
  - D36: input.showLandmarks param in the manifest drives blob visibility
  - D38: Folder layout — src/effects/handTrackingMosaic/blobRenderer.ts
```

### Current Codebase Tree (relevant subset)

```
src/
  engine/
    manifest.ts            # exports Landmark type
    paramStore.ts          # input.showLandmarks, input.mirrorMode read here (not here — via Task 2.5)
  effects/
    handTrackingMosaic/
      grid.ts              # Task 2.3
      gridRenderer.ts      # Task 2.3 — MIRROR reference
      grid.test.ts
      gridRenderer.test.ts
```

### Desired Codebase Tree (files this task adds)

```
src/
  effects/
    handTrackingMosaic/
      blobRenderer.ts         # drawLandmarkBlobs(ctx, landmarks, target, style, opts)
      blobRenderer.test.ts    # vitest-canvas-mock assertions
```

### Known Gotchas

```typescript
// CRITICAL: setLineDash mutates ctx state.
// Pattern:
//   ctx.save()
//   ctx.setLineDash([2, 3])
//   // ... draw blobs
//   ctx.setLineDash([])  // explicit reset even before restore (defensive)
//   ctx.restore()

// CRITICAL: The 2D canvas is HiDPI-scaled in Stage.tsx (Task 1.6 applies ctx.scale(dpr, dpr) once).
// Therefore blobRenderer receives LOGICAL pixel dimensions, not physical.
// target.width and target.height are in logical pixels. Landmark coords are in 0..1 normalized
// space; multiply by target.width / target.height to get logical pixel positions.

// CRITICAL: D27 mandates landmarks are UNMIRRORED.
// If opts.mirror === true (the default, per D10), the display canvas is CSS-flipped.
// The 2D canvas INHERITS the CSS transform in Stage.tsx. Therefore, when the ctx draws at
// (landmark.x * width, landmark.y * height), the display flip is automatic.
// BUT text is also flipped by CSS scaleX(-1) — so labels would appear MIRRORED on screen.
// FIX: in mirror mode, blobRenderer must pre-invert the x coordinate BEFORE drawing the text:
//   drawX = opts.mirror ? (target.width - cx) : cx
// Then save/restore around the text, additionally applying ctx.scale(-1, 1) + translate
// to un-mirror the text. Pattern:
//   ctx.save()
//   if (opts.mirror) { ctx.translate(drawX, 0); ctx.scale(-1, 1); ctx.translate(-drawX, 0) }
//   ctx.fillText(...)
//   ctx.restore()
// Simpler alternative: render the text on a SECOND un-mirrored overlay. For MVP, go with the
// in-place ctx.scale flip.

// CRITICAL: fillText default textBaseline is 'alphabetic' (descender-aware).
// Set ctx.textBaseline = 'middle' + ctx.textAlign = 'left' for predictable positioning.

// CRITICAL: noUncheckedIndexedAccess — landmarks[index] returns Landmark | undefined.
// Guard each FINGERTIP_INDICES lookup:
//   const lm = landmarks[i]
//   if (!lm) continue

// CRITICAL: landmarks.length may be 0 (hand tracking returned empty array) or < 21 (partial
// detection). Defensive: for each fingertip index, check bounds before access.

// CRITICAL: Do NOT import paramStore here. The renderer is pure; Task 2.5 wires the call site
// with the relevant params from the snapshot.

// CRITICAL: Dev hook for E2E — expose via window.__handTracker.getLandmarkBlobCount():
// In the call site (Task 2.5's render.ts), count the blobs drawn each frame. Blob renderer
// itself returns void; the caller counts for the hook. Alternatively, blobRenderer returns
// the count drawn — this keeps the caller terse.

// CRITICAL: The required test-id `data-testid="landmark-blob"` is for visual E2E counting.
// Since blobs are drawn to a Canvas (no DOM elements per blob), the test-id lives on the
// CANVAS element (Stage.tsx already provides it via data-testid="overlay-canvas").
// The blob count is read via the dev hook — NOT via DOM query per blob. Update the PHASES.md
// reference accordingly; E2E asserts count === 5 via window.__handTracker.getLandmarkBlobCount().
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/effects/handTrackingMosaic/blobRenderer.ts

import type { Landmark } from '../../engine/manifest';

export const FINGERTIP_INDICES = [4, 8, 12, 16, 20] as const;
export type FingertipIndex = (typeof FINGERTIP_INDICES)[number];

export type BlobRenderStyle = {
  blobRadius?: number;    // logical px, default 14
  strokeColor?: string;   // default '#00ff88'
  strokeWidth?: number;   // default 2
  dashPattern?: readonly [number, number]; // default [2, 3]
  labelFont?: string;     // default '11px monospace'
  labelColor?: string;    // default '#00ff88'
  /** gap (logical px) between blob edge and label start */
  labelGap?: number;      // default 6
};

export type BlobRenderTarget = {
  width: number;
  height: number;
};

export type BlobRenderOpts = {
  mirror?: boolean;        // default false (display canvas is already CSS-mirrored)
  showLandmarks?: boolean; // default true
};

/** Draws fingertip blobs + labels. Returns the count of blobs actually drawn. */
export function drawLandmarkBlobs(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[] | null,
  target: BlobRenderTarget,
  style?: BlobRenderStyle,
  opts?: BlobRenderOpts,
): number;

/** Canonical label formatter — pure function for testing. */
export function formatCoordLabel(x: number, y: number): string;
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/effects/handTrackingMosaic/blobRenderer.ts
  - IMPLEMENT:
      - FINGERTIP_INDICES constant
      - formatCoordLabel(x, y): string
          return `x: ${x.toFixed(3)}  y: ${y.toFixed(3)}`  // exactly two spaces per D7
      - drawLandmarkBlobs:
          • if (opts?.showLandmarks === false) return 0
          • if (!landmarks || landmarks.length === 0) return 0
          • const mirror = opts?.mirror ?? false
          • const radius = style?.blobRadius ?? 14
          • const strokeColor = style?.strokeColor ?? '#00ff88'
          • const strokeWidth = style?.strokeWidth ?? 2
          • const dash = style?.dashPattern ?? [2, 3]
          • const labelFont = style?.labelFont ?? '11px monospace'
          • const labelColor = style?.labelColor ?? '#00ff88'
          • const labelGap = style?.labelGap ?? 6
          • const { width, height } = target
          • let drawn = 0
          • ctx.save()
          • ctx.strokeStyle = strokeColor
          • ctx.lineWidth = strokeWidth
          • ctx.setLineDash([...dash])
          • ctx.beginPath()  // batch all circles in one path
          • for (const idx of FINGERTIP_INDICES) {
              const lm = landmarks[idx]
              if (!lm) continue
              const cx = (mirror ? (1 - lm.x) : lm.x) * width
              const cy = lm.y * height
              ctx.moveTo(cx + radius, cy)  // ensure starting point so each arc is separate
              ctx.arc(cx, cy, radius, 0, Math.PI * 2)
              drawn++
            }
          • ctx.stroke()
          • ctx.setLineDash([])  // defensive reset before labels
          • // Labels — solid text
          • ctx.fillStyle = labelColor
          • ctx.font = labelFont
          • ctx.textBaseline = 'middle'
          • ctx.textAlign = 'left'
          • for (const idx of FINGERTIP_INDICES) {
              const lm = landmarks[idx]
              if (!lm) continue
              const cx = (mirror ? (1 - lm.x) : lm.x) * width
              const cy = lm.y * height
              const label = formatCoordLabel(lm.x, lm.y)
              // In mirror mode the display canvas is CSS scaleX(-1); un-mirror this text
              if (mirror) {
                ctx.save()
                ctx.translate(cx + radius + labelGap, cy)
                ctx.scale(-1, 1)
                ctx.fillText(label, 0, 0)
                ctx.restore()
              } else {
                ctx.fillText(label, cx + radius + labelGap, cy)
              }
            }
          • ctx.restore()
          • return drawn
  - MIRROR: src/effects/handTrackingMosaic/gridRenderer.ts (ctx.save/restore bracket; setLineDash reset)
  - NAMING: camelCase functions, SCREAMING_SNAKE_CASE const arrays
  - GOTCHA: Use `for (const idx of FINGERTIP_INDICES)` — NOT .map + side effects
  - GOTCHA: noUncheckedIndexedAccess — `landmarks[idx]` is `Landmark | undefined`; guard with `if (!lm) continue`
  - GOTCHA: `dash as [number, number]` may need `[...dash]` to produce a mutable array for setLineDash (it accepts readonly but TS types differ)
  - VALIDATE: pnpm lint src/effects/handTrackingMosaic/blobRenderer.ts && pnpm typecheck

Task 2: CREATE src/effects/handTrackingMosaic/blobRenderer.test.ts
  - IMPLEMENT: Vitest suite (jsdom + canvas-mock):
      import 'vitest-canvas-mock'

      function makeCtx(): CanvasRenderingContext2D {
        const canvas = document.createElement('canvas')
        canvas.width = 640; canvas.height = 480
        return canvas.getContext('2d') as CanvasRenderingContext2D
      }

      function makeLandmarks(overrides?: Partial<Record<number, {x:number;y:number}>>): Landmark[] {
        return Array.from({ length: 21 }, (_, i) => ({
          x: overrides?.[i]?.x ?? 0.5,
          y: overrides?.[i]?.y ?? 0.5,
          z: 0,
        }))
      }

      Tests:
      1. 'formatCoordLabel pads to 3 decimals' — formatCoordLabel(0.373, 0.287) === 'x: 0.373  y: 0.287'
      2. 'formatCoordLabel rounds' — 0.1234567 → '0.123'
      3. 'returns 0 when landmarks is null' — spy on ctx.arc; zero calls
      4. 'returns 0 when landmarks is empty array'
      5. 'returns 0 when opts.showLandmarks === false'
      6. 'draws 5 blobs for 21 landmarks' — returned value === 5; spy on arc called 5 times
      7. 'draws <5 when landmarks length is 15 (no indices 16, 20 exist)' — partial detection
      8. 'sets setLineDash([2, 3]) before stroke'
      9. 'resets setLineDash([]) before drawing labels'
     10. 'calls fillText 5 times with formatted labels' — for i in FINGERTIP_INDICES, assert one fillText call with the canonical label string
     11. 'label text matches format regex' — /^x: \d\.\d{3}  y: \d\.\d{3}$/
     12. 'mirror=true flips x for blob center' — give landmark[8] = { x: 0.25 }, target.width=640, assert arc called with cx=480 (= 640 - 160) not 160
  - MIRROR: src/effects/handTrackingMosaic/gridRenderer.test.ts
  - MOCK: vitest-canvas-mock stub; vi.spyOn for arc / stroke / fillText / setLineDash
  - GOTCHA: vitest-canvas-mock may not record .setLineDash — verify by running once. If unsupported, spy on it directly via vi.spyOn(ctx, 'setLineDash')
  - GOTCHA: textBaseline, textAlign, font are properties (getter/setter); assert via direct equality AFTER the call (e.g., `expect(ctx.textAlign).toBe('left')` — but ctx state may be restored; check BEFORE restore, or spy on assignment via Object.defineProperty)
  - VALIDATE: pnpm vitest run src/effects/handTrackingMosaic/blobRenderer.test.ts
```

### Integration Points

```yaml
CALLED_BY:
  - Task 2.5 manifest.render / render.ts — the effect's render() function invokes:
      drawLandmarkBlobs(ctx2d, frameCtx.landmarks, target, style, {
        mirror: paramStore.snapshot.input.mirrorMode,
        showLandmarks: paramStore.snapshot.input.showLandmarks,
      })
  - The caller reads style fields from paramStore.snapshot (e.g. grid.lineColor for blob color)
    OR hardcodes defaults for MVP parity with the reference screenshot.

DEV_HOOK:
  - The call site (Task 2.5) stores the return value on window.__handTracker.getLandmarkBlobCount
    so E2E tests can assert:
        const count = await page.evaluate(() => window.__handTracker?.getLandmarkBlobCount?.() ?? 0)
        expect(count).toBe(5)  // with a real hand
        expect(count).toBe(0)  // with fake testsrc2 Y4M

EXPORTS:
  - FINGERTIP_INDICES (const tuple)
  - FingertipIndex (type)
  - BlobRenderStyle, BlobRenderTarget, BlobRenderOpts (types)
  - drawLandmarkBlobs (function)
  - formatCoordLabel (function — exported for reuse + testability)
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm lint src/effects/handTrackingMosaic/blobRenderer.ts src/effects/handTrackingMosaic/blobRenderer.test.ts
pnpm typecheck
```

Expected: zero errors.

### Level 2 — Unit Tests

```bash
pnpm vitest run src/effects/handTrackingMosaic/blobRenderer.test.ts
```

Expected: all 12+ tests pass.

### Level 3 — Integration (production build)

```bash
pnpm build
```

Expected: exits 0. `blobRenderer.ts` imports `Landmark` type only — tree-shakes cleanly.

### Level 4 — E2E

```bash
pnpm test:e2e -- --grep "Task 2.4:"
```

Expected: `tests/e2e/blob-overlay.spec.ts` with `test.describe('Task 2.4: landmark blobs', ...)`:

1. Navigate to `/`, grant fake camera
2. Wait for render loop to start (exposed via `window.__handTracker.getFPS() > 0`)
3. `const count = await page.evaluate(() => window.__handTracker?.getLandmarkBlobCount?.() ?? null)`
4. With synthetic testsrc2 Y4M (no hand): assert `count === 0`
5. OPTIONAL: with a real-hand Y4M (deferred to later phases): assert `count === 5`
6. Take screenshot to test-results/ for visual inspection

If Task 2.5 has not yet added `getLandmarkBlobCount` dev hook, ship `test.describe.skip('Task 2.4: ...')` so grep matches and suite exits 0. Update when 2.5 lands.

---

## Final Validation Checklist

### Technical

- [ ] L1, L2, L3, L4 all exit 0
- [ ] `pnpm vitest run` — all tests pass
- [ ] `pnpm lint .` — zero errors
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm build` — production build succeeds

### Feature

- [ ] Exactly 5 blobs drawn for 21-landmark input
- [ ] 0 blobs for null / empty / showLandmarks=false
- [ ] Labels match format regex `/^x: \d\.\d{3}  y: \d\.\d{3}$/`
- [ ] `setLineDash([2, 3])` set before stroke; `setLineDash([])` reset after
- [ ] Mirror mode correctly flips x (blob + label)
- [ ] Returns the number of blobs drawn

### Code Quality

- [ ] No `any` types
- [ ] No imports from paramStore / React / OGL / MediaPipe — pure function over ctx + landmarks
- [ ] Pure `formatCoordLabel` exported for reuse
- [ ] `ctx.save()/restore()` brackets all state mutations
- [ ] Defensive landmark bounds checks (noUncheckedIndexedAccess)

---

## Anti-Patterns

- Do NOT render landmarks other than fingertips (D6: only 4, 8, 12, 16, 20)
- Do NOT skip `setLineDash([])` reset — bleeds into subsequent renders
- Do NOT use `toFixed(2)` or `(Math.round(x*1000)/1000).toString()` — always `.toFixed(3)`
- Do NOT use a single space between `x:` and `y:` — D7 specifies two spaces
- Do NOT add React state — pure function
- Do NOT import paramStore here — caller threads opts through
- Do NOT swallow the drawn-count return value — dev hook depends on it
- Do NOT draw connecting lines between landmarks — not in the reference
- Do NOT add `'use client'` — Vite SPA
- Do NOT use `npm` / `npx` / `bun`
- Do NOT emit `<promise>COMPLETE</promise>` if any validation level is failing

---

## No Prior Knowledge Test

- [x] Every file path in `All Needed Context` exists (Task 2.1/2.2/2.3 outputs + scaffold)
- [x] Every URL in `urls:` is reachable
- [x] Every D-number cited (D6, D7, D8, D18, D27, D36, D38) exists in DISCOVERY.md
- [x] Implementation Tasks topologically sorted (blobRenderer.ts → tests)
- [x] Validation Loop commands copy-paste runnable
- [x] MIRROR file (gridRenderer.ts) exists — created by Task 2.3
- [x] Task is atomic — depends on Task 2.1/2.3 + Phase 1 Task 1.4 (Landmark type + landmark data)

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/ogl-webgl-mosaic/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
