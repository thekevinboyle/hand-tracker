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
import { buildPaneFromManifest } from '../engine/buildPaneFromManifest';
import type { EffectManifest } from '../engine/manifest';

export type PanelProps = {
  manifest: EffectManifest;
};

export function Panel({ manifest }: PanelProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { dispose } = buildPaneFromManifest(manifest, container, [EssentialsPlugin]);
    return () => {
      dispose();
    };
  }, [manifest]);

  return <div ref={containerRef} className="panel-container" data-testid="params-panel" />;
}
