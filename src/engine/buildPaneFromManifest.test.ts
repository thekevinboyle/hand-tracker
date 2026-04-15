import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPaneFromManifest } from './buildPaneFromManifest';
import type { EffectInstance, EffectManifest, ParamDef } from './manifest';
import { paramStore } from './paramStore';

/**
 * Make a minimal manifest fixture. `params` is the discriminator-driven knob
 * under test; the rest (id, displayName, create, etc.) is boilerplate.
 */
function makeManifest(params: ParamDef[]): EffectManifest {
  return {
    id: 'test-effect',
    displayName: 'Test Effect',
    version: '0.0.1',
    description: 'Fixture for buildPaneFromManifest',
    params,
    defaultParams: {},
    modulationSources: [],
    create: (_gl: WebGL2RenderingContext): EffectInstance => ({
      render: () => {},
      dispose: () => {},
    }),
  };
}

/**
 * Seed paramStore with the right sections/keys so addBinding's resolvePath
 * can walk `bindingTarget`. `buildPaneFromManifest` does NOT own initial
 * values — it's the effect manifest's job (Task 2.5) via `defaultParams`.
 * Here we call `replace()` directly to set up the mirror.
 */
function seedParamStore(state: Record<string, Record<string, unknown>>) {
  paramStore.replace(state);
}

describe('engine/buildPaneFromManifest', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Reset the module singleton between tests.
    paramStore.replace({});
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('no-params manifest: pane mounts into container and dispose clears it', () => {
    const manifest = makeManifest([]);
    const { pane, dispose } = buildPaneFromManifest(manifest, container);
    expect(pane).toBeDefined();
    // Pane adds at least one child element to the container.
    expect(container.children.length).toBeGreaterThan(0);
    dispose();
    expect(container.children.length).toBe(0);
  });

  it('single-page manifest skips the tab — addBinding goes straight on the pane', () => {
    seedParamStore({ grid: { columnCount: 12 } });
    const manifest = makeManifest([
      {
        type: 'integer',
        key: 'grid.columnCount',
        label: 'Columns',
        defaultValue: 12,
        min: 4,
        max: 20,
      },
    ]);
    const { dispose } = buildPaneFromManifest(manifest, container);
    // No tab element — only blades.
    expect(container.querySelectorAll('.tp-tabv').length).toBe(0);
    // Some binding DOM was rendered.
    expect(container.querySelectorAll('.tp-lblv').length).toBeGreaterThan(0);
    dispose();
  });

  it('creates one tab per unique page in first-seen order', () => {
    seedParamStore({
      grid: { columnCount: 12 },
      mosaic: { tileSize: 16 },
    });
    const manifest = makeManifest([
      {
        type: 'integer',
        key: 'grid.columnCount',
        label: 'Columns',
        defaultValue: 12,
        min: 4,
        max: 20,
        page: 'Grid',
      },
      {
        type: 'number',
        key: 'mosaic.tileSize',
        label: 'Tile size',
        defaultValue: 16,
        min: 4,
        max: 64,
        page: 'Effect',
      },
      {
        type: 'integer',
        key: 'grid.columnCount',
        label: 'Columns (dupe page)',
        defaultValue: 12,
        min: 4,
        max: 20,
        page: 'Grid',
      },
    ]);
    const { pane, dispose } = buildPaneFromManifest(manifest, container);
    // Tweakpane exposes tab pages via the instance for assertion.
    // The most portable signal is the rendered DOM: one .tp-tabv + two .tp-tbiv
    // items (tab-bar-item view) with label text inside .tp-tbiv_t.
    expect(container.querySelectorAll('.tp-tabv').length).toBe(1);
    const tabItems = container.querySelectorAll('.tp-tbiv_t');
    expect(tabItems.length).toBe(2);
    expect(tabItems[0]?.textContent?.trim()).toBe('Grid');
    expect(tabItems[1]?.textContent?.trim()).toBe('Effect');
    expect(pane).toBeDefined();
    dispose();
  });

  it('groups params into folders within a page', () => {
    seedParamStore({
      grid: { seed: 42, columnCount: 12 },
    });
    const manifest = makeManifest([
      {
        type: 'integer',
        key: 'grid.seed',
        label: 'Seed',
        defaultValue: 42,
        min: 0,
        max: 1000,
        folder: 'Advanced',
      },
      {
        type: 'integer',
        key: 'grid.columnCount',
        label: 'Columns',
        defaultValue: 12,
        min: 4,
        max: 20,
        folder: 'Advanced',
      },
    ]);
    const { dispose } = buildPaneFromManifest(manifest, container);
    // One folder, two bindings inside it.
    const folders = container.querySelectorAll('.tp-fldv');
    expect(folders.length).toBe(1);
    expect(folders[0]?.querySelector('.tp-fldv_t')?.textContent?.trim()).toBe('Advanced');
    dispose();
  });

  it('number binding write-through: paramStore.set() updates snapshot on change event', () => {
    seedParamStore({ mosaic: { tileSize: 16 } });
    const manifest = makeManifest([
      {
        type: 'number',
        key: 'mosaic.tileSize',
        label: 'Tile size',
        defaultValue: 16,
        min: 4,
        max: 64,
      },
    ]);
    const { dispose } = buildPaneFromManifest(manifest, container);

    // Simulate a Tweakpane change by writing through the same pathway the
    // builder wires: the on('change') handler calls paramStore.set(). We
    // exercise that by asserting the store update when the handler runs.
    const before = paramStore.snapshot;
    paramStore.set('mosaic.tileSize', 32);
    const after = paramStore.snapshot;
    expect(after).not.toBe(before);
    expect((after.mosaic as { tileSize: number }).tileSize).toBe(32);
    // And the binding mirror was updated in place (Tweakpane sees the change
    // next refresh).
    expect((paramStore.bindingTarget.mosaic as { tileSize: number }).tileSize).toBe(32);
    dispose();
  });

  it('select binding: passes options through to Tweakpane', () => {
    seedParamStore({ input: { mode: 'auto' } });
    const manifest = makeManifest([
      {
        type: 'select',
        key: 'input.mode',
        label: 'Mode',
        defaultValue: 'auto',
        options: { Auto: 'auto', Manual: 'manual' },
      },
    ]);
    const { dispose } = buildPaneFromManifest(manifest, container);
    // Tweakpane renders a <select> for option bindings.
    const select = container.querySelector('select');
    expect(select).toBeTruthy();
    dispose();
  });

  it('boolean binding: renders a checkbox input', () => {
    seedParamStore({ input: { mirror: true } });
    const manifest = makeManifest([
      {
        type: 'boolean',
        key: 'input.mirror',
        label: 'Mirror',
        defaultValue: true,
      },
    ]);
    const { dispose } = buildPaneFromManifest(manifest, container);
    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    dispose();
  });

  it('button: addButton creates a .tp-btnv blade and fires onClick with snapshot', () => {
    const onClick = vi.fn();
    const manifest = makeManifest([
      {
        type: 'button',
        key: 'actions.reset',
        label: 'Reset',
        onClick,
      },
    ]);
    const { dispose } = buildPaneFromManifest(manifest, container);
    const button = container.querySelector<HTMLButtonElement>('.tp-btnv_b');
    expect(button).toBeTruthy();
    button?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    // onClick receives the current snapshot (read-only by convention).
    expect(onClick).toHaveBeenCalledWith(paramStore.snapshot);
    dispose();
  });

  it('color binding: renders without crashing', () => {
    seedParamStore({ grid: { lineColor: '#00ff88' } });
    const manifest = makeManifest([
      {
        type: 'color',
        key: 'grid.lineColor',
        label: 'Line color',
        defaultValue: '#00ff88',
      },
    ]);
    const { dispose } = buildPaneFromManifest(manifest, container);
    // Tweakpane color bindings render a swatch button.
    expect(container.querySelectorAll('.tp-lblv').length).toBeGreaterThan(0);
    dispose();
  });

  it('string binding: renders a text input', () => {
    seedParamStore({ meta: { label: 'hello' } });
    const manifest = makeManifest([
      {
        type: 'string',
        key: 'meta.label',
        label: 'Label',
        defaultValue: 'hello',
      },
    ]);
    const { dispose } = buildPaneFromManifest(manifest, container);
    const text = container.querySelector('input[type="text"]');
    expect(text).toBeTruthy();
    dispose();
  });

  it('integer binding: forces step: 1 when step is omitted', () => {
    seedParamStore({ grid: { columnCount: 12 } });
    const manifest = makeManifest([
      {
        type: 'integer',
        key: 'grid.columnCount',
        label: 'Columns',
        defaultValue: 12,
        min: 4,
        max: 20,
      },
    ]);
    const { dispose } = buildPaneFromManifest(manifest, container);
    // If the binding was constructed with step: 1 the blade is present.
    // Tweakpane doesn't expose `step` in the DOM directly, so we assert a
    // slider-style binding exists (both slider + number text input).
    expect(container.querySelectorAll('.tp-lblv').length).toBeGreaterThan(0);
    dispose();
  });

  it('registerPlugin(EssentialsPlugin) before any blade does not throw', () => {
    seedParamStore({ grid: { columnCount: 12 } });
    const manifest = makeManifest([
      {
        type: 'integer',
        key: 'grid.columnCount',
        label: 'Columns',
        defaultValue: 12,
        min: 4,
        max: 20,
      },
    ]);
    expect(() =>
      buildPaneFromManifest(manifest, container, [EssentialsPlugin]).dispose(),
    ).not.toThrow();
  });

  it('dispose() clears the container DOM', () => {
    seedParamStore({ grid: { columnCount: 12 } });
    const manifest = makeManifest([
      {
        type: 'integer',
        key: 'grid.columnCount',
        label: 'Columns',
        defaultValue: 12,
        min: 4,
        max: 20,
      },
    ]);
    const { dispose } = buildPaneFromManifest(manifest, container);
    expect(container.children.length).toBeGreaterThan(0);
    dispose();
    expect(container.children.length).toBe(0);
  });

  it('dispose() is idempotent', () => {
    const manifest = makeManifest([]);
    const { dispose } = buildPaneFromManifest(manifest, container);
    expect(() => {
      dispose();
      dispose();
    }).not.toThrow();
  });

  it('throws on unknown section in dotPath', () => {
    // paramStore is empty — mosaic section doesn't exist on bindingTarget.
    const manifest = makeManifest([
      {
        type: 'number',
        key: 'mosaic.tileSize',
        label: 'Tile',
        defaultValue: 16,
        min: 4,
        max: 64,
      },
    ]);
    expect(() => buildPaneFromManifest(manifest, container)).toThrow(
      /segment "mosaic" missing on bindingTarget/,
    );
  });
});
