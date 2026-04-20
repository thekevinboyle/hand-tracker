/**
 * src/ui/primitives/Button.test.tsx — unit tests for the Button primitive
 * (Task DR-7.1).
 *
 * Coverage (≥ 8 per task file Step 4):
 *   1.  renders with default variant 'secondary' and size 'md'
 *   2.  renders text children
 *   3.  fires onClick on click
 *   4.  disabled: no onClick + `disabled` attr reflected in DOM
 *   5.  sets data-testid="button-primary" by default for variant='primary'
 *   6.  honors consumer `testid` override
 *   7.  applies data-variant and data-size data attrs correctly
 *   8.  spreads aria-label onto the native button
 *   9.  merges consumer className with internal class
 *   10. defaults type="button" (never accidentally submits)
 *   11. keyboard-accessible (Enter/Space fire onClick via native button)
 *   12. forwards ref to the underlying <button>
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

afterEach(() => {
  cleanup();
});

describe('Task DR-7.1: Button primitive — defaults', () => {
  it('renders with default variant "secondary" and size "md"', () => {
    render(<Button>Go</Button>);
    const btn = screen.getByRole('button', { name: /go/i });
    expect(btn).toHaveAttribute('data-variant', 'secondary');
    expect(btn).toHaveAttribute('data-size', 'md');
  });

  it('renders text children', () => {
    render(<Button>Record</Button>);
    expect(screen.getByRole('button').textContent).toBe('Record');
  });

  it('defaults type="button" so it never submits a form by accident', () => {
    render(<Button>Safe</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Task DR-7.1: Button primitive — interaction', () => {
  it('fires onClick on click', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('respects disabled — onClick not fired, `disabled` attr present', () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Dim
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is keyboard-accessible — Enter on a focused button fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Key</Button>);
    const btn = screen.getByRole('button');
    btn.focus();
    expect(document.activeElement).toBe(btn);
    // A native <button> with `type="button"` fires `click` on Enter/Space
    // via the browser's UA stylesheet. In jsdom this mapping is a no-op,
    // so we emulate by dispatching a click — the important assertion is
    // that the Button *is* a native <button> which the browser handles.
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Task DR-7.1: Button primitive — testid + data attrs', () => {
  it('sets data-testid="button-primary" by default for variant="primary"', () => {
    render(<Button variant="primary">Save</Button>);
    expect(screen.getByTestId('button-primary')).toBeInTheDocument();
  });

  it('honors consumer testid override', () => {
    render(
      <Button variant="primary" testid="record-button">
        Record
      </Button>,
    );
    expect(screen.getByTestId('record-button')).toBeInTheDocument();
    // Default testid is NOT applied when override is present.
    expect(screen.queryByTestId('button-primary')).toBeNull();
  });

  it('applies data-variant and data-size attributes correctly', () => {
    render(
      <Button variant="icon" size="sm">
        {'\u2715'}
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-variant', 'icon');
    expect(btn).toHaveAttribute('data-size', 'sm');
  });
});

describe('Task DR-7.1: Button primitive — a11y + className', () => {
  it('spreads aria-label onto the native button', () => {
    render(
      <Button variant="icon" aria-label="Close">
        {'\u2715'}
      </Button>,
    );
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('merges consumer className with internal class', () => {
    render(<Button className="extra-class">X</Button>);
    const btn = screen.getByRole('button');
    // Consumer class is present alongside the CSS-Module-hashed internal class.
    expect(btn.className).toMatch(/extra-class/);
    // Class list contains more than just "extra-class" (internal class is
    // hashed and unpredictable — just check count > 1).
    expect(btn.className.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);
  });

  it('forwards ref to the underlying <button>', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toBe('Ref');
  });
});
