/**
 * Unit tests for the modulation route store (Task 4.2).
 *
 * Mirrors the paramStore.test.ts discipline — every test builds a fresh
 * store via `createModulationStore([])` so the module singleton isn't
 * polluted across cases.
 */

import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_MODULATION_ROUTES, type ModulationRoute } from './modulation';
import { createModulationStore, type ModulationStore } from './modulationStore';

function route(partial: Partial<ModulationRoute> & Pick<ModulationRoute, 'id'>): ModulationRoute {
  return {
    enabled: true,
    source: 'landmark[8].x',
    targetParam: 'mosaic.tileSize',
    inputRange: [0, 1],
    outputRange: [4, 64],
    curve: 'linear',
    ...partial,
  };
}

describe('createModulationStore', () => {
  it('defaults to an empty routes list when no initial given', () => {
    const store: ModulationStore = createModulationStore();
    expect(store.getSnapshot().routes).toEqual([]);
  });

  it('accepts an explicit initial set (e.g. DEFAULT_MODULATION_ROUTES)', () => {
    const store = createModulationStore(DEFAULT_MODULATION_ROUTES);
    expect(store.getSnapshot().routes).toEqual(DEFAULT_MODULATION_ROUTES);
    // Snapshot holds a copy, not the imported array reference.
    expect(store.getSnapshot().routes).not.toBe(DEFAULT_MODULATION_ROUTES);
  });
});

describe('getSnapshot', () => {
  it('returns a stable reference until the next mutation', () => {
    const store = createModulationStore([]);
    const a = store.getSnapshot();
    const b = store.getSnapshot();
    expect(a).toBe(b);
  });

  it('returns a new reference after upsert', () => {
    const store = createModulationStore([]);
    const before = store.getSnapshot();
    store.upsertRoute(route({ id: 'r1' }));
    const after = store.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.routes).not.toBe(before.routes);
  });
});

describe('subscribe', () => {
  it('fires on every mutation', () => {
    const store = createModulationStore([]);
    const listener = vi.fn();
    store.subscribe(listener);
    store.upsertRoute(route({ id: 'r1' }));
    store.upsertRoute(route({ id: 'r1', enabled: false }));
    store.deleteRoute('r1');
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('unsubscribe stops notifications', () => {
    const store = createModulationStore([]);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.upsertRoute(route({ id: 'r1' }));
    unsubscribe();
    store.upsertRoute(route({ id: 'r2' }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('upsertRoute', () => {
  it('inserts a new route at the end', () => {
    const store = createModulationStore([]);
    store.upsertRoute(route({ id: 'a' }));
    store.upsertRoute(route({ id: 'b' }));
    expect(store.getSnapshot().routes.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('replaces an existing route in place (preserves order)', () => {
    const store = createModulationStore([
      route({ id: 'a' }),
      route({ id: 'b', enabled: true }),
      route({ id: 'c' }),
    ]);
    store.upsertRoute(route({ id: 'b', enabled: false }));
    const routes = store.getSnapshot().routes;
    expect(routes.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(routes[1]?.enabled).toBe(false);
  });
});

describe('deleteRoute', () => {
  it('removes the matching route', () => {
    const store = createModulationStore([route({ id: 'a' }), route({ id: 'b' })]);
    store.deleteRoute('a');
    expect(store.getSnapshot().routes.map((r) => r.id)).toEqual(['b']);
  });

  it('is a no-op for a missing id (no listener call)', () => {
    const store = createModulationStore([route({ id: 'a' })]);
    const listener = vi.fn();
    store.subscribe(listener);
    store.deleteRoute('zz');
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot().routes.map((r) => r.id)).toEqual(['a']);
  });
});

describe('replaceRoutes', () => {
  it('swaps the entire list and fires once', () => {
    const store = createModulationStore([route({ id: 'a' })]);
    const listener = vi.fn();
    store.subscribe(listener);
    store.replaceRoutes([route({ id: 'x' }), route({ id: 'y' })]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().routes.map((r) => r.id)).toEqual(['x', 'y']);
  });
});
