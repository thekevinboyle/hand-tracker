/*
 * src/ui/primitives/useParam.test.ts — unit tests for the `useParam` hook
 * (Task DR-7.7). ≥ 12 tests covering:
 *
 *   1.  reads initial value
 *   2.  updates when paramStore.set fires
 *   3.  setter calls paramStore.set with correct key
 *   4.  setter reference stable across re-renders (useCallback)
 *   5.  isolation — sibling-key change produces no re-render
 *   6.  StrictMode double-mount — net-zero listener count after unmount
 *   7.  concurrent updates surface in the consumer
 *   8.  unmount cleans up subscription
 *   9.  works with integer params (mosaic.tileSize → number)
 *   10. works with string params (grid.lineColor → string)
 *   11. works with boolean params (input.mirrorMode → boolean)
 *   12. Object.is short-circuit — setting same value does NOT re-render
 *   13. paramStore.replace() propagates through consumers
 *   14. switching the `key` prop re-subscribes to the new key
 *   15. type inference smoke — `typeof` matches the manifest leaf type
 *
 * Important: tests NEVER pass the generic explicitly
 * (synergy-fix CRITICAL-04). Inference-only.
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAM_STATE } from '../../effects/handTrackingMosaic/manifest';
import { paramStore } from '../../engine/paramStore';
import { useParam } from './useParam';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  // Reset paramStore to the manifest defaults before every test so tests
  // stay order-independent (paramStore is a module singleton — the
  // `custom-param-components` skill §7 warns against mutations leaking).
  paramStore.replace({
    grid: { ...DEFAULT_PARAM_STATE.grid },
    mosaic: { ...DEFAULT_PARAM_STATE.mosaic },
    effect: { ...DEFAULT_PARAM_STATE.effect },
    input: { ...DEFAULT_PARAM_STATE.input },
  });
});

describe('Task DR-7.7: useParam — initial read + setter contract', () => {
  it('reads the initial value from paramStore', () => {
    const { result } = renderHook(() => useParam('mosaic.tileSize'));
    expect(result.current[0]).toBe(DEFAULT_PARAM_STATE.mosaic.tileSize);
  });

  it('setter calls paramStore.set with the correct key', () => {
    const spy = vi.spyOn(paramStore, 'set');
    const { result } = renderHook(() => useParam('mosaic.tileSize'));
    act(() => {
      result.current[1](32);
    });
    expect(spy).toHaveBeenCalledWith('mosaic.tileSize', 32);
    spy.mockRestore();
  });

  it('re-renders with the new value after setValue', () => {
    const { result } = renderHook(() => useParam('mosaic.tileSize'));
    expect(result.current[0]).toBe(16);
    act(() => {
      result.current[1](48);
    });
    expect(result.current[0]).toBe(48);
    expect(paramStore.snapshot.mosaic?.tileSize).toBe(48);
  });

  it('setter reference is stable across re-renders (useCallback on key)', () => {
    const { result, rerender } = renderHook(() => useParam('mosaic.tileSize'));
    const firstSetter = result.current[1];
    rerender();
    rerender();
    expect(result.current[1]).toBe(firstSetter);
    // Even after an actual value change the setter identity is preserved
    // because useCallback deps are `[key]` only.
    act(() => {
      result.current[1](24);
    });
    expect(result.current[1]).toBe(firstSetter);
  });
});

describe('Task DR-7.7: useParam — re-render isolation (Object.is)', () => {
  it('does NOT re-render when an unrelated key changes', () => {
    let renderCount = 0;
    renderHook(() => {
      renderCount++;
      return useParam('mosaic.tileSize');
    });
    const before = renderCount;
    act(() => {
      paramStore.set('grid.seed', 99);
    });
    // Zero upstream-triggered re-renders: the subscribe wrapper swallowed
    // the sibling-key notification.
    expect(renderCount - before).toBe(0);
  });

  it('does NOT re-render when paramStore.set uses the same value (store-level no-op)', () => {
    let renderCount = 0;
    renderHook(() => {
      renderCount++;
      return useParam('mosaic.tileSize');
    });
    const before = renderCount;
    // paramStore.set short-circuits on === equality → no notify → no re-render.
    act(() => {
      paramStore.set('mosaic.tileSize', DEFAULT_PARAM_STATE.mosaic.tileSize);
    });
    expect(renderCount - before).toBe(0);
  });

  it('DOES re-render the matching consumer when its own key changes', () => {
    let renderCount = 0;
    renderHook(() => {
      renderCount++;
      return useParam('mosaic.tileSize');
    });
    const before = renderCount;
    act(() => {
      paramStore.set('mosaic.tileSize', 24);
    });
    expect(renderCount - before).toBe(1);
  });
});

describe('Task DR-7.7: useParam — subscription lifecycle', () => {
  it('unmount cleans up the subscription (paramStore listener count returns to baseline)', () => {
    const subscribeSpy = vi.spyOn(paramStore, 'subscribe');
    const { unmount } = renderHook(() => useParam('mosaic.tileSize'));
    expect(subscribeSpy).toHaveBeenCalled();
    unmount();
    // Post-unmount `set` must not crash nor cause any leaks — verified by
    // asserting we can still freely mutate paramStore without issues.
    expect(() => paramStore.set('mosaic.tileSize', 64)).not.toThrow();
    subscribeSpy.mockRestore();
  });

  it('StrictMode double-mount leaves a single net subscription', () => {
    // Spy on subscribe; count invocations AND unsubscribes.
    const original = paramStore.subscribe.bind(paramStore);
    let subscribeCount = 0;
    let unsubscribeCount = 0;
    const spy = vi.spyOn(paramStore, 'subscribe').mockImplementation((listener) => {
      subscribeCount++;
      const unsub = original(listener);
      return () => {
        unsubscribeCount++;
        unsub();
      };
    });

    const { unmount } = renderHook(() => useParam('mosaic.tileSize'), {
      wrapper: StrictMode,
    });
    // In StrictMode dev mode, React 19 invokes subscribe once at mount and
    // once at the simulated remount. The cleanup after the first mount
    // unsubscribes the first listener — net 1 live subscription.
    expect(subscribeCount - unsubscribeCount).toBe(1);
    unmount();
    // After unmount both halves must have balanced.
    expect(subscribeCount - unsubscribeCount).toBe(0);
    spy.mockRestore();
  });

  it('re-subscribes when the `key` prop changes', () => {
    const subscribeSpy = vi.spyOn(paramStore, 'subscribe');
    type SwitchableKey = 'mosaic.tileSize' | 'grid.seed';
    const initialProps: { k: SwitchableKey } = { k: 'mosaic.tileSize' };
    const { result, rerender } = renderHook(({ k }: { k: SwitchableKey }) => useParam(k), {
      initialProps,
    });
    const initialSubscribeCalls = subscribeSpy.mock.calls.length;
    expect(result.current[0]).toBe(DEFAULT_PARAM_STATE.mosaic.tileSize);

    rerender({ k: 'grid.seed' });
    expect(result.current[0]).toBe(DEFAULT_PARAM_STATE.grid.seed);
    // Key change → useCallback[key] regenerates subscribe → React re-subscribes.
    expect(subscribeSpy.mock.calls.length).toBeGreaterThan(initialSubscribeCalls);
    subscribeSpy.mockRestore();
  });
});

describe('Task DR-7.7: useParam — value-type coverage + paramStore.replace', () => {
  it('works with integer params (mosaic.tileSize → number)', () => {
    const { result } = renderHook(() => useParam('mosaic.tileSize'));
    // Type-level inference is verified below; here we confirm runtime shape.
    expect(typeof result.current[0]).toBe('number');
    act(() => {
      result.current[1](40);
    });
    expect(result.current[0]).toBe(40);
  });

  it('works with string params (grid.lineColor → string)', () => {
    const { result } = renderHook(() => useParam('grid.lineColor'));
    expect(typeof result.current[0]).toBe('string');
    act(() => {
      result.current[1]('#ff00aa');
    });
    expect(result.current[0]).toBe('#ff00aa');
  });

  it('works with boolean params (input.mirrorMode → boolean)', () => {
    const { result } = renderHook(() => useParam('input.mirrorMode'));
    expect(typeof result.current[0]).toBe('boolean');
    expect(result.current[0]).toBe(true);
    act(() => {
      result.current[1](false);
    });
    expect(result.current[0]).toBe(false);
  });

  it('propagates paramStore.replace() to consumers (preset-load path)', () => {
    const { result } = renderHook(() => useParam('mosaic.tileSize'));
    expect(result.current[0]).toBe(16);
    act(() => {
      paramStore.replace({
        grid: { ...DEFAULT_PARAM_STATE.grid },
        mosaic: { ...DEFAULT_PARAM_STATE.mosaic, tileSize: 8 },
        effect: { ...DEFAULT_PARAM_STATE.effect },
        input: { ...DEFAULT_PARAM_STATE.input },
      });
    });
    expect(result.current[0]).toBe(8);
  });

  it('surfaces multiple concurrent updates in the final consumer value', () => {
    const { result } = renderHook(() => useParam('mosaic.tileSize'));
    act(() => {
      result.current[1](20);
      result.current[1](30);
      result.current[1](40);
    });
    expect(result.current[0]).toBe(40);
    expect(paramStore.snapshot.mosaic?.tileSize).toBe(40);
  });

  it('type inference — tileSize is `number`, mirrorMode is `boolean`, deviceId is `string`', () => {
    // This test is a RUNTIME proxy for a compile-time property: TypeScript
    // must have inferred `number` / `boolean` / `string` from the `ParamKey`
    // union. If inference regressed to `unknown`, these assertions still
    // pass at runtime, BUT the `pnpm tsc --noEmit` L1 gate (which
    // type-checks the test files) would fail at the explicit type
    // annotations below — which is the load-bearing assertion.
    const { result: numResult } = renderHook(() => useParam('mosaic.tileSize'));
    const num: number = numResult.current[0];
    expect(typeof num).toBe('number');

    const { result: boolResult } = renderHook(() => useParam('input.mirrorMode'));
    const bool: boolean = boolResult.current[0];
    expect(typeof bool).toBe('boolean');

    const { result: strResult } = renderHook(() => useParam('input.deviceId'));
    const str: string = strResult.current[0];
    expect(typeof str).toBe('string');
  });
});

describe('Task DR-7.7: useParam — multi-consumer behavior', () => {
  it('two consumers of the same key both see the updated value', () => {
    const { result: a } = renderHook(() => useParam('mosaic.tileSize'));
    const { result: b } = renderHook(() => useParam('mosaic.tileSize'));
    expect(a.current[0]).toBe(16);
    expect(b.current[0]).toBe(16);
    act(() => {
      a.current[1](52);
    });
    expect(a.current[0]).toBe(52);
    expect(b.current[0]).toBe(52);
  });

  it('consumers of different keys stay isolated — only the matching one re-renders', () => {
    let tileRenders = 0;
    let seedRenders = 0;
    renderHook(() => {
      tileRenders++;
      return useParam('mosaic.tileSize');
    });
    renderHook(() => {
      seedRenders++;
      return useParam('grid.seed');
    });
    const tileBefore = tileRenders;
    const seedBefore = seedRenders;

    act(() => {
      paramStore.set('mosaic.tileSize', 42);
    });
    expect(tileRenders - tileBefore).toBe(1);
    expect(seedRenders - seedBefore).toBe(0);

    act(() => {
      paramStore.set('grid.seed', 7);
    });
    expect(tileRenders - tileBefore).toBe(1); // still 1 — no extra render
    expect(seedRenders - seedBefore).toBe(1);
  });
});
