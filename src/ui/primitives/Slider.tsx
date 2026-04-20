/*
 * src/ui/primitives/Slider.tsx — Slider + RangeSlider primitives (Task DR-7.3).
 *
 * Two related controls in one file:
 *   - <Slider>      : single-thumb, value: number
 *   - <RangeSlider> : two-thumb non-crossing, value: readonly [lo, hi]
 *
 * Visual contract:
 *   - Hairline track (2px, --space-02) in --color-slider-track
 *   - Active-range fill in --color-slider-active (between 0..value for single,
 *     between lo..hi for range)
 *   - Thumb is a THIN VERTICAL LINE (2 × 16 px, --space-02 × --space-16) in
 *     --color-slider-handle — NOT a circle
 *   - Expanded touch-area = 32 × 32 px (--space-32 tall × 100% wide root).
 *     Interaction rides on an invisible <input type="range"> overlay with
 *     `opacity: 0; inset: 0`, so the native a11y / keyboard / pointer drag
 *     behavior is inherited for free.
 *
 * Keyboard:
 *   - Arrow keys ±step (native)
 *   - Home / End → min / max (native)
 *   - PageUp / PageDown → ±10 × step (overridden — native defaults to ~10%
 *     of the total range, not 10× step)
 *
 * RangeSlider non-crossing: enforced at the native-input level via
 * `max={hi - step}` on the lo-input and `min={lo + step}` on the hi-input,
 * so the native drag cannot push past the other thumb.
 *
 * Authority:
 *   - task-DR-7-3.md (prop API, test count ≥ 15, touch-area size)
 *   - DISCOVERY DR11 (motion) + DR5 (palette)
 *   - `custom-param-components` skill § 3.3 — Slider contract
 *   - `design-tokens-dark-palette` skill — token names
 */

import { type JSX, type KeyboardEvent as ReactKeyboardEvent, useCallback, useId } from 'react';
import styles from './Slider.module.css';

/* ──────────────────────────────────────────────────────────────
 * Shared math helpers — exported for unit testing.
 * ────────────────────────────────────────────────────────────── */

/** Map a numeric value to a 0..1 proportion along [min, max], clamped. */
export function toProportion(v: number, min: number, max: number): number {
  if (max <= min) return 0;
  const p = (v - min) / (max - min);
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * Map an 0..1 proportion back to a stepped value in [min, max].
 * Handles float precision for non-integer steps (e.g. 0.01 → prevents
 * 0.9999999) via toFixed(precision) rounded to the step's precision.
 */
export function fromProportion(p: number, min: number, max: number, step: number): number {
  const clampedP = p < 0 ? 0 : p > 1 ? 1 : p;
  const raw = min + (max - min) * clampedP;
  const steps = Math.round((raw - min) / step);
  const stepped = min + steps * step;
  const clamped = stepped < min ? min : stepped > max ? max : stepped;
  // Precision: 0 for integer step; ceil(-log10(step)) for fractional.
  const precision = step < 1 ? Math.max(0, Math.ceil(-Math.log10(step))) : 0;
  return Number.parseFloat(clamped.toFixed(precision));
}

/** Clamp a raw numeric value to [min, max] and snap to the nearest step. */
function clampToStep(v: number, min: number, max: number, step: number): number {
  return fromProportion(toProportion(v, min, max), min, max, step);
}

/* ──────────────────────────────────────────────────────────────
 * <Slider> — single-thumb.
 * ────────────────────────────────────────────────────────────── */

export type SliderProps = {
  min: number;
  max: number;
  /** Manifest `step` — e.g. 1 for integer params, 0.01 for 0..1 floats. */
  step: number;
  value: number;
  onChange: (next: number) => void;
  /** Required a11y label for the underlying <input type="range">. */
  ariaLabel: string;
  disabled?: boolean;
  /** Override the default `data-testid` (default: `slider`). */
  testid?: string;
};

export function Slider(props: SliderProps): JSX.Element {
  const { min, max, step, value, onChange, ariaLabel, disabled = false, testid } = props;

  const reactId = useId();
  const inputId = `${reactId}-input`;
  const rootTestid = testid ?? 'slider';
  const proportion = toProportion(value, min, max);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (disabled) return;
      if (e.key === 'PageUp') {
        e.preventDefault();
        onChange(clampToStep(value + step * 10, min, max, step));
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        onChange(clampToStep(value - step * 10, min, max, step));
      }
      // Arrow/Home/End flow through to the native input's built-in handling.
    },
    [disabled, max, min, onChange, step, value],
  );

  return (
    <div
      className={styles.root}
      data-testid={rootTestid}
      data-disabled={disabled ? 'true' : undefined}
    >
      <div className={styles.track} aria-hidden="true">
        <div className={styles.activeRange} style={{ left: '0%', width: `${proportion * 100}%` }} />
        <div className={styles.thumb} style={{ left: `calc(${proportion * 100}% - 1px)` }} />
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        className={styles.nativeInput}
        onChange={(e) => {
          if (!disabled) onChange(Number(e.currentTarget.value));
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        data-testid={`${rootTestid}-input`}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * <RangeSlider> — two-thumb non-crossing.
 * ────────────────────────────────────────────────────────────── */

export type RangeSliderProps = {
  min: number;
  max: number;
  step: number;
  value: readonly [number, number];
  onChange: (next: readonly [number, number]) => void;
  ariaLabel: string;
  disabled?: boolean;
  /** Override the default `data-testid` (default: `range-slider`). */
  testid?: string;
};

export function RangeSlider(props: RangeSliderProps): JSX.Element {
  const { min, max, step, value, onChange, ariaLabel, disabled = false, testid } = props;
  const [lo, hi] = value;
  const rootTestid = testid ?? 'range-slider';

  const loProp = toProportion(lo, min, max);
  const hiProp = toProportion(hi, min, max);
  // Midpoint between thumbs — used to split pointer hit-areas so each
  // overlay owns its own half and the two <input>s do not fight.
  const midProp = (loProp + hiProp) / 2;

  const handleLoKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (disabled) return;
      if (e.key === 'PageUp') {
        e.preventDefault();
        const next = Math.min(hi - step, clampToStep(lo + step * 10, min, hi - step, step));
        onChange([next, hi]);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        const next = clampToStep(lo - step * 10, min, hi - step, step);
        onChange([next, hi]);
      }
    },
    [disabled, hi, lo, min, onChange, step],
  );

  const handleHiKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (disabled) return;
      if (e.key === 'PageUp') {
        e.preventDefault();
        const next = clampToStep(hi + step * 10, lo + step, max, step);
        onChange([lo, next]);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        const next = Math.max(lo + step, clampToStep(hi - step * 10, lo + step, max, step));
        onChange([lo, next]);
      }
    },
    [disabled, hi, lo, max, onChange, step],
  );

  return (
    <div
      className={styles.root}
      data-testid={rootTestid}
      data-disabled={disabled ? 'true' : undefined}
    >
      <div className={styles.track} aria-hidden="true">
        <div
          className={styles.activeRange}
          style={{ left: `${loProp * 100}%`, width: `${(hiProp - loProp) * 100}%` }}
        />
        <div className={styles.thumb} style={{ left: `calc(${loProp * 100}% - 1px)` }} />
        <div className={styles.thumb} style={{ left: `calc(${hiProp * 100}% - 1px)` }} />
      </div>
      <input
        type="range"
        min={min}
        max={hi - step}
        step={step}
        value={lo}
        aria-label={`${ariaLabel} (lower)`}
        className={styles.nativeInput}
        style={{ right: `${100 - midProp * 100}%` }}
        onChange={(e) => {
          if (!disabled) onChange([Number(e.currentTarget.value), hi]);
        }}
        onKeyDown={handleLoKeyDown}
        disabled={disabled}
        data-testid={`${rootTestid}-input-lo`}
      />
      <input
        type="range"
        min={lo + step}
        max={max}
        step={step}
        value={hi}
        aria-label={`${ariaLabel} (upper)`}
        className={styles.nativeInput}
        style={{ left: `${midProp * 100}%` }}
        onChange={(e) => {
          if (!disabled) onChange([lo, Number(e.currentTarget.value)]);
        }}
        onKeyDown={handleHiKeyDown}
        disabled={disabled}
        data-testid={`${rootTestid}-input-hi`}
      />
    </div>
  );
}
