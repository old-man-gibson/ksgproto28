// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { grantGraded, stockOf, type Placement } from '../src/core/systems/disciplines';
import {
  ALCHEMY,
  activeCoating,
  brew,
  canUseFlask,
  composeBrew,
  formOf,
  previewBrew,
  resolveBrew,
  spendCoating,
  useFlask,
} from '../src/core/systems/alchemy';
import { BREW_MAX_DURATION, REAGENTS, formulaFor } from '../src/core/data/alchemy.data';
import { deserialize, serialize } from '../src/core/save/save';
import { noveltyKeys } from '../src/core/systems/disciplines';
import { applyStatus, fireStatusEvent, hasStatus } from '../src/core/systems/statuses';
import { isHarmful } from '../src/core/systems/conditionHarm';
import { MIRACLES, STATUSES } from '../src/core/registry';
import { DISCIPLINES } from '../src/core/data/disciplines.data';
import type { GradedStack, QualityTier, StatusApplication } from '../src/core/types';
import { text } from '../src/core/text/log';

const fresh = (seed = 1) => new Game(createInitialState(seed));
const at = (id: string, quality: QualityTier = 'c'): GradedStack => ({ id, quality });

/** Stock the whole shelf and open every step, so sequence is the only variable. */
function shelf(g: Game, level = 40) {
  for (const id of Object.keys(REAGENTS)) {
    for (const q of ['f', 'c', 'a', 's'] as QualityTier[]) grantGraded(g.state, id, q, 10);
  }
  g.state.skills.alchemy = { level, xp: 0 };
}

/** Lay a sequence out across the alembic's numbered steps. */
const lay = (...ids: (string | GradedStack)[]): Placement => {
  const out: Placement = {};
  ids.forEach((v, i) => {
    out[`step${i + 1}`] = typeof v === 'string' ? at(v) : v;
  });
  return out;
};

const seq = (...ids: string[]) => composeBrew(ids.map((id) => at(id)));

describe('the sequence is the recipe', () => {
  it('reverses into a different brew — the whole premise', () => {
    const early = seq('spring_water', 'gloomcap', 'mendroot');
    const late = seq('spring_water', 'mendroot', 'gloomcap');
    // Same three reagents, same grades. Only the order moved.
    expect(early.potency).toBeCloseTo(late.potency, 5);
    // ...and what they are OF is not the same brew at all.
    expect(early.essences[0].spec.id).toBe('mending');
    expect(late.essences[0].spec.id).toBe('gloom');
  });

  it('law 1: steeping trades character for strength', () => {
    // One essence, moved from last to first as the sequence grows around it.
    const last = seq('spring_water', 'emberbloom');
    const buried = seq('spring_water', 'emberbloom', 'fixing_salt', 'bone_ash');
    expect(last.essences[0].weight).toBeGreaterThan(buried.essences[0]?.weight ?? 0);
    expect(buried.potency).toBeGreaterThan(last.potency);
  });

  it('law 1: an essence added last keeps all of itself', () => {
    const s = seq('spring_water', 'quicksilver', 'emberbloom');
    // Nothing follows the bloom, so nothing dissolved it: full power, at C.
    expect(s.essences[0].weight).toBeCloseTo(REAGENTS.emberbloom.essence!.power, 5);
  });

  it('law 2: an operator finds only what came before it', () => {
    // Salt first has nothing to settle; salt last quenches what the spirit did.
    const saltFirst = seq('fixing_salt', 'grain_spirit', 'quicksilver', 'emberbloom');
    const saltLast = seq('grain_spirit', 'quicksilver', 'emberbloom', 'fixing_salt');
    expect(saltFirst.volatility).toBeGreaterThan(saltLast.volatility);
    expect(saltLast.duration).toBeGreaterThan(saltFirst.duration);
  });

  it('law 2: brimstone catches only in a brew already running', () => {
    const roused = seq('grain_spirit', 'quicksilver', 'emberbloom', 'brimstone');
    const cold = seq('spring_water', 'emberbloom', 'brimstone');
    expect(roused.notes[3]).toContain('so it ignites');
    expect(cold.notes[2]).toContain('so it fails');
  });

  it('law 2: ash takes the weakest substance out, and only when there is one', () => {
    const purified = seq('spring_water', 'frostmoss', 'emberbloom', 'bone_ash');
    // Two essences went in; the weaker was removed rather than diluted.
    expect(purified.essences).toHaveLength(1);
    const useless = seq('bone_ash', 'spring_water', 'emberbloom');
    expect(useless.notes[0]).toContain('No essence before it');
  });
});

describe('the reading', () => {
  it('has exactly one line per step, in order, each naming its reagent', () => {
    const ids = ['grain_spirit', 'quicksilver', 'emberbloom', 'brimstone', 'fixing_salt'];
    const s = seq(...ids);
    expect(s.notes).toHaveLength(ids.length);
    ids.forEach((id, i) => expect(s.notes[i]).toContain(REAGENTS[id].name));
  });

  it('opens the summary with the form and the dial that decided it', () => {
    expect(seq('grain_spirit', 'quicksilver', 'emberbloom').summary[0]).toBe(
      'Form: spirit base, volatility 1.8 (1.0 or more) → Flask.',
    );
    expect(seq('emberbloom', 'quicksilver').summary[0]).toBe('Form: no base → Residue.');
  });

  it('names what a form leaves unused instead of dropping it silently', () => {
    // ALCHEMY.md §7: a storm oil loses its mana and its buff; the reading says so.
    expect(seq('pressed_oil', 'quicksilver', 'thunderbloom').summary.join(' ')).toContain(
      'Not used by an Oil: Storm (buffs, Mana restore)',
    );
    expect(seq('spring_water', 'emberbloom').summary.join(' ')).toContain('Ember (heat damage, afflictions)');
    // A form that reads everything its essences carry has nothing to report.
    expect(seq('grain_spirit', 'quicksilver', 'emberbloom').summary.join(' ')).not.toContain('Not used');
  });

  it('quotes the numbers the fold actually used', () => {
    const s = seq('grain_spirit', 'quicksilver', 'emberbloom', 'brimstone');
    // 3.76 × 1.55 = 5.83 raw, into a base that holds 5: 5 + 0.83 × 0.35 = 5.29.
    expect(s.notes[3]).toContain('Potency ×1.55 → 5.83');
    expect(s.summary.join(' ')).toContain('35% of the excess stays → 5.29');
    expect(s.potency).toBeCloseTo(5.29, 2);
  });
});

describe('the outcome table', () => {
  it('is solvent across, volatility down', () => {
    expect(formOf('water', 0)).toBe('elixir');
    expect(formOf('water', 2)).toBe('draught');
    expect(formOf('spirit', 0)).toBe('fume');
    expect(formOf('spirit', 2)).toBe('bomb');
    expect(formOf('oil', 0)).toBe('salve');
    expect(formOf('oil', 2)).toBe('oil');
    expect(formOf('none', 5)).toBe('residue');
  });

  it('reads volatility on every solvent — no cell ignores it', () => {
    // The table's own invariant: each medium answers the dial differently, and
    // none of them answers it the same way twice.
    for (const medium of ['water', 'oil', 'spirit'] as const) {
      expect(formOf(medium, 0)).not.toBe(formOf(medium, 2));
    }
  });

  it('raises nothing without a solvent', () => {
    const s = seq('emberbloom', 'quicksilver', 'brimstone');
    expect(s.form).toBe('residue');
    expect(s.medium).toBe('none');
  });

  it('makes a bomb out of spirit, agitation and a lit substance', () => {
    const s = seq('grain_spirit', 'quicksilver', 'emberbloom', 'brimstone');
    expect(s.form).toBe('bomb');
    expect(s.strikes.length).toBeGreaterThan(0);
    expect(s.strikes.some((k) => k.type === 'heat')).toBe(true);
  });

  it('makes an elixir out of still water, and it grants rather than restores', () => {
    const s = seq('spring_water', 'mendroot', 'gloomcap');
    expect(s.form).toBe('elixir');
    expect(s.grants.some((g) => g.id === 'concealed')).toBe(true);
    expect(s.restore).toHaveLength(0);
  });

  it('makes a draught out of roused water, and it restores rather than grants', () => {
    const s = seq('spring_water', 'quicksilver', 'mendroot');
    expect(s.form).toBe('draught');
    expect(s.restore.some((r) => r.resource === 'hp' && r.amount > 0)).toBe(true);
    expect(s.grants).toHaveLength(0);
  });

  it('makes a salve out of settled oil, and only a salve cures', () => {
    const s = seq('pressed_oil', 'mendroot');
    expect(s.form).toBe('salve');
    expect(s.cures).toContain('poison');
  });

  it('makes a weapon oil out of roused oil — per-blow bite and riders', () => {
    const s = seq('pressed_oil', 'quicksilver', 'emberbloom');
    expect(s.form).toBe('oil');
    expect(s.blows).toBeGreaterThan(1);
    expect(s.strikes.some((k) => k.type === 'heat')).toBe(true);
    expect(s.inflicts.some((i) => i.id === 'on_fire')).toBe(true);
    // A coating's per-blow bite must stay far under a flask's single burst.
    const flask = seq('grain_spirit', 'quicksilver', 'emberbloom');
    expect(s.strikes[0].power).toBeLessThan(flask.strikes[0].power / 2);
    // ...and the salve register must stay out of it entirely.
    expect(s.cures).toHaveLength(0);
    expect(s.restore).toHaveLength(0);
  });

  it('makes a fume when spirit never catches — afflictions, no blow', () => {
    const s = seq('grain_spirit', 'nightcap', 'fixing_salt');
    expect(s.form).toBe('fume');
    expect(s.strikes).toHaveLength(0);
    expect(s.inflicts.some((i) => i.id === 'poison')).toBe(true);
  });
});

describe('solvents', () => {
  it('caps what a brew can hold, and spills the rest', () => {
    // Spirit holds least; four heavy essences into it must run over.
    const s = seq('grain_spirit', 'emberbloom', 'nightcap', 'thunderbloom', 'frostmoss');
    expect(s.summary.some((n) => n.startsWith('Over the limit'))).toBe(true);
  });

  it('a second solvent thins what is already there', () => {
    const neat = seq('grain_spirit', 'quicksilver', 'emberbloom');
    const cut = seq('grain_spirit', 'quicksilver', 'spring_water', 'emberbloom');
    expect(cut.volatility).toBeLessThan(neat.volatility);
    // The medium is decided by the FIRST solvent and never changes hands.
    expect(cut.medium).toBe('spirit');
  });
});

describe('grades', () => {
  it('scale a brew without deciding it', () => {
    const poor = composeBrew([at('spring_water', 'e'), at('mendroot', 'e')]);
    const fine = composeBrew([at('spring_water', 'a'), at('mendroot', 'a')]);
    expect(fine.potency).toBeGreaterThan(poor.potency);
    expect(fine.form).toBe(poor.form);
  });
});

describe('the bench', () => {
  it('refuses a sequence too short to be one', () => {
    const g = fresh();
    shelf(g);
    expect(previewBrew(g.state, lay('spring_water')).ok).toBe(false);
  });

  it('refuses reagents the alchemist has not reached', () => {
    const g = fresh();
    shelf(g, 0);
    const check = previewBrew(g.state, lay('spring_water', 'gloomcap'));
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('Alchemy');
  });

  it('spends the sequence and shelves a flask that remembers it', () => {
    const g = fresh();
    shelf(g);
    const before = stockOf(g.state, 'mendroot', 'c');
    const made = brew(g.state, g.bus, lay('spring_water', 'mendroot'));
    expect(made).not.toBeNull();
    expect(stockOf(g.state, 'mendroot', 'c')).toBe(before - 1);
    expect(g.state.flasks).toHaveLength(1);
    expect(g.state.flasks[0].steps.map((s) => s.id)).toEqual(['spring_water', 'mendroot']);
    // The flask is nothing but its sequence — reading it back gives the same brew.
    expect(resolveBrew(g.state.flasks[0]).name).toBe(made!.spec.name);
  });

  it('a reagent laid twice at one grade needs two in stock', () => {
    const g = fresh();
    g.state.skills.alchemy = { level: 0, xp: 0 };
    grantGraded(g.state, 'spring_water', 'b', 1);
    const twice = lay(at('spring_water', 'b'), at('spring_water', 'b'));
    const check = previewBrew(g.state, twice);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/1 Spring Water of that grade; this layout uses 2/);
    expect(brew(g.state, g.bus, twice)).toBeNull();
    expect(stockOf(g.state, 'spring_water', 'b')).toBe(1);
  });

  it('closes gaps: an empty step in the middle is not a step', () => {
    const g = fresh();
    shelf(g);
    const gappy: Placement = { step1: at('spring_water'), step4: at('mendroot') };
    const check = previewBrew(g.state, gappy);
    expect(check.ok).toBe(true);
    expect(check.sequence!.map((s) => s.id)).toEqual(['spring_water', 'mendroot']);
  });

  it('recognises a written formula, exactly and in order', () => {
    expect(formulaFor(['grain_spirit', 'quicksilver', 'emberbloom', 'brimstone'])?.id).toBe(
      'smoulder_flask',
    );
    // The same four in another order is somebody else's discovery.
    expect(formulaFor(['grain_spirit', 'emberbloom', 'quicksilver', 'brimstone'])).toBeUndefined();
  });

  it('keys novelty on the ORDER, so a permutation is a fresh discovery', () => {
    const a = noveltyKeys(ALCHEMY, lay('spring_water', 'mendroot', 'gloomcap'));
    const b = noveltyKeys(ALCHEMY, lay('spring_water', 'gloomcap', 'mendroot'));
    expect(a[0]).not.toBe(b[0]);
    // ...while an unordered bench still treats them as one craft.
    const stove = DISCIPLINES.cooking;
    const one = noveltyKeys(stove, { main: at('raw_meat'), second: at('wild_onion') });
    const other = noveltyKeys(stove, { main: at('wild_onion'), second: at('raw_meat') });
    expect(one[0]).toBe(other[0]);
  });
});

describe('using what came out', () => {
  it('drinks an elixir and wears what it grants', () => {
    const g = fresh();
    shelf(g);
    brew(g.state, g.bus, lay('spring_water', 'mendroot', 'gloomcap'));
    expect(useFlask(g.state, g.bus, 0)).not.toBeNull();
    expect(hasStatus(g.state, 'concealed')).toBe(true);
    expect(g.state.flasks).toHaveLength(0);
  });

  it('will not throw a flask with nothing to throw it at', () => {
    const g = fresh();
    shelf(g);
    brew(g.state, g.bus, lay('grain_spirit', 'quicksilver', 'emberbloom', 'brimstone'));
    const check = canUseFlask(g.state, 0);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe(text('alchemy.reason.no_target'));
  });

  it('puts every flask on one clock, so a satchel is not an action bar', () => {
    const g = fresh();
    shelf(g);
    brew(g.state, g.bus, lay('spring_water', 'mendroot'));
    brew(g.state, g.bus, lay('spring_water', 'mendroot'));
    useFlask(g.state, g.bus, 0);
    expect(canUseFlask(g.state, 0).ok).toBe(false);
  });

  it('works an oil into the blade, and spends it a blow at a time', () => {
    const g = fresh();
    shelf(g);
    g.state.equipment.weapon = { uid: 99, defId: 'rusty_sword', slots: 0, runes: [] };
    brew(g.state, g.bus, lay('pressed_oil', 'quicksilver', 'emberbloom'));
    const spec = useFlask(g.state, g.bus, 0)!;
    expect(g.state.coating).not.toBeNull();
    expect(g.state.coating!.blowsLeft).toBe(spec.blows);

    const bite = spendCoating(g.state)!;
    expect(bite.typed.some((t) => t.type === 'heat')).toBe(true);
    expect(g.state.coating!.blowsLeft).toBe(spec.blows! - 1);

    // Run it dry: the last blow clears the blade rather than leaving a husk.
    while (g.state.coating) spendCoating(g.state);
    expect(spendCoating(g.state)).toBeNull();
  });

  it('will not coat a hand with nothing in it', () => {
    const g = fresh();
    shelf(g);
    delete g.state.equipment.weapon;
    brew(g.state, g.bus, lay('pressed_oil', 'quicksilver', 'emberbloom'));
    const check = canUseFlask(g.state, 0);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe(text('alchemy.reason.no_weapon'));
  });

  it('leaves the oil on the blade it was worked into, not on the next one', () => {
    const g = fresh();
    shelf(g);
    g.state.equipment.weapon = { uid: 99, defId: 'rusty_sword', slots: 0, runes: [] };
    brew(g.state, g.bus, lay('pressed_oil', 'quicksilver', 'emberbloom'));
    useFlask(g.state, g.bus, 0);
    // Draw a different blade: the coating is still in state but not in hand.
    g.state.equipment.weapon = { uid: 100, defId: 'rusty_sword', slots: 0, runes: [] };
    expect(activeCoating(g.state)).toBeNull();
    expect(spendCoating(g.state)).toBeNull();
    g.state.equipment.weapon = { uid: 99, defId: 'rusty_sword', slots: 0, runes: [] };
    expect(activeCoating(g.state)).not.toBeNull();
  });

  it('a half-spent coating survives a save', () => {
    const g = fresh();
    shelf(g);
    g.state.equipment.weapon = { uid: 99, defId: 'rusty_sword', slots: 0, runes: [] };
    brew(g.state, g.bus, lay('pressed_oil', 'quicksilver', 'emberbloom'));
    useFlask(g.state, g.bus, 0);
    spendCoating(g.state);
    const before = g.state.coating!;
    expect(before.blowsLeft).toBeGreaterThan(0);

    const after = deserialize(serialize(g.state)).coating!;
    expect(after).not.toBeNull();
    expect(after.blowsLeft).toBe(before.blowsLeft);
    // The blade it was worked into has to survive too, or the oil comes back
    // stranded on a weapon uid that no longer means anything.
    expect(after.weaponUid).toBe(99);
    // And it must still RESOLVE: a coating is stored as its sequence, so a
    // brew that no longer reads back is a coating that silently does nothing.
    expect(resolveBrew(after.brew).form).toBe('oil');
  });

  it('refuses residue, and keeps it', () => {
    const g = fresh();
    shelf(g);
    brew(g.state, g.bus, lay('emberbloom', 'quicksilver'));
    expect(useFlask(g.state, g.bus, 0)).toBeNull();
    expect(g.state.flasks).toHaveLength(1);
  });
});

describe('a coated blade in a real fight', () => {
  /** Swing until the coating has actually been spent, or give up. */
  function fightUntilCoatingSpent(g: Game, ticks = 4000) {
    for (let i = 0; i < ticks; i++) {
      g.tick();
      if (!g.state.combat) g.selectActivity('hunt');
      if (!g.state.coating) return true;
    }
    return false;
  }

  it('carries its bite and its riders onto what it hits, and wears off', () => {
    const g = new Game(createInitialState(7));
    g.state.spot = 'woods_edge';
    g.equip(1); // the rusty sword the game starts with
    shelf(g);
    brew(g.state, g.bus, lay('pressed_oil', 'quicksilver', 'emberbloom'));
    useFlask(g.state, g.bus, 0);
    const blows = g.state.coating!.blowsLeft;
    expect(blows).toBeGreaterThan(1);

    g.selectActivity('hunt');
    // Somewhere in here the oil must show up as heat damage and as burning.
    let sawBite = false;
    let sawFire = false;
    for (let i = 0; i < 4000 && g.state.coating; i++) {
      g.tick();
      if (!g.state.combat) {
        g.selectActivity('hunt');
        continue;
      }
      if (g.state.combat.enemies[0]?.statuses?.some((s) => s.id === 'on_fire')) sawFire = true;
      // The oil's damage arrives as its own named SLICE of the swing, the way
      // a weapon enchant's does — not as a line of its own in the feed.
      for (const entry of g.state.combatFeed) {
        const slice = entry.damage?.slices?.find((s) => s.source === 'Ember Oil');
        if (slice && slice.type === 'heat' && slice.dealt > 0) sawBite = true;
      }
    }
    expect(sawFire, 'a coated blow should set what it hits on fire').toBe(true);
    expect(sawBite, 'the oil should land as its own heat slice of the swing').toBe(true);
    // The blade runs dry rather than oiling itself forever.
    expect(g.state.coating).toBeNull();
  });

  it('does nothing at all when the blade is bare', () => {
    const g = new Game(createInitialState(7));
    g.state.spot = 'woods_edge';
    g.equip(1);
    shelf(g);
    brew(g.state, g.bus, lay('pressed_oil', 'quicksilver', 'emberbloom'));
    useFlask(g.state, g.bus, 0);
    // Same fight, but the oiled blade is not the one in hand.
    g.state.equipment.weapon = { uid: 4242, defId: 'rusty_sword', slots: 0, runes: [] };
    const before = g.state.coating!.blowsLeft;
    g.selectActivity('hunt');
    fightUntilCoatingSpent(g, 600);
    expect(g.state.coating!.blowsLeft).toBe(before);
  });
});

describe('determinism', () => {
  it('two alchemists with the same sequence get the same flask', () => {
    const a = seq('grain_spirit', 'nightcap', 'quicksilver', 'green_vitriol');
    const b = seq('grain_spirit', 'nightcap', 'quicksilver', 'green_vitriol');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('alchemy carries its own conditions', () => {
  const GRANTED = { frostmoss: 'frosted', gloomcap: 'concealed', bloodwort: 'invigorated' } as const;

  it('Frostmoss, Gloomcap and Bloodwort each grant one of their own, not a deity’s', () => {
    for (const [reagent, id] of Object.entries(GRANTED)) {
      expect(REAGENTS[reagent].essence!.grants?.map((g) => g.id), reagent).toEqual([id]);
      const def = STATUSES[id];
      expect(def, id).toBeTruthy();
      // Self-granted, so elementless and harmless like every other buff.
      expect(def.element, id).toBeUndefined();
      expect(isHarmful(def), id).toBe(false);
    }
  });

  it('no reagent grants a condition a miracle grants — alchemy borrows no deity’s signature', () => {
    const divine = new Set(
      Object.values(MIRACLES).flatMap((m) => [...(m.spec.grants ?? []), ...(m.spec.afflicts ?? [])].map((a) => a.id)),
    );
    expect(divine.size).toBeGreaterThan(5);
    for (const [id, def] of Object.entries(REAGENTS)) {
      for (const g of def.essence?.grants ?? []) expect(divine.has(g.id), `${id} grants '${g.id}'`).toBe(false);
    }
  });

  it('the divine originals are untouched and still granted by their miracles', () => {
    const granted = Object.values(MIRACLES).flatMap((m) => (m.spec.grants ?? []).map((a) => a.id));
    for (const id of ['ximas_rime', 'veiled', 'blood_communion']) {
      expect(STATUSES[id], id).toBeTruthy();
      expect(granted, id).toContain(id);
    }
  });

  it('is sized for a short flask: each runs the Elixir’s own clock and a modest intensity', () => {
    for (const [reagent, id] of Object.entries(GRANTED)) {
      const spec = seq('spring_water', reagent);
      expect(spec.form, reagent).toBe('elixir');
      const grant = spec.grants.find((g) => g.id === id)!;
      expect(grant, reagent).toBeTruthy();
      expect(grant.duration!, reagent).toBeLessThanOrEqual(BREW_MAX_DURATION);
      expect(grant.intensity!, reagent).toBeGreaterThan(0.3);
      expect(grant.intensity!, reagent).toBeLessThan(2);
      expect(STATUSES[id].duration, id).toBeLessThanOrEqual(BREW_MAX_DURATION);
    }
  });

  it('drinking each Elixir wears its condition', () => {
    for (const [reagent, id] of Object.entries(GRANTED)) {
      const g = fresh();
      shelf(g);
      brew(g.state, g.bus, lay('spring_water', reagent));
      expect(useFlask(g.state, g.bus, 0)).not.toBeNull();
      expect(hasStatus(g.state, id), id).toBe(true);
    }
  });
});

describe('cures that work', () => {
  /** Brew and use a Mendroot Salve (settled oil) on a player carrying `held`. */
  function applySalve(held: StatusApplication[]) {
    const g = fresh();
    shelf(g);
    for (const app of held) applyStatus(g.state, g.state, app, 'test');
    brew(g.state, g.bus, lay('pressed_oil', 'mendroot'));
    expect(g.state.flasks).toHaveLength(1);
    expect(resolveBrew(g.state.flasks[0]).form).toBe('salve');
    expect(useFlask(g.state, g.bus, 0)).not.toBeNull();
    return g;
  }

  it('the tags Mendroot emits are the ones the conditions listen for', () => {
    expect(REAGENTS.mendroot.essence!.cures).toEqual(['poison', 'bleed']);
    const listens = (id: string, tag: string) =>
      (STATUSES[id].removal ?? []).some((r) => r.on === 'cure' && r.tag === tag);
    expect(listens('poison', 'poison')).toBe(true);
    expect(listens('rotting', 'poison')).toBe(true);
    expect(listens('bleeding', 'bleed')).toBe(true);
    // A laceration answers treatment (the salve's heal), not the cure: one rung a flask.
    expect(listens('lacerated', 'bleed')).toBe(false);
  });

  it('a brewed salve removes a held poison', () => {
    const g = applySalve([{ id: 'poison', intensity: 2 }]);
    expect(hasStatus(g.state, 'poison')).toBe(false);
  });

  it('...and a held bleed', () => {
    const g = applySalve([{ id: 'bleeding', intensity: 1 }]);
    expect(hasStatus(g.state, 'bleeding')).toBe(false);
  });

  it('a rot eases to poison: one rung a flask, and the next flask ends it', () => {
    const rot = applySalve([{ id: 'rotting', intensity: 1 }]);
    expect(hasStatus(rot.state, 'rotting')).toBe(false);
    expect(hasStatus(rot.state, 'poison')).toBe(true);

    // The cure alone fires one rung each time it is spoken.
    const again = fresh();
    applyStatus(again.state, again.state, { id: 'rotting', intensity: 1 }, 'test');
    fireStatusEvent(again.state, again.state, 'cure', { tag: 'poison' });
    expect(hasStatus(again.state, 'poison')).toBe(true);
    fireStatusEvent(again.state, again.state, 'cure', { tag: 'poison' });
    expect(hasStatus(again.state, 'poison')).toBe(false);
  });

  it('a laceration eases to a bleed in ONE flask, not two: the next flask closes it', () => {
    // A Mendroot Salve is treatment (heal kind 'salve') and cure at once. The
    // cure goes first and names no laceration; the heal then eases it one rung.
    // Were the heal first, the bleed it leaves would meet the cure and close:
    // two rungs, against what the tooltip and BREWING.md promise.
    const cut = applySalve([{ id: 'lacerated', intensity: 1 }]);
    expect(hasStatus(cut.state, 'lacerated')).toBe(false);
    expect(hasStatus(cut.state, 'bleeding')).toBe(true);

    // A second salve (flasks share one clock) closes what is left.
    cut.state.totalTicks += 1000;
    brew(cut.state, cut.bus, lay('pressed_oil', 'mendroot'));
    expect(useFlask(cut.state, cut.bus, 0)).not.toBeNull();
    expect(hasStatus(cut.state, 'bleeding')).toBe(false);
  });

  it('the cure alone does nothing to a laceration (it answers treatment)', () => {
    const cut = fresh();
    applyStatus(cut.state, cut.state, { id: 'lacerated', intensity: 1 }, 'test');
    fireStatusEvent(cut.state, cut.state, 'cure', { tag: 'bleed' });
    expect(hasStatus(cut.state, 'lacerated')).toBe(true);
  });

  it('leaves what it does not name alone', () => {
    const g = applySalve([{ id: 'on_fire', intensity: 1 }, { id: 'poison', intensity: 1 }]);
    expect(hasStatus(g.state, 'poison')).toBe(false);
    expect(hasStatus(g.state, 'on_fire')).toBe(true);
  });
});

describe('only the Salve treats a wound', () => {
  /** Brew and use this sequence on a player at 1 HP who is bleeding. */
  function bleedingWith(...ids: string[]) {
    const g = fresh();
    shelf(g);
    g.state.resources.hp = 1;
    applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 }, 'test');
    brew(g.state, g.bus, lay(...ids));
    expect(useFlask(g.state, g.bus, 0)).not.toBeNull();
    return g;
  }

  it('a Draught restores health but closes nothing', () => {
    expect(seq('spring_water', 'quicksilver', 'mendroot').form).toBe('draught');
    const g = bleedingWith('spring_water', 'quicksilver', 'mendroot');
    expect(g.state.resources.hp).toBeGreaterThan(1);
    expect(hasStatus(g.state, 'bleeding')).toBe(true);
  });

  it('a Salve restores health and closes the wound', () => {
    const g = bleedingWith('pressed_oil', 'mendroot');
    expect(g.state.resources.hp).toBeGreaterThan(1);
    expect(hasStatus(g.state, 'bleeding')).toBe(false);
  });

  it('a Draught leaves a laceration as it found it', () => {
    const g = fresh();
    shelf(g);
    g.state.resources.hp = 1;
    applyStatus(g.state, g.state, { id: 'lacerated', intensity: 1 }, 'test');
    brew(g.state, g.bus, lay('spring_water', 'quicksilver', 'mendroot'));
    useFlask(g.state, g.bus, 0);
    expect(hasStatus(g.state, 'lacerated')).toBe(true);
    expect(hasStatus(g.state, 'bleeding')).toBe(false);
  });
});
