/**
 * Unit tests for reducedMotion (Task 4.6).
 *
 * Mocks `window.matchMedia` with a stub that captures the change handler
 * so tests can synthesise OS-setting toggles by calling `fireChange(...)`.
 * Each test builds a fresh singleton via `createReducedMotion()` so the
 * module-scoped state doesn't leak between cases.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReducedMotion } from './reducedMotion';

type ChangeHandler = (e: MediaQueryListEvent) => void;

interface MockMQL {
  matches: boolean;
  addEventListener: (type: string, cb: ChangeHandler) => void;
  removeEventListener: (type: string, cb: ChangeHandler) => void;
}

let mockMQL: MockMQL;
let changeHandler: ChangeHandler | null = null;
let matchMediaMock: ReturnType<typeof vi.fn>;
let originalMatchMedia: typeof window.matchMedia | undefined;

function fireChange(matches: boolean): void {
  mockMQL.matches = matches;
  changeHandler?.({ matches } as MediaQueryListEvent);
}

beforeEach(() => {
  changeHandler = null;
  mockMQL = {
    matches: false,
    addEventListener: vi.fn((_type: string, cb: ChangeHandler) => {
      changeHandler = cb;
    }),
    removeEventListener: vi.fn(() => {
      changeHandler = null;
    }),
  };
  matchMediaMock = vi.fn((_q: string) => mockMQL);
  originalMatchMedia = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', {
    value: matchMediaMock,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  if (originalMatchMedia !== undefined) {
    Object.defineProperty(window, 'matchMedia', {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    });
  }
});

describe('createReducedMotion — init', () => {
  it('queries the exact media string `(prefers-reduced-motion: reduce)`', () => {
    createReducedMotion();
    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('getIsReduced reflects matchMedia.matches at init (false)', () => {
    mockMQL.matches = false;
    const rm = createReducedMotion();
    expect(rm.getIsReduced()).toBe(false);
  });

  it('getIsReduced reflects matchMedia.matches at init (true)', () => {
    mockMQL.matches = true;
    const rm = createReducedMotion();
    expect(rm.getIsReduced()).toBe(true);
  });
});

describe('change event propagation', () => {
  it('subscribe receives the new value when the OS setting toggles', () => {
    const rm = createReducedMotion();
    const cb = vi.fn();
    rm.subscribe(cb);
    fireChange(true);
    expect(cb).toHaveBeenCalledWith(true);
    expect(rm.getIsReduced()).toBe(true);
    fireChange(false);
    expect(cb).toHaveBeenCalledWith(false);
    expect(rm.getIsReduced()).toBe(false);
  });

  it('multiple subscribers all fire on change', () => {
    const rm = createReducedMotion();
    const a = vi.fn();
    const b = vi.fn();
    rm.subscribe(a);
    rm.subscribe(b);
    fireChange(true);
    expect(a).toHaveBeenCalledWith(true);
    expect(b).toHaveBeenCalledWith(true);
  });

  it('unsubscribe stops delivering notifications', () => {
    const rm = createReducedMotion();
    const cb = vi.fn();
    const off = rm.subscribe(cb);
    off();
    fireChange(true);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('dispose', () => {
  it('clears listeners + detaches the matchMedia handler', () => {
    const rm = createReducedMotion();
    const cb = vi.fn();
    rm.subscribe(cb);
    rm.dispose();
    fireChange(true);
    expect(cb).not.toHaveBeenCalled();
    expect(mockMQL.removeEventListener).toHaveBeenCalled();
  });
});

describe('matchMedia unavailable', () => {
  it('returns a no-op singleton when window.matchMedia is absent', () => {
    // Drop matchMedia entirely for this case.
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const rm = createReducedMotion();
    expect(rm.getIsReduced()).toBe(false);
    const off = rm.subscribe(vi.fn());
    expect(() => off()).not.toThrow();
  });
});

describe('uses addEventListener (not deprecated addListener)', () => {
  it('invokes addEventListener("change", ...)', () => {
    createReducedMotion();
    expect(mockMQL.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
