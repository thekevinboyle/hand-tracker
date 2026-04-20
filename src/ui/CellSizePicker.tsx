/*
 * src/ui/CellSizePicker.tsx — 5-bucket cell-size picker (Task DR-8.1).
 *
 * Thin composite around the Segmented primitive. Binds `mosaic.tileSize`
 * via `useParam` (DR-7.7) with the 5 buckets locked by DISCOVERY DR9:
 *   XS → 4   S → 8   M → 16 (default)   L → 32   XL → 64
 *
 * Between-bucket semantics (DR-7.2 synergy-fix HIGH-01 carry-forward):
 * when a modulation route (or any future consumer) drives `mosaic.tileSize`
 * to a value that is NOT one of the 5 buckets (e.g. 12), the Segmented
 * primitive renders with `value={undefined}` so no bucket is visually
 * highlighted. This is already supported end-to-end by Segmented's
 * `value: V | undefined` contract.
 *
 * Authority:
 *   - DISCOVERY.md DR9 — bucket spec.
 *   - `custom-param-components` skill — CellSizePicker pattern.
 *   - task-DR-8-1.md — testid + behavior contract.
 */

import type { JSX } from 'react';
import { Segmented } from './primitives/Segmented';
import { useParam } from './primitives/useParam';

/**
 * Bucket table — VALUE is the concrete `mosaic.tileSize` emitted when the
 * user selects the option; LABEL is what renders in the Segmented typography.
 * Ordered ascending so ArrowRight moves "up" in size.
 */
const BUCKETS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 4, label: 'XS' },
  { value: 8, label: 'S' },
  { value: 16, label: 'M' },
  { value: 32, label: 'L' },
  { value: 64, label: 'XL' },
];

export function CellSizePicker(): JSX.Element {
  // Generic inference — NEVER pass `<number>` explicitly. The hook
  // resolves `ParamValue<'mosaic.tileSize'>` to `number` on its own
  // (synergy-fix CRITICAL-04 + task-DR-7-7 carry-forward).
  const [tileSize, setTileSize] = useParam('mosaic.tileSize');

  // When the current tileSize is not one of the 5 bucket values, render
  // with value=undefined so Segmented shows no selected bucket.
  const active = BUCKETS.some((b) => b.value === tileSize) ? tileSize : undefined;

  return (
    <div data-testid="toolbar-cell-picker">
      <Segmented<number>
        options={BUCKETS}
        value={active}
        onChange={(next) => setTileSize(next)}
        ariaLabel="Cell size"
        testid="cell-size-picker"
      />
    </div>
  );
}
