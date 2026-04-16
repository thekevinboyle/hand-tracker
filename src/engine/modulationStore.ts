/**
 * Modulation route store (Task 4.2, scope for Task 4.3 preset I/O).
 *
 * Holds the live list of `ModulationRoute` records backing the Modulation
 * panel. Minimal surface — mirrors `paramStore.ts`'s subscribe / snapshot
 * discipline so `useSyncExternalStore` + the render loop both get stable
 * references:
 *
 *   - `getSnapshot()` returns the current `{ routes }` object; identity
 *     stable until the next mutation.
 *   - `subscribe(listener)` returns an unsubscribe function.
 *   - `upsertRoute(route)` inserts by `id` or replaces the existing route
 *     at the matching index (preserves order for React keys).
 *   - `deleteRoute(id)` drops the route with matching id; no-op if absent.
 *   - `replaceRoutes(next)` swaps the entire list (preset load path).
 *
 * Seeded with `DEFAULT_MODULATION_ROUTES` at construction so first
 * snapshot always has the D13 two-route baseline. Consumers that need
 * an empty store use `createModulationStore([])`.
 *
 * Pure module — no DOM, no React. React bindings live in
 * `src/ui/ModulationPanel.ts` (imperative Tweakpane) and — later —
 * `src/ui/useModulation.ts` for React reads.
 */

import type { ModulationRoute } from './modulation';

export type ModulationSnapshot = {
  readonly routes: readonly ModulationRoute[];
};

export type ModulationStoreListener = () => void;

export type ModulationStore = {
  getSnapshot(): ModulationSnapshot;
  subscribe(listener: ModulationStoreListener): () => void;
  upsertRoute(route: ModulationRoute): void;
  deleteRoute(id: string): void;
  replaceRoutes(next: readonly ModulationRoute[]): void;
};

export function createModulationStore(initial: readonly ModulationRoute[] = []): ModulationStore {
  let snapshot: ModulationSnapshot = { routes: initial.slice() };
  const listeners = new Set<ModulationStoreListener>();

  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  function getSnapshot(): ModulationSnapshot {
    return snapshot;
  }

  function subscribe(listener: ModulationStoreListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function upsertRoute(route: ModulationRoute): void {
    const existingIdx = snapshot.routes.findIndex((r) => r.id === route.id);
    let nextRoutes: ModulationRoute[];
    if (existingIdx < 0) {
      nextRoutes = [...snapshot.routes, route];
    } else {
      nextRoutes = snapshot.routes.slice();
      nextRoutes[existingIdx] = route;
    }
    snapshot = { routes: nextRoutes };
    notify();
  }

  function deleteRoute(id: string): void {
    const idx = snapshot.routes.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const nextRoutes = snapshot.routes.slice();
    nextRoutes.splice(idx, 1);
    snapshot = { routes: nextRoutes };
    notify();
  }

  function replaceRoutes(next: readonly ModulationRoute[]): void {
    snapshot = { routes: next.slice() };
    notify();
  }

  return { getSnapshot, subscribe, upsertRoute, deleteRoute, replaceRoutes };
}

/** Module-singleton — mirrors `paramStore.ts`. Starts empty (same as
 *  `paramStore`); the app seeds `DEFAULT_MODULATION_ROUTES` at startup
 *  via `main.tsx`. Tests that need isolation import `createModulationStore`
 *  and build a fresh instance. */
export const modulationStore: ModulationStore = createModulationStore();
