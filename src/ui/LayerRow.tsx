/*
 * src/ui/LayerRow.tsx — LayerRow helper (Task DR-8.2).
 *
 * Net-new helper composing a label + a control into a single flex row used
 * inside a `<LayerSection>` body (LayerSection itself lives in DR-7.6's
 * `src/ui/primitives/LayerCard.tsx`). Per synergy-fix CRITICAL-05 this is the
 * only new file at the `src/ui/` root — LayerSection is NOT re-declared here.
 *
 * Visual contract (see LayerRow.module.css):
 *   - Flex row, space-between, vertical-centered.
 *   - Label in `--color-text-muted`; control right-aligned.
 *   - Vertical padding `--space-04` so rows don't touch each other.
 *
 * The `label` string is rendered as a plain `<span>` — it is NOT a `<label
 * htmlFor>` because the primitives (Slider / Toggle / ColorPicker) each own
 * their own ARIA label via the `ariaLabel` prop (synergy-fix HIGH-02). The
 * row's visible text therefore duplicates the a11y name rather than being
 * the single source; that's intentional — it keeps every primitive working
 * stand-alone and lets the sidebar mix controls without needing to thread
 * `id` through every level.
 *
 * Authority:
 *   - task-DR-8-2.md § Implementation Blueprint, Step 1.
 *   - `custom-param-components` skill — Sidebar / LayerRow pattern.
 */

import type { JSX, ReactNode } from 'react';
import styles from './LayerRow.module.css';

export type LayerRowProps = {
  /** Visible label text rendered to the left of the control. */
  label: string;
  /** The control (Slider / Toggle / ColorPicker / Button / select). */
  children: ReactNode;
  /** Override the default `data-testid` (default: `layer-row`). */
  testid?: string;
};

export function LayerRow({ label, children, testid }: LayerRowProps): JSX.Element {
  return (
    <div className={styles.row} data-testid={testid ?? 'layer-row'}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}
