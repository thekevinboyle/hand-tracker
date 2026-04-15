# Task 4.3: Preset Schema + localStorage + Import/Export

**Phase**: 4 — Modulation, Presets, Record, A11y
**Branch**: `task/4-3-presets-persistence`
**Commit prefix**: `Task 4.3:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Implement the Preset CRUD API (save/load/delete/list/export-json/import-json) with a versioned `version: 1` schema per D29, manual `isValidPreset` type guard (no zod), localStorage persistence under `hand-tracker-fx:presets:v1`, and `DEFAULT_PRESET` seeding on first launch.

**Deliverable**:
- `src/engine/presets.ts` — CRUD + file I/O + default seeding
- `src/engine/presets.test.ts` — ≥15 passing Vitest cases with jsdom
- `src/ui/PresetActions.tsx` — Save / Save-As / Delete / Export / Import buttons (React, invoked from Panel.tsx)

**Success Definition**: `pnpm vitest run src/engine/presets.test.ts` exits 0; round-trip test (save → clear stores → load → stores equal original) passes; importing a `version: 2` JSON file is rejected with a thrown Error.

---

## User Persona

**Target User**: Creative technologist saving a look they like.

**Use Case**: User tunes params + modulation routes, clicks "Save As", types "Warp-Tiny", and it persists across page reloads.

**User Journey**:
1. User tweaks `mosaic.tileSize` and a modulation route.
2. Clicks "Save As" in the Presets panel.
3. Types a name in the browser prompt, hits Enter.
4. Reloads the page.
5. Cycles to their preset (Task 4.4) — same values restore.
6. Optional: exports `.json`, emails it to a friend, friend imports it.

**Pain Points Addressed**: Without persistence, every session starts at defaults. Without export, collabs can't share looks.

---

## Why

- Satisfies D29 (schema), D30 (Save/Save-As/Delete/List + initial Default preset).
- Required by Task 4.4 (chevron cycler reads the preset list).
- Forward-compat `version: 1` + `effectId: 'handTrackingMosaic'` guards against schema drift.
- Without this, no preset-based demo / share workflow exists.

---

## What

- Preset schema exactly per D29 — `version: 1`, `name`, `effectId: 'handTrackingMosaic'`, `params: ParamState`, `modulationRoutes: ModulationRoute[]`, `createdAt: ISO string`.
- Storage key `hand-tracker-fx:presets:v1`; parsed as `Preset[]`.
- `isValidPreset` guard rejects: missing fields, wrong `version`, wrong `effectId`, non-array `modulationRoutes`, non-object `params`.
- `savePreset(name)` snapshots `paramStore.snapshot` + `modulationStore.getSnapshot().routes` via `structuredClone`.
- `loadPreset(name)` calls `paramStore.replace()` + `modulationStore.setRoutes()` then returns `true` / `false`.
- `exportPresetFile(name)` triggers a blob download.
- `importPresetFile(file)` validates, writes, optionally loads.
- `initializePresetsIfEmpty()` seeds `DEFAULT_PRESET` and loads it.

### NOT Building (scope boundary)

- No zod, no runtime schema library (D29: "manual validation sufficient").
- No preset thumbnails / snapshots.
- No cloud sync.
- No preset tags / search.
- No migration logic (version >1 files are rejected, not upgraded).

### Success Criteria

- [ ] `pnpm biome check src/engine/presets.ts src/engine/presets.test.ts src/ui/PresetActions.tsx` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run src/engine/presets.test.ts` exits 0 with ≥15 passing
- [ ] Round-trip test: save → mutate stores → load → stores equal originals
- [ ] `isValidPreset({ version: 2, ... })` returns false
- [ ] `importPresetFile` on corrupt JSON throws "not valid JSON"
- [ ] `exportPresetFile` creates an `<a>` with `download` attribute and calls `.click()`

---

## All Needed Context

```yaml
files:
  - path: src/engine/paramStore.ts
    why: Provides `ParamState` type, `DEFAULT_PARAM_STATE` const, and `paramStore.replace(next)`
    gotcha: `replace()` notifies subscribers; Tweakpane needs `pane.refresh()` after (handled by preset load call site, not by presets.ts)

  - path: src/engine/modulationStore.ts
    why: Provides `modulationStore.setRoutes(routes)` and `getSnapshot().routes`
    gotcha: setRoutes replaces the entire array — pass a structuredClone if the input could be mutated later

  - path: src/engine/modulation.ts
    why: Exports `ModulationRoute`, `DEFAULT_MODULATION_ROUTES` used in DEFAULT_PRESET
    gotcha: Import types, not values, where possible

  - path: src/ui/Panel.tsx
    why: React host where PresetActions will be rendered inline (above the Pane container)
    gotcha: Panel.tsx already manages pane lifecycle; PresetActions only dispatches store mutations then calls paneRef.current?.refresh()

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/API/Storage/localStorage
    why: quota, JSON serialization, synchronous API
    critical: Safari private mode throws on setItem — wrap in try/catch and log a warning

  - url: https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
    why: Blob URL for file download; must revoke after click to prevent leaks
    critical: Call `URL.revokeObjectURL(url)` after triggering the download (or in a setTimeout 0)

  - url: https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone
    why: Deep-clone ParamState and modulationRoutes without JSON round-trip
    critical: Chrome 98+, Firefox 94+, Safari 15.4+ — all in target (D21)

skills:
  - tweakpane-params-presets
  - hand-tracker-fx-architecture
  - vitest-unit-testing-patterns

discovery:
  - D29: Exact Preset schema (version 1, name, effectId, params, modulationRoutes, createdAt)
  - D30: UI requirements — Save / Save As / Delete / list; Default preset seeded on first launch
  - D20: paramStore is plain object; presets write via paramStore.replace()
  - D21: Vitest for utilities; jsdom environment needed for localStorage
```

### Current Codebase Tree

```
src/
  engine/
    paramStore.ts          # exports ParamState, DEFAULT_PARAM_STATE, paramStore
    modulation.ts          # Task 4.1 — exports ModulationRoute, DEFAULT_MODULATION_ROUTES
    modulationStore.ts     # Phase 2
  ui/
    Panel.tsx              # React host
```

### Desired Codebase Tree

```
src/
  engine/
    presets.ts             # CREATE — CRUD + file I/O + DEFAULT_PRESET + initializePresetsIfEmpty
    presets.test.ts        # CREATE — Vitest suite
  ui/
    PresetActions.tsx      # CREATE — Save / Save As / Delete / Export / Import buttons
```

### Known Gotchas

```typescript
// CRITICAL: The Preset schema is EXACTLY D29. Any deviation breaks forward compat.
// version: 1 (literal), effectId: 'handTrackingMosaic' (literal).
//
//   export type Preset = {
//     version: 1
//     name: string
//     effectId: 'handTrackingMosaic'
//     params: ParamState
//     modulationRoutes: ModulationRoute[]
//     createdAt: string // ISO 8601
//   }

// CRITICAL: isValidPreset is a MANUAL type guard. No zod, no yup, no io-ts.
// Must check every field — version, name (string), effectId (literal), params (object-not-null),
// modulationRoutes (array), createdAt (string). Reject on first failure with `return false`.

// CRITICAL: localStorage writes can throw (quota, private mode). Wrap writeStorage in try/catch
// and console.warn — NEVER swallow silently, but do not throw from save(). A failed save should
// still return the preset object (user sees it in the live list until reload).

// CRITICAL: structuredClone must be used for params/routes. JSON round-trip drops undefined
// and mangles dates. structuredClone preserves types and is fast.

// CRITICAL: The exported JSON file contains a SINGLE Preset object, not an array.
// Naming: `${name-sanitized}.hand-tracker-fx.json`. Sanitize with /[^a-z0-9_-]/gi → '_'.

// CRITICAL: Import rejects version:2 — we do NOT migrate. This is deliberate forward compat.

// CRITICAL: The PresetActions component is the ONLY place that calls `paneRef.current?.refresh()`
// after a preset load. Without refresh, Tweakpane shows stale values until the user interacts.

// CRITICAL: Use `window.prompt` for name input (MVP keeps it simple). Do NOT add a modal library.
// Sanitize the returned string (trim, reject empty).

// CRITICAL: Biome v2, pnpm, no 'use client'.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/engine/presets.ts — full type

import type { ParamState } from './paramStore'
import type { ModulationRoute } from './modulation'

export type Preset = {
  version: 1
  name: string
  effectId: 'handTrackingMosaic'
  params: ParamState
  modulationRoutes: ModulationRoute[]
  createdAt: string  // ISO 8601
}

function isValidPreset(p: unknown): p is Preset {
  if (typeof p !== 'object' || p === null) return false
  const o = p as Record<string, unknown>
  return (
    o.version === 1 &&
    typeof o.name === 'string' &&
    o.effectId === 'handTrackingMosaic' &&
    typeof o.params === 'object' && o.params !== null &&
    Array.isArray(o.modulationRoutes) &&
    typeof o.createdAt === 'string'
  )
}
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/engine/presets.ts
  - IMPLEMENT: |
      const STORAGE_KEY = 'hand-tracker-fx:presets:v1'
      function readStorage(): Preset[]
      function writeStorage(presets: Preset[]): void
      function isValidPreset(p: unknown): p is Preset
      export function listPresets(): Preset[]
      export function getPreset(name: string): Preset | undefined
      export function savePreset(name: string): Preset
      export function loadPreset(name: string): boolean
      export function deletePreset(name: string): void
      export function exportPresetFile(name: string): void
      export async function importPresetFile(file: File, opts?: { loadImmediately?: boolean }): Promise<Preset>
      export const DEFAULT_PRESET: Preset
      export function initializePresetsIfEmpty(): void
  - MIRROR: src/engine/modulation.ts (pure module, named exports, no default export)
  - GOTCHA: DEFAULT_PRESET uses structuredClone of DEFAULT_PARAM_STATE and DEFAULT_MODULATION_ROUTES
            and a stable ISO timestamp ('2026-04-14T00:00:00.000Z') so snapshot tests don't drift
  - VALIDATE: pnpm biome check src/engine/presets.ts && pnpm tsc --noEmit

Task 2: CREATE src/engine/presets.test.ts
  - IMPLEMENT: Vitest suite (jsdom env), covering:
      1. listPresets on fresh storage → []
      2. savePreset('A') → listPresets includes 'A'
      3. savePreset('A') twice → only one entry (replace behavior)
      4. deletePreset removes entry
      5. loadPreset returns false for unknown name
      6. Round-trip: save → mutate stores → load → stores equal original snapshot
      7. isValidPreset rejects null, arrays, missing fields, version:2, wrong effectId
      8. importPresetFile on corrupt JSON throws "not valid JSON"
      9. importPresetFile on wrong-schema throws "failed validation"
      10. importPresetFile valid file writes to storage and optionally loads
      11. exportPresetFile creates anchor with download attribute (assert via DOM)
      12. exportPresetFile on unknown name → warn, no throw
      13. DEFAULT_PRESET has version:1 and effectId 'handTrackingMosaic'
      14. initializePresetsIfEmpty on empty → seeds DEFAULT_PRESET
      15. initializePresetsIfEmpty on non-empty → no-op
      16. readStorage tolerates malformed JSON (returns [])
  - MOCK: localStorage is provided by jsdom; no mocks needed for it. For exportPresetFile,
          spy document.createElement and URL.createObjectURL.
  - MIRROR: src/engine/modulation.test.ts (Task 4.1)
  - VALIDATE: pnpm vitest run src/engine/presets.test.ts

Task 3: CREATE src/ui/PresetActions.tsx
  - IMPLEMENT: |
      type Props = { paneRef: RefObject<Pane | null> }
      export function PresetActions({ paneRef }: Props): JSX.Element
  - DETAILS:
      - Buttons: Save, Save As, Delete, Export, Import (file input)
      - Save: if a "current" preset name is known (via presetCycler state — optional, can be local state), call savePreset(currentName)
      - Save As: `const name = window.prompt('Preset name')`; trim; if not empty, savePreset(name)
      - Delete: `window.confirm` guard, then deletePreset(currentName)
      - Export: exportPresetFile(currentName)
      - Import: <input type="file" accept=".json"> → importPresetFile(file); on success paneRef.current?.refresh()
      - After any load: paneRef.current?.refresh()
  - MIRROR: any existing src/ui/*.tsx (dark theme, button class conventions)
  - NAMING: PascalCase component, camelCase handlers
  - GOTCHA: No 'use client' directive. No React state for the preset data; rely on presets.ts functions.
  - VALIDATE: pnpm biome check src/ui/PresetActions.tsx && pnpm tsc --noEmit

Task 4: MODIFY src/main.tsx (or the app bootstrap file)
  - FIND: the line that renders the React root OR the first line of effect bootstrap
  - ADD: `import { initializePresetsIfEmpty } from '../engine/presets'`
         and call `initializePresetsIfEmpty()` BEFORE `createRoot(...).render(...)`
  - PRESERVE: existing bootstrap order
  - VALIDATE: pnpm build
```

### Integration Points

```yaml
PARAM_STORE:
  - savePreset reads paramStore.snapshot via structuredClone
  - loadPreset writes via paramStore.replace(preset.params)

MODULATION_STORE:
  - savePreset reads modulationStore.getSnapshot().routes
  - loadPreset writes via modulationStore.setRoutes(preset.modulationRoutes)

PANE_REFRESH:
  - PresetActions calls paneRef.current?.refresh() after any load
  - presets.ts itself never touches the Pane

STORAGE:
  - Key: 'hand-tracker-fx:presets:v1'
  - Value: JSON.stringify(Preset[])

FILE_IO:
  - Export: Blob → createObjectURL → <a download> → click → revokeObjectURL
  - Import: File → text() → JSON.parse → isValidPreset → writeStorage → optional loadPreset
```

---

## Validation Loop

### Level 1 — Syntax & Style

```bash
pnpm biome check src/engine/presets.ts src/engine/presets.test.ts src/ui/PresetActions.tsx
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/engine/presets.test.ts
pnpm vitest run
```

Requires `vitest.config.ts` to have `environment: 'jsdom'` (Phase 1 deliverable — verify).

### Level 3 — Integration

```bash
pnpm build
```

### Level 4 — E2E (satisfied by Task 4.R)

```bash
pnpm test:e2e --grep "Task 4.3:"
```

If not present, mark N/A and defer to 4.R.

---

## Final Validation Checklist

### Technical

- [ ] All 4 levels exit 0 (L4 may be N/A)
- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm vitest run` — all tests pass

### Feature

- [ ] Round-trip save/load preserves params and routes exactly
- [ ] DEFAULT_PRESET seeds on first launch
- [ ] version:2 import is rejected with a thrown Error
- [ ] Export triggers a .json download
- [ ] window.prompt Save As flow works in the browser

### Code Quality

- [ ] No `any` types
- [ ] No zod / ajv / yup — manual guard only
- [ ] structuredClone used for deep copies (not JSON round-trip)
- [ ] try/catch around localStorage writes with `console.warn`
- [ ] `URL.revokeObjectURL` called after download

---

## Anti-Patterns

- Do not use zod or a validation library.
- Do not migrate version:2 files silently — reject.
- Do not store Tweakpane `exportState()` in `params` — store the semantic `ParamState` only (D29 commentary in research).
- Do not JSON.stringify for deep clone — use `structuredClone`.
- Do not call `paneRef.current?.refresh()` inside presets.ts — keep it UI-layer only.
- Do not swallow localStorage errors without a warn log.
- Do not use confirm/prompt in unit tests without `vi.spyOn(window, 'prompt').mockReturnValue('X')`.

---

## No Prior Knowledge Test

- [ ] Every cited file exists in the codebase or is created by this task
- [ ] D29 schema reproduced verbatim
- [ ] Every D-number cited exists in DISCOVERY.md (D20, D21, D29, D30)
- [ ] Validation commands copy-paste runnable
- [ ] Test file enumerated with ≥15 cases, each distinct
- [ ] No dependency on Task 4.4 (cycler lives in 4.4)

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/tweakpane-params-presets/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
