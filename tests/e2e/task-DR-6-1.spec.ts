/**
 * Task DR-6.1 — Design tokens (CSS custom properties) E2E.
 *
 * Asserts the browser actually resolves the `:root { --… }` declarations
 * the app ships with. This is the L4 gate that `tokens.css` is imported
 * early enough for `getComputedStyle(document.documentElement)` to see
 * the values — and that `html` picks up `--color-bg`.
 *
 * Robustness note: Vite 8 uses LightningCSS to minify production CSS,
 * which normalises `#AABBCC` hex → lowercase, collapses `#333333` →
 * `#333`, and rewrites `2.0rem` → `2rem`. We therefore assert on the
 * *resolved* value by asking the browser to compute a derived color
 * (which yields a canonical `rgb(r, g, b)` regardless of source hex
 * casing / shortening) and by trimming numeric whitespace where
 * applicable.
 *
 * Describe block prefix MUST match `Task DR-6.1:` so
 * `pnpm test:e2e --grep "Task DR-6.1:"` resolves these tests only.
 */

import { expect, test } from '@playwright/test';

// Resolve a CSS custom property to a canonical `rgb(r, g, b)` string by
// parking it on a throwaway element and reading the browser's computed
// color. Normalises past any case / short-hex differences introduced by
// LightningCSS.
async function resolveColorVar(
  page: import('@playwright/test').Page,
  varName: string,
): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return rgb;
  }, varName);
}

test.describe('Task DR-6.1: design tokens expose palette + scale', () => {
  test('computed --* color tokens resolve to the DR5 palette', async ({ page }) => {
    await page.goto('/');

    // Wait until the hidden camera-state indicator mounts — proves the
    // React tree + CSS have loaded. tokens.css is imported by index.css
    // which is imported by App.tsx; by the time <main class="app-shell">
    // is in the DOM, :root custom properties are resolvable.
    await expect(page.getByTestId('camera-state')).toBeAttached({ timeout: 30_000 });

    // Resolve every color-* token we care about through the browser so
    // the assertions are immune to minifier hex-case / hex-shortening.
    const colors = {
      bg: await resolveColorVar(page, '--color-bg'),
      stageBg: await resolveColorVar(page, '--color-stage-bg'),
      panel: await resolveColorVar(page, '--color-panel'),
      divider: await resolveColorVar(page, '--color-divider'),
      textPrimary: await resolveColorVar(page, '--color-text-primary'),
      textMuted: await resolveColorVar(page, '--color-text-muted'),
      accentRecord: await resolveColorVar(page, '--color-accent-record'),
      focusRing: await resolveColorVar(page, '--color-focus-ring'),
      secondaryBg: await resolveColorVar(page, '--color-button-secondary-bg'),
      secondaryBgHover: await resolveColorVar(page, '--color-button-secondary-bg-hover'),
    };

    // All values derived from DR5. Chrome serialises as `rgb(r, g, b)`.
    expect(colors.bg).toBe('rgb(10, 10, 11)'); // #0A0A0B
    expect(colors.stageBg).toBe('rgb(0, 0, 0)'); // #000000
    expect(colors.panel).toBe('rgb(21, 21, 21)'); // #151515
    expect(colors.divider).toBe('rgb(31, 31, 31)'); // #1F1F1F
    expect(colors.textPrimary).toBe('rgb(234, 234, 234)'); // #EAEAEA
    expect(colors.textMuted).toBe('rgb(143, 143, 143)'); // #8F8F8F
    expect(colors.accentRecord).toBe('rgb(210, 48, 48)'); // #D23030
    expect(colors.focusRing).toBe('rgb(106, 169, 255)'); // #6AA9FF
    expect(colors.secondaryBg).toBe('rgb(42, 42, 42)'); // #2A2A2A
    expect(colors.secondaryBgHover).toBe('rgb(51, 51, 51)'); // #333333
  });

  test('computed scale tokens (space / type / radius / motion) match intent', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toBeAttached({ timeout: 30_000 });

    const values = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        space20: cs.getPropertyValue('--space-20').trim(),
        space24: cs.getPropertyValue('--space-24').trim(),
        fontFamily: cs.getPropertyValue('--font-family').trim(),
        fontSizeM: cs.getPropertyValue('--font-size-m').trim(),
        fontSizeRoot: cs.getPropertyValue('--font-size-root').trim(),
        radiusPill: cs.getPropertyValue('--radius-pill').trim(),
        radiusCircle: cs.getPropertyValue('--radius-circle').trim(),
        durationShort: cs.getPropertyValue('--duration-short').trim(),
        durationMedium: cs.getPropertyValue('--duration-medium').trim(),
        easeSpring: cs.getPropertyValue('--ease-spring').trim(),
        easeDefault: cs.getPropertyValue('--ease-default').trim(),
      };
    });

    // LightningCSS minification: 2.0rem → 2rem, 0.2s → .2s, etc. Parse
    // numerics where the unit might vary in text form.
    const remValue = (raw: string): number => {
      expect(raw).toMatch(/rem$/);
      return Number.parseFloat(raw);
    };
    const secValue = (raw: string): number => {
      expect(raw).toMatch(/s$/);
      return Number.parseFloat(raw);
    };

    expect(remValue(values.space20)).toBeCloseTo(2.0, 3);
    expect(remValue(values.space24)).toBeCloseTo(2.4, 3);
    expect(remValue(values.radiusPill)).toBeCloseTo(2.2, 3);
    expect(values.radiusCircle).toBe('50%');

    expect(values.fontFamily).toContain('JetBrains Mono');
    expect(values.fontFamily.toLowerCase()).toContain('monospace');
    expect(remValue(values.fontSizeM)).toBeCloseTo(1.3, 3);
    expect(values.fontSizeRoot.replace(/\s+/g, '').toLowerCase()).toContain('clamp(');

    expect(secValue(values.durationShort)).toBeCloseTo(0.2, 3);
    expect(secValue(values.durationMedium)).toBeCloseTo(0.35, 3);

    // Normalise whitespace — LightningCSS may drop spaces inside cubic-bezier().
    const normaliseBezier = (s: string): string => s.replace(/\s+/g, '');
    expect(normaliseBezier(values.easeSpring)).toBe('cubic-bezier(.47,0,.23,1.38)');
    expect(normaliseBezier(values.easeDefault)).toBe('cubic-bezier(.4,0,.2,1)');
  });

  test('html background-color resolves via --color-bg (DR5 #0A0A0B)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toBeAttached({ timeout: 30_000 });

    const bg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).backgroundColor;
    });
    // Chrome serialises hex colors as rgb(r, g, b). #0A0A0B → rgb(10, 10, 11).
    expect(bg).toBe('rgb(10, 10, 11)');
  });
});
