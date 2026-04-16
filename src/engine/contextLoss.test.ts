/**
 * Unit tests for the context-loss helpers (Task 3.5).
 *
 * The real WEBGL_lose_context extension is driver-dependent and not
 * available in jsdom, so the integration case is gated to Playwright
 * (`tests/e2e/task-3-5.spec.ts`). Here we assert the contract: handlers
 * fire the synchronous preventDefault(), the detach function actually
 * removes listeners, and disposeRenderer drops every resource in the
 * documented order with idempotent double-invocation safety.
 */

import type { Renderer, Texture } from 'ogl';
import { describe, expect, it, vi } from 'vitest';
import { attachContextLossHandlers, disposeRenderer } from './renderer';

function makeCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

describe('attachContextLossHandlers', () => {
  it('calls event.preventDefault() synchronously inside webglcontextlost', () => {
    const canvas = makeCanvas();
    const onLost = vi.fn();
    const onRestored = vi.fn();
    attachContextLossHandlers(canvas, { onLost, onRestored });

    // Wrap a real Event so defaultPrevented reflects the synchronous call.
    const lostEvent = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lostEvent);

    expect(lostEvent.defaultPrevented).toBe(true);
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(onLost).toHaveBeenCalledWith(lostEvent);
  });

  it('fires onRestored on webglcontextrestored (without preventDefault)', () => {
    const canvas = makeCanvas();
    const onLost = vi.fn();
    const onRestored = vi.fn();
    attachContextLossHandlers(canvas, { onLost, onRestored });

    const restoredEvent = new Event('webglcontextrestored', { cancelable: true });
    canvas.dispatchEvent(restoredEvent);
    expect(restoredEvent.defaultPrevented).toBe(false);
    expect(onRestored).toHaveBeenCalledTimes(1);
  });

  it('returns a detach fn that removes both listeners', () => {
    const canvas = makeCanvas();
    const onLost = vi.fn();
    const onRestored = vi.fn();
    const detach = attachContextLossHandlers(canvas, { onLost, onRestored });

    detach();
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));

    expect(onLost).not.toHaveBeenCalled();
    expect(onRestored).not.toHaveBeenCalled();
  });

  it('detach is idempotent under double-invocation (StrictMode safety)', () => {
    const canvas = makeCanvas();
    const detach = attachContextLossHandlers(canvas, {
      onLost: vi.fn(),
      onRestored: vi.fn(),
    });
    expect(() => {
      detach();
      detach();
    }).not.toThrow();
  });
});

describe('disposeRenderer', () => {
  function makeFakeBundle() {
    const deleteTexture = vi.fn();
    const getExtension = vi.fn().mockReturnValue({ loseContext: vi.fn() });
    const renderer = {
      gl: { deleteTexture, getExtension },
    } as unknown as Renderer;
    const texture = { texture: { __tag: 'gl-texture' } } as unknown as Texture;
    const ro = { disconnect: vi.fn() } as unknown as ResizeObserver;
    const detachCtxLoss = vi.fn();
    const videoEl = {
      cancelVideoFrameCallback: vi.fn(),
    } as unknown as HTMLVideoElement;
    return { renderer, texture, ro, detachCtxLoss, videoEl, deleteTexture, getExtension };
  }

  it('cancels rVFC when the handle is defined', () => {
    const { renderer, texture, ro, detachCtxLoss, videoEl } = makeFakeBundle();
    disposeRenderer({
      renderer,
      texture,
      resizeObserver: ro,
      detachCtxLoss,
      rVFCHandle: 42,
      videoEl,
    });
    expect(videoEl.cancelVideoFrameCallback).toHaveBeenCalledWith(42);
  });

  it('skips rVFC cancel when handle is undefined', () => {
    const { renderer, texture, ro, detachCtxLoss, videoEl } = makeFakeBundle();
    disposeRenderer({ renderer, texture, resizeObserver: ro, detachCtxLoss, videoEl });
    expect(videoEl.cancelVideoFrameCallback).not.toHaveBeenCalled();
  });

  it('disconnects the ResizeObserver', () => {
    const { renderer, texture, ro, detachCtxLoss } = makeFakeBundle();
    disposeRenderer({ renderer, texture, resizeObserver: ro, detachCtxLoss });
    expect(ro.disconnect).toHaveBeenCalledTimes(1);
  });

  it('detaches the context-loss listeners', () => {
    const { renderer, texture, detachCtxLoss } = makeFakeBundle();
    disposeRenderer({ renderer, texture, detachCtxLoss });
    expect(detachCtxLoss).toHaveBeenCalledTimes(1);
  });

  it('calls gl.deleteTexture on texture.texture', () => {
    const { renderer, texture, deleteTexture } = makeFakeBundle();
    disposeRenderer({ renderer, texture });
    expect(deleteTexture).toHaveBeenCalledWith(
      (texture as unknown as { texture: unknown }).texture,
    );
  });

  it('skips gl.deleteTexture when either renderer or texture is null', () => {
    const { renderer, texture, deleteTexture } = makeFakeBundle();
    disposeRenderer({ renderer: null, texture });
    disposeRenderer({ renderer, texture: null });
    expect(deleteTexture).not.toHaveBeenCalled();
  });

  it('forceLoseContext=true invokes WEBGL_lose_context.loseContext()', () => {
    const { renderer, texture, getExtension } = makeFakeBundle();
    disposeRenderer({ renderer, texture, forceLoseContext: true });
    expect(getExtension).toHaveBeenCalledWith('WEBGL_lose_context');
  });

  it('forceLoseContext=false (default) skips the extension lookup', () => {
    const { renderer, texture, getExtension } = makeFakeBundle();
    disposeRenderer({ renderer, texture });
    expect(getExtension).not.toHaveBeenCalled();
  });

  it('is idempotent under double-invocation', () => {
    const { renderer, texture, ro, detachCtxLoss } = makeFakeBundle();
    const call = () => disposeRenderer({ renderer, texture, resizeObserver: ro, detachCtxLoss });
    expect(() => {
      call();
      call();
    }).not.toThrow();
  });

  it('tolerates a null WEBGL_lose_context extension', () => {
    const deleteTexture = vi.fn();
    const renderer = {
      gl: {
        deleteTexture,
        getExtension: vi.fn().mockReturnValue(null),
      },
    } as unknown as Renderer;
    const texture = { texture: {} } as unknown as Texture;
    expect(() => disposeRenderer({ renderer, texture, forceLoseContext: true })).not.toThrow();
  });
});
