/**
 * Generic manifest → Tweakpane builder (Task 2.2).
 *
 * Turns an `EffectManifest.params` array (Task 2.1's ParamDef discriminated
 * union) into a live Tweakpane v4 panel with tabs (one per unique `page`),
 * folders, and bindings wired through to `paramStore`. Returns a disposer so
 * React/`<Panel />` can tear the pane down in `useEffect` cleanup.
 *
 * Rules (from the tweakpane-params-presets skill):
 *   - Plugins MUST be registered BEFORE any addBinding / addBlade that uses
 *     them. We register immediately after `new Pane(...)`.
 *   - Bindings target `paramStore.bindingTarget` (the mirror), NEVER
 *     `paramStore.snapshot` (which is immutable-by-convention). On change we
 *     write through via `paramStore.set(key, value)`, which produces the
 *     next snapshot reference and notifies subscribers.
 *   - Buttons receive `paramStore.snapshot` as a READ-ONLY argument at click
 *     time (manifest authors close over `paramStore.set` for writes).
 *   - `pane.refresh()` is NEVER called here — reserved for Phase 4 preset
 *     load in `<Panel />` / PresetCycler.
 */

import type { FolderApi, TabPageApi, TpPluginBundle } from 'tweakpane';
import { Pane } from 'tweakpane';
import type { EffectManifest, ParamDef } from './manifest';
import { paramStore } from './paramStore';

export type BuildPaneResult = {
  pane: Pane;
  dispose(): void;
};

type FolderContainer = Pane | TabPageApi | FolderApi;

// WeakMap keyed by container — each page/folder/pane has its own folder cache
// so names like `'Grid'` on different pages don't collide.
const folderCache = new WeakMap<FolderContainer, Map<string, FolderApi>>();

function getOrCreateFolder(container: FolderContainer, title: string): FolderApi {
  let cache = folderCache.get(container);
  if (!cache) {
    cache = new Map();
    folderCache.set(container, cache);
  }
  const cached = cache.get(title);
  if (cached) return cached;
  const folder = container.addFolder({ title, expanded: true });
  cache.set(title, folder);
  return folder;
}

/**
 * Walk a dot-path on `root`, returning the parent object + leaf key so
 * Tweakpane's `addBinding(host, leafKey)` can bind directly.
 *
 * For Task 2.2 the param store is two-deep (`section.leaf`), but this helper
 * supports arbitrary depth to keep future nested-section refactors easy.
 */
function resolvePath(
  root: Record<string, unknown>,
  dotPath: string,
): { host: Record<string, unknown>; leafKey: string } {
  const parts = dotPath.split('.');
  if (parts.length < 2) {
    throw new Error(`buildPaneFromManifest: dotPath "${dotPath}" must be at least "section.leaf"`);
  }
  const leafKey = parts[parts.length - 1];
  if (!leafKey) {
    throw new Error(`buildPaneFromManifest: dotPath "${dotPath}" has empty leaf`);
  }
  let host: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const segment = parts[i];
    if (!segment) {
      throw new Error(`buildPaneFromManifest: dotPath "${dotPath}" has empty segment`);
    }
    const next = host[segment];
    if (typeof next !== 'object' || next === null) {
      throw new Error(
        `buildPaneFromManifest: dotPath "${dotPath}" — segment "${segment}" missing on bindingTarget`,
      );
    }
    host = next as Record<string, unknown>;
  }
  return { host, leafKey };
}

/** Unique values in first-seen order. */
function uniqueInOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

const DEFAULT_PAGE = 'Main';

/**
 * Build a Tweakpane from an effect manifest. Returns `{ pane, dispose }`.
 * `dispose()` is safe to call multiple times (Tweakpane's own guard) and
 * additionally clears the container DOM as a belt-and-suspenders in case a
 * mid-drag overlay was left behind.
 */
export function buildPaneFromManifest(
  manifest: EffectManifest,
  container: HTMLElement,
  plugins: readonly TpPluginBundle[] = [],
): BuildPaneResult {
  const pane = new Pane({ container, title: manifest.displayName });

  // Register plugins BEFORE adding any blade that might use them.
  for (const plugin of plugins) {
    pane.registerPlugin(plugin);
  }

  const bindingRoot = paramStore.bindingTarget as unknown as Record<string, unknown>;

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    pane.dispose();
    // Belt-and-suspenders: Tweakpane's own cleanup handles its DOM, but if a
    // drag overlay leaked or tests mount+unmount rapidly, clear the host.
    container.replaceChildren();
  };

  // If there are no params, we're done — avoid adding an empty tab (Tweakpane
  // errors on `pages: []`).
  if (manifest.params.length === 0) {
    return { pane, dispose };
  }

  const pageNames = uniqueInOrder(manifest.params.map((p) => p.page ?? DEFAULT_PAGE));

  // If everything lives on a single page, skip the tab entirely — addFolder
  // directly on the Pane. This keeps the UI clean for small manifests.
  let pageContainers: Map<string, FolderContainer>;
  if (pageNames.length === 1) {
    const onlyPage = pageNames[0];
    if (!onlyPage) {
      // Defensive — uniqueInOrder preserves at least one entry.
      throw new Error('buildPaneFromManifest: unexpected empty page name');
    }
    pageContainers = new Map<string, FolderContainer>([[onlyPage, pane]]);
  } else {
    // Tweakpane v4 ships `addTab` on the inherited FolderApi; the concrete
    // `Pane` class declaration doesn't re-expose it, so we narrow via the
    // FolderContainer union (which includes FolderApi — the method's actual
    // owner) to get the tab factory.
    const folderLike: FolderContainer = pane;
    const tab = folderLike.addTab({ pages: pageNames.map((title) => ({ title })) });
    pageContainers = new Map<string, FolderContainer>();
    pageNames.forEach((name, i) => {
      const page = tab.pages[i];
      if (!page) {
        throw new Error(`buildPaneFromManifest: tab page ${i} missing after construction`);
      }
      pageContainers.set(name, page);
    });
  }

  for (const param of manifest.params) {
    const pageName = param.page ?? DEFAULT_PAGE;
    const pageContainer = pageContainers.get(pageName);
    if (!pageContainer) {
      throw new Error(`buildPaneFromManifest: page "${pageName}" missing — unreachable`);
    }
    const target: FolderContainer = param.folder
      ? getOrCreateFolder(pageContainer, param.folder)
      : pageContainer;

    addBlade(target, param, bindingRoot);
  }

  return { pane, dispose };
}

/**
 * Add a single blade (binding or button) to the chosen target. The
 * discriminated-union switch is exhaustive; the `_exhaustive: never` assign
 * in `default:` is a compile-time fence against dropping a `ParamType` here
 * without also updating the builder.
 */
function addBlade(
  target: FolderContainer,
  param: ParamDef,
  bindingRoot: Record<string, unknown>,
): void {
  const label = param.label;

  switch (param.type) {
    case 'button': {
      const btn = target.addButton({ title: label });
      btn.on('click', () => {
        param.onClick(paramStore.snapshot as Record<string, unknown>);
      });
      return;
    }
    case 'number': {
      const { host, leafKey } = resolvePath(bindingRoot, param.key);
      const opts: Record<string, unknown> = {
        label,
        min: param.min,
        max: param.max,
      };
      if (param.step !== undefined) opts.step = param.step;
      const binding = target.addBinding(host, leafKey, opts);
      binding.on('change', (ev: { value: unknown }) => {
        paramStore.set(param.key, ev.value);
      });
      return;
    }
    case 'integer': {
      const { host, leafKey } = resolvePath(bindingRoot, param.key);
      const binding = target.addBinding(host, leafKey, {
        label,
        min: param.min,
        max: param.max,
        step: param.step ?? 1,
      });
      binding.on('change', (ev: { value: unknown }) => {
        paramStore.set(param.key, ev.value);
      });
      return;
    }
    case 'boolean': {
      const { host, leafKey } = resolvePath(bindingRoot, param.key);
      const binding = target.addBinding(host, leafKey, { label });
      binding.on('change', (ev: { value: unknown }) => {
        paramStore.set(param.key, ev.value);
      });
      return;
    }
    case 'select': {
      const { host, leafKey } = resolvePath(bindingRoot, param.key);
      const binding = target.addBinding(host, leafKey, {
        label,
        options: param.options,
      });
      binding.on('change', (ev: { value: unknown }) => {
        paramStore.set(param.key, ev.value);
      });
      return;
    }
    case 'color': {
      const { host, leafKey } = resolvePath(bindingRoot, param.key);
      // Tweakpane auto-detects `#rrggbb` hex strings as colors — no opts beyond label.
      const binding = target.addBinding(host, leafKey, { label });
      binding.on('change', (ev: { value: unknown }) => {
        paramStore.set(param.key, ev.value);
      });
      return;
    }
    case 'string': {
      const { host, leafKey } = resolvePath(bindingRoot, param.key);
      const binding = target.addBinding(host, leafKey, { label });
      binding.on('change', (ev: { value: unknown }) => {
        paramStore.set(param.key, ev.value);
      });
      return;
    }
    default: {
      // Exhaustiveness fence — TS errors here if a new ParamType is added
      // without updating this switch.
      const _exhaustive: never = param;
      throw new Error(`buildPaneFromManifest: unhandled param ${JSON.stringify(_exhaustive)}`);
    }
  }
}
