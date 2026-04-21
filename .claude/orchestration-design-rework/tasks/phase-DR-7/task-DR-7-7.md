# Task DR-7.7: Build `useParam` hook + paramStore subscription bridge

**Phase**: DR-7 — Primitives
**Branch**: `task/DR-7-7-useparam-hook`
**Commit prefix**: `Task DR-7.7:`
**Estimated complexity**: High
**Max Ralph iterations**: 30

---

## Goal

**Feature Goal**: Build the `useParam<T>(dotPath)` React hook that binds a single dot-pathed key in `paramStore` to the consuming component via `useSyncExternalStore`. Return a `[value, setValue]` tuple with stable identity across unrelated mutations (structural sharing preserved by the store's `set`-produces-new-top-level-reference contract). Type-safe via a generic `<T>` plus a manifest-derived union of valid param keys. StrictMode-safe — no double-subscription, no stale-closure writes.

**Deliverable**:
- `src/ui/primitives/useParam.ts`
- `src/ui/primitives/useParam.test.ts` (≥ 12 tests covering subscription, unsubscribe, StrictMode, concurrent updates, re-render isolation)

**Success Definition**: `pnpm biome check src/ui/primitives/useParam.* && pnpm tsc --noEmit && pnpm vitest run src/ui/primitives/useParam.test.ts` all exit 0; `useParam('mosaic.tileSize')` in a StrictMode tree increments render count by exactly 1 when `mosaic.tileSize` changes, and by 0 when `grid.columnCount` changes.

---

## Context

`useParam` replaces the role Tweakpane's `addBinding` served. Every DR-8 primitive that edits a manifest param uses it. The hook is the ONLY bridge between React's render tree and the plain-object `paramStore`. Correctness here determines whether the entire DR-8 chrome is responsive and StrictMode-safe.

## Dependencies

- **`src/engine/paramStore.ts`** (existing, locked per DR3 — we only consume its public API: `subscribe`, `getSnapshot`, `set`).
- **`src/effects/handTrackingMosaic/manifest.ts`** (existing) — source of param keys for the type-safe union.

## Blocked By

- None at runtime (paramStore is long-existing). Task ordering: wait for DR-6.R to close Foundation before starting this task, so the design-tokens skill is already authored and skill reads don't block.

## Research Findings

- **From `src/engine/paramStore.ts`**: `subscribe(listener)` returns an unsubscribe fn. `getSnapshot()` returns a stable reference until the next `set()`. `set(dotPath, value)` no-ops on `===` equality. Top-level snapshot reference changes on every real mutation, but unchanged sections keep referential identity (structural sharing).
- **React 19 `useSyncExternalStore`**: accepts `(subscribe, getSnapshot, getServerSnapshot?)`. Our app is SSR-free, so `getServerSnapshot` is a no-op fallback returning the same snapshot. The hook's subscribe callback receives a rerender trigger.
- **Key selector pattern**: to avoid re-rendering a `tileSize` consumer when only `grid.seed` changes, use a *selector* `getSnapshot` that returns `store.getSnapshot()[section][leaf]`. Because sections are new objects on mutation of ANY leaf in that section, this does cause a same-section re-render even for a different key. Acceptable: sections are small (3–7 keys) and renders are cheap.
- **For stricter isolation** (only re-render when THIS key changes): additionally check `Object.is(prevValue, nextValue)` via a ref-comparison wrapper around `useSyncExternalStore` or via `useSyncExternalStoreWithSelector` from `use-sync-external-store/with-selector`. We'll implement the stricter variant.
- **From `vitest-unit-testing-patterns` § 4.7**: StrictMode double-invokes effects. Tests must wrap in `<StrictMode>` to catch subscribe leaks.

## Implementation Plan

### Step 1: Minimal TypeScript signature

```typescript
// src/ui/primitives/useParam.ts
import { useSyncExternalStore } from 'react';
import { paramStore } from '../../engine/paramStore';
import type { HandTrackingMosaicParams } from '../../effects/handTrackingMosaic/manifest';

/** All valid dot-pathed param keys derived structurally from the manifest type. */
export type ParamKey = DotPaths<HandTrackingMosaicParams>;

/** Value type at the given dot-pathed key. */
export type ParamValue<K extends ParamKey> = DotValue<HandTrackingMosaicParams, K>;

/** Hook: subscribe to a paramStore key. Re-renders only when that key's
 *  value changes (Object.is compared). Returns [value, setValue]. */
export function useParam<K extends ParamKey>(key: K): readonly [ParamValue<K>, (next: ParamValue<K>) => void];

// ---------------------------------------------------------------------------
// Type helpers (dot-path utilities over HandTrackingMosaicParams)
// ---------------------------------------------------------------------------

type DotPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? DotPaths<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`;
}[keyof T & string];

type DotValue<T, P extends string> =
  P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? T[K] extends Record<string, unknown>
        ? DotValue<T[K], Rest>
        : never
      : never
    : P extends keyof T
      ? T[P]
      : never;
```

Examples of resolved types:
- `ParamKey` ≈ `'grid.seed' | 'grid.columnCount' | 'grid.rowCount' | 'grid.widthVariance' | 'grid.lineColor' | 'grid.lineWeight' | 'mosaic.tileSize' | 'mosaic.blendOpacity' | 'mosaic.edgeFeather' | 'effect.regionPadding' | 'input.mirrorMode' | 'input.showLandmarks' | 'input.deviceId'`
- `ParamValue<'mosaic.tileSize'>` = `number`
- `ParamValue<'input.mirrorMode'>` = `boolean`

### Step 2: Implementation

```typescript
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { paramStore, type ParamState } from '../../engine/paramStore';
import type { HandTrackingMosaicParams } from '../../effects/handTrackingMosaic/manifest';

function readValueAt(snapshot: ParamState, dotPath: string): unknown {
  const idx = dotPath.indexOf('.');
  if (idx < 0) return undefined;
  const section = dotPath.slice(0, idx);
  const leaf = dotPath.slice(idx + 1);
  const sec = snapshot[section];
  return sec === undefined ? undefined : sec[leaf];
}

export function useParam<K extends ParamKey>(
  key: K,
): readonly [ParamValue<K>, (next: ParamValue<K>) => void] {
  // Cache the last value so we can short-circuit re-renders on sibling changes.
  const lastValueRef = useRef<unknown>(readValueAt(paramStore.getSnapshot(), key));

  const subscribe = useCallback(
    (listener: () => void): (() => void) => {
      return paramStore.subscribe(() => {
        const next = readValueAt(paramStore.getSnapshot(), key);
        if (!Object.is(next, lastValueRef.current)) {
          lastValueRef.current = next;
          listener();
        }
        // If equal — swallow the notification: no re-render for sibling-key changes.
      });
    },
    [key],
  );

  const getSnapshot = useCallback((): ParamValue<K> => {
    // Always read fresh. If unchanged, React's internal Object.is check also bails.
    const value = readValueAt(paramStore.getSnapshot(), key) as ParamValue<K>;
    lastValueRef.current = value;
    return value;
  }, [key]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (next: ParamValue<K>) => {
      paramStore.set(key, next);
    },
    [key],
  );

  return useMemo(() => [value, setValue] as const, [value, setValue]);
}
```

Note: `useMemo` on the tuple is conventional but optional — React's bail-out on `Object.is` for primitives means returning `[value, setValue]` directly also works. Keep the memo for clarity and to avoid spurious array identity churn in downstream `useEffect` deps.

### Step 3: Re-export ParamKey types for downstream (DR-8)

DR-8 primitives import `ParamKey` and `ParamValue<K>` from this file to type their consumer-facing props.

### Step 4: Unit tests (≥ 12)

File: `src/ui/primitives/useParam.test.ts`. Must cover:

1. Initial render returns the current paramStore value at the key
2. Calling `setValue(v)` updates paramStore and re-renders the consumer with the new value
3. Setting the SAME value (Object.is) does not re-render (store-level no-op)
4. Setting a DIFFERENT key (e.g. `grid.seed` while watching `mosaic.tileSize`) does not re-render the `tileSize` consumer
5. Unmounting unsubscribes — subsequent `paramStore.set(...)` does not trigger callbacks on the unmounted consumer
6. StrictMode double-mount: only one net subscription remains after the first effect-cleanup-and-rerun cycle
7. Multiple consumers of the same key both receive the new value on a single `set` call
8. Type inference: `useParam('mosaic.tileSize')` yields `number`; `useParam('input.mirrorMode')` yields `boolean` (test via a helper that asserts `typeof`)
9. Switching the `key` prop between two different keys re-subscribes to the new key
10. Concurrent updates: two `paramStore.set` calls in quick succession both surface in the consumer's render
11. Initial StrictMode double-render still returns correct initial value
12. `paramStore.replace()` (preset load) propagates through `useParam` consumers

Test skeleton (pattern reference):

```typescript
import { act, renderHook, StrictMode } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { paramStore } from '../../engine/paramStore';
import { useParam } from './useParam';

describe('useParam', () => {
  beforeEach(() => {
    paramStore.replace({
      grid: { seed: 42, columnCount: 12, rowCount: 8, widthVariance: 0.6, lineColor: '#00ff88', lineWeight: 1 },
      mosaic: { tileSize: 16, blendOpacity: 1, edgeFeather: 0 },
      effect: { regionPadding: 1 },
      input: { mirrorMode: true, showLandmarks: true, deviceId: '' },
    });
  });

  it('reads the initial value', () => {
    const { result } = renderHook(() => useParam('mosaic.tileSize'));
    expect(result.current[0]).toBe(16);
  });

  it('writes through setValue', () => {
    const { result } = renderHook(() => useParam('mosaic.tileSize'));
    act(() => result.current[1](32));
    expect(result.current[0]).toBe(32);
    expect(paramStore.snapshot.mosaic!.tileSize).toBe(32);
  });

  it('does not re-render on sibling key changes', () => {
    let renderCount = 0;
    const { rerender } = renderHook(() => {
      renderCount++;
      return useParam('mosaic.tileSize');
    });
    const before = renderCount;
    act(() => paramStore.set('grid.seed', 99));
    rerender();
    // Allow ONE rerender for the manual rerender call; store-triggered rerender must not have fired.
    expect(renderCount - before).toBe(1);
  });

  it('StrictMode double-mount leaves one net subscription', () => {
    const { unmount } = renderHook(() => useParam('mosaic.tileSize'), { wrapper: StrictMode });
    unmount();
    // (verify via counting listeners — pattern in paramStore internals; alternately spy on subscribe)
  });
});
```

To count listeners: `paramStore` exposes `subscribe` but no size getter. Spy-wrap via `vi.spyOn(paramStore, 'subscribe')` and assert invocation counts match unsubscribes.

## Files to Create

- `src/ui/primitives/useParam.ts`
- `src/ui/primitives/useParam.test.ts`

## Files to Modify

- None. `paramStore.ts` and `manifest.ts` are locked per DR3.

## Contracts

### Provides

- `useParam`, `ParamKey`, `ParamValue<K>` from `src/ui/primitives/useParam.ts`.
- Subscription isolation: consumers of `useParam<K>` re-render ONLY when their specific key changes (Object.is).

### Consumes

- `paramStore.subscribe`, `paramStore.getSnapshot`, `paramStore.set` from `src/engine/paramStore.ts`.
- `HandTrackingMosaicParams` type from `src/effects/handTrackingMosaic/manifest.ts`.

## Acceptance Criteria

- [ ] Re-renders only the consumer when ITS specific key changes (verified by a render-count test)
- [ ] Structural sharing preserved — if upstream snapshot returns identical reference, React bails
- [ ] `setValue` writes through `paramStore.set`
- [ ] StrictMode-safe — double-mount/unmount yields net-zero listener count
- [ ] `paramStore.replace` propagates (preset load path)
- [ ] Type inference via `ParamKey` union prevents typos like `useParam('grid.seeed')` at compile time
- [ ] ≥ 12 passing unit tests

## Testing Protocol

### L1

```bash
pnpm biome check src/ui/primitives/useParam.ts src/ui/primitives/useParam.test.ts
pnpm tsc --noEmit
```

### L2

```bash
pnpm vitest run src/ui/primitives/useParam.test.ts
```

### L3

```bash
pnpm build
```

### L4

```bash
pnpm test:e2e --grep "Task DR-7.7:"
```

No direct L4 — the DR-7.R showcase spec exercises `useParam` indirectly via the primitive preview. Should exit 0 (no tests found OR showcase spec exists and passes).

## Skills to Read

- `.claude/skills/custom-param-components/SKILL.md` — authoritative for the paramStore binding pattern (this task defines the pattern, so read the draft and align)
- `.claude/skills/design-tokens-dark-palette/SKILL.md` — context only; this task has no styling
- `.claude/skills/vitest-unit-testing-patterns/SKILL.md` — § 4.7 StrictMode patterns critical
- `.claude/skills/prp-task-ralph-loop/SKILL.md`
- `.claude/skills/hand-tracker-fx-architecture/SKILL.md`
- `.claude/skills/tweakpane-params-presets/SKILL.md` — REFERENCE ONLY for the outgoing `addBinding` pattern that `useParam` replaces

## Research Files to Read

- `src/engine/paramStore.ts` (read the file itself — it IS the spec; especially the `subscribe` / `getSnapshot` / `set` / `replace` contract)
- `src/effects/handTrackingMosaic/manifest.ts` — for the `HandTrackingMosaicParams` type the union is derived from

## Known Gotchas

```typescript
// CRITICAL: paramStore.set() short-circuits on Object.is equality. Our hook
// must NOT independently short-circuit — let the store's no-op discipline
// flow through the subscribe chain.

// CRITICAL: useSyncExternalStore requires a STABLE `subscribe` function
// identity across renders (React may unsubscribe/resubscribe if it changes).
// Use useCallback with `key` in deps — the subscribe re-identifies only
// when the watched key changes, which is the desired behavior.

// CRITICAL: React 19 StrictMode double-invokes BOTH the effect and its
// cleanup. Our subscribe path returns an unsubscribe, so it survives —
// but if you add a useEffect inside the hook you MUST pair mount with
// unmount correctly.

// CRITICAL: readValueAt must NOT throw on unknown sections. It returns
// undefined silently (paramStore itself throws on unknown sections only
// during writes — reads are forgiving). Tests should cover this.

// CRITICAL: The `ParamKey` DotPaths type computation is recursive. If you
// extend HandTrackingMosaicParams to 3+ levels of nesting, verify TypeScript
// does not hit recursion-depth limits (current: 2 levels — safe).

// CRITICAL: Do not use React's `useState` to store the value — the whole
// point of useSyncExternalStore is that React's scheduler reads from the
// store directly. Duplicating in useState creates a second source of truth.

// CRITICAL: paramStore is a module singleton. Tests that mutate it MUST
// restore state in beforeEach via paramStore.replace(INITIAL).

// CRITICAL: useMemo on the [value, setValue] tuple keeps referential
// stability for downstream useEffect deps — do not remove it lightly.
```

## Anti-Patterns

- Do not use `any` types. `unknown` + narrow, or `as` casts with the DotValue generic.
- Do not store MediaStream in React state (repeated from parent CLAUDE.md; applies to any future mediaStream usage near this hook).
- Do not import Tweakpane here — DR3 retires Tweakpane from the UI runtime; this hook must be a clean replacement.
- Do not deep-copy the snapshot in the hook — paramStore already provides structural-sharing guarantees.
- Do not add a React Context wrapper. The hook talks directly to the module singleton.

## No Prior Knowledge Test

- [ ] `paramStore.ts` file exists at the claimed path (verified by reading it)
- [ ] `HandTrackingMosaicParams` type exists in `manifest.ts`
- [ ] Type helpers `DotPaths` + `DotValue` resolve for the 13 known manifest keys
- [ ] ≥ 12 tests listed, covering: subscription, unsubscribe, StrictMode, concurrent, type inference, replace
- [ ] L1–L4 commands copy-paste runnable

## Git

- Branch: `task/DR-7-7-useparam-hook`
- Commit prefix: `Task DR-7.7:`
- Trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
