/*
 * src/ui/primitives/Toggle.tsx — Toggle primitive (Task DR-7.4).
 *
 * 20×20 ARIA switch that morphs square (ON) ↔ circle (OFF).
 *   - ON  : `--color-toggle-on` fill, `--radius-0`, X-shaped icon
 *   - OFF : `--color-toggle-off` fill, `--radius-circle`, icon rotated -90°
 *
 * The two SVG lines are DIAGONALS (NW→SE and NE→SW), forming an "X". The
 * spring rotation runs on 0.35s with a 0.15s delay so the ::before surface
 * (background + radius) animates first, then the icon snaps. Reduced-motion
 * is handled at the token level in src/ui/tokens.css — no per-component
 * media block.
 *
 * The skill's canonical spec (§ 3.4) and the task file both allow either
 * an X-shape or a "+"-shape for the inner icon; we choose diagonals so the
 * icon reads as a classic "close/X" when ON. Tests assert on BEHAVIOR
 * (aria-checked, onChange calls, disabled gating) — never on the exact
 * transform matrix, because jsdom does not compute CSS transitions.
 *
 * Authority:
 *   - task-DR-7-4.md
 *   - DISCOVERY.md DR11 (motion — spring bezier on structural changes)
 *   - `custom-param-components` skill § 3.4 — Toggle contract
 *   - `design-tokens-dark-palette` skill — `--ease-spring` value
 */

import { forwardRef, type JSX, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import styles from './Toggle.module.css';

export type ToggleProps = {
  /** Current checked state. Fully controlled — no internal state. */
  checked: boolean;
  /** Fires with the next boolean when user toggles via click or keyboard. */
  onChange: (next: boolean) => void;
  /** REQUIRED label for screen readers (ARIA switch pattern). */
  ariaLabel: string;
  /** Disables pointer + keyboard interaction. */
  disabled?: boolean;
  /** Override the default `data-testid` (default: `toggle`). */
  testid?: string;
};

/** Native button `role="switch"` — Space + Enter both toggle. */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  function Toggle(props, ref): JSX.Element {
    const { checked, onChange, ariaLabel, disabled = false, testid } = props;

    const handleClick = (): void => {
      if (disabled) return;
      onChange(!checked);
    };

    const handleKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>): void => {
      if (disabled) return;
      // Space: preventDefault to suppress page scroll.
      // Enter: also toggle (standard for role="switch"); no preventDefault
      // needed since Enter does not scroll.
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        onChange(!checked);
      } else if (e.key === 'Enter') {
        onChange(!checked);
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        className={styles.root}
        data-checked={checked ? 'true' : 'false'}
        data-testid={testid ?? 'toggle'}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/*
         * Diagonal X icon inside a 10×10 viewBox. When OFF, the wrapping
         * group rotates -90° on a 0.35s spring curve with a 0.15s delay.
         * `stroke="currentColor"` inherits the text color set on .root
         * (which itself is chosen against the ::before background).
         */}
        <svg className={styles.icon} viewBox="0 0 10 10" aria-hidden="true" width={10} height={10}>
          {/* NW → SE diagonal */}
          <line
            x1="1"
            y1="1"
            x2="9"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* NE → SW diagonal */}
          <line
            x1="9"
            y1="1"
            x2="1"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    );
  },
);
