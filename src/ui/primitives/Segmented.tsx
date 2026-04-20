/*
 * src/ui/primitives/Segmented.tsx — Segmented primitive (Task DR-7.2).
 *
 * Typographic N-option radio group. No pill/track background — selected
 * state is `color: var(--color-segmented-selected)` + `font-weight: 600`.
 * "/" separator rendered via `input::before` on every option except the
 * first (see Segmented.module.css). Reduced-motion inherited from the
 * global `--duration-*` override in tokens.css — no per-component media
 * block needed.
 *
 * Authority:
 *   - DISCOVERY.md DR5 (palette) + DR9 (CellSizePicker bucket semantics).
 *   - `custom-param-components` skill § 3.2 — Segmented contract.
 *   - `design-tokens-dark-palette` skill — token names.
 *   - Synergy-fix CRITICAL-04 / HIGH-01 — `value: V | undefined` so the
 *     consumer (CellSizePicker) can render "no bucket" when a modulated
 *     numeric value lies between two buckets.
 *
 * a11y: role=radiogroup with `aria-label`; each option is role=radio with
 * `aria-checked`. Roving tabindex: only the currently-selected option has
 * `tabIndex=0`; others `tabIndex=-1`. When no value is selected (`value`
 * is `undefined`), the FIRST option carries tabIndex=0 so keyboard users
 * can still enter the group. ArrowLeft/ArrowUp cycles previous, ArrowRight
 * /ArrowDown cycles next (both with wrap-around), Home / End jump to first
 * / last. Focus is moved imperatively to the newly-selected radio so the
 * roving tabindex stays aligned with the user's focus.
 */

import { type JSX, type KeyboardEvent, useCallback, useId, useRef } from 'react';
import styles from './Segmented.module.css';

export type SegmentedOption<V extends string | number> = {
  value: V;
  label: string;
  testid?: string;
};

export type SegmentedProps<V extends string | number> = {
  /** Options to render. Typically 2, 3, or 5 items. */
  options: ReadonlyArray<SegmentedOption<V>>;
  /**
   * Currently-selected value. `undefined` renders no visible selection —
   * used by CellSizePicker when a modulated numeric value lies between
   * two buckets (synergy-fix HIGH-01).
   */
  value: V | undefined;
  /** Fires when the user selects a new option (click or keyboard). */
  onChange: (next: V) => void;
  /** Required radiogroup name for screen readers. */
  ariaLabel: string;
  /** Optional native `<input name>`. Defaults to a stable `useId()` value. */
  name?: string;
  /** Override the default `data-testid` (default: `segmented`). */
  testid?: string;
  /** Disables all interaction when true. */
  disabled?: boolean;
};

export function Segmented<V extends string | number>(props: SegmentedProps<V>): JSX.Element {
  const { options, value, onChange, ariaLabel, name, testid, disabled = false } = props;

  const reactId = useId();
  const groupName = name ?? reactId;
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const selectedIdx = options.findIndex((o) => o.value === value);

  const focusOption = useCallback((idx: number): void => {
    const el = inputRefs.current[idx];
    if (el !== null && el !== undefined) {
      el.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (disabled) return;
      if (options.length === 0) return;
      // When no value is selected, treat current index as -1; ArrowRight
      // then lands on index 0, ArrowLeft on the last item.
      const currentIdx = selectedIdx;
      let nextIdx: number;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextIdx =
          currentIdx < 0 ? options.length - 1 : (currentIdx - 1 + options.length) % options.length;
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % options.length;
      } else if (e.key === 'Home') {
        nextIdx = 0;
      } else if (e.key === 'End') {
        nextIdx = options.length - 1;
      } else {
        return;
      }
      e.preventDefault();
      const nextOption = options[nextIdx];
      if (nextOption !== undefined) {
        onChange(nextOption.value);
        focusOption(nextIdx);
      }
    },
    [disabled, focusOption, onChange, options, selectedIdx],
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
      data-testid={testid ?? 'segmented'}
      className={styles.root}
      onKeyDown={handleKeyDown}
    >
      {options.map((opt, i) => {
        const id = `${reactId}-${i}`;
        const checked = opt.value === value;
        // Roving tabindex: only one input is in the tab order at a time.
        // If nothing is selected, the first option receives tabIndex=0 so
        // the group is still keyboard-reachable (WAI-ARIA APG radiogroup).
        const tabIndex = checked || (selectedIdx < 0 && i === 0) ? 0 : -1;
        return (
          <label key={String(opt.value)} htmlFor={id} className={styles.item}>
            <input
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="radio"
              id={id}
              name={groupName}
              value={String(opt.value)}
              checked={checked}
              onChange={() => {
                if (!disabled) onChange(opt.value);
              }}
              className={styles.input}
              tabIndex={tabIndex}
              data-testid={opt.testid ?? `segmented-option-${String(opt.value)}`}
              disabled={disabled}
              aria-checked={checked}
            />
            <span className={styles.label}>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
