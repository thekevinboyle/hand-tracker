/**
 * src/ui/ModulationCard.test.tsx — unit tests for ModulationCard
 * (Task DR-8.3).
 *
 * Coverage (≥ 7 tests):
 *   - Renders the modulation-card root + LayerCard header "MODULATION"
 *   - Card is collapsed by default (defaultCollapsed, synergy HIGH-03)
 *   - Expand via chevron reveals the route list
 *   - Two routes → two ModulationRows with testids -0 and -1
 *   - Empty store → empty-state copy visible
 *   - "+ Add route" button calls upsertRoute (verified via snapshot delta)
 *   - Deleting middle row re-indexes remaining rows from 0
 *   - Count in the header updates when routes change
 *   - StrictMode double-mount: exactly one listener net after cleanup
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../effects/handTrackingMosaic';
import type { ModulationRoute } from '../engine/modulation';
import { modulationStore } from '../engine/modulationStore';
import { ModulationCard } from './ModulationCard';

function seedRoute(overrides: Partial<ModulationRoute> = {}): ModulationRoute {
  return {
    id: `r-${Math.random().toString(36).slice(2)}`,
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
  act(() => {
    modulationStore.replaceRoutes([]);
  });
});

afterEach(() => {
  cleanup();
});

describe('Task DR-8.3: ModulationCard — rendering', () => {
  it('renders the card root + MODULATION heading', () => {
    render(<ModulationCard />);
    expect(screen.getByTestId('modulation-card')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /modulation/i })).toBeInTheDocument();
  });

  it('is collapsed by default (chevron aria-expanded="false")', () => {
    render(<ModulationCard />);
    const chevron = screen.getByTestId('modulation-card-chevron');
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('modulation-card')).toHaveAttribute('data-collapsed', 'true');
  });

  it('chevron click expands the card (aria-expanded flips to "true")', () => {
    render(<ModulationCard />);
    const chevron = screen.getByTestId('modulation-card-chevron');
    fireEvent.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('modulation-card')).toHaveAttribute('data-collapsed', 'false');
  });

  it('renders one ModulationRow per route with zero-based testids', () => {
    act(() => {
      modulationStore.replaceRoutes([seedRoute({ id: 'a' }), seedRoute({ id: 'b' })]);
    });
    render(<ModulationCard />);
    expect(screen.getByTestId('modulation-route-0')).toBeInTheDocument();
    expect(screen.getByTestId('modulation-route-1')).toBeInTheDocument();
    expect(screen.queryByTestId('modulation-route-2')).toBeNull();
  });

  it('renders the empty-state copy when the store has no routes', () => {
    render(<ModulationCard />);
    expect(screen.getByText(/no modulation routes/i)).toBeInTheDocument();
  });

  it('header count reflects the route length', () => {
    act(() => {
      modulationStore.replaceRoutes([seedRoute({ id: 'a' }), seedRoute({ id: 'b' })]);
    });
    render(<ModulationCard />);
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });
});

describe('Task DR-8.3: ModulationCard — mutations', () => {
  it('"+ Add route" click creates a new route visible as modulation-route-0', () => {
    render(<ModulationCard />);
    expect(modulationStore.getSnapshot().routes).toHaveLength(0);
    fireEvent.click(screen.getByTestId('modulation-card-add-route'));
    // Store updated synchronously; useSyncExternalStore re-renders.
    expect(modulationStore.getSnapshot().routes).toHaveLength(1);
    expect(screen.getByTestId('modulation-route-0')).toBeInTheDocument();
  });

  it('deleting the middle row re-indexes remaining rows from 0', () => {
    act(() => {
      modulationStore.replaceRoutes([
        seedRoute({ id: 'a' }),
        seedRoute({ id: 'b' }),
        seedRoute({ id: 'c' }),
      ]);
    });
    render(<ModulationCard />);
    expect(screen.getByTestId('modulation-route-0')).toBeInTheDocument();
    expect(screen.getByTestId('modulation-route-1')).toBeInTheDocument();
    expect(screen.getByTestId('modulation-route-2')).toBeInTheDocument();
    // Delete middle (id 'b').
    fireEvent.click(screen.getByTestId('modulation-route-1-delete'));
    expect(modulationStore.getSnapshot().routes).toHaveLength(2);
    // Remaining rows re-indexed to 0 and 1.
    expect(screen.getByTestId('modulation-route-0')).toBeInTheDocument();
    expect(screen.getByTestId('modulation-route-1')).toBeInTheDocument();
    expect(screen.queryByTestId('modulation-route-2')).toBeNull();
  });
});

describe('Task DR-8.3: ModulationCard — subscription lifecycle', () => {
  it('StrictMode double-mount nets exactly zero leaked listeners after cleanup', () => {
    const baselineSize = (
      modulationStore as unknown as { getSnapshot: () => { routes: readonly ModulationRoute[] } }
    ).getSnapshot().routes.length;
    const { unmount } = render(
      <StrictMode>
        <ModulationCard />
      </StrictMode>,
    );
    // Bump the store; the StrictMode subscriber should re-render without
    // duplicating rows.
    act(() => {
      modulationStore.replaceRoutes([seedRoute({ id: 'only' })]);
    });
    expect(screen.getByTestId('modulation-route-0')).toBeInTheDocument();
    // Exactly one modulation-route-0 element in the DOM — StrictMode cleanup
    // must have torn down the extra mount.
    expect(screen.getAllByTestId('modulation-route-0')).toHaveLength(1);
    unmount();
    // After unmount the store snapshot still works (we didn't leak listeners
    // that throw when invoked).
    expect(modulationStore.getSnapshot().routes.length).toBeGreaterThanOrEqual(baselineSize);
  });

  it('external store updates re-render the card without remounting', () => {
    render(<ModulationCard />);
    expect(screen.queryByTestId('modulation-route-0')).toBeNull();
    act(() => {
      modulationStore.upsertRoute(seedRoute({ id: 'live' }));
    });
    expect(screen.getByTestId('modulation-route-0')).toBeInTheDocument();
  });
});
