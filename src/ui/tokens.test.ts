/**
 * src/ui/tokens.test.ts — Level-2 unit tests for the DR-6.1 token system.
 *
 * Asserts:
 *   1. Every TokenKey is present on the exported `tokens` record.
 *   2. Every color-* token is a valid 6-digit uppercase hex string.
 *   3. Every space-* token is a finite `rem` value.
 *   4. Every duration-* token is a finite `s` value.
 *   5. `cssVar(key)` returns `'var(--' + key + ')'` verbatim.
 *   6. tokens.css re-exports parity — every `--<name>:` declaration in
 *      tokens.css is mirrored by a key in `tokens`, and vice versa.
 *   7. The `prefers-reduced-motion: reduce` override block collapses
 *      every `--duration-*` to `0s` (DR11 + parent D26).
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cssVar, type TokenKey, tokens } from './tokens';

// Read tokens.css at test time via the file system. `@types/node` is a
// dev-dependency wired into `tsconfig.app.json#types` so the production
// `tsc` pass (part of `pnpm build`) also typechecks this file. Vitest runs
// under Node — `node:fs` is always available here — and the file is never
// imported by app code, so this does not pull Node APIs into the bundle.
const CSS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), './tokens.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

const ALL_KEYS: TokenKey[] = [
  // Color — surfaces
  'color-bg',
  'color-stage-bg',
  'color-panel',
  'color-divider',
  // Color — text
  'color-text-primary',
  'color-text-muted',
  'color-text-disabled',
  // Color — buttons
  'color-button-primary-bg',
  'color-button-primary-text',
  'color-button-secondary-bg',
  'color-button-secondary-bg-hover',
  // Color — segmented / toggle / slider
  'color-segmented-unselected',
  'color-segmented-selected',
  'color-toggle-on',
  'color-toggle-off',
  'color-slider-track',
  'color-slider-active',
  'color-slider-handle',
  'color-slider-hover',
  // Color — accents
  'color-accent-record',
  'color-focus-ring',
  // Spacing
  'space-01',
  'space-02',
  'space-04',
  'space-06',
  'space-08',
  'space-10',
  'space-12',
  'space-16',
  'space-20',
  'space-24',
  'space-32',
  'space-44',
  'space-56',
  // Type
  'font-family',
  'font-size-root',
  'font-size-xs',
  'font-size-s',
  'font-size-m',
  'font-size-l',
  'font-size-xl',
  'font-weight-regular',
  'font-weight-medium',
  'font-weight-semibold',
  'line-height-body',
  'letter-spacing-body',
  // Radius
  'radius-0',
  'radius-pill',
  'radius-circle',
  // Motion
  'duration-fast',
  'duration-short',
  'duration-medium',
  'duration-long',
  'ease-default',
  'ease-spring',
];

describe('tokens — shape + presence', () => {
  it('exports every TokenKey as a non-empty string', () => {
    for (const key of ALL_KEYS) {
      expect(tokens[key], `tokens['${key}'] should be defined`).toBeDefined();
      expect(typeof tokens[key]).toBe('string');
      expect(tokens[key].length).toBeGreaterThan(0);
    }
  });

  it('does not leak any stray keys beyond TokenKey', () => {
    const keys = Object.keys(tokens).sort();
    const expected = [...ALL_KEYS].sort();
    expect(keys).toEqual(expected);
  });

  it('declares at least 30 tokens (DR-6.1 floor)', () => {
    expect(Object.keys(tokens).length).toBeGreaterThanOrEqual(30);
  });
});

describe('tokens — color shape (DR5)', () => {
  const colorKeys = ALL_KEYS.filter((k) => k.startsWith('color-'));

  it('defines at least 16 color roles', () => {
    expect(colorKeys.length).toBeGreaterThanOrEqual(16);
  });

  it.each(colorKeys)('%s is a 6-digit uppercase hex', (key) => {
    // Every color token currently uses the `#AABBCC` form. If a future
    // token introduces transparency we'll widen this; for now the strict
    // form keeps the codebase predictable under grep.
    expect(tokens[key]).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('tokens — spacing shape', () => {
  const spaceKeys = ALL_KEYS.filter((k) => k.startsWith('space-'));

  it('defines at least 10 spacing steps', () => {
    expect(spaceKeys.length).toBeGreaterThanOrEqual(10);
  });

  it.each(spaceKeys)('%s parses as a finite rem value', (key) => {
    const raw = tokens[key];
    expect(raw).toMatch(/^\d+(?:\.\d+)?rem$/);
    const num = Number.parseFloat(raw);
    expect(Number.isFinite(num)).toBe(true);
    expect(num).toBeGreaterThan(0);
  });
});

describe('tokens — type scale', () => {
  it('defines at least 5 font-size steps', () => {
    const sizeKeys = ALL_KEYS.filter((k) => k.startsWith('font-size-') && k !== 'font-size-root');
    expect(sizeKeys.length).toBeGreaterThanOrEqual(5);
  });

  it('root font-size uses a clamp() for fluid type', () => {
    expect(tokens['font-size-root']).toMatch(/^clamp\(.+\)$/);
    expect(tokens['font-size-root']).toContain('13px');
    expect(tokens['font-size-root']).toContain('16px');
  });

  it('font-weight-* tokens are plain integer strings', () => {
    expect(tokens['font-weight-regular']).toBe('400');
    expect(tokens['font-weight-medium']).toBe('500');
    expect(tokens['font-weight-semibold']).toBe('600');
  });

  it('font-family references JetBrains Mono + fallback chain', () => {
    // DR-6.2 will supply the @font-face; here we only assert the CSS
    // string references the intended primary + safe fallback.
    expect(tokens['font-family']).toContain('JetBrains Mono');
    expect(tokens['font-family']).toContain('monospace');
  });
});

describe('tokens — radius', () => {
  it('defines at least 3 radius roles', () => {
    const radiusKeys = ALL_KEYS.filter((k) => k.startsWith('radius-'));
    expect(radiusKeys.length).toBeGreaterThanOrEqual(3);
  });

  it('radius-0 is the literal 0 (no unit — spec-compliant)', () => {
    expect(tokens['radius-0']).toBe('0');
  });

  it('radius-circle is 50%', () => {
    expect(tokens['radius-circle']).toBe('50%');
  });
});

describe('tokens — motion (DR11)', () => {
  const durKeys = ALL_KEYS.filter((k) => k.startsWith('duration-'));

  it('defines at least 3 duration steps', () => {
    expect(durKeys.length).toBeGreaterThanOrEqual(3);
  });

  it.each(durKeys)('%s parses as a finite seconds value', (key) => {
    const raw = tokens[key];
    expect(raw).toMatch(/^\d+(?:\.\d+)?s$/);
    expect(Number.isFinite(Number.parseFloat(raw))).toBe(true);
  });

  it('defines at least 2 easing curves including the DR11 spring', () => {
    const easeKeys = ALL_KEYS.filter((k) => k.startsWith('ease-'));
    expect(easeKeys.length).toBeGreaterThanOrEqual(2);
    expect(tokens['ease-default']).toMatch(/^cubic-bezier\(.+\)$/);
    expect(tokens['ease-spring']).toBe('cubic-bezier(0.47, 0, 0.23, 1.38)');
  });
});

describe('cssVar()', () => {
  it('wraps a key in the CSS var() form', () => {
    expect(cssVar('color-bg')).toBe('var(--color-bg)');
    expect(cssVar('space-20')).toBe('var(--space-20)');
    expect(cssVar('ease-spring')).toBe('var(--ease-spring)');
  });
});

describe('tokens.css ↔ tokens.ts parity', () => {
  // Scan tokens.css for `--<name>:` declarations (top-level :root block).
  // Duration overrides inside the `prefers-reduced-motion` block redeclare
  // existing keys — `new Set` dedupes them.
  const cssNames = new Set([...CSS.matchAll(/^\s*--([a-z0-9-]+)\s*:/gm)].map((m) => m[1] ?? ''));

  it('every token in tokens.ts is declared in tokens.css', () => {
    const missing = Object.keys(tokens).filter((k) => !cssNames.has(k));
    expect(missing, `missing from tokens.css: ${missing.join(', ')}`).toEqual([]);
  });

  it('every --* declared in tokens.css is mirrored in tokens.ts', () => {
    const tsKeys = new Set(Object.keys(tokens));
    const missing = [...cssNames].filter((n) => !tsKeys.has(n));
    expect(missing, `missing from tokens.ts: ${missing.join(', ')}`).toEqual([]);
  });

  it('declares a prefers-reduced-motion override that zeroes duration-*', () => {
    expect(CSS).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(CSS).toMatch(/--duration-fast:\s*0s/);
    expect(CSS).toMatch(/--duration-short:\s*0s/);
    expect(CSS).toMatch(/--duration-medium:\s*0s/);
    expect(CSS).toMatch(/--duration-long:\s*0s/);
  });
});
