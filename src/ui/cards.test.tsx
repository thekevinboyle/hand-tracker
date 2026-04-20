/**
 * src/ui/cards.test.tsx — Level-2 unit tests for the DR-8.4 restyled cards.
 *
 * Scope:
 *   - DOM structure: both the PrePromptCard and ErrorStates root elements
 *     carry BOTH `.card` and `.card-panel` classes (HIGH-07 co-class pattern —
 *     no new wrapper <div> was introduced).
 *   - Divider presence: `<hr class="card-divider" />` sits between title
 *     and body (DR14).
 *   - Retry button: rendered with the `.card-retry` class so the
 *     token-driven secondary-button styling applies.
 *   - Token references: cards.css contains NO hex literals; colors come
 *     exclusively from `var(--color-*)` tokens. (LightningCSS-resolved
 *     colors are not observable through `getComputedStyle` in jsdom — the
 *     gotcha calls this out — so we assert on the CSS source text.)
 *   - Font family: `--font-family` is applied to the card root — verified
 *     by reading cards.css and confirming the rule references it.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorStates } from './ErrorStates';
import { PrePromptCard } from './PrePromptCard';

const CSS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), './cards.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

describe('cards.css — token-only styling (DR-8.4)', () => {
  it('contains no hex literals (tokens-only invariant)', () => {
    // Strip comments before scanning so only CSS property values are checked.
    const stripped = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const hexes = stripped.match(/#[0-9a-fA-F]{3,8}\b/g);
    expect(hexes, `Hex literals found in cards.css: ${hexes?.join(', ')}`).toBeNull();
  });

  it('.card root references --color-bg + --font-family tokens', () => {
    // Outer fullscreen container pulls the PAGE bg token and the root
    // font family so inner content inherits JetBrains Mono.
    expect(CSS).toMatch(/\.card\s*\{[^}]*background:\s*var\(--color-bg\)/);
    expect(CSS).toMatch(/\.card\s*\{[^}]*font-family:\s*var\(--font-family\)/);
  });

  it('.card-panel co-class paints the --color-panel surface', () => {
    // The panel styling is applied as a co-class on `.card` itself (HIGH-07).
    expect(CSS).toMatch(/\.card\.card-panel[^{]*\{[^}]*background:\s*var\(--color-panel\)/);
  });

  it('.card-divider is a hairline using --color-divider', () => {
    expect(CSS).toMatch(
      /\.card-divider\s*\{[^}]*border-top:\s*1px\s+solid\s+var\(--color-divider\)/,
    );
  });

  it('.card-retry animates border-radius square→pill on hover (DR11)', () => {
    // At rest the button sits at radius-0; on hover it goes to radius-pill.
    expect(CSS).toMatch(/\.card-retry\s*\{[^}]*border-radius:\s*var\(--radius-0\)/);
    expect(CSS).toMatch(/\.card-retry:hover\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/);
    // Transition declaration references the duration-short token so the
    // prefers-reduced-motion :root override collapses it to 0s.
    expect(CSS).toMatch(/\.card-retry\s*\{[^}]*transition:[^;]*var\(--duration-short\)/);
  });
});

describe('PrePromptCard (DR-8.4)', () => {
  it('root element carries both .card and .card-panel co-classes (HIGH-07 — no new wrapper div)', () => {
    render(<PrePromptCard onAllow={() => {}} />);
    const root = screen.getByTestId('error-state-card-PROMPT');
    expect(root).toHaveClass('card');
    expect(root).toHaveClass('card-panel');
  });

  it('renders <hr class="card-divider" /> between title and body', () => {
    render(<PrePromptCard onAllow={() => {}} />);
    const root = screen.getByTestId('error-state-card-PROMPT');
    const title = root.querySelector('.card-title');
    const divider = root.querySelector('hr.card-divider');
    const body = root.querySelector('.card-body');
    expect(title).not.toBeNull();
    expect(divider).not.toBeNull();
    expect(body).not.toBeNull();
    // DOM order: title, divider, body.
    const kids = Array.from(root.children);
    const iTitle = kids.indexOf(title as HTMLElement);
    const iDivider = kids.indexOf(divider as HTMLElement);
    const iBody = kids.indexOf(body as HTMLElement);
    expect(iTitle).toBeLessThan(iDivider);
    expect(iDivider).toBeLessThan(iBody);
  });

  it('retry button uses the .card-retry class (secondary-button tokens apply)', () => {
    render(<PrePromptCard onAllow={() => {}} />);
    const btn = screen.getByRole('button', { name: /enable camera/i });
    expect(btn).toHaveClass('card-retry');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('preserves role="dialog" + aria-live + aria-labelledby + testid (DR14 structural invariant)', () => {
    render(<PrePromptCard onAllow={() => {}} />);
    const root = screen.getByTestId('error-state-card-PROMPT');
    expect(root).toHaveAttribute('role', 'dialog');
    expect(root).toHaveAttribute('aria-live', 'polite');
    expect(root).toHaveAttribute('aria-labelledby', 'prp-title');
  });
});

describe('ErrorStates (DR-8.4)', () => {
  it('USER_DENIED: root carries both .card and .card-panel co-classes', () => {
    render(<ErrorStates state="USER_DENIED" onRetry={() => {}} />);
    const root = screen.getByTestId('error-state-card-USER_DENIED');
    expect(root).toHaveClass('card');
    expect(root).toHaveClass('card-panel');
  });

  it('USER_DENIED: renders divider + preserves role="alert"', () => {
    render(<ErrorStates state="USER_DENIED" onRetry={() => {}} />);
    const root = screen.getByTestId('error-state-card-USER_DENIED');
    expect(root.querySelector('hr.card-divider')).not.toBeNull();
    expect(root).toHaveAttribute('role', 'alert');
  });

  it('NO_WEBGL (terminal, no retry): still renders divider between title and body', () => {
    render(<ErrorStates state="NO_WEBGL" onRetry={() => {}} />);
    const root = screen.getByTestId('error-state-card-NO_WEBGL');
    expect(root.querySelector('hr.card-divider')).not.toBeNull();
    // No retry button for terminal state (contract preserved).
    expect(root.querySelector('.card-retry')).toBeNull();
  });
});
