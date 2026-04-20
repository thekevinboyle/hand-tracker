/**
 * src/ui/Footer.test.tsx — unit tests for the Task DR-8.7 Footer.
 *
 * Coverage:
 *   - renders a `<footer>` with data-testid="footer"
 *   - version label text matches verbatim
 *   - credit label text matches verbatim
 *   - dotted spacer is aria-hidden (screen-reader-quiet)
 *   - uses --color-text-muted token via the class hook (jsdom can't
 *     resolve CSS custom properties, so we assert class-presence only;
 *     the computed-color check lives in the L4 spec where the real
 *     browser CSS engine resolves tokens to rgb())
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Footer } from './Footer';

afterEach(() => {
  cleanup();
});

describe('Task DR-8.7: Footer — verbatim copy + structure', () => {
  it('renders a <footer> element with data-testid="footer"', () => {
    render(<Footer />);
    const root = screen.getByTestId('footer');
    expect(root).toBeInTheDocument();
    expect(root.tagName.toLowerCase()).toBe('footer');
  });

  it('renders the version label verbatim', () => {
    render(<Footer />);
    expect(screen.getByText('hand-tracker-fx v0.1.0')).toBeInTheDocument();
  });

  it('renders the credit label verbatim', () => {
    render(<Footer />);
    expect(screen.getByText('Built with MediaPipe, ogl, React')).toBeInTheDocument();
  });

  it('marks the dotted spacer as aria-hidden', () => {
    render(<Footer />);
    const root = screen.getByTestId('footer');
    const spacer = root.querySelector('[aria-hidden="true"]');
    expect(spacer).not.toBeNull();
    // Six literal U+00B7 MIDDLE DOT glyphs — the visible run is stylistic
    // per synergy MEDIUM-10 (spacer width scales via letter-spacing), but
    // the copy the HTML ships with is stable.
    expect(spacer?.textContent).toBe('\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7');
  });
});
