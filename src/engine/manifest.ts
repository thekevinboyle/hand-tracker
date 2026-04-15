/**
 * Effect manifest + registry type surface (Task 2.1).
 *
 * This module is TYPE-ONLY — no runtime code. It publishes the canonical
 * TypeScript contract every effect binds to:
 *   - `EffectManifest<TParams>` — what a manifest file exports
 *   - `EffectInstance` — what `manifest.create(gl)` returns
 *   - `ParamDef` — discriminated union over `ParamType`
 *   - `ParamType` — the discriminator string literals
 *   - `ModulationSourceDef` — Phase 4 forward-compat descriptor
 *
 * `FrameContext` and `Landmark` are single-source-of-truth in
 * `src/engine/types.ts` (Task 1.5) and are RE-EXPORTED here so downstream
 * imports from either module stay type-identical.
 */

export type { FrameContext, Landmark } from './types';

import type { Landmark } from './types';

/** Discriminator tags for `ParamDef`. */
export type ParamType = 'number' | 'integer' | 'boolean' | 'select' | 'color' | 'string' | 'button';

/** Fields shared by every `ParamDef` variant. */
type ParamBase = {
  /** Dot-path key in the param store (e.g. `'grid.seed'`, `'mosaic.tileSize'`). */
  key: string;
  label: string;
  /** Tweakpane tab name; default `'Main'` when consumed by Task 2.2. */
  page?: string;
  /** Optional folder within the page. */
  folder?: string;
};

/**
 * Param definition — a DISCRIMINATED UNION on `type`. Optional-everywhere
 * interfaces break exhaustiveness checks in `buildPaneFromManifest` (Task
 * 2.2); this shape forces consumers to narrow via `switch (def.type)`.
 */
export type ParamDef =
  | (ParamBase & {
      type: 'number';
      defaultValue: number;
      min: number;
      max: number;
      step?: number;
      displayMin?: number;
      displayMax?: number;
    })
  | (ParamBase & {
      type: 'integer';
      defaultValue: number;
      min: number;
      max: number;
      step?: number;
    })
  | (ParamBase & {
      type: 'boolean';
      defaultValue: boolean;
    })
  | (ParamBase & {
      type: 'select';
      defaultValue: string | number;
      options: Record<string, string | number>;
    })
  | (ParamBase & {
      type: 'color';
      /** Hex `'#rrggbb'`. */
      defaultValue: string;
    })
  | (ParamBase & {
      type: 'string';
      defaultValue: string;
    })
  | (ParamBase & {
      type: 'button';
      /**
       * `allParams` is a READ-ONLY snapshot of paramStore state at click
       * time. Mutating it is a no-op. To write back, close over
       * `paramStore.set(key, value)` in the manifest author module.
       */
      onClick: (allParams: Record<string, unknown>) => void;
    });

/**
 * Modulation source descriptor (Phase 4 consumes this). Task 2.1 only needs
 * the shape + a list on the manifest; `extract` is optional to avoid
 * coupling this file to landmark runtime code.
 */
export type ModulationSourceDef = {
  /** Stable id, e.g. `'landmark[8].x'`, `'pinch'`, `'centroid.y'`. */
  id: string;
  label: string;
  extract?: (landmarks: Landmark[] | null) => number | undefined;
};

/**
 * An active effect instance — created by `EffectManifest.create(gl)`. The
 * engine disposes it on effect swap or unmount.
 */
export type EffectInstance = {
  render(ctx: import('./types').FrameContext): void;
  dispose(): void;
};

/**
 * Generic manifest contract. `TParams` narrows `defaultParams` and lets
 * consumers type their params object. The default generic permits untyped
 * registration for test fixtures / scaffolding.
 *
 * `create(gl: WebGL2RenderingContext): EffectInstance` is PINNED — Phase 3
 * (Task 3.4) sources the ogl Renderer + video Texture via module-scoped
 * refs in `src/engine/renderer.ts`, NOT via a `deps` parameter here.
 */
export type EffectManifest<TParams = Record<string, unknown>> = {
  id: string;
  displayName: string;
  version: string;
  description: string;
  params: ParamDef[];
  defaultParams: TParams;
  modulationSources: ModulationSourceDef[];
  create(gl: WebGL2RenderingContext): EffectInstance;
};
