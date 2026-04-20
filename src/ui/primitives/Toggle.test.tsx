/**
 * src/ui/primitives/Toggle.test.tsx — unit tests for the Toggle primitive
 * (Task DR-7.4).
 *
 * ≥ 8 tests covering:
 *   - ARIA switch role + aria-checked reflection
 *   - Click toggles onChange(!checked)
 *   - Space key toggles + preventDefault (no scroll)
 *   - Enter key toggles
 *   - disabled gates click + keyboard
 *   - aria-label propagation (REQUIRED prop)
 *   - data-checked attribute reflects state
 *   - default + override testid
 *   - forwardRef forwards to <button>
 *   - renders SVG icon as aria-hidden (not in a11y tree)
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toggle } from './Toggle';

afterEach(() => {
  cleanup();
});

describe('Task DR-7.4: Toggle — ARIA switch + rendering', () => {
  it('renders with role="switch" and aria-checked="true" when checked={true}', () => {
    render(<Toggle checked={true} onChange={() => {}} ariaLabel="Mirror mode" />);
    const btn = screen.getByRole('switch');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-checked', 'true');
  });

  it('renders with aria-checked="false" when checked={false}', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="Mirror mode" />);
    const btn = screen.getByRole('switch');
    expect(btn).toHaveAttribute('aria-checked', 'false');
  });

  it('propagates ariaLabel to the underlying button (required for screen readers)', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="Show landmarks" />);
    expect(screen.getByRole('switch', { name: /show landmarks/i })).toBeInTheDocument();
  });

  it('data-checked attribute reflects state (drives CSS styling)', () => {
    const { rerender } = render(<Toggle checked={true} onChange={() => {}} ariaLabel="T" />);
    expect(screen.getByRole('switch')).toHaveAttribute('data-checked', 'true');

    rerender(<Toggle checked={false} onChange={() => {}} ariaLabel="T" />);
    expect(screen.getByRole('switch')).toHaveAttribute('data-checked', 'false');
  });

  it('renders an aria-hidden SVG icon (not in the a11y tree)', () => {
    const { container } = render(<Toggle checked={true} onChange={() => {}} ariaLabel="T" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    // Two diagonal lines make the X shape.
    expect(svg?.querySelectorAll('line')).toHaveLength(2);
  });

  it('defaults type="button" so a Toggle inside a <form> never submits', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="T" />);
    expect(screen.getByRole('switch')).toHaveAttribute('type', 'button');
  });
});

describe('Task DR-7.4: Toggle — interaction', () => {
  it('click fires onChange(!checked) — true → false', () => {
    const onChange = vi.fn();
    render(<Toggle checked={true} onChange={onChange} ariaLabel="T" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('click fires onChange(!checked) — false → true', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="T" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Space key toggles and preventDefault is called (prevents page scroll)', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="T" />);
    const btn = screen.getByRole('switch');
    // Dispatch a real KeyboardEvent so we can read `defaultPrevented`.
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    btn.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Enter key toggles (no preventDefault needed — Enter does not scroll)', () => {
    const onChange = vi.fn();
    render(<Toggle checked={true} onChange={onChange} ariaLabel="T" />);
    const btn = screen.getByRole('switch');
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('unrelated keys (ArrowRight, Tab, Escape) do NOT fire onChange', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="T" />);
    const btn = screen.getByRole('switch');
    fireEvent.keyDown(btn, { key: 'ArrowRight' });
    fireEvent.keyDown(btn, { key: 'Tab' });
    fireEvent.keyDown(btn, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disabled blocks click — onChange NOT fired, `disabled` attr set', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="T" disabled />);
    const btn = screen.getByRole('switch');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disabled blocks Space and Enter keyboard toggles', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="T" disabled />);
    const btn = screen.getByRole('switch');
    fireEvent.keyDown(btn, { key: ' ' });
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Task DR-7.4: Toggle — testid + ref', () => {
  it('defaults data-testid="toggle"', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="T" />);
    expect(screen.getByTestId('toggle')).toBeInTheDocument();
  });

  it('honors consumer testid override', () => {
    render(
      <Toggle checked={false} onChange={() => {}} ariaLabel="Mirror" testid="toggle-mirror" />,
    );
    expect(screen.getByTestId('toggle-mirror')).toBeInTheDocument();
    expect(screen.queryByTestId('toggle')).toBeNull();
  });

  it('forwards ref to the underlying <button>', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Toggle ref={ref} checked={false} onChange={() => {}} ariaLabel="T" />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.getAttribute('role')).toBe('switch');
  });
});
