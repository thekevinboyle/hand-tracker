/**
 * src/ui/fontLoading.test.ts — Level-2 unit tests for DR-6.2 @font-face wiring.
 *
 * Asserts on the raw `tokens.css` source (read via `node:fs`, matching the
 * pattern established by `tokens.test.ts`):
 *
 *   1. Exactly three `@font-face` rules are declared.
 *   2. The three weights (400 / 500 / 600) each appear.
 *   3. `font-display: swap` is present on every block.
 *   4. The three subset woff2 URLs are referenced.
 *   5. The Medium (500) file is the one the preload link in index.html
 *      points at — this pairs with the preload check below.
 *   6. The @font-face block appears BEFORE the `:root { … }` block
 *      (idiomatic ordering per jetbrains-mono-self-hosting §5).
 *   7. index.html references `<link rel="preload"` for the Medium weight
 *      with the mandatory `crossorigin` + `type="font/woff2"` attributes.
 *
 * No jsdom FontFaceSet probing — jsdom's `document.fonts` implementation is
 * incomplete. A text-search on the CSS/HTML sources is the robust L2 check.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS_PATH = resolve(HERE, './tokens.css');
const INDEX_HTML_PATH = resolve(HERE, '../../index.html');

const TOKENS_CSS_RAW = readFileSync(TOKENS_CSS_PATH, 'utf-8');
const INDEX_HTML = readFileSync(INDEX_HTML_PATH, 'utf-8');

// Strip /* … */ block comments so substring probes don't collide with
// prose references to `@font-face` / `:root` in the file header.
const TOKENS_CSS = TOKENS_CSS_RAW.replace(/\/\*[\s\S]*?\*\//g, '');

describe('tokens.css — @font-face declarations (DR-6.2)', () => {
  it('declares exactly three @font-face rules', () => {
    const matches = TOKENS_CSS.match(/@font-face\s*\{/g) ?? [];
    expect(matches).toHaveLength(3);
  });

  it('declares the three JetBrains Mono weights 400 / 500 / 600', () => {
    expect(TOKENS_CSS).toMatch(/font-weight:\s*400/);
    expect(TOKENS_CSS).toMatch(/font-weight:\s*500/);
    expect(TOKENS_CSS).toMatch(/font-weight:\s*600/);
  });

  it('sets font-display: swap on every @font-face block', () => {
    const swapMatches = TOKENS_CSS.match(/font-display:\s*swap/g) ?? [];
    expect(swapMatches).toHaveLength(3);
  });

  it('references the three subset woff2 URLs', () => {
    expect(TOKENS_CSS).toContain('/fonts/JetBrainsMono-Regular-subset.woff2');
    expect(TOKENS_CSS).toContain('/fonts/JetBrainsMono-Medium-subset.woff2');
    expect(TOKENS_CSS).toContain('/fonts/JetBrainsMono-SemiBold-subset.woff2');
  });

  it('places @font-face rules BEFORE :root { … }', () => {
    const firstFontFaceIdx = TOKENS_CSS.search(/@font-face\s*\{/);
    const rootBlockIdx = TOKENS_CSS.indexOf(':root {');
    expect(firstFontFaceIdx).toBeGreaterThanOrEqual(0);
    expect(rootBlockIdx).toBeGreaterThanOrEqual(0);
    expect(firstFontFaceIdx).toBeLessThan(rootBlockIdx);
  });

  it('keeps --font-family set to JetBrains Mono with a monospace fallback chain', () => {
    expect(TOKENS_CSS).toMatch(/--font-family:\s*'JetBrains Mono',[^;]*monospace/i);
  });
});

describe('index.html — preload link (DR-6.2)', () => {
  it('preloads the Medium (500) weight with crossorigin + type="font/woff2"', () => {
    // Single preload — per task spec we do not preload Regular or SemiBold.
    const preloadMatches = INDEX_HTML.match(/rel="preload"/g) ?? [];
    expect(preloadMatches).toHaveLength(1);

    // The preload MUST point at the Medium subset.
    expect(INDEX_HTML).toContain('/fonts/JetBrainsMono-Medium-subset.woff2');

    // The preload MUST carry as="font", type="font/woff2", and crossorigin.
    // We tolerate attribute ordering and HTML whitespace variations but
    // require each attribute to appear inside the same <link> tag.
    const preloadTagMatch = INDEX_HTML.match(/<link\s+rel="preload"[^>]*>/);
    expect(preloadTagMatch).not.toBeNull();
    const tag = preloadTagMatch?.[0] ?? '';
    expect(tag).toMatch(/as="font"/);
    expect(tag).toMatch(/type="font\/woff2"/);
    expect(tag).toMatch(/crossorigin/);
  });

  it('includes the DR19 signature dev comment', () => {
    expect(INDEX_HTML).toContain('Hand Tracker FX — pixelcrash-inspired rework 2026-04-20');
  });
});
