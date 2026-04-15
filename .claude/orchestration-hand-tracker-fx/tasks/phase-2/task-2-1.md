# Task 2.1: Define Effect Manifest + Registry Types

**Phase**: 2 — Engine + Overlay
**Branch**: `task/2-1-effect-registry-types`
**Commit prefix**: `Task 2.1:`
**Estimated complexity**: Low
**Max Ralph iterations**: 10

---

## Goal

**Feature Goal**: Publish the canonical TypeScript type surface for every future effect — `EffectManifest`, `EffectInstance`, `ParamDef`, `ParamType`, `ModulationSourceDef` — plus re-exports of `FrameContext` and `Landmark` from the canonical `src/engine/types.ts` (created by Task 1.5), plus a tiny global `effectRegistry` that later phases mount effects into.

**Deliverable**:
- `src/engine/manifest.ts` — type-only module (exports types, no runtime code). `FrameContext` and `Landmark` are re-exported from `./types` (single source of truth created by Task 1.5) — this file does NOT redeclare them.
- `src/engine/registry.ts` — `registerEffect`, `getEffect`, `listEffects`, `clearRegistry` (test-only)
- `src/engine/registry.test.ts` — Vitest unit suite (register/get/list/duplicate-throws)

**Success Definition**: `pnpm typecheck` exits 0, `pnpm lint src/engine` exits 0, `pnpm vitest run src/engine/registry.test.ts` exits 0 with all tests green, and importing `registerEffect` from `src/engine/registry.ts` anywhere in the codebase produces correct type inference against a provided `EffectManifest<TParams>` generic.

---

## User Persona

**Target User**: Creative technologist (the eventual app user) + the future execution agent building Task 2.5 and Phase 3 tasks.

**Use Case**: Before Task 2.5 can `registerEffect(handTrackingMosaicManifest)`, the manifest shape must be locked down and the registry must accept it without type errors.

**User Journey**:
1. Task 2.5 writes `const handTrackingMosaicManifest: EffectManifest<HandTrackingMosaicParams> = { ... }`
2. The manifest literal type-checks against the exported interface in `manifest.ts`
3. `registerEffect(handTrackingMosaicManifest)` compiles and the manifest appears in `listEffects()`
4. Phase 4 modulation code reads `manifest.modulationSources` and wires the default routes

**Pain Points Addressed**: Without a stable type contract, every later task would be mutually dependent on ad-hoc shape changes. This task pins the contract.

---

## Why

- Required by D36: `EffectManifest` / `EffectInstance` contract — the only entry point for effects
- Required by D37: `FrameContext` shape passed to effects per frame
- Satisfies D38: folder layout under `src/engine/`
- Unlocks Task 2.2 (paramStore uses `ParamDef`), Task 2.5 (manifest consumer), and all of Phase 3 (effect `create()` + `render()` signatures)
- Integrates with Task 1.4 / 1.5: the `Landmark` type exported here matches what `tracking/handLandmarker.ts` produces and what `engine/renderLoop.ts` threads through `FrameContext`

---

## What

- Export a generic `EffectManifest<TParams>` interface containing `id`, `displayName`, `version`, `description`, `params`, `defaultParams`, `modulationSources`, `create(gl)`
- Export `EffectInstance` interface with `render(ctx: FrameContext)` + `dispose()`
- Export `ParamDef` as a **discriminated union** over `ParamType` — each variant carries the fields valid for that type (no optional-everywhere bag of fields)
- Re-export `FrameContext` and `Landmark` from `./types` (single source of truth — created in Task 1.5). `src/engine/manifest.ts` does NOT redeclare these types. `Landmark` is unified as `NormalizedLandmark` from `@mediapipe/tasks-vision` (re-exported as `Landmark`).
- Export `ModulationSourceDef` type (label + id + value-extractor stub) for Phase 4 forward compat
- Registry module exports `registerEffect`, `getEffect`, `listEffects`, `clearRegistry` (test-only helper)
- Registry throws on duplicate `id` registration; `getEffect` throws on unknown `id`
- All types are `export type` — no classes, no default exports, no barrel re-exports

### NOT Building (scope boundary)

- No `handTrackingMosaic` manifest (Task 2.5)
- No `paramStore` (Task 2.2)
- No Tweakpane `ParamDef` → binding adapter (Task 2.2)
- No modulation evaluator (Phase 4)
- No `FrameContext` resolver — types only; Phase 1.5 already implemented the runtime shape
- No React components
- No preset schema — `Preset` lives in `src/engine/presets.ts` (Phase 4)

### Success Criteria

- [ ] `src/engine/manifest.ts` exports `EffectManifest`, `EffectInstance`, `ParamDef`, `ParamType`, `ModulationSourceDef` (all as `export type`), AND re-exports `FrameContext` + `Landmark` from `./types` via `export type { FrameContext, Landmark } from './types'`
- [ ] `src/engine/manifest.ts` does NOT redeclare `FrameContext` or `Landmark` (single source of truth is `src/engine/types.ts` from Task 1.5)
- [ ] `ParamDef` is a discriminated union — `type: 'number'` variant requires `min`/`max`, `type: 'select'` variant requires `options`, `type: 'button'` variant requires `onClick`, etc.
- [ ] `src/engine/registry.ts` exports `registerEffect`, `getEffect`, `listEffects`, `clearRegistry`
- [ ] `registerEffect` accepts a generic `EffectManifest<TParams>` and preserves `TParams` through `getEffect`
- [ ] `registerEffect` throws on duplicate `id`
- [ ] `getEffect` throws on unknown `id`
- [ ] `pnpm lint src/engine/manifest.ts src/engine/registry.ts src/engine/registry.test.ts` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm vitest run src/engine/registry.test.ts` exits 0 with 5+ tests

---

## All Needed Context

> **Context Completeness Check**: An agent with zero prior knowledge of this codebase must be able to implement this task using only this file. The registry pattern is documented inline; the `ParamDef` union is specified below byte-for-byte.

```yaml
files:
  - path: src/App.tsx
    why: Only existing React source — confirms file conventions (named exports, no semicolon-free, PascalCase component)
    gotcha: Biome v2 enforces single style; match existing indentation (2 spaces) and semicolons

  - path: src/App.test.tsx
    why: MIRROR this test file's structure — `describe` + `it`, Vitest imports, `@testing-library/react`
    gotcha: Tests import with `.tsx`/`.ts` extension omitted; Vitest resolves via tsconfig paths

  - path: package.json
    why: Confirm pnpm scripts (`lint`, `typecheck`, `test`), deps already installed (tweakpane, ogl, @mediapipe/tasks-vision)
    gotcha: Do NOT add dependencies in this task — only types

  - path: biome.json
    why: Know the enabled rules (noExplicitAny, noUnusedVariables) before writing code
    gotcha: Biome v2 treats `noExplicitAny` as error; use `unknown` and narrow

  - path: tsconfig.app.json
    why: Confirm strict flags (noUncheckedIndexedAccess, noImplicitOverride)
    gotcha: Array access returns `T | undefined` under noUncheckedIndexedAccess — must guard

urls:
  - url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
    why: ParamDef is a discriminated union; this is the canonical pattern reference
    critical: The `type` field must be a string literal type in each variant for narrowing to work

  - url: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/hand_landmarker/hand_landmarker_result.d.ts
    why: Landmark shape — `{x, y, z, visibility?}` in normalized 0..1 coordinates
    critical: MediaPipe returns `NormalizedLandmark[]` from `detectForVideo(...).landmarks`. Align our `Landmark` type with that.

  - url: https://vitest.dev/api/#describe
    why: Vitest `describe`/`it`/`expect`/`beforeEach`/`afterEach` API
    critical: Use `vitest run` (not `vitest` watch) in validation loop

skills:
  - hand-tracker-fx-architecture
  - prp-task-ralph-loop
  - tweakpane-params-presets   # read for ParamDef/ParamState conventions
  - vitest-unit-testing-patterns

discovery:
  - D16: Tech stack — React 19 + Vite 8 + TypeScript 6 strict + pnpm 10 + Biome v2 + Vitest 4
  - D36: `EffectManifest<TParams>` with `id/displayName/params/defaultParams/modulationSources/create(gl)`; global `effectRegistry`; `registerEffect(manifest)` is the only entry point
  - D37: `FrameContext` = `{ videoTexture, videoSize, landmarks, params, timeMs }`
  - D38: Folder structure — `src/engine/` holds `manifest.ts`, `registry.ts`, `paramStore.ts`, `modulation.ts`
```

### Current Codebase Tree (relevant subset)

```
src/
  App.tsx
  App.test.tsx
  index.css
  main.tsx
  test/          # (test setup, if present from Phase 1)
package.json
biome.json
tsconfig.json
tsconfig.app.json
tsconfig.node.json
vite.config.ts
playwright.config.ts
```

### Desired Codebase Tree (files this task adds)

```
src/
  engine/
    manifest.ts          # type-only: EffectManifest, EffectInstance, ParamDef, ParamType,
                         # ModulationSourceDef, FrameContext, Landmark
    registry.ts          # registerEffect, getEffect, listEffects, clearRegistry
    registry.test.ts     # Vitest suite — covers register/get/list/duplicate/clear
```

No existing files are modified.

### Known Gotchas

```typescript
// CRITICAL: React StrictMode runs effects twice in dev.
// Not applicable to pure type/module code in this task, but cleanup discipline matters
// for anyone who imports the registry later.

// CRITICAL: Biome v2 is the single linter + formatter (no ESLint, no Prettier).
// Run: pnpm biome check --write src/engine   (auto-fix during active development)
// Run: pnpm lint src/engine                   (check only — used in validation loop)

// CRITICAL: TypeScript strict + noUncheckedIndexedAccess is ON.
// Registry.get() and array lookups return `T | undefined` — narrow or throw.
// Using `any` is a BUILD FAILURE, not a warning. Use `unknown` and narrow.

// CRITICAL: pnpm, not npm or bun. All commands: pnpm install, pnpm run <script>.

// CRITICAL: ParamDef is a DISCRIMINATED UNION on `type`, not an interface with optional fields.
// Optional-everywhere patterns break exhaustiveness checks and force unsafe casts in
// buildPaneFromManifest (Task 2.2).

// CRITICAL: EffectManifest.create signature is PINNED to `create(gl: WebGL2RenderingContext): EffectInstance`.
// NOT ogl's Renderer, and NOT with a `deps` parameter. The engine passes the raw WebGL2
// context; the effect decides whether to wrap it. This keeps the manifest type
// independent of ogl and testable without a WebGL context (mock the ctx in Task 2.5).
// Phase 3 (Task 3.4) does NOT modify this signature — instead, it sources the Renderer
// and video Texture via module-scoped refs exposed by `src/engine/renderer.ts`
// (`getRenderer()`, `getVideoTexture()`). This preserves backward compatibility with
// Task 2.5's `satisfies EffectManifest<HandTrackingMosaicParams>` literal.

// CRITICAL: `FrameContext` and `Landmark` are declared in `src/engine/types.ts`
// (created by Task 1.5). This module RE-EXPORTS them via
// `export type { FrameContext, Landmark } from './types'`. Never redeclare.
// `Landmark` is unified as `NormalizedLandmark` from '@mediapipe/tasks-vision'.

// CRITICAL: EffectInstance.render(ctx: FrameContext) — ctx is read-only per frame.
// Effects MUST NOT mutate ctx.params in place. If modulation is needed, compose at the
// engine boundary before calling render().

// CRITICAL: This task creates ONLY types + a tiny registry. Do not import from OGL,
// MediaPipe, or Tweakpane here. Those are consumer concerns.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/engine/manifest.ts

// Re-export the canonical FrameContext + Landmark types from src/engine/types.ts
// (single source of truth — created in Task 1.5). DO NOT redeclare.
// `Landmark` is an alias for MediaPipe's `NormalizedLandmark`.
export type { FrameContext, Landmark } from './types';

/**
 * Param type tags — the discriminator for ParamDef.
 */
export type ParamType =
  | 'number'
  | 'integer'
  | 'boolean'
  | 'select'
  | 'color'
  | 'string'
  | 'button';

/** Shared fields on every variant. */
type ParamBase = {
  key: string;       // dot-path: 'grid.seed', 'mosaic.tileSize'
  label: string;
  page?: string;     // tab name; default 'Main'
  folder?: string;   // optional folder within the page
};

/** Discriminated variants — each carries only the fields that make sense. */
export type ParamDef =
  | (ParamBase & {
      type: 'number';
      defaultValue: number;
      min: number;
      max: number;
      step?: number;
      displayMin?: number;
      displayMax?: number;
    })
  | (ParamBase & {
      type: 'integer';
      defaultValue: number;
      min: number;
      max: number;
      step?: number;
    })
  | (ParamBase & {
      type: 'boolean';
      defaultValue: boolean;
    })
  | (ParamBase & {
      type: 'select';
      defaultValue: string | number;
      options: Record<string, string | number>;
    })
  | (ParamBase & {
      type: 'color';
      defaultValue: string; // hex '#rrggbb'
    })
  | (ParamBase & {
      type: 'string';
      defaultValue: string;
    })
  | (ParamBase & {
      type: 'button';
      /**
       * `allParams` is a READ-ONLY snapshot of the paramStore state at the time of
       * click. Mutating it is a no-op. To write back, use `paramStore.set(key, value)`
       * (imported via closure by the manifest author). Example:
       *   onClick: () => paramStore.set('grid.seed', (Math.random() * 2 ** 32) >>> 0)
       */
      onClick: (allParams: Record<string, unknown>) => void;
    });

/**
 * Modulation source descriptor (Phase 4 consumes this).
 * For 2.1 we only need the type + a list on the manifest.
 */
// Import the Landmark type for use in ModulationSourceDef below.
import type { Landmark } from './types';

export type ModulationSourceDef = {
  id: string;                      // 'landmark[8].x', 'pinch', 'centroid.y'
  label: string;
  // Extractor stub — Phase 4 implements the real resolver.
  // Keep optional to avoid coupling 2.1 to landmark runtime code.
  extract?: (landmarks: Landmark[] | null) => number | undefined;
};

/**
 * An active effect instance — created by EffectManifest.create(gl).
 * Lifetime managed by the engine; disposed on effect swap or unmount.
 */
export type EffectInstance = {
  render(ctx: FrameContext): void;
  dispose(): void;
};

/**
 * Generic manifest — TParams narrows defaultParams + helps consumers type their
 * params object. Default generic permits untyped registration for test scaffolding.
 */
export type EffectManifest<TParams = Record<string, unknown>> = {
  id: string;
  displayName: string;
  version: string;
  description: string;
  params: ParamDef[];
  defaultParams: TParams;
  modulationSources: ModulationSourceDef[];
  create(gl: WebGL2RenderingContext): EffectInstance;
};
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/engine/manifest.ts
  - IMPLEMENT: All five locally-declared types (ParamType, ParamDef, ModulationSourceDef, EffectInstance, EffectManifest) exactly as in "Data Models" above; plus a re-export line `export type { FrameContext, Landmark } from './types'` (canonical types live in Task 1.5's types.ts)
  - MIRROR: none (first engine/ file) — follow src/App.tsx naming/semicolon conventions
  - NAMING: PascalCase types, camelCase fields, kebab-case files
  - GOTCHA: `ParamDef` MUST be a discriminated union (literal `type` field in each variant)
  - GOTCHA: Export every type with `export type` — no runtime code in this file
  - GOTCHA: DO NOT redeclare `FrameContext` or `Landmark` — they are single-source in `src/engine/types.ts` (Task 1.5). Re-exporting keeps downstream imports (`from '../../engine/manifest'` and `from '../../engine/types'`) both valid and guarantees nominal identity.
  - GOTCHA: `create(gl: WebGL2RenderingContext): EffectInstance` — this signature is PINNED. Do not add a second `deps` parameter (Phase 3 Task 3.4 sources renderer/texture via module refs exported by `src/engine/renderer.ts`, not via the manifest signature).
  - VALIDATE: pnpm lint src/engine/manifest.ts && pnpm typecheck

Task 2: CREATE src/engine/registry.ts
  - IMPLEMENT:
      - Module-private `Map<string, EffectManifest>` (cast at insertion — see below)
      - `export function registerEffect<T>(manifest: EffectManifest<T>): void`
          • throws `new Error(\`Effect "\${id}" is already registered\`)` on duplicate id
      - `export function getEffect<T = Record<string, unknown>>(id: string): EffectManifest<T>`
          • throws `new Error(\`Effect "\${id}" not found in registry\`)` on miss
          • cast to `EffectManifest<T>` on retrieval (consumer asserts T)
      - `export function listEffects(): EffectManifest[]`
          • returns `Array.from(map.values())`
      - `export function clearRegistry(): void`
          • test-only helper; documented with `/** @internal test-only */`
  - MIRROR: src/App.tsx (named exports, no default, semicolons match)
  - NAMING: camelCase functions
  - GOTCHA: Map is module-scoped — multiple test files sharing the same Vitest process share the map.
    registry.test.ts MUST call `clearRegistry()` in beforeEach.
  - GOTCHA: The `Map<string, EffectManifest>` stores with `Record<string, unknown>` default.
    getEffect<T>() casts to EffectManifest<T>; this is a documented, narrow use of a type assertion
    (not `as any`). It is the only acceptable cast in this file.
  - VALIDATE: pnpm lint src/engine/registry.ts && pnpm typecheck

Task 3: CREATE src/engine/registry.test.ts
  - IMPLEMENT: Vitest suite — at minimum these tests:
      1. 'registers a manifest and returns it via getEffect'
      2. 'listEffects returns all registered manifests'
      3. 'throws on duplicate id'
      4. 'throws on unknown id from getEffect'
      5. 'clearRegistry empties the store'
      6. 'preserves TParams generic through getEffect'
          — compile-time check; assert .defaultParams has the right shape
  - MIRROR: src/App.test.tsx (describe + it, vitest imports)
  - MOCK: none — pure data
  - GOTCHA: `beforeEach(() => clearRegistry())` so tests don't leak state
  - GOTCHA: Build a minimal `EffectManifest` fixture with a noop `create()` returning
    `{ render: () => {}, dispose: () => {} }`
  - VALIDATE: pnpm vitest run src/engine/registry.test.ts
```

### Integration Points

```yaml
CONSUMED_BY:
  - src/engine/paramStore.ts (Task 2.2): imports ParamDef to shape the store keys
  - src/engine/buildPaneFromManifest.ts (Task 2.2): iterates manifest.params, discriminates on ParamDef.type
  - src/effects/handTrackingMosaic/manifest.ts (Task 2.5): declares EffectManifest<HandTrackingMosaicParams>
  - src/effects/handTrackingMosaic/index.ts (Task 2.5): calls registerEffect(handTrackingMosaicManifest)
  - src/engine/renderer.ts (Task 3.1): constructs EffectInstance via manifest.create(gl), then calls render(ctx)

EXPORTS:
  - src/engine/manifest.ts
      - export type EffectManifest<TParams>
      - export type EffectInstance
      - export type ParamDef
      - export type ParamType
      - export type ModulationSourceDef
      - export type FrameContext
      - export type Landmark
  - src/engine/registry.ts
      - export function registerEffect
      - export function getEffect
      - export function listEffects
      - export function clearRegistry
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm lint src/engine/manifest.ts src/engine/registry.ts src/engine/registry.test.ts
pnpm typecheck
```

Expected: zero errors. Fix all Biome and TypeScript errors before proceeding to L2.

### Level 2 — Unit Tests

```bash
pnpm vitest run src/engine/registry.test.ts
```

Expected: all 6+ tests pass. If any fail, read the full error output — do not guess from the first line.

### Level 3 — Integration (production build)

```bash
pnpm build
```

Expected: exits 0. The new module is tree-shaken cleanly (types-only file + tiny runtime registry). `tsc -b` must not complain about orphan types.

### Level 4 — E2E

```bash
pnpm test:e2e -- --grep "Task 2.1:"
```

Expected: this task has **no user-visible behavior** so the E2E suite ships a single `tests/e2e/engine-registry.spec.ts` with a `describe('Task 2.1: registry types', ...)` block that:

1. Navigates to `/`
2. Evaluates `window.__handTracker?.__engine?.listEffects?.() ?? []` via `page.evaluate(...)`
3. Asserts the dev-hook exists and returns an array (length 0 at this point — no effects registered yet)

If Task 1.5 did not install the `window.__handTracker` dev hook, this L4 ships a no-op spec that runs `describe.skip('Task 2.1: ...')` so `--grep` still matches. Do NOT emit `<promise>COMPLETE</promise>` if the grep mismatches and reports "0 tests found".

To make the dev hook inspectable, Task 2.1 ALSO adds a minimal re-export to `src/engine/devHooks.ts` (if the file exists from Task 1.5):

```typescript
// src/engine/devHooks.ts (modify)
import { listEffects } from './registry';
// ... existing dev-hook registration
(window as Window & { __handTracker?: Record<string, unknown> }).__handTracker = {
  ...(window as Window & { __handTracker?: Record<string, unknown> }).__handTracker,
  __engine: { listEffects },
};
```

If `src/engine/devHooks.ts` does not exist, skip the modify and rely on the `describe.skip('Task 2.1: ...')` no-op spec.

---

## Final Validation Checklist

### Technical

- [ ] `pnpm lint src/engine` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm vitest run` — all tests pass (not just registry.test.ts)
- [ ] `pnpm build` — production build succeeds
- [ ] `pnpm test:e2e -- --grep "Task 2.1:"` — exits 0

### Feature

- [ ] All seven types exported from `src/engine/manifest.ts`
- [ ] `ParamDef` is a discriminated union — compile-time test: assigning `{ type: 'number', min: 0 }` without `max` is a type error
- [ ] `registerEffect(manifest)` with duplicate id throws
- [ ] `getEffect('unknown')` throws
- [ ] `listEffects()` returns array
- [ ] `clearRegistry()` empties the map

### Code Quality

- [ ] No `any` types
- [ ] No default exports
- [ ] No runtime code in `manifest.ts` (types only)
- [ ] Registry uses a single controlled type assertion (documented) — not `as any`
- [ ] No React state, no imports from OGL/MediaPipe/Tweakpane

---

## Anti-Patterns

- Do not use `any` — use `unknown` and narrow, or specify `TParams` generic
- Do not make `ParamDef` an interface with optional fields — it must be a discriminated union
- Do not default-export anything from `manifest.ts` or `registry.ts`
- Do not add runtime side effects at module load in `manifest.ts`
- Do not expose the internal `Map` — only the four named functions
- Do not import ogl, MediaPipe, or Tweakpane in this task
- Do not skip `clearRegistry()` in `beforeEach` — tests will leak
- Do not use `npm` / `npx` / `bun` — project is pnpm-only
- Do not add `// biome-ignore` or `// @ts-expect-error` — fix the underlying issue
- Do not emit `<promise>COMPLETE</promise>` if any validation level is failing

---

## No Prior Knowledge Test

- [x] Every file path in `All Needed Context` exists (src/App.tsx, App.test.tsx, package.json, biome.json, tsconfig.app.json all confirmed present from Phase 1 scaffold)
- [x] Every URL in `urls:` is reachable and points to the correct section
- [x] Every D-number cited (D16, D36, D37, D38) exists in DISCOVERY.md
- [x] Implementation Tasks are topologically sorted (types → registry → tests)
- [x] Validation Loop commands are copy-paste runnable with no placeholders
- [x] MIRROR files (src/App.tsx, src/App.test.tsx) exist in the codebase
- [x] Task is atomic — depends only on Phase 1 scaffold, no forward dependency

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/tweakpane-params-presets/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
