# Task 4.1: ModulationRoute Evaluator + Default Routes

**Phase**: 4 — Modulation, Presets, Record, A11y
**Branch**: `task/4-1-modulation-evaluator`
**Commit prefix**: `Task 4.1:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Implement a pure `applyModulation()` evaluator that maps modulation sources (hand landmarks, pinch, centroid) through ModulationRoutes to live params, with a bezier-easing cache and the two default routes from D13.

**Deliverable**: `src/engine/modulation.ts` (types + evaluator + source resolver + `DEFAULT_MODULATION_ROUTES`) and `src/engine/modulation.test.ts` (Vitest suite with ≥12 passing cases).

**Success Definition**: `pnpm vitest run src/engine/modulation.test.ts` exits 0; for `landmark[8].x = 0.5` with default routes, `applyModulation()` returns `mosaic.tileSize === 34`; for `landmark[8].y = 0.5`, `grid.columnCount === 12` (integer rounded).

---

## User Persona

**Target User**: Creative technologist using Hand Tracker FX on Chrome 120+.

**Use Case**: User moves their index finger left/right and sees `mosaic.tileSize` change live; moves up/down and sees `grid.columnCount` change live. This is the core interactivity of the app (D13).

**User Journey**:
1. App loads, webcam grants, landmarks stream.
2. On each frame, `resolveModulationSources(landmarks)` produces a Map.
3. `applyModulation(routes, sources, paramStore.snapshot)` returns a new ParamState.
4. Render loop writes that snapshot back to `paramStore` only if it changed.
5. WebGL shader reads the modulated `mosaic.tileSize` and the grid regenerates at the new `columnCount`.

**Pain Points Addressed**: Without this task, params are static. The TD-inspired "hand drives effect" behavior is the core value prop and it literally cannot exist until this evaluator ships.

---

## Why

- Core interactivity hinge: every frame of the render loop calls this evaluator (D18, D20).
- Unblocks Task 4.2 (Modulation panel UI, which needs the evaluator to validate against), Task 4.6 (reduced-motion neutralizer, which no-ops the evaluator), Phase 5 E2E (modulation is tested against the fake device stream).
- Satisfies D13 (default routes), D14 (route schema), D15 (source types).

---

## What

- Pure TS module — no DOM, no React, no side effects beyond the bezier cache Map.
- Exports: `ModulationRoute`, `ModulationSourceId`, `Landmark`, `applyModulation`, `resolveModulationSources`, `DEFAULT_MODULATION_ROUTES`.
- `applyModulation` returns the SAME object reference if nothing changed (fast-path for the render loop).
- Integer-typed params (detected via `Number.isInteger(currentValue)`) are rounded after curve eval.
- Bezier curves memoized per control-point tuple in a module-scoped Map.

### NOT Building (scope boundary)

- No Tweakpane wiring (that is Task 4.2).
- No preset persistence (Task 4.3).
- No React integration / hooks.
- No modulation store (`modulationStore.ts` already exists from Phase 2 per orchestration plan; this task only consumes it indirectly via types).
- No MIDI source — architecture supports but MVP does not (D15).

### Success Criteria

- [ ] `src/engine/modulation.ts` exports all seven names above.
- [ ] `pnpm biome check src/engine/modulation.ts src/engine/modulation.test.ts` exits 0.
- [ ] `pnpm tsc --noEmit` exits 0.
- [ ] `pnpm vitest run src/engine/modulation.test.ts` exits 0 with ≥12 tests passing.
- [ ] Bezier cache does not recompute across calls with identical control points (verified with `vi.spyOn`).
- [ ] `applyModulation` with empty routes returns the exact input object (`===` identity).

---

## All Needed Context

> **Context Completeness Check**: Agent with zero prior knowledge of this codebase must be able to ship this task using only this file.

```yaml
files:
  - path: src/engine/paramStore.ts
    why: Imports `ParamState` type for the evaluator signature; import pattern via `import('./paramStore').ParamState`
    gotcha: paramStore.snapshot is the read-only current state; the evaluator never mutates it in place

  - path: src/engine/modulationStore.ts
    why: The store the Panel feeds; this task does NOT import from it (evaluator is pure) but the types must align
    gotcha: Only import types, never the store instance

  - path: src/effects/handTrackingMosaic/manifest.ts
    why: Confirms param dot-paths that routes target — `mosaic.tileSize`, `grid.columnCount`, `grid.seed`, etc.
    gotcha: `grid.columnCount` is typed integer; `mosaic.tileSize` is float — the rounding branch must handle both

  - path: src/engine/modulation.ts
    why: MAY already exist as a stub from earlier phases — verify with `git status` before CREATE vs MODIFY
    gotcha: If it exists, preserve any existing exports; otherwise create fresh

urls:
  - url: https://github.com/gre/bezier-easing
    why: `BezierEasing(x1, y1, x2, y2)` returns `(t: number) => number`; signature matches CSS cubic-bezier()
    critical: The returned function is pure; safe to cache by stringified control points

  - url: https://vitest.dev/api/vi.html#vi-spyon
    why: Spy on the BezierEasing import to verify cache hits
    critical: Must use `vi.mock('bezier-easing', ...)` at the top of the test file or dynamic import

skills:
  - tweakpane-params-presets
  - vitest-unit-testing-patterns
  - hand-tracker-fx-architecture

discovery:
  - D13: Default modulation routes — landmark[8].x → mosaic.tileSize [4..64]; landmark[8].y → grid.columnCount [4..20]
  - D14: User-configurable per-route: source, input range, output param, output range, easing curve
  - D15: Sources = landmark[0..20].x|y, pinch (|p4 - p8|), centroid.x|y
  - D18: rVFC render loop — evaluator must be allocation-light
  - D20: paramStore is plain object; no React state in hot path
  - D21: Vitest for pure utilities; this module is the canonical "pure utility"
```

### Current Codebase Tree (relevant subset)

```
src/
  engine/
    paramStore.ts          # plain-object store (Phase 2)
    modulationStore.ts     # routes store (Phase 2)
    modulation.ts          # may exist as stub — this task owns it
  effects/
    handTrackingMosaic/
      manifest.ts
```

### Desired Codebase Tree (files this task adds or modifies)

```
src/
  engine/
    modulation.ts          # CREATE or OVERWRITE — evaluator + defaults
    modulation.test.ts     # CREATE — Vitest suite
package.json               # MODIFY — add bezier-easing dep if missing
```

### Known Gotchas

```typescript
// CRITICAL: applyModulation runs 30x/second in the render loop.
// Returning a new object on every call would thrash GC.
// Fast-path: if no routes fire AND no values changed, return the INPUT `params` reference unchanged.
// The renderer uses `if (modulated !== paramStore.snapshot) paramStore.replace(modulated)`.

// CRITICAL: The bezier cache is module-scoped. Unit tests should NOT reset it
// between tests (the key space is small and stable). If you need to test eviction,
// add a separate `clearBezierCache()` dev-only export — do NOT export it in MVP.

// CRITICAL: Never use `any` — import `ParamState` via the type-only form:
//   import type { ParamState } from './paramStore'
// TypeScript strict + noExplicitAny: error is enforced.

// CRITICAL: Integer rounding logic must NOT assume the param is integer.
// Detect with `Number.isInteger(currentSection[key])` against the CURRENT value.
// Floating-point rounding artifacts (0.9999999) must not trip the check — use a tolerance of 1e-9 if needed.

// CRITICAL: `resolveModulationSources(null)` must return an empty Map, not throw.
// The MediaPipe landmarker returns null frames while loading or when no hand is visible.

// CRITICAL: Clamp t to [0, 1] AFTER computing `(raw - inMin) / (inMax - inMin)`.
// If inputRange is inverted ([1, 0]) the clamp still produces a correct value
// (the division goes negative; Math.max(0, ...) recovers).

// CRITICAL: Biome v2 — run `pnpm biome check` not eslint. No Prettier.

// CRITICAL: pnpm only. `pnpm add bezier-easing` (NOT `npm install`).

// CRITICAL: This is a Vite SPA. No 'use client'. No Node-only APIs.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/engine/modulation.ts

import BezierEasing from 'bezier-easing'
import type { ParamState } from './paramStore'

export type ModulationSourceId =
  | `landmark[${number}].x`
  | `landmark[${number}].y`
  | 'pinch'
  | 'centroid.x'
  | 'centroid.y'

export type ModulationRoute = {
  id: string
  enabled: boolean
  source: ModulationSourceId
  targetParam: string
  inputRange: [number, number]
  outputRange: [number, number]
  curve: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'cubicBezier'
  bezierControlPoints?: [number, number, number, number]
}

export type Landmark = { x: number; y: number; z: number }

export function applyModulation(
  routes: ModulationRoute[],
  sources: Map<ModulationSourceId, number>,
  params: ParamState,
): ParamState

export function resolveModulationSources(
  landmarks: Landmark[] | null,
): Map<ModulationSourceId, number>

export const DEFAULT_MODULATION_ROUTES: ModulationRoute[]
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: MODIFY package.json
  - ADD: "bezier-easing": "^2.1.0" to dependencies (if not already present)
  - ADD: "@types/bezier-easing": "^2.1.6" to devDependencies (if not already present)
  - COMMAND: pnpm add bezier-easing && pnpm add -D @types/bezier-easing
  - VALIDATE: pnpm tsc --noEmit

Task 2: CREATE src/engine/modulation.ts
  - IMPLEMENT: types (ModulationSourceId, ModulationRoute, Landmark),
               bezier cache (module-scoped Map<string, (t:number)=>number>),
               getBezierFn(cp) helper,
               applyCurve(t, curve, cp?) switch,
               applyModulation(routes, sources, params) evaluator,
               resolveModulationSources(landmarks) resolver,
               DEFAULT_MODULATION_ROUTES constant.
  - MIRROR: src/engine/paramStore.ts (pure-module pattern — no side effects at import time)
  - NAMING: camelCase functions, SCREAMING_SNAKE_CASE constants, PascalCase types
  - GOTCHA: applyModulation must return the INPUT params object identity when no routes fire
  - VALIDATE: pnpm biome check src/engine/modulation.ts && pnpm tsc --noEmit

Task 3: CREATE src/engine/modulation.test.ts
  - IMPLEMENT: Vitest suite covering:
      1. DEFAULT_MODULATION_ROUTES shape (2 routes, ids, enabled: true)
      2. applyModulation with empty routes → identity return
      3. applyModulation with disabled route → identity return
      4. landmark[8].x = 0.5 default route → tileSize ≈ 34
      5. landmark[8].y = 0.5 default route → columnCount === 12 (integer)
      6. landmark[8].x = 0.0 → tileSize === 4 (lower bound)
      7. landmark[8].x = 1.0 → tileSize === 64 (upper bound)
      8. inputRange [0,1] with raw value -0.5 → clamps to outMin
      9. inputRange [0,1] with raw value 1.5 → clamps to outMax
      10. easeIn curve at t=0.5 → 0.25 (t*t)
      11. cubicBezier curve: same control points twice → BezierEasing called once (cache hit)
      12. resolveModulationSources(null) → empty Map
      13. resolveModulationSources with 21 landmarks → sets landmark[0..20].x|y + pinch + centroid
      14. integer rounding: fractional tileSize target → non-integer target stays fractional
  - MIRROR: src/engine/paramStore.test.ts (if exists) OR any existing *.test.ts
  - MOCK: vi.mock('bezier-easing', () => ({ default: vi.fn(() => (t: number) => t) }))
  - VALIDATE: pnpm vitest run src/engine/modulation.test.ts
```

### Integration Points

```yaml
RENDER_LOOP:
  - pattern: |
      const sources = resolveModulationSources(latestLandmarks)
      const modulated = applyModulation(routes, sources, paramStore.snapshot)
      if (modulated !== paramStore.snapshot) paramStore.replace(modulated)
  - file: src/engine/renderer.ts (consumed by Phase 3; this task does not modify it)

MODULATION_STORE:
  - pattern: modulationStore.setRoutes(DEFAULT_MODULATION_ROUTES) at init
  - file: src/engine/modulationStore.ts (Phase 2)

PANEL_UI:
  - pattern: Task 4.2 imports ModulationRoute type from this module
```

---

## Validation Loop

### Level 1 — Syntax & Style (run after EVERY file write)

```bash
pnpm biome check src/engine/modulation.ts src/engine/modulation.test.ts
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/engine/modulation.test.ts
pnpm vitest run    # regression guard
```

### Level 3 — Integration (production build)

```bash
pnpm build
```

### Level 4 — E2E

```bash
pnpm test:e2e --grep "Task 4.1:"
```

Assertion: (No dedicated E2E for a pure utility. If no test exists with that grep, mark L4 as N/A in Progress Log and note the `--grep` returned 0. L4 is satisfied by Task 4.R regression.)

---

## Final Validation Checklist

### Technical

- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm vitest run` — all tests pass (≥12 new + pre-existing green)
- [ ] `pnpm build` — production build succeeds

### Feature

- [ ] `DEFAULT_MODULATION_ROUTES` exports two routes matching D13 exactly
- [ ] Bezier cache verified via spy (same cp → BezierEasing called once)
- [ ] Empty routes / empty sources → identity return confirmed in tests

### Code Quality

- [ ] No `any` types
- [ ] No React / DOM imports — pure module
- [ ] No side effects at module import time (bezier cache is lazy)
- [ ] MIRROR pattern followed

---

## Anti-Patterns

- Do not call `structuredClone(params)` per frame — use the shallow-merge-mutated-sections pattern from the research doc.
- Do not reset the bezier cache between applyModulation calls — cache lives for the session.
- Do not export a mutable cache handle from this module.
- Do not use `any` to shortcut the `ParamState` section typing — use `keyof ParamState` + `Record<string, unknown>` cast.
- Do not clamp input range BEFORE computing `t` — clamp after division so inverted ranges still work.
- Do not add a `modulationStore` import — evaluator is pure.

---

## No Prior Knowledge Test

- [ ] Every file path in `All Needed Context` exists in the codebase or is marked CREATE
- [ ] Every URL in `urls:` is reachable
- [ ] Every D-number cited exists in DISCOVERY.md (D13, D14, D15, D18, D20, D21)
- [ ] Implementation Tasks are topologically sorted
- [ ] Validation Loop commands are copy-paste runnable, no placeholders
- [ ] MIRROR file `src/engine/paramStore.ts` exists (Phase 2 deliverable)
- [ ] Task is atomic — no dependency on future tasks

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/tweakpane-params-presets/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
