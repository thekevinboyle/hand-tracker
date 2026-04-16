/**
 * Modulation panel builder (Task 4.2).
 *
 * Imperative Tweakpane Folder + Blade construction — one collapsible folder
 * per ModulationRoute, plus an "+ Add route" button. Every blade edit
 * routes to `modulationStore.upsertRoute()`; the store's subscribe fires
 * back into this builder to rebuild the folder list on structural changes
 * (add / delete).
 *
 * Pure imperative — NO React. The caller (Panel.tsx) wraps this in a
 * useEffect and invokes the returned dispose() on unmount. StrictMode
 * double-mount is survived because dispose() tears down the subscribe +
 * every per-route folder + the container folder in order.
 *
 * Contract:
 *   - Plugins (Essentials — for cubicbezier + interval blades) MUST be
 *     registered by the caller BEFORE buildModulationPage runs.
 *     `buildPaneFromManifest` already registers them on pane construction
 *     so wire in that order: buildPaneFromManifest() THEN buildModulationPage().
 *   - Every on('change') handler casts event.value at the type boundary;
 *     never `any`. Tweakpane blades return `unknown` by default.
 *   - `crypto.randomUUID()` is used ONLY in the Add-Route click handler —
 *     never in the render hot path (D20).
 */

import type { FolderApi, Pane, TabPageApi } from 'tweakpane';
import type { ModulationRoute, ModulationSourceId } from '../engine/modulation';
import { modulationStore } from '../engine/modulationStore';

/** Tweakpane v4's concrete `Pane` class inherits `addFolder` / `addButton`
 *  from `FolderApi` but its TypeScript declaration doesn't re-expose them.
 *  Widening via this union matches the pattern in
 *  `src/engine/buildPaneFromManifest.ts`. */
type FolderContainer = Pane | TabPageApi | FolderApi;

/** Every landmark[0..20].x|y + pinch + centroid.x|y — 45 entries, matches
 *  the manifest's `modulationSources` declaration. Precomputed once at
 *  module load so the Source dropdown doesn't rebuild its option map per
 *  folder. */
const SOURCE_OPTIONS: Record<string, ModulationSourceId> = (() => {
  const out: Record<string, ModulationSourceId> = {};
  for (let i = 0; i < 21; i++) {
    out[`Landmark ${i} X`] = `landmark[${i}].x` as ModulationSourceId;
    out[`Landmark ${i} Y`] = `landmark[${i}].y` as ModulationSourceId;
  }
  out['Pinch strength'] = 'pinch';
  out['Hand centroid X'] = 'centroid.x';
  out['Hand centroid Y'] = 'centroid.y';
  return out;
})();

/** D14 curve palette — same five values the evaluator recognises. */
const CURVE_OPTIONS = {
  Linear: 'linear',
  'Ease In': 'easeIn',
  'Ease Out': 'easeOut',
  'Ease In-Out': 'easeInOut',
  'Cubic Bezier': 'cubicBezier',
} as const satisfies Record<string, ModulationRoute['curve']>;

type IntervalValue = { min: number; max: number };

/**
 * Render one route's controls into `container`. Returns a `dispose` that
 * removes the folder (and every blade + binding inside it) on cleanup.
 * Every control's on('change') calls `modulationStore.upsertRoute(...)`,
 * which triggers the page's subscriber to rebuild — do NOT call
 * `pane.refresh()` here (causes double-render + breaks drag interactions
 * on the cubicbezier blade).
 */
export function addRouteControls(container: FolderApi, route: ModulationRoute): () => void {
  const folder = container.addFolder({
    title: `Route: ${route.source} → ${route.targetParam}`,
    expanded: false,
  });

  const enabledObj = { enabled: route.enabled };
  folder
    .addBinding(enabledObj, 'enabled', { label: 'Enabled' })
    .on('change', (ev: { value: unknown }) => {
      modulationStore.upsertRoute({ ...route, enabled: Boolean(ev.value) });
    });

  const sourceObj = { source: route.source };
  folder
    .addBinding(sourceObj, 'source', { label: 'Source', options: SOURCE_OPTIONS })
    .on('change', (ev: { value: unknown }) => {
      modulationStore.upsertRoute({ ...route, source: ev.value as ModulationSourceId });
    });

  const targetObj = { targetParam: route.targetParam };
  folder
    .addBinding(targetObj, 'targetParam', { label: 'Target param' })
    .on('change', (ev: { value: unknown }) => {
      modulationStore.upsertRoute({ ...route, targetParam: String(ev.value) });
    });

  // @tweakpane/plugin-essentials v0.2.1 ships `interval` as an INPUT plugin
  // (not a blade) — so we use `addBinding(host, key, opts)` with a
  // `{ min, max }`-shaped host object. The plugin's accept() checks for
  // `Interval.isObject(exValue)` i.e. the bound object itself has numeric
  // `min` + `max` keys.
  const inputRangeObj = { value: { min: route.inputRange[0], max: route.inputRange[1] } };
  folder
    .addBinding(inputRangeObj, 'value', {
      label: 'Input range',
      min: -1,
      max: 2,
      step: 0.01,
    })
    .on('change', (ev: { value: unknown }) => {
      const v = ev.value as IntervalValue;
      modulationStore.upsertRoute({ ...route, inputRange: [v.min, v.max] });
    });

  const outputRangeObj = { value: { min: route.outputRange[0], max: route.outputRange[1] } };
  folder
    .addBinding(outputRangeObj, 'value', {
      label: 'Output range',
      min: -100,
      max: 200,
      step: 0.5,
    })
    .on('change', (ev: { value: unknown }) => {
      const v = ev.value as IntervalValue;
      modulationStore.upsertRoute({ ...route, outputRange: [v.min, v.max] });
    });

  const curveObj = { curve: route.curve };
  folder
    .addBinding(curveObj, 'curve', { label: 'Curve', options: CURVE_OPTIONS })
    .on('change', (ev: { value: unknown }) => {
      modulationStore.upsertRoute({
        ...route,
        curve: ev.value as ModulationRoute['curve'],
      });
    });

  const bezierCp: [number, number, number, number] = route.bezierControlPoints ?? [0.5, 0, 0.5, 1];
  folder
    .addBlade({
      view: 'cubicbezier',
      value: bezierCp,
      expanded: false,
      label: 'Bezier curve',
      picker: 'inline',
    })
    .on('change', (ev: { value: unknown }) => {
      modulationStore.upsertRoute({
        ...route,
        bezierControlPoints: ev.value as [number, number, number, number],
      });
    });

  folder.addButton({ title: 'Delete route' }).on('click', () => {
    modulationStore.deleteRoute(route.id);
  });

  return () => {
    folder.dispose();
  };
}

/**
 * Build the "Modulation" section on an existing Pane. Registers a
 * subscriber on `modulationStore` that rebuilds every per-route folder
 * on structural changes. Returns a dispose function that tears down the
 * subscriber + every folder + the container.
 */
export function buildModulationPage(pane: Pane): () => void {
  // Widen to FolderContainer — Tweakpane v4's Pane class inherits addFolder
  // from FolderApi but the TS declaration omits it. See comment above.
  const folderLike: FolderContainer = pane;
  const container = folderLike.addFolder({ title: 'Modulation', expanded: true });

  let folderDisposers: Array<() => void> = [];

  function rebuildFolders(): void {
    for (const d of folderDisposers) d();
    folderDisposers = modulationStore
      .getSnapshot()
      .routes.map((r) => addRouteControls(container, r));
  }

  rebuildFolders();
  const unsubscribe = modulationStore.subscribe(rebuildFolders);

  container.addButton({ title: '+ Add route' }).on('click', () => {
    modulationStore.upsertRoute({
      id: crypto.randomUUID(),
      enabled: true,
      source: 'landmark[8].x',
      targetParam: 'mosaic.tileSize',
      inputRange: [0, 1],
      outputRange: [4, 64],
      curve: 'linear',
    });
  });

  return () => {
    unsubscribe();
    for (const d of folderDisposers) d();
    folderDisposers = [];
    container.dispose();
  };
}
