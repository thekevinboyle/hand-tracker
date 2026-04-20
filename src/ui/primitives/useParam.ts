/*
 * src/ui/primitives/useParam.ts — React hook bridging `paramStore` into the
 * render tree via `useSyncExternalStore` (Task DR-7.7).
 *
 * Single source of truth for reading / writing individual dot-pathed keys
 * (e.g. `'mosaic.tileSize'`). Consumers get full compile-time safety:
 *   - `ParamKey` is the union of all valid dot-paths over
 *     `HandTrackingMosaicParams` (derived structurally — no manual enum).
 *   - `ParamValue<K>` resolves to the exact leaf type (number / string /
 *     boolean) for each key.
 * Callers rely on generic inference — `const [tileSize, setTileSize] =
 *   useParam('mosaic.tileSize')` — never passing the generic explicitly
 * (synergy-fix CRITICAL-04).
 *
 * Re-render isolation (synergy-fix HIGH-05 + task file "Research Findings"):
 * paramStore's `set()` notifies EVERY listener, but sibling-key consumers
 * must not re-render. To achieve this we wrap `subscribe` so each upstream
 * notify re-derives the value at this hook's key, compares it against a
 * ref-cached `lastValueRef` (Object.is), and SWALLOWS the listener call
 * when the value is unchanged. Consumers of `mosaic.tileSize` therefore
 * receive zero re-renders when `grid.seed` changes.
 *
 * StrictMode-safe by construction: `useSyncExternalStore` owns
 * subscribe/cleanup balancing; we never stash a listener in module state.
 *
 * Authority:
 *   - task-DR-7-7.md — signature + test coverage.
 *   - `custom-param-components` skill §2 — `useParam` contract.
 *   - `src/engine/paramStore.ts` — the `subscribe / getSnapshot / set /
 *     replace` spec we consume.
 *   - DR3 — engine locked; this module is the ONE bridge into the paramStore.
 */

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type { HandTrackingMosaicParams } from '../../effects/handTrackingMosaic/manifest';
import { type ParamState, paramStore } from '../../engine/paramStore';

// ---------------------------------------------------------------------------
// Dot-path type helpers
// ---------------------------------------------------------------------------

/** Recursive dot-path builder for an object type. */
type DotPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? DotPaths<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`;
}[keyof T & string];

/** Resolve the value type at a given dot-path against an object type. */
type DotValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? T[K] extends Record<string, unknown>
      ? DotValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never;

/** Union of all valid dot-pathed keys over `HandTrackingMosaicParams`. */
export type ParamKey = DotPaths<HandTrackingMosaicParams>;

/** Exact leaf-type for a given `ParamKey`. */
export type ParamValue<K extends ParamKey> = DotValue<HandTrackingMosaicParams, K>;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Read a dot-pathed value from a paramStore snapshot. Tolerant of unknown
 * sections / leaves — returns `undefined` instead of throwing (reads are
 * forgiving; paramStore itself only throws on writes to unknown sections).
 */
function readValueAt(snapshot: ParamState, dotPath: string): unknown {
  const idx = dotPath.indexOf('.');
  if (idx < 0) return undefined;
  const section = dotPath.slice(0, idx);
  const leaf = dotPath.slice(idx + 1);
  const sec = snapshot[section];
  return sec === undefined ? undefined : sec[leaf];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to a single dot-pathed key in `paramStore`. Returns a
 * `[value, setValue]` tuple where `setValue` is memoised per-key.
 *
 * Re-renders fire ONLY when this key's value changes (Object.is). Setting
 * a sibling key (`grid.seed` while watching `mosaic.tileSize`) produces
 * zero re-renders in this consumer.
 *
 * Usage:
 * ```tsx
 * const [tileSize, setTileSize] = useParam('mosaic.tileSize');
 * const [mirror, setMirror] = useParam('input.mirrorMode');
 * ```
 */
export function useParam<K extends ParamKey>(
  key: K,
): readonly [ParamValue<K>, (next: ParamValue<K>) => void] {
  // Cache the last-seen value so we can swallow listener notifications that
  // correspond to sibling-key mutations (our value unchanged).
  const lastValueRef = useRef<unknown>(readValueAt(paramStore.getSnapshot(), key));

  const subscribe = useCallback(
    (listener: () => void): (() => void) => {
      return paramStore.subscribe(() => {
        const next = readValueAt(paramStore.getSnapshot(), key);
        if (!Object.is(next, lastValueRef.current)) {
          lastValueRef.current = next;
          listener();
        }
        // Otherwise: sibling-key change. Swallow — no re-render for this
        // consumer.
      });
    },
    [key],
  );

  const getSnapshot = useCallback((): ParamValue<K> => {
    const value = readValueAt(paramStore.getSnapshot(), key) as ParamValue<K>;
    // Keep the ref in sync with what React actually observes so the
    // subscribe-callback's short-circuit compares against the right
    // baseline on the first post-mount notify.
    lastValueRef.current = value;
    return value;
  }, [key]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (next: ParamValue<K>): void => {
      paramStore.set(key, next);
    },
    [key],
  );

  return useMemo(() => [value, setValue] as const, [value, setValue]);
}
