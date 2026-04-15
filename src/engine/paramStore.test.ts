import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createParamStore, type ParamState } from './paramStore';

type TestState = {
  grid: { seed: number; columnCount: number };
  mosaic: { tileSize: number; enabled: boolean };
};

function makeStore() {
  const initial: TestState = {
    grid: { seed: 42, columnCount: 12 },
    mosaic: { tileSize: 16, enabled: true },
  };
  return createParamStore<TestState & ParamState>(initial);
}

describe('engine/paramStore', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
  });

  it('snapshot returns a stable reference until set()', () => {
    const first = store.snapshot;
    const second = store.snapshot;
    expect(first).toBe(second);
    expect(store.getSnapshot()).toBe(first);
  });

  it('set() produces a new top-level snapshot reference', () => {
    const before = store.snapshot;
    store.set('grid.columnCount', 20);
    const after = store.snapshot;
    expect(after).not.toBe(before);
    expect(after.grid.columnCount).toBe(20);
  });

  it('set() replaces the section reference but keeps other sections equal', () => {
    const before = store.snapshot;
    store.set('grid.columnCount', 20);
    const after = store.snapshot;
    expect(after.grid).not.toBe(before.grid);
    expect(after.mosaic).toBe(before.mosaic);
  });

  it('set() updates bindingTarget in place (same reference, new property value)', () => {
    const targetRef = store.bindingTarget;
    const sectionRef = store.bindingTarget.grid;
    store.set('grid.columnCount', 20);
    expect(store.bindingTarget).toBe(targetRef);
    expect(store.bindingTarget.grid).toBe(sectionRef);
    expect(store.bindingTarget.grid.columnCount).toBe(20);
  });

  it('set() is a no-op when the value is unchanged (no new ref, no notify)', () => {
    const before = store.snapshot;
    const spy = vi.fn();
    store.subscribe(spy);
    store.set('grid.columnCount', 12);
    expect(store.snapshot).toBe(before);
    expect(spy).not.toHaveBeenCalled();
  });

  it('subscribe fires on set() exactly once per change', () => {
    const spy = vi.fn();
    store.subscribe(spy);
    store.set('grid.columnCount', 20);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes the listener', () => {
    const spy = vi.fn();
    const unsubscribe = store.subscribe(spy);
    unsubscribe();
    store.set('grid.columnCount', 20);
    expect(spy).not.toHaveBeenCalled();
  });

  it('multiple subscribers all fire on a single set()', () => {
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    store.set('grid.columnCount', 20);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('replace() updates snapshot AND bindingTarget to the new shape', () => {
    const targetRef = store.bindingTarget;
    const sectionRef = store.bindingTarget.grid;
    const next: TestState = {
      grid: { seed: 7, columnCount: 8 },
      mosaic: { tileSize: 32, enabled: false },
    };
    store.replace(next as TestState & ParamState);
    expect(store.snapshot.grid.seed).toBe(7);
    expect(store.snapshot.mosaic.tileSize).toBe(32);
    // bindingTarget root + existing sections must retain their references so
    // Tweakpane bindings that closed over them stay live.
    expect(store.bindingTarget).toBe(targetRef);
    expect(store.bindingTarget.grid).toBe(sectionRef);
    expect(store.bindingTarget.grid.seed).toBe(7);
    expect(store.bindingTarget.mosaic.enabled).toBe(false);
  });

  it('replace() notifies all subscribers exactly once', () => {
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    store.replace({
      grid: { seed: 1, columnCount: 1 },
      mosaic: { tileSize: 1, enabled: true },
    } as TestState & ParamState);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('subscribe() added during a notify does not fire retroactively', () => {
    const late = vi.fn();
    const first = vi.fn(() => {
      store.subscribe(late);
    });
    store.subscribe(first);
    store.set('grid.columnCount', 20);
    expect(first).toHaveBeenCalledTimes(1);
    expect(late).not.toHaveBeenCalled();
    // The newly added listener fires on the next change.
    store.set('grid.columnCount', 21);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('set() throws on malformed dotPath', () => {
    expect(() => store.set('noDot', 1)).toThrow(/must contain a section/);
    expect(() => store.set('.leaf', 1)).toThrow(/empty section or leaf/);
    expect(() => store.set('section.', 1)).toThrow(/empty section or leaf/);
  });

  it('set() throws on unknown section', () => {
    expect(() => store.set('ghost.leaf', 1)).toThrow(/unknown section "ghost"/);
  });

  it('initial state is deep-cloned (mutating input does not affect store)', () => {
    const initial: TestState = {
      grid: { seed: 42, columnCount: 12 },
      mosaic: { tileSize: 16, enabled: true },
    };
    const s = createParamStore<TestState & ParamState>(initial);
    initial.grid.columnCount = 999;
    expect(s.snapshot.grid.columnCount).toBe(12);
  });
});
