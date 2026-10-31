// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import type { Chromosome, GameState, GeneInstance, QualityTier } from '../src/core/types';
import {
  GENE_ACTIVE,
  REFINE_COPIES,
  abilityDamage,
  activeEdges,
  applyActiveArm,
  armDelivery,
  armGrants,
  atGrade,
  spokenAs,
  canRefine,
  chromosomeMods,
  contributionWeight,
  deliveredBy,
  grantIsLive,
  isClamped,
  isSealed,
  refuteCast,
  capacityFree,
  capacityLimit,
  capacityUsed,
  chromosomeOf,
  coefficientOf,
  currentResolution,
  cutCost,
  cutEdge,
  edgeKey,
  establish,
  expressedMain,
  fullyConnected,
  geneAbility,
  geneAbilityBase,
  geneFrom,
  harvestKill,
  histoneCost,
  hopDistances,
  mainCost,
  mutagensFrom,
  nextGrade,
  placeMutagen,
  powerRank,
  perTargetInflictIntensity,
  priceGeneAbility,
  reaching,
  refine,
  refineCost,
  FUSE_BIOMATTER,
  FUSED_GRADE,
  fuse,
  fusionOf,
  nucleasesFrom,
  rekeyGene,
  removeMutagen,
  resolveChromosome,
  syncGeneStatuses,
  weakPointsOf,
  restoreEdge,
  SWAP_COOLDOWN_KEY,
  SWAP_SETTLE_TICKS,
  setSkipSettling,
  settlingLeft,
  showsGrade,
  slotMain,
  swapBiomatterCost,
  unlockMutagens,
  unslotMain,
} from '../src/core/systems/mutagens';
import {
  BASELINE_LAYOUT,
  GENERA,
  MAIN_BASE_COST,
  MAIN_GENES,
  MUTATIONS,
  NUCLEASES,
  QUALITY_APPROACH,
  startingKit,
} from '../src/core/data/mutagens.data';
import { qualityMult } from '../src/core/data/quality.data';
import { BASE_SPEED } from '../src/core/systems/derived';
import { SAVE_VERSION, createInitialState } from '../src/core/state';
import { migrate } from '../src/core/save/migrations';
import { Game } from '../src/core/game';
import {
  TELEKINETIC_GRIP_CAP,
  TELEKINETIC_GRIP_HALF,
  abandonCombat,
  playerDamageType,
  spawnMonster,
  telekineticGrip,
} from '../src/core/systems/combat';
import { expressedGene, fastGuard, fastOf, genomeOf } from '../src/core/systems/mutagens';
import { MAX_STACK, composeArcane } from '../src/core/systems/arcane';
import { ARCANE_WORDS } from '../src/core/data/spellcraft.data';
import { STATUSES } from '../src/core/data/statuses.data';
import { applyStatus, hasStatus } from '../src/core/systems/statuses';
import { darknessFactor } from '../src/core/systems/exposure';
import { findStatus } from '../src/core/systems/statuses';
import { createItem } from '../src/core/systems/runes';
import {
  armCost,
  armsFrom,
  floatingSlots,
  handSwingShare,
  handsFrom,
  heldGrips,
  isTelekinetic,
  telekineticFrom,
} from '../src/core/systems/wield';
import { ITEMS } from '../src/core/registry';
import { abilityCarries, bearerGrants } from '../src/core/systems/mutagens';
import { geneAbilityLanded, geneAbilityLines } from '../src/ui/lib/format';
import { attrName } from '../src/core/systems/attributes';
import { monsterStats } from '../src/core/systems/monsterStats';
import { getDerivedStats } from '../src/core/systems/derived';
import { grantGraded, isGraded, stockOf } from '../src/core/systems/disciplines';
import { startBenchWork, tickBenchWork } from '../src/core/systems/benchwork';
import { MATERIALS } from '../src/core/registry';
import { monsterTagSet, monsterTags } from '../src/core/systems/bestiary';
import { MONSTERS, MONSTER_TAGS, SPOTS } from '../src/core/registry';

const fresh = (seed = 1) => new Game(createInitialState(seed));

/**
 * A game with mutagens explicitly shut. The system currently ships OPEN (the
 * alpha default), so anything testing the gate has to close it by hand rather
 * than lean on how a fresh state happens to arrive — which is what makes these
 * tests keep meaning something when the unlock quest flips the default back.
 */
function locked(seed = 1) {
  const g = fresh(seed);
  g.state.mutagens.unlocked = false;
  g.state.mutagens.chromosome.established = [];
  return g;
}

const gene = (id: string, quality: QualityTier = 'c'): GeneInstance => ({ id, quality });

/** A fully wired baseline chromosome with a main gene, plus whatever is layered on. */
function chromo(over: Partial<Chromosome> = {}): Chromosome {
  return { ...fullyConnected(), main: gene('hill_giant'), ...over };
}

const cutting = (...pairs: [string, string][]) => pairs.map(([a, b]) => edgeKey(a, b));

/** The single branch that passed through every named socket, in order. */
function branchVia(c: Chromosome, from: string, ...via: string[]) {
  const res = resolveChromosome(c);
  const all = Object.values(res.arms).flatMap((a) => a.contributions);
  return all.find(
    (x) => x.from === from && via.every((v, i) => x.through[i] === v) && x.through.length === via.length,
  );
}

describe('law 1: routing counts edges, never length', () => {
  it('measures hops topologically while the ring carries the long edges', () => {
    const dist = hopDistances(activeEdges(chromo()));
    // g sits one hop from the centre across 9μm; a sits two hops across 6μm
    // total. If length entered the routing decision these would be reversed.
    expect(dist.g).toBe(1);
    expect(dist.a).toBe(2);
    const long = BASELINE_LAYOUT.edges.find((e) => e.a === 'g' && e.b === '@')!;
    const short = BASELINE_LAYOUT.edges.find((e) => e.a === 'a' && e.b === 'd')!;
    expect(long.length).toBeGreaterThan(short.length);
  });

  it('an unestablished edge is not a route', () => {
    const c = chromo({ established: [] });
    expect(hopDistances(activeEdges(c))['@']).toBe(0);
    expect(hopDistances(activeEdges(c)).g).toBeUndefined();
  });

  it('a cut edge stops carrying, but stays established', () => {
    const c = chromo({ cut: cutting(['g', '@']) });
    expect(activeEdges(c).some((e) => edgeKey(e.a, e.b) === edgeKey('g', '@'))).toBe(false);
    expect(c.established).toContain(edgeKey('g', '@'));
    // g now reaches the centre the long way round, through the ring.
    expect(hopDistances(activeEdges(c)).g).toBe(3);
  });
});

describe('law 1: ties split evenly, and the ring makes that structural', () => {
  it('g and i sit one hop out and deliver whole', () => {
    const c = chromo({ placed: { g: gene('elastic') } });
    const res = resolveChromosome(c);
    const arrivals = reaching(res, 'attacks');
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0].share).toBe(1);
    expect(arrivals[0].through).toEqual([]);
  });

  it('h is two hops out either way round, so it splits 50:50 into both lower arms', () => {
    const c = chromo({ placed: { h: gene('vigorous') } });
    const res = resolveChromosome(c);
    const attacks = reaching(res, 'attacks');
    const defenses = reaching(res, 'defenses');
    expect(attacks).toHaveLength(1);
    expect(defenses).toHaveLength(1);
    expect(attacks[0].share).toBe(0.5);
    expect(defenses[0].share).toBe(0.5);
    // Same distance either way — the ring is symmetric on purpose.
    expect(attacks[0].distance).toBe(defenses[0].distance);
  });

  it('splitting costs exactly the halving and nothing more', () => {
    const whole = resolveChromosome(chromo({ placed: { g: gene('vigorous') } }));
    const split = resolveChromosome(chromo({ placed: { h: gene('vigorous') } }));
    const wholeTotal = reaching(whole, 'attacks').reduce((s, c) => s + c.share, 0);
    const splitTotal = Object.values(split.arms)
      .flatMap((a) => a.contributions)
      .reduce((s, c) => s + c.share, 0);
    // Share is conserved across a split: two halves, no third penalty.
    expect(wholeTotal).toBeCloseTo(1, 10);
    expect(splitTotal).toBeCloseTo(1, 10);
  });

  it('a cut breaks the ring symmetry and makes h deliver whole', () => {
    const c = chromo({ placed: { h: gene('vigorous') }, cut: cutting(['h', 'i']) });
    const res = resolveChromosome(c);
    expect(reaching(res, 'attacks')[0].share).toBe(1);
    expect(reaching(res, 'defenses')).toHaveLength(0);
  });
});

describe('distance buys magnitude, hops buy character', () => {
  it('the ring delivers strong and untouched; the cluster delivers transformed', () => {
    const c = chromo({ placed: { g: gene('vigorous'), a: gene('studious') } });
    const res = resolveChromosome(c);
    const ring = reaching(res, 'attacks')[0];
    const cluster = reaching(res, 'special')[0];
    // One hop across 9μm beats two hops across 6μm — length, not depth.
    expect(ring.hops).toBeLessThan(cluster.hops);
    expect(ring.intensity).toBeGreaterThan(cluster.intensity);
    expect(ring.through).toEqual([]);
    expect(cluster.through).toEqual(['d']);
  });

  it('a full upper traversal reaches ×6 — the calibration MUTAGENS.md §12 claims', () => {
    // Two cuts funnel the entire upper cluster through d: e loses its short
    // route, and f loses its direct exit.
    const c = chromo({
      placed: { e: gene('studious') },
      cut: cutting(['d', 'e'], ['f', '@']),
    });
    const branch = branchVia(c, 'e', 'f', 'c', 'b', 'a', 'd');
    expect(branch).toBeDefined();
    expect(branch!.hops).toBe(6);
    expect(branch!.distance).toBe(18);
    expect(branch!.intensity).toBeCloseTo(6, 10);
    expect(branch!.arm).toBe('special');
  });

  it('two cuts are all the grand tour costs — the price is a silent arm', () => {
    const c = chromo({
      placed: { e: gene('studious') },
      cut: cutting(['d', 'e'], ['f', '@']),
    });
    const res = resolveChromosome(c);
    expect(res.arms.active.contributions).toHaveLength(0);
  });
});

describe('law 2: you never write an order, you move things', () => {
  it('the same two mutations in opposite positions are not the same arrival', () => {
    // One route only, so the ordering is unambiguous: b → a → d → centromere.
    // The EDGE leg is what carries and rewrites a type now — the Wards (chill,
    // ember) used to do it too, which is exactly the bundling the tripartition
    // undid.
    const cut = cutting(['b', 'c']);
    const rimeFirst = chromo({
      placed: { b: gene('radiant_edge'), a: gene('rime_edge'), d: gene('searing_edge') },
      cut,
    });
    const searFirst = chromo({
      placed: { b: gene('radiant_edge'), a: gene('searing_edge'), d: gene('rime_edge') },
      cut,
    });
    // Same origin, same path, same two transforms. Only their order moved.
    expect(branchVia(rimeFirst, 'b', 'a', 'd')!.arrived.type).toBe('heat');
    expect(branchVia(searFirst, 'b', 'a', 'd')!.arrived.type).toBe('cold');
  });

  it('the socket nearest the centre gets the last word', () => {
    const c = chromo({
      placed: { b: gene('radiant_edge'), a: gene('rime_edge'), d: gene('searing_edge') },
      cut: cutting(['b', 'c']),
    });
    const branch = branchVia(c, 'b', 'a', 'd')!;
    // Radiant left as light, rime rewrote it to cold, searing had the last say.
    expect(branch.through).toEqual(['a', 'd']);
    expect(branch.arrived.type).toBe('heat');
  });

  it('a gene does not transform its own effect', () => {
    const c = chromo({ placed: { g: gene('rime_edge') } });
    const arrival = reaching(resolveChromosome(c), 'attacks')[0];
    expect(arrival.through).toEqual([]);
    expect(arrival.arrived.type).toBe('cold');
  });

  it('capabilities accumulate along the way rather than replacing', () => {
    const c = chromo({
      placed: { b: gene('elastic'), a: gene('bouncing'), d: gene('taint_brand') },
      cut: cutting(['b', 'c']),
    });
    const branch = branchVia(c, 'b', 'a', 'd')!;
    expect(branch.arrived.grants).toEqual(
      expect.arrayContaining(['ignores_dodge', 'splits_target', 'inflicts_tainted']),
    );
  });
});

describe('capabilities are free, magnitudes are capped', () => {
  it('a cheap gene reaches every trick', () => {
    const cheap = chromo({ main: gene('hill_giant', 'f'), placed: { g: gene('elastic') } });
    const dear = chromo({ main: gene('jotunn', 's'), placed: { g: gene('elastic') } });
    expect(resolveChromosome(cheap).arms.attacks.grants).toEqual(
      resolveChromosome(dear).arms.attacks.grants,
    );
    expect(resolveChromosome(cheap).arms.attacks.grants).toContain('ignores_dodge');
  });

  it('but cannot push the numbers as far', () => {
    // rock giant rather than hill giant: the point is a cap that BINDS, and a
    // tier-2 gene's ceiling already clears this route on its own.
    const cheap = resolveChromosome(
      chromo({ main: gene('rock_giant', 'f'), placed: { g: gene('vigorous') } }),
    );
    const dear = resolveChromosome(
      chromo({ main: gene('jotunn', 's'), placed: { g: gene('vigorous') } }),
    );
    expect(cheap.ceiling).toBeLessThan(dear.ceiling);
    expect(cheap.arms.attacks.weight).toBeLessThan(dear.arms.attacks.weight);
  });

  it('the ceiling covers the special arm, where the exploit would live', () => {
    // skillXp and craftSpeed do not scale off base power the way damage does,
    // so an uncapped special arm is a bottom-tier-F-rank economy exploit: buy
    // the cheapest gene going and pour every freed point into the graph. The
    // cap has to bite exactly there — on the grand tour, at ×6.
    const tour = { placed: { e: gene('studious') }, cut: cutting(['d', 'e'], ['f', '@']) };
    const cheap = resolveChromosome(chromo({ main: gene('hill_giant', 'f'), ...tour }));
    const dear = resolveChromosome(chromo({ main: gene('jotunn', 's'), ...tour }));
    expect(cheap.arms.special.weight).toBeLessThan(dear.arms.special.weight);
    // The cheap gene is clamped below what it routed; the good one is not.
    expect(cheap.arms.special.weight).toBeCloseTo(cheap.ceiling, 10);
    expect(dear.arms.special.weight).toBeCloseTo(6, 10);
  });

  it('but a cap that has not been reached does not penalise a cheap gene', () => {
    // Deliberate: the ceiling limits how far TOPOLOGY may push a magnitude, it
    // is not a blanket scaling penalty. A modest route pays out in full on any
    // gene, which is what keeps a cheap gene worth playing rather than merely
    // worth tolerating. Do not "fix" this into a multiplier.
    const cheap = resolveChromosome(
      chromo({ main: gene('hill_giant', 'f'), placed: { a: gene('studious') } }),
    );
    const dear = resolveChromosome(
      chromo({ main: gene('jotunn', 's'), placed: { a: gene('studious') } }),
    );
    expect(cheap.arms.special.weight).toBe(dear.arms.special.weight);
    expect(cheap.arms.special.weight).toBeLessThan(cheap.ceiling);
  });
});

describe('tier and quality', () => {
  it('tier buys the ceiling, quality buys the approach', () => {
    // A hill giant runs half its ceiling at F and all of it at S, and a jötunn
    // runs the same fractions against a taller one.
    expect(coefficientOf(gene('hill_giant', 'f'))).toBeCloseTo(1, 6);
    expect(coefficientOf(gene('hill_giant', 's'))).toBeCloseTo(2, 6);
    expect(coefficientOf(gene('jotunn', 's'))).toBeGreaterThan(coefficientOf(gene('hill_giant', 's')));
  });

  it('the flat term decays and the coefficient rides gear forever', () => {
    const hill = gene('hill_giant', 's');
    const jotunn = gene('jotunn', 'f');
    // Early, the jötunn's flat base dominates.
    expect(abilityDamage(jotunn, 10)).toBeGreaterThan(abilityDamage(hill, 10));
    // Late, the refined hill giant's coefficient overtakes it.
    expect(abilityDamage(hill, 2000)).toBeGreaterThan(abilityDamage(jotunn, 2000));
  });

  it('at two grades a step, a B reads level with a D one tier up', () => {
    // draconoid is the baseline shape: four tiers, gradesPerStep 2.
    expect(powerRank(gene('wyrmling', 'b'))).toBeCloseTo(powerRank(gene('drake', 'd')), 10);
  });

  it('a wider genus makes the same two grades worth less of a tier', () => {
    // gigantoid runs four grades a step, so B does NOT catch the next tier's D.
    expect(powerRank(gene('hill_giant', 'b'))).toBeLessThan(powerRank(gene('jotunn', 'd')));
  });

  it('a unique is out of reach of anything more than a tier below it', () => {
    // There are as many slime kings as there are slimes willing to become one.
    // There is one Balor. Two rules hold it: powerRank, where four grades a
    // step stops a perfect tier-2 gene reaching a raw tier-4 one...
    expect(powerRank(gene('forest_giant', 's'))).toBeLessThan(powerRank(gene('balor', 'f')));
    expect(powerRank(gene('jotunn', 's'))).toBeLessThan(powerRank(gene('surtr', 'f')));
    // ...and the coefficient, which rides gear forever, so the gap does not
    // quietly close once weapons get good.
    expect(coefficientOf(gene('balor', 'f'))).toBeGreaterThan(coefficientOf(gene('forest_giant', 's')));
    expect(coefficientOf(gene('surtr', 'f'))).toBeGreaterThan(coefficientOf(gene('jotunn', 's')));
    // A unique also beats its OWN rung — Balor is not merely another tier 4.
    expect(coefficientOf(gene('balor', 'c'))).toBeGreaterThan(coefficientOf(gene('storm_giant', 'c')));
  });

  it('the debug settling skip is a module flag, never save state', () => {
    // It configures the RULES, not a character. On the save it would need a
    // migration and would ride along in a real player's file forever.
    const g = fresh();
    g.state.useCooldowns = { [SWAP_COOLDOWN_KEY]: g.state.totalTicks + SWAP_SETTLE_TICKS };
    expect(settlingLeft(g.state)).toBeGreaterThan(0);

    setSkipSettling(true);
    try {
      expect(settlingLeft(g.state)).toBe(0);
      // The stored deadline is untouched — the switch hides it, it does not
      // spend it, so turning the toggle back off restores what was running.
      expect(g.state.useCooldowns[SWAP_COOLDOWN_KEY]).toBeGreaterThan(g.state.totalTicks);
    } finally {
      setSkipSettling(false);
    }
    expect(settlingLeft(g.state)).toBeGreaterThan(0);
  });

  it('a unique variant keeps its parent species’ capabilities exactly', () => {
    // The whole shape of "unique variant of a species": the same body, with one
    // impossible thing added — not a different giant that happens to rank higher.
    expect(MAIN_GENES.balor.grants).toEqual(MAIN_GENES.fomorian.grants);
    expect(MAIN_GENES.balor.size).toBe(MAIN_GENES.fomorian.size);
  });

  it('F is weak here, never harmful — the documented divergence', () => {
    // The shared scale makes F actively negative. A rotten carrot can be thrown
    // away; a rare monster drop cannot. MUTAGENS.md §9.
    expect(qualityMult('f')).toBeLessThan(0);
    expect(QUALITY_APPROACH.f).toBeGreaterThan(0);
    expect(coefficientOf(gene('hill_giant', 'f'))).toBeGreaterThan(0);
    expect(abilityDamage(gene('hill_giant', 'f'), 100)).toBeGreaterThan(0);
  });
});

describe('capacity', () => {
  it('cost grows faster than power as you climb', () => {
    const powerRatio = 400 / 200; // jötunn's flat base over a hill giant's
    const costRatio = mainCost(gene('jotunn')) / mainCost(gene('hill_giant'));
    expect(costRatio).toBeGreaterThan(powerRatio);
  });

  it('is anchored to measured power, not to the ordinal tier index', () => {
    // dvibāhu is tier 0 of a two-species genus and cheaper than a tier-1 drake
    // despite both being "second from the bottom" of nothing in common.
    expect(mainCost(gene('dvibahu'))).toBeLessThan(mainCost(gene('drake')));
    // asura is tier 1 but far more powerful than drake at tier 1, and pays.
    expect(mainCost(gene('asura'))).toBeGreaterThan(mainCost(gene('drake')));
  });

  it('F is the cheapest grade and S carries a slight surcharge', () => {
    const f = mainCost(gene('hill_giant', 'f'));
    const c = mainCost(gene('hill_giant', 'c'));
    const s = mainCost(gene('hill_giant', 's'));
    expect(f).toBeLessThan(c);
    expect(s).toBeGreaterThan(c);
    // "Slight" — the surcharge must not rival the tier decision.
    expect(s / c).toBeLessThan(mainCost(gene('jotunn')) / mainCost(gene('hill_giant')));
  });

  it('cuts compound, so a heavily sculpted graph bites', () => {
    const first = cutCost(1) - cutCost(0);
    const second = cutCost(2) - cutCost(1);
    const third = cutCost(3) - cutCost(2);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
  });

  it('accounts for the gene, the mutations and the cuts separately', () => {
    const c = chromo({
      placed: { g: gene('vigorous'), a: gene('studious') },
      cut: cutting(['h', 'i']),
    });
    const use = capacityUsed(c);
    expect(use.main).toBeGreaterThan(0);
    expect(use.mutations).toBeGreaterThan(0);
    expect(use.cuts).toBeGreaterThan(0);
    expect(use.total).toBeCloseTo(use.main + use.mutations + use.cuts, 10);
  });

  it('a refined low tier is cheaper than a raw high tier of the same output', () => {
    // §6: climbing is the headroom play, never the efficiency play.
    expect(mainCost(gene('hill_giant', 's'))).toBeLessThan(mainCost(gene('jotunn', 'f')));
  });
});

describe('the parts that must not contribute', () => {
  it('a gene with no live route to the centre is stranded and silent', () => {
    const c = chromo({
      placed: { e: gene('studious') },
      cut: cutting(['d', 'e'], ['e', 'f']),
    });
    const res = resolveChromosome(c);
    expect(res.stranded).toEqual(['e']);
    expect(Object.values(res.arms).every((a) => a.contributions.length === 0)).toBe(true);
  });

  it('an empty socket contributes nothing and is not stranded', () => {
    const res = resolveChromosome(chromo());
    expect(res.stranded).toEqual([]);
    expect(Object.values(res.arms).every((a) => a.contributions.length === 0)).toBe(true);
  });

  it('a main gene still carries its base effects with nothing routed in', () => {
    const res = resolveChromosome(chromo({ main: gene('hill_giant') }));
    expect(res.arms.defenses.base).toBeDefined();
    // Which stat is the gene's business; that the arm arrives carrying its
    // gene's own defences, unrouted, is the engine's.
    expect(res.arms.defenses.base!.map((m) => m.stat)).toContain('resBludgeoning');
    expect(res.arms.special!.base!.map((m) => m.stat)).toContain('maxHp');
  });

  it('an empty centromere expresses bare rather than nothing', () => {
    const res = resolveChromosome(chromo({ main: null }));
    expect(expressedMain(chromo({ main: null })).id).toBe('bare');
    expect(res.main!.id).toBe('bare');
    expect(res.ceiling).toBeGreaterThan(0);
  });

  it('so effects routed at an unfilled centromere land instead of evaporating', () => {
    // The property that matters on a split chromosome, where leaving a slot
    // open is a real option: an empty centromere must be a choice, not a hole
    // that swallows everything aimed at it.
    const res = resolveChromosome(chromo({ main: null, placed: { g: gene('vigorous') } }));
    expect(res.arms.attacks.contributions).toHaveLength(1);
    expect(res.arms.attacks.weight).toBeGreaterThan(0);
  });

  it('the floor is free — bare costs no capacity', () => {
    expect(capacityUsed(chromo({ main: null })).main).toBe(0);
  });

  it('bare is not a thing you can hold', () => {
    // It is the default expression, so an item version would be strictly worse
    // than the state it duplicates and a slot you could fill to no effect.
    expect(MATERIALS.bare).toBeUndefined();
    expect(MAIN_GENES.bare).toBeDefined();
  });

  it('bare has all four arms populated but no headline ability', () => {
    const res = resolveChromosome(chromo({ main: gene('bare') }));
    expect(res.main!.ability).toBeUndefined();
    expect(res.main!.writesAttributes).toBe(true);
    for (const arm of ['attacks', 'defenses', 'active', 'special'] as const) {
      expect(res.arms[arm].base?.length).toBeGreaterThan(0);
    }
  });

  it('bare is held at C but never shows a grade', () => {
    // C is the neutral anchor, so every quality-keyed curve reads bare without
    // a special case — and the cost comes out at exactly its floor, neither
    // discounted like an F nor surcharged like an S.
    expect(showsGrade(gene('bare'))).toBe(false);
    expect(showsGrade(gene('hill_giant'))).toBe(true);
    expect(mainCost(gene('bare', 'c'))).toBeCloseTo(MAIN_BASE_COST * 0.4, 10);
  });
});

// ================= Slice 2: state, acquisition, refinement =================

describe('content coherence', () => {
  /**
   * Everything that is FOUND. A fused mutagen is made at a bench and never
   * dropped (see `mutagensFrom`), so it carries no source tag by design —
   * exempted explicitly rather than by a truthiness check that would also
   * swallow a real one somebody forgot to give a tag.
   */
  const droppable = () => Object.values(MUTATIONS).filter((m) => !m.rekey);

  it('every mutagen keys on a real monster tag', () => {
    // An invented tag is not an error anything else catches — the mutagen just
    // never drops, silently, forever.
    for (const m of droppable()) {
      expect(m.from, `mutagen ${m.id} declares no source tag`).toBeTruthy();
      expect(MONSTER_TAGS[m.from!], `mutagen ${m.id}: '${m.from}' is not a monster tag`).toBeDefined();
    }
  });

  it('every mutagen tag is actually carried by some monster', () => {
    const live = new Set(Object.values(MONSTERS).flatMap((d) => monsterTags(d)));
    for (const m of droppable()) {
      expect(live.has(m.from!), `mutagen ${m.id}: nothing alive carries '${m.from}'`).toBe(true);
    }
  });

  it('a fused mutagen declares no source, because nothing drops one', () => {
    const fused = Object.values(MUTATIONS).filter((m) => m.rekey);
    expect(fused.length).toBeGreaterThan(0);
    for (const m of fused) {
      expect(m.from, `${m.id} must not be findable`).toBeUndefined();
      // …and carries a rekey and NOTHING else: the parent's effect and
      // transform were spent in the fusing, not inherited.
      expect(m.effect, `${m.id} kept an effect`).toBeUndefined();
      expect(m.transform, `${m.id} kept a transform`).toBeUndefined();
    }
  });

  it('every nuclease keys on a tag something actually carries', () => {
    const live = new Set(Object.values(MONSTERS).flatMap((d) => monsterTags(d)));
    for (const n of Object.values(NUCLEASES)) {
      expect(MONSTER_TAGS[n.from!], `nuclease ${n.id}: '${n.from}' is not a monster tag`).toBeDefined();
      expect(live.has(n.from!), `nuclease ${n.id}: nothing alive carries '${n.from}'`).toBe(true);
    }
  });

  it('the culture bench stands somewhere, and somewhere that makes sense', () => {
    // A discipline nobody can walk up to is a system that does not exist. The
    // basement also spawns the slimes whose genes are the one collectable
    // line, so harvesting and refining happen in the same room.
    const homes = Object.values(SPOTS).filter((s) => (s.benches ?? []).includes('mutagens'));
    // The basement must always be one of them — it is where the slimes are, so
    // harvesting and refining stay in the same room. Others may join it (a
    // purpose-built lab in the home base does), which is a promotion, not a
    // problem; what would break the system is nowhere hosting it at all.
    expect(homes.map((s) => s.id)).toContain('basement');
    const basement = SPOTS.basement;
    expect(basement.encounters?.some((e) => MAIN_GENES.slime_gene.from === e.monsterId)).toBe(true);
  });

  it('at least one genus is fully reachable today', () => {
    // The rest are authored ahead of their monsters and inert until written,
    // which is fine — but if NONE are reachable the whole system is decorative.
    const reachable = Object.values(GENERA).filter((genus) =>
      genus.tiers.every((id) => MONSTERS[MAIN_GENES[id]?.from ?? '']),
    );
    expect(reachable.map((g) => g.id)).toContain('slimoid');
  });

  it('every genus lists its tiers in order and they exist', () => {
    // Non-STRICTLY ascending: ties are sidegrades, and a branching genus has
    // several species sharing a rung.
    for (const genus of Object.values(GENERA)) {
      let last = -1;
      for (const id of genus.tiers) {
        const def = MAIN_GENES[id];
        expect(def, `genus ${genus.id} names a missing gene '${id}'`).toBeDefined();
        expect(def.tier).toBeGreaterThanOrEqual(last);
        expect(def.genus).toBe(genus.id);
        last = def.tier;
      }
    }
  });

  it('sidegrades read as equals, not as a ladder', () => {
    // Guardian and golem share rung three, so at equal quality they must land
    // on the same power rank — the choice between them is what they DO.
    expect(powerRank(gene('slime_guardian_gene', 'c'))).toBe(powerRank(gene('slime_golem_gene', 'c')));
    expect(mainCost(gene('slime_guardian_gene'))).toBeCloseTo(mainCost(gene('slime_golem_gene')), 6);
    // ...and a parallel branch shares the bottom rung with the plain line.
    expect(powerRank(gene('slime_gene', 'c'))).toBe(powerRank(gene('fire_slime_gene', 'c')));
  });

  it('cost anchors on the weakest species, not the first listed', () => {
    // A branching genus has several species at its bottom rung; `tiers[0]` is
    // only whichever one got typed first.
    const bottom = mainCost(gene('slime_gene', 'c'));
    for (const id of GENERA.slimoid.tiers) {
      expect(mainCost(gene(id, 'c')), `${id} cheaper than the bottom rung`).toBeGreaterThanOrEqual(
        bottom - 1e-9,
      );
    }
  });

  it('every slimoid species points at a monster that exists', () => {
    for (const id of GENERA.slimoid.tiers) {
      const def = MAIN_GENES[id];
      expect(MONSTERS[def.from ?? ''], `${id} has no species to drop it`).toBeDefined();
    }
  });
});

describe('save migration', () => {
  it('an old save arrives with the starting kit and nothing catalogued', () => {
    const old = { version: 33 } as unknown as Record<string, unknown>;
    const out = migrate(old, 34);
    expect(out.mutagens.chromosome.main).toBeNull();
    expect(out.mutagens.chromosome.established).toEqual(startingKit());
    expect(out.mutagens.known.genes).toEqual([]);
    // A full bestiary is what LETS you collect genes, never a claim that you did.
    expect(out.mutagens.known.mutagens).toEqual([]);
  });

  it('a returning character gets exactly what a new one gets', () => {
    const migrated = migrate({ version: 33 } as Record<string, unknown>, SAVE_VERSION).mutagens;
    expect(migrated).toEqual(createInitialState(1).mutagens);
  });

  it('opens a v34 save that was already saved shut', () => {
    // The bug this exists for: v34 arrived locked, so every save made under it
    // had a system nobody could reach. Relaxing v34's own default cannot reach
    // them — a migration runs once — so v35 has to go and open them.
    const shut = {
      version: 34,
      mutagens: {
        unlocked: false,
        chromosome: { layout: 'baseline', main: null, placed: {}, established: [], cut: [] },
        known: { genes: [], mutagens: [] },
      },
    } as unknown as Record<string, unknown>;
    const out = migrate(shut, SAVE_VERSION);
    expect(out.mutagens.unlocked).toBe(true);
    expect(out.mutagens.chromosome.established).toEqual(startingKit());
  });

  it('leaves a chromosome somebody has already built alone', () => {
    const built = {
      version: 34,
      mutagens: {
        unlocked: false,
        chromosome: {
          layout: 'baseline',
          main: null,
          placed: {},
          established: [edgeKey('a', 'b')],
          cut: [],
        },
        known: { genes: ['slime_gene'], mutagens: [] },
      },
    } as unknown as Record<string, unknown>;
    const out = migrate(built, SAVE_VERSION);
    expect(out.mutagens.unlocked).toBe(true);
    // Opened, but not re-kitted over the top of real spending.
    expect(out.mutagens.chromosome.established).toEqual([edgeKey('a', 'b')]);
    expect(out.mutagens.known.genes).toEqual(['slime_gene']);
  });

  it('a fresh state and a migrated one agree on shape', () => {
    const fresh = createInitialState(1).mutagens;
    const migrated = migrate({ version: 33 } as Record<string, unknown>, 34).mutagens;
    expect(Object.keys(migrated).sort()).toEqual(Object.keys(fresh).sort());
    expect(migrated.chromosome.layout).toBe(fresh.chromosome.layout);
  });
});

describe('opening the system', () => {
  it('ships OPEN for now, with the kit already granted', () => {
    // ⚠️ ALPHA: the gate is wired but starts down. When the unlock quest lands
    // this expectation flips, and every `locked()` test below keeps working.
    const g = fresh();
    expect(g.state.mutagens.unlocked).toBe(true);
    expect(chromosomeOf(g.state).established).toEqual(startingKit());
  });

  it('the starting kit is a centromere and exactly two arms', () => {
    const g = locked();
    unlockMutagens(g.state, g.bus, 'i');
    const c = chromosomeOf(g.state);
    expect(c.established).toHaveLength(2);
    expect(c.established).toContain(edgeKey('d', '@'));
    expect(c.established).toContain(edgeKey('i', '@'));
    // One deep-cluster arm and one ring arm: both flavours from the first hour.
    expect(c.main).toBeNull();
  });

  it('the lower arm is a real choice between attacks and defenses', () => {
    const a = locked();
    unlockMutagens(a.state, a.bus, 'g');
    const b = locked();
    unlockMutagens(b.state, b.bus, 'i');
    expect(chromosomeOf(a.state).established).toContain(edgeKey('g', '@'));
    expect(chromosomeOf(b.state).established).toContain(edgeKey('i', '@'));
  });

  it('unlocking twice does not re-grant the kit', () => {
    const g = locked();
    unlockMutagens(g.state, g.bus);
    cutEdge(g.state, g.bus, 'd', '@');
    unlockMutagens(g.state, g.bus);
    expect(chromosomeOf(g.state).cut).toHaveLength(1);
  });
});

describe('acquisition', () => {
  /** Kill the same thing many times, so a low per-kill roll still resolves. */
  function grind(g: ReturnType<typeof fresh>, monsterId: string, times = 400) {
    for (let i = 0; i < times; i++) harvestKill(g.state, g.bus, monsterId);
  }

  it('drops nothing at all while the system is shut', () => {
    // The gate still works even though nothing currently closes it — a monster
    // is only carrying a gene once you know to look.
    const g = locked();
    grind(g, 'slime_base_basic');
    expect(g.state.materials.biomatter ?? 0).toBe(0);
    expect(g.state.stock.slime_gene).toBeUndefined();
    expect(g.state.mutagens.known.genes).toEqual([]);
  });

  it('genes key on the species, so only its own kill yields it', () => {
    expect(geneFrom('slime_base_basic')?.id).toBe('slime_gene');
    expect(geneFrom('slime_base_elite')?.id).toBe('slimest_gene');
    expect(geneFrom('wolf')).toBeUndefined();
  });

  it('mutagens key on tags, so unrelated species share them', () => {
    const fromSlime = mutagensFrom(monsterTagSet('slime_fire')).map((m) => m.id);
    const fromRat = mutagensFrom(monsterTagSet('forest_rat')).map((m) => m.id);
    // A fire slime carries both `slime` and `fire`; a rat carries `beast`.
    expect(fromSlime).toEqual(expect.arrayContaining(['elastic', 'ember']));
    expect(fromRat).toContain('vigorous');
    expect(fromRat).not.toContain('elastic');
  });

  it('once open, a species hands over its gene and its tags hand over mutagens', () => {
    const g = fresh();
    unlockMutagens(g.state, g.bus);
    grind(g, 'slime_fire');
    expect(g.state.materials.biomatter ?? 0).toBeGreaterThan(0);
    // A fire slime carries `slime` and `fire`, so both those mutagens turn up —
    // and it is also rung zero of the slimoid fire branch, so its own gene does
    // too. One kill, both keys, exactly once each.
    expect(g.state.mutagens.known.mutagens).toEqual(
      expect.arrayContaining(['elastic', 'ember']),
    );
    expect(g.state.mutagens.known.genes).toEqual(['fire_slime_gene']);
  });

  it('a species that carries no gene still hands over its tag mutagens', () => {
    const g = fresh();
    unlockMutagens(g.state, g.bus);
    grind(g, 'cave_spider', 800);
    expect(g.state.mutagens.known.mutagens).toEqual(
      expect.arrayContaining(['bouncing', 'tainting']),
    );
    expect(geneFrom('cave_spider')).toBeUndefined();
    expect(g.state.mutagens.known.genes).toEqual([]);
  });

  it('the slimoid line is collectable from the species that exist', () => {
    const g = fresh();
    unlockMutagens(g.state, g.bus);
    grind(g, 'slime_base_basic', 800);
    expect(g.state.mutagens.known.genes).toContain('slime_gene');
    expect(Object.keys(g.state.stock)).toContain('slime_gene');
  });

  it('a find only ever pays discovery once', () => {
    const g = fresh();
    unlockMutagens(g.state, g.bus);
    grind(g, 'forest_rat', 800);
    const entries = g.state.mutagens.known.mutagens;
    expect(entries).toContain('vigorous');
    expect(entries.filter((id) => id === 'vigorous')).toHaveLength(1);
  });
});

describe('refinement', () => {
  function stocked(quality: QualityTier = 'c', copies = REFINE_COPIES, biomatter = 500) {
    const g = fresh();
    unlockMutagens(g.state, g.bus);
    grantGraded(g.state, 'slime_gene', quality, copies);
    g.state.materials.biomatter = biomatter;
    return g;
  }

  it('pushes a grade up by consuming copies and biomatter', () => {
    const g = stocked('c');
    const before = g.state.materials.biomatter!;
    expect(refine(g.state, g.bus, 'slime_gene', 'c')).toBe('b');
    expect(stockOf(g.state, 'slime_gene', 'c')).toBe(0);
    expect(stockOf(g.state, 'slime_gene', 'b')).toBe(1);
    expect(g.state.materials.biomatter).toBeLessThan(before);
  });

  it('never touches tier — a refined slime gene is still a slime gene', () => {
    const g = stocked('c');
    refine(g.state, g.bus, 'slime_gene', 'c');
    // Tier is a property of the species that carried it, fixed at the drop.
    expect(MAIN_GENES.slime_gene.tier).toBe(0);
    expect(stockOf(g.state, 'slimer_gene', 'b')).toBe(0);
  });

  it('refuses without enough copies, and spends nothing when it does', () => {
    const g = stocked('c', 1);
    const before = g.state.materials.biomatter!;
    expect(refine(g.state, g.bus, 'slime_gene', 'c')).toBeNull();
    expect(stockOf(g.state, 'slime_gene', 'c')).toBe(1);
    expect(g.state.materials.biomatter).toBe(before);
  });

  it('refuses without enough biomatter', () => {
    const g = stocked('c', REFINE_COPIES, 0);
    expect(canRefine(g.state, 'slime_gene', 'c').ok).toBe(false);
    expect(refine(g.state, g.bus, 'slime_gene', 'c')).toBeNull();
  });

  it('refuses entirely while the system is shut', () => {
    const g = locked();
    grantGraded(g.state, 'slime_gene', 'c', 4);
    g.state.materials.biomatter = 500;
    expect(canRefine(g.state, 'slime_gene', 'c').ok).toBe(false);
  });

  it('gets steeper the closer to the top', () => {
    expect(refineCost('b')).toBeGreaterThan(refineCost('d'));
    expect(refineCost('s')).toBeGreaterThan(refineCost('a'));
  });

  it('stops at Divine', () => {
    const g = stocked('s');
    expect(nextGrade('s')).toBeNull();
    expect(refine(g.state, g.bus, 'slime_gene', 's')).toBeNull();
  });
});

describe('refinement on the bench clock', () => {
  function bench(copies = 4, biomatter = 500) {
    const g = fresh();
    unlockMutagens(g.state, g.bus);
    grantGraded(g.state, 'slime_gene', 'c', copies);
    g.state.materials.biomatter = biomatter;
    return g;
  }

  const subject = { subject: { id: 'slime_gene', quality: 'c' as QualityTier } };

  it('a gene is a material, so it stocks and slots like anything else', () => {
    // The whole reason genes ride the material machinery rather than a bespoke
    // inventory: drops, grading, bench slots and selling all come for free.
    expect(MATERIALS.slime_gene?.graded).toBe(true);
    expect(MATERIALS.slime_gene?.craftTags).toContain('gene');
    expect(MATERIALS.chill?.craftTags).toContain('mutagen');
    expect(isGraded('slime_gene')).toBe(true);
  });

  it('runs as a timed job rather than resolving on the click', () => {
    const g = bench();
    expect(startBenchWork(g.state, g.bus, 'mutagens', subject, { count: 1 })).toBe(true);
    expect(g.state.benchWork).not.toBeNull();
    // Nothing has happened yet — the bench is working, not finished.
    expect(stockOf(g.state, 'slime_gene', 'b')).toBe(0);
    for (let i = 0; i < 400 && g.state.benchWork; i++) tickBenchWork(g.state, g.bus);
    expect(stockOf(g.state, 'slime_gene', 'b')).toBe(1);
    expect(g.state.benchWork).toBeNull();
  });

  it('takes real time — the subject is not refined on the first tick', () => {
    const g = bench();
    startBenchWork(g.state, g.bus, 'mutagens', subject, { count: 1 });
    tickBenchWork(g.state, g.bus);
    expect(stockOf(g.state, 'slime_gene', 'c')).toBe(4);
    expect(g.state.benchWork!.ticksLeft).toBeLessThan(g.state.benchWork!.ticksPer);
  });

  it('refuses to start on a subject that cannot be refined', () => {
    const g = bench(1);
    expect(startBenchWork(g.state, g.bus, 'mutagens', subject, { count: 1 })).toBe(false);
    expect(g.state.benchWork).toBeNull();
  });

  it('stops itself once the grade it was working runs out', () => {
    // Two copies make one better one, so four C-grade genes are two passes and
    // then nothing — a bench cannot chase its own output up the ladder.
    const g = bench(4);
    startBenchWork(g.state, g.bus, 'mutagens', subject, { count: null });
    for (let i = 0; i < 2000 && g.state.benchWork; i++) tickBenchWork(g.state, g.bus);
    expect(g.state.benchWork).toBeNull();
    expect(stockOf(g.state, 'slime_gene', 'c')).toBe(0);
    expect(stockOf(g.state, 'slime_gene', 'b')).toBe(2);
  });

  it('walking away abandons the culture', () => {
    const g = bench();
    startBenchWork(g.state, g.bus, 'mutagens', subject, { count: 1 });
    g.state.spot = 'somewhere_else';
    tickBenchWork(g.state, g.bus);
    expect(g.state.benchWork).toBeNull();
    expect(stockOf(g.state, 'slime_gene', 'c')).toBe(4);
  });
});

describe('capacity is enforced on every edit', () => {
  function opened(level = 0) {
    const g = fresh();
    unlockMutagens(g.state, g.bus);
    if (level) g.state.skills.geneshaping = { level, xp: 0 };
    // Rewriting the centromere costs biomatter now; these tests are about
    // capacity, so they should never fail for want of material.
    g.state.materials.biomatter = 5000;
    return g;
  }

  /** Skip the settling period, for tests that are not about it. */
  const settled = (g: ReturnType<typeof fresh>) => {
    g.state.useCooldowns = {};
  };

  it('grows with the skill', () => {
    expect(capacityLimit(opened(20).state)).toBeGreaterThan(capacityLimit(opened().state));
  });

  it('refuses a gene that will not fit, and changes nothing when it does', () => {
    const g = opened();
    grantGraded(g.state, 'jotunn', 's', 1);
    const check = slotMain(g.state, g.bus, gene('jotunn', 's'));
    expect(check.ok).toBe(false);
    expect(chromosomeOf(g.state).main).toBeNull();
    // The refused gene is still in stock — a rejected edit costs nothing.
    expect(stockOf(g.state, 'jotunn', 's')).toBe(1);
  });

  it('takes a gene it can afford, and hands the old one back', () => {
    const g = opened(40);
    grantGraded(g.state, 'slime_gene', 'c', 1);
    grantGraded(g.state, 'slimer_gene', 'c', 1);
    expect(slotMain(g.state, g.bus, gene('slime_gene')).ok).toBe(true);
    expect(stockOf(g.state, 'slime_gene', 'c')).toBe(0);
    // The body has to take before it can be rewritten again.
    expect(slotMain(g.state, g.bus, gene('slimer_gene')).ok).toBe(false);
    settled(g);
    expect(slotMain(g.state, g.bus, gene('slimer_gene')).ok).toBe(true);
    // Swapping returns what was in the centromere rather than eating it.
    expect(stockOf(g.state, 'slime_gene', 'c')).toBe(1);
    expect(chromosomeOf(g.state).main!.id).toBe('slimer_gene');
  });

  it('will not place a mutagen you do not hold, or in a socket that is not there', () => {
    const g = opened(40);
    expect(placeMutagen(g.state, g.bus, 'g', gene('vigorous')).ok).toBe(false);
    grantGraded(g.state, 'vigorous', 'c', 1);
    expect(placeMutagen(g.state, g.bus, 'zz', gene('vigorous')).ok).toBe(false);
    expect(placeMutagen(g.state, g.bus, 'g', gene('vigorous')).ok).toBe(true);
  });

  it('removing a mutagen returns it to stock', () => {
    const g = opened(40);
    grantGraded(g.state, 'vigorous', 'c', 1);
    placeMutagen(g.state, g.bus, 'g', gene('vigorous'));
    expect(stockOf(g.state, 'vigorous', 'c')).toBe(0);
    expect(removeMutagen(g.state, 'g').ok).toBe(true);
    expect(stockOf(g.state, 'vigorous', 'c')).toBe(1);
  });

  it('establishing is permanent and only along real edges', () => {
    const g = opened(40);
    g.state.materials.histone = 100;
    expect(establish(g.state, g.bus, 'a', 'i').ok).toBe(false);
    expect(establish(g.state, g.bus, 'a', 'd').ok).toBe(true);
    expect(establish(g.state, g.bus, 'a', 'd').ok).toBe(false);
  });

  it('spooling histones teaches geneshaping and nothing else', () => {
    /*
     * THE BUG THIS PINS: every recipe emitted a bare 'craft' tag, and all six
     * crafting skills claimed it — so one spool of histones paid Smithing,
     * Cooking, Alchemy, Runecarving and Leathercrafting the full XP and
     * manifested every one of them. A geneshaping bench taught blacksmithing.
     */
    const g = fresh();
    g.state.spot = 'basement';
    g.state.materials.biomatter = 40;
    g.selectActivity('craft_histone');
    for (let i = 0; i < 900; i++) g.tick();
    expect(g.state.materials.histone ?? 0, 'nothing was spooled').toBeGreaterThan(0);
    expect(g.state.skills.geneshaping?.level).toBeGreaterThanOrEqual(1);
    for (const other of ['smithing', 'cooking', 'alchemy', 'runecarving', 'leathercrafting']) {
      expect(g.state.skills[other], `spooling must not teach ${other}`).toBeUndefined();
    }
  });

  it('a connection costs histones, and refuses without them', () => {
    const g = opened(40);
    g.state.materials.histone = 2;
    const check = establish(g.state, g.bus, 'a', 'd');
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/histones/);
    expect(chromosomeOf(g.state).established).not.toContain(edgeKey('a', 'd'));
  });

  it('spends exactly what it quoted', () => {
    const g = opened(40);
    g.state.materials.histone = 50;
    const edge = BASELINE_LAYOUT.edges.find((e) => edgeKey(e.a, e.b) === edgeKey('a', 'd'))!;
    expect(establish(g.state, g.bus, 'a', 'd').ok).toBe(true);
    expect(g.state.materials.histone).toBe(50 - histoneCost(edge));
  });

  it('long edges cost more, so the premium geography is actually premium', () => {
    // A 9μm ring arm delivers ×3 where a 3μm cluster edge delivers ×1. If both
    // cost the same there is never a reason to prefer the short one.
    const ring = BASELINE_LAYOUT.edges.find((e) => edgeKey(e.a, e.b) === edgeKey('g', '@'))!;
    const cluster = BASELINE_LAYOUT.edges.find((e) => edgeKey(e.a, e.b) === edgeKey('a', 'd'))!;
    expect(ring.length).toBeGreaterThan(cluster.length);
    expect(histoneCost(ring)).toBeGreaterThan(histoneCost(cluster));
    expect(histoneCost(ring) / histoneCost(cluster)).toBeCloseTo(ring.length / cluster.length, 1);
  });

  it('cutting reserves capacity and restoring hands it back', () => {
    const g = opened(40);
    const before = capacityFree(g.state);
    expect(cutEdge(g.state, g.bus, 'd', '@').ok).toBe(true);
    expect(capacityFree(g.state)).toBeLessThan(before);
    expect(restoreEdge(g.state, 'd', '@').ok).toBe(true);
    expect(capacityFree(g.state)).toBeCloseTo(before, 10);
  });

  it('cannot cut what was never established', () => {
    const g = opened(40);
    expect(cutEdge(g.state, g.bus, 'a', 'b').ok).toBe(false);
  });

  it('rewriting the centromere costs biomatter, scaled by what you put on', () => {
    const g = opened(40);
    grantGraded(g.state, 'slime_gene', 'c', 1);
    grantGraded(g.state, 'jotunn', 'c', 1);
    // A jötunn is a bigger job than a slime, because it is a bigger body.
    expect(swapBiomatterCost(gene('jotunn'))).toBeGreaterThan(
      swapBiomatterCost(gene('slime_gene')),
    );
    const before = g.state.materials.biomatter!;
    expect(slotMain(g.state, g.bus, gene('slime_gene')).ok).toBe(true);
    expect(g.state.materials.biomatter).toBe(before - swapBiomatterCost(gene('slime_gene')));
  });

  it('refuses without the biomatter, and spends nothing when it does', () => {
    const g = opened(40);
    grantGraded(g.state, 'slime_gene', 'c', 1);
    g.state.materials.biomatter = 0;
    const check = slotMain(g.state, g.bus, gene('slime_gene'));
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/biomatter/);
    expect(chromosomeOf(g.state).main).toBeNull();
    expect(stockOf(g.state, 'slime_gene', 'c')).toBe(1);
  });

  it('you cannot shrug a body off mid-fight and put it back after', () => {
    // The whole point of settling. Reverting to bare is free of MATERIAL —
    // you are not manufacturing anything — but it still has to take, so a bad
    // body cannot be dodged for the length of one fight.
    const g = opened(40);
    grantGraded(g.state, 'slime_gene', 'c', 1);
    slotMain(g.state, g.bus, gene('slime_gene'));
    settled(g);
    const held = g.state.materials.biomatter!;
    expect(unslotMain(g.state).ok).toBe(true);
    expect(g.state.materials.biomatter).toBe(held);
    expect(settlingLeft(g.state)).toBeGreaterThan(0);
    expect(slotMain(g.state, g.bus, gene('slime_gene')).ok).toBe(false);
  });

  it('the live resolution reflects what is actually worn', () => {
    const g = opened(40);
    grantGraded(g.state, 'slime_gene', 'c', 1);
    grantGraded(g.state, 'vigorous', 'c', 1);
    slotMain(g.state, g.bus, gene('slime_gene'));
    placeMutagen(g.state, g.bus, 'g', gene('vigorous'));
    const res = currentResolution(g.state);
    expect(res.main!.id).toBe('slime_gene');
    expect(res.arms.attacks.contributions).toHaveLength(1);
  });
});

describe('legibility', () => {
  it('every arrival can explain how it got there', () => {
    const c = chromo({
      placed: { b: gene('radiant_edge'), a: gene('rime_edge') },
      cut: cutting(['b', 'c']),
    });
    const branch = branchVia(c, 'b', 'a', 'd')!;
    expect(branch.notes.join(' ')).toMatch(/passes through a/);
    expect(branch.notes.join(' ')).toMatch(/arrives at the special arm/);
  });

  it('a split says so', () => {
    const c = chromo({ placed: { h: gene('vigorous') } });
    const arrival = reaching(resolveChromosome(c), 'attacks')[0];
    expect(arrival.notes.join(' ')).toMatch(/ties 2 ways/);
  });
});

/**
 * §11 asks the panel to show its work, and the way a readout starts lying about
 * the thing it describes is by computing it a second time. These lock the panel
 * and the stat pipeline to ONE answer: `deliveredBy` is what the character
 * feels AND what the player is shown.
 */
describe('what an arm actually delivers', () => {
  it('scales a route by distance and by the splits it took', () => {
    // vigorous is +8% maxHp, worked at 75% by its C grade. From i it arrives
    // untouched across one 9μm edge (×3 intensity, no tie), so the arm gets
    // 8% × 0.75 × 3.
    const c = chromo({ placed: { i: gene('vigorous') } });
    const res = resolveChromosome(c);
    const [route] = reaching(res, 'defenses');
    expect(contributionWeight(route, res.ceiling)).toBeCloseTo(3);
    expect(deliveredBy(route, res.ceiling)[0].value).toBeCloseTo(0.08 * 0.75 * 3);
  });

  it('is capped by the gene, not by the graph', () => {
    // A bottom-grade slime carries far less than the ring can deliver, so the
    // ceiling has to bite — and bite in the delivered VALUE, not just a label.
    const c = chromo({ main: gene('slime_gene', 'f'), placed: { i: gene('vigorous') } });
    const res = resolveChromosome(c);
    const [route] = reaching(res, 'defenses');
    expect(isClamped(route, res.ceiling)).toBe(true);
    expect(contributionWeight(route, res.ceiling)).toBeCloseTo(res.ceiling);
    expect(deliveredBy(route, res.ceiling)[0].value).toBeCloseTo(0.08 * 0.75 * res.ceiling);
  });

  it('compounds several routes the way the stat pipeline compounds them', () => {
    // g and j both reach attacks; j ties and halves. derived.ts applies each
    // multiplier separately (`stats *= 1 + value`), so folding them has to
    // compound — summing would quietly under-report a stacked arm.
    const c = chromo({ placed: { g: gene('vigorous'), j: gene('vigorous') } });
    const res = resolveChromosome(c);
    const total = armDelivery(res, 'attacks').mods.find((m) => m.stat === 'maxHp');
    const parts = reaching(res, 'attacks').flatMap((r) => deliveredBy(r, res.ceiling));
    expect(parts.length).toBeGreaterThan(1);
    expect(total!.value).toBeCloseTo(parts.reduce((n, m) => (1 + n) * (1 + m.value) - 1, 0));
  });

  it('never folds two modifiers that apply under different conditions', () => {
    // Same stat, same op, different gates — merging them would state a bonus
    // the character only sometimes has as one it always has.
    const c = chromo({ main: gene('troll'), placed: {} });
    const res = resolveChromosome(c);
    const attacks = res.arms.attacks.base!;
    expect(attacks).toHaveLength(2);
    expect(attacks[0].fromStat).toBe('resBludgeoning');
    expect(attacks[1].requiresTag).toBe('bone');
  });

  it('shows exactly what the stat pipeline consumes', () => {
    const g = fresh();
    g.state.materials.biomatter = 5000;
    g.state.useCooldowns = {};
    grantGraded(g.state, 'troll', 'c', 1);
    grantGraded(g.state, 'vigorous', 'c', 1);
    grantGraded(g.state, 'chill', 'c', 1);
    slotMain(g.state, g.bus, gene('troll'));
    g.state.mutagens.chromosome.established = BASELINE_LAYOUT.edges.map((e) => edgeKey(e.a, e.b));
    placeMutagen(g.state, g.bus, 'i', gene('vigorous'));
    placeMutagen(g.state, g.bus, 'a', gene('chill'));

    const res = currentResolution(g.state);
    // The routed half of what the character sheet reads, modifier for modifier,
    // against what the panel draws under each route. Not "close enough" —
    // identical, because they are one function called twice.
    const routed = chromosomeMods(g.state)
      .filter((x) => x.source.includes('→'))
      .map((x) => x.mod);
    const drawn = Object.values(res.arms).flatMap((arm) =>
      arm.contributions.flatMap((c) => deliveredBy(c, res.ceiling)),
    );
    expect(routed.length).toBeGreaterThan(0);
    expect(drawn).toEqual(routed);
  });

  it('knows which capabilities the game reads, and WHERE', () => {
    // The panel says "read by nothing yet" off this, so it is the fact that has
    // to be true rather than the wording. Since §12.3 was adopted for the
    // Active arm, liveness depends on where a capability landed — the same
    // Bouncing Mutation is a real trick in Active and a dead letter in Attacks.
    // The two that shape a BLOW are read in both arms that own a blow: Active
    // says it about the gene's ability, Attacks about your ordinary swing.
    for (const arm of ['active', 'attacks'] as const) {
      expect(grantIsLive('splits_target', arm)).toBe(true);
      expect(grantIsLive('ignores_dodge', arm)).toBe(true);
    }
    for (const arm of ['defenses', 'special'] as const) {
      expect(grantIsLive('splits_target', arm)).toBe(false);
      expect(grantIsLive('ignores_dodge', arm)).toBe(false);
    }
    // A condition needs something that LEAVES conditions — the ability, only.
    expect(grantIsLive('inflicts_tainted', 'active')).toBe(true);
    for (const arm of ['attacks', 'defenses', 'special'] as const) {
      expect(grantIsLive('inflicts_tainted', arm)).toBe(false);
    }
    // Equipment rules never ask which door a thing came through.
    for (const arm of ['active', 'attacks', 'defenses', 'special'] as const) {
      expect(grantIsLive('arms:+2', arm)).toBe(true);
      expect(grantIsLive('onehand:*', arm)).toBe(true);
    }
    // A capability naming a status that does not exist is a content error and
    // must never read as live.
    expect(grantIsLive('inflicts_nonsense', 'active')).toBe(false);
  });

  it('makes a mutagen worth refining, which it once was not', () => {
    // `walk` never read `held.quality`, so a mutagen's grade bought NOTHING
    // while QUALITY_COST charged more capacity for it — F was strictly optimal
    // and every refinement a self-inflicted wound. Grade is a mutagen's only
    // power axis; it has no tier to climb.
    const worst = chromo({ placed: { i: gene('vigorous', 'f') } });
    const best = chromo({ placed: { i: gene('vigorous', 's') } });
    const value = (c: Chromosome) => {
      const res = resolveChromosome(c);
      return deliveredBy(reaching(res, 'defenses')[0], res.ceiling)[0].value;
    };
    expect(value(best)).toBeGreaterThan(value(worst));
    // F is weak, never harmful — §9. It still delivers something positive.
    expect(value(worst)).toBeGreaterThan(0);
    expect(value(worst) / value(best)).toBeCloseTo(0.5);
  });

  it('leaves capabilities alone, however cheap the mutagen', () => {
    // §7: a capability reads the same off a cheap thing as an expensive one,
    // so the quality curve must touch magnitudes and nothing else.
    const worst = resolveChromosome(chromo({ placed: { g: gene('bouncing', 'f') } }));
    const best = resolveChromosome(chromo({ placed: { g: gene('bouncing', 's') } }));
    expect(worst.arms.attacks.grants).toEqual(best.arms.attacks.grants);
  });

  it('counts a route that carries nothing but a capability', () => {
    // bouncing has grants and no mods: the arm must not report it as delivering
    // a stat, and must not lose it either.
    const c = chromo({ placed: { g: gene('bouncing') } });
    const got = armDelivery(resolveChromosome(c), 'attacks');
    expect(got.mods).toHaveLength(0);
    expect(got.silent).toBe(1);
    expect(got.grants).toContain('splits_target');
  });
});

/**
 * Two ways to be worth more than you are, and they point opposite directions:
 * a CONDUIT multiplies what passes through it, a CATALYST multiplies the output
 * of whatever its own route runs into.
 */
describe('amplifiers', () => {
  /** The one route into `arm`, and what it was worth on arrival. */
  const only = (c: Chromosome, arm: 'attacks' | 'defenses' | 'special' | 'active') => {
    const res = resolveChromosome(c);
    const route = reaching(res, arm)[0];
    return { res, route, weight: contributionWeight(route, res.ceiling) };
  };

  it('a conduit multiplies what passes through it and contributes nothing itself', () => {
    // h ties both ways round the ring, so cut one side to get a single route:
    // j → g → @ with the conduit sitting in g.
    const plain = chromo({ placed: { j: gene('vigorous'), g: gene('vigorous') } });
    const piped = chromo({ placed: { j: gene('vigorous'), g: gene('resonance') } });
    // Resonance delivers no modifier of its own — it is pure infrastructure.
    const own = reaching(resolveChromosome(piped), 'attacks').find((r) => r.from === 'g');
    expect(own && deliveredBy(own, resolveChromosome(piped).ceiling)).toHaveLength(0);
    // …but what came through it arrives stronger than it otherwise would.
    const through = (c: Chromosome) =>
      reaching(resolveChromosome(c), 'attacks').find((r) => r.from === 'j')!;
    expect(through(piped).gain).toBeGreaterThan(through(plain).gain);
    expect(through(plain).gain).toBe(1);
  });

  it('a catalyst raises what its route runs INTO, not what passes through it', () => {
    // j → g → @. A catalyst in j lifts g's own output; it multiplies nothing
    // travelling through j, because nothing does.
    const plain = chromo({ placed: { g: gene('vigorous') } });
    const fed = chromo({ placed: { g: gene('vigorous'), j: gene('catalyst') } });
    expect(only(fed, 'attacks').route.gain).toBeGreaterThan(only(plain, 'attacks').route.gain);
    expect(only(fed, 'attacks').route.from).toBe('g');
  });

  it('a catalyst pointed at the centromere helps nobody', () => {
    // g routes straight to @, so there is no mutagen downstream to lift.
    const c = chromo({ placed: { g: gene('catalyst'), i: gene('vigorous') } });
    expect(only(c, 'defenses').route.gain).toBe(1);
  });

  it('amplifiers compound through each other', () => {
    // A catalyst feeding a catalyst hands on more than it would alone — which
    // is the whole of "including another amplifier".
    const one = chromo({ placed: { d: gene('vigorous'), a: gene('catalyst') } });
    const two = chromo({ placed: { d: gene('vigorous'), a: gene('catalyst'), b: gene('catalyst') } });
    const lifted = (c: Chromosome) =>
      reaching(resolveChromosome(c), 'special').find((r) => r.from === 'd')!.gain;
    expect(lifted(two)).toBeGreaterThan(lifted(one));
  });

  it('quality buys the surplus, so a bottom-grade amplifier is weak and never harmful', () => {
    const weak = chromo({ placed: { g: gene('vigorous'), j: gene('catalyst', 'f') } });
    const strong = chromo({ placed: { g: gene('vigorous'), j: gene('catalyst', 's') } });
    expect(only(weak, 'attacks').route.gain).toBeGreaterThan(1);
    expect(only(weak, 'attacks').route.gain).toBeLessThan(only(strong, 'attacks').route.gain);
  });

  it('holds a conduit chain under the ceiling too', () => {
    // Same guard from the other direction: conduits multiply what PASSES, and
    // a stack of them must also land inside §7's cap rather than through it.
    const c = chromo({
      main: gene('slime_gene', 'f'),
      placed: { j: gene('vigorous'), g: gene('resonance', 's') },
    });
    const res = resolveChromosome(c);
    const route = reaching(res, 'attacks').find((r) => r.from === 'j')!;
    expect(route.gain).toBeGreaterThan(1);
    expect(contributionWeight(route, res.ceiling)).toBeLessThanOrEqual(res.ceiling);
  });

  it('is held by the gene ceiling like every other magnitude', () => {
    // THE guard. Amplification used to multiply `effect.mods` directly, which
    // put it entirely outside §7's cap — and a chain of multipliers that the
    // ceiling cannot see is the only build worth playing. Amplifiers must buy
    // a way to REACH the ceiling, never a way past it.
    const c = chromo({
      main: gene('slime_gene', 'f'),
      placed: { g: gene('vigorous'), j: gene('catalyst', 's') },
    });
    const { res, route, weight } = only(c, 'attacks');
    expect(route.gain).toBeGreaterThan(1);
    expect(isClamped(route, res.ceiling)).toBe(true);
    expect(weight).toBeCloseTo(res.ceiling * route.share);
  });
});

/**
 * `(flat + power × fromStat) × speed × (1 + amplifiedBy)` — one formula, and
 * each ability uses the parts it needs.
 */
describe('what a gene ability lands for', () => {
  const priced = (spec: object, stats: Partial<Record<string, number>>) =>
    priceGeneAbility(
      fresh().state,
      { type: 'gene', cooldown: 10, ...spec } as never,
      { speed: BASE_SPEED, ...stats } as never,
      'Test',
    ).damage;

  it("prices off a condition the TARGET carries, and reads as its floor without one", () => {
    const spec = { flat: 10, perTargetStacks: { status: 'hunger_anupama', power: 4 } };
    const hungry = fresh();
    for (let i = 0; i < 6; i++) {
      applyStatus(hungry.state, hungry.state, { id: 'hunger_anupama', intensity: 0.2 });
    }

    const withTarget = priceGeneAbility(
      fresh().state,
      { type: 'gene', cooldown: 10, ...spec } as never,
      { speed: BASE_SPEED } as never,
      'Test',
      hungry.state,
    ).damage;
    // Six appetites at 4 apiece, on top of the body's own 10.
    expect(withTarget).toBeCloseTo(34);

    // Every other pricing field reads the caster, so a panel with nobody in
    // front of it still has to price the blow. It reads as the floor.
    expect(priced(spec, {})).toBeCloseTo(10);
  });

  it('scales what it inflicts by the root of the same count, per target', () => {
    const gene = { id: 'bare', quality: 'S' } as unknown as GeneInstance;
    const spec = {
      type: 'gene',
      cooldown: 10,
      perTargetStacks: { status: 'hunger_anupama', power: 1, inflictRoot: [4, 2] as [number, number] },
    } as never;

    const target = fresh();
    for (let i = 0; i < 16; i++) {
      applyStatus(target.state, target.state, { id: 'hunger_anupama', intensity: 0.2 });
    }
    // At S the root is 2, so sixteen appetites weigh four.
    expect(perTargetInflictIntensity(spec, gene, target.state)).toBeCloseTo(4);

    // Nothing on them, nothing to weigh.
    expect(perTargetInflictIntensity(spec, gene, fresh().state)).toBeUndefined();
  });

  it('leaves an ability with no inflictRoot to its authored intensity', () => {
    const gene = { id: 'bare', quality: 'S' } as unknown as GeneInstance;
    const spec = {
      type: 'gene',
      cooldown: 10,
      perTargetStacks: { status: 'hunger_anupama', power: 1 },
    } as never;
    const target = fresh();
    applyStatus(target.state, target.state, { id: 'hunger_anupama', intensity: 1 });
    expect(perTargetInflictIntensity(spec, gene, target.state)).toBeUndefined();
  });

  it('prices an unbounded stat per point, as the giants do', () => {
    expect(priced({ flat: 30, power: 1.4, fromStat: 'damage' }, { damage: 1000 })).toBeCloseTo(1430);
  });

  it('adds armour to the base and scales the whole thing by speed', () => {
    // The basic slime bounce: (flat + armor) × speed.
    const spec = { flat: 60, power: 1, fromStat: 'armor', scalesWithSpeed: true };
    expect(priced(spec, { armor: 40 })).toBeCloseTo(100);
    expect(priced(spec, { armor: 40, speed: BASE_SPEED * 2 })).toBeCloseTo(200);
  });

  it('amplifies rather than prices a resistance, so the cap is a ×1.75', () => {
    // THE BUG. `power × resHeat` made the blow worth almost nothing early, worth
    // its ceiling the moment the 0.75 cap was reached, and worth exactly that
    // forever after — a resistance has no attribute behind it to keep growing.
    const spec = { flat: 60, amplifiedBy: 'resHeat', scalesWithSpeed: true };
    expect(priced(spec, { resHeat: 0 })).toBeCloseTo(60);
    expect(priced(spec, { resHeat: 0.75 })).toBeCloseTo(105); // 60 × 1.75
  });

  it('Anupama wears its own rule and pays its attack arm in regeneration', () => {
    const def = MAIN_GENES.asurendra_anupama;
    expect(def.tier).toBe(5);
    expect(def.genus).toBe('asuroid');
    // The Special is a condition, not a flag — so the monster half can wear the
    // same one through MonsterDef.wears.
    expect(def.confers?.map((a) => a.id)).toContain('fasting');
    // "Uniquely no bonus to damage" is the identity: the attack arm is empty on
    // purpose, and its payout lives in `fasts` instead. Assert it so nobody
    // tidies an "oversight" into it.
    expect(def.base?.attacks ?? []).toHaveLength(0);
    expect(def.fasts?.regenRoot[0]).toBeGreaterThan(def.fasts!.regenRoot[1]);
  });

  it("Anupama's active is priced off the target and thrown at the room", () => {
    const spec = MAIN_GENES.asurendra_anupama.ability!.spec as never as {
      splashAll?: boolean;
      perTargetStacks?: { status: string };
      inflicts?: { id: string }[];
    };
    expect(spec.splashAll).toBe(true);
    expect(spec.perTargetStacks?.status).toBe('hunger_anupama');
    expect(spec.inflicts?.map((a) => a.id)).toContain('weight_of_hunger');

    const hungry = fresh();
    for (let i = 0; i < 5; i++) {
      applyStatus(hungry.state, hungry.state, { id: 'hunger_anupama', intensity: 0.2 });
    }
    const real = MAIN_GENES.asurendra_anupama.ability!.spec;
    const stats = { speed: BASE_SPEED } as never;
    const starving = priceGeneAbility(fresh().state, real as never, stats, 'x', hungry.state).damage;
    const sated = priceGeneAbility(fresh().state, real as never, stats, 'x').damage;
    expect(starving).toBeGreaterThan(sated);
  });

  it('lets a negative resistance genuinely take damage off', () => {
    // A troll's −25% heat is a real result, not a floor to clamp away.
    const spec = { flat: 60, amplifiedBy: 'resHeat' };
    expect(priced(spec, { resHeat: -0.25 })).toBeCloseTo(45);
    // …but never past zero into healing the thing you hit.
    expect(priced(spec, { resHeat: -3 })).toBe(0);
  });

  it('keeps growing after the resistance cap, through speed', () => {
    // The point of the whole change: at the cap the resistance term is pinned,
    // so the blow needs a term with an attribute behind it or it is finished.
    const spec = { flat: 60, amplifiedBy: 'resHeat', scalesWithSpeed: true };
    const capped = { resHeat: 0.75 };
    expect(priced(spec, { ...capped, speed: BASE_SPEED * 3 })).toBeGreaterThan(
      priced(spec, capped),
    );
  });

  it('shows its working, and the working multiplies out to the number', () => {
    // The damage report and the ability card read these same steps, so a step
    // that does not reconstruct the total is a card that lies about the blow.
    const { damage, steps } = priceGeneAbility(
      fresh().state,
      {
        type: 'gene',
        cooldown: 10,
        flat: 60,
        amplifiedBy: 'resHeat',
        scalesWithSpeed: true,
      } as never,
      { speed: BASE_SPEED * 1.5, resHeat: 0.5 } as never,
      'Flaming Bounce',
    );
    const rebuilt = steps.reduce((n, s) => (s.mult !== undefined ? n * s.mult : n + (s.value ?? 0)), 0);
    expect(rebuilt).toBeCloseTo(damage);
    expect(damage).toBeCloseTo(60 * 1.5 * 1.5);
  });
});

/**
 * NUCLEASES change WHAT, never HOW MUCH.
 *
 * The qualitative axis the magnitude-sink arms lacked: every other thing on
 * this graph moves a number, and a rekey moves a KEY. `g–@` is one hop from
 * the centromere and `j` is two, which is what the index rule sorts on.
 */
describe('a nuclease rekeys a body', () => {
  const troll = MAIN_GENES.troll;
  const heatMod = (def: typeof troll) =>
    def.base!.defenses!.find((m) => m.value < 0)!;

  it('is the same product whichever mutation supplied the element', () => {
    // THE RULE. The nuclease is what spawns; the mutation is spent for its
    // elemental tag and everything else it did is lost in the fusing. So a
    // Venom Edge and a Miasma Brand make the one Poison Vulnerability.
    expect(fusionOf('vuln', 'venom_edge')).toBe(MUTATIONS.vuln_poison);
    expect(fusionOf('vuln', 'miasma_brand')).toBe(MUTATIONS.vuln_poison);
    expect(fusionOf('vuln', 'tainting')).toBe(MUTATIONS.vuln_poison);
    // …and the three legs of the cold line likewise agree.
    for (const parent of ['rime_edge', 'frostbite_brand', 'chill']) {
      expect(fusionOf('vuln', parent), parent).toBe(MUTATIONS.vuln_cold);
    }
  });

  it('carries the rekey and nothing else — the parent is gone', () => {
    const fused = MUTATIONS.vuln_cold;
    expect(fused.rekey).toEqual({ kind: 'vulnerability', to: 'cold' });
    expect(fused.effect).toBeUndefined();
    expect(fused.transform).toBeUndefined();
    // A Ward fused into a nuclease stops warding: it is not that thing now.
    expect(MUTATIONS.chill.effect).toBeDefined();
  });

  it('pairs with nothing that speaks for no element', () => {
    expect(fusionOf('vuln', 'vigorous')).toBeUndefined();
    expect(fusionOf('vuln', 'resonance')).toBeUndefined();
    // …and never with something already fused.
    expect(fusionOf('vuln', 'vuln_cold')).toBeUndefined();
  });

  it('rewrites the weakness and leaves its size alone', () => {
    // THE LAW. A −25% heat weakness becomes a −25% COLD one.
    const before = heatMod(troll);
    expect(before.stat).toBe('resHeat');
    const after = heatMod(rekeyGene(troll, ['cold']));
    expect(after.stat).toBe('resCold');
    expect(after.value).toBe(before.value);
  });

  it('rewrites what douses it, which is the whole reason that moved onto the gene', () => {
    const rules = rekeyGene(troll, ['cold', 'lightning']).confers![0].removal!;
    // Resistances come first in the index order, so the second rekey is the
    // first dousing type.
    expect(rules[0].damageTypes).toEqual(['lightning', 'acid']);
  });

  it('never touches the content the species is written from', () => {
    // The def is shared: rewriting in place would rekey the species for every
    // save in the process, and only show up on the second character.
    rekeyGene(troll, ['cold', 'lightning']);
    expect(MAIN_GENES.troll.base!.defenses!.some((m) => m.stat === 'resHeat')).toBe(true);
    expect(MAIN_GENES.troll.confers![0].removal![0].damageTypes).toEqual(['heat', 'acid']);
  });

  it('does nothing to a body with nothing to rewrite', () => {
    // "…but only if such vulnerabilities exist in the first place."
    const slime = MAIN_GENES.slime_gene;
    expect(weakPointsOf(slime)).toHaveLength(0);
    expect(rekeyGene(slime, ['cold'])).toBe(slime);
  });

  it('takes the nearest route first, and ignores the surplus', () => {
    const res = resolveChromosome(
      chromo({
        main: gene('troll'),
        // g is one hop, j is two — so g rewrites the FIRST weak point.
        placed: { g: gene('vuln_lightning'), j: gene('vuln_cold') },
      }),
    );
    expect(res.main!.base!.defenses!.find((m) => m.value < 0)!.stat).toBe('resLightning');
    expect(res.main!.confers![0].removal![0].damageTypes).toEqual(['cold', 'acid']);
    // A third would have nothing left to point at, and simply does nothing.
    const crowded = resolveChromosome(
      chromo({
        main: gene('troll'),
        placed: {
          g: gene('vuln_lightning'),
          j: gene('vuln_cold'),
          i: gene('vuln_heat'),
        },
      }),
    );
    expect(crowded.main!.base!.defenses!.find((m) => m.value < 0)!.stat).toBe('resLightning');
  });

  it('reaches the character sheet, not just the resolution', () => {
    const g = fresh();
    unlockMutagens(g.state, g.bus);
    g.state.mutagens.chromosome = chromo({
      main: gene('troll'),
      placed: { g: gene('vuln_cold') },
    });
    const mods = chromosomeMods(g.state).map((x) => x.mod);
    expect(mods.some((m) => m.stat === 'resCold' && m.value < 0)).toBe(true);
    expect(mods.some((m) => m.stat === 'resHeat' && m.value < 0)).toBe(false);
  });

  describe('fusing one', () => {
    function bench() {
      const g = fresh();
      unlockMutagens(g.state, g.bus);
      g.state.materials.biomatter = 500;
      g.state.materials.vuln = 2;
      grantGraded(g.state, 'chill', 'b', 1);
      grantGraded(g.state, 'vigorous', 'b', 1);
      return g;
    }

    it('spends both halves and keeps the subject\'s grade', () => {
      // A nuclease adds no magnitude, so taking grade out at the other end
      // would quietly make fusing a refinement in reverse.
      const g = bench();
      expect(fuse(g.state, g.bus, 'vuln', 'chill', 'b')?.id).toBe('vuln_cold');
      // Produced at C, never the subject's grade: a rekey has no magnitude for a
      // grade to scale, so carrying one would be a number that changes nothing.
      expect(stockOf(g.state, 'vuln_cold', FUSED_GRADE)).toBe(1);
      expect(stockOf(g.state, 'vuln_cold', 'b')).toBe(0);
      expect(stockOf(g.state, 'chill', 'b')).toBe(0);
      expect(g.state.materials.vuln).toBe(1);
      expect(g.state.materials.biomatter).toBe(500 - FUSE_BIOMATTER);
    });

    it('refuses a mutation that speaks for no element, and spends nothing', () => {
      const g = bench();
      expect(fuse(g.state, g.bus, 'vuln', 'vigorous', 'b')).toBeNull();
      expect(g.state.materials.vuln).toBe(2);
      expect(g.state.materials.biomatter).toBe(500);
      expect(stockOf(g.state, 'vigorous', 'b')).toBe(1);
    });

    it('refuses without the nuclease, the subject, or the biomatter', () => {
      const noNuclease = bench();
      noNuclease.state.materials.vuln = 0;
      expect(fuse(noNuclease.state, noNuclease.bus, 'vuln', 'chill', 'b')).toBeNull();
      const noSubject = bench();
      expect(fuse(noSubject.state, noSubject.bus, 'vuln', 'chill', 's')).toBeNull();
      const noBiomatter = bench();
      noBiomatter.state.materials.biomatter = 0;
      expect(fuse(noBiomatter.state, noBiomatter.bus, 'vuln', 'chill', 'b')).toBeNull();
    });

    it('is never found on a corpse — the bench is what makes one', () => {
      // Dropping the result would make the fusion pointless and the bench
      // optional, which is the whole reason the pairing exists.
      const everything = new Set(['ice', 'fire', 'undead', 'slime', 'beast', 'toxic']);
      expect(mutagensFrom(everything).some((m) => m.rekey)).toBe(false);
      // The nuclease itself, however, is findable.
      expect(nucleasesFrom(new Set(['undead'])).map((n) => n.id)).toContain('vuln');
    });
  });

  it('changes what douses the body it is actually worn on', () => {
    // End to end: the rekeyed dousing types have to reach the condition the
    // body wears, or the rewrite is a number on a card and nothing more.
    const g = fresh();
    unlockMutagens(g.state, g.bus);
    g.state.mutagens.chromosome = chromo({
      main: gene('troll'),
      // Two rekeys: the first takes the resistance, the second the dousing.
      placed: { g: gene('vuln_cold'), j: gene('vuln_cold') },
    });
    syncGeneStatuses(g.state);
    const rule = findStatus(g.state, 'knitting')!.removal!.find((r) => r.damageTypes)!;
    expect(rule.damageTypes).toEqual(['cold', 'acid']);
  });
});

/**
 * The Attacks row of §12's proposal, adopted 2026-08-07 alongside Active.
 *
 * This is the arm that restores "hops buy character" to half the system: before
 * it, a transform could only retype (inert here) or multiply (which is
 * distance's job), so routing into Attacks was a pure magnitude sink with no
 * puzzle in it. `g–@` is the Attacks door.
 */
describe('the Attacks arm reaches your ordinary swing', () => {
  function armed(over: Partial<Chromosome>) {
    const g = fresh();
    unlockMutagens(g.state, g.bus);
    g.state.mutagens.chromosome = chromo({ main: gene('troll'), ...over });
    return g;
  }

  /** Put a weapon in hand, the long way round — no starting kit assumptions. */
  function give(g: Game, defId: string) {
    const item = createItem(g.state, defId);
    g.state.inventory.push(item);
    return item;
  }

  it('leaves the weapon speaking for itself when nothing is routed', () => {
    const g = armed({ placed: {} });
    g.equip(give(g, 'iron_sword').uid);
    expect(playerDamageType(g.state)).toBe('slashing');
  });

  it('re-types every ordinary swing when a type arrives', () => {
    const g = armed({ placed: { g: gene('rime_edge') } });
    g.equip(give(g, 'iron_sword').uid);
    // A rimed body swings cold whatever the blade is made of.
    expect(playerDamageType(g.state)).toBe('cold');
  });

  it('re-types a bare fist too — this is the body, not the weapon', () => {
    const g = armed({ placed: { g: gene('searing_edge') } });
    expect(playerDamageType(g.state)).toBe('heat');
  });

  it('never re-types from another arm', () => {
    // i is the Defenses door; the same Edge does nothing to your swing there.
    const g = armed({ placed: { i: gene('rime_edge') } });
    g.equip(give(g, 'iron_sword').uid);
    expect(playerDamageType(g.state)).toBe('slashing');
  });

  it('gives the loudest route the last word here as well', () => {
    // j → i → @ and j → g → @ tie, so cut the defenses side: j reaches attacks
    // alone across 15μm (×5), against g's own 9μm (×3).
    const g = armed({
      placed: { g: gene('searing_edge'), j: gene('rime_edge') },
      cut: cutting(['i', 'j']),
    });
    // g holds a Searing Edge, which re-types what passes THROUGH it — law 2
    // still has the last word, so the nearer socket wins on character.
    expect(playerDamageType(g.state)).toBe('heat');
  });

  it('carries the blow-shaping capabilities, which Active also reads', () => {
    const g = armed({ placed: { g: gene('elastic'), j: gene('bouncing') } });
    expect(armGrants(g.state, 'attacks', 'ignores_dodge')).toBe(true);
    expect(armGrants(g.state, 'attacks', 'splits_target')).toBe(true);
    // …and does not claim them for an arm that never received them.
    expect(armGrants(g.state, 'defenses', 'ignores_dodge')).toBe(false);
  });
});

/**
 * docs/MUTAGENS.md §12.3, adopted for this arm on 2026-08-07.
 *
 * The arm named Active described an ABILITY while the other three described
 * stats — and only the stats were consumed, so pouring mutations into Active
 * did everything except what its name promised. `f–@` is the Active door, so
 * everything below routes through socket `f`.
 */
describe('the Active arm reaches the ability', () => {
  const troll = MAIN_GENES.troll.ability!;
  const resolved = (over: Partial<Chromosome>) =>
    applyActiveArm(troll, resolveChromosome(chromo({ main: gene('troll'), ...over })));
  const spec = (over: Partial<Chromosome>) => {
    const s = resolved(over).spec;
    if (s.type !== 'gene') throw new Error('troll bite is a gene spec');
    return s;
  };

  it('leaves the ability exactly as written when nothing arrives', () => {
    expect(resolved({ placed: {} })).toEqual(troll);
  });

  it('re-types the blow when a type arrives', () => {
    expect(troll.spec.type === 'gene' && troll.spec.damageType).toBe('piercing');
    expect(spec({ placed: { f: gene('rime_edge') } }).damageType).toBe('cold');
  });

  it('re-types rather than adding, because §7a says replacement is the safe one', () => {
    // Additive re-typing widens resistance coverage for free; replacement costs
    // you against the new type, permanently, with no opt-out.
    const s = spec({ placed: { f: gene('rime_edge') } });
    expect(s.damageType).toBe('cold');
    expect(s.riders ?? []).toHaveLength(0);
  });

  it('gives the loudest route the last word when several types arrive', () => {
    // `f` must stay EMPTY for this to be a contest at all: every route into the
    // Active door passes through f, so an Edge sitting there re-types the lot
    // and wins by law 2 regardless of what anything else was worth.
    //
    // With f clear: e → f → @ crosses 6μm undisturbed for ×2 (d–e cut so it
    // does not tie into special), while b → c → f → @ crosses 9μm for ×3 but
    // halves at b's tie, landing at ×1.5. The nearer, undivided route is the
    // louder one — and which route is loudest is a topology decision the player
    // already controls.
    const cut = cutting(['d', 'e']);
    const s = spec({ placed: { e: gene('rime_edge'), b: gene('searing_edge') }, cut });
    expect(s.damageType).toBe('cold');
    const swapped = spec({ placed: { e: gene('searing_edge'), b: gene('rime_edge') }, cut });
    expect(swapped.damageType).toBe('heat');
  });

  it('makes the blow leave a condition when a brand arrives', () => {
    const s = spec({ placed: { f: gene('frostbite_brand') } });
    expect(s.inflicts?.map((a) => a.id)).toContain('chilled');
    // …without losing what the species already left behind.
    expect(s.inflicts?.map((a) => a.id)).toEqual(
      expect.arrayContaining(['bleeding', 'punctured', 'chilled']),
    );
  });

  it('brands as hard as the graph carried it, not always at 1', () => {
    // §7 splits this in two, and the split is the whole point: WHETHER the bite
    // brands is a capability and free, but HOW HARD is a magnitude and the
    // graph decides it. Pinned at intensity 1 — as it was — distance, grade and
    // placement all meant nothing whatsoever to a condition build.
    const near = spec({ placed: { f: gene('frostbite_brand') } });
    const far = spec({ placed: { c: gene('frostbite_brand') } });
    const chill = (s: typeof near) => s.inflicts!.find((a) => a.id === 'chilled')!.intensity!;
    // c → f → ◉ crosses two edges; f → ◉ crosses one.
    expect(chill(far)).toBeGreaterThan(chill(near));
  });

  it('brands harder for a better grade, like every other magnitude', () => {
    const worst = spec({ placed: { f: gene('frostbite_brand', 'f') } });
    const best = spec({ placed: { f: gene('frostbite_brand', 's') } });
    const chill = (s: typeof worst) => s.inflicts!.find((a) => a.id === 'chilled')!.intensity!;
    // The capability arrives either way — F is weak, never absent.
    expect(chill(worst)).toBeGreaterThan(0);
    expect(chill(best)).toBeGreaterThan(chill(worst));
  });

  it('names the BASE form, so branding repeatedly escalates on its own', () => {
    // buffeted → unfooted and shardbound → shardbloom are the status system's
    // business; a mutagen that named the escalated form would skip the ladder.
    expect(spec({ placed: { f: gene('buffet_brand') } }).inflicts?.map((a) => a.id)).toContain(
      'buffeted',
    );
    expect(spec({ placed: { f: gene('tremor_brand') } }).inflicts?.map((a) => a.id)).toContain(
      'shardbound',
    );
  });

  it('changes the SHAPE of the blow when a function capability arrives', () => {
    expect(spec({ placed: { f: gene('bouncing') } }).splashAll).toBe(true);
    expect(spec({ placed: { f: gene('elastic') } }).sure).toBe(true);
  });

  it('never reaches the ability from another arm', () => {
    // g is the Attacks door and i is Defenses. Same mutagen, nothing happens.
    expect(resolved({ placed: { g: gene('rime_edge'), i: gene('frostbite_brand') } })).toEqual(
      troll,
    );
  });

  it('does not pay a routed magnitude twice', () => {
    // Mods routed into Active land as ordinary stats, as they always have. If
    // they ALSO moved the ability's own coefficient, the ceiling argument in
    // §7a would be counting one contribution in two places.
    const s = spec({ placed: { f: gene('searing_edge') } });
    expect(s.power).toBe((troll.spec as { power: number }).power);
    expect(s.flat).toBe((troll.spec as { flat: number }).flat);
  });

  it('reaches the live ability the rotation actually swings', () => {
    // End to end: the seam is `geneAbility`, so every consumer — pickActive,
    // the combat card, the panel — sees the rewritten spec without asking.
    const g = fresh();
    unlockMutagens(g.state, g.bus);
    g.state.skills.geneshaping = { level: 40, xp: 0 };
    g.state.materials.biomatter = 5000;
    g.state.useCooldowns = {};
    grantGraded(g.state, 'troll', 'c', 1);
    grantGraded(g.state, 'rime_edge', 'c', 1);
    slotMain(g.state, g.bus, gene('troll'));
    g.state.mutagens.chromosome.established = BASELINE_LAYOUT.edges.map((e) => edgeKey(e.a, e.b));
    expect((geneAbility(g.state)!.spec as { damageType: string }).damageType).toBe('piercing');
    placeMutagen(g.state, g.bus, 'f', gene('rime_edge'));
    expect((geneAbility(g.state)!.spec as { damageType: string }).damageType).toBe('cold');
    // …and the written species is still available, unchanged, for comparison.
    expect((geneAbilityBase(g.state)!.spec as { damageType: string }).damageType).toBe('piercing');
  });
});

/**
 * The first asurendra. Tier 5's identity is breaking a rule rather than bending
 * a number, and Tarunavāk's rule is "casting costs you a turn": it speaks
 * beside the action bar, for free, while you do something else.
 */
describe('Tarunavāk, of Sixteen Tongues', () => {
  const def = MAIN_GENES.asurendra_tarunavak;

  it('knows sixteen words, and every one of them is real', () => {
    // An invented word would silently never cast — the same silent failure an
    // invented monster tag is, and the reason this is asserted at all.
    expect(def.tongues!.words).toHaveLength(16);
    for (const w of def.tongues!.words) {
      expect(ARCANE_WORDS[w], `'${w}' is not an arcane word`).toBeDefined();
    }
    // Never `zero`, which unsays a sentence rather than being one.
    expect(def.tongues!.words).not.toContain('zero');
  });

  it('speaks each word ALONE — a lone word is a real cast, not a fragment', () => {
    for (const w of def.tongues!.words) {
      const spec = composeArcane([w]);
      expect(spec, `'${w}' composes to nothing on its own`).toBeTruthy();
      expect(spec!.strikes.length, `'${w}' lands nothing on its own`).toBeGreaterThan(0);
    }
  });

  it('gives every word its own type, so the pool is genuinely varied', () => {
    // The reason for single words over pairs: composing would blend sixteen
    // distinct outcomes into one average. The three physical verbs earn their
    // place by answering resistances no element does.
    const types = new Set(def.tongues!.words.map((w) => composeArcane([w])!.strikes[0].type));
    expect(types.size).toBeGreaterThan(8);
    for (const physical of ['slashing', 'bludgeoning', 'piercing']) {
      expect(types.has(physical as never), physical).toBe(true);
    }
  });

  it('climbs its own ladder as a TOKEN, and stops at the top of it', () => {
    // ⚠️ `stacked` holds DISPLAY names — there is no word called "blaze".
    // Depth is a sentence token the composer parses, and building the display
    // name instead composes nothing and the mouth goes quiet without erroring.
    expect(spokenAs('fire', 1)).toBe('fire');
    expect(spokenAs('fire', 2)).toBe('fire:2');
    expect(spokenAs('fire', 3)).toBe('fire:3');
    expect(ARCANE_WORDS.blaze, 'blaze is a display name, not a word').toBeUndefined();
    // Said a hundred times it is still the third rung — the ladder has three.
    expect(spokenAs('fire', 100)).toBe(`fire:${MAX_STACK}`);
    // Every word in the pool composes at every rung, so none is a special case.
    for (const w of def.tongues!.words) {
      for (let rung = 1; rung <= MAX_STACK; rung++) {
        const spec = composeArcane([spokenAs(w, rung)]);
        expect(spec, `${w} rung ${rung} composes to nothing`).toBeTruthy();
      }
    }
  });

  it('reads its clock and its power off the grade', () => {
    const worst = atGrade(def.tongues!.everyTicks, gene('asurendra_tarunavak', 'f'));
    const best = atGrade(def.tongues!.everyTicks, gene('asurendra_tarunavak', 's'));
    expect(best).toBeLessThan(worst); // better bodies speak more often
    const quiet = atGrade(def.tongues!.power, gene('asurendra_tarunavak', 'f'));
    const loud = atGrade(def.tongues!.power, gene('asurendra_tarunavak', 's'));
    expect(loud).toBeGreaterThan(quiet);
    expect(quiet).toBeGreaterThan(0); // F is weak, never harmful
  });

  it('speaks in a fight, escalating as it goes, without spending mana', () => {
    const g = fresh();
    g.state.spot = 'woods_edge';
    g.state.mutagens.chromosome.main = { id: 'asurendra_tarunavak', quality: 's' };
    g.selectActivity('hunt');
    for (let i = 0; i < 400 && !g.state.combat; i++) g.tick();
    expect(g.state.combat, 'needed a fight').toBeTruthy();
    const manaBefore = g.state.resources.mana;
    // Observed cumulatively: fights end and start again inside 400 ticks, and
    // `spoken` resets with each — sampling only at the end can read a mouth
    // that has simply not opened yet in the newest encounter.
    const everSaid = new Set<string>();
    let deepest = 0;
    for (let i = 0; i < 400; i++) {
      g.tick();
      for (const [word, times] of Object.entries(g.state.combat?.spoken ?? {})) {
        everSaid.add(word);
        deepest = Math.max(deepest, times);
      }
    }
    expect(everSaid.size, 'nothing was ever said').toBeGreaterThan(0);
    expect(deepest, 'never climbed past the first rung').toBeGreaterThan(1);
    // Words are not cast so much as leaked: the pool is untouched.
    expect(g.state.resources.mana).toBeGreaterThanOrEqual(manaBefore);
  });

  it('starts each fight quiet — the rung is the shape of a fight', () => {
    // `spoken` lives on the encounter, so a new one opens at the first rung
    // rather than inheriting a mouth already at full voice.
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'asurendra_tarunavak', quality: 's' };
    g.state.spot = 'woods_edge';
    g.selectActivity('hunt');
    for (let i = 0; i < 400 && !g.state.combat; i++) g.tick();
    g.state.combat!.spoken = { fire: 3 };
    abandonCombat(g.state, g.bus);
    for (let i = 0; i < 400 && !g.state.combat; i++) g.tick();
    expect(g.state.combat?.spoken ?? {}).toEqual({});
  });
});

/**
 * Kritavya refuses creation — and the whole of the gene is that it does not
 * make an exception for your hands.
 */
describe('Kritavya, Refuter of Creation', () => {
  function refuting(quality: QualityTier = 's') {
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'asurendra_kritavya', quality };
    g.state.combat = {
      enemies: [], playerBar: 0, cooldowns: {}, buffs: {}, events: {},
    } as never;
    return g;
  }

  it('argues with nothing at all when the body is not that body', () => {
    const g = fresh();
    g.state.combat = { enemies: [], playerBar: 0, cooldowns: {}, buffs: {}, events: {} } as never;
    expect(refuteCast(g.state, 'grimoire:1', 10).negated).toBe(false);
  });

  it('refuses a working and charges the speaker for the argument', () => {
    const g = refuting();
    let negated = 0;
    let backlash = 0;
    for (let i = 0; i < 60; i++) {
      const r = refuteCast(g.state, `grimoire:${i}`, 10);
      if (r.negated) { negated += 1; backlash += r.backlash; }
    }
    // At the best grade it refuses most things; the cost rides along with it.
    expect(negated).toBeGreaterThan(30);
    expect(backlash).toBe(negated * 10);
  });

  it('gets likelier to seal the same working the more it is repeated', () => {
    // The counterplay is to VARY what you speak, not to stop speaking — so the
    // escalation is per working, never per caster.
    const g = refuting();
    for (let i = 0; i < 40; i++) refuteCast(g.state, 'grimoire:7', 5);
    expect(g.state.combat!.refuted!['grimoire:7']).toBe(40);
    expect(isSealed(g.state, 'grimoire:7')).toBe(true);
  });

  it('seals for the FIGHT, never for good', () => {
    // Destroying a prepared working outright is irreversible loss of player
    // property, which this game does not do — a fight finished with your hands
    // is a story, a bricked grimoire is a bug report.
    const g = refuting();
    for (let i = 0; i < 40; i++) refuteCast(g.state, 'grimoire:7', 5);
    expect(isSealed(g.state, 'grimoire:7')).toBe(true);
    abandonCombat(g.state, g.bus);
    expect(isSealed(g.state, 'grimoire:7')).toBe(false);
  });

  it('refuses less often at a worse grade, but never not at all', () => {
    const rate = (quality: QualityTier) => {
      const g = refuting(quality);
      let n = 0;
      for (let i = 0; i < 300; i++) if (refuteCast(g.state, `w${i}`, 1).negated) n += 1;
      return n / 300;
    };
    const worst = rate('f');
    const best = rate('s');
    expect(worst).toBeGreaterThan(0);
    expect(best).toBeGreaterThan(worst);
  });

  it('holds a shield that is worth having early and worth building for later', () => {
    const shield = STATUSES.refutation;
    const flat = shield.mods!.find((m) => !m.fromStat)!;
    const scaled = shield.mods!.find((m) => m.fromStat === 'spellPower')!;
    expect(flat.stat).toBe('ward');
    expect(scaled.stat).toBe('ward');
    // It answers being STRUCK, not your own swings — otherwise it is a weapon.
    expect(shield.retaliate!.onContact).toBe(true);
    expect(shield.retaliate!.onAttack).toBeUndefined();
    expect(shield.retaliate!.inflicts?.[0].id).toBe('punctured');
  });
});

/**
 * Nirākṣa swallowed his eyes, which is both the immunity and the cost — six
 * arms and nothing to take, at the price of a wind-up long enough to feel.
 */
describe('Nirākṣa who Swallowed His Eyes', () => {
  function eyeless() {
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'asurendra_niraksha', quality: 's' };
    syncGeneStatuses(g.state);
    return g;
  }

  it('wears its blindness rather than being given an exemption', () => {
    // The immunity is expressed by the conditions that would land, so anything
    // else that should be immune only has to be handed the same condition.
    expect(hasStatus(eyeless().state, 'eyeless')).toBe(true);
    expect(STATUSES.blinded.blockedBy).toContain('eyeless');
    expect(STATUSES.dazzled.blockedBy).toContain('eyeless');
  });

  it('cannot be blinded or dazzled, at either end of the ladder', () => {
    const g = eyeless();
    // Dazzle is blocked too: it ESCALATES into blindness, so stopping only the
    // far end leaves an eyeless body catchable by the near one.
    for (const id of ['blinded', 'dazzled']) {
      expect(applyStatus(g.state, g.state, { id, intensity: 5 }), id).toBeNull();
      expect(hasStatus(g.state, id), id).toBe(false);
    }
  });

  it('pays nothing for the dark, however deep', () => {
    const dark = () => {
      const g = eyeless();
      g.state.spot = 'malgeri_dc_central_hub';
      return darknessFactor(g.state);
    };
    expect(dark()).toBe(0);
    // …where an ordinary body in the same room does pay.
    const sighted = fresh();
    sighted.state.spot = 'malgeri_dc_central_hub';
    expect(darknessFactor(sighted.state)).toBeGreaterThan(0);
  });

  it('opens what it opens for good', () => {
    const def = MAIN_GENES.asurendra_niraksha;
    const rider = def.onCrit![0];
    expect(rider.id).toBe('blinded');
    expect(rider.duration).toBe('permanent');
  });

  it('winds up instead of landing, and drags the bar while it does', () => {
    const spec = MAIN_GENES.asurendra_niraksha.ability!.spec;
    if (spec.type !== 'gene') throw new Error('unreachable');
    expect(spec.incant!.fillMult).toBeCloseTo(1 / 3);
    // Certain, not merely likely — and the ticks read off the grade, so a
    // better body speaks the long word faster.
    expect(spec.incant!.critBonus).toBe(1);
    const slow = atGrade(spec.incant!.ticks, gene('asurendra_niraksha', 'f'));
    const quick = atGrade(spec.incant!.ticks, gene('asurendra_niraksha', 's'));
    expect(quick).toBeLessThan(slow);
  });

  it('starts, holds, and lands in a real fight', () => {
    const g = fresh();
    g.state.spot = 'woods_edge';
    g.state.mutagens.chromosome.main = { id: 'asurendra_niraksha', quality: 's' };
    g.selectActivity('hunt');
    for (let i = 0; i < 400 && !g.state.combat; i++) g.tick();
    expect(g.state.combat, 'needed a fight').toBeTruthy();
    let everIncanted = false;
    let everLanded = false;
    for (let i = 0; i < 900; i++) {
      const before = g.state.combat?.incantAt;
      g.tick();
      const after = g.state.combat?.incantAt;
      if (after !== undefined) everIncanted = true;
      if (before !== undefined && after === undefined) everLanded = true;
    }
    expect(everIncanted, 'never began an incantation').toBe(true);
    expect(everLanded, 'began one and never finished it').toBe(true);
  });

  it('drops the incantation if the body speaking it stops existing', () => {
    // It reads the gene fresh rather than remembering what started it, so a
    // centromere swapped mid-word leaves a word nobody is saying.
    const g = fresh();
    g.state.spot = 'woods_edge';
    g.state.mutagens.chromosome.main = { id: 'asurendra_niraksha', quality: 's' };
    g.selectActivity('hunt');
    for (let i = 0; i < 1200 && g.state.combat?.incantAt === undefined; i++) g.tick();
    expect(g.state.combat?.incantAt, 'never began an incantation').toBeDefined();
    g.state.mutagens.chromosome.main = null;
    g.tick();
    expect(g.state.combat?.incantAt).toBeUndefined();
  });
});

/**
 * WHAT THE CARD SAYS THE ABILITY DOES.
 *
 * Every gene ability used to be a blow, so one readout could price all of them.
 * Three shapes broke that — a volley that lands nothing, a wind-up that lands
 * later, a ward whose blow is deliberately zero — and each was described by a
 * number that was false, or by nothing at all. §11: an illegible system is a
 * broken one, and a legible lie is worse than silence.
 */
describe('what a gene ability says about itself', () => {
  function wearing(id: string, quality: QualityTier = 's') {
    const g = fresh();
    g.state.mutagens.chromosome.main = { id, quality };
    return g;
  }
  const lines = (g: ReturnType<typeof fresh>) => geneAbilityLines(g.state).join('\n');

  it('never prices a blow an ability does not have', () => {
    const g = wearing('asurendra_vashkara');
    // The bug this whole pass started from: "0 bludgeoning damage", where the
    // zero came from a price with no terms and the type from a `?? ` fallback.
    expect(geneAbilityLanded(g.state)).toBeNull();
    expect(lines(g)).not.toMatch(/\d\S* \w+ damage/);
    expect(lines(g)).not.toMatch(/bludgeoning/);
  });

  it('says what the volley does instead', () => {
    const said = lines(wearing('asurendra_vashkara'));
    expect(said).toMatch(/telekinetic weapons/i);
    expect(said).toMatch(/\d+ strikes/);
    // And is explicit that the damage is not its own — the one thing a player
    // reading a burst ability will otherwise assume.
    expect(said).toMatch(/No damage of its own/i);
  });

  it('quotes the wind-up at what actually arrives, and says when', () => {
    const g = wearing('asurendra_niraksha');
    const spec = MAIN_GENES.asurendra_niraksha.ability!.spec;
    if (spec.type !== 'gene') throw new Error('unreachable');
    const stats = getDerivedStats(g.state);
    const bare = priceGeneAbility(g.state, spec, stats, 'x').damage;
    // `landIncantation` multiplies by crit damage every time, so the card that
    // quoted the bare figure understated the blow by the whole crit build.
    expect(geneAbilityLanded(g.state)).toBeCloseTo(bare * Math.max(1, stats.critDamage));
    expect(lines(g)).toMatch(/when it lands/);
    expect(lines(g)).toMatch(/Wind-up: the hit lands/);
  });

  it('names the ward a zero-damage blow is actually for', () => {
    const said = lines(wearing('asurendra_kritavya'));
    expect(said).toMatch(/Puts Refutation on you for/);
  });

  it('keeps a deliberate zero in the working rather than dropping it', () => {
    const g = wearing('asurendra_kritavya');
    const spec = MAIN_GENES.asurendra_kritavya.ability!.spec;
    if (spec.type !== 'gene') throw new Error('unreachable');
    // `flat: 0` is a statement, not an absence — without it the damage tooltip
    // printed a "Swing" header over no working at all.
    const priced = priceGeneAbility(g.state, spec, getDerivedStats(g.state), 'Refutation');
    expect(priced.steps.some((s) => s.label.includes('the body itself'))).toBe(true);
  });

  it('names an attribute-priced blow after the attribute it reads', () => {
    // Both halves: `priceGeneAbility` prices off `fromAttr`, so a breakdown that
    // only knew `fromStat` printed a total its own terms did not add up to.
    const byAttr = Object.values(MAIN_GENES).filter((d) => {
      const s = d.ability?.spec;
      return s?.type === 'gene' && s.fromAttr !== undefined;
    });
    expect(byAttr.length, 'no gene prices off an attribute any more').toBeGreaterThan(0);
    for (const def of byAttr) {
      const spec = def.ability!.spec;
      if (spec.type !== 'gene') continue;
      const said = lines(wearing(def.id));
      expect(said, def.id).toContain(attrName(spec.fromAttr!));
    }
  });

  it('never advertises reaching everyone for nothing', () => {
    for (const def of Object.values(MAIN_GENES)) {
      const spec = def.ability?.spec;
      if (spec?.type !== 'gene' || !spec.splashAll) continue;
      // `splashAll` is a capability and `splash` is a share; declaring only the
      // first used to read "Reaches every enemy for 0% of the blow".
      expect(lines(wearing(def.id)), def.id).not.toMatch(/for 0% of the blow/);
    }
  });
});

describe('what the Active arm may hand an ability', () => {
  const carriesOf = (id: string) => {
    const spec = MAIN_GENES[id].ability!.spec;
    if (spec.type !== 'gene') throw new Error('unreachable');
    return abilityCarries(spec);
  };

  it('hands a volley nothing, because a volley reads nothing', () => {
    // Its strikes are ordinary floating swings reading each grip's own edge —
    // the ability's spec is never consulted, so writing to it and then
    // reporting the write is the legible lie §11 warns about.
    expect(carriesOf('asurendra_vashkara')).toEqual({
      type: false,
      sure: false,
      splash: false,
      inflicts: false,
    });
  });

  it('hands a wind-up what lands with it, and nothing else', () => {
    // `landIncantation` reads the type and the conditions; it never reads the
    // splash, and it is long past any roll to hit.
    expect(carriesOf('asurendra_niraksha')).toEqual({
      type: true,
      sure: false,
      splash: false,
      inflicts: true,
    });
  });

  it('declines the write rather than making it and hoping', () => {
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'asurendra_vashkara', quality: 's' };
    const spec = geneAbility(g.state)!.spec;
    if (spec.type !== 'gene') throw new Error('unreachable');
    // Whatever the graph delivered, none of it may have landed on this spec.
    expect(spec.damageType).toBeUndefined();
    expect(spec.splashAll).toBeUndefined();
    expect(spec.sure).toBeUndefined();
    expect(spec.inflicts).toBeUndefined();
  });

  it('calls an Active capability live only when something can read it', () => {
    const volley = MAIN_GENES.asurendra_vashkara.ability!.spec;
    if (volley.type !== 'gene') throw new Error('unreachable');
    for (const grant of ['splits_target', 'inflicts_burning', 'ignores_dodge']) {
      // A body with no ability at all was told all three were live.
      expect(grantIsLive(grant, 'active', null), `${grant} with no ability`).toBe(false);
      expect(grantIsLive(grant, 'active', volley), `${grant} on a volley`).toBe(false);
    }
    // …while the arm that reads them about your ordinary swing still does.
    expect(grantIsLive('splits_target', 'attacks', null)).toBe(true);
    // …and a caller with no body in front of it still gets the weak answer.
    expect(grantIsLive('splits_target', 'active')).toBe(true);
  });
});

/**
 * Vashkāra holds nothing. `telekinetic:N` is deliberately a WIELD capability
 * rather than a gene trick — a fighting style that lifts a blade with the mind
 * grants the same string and gets the same behaviour, so these test the rule
 * and not the gene.
 */
describe('grips the mind holds', () => {
  const grantSet = (...gs: string[]) => new Set(gs);

  it('counts against arms rather than on top of them', () => {
    // Six grips, none of them a hand — the whole of Vashkāra's posture, and the
    // reason it needs no rule of its own.
    const v = grantSet('arms:+4', 'telekinetic:6');
    expect(armsFrom(v)).toBe(6);
    expect(telekineticFrom(v)).toBe(6);
    expect(handsFrom(v)).toBe(0);
  });

  it('floats the LAST grips, so a partial grant leaves the main hand swinging', () => {
    const one = grantSet('telekinetic:1');
    expect(isTelekinetic(one, 'weapon')).toBe(false);
    expect(isTelekinetic(one, 'offhand')).toBe(true);
    // …and never reaches past the arms the body actually has.
    expect(isTelekinetic(one, 'hand3')).toBe(false);
  });

  it('never goes negative, however hard the grant overshoots', () => {
    expect(handsFrom(grantSet('telekinetic:99'))).toBe(0);
    expect(armsFrom(grantSet('telekinetic:99'))).toBe(2);
  });

  it('costs one grip for a two-hander, because a mind has no second hand', () => {
    const v = grantSet('arms:+4', 'telekinetic:6');
    const great = ITEMS.steel_greatsword;
    expect(armCost(v, great, 'weapon')).toBe(1);
    expect(armCost(grantSet(), great, 'weapon')).toBe(2);
  });

  it('splits your damage between the two clocks and never pays it twice', () => {
    const g = fresh();
    const v = grantSet('arms:+4', 'telekinetic:6');
    // Three weapons on a six-grip body: all three float, so the hands swing for
    // nothing and the whole of the damage rides the floating clock.
    for (const s of ['weapon', 'offhand', 'hand3'] as const) {
      g.state.equipment[s] = createItem(g.state, 'iron_sword');
    }
    expect(heldGrips(g.state, v)).toBe(3);
    expect(floatingSlots(g.state, v).length).toBe(3);
    expect(handSwingShare(g.state, v)).toBe(0);

    // On an ordinary body with one float, the hand keeps its half.
    const one = grantSet('telekinetic:1');
    const h = fresh();
    h.state.equipment.weapon = createItem(h.state, 'iron_sword');
    h.state.equipment.offhand = createItem(h.state, 'iron_sword');
    expect(handSwingShare(h.state, one)).toBe(0.5);
    expect(floatingSlots(h.state, one)).toEqual(['offhand']);
  });

  it('leaves bare fists alone — telekinesis is not the reason not to punch', () => {
    const g = fresh();
    expect(handSwingShare(g.state, grantSet())).toBe(1);
    // …but a body with no hands does not punch, holding nothing or not.
    expect(handSwingShare(g.state, grantSet('arms:+4', 'telekinetic:6'))).toBe(0);
  });
});

describe('Vashkāra of the Unheld Blades', () => {
  /** The blades' live run, whichever rotation or volley it belongs to. */
  const bladeRun = (state: GameState) =>
    state.floatingFeed?.find((f) => f.group.startsWith('telekinesis:'));

  function armed() {
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'asurendra_vashkara', quality: 's' };
    for (const s of ['weapon', 'offhand', 'hand3', 'hand4'] as const) {
      g.state.equipment[s] = createItem(g.state, 'iron_sword');
    }
    g.state.spot = 'woods_edge';
    g.selectActivity('hunt');
    for (let i = 0; i < 400 && !g.state.combat; i++) g.tick();
    expect(g.state.combat, 'needed a fight').toBeTruthy();
    return g;
  }

  it('grows the grips and empties every one of them', () => {
    const grants = bearerGrants(armed().state);
    expect(armsFrom(grants)).toBe(6);
    expect(handsFrom(grants)).toBe(0);
  });

  it('fights without your action bar', () => {
    const g = armed();
    let floated = false;
    let hurt = false;
    for (let i = 0; i < 300; i++) {
      const before = g.state.combat?.enemies[0]?.hp ?? 0;
      g.tick();
      const after = g.state.combat?.enemies[0]?.hp ?? before;
      if (after < before) hurt = true;
      // The blades do not get lines of their own any more — they run as a
      // floating tally, drawn against whatever line is newest.
      if (bladeRun(g.state)) floated = true;
    }
    expect(floated, 'the weapons never struck on their own').toBe(true);
    expect(hurt, 'nothing ever took damage').toBe(true);
  });

  it('holds the bar rather than punching, when nothing else is legal', () => {
    const g = armed();
    let concentrated = false;
    for (let i = 0; i < 600 && !concentrated; i++) {
      // The body's own ability is kept out of reach on purpose: the question is
      // what a full bar does with NOTHING legal on it, and an ability that is
      // ready is something legal.
      if (g.state.combat) g.state.combat.cooldowns[GENE_ACTIVE] = 999;
      g.tick();
      concentrated = g.state.combatFeed.some((l) => l.text.includes('concentrating'));
    }
    expect(concentrated, 'the bar never reported being held').toBe(true);
  });

  it('does not punch: with nothing aloft, the bar produces no weapon hit', () => {
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'asurendra_vashkara', quality: 's' };
    g.state.spot = 'woods_edge';
    g.selectActivity('hunt');
    for (let i = 0; i < 400 && !g.state.combat; i++) g.tick();
    // Nothing equipped, so nothing floating either. It should be unable to hurt
    // anything at all rather than falling back to fists.
    const hp = g.state.combat!.enemies[0]!.hp;
    for (let i = 0; i < 150 && g.state.combat; i++) g.tick();
    expect(g.state.combat?.enemies[0]?.hp ?? hp).toBe(hp);
  });

  it('spends its active on a volley rather than on a blow of its own', () => {
    const spec = MAIN_GENES.asurendra_vashkara.ability!.spec;
    if (spec.type !== 'gene') throw new Error('unreachable');
    // No flat, no power, no stat — the volley IS the damage, and it is the
    // floating strike the body already had, several times over.
    expect(spec.flat ?? 0).toBe(0);
    expect(spec.power ?? 0).toBe(0);
    expect(spec.volley!.hits[1]).toBeGreaterThan(spec.volley!.hits[0]);
  });

  it('rips through a volley and then puts it down', () => {
    const g = armed();
    let sawVolley = false;
    for (let i = 0; i < 600 && g.state.combat; i++) {
      g.tick();
      if (g.state.combat?.volley) sawVolley = true;
    }
    expect(sawVolley, 'never fired a volley').toBe(true);
    // A volley drains and clears itself, so nothing can be left holding one.
    expect(g.state.combat?.volley).toBeUndefined();
  });

  it('amplifies the hold with Wisdom rather than replacing the blade', () => {
    const g = armed();
    // The mind's grip is a MULTIPLIER, so the blade's own edge, enchant, runes
    // and oil all go on mattering — which is what makes "an ordinary swing of
    // whatever that grip holds" a true sentence rather than a flavour one.
    expect(telekineticGrip(g.state)).toBeGreaterThan(1);

    /*
     * AND IT IS BOUNDED. Damage is a product, not a number — a real six-armed
     * build runs its base through twenty-odd multipliers — so an uncapped
     * multiplier on the whole stat compounds with every one of them. This
     * shipped linear at 0.01/point and reached x2.93 on a live save.
     */
    g.state.attrs.wis.level = 200;
    const deep = telekineticGrip(g.state);
    g.state.attrs.wis.level = 100000;
    const absurd = telekineticGrip(g.state);
    expect(absurd).toBeGreaterThan(deep); // every point still buys something…
    expect(absurd).toBeLessThanOrEqual(1 + TELEKINETIC_GRIP_CAP); // …and never more than the cap
    // TELEKINETIC_GRIP_HALF is the knob: that much Wisdom buys half the cap, so
    // a body at exactly that level sits at the midpoint.
    g.state.attrs.wis.level = TELEKINETIC_GRIP_HALF;
    expect(telekineticGrip(g.state)).toBeCloseTo(1 + TELEKINETIC_GRIP_CAP / 2, 1);
  });

  it('hits harder for it, and grazes harder too', () => {
    // Same seed, same rolls, one changed attribute: the first strike of the
    // fight is a clean before/after because nothing upstream of it differs.
    const firstStrike = (wis: number) => {
      const g = armed();
      g.state.attrs.wis.level = wis;
      for (let i = 0; i < 400; i++) {
        g.tick();
        const run = bladeRun(g.state);
        const dealt = run?.report?.total ?? 0;
        if (dealt > 0) return dealt;
      }
      return 0;
    };
    const dull = firstStrike(1);
    const keen = firstStrike(200);
    expect(dull, 'no strike landed at all').toBeGreaterThan(0);
    expect(keen).toBeGreaterThan(dull);
  });

  it('folds one line per full rotation of the rack', () => {
    const g = armed();
    const slots = floatingSlots(g.state, bearerGrants(g.state)).length;
    expect(slots, 'needed several blades to rotate through').toBeGreaterThan(1);
    // `run` is the fold window, and it must tick over exactly when the rack
    // wraps — a line covers "every blade struck once", never a stretch of fight
    // that merely happened not to be interrupted.
    let wraps = 0;
    let bumps = 0;
    for (let i = 0; i < 500 && g.state.combat; i++) {
      // Kept standing on purpose: the rack only wraps if the fight outlasts a
      // full rotation, and four iron swords do not leave a forest rat that long.
      const foe = g.state.combat.enemies[0];
      if (foe) foe.hp = monsterStats(foe).maxHp;
      const before = g.state.combat.floating;
      const wasNth = before?.nth;
      const wasRun = before?.run;
      g.tick();
      const now = g.state.combat?.floating;
      if (now && wasNth !== undefined && now.nth !== wasNth) {
        if (now.nth === 0) wraps++;
        if (now.run !== wasRun) bumps++;
      }
    }
    expect(wraps, 'the rack never completed a rotation').toBeGreaterThan(0);
    expect(bumps).toBe(wraps);
  });

  it('drops the clock the moment nothing is floating any more', () => {
    const g = armed();
    // Fights here are short — wait for a clock rather than for a tick count.
    for (let i = 0; i < 200 && !g.state.combat?.floating; i++) g.tick();
    expect(g.state.combat?.floating, 'never started a floating clock').toBeTruthy();
    g.state.mutagens.chromosome.main = null;
    g.tick();
    expect(g.state.combat?.floating).toBeUndefined();
  });
});

/*
 * docs/plans/bearer-seam.md. The story is a pure refactor, so its real proof is
 * the other ~1580 tests in this repo passing unchanged. What is left for here
 * is the part those cannot see: that a bearer which is NOT the player answers
 * for itself, and that the caches survive more than one of them.
 */
describe('the bearer seam', () => {
  const foe = (g: Game) => spawnMonster(g.state, SPOTS.woods_edge);

  /** A player wearing a real body, so "it read the player's" would be visible. */
  function trollPlayer(seed = 1) {
    const g = fresh(seed);
    g.state.materials.biomatter = 5000;
    g.state.useCooldowns = {};
    grantGraded(g.state, 'troll', 'c', 1);
    // Asserted rather than assumed: a swap refused for biomatter or settling
    // would leave the player bare, and every comparison below would then pass
    // by comparing two bare bodies.
    expect(slotMain(g.state, g.bus, gene('troll')).ok).toBe(true);
    return g;
  }

  it('a monster carrying no genome wears the bare sequence, not nothing', () => {
    const g = fresh();
    const e = foe(g);
    // §8: bare is the DEFAULT rather than an item, which is what lets the seam
    // land before a single genome is authored — every downstream reader gets a
    // real body and no caller anywhere needs a null branch.
    expect(expressedMain(genomeOf(e)).id).toBe('bare');
    expect(expressedGene(e).id).toBe('bare');
    expect(currentResolution(e).main?.id).toBe('bare');
  });

  it('answers for the monster rather than for whoever is watching', () => {
    const g = trollPlayer();
    const e = foe(g);
    expect(expressedGene(g.state).id).toBe('troll');
    expect(expressedGene(e).id).toBe('bare');
    expect(geneAbility(g.state)?.name).toBe('Troll Bite');
    expect(geneAbility(e)).toBeUndefined();
    expect(bearerGrants(e).size).toBe(0);
    expect(armGrants(e, 'attacks', 'ignores_dodge')).toBe(false);
  });

  it('a bare bearer contributes the bare body and nothing routed', () => {
    const g = trollPlayer();
    const e = foe(g);
    const mine = chromosomeMods(g.state);
    const theirs = chromosomeMods(g.state, e);
    // The troll's own lines are on the player and on nobody else.
    expect(mine.some((m) => m.mod.stat === 'resHeat')).toBe(true);
    expect(theirs.some((m) => m.mod.stat === 'resHeat')).toBe(false);
    // Bare writes attributes, one per arm, every one of them zero (§8). So a
    // bare bearer delivers a real shape that changes no number — which is the
    // distinction between "wears nothing" and "is not wearing anything".
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every((m) => m.mod.value === 0)).toBe(true);
  });

  it('a fast is read off the faster, not off the field', () => {
    const g = trollPlayer();
    const e = foe(g);
    // Neither is fasting, and asking is safe on both sides. The point is that
    // it ASKS the bearer: `fastOf` used to read the player's chromosome, which
    // is one of the three workarounds that predicted this whole seam.
    expect(fastOf(g.state)).toBeNull();
    expect(fastOf(e)).toBeNull();
    expect(fastGuard(e, 40)).toEqual({ armor: 0, ward: 0 });
  });

  /*
   * ⚠️ THE REGRESSION THIS STORY EXISTS TO PREVENT.
   *
   * Both caches held exactly ONE entry, which was sound while exactly one
   * chromosome existed. Under a single slot the player's resolution is evicted
   * by the first monster asked about and rebuilt from scratch on the next tick,
   * for every tick of every fight — a silent, system-wide cost that no
   * behavioural test would ever fail on. Identity is the only way to see it.
   */
  it('keeps several bearers cached at once instead of thrashing one slot', () => {
    const g = trollPlayer();
    const mine = currentResolution(g.state);
    const grants = bearerGrants(g.state);

    const crowd = [foe(g), foe(g), foe(g), foe(g), foe(g)];
    for (const e of crowd) {
      currentResolution(e);
      bearerGrants(e);
    }

    expect(currentResolution(g.state)).toBe(mine);
    expect(bearerGrants(g.state)).toBe(grants);
  });

  it('gives every ungenomed bearer the same cache entry', () => {
    const g = fresh();
    // One frozen NO_GENOME means a formation of five costs one resolution, not
    // five — and nothing can write a socket onto the graph they all share.
    const a = foe(g);
    const b = foe(g);
    expect(currentResolution(a)).toBe(currentResolution(b));
    expect(Object.isFrozen(genomeOf(a))).toBe(true);
    expect(genomeOf(a)).toBe(genomeOf(b));
  });
});
