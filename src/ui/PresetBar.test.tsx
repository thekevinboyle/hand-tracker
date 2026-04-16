/**
 * Unit tests for PresetBar + PresetCycler (Task 4.4).
 *
 * Strategy:
 *   - `src/engine/presets` is mocked so `listPresets` returns a fixed
 *     array and `loadPreset` is a spy we can introspect. This keeps the
 *     cycler's own math testable without touching paramStore /
 *     modulationStore state (which other test files share).
 *   - PresetBar itself is rendered with @testing-library/react; chevron
 *     click + keydown are the exercised entrypoints.
 *   - Every test imports `presetCycler` fresh via `vi.resetModules()` +
 *     dynamic import so the module-singleton state doesn't leak between
 *     cases (listPresets is re-evaluated on each createPresetCycler()).
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import type { Pane } from 'tweakpane';
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

const { listPresetsMock, loadPresetMock } = vi.hoisted(() => ({
  listPresetsMock: vi.fn<() => Preset[]>(),
  loadPresetMock: vi.fn<(name: string) => boolean>(() => true),
}));

vi.mock('../engine/presets', () => ({
  listPresets: listPresetsMock,
  loadPreset: loadPresetMock,
}));

// Import AFTER the mock. Use `import()` so we can re-import a fresh
// singleton between tests via vi.resetModules() without touching the
// top-level import bindings.
type PresetBarModule = typeof import('./PresetBar');
type PresetCyclerModule = typeof import('./PresetCycler');

let PresetBar: PresetBarModule['PresetBar'];
let presetCycler: PresetCyclerModule['presetCycler'];

beforeEach(async () => {
  vi.resetModules();
  listPresetsMock.mockReset();
  listPresetsMock.mockReturnValue(FIXTURE);
  loadPresetMock.mockReset();
  loadPresetMock.mockReturnValue(true);
  ({ PresetBar } = await import('./PresetBar'));
  ({ presetCycler } = await import('./PresetCycler'));
});

afterEach(() => {
  cleanup();
});

function makePaneRef(): {
  ref: React.RefObject<Pane | null>;
  refresh: ReturnType<typeof vi.fn>;
} {
  const refresh = vi.fn();
  const ref = createRef<Pane | null>() as React.RefObject<Pane | null>;
  ref.current = { refresh } as unknown as Pane;
  return { ref, refresh };
}

describe('PresetBar rendering', () => {
  it('renders the current preset name (initial index 0)', () => {
    const { ref } = makePaneRef();
    render(<PresetBar paneRef={ref} />);
    expect(screen.getByTestId('preset-name').textContent).toBe('Alpha');
  });

  it('renders "—" when no presets are available', async () => {
    listPresetsMock.mockReturnValue([]);
    vi.resetModules();
    ({ PresetBar } = await import('./PresetBar'));
    const { ref } = makePaneRef();
    render(<PresetBar paneRef={ref} />);
    expect(screen.getByTestId('preset-name').textContent).toBe('—');
  });
});

describe('chevron click', () => {
  it('Next chevron advances + loads + refreshes pane', () => {
    const { ref, refresh } = makePaneRef();
    render(<PresetBar paneRef={ref} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next preset' }));
    expect(screen.getByTestId('preset-name').textContent).toBe('Beta');
    expect(loadPresetMock).toHaveBeenCalledWith('Beta');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('Prev chevron wraps from index 0 → last', () => {
    const { ref } = makePaneRef();
    render(<PresetBar paneRef={ref} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous preset' }));
    expect(screen.getByTestId('preset-name').textContent).toBe('Gamma');
    expect(loadPresetMock).toHaveBeenCalledWith('Gamma');
  });

  it('Next chevron wraps from last → index 0', () => {
    const { ref } = makePaneRef();
    render(<PresetBar paneRef={ref} />);
    // Cycle to end: 0 → 1 → 2 → 0
    const next = screen.getByRole('button', { name: 'Next preset' });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByTestId('preset-name').textContent).toBe('Alpha');
  });

  it('disables both chevrons when presets.length <= 1', async () => {
    listPresetsMock.mockReturnValue([FIXTURE[0] as Preset]);
    vi.resetModules();
    ({ PresetBar } = await import('./PresetBar'));
    const { ref } = makePaneRef();
    render(<PresetBar paneRef={ref} />);
    expect(screen.getByRole('button', { name: 'Previous preset' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next preset' })).toBeDisabled();
  });
});

describe('window keydown', () => {
  it('ArrowRight cycles forward', () => {
    const { ref } = makePaneRef();
    render(<PresetBar paneRef={ref} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('preset-name').textContent).toBe('Beta');
    expect(loadPresetMock).toHaveBeenCalledWith('Beta');
  });

  it('ArrowLeft cycles backward (wraps)', () => {
    const { ref } = makePaneRef();
    render(<PresetBar paneRef={ref} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('preset-name').textContent).toBe('Gamma');
  });

  it('ignores keydown originating from an <input> element', () => {
    const { ref } = makePaneRef();
    render(
      <>
        <input aria-label="probe" defaultValue="" />
        <PresetBar paneRef={ref} />
      </>,
    );
    const input = screen.getByLabelText('probe');
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    // Name stays on the starting preset; loadPreset never called.
    expect(screen.getByTestId('preset-name').textContent).toBe('Alpha');
    expect(loadPresetMock).not.toHaveBeenCalled();
  });

  it('ignores keydown originating from a <textarea>', () => {
    const { ref } = makePaneRef();
    render(
      <>
        <textarea aria-label="note" defaultValue="" />
        <PresetBar paneRef={ref} />
      </>,
    );
    const ta = screen.getByLabelText('note');
    fireEvent.keyDown(ta, { key: 'ArrowRight' });
    expect(loadPresetMock).not.toHaveBeenCalled();
  });

  it('removes the keydown listener on unmount (no further cycling)', () => {
    const { ref } = makePaneRef();
    const { unmount } = render(<PresetBar paneRef={ref} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(loadPresetMock).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(loadPresetMock).toHaveBeenCalledTimes(1); // unchanged
  });
});

describe('presetCycler.refresh', () => {
  it('re-reads listPresets + clamps currentIndex when the list shrinks', () => {
    listPresetsMock.mockReturnValue(FIXTURE);
    presetCycler.goTo(2); // Gamma
    expect(presetCycler.getState().currentIndex).toBe(2);
    // Now shrink the list to 1 element.
    listPresetsMock.mockReturnValue([FIXTURE[0] as Preset]);
    presetCycler.refresh();
    expect(presetCycler.getState().presets).toHaveLength(1);
    expect(presetCycler.getState().currentIndex).toBe(0);
  });

  it('does NOT load a preset on refresh (explicit-load contract)', () => {
    listPresetsMock.mockReturnValue(FIXTURE);
    presetCycler.refresh();
    expect(loadPresetMock).not.toHaveBeenCalled();
  });
});
