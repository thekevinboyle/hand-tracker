/**
 * src/ui/Toolbar.test.tsx — unit tests for Toolbar + CellSizePicker (Task DR-8.1).
 *
 * Coverage (>= 8 per task file Step 5):
 *
 *   Toolbar:
 *     1. renders the root with data-testid="toolbar"
 *     2. renders testid="toolbar-wordmark" with "Hand Tracker FX" text
 *     3. renders testid="toolbar-cell-picker"
 *     4. renders the RecordButton (record-button testid) inside
 *     5. mounts the 20x20 glyph mark as aria-hidden
 *
 *   CellSizePicker:
 *     6. default tileSize=16 (DEFAULT_PARAM_STATE) → M bucket checked
 *     7. clicking XL writes 64 to paramStore
 *     8. clicking each of the 5 buckets writes the correct tileSize
 *     9. between-bucket tileSize (12) shows NO bucket visually selected
 *    10. external paramStore update propagates into the picker's checked state
 *
 * Uses fireEvent (not @testing-library/user-event — not installed; carry
 * forward from DR-7 gotchas).
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// Side-effect: seeds paramStore with DEFAULT_PARAM_STATE + registers the
// manifest. Mirrors main.tsx / Showcase — useParam('mosaic.tileSize')
// returns 16 on first render after this import (synergy HIGH-08).
import '../effects/handTrackingMosaic';
import { paramStore } from '../engine/paramStore';
import { CellSizePicker } from './CellSizePicker';
import { Toolbar } from './Toolbar';

// Reset paramStore to the manifest defaults between tests so each case
// starts from the same baseline (mosaic.tileSize = 16).
beforeEach(() => {
  paramStore.set('mosaic.tileSize', 16);
});

afterEach(() => {
  cleanup();
});

describe('Task DR-8.1: Toolbar — structural rendering', () => {
  const getCanvas = (): HTMLCanvasElement | null => null;

  it('renders the root with data-testid="toolbar"', () => {
    render(<Toolbar getCanvas={getCanvas} />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('renders testid="toolbar-wordmark" with "Hand Tracker FX" text', () => {
    render(<Toolbar getCanvas={getCanvas} />);
    const wordmark = screen.getByTestId('toolbar-wordmark');
    expect(wordmark).toHaveTextContent('Hand Tracker FX');
  });

  it('renders testid="toolbar-cell-picker" (CellSizePicker is mounted)', () => {
    render(<Toolbar getCanvas={getCanvas} />);
    expect(screen.getByTestId('toolbar-cell-picker')).toBeInTheDocument();
  });

  it('renders the RecordButton (record-button testid) inside the trailing cell', () => {
    render(<Toolbar getCanvas={getCanvas} />);
    expect(screen.getByTestId('record-button')).toBeInTheDocument();
  });

  it('mounts the 20x20 glyph mark as aria-hidden (decorative)', () => {
    const { container } = render(<Toolbar getCanvas={getCanvas} />);
    // Decorative span sits as first child of the leading cell; asserted
    // structurally rather than by testid because it's intentionally
    // invisible to screen readers.
    const hiddenEls = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenEls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Task DR-8.1: CellSizePicker — default state', () => {
  it('default tileSize=16 renders the M bucket as aria-checked="true"', () => {
    // paramStore seeded above in beforeEach to 16.
    render(<CellSizePicker />);
    const mOption = screen.getByTestId('segmented-option-16');
    expect(mOption.getAttribute('aria-checked')).toBe('true');
  });

  it('default tileSize=16 leaves the other buckets NOT aria-checked="true"', () => {
    render(<CellSizePicker />);
    for (const value of [4, 8, 32, 64]) {
      const opt = screen.getByTestId(`segmented-option-${value}`);
      expect(opt.getAttribute('aria-checked')).not.toBe('true');
    }
  });
});

describe('Task DR-8.1: CellSizePicker — click writes through paramStore', () => {
  it('clicking the XL bucket writes 64 to paramStore.mosaic.tileSize', () => {
    render(<CellSizePicker />);
    fireEvent.click(screen.getByTestId('segmented-option-64'));
    const snap = paramStore.snapshot.mosaic as { tileSize: number };
    expect(snap.tileSize).toBe(64);
  });

  it('clicking each of the 5 buckets writes the correct tileSize', () => {
    render(<CellSizePicker />);
    const cases: Array<[string, number]> = [
      ['segmented-option-4', 4],
      ['segmented-option-8', 8],
      ['segmented-option-16', 16],
      ['segmented-option-32', 32],
      ['segmented-option-64', 64],
    ];
    for (const [testid, expected] of cases) {
      fireEvent.click(screen.getByTestId(testid));
      const snap = paramStore.snapshot.mosaic as { tileSize: number };
      expect(snap.tileSize).toBe(expected);
    }
  });
});

describe('Task DR-8.1: CellSizePicker — between-bucket value semantics', () => {
  it('tileSize=12 (between buckets) shows NO bucket visually selected', () => {
    paramStore.set('mosaic.tileSize', 12);
    render(<CellSizePicker />);
    for (const value of [4, 8, 16, 32, 64]) {
      const opt = screen.getByTestId(`segmented-option-${value}`);
      expect(opt.getAttribute('aria-checked')).not.toBe('true');
    }
  });

  it('tileSize=24 (another between-bucket value) also shows no selection', () => {
    paramStore.set('mosaic.tileSize', 24);
    render(<CellSizePicker />);
    for (const value of [4, 8, 16, 32, 64]) {
      const opt = screen.getByTestId(`segmented-option-${value}`);
      expect(opt.getAttribute('aria-checked')).not.toBe('true');
    }
  });
});

describe('Task DR-8.1: CellSizePicker — external paramStore updates propagate', () => {
  it('external paramStore.set("mosaic.tileSize", 32) re-renders with L checked', () => {
    render(<CellSizePicker />);
    // Initial: M (16) checked.
    expect(screen.getByTestId('segmented-option-16').getAttribute('aria-checked')).toBe('true');
    // Simulate a modulation route / preset load / sidebar slider pushing 32.
    // `act()` wraps the external store notify so React flushes the
    // useSyncExternalStore re-render before we probe the DOM.
    act(() => {
      paramStore.set('mosaic.tileSize', 32);
    });
    expect(screen.getByTestId('segmented-option-32').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('segmented-option-16').getAttribute('aria-checked')).not.toBe('true');
  });
});
