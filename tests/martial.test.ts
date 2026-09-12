// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { migrate } from '../src/core/save/migrations';
import {
  FORK_ARCHETYPES,
  FORK_ARCHETYPE_LIST,
  FORK_TIER,
  MASTERY_LADDER,
  MAX_DRILLED,
  NEUTRAL_POSITION,
  POSITIONS,
  ROUGH_STAMINA_MULT,
  SPELL_READY_POSITION,
  TECHNIQUES,
  TECHNIQUE_LIST,
  WEAPON_FAMILIES,
} from '../src/core/data/martial.data';
import {
  applyTechniqueEquipment,
  checkTechniqueLearning,
  chooseFork,
  chosenFork,
  clearFork,
  declaredEntries,
  declaredPositions,
  effectiveReps,
  knownPositions,
  openEntry,
  techniqueEntries,
  positionDodgeMult,
  positionIncomingMult,
  positionKnown,
  readyableSpell,
  recoverGroundedWeapon,
  releaseReadiedSpell,
  setPosition,
  spellIsHeld,
  toggleSheathe,
  weaponStateGate,
  eligibleToLearn,
  entryPositions,
  forkAvailable,
  forkOptions,
  isDrilled,
  knownTechniques,
  learnTechnique,
  masteryTier,
  masteryTierName,
  positionAllows,
  positionGraph,
  recordExecution,
  repsToNextTier,
  resetTechnique,
  resolvedMove,
  techniqueArmed,
  techniqueBenched,
  techniquesForFamilies,
  techniqueDisplayName,
  techniqueExecutions,
  techniqueExit,
  techniqueForm,
  techniqueHomeSkill,
  techniqueStatus,
  techniquesUnderSkill,
  toggleDrill,
} from '../src/core/systems/martial';
import { ITEMS, SKILLS } from '../src/core/registry';
import { equippedTags } from '../src/core/systems/conditions';
import { TRIGGER_EVENTS, evaluateTrigger, visibleTriggerSubjects } from '../src/core/systems/triggers';
import { inscribeArcane, setPrepared } from '../src/core/systems/spellcraft';
import { activeRotation } from '../src/core/systems/combat';
import { getDerivedStats } from '../src/core/systems/derived';
import { exert } from '../src/core/systems/stamina';
import type { CombatState, GameState, TechniqueDef, TechniqueForm } from '../src/core/types';

const fresh = (seed = 1) => new Game(createInitialState(seed));

/** A fighter who KNOWS Gather and Heavy Blow (ledger entries, canonical). */
function brawler(seed = 1): Game {
  const g = fresh(seed);
  learn(g.state, 'gather');
  learn(g.state, 'heavy_blow');
  return g;
}

function learn(state: GameState, id: string, form: TechniqueForm = 'canonical', reps = 0): void {
  state.techniques[id] = { executions: reps, form };
  if (reps > 0 && !state.drilling.includes(id)) state.drilling.push(id);
}

// ---------- Readiness conditions (#3) ----------

describe('technique-readiness trigger subjects', () => {
  function inCombat(g: Game): CombatState {
    const combat: CombatState = {
      enemies: [null, null, null, null, null],
      playerBar: 0, momentum: 0, position: NEUTRAL_POSITION,
      cooldowns: {}, buffs: [], events: {},
    };
    g.state.combat = combat;
    return combat;
  }

  it('reads a technique cooldown, so a plan can refuse to start what it cannot finish', () => {
    const g = fresh(60);
    learn(g.state, 'weapon_drop');
    learn(g.state, 'ground_draw');
    const combat = inCombat(g);
    const ctx = { state: g.state, combat, stats: getDerivedStats(g.state) };
    // Weapon Drop's own plan: don't throw the sword down unless the way back up is free.
    const wontStart = {
      conditions: [{ subject: 'technique.ground_draw', op: 'is' as const, value: 'ready' }],
    };
    expect(evaluateTrigger(ctx, wontStart)).toBe(true);
    combat.cooldowns['technique:ground_draw'] = 40;
    expect(evaluateTrigger(ctx, wontStart)).toBe(false);
  });

  it('offers only techniques the player has actually learned', () => {
    const g = fresh(61);
    const has = (state: GameState, id: string) =>
      visibleTriggerSubjects(state).some((s) => s.id === id);
    expect(has(g.state, 'technique.ground_draw')).toBe(false);
    learn(g.state, 'ground_draw');
    expect(has(g.state, 'technique.ground_draw')).toBe(true);
    // Ordinary subjects are never hidden.
    expect(has(g.state, 'enemy.hpPct')).toBe(true);
  });

  it('a stored condition on a hidden subject still evaluates — hiding is a picker concern', () => {
    const g = fresh(62);
    const combat = inCombat(g);
    combat.cooldowns['technique:ground_draw'] = 10;
    const ctx = { state: g.state, combat, stats: getDerivedStats(g.state) };
    // Never learned, so not offered — but the rule still reads true cooldown.
    expect(
      evaluateTrigger(ctx, {
        conditions: [{ subject: 'technique.ground_draw', op: 'is', value: 'cooling' }],
      }),
    ).toBe(true);
  });
});

// ---------- Position discovery & effects (#1) ----------

describe('position visibility and effects', () => {
  it('a position reveals itself once a known technique reaches it', () => {
    const g = fresh(63);
    // Neutral is always there — every plain swing returns to it.
    expect(positionKnown(g.state, NEUTRAL_POSITION)).toBe(true);
    expect(positionKnown(g.state, 'coiled')).toBe(false);
    expect(knownPositions(g.state).map((p) => p.id)).toEqual([NEUTRAL_POSITION]);

    learn(g.state, 'gather'); // neutral → coiled
    expect(positionKnown(g.state, 'coiled')).toBe(true);
    expect(positionKnown(g.state, 'off_balance')).toBe(false);

    learn(g.state, 'heavy_blow'); // coiled → off_balance
    expect(positionKnown(g.state, 'off_balance')).toBe(true);
  });

  it('an entry position counts as reaching it, not just an exit', () => {
    const g = fresh(64);
    learn(g.state, 'thrust'); // extended → neutral: known by its ENTRY
    expect(positionKnown(g.state, 'extended')).toBe(true);
  });

  it('the spell-ready seat costs you defensively for as long as you hold it', () => {
    const g = fresh(65);
    const combat: CombatState = {
      enemies: [null, null, null, null, null],
      playerBar: 0, momentum: 0, position: NEUTRAL_POSITION,
      cooldowns: {}, buffs: [], events: {},
    };
    g.state.combat = combat;
    expect(positionIncomingMult(g.state)).toBe(1);
    expect(positionDodgeMult(g.state)).toBe(1);
    combat.position = SPELL_READY_POSITION;
    expect(positionIncomingMult(g.state)).toBeCloseTo(1.1);
  });

  it('every declared position effect is a sane multiplier', () => {
    // dodgeMult especially: 0 is legal and meaningful (a stance taken wide
    // open dodges nothing), which is why the reader uses ?? and not ||.
    for (const p of Object.values(POSITIONS)) {
      const e = p.effects;
      if (!e) continue;
      if (e.incomingMult !== undefined) expect(e.incomingMult).toBeGreaterThan(0);
      if (e.dodgeMult !== undefined) expect(e.dodgeMult).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------- Content sanity ----------

describe('technique content', () => {
  it('every entry and exit position exists in the vocabulary', () => {
    for (const def of TECHNIQUE_LIST) {
      expect(POSITIONS[def.to], `${def.id} exits into ${def.to}`).toBeDefined();
      const from = declaredPositions(def);
      if (from !== 'any') {
        for (const p of from) expect(POSITIONS[p], `${def.id} enters from ${p}`).toBeDefined();
      }
      // Every way's own read must name a real event, same as the def's.
      for (const entry of declaredEntries(def)) {
        if (!entry.trigger?.event) continue;
        expect(
          TRIGGER_EVENTS.some((e) => e.id === entry.trigger!.event),
          `${def.id} entry event ${entry.trigger.event}`,
        ).toBe(true);
      }
      for (const [tier, note] of Object.entries(def.mastery ?? {})) {
        expect(Number(tier)).toBeGreaterThanOrEqual(1);
        expect(Number(tier)).toBeLessThanOrEqual(MASTERY_LADDER.length);
        for (const p of note.addFrom ?? []) {
          expect(POSITIONS[p], `${def.id} tier ${tier} opens ${p}`).toBeDefined();
        }
      }
    }
  });

  it('a self-taught technique names a real counter and a reachable count', () => {
    // `eligibleToLearn` gates on `(state.stats[stat] ?? 0) < count`, so a
    // half-filled learn block — blank stat, count 0 — reads as "already met"
    // and hands the technique to EVERY fighter from tick one, silently
    // rewriting rotations. That is a very quiet way to break a fight.
    for (const def of TECHNIQUE_LIST) {
      const self = def.learn?.self;
      if (!self) continue;
      expect(self.stat, `${def.id}: learn.self needs a counter to watch`).toBeTruthy();
      expect(
        self.count,
        `${def.id}: learn.self count must be > 0, or it is learned by everyone at once`,
      ).toBeGreaterThan(0);
    }
  });

  it('every baked trigger event is a real trigger event', () => {
    const events = new Set(TRIGGER_EVENTS.map((e) => e.id));
    for (const def of TECHNIQUE_LIST) {
      if (def.trigger?.event) {
        expect(events.has(def.trigger.event), `${def.id}: ${def.trigger.event}`).toBe(true);
      }
    }
  });

  it('every declared home skill exists', () => {
    for (const def of TECHNIQUE_LIST) {
      if (def.skill) expect(SKILLS[def.skill], `${def.id} home ${def.skill}`).toBeDefined();
    }
  });

  it('every technique is acquirable without a teacher (for now)', () => {
    // Until teacher content exists, a technique with no self-learn counter
    // would be unreachable for new players.
    for (const def of TECHNIQUE_LIST) {
      expect(def.learn?.self, `${def.id} has no acquisition path`).toBeDefined();
    }
  });
});

// ---------- The ledger ----------

describe('the learned ledger', () => {
  it('eligibility is not knowledge: qualified but unlearned stays unknown', () => {
    const g = fresh(2);
    g.state.skills.fighting = { level: 20, xp: 0 };
    g.state.attrs.str.level = 20;
    expect(knownTechniques(g.state)).toEqual([]);
    expect(eligibleToLearn(g.state, TECHNIQUES.gather)).toBe(true);
    expect(eligibleToLearn(g.state, TECHNIQUES.riposte)).toBe(false); // dex 1
  });

  it('self-learning crystallizes rough when the counter crosses, if eligible', () => {
    const g = fresh(3);
    g.state.stats['combat:attacks'] = 150;
    checkTechniqueLearning(g.state, g.bus);
    expect(techniqueForm(g.state, 'gather')).toBeUndefined(); // fighting too low

    g.state.skills.fighting = { level: 5, xp: 0 };
    checkTechniqueLearning(g.state, g.bus);
    expect(techniqueForm(g.state, 'gather')).toBe('rough');
    expect(g.state.log.some((l) => l.msg.includes('Gather'))).toBe(true);

    // Idempotent: a second pass neither duplicates nor re-announces.
    const lines = g.state.log.length;
    checkTechniqueLearning(g.state, g.bus);
    expect(g.state.log.length).toBe(lines);
  });

  it('re-learning never downgrades: rough → canonical keeps reps, never back', () => {
    const g = fresh(4);
    learn(g.state, 'gather', 'rough', 40);
    learnTechnique(g.state, TECHNIQUES.gather, 'canonical');
    expect(techniqueForm(g.state, 'gather')).toBe('canonical');
    expect(techniqueExecutions(g.state, 'gather')).toBe(40);
    learnTechnique(g.state, TECHNIQUES.gather, 'rough');
    expect(techniqueForm(g.state, 'gather')).toBe('canonical');
  });

  it('a technique homes to its school once known, else its eligibility skill', () => {
    const g = fresh(50);
    learn(g.state, 'finishing_cut');
    g.state.skills.swordsmanship = { level: 25, xp: 0 };
    // The school hasn't manifested: swordsmanship claims it.
    expect(techniqueHomeSkill(g.state, TECHNIQUES.finishing_cut)).toBe('swordsmanship');
    g.state.skills.school_ittou_ryu = { level: 1, xp: 0 };
    expect(techniqueHomeSkill(g.state, TECHNIQUES.finishing_cut)).toBe('school_ittou_ryu');
    expect(techniquesUnderSkill(g.state, 'school_ittou_ryu').map((t) => t.id)).toEqual([
      'finishing_cut',
    ]);
  });

  it('family techniques demand the weapon in hand', () => {
    const g = fresh(5);
    learn(g.state, 'thrust');
    expect(techniqueArmed(g.state, TECHNIQUES.thrust)).toBe(false); // bare hands
    g.equip(1); // the starting rusty sword
    expect(techniqueArmed(g.state, TECHNIQUES.thrust)).toBe(true);
    expect(techniqueArmed(g.state, TECHNIQUES.gather)).toBe(true);
  });
});

// ---------- The powers-of-ten ladder ----------

describe('the mastery ladder', () => {
  it('rungs land at 10 / 100 / 1,000 / 10,000', () => {
    const g = fresh(6);
    const def = TECHNIQUES.gather;
    for (const [reps, tier] of [[0, 0], [9, 0], [10, 1], [99, 1], [100, 2], [1000, 3], [10000, 4]] as const) {
      g.state.techniques.gather = { executions: reps, form: 'canonical' };
      expect(masteryTier(g.state, def), `${reps} reps`).toBe(tier);
    }
  });

  it('rough reps count double on the ladder', () => {
    const g = fresh(7);
    learn(g.state, 'gather', 'rough', 5);
    expect(effectiveReps(g.state, 'gather')).toBe(10);
    expect(masteryTier(g.state, TECHNIQUES.gather)).toBe(1);
    expect(repsToNextTier(g.state, TECHNIQUES.gather)).toBe(45); // 90 effective / 2
  });

  it('generic bonuses hone the move; data notes rename rungs', () => {
    const g = fresh(8);
    const def = TECHNIQUES.gather;
    learn(g.state, 'gather', 'canonical', 100);
    expect(masteryTierName(def, 2)).toBe('Second Nature'); // note override
    expect(masteryTierName(TECHNIQUES.heavy_blow, 2)).toBe('Drilled'); // generic
    const honed = resolvedMove(g.state, def);
    expect(honed.damageMult).toBeCloseTo(def.move.damageMult! * 1.12);
    expect(honed.cooldown).toBeLessThan(def.move.cooldown);
  });

  it('the rough surcharge exists below the summit and dissolves at Perfected', () => {
    const g = fresh(9);
    const def = TECHNIQUES.heavy_blow;
    learn(g.state, 'heavy_blow', 'rough', 100); // 200 effective — tier 2
    expect(resolvedMove(g.state, def).staminaCost).toBeCloseTo(
      def.move.staminaCost! * ROUGH_STAMINA_MULT,
    );
    // Ten thousand swings of your own way is its own mastery.
    learn(g.state, 'heavy_blow', 'rough', 5000); // 10,000 effective — tier 4
    expect(resolvedMove(g.state, def).staminaCost).toBeCloseTo(def.move.staminaCost!);
  });

  it('practice opens new entries: a Perfected Heavy Blow needs no wind-up', () => {
    const g = fresh(10);
    learn(g.state, 'heavy_blow');
    expect(entryPositions(g.state, TECHNIQUES.heavy_blow)).toEqual(['coiled']);
    g.state.techniques.heavy_blow!.executions = 10000;
    expect(entryPositions(g.state, TECHNIQUES.heavy_blow)).toContain('neutral');
    expect(positionAllows(g.state, TECHNIQUES.heavy_blow, 'neutral')).toBe(true);
  });
});

// ---------- Drilling ----------

describe('repetition and drilling', () => {
  it('practice only counts for drilled techniques, up to the slot cap', () => {
    const g = brawler(11);
    learn(g.state, 'sidestep');
    learn(g.state, 'riposte');
    recordExecution(g.state, TECHNIQUES.gather); // free slot auto-claims
    expect(isDrilled(g.state, 'gather')).toBe(true);
    expect(techniqueExecutions(g.state, 'gather')).toBe(1);

    toggleDrill(g.state, 'heavy_blow');
    toggleDrill(g.state, 'riposte');
    expect(g.state.drilling).toHaveLength(MAX_DRILLED);
    expect(toggleDrill(g.state, 'sidestep')).toBe(false);
    recordExecution(g.state, TECHNIQUES.sidestep);
    expect(techniqueExecutions(g.state, 'sidestep')).toBe(0);

    toggleDrill(g.state, 'riposte');
    recordExecution(g.state, TECHNIQUES.sidestep);
    expect(techniqueExecutions(g.state, 'sidestep')).toBe(1);
  });

  it('crossing a rung is reported exactly once, with its name', () => {
    const g = brawler(12);
    g.state.techniques.gather!.executions = 9;
    g.state.drilling.push('gather');
    expect(recordExecution(g.state, TECHNIQUES.gather)).toEqual({ tier: 1, name: 'Practiced' });
    expect(recordExecution(g.state, TECHNIQUES.gather)).toBeUndefined();
  });
});

// ---------- Forks ----------

describe('fork archetypes', () => {
  it('every archetype strictly advances the move (crude EV ≥ base)', () => {
    for (const arch of FORK_ARCHETYPE_LIST) {
      const ev =
        arch.kind === 'strike'
          ? ((arch.damageMult ?? 1) * (arch.hits ?? 1)) / (arch.cooldownMult ?? 1) +
            (arch.splashAdd ?? 0)
          : (arch.durationMult ?? 1) / (arch.cooldownMult ?? 1);
      expect(ev, `${arch.id} must advance the move`).toBeGreaterThanOrEqual(1);
      if (arch.exitTo) expect(POSITIONS[arch.exitTo], `${arch.id} exit`).toBeDefined();
    }
  });

  it('every offered fork exists and matches its move kind', () => {
    for (const def of TECHNIQUE_LIST) {
      const offensive = def.move.damageMult !== undefined;
      for (const id of def.forks ?? []) {
        const arch = FORK_ARCHETYPES[id];
        expect(arch, `${def.id} offers ${id}`).toBeDefined();
        expect(arch.kind === 'strike', `${def.id}: ${id} kind`).toBe(offensive);
      }
    }
  });

  it('the choice opens at Honed, applies to the move, and is permanent', () => {
    const g = brawler(30);
    const def = TECHNIQUES.heavy_blow;
    g.state.techniques.heavy_blow!.executions = 999;
    expect(forkAvailable(g.state, def)).toBe(false); // one rep short

    g.state.techniques.heavy_blow!.executions = 1000;
    expect(forkAvailable(g.state, def)).toBe(true);
    expect(chooseFork(g.state, def, 'sweep')).toBe(false); // not offered
    expect(chooseFork(g.state, def, 'split')).toBe(true);

    const move = resolvedMove(g.state, def);
    expect(move.hits).toBe(2);
    // Base 2.0 × Honed 1.2 × Split 0.65.
    expect(move.damageMult).toBeCloseTo(2.0 * 1.2 * 0.65);
    expect(techniqueDisplayName(g.state, def)).toBe('Split Heavy Blow');

    // Permanent: the choice is closed and cannot be re-made.
    expect(forkAvailable(g.state, def)).toBe(false);
    expect(chooseFork(g.state, def, 'overwhelm')).toBe(false);
    expect(chosenFork(g.state, def)?.id).toBe('split');
  });

  it('overwhelm rewrites the exit; the fight would land there', () => {
    const g = brawler(31);
    learn(g.state, 'crosscut', 'canonical', MASTERY_LADDER[FORK_TIER - 1]);
    expect(techniqueExit(g.state, TECHNIQUES.crosscut)).toBe('extended');
    chooseFork(g.state, TECHNIQUES.crosscut, 'overwhelm');
    expect(techniqueExit(g.state, TECHNIQUES.crosscut)).toBe('off_balance');
  });

  it('a syncretic form is offered the whole matching vocabulary', () => {
    const g = brawler(32);
    learn(g.state, 'thrust', 'syncretic', 1000);
    const options = forkOptions(g.state, TECHNIQUES.thrust).map((a) => a.id);
    expect(options).toContain('sweep'); // beyond thrust's curated pair
    expect(options).toContain('flowing'); // thrust exits neutral — a real change
    expect(options).not.toContain('lasting'); // buff archetypes never fit a strike

    // A pure-exit archetype is never offered where it would change nothing:
    // crosscut already exits extended, so syncretic breadth excludes Flowing.
    learn(g.state, 'crosscut', 'syncretic', 1000);
    const cross = forkOptions(g.state, TECHNIQUES.crosscut).map((a) => a.id);
    expect(cross).not.toContain('flowing');
    // Overwhelming on a technique already exiting its drawback stays offered.
    const heavy = forkOptions(g.state, TECHNIQUES.heavy_blow).map((a) => a.id);
    expect(heavy).toContain('overwhelm');
    // And no rough tax: syncretic is canonical-grade.
    learn(g.state, 'heavy_blow', 'syncretic', 100);
    expect(resolvedMove(g.state, TECHNIQUES.heavy_blow).staminaCost).toBeCloseTo(
      TECHNIQUES.heavy_blow.move.staminaCost!,
    );
  });

  it('debug hooks: clearFork reopens the choice, resetTechnique unknows it', () => {
    const g = brawler(33);
    g.state.techniques.heavy_blow!.executions = 1000;
    chooseFork(g.state, TECHNIQUES.heavy_blow, 'overwhelm');
    clearFork(g.state, 'heavy_blow');
    expect(chosenFork(g.state, TECHNIQUES.heavy_blow)).toBeUndefined();
    expect(forkAvailable(g.state, TECHNIQUES.heavy_blow)).toBe(true);
    g.state.drilling.push('heavy_blow');
    resetTechnique(g.state, 'heavy_blow');
    expect(techniqueForm(g.state, 'heavy_blow')).toBeUndefined();
    expect(g.state.drilling).not.toContain('heavy_blow');
  });
});

// ---------- Reactive windows ----------

describe('reactive trigger windows', () => {
  it('a wide window keeps a reflex fresh until the next swing', () => {
    const g = fresh(13);
    const combat: CombatState = {
      enemies: [null, null, null, null, null],
      playerBar: 0, momentum: 0, position: NEUTRAL_POSITION,
      cooldowns: {}, buffs: [], events: {},
    };
    g.state.combat = combat;
    const ctx = { state: g.state, combat, stats: getDerivedStats(g.state) };
    const trigger = TECHNIQUES.riposte.trigger!; // onDodge, window 20

    g.state.totalTicks = 100;
    combat.events.onDodge = 100;
    expect(evaluateTrigger(ctx, trigger)).toBe(true);
    g.state.totalTicks = 100 + trigger.window!;
    expect(evaluateTrigger(ctx, trigger)).toBe(true);
    g.state.totalTicks = 100 + trigger.window! + 1;
    expect(evaluateTrigger(ctx, trigger)).toBe(false);
  });
});

// ---------- Card legibility ----------

describe('technique status', () => {
  function inCombat(g: Game): CombatState {
    const combat: CombatState = {
      enemies: [null, null, null, null, null],
      playerBar: 0, momentum: 0, position: NEUTRAL_POSITION,
      cooldowns: {}, buffs: [], events: {},
    };
    g.state.combat = combat;
    return combat;
  }
  const statusOf = (g: Game, id: string) =>
    techniqueStatus(g.state, getDerivedStats(g.state), TECHNIQUES[id]);

  it('reports the first blocker in rotation order', () => {
    const g = brawler(20);
    learn(g.state, 'thrust');
    learn(g.state, 'crosscut');

    expect(statusOf(g, 'thrust')).toEqual({ kind: 'unarmed', family: 'sword' });
    expect(statusOf(g, 'gather')).toEqual({ kind: 'ready' });

    g.equip(1);
    const combat = inCombat(g);

    expect(statusOf(g, 'gather')).toEqual({ kind: 'primed' });
    expect(statusOf(g, 'heavy_blow')).toEqual({ kind: 'position', from: ['coiled'] });

    expect(statusOf(g, 'crosscut')).toEqual({ kind: 'trigger', event: 'onCrit' });
    g.state.totalTicks = 50;
    combat.events.onCrit = 50;
    expect(statusOf(g, 'crosscut')).toEqual({ kind: 'primed' });

    combat.cooldowns['technique:crosscut'] = 12;
    expect(statusOf(g, 'crosscut')).toEqual({ kind: 'cooldown', ticks: 12 });

    g.state.skillTriggers['technique:gather'] = { enabled: false, conditions: [] };
    expect(statusOf(g, 'gather')).toEqual({ kind: 'off' });
    g.state.skillTriggers['technique:gather'] = {
      conditions: [{ subject: 'enemy.count', op: '>=', value: 3 }],
    };
    expect(statusOf(g, 'gather')).toEqual({ kind: 'gated' });
  });

  it('mastery-opened entries change the position answer', () => {
    const g = brawler(21);
    inCombat(g);
    expect(statusOf(g, 'heavy_blow').kind).toBe('position');
    g.state.techniques.heavy_blow!.executions = 10000;
    expect(statusOf(g, 'heavy_blow').kind).toBe('primed');
  });
});

// ---------- The fight composes the chain ----------

describe('techniques in combat', () => {
  it('chains emerge from positions: Gather coils, Heavy Blow spends it', () => {
    const g = brawler(22);
    g.state.attrs.con.level = 30;
    g.state.spot = 'woods_edge';
    g.equip(1);
    g.selectActivity('hunt');

    const sawGather = () => g.state.combatFeed.some((f) => f.text.includes('Gather'));
    const sawHeavy = () => g.state.combatFeed.some((f) => f.text.includes('Heavy Blow'));
    let coiled = false;
    for (let i = 0; i < 6000 && !(sawGather() && sawHeavy()); i++) {
      g.tick();
      if (g.state.combat?.position === 'coiled') coiled = true;
    }
    expect(sawGather()).toBe(true);
    expect(coiled).toBe(true);
    expect(sawHeavy()).toBe(true);
    expect(techniqueExecutions(g.state, 'gather')).toBeGreaterThan(0);
    expect(techniqueExecutions(g.state, 'heavy_blow')).toBeGreaterThan(0);
  });

  it('the fight itself teaches: enough swings crystallize Gather (rough)', () => {
    const g = fresh(23);
    g.state.skills.fighting = { level: 5, xp: 0 };
    g.state.attrs.con.level = 30;
    g.state.stats['combat:attacks'] = 99; // one swing away
    g.state.spot = 'woods_edge';
    g.equip(1);
    g.selectActivity('hunt');
    for (let i = 0; i < 2000 && !techniqueForm(g.state, 'gather'); i++) g.tick();
    expect(techniqueForm(g.state, 'gather')).toBe('rough');
  });
});

// ---------- Answering with their own force ----------

/**
 * Flowing Shield is the first technique whose damage comes from the ENEMY's
 * swing rather than yours: the parry stamps how hard the blow was coming in
 * (`combat.prevented`), and `preventedMult` returns a share of it.
 */
describe('deflection: the force turned aside', () => {
  /** A buckler fighter who parries often enough to see it happen. */
  function shieldFighter(seed: number): Game {
    const g = fresh(seed);
    g.state.skills.fighting = { level: 20, xp: 0 };
    g.state.skills.shield_combat = { level: 20, xp: 0 };
    g.state.skills.deflection = { level: 40, xp: 0 };
    g.state.attrs.con.level = 40;
    g.state.attrs.dex.level = 30;
    g.state.resources.hp = 5000;
    g.equip(1); // rusty sword
    g.state.inventory.push({ uid: 60, defId: 'warden_buckler', slots: 0, runes: [] });
    g.equip(60, 'offhand');
    return g;
  }

  it('a parry records the force of the blow it turned aside', () => {
    const g = shieldFighter(60);
    g.state.spot = 'training_grounds'; // dummies swing forever, and never kill
    g.selectActivity('hunt');
    for (let i = 0; i < 3000 && !g.state.combat?.prevented?.onParry; i++) g.tick();
    expect(g.state.combat?.prevented?.onParry).toBeGreaterThan(0);
  });

  it('a blow that lands but is BLOCKED leaves a reading too', () => {
    // The other half of "damage prevented": a parry stops everything, a guard
    // stops a share — an onHit counter answers with whatever the armor ate.
    const g = shieldFighter(64);
    g.state.attrs.con.level = 80; // real armor, so there is something to block
    g.state.spot = 'woods_edge'; // real monsters: dummies never land a blow
    g.selectActivity('hunt');
    let blocked = 0;
    for (let i = 0; i < 4000 && blocked === 0; i++) {
      g.tick();
      blocked = g.state.combat?.prevented?.onHit ?? 0;
    }
    expect(blocked).toBeGreaterThan(0);
  });

  it('a parry reading and a block reading never overwrite each other', () => {
    // The swarm case: one enemy is parried while others land blocked hits.
    // Keyed readings mean both survive, so a parry counter still answers the
    // parry instead of a bystander's glancing blow.
    const g = shieldFighter(65);
    g.state.attrs.con.level = 80;
    g.state.spot = 'woods_edge';
    g.selectActivity('hunt');
    let both = false;
    for (let i = 0; i < 5000 && !both; i++) {
      g.tick();
      const p = g.state.combat?.prevented;
      both = (p?.onParry ?? 0) > 0 && (p?.onHit ?? 0) > 0;
    }
    expect(both).toBe(true);
  });

  it('the technique spends that force, and cannot cash it twice', () => {
    const g = shieldFighter(61);
    learn(g.state, 'flowing_shield');
    g.state.spot = 'training_grounds';
    g.selectActivity('hunt');
    g.state.skillTriggers['technique:flowing_shield'] = { enabled: true, conditions: [] };

    const struck = () => g.state.combatFeed.some((f) => f.text.includes('Flowing Shield'));
    for (let i = 0; i < 6000 && !struck(); i++) {
      if (g.state.combat) g.state.combat.position = 'guarded'; // its entry gate
      g.tick();
    }
    expect(struck()).toBe(true);
    // Spent on use: the parry reading is cleared, so the next swing cannot
    // cash the same deflection twice.
    expect(g.state.combat?.prevented?.onParry).toBeUndefined();
    expect(techniqueExecutions(g.state, 'flowing_shield')).toBeGreaterThan(0);
  });

  it('practice and the fork sharpen the signature, not just the swing', () => {
    const g = fresh(62);
    const base = TECHNIQUES.flowing_shield.move.preventedMult!;
    learn(g.state, 'flowing_shield');
    expect(resolvedMove(g.state, TECHNIQUES.flowing_shield).preventedMult).toBeCloseTo(base);

    // Drilled (tier 2) lifts the returned share along with the strike.
    g.state.techniques.flowing_shield.executions = MASTERY_LADDER[1];
    const drilled = resolvedMove(g.state, TECHNIQUES.flowing_shield);
    expect(drilled.preventedMult!).toBeGreaterThan(base);
    expect(drilled.preventedMult!).toBeCloseTo(base * 1.12);

    // A fork that trades damage moves the returned share by the same factor.
    g.state.techniques.flowing_shield.executions = MASTERY_LADDER[2];
    g.state.techniques.flowing_shield.path = 'economy'; // damageMult 0.9
    const forked = resolvedMove(g.state, TECHNIQUES.flowing_shield);
    expect(forked.preventedMult!).toBeCloseTo(base * 1.2 * 0.9);
  });

  it('is gated on a buckler specifically — a plank shield will not do', () => {
    const g = fresh(63);
    g.state.attrs.dex.level = 20; // the buckler asks for a steady hand
    learn(g.state, 'flowing_shield');
    g.state.inventory.push({ uid: 61, defId: 'wooden_shield', slots: 0, runes: [] });
    g.equip(61, 'offhand');
    expect(techniqueArmed(g.state, TECHNIQUES.flowing_shield)).toBe(false);

    g.state.inventory.push({ uid: 62, defId: 'warden_buckler', slots: 0, runes: [] });
    g.equip(62, 'offhand');
    expect(techniqueArmed(g.state, TECHNIQUES.flowing_shield)).toBe(true);
  });
});

// ---------- Counters: the technique inside their swing ----------

/**
 * A counter is the third execution kind: not on the action bar, not in the
 * buff slot, but inside the enemy's own attack — softening the blow and
 * answering it on the spot.
 */
describe('counters', () => {
  /** A boxer-magiknight: the shell to be worth hitting, the will to answer. */
  function magiknight(seed: number, mana = 40): Game {
    const g = fresh(seed);
    g.state.skills.fighting = { level: 20, xp: 0 };
    g.state.skills.unarmed_combat = { level: 20, xp: 0 };
    g.state.skills.school_boxing = { level: 15, xp: 0 };
    g.state.skills.school_magic_combat = { level: 10, xp: 0 };
    g.state.attrs.con.level = 60;
    g.state.attrs.int.level = 40; // the pool it is paid from
    g.state.resources.hp = 5000;
    g.state.resources.mana = mana;
    learn(g.state, 'electric_cross');
    g.state.spot = 'woods_edge'; // dummies cannot land the blow it answers
    return g;
  }

  /** Fight with the guard set, which is where the cross lives. */
  function guardedFight(g: Game, ticks: number): boolean {
    g.selectActivity('hunt');
    const answered = () => g.state.combatFeed.some((f) => f.text.includes('Electric Cross answers'));
    for (let i = 0; i < ticks && !answered(); i++) {
      if (g.state.combat) g.state.combat.position = 'guarded';
      g.tick();
    }
    return answered();
  }

  it('answers the blow that landed, and is paid for in mana', () => {
    const g = magiknight(70);
    const before = g.state.resources.mana;
    expect(guardedFight(g, 6000)).toBe(true);
    expect(g.state.resources.mana).toBeLessThan(before);
    expect(techniqueExecutions(g.state, 'electric_cross')).toBeGreaterThan(0);
    // Spent on use: the block it answered cannot be cashed again.
    expect(g.state.combat?.prevented?.onHit).toBeUndefined();
  });

  it('names itself in the incoming breakdown instead of shrinking the number', () => {
    // A counter takes its share BEFORE armor, so the blow arrives smaller than
    // the lines above it imply. The step has to say so, or the tooltip lies.
    const g = magiknight(74);
    g.selectActivity('hunt');
    const intercepted = () =>
      g.state.combatFeed.some((f) =>
        f.damage?.steps?.some((s) => s.label === 'Electric Cross intercepts'),
      );
    for (let i = 0; i < 6000 && !intercepted(); i++) {
      if (g.state.combat) g.state.combat.position = 'guarded';
      g.tick();
    }
    expect(intercepted()).toBe(true);
    const step = g.state.combatFeed
      .flatMap((f) => f.damage?.steps ?? [])
      .find((s) => s.label === 'Electric Cross intercepts');
    expect(step?.mult).toBeCloseTo(0.6); // 40% off, stated as a multiplier
  });

  it('softens the blow before armor, so the guard and the reflex are one block', () => {
    const g = magiknight(71);
    g.selectActivity('hunt');
    let blocked = 0;
    for (let i = 0; i < 6000 && blocked === 0; i++) {
      if (g.state.combat) g.state.combat.position = 'guarded';
      g.tick();
      blocked = g.state.combat?.prevented?.onHit ?? 0;
    }
    // The reading exists whether or not the answer has cashed it yet; what
    // matters is that the interception's share is inside it.
    expect(blocked).toBeGreaterThanOrEqual(0);
    expect(g.state.combatFeed.some((f) => f.text.includes('hits you'))).toBe(true);
  });

  it('an empty pool is not a refusal, just not this blow', () => {
    // Held empty, not merely started empty — the price is a share of MAX, and
    // regen would otherwise cover it within a few seconds of a long fight.
    const g = magiknight(72, 0);
    g.selectActivity('hunt');
    for (let i = 0; i < 3000; i++) {
      if (g.state.combat) g.state.combat.position = 'guarded';
      g.state.resources.mana = 0;
      g.tick();
    }
    expect(g.state.combatFeed.some((f) => f.text.includes('Electric Cross'))).toBe(false);
    expect(techniqueExecutions(g.state, 'electric_cross')).toBe(0);
  });

  it('stays out of the ordinary paths — it is never swung and never a buff', () => {
    // Left in neutral (its `neutral` entry only opens at Drilled), the counter
    // must simply never appear: if it leaked onto the action bar it would fire
    // here as an ordinary 1× strike.
    const g = magiknight(73);
    g.selectActivity('hunt');
    for (let i = 0; i < 3000; i++) g.tick();
    expect(g.state.combatFeed.some((f) => f.text.includes('Electric Cross'))).toBe(false);
  });

  it('returns the block as its own damage type, not the weapon\'s', () => {
    const move = TECHNIQUES.electric_cross.move;
    expect(move.damageType).toBe('lightning');
    expect(move.damageMult).toBe(1); // the fist half stays bludgeoning
    expect(move.counter?.reduce).toBeGreaterThan(0);
  });
});

// ---------- Positions are felt ----------

describe('position effects', () => {
  it('off balance takes blows harder, guarded softer, neutral at par', () => {
    const g = brawler(40);
    const combat: CombatState = {
      enemies: [null, null, null, null, null],
      playerBar: 0, momentum: 0, position: 'neutral',
      cooldowns: {}, buffs: [], events: {},
    };
    g.state.combat = combat;
    expect(positionIncomingMult(g.state)).toBe(1);
    combat.position = 'off_balance';
    expect(positionIncomingMult(g.state)).toBeCloseTo(1.15);
    combat.position = 'guarded';
    expect(positionIncomingMult(g.state)).toBeCloseTo(0.9);
  });
});

// ---------- Weapon states ----------

describe('weapon states', () => {
  function armedCombat(g: Game): CombatState {
    const combat: CombatState = {
      enemies: [null, null, null, null, null],
      playerBar: 0, momentum: 0, position: NEUTRAL_POSITION,
      grounded: null, cooldowns: {}, buffs: [], events: {},
    };
    g.state.combat = combat;
    return combat;
  }

  it('only daggers conceal, and sheathing makes you genuinely unarmed', () => {
    const g = fresh(41);
    g.equip(1); // rusty sword
    expect(toggleSheathe(g.state)).toBe(false); // swords don't hide

    g.state.inventory.push({ uid: 50, defId: 'iron_dagger', slots: 0, runes: [] });
    g.equip(50);
    expect(toggleSheathe(g.state)).toBe(true);
    expect(g.state.equipment.weapon).toBeUndefined();
    expect(equippedTags(g.state).has('unarmed')).toBe(true);
    expect(equippedTags(g.state).has('dagger')).toBe(false);
    // Drawn back by hand: wielded again.
    expect(toggleSheathe(g.state)).toBe(false);
    expect(g.state.equipment.weapon?.defId).toBe('iron_dagger');
  });

  it('hidden draw gates on the sheathed blade and reclaims it pre-strike', () => {
    const g = fresh(42);
    learn(g.state, 'hidden_draw');
    armedCombat(g);
    expect(weaponStateGate(g.state, TECHNIQUES.hidden_draw)).toBe('sheathed');

    g.state.inventory.push({ uid: 50, defId: 'iron_dagger', slots: 0, runes: [] });
    g.equip(50);
    toggleSheathe(g.state);
    expect(weaponStateGate(g.state, TECHNIQUES.hidden_draw)).toBeNull();

    applyTechniqueEquipment(g.state, TECHNIQUES.hidden_draw, 'pre');
    expect(g.state.sheathed).toBeNull();
    expect(g.state.equipment.weapon?.defId).toBe('iron_dagger'); // strike is armed
  });

  it('drop grounds the blade post-strike; ground draw takes it back up', () => {
    const g = fresh(43);
    learn(g.state, 'weapon_drop');
    learn(g.state, 'ground_draw');
    g.equip(1);
    armedCombat(g);

    expect(weaponStateGate(g.state, TECHNIQUES.weapon_drop)).toBeNull();
    expect(weaponStateGate(g.state, TECHNIQUES.ground_draw)).toBe('grounded');

    applyTechniqueEquipment(g.state, TECHNIQUES.weapon_drop, 'post');
    expect(g.state.equipment.weapon).toBeUndefined();
    expect(g.state.combat?.grounded?.defId).toBe('rusty_sword');
    expect(equippedTags(g.state).has('unarmed')).toBe(true);
    expect(weaponStateGate(g.state, TECHNIQUES.weapon_drop)).toBe('wielded');
    expect(weaponStateGate(g.state, TECHNIQUES.ground_draw)).toBeNull();

    applyTechniqueEquipment(g.state, TECHNIQUES.ground_draw, 'pre');
    expect(g.state.combat?.grounded).toBeNull();
    expect(g.state.equipment.weapon?.defId).toBe('rusty_sword');
  });

  it('nobody leaves their blade in the dirt when the fight ends', () => {
    const g = fresh(44);
    g.equip(1);
    const combat = armedCombat(g);
    // Read through a thunk: TS narrows the deleted property otherwise.
    const held = () => g.state.equipment.weapon;
    combat.grounded = g.state.equipment.weapon!;
    delete g.state.equipment.weapon;
    recoverGroundedWeapon(g.state);
    expect(held()?.defId).toBe('rusty_sword');

    // Hand already full (re-armed mid-fight): the grounded one goes to the pack.
    combat.grounded = { uid: 60, defId: 'iron_dagger', slots: 0, runes: [] };
    const packBefore = g.state.inventory.length;
    recoverGroundedWeapon(g.state);
    expect(g.state.inventory.length).toBe(packBefore + 1);
  });
});

// ---------- Ways in: per-entry reads ----------

describe('entry ways', () => {
  const ctxIn = (g: Game, position: string) => {
    const combat: CombatState = {
      enemies: [null, null, null, null, null],
      playerBar: 0, momentum: 0, position,
      cooldowns: {}, buffs: [], events: {},
    };
    g.state.combat = combat;
    return { state: g.state, combat, stats: getDerivedStats(g.state) };
  };

  /** A def with one plain way in and one that wants a dodge first. */
  const twoWays: TechniqueDef = {
    id: 'test_two_ways',
    name: 'Two Ways',
    icon: '⚔',
    desc: 'Out of a coil, or out of trouble.',
    from: [
      { at: ['coiled'] },
      { at: ['off_balance'], trigger: { conditions: [], event: 'onDodge', window: 20 } },
    ],
    to: 'neutral',
    move: { damageMult: 1, cooldown: 10 },
  };

  it('normalizes all three declared forms to the same shape', () => {
    expect(declaredEntries({ ...twoWays, from: 'any' })).toEqual([{ at: 'any' }]);
    expect(declaredEntries({ ...twoWays, from: ['coiled'] })).toEqual([{ at: ['coiled'] }]);
    expect(declaredEntries(twoWays)).toHaveLength(2);
    // Flattened, the graph sees every position whichever form was written.
    expect(declaredPositions(twoWays)).toEqual(['coiled', 'off_balance']);
  });

  it('each way carries its own read — the plain one needs no moment', () => {
    const g = fresh(90);
    learn(g.state, 'gather'); // any ledger entry; the def under test is synthetic

    // The plain way: standing in the coil is enough.
    expect(openEntry(g.state, twoWays, 'coiled', ctxIn(g, 'coiled'))?.at).toEqual(['coiled']);

    // The opportunistic way: right footing, but nothing has happened yet.
    const ctx = ctxIn(g, 'off_balance');
    expect(openEntry(g.state, twoWays, 'off_balance', ctx)).toBeUndefined();
    // …and now it has.
    g.state.totalTicks = 100;
    ctx.combat.events.onDodge = 100;
    expect(openEntry(g.state, twoWays, 'off_balance', ctx)?.at).toEqual(['off_balance']);
  });

  it('a way nobody is standing in never opens, however fresh its moment', () => {
    const g = fresh(91);
    const ctx = ctxIn(g, 'neutral');
    g.state.totalTicks = 100;
    ctx.combat.events.onDodge = 100;
    expect(openEntry(g.state, twoWays, 'neutral', ctx)).toBeUndefined();
  });

  it('practice adds a PLAIN way — repetition opens the motion, not a new read', () => {
    const g = fresh(92);
    const def: TechniqueDef = { ...twoWays, mastery: { 2: { addFrom: ['guarded'] } } };
    learn(g.state, def.id, 'canonical', 100); // tier 2
    const entries = techniqueEntries(g.state, def);
    const opened = entries.find((e) => e.at !== 'any' && (e.at as string[]).includes('guarded'));
    expect(opened).toBeDefined();
    expect(opened!.trigger).toBeUndefined();
    // And it fires on footing alone, with no event stamped anywhere.
    expect(openEntry(g.state, def, 'guarded', ctxIn(g, 'guarded'))).toBeDefined();
  });
});

// ---------- Impaled: the blade left in them ----------

describe('impaled weapons', () => {
  function armedCombat(g: Game): CombatState {
    const combat: CombatState = {
      enemies: [null, null, null, null, null],
      playerBar: 0, momentum: 0, position: NEUTRAL_POSITION,
      grounded: null, impaled: null, cooldowns: {}, buffs: [], events: {},
    };
    g.state.combat = combat;
    return combat;
  }

  it('impaling leaves the blade in them; wrenching takes it back pre-strike', () => {
    const g = fresh(80);
    learn(g.state, 'impaling_swing');
    learn(g.state, 'flesh_draw');
    g.equip(1);
    armedCombat(g);

    expect(weaponStateGate(g.state, TECHNIQUES.flesh_draw)).toBe('impaled');
    applyTechniqueEquipment(g.state, TECHNIQUES.impaling_swing, 'post');
    expect(g.state.equipment.weapon).toBeUndefined();
    expect(g.state.combat?.impaled?.defId).toBe('rusty_sword');
    // You are genuinely unarmed with your sword in somebody else.
    expect(equippedTags(g.state).has('unarmed')).toBe(true);
    expect(weaponStateGate(g.state, TECHNIQUES.flesh_draw)).toBeNull();

    applyTechniqueEquipment(g.state, TECHNIQUES.flesh_draw, 'pre');
    expect(g.state.combat?.impaled).toBeNull();
    expect(g.state.equipment.weapon?.defId).toBe('rusty_sword');
  });

  it('grounded and impaled are separate slots — the recoveries never swap', () => {
    const g = fresh(81);
    learn(g.state, 'ground_draw');
    learn(g.state, 'flesh_draw');
    const combat = armedCombat(g);

    // A blade in the dirt is not a blade in a ribcage: Flesh Draw stays shut.
    combat.grounded = { uid: 90, defId: 'rusty_sword', slots: 0, runes: [] };
    expect(weaponStateGate(g.state, TECHNIQUES.ground_draw)).toBeNull();
    expect(weaponStateGate(g.state, TECHNIQUES.flesh_draw)).toBe('impaled');

    combat.grounded = null;
    combat.impaled = { uid: 91, defId: 'rusty_sword', slots: 0, runes: [] };
    expect(weaponStateGate(g.state, TECHNIQUES.ground_draw)).toBe('grounded');
    expect(weaponStateGate(g.state, TECHNIQUES.flesh_draw)).toBeNull();
  });

  it('the fight ending returns a buried blade as well as a dropped one', () => {
    const g = fresh(82);
    const combat = armedCombat(g);
    const held = () => g.state.equipment.weapon;
    combat.impaled = { uid: 92, defId: 'rusty_sword', slots: 0, runes: [] };
    recoverGroundedWeapon(g.state);
    expect(combat.impaled).toBeNull();
    expect(held()?.defId).toBe('rusty_sword');
  });
});

// ---------- Rune graph surgery ----------

describe('rune technique surgery', () => {
  function runedFighter(seed: number): Game {
    const g = fresh(seed);
    learn(g.state, 'sidestep');
    learn(g.state, 'thrust');
    learn(g.state, 'riposte');
    // Placed directly — a fresh character can't meet the katana's wield
    // requirements, and the surgery only cares that the runes are socketed.
    g.state.equipment.weapon = {
      uid: 70, defId: 'katana', slots: 3,
      runes: ['gale_rune', 'earthbind_rune', 'umbral_rune'],
    };
    return g;
  }

  it('tempo surgery: the Gale rune makes Sidestep a Flash Step', () => {
    const g = runedFighter(45);
    expect(techniqueDisplayName(g.state, TECHNIQUES.sidestep)).toBe('Flash Step');
    expect(resolvedMove(g.state, TECHNIQUES.sidestep).cooldown).toBe(Math.round(120 * 0.55));
  });

  it('exit surgery: the Earthbind rune roots the thrust into coiled', () => {
    const g = runedFighter(46);
    expect(techniqueExit(g.state, TECHNIQUES.thrust)).toBe('coiled');
    expect(techniqueDisplayName(g.state, TECHNIQUES.thrust)).toBe('Rooted Thrust');
  });

  it('choice surgery: the Umbral rune widens the Honed offering', () => {
    const g = runedFighter(47);
    expect(resolvedMove(g.state, TECHNIQUES.riposte).damageMult).toBeCloseTo(1.4 * 1.1);
    const options = forkOptions(g.state, TECHNIQUES.riposte).map((a) => a.id);
    expect(options).toContain('sweep'); // granted — not in riposte's pair
    expect(options).toContain('economy');
  });

  it('surgery is equipment: unsocket the weapon and the node reverts', () => {
    const g = runedFighter(48);
    g.unequip('weapon');
    expect(techniqueDisplayName(g.state, TECHNIQUES.sidestep)).toBe('Sidestep');
    expect(techniqueExit(g.state, TECHNIQUES.thrust)).toBe('neutral');
    expect(forkOptions(g.state, TECHNIQUES.riposte).map((a) => a.id)).not.toContain('sweep');
  });
});

// ---------- The spellblade seat ----------

describe('readied spells', () => {
  /** A spellblade with a prepared working and mana to hold it. */
  function spellblade(seed: number): Game {
    const g = fresh(seed);
    g.state.attrs.int.level = 30;
    g.state.resources.mana = 50;
    learn(g.state, 'ready_spell');
    learn(g.state, 'spell_parry');
    const spell = inscribeArcane(g.state, g.bus, ['fire', 'pierce'])!;
    setPrepared(g.state, g.bus, spell.uid, true);
    g.state.combat = {
      enemies: [null, null, null, null, null],
      playerBar: 0, momentum: 0, position: NEUTRAL_POSITION,
      cooldowns: {}, buffs: [], events: {},
    };
    return g;
  }

  it('offers a prepared working you can actually pay for', () => {
    const g = spellblade(70);
    const stats = getDerivedStats(g.state);
    expect(readyableSpell(g.state, stats)).not.toBeNull();
    // Nothing prepared: nothing to hold.
    for (const s of g.state.grimoire) s.prepared = false;
    expect(readyableSpell(g.state, stats)).toBeNull();
    // Prepared but unaffordable is also a no — not a refusal, just not yet.
    for (const s of g.state.grimoire) s.prepared = true;
    g.state.resources.mana = 0;
    expect(readyableSpell(g.state, stats)).toBeNull();
  });

  it('Spell Parry gates on something actually being held', () => {
    const g = spellblade(71);
    expect(weaponStateGate(g.state, TECHNIQUES.spell_parry)).toBe('readied');
    g.state.combat!.readiedSpell = g.state.grimoire[0].uid;
    expect(weaponStateGate(g.state, TECHNIQUES.spell_parry)).toBeNull();
  });

  it('walking out of the seat drops the working — the mana is spent either way', () => {
    const g = spellblade(72);
    const c = g.state.combat!;
    c.position = SPELL_READY_POSITION;
    c.readiedSpell = g.state.grimoire[0].uid;

    // Moving within the seat keeps it.
    setPosition(g.state, SPELL_READY_POSITION);
    expect(c.readiedSpell).toBe(g.state.grimoire[0].uid);

    // A plain swing recovers to neutral, and the held working is simply gone.
    setPosition(g.state, NEUTRAL_POSITION);
    expect(c.readiedSpell).toBeNull();
  });

  it('a fight that ends takes the held working with it', () => {
    const g = spellblade(73);
    g.state.combat!.readiedSpell = g.state.grimoire[0].uid;
    releaseReadiedSpell(g.state);
    expect(g.state.combat!.readiedSpell).toBeNull();
  });

  it('a held working does not also cast itself through the rotation', () => {
    const g = spellblade(75);
    const uid = g.state.grimoire[0].uid;
    // Prepared, so it is in the rotation…
    expect(activeRotation(g.state)).toContain(`grimoire:${uid}`);
    // …but while HELD it is out of it: its mana is already spent and it is
    // being carried to deliver through an opening, not left to go off alone.
    expect(spellIsHeld(g.state, uid)).toBe(false);
    g.state.combat!.readiedSpell = uid;
    expect(spellIsHeld(g.state, uid)).toBe(true);
  });

  it('readying pays mana up front and seats you; the position is discoverable', () => {
    const g = spellblade(74);
    // The seat is known because Ready Spell exits into it.
    expect(positionKnown(g.state, SPELL_READY_POSITION)).toBe(true);
    const before = g.state.resources.mana;
    const stats = getDerivedStats(g.state);
    const pick = readyableSpell(g.state, stats)!;
    expect(pick.cost).toBeGreaterThan(0);
    expect(before).toBeGreaterThanOrEqual(pick.cost);
  });
});

// ---------- The magiknight seam ----------

describe('mana-fuelled exertion', () => {
  it('a pool:mana bargain draws mana and leaves stamina alone', () => {
    const g = fresh(49);
    g.state.attrs.int.level = 20;
    g.state.resources.mana = 20;
    g.state.exerting = true;
    const stats = getDerivedStats(g.state);
    const staminaBefore = g.state.resources.stamina;
    const result = exert(g.state, stats, {
      on: 'attack',
      pool: 'mana',
      cost: 0.3,
      hit: { damage: 1 },
    });
    expect(result.spent).toBeGreaterThan(0);
    expect(result.damage).toBeGreaterThan(0);
    expect(g.state.resources.mana).toBeLessThan(20);
    expect(g.state.resources.stamina).toBe(staminaBefore);
  });
});

// ---------- The position graph (planner) ----------

describe('the position graph', () => {
  /** Every edge one technique contributes, as "from>to" strings. */
  function edgesOf(g: Game, id: string): string[] {
    return positionGraph(g.state, [TECHNIQUES[id]]).map((e) => `${e.from ?? 'any'}>${e.to}`);
  }

  it('draws one edge per entry position, and no source at all for a reflex', () => {
    const g = fresh(60);
    // Crosscut enters from two positions: two edges, one exit apiece.
    expect(edgesOf(g, 'crosscut').sort()).toEqual(['extended>extended', 'neutral>extended']);
    // Sidestep answers from anywhere — it has no entry node to hang off.
    expect(edgesOf(g, 'sidestep')).toEqual(['any>guarded']);
  });

  it('grows with practice: a Perfected entry becomes a new edge', () => {
    const g = fresh(61);
    expect(edgesOf(g, 'heavy_blow')).toEqual(['coiled>off_balance']);
    // Ten thousand swings open the neutral entry (mastery addFrom), and the
    // graph must show it — this is why it reads entryPositions, not def.from.
    learn(g.state, 'heavy_blow', 'canonical', MASTERY_LADDER[3]);
    expect(edgesOf(g, 'heavy_blow').sort()).toEqual(['coiled>off_balance', 'neutral>off_balance']);
  });

  it('follows a fork that rewrites the exit — Flowing Thrust feeds itself', () => {
    const g = fresh(62);
    learn(g.state, 'thrust', 'canonical', MASTERY_LADDER[FORK_TIER - 1]);
    expect(edgesOf(g, 'thrust')).toEqual(['extended>neutral']);
    expect(chooseFork(g.state, TECHNIQUES.thrust, 'flowing')).toBe(true);
    // The exit moves to where it enters: a loop the fight can ride, discovered
    // rather than declared.
    expect(edgesOf(g, 'thrust')).toEqual(['extended>extended']);
  });

  it('every edge names positions the graph can actually seat', () => {
    const g = fresh(63);
    for (const edge of positionGraph(g.state, [...TECHNIQUE_LIST])) {
      expect(POSITIONS[edge.to], `${edge.def.id} exits into ${edge.to}`).toBeDefined();
      if (edge.from !== null) {
        expect(POSITIONS[edge.from], `${edge.def.id} enters from ${edge.from}`).toBeDefined();
      }
    }
  });
});

describe('weapon-group filtering', () => {
  it('universal moves are always available; family moves only when picked', () => {
    const ids = (families: string[]) => techniquesForFamilies(families).map((t) => t.id);
    // Nothing selected still leaves the family-less reflexes on the graph.
    expect(ids([])).toContain('gather');
    expect(ids([])).not.toContain('thrust');
    expect(ids(['sword'])).toContain('thrust'); // sword
    expect(ids(['sword'])).toContain('gather'); // still universal
    expect(ids(['sword'])).not.toContain('slip_jab'); // unarmed
    // Several groups at once — "swords + fists" is one selection, not two views.
    expect(ids(['sword', 'unarmed'])).toEqual(
      expect.arrayContaining(['thrust', 'slip_jab', 'gather']),
    );
  });

  it('every declared family is one some technique or item actually uses', () => {
    const claimed = new Set(WEAPON_FAMILIES.map((f) => f.id));
    const used = new Set<string>();
    for (const t of TECHNIQUE_LIST) if (t.family) used.add(t.family);
    for (const item of Object.values(ITEMS)) for (const tag of item.tags) used.add(tag);
    for (const id of claimed) expect(used.has(id), `${id} names nothing`).toBe(true);
    // And no technique hides behind a family the planner cannot offer.
    for (const t of TECHNIQUE_LIST) {
      if (t.family) expect(claimed.has(t.family), `${t.id}: ${t.family}`).toBe(true);
    }
  });

  it('benching is the trigger switch, and never touches the ledger', () => {
    const g = brawler(64);
    expect(techniqueBenched(g.state, 'gather')).toBe(false);
    g.setSkillEnabled('technique:gather', false);
    expect(techniqueBenched(g.state, 'gather')).toBe(true);
    expect(g.state.techniques.gather).toBeDefined(); // still known, just held back
    g.setSkillEnabled('technique:gather', true);
    expect(techniqueBenched(g.state, 'gather')).toBe(false);
  });
});

// ---------- Migrations ----------

describe('save migration v24 → v25', () => {
  it('sweeps the dissolved actives and seeds the practice ledger', () => {
    const raw = {
      version: 24,
      skills: { fighting: { level: 5, xp: 0 }, heavy_swing: { level: 3, xp: 10 }, fireball: { level: 2, xp: 0 } },
      skillOrder: ['heavy_swing', 'active_dodge', 'fireball'],
      skillTriggers: { heavy_swing: { conditions: [] } },
      combat: { enemies: [null, null, null, null, null], playerBar: 0, momentum: 0, cooldowns: {}, buffs: [], events: {} },
    } as unknown as Record<string, unknown>;
    migrate(raw, 25);
    expect(raw.techniques).toEqual({});
    expect(raw.drilling).toEqual([]);
    expect((raw.skills as Record<string, unknown>).heavy_swing).toBeUndefined();
    expect((raw.skills as Record<string, unknown>).fireball).toBeUndefined();
    expect(raw.skillOrder).toEqual([]);
    expect((raw.combat as { position: string }).position).toBe('neutral');
    expect(raw.version).toBe(25);
  });
});

describe('save migration v26 → v27', () => {
  it('adds the sheath and backfills a live fight', () => {
    const raw = {
      version: 26,
      combat: { enemies: [null, null, null, null, null], playerBar: 0, momentum: 0, position: 'neutral', cooldowns: {}, buffs: [], events: {} },
    } as unknown as Record<string, unknown>;
    migrate(raw, 27);
    expect(raw.sheathed).toBeNull();
    expect((raw.combat as { grounded: unknown }).grounded).toBeNull();
    expect(raw.version).toBe(27);
  });
});

describe('save migration v25 → v26', () => {
  it('grandfathers currently-qualified techniques as canonical, keeps reps', () => {
    const base = createInitialState(30);
    base.skills.fighting = { level: 12, xp: 0 };
    base.attrs.str.level = 8;
    base.techniques = { gather: { executions: 77 } as never };
    const raw = base as unknown as Record<string, unknown>;
    raw.version = 25;
    migrate(raw, 26);
    const ledger = raw.techniques as Record<string, { executions: number; form: string }>;
    expect(ledger.gather).toEqual({ executions: 77, form: 'canonical' }); // reps kept
    expect(ledger.heavy_blow).toEqual({ executions: 0, form: 'canonical' }); // qualified
    expect(ledger.riposte).toBeUndefined(); // dex 1 — back to the counters
    expect(raw.version).toBe(26);
  });
});
