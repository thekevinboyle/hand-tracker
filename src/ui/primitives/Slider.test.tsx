/**
 * src/ui/primitives/Slider.test.tsx — unit tests for Slider + RangeSlider
 * primitives (Task DR-7.3).
 *
 * ≥ 15 tests across:
 *   - Slider (single-thumb)        : rendering, value, onChange, keyboard
 *   - RangeSlider (two-thumb)      : rendering, non-crossing, onChange
 *   - Math helpers                 : toProportion, fromProportion
 *   - A11y + layout                : aria-label, touch-area, disabled
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromProportion, RangeSlider, Slider, toProportion } from './Slider';

afterEach(() => {
  cleanup();
});

describe('Task DR-7.3: Slider — helpers (toProportion / fromProportion)', () => {
  it('toProportion(50, 0, 100) returns 0.5', () => {
    expect(toProportion(50, 0, 100)).toBe(0.5);
  });

  it('toProportion clamps below min to 0 and above max to 1', () => {
    expect(toProportion(-10, 0, 100)).toBe(0);
    expect(toProportion(999, 0, 100)).toBe(1);
  });

  it('toProportion returns 0 when max <= min (degenerate range)', () => {
    expect(toProportion(5, 10, 10)).toBe(0);
    expect(toProportion(5, 10, 0)).toBe(0);
  });

  it('fromProportion(0.5, 0, 100, 1) returns 50', () => {
    expect(fromProportion(0.5, 0, 100, 1)).toBe(50);
  });

  it('fromProportion(1, 0, 1, 0.01) returns exactly 1 (no float noise)', () => {
    // Without toFixed(precision) this would produce 0.9999999…
    expect(fromProportion(1, 0, 1, 0.01)).toBe(1);
  });

  it('fromProportion snaps to the nearest step', () => {
    // p=0.333 of [0,100] step=10 → raw=33.3 → nearest step = 30
    expect(fromProportion(0.333, 0, 100, 10)).toBe(30);
  });
});

describe('Task DR-7.3: Slider — rendering + proportion', () => {
  it('renders the slider and exposes the native range input', () => {
    render(
      <Slider min={0} max={100} step={1} value={50} onChange={() => {}} ariaLabel="Test slider" />,
    );
    const input = screen.getByTestId('slider-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('range');
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
    expect(input.step).toBe('1');
    expect(input.value).toBe('50');
  });

  it('at value=max the decorative thumb sits flush against the right edge (calc(100% - 1px))', () => {
    const { container } = render(
      <Slider min={0} max={100} step={1} value={100} onChange={() => {}} ariaLabel="Test" />,
    );
    // Inline style is set as the raw string — look for calc(100% - 1px).
    const thumbs = container.querySelectorAll('[style*="left"]');
    // One .activeRange + one .thumb both carry inline left:.
    const thumbLeft = Array.from(thumbs).find((el) =>
      (el as HTMLElement).style.left.includes('calc('),
    ) as HTMLElement | undefined;
    expect(thumbLeft).toBeDefined();
    expect(thumbLeft?.style.left).toBe('calc(100% - 1px)');
  });

  it('at value=min the decorative thumb sits at calc(0% - 1px)', () => {
    const { container } = render(
      <Slider min={0} max={100} step={1} value={0} onChange={() => {}} ariaLabel="Test" />,
    );
    const styled = container.querySelectorAll('[style]');
    const thumbLeft = Array.from(styled).find((el) =>
      (el as HTMLElement).style.left.startsWith('calc('),
    ) as HTMLElement | undefined;
    expect(thumbLeft?.style.left).toBe('calc(0% - 1px)');
  });
});

describe('Task DR-7.3: Slider — interaction', () => {
  it('onChange fires with a Number when the native input value changes', () => {
    const onChange = vi.fn();
    render(<Slider min={0} max={100} step={1} value={50} onChange={onChange} ariaLabel="Test" />);
    const input = screen.getByTestId('slider-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '60' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it('PageUp steps value up by 10 × step (custom handler)', () => {
    const onChange = vi.fn();
    render(<Slider min={0} max={100} step={1} value={50} onChange={onChange} ariaLabel="Test" />);
    const input = screen.getByTestId('slider-input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'PageUp' });
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it('PageDown steps value down by 10 × step', () => {
    const onChange = vi.fn();
    render(<Slider min={0} max={100} step={1} value={50} onChange={onChange} ariaLabel="Test" />);
    const input = screen.getByTestId('slider-input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'PageDown' });
    expect(onChange).toHaveBeenCalledWith(40);
  });

  it('PageUp clamps at max', () => {
    const onChange = vi.fn();
    render(<Slider min={0} max={100} step={1} value={95} onChange={onChange} ariaLabel="Test" />);
    const input = screen.getByTestId('slider-input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'PageUp' });
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('PageDown clamps at min', () => {
    const onChange = vi.fn();
    render(<Slider min={0} max={100} step={1} value={5} onChange={onChange} ariaLabel="Test" />);
    const input = screen.getByTestId('slider-input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'PageDown' });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('Arrow keys bubble through to the native input (no preventDefault in handler)', () => {
    // The component's custom keydown handler only intercepts PageUp/PageDown.
    // ArrowRight / ArrowLeft flow through untouched — proof: after dispatching
    // ArrowRight, `e.defaultPrevented` remains false on the synthetic event.
    const onChange = vi.fn();
    render(<Slider min={0} max={100} step={1} value={50} onChange={onChange} ariaLabel="Test" />);
    const input = screen.getByTestId('slider-input') as HTMLInputElement;
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('disabled prop blocks onChange on input change', () => {
    const onChange = vi.fn();
    render(
      <Slider
        min={0}
        max={100}
        step={1}
        value={50}
        onChange={onChange}
        ariaLabel="Test"
        disabled
      />,
    );
    const input = screen.getByTestId('slider-input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    // Even if somehow the change event fires, the handler early-returns.
    fireEvent.change(input, { target: { value: '60' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disabled prop blocks PageUp / PageDown keydown', () => {
    const onChange = vi.fn();
    render(
      <Slider
        min={0}
        max={100}
        step={1}
        value={50}
        onChange={onChange}
        ariaLabel="Test"
        disabled
      />,
    );
    const input = screen.getByTestId('slider-input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'PageUp' });
    fireEvent.keyDown(input, { key: 'PageDown' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Task DR-7.3: Slider — a11y + testid', () => {
  it('applies ariaLabel to the native input', () => {
    render(
      <Slider min={0} max={100} step={1} value={50} onChange={() => {}} ariaLabel="Tile size" />,
    );
    const input = screen.getByLabelText('Tile size') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('range');
  });

  it('default testid is `slider` / `slider-input`; override takes precedence', () => {
    const { rerender } = render(
      <Slider min={0} max={100} step={1} value={50} onChange={() => {}} ariaLabel="T" />,
    );
    expect(screen.getByTestId('slider')).toBeInTheDocument();
    expect(screen.getByTestId('slider-input')).toBeInTheDocument();

    rerender(
      <Slider
        min={0}
        max={100}
        step={1}
        value={50}
        onChange={() => {}}
        ariaLabel="T"
        testid="tile-size-slider"
      />,
    );
    expect(screen.getByTestId('tile-size-slider')).toBeInTheDocument();
    expect(screen.getByTestId('tile-size-slider-input')).toBeInTheDocument();
  });

  it('root carries data-disabled when disabled', () => {
    render(
      <Slider min={0} max={100} step={1} value={50} onChange={() => {}} ariaLabel="T" disabled />,
    );
    expect(screen.getByTestId('slider').getAttribute('data-disabled')).toBe('true');
  });

  it('supports large integer ranges (0..65535)', () => {
    const onChange = vi.fn();
    render(
      <Slider min={0} max={65535} step={1} value={32768} onChange={onChange} ariaLabel="Seed" />,
    );
    const input = screen.getByTestId('slider-input') as HTMLInputElement;
    expect(input.max).toBe('65535');
    fireEvent.change(input, { target: { value: '65535' } });
    expect(onChange).toHaveBeenCalledWith(65535);
  });

  it('supports fractional step (step=0.01)', () => {
    const onChange = vi.fn();
    render(
      <Slider min={0} max={1} step={0.01} value={0.5} onChange={onChange} ariaLabel="Opacity" />,
    );
    const input = screen.getByTestId('slider-input') as HTMLInputElement;
    expect(input.step).toBe('0.01');
    fireEvent.change(input, { target: { value: '0.75' } });
    expect(onChange).toHaveBeenCalledWith(0.75);
  });
});

describe('Task DR-7.3: RangeSlider — rendering + non-crossing', () => {
  it('renders two thumbs and two native range inputs', () => {
    const { container } = render(
      <RangeSlider
        min={0}
        max={100}
        step={1}
        value={[20, 80]}
        onChange={() => {}}
        ariaLabel="Input range"
      />,
    );
    expect(screen.getByTestId('range-slider')).toBeInTheDocument();
    expect(screen.getByTestId('range-slider-input-lo')).toBeInTheDocument();
    expect(screen.getByTestId('range-slider-input-hi')).toBeInTheDocument();
    // Two decorative thumbs (each 2px wide) — inline style carries
    // `left: calc(…% - 1px)`. Scan all `[style]` attributes for the `calc`
    // signature (CSS attribute selector with `(` needs escaping — simpler
    // to enumerate).
    const styled = container.querySelectorAll('[style]');
    const thumbs = Array.from(styled).filter((el) =>
      (el as HTMLElement).style.left.startsWith('calc('),
    );
    expect(thumbs).toHaveLength(2);
  });

  it('lo input max is clamped to hi - step (cannot cross)', () => {
    render(
      <RangeSlider min={0} max={100} step={1} value={[20, 80]} onChange={() => {}} ariaLabel="R" />,
    );
    const lo = screen.getByTestId('range-slider-input-lo') as HTMLInputElement;
    // hi=80, step=1 → max of lo-input = 79
    expect(lo.max).toBe('79');
  });

  it('hi input min is clamped to lo + step (cannot cross)', () => {
    render(
      <RangeSlider min={0} max={100} step={1} value={[20, 80]} onChange={() => {}} ariaLabel="R" />,
    );
    const hi = screen.getByTestId('range-slider-input-hi') as HTMLInputElement;
    // lo=20, step=1 → min of hi-input = 21
    expect(hi.min).toBe('21');
  });

  it('onChange fires with [newLo, hi] tuple when lo-input changes', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider min={0} max={100} step={1} value={[20, 80]} onChange={onChange} ariaLabel="R" />,
    );
    const lo = screen.getByTestId('range-slider-input-lo') as HTMLInputElement;
    fireEvent.change(lo, { target: { value: '30' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([30, 80]);
  });

  it('onChange fires with [lo, newHi] tuple when hi-input changes', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider min={0} max={100} step={1} value={[20, 80]} onChange={onChange} ariaLabel="R" />,
    );
    const hi = screen.getByTestId('range-slider-input-hi') as HTMLInputElement;
    fireEvent.change(hi, { target: { value: '70' } });
    expect(onChange).toHaveBeenCalledWith([20, 70]);
  });

  it('applies `(lower)` and `(upper)` suffix to the two native inputs aria-label', () => {
    render(
      <RangeSlider
        min={0}
        max={100}
        step={1}
        value={[20, 80]}
        onChange={() => {}}
        ariaLabel="Input range"
      />,
    );
    expect(screen.getByLabelText('Input range (lower)')).toBeInTheDocument();
    expect(screen.getByLabelText('Input range (upper)')).toBeInTheDocument();
  });

  it('disabled prop blocks onChange on both inputs', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        min={0}
        max={100}
        step={1}
        value={[20, 80]}
        onChange={onChange}
        ariaLabel="R"
        disabled
      />,
    );
    const lo = screen.getByTestId('range-slider-input-lo') as HTMLInputElement;
    const hi = screen.getByTestId('range-slider-input-hi') as HTMLInputElement;
    expect(lo.disabled).toBe(true);
    expect(hi.disabled).toBe(true);
    fireEvent.change(lo, { target: { value: '30' } });
    fireEvent.change(hi, { target: { value: '70' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('PageUp on lo-input steps +10×step and fires tuple onChange', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider min={0} max={100} step={1} value={[20, 80]} onChange={onChange} ariaLabel="R" />,
    );
    const lo = screen.getByTestId('range-slider-input-lo') as HTMLInputElement;
    fireEvent.keyDown(lo, { key: 'PageUp' });
    expect(onChange).toHaveBeenCalledWith([30, 80]);
  });

  it('PageUp on lo cannot cross hi (clamps at hi - step)', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider min={0} max={100} step={1} value={[75, 80]} onChange={onChange} ariaLabel="R" />,
    );
    const lo = screen.getByTestId('range-slider-input-lo') as HTMLInputElement;
    fireEvent.keyDown(lo, { key: 'PageUp' });
    // +10×step would be 85 but hi=80, step=1 → clamp to 79
    expect(onChange).toHaveBeenCalledWith([79, 80]);
  });

  it('PageDown on hi cannot cross lo (clamps at lo + step)', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider min={0} max={100} step={1} value={[20, 25]} onChange={onChange} ariaLabel="R" />,
    );
    const hi = screen.getByTestId('range-slider-input-hi') as HTMLInputElement;
    fireEvent.keyDown(hi, { key: 'PageDown' });
    // -10×step would be 15 but lo=20, step=1 → clamp to 21
    expect(onChange).toHaveBeenCalledWith([20, 21]);
  });

  it('defaults to testid="range-slider" + suffix; override propagates to both inputs', () => {
    render(
      <RangeSlider
        min={0}
        max={100}
        step={1}
        value={[20, 80]}
        onChange={() => {}}
        ariaLabel="R"
        testid="input-range"
      />,
    );
    expect(screen.getByTestId('input-range')).toBeInTheDocument();
    expect(screen.getByTestId('input-range-input-lo')).toBeInTheDocument();
    expect(screen.getByTestId('input-range-input-hi')).toBeInTheDocument();
  });
});
