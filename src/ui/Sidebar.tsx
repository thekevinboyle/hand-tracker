/*
 * src/ui/Sidebar.tsx — right-column Sidebar (Task DR-8.2 + DR-8.5 + DR-8.6).
 *
 * Hosts the (single) `<LayerCard1>` and reserves slots for DR-8.3's
 * ModulationCard + DR-8.5's `<PresetStrip>`. DR-8.5 wires the default
 * PresetStrip into the header — callers can still override via the
 * `presetStripSlot` prop (Sidebar unit tests do). DR6 locks this MVP to
 * one effect so there is no "Add layer" UI.
 *
 * Testid contract (DISCOVERY §7):
 *   - `panel-root` on the root `<aside>`.
 *
 * DR-8.6 — retired the `paneRef` prop. With Tweakpane gone, the sidebar
 * no longer needs a Pane handle to thread through; the PresetStrip
 * auto-rerenders via paramStore's useSyncExternalStore subscriptions.
 *
 * Authority:
 *   - DISCOVERY.md DR3 (Tweakpane retirement)
 *   - DISCOVERY.md DR6 (single LAYER 1), DR8 (sidebar shape), DR16 (preset
 *     strip in sidebar header), §7 (testids)
 *   - task-DR-8-2.md § Step 3, task-DR-8-5.md § Step 4, task-DR-8-6.md
 *   - `custom-param-components` skill — Sidebar composition pattern
 */

import type { JSX, ReactNode } from 'react';
import { LayerCard1 } from './LayerCard1';
import styles from './Sidebar.module.css';

export type SidebarProps = {
  /** Preset strip slot. Pass `null` to render no strip. Unit tests typically
   *  omit this to keep the sidebar tree noise-free. */
  presetStripSlot?: ReactNode;
  /** Modulation card slot — filled by DR-8.3's `<ModulationCard>`. */
  modulationSlot?: ReactNode;
};

export function Sidebar({ presetStripSlot, modulationSlot }: SidebarProps = {}): JSX.Element {
  return (
    <aside className={styles.sidebar} data-testid="panel-root">
      {presetStripSlot !== undefined && presetStripSlot !== null ? (
        <div className={styles.header}>{presetStripSlot}</div>
      ) : null}
      <LayerCard1 />
      {modulationSlot !== undefined ? <div className={styles.slot}>{modulationSlot}</div> : null}
    </aside>
  );
}
