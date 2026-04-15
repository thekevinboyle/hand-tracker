import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCamera } from './useCamera';

interface FakeTrack {
  kind: string;
  stop: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
}

interface FakeStream {
  getTracks: () => FakeTrack[];
  getVideoTracks: () => FakeTrack[];
  __tracks: FakeTrack[];
}

function mockStream(): FakeStream {
  const track: FakeTrack = {
    kind: 'video',
    stop: vi.fn(),
    addEventListener: vi.fn(),
  };
  const tracks = [track];
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks,
    __tracks: tracks,
  };
}

interface MockNavigatorOpts {
  permissionState?: PermissionState;
  permissionQueryThrows?: boolean;
  getUserMedia?: ReturnType<typeof vi.fn>;
  enumerateDevices?: ReturnType<typeof vi.fn>;
}

function installMockNavigator(opts: MockNavigatorOpts = {}) {
  const permissionStatus = {
    state: opts.permissionState ?? 'prompt',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const permissionsQuery = opts.permissionQueryThrows
    ? vi.fn().mockRejectedValue(new Error('permissions.query not supported'))
    : vi.fn().mockResolvedValue(permissionStatus);

  const gum =
    opts.getUserMedia ?? vi.fn().mockResolvedValue(mockStream() as unknown as MediaStream);
  const enumerate =
    opts.enumerateDevices ??
    vi
      .fn()
      .mockResolvedValue([
        { kind: 'videoinput', deviceId: 'cam-a', label: 'Front', groupId: 'g1' },
      ]);

  const mediaDevices = {
    getUserMedia: gum,
    enumerateDevices: enumerate,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  vi.stubGlobal('navigator', {
    permissions: { query: permissionsQuery },
    mediaDevices,
  });

  return { permissionStatus, permissionsQuery, gum, enumerate, mediaDevices };
}

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* some test environments don't expose a usable Storage; tests don't require it */
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useCamera', () => {
  it('initial state is PROMPT when permissions.query returns "prompt"', async () => {
    installMockNavigator({ permissionState: 'prompt' });
    const { result } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('PROMPT'));
  });

  it('auto-starts capture when permissions.query returns "granted" on mount', async () => {
    const { gum } = installMockNavigator({ permissionState: 'granted' });
    const { result } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('GRANTED'));
    expect(gum).toHaveBeenCalledTimes(1);
  });

  it('retry() transitions to GRANTED on happy path', async () => {
    const { gum } = installMockNavigator({ permissionState: 'prompt' });
    const { result } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('PROMPT'));
    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.state).toBe('GRANTED'));
    expect(gum).toHaveBeenCalledTimes(1);
  });

  it('NotAllowedError + permissions "denied" maps to USER_DENIED', async () => {
    installMockNavigator({
      permissionState: 'denied',
      getUserMedia: vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError')),
    });
    const { result } = renderHook(() => useCamera());
    // Status denied on mount already routes to USER_DENIED without calling gUM.
    await waitFor(() => expect(result.current.state).toBe('USER_DENIED'));
  });

  it('NotAllowedError + permissions "prompt" maps to SYSTEM_DENIED via retry', async () => {
    installMockNavigator({
      permissionState: 'prompt',
      getUserMedia: vi.fn().mockRejectedValue(new DOMException('nope', 'NotAllowedError')),
    });
    const { result } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('PROMPT'));
    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.state).toBe('SYSTEM_DENIED'));
  });

  it('NotReadableError maps to DEVICE_CONFLICT', async () => {
    installMockNavigator({
      permissionState: 'prompt',
      getUserMedia: vi.fn().mockRejectedValue(new DOMException('busy', 'NotReadableError')),
    });
    const { result } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('PROMPT'));
    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.state).toBe('DEVICE_CONFLICT'));
  });

  it('NotFoundError maps to NOT_FOUND', async () => {
    installMockNavigator({
      permissionState: 'prompt',
      getUserMedia: vi.fn().mockRejectedValue(new DOMException('no cam', 'NotFoundError')),
    });
    const { result } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('PROMPT'));
    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.state).toBe('NOT_FOUND'));
  });

  it('OverconstrainedError triggers relaxed retry then GRANTED', async () => {
    const gum = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('bad', 'OverconstrainedError'))
      .mockResolvedValueOnce(mockStream() as unknown as MediaStream);
    installMockNavigator({ permissionState: 'prompt', getUserMedia: gum });
    const { result } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('PROMPT'));
    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.state).toBe('GRANTED'));
    expect(gum).toHaveBeenCalledTimes(2);
    expect(gum.mock.calls[1]?.[0]).toEqual({ video: true, audio: false });
  });

  it('permissions.query throw falls through to PROMPT', async () => {
    installMockNavigator({ permissionQueryThrows: true });
    const { result } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('PROMPT'));
  });

  it('cleanup calls track.stop() on all tracks', async () => {
    const stream = mockStream();
    const gum = vi.fn().mockResolvedValue(stream as unknown as MediaStream);
    installMockNavigator({ permissionState: 'granted', getUserMedia: gum });
    const { result, unmount } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('GRANTED'));
    const trackStop = stream.__tracks[0]?.stop;
    expect(trackStop).toBeDefined();
    unmount();
    expect(trackStop).toHaveBeenCalled();
  });

  it('non-DOMException error maps to SYSTEM_DENIED', async () => {
    installMockNavigator({
      permissionState: 'prompt',
      getUserMedia: vi.fn().mockRejectedValue(new Error('weird')),
    });
    const { result } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('PROMPT'));
    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.state).toBe('SYSTEM_DENIED'));
  });
});
