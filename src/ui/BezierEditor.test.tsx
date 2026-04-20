/**
 * src/ui/BezierEditor.test.tsx — unit tests for the cubic-bezier editor
 * (Task DR-8.3 / synergy-fix HIGH-09).
 *
 * Coverage (≥ 4 tests):
 *   - Renders two draggable handles with correct testids + aria labels
 *   - Keyboard arrows move handle 1 and handle 2 by ±0.01 (±0.1 with Shift)
 *   - onChange receives a new tuple on each interaction
 *   - clampX / clampY exports behave per CSS cubic-bezier spec
 *   - disabled prop gates interactions
 *   - testid override is honored
 *
 * Uses fireEvent only (@testing-library/user-event is not a project dep).
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BezierEditor, type BezierTuple, clampX, clampY } from './BezierEditor';

afterEach(() => {
  cleanup();
});

describe('Task DR-8.3: BezierEditor — rendering', () => {
  it('renders the root with the default testid and an img-role svg with the aria label', () => {
    render(<BezierEditor value={[0.25, 0.1, 0.25, 1]} onChange={() => {}} ariaLabel="Bezier" />);
    expect(screen.getByTestId('bezier-editor')).toBeInTheDocument();
    // The SVG carries role="img" + the aria-label so assistive tech reads a
    // single accessible name for the editor; the inner <circle> sliders still
    // expose their own aria-label names.
    expect(screen.getByRole('img', { name: /bezier/i })).toBeInTheDocument();
  });

  it('renders two handle circles with slider role + testids', () => {
    render(<BezierEditor value={[0.25, 0.1, 0.75, 0.9]} onChange={() => {}} ariaLabel="Curve" />);
    expect(screen.getByTestId('bezier-editor-handle-1')).toBeInTheDocument();
    expect(screen.getByTestId('bezier-editor-handle-2')).toBeInTheDocument();
    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(2);
  });

  it('honors testid override on the root', () => {
    render(
      <BezierEditor
        value={[0.5, 0, 0.5, 1]}
        onChange={() => {}}
        ariaLabel="x"
        testid="custom-bezier"
      />,
    );
    expect(screen.getByTestId('custom-bezier')).toBeInTheDocument();
    expect(screen.getByTestId('custom-bezier-handle-1')).toBeInTheDocument();
    expect(screen.getByTestId('custom-bezier-handle-2')).toBeInTheDocument();
  });

  it('sets data-disabled and aria-valuenow reflects clamped x1/x2', () => {
    render(<BezierEditor value={[1.5, 0, -0.2, 1]} onChange={() => {}} ariaLabel="c" disabled />);
    const root = screen.getByTestId('bezier-editor');
    expect(root).toHaveAttribute('data-disabled', 'true');
    const h1 = screen.getByTestId('bezier-editor-handle-1');
    const h2 = screen.getByTestId('bezier-editor-handle-2');
    // x1 was 1.5 → clamped to 1; x2 was -0.2 → clamped to 0.
    expect(h1).toHaveAttribute('aria-valuenow', '1');
    expect(h2).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('Task DR-8.3: BezierEditor — keyboard', () => {
  it('ArrowRight on handle 1 bumps x1 by +0.01', () => {
    const onChange = vi.fn<(v: BezierTuple) => void>();
    render(<BezierEditor value={[0.25, 0.1, 0.75, 0.9]} onChange={onChange} ariaLabel="c" />);
    fireEvent.keyDown(screen.getByTestId('bezier-editor-handle-1'), {
      key: 'ArrowRight',
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0];
    expect(next).toBeDefined();
    if (!next) throw new Error('expected onChange arg');
    expect(next[0]).toBeCloseTo(0.26, 5);
    expect(next[1]).toBe(0.1);
    expect(next[2]).toBe(0.75);
    expect(next[3]).toBe(0.9);
  });

  it('Shift+ArrowRight on handle 2 bumps x2 by +0.1', () => {
    const onChange = vi.fn<(v: BezierTuple) => void>();
    render(<BezierEditor value={[0.25, 0.1, 0.5, 0.9]} onChange={onChange} ariaLabel="c" />);
    fireEvent.keyDown(screen.getByTestId('bezier-editor-handle-2'), {
      key: 'ArrowRight',
      shiftKey: true,
    });
    const next = onChange.mock.calls[0]?.[0];
    expect(next).toBeDefined();
    if (!next) throw new Error('expected onChange arg');
    expect(next[2]).toBeCloseTo(0.6, 5);
  });

  it('ArrowUp on handle 1 bumps y1 by +0.01', () => {
    const onChange = vi.fn<(v: BezierTuple) => void>();
    render(<BezierEditor value={[0.25, 0.1, 0.75, 0.9]} onChange={onChange} ariaLabel="c" />);
    fireEvent.keyDown(screen.getByTestId('bezier-editor-handle-1'), {
      key: 'ArrowUp',
    });
    const next = onChange.mock.calls[0]?.[0];
    expect(next).toBeDefined();
    if (!next) throw new Error('expected onChange arg');
    expect(next[1]).toBeCloseTo(0.11, 5);
  });

  it('disabled prop suppresses keyboard updates', () => {
    const onChange = vi.fn();
    render(
      <BezierEditor value={[0.25, 0.1, 0.75, 0.9]} onChange={onChange} ariaLabel="c" disabled />,
    );
    fireEvent.keyDown(screen.getByTestId('bezier-editor-handle-1'), {
      key: 'ArrowRight',
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Task DR-8.3: BezierEditor — clamp helpers', () => {
  it('clampX bounds to [0, 1]', () => {
    expect(clampX(-0.5)).toBe(0);
    expect(clampX(0.5)).toBe(0.5);
    expect(clampX(2)).toBe(1);
  });

  it('clampY bounds to [-1, 2]', () => {
    expect(clampY(-5)).toBe(-1);
    expect(clampY(0.5)).toBe(0.5);
    expect(clampY(5)).toBe(2);
  });
});
