/*
 * src/ui/Sidebar.tsx — right-column Sidebar (Task DR-8.2 + DR-8.5).
 *
 * Hosts the (single) `<LayerCard1>` and reserves slots for DR-8.3's
 * ModulationCard + DR-8.5's `<PresetStrip>`. DR-8.5 wires the default
 * PresetStrip into the header — callers can still override via the
 * `presetStripSlot` prop (Sidebar unit tests do). DR6 locks this MVP to
 * one effect so there is no "Add layer" UI.
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
 * Toolbar it doesn't need pointer-events trickery because the DR-8.5
 * PresetStrip now lives inside the sidebar flow (the retired fixed-position
 * PresetActions stole pointer events above the toolbar — that's gone).
 *
 * Authority:
 *   - DISCOVERY.md DR6 (single LAYER 1), DR8 (sidebar shape), DR16 (preset
 *     strip in sidebar header), §7 (testids)
 *   - task-DR-8-2.md § Step 3, task-DR-8-5.md § Step 4
 *   - `custom-param-components` skill — Sidebar composition pattern
 */

import type { JSX, ReactNode, RefObject } from 'react';
import type { Pane } from 'tweakpane';
import { LayerCard1 } from './LayerCard1';
import { PresetStrip } from './PresetStrip';
import styles from './Sidebar.module.css';

export type SidebarProps = {
  /** Preset strip slot. Explicit override (takes precedence over `paneRef`).
   *  Pass `null` to render no strip. Unit tests typically omit both this
   *  and `paneRef` to keep the sidebar tree noise-free. */
  presetStripSlot?: ReactNode;
  /** Modulation card slot — filled by DR-8.3's `<ModulationCard>`. */
  modulationSlot?: ReactNode;
  /** When supplied (and `presetStripSlot` is NOT), Sidebar auto-mounts the
   *  default `<PresetStrip paneRef={paneRef} />` in the header. App.tsx
   *  takes this path. DR-8.6 drops Tweakpane and the arg becomes dead. */
  paneRef?: RefObject<Pane | null>;
};

export function Sidebar({
  presetStripSlot,
  modulationSlot,
  paneRef,
}: SidebarProps = {}): JSX.Element {
  // Default rendering rules:
  //   - If `presetStripSlot` was explicitly provided, use it (even `null`).
  //   - Else if `paneRef` was supplied, auto-mount `<PresetStrip>`.
  //   - Else (both absent) → omit the header wrapper entirely so DR-8.2's
  //     "one direct child" invariant holds for bare-sidebar unit tests.
  const strip =
    presetStripSlot !== undefined ? (
      presetStripSlot
    ) : paneRef !== undefined ? (
      <PresetStrip paneRef={paneRef} />
    ) : null;
  return (
    <aside className={styles.sidebar} data-testid="panel-root">
      {strip !== null ? <div className={styles.header}>{strip}</div> : null}
      <LayerCard1 />
      {modulationSlot !== undefined ? <div className={styles.slot}>{modulationSlot}</div> : null}
    </aside>
  );
}
