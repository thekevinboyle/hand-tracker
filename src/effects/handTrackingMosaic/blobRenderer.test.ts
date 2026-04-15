import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Landmark } from '../../engine/manifest';
import { drawLandmarkBlobs, FINGERTIP_INDICES, formatCoordLabel } from './blobRenderer';

/**
 * vitest-canvas-mock is wired globally via src/test/setup.ts, so
 * `canvas.getContext('2d')` returns a jest-canvas-mock recording stub.
 *
 * jest-canvas-mock pops property assignments (strokeStyle, lineWidth,
 * setLineDash, fillStyle, font, textAlign, textBaseline) off the state stack
 * on `restore()`, so post-draw getters return defaults. Inspect the event
 * stream via `(ctx as { __getEvents }).__getEvents()` when asserting state
 * that was set inside the save()/restore() bracket.
 */
type CanvasEvent = { type: string; props: Record<string, unknown> };
function getEvents(ctx: CanvasRenderingContext2D): CanvasEvent[] {
  return (ctx as unknown as { __getEvents?: () => CanvasEvent[] }).__getEvents?.() ?? [];
}

function make2d(w = 640, h = 480): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('vitest-canvas-mock should provide a 2D context');
  return ctx;
}

/**
 * Build a 21-landmark array (MediaPipe hand topology) with per-index overrides.
 * Defaults put everything at (0.5, 0.5) so x / y assertions isolate the
 * overridden index.
 */
function makeLandmarks(
  overrides?: Record<number, { x?: number; y?: number; z?: number }>,
): Landmark[] {
  return Array.from({ length: 21 }, (_, i): Landmark => {
    const o = overrides?.[i];
    return { x: o?.x ?? 0.5, y: o?.y ?? 0.5, z: o?.z ?? 0, visibility: 1 };
  });
}

const TARGET = { width: 640, height: 480 } as const;

describe('effects/handTrackingMosaic/blobRenderer — formatCoordLabel', () => {
  it('pads both coordinates to exactly 3 decimals with two spaces between', () => {
    expect(formatCoordLabel(0.373, 0.287)).toBe('x: 0.373  y: 0.287');
  });

  it('rounds long decimals via toFixed(3)', () => {
    expect(formatCoordLabel(0.1234567, 0.8765432)).toBe('x: 0.123  y: 0.877');
  });

  it('pads trailing zeros', () => {
    expect(formatCoordLabel(0.1, 0.2)).toBe('x: 0.100  y: 0.200');
  });

  it('matches the D7 regex /^x: \\d\\.\\d{3}  y: \\d\\.\\d{3}$/', () => {
    expect(formatCoordLabel(0.5, 0.5)).toMatch(/^x: \d\.\d{3} {2}y: \d\.\d{3}$/);
  });
});

describe('effects/handTrackingMosaic/blobRenderer — drawLandmarkBlobs', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = make2d();
  });

  it('returns 0 and performs no draws when landmarks is null', () => {
    const arc = vi.spyOn(ctx, 'arc');
    const fillText = vi.spyOn(ctx, 'fillText');
    const drawn = drawLandmarkBlobs(ctx, null, TARGET);
    expect(drawn).toBe(0);
    expect(arc).not.toHaveBeenCalled();
    expect(fillText).not.toHaveBeenCalled();
  });

  it('returns 0 and performs no draws when landmarks is an empty array', () => {
    const arc = vi.spyOn(ctx, 'arc');
    const drawn = drawLandmarkBlobs(ctx, [], TARGET);
    expect(drawn).toBe(0);
    expect(arc).not.toHaveBeenCalled();
  });

  it('returns 0 and performs no draws when opts.showLandmarks === false', () => {
    const arc = vi.spyOn(ctx, 'arc');
    const save = vi.spyOn(ctx, 'save');
    const drawn = drawLandmarkBlobs(ctx, makeLandmarks(), TARGET, undefined, {
      showLandmarks: false,
    });
    expect(drawn).toBe(0);
    expect(arc).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('draws exactly 5 circles for a complete 21-landmark array', () => {
    const arc = vi.spyOn(ctx, 'arc');
    const drawn = drawLandmarkBlobs(ctx, makeLandmarks(), TARGET);
    expect(drawn).toBe(5);
    expect(arc).toHaveBeenCalledTimes(5);
  });

  it('draws at the fingertip indices (4, 8, 12, 16, 20), not at the wrist', () => {
    const arc = vi.spyOn(ctx, 'arc');
    // Unique (x, y) for each fingertip so the arc coordinates are identifiable.
    const lms = makeLandmarks({
      4: { x: 0.1, y: 0.2 },
      8: { x: 0.3, y: 0.4 },
      12: { x: 0.5, y: 0.6 },
      16: { x: 0.7, y: 0.8 },
      20: { x: 0.9, y: 0.95 },
      // A decoy at the wrist (0) that should NOT be drawn.
      0: { x: 0.01, y: 0.01 },
    });
    drawLandmarkBlobs(ctx, lms, TARGET);
    const xs = arc.mock.calls.map((c) => (c as [number, number, number, number, number])[0]);
    const ys = arc.mock.calls.map((c) => (c as [number, number, number, number, number])[1]);
    expect(xs).toEqual([
      0.1 * TARGET.width,
      0.3 * TARGET.width,
      0.5 * TARGET.width,
      0.7 * TARGET.width,
      0.9 * TARGET.width,
    ]);
    expect(ys).toEqual([
      0.2 * TARGET.height,
      0.4 * TARGET.height,
      0.6 * TARGET.height,
      0.8 * TARGET.height,
      0.95 * TARGET.height,
    ]);
    // Wrist (0.01, 0.01) must not appear.
    expect(xs).not.toContain(0.01 * TARGET.width);
  });

  it('defensively skips fingertip indices beyond a partial landmark array', () => {
    const arc = vi.spyOn(ctx, 'arc');
    // Only 12 landmarks — indices 16 and 20 are undefined.
    const partial: Landmark[] = Array.from({ length: 12 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 1,
    }));
    const drawn = drawLandmarkBlobs(ctx, partial, TARGET);
    // length 12 → valid indices 0..11. Fingertips 4, 8 present; 12, 16, 20 out of bounds.
    expect(drawn).toBe(2);
    expect(arc).toHaveBeenCalledTimes(2);
  });

  it('calls setLineDash([2, 3]) before stroke and resets to [] before labels', () => {
    const setLineDash = vi.spyOn(ctx, 'setLineDash');
    const stroke = vi.spyOn(ctx, 'stroke');
    const fillText = vi.spyOn(ctx, 'fillText');
    drawLandmarkBlobs(ctx, makeLandmarks(), TARGET);
    expect(setLineDash).toHaveBeenCalledTimes(2);
    const firstCall = setLineDash.mock.calls[0] as [number[]] | undefined;
    const secondCall = setLineDash.mock.calls[1] as [number[]] | undefined;
    expect(firstCall?.[0]).toEqual([2, 3]);
    expect(secondCall?.[0]).toEqual([]);
    // Call order invariant: setLineDash([2,3]) → stroke() → setLineDash([]) → fillText(…).
    const firstDashOrder = setLineDash.mock.invocationCallOrder[0] as number;
    const strokeOrder = stroke.mock.invocationCallOrder[0] as number;
    const secondDashOrder = setLineDash.mock.invocationCallOrder[1] as number;
    const firstFillOrder = fillText.mock.invocationCallOrder[0] as number;
    expect(firstDashOrder).toBeLessThan(strokeOrder);
    expect(strokeOrder).toBeLessThan(secondDashOrder);
    expect(secondDashOrder).toBeLessThan(firstFillOrder);
  });

  it('wraps all state mutations in a single save()/restore() bracket', () => {
    const save = vi.spyOn(ctx, 'save');
    const restore = vi.spyOn(ctx, 'restore');
    drawLandmarkBlobs(ctx, makeLandmarks(), TARGET);
    // Outer bracket only (mirror=false path has no inner save/restore).
    expect(save).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('applies default strokeColor and lineWidth via recorded events', () => {
    drawLandmarkBlobs(ctx, makeLandmarks(), TARGET);
    const events = getEvents(ctx);
    const strokeStyle = events.find((e) => e.type === 'strokeStyle');
    const lineWidth = events.find((e) => e.type === 'lineWidth');
    expect(strokeStyle?.props.value).toBe('#00ff88');
    expect(lineWidth?.props.value).toBe(2);
  });

  it('applies custom style overrides (strokeColor, strokeWidth, dashPattern)', () => {
    const setLineDash = vi.spyOn(ctx, 'setLineDash');
    drawLandmarkBlobs(ctx, makeLandmarks(), TARGET, {
      strokeColor: '#ff00aa',
      strokeWidth: 4,
      dashPattern: [5, 2],
    });
    const events = getEvents(ctx);
    expect(events.find((e) => e.type === 'strokeStyle')?.props.value).toBe('#ff00aa');
    expect(events.find((e) => e.type === 'lineWidth')?.props.value).toBe(4);
    const firstCall = setLineDash.mock.calls[0] as [number[]] | undefined;
    expect(firstCall?.[0]).toEqual([5, 2]);
  });

  it('emits one fillText call per fingertip with D7-formatted labels', () => {
    const fillText = vi.spyOn(ctx, 'fillText');
    const lms = makeLandmarks({
      4: { x: 0.111, y: 0.222 },
      8: { x: 0.373, y: 0.287 },
      12: { x: 0.5, y: 0.5 },
      16: { x: 0.75, y: 0.6666 },
      20: { x: 0.9, y: 0.99 },
    });
    drawLandmarkBlobs(ctx, lms, TARGET);
    expect(fillText).toHaveBeenCalledTimes(5);
    const texts = fillText.mock.calls.map((c) => (c as [string, number, number])[0]);
    expect(texts).toEqual([
      'x: 0.111  y: 0.222',
      'x: 0.373  y: 0.287',
      'x: 0.500  y: 0.500',
      'x: 0.750  y: 0.667',
      'x: 0.900  y: 0.990',
    ]);
    for (const t of texts) {
      expect(t).toMatch(/^x: \d\.\d{3} {2}y: \d\.\d{3}$/);
    }
  });

  it('positions each label at (cx + radius + labelGap, cy) when mirror=false', () => {
    const fillText = vi.spyOn(ctx, 'fillText');
    const lms = makeLandmarks({ 8: { x: 0.25, y: 0.5 } });
    drawLandmarkBlobs(ctx, lms, TARGET, { blobRadius: 10, labelGap: 6 });
    // Index 8 is the second fingertip drawn (after 4).
    const call = fillText.mock.calls[1] as [string, number, number] | undefined;
    expect(call).toBeDefined();
    const expectedCx = 0.25 * TARGET.width;
    const expectedCy = 0.5 * TARGET.height;
    expect(call?.[1]).toBeCloseTo(expectedCx + 10 + 6, 6);
    expect(call?.[2]).toBeCloseTo(expectedCy, 6);
  });

  it('mirror=true flips x for the blob centre (cx = (1 - lm.x) * width)', () => {
    const arc = vi.spyOn(ctx, 'arc');
    // Single fingertip with a distinctive x; others default to 0.5 (cx = 320 regardless of mirror).
    const lms = makeLandmarks({ 8: { x: 0.25, y: 0.5 } });
    drawLandmarkBlobs(ctx, lms, TARGET, undefined, { mirror: true });
    // Index 8 is the SECOND arc (thumb @ 4 is first, still at 0.5 → 320 mirrored → 320).
    const secondArc = arc.mock.calls[1] as [number, number, number, number, number] | undefined;
    expect(secondArc?.[0]).toBeCloseTo(TARGET.width - 0.25 * TARGET.width, 6); // = 480, not 160
    expect(secondArc?.[1]).toBeCloseTo(0.5 * TARGET.height, 6);
  });

  it('mirror=true counter-rotates label text via an inner save/scale/restore', () => {
    const save = vi.spyOn(ctx, 'save');
    const restore = vi.spyOn(ctx, 'restore');
    const scale = vi.spyOn(ctx, 'scale');
    drawLandmarkBlobs(ctx, makeLandmarks(), TARGET, undefined, { mirror: true });
    // Outer + one inner save per drawn label = 1 + 5 = 6 saves.
    expect(save).toHaveBeenCalledTimes(1 + FINGERTIP_INDICES.length);
    expect(restore).toHaveBeenCalledTimes(1 + FINGERTIP_INDICES.length);
    // Every scale() call should flip x.
    for (const call of scale.mock.calls) {
      expect(call).toEqual([-1, 1]);
    }
  });

  it('sets textBaseline=middle and textAlign=left via recorded events', () => {
    drawLandmarkBlobs(ctx, makeLandmarks(), TARGET);
    const events = getEvents(ctx);
    const baseline = events.find((e) => e.type === 'textBaseline');
    const align = events.find((e) => e.type === 'textAlign');
    const font = events.find((e) => e.type === 'font');
    expect(baseline?.props.value).toBe('middle');
    expect(align?.props.value).toBe('left');
    expect(font?.props.value).toBe('11px monospace');
  });

  it('sets fillStyle to the default labelColor via recorded events', () => {
    drawLandmarkBlobs(ctx, makeLandmarks(), TARGET);
    const events = getEvents(ctx);
    const fillStyle = events.find((e) => e.type === 'fillStyle');
    expect(fillStyle?.props.value).toBe('#00ff88');
  });

  it('batches all circles into a single stroke() call', () => {
    const beginPath = vi.spyOn(ctx, 'beginPath');
    const stroke = vi.spyOn(ctx, 'stroke');
    drawLandmarkBlobs(ctx, makeLandmarks(), TARGET);
    expect(beginPath).toHaveBeenCalledTimes(1);
    expect(stroke).toHaveBeenCalledTimes(1);
  });
});
