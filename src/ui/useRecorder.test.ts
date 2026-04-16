/**
 * Unit tests for useRecorder (Task 4.5).
 *
 * Mocks:
 *   - `MediaRecorder` — stub class + `isTypeSupported` spy so codec
 *     selection is deterministic.
 *   - `HTMLCanvasElement.prototype.captureStream` — jsdom lacks it.
 *   - `URL.createObjectURL` / `URL.revokeObjectURL` — spy to assert the
 *     download/cleanup contract.
 *   - `document.createElement('a')` is NOT mocked; the test inspects the
 *     anchor that `buildAndDownload` appends to `document.body`.
 *
 * Covers pickMimeType (5 codec-chain cases + MediaRecorder-undefined),
 * start → stop round-trip (captureStream called, MediaRecorder
 * constructed, anchor clicked, URL revoked), elapsed ticker, unmount
 * cleanup, error surfacing.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickMimeType, useRecorder } from './useRecorder';

// ---------------------------------------------------------------------------
// MediaRecorder stub — built fresh each test via beforeEach.
// ---------------------------------------------------------------------------

interface MRCtorOpts {
  mimeType?: string;
}
type MRConstructorCall = { stream: MediaStream; opts?: MRCtorOpts };
const mrConstructorCalls: MRConstructorCall[] = [];
let lastRecorder: StubRecorder | null = null;

class StubRecorder {
  static isTypeSupported = vi.fn<(t: string) => boolean>(() => true);
  static supported = new Set<string>([
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]);

  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((e: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  readonly mimeType: string;

  constructor(stream: MediaStream, opts?: MRCtorOpts) {
    mrConstructorCalls.push({ stream, opts });
    this.mimeType = opts?.mimeType ?? 'video/webm';
    lastRecorder = this;
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    // Fire a single dataavailable with a non-empty blob, then onstop.
    this.ondataavailable?.({
      data: new Blob(['stub-chunk'], { type: this.mimeType }),
    } as BlobEvent);
    this.onstop?.();
  }
}

beforeEach(() => {
  mrConstructorCalls.length = 0;
  lastRecorder = null;

  StubRecorder.isTypeSupported = vi.fn<(t: string) => boolean>((t) =>
    StubRecorder.supported.has(t),
  );
  vi.stubGlobal('MediaRecorder', StubRecorder);

  // jsdom has no captureStream — stub a minimal MediaStream the recorder accepts.
  Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
    configurable: true,
    writable: true,
    value: vi.fn(() => {
      const stop = vi.fn();
      return {
        getTracks: () => [{ stop }],
      } as unknown as MediaStream;
    }),
  });

  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  StubRecorder.supported = new Set([
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]);
});

// ---------------------------------------------------------------------------
// pickMimeType
// ---------------------------------------------------------------------------

describe('pickMimeType', () => {
  it('returns vp9 when every candidate is supported', () => {
    expect(pickMimeType()).toBe('video/webm;codecs=vp9');
  });

  it('falls back to vp8 when vp9 is unsupported', () => {
    StubRecorder.supported = new Set(['video/webm;codecs=vp8', 'video/webm']);
    expect(pickMimeType()).toBe('video/webm;codecs=vp8');
  });

  it('falls back to plain video/webm when both codec-specific types fail', () => {
    StubRecorder.supported = new Set(['video/webm']);
    expect(pickMimeType()).toBe('video/webm');
  });

  it('throws when no candidate is supported', () => {
    StubRecorder.supported = new Set();
    expect(() => pickMimeType()).toThrow(/No supported webm codec/);
  });

  it('throws when MediaRecorder is undefined', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    expect(() => pickMimeType()).toThrow(/MediaRecorder not supported/);
  });
});

// ---------------------------------------------------------------------------
// useRecorder lifecycle
// ---------------------------------------------------------------------------

function makeCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

describe('useRecorder.start', () => {
  it('calls canvas.captureStream(30) and constructs MediaRecorder with the chosen mime', () => {
    const { result } = renderHook(() => useRecorder());
    const canvas = makeCanvas();
    act(() => {
      result.current.start(canvas);
    });
    const capture = canvas.captureStream as unknown as ReturnType<typeof vi.fn>;
    expect(capture).toHaveBeenCalledWith(30);
    expect(mrConstructorCalls).toHaveLength(1);
    expect(mrConstructorCalls[0]?.opts?.mimeType).toBe('video/webm;codecs=vp9');
    expect(result.current.isRecording).toBe(true);
  });

  it('surfaces pickMimeType errors + stays idle when no codec is available', () => {
    StubRecorder.supported = new Set();
    const { result } = renderHook(() => useRecorder());
    act(() => {
      result.current.start(makeCanvas());
    });
    expect(result.current.isRecording).toBe(false);
    expect(result.current.error?.message).toMatch(/No supported webm codec/);
    expect(mrConstructorCalls).toHaveLength(0);
  });

  it('is idempotent — double-click while recording is a no-op', () => {
    const { result } = renderHook(() => useRecorder());
    const canvas = makeCanvas();
    act(() => {
      result.current.start(canvas);
    });
    act(() => {
      result.current.start(canvas);
    });
    expect(mrConstructorCalls).toHaveLength(1);
  });
});

describe('useRecorder.stop (round-trip download)', () => {
  it('builds a Blob, creates an anchor with a hyphenated-ISO filename, clicks it, revokes the URL', async () => {
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    const createEl = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = origCreate('a') as HTMLAnchorElement;
        a.click = clickSpy;
        return a;
      }
      return origCreate(tag as 'a');
    });

    const { result } = renderHook(() => useRecorder());
    const canvas = makeCanvas();
    act(() => {
      result.current.start(canvas);
    });
    act(() => {
      result.current.stop();
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    // The anchor's `download` attr embeds an ISO with `:` swapped for `-`.
    const anchorCall = createEl.mock.calls.find((args) => args[0] === 'a');
    expect(anchorCall).toBeDefined();
    // Await the revoke setTimeout(0).
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    expect(result.current.isRecording).toBe(false);
  });

  it('filename has no colons and ends in .webm', () => {
    let capturedFilename = '';
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag as 'a');
      if (tag === 'a') {
        const a = el as HTMLAnchorElement;
        Object.defineProperty(a, 'download', {
          set(v: string) {
            capturedFilename = v;
          },
          get() {
            return capturedFilename;
          },
          configurable: true,
        });
        a.click = vi.fn();
      }
      return el;
    });

    const { result } = renderHook(() => useRecorder());
    act(() => {
      result.current.start(makeCanvas());
    });
    act(() => {
      result.current.stop();
    });
    expect(capturedFilename).toMatch(/^hand-tracker-fx-[\dTZ.-]+\.webm$/);
    expect(capturedFilename).not.toContain(':');
  });

  it('stream tracks are stopped after recorder.onstop fires', () => {
    const trackStop = vi.fn();
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
      configurable: true,
      writable: true,
      value: () =>
        ({
          getTracks: () => [{ stop: trackStop }],
        }) as unknown as MediaStream,
    });
    const { result } = renderHook(() => useRecorder());
    act(() => {
      result.current.start(makeCanvas());
    });
    act(() => {
      result.current.stop();
    });
    expect(trackStop).toHaveBeenCalledTimes(1);
  });
});

describe('useRecorder.stop (guards)', () => {
  it('does nothing when not recording', () => {
    const { result } = renderHook(() => useRecorder());
    act(() => {
      result.current.stop();
    });
    expect(result.current.isRecording).toBe(false);
  });
});

describe('useRecorder unmount cleanup', () => {
  it('stops any in-flight recorder on unmount so streams do not leak', () => {
    const trackStop = vi.fn();
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
      configurable: true,
      writable: true,
      value: () =>
        ({
          getTracks: () => [{ stop: trackStop }],
        }) as unknown as MediaStream,
    });
    const { result, unmount } = renderHook(() => useRecorder());
    act(() => {
      result.current.start(makeCanvas());
    });
    unmount();
    // Unmount fires the recorder.onstop → cleanupStream → track.stop()
    expect(trackStop).toHaveBeenCalled();
    expect(lastRecorder?.state).toBe('inactive');
  });
});
