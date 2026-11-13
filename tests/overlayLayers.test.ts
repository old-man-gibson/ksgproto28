import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LAYER } from '../src/ui/lib/overlays';

// The overlay stack orders by layer (ui/lib/overlays.ts), and a layer is the
// overlay's CSS z-index: the top of the stack is what is on top of the screen.
// The two live in different files, so this holds them together: each overlay
// component joins the stack on the layer its own stylesheet draws it at.

const UI = path.resolve(__dirname, '../src/ui');
const read = (file: string): string => fs.readFileSync(path.join(UI, file), 'utf8');

/** The z-index of the first rule for `selector` in the file's <style>. */
function zIndexOf(source: string, selector: string): number | null {
  const style = source.slice(source.indexOf('<style'));
  const at = style.indexOf(`${selector} {`);
  if (at < 0) return null;
  const rule = style.slice(at, style.indexOf('}', at));
  const m = /z-index:\s*(\d+)/.exec(rule);
  return m ? Number(m[1]) : null;
}

const OVERLAYS: { file: string; selector: string; layer: keyof typeof LAYER }[] = [
  { file: 'lib/Modal.svelte', selector: '.overlay', layer: 'window' },
  { file: 'DefeatModal.svelte', selector: '.overlay', layer: 'window' },
  { file: 'OfflineModal.svelte', selector: '.overlay', layer: 'report' },
  { file: 'DareModal.svelte', selector: '.overlay', layer: 'hold' },
  { file: 'EvolveModal.svelte', selector: '.overlay', layer: 'hold' },
  { file: 'PrestigeModal.svelte', selector: '.overlay', layer: 'hold' },
  { file: 'LogDrawer.svelte', selector: '.log-drawer', layer: 'drawer' },
  { file: 'MapCard.svelte', selector: '.map-card', layer: 'drawer' },
  { file: 'lib/Tip.svelte', selector: '.tip-pop', layer: 'tip' },
];

describe('overlay layers', () => {
  for (const { file, selector, layer } of OVERLAYS) {
    it(`${file} is drawn at the ${layer} layer (${LAYER[layer]}) and joins the stack on it`, () => {
      const source = read(file);
      expect(zIndexOf(source, selector), `${file} ${selector}`).toBe(LAYER[layer]);
      expect(source).toContain(`LAYER.${layer}`);
    });
  }

  it('the hold-play windows join the stack with no close, so Escape and back do nothing on them', () => {
    for (const file of ['DareModal.svelte', 'EvolveModal.svelte', 'PrestigeModal.svelte']) {
      expect(read(file), file).toContain('pushOverlay(LAYER.hold, null)');
    }
  });

  it('no overlay still reads Escape or searches the page for open windows on its own', () => {
    for (const { file } of OVERLAYS) {
      const source = read(file);
      expect(source, file).not.toMatch(/key === 'Escape'/);
      expect(source, file).not.toContain("querySelector('[role=\"dialog\"]");
    }
  });

  /** Every .svelte and .ts file under src/ui, as paths relative to it. */
  function uiFiles(dir = ''): string[] {
    return fs.readdirSync(path.join(UI, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) return e.name === 'assets' ? [] : uiFiles(rel);
      return /\.(svelte|ts)$/.test(e.name) ? [rel] : [];
    });
  }

  it('nothing in the UI reads Escape but the stack itself: a panel-local handler would be skipped by the Android back button', () => {
    for (const file of uiFiles()) {
      if (file === 'lib/overlays.ts') continue;
      expect(read(file), file).not.toMatch(/key\s*[!=]==?\s*['"](Escape|Esc)['"]/);
    }
  });

  it('the pickers and pick modes of the panels join the stack at the layer of the window they are drawn in', () => {
    for (const file of [
      'panels/BenchPanel.svelte',
      'panels/ChromosomePanel.svelte',
      'panels/CombatPanel.svelte',
      'panels/MartialPlanner.svelte',
      'panels/MusicPanel.svelte',
      'panels/SpellcraftPanel.svelte',
      'panels/WuxinPanel.svelte',
      'lib/TagPicker.svelte',
    ]) {
      const source = read(file);
      expect(source, file).toContain('hostLayer(LAYER.');
      expect(source, file).toContain('pushOverlay(');
    }
    expect(read('lib/Modal.svelte')).toContain('provideHostLayer(LAYER.window)');
  });

  it('the page layer is below every drawn overlay', () => {
    expect(LAYER.page).toBeLessThan(LAYER.drawer);
  });
});
