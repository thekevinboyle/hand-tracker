/**
 * Unit tests for the handTrackingMosaic manifest (Task 2.5).
 *
 * Tests:
 *   - Registration + listEffects round-trip
 *   - Default param values match DISCOVERY D4/D9/D10
 *   - All required ParamDef keys present (14 total: 13 leaf + 1 button)
 *   - Modulation sources: 21*2 landmark + pinch + centroid.x + centroid.y = 45
 *   - Randomize Grid button rerolls grid.seed
 *   - create(gl).render() invokes drawGrid + drawLandmarkBlobs via ctx.stroke()
 *   - create(gl).render() handles null ctx2d gracefully
 *   - Dev-hook getters have correct initial values
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParamState } from '../../engine/paramStore';
import { paramStore } from '../../engine/paramStore';
import { clearRegistry, listEffects, registerEffect } from '../../engine/registry';
import {
  __getLastBlobCount,
  __getLastGridLayout,
  DEFAULT_PARAM_STATE,
  handTrackingMosaicManifest,
} from './manifest';

describe('Task 2.5: handTrackingMosaic manifest', () => {
  beforeEach(() => {
    clearRegistry();
    // Seed paramStore with the manifest defaults so render() and onClick work.
    paramStore.replace(DEFAULT_PARAM_STATE as unknown as ParamState);
  });

  it('registers exactly one effect with id handTrackingMosaic', () => {
    registerEffect(handTrackingMosaicManifest);
    const all = listEffects();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe('handTrackingMosaic');
  });

  it('manifest has correct id and displayName', () => {
    expect(handTrackingMosaicManifest.id).toBe('handTrackingMosaic');
    expect(handTrackingMosaicManifest.displayName).toBe('Hand Tracking Mosaic');
    expect(handTrackingMosaicManifest.version).toBe('1.0.0');
  });

  it('defaultParams matches DISCOVERY values (D4/D9/D10)', () => {
    expect(DEFAULT_PARAM_STATE.grid.seed).toBe(42);
    expect(DEFAULT_PARAM_STATE.grid.columnCount).toBe(12);
    expect(DEFAULT_PARAM_STATE.grid.rowCount).toBe(8);
    expect(DEFAULT_PARAM_STATE.grid.widthVariance).toBeCloseTo(0.6);
    expect(DEFAULT_PARAM_STATE.grid.lineColor).toBe('#00ff88');
    expect(DEFAULT_PARAM_STATE.grid.lineWeight).toBe(1);
    expect(DEFAULT_PARAM_STATE.mosaic.tileSize).toBe(16);
    expect(DEFAULT_PARAM_STATE.mosaic.blendOpacity).toBeCloseTo(1.0);
    expect(DEFAULT_PARAM_STATE.mosaic.edgeFeather).toBe(0);
    expect(DEFAULT_PARAM_STATE.effect.regionPadding).toBe(1);
    expect(DEFAULT_PARAM_STATE.input.mirrorMode).toBe(true);
    expect(DEFAULT_PARAM_STATE.input.showLandmarks).toBe(true);
    expect(DEFAULT_PARAM_STATE.input.deviceId).toBe('');
  });

  it('params include all required keys', () => {
    const keys = handTrackingMosaicManifest.params.map((p) => p.key);
    const required = [
      'grid.seed',
      'grid.columnCount',
      'grid.rowCount',
      'grid.widthVariance',
      'grid.lineColor',
      'grid.lineWeight',
      'grid.randomize',
      'mosaic.tileSize',
      'mosaic.blendOpacity',
      'mosaic.edgeFeather',
      'effect.regionPadding',
      'input.mirrorMode',
      'input.showLandmarks',
      'input.deviceId',
    ];
    for (const k of required) {
      expect(keys).toContain(k);
    }
    expect(handTrackingMosaicManifest.params.length).toBeGreaterThanOrEqual(14);
  });

  it('modulationSources include 21 landmarks + pinch + centroid', () => {
    const ids = handTrackingMosaicManifest.modulationSources.map((s) => s.id);
    expect(ids).toContain('landmark[0].x');
    expect(ids).toContain('landmark[0].y');
    expect(ids).toContain('landmark[20].x');
    expect(ids).toContain('landmark[20].y');
    expect(ids).toContain('pinch');
    expect(ids).toContain('centroid.x');
    expect(ids).toContain('centroid.y');
    expect(ids).toHaveLength(21 * 2 + 3);
  });

  it('grid.randomize onClick rerolls grid.seed', () => {
    const before = (paramStore.snapshot as Record<string, Record<string, unknown>>).grid?.seed;
    const rand = handTrackingMosaicManifest.params.find((p) => p.key === 'grid.randomize');
    expect(rand?.type).toBe('button');
    if (rand?.type === 'button') {
      rand.onClick(paramStore.snapshot as Record<string, unknown>);
    }
    const after = (paramStore.snapshot as Record<string, Record<string, unknown>>).grid?.seed;
    // The new seed should differ from the default (42). In the extremely
    // unlikely event Math.random produces exactly 42 >>> 0, the test would
    // flake — acceptable probability.
    expect(after).not.toBe(before);
  });

  it('create(gl).render invokes drawGrid and drawLandmarkBlobs', () => {
    const fakeGl = {
      clearColor: vi.fn(),
      clear: vi.fn(),
      COLOR_BUFFER_BIT: 0x4000,
    } as unknown as WebGL2RenderingContext;

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx2d = canvas.getContext('2d') as CanvasRenderingContext2D;

    // Spy on stroke() — both drawGrid and drawLandmarkBlobs call it
    const strokeSpy = vi.spyOn(ctx2d, 'stroke');

    const instance = handTrackingMosaicManifest.create(fakeGl);
    instance.render({
      videoTexture: null,
      videoSize: { w: 640, h: 480 },
      landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })),
      params: {},
      timeMs: 0,
      ctx2d,
    });

    // GL clear was called (noop mosaic placeholder)
    expect(fakeGl.clearColor).toHaveBeenCalled();
    expect(fakeGl.clear).toHaveBeenCalled();
    // stroke() was called at least twice — once for grid, once for blobs
    expect(strokeSpy).toHaveBeenCalled();
    expect(strokeSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

    instance.dispose();
  });

  it('create(gl).render returns early when ctx2d is null', () => {
    const fakeGl = {
      clearColor: vi.fn(),
      clear: vi.fn(),
      COLOR_BUFFER_BIT: 0x4000,
    } as unknown as WebGL2RenderingContext;

    const instance = handTrackingMosaicManifest.create(fakeGl);

    // Should not throw when ctx2d is null
    instance.render({
      videoTexture: null,
      videoSize: { w: 640, h: 480 },
      landmarks: null,
      params: {},
      timeMs: 0,
      ctx2d: null,
    });

    expect(fakeGl.clearColor).toHaveBeenCalled();
    instance.dispose();
  });

  it('render updates __getLastBlobCount and __getLastGridLayout', () => {
    const fakeGl = {
      clearColor: vi.fn(),
      clear: vi.fn(),
      COLOR_BUFFER_BIT: 0x4000,
    } as unknown as WebGL2RenderingContext;

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx2d = canvas.getContext('2d') as CanvasRenderingContext2D;

    const instance = handTrackingMosaicManifest.create(fakeGl);
    instance.render({
      videoTexture: null,
      videoSize: { w: 640, h: 480 },
      landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })),
      params: {},
      timeMs: 0,
      ctx2d,
    });

    // After rendering with 21 landmarks, 5 fingertip blobs should be drawn
    expect(__getLastBlobCount()).toBe(5);
    // Grid layout should be populated with columns and rows
    const layout = __getLastGridLayout();
    expect(layout).not.toBeNull();
    expect(layout?.columns).toHaveLength(12); // default columnCount
    expect(layout?.rows).toHaveLength(8); // default rowCount

    instance.dispose();
  });
});
