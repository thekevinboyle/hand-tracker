/*
 * src/ui/Sidebar.tsx — right-column Sidebar (Task DR-8.2).
 *
 * Hosts the (single) `<LayerCard1>` and reserves slots for DR-8.3's
 * ModulationCard and DR-8.5's PresetStrip. DR6 locks this MVP to one effect
 * so there is no "Add layer" UI.
 *
 * Testid contract (DISCOVERY §7):
 *   - `panel-root` MOVES here from the old `<Panel>` Tweakpane wrapper. 45
 *     existing E2E specs assert `panel-root` is visible in GRANTED state —
 *     mounting this component on top of the Tweakpane Panel preserves that
 *     contract. The old `<Panel>` component has its `panel-root` testid
 *     removed in this same task so there's only one element with the id.
 *
 * Positioning + styling lives in Sidebar.module.css (fixed right column,
 * 340px wide, below the Toolbar). Sidebar is always-interactive; unlike
 * Toolbar it doesn't need pointer-events trickery because it doesn't
 * collide with the retiring PresetActions z-index.
 *
 * Authority:
 *   - DISCOVERY.md DR6 (single LAYER 1), DR8 (sidebar shape), §7 (testids)
 *   - task-DR-8-2.md § Step 3
 *   - `custom-param-components` skill — Sidebar composition pattern
 */

import type { JSX, ReactNode } from 'react';
import { LayerCard1 } from './LayerCard1';
import styles from './Sidebar.module.css';

export type SidebarProps = {
  /** Preset strip slot — filled by DR-8.5's `<PresetStrip>`. */
  presetStripSlot?: ReactNode;
  /** Modulation card slot — filled by DR-8.3's `<ModulationCard>`. */
  modulationSlot?: ReactNode;
};

export function Sidebar({ presetStripSlot, modulationSlot }: SidebarProps = {}): JSX.Element {
  return (
    <aside className={styles.sidebar} data-testid="panel-root">
      {presetStripSlot !== undefined ? (
        <div className={styles.header}>{presetStripSlot}</div>
      ) : null}
      <LayerCard1 />
      {modulationSlot !== undefined ? <div className={styles.slot}>{modulationSlot}</div> : null}
    </aside>
  );
}
