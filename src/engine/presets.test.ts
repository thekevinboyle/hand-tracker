/**
 * Unit tests for `src/engine/presets.ts` — Task 4.3.
 *
 * Runs under jsdom so `localStorage` + DOM APIs are available. Every test
 * clears the store key in beforeEach so the order-independence holds;
 * paramStore + modulationStore are reset via their public API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MODULATION_ROUTES } from './modulation';
import { modulationStore } from './modulationStore';
import { paramStore } from './paramStore';
import {
  DEFAULT_PRESET,
  deletePreset,
  exportPresetFile,
  getPreset,
  importPresetFile,
  initializePresetsIfEmpty,
  isValidPreset,
  listPresets,
  loadPreset,
  type Preset,
  savePreset,
} from './presets';

const STORAGE_KEY = 'hand-tracker-fx:presets:v1';

function resetStores(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  paramStore.replace({
    grid: { columnCount: 12, rowCount: 8, seed: 42, widthVariance: 0.6 },
    mosaic: { tileSize: 16, blendOpacity: 0.5, edgeFeather: 0 },
  });
  modulationStore.replaceRoutes(DEFAULT_MODULATION_ROUTES);
}

describe('isValidPreset', () => {
  it('accepts a well-formed preset', () => {
    const preset: Preset = {
      version: 1,
      name: 'OK',
      effectId: 'handTrackingMosaic',
      params: {},
      modulationRoutes: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    expect(isValidPreset(preset)).toBe(true);
  });

  it('rejects null + arrays + primitives', () => {
    expect(isValidPreset(null)).toBe(false);
    expect(isValidPreset(undefined)).toBe(false);
    expect(isValidPreset(42)).toBe(false);
    expect(isValidPreset('preset')).toBe(false);
    expect(isValidPreset([])).toBe(false);
  });

  it('rejects version !== 1 (forward-compat guard)', () => {
    const p = {
      version: 2,
      name: 'Future',
      effectId: 'handTrackingMosaic',
      params: {},
      modulationRoutes: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    expect(isValidPreset(p)).toBe(false);
  });

  it('rejects wrong effectId', () => {
    const p = {
      version: 1,
      name: 'Other',
      effectId: 'someOtherEffect',
      params: {},
      modulationRoutes: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    expect(isValidPreset(p)).toBe(false);
  });

  it('rejects missing / wrong-type fields', () => {
    const base = {
      version: 1 as const,
      name: 'A',
      effectId: 'handTrackingMosaic' as const,
      params: {},
      modulationRoutes: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    expect(isValidPreset({ ...base, name: 42 })).toBe(false);
    expect(isValidPreset({ ...base, params: null })).toBe(false);
    expect(isValidPreset({ ...base, params: [] })).toBe(false);
    expect(isValidPreset({ ...base, modulationRoutes: 'not-an-array' })).toBe(false);
    expect(isValidPreset({ ...base, createdAt: 1234 })).toBe(false);
  });
});

describe('listPresets / savePreset / getPreset / deletePreset', () => {
  beforeEach(() => {
    resetStores();
  });

  it('listPresets on fresh storage returns an empty array', () => {
    expect(listPresets()).toEqual([]);
  });

  it('savePreset adds an entry visible to listPresets + getPreset', () => {
    savePreset('Alpha');
    const list = listPresets();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('Alpha');
    expect(getPreset('Alpha')?.name).toBe('Alpha');
  });

  it('savePreset overwrites an existing name (no duplicate row)', () => {
    savePreset('Alpha');
    savePreset('Alpha');
    expect(listPresets()).toHaveLength(1);
  });

  it('deletePreset removes the matching entry', () => {
    savePreset('A');
    savePreset('B');
    deletePreset('A');
    expect(listPresets().map((p) => p.name)).toEqual(['B']);
  });

  it('deletePreset on an unknown name is a silent no-op', () => {
    savePreset('Alpha');
    expect(() => deletePreset('Missing')).not.toThrow();
    expect(listPresets()).toHaveLength(1);
  });

  it('savePreset snapshot is structurally deep-cloned (mutating after save does not leak)', () => {
    savePreset('Snap');
    // Mutate the live stores post-save — the stored preset must not change.
    paramStore.replace({ grid: { columnCount: 99 } });
    const saved = getPreset('Snap');
    const grid = saved?.params.grid as { columnCount: number } | undefined;
    expect(grid?.columnCount).toBe(12);
  });
});

describe('loadPreset', () => {
  beforeEach(() => {
    resetStores();
  });

  it('returns false for an unknown name', () => {
    expect(loadPreset('Nope')).toBe(false);
  });

  it('round-trip: save → mutate stores → load → stores equal the originals', () => {
    savePreset('Round');
    const snappedParams = structuredClone(paramStore.snapshot);
    const snappedRoutes = structuredClone(modulationStore.getSnapshot().routes);

    // Mutate both stores.
    paramStore.replace({ grid: { columnCount: 99 } });
    modulationStore.replaceRoutes([]);

    const ok = loadPreset('Round');
    expect(ok).toBe(true);
    expect(paramStore.snapshot).toEqual(snappedParams);
    expect(modulationStore.getSnapshot().routes).toEqual(snappedRoutes);
  });
});

describe('exportPresetFile', () => {
  beforeEach(() => {
    resetStores();
  });

  it('creates an <a download> and clicks it for the named preset', async () => {
    savePreset('Export');
    const clickSpy = vi.fn();
    const anchor = document.createElement('a');
    anchor.click = clickSpy;
    const createEl = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return anchor;
      return document.createDocumentFragment() as unknown as HTMLElement;
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    exportPresetFile('Export');

    expect(createEl).toHaveBeenCalledWith('a');
    expect(anchor.download).toBe('Export.hand-tracker-fx.json');
    expect(anchor.href).toBe('blob:mock-url');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    // Revoke fires on a `setTimeout(..., 0)` — await the macrotask tick.
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createEl.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('warns and is a silent no-op for an unknown name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exportPresetFile('Missing');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('sanitizes filename characters — slashes / dots / spaces become _', () => {
    savePreset('My / Fun * Preset');
    const anchor = document.createElement('a');
    anchor.click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return anchor;
      return document.createDocumentFragment() as unknown as HTMLElement;
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    exportPresetFile('My / Fun * Preset');
    expect(anchor.download).toBe('My___Fun___Preset.hand-tracker-fx.json');
    vi.restoreAllMocks();
  });
});

describe('importPresetFile', () => {
  beforeEach(() => {
    resetStores();
  });

  /** jsdom 25's File lacks a working `.text()`; wrap so `await file.text()`
   *  returns the raw string directly. The shape matches the subset of the
   *  File API that `importPresetFile` depends on. */
  function makeFile(content: string): File {
    const fake = {
      text: async () => content,
      name: 'preset.json',
      type: 'application/json',
    } as unknown as File;
    return fake;
  }

  it('throws "not valid JSON" on malformed input', async () => {
    await expect(importPresetFile(makeFile('not json {'))).rejects.toThrow(/not valid JSON/);
  });

  it('throws "failed validation" on version:2', async () => {
    const bad = JSON.stringify({
      version: 2,
      name: 'Future',
      effectId: 'handTrackingMosaic',
      params: {},
      modulationRoutes: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await expect(importPresetFile(makeFile(bad))).rejects.toThrow(/failed validation/);
  });

  it('throws on JSON that is valid but wrong shape', async () => {
    await expect(importPresetFile(makeFile('{"hello":"world"}'))).rejects.toThrow(
      /failed validation/,
    );
  });

  it('writes the imported preset to storage', async () => {
    const fresh: Preset = {
      version: 1,
      name: 'Imported',
      effectId: 'handTrackingMosaic',
      params: { grid: { columnCount: 7 } },
      modulationRoutes: [],
      createdAt: '2026-02-02T00:00:00.000Z',
    };
    await importPresetFile(makeFile(JSON.stringify(fresh)));
    const stored = getPreset('Imported');
    expect(stored?.params).toEqual({ grid: { columnCount: 7 } });
  });

  it('loadImmediately: true applies the preset to both stores', async () => {
    const fresh: Preset = {
      version: 1,
      name: 'Load-On-Import',
      effectId: 'handTrackingMosaic',
      params: { mosaic: { tileSize: 48 } },
      modulationRoutes: [],
      createdAt: '2026-02-02T00:00:00.000Z',
    };
    await importPresetFile(makeFile(JSON.stringify(fresh)), { loadImmediately: true });
    const mosaic = paramStore.snapshot.mosaic as { tileSize: number } | undefined;
    expect(mosaic?.tileSize).toBe(48);
    expect(modulationStore.getSnapshot().routes).toEqual([]);
  });
});

describe('DEFAULT_PRESET', () => {
  it('has version:1 + effectId handTrackingMosaic', () => {
    expect(DEFAULT_PRESET.version).toBe(1);
    expect(DEFAULT_PRESET.effectId).toBe('handTrackingMosaic');
    expect(DEFAULT_PRESET.name).toBe('Default');
  });
});

describe('initializePresetsIfEmpty', () => {
  beforeEach(() => {
    resetStores();
  });

  it('seeds DEFAULT_PRESET when storage is empty', () => {
    initializePresetsIfEmpty();
    const list = listPresets();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('Default');
  });

  it('is a no-op when storage already has presets', () => {
    savePreset('Existing');
    initializePresetsIfEmpty();
    expect(listPresets().map((p) => p.name)).toEqual(['Existing']);
  });
});

describe('readStorage resilience', () => {
  beforeEach(() => {
    resetStores();
  });

  it('tolerates malformed JSON in storage (returns empty list)', () => {
    window.localStorage.setItem(STORAGE_KEY, '{this is not valid json[');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(listPresets()).toEqual([]);
    warn.mockRestore();
  });

  it('tolerates non-array JSON in storage (returns empty list)', () => {
    window.localStorage.setItem(STORAGE_KEY, '{"not":"an array"}');
    expect(listPresets()).toEqual([]);
  });

  it('filters out invalid entries from a partially-corrupted array', () => {
    const good: Preset = {
      version: 1,
      name: 'Good',
      effectId: 'handTrackingMosaic',
      params: {},
      modulationRoutes: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const bad = { version: 99, name: 'Bad' };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([good, bad]));
    const list = listPresets();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('Good');
  });
});
