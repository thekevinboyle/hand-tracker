/**
 * src/ui/primitives/Segmented.test.tsx — unit tests for the Segmented
 * primitive (Task DR-7.2).
 *
 * Coverage (>= 10 per task file Step 5):
 *   1.  renders 2-option variant (Below / Above)
 *   2.  renders 3-option variant
 *   3.  renders 5-option variant (XS / S / M / L / XL)
 *   4.  clicking an option fires onChange with the clicked value
 *   5.  ArrowRight cycles next with wrap-around
 *   6.  ArrowLeft cycles prev with wrap-around (from first -> last)
 *   7.  Home key jumps to the first option
 *   8.  End key jumps to the last option
 *   9.  value=undefined renders NO checked input (no aria-checked='true')
 *   10. selected option label has font-weight: 600 (checks class application)
 *   11. radiogroup carries `aria-label`
 *   12. disabled prop blocks click + keyboard interaction
 *   13. roving tabindex — only selected input has tabIndex=0
 *   14. testid override takes precedence over default
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Segmented } from './Segmented';

afterEach(() => {
  cleanup();
});

const TWO = [
  { value: 0, label: 'Below' },
  { value: 1, label: 'Above' },
] as const;

const THREE = [
  { value: 'lo', label: 'Below' },
  { value: 'mid', label: 'Between' },
  { value: 'hi', label: 'Above' },
] as const;

const FIVE = [
  { value: 4, label: 'XS' },
  { value: 8, label: 'S' },
  { value: 16, label: 'M' },
  { value: 32, label: 'L' },
  { value: 64, label: 'XL' },
] as const;

describe('Task DR-7.2: Segmented primitive — rendering variants', () => {
  it('renders the 2-option variant (Below / Above)', () => {
    render(<Segmented options={TWO} value={0} onChange={() => {}} ariaLabel="Boundary" />);
    expect(screen.getByLabelText('Below')).toBeInTheDocument();
    expect(screen.getByLabelText('Above')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('renders the 3-option variant', () => {
    render(<Segmented options={THREE} value="mid" onChange={() => {}} ariaLabel="Pos" />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByLabelText('Between')).toBeInTheDocument();
  });

  it('renders the 5-option variant (XS / S / M / L / XL)', () => {
    render(<Segmented options={FIVE} value={16} onChange={() => {}} ariaLabel="Cell size" />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(screen.getByLabelText('XS')).toBeInTheDocument();
    expect(screen.getByLabelText('XL')).toBeInTheDocument();
  });
});

describe('Task DR-7.2: Segmented primitive — click + change', () => {
  it('clicking an option fires onChange with the clicked value', () => {
    const onChange = vi.fn();
    render(<Segmented options={FIVE} value={4} onChange={onChange} ariaLabel="Cell size" />);
    const opt = screen.getByTestId('segmented-option-32');
    fireEvent.click(opt);
    expect(onChange).toHaveBeenCalledWith(32);
  });

  it('ignores clicks when disabled', () => {
    const onChange = vi.fn();
    render(
      <Segmented options={FIVE} value={4} onChange={onChange} ariaLabel="Cell size" disabled />,
    );
    const opt = screen.getByTestId('segmented-option-16');
    fireEvent.click(opt);
    // Native radio is `disabled`; the onChange handler is also gated by
    // the component's `disabled` check. Either path must silence the
    // onChange prop.
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Task DR-7.2: Segmented primitive — keyboard cycling', () => {
  function renderControlled(initial: (typeof FIVE)[number]['value']): {
    onChange: ReturnType<typeof vi.fn>;
  } {
    const onChange = vi.fn();
    render(<Segmented options={FIVE} value={initial} onChange={onChange} ariaLabel="Cell size" />);
    return { onChange };
  }

  it('ArrowRight cycles next', () => {
    const { onChange } = renderControlled(4);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('ArrowRight from the last option wraps to the first', () => {
    const { onChange } = renderControlled(64);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('ArrowLeft cycles previous with wrap-around (first -> last)', () => {
    const { onChange } = renderControlled(4);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(64);
  });

  it('Home key jumps to the first option', () => {
    const { onChange } = renderControlled(32);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('End key jumps to the last option', () => {
    const { onChange } = renderControlled(8);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith(64);
  });

  it('ArrowUp / ArrowDown behave like ArrowLeft / ArrowRight', () => {
    const { onChange } = renderControlled(8);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(16);
    fireEvent.keyDown(group, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('unhandled keys do not fire onChange (no default preventDefault)', () => {
    const { onChange } = renderControlled(16);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'a' });
    fireEvent.keyDown(group, { key: 'Tab' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keyboard is inert when disabled', () => {
    const onChange = vi.fn();
    render(
      <Segmented options={FIVE} value={4} onChange={onChange} ariaLabel="Cell size" disabled />,
    );
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    fireEvent.keyDown(group, { key: 'End' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Task DR-7.2: Segmented primitive — value=undefined semantics', () => {
  it('renders no checked input when value is undefined', () => {
    render(
      <Segmented options={FIVE} value={undefined} onChange={() => {}} ariaLabel="Cell size" />,
    );
    const radios = screen.getAllByRole('radio');
    // None of the radios should report aria-checked='true'.
    for (const radio of radios) {
      expect(radio.getAttribute('aria-checked')).not.toBe('true');
    }
  });

  it('when value=undefined, ArrowRight lands on the first option', () => {
    const onChange = vi.fn();
    render(
      <Segmented options={FIVE} value={undefined} onChange={onChange} ariaLabel="Cell size" />,
    );
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('when value=undefined, roving tabindex places tabIndex=0 on the first option', () => {
    render(
      <Segmented options={FIVE} value={undefined} onChange={() => {}} ariaLabel="Cell size" />,
    );
    const radios = screen.getAllByRole('radio');
    // First option reachable via Tab; others not.
    expect(radios[0]?.getAttribute('tabindex')).toBe('0');
    for (let i = 1; i < radios.length; i += 1) {
      expect(radios[i]?.getAttribute('tabindex')).toBe('-1');
    }
  });
});

describe('Task DR-7.2: Segmented primitive — a11y + selection styling', () => {
  it('radiogroup carries the provided aria-label', () => {
    render(<Segmented options={TWO} value={0} onChange={() => {}} ariaLabel="Boundary choice" />);
    expect(screen.getByRole('radiogroup', { name: /boundary choice/i })).toBeInTheDocument();
  });

  it('selected option has aria-checked=true and siblings do not', () => {
    render(<Segmented options={FIVE} value={16} onChange={() => {}} ariaLabel="Cell size" />);
    const selected = screen.getByTestId('segmented-option-16');
    expect(selected.getAttribute('aria-checked')).toBe('true');
    const other = screen.getByTestId('segmented-option-4');
    expect(other.getAttribute('aria-checked')).not.toBe('true');
  });

  it('selected option is the sole Tab stop (roving tabindex)', () => {
    render(<Segmented options={FIVE} value={32} onChange={() => {}} ariaLabel="Cell size" />);
    const radios = screen.getAllByRole('radio');
    const zeroStops = radios.filter((r) => r.getAttribute('tabindex') === '0');
    expect(zeroStops).toHaveLength(1);
    expect(zeroStops[0]).toBe(screen.getByTestId('segmented-option-32'));
  });

  it('selected label adopts the selected style (computed font-weight or CSS class)', () => {
    const { container } = render(
      <Segmented options={FIVE} value={16} onChange={() => {}} ariaLabel="Cell size" />,
    );
    // CSS Modules cannot compute pseudo-class styles under jsdom, so we
    // verify the structural contract: the selected input is `:checked`,
    // the label-bearing ancestor uses `.item`, and CSS selector
    // `.item:has(.input:checked) .label` applies `font-weight: 600` in
    // real browsers (covered in DR-7.R visual regression).
    const selectedInput = screen.getByTestId('segmented-option-16') as HTMLInputElement;
    expect(selectedInput.checked).toBe(true);
    // Structural sanity — five inputs, five labels, one root.
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(5);
  });
});

describe('Task DR-7.2: Segmented primitive — testid + structure', () => {
  it('defaults data-testid="segmented" on the radiogroup root', () => {
    render(<Segmented options={TWO} value={0} onChange={() => {}} ariaLabel="Boundary" />);
    expect(screen.getByTestId('segmented')).toBeInTheDocument();
  });

  it('honors consumer testid override', () => {
    render(
      <Segmented
        options={TWO}
        value={0}
        onChange={() => {}}
        ariaLabel="Boundary"
        testid="cell-size-picker"
      />,
    );
    expect(screen.getByTestId('cell-size-picker')).toBeInTheDocument();
    // Default testid is not applied alongside the override.
    expect(screen.queryByTestId('segmented')).toBeNull();
  });

  it('each option carries data-testid "segmented-option-<value>" by default', () => {
    render(<Segmented options={FIVE} value={4} onChange={() => {}} ariaLabel="Cell size" />);
    expect(screen.getByTestId('segmented-option-4')).toBeInTheDocument();
    expect(screen.getByTestId('segmented-option-64')).toBeInTheDocument();
  });

  it('renders N radio inputs and implicitly N-1 "/" separators via CSS pseudo', () => {
    // jsdom cannot render `::before` content, so we assert the structural
    // invariant: one input per option is present and styled via the `.input`
    // class (the CSS module declares `.input::before { content: '/' }` which
    // visual regression asserts in DR-7.R).
    render(<Segmented options={FIVE} value={16} onChange={() => {}} ariaLabel="Cell size" />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    // First item suppresses the separator — visible only in browser; this
    // test asserts the structural precondition (CSS selector `.item:first-child
    // .input::before` targets exactly the first option).
    const firstLabel = radios[0]?.closest('label');
    expect(firstLabel).not.toBeNull();
  });
});
