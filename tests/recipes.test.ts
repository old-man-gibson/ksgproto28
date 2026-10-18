import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { NPCS, SPOTS } from '../src/core/registry';
import { grantGraded, knowsRecipe, type Placement } from '../src/core/systems/disciplines';
import { previewCook } from '../src/core/systems/cooking';
import { canUse, useConsumable } from '../src/core/systems/consumables';
import { rollActivityDrops } from '../src/core/systems/activitydrops';
import type { ActivityDrop, QualityTier } from '../src/core/types';

const at = (id: string, quality: QualityTier = 'c') => ({ id, quality });
const meatAndHerb: Placement = { main: at('raw_meat'), second: at('common_herb') };

function kitchen(seed = 1) {
  const g = new Game(createInitialState(seed));
  for (const id of ['raw_meat', 'common_herb', 'river_fish', 'wild_onion', 'rough_flour', 'wild_honey']) {
    grantGraded(g.state, id, 'c', 5);
  }
  return g;
}

describe('recipe cards teach learned dishes', () => {
  it('meat + herb is a ration until the card is read, then Herb-Rubbed Meat', () => {
    const g = kitchen();
    expect(previewCook(g.state, meatAndHerb).outcome?.id).toBe('ration');
    g.state.materials.recipe_herb_rubbed_meat = 1;
    expect(useConsumable(g.state, g.bus, 'recipe_herb_rubbed_meat')).not.toBeNull();
    expect(knowsRecipe(g.state, 'herb_rubbed_meat')).toBe(true);
    expect(g.state.materials.recipe_herb_rubbed_meat ?? 0).toBe(0);
    expect(previewCook(g.state, meatAndHerb).outcome?.id).toBe('herb_rubbed_meat');
  });

  it('a card for a known recipe cannot be read again (nothing is spent)', () => {
    const g = kitchen();
    g.state.materials.recipe_fish_onion_pot = 2;
    useConsumable(g.state, g.bus, 'recipe_fish_onion_pot');
    expect(canUse(g.state, 'recipe_fish_onion_pot', 'c').ok).toBe(false);
    expect(useConsumable(g.state, g.bus, 'recipe_fish_onion_pot')).toBeNull();
    expect(g.state.materials.recipe_fish_onion_pot).toBe(1);
  });

  it('each learned dish beats the generic outcome its ingredients would otherwise make', () => {
    const g = kitchen();
    for (const r of ['herb_rubbed_meat', 'fish_onion_pot', 'lectory_porridge']) g.state.stats[`recipe:${r}`] = 1;
    // Fish + onion is meat + vegetable too: without the recipe, a stew.
    expect(previewCook(g.state, { main: at('river_fish'), second: at('wild_onion') }).outcome?.id).toBe('fish_onion_pot');
    expect(previewCook(g.state, { main: at('rough_flour'), second: at('wild_honey') }).outcome?.id).toBe('lectory_porridge');
  });

  it('the chef sells two cards; the third is not on any counter', () => {
    const lines = NPCS.head_chef.shop!.lines.map((l) => l.id);
    expect(lines).toContain('recipe_herb_rubbed_meat');
    expect(lines).toContain('recipe_fish_onion_pot');
    for (const npc of Object.values(NPCS)) {
      expect((npc.shop?.lines ?? []).map((l) => l.id)).not.toContain('recipe_lectory_porridge');
    }
  });
});

describe('reading in the Reading Hall turns up a rare recipe card', () => {
  const reading = SPOTS.the_reading_hall.activities.find((a) => a.id === 'train_int_hall')!;
  const drop = (('drops' in reading ? reading.drops : undefined) ?? [])[0] as ActivityDrop;

  it('drops within a bounded number of reps (drought-protected), then never again while held or known', () => {
    const g = new Game(createInitialState(11));
    let reps = 0;
    while ((g.state.materials.recipe_lectory_porridge ?? 0) === 0 && reps < 20000) {
      rollActivityDrops(g.state, g.bus, reading);
      reps++;
    }
    expect(g.state.materials.recipe_lectory_porridge).toBe(1);
    // Rare: not on the first handful of reps for this seed, and well inside the mercy bound.
    expect(reps).toBeGreaterThan(10);
    expect(reps).toBeLessThan(6000);
    // Held: no second copy.
    for (let i = 0; i < 5000; i++) rollActivityDrops(g.state, g.bus, reading);
    expect(g.state.materials.recipe_lectory_porridge).toBe(1);
    // Known: still none.
    useConsumable(g.state, g.bus, 'recipe_lectory_porridge');
    for (let i = 0; i < 5000; i++) rollActivityDrops(g.state, g.bus, reading);
    expect(g.state.materials.recipe_lectory_porridge ?? 0).toBe(0);
  });

  it('a completed reading rep is what rolls it', () => {
    const g = new Game(createInitialState(11));
    g.state.spot = 'the_reading_hall';
    g.selectActivity('train_int_hall');
    // Force the very next roll to pay: the drop's mercy counter at its ceiling.
    let rolls = 0;
    const orig = drop.chance;
    drop.chance = 1;
    try {
      for (let i = 0; i < 200 && !(g.state.materials.recipe_lectory_porridge ?? 0); i++) {
        g.tick();
        rolls++;
      }
    } finally {
      drop.chance = orig;
    }
    expect(g.state.materials.recipe_lectory_porridge).toBe(1);
    expect(rolls).toBeGreaterThan(1); // it waited for the rep to complete
  });
});
