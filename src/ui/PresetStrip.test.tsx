/**
 * Unit tests for PresetStrip (Task DR-8.5; simplified DR-8.6).
 *
 * The strip collapses the retired PresetBar + PresetActions; these tests
 * cover the union of their behavior:
 *   - cycler rendering + chevron clicks + keyboard + input-target guard
 *   - Save / Save As / Delete / Export / Import button wiring
 *   - presetCycler.onChange → re-render contract
 *   - testid contract: preset-bar, preset-name, preset-actions
 *
 * DR-8.6: the `paneRef` prop + `refreshPane()` helper are gone — Tweakpane
 * is retired, so every `useParam`-subscribed primitive auto-rerenders on
 * paramStore changes. No explicit refresh handle is needed.
 *
 * Strategy: mock `src/engine/presets` so file I/O is inspectable, then
 * dynamic-import the module under test after `vi.resetModules()` so the
 * cycler singleton picks up the fresh `listPresets` stub per test.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preset } from '../engine/presets';

const FIXTURE: Preset[] = [
  {
    version: 1,
    name: 'Alpha',
    effectId: 'handTrackingMosaic',
    params: {},
    modulationRoutes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    version: 1,
    name: 'Beta',
    effectId: 'handTrackingMosaic',
    params: {},
    modulationRoutes: [],
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    version: 1,
    name: 'Gamma',
    effectId: 'handTrackingMosaic',
    params: {},
    modulationRoutes: [],
    createdAt: '2026-01-03T00:00:00.000Z',
  },
];

const {
  listPresetsMock,
  loadPresetMock,
  savePresetMock,
  deletePresetMock,
  exportPresetFileMock,
  importPresetFileMock,
} = vi.hoisted(() => ({
  listPresetsMock: vi.fn<() => Preset[]>(),
  loadPresetMock: vi.fn<(name: string) => boolean>(() => true),
  savePresetMock: vi.fn<(name: string) => Preset>(),
  deletePresetMock: vi.fn<(name: string) => void>(),
  exportPresetFileMock: vi.fn<(name: string) => void>(),
  importPresetFileMock:
    vi.fn<(file: File, opts?: { loadImmediately?: boolean }) => Promise<Preset>>(),
}));

vi.mock('../engine/presets', () => ({
  listPresets: listPresetsMock,
  loadPreset: loadPresetMock,
  savePreset: savePresetMock,
  deletePreset: deletePresetMock,
  exportPresetFile: exportPresetFileMock,
  importPresetFile: importPresetFileMock,
}));

type PresetStripModule = typeof import('./PresetStrip');
type PresetCyclerModule = typeof import('./PresetCycler');

let PresetStrip: PresetStripModule['PresetStrip'];
let presetCycler: PresetCyclerModule['presetCycler'];

beforeEach(async () => {
  vi.resetModules();
  listPresetsMock.mockReset();
  listPresetsMock.mockReturnValue(FIXTURE);
  loadPresetMock.mockReset();
  loadPresetMock.mockReturnValue(true);
  savePresetMock.mockReset();
  savePresetMock.mockImplementation((name: string) => ({
    version: 1 as const,
    name,
    effectId: 'handTrackingMosaic' as const,
    params: {},
    modulationRoutes: [],
    createdAt: '2026-04-19T00:00:00.000Z',
  }));
  deletePresetMock.mockReset();
  exportPresetFileMock.mockReset();
  importPresetFileMock.mockReset();
  ({ PresetStrip } = await import('./PresetStrip'));
  ({ presetCycler } = await import('./PresetCycler'));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Task DR-8.5: PresetStrip — rendering + testids', () => {
  it('renders the preset-bar, preset-name, and preset-actions testids', () => {
    render(<PresetStrip />);
    expect(screen.getByTestId('preset-bar')).toBeInTheDocument();
    expect(screen.getByTestId('preset-name')).toBeInTheDocument();
    expect(screen.getByTestId('preset-actions')).toBeInTheDocument();
  });

  it('seeds the name input with the current preset (index 0 → Alpha)', () => {
    render(<PresetStrip />);
    expect(screen.getByTestId('preset-name')).toHaveValue('Alpha');
  });

  it('renders chevron icon buttons with accessible names', () => {
    render(<PresetStrip />);
    expect(screen.getByRole('button', { name: 'Previous preset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next preset' })).toBeInTheDocument();
  });

  it('disables both chevrons when presets.length <= 1', async () => {
    listPresetsMock.mockReturnValue([FIXTURE[0] as Preset]);
    vi.resetModules();
    ({ PresetStrip } = await import('./PresetStrip'));
    render(<PresetStrip />);
    expect(screen.getByRole('button', { name: 'Previous preset' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next preset' })).toBeDisabled();
  });
});

describe('Task DR-8.5: PresetStrip — chevron cycling', () => {
  it('Next chevron advances + loads the next preset', () => {
    render(<PresetStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Next preset' }));
    expect(screen.getByTestId('preset-name')).toHaveValue('Beta');
    expect(loadPresetMock).toHaveBeenCalledWith('Beta');
  });

  it('Prev chevron wraps from index 0 → last', () => {
    render(<PresetStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous preset' }));
    expect(screen.getByTestId('preset-name')).toHaveValue('Gamma');
    expect(loadPresetMock).toHaveBeenCalledWith('Gamma');
  });
});

describe('Task DR-8.5: PresetStrip — window keydown', () => {
  it('ArrowRight cycles forward', () => {
    render(<PresetStrip />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('preset-name')).toHaveValue('Beta');
    expect(loadPresetMock).toHaveBeenCalledWith('Beta');
  });

  it('ArrowLeft cycles backward (wraps)', () => {
    render(<PresetStrip />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('preset-name')).toHaveValue('Gamma');
  });

  it('input-target guard: keydown inside the preset-name input does NOT cycle', () => {
    render(<PresetStrip />);
    const input = screen.getByTestId('preset-name');
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(screen.getByTestId('preset-name')).toHaveValue('Alpha');
    expect(loadPresetMock).not.toHaveBeenCalled();
  });

  it('removes the keydown listener on unmount', () => {
    const { unmount } = render(<PresetStrip />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(loadPresetMock).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(loadPresetMock).toHaveBeenCalledTimes(1);
  });
});

describe('Task DR-8.5: PresetStrip — action buttons', () => {
  it('Save calls savePreset with the current name and refreshes the cycler', () => {
    render(<PresetStrip />);
    const refreshSpy = vi.spyOn(presetCycler, 'refresh');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(savePresetMock).toHaveBeenCalledWith('Alpha');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('Save As accepts prompt input, saves, updates name, refreshes cycler', () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('MyPreset');
    render(<PresetStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Save As' }));
    expect(promptSpy).toHaveBeenCalled();
    expect(savePresetMock).toHaveBeenCalledWith('MyPreset');
    // `refresh()` broadcasts but the index-didn't-change guard inside the
    // cycler subscription means `setCurrentName('MyPreset')` isn't clobbered.
    expect(screen.getByTestId('preset-name')).toHaveValue('MyPreset');
  });

  it('Save As cancel (prompt returns null) does not save', () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(<PresetStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Save As' }));
    expect(savePresetMock).not.toHaveBeenCalled();
  });

  it('Save As empty string (whitespace only) does not save', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('   ');
    render(<PresetStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Save As' }));
    expect(savePresetMock).not.toHaveBeenCalled();
  });

  it('Delete confirms, then calls deletePreset', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PresetStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deletePresetMock).toHaveBeenCalledWith('Alpha');
  });

  it('Delete cancel (confirm=false) does NOT delete', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<PresetStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deletePresetMock).not.toHaveBeenCalled();
  });

  it('Export triggers exportPresetFile for the current name', () => {
    render(<PresetStrip />);
    fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    expect(exportPresetFileMock).toHaveBeenCalledWith('Alpha');
  });

  it('Import: file-input change calls importPresetFile and updates name', async () => {
    importPresetFileMock.mockResolvedValue({
      version: 1,
      name: 'Imported',
      effectId: 'handTrackingMosaic',
      params: {},
      modulationRoutes: [],
      createdAt: '2026-04-19T00:00:00.000Z',
    });
    render(<PresetStrip />);
    const fileInput = screen
      .getByTestId('preset-actions')
      .querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const file = new File(['{}'], 'preset.json', { type: 'application/json' });
    // jsdom-safe: override `files` before firing change.
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);
    await vi.waitFor(() => {
      expect(importPresetFileMock).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(screen.getByTestId('preset-name')).toHaveValue('Imported');
    });
  });

  it('Import: failure surfaces via alert and does not update state', async () => {
    importPresetFileMock.mockRejectedValue(new Error('bad JSON'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<PresetStrip />);
    const fileInput = screen
      .getByTestId('preset-actions')
      .querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['nope'], 'broken.json', { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);
    await vi.waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Import failed'));
    });
    expect(screen.getByTestId('preset-name')).toHaveValue('Alpha');
  });
});

describe('Task DR-8.5: PresetStrip — name input blur', () => {
  it('blur with an existing preset name triggers loadPreset', () => {
    render(<PresetStrip />);
    const input = screen.getByTestId('preset-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Beta' } });
    fireEvent.blur(input);
    expect(loadPresetMock).toHaveBeenCalledWith('Beta');
  });

  it('blur with an unknown preset name silently no-ops', () => {
    loadPresetMock.mockReturnValue(false);
    render(<PresetStrip />);
    const input = screen.getByTestId('preset-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'DoesNotExist' } });
    fireEvent.blur(input);
    expect(loadPresetMock).toHaveBeenCalledWith('DoesNotExist');
  });

  it('blur with empty name is a no-op (no loadPreset call)', () => {
    render(<PresetStrip />);
    const input = screen.getByTestId('preset-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(loadPresetMock).not.toHaveBeenCalled();
  });
});

describe('Task DR-8.5: PresetStrip — external store integration', () => {
  it('re-renders when presetCycler.onChange fires from a goTo() call', () => {
    render(<PresetStrip />);
    expect(screen.getByTestId('preset-name')).toHaveValue('Alpha');
    // Wrap in act() — goTo triggers a state update in the external store
    // which fans out to every subscriber's React setState.
    act(() => {
      presetCycler.goTo(2);
    });
    expect(screen.getByTestId('preset-name')).toHaveValue('Gamma');
  });
});
