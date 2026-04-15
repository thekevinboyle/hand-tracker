# Task 4.4: Preset Chevron Cycler + ArrowLeft/Right Keybindings

**Phase**: 4 — Modulation, Presets, Record, A11y
**Branch**: `task/4-4-preset-cycler`
**Commit prefix**: `Task 4.4:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Implement the framework-agnostic `presetCycler` state machine + the React `PresetBar` component with `<` / `>` chevron buttons and global `ArrowLeft` / `ArrowRight` key bindings that wrap-cycle through the saved preset list, calling `loadPreset()` and `paneRef.current?.refresh()` on every change.

**Deliverable**:
- `src/ui/PresetCycler.ts` — pure state machine (getState, onChange, cycleNext, cyclePrev, goTo, refresh)
- `src/ui/PresetBar.tsx` — React component (chevrons + name display + keydown listener)
- `src/ui/PresetBar.test.tsx` — component tests with @testing-library/react

**Success Definition**: E2E: pressing ArrowRight twice starting on "Default" → "Default" (wraps). Unit: cycleNext advances `currentIndex`, calls `loadPreset`, and emits onChange. Pane refresh is invoked on each cycle.

---

## User Persona

**Target User**: Creative technologist demo-ing the app — wants fast keyboard-driven look switching.

**Use Case**: Live demo with 4 saved presets. User hits ArrowRight to cycle forward for each scene change.

**User Journey**:
1. User saves 3 presets.
2. Focus is on the page (not inside a Tweakpane input).
3. Press ArrowRight → preset name flashes, Tweakpane values change, render reflects new params.
4. Press ArrowRight past the last preset → wraps to first.
5. Click `<` chevron at screen edge → cycles backward.

**Pain Points Addressed**: Without this, presets can be saved but not quickly recalled for demos/performance.

---

## Why

- D11: Left/right chevron arrows are functional preset cyclers.
- D30: ArrowLeft/Right cycle within the preset list.
- Requires Task 4.3 (preset CRUD + list).
- Unblocks Task 4.R regression (full flow demo).

---

## What

- `presetCycler` is a module-singleton plain-object store with `{ presets, currentIndex }`.
- `refresh()` re-reads presets from `listPresets()` — called after save/delete from PresetActions.
- `cycleNext(pane?)` / `cyclePrev(pane?)` / `goTo(i, pane?)` wrap the index mod length, call `loadPreset`, call `pane?.refresh()`, notify subscribers.
- `PresetBar` renders `< [name] >`. Chevrons disabled when `presets.length <= 1`.
- Keydown listener is on `window`; skipped when `e.target` is an `<input>` or `<textarea>` (avoid stealing Tweakpane number input keys).
- Integrates with a `paneRef` passed by the parent React tree.

### NOT Building (scope boundary)

- No preset reorder / drag-and-drop.
- No preset thumbnails.
- No MIDI program change mapping.
- No URL-based preset deep links.
- No multi-cursor / modifier-key fast cycling.

### Success Criteria

- [ ] `pnpm biome check src/ui/PresetCycler.ts src/ui/PresetBar.tsx src/ui/PresetBar.test.tsx` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] Unit tests: cycleNext wraps; onChange fires; loadPreset mock called with correct name
- [ ] Component tests: ArrowRight keydown triggers cycleNext; keydown inside `<input>` does NOT trigger
- [ ] Manual browser: press Arrow keys, preset name in PresetBar updates, Tweakpane params update

---

## All Needed Context

```yaml
files:
  - path: src/engine/presets.ts
    why: Provides listPresets(), loadPreset(name), Preset type — the cycler's only data source
    gotcha: listPresets reads localStorage every call — fine for MVP (presets list is short)

  - path: src/ui/PresetActions.tsx
    why: After Save/Delete, call `presetCycler.refresh()` to sync the cycler with storage
    gotcha: Save and Delete both mutate storage; cycler does not observe storage — explicit refresh needed

  - path: src/ui/Panel.tsx
    why: Owns the paneRef that PresetBar needs for paneRef.current?.refresh()
    gotcha: Pass paneRef as a prop; do not use a global singleton — React StrictMode creates two panes in dev

  - path: src/ui/App.tsx
    why: Where PresetBar is mounted (top/bottom chrome)
    gotcha: PresetBar should be rendered ONCE at the App level, not inside Panel

urls:
  - url: https://react.dev/reference/react/useEffect
    why: useEffect cleanup for keydown listener + presetCycler subscription
    critical: Return cleanup from effect; StrictMode runs the effect twice in dev

  - url: https://testing-library.com/docs/react-testing-library/api
    why: render, screen, fireEvent.keyDown for PresetBar tests
    critical: fireEvent.keyDown(window, { key: 'ArrowRight' }) dispatches at the document level

skills:
  - tweakpane-params-presets
  - hand-tracker-fx-architecture
  - vitest-unit-testing-patterns

discovery:
  - D11: Chevron arrows are functional preset cyclers
  - D30: ArrowLeft / ArrowRight keys cycle the list
```

### Current Codebase Tree

```
src/
  engine/
    presets.ts             # Task 4.3
  ui/
    PresetActions.tsx      # Task 4.3
    Panel.tsx              # Phase 2
    App.tsx
```

### Desired Codebase Tree

```
src/
  ui/
    PresetCycler.ts        # CREATE — singleton state machine
    PresetBar.tsx          # CREATE — React component with chevrons + key handler
    PresetBar.test.tsx     # CREATE — component tests
    App.tsx                # MODIFY — render <PresetBar paneRef={paneRef} />
    PresetActions.tsx      # MODIFY — call presetCycler.refresh() after save/delete/import
```

### Known Gotchas

```typescript
// CRITICAL: Key event target check. A keydown that originates inside a Tweakpane
// number input or any <input>/<textarea> MUST be ignored — otherwise Tweakpane's
// value-arrow-keys conflict with our cycler.
//
//   if (e.target instanceof HTMLInputElement) return
//   if (e.target instanceof HTMLTextAreaElement) return
//
// This is also a UX expectation: ArrowLeft inside a text field should move the caret.

// CRITICAL: presetCycler is a MODULE SINGLETON. React components consume it via
// useSyncExternalStore-style subscription. Do NOT recreate it inside a component body.

// CRITICAL: The cycler's list becomes stale when the user saves/deletes.
// PresetActions must call `presetCycler.refresh()` at the end of save/delete/import handlers.

// CRITICAL: Under React StrictMode, useEffect runs twice in dev. The keydown
// listener MUST be removed in cleanup — otherwise two listeners fire and the
// index jumps by 2 in dev.

// CRITICAL: The chevron buttons are disabled when `presets.length <= 1` — a single
// preset has no "next". Do NOT render `<button disabled>` with an onClick handler
// that fires — the disabled attr prevents the click but keep handler simple.

// CRITICAL: paneRef is a RefObject<Pane | null>. Always null-check before calling
// .refresh(). In StrictMode, the ref may be null during the first mount teardown.

// CRITICAL: `e.preventDefault()` on ArrowLeft/Right prevents the browser scroll
// when the page has focus. Always call it after the target-type guard.

// CRITICAL: Biome v2, pnpm, no 'use client'. React 19 Vite SPA.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/ui/PresetCycler.ts

import type { Pane } from 'tweakpane'
import { listPresets, loadPreset, type Preset } from '../engine/presets'

type CyclerState = {
  presets: Preset[]
  currentIndex: number
}

type ChangeHandler = (state: CyclerState) => void
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/ui/PresetCycler.ts
  - IMPLEMENT: |
      function createPresetCycler(): {
        cycleNext(pane?: Pane): void
        cyclePrev(pane?: Pane): void
        goTo(index: number, pane?: Pane): void
        refresh(): void
        onChange(h: ChangeHandler): () => void
        getState(): CyclerState
      }
      export const presetCycler = createPresetCycler()
  - DETAILS:
      - Initial state: { presets: listPresets(), currentIndex: 0 }
      - cycleNext: (i + 1) mod len, call loadPreset(presets[next].name), pane?.refresh(), notify
      - cyclePrev: (i - 1 + len) mod len, same
      - goTo: bounds-check, call loadPreset, pane?.refresh(), notify
      - refresh: re-read listPresets(); clamp currentIndex if needed
      - onChange: add handler, return unsubscribe
  - MIRROR: src/engine/modulationStore.ts (same factory pattern + subscribe contract)
  - NAMING: camelCase, no default export
  - GOTCHA: Do not load a preset inside `refresh()` — only the user's cycle/goTo should load
  - VALIDATE: pnpm biome check src/ui/PresetCycler.ts && pnpm tsc --noEmit

Task 2: CREATE src/ui/PresetBar.tsx
  - IMPLEMENT: |
      type Props = { paneRef: React.RefObject<Pane | null> }
      export function PresetBar({ paneRef }: Props): JSX.Element
  - DETAILS:
      - useState initialized from presetCycler.getState()
      - useEffect subscribes to presetCycler.onChange(setState); cleanup unsubscribes
      - useEffect adds window keydown listener:
          function onKey(e: KeyboardEvent) {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
            if (e.key === 'ArrowLeft')  { e.preventDefault(); presetCycler.cyclePrev(paneRef.current ?? undefined) }
            if (e.key === 'ArrowRight') { e.preventDefault(); presetCycler.cycleNext(paneRef.current ?? undefined) }
          }
        cleanup removes the listener
      - JSX:
          <div className="preset-bar" role="group" aria-label="Preset cycler">
            <button aria-label="Previous preset" disabled={presets.length <= 1} onClick={() => presetCycler.cyclePrev(paneRef.current ?? undefined)}>&lsaquo;</button>
            <span className="preset-name">{presets[currentIndex]?.name ?? '—'}</span>
            <button aria-label="Next preset" disabled={presets.length <= 1} onClick={() => presetCycler.cycleNext(paneRef.current ?? undefined)}>&rsaquo;</button>
          </div>
  - MIRROR: any existing src/ui/*.tsx with useEffect cleanup
  - NAMING: PascalCase component, camelCase handlers
  - GOTCHA: No 'use client'. No React state for presets — source of truth is presetCycler.
  - VALIDATE: pnpm biome check src/ui/PresetBar.tsx && pnpm tsc --noEmit

Task 3: CREATE src/ui/PresetBar.test.tsx
  - IMPLEMENT: Vitest + @testing-library/react, covering:
      1. Renders current preset name
      2. Click right chevron → presetCycler.cycleNext called
      3. Click left chevron → cyclePrev called
      4. fireEvent.keyDown(window, { key: 'ArrowRight' }) → cycleNext called
      5. fireEvent.keyDown(window, { key: 'ArrowLeft' }) → cyclePrev called
      6. Keydown target inside <input> → NO cycler call
      7. presets.length === 1 → both chevrons disabled
      8. Unmount removes keydown listener (assert via another keydown firing → no call)
  - MOCK: vi.mock of ../engine/presets listPresets to return a fixed Preset[]; spy presetCycler methods
  - MIRROR: any existing src/ui/*.test.tsx pattern
  - VALIDATE: pnpm vitest run src/ui/PresetBar.test.tsx

Task 4: MODIFY src/ui/App.tsx
  - FIND: the render tree that mounts Panel
  - ADD: <PresetBar paneRef={paneRef} /> above or below the main canvas, as the preset chrome
  - PRESERVE: existing layout; PresetBar is a thin strip
  - VALIDATE: pnpm build

Task 5: MODIFY src/ui/PresetActions.tsx
  - FIND: the end of each handler (save, saveAs, delete, import)
  - ADD: `presetCycler.refresh()` after any storage-mutating operation
  - PRESERVE: existing behavior
  - VALIDATE: pnpm tsc --noEmit
```

### Integration Points

```yaml
PANE_REF:
  - App.tsx holds a useRef<Pane | null>(null) — the same ref Panel.tsx populates
  - Pass it to PresetBar and to PresetActions

PRESET_STORAGE:
  - presetCycler reads storage via listPresets() only on refresh(); cached in state between refreshes
  - Save/Delete/Import all call presetCycler.refresh()

KEYBOARD:
  - window keydown listener with target-type guard
  - e.preventDefault() on matched keys
```

---

## Validation Loop

### Level 1 — Syntax & Style

```bash
pnpm biome check src/ui/PresetCycler.ts src/ui/PresetBar.tsx src/ui/PresetBar.test.tsx src/ui/App.tsx src/ui/PresetActions.tsx
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/ui/PresetBar.test.tsx
pnpm vitest run
```

### Level 3 — Integration

```bash
pnpm build
```

### Level 4 — E2E

```bash
pnpm test:e2e -- --grep "Task 4.4:"
```

Playwright test asserts:
- Start on "Default" preset (assertion on visible `.preset-name` text)
- Press ArrowRight → `.preset-name` text changes (if ≥2 presets seeded by the test; else create one in beforeEach)
- Press ArrowLeft → returns to previous name
- Pressing ArrowLeft/Right while focused inside a Tweakpane number input does NOT cycle the preset

If ≥2 presets is not yet trivially seeded in E2E, use a `page.evaluate(() => localStorage.setItem(...))` pre-load step.

---

## Final Validation Checklist

### Technical

- [ ] All 4 levels exit 0
- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm vitest run` — all tests pass

### Feature

- [ ] Chevron buttons cycle presets
- [ ] ArrowLeft/ArrowRight cycle presets
- [ ] Keys inside input fields do NOT cycle
- [ ] PresetBar reflects the current preset name
- [ ] StrictMode double-mount does not double-fire key handlers

### Code Quality

- [ ] No `any` types
- [ ] No preset data in React state (cycler is source of truth)
- [ ] Keydown cleanup verified
- [ ] MIRROR pattern followed

---

## Anti-Patterns

- Do not observe localStorage with a `storage` event listener — the cycler is explicit-refresh only.
- Do not re-attach keydown on every render — use `useEffect([paneRef])`.
- Do not call `cycleNext()` inside a test without spying `loadPreset` — otherwise the real paramStore is mutated and leaks into sibling tests.
- Do not render `<PresetBar />` inside `Panel` — it lives at the App level so key handler is global.
- Do not use `document.addEventListener` — use `window` so Playwright `page.keyboard.press` works reliably.

---

## No Prior Knowledge Test

- [ ] Every cited file exists (4.3 presets.ts, Phase 2 Panel.tsx)
- [ ] D-numbers cited exist (D11, D30)
- [ ] Validation commands copy-paste runnable
- [ ] No dependency on Tasks 4.5/4.6
- [ ] Test file enumerates 8 cases

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/tweakpane-params-presets/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
```
