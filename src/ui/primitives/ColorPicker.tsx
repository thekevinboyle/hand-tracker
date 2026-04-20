/*
 * src/ui/primitives/ColorPicker.tsx — ColorPicker primitive (Task DR-7.5).
 *
 * Pairs a 20×20 native `<input type="color">` swatch with a borderless
 * uppercase hex text input. Both edit the same controlled hex value.
 *
 *   - Text input is the DRAFT: local state updates on every keystroke,
 *     commit only on blur / Enter. Invalid hex silently reverts to the
 *     last committed `value` (no red outline, no error UI — pixelcrash
 *     silence per research § Components > 8).
 *   - Native color input always returns a valid 7-char lowercase hex;
 *     its `change` fires `onChange` directly.
 *   - `value` prop is canonical `#rrggbb` (lowercase — manifest form).
 *     The draft is stored UPPERCASE for display continuity (even though
 *     CSS `text-transform: uppercase` would also handle it visually,
 *     keeping the raw state uppercase makes assertions deterministic).
 *   - `onChange` always receives lowercase 7-char hex.
 *
 * `normalizeHex` is exported for direct unit testing. It trims whitespace,
 * accepts leading `#` optional, rejects 3-char shorthand (manifest uses
 * 6-char exclusively), returns lowercase `#rrggbb` or `null`.
 *
 * Reduced-motion: handled at the token level in tokens.css — no per-
 * component media block.
 *
 * Authority:
 *   - task-DR-7-5.md
 *   - `custom-param-components` skill § 3.5 — ColorPicker contract
 *   - `design-tokens-dark-palette` skill — token names
 *   - DISCOVERY DR5 (palette) + DR11 (motion)
 */

import {
  type ChangeEvent,
  type FocusEvent,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useState,
} from 'react';
import styles from './ColorPicker.module.css';

export type ColorPickerProps = {
  /** Current hex, canonical lowercase `#rrggbb`. */
  value: string;
  /** Fired with canonical lowercase `#rrggbb` — only on valid commits. */
  onChange: (next: string) => void;
  /** REQUIRED label for screen readers (applied to both inputs). */
  ariaLabel: string;
  /** Disables both the swatch and the text input. */
  disabled?: boolean;
  /** Override the default `data-testid` (default: `color-picker`). */
  testid?: string;
};

/**
 * Normalize a user-entered hex string to canonical `#rrggbb` (lowercase, 7 chars).
 * Accepts leading `#` optional and trims surrounding whitespace.
 * Rejects 3-char shorthand — manifest values are always 6-char hex
 * (e.g. `#00ff88`). Returns `null` on invalid input rather than throwing,
 * so callers can silently revert without try/catch noise.
 */
export function normalizeHex(input: string): string | null {
  const trimmed = input.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(withHash)) return null;
  return withHash.toLowerCase();
}

export function ColorPicker(props: ColorPickerProps): JSX.Element {
  const { value, onChange, ariaLabel, disabled = false, testid } = props;
  const rootTestid = testid ?? 'color-picker';

  // Draft is what's in the text input. Stored uppercase for display continuity.
  const [draft, setDraft] = useState<string>(value.toUpperCase());

  // Resync the draft when `value` changes from outside (e.g. preset load).
  useEffect(() => {
    setDraft(value.toUpperCase());
  }, [value]);

  const commit = (): void => {
    const normalized = normalizeHex(draft);
    if (normalized === null) {
      // Silent reject — revert to the current valid value.
      setDraft(value.toUpperCase());
      return;
    }
    if (normalized !== value) {
      onChange(normalized);
    }
    // Always sync draft to normalized-uppercase form so visible text matches.
    setDraft(normalized.toUpperCase());
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setDraft(e.currentTarget.value);
  };

  const handleTextBlur = (_e: FocusEvent<HTMLInputElement>): void => {
    commit();
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Run the same commit path as blur. We could call blur() here to lean
      // on the onBlur handler, but jsdom does not reliably fire React's
      // synthetic onBlur from programmatic .blur(), so we invoke commit()
      // directly. In a real browser this is equivalent — both paths trim
      // the draft and either fire onChange or revert.
      commit();
    }
  };

  const handleSwatchChange = (e: ChangeEvent<HTMLInputElement>): void => {
    // Native color input always returns a valid 7-char lowercase hex.
    const next = e.currentTarget.value.toLowerCase();
    if (next !== value) {
      onChange(next);
    }
    setDraft(next.toUpperCase());
  };

  return (
    <div className={styles.root} data-testid={rootTestid}>
      <input
        type="text"
        className={styles.text}
        value={draft}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={`${ariaLabel} hex`}
        spellCheck={false}
        autoComplete="off"
        maxLength={7}
        data-testid={`${rootTestid}-text`}
      />
      <input
        type="color"
        className={styles.swatch}
        value={value.toLowerCase()}
        onChange={handleSwatchChange}
        disabled={disabled}
        aria-label={ariaLabel}
        data-testid={`${rootTestid}-swatch`}
      />
    </div>
  );
}
