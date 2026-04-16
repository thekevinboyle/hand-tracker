/**
 * Hand Tracking Mosaic — effect manifest (Task 2.5 + Task 3.4).
 *
 * Declares every parameter (D4 grid + D9 mosaic + D10 input), default values,
 * modulation sources (D15), and the `create(gl)` factory that returns an
 * `EffectInstance`. Phase 2 (Task 2.5) shipped the no-op version of render()
 * — Phase 3 (Task 3.4) rewired it to compile the real mosaic shaders, call
 * `computeActiveRegions` per frame, push uniforms, and invoke
 * `renderer.render({ scene: mesh })`. The 2D overlay still draws the grid +
 * fingertip blobs on top, and now ALSO pre-composites the WebGL canvas via
 * `drawImage(webglCanvas, …)` so Phase 4's `captureStream()` recording
 * picks up the mosaic (D28 precondition).
 *
 * Renderer + video Texture are sourced through the module brokers
 * `src/engine/rendererRef.ts` + `src/engine/videoTextureRef.ts`, populated
 * by Stage.tsx's useEffect before any render() is dispatched. The manifest
 * signature `create(gl): EffectInstance` is pinned by D36 and unchanged.
 *
 * `satisfies EffectManifest<HandTrackingMosaicParams>` preserves narrow
 * inference while verifying the shape against the generic contract from
 * Task 2.1.
 */

import type {
  EffectInstance,
  EffectManifest,
  FrameContext,
  ModulationSourceDef,
  ParamDef,
} from '../../engine/manifest';
import { paramStore } from '../../engine/paramStore';
import { getRendererOrThrow } from '../../engine/rendererRef';
import { getVideoTexture } from '../../engine/videoTextureRef';
import { drawLandmarkBlobs } from './blobRenderer';
import { buildGridLayout, type GridLayout, generateColumnWidths, generateRowWidths } from './grid';
import { drawGrid } from './gridRenderer';
import { computeActiveRegions } from './region';
import { initMosaicEffect, updateMosaicUniforms } from './render';

// ---------------------------------------------------------------------------
// Param type
// ---------------------------------------------------------------------------

export type HandTrackingMosaicParams = {
  grid: {
    seed: number;
    columnCount: number;
    rowCount: number;
    widthVariance: number;
    lineColor: string;
    lineWeight: number;
  };
  mosaic: {
    tileSize: number;
    blendOpacity: number;
    edgeFeather: number;
  };
  effect: {
    regionPadding: number;
  };
  input: {
    mirrorMode: boolean;
    showLandmarks: boolean;
    deviceId: string;
  };
};

// ---------------------------------------------------------------------------
// Defaults (D4, D9, D10)
// ---------------------------------------------------------------------------

export const DEFAULT_PARAM_STATE: HandTrackingMosaicParams = {
  grid: {
    seed: 42,
    columnCount: 12,
    rowCount: 8,
    widthVariance: 0.6,
    lineColor: '#00ff88',
    lineWeight: 1,
  },
  mosaic: {
    tileSize: 16,
    blendOpacity: 1.0,
    edgeFeather: 0,
  },
  effect: {
    regionPadding: 1,
  },
  input: {
    mirrorMode: true,
    showLandmarks: true,
    deviceId: '',
  },
};

// ---------------------------------------------------------------------------
// Modulation sources (D15 — 21 landmark x/y + pinch + centroid.x/y)
// ---------------------------------------------------------------------------

const DEFAULT_MODULATION_SOURCES: ModulationSourceDef[] = [
  ...Array.from({ length: 21 }, (_, i) => [
    { id: `landmark[${i}].x`, label: `Landmark ${i} X` },
    { id: `landmark[${i}].y`, label: `Landmark ${i} Y` },
  ]).flat(),
  { id: 'pinch', label: 'Pinch strength' },
  { id: 'centroid.x', label: 'Hand centroid X' },
  { id: 'centroid.y', label: 'Hand centroid Y' },
];

// ---------------------------------------------------------------------------
// ParamDef array — one entry per leaf key + 1 button
// ---------------------------------------------------------------------------

const PARAMS: ParamDef[] = [
  // Grid page
  {
    type: 'integer',
    key: 'grid.seed',
    label: 'Seed',
    page: 'Grid',
    defaultValue: 42,
    min: 0,
    max: 2147483647,
    step: 1,
  },
  {
    type: 'integer',
    key: 'grid.columnCount',
    label: 'Columns',
    page: 'Grid',
    defaultValue: 12,
    min: 4,
    max: 32,
    step: 1,
  },
  {
    type: 'integer',
    key: 'grid.rowCount',
    label: 'Rows',
    page: 'Grid',
    defaultValue: 8,
    min: 2,
    max: 24,
    step: 1,
  },
  {
    type: 'number',
    key: 'grid.widthVariance',
    label: 'Width variance',
    page: 'Grid',
    defaultValue: 0.6,
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    type: 'color',
    key: 'grid.lineColor',
    label: 'Line color',
    page: 'Grid',
    defaultValue: '#00ff88',
  },
  {
    type: 'number',
    key: 'grid.lineWeight',
    label: 'Line weight',
    page: 'Grid',
    defaultValue: 1,
    min: 0.5,
    max: 4,
    step: 0.5,
  },
  {
    type: 'button',
    key: 'grid.randomize',
    label: 'Randomize Grid',
    page: 'Grid',
    onClick: () => {
      const seed = (Math.random() * 2 ** 32) >>> 0;
      paramStore.set('grid.seed', seed);
    },
  },
  // Effect page
  {
    type: 'integer',
    key: 'mosaic.tileSize',
    label: 'Tile size',
    page: 'Effect',
    defaultValue: 16,
    min: 4,
    max: 64,
    step: 1,
  },
  {
    type: 'number',
    key: 'mosaic.blendOpacity',
    label: 'Blend opacity',
    page: 'Effect',
    defaultValue: 1.0,
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    type: 'number',
    key: 'mosaic.edgeFeather',
    label: 'Edge feather',
    page: 'Effect',
    defaultValue: 0,
    min: 0,
    max: 8,
    step: 0.5,
  },
  {
    type: 'integer',
    key: 'effect.regionPadding',
    label: 'Region padding',
    page: 'Effect',
    defaultValue: 1,
    min: 0,
    max: 4,
    step: 1,
  },
  // Input page
  {
    type: 'boolean',
    key: 'input.mirrorMode',
    label: 'Mirror',
    page: 'Input',
    defaultValue: true,
  },
  {
    type: 'boolean',
    key: 'input.showLandmarks',
    label: 'Show landmarks',
    page: 'Input',
    defaultValue: true,
  },
  {
    type: 'string',
    key: 'input.deviceId',
    label: 'Camera device',
    page: 'Input',
    defaultValue: '',
  },
];

// ---------------------------------------------------------------------------
// Module-level state for dev hooks
// ---------------------------------------------------------------------------

let lastBlobCount = 0;
let lastGridLayoutValue: GridLayout | null = null;
let lastRegionCount = 0;

export function __getLastBlobCount(): number {
  return lastBlobCount;
}

export function __getLastGridLayout(): GridLayout | null {
  return lastGridLayoutValue;
}

export function __getLastRegionCount(): number {
  return lastRegionCount;
}

// ---------------------------------------------------------------------------
// create() factory (D36, D37)
// ---------------------------------------------------------------------------

function create(gl: WebGL2RenderingContext): EffectInstance {
  const renderer = getRendererOrThrow();
  const texture = getVideoTexture();
  if (!texture) {
    throw new Error(
      'Video texture not initialized — manifest.create() called before Stage mounted the ogl bundle',
    );
  }

  const { mesh, program } = initMosaicEffect(gl, texture);

  // Memoise grid edges by the tuple (seed, columnCount, rowCount, widthVariance)
  // — the breakpoints change only when those params move, so recomputing every
  // frame wastes ~0.3ms at 30fps. Cache both the normalized breakpoints
  // (returned by grid.ts) AND the pixel-space edges with leading 0 prepended
  // (what computeActiveRegions expects) so the hot path does zero allocation
  // beyond the rects result.
  type GridCache = {
    seed: number;
    cols: number;
    rows: number;
    variance: number;
    videoW: number;
    videoH: number;
    colEdgesPx: number[];
    rowEdgesPx: number[];
  };
  let gridCache: GridCache | null = null;

  function edgesFromBreakpoints(breakpoints: readonly number[], size: number): number[] {
    const edges = new Array<number>(breakpoints.length + 1);
    edges[0] = 0;
    for (let i = 0; i < breakpoints.length; i++) {
      const b = breakpoints[i] ?? 0;
      edges[i + 1] = b * size;
    }
    return edges;
  }

  return {
    render(frameCtx: FrameContext): void {
      const snap = paramStore.snapshot as unknown as HandTrackingMosaicParams;
      const { w: videoW, h: videoH } = frameCtx.videoSize;
      const { seed, columnCount: cols, rowCount: rows, widthVariance: variance } = snap.grid;

      if (
        !gridCache ||
        gridCache.seed !== seed ||
        gridCache.cols !== cols ||
        gridCache.rows !== rows ||
        gridCache.variance !== variance ||
        gridCache.videoW !== videoW ||
        gridCache.videoH !== videoH
      ) {
        gridCache = {
          seed,
          cols,
          rows,
          variance,
          videoW,
          videoH,
          colEdgesPx: edgesFromBreakpoints(generateColumnWidths(seed, cols, variance), videoW),
          rowEdgesPx: edgesFromBreakpoints(generateRowWidths(seed, rows, variance), videoH),
        };
      }

      const rects = computeActiveRegions(
        frameCtx.landmarks,
        videoW,
        videoH,
        gridCache.colEdgesPx,
        gridCache.rowEdgesPx,
        snap.effect.regionPadding,
      );
      lastRegionCount = rects.length;

      const canvas = renderer.gl.canvas as HTMLCanvasElement;
      const canvasW = canvas.width;
      const canvasH = canvas.height;

      updateMosaicUniforms(
        program,
        rects,
        {
          tileSize: snap.mosaic.tileSize,
          blendOpacity: snap.mosaic.blendOpacity,
          edgeFeather: snap.mosaic.edgeFeather,
        },
        canvasW,
        canvasH,
      );

      // Effect owns the WebGL draw — renderLoop does NOT call renderer.render()
      // separately (see task-3-4.md "Known Gotchas").
      renderer.render({ scene: mesh });

      // 2D overlay: pre-composite the mosaic first so captureStream() (D28,
      // Phase 4) captures it, then grid + landmark blobs on top. When mirror
      // mode is on, flip the drawImage call — CSS scaleX(-1) on the display
      // canvases does NOT affect the overlay's pixel buffer.
      const ctx2d = frameCtx.ctx2d;
      if (!ctx2d) return;

      const { w, h } = frameCtx.videoSize;
      ctx2d.clearRect(0, 0, w, h);

      const mirror = snap.input.mirrorMode === true;
      if (mirror) {
        ctx2d.save();
        ctx2d.scale(-1, 1);
        ctx2d.translate(-w, 0);
        ctx2d.drawImage(canvas, 0, 0, w, h);
        ctx2d.restore();
      } else {
        ctx2d.drawImage(canvas, 0, 0, w, h);
      }

      const layout = buildGridLayout(snap.grid);
      lastGridLayoutValue = layout;

      drawGrid(
        ctx2d,
        layout,
        { width: w, height: h },
        {
          lineColor: snap.grid.lineColor,
          lineWeight: snap.grid.lineWeight,
        },
      );

      lastBlobCount = drawLandmarkBlobs(
        ctx2d,
        frameCtx.landmarks,
        { width: w, height: h },
        undefined,
        {
          mirror: snap.input.mirrorMode,
          showLandmarks: snap.input.showLandmarks,
        },
      );
    },
    dispose(): void {
      // Delete the WebGL program + shaders. Texture deletion is the
      // renderer's responsibility (Stage.tsx cleanup — Task 3.5 extends).
      program.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// Manifest export
// ---------------------------------------------------------------------------

export const handTrackingMosaicManifest = {
  id: 'handTrackingMosaic',
  displayName: 'Hand Tracking Mosaic',
  version: '1.0.0',
  description: 'Seeded grid overlay + fingertip blobs + hand-region mosaic (WebGL)',
  params: PARAMS,
  defaultParams: DEFAULT_PARAM_STATE,
  modulationSources: DEFAULT_MODULATION_SOURCES,
  create,
} satisfies EffectManifest<HandTrackingMosaicParams>;
