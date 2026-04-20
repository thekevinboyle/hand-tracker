/**
 * React wrapper around `buildPaneFromManifest` (Task 2.2).
 *
 * Mounts a Tweakpane into a ref-owned div in `useEffect`, disposes in
 * cleanup. Idempotent under React StrictMode double-mount in dev (the
 * cleanup + re-mount cycle disposes the first instance before the second
 * builds). No 'use client' directive — Vite SPA, no RSC boundary.
 *
 * Props:
 *   - `manifest` — the effect manifest whose `params[]` drives the panel. Changing
 *     the manifest reference rebuilds the pane.
 *
 * The canvas render loop NEVER reads from this component — it reads
 * `paramStore.snapshot` directly (D20). This component is pure chrome for
 * the parameters UI.
 */

import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import type { JSX, RefObject } from 'react';
import { useEffect, useRef } from 'react';
import type { Pane } from 'tweakpane';
import { buildPaneFromManifest } from '../engine/buildPaneFromManifest';
import type { EffectManifest } from '../engine/manifest';
// Task DR-8.3: modulation UI moved to `<ModulationCard>` (React); the
// imperative `buildModulationPage` Tweakpane builder was deleted.
// Task DR-8.5: `<PresetActions>` was merged into the sidebar's
// `<PresetStrip>` — Panel no longer hosts a preset bar. Panel.tsx itself
// is scheduled for full retirement in DR-8.6 once `useParam`-subscribed
// primitives replace the final Tweakpane bindings.

export type PanelProps = {
  manifest: EffectManifest;
  /** Optional shared ref — when provided, Panel populates it with the
   *  Tweakpane instance on mount + nulls it on unmount. App.tsx passes a
   *  ref it also hands to the sidebar's `<PresetStrip>` so keyboard /
   *  chevron cycling can call `pane.refresh()` after a preset load. */
  paneRef?: RefObject<Pane | null>;
};

export function Panel({ manifest, paneRef: externalPaneRef }: PanelProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { pane, dispose } = buildPaneFromManifest(manifest, container, [EssentialsPlugin]);
    if (externalPaneRef) externalPaneRef.current = pane;
    // Task DR-8.3: modulation is no longer Tweakpane-owned — the React
    // `<ModulationCard>` subscribes to `modulationStore` directly. Panel.tsx
    // now only hosts effect-params until DR-8.6 retires it entirely.
    return () => {
      dispose();
      if (externalPaneRef) externalPaneRef.current = null;
    };
  }, [manifest, externalPaneRef]);

  return (
    // Task DR-8.2: the `panel-root` + `params-panel` testids migrated to
    // the new `<Sidebar>` + `<LayerCard1>` chrome. Panel's internal testids
    // are now `tweakpane-panel-root` + `tweakpane-params-panel` so Panel.test
    // can still target the Tweakpane host in isolation until DR-8.6 retires
    // this component entirely.
    <div className="panel-container" data-testid="tweakpane-panel-root">
      <div ref={containerRef} data-testid="tweakpane-params-panel" />
    </div>
  );
}
