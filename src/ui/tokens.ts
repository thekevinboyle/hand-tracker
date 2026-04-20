/**
 * src/ui/tokens.ts — TypeScript mirror of src/ui/tokens.css (Task DR-6.1).
 *
 * Hand-maintained in sync with tokens.css. The CSS file is the source of
 * truth at render time; this module exists for TypeScript consumers that
 * need raw token values (Canvas 2D overlay colors, inline styles during
 * font-load, test assertions). Prefer `var(--key)` via CSS first — only
 * import from here when CSS cannot reach.
 *
 * Authority: `.claude/orchestration-design-rework/DISCOVERY.md` DR5 / DR7 /
 * DR11 / DR12. If a value here disagrees with tokens.css, tokens.css wins
 * at render time — keep them hand-synced.
 *
 * Do NOT rename keys to camelCase — kebab-cased keys match CSS custom
 * property names verbatim so `cssVar('color-bg')` and a grep for
 * `color-bg` both resolve predictably.
 */

export type TokenKey =
  // Color — surfaces
  | 'color-bg'
  | 'color-stage-bg'
  | 'color-panel'
  | 'color-divider'
  // Color — text
  | 'color-text-primary'
  | 'color-text-muted'
  | 'color-text-disabled'
  // Color — buttons
  | 'color-button-primary-bg'
  | 'color-button-primary-text'
  | 'color-button-secondary-bg'
  | 'color-button-secondary-bg-hover'
  // Color — segmented / toggle / slider
  | 'color-segmented-unselected'
  | 'color-segmented-selected'
  | 'color-toggle-on'
  | 'color-toggle-off'
  | 'color-slider-track'
  | 'color-slider-active'
  | 'color-slider-handle'
  | 'color-slider-hover'
  // Color — accents
  | 'color-accent-record'
  | 'color-focus-ring'
  // Spacing
  | 'space-01'
  | 'space-02'
  | 'space-04'
  | 'space-06'
  | 'space-08'
  | 'space-10'
  | 'space-12'
  | 'space-16'
  | 'space-20'
  | 'space-24'
  | 'space-32'
  | 'space-44'
  | 'space-56'
  // Type
  | 'font-family'
  | 'font-size-root'
  | 'font-size-xs'
  | 'font-size-s'
  | 'font-size-m'
  | 'font-size-l'
  | 'font-size-xl'
  | 'font-weight-regular'
  | 'font-weight-medium'
  | 'font-weight-semibold'
  | 'line-height-body'
  | 'letter-spacing-body'
  // Radius
  | 'radius-0'
  | 'radius-pill'
  | 'radius-circle'
  // Motion
  | 'duration-fast'
  | 'duration-short'
  | 'duration-medium'
  | 'duration-long'
  | 'ease-default'
  | 'ease-spring';

export type Tokens = Record<TokenKey, string>;

export const tokens = {
  // Color — surfaces
  'color-bg': '#0A0A0B',
  'color-stage-bg': '#000000',
  'color-panel': '#151515',
  'color-divider': '#1F1F1F',
  // Color — text
  'color-text-primary': '#EAEAEA',
  'color-text-muted': '#8F8F8F',
  'color-text-disabled': '#6F6F6F',
  // Color — buttons
  'color-button-primary-bg': '#EAEAEA',
  'color-button-primary-text': '#0A0A0B',
  'color-button-secondary-bg': '#2A2A2A',
  'color-button-secondary-bg-hover': '#333333',
  // Color — segmented / toggle / slider
  'color-segmented-unselected': '#6F6F6F',
  'color-segmented-selected': '#EAEAEA',
  'color-toggle-on': '#EAEAEA',
  'color-toggle-off': '#4A4A4A',
  'color-slider-track': '#2A2A2A',
  'color-slider-active': '#EAEAEA',
  'color-slider-handle': '#EAEAEA',
  'color-slider-hover': '#CFCFCF',
  // Color — accents
  'color-accent-record': '#D23030',
  'color-focus-ring': '#6AA9FF',
  // Spacing
  'space-01': '0.1rem',
  'space-02': '0.2rem',
  'space-04': '0.4rem',
  'space-06': '0.6rem',
  'space-08': '0.8rem',
  'space-10': '1.0rem',
  'space-12': '1.2rem',
  'space-16': '1.6rem',
  'space-20': '2.0rem',
  'space-24': '2.4rem',
  'space-32': '3.2rem',
  'space-44': '4.4rem',
  'space-56': '5.6rem',
  // Type
  'font-family': "'JetBrains Mono', ui-monospace, Menlo, monospace",
  'font-size-root': 'clamp(13px, 0.9vw, 16px)',
  'font-size-xs': '1.15rem',
  'font-size-s': '1.2rem',
  'font-size-m': '1.3rem',
  'font-size-l': '1.5rem',
  'font-size-xl': '2rem',
  'font-weight-regular': '400',
  'font-weight-medium': '500',
  'font-weight-semibold': '600',
  'line-height-body': '1.4',
  'letter-spacing-body': '-0.01em',
  // Radius
  'radius-0': '0',
  'radius-pill': '2.2rem',
  'radius-circle': '50%',
  // Motion
  'duration-fast': '0.1s',
  'duration-short': '0.2s',
  'duration-medium': '0.35s',
  'duration-long': '0.5s',
  'ease-default': 'cubic-bezier(0.4, 0, 0.2, 1)',
  'ease-spring': 'cubic-bezier(0.47, 0, 0.23, 1.38)',
} as const satisfies Tokens;

/**
 * Typed helper for inline-style consumers:
 *   style={{ color: cssVar('color-text-primary') }}
 * Preferred over hardcoded `var(--color-…)` strings at call sites —
 * lets TypeScript catch a typo that would otherwise silently yield an
 * unresolved custom property.
 */
export function cssVar(key: TokenKey): string {
  return `var(--${key})`;
}
