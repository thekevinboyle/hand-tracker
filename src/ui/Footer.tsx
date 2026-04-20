/*
 * src/ui/Footer.tsx — bottom-row Footer (Task DR-8.7).
 *
 * Small credit/version row mounted inside the `state === 'GRANTED'` branch
 * of App.tsx. Hidden on every non-GRANTED screen (PROMPT + 7 error states)
 * because App simply does not render it there — no `hidden` attribute, no
 * CSS display toggling.
 *
 * Copy (verbatim, DR18):
 *   hand-tracker-fx v0.1.0 · · · · · · Built with MediaPipe, ogl, React
 *
 * The middle "spacer" span holds a literal run of six U+00B7 MIDDLE DOT
 * characters. Per synergy-fix MEDIUM-10, the visual dot-COUNT between the
 * two labels is stylistic, not semantic — the spacer is flex: 1 1 auto and
 * uses letter-spacing: 0.3em so the gaps scale with viewport width. The
 * aria-hidden="true" attribute stops screen readers from reading the dots
 * aloud as "middle dot middle dot middle dot ...".
 *
 * Authority:
 *   - DISCOVERY.md DR18 — keep a simplified footer; no "Leave feedback"
 *   - DISCOVERY.md §7     — testid contract (`footer`)
 *   - synergy-fix MEDIUM-10 — spacer is flex:1 + letter-spacing, not a fixed dot count
 *   - synergy-fix CRITICAL-03 — visibility is driven by the App.tsx camera-state
 *     branch, NOT by a `__handTracker.forceCameraState` dev hook
 *   - task-DR-8-7.md — hardcoded `v0.1.0` (DR-9.R tags the git version)
 */

import type { JSX } from 'react';
import styles from './Footer.module.css';

export function Footer(): JSX.Element {
  return (
    <footer className={styles.footer} data-testid="footer">
      <span className={styles.label}>hand-tracker-fx v0.1.0</span>
      <span aria-hidden="true" className={styles.spacer}>
        ······
      </span>
      <span className={styles.label}>Built with MediaPipe, ogl, React</span>
    </footer>
  );
}
