/*
 * src/ui/PresetStrip.tsx — Preset strip at the top of the Sidebar (Task DR-8.5).
 *
 * Collapses the retired `<PresetBar>` (floating chevron cycler) and
 * `<PresetActions>` (floating CRUD button row) into a single horizontal
 * strip:
 *
 *   [‹] [name input] [›]  [Save] [Save As] [Delete] [↓ Export] [↑ Import]
 *
 * Source-of-truth rules:
 *   - `presetCycler` (module singleton) owns the cached preset list +
 *     current index. PresetStrip subscribes via useSyncExternalStore-style
 *     `presetCycler.onChange` so re-renders fire on every cycle.
 *   - Local `currentName` React state mirrors the preset that is currently
 *     LOADED (not just highlighted). Save As / blur-load / import all
 *     write to it.
 *   - All file I/O goes through `src/engine/presets.ts` — this component
 *     is UI-only.
 *
 * Testid contract (DISCOVERY §7):
 *   - Root strip element: `data-testid="preset-bar"` (preserves the old
 *     PresetBar selector so 45 E2E specs don't churn).
 *   - Editable name input: `data-testid="preset-name"`.
 *   - Action button row: `data-testid="preset-actions"`.
 *
 * Keyboard:
 *   - Global window keydown for ArrowLeft/Right cycles presets. The
 *     target-type guard (`<input>` / `<textarea>`) keeps caret movement
 *     inside the name input untouched — identical behavior to the
 *     retired PresetBar.
 *
 * Pane ref transition:
 *   - `paneRef` stays optional so App.tsx can thread the Tweakpane Pane
 *     through for `pane.refresh()` until DR-8.6 retires Tweakpane. After
 *     that cut the arg becomes dead — `useParam`-subscribed primitives
 *     re-render on paramStore writes automatically.
 *
 * Authority:
 *   - DISCOVERY.md DR16 — Merge PresetBar + PresetActions into one strip.
 *   - DISCOVERY.md §7 — Preserve preset-bar / preset-name / preset-actions.
 *   - task-DR-8-5.md § Implementation Blueprint.
 *   - `custom-param-components` skill — PresetStrip pattern.
 *   - `design-tokens-dark-palette` skill — tokens only.
 */

import type { ChangeEvent, FocusEvent, JSX, RefObject } from 'react';
import { useEffect, useState } from 'react';
import type { Pane } from 'tweakpane';
import {
  deletePreset,
  exportPresetFile,
  importPresetFile,
  loadPreset,
  savePreset,
} from '../engine/presets';
import { type CyclerState, presetCycler } from './PresetCycler';
import styles from './PresetStrip.module.css';
import { Button } from './primitives/Button';

export type PresetStripProps = {
  /** Threaded through for `pane.refresh()` while Tweakpane is still live.
   *  DR-8.6 retires Tweakpane and this arg becomes dead. Optional from
   *  day one so tests can omit it. */
  paneRef?: RefObject<Pane | null>;
};

/** Tweakpane v4's concrete Pane inherits `refresh()` from FolderApi but
 *  doesn't re-expose it in the TS declaration. Widen at the call site —
 *  same pattern as `PresetCycler.callPaneRefresh` + `buildPaneFromManifest`. */
function refreshPane(paneRef?: RefObject<Pane | null>): void {
  if (!paneRef) return;
  const pane = paneRef.current as unknown as { refresh?: () => void } | null;
  pane?.refresh?.();
}

function readInitialName(state: CyclerState): string {
  return state.presets[state.currentIndex]?.name ?? 'Default';
}

export function PresetStrip({ paneRef }: PresetStripProps = {}): JSX.Element {
  const [cyclerState, setCyclerState] = useState<CyclerState>(() => presetCycler.getState());
  const [currentName, setCurrentName] = useState<string>(() =>
    readInitialName(presetCycler.getState()),
  );

  // Keep React mirror in sync with the cycler. StrictMode double-mount
  // re-subscribes; the cleanup ensures only one listener is ever active.
  //
  // CRITICAL: only sync `currentName` from the cycler when the cycler's
  // `currentIndex` actually changed (i.e. a real cyclePrev/cycleNext/goTo
  // fired). `presetCycler.refresh()` also broadcasts but keeps the index
  // stable — syncing on refresh would clobber a just-set `currentName`
  // from Save As / Import (both of which call refresh() immediately after
  // setCurrentName). This mirrors the old-world invariant: PresetActions
  // owned the name input, PresetBar displayed the cycler's name; they
  // were independent. The merged strip reconciles them by sourcing name
  // updates from EXPLICIT user cycles only.
  useEffect(() => {
    let prevIndex = presetCycler.getState().currentIndex;
    return presetCycler.onChange((next) => {
      setCyclerState(next);
      if (next.currentIndex !== prevIndex) {
        const name = next.presets[next.currentIndex]?.name;
        if (name) setCurrentName(name);
        prevIndex = next.currentIndex;
      }
    });
  }, []);

  // Global keyboard shortcuts — ported verbatim from the retired PresetBar.
  // The target-type guard (skip <input>, <textarea>) lets the caret inside
  // the preset-name input move as expected.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const target = e.target;
      if (target instanceof HTMLInputElement) return;
      if (target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        presetCycler.cyclePrev(paneRef?.current ?? undefined);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        presetCycler.cycleNext(paneRef?.current ?? undefined);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [paneRef]);

  const disabled = cyclerState.presets.length <= 1;
  const canAct = currentName.length > 0;

  function handlePrev(): void {
    presetCycler.cyclePrev(paneRef?.current ?? undefined);
  }

  function handleNext(): void {
    presetCycler.cycleNext(paneRef?.current ?? undefined);
  }

  function handleSave(): void {
    if (!currentName) return;
    savePreset(currentName);
    // Keep the cycler's cached list + current index in sync with storage.
    presetCycler.refresh();
  }

  function handleSaveAs(): void {
    const input = window.prompt('Preset name');
    if (input === null) return;
    const name = input.trim();
    if (!name) return;
    savePreset(name);
    setCurrentName(name);
    presetCycler.refresh();
  }

  function handleDelete(): void {
    if (!currentName) return;
    if (!window.confirm(`Delete preset "${currentName}"?`)) return;
    deletePreset(currentName);
    presetCycler.refresh();
  }

  function handleExport(): void {
    if (!currentName) return;
    exportPresetFile(currentName);
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    // Clear the input so selecting the same file twice still triggers change.
    e.target.value = '';
    if (!file) return;
    try {
      const preset = await importPresetFile(file, { loadImmediately: true });
      setCurrentName(preset.name);
      presetCycler.refresh();
      refreshPane(paneRef);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Import failed: ${msg}`);
    }
  }

  function handleLoadOnBlur(e: FocusEvent<HTMLInputElement>): void {
    // When the user types a name in the preset-name input and blurs, load
    // if that preset exists. Unknown names silently no-op (no noisy banner).
    const name = e.target.value.trim();
    if (!name) return;
    if (loadPreset(name)) {
      setCurrentName(name);
      refreshPane(paneRef);
    }
  }

  return (
    <div className={styles.strip} role="toolbar" aria-label="Preset strip" data-testid="preset-bar">
      <div className={styles.cycler}>
        <Button
          variant="icon"
          size="sm"
          aria-label="Previous preset"
          disabled={disabled}
          onClick={handlePrev}
        >
          ‹
        </Button>
        <input
          type="text"
          className={styles.name}
          value={currentName}
          onChange={(e) => setCurrentName(e.target.value)}
          onBlur={handleLoadOnBlur}
          aria-label="Current preset name"
          data-testid="preset-name"
        />
        <Button
          variant="icon"
          size="sm"
          aria-label="Next preset"
          disabled={disabled}
          onClick={handleNext}
        >
          ›
        </Button>
      </div>
      <div className={styles.actions} data-testid="preset-actions">
        <Button variant="secondary" size="sm" onClick={handleSave} disabled={!canAct}>
          Save
        </Button>
        <Button variant="secondary" size="sm" onClick={handleSaveAs}>
          Save As
        </Button>
        <Button variant="secondary" size="sm" onClick={handleDelete} disabled={!canAct}>
          Delete
        </Button>
        <Button variant="secondary" size="sm" onClick={handleExport} disabled={!canAct}>
          ↓ Export
        </Button>
        <label className={styles.importLabel}>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className={styles.hiddenFileInput}
          />
          ↑ Import
        </label>
      </div>
    </div>
  );
}
