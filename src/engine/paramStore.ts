/**
 * Plain-object parameter store (Task 2.2).
 *
 * Backs the Tweakpane parameters panel AND the canvas render loop's per-frame
 * read path. Snapshot is a frozen reference that only swaps when `set()` or
 * `replace()` is called, so `useSyncExternalStore(subscribe, getSnapshot)`
 * (React 19) satisfies its Object.is stability contract without any Proxy
 * machinery (D20: React is chrome only; canvas reads `paramStore.snapshot`
 * directly).
 *
 * Two mirrored states are kept:
 *   - `snapshot` — immutable-by-convention, new top-level reference on every
 *     mutation. Read by React and the canvas loop.
 *   - `bindingTarget` — a stable plain object that Tweakpane's addBinding
 *     mutates in place. Its `on('change')` handler writes through to
 *     `set(dotPath, value)`, which refreshes `snapshot`.
 *
 * `createParamStore<T>()` is exported for tests; `paramStore` is the module
 * singleton consumers import (canvas loop, <Panel />, future preset I/O).
 */

/** One param section (e.g. `grid`, `mosaic`). */
export type ParamSection = Record<string, unknown>;

/** Root shape: { [sectionName]: { [paramKey]: value } }. */
export type ParamState = Record<string, ParamSection>;

export type ParamStoreListener = () => void;

export type ParamStore<T extends ParamState = ParamState> = {
  /** Stable reference until the next `set()` / `replace()`. */
  readonly snapshot: T;
  /** React `useSyncExternalStore` getter. Returns the same reference as `snapshot`. */
  getSnapshot(): T;
  /** Subscribe to change notifications. Returns an unsubscribe fn. */
  subscribe(listener: ParamStoreListener): () => void;
  /**
   * Mutate a single dot-pathed key (e.g. `'grid.columnCount'`). No-ops when
   * the incoming value is `===` to the current one (prevents notify spam).
   * Produces a new top-level `snapshot` reference on actual change.
   */
  set(dotPath: string, value: unknown): void;
  /**
   * Wholesale replace (used by preset load). Deep-clones `next` into
   * `snapshot`, overwrites `bindingTarget` in place (preserving its
   * references so Tweakpane's bindings stay live), and notifies once.
   */
  replace(next: T): void;
  /**
   * Mirror object — Tweakpane mutates this in place via `addBinding(host, leafKey)`.
   * Stable reference for the lifetime of the store.
   */
  readonly bindingTarget: T;
};

function splitDotPath(dotPath: string): [string, string] {
  const idx = dotPath.indexOf('.');
  if (idx < 0) {
    throw new Error(`paramStore: dotPath "${dotPath}" must contain a section (e.g. "grid.seed")`);
  }
  const section = dotPath.slice(0, idx);
  const leaf = dotPath.slice(idx + 1);
  if (section.length === 0 || leaf.length === 0) {
    throw new Error(`paramStore: dotPath "${dotPath}" has empty section or leaf`);
  }
  return [section, leaf];
}

export function createParamStore<T extends ParamState>(initial: T): ParamStore<T> {
  let snapshot: T = structuredClone(initial);
  const bindingTarget: T = structuredClone(initial);
  const listeners = new Set<ParamStoreListener>();

  const notify = (): void => {
    // Snapshot the set before iterating so listeners added during dispatch
    // only fire on the NEXT notify (matches useSyncExternalStore semantics).
    for (const listener of [...listeners]) {
      listener();
    }
  };

  function getSnapshot(): T {
    return snapshot;
  }

  function subscribe(listener: ParamStoreListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function set(dotPath: string, value: unknown): void {
    const [section, leaf] = splitDotPath(dotPath);
    const currentSection = snapshot[section];
    if (currentSection === undefined) {
      throw new Error(`paramStore: unknown section "${section}" in dotPath "${dotPath}"`);
    }
    if (currentSection[leaf] === value) return;

    const newSection: ParamSection = { ...currentSection, [leaf]: value };
    snapshot = { ...snapshot, [section]: newSection } as T;

    // Mutate the mirror in place so Tweakpane's addBinding reference stays live.
    const mirrorSection = bindingTarget[section];
    if (mirrorSection !== undefined) {
      (mirrorSection as ParamSection)[leaf] = value;
    }
    notify();
  }

  function replace(next: T): void {
    snapshot = structuredClone(next);
    // Overwrite bindingTarget in place so Tweakpane's host references remain
    // valid. Remove keys no longer present and copy fresh section values.
    for (const key of Object.keys(bindingTarget)) {
      if (!(key in next)) {
        delete (bindingTarget as Record<string, unknown>)[key];
      }
    }
    for (const key of Object.keys(next)) {
      const sourceSection = next[key];
      if (sourceSection === undefined) continue;
      const targetSection = bindingTarget[key];
      if (targetSection === undefined) {
        // New section — assign a fresh clone so Tweakpane can bind to it later.
        (bindingTarget as Record<string, ParamSection>)[key] = { ...sourceSection };
      } else {
        // Preserve the mirror reference; replace leaves only.
        for (const k of Object.keys(targetSection)) {
          if (!(k in sourceSection)) {
            delete (targetSection as ParamSection)[k];
          }
        }
        Object.assign(targetSection, sourceSection);
      }
    }
    notify();
  }

  return {
    get snapshot(): T {
      return snapshot;
    },
    getSnapshot,
    subscribe,
    set,
    replace,
    get bindingTarget(): T {
      return bindingTarget;
    },
  };
}

/**
 * Module singleton. Initialised empty; Task 2.5 replaces the state with the
 * handTrackingMosaic manifest's `defaultParams` at registration time.
 */
export const paramStore: ParamStore = createParamStore<ParamState>({});
