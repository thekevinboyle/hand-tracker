/*
 * src/ui/LayerCard1.tsx — the single LAYER 1 card (Task DR-8.2).
 *
 * DR6 locks the MVP to ONE effect: `handTrackingMosaic`. This component is
 * therefore hardcoded against that manifest — no multi-effect lookup, no
 * "Add layer" button. The three inner LayerSection groups (Grid / Mosaic /
 * Input) mirror the pixelcrash "layer body" pattern (DR8) and aggregate all
 * 14 manifest params through `useParam` bindings.
 *
 * Synergy-fix carry-forwards:
 *   - CRITICAL-04: `useParam('key.path')` calls NEVER pass an explicit
 *     generic — the hook infers the value type from the key literal.
 *   - CRITICAL-05: `{ LayerCard, LayerSection }` imported from
 *     `./primitives/LayerCard`. NOT redeclared in this file. Prop names:
 *     LayerCard → `title`, LayerSection → `heading`, both → `testid`
 *     (lowercase).
 *   - HIGH-02: every `<Slider>` and `<ColorPicker>` passes `ariaLabel`
 *     (the row's label string).
 *   - HIGH-03: LayerCard is not collapsible here (DR6 — "always expanded"),
 *     so `defaultCollapsed` is irrelevant.
 *
 * Testid contract (DISCOVERY §7):
 *   - `params-panel` — wraps the LayerCard body (back-compat with the old
 *     Tweakpane div; 45 existing E2E specs rely on it being visible when
 *     state === GRANTED).
 *   - `layer-card-grid`, `layer-card-mosaic`, `layer-card-input` — one on
 *     each LayerSection `<section>`.
 *
 * `grid.randomize` is a ButtonParamDef from the manifest — we look up its
 * `onClick` at render time (not module load) so any future manifest swap
 * re-reads the handler.
 *
 * Authority:
 *   - task-DR-8-2.md
 *   - DISCOVERY DR6 (single LAYER 1), DR8 (sidebar hosts cards), §7 (testids)
 *   - `custom-param-components` skill — LayerCard1 hardcoded pattern
 *   - `hand-tracker-fx-architecture` skill — manifest → paramStore → useParam
 */

import type { JSX } from 'react';
import { handTrackingMosaicManifest } from '../effects/handTrackingMosaic';
import { paramStore } from '../engine/paramStore';
import { LayerRow } from './LayerRow';
import { Button } from './primitives/Button';
import { ColorPicker } from './primitives/ColorPicker';
import { LayerCard, LayerSection } from './primitives/LayerCard';
import { Slider } from './primitives/Slider';
import { Toggle } from './primitives/Toggle';
import { useParam } from './primitives/useParam';

export function LayerCard1(): JSX.Element {
  // ─── Grid ─────────────────────────────────────────────────────
  // `grid.seed` manifest range is 0..2147483647; a pixel-resolution slider
  // at that span is unusable, so the visible UI range is 0..65535 with step
  // 1. The manifest button's onClick writes random u32 values directly to
  // paramStore — that value can exceed the slider's max but paramStore.set
  // does not clamp, so the numeric value persists intact (the slider just
  // visually pins at its max until the user drags or the value drops).
  const [seed, setSeed] = useParam('grid.seed');
  const [cols, setCols] = useParam('grid.columnCount');
  const [rows, setRows] = useParam('grid.rowCount');
  const [variance, setVariance] = useParam('grid.widthVariance');
  const [lineColor, setLineColor] = useParam('grid.lineColor');
  const [lineWeight, setLineWeight] = useParam('grid.lineWeight');

  // ─── Mosaic (DR6 groups these four together) ─────────────────
  const [tileSize, setTileSize] = useParam('mosaic.tileSize');
  const [blendOpacity, setBlendOpacity] = useParam('mosaic.blendOpacity');
  const [edgeFeather, setEdgeFeather] = useParam('mosaic.edgeFeather');
  // regionPadding's manifest page is "Effect" but DR6 puts it visually under
  // Mosaic. The key path (`effect.regionPadding`) is unchanged — only the
  // visual grouping moves.
  const [regionPadding, setRegionPadding] = useParam('effect.regionPadding');

  // ─── Input ───────────────────────────────────────────────────
  const [mirror, setMirror] = useParam('input.mirrorMode');
  const [showLandmarks, setShowLandmarks] = useParam('input.showLandmarks');
  const [deviceId, setDeviceId] = useParam('input.deviceId');

  // Manifest button lookup — resolved per-render so a hot-swapped manifest
  // picks up the new onClick (no module-load caching).
  const randomizeDef = handTrackingMosaicManifest.params.find(
    (p) => p.type === 'button' && p.key === 'grid.randomize',
  );
  const handleRandomize = (): void => {
    // ButtonParamDef.onClick(allParams) — the manifest receives a read-only
    // snapshot of paramStore. The handTrackingMosaic randomize handler
    // closes over `paramStore.set` so the arg is effectively unused, but
    // the type signature requires it.
    if (randomizeDef?.type === 'button') {
      randomizeDef.onClick(paramStore.snapshot as Record<string, unknown>);
    }
  };

  return (
    <LayerCard title="LAYER 1" testid="layer-card-1">
      <div data-testid="params-panel">
        <LayerSection heading="Grid" testid="layer-card-grid">
          <LayerRow label="Seed">
            <Slider min={0} max={65535} step={1} value={seed} onChange={setSeed} ariaLabel="Seed" />
          </LayerRow>
          <LayerRow label="Columns">
            <Slider min={4} max={32} step={1} value={cols} onChange={setCols} ariaLabel="Columns" />
          </LayerRow>
          <LayerRow label="Rows">
            <Slider min={2} max={24} step={1} value={rows} onChange={setRows} ariaLabel="Rows" />
          </LayerRow>
          <LayerRow label="Width variance">
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={variance}
              onChange={setVariance}
              ariaLabel="Width variance"
            />
          </LayerRow>
          <LayerRow label="Line color">
            <ColorPicker value={lineColor} onChange={setLineColor} ariaLabel="Line color" />
          </LayerRow>
          <LayerRow label="Line weight">
            <Slider
              min={0.5}
              max={4}
              step={0.5}
              value={lineWeight}
              onChange={setLineWeight}
              ariaLabel="Line weight"
            />
          </LayerRow>
          <LayerRow label="Randomize grid">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRandomize}
              testid="button-randomize-grid"
            >
              Randomize
            </Button>
          </LayerRow>
        </LayerSection>

        <LayerSection heading="Mosaic" testid="layer-card-mosaic">
          <LayerRow label="Tile size">
            <Slider
              min={4}
              max={64}
              step={1}
              value={tileSize}
              onChange={setTileSize}
              ariaLabel="Tile size"
            />
          </LayerRow>
          <LayerRow label="Blend opacity">
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={blendOpacity}
              onChange={setBlendOpacity}
              ariaLabel="Blend opacity"
            />
          </LayerRow>
          <LayerRow label="Edge feather">
            <Slider
              min={0}
              max={8}
              step={0.5}
              value={edgeFeather}
              onChange={setEdgeFeather}
              ariaLabel="Edge feather"
            />
          </LayerRow>
          <LayerRow label="Region padding">
            <Slider
              min={0}
              max={4}
              step={1}
              value={regionPadding}
              onChange={setRegionPadding}
              ariaLabel="Region padding"
            />
          </LayerRow>
        </LayerSection>

        <LayerSection heading="Input" testid="layer-card-input">
          <LayerRow label="Mirror">
            <Toggle checked={mirror} onChange={setMirror} ariaLabel="Mirror" />
          </LayerRow>
          <LayerRow label="Show landmarks">
            <Toggle
              checked={showLandmarks}
              onChange={setShowLandmarks}
              ariaLabel="Show landmarks"
            />
          </LayerRow>
          <LayerRow label="Camera device">
            {/* Simple single-option select — enumerateDevices integration is
                DR-9 work. Must not crash when deviceId === ''. */}
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.currentTarget.value)}
              aria-label="Camera device"
              data-testid="camera-device-select"
            >
              <option value="">Default</option>
            </select>
          </LayerRow>
        </LayerSection>
      </div>
    </LayerCard>
  );
}
