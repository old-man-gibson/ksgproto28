import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { MATERIALS, NPCS, RECIPES, SPOTS } from '../src/core/registry';
import { dropChance, foundKey, rollActivityDrops } from '../src/core/systems/activitydrops';
import { canUse, useConsumable } from '../src/core/systems/consumables';
import { favorWith, floatingFavor } from '../src/core/systems/divine';
import { meetDeity, wordUnlocked, deityKnown } from '../src/core/systems/unlocks';
import { hasTitle } from '../src/core/systems/titles';
import { buyPrice, resaleCeiling } from '../src/core/systems/shops';
import { recipeHidden } from '../src/core/systems/crafting';
import { stockOf } from '../src/core/systems/disciplines';
import { getDerivedStats } from '../src/core/systems/derived';
import type { ActivityDef, ActivityDrop } from '../src/core/types';

/** The eight district finds, as the user approved them (2026-10-17). */
const FINDS: [spot: string, activity: string, material: string][] = [
  ['chalk_yard', 'train_int_chalk', 'word_slip_stone'],
  ['the_nine_chapels', 'train_wis_chapels', 'votive_token'],
  ['the_sand', 'spar_sand', 'drill_manual_riposte'],
  ['the_alembics', 'job_retorts', 'emberbloom'],
  ['the_rolls', 'job_copying', 'chancery_price_seal'],
  ['the_holding', 'job_watch', 'unclaimed_case_file'],
  ['the_forges', 'job_bellows_threshold', 'smiths_pattern_bronze'],
  ['granary_kitchens', 'job_pans', 'iron_pot'],
];
const act = (spot: string, id: string) => SPOTS[spot].activities.find((a) => a.id === id) as ActivityDef;
const dropOf = (a: ActivityDef) => (('drops' in a ? a.drops : undefined) ?? [])[0] as ActivityDrop;
const fresh = (seed = 5) => new Game(createInitialState(seed));
/** Hold one of a material and use it. */
function use(g: Game, id: string) {
  g.state.materials[id] = (g.state.materials[id] ?? 0) + 1;
  return useConsumable(g.state, g.bus, id);
}

describe('one rare find per district', () => {
  it('each named activity drops its find, at roughly one per 40 minutes of the activity', () => {
    for (const [spot, id, material] of FINDS) {
      const a = act(spot, id);
      expect(a, `${spot}/${id}`).toBeDefined();
      const d = dropOf(a);
      expect(d.material, `${spot}/${id}`).toBe(material);
      const cycle = a.kind === 'train' ? 20 : (a as { ticksPer: number }).ticksPer;
      // per-cycle chance ≈ cycle ticks / 24,000 (40 min), within rounding
      expect(d.chance * 24000, `${spot}/${id}`).toBeCloseTo(cycle, -1);
    }
  });

  it('is unmarked: no spot description mentions its find', () => {
    for (const [spot, , material] of FINDS) {
      const desc = SPOTS[spot].desc ?? '';
      expect(desc.toLowerCase(), spot).not.toContain(MATERIALS[material].name.toLowerCase());
      expect(desc.toLowerCase(), spot).not.toContain('rare');
    }
    expect(SPOTS.the_reading_hall.desc).not.toMatch(/recipe/i);
  });

  it('a find drops within its mercy bound, and a spent card is never rolled again', () => {
    const g = fresh(21);
    const a = act('chalk_yard', 'train_int_chalk');
    let reps = 0;
    while (!g.state.materials.word_slip_stone && reps < 20000) {
      rollActivityDrops(g.state, g.bus, a);
      reps++;
    }
    expect(g.state.materials.word_slip_stone).toBe(1);
    expect(reps).toBeLessThan(6000);
    useConsumable(g.state, g.bus, 'word_slip_stone');
    for (let i = 0; i < 5000; i++) rollActivityDrops(g.state, g.bus, a);
    expect(g.state.materials.word_slip_stone ?? 0).toBe(0);
  });
});

describe('what each find does', () => {
  it('Scholars: the word slip lifts "stone", once', () => {
    const g = fresh();
    expect(wordUnlocked(g.state, 'stone')).toBe(false);
    use(g, 'word_slip_stone');
    expect(wordUnlocked(g.state, 'stone')).toBe(true);
    g.state.materials.word_slip_stone = 1;
    expect(canUse(g.state, 'word_slip_stone', 'c').ok).toBe(false);
  });

  it('Temple: the first token is +2 with every god now and later; later ones are floating favor', () => {
    const g = fresh();
    const before = favorWith(g.state, 'denjalle');
    use(g, 'votive_token');
    expect(favorWith(g.state, 'denjalle')).toBe(before + 2);
    expect(favorWith(g.state, 'usvylgr')).toBe(before + 2);
    expect(floatingFavor(g.state)).toBe(0);
    use(g, 'votive_token');
    use(g, 'votive_token');
    expect(favorWith(g.state, 'denjalle')).toBe(before + 2);
    expect(floatingFavor(g.state)).toBe(2);
    expect(g.assignFloatingFavor('usvylgr')).toBe(true);
    expect(favorWith(g.state, 'usvylgr')).toBe(before + 3);
    expect(floatingFavor(g.state)).toBe(1);
    // An unknown god cannot take it.
    expect(g.assignFloatingFavor('ikthelthe')).toBe(false);
    // A god met later starts at the first token's +2.
    expect(deityKnown(g.state, 'ikthelthe')).toBe(false);
    expect(meetDeity(g.state, g.bus, 'ikthelthe')).toBe(true);
    expect(favorWith(g.state, 'ikthelthe')).toBe(2);
  });

  it('Temple: each token found makes the next one half as likely', () => {
    const g = fresh();
    const d = dropOf(act('the_nine_chapels', 'train_wis_chapels'));
    expect(dropChance(g.state, d)).toBeCloseTo(d.chance, 10);
    g.state.stats[foundKey('votive_token')] = 2;
    expect(dropChance(g.state, d)).toBeCloseTo(d.chance / 4, 10);
  });

  it('Ironyard: the manual teaches Riposte in canonical form, or perfects a rough one', () => {
    const g = fresh();
    g.state.techniques = { riposte: { executions: 3, form: 'rough' } };
    use(g, 'drill_manual_riposte');
    expect(g.state.techniques.riposte.form).toBe('canonical');
    expect(g.state.techniques.riposte.executions).toBe(3);
  });

  it('Chancery: the seal takes 10% off at every counter, never below resale', () => {
    const g = fresh();
    const goldGain = getDerivedStats(g.state).goldGain;
    const line = NPCS.master_smith.shop!.lines[0];
    const before = buyPrice(g.state, 'master_smith', line, goldGain);
    use(g, 'chancery_price_seal');
    const after = buyPrice(g.state, 'master_smith', line, goldGain);
    expect(after).toBeLessThanOrEqual(before);
    expect(after).toBeGreaterThan(resaleCeiling(g.state, line, goldGain));
    const pricey = NPCS.head_chef.shop!.lines.find((l) => l.id === 'recipe_fish_onion_pot')!;
    g.state.stats['flag:chancery_seal'] = 0;
    const full = buyPrice(g.state, 'head_chef', pricey, goldGain);
    g.state.stats['flag:chancery_seal'] = 1;
    expect(buyPrice(g.state, 'head_chef', pricey, goldGain)).toBe(Math.max(Math.ceil(full * 0.9), resaleCeiling(g.state, pricey, goldGain) + 1));
  });

  it('Assize: the case file earns the hidden title Friend of the Court', () => {
    const g = fresh();
    expect(hasTitle(g.state, 'friend_of_the_court')).toBe(false);
    use(g, 'unclaimed_case_file');
    expect(hasTitle(g.state, 'friend_of_the_court')).toBe(true);
  });

  it('Wrights: the bronze line is not listed until the pattern is studied', () => {
    const g = fresh();
    for (const id of ['copper_ingot', 'tin_ingot', 'bronze_ingot', 'bronze_dagger']) {
      expect(recipeHidden(g.state, RECIPES[id]), id).toBe(true);
    }
    use(g, 'smiths_pattern_bronze');
    for (const id of ['copper_ingot', 'tin_ingot', 'bronze_ingot', 'bronze_dagger']) {
      expect(recipeHidden(g.state, RECIPES[id]), id).toBe(false);
    }
    expect(RECIPES.bronze_dagger.result.id).toBe('bronze_dagger');
    expect(SPOTS.the_forges.recipes).toContain('bronze_ingot');
  });

  it('Granaries: the pot arrives at a pinned grade and is not rolled while one is held', () => {
    const g = fresh(9);
    const a = act('granary_kitchens', 'job_pans');
    const d = dropOf(a);
    const orig = d.chance;
    d.chance = 1;
    try {
      rollActivityDrops(g.state, g.bus, a);
      expect(stockOf(g.state, 'iron_pot', 'b')).toBe(1);
      rollActivityDrops(g.state, g.bus, a);
      expect(stockOf(g.state, 'iron_pot', 'b')).toBe(1);
    } finally {
      d.chance = orig;
    }
  });

  it('Alembic Row: the Retorts job pays and turns up three emberbloom at once', () => {
    const g = fresh(9);
    const a = act('the_alembics', 'job_retorts');
    expect(a.kind).toBe('job');
    const d = dropOf(a);
    const orig = d.chance;
    d.chance = 1;
    try {
      rollActivityDrops(g.state, g.bus, a);
    } finally {
      d.chance = orig;
    }
    const held = Object.values(g.state.stock.emberbloom ?? {}).reduce((n, q) => n + (q ?? 0), 0);
    expect(held).toBe(3);
  });
});
