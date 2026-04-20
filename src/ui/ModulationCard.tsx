/*
 * src/ui/ModulationCard.tsx — collapsible Modulation card (Task DR-8.3).
 *
 * Replaces the retired Tweakpane `buildModulationPage` imperative builder
 * with a React component that subscribes to `modulationStore` via
 * `useSyncExternalStore`. The card renders below `<LayerCard1 />` inside
 * the `<Sidebar>` and is collapsed by default — users click the chevron to
 * reveal the route list.
 *
 * Testid contract (DISCOVERY §7):
 *   - `modulation-card` on the card root (via LayerCard testid override).
 *   - `modulation-route-${index}` on each `<ModulationRow>` — zero-based,
 *     re-indexed on every snapshot change (route deletion compacts the IDs).
 *
 * Known gotchas:
 *   - `defaultCollapsed` (not `collapsedByDefault`) per synergy-fix HIGH-03.
 *   - The LayerCard handles the collapse state itself; we don't need a
 *     module-level boolean. A fresh page load starts collapsed.
 *   - "+ Add route" seeds a new route with the same defaults the retired
 *     ModulationPanel used. `crypto.randomUUID()` is polyfill-free in modern
 *     browsers + jsdom 25 — no mock needed for unit tests.
 *
 * Authority:
 *   - task-DR-8-3.md § Step 4.
 *   - `custom-param-components` skill — ModulationCard pattern.
 *   - DISCOVERY.md DR8.
 */

import { type JSX, useSyncExternalStore } from 'react';
import type { ModulationRoute } from '../engine/modulation';
import { modulationStore } from '../engine/modulationStore';
import styles from './ModulationCard.module.css';
import { ModulationRow } from './ModulationRow';
import { Button } from './primitives/Button';
import { LayerCard } from './primitives/LayerCard';

/** Factory for a fresh "+ Add route" route — mirrors the retired
 *  `buildModulationPage` default row exactly so A/B comparisons hold. */
function makeDefaultRoute(): ModulationRoute {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    source: 'landmark[8].x',
    targetParam: 'mosaic.tileSize',
    inputRange: [0, 1],
    outputRange: [4, 64],
    curve: 'linear',
  };
}

export function ModulationCard(): JSX.Element {
  const snapshot = useSyncExternalStore(
    modulationStore.subscribe,
    modulationStore.getSnapshot,
    modulationStore.getSnapshot,
  );
  const routes = snapshot.routes;

  const handleAdd = (): void => {
    modulationStore.upsertRoute(makeDefaultRoute());
  };

  return (
    <LayerCard
      title="MODULATION"
      collapsible
      defaultCollapsed
      testid="modulation-card"
      action={<span className={styles.count}>({routes.length})</span>}
    >
      <div className={styles.list}>
        {routes.length === 0 ? (
          <p className={styles.empty}>No modulation routes.</p>
        ) : (
          routes.map((route, i) => <ModulationRow key={route.id} route={route} index={i} />)
        )}
      </div>
      <div className={styles.footer}>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAdd}
          testid="modulation-card-add-route"
        >
          + Add route
        </Button>
      </div>
    </LayerCard>
  );
}
