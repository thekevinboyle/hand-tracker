/**
 * Canvas-2D grid overlay renderer (Task 2.3).
 *
 * Pure function over a `CanvasRenderingContext2D`. Given a `GridLayout`
 * (normalized breakpoints from `grid.ts`), a `GridRenderTarget` sizing pair
 * in logical pixels, and a `GridRenderStyle`, draws the interior grid lines
 * in a single batched path so that the whole grid costs ONE `stroke()` call.
 *
 * Invariants:
 *   - Brackets every state mutation between `save()` / `restore()` so other
 *     consumers of the same 2D ctx (Task 2.4 blob renderer) inherit no style.
 *   - Calls `setLineDash([])` explicitly — neighbouring draw code may have
 *     left a dashed pattern active.
 *   - Caller has already applied the DPR transform (Stage.tsx from Task 1.6),
 *     so widths/heights are consumed as logical pixels.
 *
 * Caller owns `ctx.clearRect()` — the renderer is additive by design; multiple
 * renderers (grid + blobs + labels) will draw into the same frame.
 */

import type { GridLayout } from './grid';

export type GridRenderStyle = {
  /** CSS color string (e.g. '#fff', 'rgba(255,255,255,0.6)'). */
  lineColor: string;
  /** Stroke width in logical pixels. */
  lineWeight: number;
  /**
   * When true, also draws the outer 0..width × 0..height border rectangle.
   * Default false — Stage's canvas background is typically the border.
   */
  drawBorder?: boolean;
};

export type GridRenderTarget = {
  /** Logical pixel width of the drawable region. */
  width: number;
  /** Logical pixel height of the drawable region. */
  height: number;
};

/**
 * Draw vertical + horizontal interior grid lines defined by `layout` into
 * `ctx`. Interior-only means the final breakpoint (which is always 1.0) is
 * NOT stroked as a line — it would coincide with the canvas edge. Pass
 * `drawBorder: true` to explicitly stroke the outer rectangle.
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  target: GridRenderTarget,
  style: GridRenderStyle,
): void {
  const { width, height } = target;
  const { lineColor, lineWeight, drawBorder = false } = style;

  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWeight;
  ctx.setLineDash([]);
  ctx.beginPath();

  // Interior vertical lines — skip the last breakpoint (== 1.0, coincides with
  // the right edge); `drawBorder` handles that edge explicitly if requested.
  const colLen = layout.columns.length;
  for (let i = 0; i < colLen - 1; i++) {
    const u = layout.columns[i] ?? 0;
    const x = u * width;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }

  // Interior horizontal lines — same treatment for the bottom edge.
  const rowLen = layout.rows.length;
  for (let i = 0; i < rowLen - 1; i++) {
    const v = layout.rows[i] ?? 0;
    const y = v * height;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }

  if (drawBorder) {
    ctx.rect(0, 0, width, height);
  }

  ctx.stroke();
  ctx.restore();
}
