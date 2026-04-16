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
import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import type { Pane } from 'tweakpane';
import { buildPaneFromManifest } from '../engine/buildPaneFromManifest';
import type { EffectManifest } from '../engine/manifest';
import { buildModulationPage } from './ModulationPanel';
import { PresetActions } from './PresetActions';

export type PanelProps = {
  manifest: EffectManifest;
};

export function Panel({ manifest }: PanelProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Lifted so `<PresetActions>` can call `pane.refresh()` after a preset
  // load flushes new values into paramStore's bindingTarget — Tweakpane
  // otherwise shows stale values until the user interacts with a blade.
  const paneRef = useRef<Pane | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { pane, dispose } = buildPaneFromManifest(manifest, container, [EssentialsPlugin]);
    paneRef.current = pane;
    // Task 4.2: attach the Modulation section after the effect-params tree.
    // Dispose order matters — tear down the modulation subscriber + folders
    // BEFORE the pane itself so dispose() doesn't fire on an already-torn
    // container.
    const disposeModulation = buildModulationPage(pane);
    return () => {
      disposeModulation();
      dispose();
      paneRef.current = null;
    };
  }, [manifest]);

  return (
    <div className="panel-container" data-testid="panel-root">
      <PresetActions paneRef={paneRef} />
      <div ref={containerRef} data-testid="params-panel" />
    </div>
  );
}
