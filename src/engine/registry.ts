/**
 * Global effect registry (Task 2.1).
 *
 * The ONLY entry point for effects. Task 2.5's `handTrackingMosaic/index.ts`
 * calls `registerEffect(manifest)` at module load; Phase 3 iterates via
 * `listEffects()` and constructs an `EffectInstance` via
 * `manifest.create(gl)`.
 *
 * Module state is intentional: multiple consumers share one registry per
 * Vitest / browser process. Tests MUST call `clearRegistry()` in
 * `beforeEach` so they don't leak state between files.
 */

import type { EffectManifest } from './manifest';

/**
 * Module-private store. The value type is the default-generic form of
 * `EffectManifest`; `getEffect<T>` re-casts at retrieval — consumers assert
 * `T`. This is the only cast in this file and is documented inline.
 */
const effects = new Map<string, EffectManifest>();

/**
 * Register an effect manifest. Throws on duplicate `id` — registration is
 * one-shot and idempotent side effects are the manifest author's concern.
 */
export function registerEffect<TParams>(manifest: EffectManifest<TParams>): void {
  if (effects.has(manifest.id)) {
    throw new Error(`Effect "${manifest.id}" is already registered`);
  }
  // Controlled, narrow cast: every EffectManifest<TParams> is structurally
  // assignable to EffectManifest<Record<string, unknown>> for storage.
  effects.set(manifest.id, manifest as unknown as EffectManifest);
}

/**
 * Retrieve a manifest by id. Throws on miss — callers either know the id
 * (compile-time constant) or should defensively check via `listEffects()`.
 *
 * The generic `TParams` defaults to `Record<string, unknown>`; callers with
 * stronger typing assert their own param shape, same pattern as
 * `JSON.parse`.
 */
export function getEffect<TParams = Record<string, unknown>>(id: string): EffectManifest<TParams> {
  const m = effects.get(id);
  if (!m) {
    throw new Error(`Effect "${id}" not found in registry`);
  }
  // Controlled cast — mirror of the widening cast in `registerEffect`.
  return m as unknown as EffectManifest<TParams>;
}

/** Snapshot of all registered manifests. Order = insertion order. */
export function listEffects(): EffectManifest[] {
  return Array.from(effects.values());
}

/** @internal test-only — empties the registry between test files. */
export function clearRegistry(): void {
  effects.clear();
}
