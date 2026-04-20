/**
 * src/ui/primitives/ColorPicker.test.tsx — unit tests for ColorPicker + normalizeHex
 * (Task DR-7.5).
 *
 * Coverage:
 *   - Initial render (swatch value + text draft)
 *   - Typing updates draft but NOT onChange (commit is on blur / Enter)
 *   - Valid hex on blur: fires onChange with lowercase normalized
 *   - Valid hex on Enter: fires onChange and blurs the input
 *   - Invalid hex on blur: silently reverts, no onChange fired
 *   - Native color input change: onChange with hex
 *   - normalizeHex: valid, invalid, leading-# optional, 3-char rejected,
 *     case-insensitive, whitespace
 *   - disabled: both inputs disabled
 *   - ariaLabel propagates to both inputs
 *   - Default + override testid
 *   - Resync: `value` prop change updates visible draft
 *
 * Uses fireEvent only (@testing-library/user-event is NOT a project dep).
 * `fireEvent.change(input, { target: { value } })` faithfully emulates a
 * user edit since React reads the HTMLInputElement.value directly.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColorPicker, normalizeHex } from './ColorPicker';

afterEach(() => {
  cleanup();
});

describe('Task DR-7.5: ColorPicker — rendering', () => {
  it('renders with initial value: swatch lowercase, text input uppercase draft', () => {
    render(<ColorPicker value="#00ff88" onChange={() => {}} ariaLabel="Line color" />);
    const text = screen.getByTestId('color-picker-text') as HTMLInputElement;
    const swatch = screen.getByTestId('color-picker-swatch') as HTMLInputElement;
    expect(text.value).toBe('#00FF88');
    expect(swatch.value).toBe('#00ff88');
    expect(swatch.type).toBe('color');
  });

  it('propagates ariaLabel: text input gets "{label} hex", swatch gets raw label', () => {
    render(<ColorPicker value="#123456" onChange={() => {}} ariaLabel="Line color" />);
    expect(screen.getByLabelText(/line color hex/i)).toBeInTheDocument();
    // The bare ariaLabel lands on the swatch.
    expect(screen.getByTestId('color-picker-swatch')).toHaveAttribute('aria-label', 'Line color');
  });

  it('defaults data-testid="color-picker" on the root', () => {
    render(<ColorPicker value="#abcdef" onChange={() => {}} ariaLabel="T" />);
    expect(screen.getByTestId('color-picker')).toBeInTheDocument();
  });

  it('honors consumer testid override', () => {
    render(
      <ColorPicker
        value="#abcdef"
        onChange={() => {}}
        ariaLabel="Line"
        testid="color-picker-line"
      />,
    );
    expect(screen.getByTestId('color-picker-line')).toBeInTheDocument();
    expect(screen.getByTestId('color-picker-line-text')).toBeInTheDocument();
    expect(screen.getByTestId('color-picker-line-swatch')).toBeInTheDocument();
    expect(screen.queryByTestId('color-picker')).toBeNull();
  });
});

describe('Task DR-7.5: ColorPicker — interaction', () => {
  it('typing updates local draft but does NOT fire onChange yet', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#00ff88" onChange={onChange} ariaLabel="T" />);
    const text = screen.getByTestId('color-picker-text') as HTMLInputElement;
    fireEvent.change(text, { target: { value: '#AAB' } });
    expect(text.value).toBe('#AAB');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('valid hex on blur fires onChange with lowercase normalized hex', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#00ff88" onChange={onChange} ariaLabel="T" />);
    const text = screen.getByTestId('color-picker-text') as HTMLInputElement;
    fireEvent.change(text, { target: { value: '#ABCDEF' } });
    fireEvent.blur(text);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#abcdef');
    // Draft resynced to normalized-uppercase form.
    expect(text.value).toBe('#ABCDEF');
  });

  it('Enter key commits same as blur: fires onChange with lowercase hex', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#00ff88" onChange={onChange} ariaLabel="T" />);
    const text = screen.getByTestId('color-picker-text') as HTMLInputElement;
    fireEvent.change(text, { target: { value: '#112233' } });
    // Enter triggers blur() inside the component, so fire both events to
    // simulate the browser sequence (keyDown → blur handler).
    fireEvent.keyDown(text, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#112233');
  });

  it('invalid hex on blur reverts draft to previous value (no onChange fired)', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#00ff88" onChange={onChange} ariaLabel="T" />);
    const text = screen.getByTestId('color-picker-text') as HTMLInputElement;
    fireEvent.change(text, { target: { value: '#12GGGG' } });
    fireEvent.blur(text);
    expect(onChange).not.toHaveBeenCalled();
    expect(text.value).toBe('#00FF88');
  });

  it('invalid short hex on Enter also reverts to previous value', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#00ff88" onChange={onChange} ariaLabel="T" />);
    const text = screen.getByTestId('color-picker-text') as HTMLInputElement;
    fireEvent.change(text, { target: { value: '#abc' } });
    fireEvent.keyDown(text, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    expect(text.value).toBe('#00FF88');
  });

  it('committing the same value (case-insensitive) does not fire onChange', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#00ff88" onChange={onChange} ariaLabel="T" />);
    const text = screen.getByTestId('color-picker-text') as HTMLInputElement;
    fireEvent.change(text, { target: { value: '#00FF88' } });
    fireEvent.blur(text);
    expect(onChange).not.toHaveBeenCalled();
    expect(text.value).toBe('#00FF88');
  });

  it('native color swatch change fires onChange with picked hex', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#00ff88" onChange={onChange} ariaLabel="T" />);
    const swatch = screen.getByTestId('color-picker-swatch') as HTMLInputElement;
    // jsdom does not open a picker; fire a synthetic change event instead.
    fireEvent.change(swatch, { target: { value: '#abc123' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#abc123');
    // Draft updated to uppercase.
    const text = screen.getByTestId('color-picker-text') as HTMLInputElement;
    expect(text.value).toBe('#ABC123');
  });

  it('disabled gates both text input and swatch', () => {
    render(<ColorPicker value="#00ff88" onChange={() => {}} ariaLabel="T" disabled />);
    const text = screen.getByTestId('color-picker-text') as HTMLInputElement;
    const swatch = screen.getByTestId('color-picker-swatch') as HTMLInputElement;
    expect(text).toBeDisabled();
    expect(swatch).toBeDisabled();
  });

  it('resyncs visible draft when `value` prop changes externally (preset load)', () => {
    const { rerender } = render(<ColorPicker value="#00ff88" onChange={() => {}} ariaLabel="T" />);
    const text1 = screen.getByTestId('color-picker-text') as HTMLInputElement;
    expect(text1.value).toBe('#00FF88');

    rerender(<ColorPicker value="#ff0000" onChange={() => {}} ariaLabel="T" />);
    const text2 = screen.getByTestId('color-picker-text') as HTMLInputElement;
    expect(text2.value).toBe('#FF0000');
  });
});

describe('Task DR-7.5: normalizeHex', () => {
  it('accepts canonical 6-char hex with leading #', () => {
    expect(normalizeHex('#abcdef')).toBe('#abcdef');
    expect(normalizeHex('#ABCDEF')).toBe('#abcdef');
    expect(normalizeHex('#00ff88')).toBe('#00ff88');
  });

  it('accepts 6-char hex WITHOUT leading # and inserts it', () => {
    expect(normalizeHex('abcdef')).toBe('#abcdef');
    expect(normalizeHex('00FF88')).toBe('#00ff88');
  });

  it('is case-insensitive and always returns lowercase', () => {
    expect(normalizeHex('#AbCdEf')).toBe('#abcdef');
    expect(normalizeHex('aBcDeF')).toBe('#abcdef');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeHex('   #abcdef   ')).toBe('#abcdef');
    expect(normalizeHex('\t#ABCDEF\n')).toBe('#abcdef');
    expect(normalizeHex('  abcdef  ')).toBe('#abcdef');
  });

  it('returns null for invalid characters', () => {
    expect(normalizeHex('#12GGGG')).toBeNull();
    expect(normalizeHex('#xxxxxx')).toBeNull();
    expect(normalizeHex('not a color')).toBeNull();
  });

  it('returns null for wrong length (3-char shorthand NOT accepted)', () => {
    expect(normalizeHex('#abc')).toBeNull();
    expect(normalizeHex('abc')).toBeNull();
    expect(normalizeHex('#abcde')).toBeNull();
    expect(normalizeHex('#abcdefg')).toBeNull();
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex('#')).toBeNull();
  });
});
