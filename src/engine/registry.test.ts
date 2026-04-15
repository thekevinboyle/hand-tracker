import { beforeEach, describe, expect, it } from 'vitest';
import type { EffectInstance, EffectManifest } from './manifest';
import { clearRegistry, getEffect, listEffects, registerEffect } from './registry';

/** Minimal manifest fixture — noop create/render/dispose, no ParamDefs. */
function makeManifest<T extends Record<string, unknown>>(
  id: string,
  defaultParams: T,
): EffectManifest<T> {
  return {
    id,
    displayName: `Effect ${id}`,
    version: '0.0.1',
    description: `Fixture ${id}`,
    params: [],
    defaultParams,
    modulationSources: [],
    create: (_gl: WebGL2RenderingContext): EffectInstance => ({
      render: () => {},
      dispose: () => {},
    }),
  };
}

describe('engine/registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registers a manifest and returns it via getEffect', () => {
    const manifest = makeManifest('test-a', { foo: 1 });
    registerEffect(manifest);
    const got = getEffect('test-a');
    expect(got.id).toBe('test-a');
    expect(got.displayName).toBe('Effect test-a');
  });

  it('listEffects returns all registered manifests in insertion order', () => {
    registerEffect(makeManifest('a', { x: 1 }));
    registerEffect(makeManifest('b', { x: 2 }));
    registerEffect(makeManifest('c', { x: 3 }));
    const ids = listEffects().map((m) => m.id);
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('throws on duplicate id', () => {
    registerEffect(makeManifest('dup', { v: 1 }));
    expect(() => registerEffect(makeManifest('dup', { v: 2 }))).toThrow(
      /Effect "dup" is already registered/,
    );
  });

  it('throws on unknown id from getEffect', () => {
    expect(() => getEffect('ghost')).toThrow(/Effect "ghost" not found in registry/);
  });

  it('clearRegistry empties the store', () => {
    registerEffect(makeManifest('x', { a: 1 }));
    registerEffect(makeManifest('y', { a: 2 }));
    expect(listEffects()).toHaveLength(2);
    clearRegistry();
    expect(listEffects()).toHaveLength(0);
    expect(() => getEffect('x')).toThrow();
  });

  it('preserves TParams generic through getEffect', () => {
    interface MyParams extends Record<string, unknown> {
      tileSize: number;
      enabled: boolean;
    }
    const manifest = makeManifest<MyParams>('typed', { tileSize: 16, enabled: true });
    registerEffect(manifest);
    const got = getEffect<MyParams>('typed');
    // Compile-time: got.defaultParams is MyParams. Runtime: values intact.
    expect(got.defaultParams.tileSize).toBe(16);
    expect(got.defaultParams.enabled).toBe(true);
  });
});
