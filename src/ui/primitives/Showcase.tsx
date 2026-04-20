/*
 * src/ui/primitives/Showcase.tsx — dev-only primitives showcase (Task DR-7.R).
 *
 * Renders every Phase DR-7 primitive side-by-side with representative props
 * for manual QA and Playwright regression. Mounted in place of <App /> when
 *   (import.meta.env.DEV || import.meta.env.MODE === 'test')
 *   && window.location.pathname === '/primitives'
 * (see src/main.tsx). Tree-shaken from production builds because Vite
 * statically replaces both env flags at build time and eliminates the
 * dynamic `import()` branch that references this module.
 *
 * paramStore pre-seed (synergy HIGH-08): the side-effect import of
 * './effects/handTrackingMosaic' from main.tsx runs `paramStore.replace(
 * DEFAULT_PARAM_STATE)` BEFORE this component mounts, so the useParam demo
 * row below reads a valid `mosaic.tileSize = 16` and the setter does not
 * throw.
 *
 * Testid discipline (synergy CRITICAL-06): every showcase instance of a
 * primitive carries an EXPLICIT `testid` so siblings of the same variant do
 * not collide on the primitive's default testid. Example: two
 * <Button variant="primary"> instances (Record + Disabled) both would default
 * to `data-testid="button-primary"`; we override both.
 *
 * Authority:
 *   - task-DR-7-R.md — Showcase spec + testid matrix
 *   - `custom-param-components` skill §2 — useParam contract
 *   - DISCOVERY.md DR14 — dev-only affordances gated via import.meta.env.DEV
 */

import { type JSX, useState } from 'react';
import { Button } from './Button';
import { ColorPicker } from './ColorPicker';
import { LayerCard, LayerSection } from './LayerCard';
import { Segmented } from './Segmented';
import styles from './Showcase.module.css';
import { RangeSlider, Slider } from './Slider';
import { Toggle } from './Toggle';
import { useParam } from './useParam';

export function Showcase(): JSX.Element {
  const [segValue, setSegValue] = useState<number>(16);
  const [sliderValue, setSliderValue] = useState<number>(50);
  const [rangeValue, setRangeValue] = useState<readonly [number, number]>([20, 80]);
  const [toggleOn, setToggleOn] = useState<boolean>(true);
  const [hex, setHex] = useState<string>('#00ff88');
  const [tileSize, setTileSize] = useParam('mosaic.tileSize');

  return (
    <main className={styles.root} data-testid="showcase-root">
      <h1 className={styles.title}>Hand Tracker FX — Primitives Showcase</h1>
      <p className={styles.subtitle}>
        Dev-only regression fixture (DR-7.R). Not shipped to production.
      </p>

      <section className={styles.section} data-testid="showcase-button">
        <h2 className={styles.heading}>Button</h2>
        <div className={styles.row}>
          <Button testid="showcase-record" variant="primary">
            Record
          </Button>
          <Button testid="showcase-randomize" variant="secondary">
            Randomize
          </Button>
          <Button testid="showcase-delete" variant="text">
            Delete
          </Button>
          <Button testid="showcase-close" variant="icon" aria-label="Close">
            ×
          </Button>
          <Button testid="showcase-disabled" variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </section>

      <section className={styles.section} data-testid="showcase-segmented">
        <h2 className={styles.heading}>Segmented</h2>
        <Segmented<number>
          ariaLabel="Cell size"
          testid="showcase-segmented-ctrl"
          options={[
            { value: 4, label: 'XS' },
            { value: 8, label: 'S' },
            { value: 16, label: 'M' },
            { value: 32, label: 'L' },
            { value: 64, label: 'XL' },
          ]}
          value={segValue}
          onChange={setSegValue}
        />
      </section>

      <section className={styles.section} data-testid="showcase-slider">
        <h2 className={styles.heading}>Slider</h2>
        <Slider
          testid="showcase-slider-ctrl"
          min={0}
          max={100}
          step={1}
          value={sliderValue}
          onChange={setSliderValue}
          ariaLabel="Demo slider"
        />
        <h3 className={styles.subheading}>RangeSlider</h3>
        <RangeSlider
          testid="showcase-range-ctrl"
          min={0}
          max={100}
          step={1}
          value={rangeValue}
          onChange={setRangeValue}
          ariaLabel="Demo range"
        />
      </section>

      <section className={styles.section} data-testid="showcase-toggle">
        <h2 className={styles.heading}>Toggle</h2>
        <Toggle
          testid="showcase-toggle-ctrl"
          checked={toggleOn}
          onChange={setToggleOn}
          ariaLabel="Demo toggle"
        />
      </section>

      <section className={styles.section} data-testid="showcase-color-picker">
        <h2 className={styles.heading}>ColorPicker</h2>
        <ColorPicker
          testid="showcase-color-ctrl"
          value={hex}
          onChange={setHex}
          ariaLabel="Demo color"
        />
      </section>

      <section className={styles.section} data-testid="showcase-layer-card">
        <h2 className={styles.heading}>LayerCard</h2>
        <LayerCard
          testid="showcase-layer-card-1"
          title="LAYER 1"
          action={
            <Button testid="showcase-layer-card-delete" variant="text">
              Delete
            </Button>
          }
        >
          <LayerSection testid="showcase-layer-section-grid" heading="Grid">
            Grid controls…
          </LayerSection>
          <LayerSection testid="showcase-layer-section-mosaic" heading="Mosaic">
            Mosaic controls…
          </LayerSection>
          <LayerSection testid="showcase-layer-section-input" heading="Input" withDivider={false}>
            Input controls…
          </LayerSection>
        </LayerCard>
        <LayerCard testid="showcase-layer-card-2" title="MODULATION" collapsible defaultCollapsed>
          <LayerSection testid="showcase-layer-section-routes" heading="Routes">
            Routes…
          </LayerSection>
        </LayerCard>
      </section>

      <section className={styles.section} data-testid="showcase-use-param">
        <h2 className={styles.heading}>useParam demo (mosaic.tileSize)</h2>
        <p data-testid="showcase-tilesize-value">Current: {tileSize}</p>
        <Button
          testid="showcase-toggle-tilesize"
          variant="secondary"
          onClick={() => setTileSize(tileSize === 16 ? 32 : 16)}
        >
          Toggle 16 ↔ 32
        </Button>
      </section>
    </main>
  );
}
