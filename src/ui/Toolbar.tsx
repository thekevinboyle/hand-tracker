/*
 * src/ui/Toolbar.tsx — top toolbar (Task DR-8.1).
 *
 * Three-column flex row mounted at the top of the viewport:
 *   [leading: mark + wordmark] · [center: CellSizePicker] · [trailing: Record]
 *
 * Semantic `<header>` — the implicit `banner` role makes the toolbar a
 * top-level landmark for screen readers.
 *
 * Record button: DR-8.1 moves it inline into the trailing cell. The
 * existing `RecordButton` component keeps `useRecorder` ownership +
 * `record-button` / `record-elapsed` testids; this task strips its
 * previous fixed-positioning so it flows inside the flex container.
 *
 * Authority:
 *   - DISCOVERY.md DR10 — toolbar contents (wordmark + CellSize + Record).
 *   - DISCOVERY.md DR13 — wordmark typography.
 *   - DISCOVERY.md DR15 — Record lives in the toolbar row.
 *   - task-DR-8-1.md — layout + testid contract.
 */

import type { JSX } from 'react';
import { CellSizePicker } from './CellSizePicker';
import { RecordButton } from './RecordButton';
import styles from './Toolbar.module.css';

export type ToolbarProps = {
  /**
   * Resolves the canvas to record at click time. Threaded straight into
   * `<RecordButton getCanvas={...} />`; the caller decides which canvas
   * (overlay vs WebGL) is captured — Task 4.5's precondition (D28) is
   * that the 2D overlay pre-composites the WebGL output, so callers
   * pass the overlay canvas.
   */
  getCanvas: () => HTMLCanvasElement | null;
};

export function Toolbar({ getCanvas }: ToolbarProps): JSX.Element {
  return (
    <header className={styles.toolbar} data-testid="toolbar">
      <div className={styles.leading}>
        <span className={styles.mark} aria-hidden="true" />
        <span className={styles.wordmark} data-testid="toolbar-wordmark">
          Hand Tracker FX
        </span>
      </div>
      <div className={styles.center}>
        <CellSizePicker />
      </div>
      <div className={styles.trailing}>
        <RecordButton getCanvas={getCanvas} />
      </div>
    </header>
  );
}
