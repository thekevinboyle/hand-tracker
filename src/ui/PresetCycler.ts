/**
 * Preset cycler state machine (Task 4.4).
 *
 * Framework-agnostic module singleton that tracks the current preset
 * index + cached list, exposes `cycleNext` / `cyclePrev` / `goTo` /
 * `refresh` / `onChange` / `getState`. PresetBar (React) subscribes and
 * re-renders on state change; PresetActions explicitly calls `refresh()`
 * after any storage-mutating operation (save / delete / import) so the
 * cached list stays in sync.
 *
 * Design rules:
 *   - `refresh()` only re-reads the preset list; it NEVER loads a
 *     preset. Load-on-restore semantics are the caller's job (the
 *     user's explicit cycle / goTo calls do the loading).
 *   - `cycleNext` / `cyclePrev` wrap mod length so pressing ArrowRight
 *     past the end lands on index 0 (D30).
 *   - `currentIndex` is clamped to `[0, length)` on refresh so deleting
 *     the currently-cycled preset doesn't leave the index dangling.
 *   - No React imports. The React binding lives in PresetStrip.tsx.
 *
 * Task DR-8.6: retired the optional `pane?: Pane` argument that used to
 * force a Tweakpane `pane.refresh()` after every preset load. The new
 * custom param components subscribe to paramStore via useSyncExternalStore;
 * `paramStore.replace(next)` inside `loadPreset()` already notifies every
 * subscriber on the next tick, so no explicit refresh handle is needed.
 */

import { listPresets, loadPreset, type Preset } from '../engine/presets';

export type CyclerState = {
  readonly presets: readonly Preset[];
  readonly currentIndex: number;
};

export type CyclerChangeHandler = (state: CyclerState) => void;

export type PresetCycler = {
  getState(): CyclerState;
  onChange(handler: CyclerChangeHandler): () => void;
  cycleNext(): void;
  cyclePrev(): void;
  goTo(index: number): void;
  /** Re-read listPresets() and clamp currentIndex. Does NOT load. */
  refresh(): void;
};

export function createPresetCycler(): PresetCycler {
  let state: CyclerState = { presets: listPresets(), currentIndex: 0 };
  const listeners = new Set<CyclerChangeHandler>();

  function notify(): void {
    for (const h of [...listeners]) h(state);
  }

  function setState(next: CyclerState): void {
    state = next;
    notify();
  }

  function applyIndexAndLoad(nextIndex: number): void {
    const { presets } = state;
    if (presets.length === 0) return;
    const preset = presets[nextIndex];
    if (!preset) return;
    setState({ presets, currentIndex: nextIndex });
    loadPreset(preset.name);
  }

  return {
    getState(): CyclerState {
      return state;
    },

    onChange(handler: CyclerChangeHandler): () => void {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },

    cycleNext(): void {
      const { presets, currentIndex } = state;
      if (presets.length === 0) return;
      const nextIndex = (currentIndex + 1) % presets.length;
      applyIndexAndLoad(nextIndex);
    },

    cyclePrev(): void {
      const { presets, currentIndex } = state;
      if (presets.length === 0) return;
      const nextIndex = (currentIndex - 1 + presets.length) % presets.length;
      applyIndexAndLoad(nextIndex);
    },

    goTo(index: number): void {
      const { presets } = state;
      if (presets.length === 0) return;
      if (index < 0 || index >= presets.length) return;
      applyIndexAndLoad(index);
    },

    refresh(): void {
      const presets = listPresets();
      const { currentIndex } = state;
      const clamped =
        presets.length === 0 ? 0 : Math.min(Math.max(currentIndex, 0), presets.length - 1);
      setState({ presets, currentIndex: clamped });
    },
  };
}

/** Module singleton — mirrors paramStore / modulationStore. Tests that
 *  need isolation import `createPresetCycler` directly. */
export const presetCycler: PresetCycler = createPresetCycler();
