# Task 4.6: `prefers-reduced-motion` Handling

**Phase**: 4 — Modulation, Presets, Record, A11y
**Branch**: `task/4-6-reduced-motion`
**Commit prefix**: `Task 4.6:`
**Estimated complexity**: Low
**Max Ralph iterations**: 10

---

## Goal

**Feature Goal**: Detect `prefers-reduced-motion: reduce` at init and listen for runtime changes; when enabled, bypass `applyModulation()` in the render loop so params hold their neutral (non-modulated) values while video + grid + blob rendering continues.

**Deliverable**:
- `src/engine/reducedMotion.ts` — matchMedia singleton with `getIsReduced()`, `subscribe(cb)`, and `dispose()`
- `src/engine/reducedMotion.test.ts` — Vitest suite (matchMedia mocked via vi.stubGlobal)

**Success Definition**: When `window.matchMedia('(prefers-reduced-motion: reduce)').matches === true`, the render loop skips modulation writes (params do not change with hand position). Toggling the OS setting at runtime fires the listener and flips behavior without a reload.

---

## User Persona

**Target User**: User with vestibular disorder who has enabled "Reduce motion" in OS accessibility settings.

**Use Case**: The user wants to see the hand-tracking mosaic effect without the params themselves animating in response to hand movement (which can be disorienting).

**User Journey**:
1. User enables Reduce Motion in macOS System Preferences.
2. Opens the app, grants camera.
3. Sees the webcam feed, grid, dotted fingertip blobs — all stable.
4. Moves hand — mosaic region follows, but `tileSize` and `columnCount` do NOT shift (modulation is paused).
5. Toggles Reduce Motion off while app is open.
6. Within ~1 frame, modulation re-activates and params respond to hand position again.

**Pain Points Addressed**: D26 explicit requirement; also a WCAG-related consideration per web-best-practices research. Without this, users with motion sensitivity may experience discomfort.

---

## Why

- Satisfies D26 exactly: "Honor `prefers-reduced-motion`. When set: pause modulation (params hold their neutral values), continue rendering video + grid + blobs but without param animation. Listen for runtime changes."
- Required for a responsible creative-tool release.
- Minimal surface area — a single media query + one listener + one branch in the render loop.

---

## What

- `reducedMotion.ts` exports a singleton with three methods:
  - `getIsReduced(): boolean` — current value (init + live)
  - `subscribe(cb: (isReduced: boolean) => void): () => void` — runtime listener
  - `dispose(): void` — remove all listeners (for tests only)
- Uses `window.matchMedia('(prefers-reduced-motion: reduce)')` with `.addEventListener('change', ...)` (not the deprecated `.addListener`).
- Render loop integration: a one-line branch:
  - `const modulated = reducedMotion.getIsReduced() ? paramStore.snapshot : applyModulation(routes, sources, paramStore.snapshot)`
- Tweakpane panel stays interactive — user can still edit params directly. ONLY the auto-modulation is paused.

### NOT Building (scope boundary)

- No pause button (D3 explicitly excluded a pause button).
- No CSS `@media (prefers-reduced-motion)` rules (web-best-practices research mentions these; out of scope for this task's JS path).
- No freezing of the WebGL loop — video + grid still render.
- No fallback for browsers lacking `matchMedia.addEventListener` (all D21 target browsers support it).
- No screen-reader announcement when the state changes.

### Success Criteria

- [ ] `pnpm biome check src/engine/reducedMotion.ts src/engine/reducedMotion.test.ts` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run src/engine/reducedMotion.test.ts` exits 0 with ≥6 passing
- [ ] Render loop integration: `reducedMotion.getIsReduced()` branch verified via spy in an integration test
- [ ] Manual: toggling macOS Reduce Motion flips modulation behavior mid-session

---

## All Needed Context

```yaml
files:
  - path: src/engine/renderer.ts
    why: The render loop that currently calls applyModulation; this task adds a one-line reducedMotion branch
    gotcha: Do NOT call reducedMotion.getIsReduced() inside applyModulation — call it at the call site so the function stays pure

  - path: src/engine/modulation.ts
    why: Source of applyModulation — must not be modified (kept pure per Task 4.1)
    gotcha: The skip happens at the caller, not inside the evaluator

  - path: src/engine/paramStore.ts
    why: `paramStore.snapshot` is what we pass through unmodified when reduced-motion is on
    gotcha: Passing `paramStore.snapshot` identity is safe — the renderer compares by `===`

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
    why: Canonical media-query semantics and JS usage
    critical: `matchMedia('(prefers-reduced-motion: reduce)')` — exact string with parentheses and colon-space

  - url: https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/change_event
    why: Modern addEventListener('change', cb) API
    critical: Old Safari < 14 used addListener/removeListener; all D21 target browsers support addEventListener now, so use it

skills:
  - hand-tracker-fx-architecture
  - vitest-unit-testing-patterns

discovery:
  - D26: Reduced motion — pause modulation, continue rendering; runtime listener required
  - D3: No pause button (scope boundary — reduced-motion is the substitute)
```

### Current Codebase Tree

```
src/
  engine/
    renderer.ts            # Phase 3 — render loop
    modulation.ts          # Task 4.1
    paramStore.ts          # Phase 2
```

### Desired Codebase Tree

```
src/
  engine/
    reducedMotion.ts       # CREATE — singleton + listener
    reducedMotion.test.ts  # CREATE — Vitest
    renderer.ts            # MODIFY — one-line branch at the modulation call site
```

### Known Gotchas

```typescript
// CRITICAL: Use addEventListener('change', ...) — NOT the deprecated addListener(...).
// All D21 target browsers (Chrome 120+, Firefox 132+, Safari 17+) support the modern API.

// CRITICAL: The singleton must be safe to import from multiple modules — creating
// multiple matchMedia listeners would multiply change notifications.
// Solution: one module-scoped MediaQueryList and one Set<Listener> of subscribers.

// CRITICAL: matchMedia may be undefined in some test environments (pre-jsdom 16 or Node).
// Guard with `typeof window !== 'undefined' && typeof window.matchMedia === 'function'`.
// If absent, return a no-op singleton (getIsReduced: () => false, subscribe: () => () => {}).

// CRITICAL: Do NOT call `window.matchMedia(...).removeEventListener('change', cb)` in
// the subscribe unsubscribe if the listener is the per-subscriber callback — the
// singleton attaches ONE media-query listener and fans out to subscribers internally.

// CRITICAL: The render loop integration is a ONE-LINE change:
//   const modulated = reducedMotion.getIsReduced()
//     ? paramStore.snapshot
//     : applyModulation(routes, sources, paramStore.snapshot)
// Returning `paramStore.snapshot` keeps identity — the downstream `modulated !== paramStore.snapshot`
// branch short-circuits to a no-op update, which is exactly the desired behavior (D26:
// "params hold their neutral values").

// CRITICAL: "Neutral values" per D26 means the current authored param state, NOT a
// hardcoded neutral set. The user's Tweakpane edits still apply — we just pause
// the hand-driven MODULATION layer.

// CRITICAL: Biome v2, pnpm, no 'use client'. Standard rules.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/engine/reducedMotion.ts

type Listener = (isReduced: boolean) => void
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/engine/reducedMotion.ts
  - IMPLEMENT: |
      type Listener = (isReduced: boolean) => void

      function createReducedMotion() {
        const listeners = new Set<Listener>()
        let mq: MediaQueryList | null = null
        let current = false

        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
          mq = window.matchMedia('(prefers-reduced-motion: reduce)')
          current = mq.matches
          const onChange = (e: MediaQueryListEvent) => {
            current = e.matches
            listeners.forEach((l) => l(current))
          }
          mq.addEventListener('change', onChange)
        }

        function getIsReduced(): boolean {
          return current
        }

        function subscribe(cb: Listener): () => void {
          listeners.add(cb)
          return () => { listeners.delete(cb) }
        }

        function dispose(): void {
          listeners.clear()
          // For tests only; production never calls this.
        }

        return { getIsReduced, subscribe, dispose }
      }

      export const reducedMotion = createReducedMotion()
  - MIRROR: src/engine/modulationStore.ts (factory + singleton export pattern)
  - NAMING: camelCase, named export
  - GOTCHA: Module-scoped mq and listener — do NOT create new matchMedia per subscribe call
  - VALIDATE: pnpm biome check src/engine/reducedMotion.ts && pnpm tsc --noEmit

Task 2: CREATE src/engine/reducedMotion.test.ts
  - IMPLEMENT: Vitest suite covering:
      1. getIsReduced reflects matchMedia.matches at init
      2. subscribe receives notifications when change event fires
      3. subscribe unsubscribe stops receiving notifications
      4. Multiple subscribers all receive the same change
      5. When matchMedia is undefined, getIsReduced returns false and subscribe is a no-op
      6. dispose() clears all subscribers
  - MOCK: |
      let changeHandler: ((e: MediaQueryListEvent) => void) | null = null
      const mockMQL = {
        matches: false,
        addEventListener: vi.fn((_, cb) => { changeHandler = cb as any }),
        removeEventListener: vi.fn(),
      }
      vi.stubGlobal('matchMedia', vi.fn(() => mockMQL))
      // Test helper: fire a fake change
      function fireChange(matches: boolean) {
        mockMQL.matches = matches
        changeHandler?.({ matches } as MediaQueryListEvent)
      }
      // NOTE: This mocks a fresh module import per test; use vi.resetModules() + dynamic import
      // so the module-scoped `current` is recomputed each test.
  - MIRROR: src/engine/modulation.test.ts (Task 4.1)
  - VALIDATE: pnpm vitest run src/engine/reducedMotion.test.ts

Task 3: MODIFY src/engine/renderer.ts
  - FIND: the render-loop block that calls `applyModulation(...)`
  - ADD: at the top of the file, `import { reducedMotion } from './reducedMotion'`
  - REPLACE: |
      // BEFORE:
      const modulated = applyModulation(routes, sources, paramStore.snapshot)
      // AFTER:
      const modulated = reducedMotion.getIsReduced()
        ? paramStore.snapshot
        : applyModulation(routes, sources, paramStore.snapshot)
  - PRESERVE: all other render loop behavior — video upload, WebGL draw, Canvas 2D overlay
  - VALIDATE: pnpm tsc --noEmit && pnpm build
```

### Concrete Listener Pattern (for agent reference)

```typescript
// matchMedia('(prefers-reduced-motion: reduce)') listener pattern

const mq = window.matchMedia('(prefers-reduced-motion: reduce)')

// Read at init
const isReducedNow: boolean = mq.matches

// Listen for runtime changes (user toggles OS setting)
mq.addEventListener('change', (e: MediaQueryListEvent) => {
  // e.matches === new value
  applyReducedMotion(e.matches)
})
```

### Integration Points

```yaml
RENDER_LOOP:
  - Before: modulated = applyModulation(...)
  - After:  modulated = reducedMotion.getIsReduced() ? paramStore.snapshot : applyModulation(...)

TASK_4_1_DEPENDENCY:
  - applyModulation is imported and called in renderer.ts per Task 4.1 integration
  - This task does NOT modify modulation.ts — keeps the evaluator pure

REACT_LAYER:
  - No React integration needed for MVP
  - Future enhancement (out of scope): a small a11y indicator that says "reduced motion: modulation paused"
```

---

## Validation Loop

### Level 1 — Syntax & Style

```bash
pnpm biome check src/engine/reducedMotion.ts src/engine/reducedMotion.test.ts src/engine/renderer.ts
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/engine/reducedMotion.test.ts
pnpm vitest run
```

### Level 3 — Integration

```bash
pnpm build
```

### Level 4 — E2E (optional; satisfied by Task 4.R)

```bash
pnpm test:e2e -- --grep "Task 4.6:"
```

Optional Playwright test:
- `await page.emulateMedia({ reducedMotion: 'reduce' })`
- Move fake landmarks via `page.evaluate` to set paramStore manually
- Assert that `paramStore.snapshot.mosaic.tileSize` does NOT change when modulation would otherwise drive it

If the fake-device landmark injection is non-trivial, skip L4 here and cover it in Task 4.R.

---

## Final Validation Checklist

### Technical

- [ ] All 4 levels exit 0 (L4 may be N/A — see Task 4.R)
- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm vitest run` — all tests pass

### Feature

- [ ] Init-time detection works (load app with OS setting on → modulation paused)
- [ ] Runtime listener works (toggle OS setting → behavior flips without reload)
- [ ] Tweakpane params remain editable while paused
- [ ] Video + grid + blobs continue to render normally

### Code Quality

- [ ] No `any` types
- [ ] One module-scoped matchMedia listener (not one-per-subscriber)
- [ ] Singleton pattern matches MIRROR (modulationStore)
- [ ] `applyModulation` not modified (still pure)

---

## Anti-Patterns

- Do not call `matchMedia` inside the render loop (30x/sec) — cache once at module load.
- Do not use the deprecated `addListener`/`removeListener` API.
- Do not modify `applyModulation` to take a "paused" flag — keep the evaluator pure, branch at the caller.
- Do not hardcode "neutral param values" — "neutral" per D26 means the current authored state.
- Do not add a pause button (D3 scope boundary).

---

## No Prior Knowledge Test

- [ ] Every cited file exists (Task 4.1, Phase 3 renderer)
- [ ] D-numbers cited (D26, D3) exist in DISCOVERY.md
- [ ] matchMedia string literal is exact: `'(prefers-reduced-motion: reduce)'`
- [ ] Validation commands copy-paste runnable
- [ ] No dependency on Tasks 4.2/4.3/4.4/4.5

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
