/**
 * Preset action buttons (Task 4.3).
 *
 * Renders a small dark-theme button row (Save / Save As / Delete / Export /
 * Import) above the Tweakpane container. Every action flows through the
 * pure `src/engine/presets.ts` API; the one UI concern this component
 * owns is calling `paneRef.current?.refresh()` after a preset load so
 * Tweakpane bindings reflect the new values (paramStore writes don't
 * automatically sync the DOM bindings).
 *
 * "Current preset" is local React state — the name of the preset most
 * recently saved / loaded / imported. Save / Delete / Export are gated
 * on a non-empty current name. The chevron cycler (Task 4.4) will lift
 * this into a shared hook later.
 */

import type { JSX, RefObject } from 'react';
import { useState } from 'react';
import type { Pane } from 'tweakpane';
import {
  deletePreset,
  exportPresetFile,
  importPresetFile,
  loadPreset,
  savePreset,
} from '../engine/presets';
import { presetCycler } from './PresetCycler';

export type PresetActionsProps = {
  paneRef: RefObject<Pane | null>;
};

const buttonStyle: React.CSSProperties = {
  background: '#1b1b1b',
  color: '#e6e6e6',
  border: '1px solid #2d2d2d',
  borderRadius: 4,
  padding: '4px 10px',
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const disabledButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};
const barStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '6px 8px',
  background: '#111',
  borderBottom: '1px solid #2d2d2d',
};

export function PresetActions({ paneRef }: PresetActionsProps): JSX.Element {
  const [currentName, setCurrentName] = useState<string>('Default');

  function refreshPane(): void {
    // Tweakpane v4's concrete `Pane` inherits `refresh()` from FolderApi
    // but the TS declaration omits it. Widen at the call site — same
    // pattern as src/engine/buildPaneFromManifest.ts.
    const pane = paneRef.current as unknown as { refresh?: () => void } | null;
    pane?.refresh?.();
  }

  function handleSave(): void {
    if (!currentName) return;
    savePreset(currentName);
    // Task 4.4: keep the cycler's cached list + current index in sync so
    // ArrowLeft/Right + chevrons see the fresh entry.
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

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    // Clear the input so selecting the same file twice still triggers change.
    e.target.value = '';
    if (!file) return;
    try {
      const preset = await importPresetFile(file, { loadImmediately: true });
      setCurrentName(preset.name);
      presetCycler.refresh();
      refreshPane();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Import failed: ${msg}`);
    }
  }

  function handleLoadOnBlur(e: React.FocusEvent<HTMLInputElement>): void {
    // When the user types a name in the "current" input and blurs, load if
    // that preset exists — cheap way to switch presets without a dropdown.
    // No-ops silently if the name is unknown (no noisy error banner).
    const name = e.target.value.trim();
    if (!name) return;
    if (loadPreset(name)) {
      setCurrentName(name);
      refreshPane();
    }
  }

  const canAct = currentName.length > 0;

  return (
    <div style={barStyle} data-testid="preset-actions">
      <input
        type="text"
        value={currentName}
        onChange={(e) => setCurrentName(e.target.value)}
        onBlur={handleLoadOnBlur}
        aria-label="Current preset name"
        style={{
          ...buttonStyle,
          flex: 1,
          textAlign: 'left' as const,
          cursor: 'text',
        }}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={!canAct}
        style={canAct ? buttonStyle : disabledButtonStyle}
      >
        Save
      </button>
      <button type="button" onClick={handleSaveAs} style={buttonStyle}>
        Save As
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={!canAct}
        style={canAct ? buttonStyle : disabledButtonStyle}
      >
        Delete
      </button>
      <button
        type="button"
        onClick={handleExport}
        disabled={!canAct}
        style={canAct ? buttonStyle : disabledButtonStyle}
      >
        Export
      </button>
      <label style={{ ...buttonStyle, cursor: 'pointer' }}>
        Import
        <input
          type="file"
          accept=".json,application/json"
          onChange={handleImport}
          style={{ display: 'none' }}
        />
      </label>
    </div>
  );
}
