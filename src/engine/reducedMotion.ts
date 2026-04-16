/**
 * `prefers-reduced-motion` detector (Task 4.6).
 *
 * Module-singleton wrapper around `window.matchMedia('(prefers-reduced-
 * motion: reduce)')`. Exposes:
 *   - `getIsReduced()` — current value (cached on the module so the
 *     render loop can check 30×/s without hitting matchMedia per frame).
 *   - `subscribe(cb)` — receive change notifications when the user
 *     toggles the OS setting at runtime; returns an unsubscribe fn.
 *   - `dispose()` — test-only cleanup; production never calls it.
 *
 * Render-loop integration (App.tsx / renderer.ts) is a one-liner:
 *   reducedMotion.getIsReduced()
 *     ? paramStore.snapshot        // pause modulation, hold current values
 *     : applyModulation(routes, sources, paramStore.snapshot)
 *
 * Honors D26. The Tweakpane panel stays interactive — user param edits
 * still apply; only the hand-driven modulation layer pauses.
 */

export type ReducedMotionListener = (isReduced: boolean) => void;

export type ReducedMotion = {
  getIsReduced(): boolean;
  subscribe(cb: ReducedMotionListener): () => void;
  /** @internal test-only teardown — clears listeners + detaches matchMedia. */
  dispose(): void;
};

export function createReducedMotion(): ReducedMotion {
  const listeners = new Set<ReducedMotionListener>();
  let current = false;
  let mq: MediaQueryList | null = null;
  let onChange: ((e: MediaQueryListEvent) => void) | null = null;

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    current = mq.matches;
    onChange = (e: MediaQueryListEvent) => {
      current = e.matches;
      for (const l of [...listeners]) l(current);
    };
    mq.addEventListener('change', onChange);
  }

  return {
    getIsReduced(): boolean {
      return current;
    },
    subscribe(cb: ReducedMotionListener): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    dispose(): void {
      listeners.clear();
      if (mq && onChange) {
        mq.removeEventListener('change', onChange);
      }
      mq = null;
      onChange = null;
      current = false;
    },
  };
}

/** Module singleton — mirrors paramStore / modulationStore / presetCycler.
 *  Tests that need isolation import `createReducedMotion` directly. */
export const reducedMotion: ReducedMotion = createReducedMotion();
