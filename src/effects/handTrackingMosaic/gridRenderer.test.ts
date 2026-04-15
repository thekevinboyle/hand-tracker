import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridLayout } from './grid';
import { drawGrid } from './gridRenderer';

/**
 * vitest-canvas-mock is wired globally via src/test/setup.ts, so
 * `canvas.getContext('2d')` returns a recording stub with all
 * CanvasRenderingContext2D methods as vi.fn spies.
 */
function make2d(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('vitest-canvas-mock should provide a 2D context');
  return ctx;
}

const LAYOUT_12x8: GridLayout = {
  // 12 breakpoints — 11 interior vertical lines.
  columns: [
    1 / 12,
    2 / 12,
    3 / 12,
    4 / 12,
    5 / 12,
    6 / 12,
    7 / 12,
    8 / 12,
    9 / 12,
    10 / 12,
    11 / 12,
    1,
  ],
  // 8 breakpoints — 7 interior horizontal lines.
  rows: [1 / 8, 2 / 8, 3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8, 1],
};

const STYLE = { lineColor: '#ff00aa', lineWeight: 1.5 } as const;
const TARGET = { width: 800, height: 600 } as const;

describe('effects/handTrackingMosaic/gridRenderer — drawGrid', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = make2d();
  });

  it('draws N-1 vertical lines for N columns (11 interior for 12)', () => {
    const moveTo = vi.spyOn(ctx, 'moveTo');
    const lineTo = vi.spyOn(ctx, 'lineTo');
    drawGrid(ctx, LAYOUT_12x8, TARGET, STYLE);
    // 11 vertical + 7 horizontal = 18 pairs.
    expect(moveTo).toHaveBeenCalledTimes(18);
    expect(lineTo).toHaveBeenCalledTimes(18);
    // First 11 moveTo calls should all use x at column * width with y=0.
    for (let i = 0; i < 11; i++) {
      const expectedX = ((i + 1) / 12) * TARGET.width;
      const call = moveTo.mock.calls[i] as [number, number] | undefined;
      expect(call).toBeDefined();
      expect(call?.[0]).toBeCloseTo(expectedX, 6);
      expect(call?.[1]).toBe(0);
    }
  });

  it('draws M-1 horizontal lines for M rows (7 interior for 8)', () => {
    const moveTo = vi.spyOn(ctx, 'moveTo');
    drawGrid(ctx, LAYOUT_12x8, TARGET, STYLE);
    // Horizontal segments start at index 11 (after 11 vertical lines).
    for (let i = 0; i < 7; i++) {
      const expectedY = ((i + 1) / 8) * TARGET.height;
      const call = moveTo.mock.calls[11 + i] as [number, number] | undefined;
      expect(call).toBeDefined();
      expect(call?.[0]).toBe(0);
      expect(call?.[1]).toBeCloseTo(expectedY, 6);
    }
  });

  it('batches draws into a single beginPath + stroke', () => {
    const beginPath = vi.spyOn(ctx, 'beginPath');
    const stroke = vi.spyOn(ctx, 'stroke');
    drawGrid(ctx, LAYOUT_12x8, TARGET, STYLE);
    expect(beginPath).toHaveBeenCalledTimes(1);
    expect(stroke).toHaveBeenCalledTimes(1);
  });

  it('wraps all state mutations in save()/restore()', () => {
    const save = vi.spyOn(ctx, 'save');
    const restore = vi.spyOn(ctx, 'restore');
    drawGrid(ctx, LAYOUT_12x8, TARGET, STYLE);
    expect(save).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('sets strokeStyle to the provided lineColor (via recorded events)', () => {
    drawGrid(ctx, LAYOUT_12x8, TARGET, STYLE);
    // save()/restore() pops the stack so the post-draw getter returns the
    // default. Inspect the recorded event stream from jest-canvas-mock to
    // confirm the assignment actually happened inside the batch.
    type CanvasEvent = { type: string; props: Record<string, unknown> };
    const events = (ctx as unknown as { __getEvents?: () => CanvasEvent[] }).__getEvents?.() ?? [];
    const strokeStyleEvent = events.find((e) => e.type === 'strokeStyle');
    expect(strokeStyleEvent).toBeDefined();
    expect(strokeStyleEvent?.props?.value).toBe(STYLE.lineColor);
  });

  it('sets lineWidth to the provided lineWeight (via recorded events)', () => {
    drawGrid(ctx, LAYOUT_12x8, TARGET, STYLE);
    type CanvasEvent = { type: string; props: Record<string, unknown> };
    const events = (ctx as unknown as { __getEvents?: () => CanvasEvent[] }).__getEvents?.() ?? [];
    const lineWidthEvent = events.find((e) => e.type === 'lineWidth');
    expect(lineWidthEvent).toBeDefined();
    expect(lineWidthEvent?.props?.value).toBe(STYLE.lineWeight);
  });

  it('calls setLineDash([]) before stroking so inherited dash does not bleed', () => {
    const setLineDash = vi.spyOn(ctx, 'setLineDash');
    drawGrid(ctx, LAYOUT_12x8, TARGET, STYLE);
    expect(setLineDash).toHaveBeenCalledTimes(1);
    expect(setLineDash).toHaveBeenCalledWith([]);
  });

  it('drawBorder=true adds a rect() spanning the full target', () => {
    const rect = vi.spyOn(ctx, 'rect');
    drawGrid(ctx, LAYOUT_12x8, TARGET, { ...STYLE, drawBorder: true });
    expect(rect).toHaveBeenCalledTimes(1);
    expect(rect).toHaveBeenCalledWith(0, 0, TARGET.width, TARGET.height);
  });

  it('drawBorder omitted does not add a rect', () => {
    const rect = vi.spyOn(ctx, 'rect');
    drawGrid(ctx, LAYOUT_12x8, TARGET, STYLE);
    expect(rect).not.toHaveBeenCalled();
  });

  it('handles zero-row, zero-column layouts without throwing and draws nothing', () => {
    const moveTo = vi.spyOn(ctx, 'moveTo');
    const stroke = vi.spyOn(ctx, 'stroke');
    expect(() => drawGrid(ctx, { columns: [], rows: [] }, TARGET, STYLE)).not.toThrow();
    expect(moveTo).not.toHaveBeenCalled();
    // A single empty stroke() is still issued to keep the save/restore bracket.
    expect(stroke).toHaveBeenCalledTimes(1);
  });

  it('handles 1-column / 1-row degenerate layouts (no interior lines)', () => {
    const moveTo = vi.spyOn(ctx, 'moveTo');
    drawGrid(ctx, { columns: [1], rows: [1] }, TARGET, STYLE);
    expect(moveTo).not.toHaveBeenCalled();
  });
});
