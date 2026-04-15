/**
 * Canvas-2D dotted-circle fingertip blob + xy-label renderer (Task 2.4).
 *
 * Pure function over a `CanvasRenderingContext2D`. Draws exactly one dotted
 * circle per MediaPipe fingertip landmark (D6: indices 4, 8, 12, 16, 20) and
 * a monospace label formatted `x: 0.xxx  y: 0.xxx` (D7, exactly two spaces
 * between the x and y tokens) to the right of each blob.
 *
 * Invariants:
 *   - Mirrors `gridRenderer.ts` (Task 2.3): one `ctx.save()` / `ctx.restore()`
 *     bracket around ALL state mutations so subsequent renderers inherit no
 *     style (strokeStyle, lineWidth, lineDash, fillStyle, font, textBaseline).
 *   - `setLineDash([2, 3])` is applied for the stroked circles and explicitly
 *     reset to `[]` before text is drawn (solid labels, never dashed).
 *   - Pure — NO imports from `paramStore` / React / `ogl` / MediaPipe. The
 *     caller (Task 2.5 render.ts) threads `opts.mirror` and `opts.showLandmarks`
 *     from the paramStore snapshot.
 *   - Mirror handling (D27): landmarks arrive in UNMIRRORED video-space. The
 *     2D overlay canvas mounted by Stage.tsx (Task 1.6) receives CSS
 *     `scaleX(-1)` when mirror-mode is on, so in the running app Task 2.5
 *     passes `mirror: false` — the CSS flip covers the display. When the
 *     canvas is NOT CSS-flipped (e.g. recording contexts, test scenarios),
 *     pass `mirror: true` and this renderer will both flip the blob centre
 *     and counter-rotate the text so labels read correctly.
 *
 * Return value: the number of blobs actually drawn. The caller uses this to
 * populate `window.__handTracker.__engine.getLandmarkBlobCount()` (Task 2.5).
 */

import type { Landmark } from '../../engine/manifest';

/** Fingertip landmark indices per DISCOVERY D6 (thumb, index, middle, ring, pinky). */
export const FINGERTIP_INDICES = [4, 8, 12, 16, 20] as const;
export type FingertipIndex = (typeof FINGERTIP_INDICES)[number];

export type BlobRenderStyle = {
  /** Circle radius in logical pixels. Default 14. */
  blobRadius?: number;
  /** CSS color for the dotted circles. Default '#00ff88'. */
  strokeColor?: string;
  /** Stroke width in logical pixels. Default 2. */
  strokeWidth?: number;
  /** Dash pattern `[on, off]`. Default [2, 3] — the reference dotted look. */
  dashPattern?: readonly [number, number];
  /** CSS font shorthand for the xy label. Default `'11px monospace'`. */
  labelFont?: string;
  /** CSS color for the label text. Default '#00ff88'. */
  labelColor?: string;
  /** Gap in logical pixels between the blob edge and the label. Default 6. */
  labelGap?: number;
};

export type BlobRenderTarget = {
  /** Logical pixel width of the drawable region. */
  width: number;
  /** Logical pixel height of the drawable region. */
  height: number;
};

export type BlobRenderOpts = {
  /**
   * Flip x before drawing. Pass `true` only when the display canvas is NOT
   * CSS-mirrored (default Stage.tsx canvas IS mirrored — pass `false`).
   */
  mirror?: boolean;
  /** Master toggle — if explicitly `false`, nothing is drawn. Default true. */
  showLandmarks?: boolean;
};

/**
 * Format a normalized (x, y) landmark coordinate pair as the D7 label string.
 * Exactly two spaces separate the x and y tokens, and each value is padded to
 * exactly 3 decimal places (e.g. `x: 0.373  y: 0.287`). Exported for reuse +
 * direct unit testing.
 */
export function formatCoordLabel(x: number, y: number): string {
  return `x: ${x.toFixed(3)}  y: ${y.toFixed(3)}`;
}

/**
 * Draw dotted-circle fingertip blobs + xy labels. Returns the count of blobs
 * actually drawn (0..5) so the caller can feed the `getLandmarkBlobCount`
 * dev hook from a single source of truth.
 */
export function drawLandmarkBlobs(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[] | null,
  target: BlobRenderTarget,
  style?: BlobRenderStyle,
  opts?: BlobRenderOpts,
): number {
  if (opts?.showLandmarks === false) return 0;
  if (!landmarks || landmarks.length === 0) return 0;

  const mirror = opts?.mirror ?? false;
  const radius = style?.blobRadius ?? 14;
  const strokeColor = style?.strokeColor ?? '#00ff88';
  const strokeWidth = style?.strokeWidth ?? 2;
  const dash = style?.dashPattern ?? ([2, 3] as const);
  const labelFont = style?.labelFont ?? '11px monospace';
  const labelColor = style?.labelColor ?? '#00ff88';
  const labelGap = style?.labelGap ?? 6;
  const { width, height } = target;

  let drawn = 0;

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  // setLineDash accepts a mutable number[]. Spread the readonly tuple to
  // satisfy the TS overload without widening the stored default.
  ctx.setLineDash([...dash]);
  ctx.beginPath();

  // First pass — batch all circle arcs into a single stroked path. `moveTo`
  // before each `arc` ensures the circles are disjoint (no chord-line between
  // them) since arcs otherwise connect to the current point.
  for (const idx of FINGERTIP_INDICES) {
    const lm = landmarks[idx];
    if (!lm) continue;
    const cx = (mirror ? 1 - lm.x : lm.x) * width;
    const cy = lm.y * height;
    ctx.moveTo(cx + radius, cy);
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    drawn++;
  }

  ctx.stroke();
  // Solid text — reset dash BEFORE labels even though fillText ignores dashes,
  // so the canvas is in a clean state when the batch ends.
  ctx.setLineDash([]);

  // Second pass — labels. Filled text, not stroked, so font/textAlign/baseline
  // are the only new state.
  ctx.fillStyle = labelColor;
  ctx.font = labelFont;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  for (const idx of FINGERTIP_INDICES) {
    const lm = landmarks[idx];
    if (!lm) continue;
    const cx = (mirror ? 1 - lm.x : lm.x) * width;
    const cy = lm.y * height;
    const label = formatCoordLabel(lm.x, lm.y);
    const tx = cx + radius + labelGap;
    if (mirror) {
      // Counter-rotate the text so it reads left-to-right despite the
      // caller-implied mirror flip. Only relevant when the display canvas is
      // NOT already CSS-mirrored (see header note).
      ctx.save();
      ctx.translate(tx, cy);
      ctx.scale(-1, 1);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(label, tx, cy);
    }
  }

  ctx.restore();
  return drawn;
}
