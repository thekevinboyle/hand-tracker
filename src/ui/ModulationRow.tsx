/*
 * src/ui/ModulationRow.tsx — per-route inline controls (Task DR-8.3).
 *
 * One row renders all six controls for a single `ModulationRoute` + a
 * "Delete" text link. When `route.curve === 'cubicBezier'` the BezierEditor
 * is rendered on a second line so the handles have room.
 *
 * Every edit flows through `modulationStore.upsertRoute({ ...route, <patch> })`.
 * Deletion calls `modulationStore.deleteRoute(route.id)`. The card above
 * re-renders via useSyncExternalStore and the row count changes — no
 * additional React state is kept here.
 *
 * Source options are the 45 authoritative sources per D15 / MEDIUM-03:
 *   21 landmarks × (x, y)  = 42
 *   + `pinch` + `centroid.x` + `centroid.y` = 45 total.
 *
 * Target options are derived from the hand-tracking-mosaic manifest, filtered
 * to non-button params (buttons are not modulation targets).
 *
 * Known gotcha: when switching `curve` away from `cubicBezier`, we DO NOT
 * clear `bezierControlPoints` — the user might switch back and expect their
 * prior curve to be preserved. The evaluator only reads `bezierControlPoints`
 * when `curve === 'cubicBezier'`, so leaving it stale is harmless.
 *
 * Authority:
 *   - task-DR-8-3.md § Step 2.
 *   - `custom-param-components` skill — ModulationRow pattern.
 *   - DISCOVERY.md D14 + D15.
 */

import type { JSX } from 'react';
import { handTrackingMosaicManifest } from '../effects/handTrackingMosaic';
import type { ModulationRoute, ModulationSourceId } from '../engine/modulation';
import { modulationStore } from '../engine/modulationStore';
import { BezierEditor } from './BezierEditor';
import styles from './ModulationRow.module.css';
import { Button } from './primitives/Button';
import { RangeSlider } from './primitives/Slider';
import { Toggle } from './primitives/Toggle';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type Option<V extends string> = { value: V; label: string };

// Build the 45-source list exactly once. Exported for unit tests.
export const SOURCE_OPTIONS: ReadonlyArray<Option<ModulationSourceId>> = (() => {
  const out: Array<Option<ModulationSourceId>> = [];
  for (let i = 0; i < 21; i++) {
    out.push({
      value: `landmark[${i}].x` as ModulationSourceId,
      label: `Landmark ${i} X`,
    });
    out.push({
      value: `landmark[${i}].y` as ModulationSourceId,
      label: `Landmark ${i} Y`,
    });
  }
  out.push({ value: 'pinch', label: 'Pinch strength' });
  out.push({ value: 'centroid.x', label: 'Hand centroid X' });
  out.push({ value: 'centroid.y', label: 'Hand centroid Y' });
  return out;
})();

export const CURVE_OPTIONS: ReadonlyArray<Option<ModulationRoute['curve']>> = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeIn', label: 'Ease In' },
  { value: 'easeOut', label: 'Ease Out' },
  { value: 'easeInOut', label: 'Ease In-Out' },
  { value: 'cubicBezier', label: 'Cubic Bezier' },
];

// Target options are derived from the manifest (non-button params only).
export const TARGET_OPTIONS: ReadonlyArray<Option<string>> = handTrackingMosaicManifest.params
  .filter((p) => p.type !== 'button')
  .map((p) => ({ value: p.key, label: p.label }));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type ModulationRowProps = {
  route: ModulationRoute;
  /** Zero-based index — drives `modulation-route-${index}` testid. */
  index: number;
};

export function ModulationRow({ route, index }: ModulationRowProps): JSX.Element {
  const patch = (next: Partial<ModulationRoute>): void => {
    modulationStore.upsertRoute({ ...route, ...next });
  };

  const isCubicBezier = route.curve === 'cubicBezier';

  return (
    <div className={styles.row} data-testid={`modulation-route-${index}`}>
      <div className={styles.primary}>
        <Toggle
          checked={route.enabled}
          onChange={(next) => patch({ enabled: next })}
          ariaLabel={`Route ${index + 1} enabled`}
          testid={`modulation-route-${index}-enabled`}
        />
        <select
          className={styles.select}
          value={route.source}
          aria-label={`Route ${index + 1} source`}
          data-testid={`modulation-route-${index}-source`}
          onChange={(e) => patch({ source: e.currentTarget.value as ModulationSourceId })}
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span aria-hidden className={styles.arrow}>
          →
        </span>
        <select
          className={styles.select}
          value={route.targetParam}
          aria-label={`Route ${index + 1} target param`}
          data-testid={`modulation-route-${index}-target`}
          onChange={(e) => patch({ targetParam: e.currentTarget.value })}
        >
          {TARGET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className={styles.sliderCell}>
          <span className={styles.sliderLabel}>In</span>
          <RangeSlider
            min={-1}
            max={2}
            step={0.01}
            value={route.inputRange}
            onChange={(next) => patch({ inputRange: [next[0], next[1]] })}
            ariaLabel={`Route ${index + 1} input range`}
            testid={`modulation-route-${index}-input-range`}
          />
        </div>
        <div className={styles.sliderCell}>
          <span className={styles.sliderLabel}>Out</span>
          <RangeSlider
            min={-100}
            max={200}
            step={0.5}
            value={route.outputRange}
            onChange={(next) => patch({ outputRange: [next[0], next[1]] })}
            ariaLabel={`Route ${index + 1} output range`}
            testid={`modulation-route-${index}-output-range`}
          />
        </div>
        <select
          className={styles.select}
          value={route.curve}
          aria-label={`Route ${index + 1} curve`}
          data-testid={`modulation-route-${index}-curve`}
          onChange={(e) => patch({ curve: e.currentTarget.value as ModulationRoute['curve'] })}
        >
          {CURVE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button
          variant="text"
          size="sm"
          testid={`modulation-route-${index}-delete`}
          onClick={() => modulationStore.deleteRoute(route.id)}
        >
          Delete
        </Button>
      </div>
      {isCubicBezier ? (
        <div className={styles.bezierCell}>
          <BezierEditor
            value={route.bezierControlPoints ?? [0.5, 0, 0.5, 1]}
            onChange={(next) =>
              patch({ bezierControlPoints: [next[0], next[1], next[2], next[3]] })
            }
            ariaLabel={`Route ${index + 1} bezier curve`}
            testid={`modulation-route-${index}-bezier`}
          />
        </div>
      ) : null}
    </div>
  );
}
