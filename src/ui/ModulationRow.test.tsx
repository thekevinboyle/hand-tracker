/**
 * src/ui/ModulationRow.test.tsx — unit tests for ModulationRow (Task DR-8.3).
 *
 * Coverage (≥ 8 tests):
 *   - SOURCE_OPTIONS is exactly 45 entries (21 × 2 + pinch + centroid.x/y)
 *   - CURVE_OPTIONS has 5 entries matching D14
 *   - TARGET_OPTIONS excludes `button`-type params
 *   - Row renders all six inline controls + Delete button
 *   - Toggle click upserts enabled: !prev
 *   - Source select change upserts new source
 *   - Target select change upserts new targetParam
 *   - Curve select change upserts new curve
 *   - Delete button click deletes the route
 *   - BezierEditor renders when curve is cubicBezier, hidden otherwise
 *   - Switching to cubicBezier preserves any prior bezierControlPoints
 *
 * Uses fireEvent only.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Side-effect: registers the handTrackingMosaic manifest so TARGET_OPTIONS
// reflects the canonical 14 params (−1 button → 13 targets).
import '../effects/handTrackingMosaic';
import type { ModulationRoute } from '../engine/modulation';
import { modulationStore } from '../engine/modulationStore';
import { CURVE_OPTIONS, ModulationRow, SOURCE_OPTIONS, TARGET_OPTIONS } from './ModulationRow';

function mkRoute(overrides: Partial<ModulationRoute> = {}): ModulationRoute {
  return {
    id: 'test-id',
    enabled: true,
    source: 'landmark[8].x',
    targetParam: 'mosaic.tileSize',
    inputRange: [0, 1],
    outputRange: [4, 64],
    curve: 'linear',
    ...overrides,
  };
}

beforeEach(() => {
  // Reset the modulationStore for isolation.
  act(() => {
    modulationStore.replaceRoutes([]);
  });
});

afterEach(() => {
  cleanup();
});

describe('Task DR-8.3: ModulationRow — option constants', () => {
  it('SOURCE_OPTIONS has exactly 45 entries (21 × 2 + pinch + centroid.x/y)', () => {
    expect(SOURCE_OPTIONS).toHaveLength(45);
    // First two entries are landmark[0].x and landmark[0].y.
    expect(SOURCE_OPTIONS[0]?.value).toBe('landmark[0].x');
    expect(SOURCE_OPTIONS[1]?.value).toBe('landmark[0].y');
    // Last three entries are pinch, centroid.x, centroid.y.
    expect(SOURCE_OPTIONS[42]?.value).toBe('pinch');
    expect(SOURCE_OPTIONS[43]?.value).toBe('centroid.x');
    expect(SOURCE_OPTIONS[44]?.value).toBe('centroid.y');
  });

  it('CURVE_OPTIONS has the 5 D14 curves', () => {
    expect(CURVE_OPTIONS).toHaveLength(5);
    const values = CURVE_OPTIONS.map((o) => o.value);
    expect(values).toEqual(['linear', 'easeIn', 'easeOut', 'easeInOut', 'cubicBezier']);
  });

  it('TARGET_OPTIONS excludes the button param (grid.randomize)', () => {
    const keys = TARGET_OPTIONS.map((o) => o.value);
    expect(keys).not.toContain('grid.randomize');
    // The manifest has 14 params; one is the Randomize button → 13 targets.
    expect(TARGET_OPTIONS).toHaveLength(13);
  });
});

describe('Task DR-8.3: ModulationRow — render', () => {
  it('renders all primary controls with testids scoped to index', () => {
    render(<ModulationRow route={mkRoute()} index={0} />);
    expect(screen.getByTestId('modulation-route-0')).toBeInTheDocument();
    expect(screen.getByTestId('modulation-route-0-enabled')).toBeInTheDocument();
    expect(screen.getByTestId('modulation-route-0-source')).toBeInTheDocument();
    expect(screen.getByTestId('modulation-route-0-target')).toBeInTheDocument();
    expect(screen.getByTestId('modulation-route-0-input-range')).toBeInTheDocument();
    expect(screen.getByTestId('modulation-route-0-output-range')).toBeInTheDocument();
    expect(screen.getByTestId('modulation-route-0-curve')).toBeInTheDocument();
    expect(screen.getByTestId('modulation-route-0-delete')).toBeInTheDocument();
  });

  it('selects reflect the incoming route values', () => {
    render(
      <ModulationRow
        route={mkRoute({ source: 'centroid.x', targetParam: 'grid.columnCount', curve: 'easeIn' })}
        index={2}
      />,
    );
    expect(screen.getByTestId('modulation-route-2-source')).toHaveValue('centroid.x');
    expect(screen.getByTestId('modulation-route-2-target')).toHaveValue('grid.columnCount');
    expect(screen.getByTestId('modulation-route-2-curve')).toHaveValue('easeIn');
  });

  it('BezierEditor is absent when curve is linear', () => {
    render(<ModulationRow route={mkRoute({ curve: 'linear' })} index={0} />);
    expect(screen.queryByTestId('modulation-route-0-bezier')).toBeNull();
  });

  it('BezierEditor is present when curve is cubicBezier', () => {
    render(<ModulationRow route={mkRoute({ curve: 'cubicBezier' })} index={0} />);
    expect(screen.getByTestId('modulation-route-0-bezier')).toBeInTheDocument();
  });
});

describe('Task DR-8.3: ModulationRow — writes', () => {
  it('Toggle click flips enabled via upsertRoute', () => {
    const route = mkRoute({ enabled: true });
    const spy = vi.spyOn(modulationStore, 'upsertRoute');
    render(<ModulationRow route={route} index={0} />);
    fireEvent.click(screen.getByTestId('modulation-route-0-enabled'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ id: 'test-id', enabled: false });
    spy.mockRestore();
  });

  it('changing Source select upserts the new source', () => {
    const route = mkRoute({ source: 'landmark[8].x' });
    const spy = vi.spyOn(modulationStore, 'upsertRoute');
    render(<ModulationRow route={route} index={0} />);
    fireEvent.change(screen.getByTestId('modulation-route-0-source'), {
      target: { value: 'pinch' },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ source: 'pinch' });
    spy.mockRestore();
  });

  it('changing Target select upserts the new targetParam', () => {
    const route = mkRoute();
    const spy = vi.spyOn(modulationStore, 'upsertRoute');
    render(<ModulationRow route={route} index={0} />);
    fireEvent.change(screen.getByTestId('modulation-route-0-target'), {
      target: { value: 'grid.columnCount' },
    });
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ targetParam: 'grid.columnCount' });
    spy.mockRestore();
  });

  it('changing Curve select upserts the new curve', () => {
    const route = mkRoute({ curve: 'linear' });
    const spy = vi.spyOn(modulationStore, 'upsertRoute');
    render(<ModulationRow route={route} index={0} />);
    fireEvent.change(screen.getByTestId('modulation-route-0-curve'), {
      target: { value: 'cubicBezier' },
    });
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ curve: 'cubicBezier' });
    spy.mockRestore();
  });

  it('Delete button calls modulationStore.deleteRoute with the route id', () => {
    const spy = vi.spyOn(modulationStore, 'deleteRoute');
    render(<ModulationRow route={mkRoute({ id: 'abc' })} index={0} />);
    fireEvent.click(screen.getByTestId('modulation-route-0-delete'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe('abc');
    spy.mockRestore();
  });

  it('switching curve from cubicBezier to linear does NOT clear bezierControlPoints', () => {
    // Seed the store with a route carrying an authored bezier. When the row
    // writes curve=linear via upsertRoute, the patch object only contains
    // `curve` — the existing `bezierControlPoints` stay on `route`.
    const route = mkRoute({
      curve: 'cubicBezier',
      bezierControlPoints: [0.2, 0.3, 0.8, 0.7],
    });
    const spy = vi.spyOn(modulationStore, 'upsertRoute');
    render(<ModulationRow route={route} index={0} />);
    fireEvent.change(screen.getByTestId('modulation-route-0-curve'), {
      target: { value: 'linear' },
    });
    const called = spy.mock.calls[0]?.[0];
    expect(called).toBeDefined();
    expect(called?.curve).toBe('linear');
    expect(called?.bezierControlPoints).toEqual([0.2, 0.3, 0.8, 0.7]);
    spy.mockRestore();
  });
});
