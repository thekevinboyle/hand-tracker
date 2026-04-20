/*
 * src/ui/BezierEditor.tsx — inline cubic-bezier curve editor (Task DR-8.3).
 *
 * Small SVG widget that renders a unit-square preview of a cubic-bezier
 * easing curve + two draggable control points. The curve's end points are
 * anchored at (0, 1) and (1, 0) (CSS cubic-bezier convention — time along
 * X, progress along Y with Y inverted because SVG Y grows downward).
 *
 * Props:
 *   - `value`: [x1, y1, x2, y2] tuple.
 *       · x1/x2 clamped to [0, 1] per CSS cubic-bezier spec
 *       · y1/y2 allowed to overshoot [-1, 2] for "spring" shapes
 *   - `onChange`: fires with a fresh tuple on every pointer drag / key press.
 *   - `ariaLabel`: required a11y name for the wrapper group.
 *   - `testid`: override for the root data-testid (default: `bezier-editor`).
 *
 * Interaction:
 *   - Pointer drag uses `setPointerCapture` so the drag continues even if the
 *     pointer leaves the SVG viewport.
 *   - Keyboard: Tab into a handle, ArrowKeys step ±0.01 (shift → ±0.1).
 *     Space/Enter do nothing (handles are not buttons).
 *
 * Reduced-motion: no intrinsic motion — the curve snaps to the current value
 * on every render. The tokens layer still collapses transition durations for
 * hover styling.
 *
 * Authority:
 *   - task-DR-8-3.md § Step 3 + Known Gotchas.
 *   - `custom-param-components` skill — BezierEditor pattern (own file).
 *   - DISCOVERY.md DR11 — motion + reduced-motion.
 */

import {
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
} from 'react';
import styles from './BezierEditor.module.css';

export type BezierTuple = readonly [number, number, number, number];

export type BezierEditorProps = {
  value: BezierTuple;
  onChange: (next: BezierTuple) => void;
  ariaLabel: string;
  disabled?: boolean;
  testid?: string;
};

// SVG viewBox — 120x80 unit space; the curve renders into the inner box.
const VIEW_W = 120;
const VIEW_H = 80;
const PAD = 10;
const INNER_W = VIEW_W - PAD * 2;
const INNER_H = VIEW_H - PAD * 2;

/** Clamp helper for `x1` / `x2` — CSS cubic-bezier requires [0, 1]. */
export function clampX(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/** Clamp helper for `y1` / `y2` — overshoot permitted in [-1, 2]. */
export function clampY(v: number): number {
  if (v < -1) return -1;
  if (v > 2) return 2;
  return v;
}

/** Convert a [0,1] t + control-y into SVG pixel coords (y inverted). */
export function unitToSvg(tx: number, ty: number): { x: number; y: number } {
  return {
    x: PAD + tx * INNER_W,
    // Map ty=0 → bottom, ty=1 → top (CSS cubic-bezier: higher Y = further).
    // Overshoot allowed ([-1,2] domain): pad the inner box so the path can
    // draw outside without clipping, but keep the anchor reference at [0,1].
    y: PAD + (1 - ty) * INNER_H,
  };
}

/** Inverse of `unitToSvg` for pointer-event coords. */
function svgToUnit(sx: number, sy: number): { tx: number; ty: number } {
  return {
    tx: (sx - PAD) / INNER_W,
    ty: 1 - (sy - PAD) / INNER_H,
  };
}

export function BezierEditor(props: BezierEditorProps): JSX.Element {
  const { value, onChange, ariaLabel, disabled = false, testid } = props;
  const [x1, y1, x2, y2] = value;
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Which handle is currently being dragged (0 = P1, 1 = P2, null = none).
  const activeHandle = useRef<0 | 1 | null>(null);

  const start = unitToSvg(0, 0);
  const end = unitToSvg(1, 1);
  const p1 = unitToSvg(clampX(x1), y1);
  const p2 = unitToSvg(clampX(x2), y2);

  // Convert client-space pointer coords to SVG user-space. Using
  // `getScreenCTM` inverse keeps this accurate under any transform / scroll.
  const clientToSvg = useCallback((evt: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    const local = pt.matrixTransform(inv);
    return { x: local.x, y: local.y };
  }, []);

  const updateHandle = useCallback(
    (handle: 0 | 1, tx: number, ty: number): void => {
      if (handle === 0) {
        onChange([clampX(tx), clampY(ty), x2, y2]);
      } else {
        onChange([x1, y1, clampX(tx), clampY(ty)]);
      }
    },
    [onChange, x1, y1, x2, y2],
  );

  const handlePointerDown = useCallback(
    (handle: 0 | 1) => (evt: ReactPointerEvent<SVGCircleElement>) => {
      if (disabled) return;
      evt.stopPropagation();
      activeHandle.current = handle;
      // Capture on the SVG root so pointermove continues even if the pointer
      // drifts outside the circle.
      const svg = svgRef.current;
      if (svg) svg.setPointerCapture(evt.pointerId);
    },
    [disabled],
  );

  const handlePointerMove = useCallback(
    (evt: ReactPointerEvent<SVGSVGElement>) => {
      if (activeHandle.current === null || disabled) return;
      const { x: sx, y: sy } = clientToSvg(evt);
      const { tx, ty } = svgToUnit(sx, sy);
      updateHandle(activeHandle.current, tx, ty);
    },
    [clientToSvg, disabled, updateHandle],
  );

  const handlePointerUp = useCallback((evt: ReactPointerEvent<SVGSVGElement>) => {
    activeHandle.current = null;
    const svg = svgRef.current;
    if (svg?.hasPointerCapture(evt.pointerId)) {
      svg.releasePointerCapture(evt.pointerId);
    }
  }, []);

  const handleKeyDown = useCallback(
    (handle: 0 | 1) => (evt: ReactKeyboardEvent<SVGCircleElement>) => {
      if (disabled) return;
      const step = evt.shiftKey ? 0.1 : 0.01;
      let dx = 0;
      let dy = 0;
      switch (evt.key) {
        case 'ArrowLeft':
          dx = -step;
          break;
        case 'ArrowRight':
          dx = step;
          break;
        case 'ArrowUp':
          dy = step;
          break;
        case 'ArrowDown':
          dy = -step;
          break;
        default:
          return;
      }
      evt.preventDefault();
      const [hx, hy] = handle === 0 ? [x1, y1] : [x2, y2];
      updateHandle(handle, hx + dx, hy + dy);
    },
    [disabled, updateHandle, x1, y1, x2, y2],
  );

  const rootTestid = testid ?? 'bezier-editor';

  // Path: M start → C p1 p2 end (cubic bezier)
  const path = `M ${start.x} ${start.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${end.x} ${end.y}`;

  return (
    <div
      className={styles.root}
      data-testid={rootTestid}
      data-disabled={disabled ? 'true' : undefined}
    >
      {/* `<svg role="img">` is permitted by WAI-ARIA even when the SVG holds
       *   interactive children; the nested `role="slider"` circles retain
       *   their own a11y names. `<title>` provides the accessible name that
       *   biome's `noSvgWithoutTitle` rule wants. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className={styles.svg}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <title>{ariaLabel}</title>
        {/* Frame */}
        <rect
          x={PAD}
          y={PAD}
          width={INNER_W}
          height={INNER_H}
          className={styles.frame}
          fill="none"
        />
        {/* Diagonal reference (linear identity) */}
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className={styles.diagonal} />
        {/* Control-point guide lines */}
        <line x1={start.x} y1={start.y} x2={p1.x} y2={p1.y} className={styles.guide} />
        <line x1={end.x} y1={end.y} x2={p2.x} y2={p2.y} className={styles.guide} />
        {/* Curve */}
        <path d={path} className={styles.curve} fill="none" />
        {/* Handles */}
        <circle
          cx={p1.x}
          cy={p1.y}
          r={5}
          className={styles.handle}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={`${ariaLabel} control point 1`}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={clampX(x1)}
          data-testid={`${rootTestid}-handle-1`}
          onPointerDown={handlePointerDown(0)}
          onKeyDown={handleKeyDown(0)}
        />
        <circle
          cx={p2.x}
          cy={p2.y}
          r={5}
          className={styles.handle}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={`${ariaLabel} control point 2`}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={clampX(x2)}
          data-testid={`${rootTestid}-handle-2`}
          onPointerDown={handlePointerDown(1)}
          onKeyDown={handleKeyDown(1)}
        />
      </svg>
    </div>
  );
}
