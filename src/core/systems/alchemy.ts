import type {
  BrewForm,
  BrewMedium,
  BrewSpec,
  BrewedFlask,
  CraftDisciplineDef,
  DamageType,
  EssenceSpec,
  GameState,
  GradedStack,
  SpellStrike,
  WeaponCoating,
  StatusApplication,
} from '../types';
import type { EventBus } from '../engine/events';
import { DISCIPLINES } from '../data/disciplines.data';
import { MATERIALS } from '../data/materials.data';
import { QUALITY_TIERS, qualityMult } from '../data/quality.data';
import { STATUSES } from '../data/statuses.data';
import {
  BREW_BASE_DURATION,
  BREW_FORMS,
  BREW_MAX_DURATION,
  REAGENTS,
  formulaFor,
} from '../data/alchemy.data';
import { rand } from '../engine/rng';
import { logRepeat } from './log';
import { checkDiscovery, grantSkillXp } from './skills';
import { grantAttrXp } from './attributes';
import { getDerivedStats } from './derived';
import { restoreResource } from './resources';
import { RESOURCES } from '../data/resources.data';
import { heal } from './health';
import { applyStatus, fireStatusEvent, statusIncomingDamageMult, statusesOf } from './statuses';
import { itemName } from './equipment';
import { feed, monsterSlice, sweepDead } from './combat';
import { checkCraft, consumePlacement, noveltyKeys, skillLevel, type Placement } from './disciplines';
import { text } from '../text/log';

/**
 * Alchemy: the crafting mirror of a spoken sentence.
 *
 * Runecarving is a SUM — rearrange the slab and you get the same rune. Cooking
 * is a CLOCK — an onion that goes in at unit four has seen four fewer units of
 * heat. Alchemy is neither: it is a SEQUENCE, read left to right exactly once,
 * and nothing in it has a duration. Only positions, and only relative ones.
 *
 * Everything here is deterministic. Two alchemists who add the same reagents at
 * the same grades in the same order get the same flask, always — the promise
 * arcane spellcraft makes, kept by a bench. A flask therefore stores nothing
 * but its sequence (see BrewedFlask); what it does is read back out of it.
 *
 * ---- The two laws ----
 *
 * **1. Extraction. The longer a substance steeps, the less of itself is left.**
 * An essence added early is broken down: it surrenders its character and comes
 * out as raw POTENCY, and generously — dissolving is the efficient way to make
 * something strong. An essence added last has dissolved into nothing and keeps
 * all of its CHARACTER: its element, its afflictions, what it does to whoever
 * drinks it. So the same three herbs, reversed, are a strong vague potion or a
 * weak vivid one, and neither is the right answer.
 *
 * **2. An operator can only act on what it finds.** Salt cannot settle a brew
 * that is not yet running. Ash cannot take the weakest thing out of an empty
 * pot. Brimstone will not catch unless something before it got the brew hot.
 * Position is not a modifier on an operator — it is the whole of what an
 * operator is.
 *
 * ---- What comes out ----
 *
 * The SOLVENT decides delivery and VOLATILITY decides burst-or-lasting, and
 * that is the entire outcome table: water calm is an elixir, water roused is a
 * draught, spirit roused is a bomb, spirit calm is a fume, oil is a salve, and
 * nothing at all is residue. The essences decide what it is OF; the potency
 * decides how much of it there is.
 */

export const ALCHEMY = DISCIPLINES.alchemy;

// ---------- Tuning ----------

/**
 * What a fully dissolved essence returns, relative to what an undissolved one
 * does. Above 1 on purpose: everything in the bottle counts toward how MUCH
 * there is, and steeping returns a third again as much — which is what makes
 * the trade against character an actual trade rather than a straight loss.
 */
export const EXTRACT_YIELD = 1.35;
/** Past this, a brew is a burst rather than something that lingers. */
export const VOLATILE_AT = 1;
/** The share of potency a solvent cannot hold that survives anyway. */
export const SPILL = 0.35;
/** What a second solvent does: weaker, calmer, roomier. */
export const DILUTE = { potency: 0.7, volatility: 0.55 };
/** Volatility left in a fixed brew. */
export const FIX_QUENCH = 0.15;
/** Duration (in base-durations) banked per point of volatility quenched. */
export const FIX_BANK = 0.5;
/** What an ignite that catches adds to volatility. */
export const IGNITE_KICK = 0.8;
/** What an ignite that fails leaves of the final potency. */
export const IGNITE_FOUL = 0.82;
/** Potency gained when a clarify removes an essence. */
export const CLARIFY_BOOST = 0.25;
/** Final potency gained when a clarify finds only one essence. */
export const CLARIFY_POLISH = 0.2;
/** A thrown flask's potency, as damage. */
export const BOMB_POWER = 2.4;
/**
 * A coated blade's potency, as damage PER BLOW — a small fraction of a flask's,
 * because it lands many times. Blows × bite comes out near a bomb's single
 * burst, so the choice between them is delivery, not power: a flask is certain
 * and immediate, an oil has to be earned a swing at a time.
 */
export const OIL_BITE = 0.3;
/** How many blows a coating lasts: a floor, a slope, and a hard ceiling. */
export const OIL_BLOWS = { base: 3, perPotency: 0.8, cap: 12 };
/** Essence weight → the intensity of what it inflicts, grants, or fumes. */
export const INFLICT_PER_WEIGHT = 0.45;
export const GRANT_PER_WEIGHT = 0.5;
/** Ticks between flasks. A satchel is not an action bar. */
export const FLASK_COOLDOWN = 60;
/** The one key every flask shares, so throwing one puts them all on the clock. */
export const FLASK_COOLDOWN_KEY = 'flask';

// ---------- Reading a sequence ----------

export function alchemyLevel(state: GameState): number {
  return state.skills[ALCHEMY?.skill ?? 'alchemy']?.level ?? 0;
}

/** The sequence a bench layout spells out: filled steps, in slot order, gaps closed. */
export function sequenceOf(disc: CraftDisciplineDef, placement: Placement): GradedStack[] {
  return disc.slots
    .map((s) => placement[s.id])
    .filter((s): s is GradedStack => !!s);
}

/** Every reagent the alchemist may put in the alembic at this level. */
export function knownReagents(level: number) {
  return Object.values(REAGENTS).filter((r) => (r.minLevel ?? 0) <= level);
}

/** How the strongest essence in a brew names it. */
function brewName(form: BrewForm, essences: BrewSpec['essences']): string {
  const kind = BREW_FORMS[form];
  if (form === 'residue') return 'Inert Residue';
  const top = essences[0];
  return top ? `${top.spec.name} ${kind.name}` : `Blank ${kind.name}`;
}

/** Scale a declared application by how loudly its essence reads. */
function scaleApps(
  apps: StatusApplication[] | undefined,
  weight: number,
  per: number,
  duration?: number,
): StatusApplication[] {
  return (apps ?? []).map((a) => {
    const out: StatusApplication = { ...a, intensity: (a.intensity ?? 1) * weight * per };
    if (duration !== undefined) out.duration = duration;
    return out;
  });
}

/** A number for the reading: at most two decimals, no trailing zeros. */
const num = (x: number): string => String(Math.round(x * 100) / 100);
/** A multiplier or share as a whole percent. */
const pctOf = (x: number): number => Math.round(x * 100);

/**
 * Read a sequence into a brew. Pure: reagents in, brew out, no state and no
 * roll. Unknown reagents are read as "ignored" rather than refused — legality
 * is `previewBrew`'s job, so the bench can read out a sequence you cannot yet
 * make.
 *
 * The reading is for a player tinkering mid-session: `notes` has exactly one
 * line per step, in order, each naming the rule that applied and the running
 * number it changed; `summary` says what the whole adds up to. The words live
 * in log.text.ts under `alchemy.step.*` and `alchemy.sum.*`.
 */
export function composeBrew(steps: GradedStack[]): BrewSpec {
  const notes: string[] = [];
  const summary: string[] = [];
  let medium: BrewMedium = 'none';
  let capacity = 0;
  let potency = 0;
  let volatility = 0;
  let purity = 1;
  let penetration = 0;
  /** Volatility that was quenched rather than spent — what a fix banks. */
  let banked = 0;
  const essences = new Map<string, { spec: EssenceSpec; weight: number }>();

  const n = steps.length;
  steps.forEach((step, i) => {
    const def = REAGENTS[step.id];
    if (!def) {
      notes.push(`${step.id}: ${text('alchemy.step.unknown')}`);
      return;
    }
    const q = qualityMult(step.quality);
    /** Operators cannot run backwards on a poor grade; they merely do less. */
    const qq = Math.max(0, q);
    /** What this step did, clause by clause; a reagent can be two kinds at once. */
    const parts: string[] = [];

    // A solvent first, because a reagent that is both raises the brew it then
    // acts on — spirit rouses what it is holding, not what it is about to.
    if (def.menstruum) {
      const body = def.menstruum.body * q;
      if (medium === 'none') {
        medium = def.menstruum.medium;
        capacity += body;
        parts.push(text('alchemy.step.base', { base: medium, forms: MEDIUM_FORMS[medium], capacity: num(capacity) }));
      } else {
        potency *= DILUTE.potency;
        volatility *= DILUTE.volatility;
        capacity += body;
        parts.push(
          text('alchemy.step.dilute', {
            pmult: DILUTE.potency,
            potency: num(potency),
            vmult: DILUTE.volatility,
            volatility: num(volatility),
            capacity: num(capacity),
          }),
        );
      }
    }

    if (def.essence) {
      // Law 1: everything added after this one is time it spends dissolving.
      const after = n - 1 - i;
      const dissolved = after / (after + 1);
      const power = def.essence.power * q;
      const kept = power * (1 - dissolved);
      // Everything that went in is still in the bottle, so all of it counts
      // toward how much there is. What steeping buys is the EXTRACT_YIELD on
      // the dissolved share; what it costs is that share's identity.
      const gain = power * dissolved * EXTRACT_YIELD + kept;
      potency += gain;
      if (kept !== 0) {
        const held = essences.get(def.essence.id);
        if (held) held.weight += kept;
        else essences.set(def.essence.id, { spec: def.essence, weight: kept });
      }
      parts.push(
        after === 0
          ? text('alchemy.step.last', { gain: num(gain), potency: num(potency) })
          : text('alchemy.step.dissolve', {
              after: `${after} step${after === 1 ? '' : 's'}`,
              dissolved: pctOf(dissolved),
              gain: num(gain),
              potency: num(potency),
              kept: 100 - pctOf(dissolved),
            }),
      );
    }

    // Law 2: an operator reads the brew as it stands right now.
    const act = def.act;
    switch (act?.kind) {
      case 'agitate': {
        const added = act.amount * qq;
        volatility += added;
        if (added > 0) parts.push(text('alchemy.step.agitate', { amount: num(added), volatility: num(volatility) }));
        break;
      }
      case 'fix': {
        const quenched = Math.max(0, volatility - FIX_QUENCH);
        if (quenched <= 0) {
          parts.push(text('alchemy.step.fix_idle', { volatility: num(volatility), floor: FIX_QUENCH }));
          break;
        }
        const bank = quenched * Math.max(0.2, q);
        banked += bank;
        const before = volatility;
        volatility = FIX_QUENCH;
        parts.push(
          text('alchemy.step.fix', { before: num(before), volatility: num(volatility), bonus: pctOf(bank * FIX_BANK) }),
        );
        break;
      }
      case 'ignite': {
        const before = volatility;
        if (volatility >= act.needs) {
          const mult = 1 + (act.mult - 1) * Math.max(0.2, q);
          potency *= mult;
          volatility += IGNITE_KICK;
          parts.push(
            text('alchemy.step.ignite', {
              before: num(before),
              needs: act.needs,
              mult: num(mult),
              potency: num(potency),
              kick: IGNITE_KICK,
              volatility: num(volatility),
            }),
          );
        } else {
          purity *= IGNITE_FOUL;
          parts.push(text('alchemy.step.ignite_fail', { before: num(before), needs: act.needs, foul: IGNITE_FOUL }));
        }
        break;
      }
      case 'clarify': {
        if (essences.size >= 2) {
          let weakest: string | null = null;
          let least = Infinity;
          for (const [id, e] of essences) {
            if (e.weight < least) {
              least = e.weight;
              weakest = id;
            }
          }
          const dropped = weakest ? essences.get(weakest)!.spec.name : '';
          if (weakest) essences.delete(weakest);
          const m = 1 + (act.mult - 1) * qq;
          for (const e of essences.values()) e.weight *= m;
          // Taking the impurity out concentrates what is left, in magnitude as
          // well as in how loudly it reads.
          const boost = 1 + CLARIFY_BOOST * qq;
          potency *= boost;
          parts.push(text('alchemy.step.clarify', { dropped, mult: num(m), boost: num(boost), potency: num(potency) }));
        } else if (essences.size === 1) {
          const polish = 1 + CLARIFY_POLISH * qq;
          purity *= polish;
          parts.push(text('alchemy.step.clarify_one', { polish: num(polish) }));
        } else {
          parts.push(text('alchemy.step.clarify_none'));
        }
        break;
      }
      case 'corrode': {
        const pierce = act.penetration * qq;
        const mult = 1 + (act.mult - 1) * qq;
        penetration += pierce;
        potency *= mult;
        purity *= act.purity;
        parts.push(
          text('alchemy.step.corrode', { pierce: pctOf(pierce), mult: num(mult), potency: num(potency), purity: act.purity }),
        );
        break;
      }
    }
    notes.push(`${def.icon} ${def.name}: ${parts.join(' ')}`);
  });

  // What the solvent will actually hold. Past its capacity a brew does not
  // simply cap — it spills, and most of the excess is lost with the froth.
  const raw = potency;
  if (capacity > 0 && potency > capacity) {
    const over = potency - capacity;
    potency = capacity + over * SPILL;
  }
  const held = potency;
  potency = Math.max(0, potency * purity);

  const ranked = [...essences.values()].filter((e) => e.weight > 0).sort((a, b) => b.weight - a.weight);
  const total = ranked.reduce((s, e) => s + e.weight, 0);
  const list = ranked.map((e) => ({ spec: e.spec, weight: e.weight, share: total > 0 ? e.weight / total : 0 }));

  const form = formOf(medium, volatility);
  const kind = BREW_FORMS[form];
  const duration = Math.min(BREW_MAX_DURATION, Math.round(BREW_BASE_DURATION * (1 + banked * FIX_BANK)));

  // ---- The registers. Which one a brew speaks in is decided by its form. ----

  const strikes: SpellStrike[] = [];
  const inflicts: StatusApplication[] = [];
  const restore: BrewSpec['restore'] = [];
  const grants: StatusApplication[] = [];
  const cures: string[] = [];

  if (kind.thrown) {
    /** Substances with no element of their own: the bottle, and its weight. */
    let bare = 0;
    for (const e of list) {
      const power = potency * e.share * BOMB_POWER;
      const riders = scaleApps(
        e.spec.inflicts,
        e.weight,
        INFLICT_PER_WEIGHT,
        // A fume is what a thrown brew is when it never caught: it does not
        // strike, it settles, and it settles for as long as it was fixed for.
        form === 'fume' ? duration : undefined,
      );
      if (form === 'fume') {
        inflicts.push(...riders);
        continue;
      }
      if (!e.spec.type) {
        bare += power;
        inflicts.push(...riders);
        continue;
      }
      const strike: SpellStrike = { type: e.spec.type, power };
      if (penetration > 0) strike.penetration = Math.min(0.95, penetration);
      if (riders.length) strike.inflicts = riders;
      strikes.push(strike);
    }
    // Whatever had no element still arrived: a bottle thrown hard is a bottle
    // thrown hard. Un-essenced brews land entirely this way.
    if (form === 'bomb') {
      const glass = bare + (list.length === 0 ? potency * BOMB_POWER : 0);
      if (glass > 0) strikes.push({ type: 'bludgeoning', power: glass });
    }
  } else if (form === 'oil') {
    // A coating. Everything here is PER BLOW: a small typed bite and the
    // substance's riders, carried by the edge until the oil wears off. The bite
    // is deliberately far under a flask's — an oil is about the same total harm
    // as a bomb, spread across blows you still have to land, and the riders are
    // the real reason to carry one.
    for (const e of list) {
      inflicts.push(...scaleApps(e.spec.inflicts, e.weight, INFLICT_PER_WEIGHT));
      if (!e.spec.type) continue;
      const strike: SpellStrike = { type: e.spec.type, power: potency * e.share * OIL_BITE };
      if (penetration > 0) strike.penetration = Math.min(0.95, penetration);
      strikes.push(strike);
    }
  } else if (kind.sustained) {
    for (const e of list) grants.push(...scaleApps(e.spec.grants, e.weight, GRANT_PER_WEIGHT, duration));
  } else if (form !== 'residue') {
    const pool = new Map<string, number>();
    for (const e of list) {
      for (const r of e.spec.restore ?? []) {
        pool.set(r.resource, (pool.get(r.resource) ?? 0) + potency * e.share * r.per);
      }
      if (form === 'salve') cures.push(...(e.spec.cures ?? []));
    }
    for (const [resource, amount] of pool) {
      restore.push({ resource: resource as BrewSpec['restore'][number]['resource'], amount });
    }
  }

  const blows =
    form === 'oil'
      ? Math.min(OIL_BLOWS.cap, Math.max(1, Math.round(OIL_BLOWS.base + potency * OIL_BLOWS.perPotency)))
      : undefined;

  // ---- The summary: what the steps add up to, and why it is this form. ----

  summary.push(
    medium === 'none'
      ? text('alchemy.sum.form_none')
      : text('alchemy.sum.form', {
          base: medium,
          volatility: num(volatility),
          state: text(volatility >= VOLATILE_AT ? 'alchemy.sum.roused' : 'alchemy.sum.calm'),
          form: kind.name,
        }),
  );
  if (raw > held) {
    summary.push(
      text('alchemy.sum.spill', { raw: num(raw), capacity: num(capacity), kept: pctOf(SPILL), potency: num(held) }),
    );
  }
  if (purity !== 1) summary.push(text('alchemy.sum.purity', { purity: num(purity), potency: num(potency) }));
  if (kind.sustained) {
    summary.push(
      banked > 0
        ? text('alchemy.sum.duration_banked', {
            seconds: Math.round(duration / 10),
            base: BREW_BASE_DURATION / 10,
            bonus: pctOf(banked * FIX_BANK),
            cap: BREW_MAX_DURATION / 10,
          })
        : text('alchemy.sum.duration', { seconds: Math.round(duration / 10) }),
    );
  }
  if (blows !== undefined) {
    summary.push(
      text('alchemy.sum.blows', { blows, base: OIL_BLOWS.base, per: OIL_BLOWS.perPotency, cap: OIL_BLOWS.cap }),
    );
  }
  // An essence only speaks in the registers its form reads. Name what this
  // form leaves unused, so an Ember Elixir with no effects is explained rather
  // than silent (ALCHEMY.md §7: a discarded payload is never silent).
  if (form !== 'residue') {
    const reads = FORM_READS[form];
    const unused: string[] = [];
    for (const e of list) {
      const lost: string[] = [];
      if (e.spec.type && !reads.includes('type')) lost.push(text('alchemy.register.damage', { type: e.spec.type }));
      if (e.spec.inflicts?.length && !reads.includes('inflicts')) lost.push(text('alchemy.register.afflictions'));
      if (e.spec.grants?.length && !reads.includes('grants')) lost.push(text('alchemy.register.buffs'));
      if (!reads.includes('restore')) {
        for (const r of e.spec.restore ?? []) {
          lost.push(text('alchemy.register.restore', { resource: RESOURCES[r.resource]?.name ?? r.resource }));
        }
      }
      if (e.spec.cures?.length && !reads.includes('cures')) lost.push(text('alchemy.register.cures'));
      if (lost.length) unused.push(`${e.spec.name} (${lost.join(', ')})`);
    }
    if (unused.length) {
      summary.push(
        text('alchemy.sum.unused', {
          form: `${/^[AEIOU]/.test(kind.name) ? 'an' : 'a'} ${kind.name}`,
          list: unused.join('; '),
        }),
      );
    }
  }

  const formula = formulaFor(steps.map((s) => s.id));
  const spec: BrewSpec = {
    name: formula?.name ?? brewName(form, list),
    icon: formula?.icon ?? kind.icon,
    form,
    medium,
    potency,
    capacity,
    volatility,
    duration,
    essences: list,
    strikes,
    inflicts,
    restore,
    grants,
    cures: [...new Set(cures)],
    value: Math.round(4 * potency + 3 * total + 5),
    notes,
    summary,
  };
  if (penetration > 0) spec.penetration = Math.min(0.95, penetration);
  if (blows !== undefined) spec.blows = blows;
  return spec;
}

/** Which forms each base can come out as, for the first step's line. */
const MEDIUM_FORMS: Record<BrewMedium, string> = {
  none: 'Residue',
  water: 'Elixir or Draught',
  oil: 'Salve or Oil',
  spirit: 'Fume or Flask',
};

/** The essence registers each form reads; everything else in it goes unused. */
const FORM_READS: Record<BrewForm, ('type' | 'inflicts' | 'grants' | 'restore' | 'cures')[]> = {
  bomb: ['type', 'inflicts'],
  fume: ['inflicts'],
  oil: ['type', 'inflicts'],
  elixir: ['grants'],
  draught: ['restore'],
  salve: ['restore', 'cures'],
  residue: [],
};

/**
 * The whole outcome table: solvent across, volatility down. Every solvent reads
 * volatility — oil settled is something you wear, oil roused is something the
 * blade wears.
 */
export function formOf(medium: BrewMedium, volatility: number): BrewForm {
  if (medium === 'none') return 'residue';
  const roused = volatility >= VOLATILE_AT;
  if (medium === 'oil') return roused ? 'oil' : 'salve';
  if (medium === 'water') return roused ? 'draught' : 'elixir';
  return roused ? 'bomb' : 'fume';
}

/** What a flask is. Nothing but its sequence decides it. */
export function resolveBrew(flask: BrewedFlask): BrewSpec {
  return composeBrew(flask.steps);
}

// ---------- Previewing and brewing ----------

export interface BrewCheck {
  ok: boolean;
  reason?: string;
  /** What would come out, if the sequence were worked as it stands. */
  spec?: BrewSpec;
  sequence?: GradedStack[];
  /** Set when the sequence is one somebody already wrote down. */
  formula?: string;
}

/** What this layout would brew, without spending anything. */
export function previewBrew(
  state: GameState,
  placement: Placement,
  disc: CraftDisciplineDef = ALCHEMY,
): BrewCheck {
  const level = skillLevel(state, disc);
  const sequence = sequenceOf(disc, placement);
  if (sequence.length < 2) return { ok: false, reason: text('alchemy.reason.too_short') };

  for (const step of sequence) {
    const def = REAGENTS[step.id];
    if (!def) return { ok: false, reason: text('alchemy.reason.not_a_reagent', { name: MATERIALS[step.id]?.name ?? step.id }) };
    if ((def.minLevel ?? 0) > level) {
      return { ok: false, reason: text('alchemy.reason.reagent_level', { name: def.name, level: def.minLevel }) };
    }
  }

  const check = checkCraft(state, disc, placement);
  if (!check.ok) return { ok: false, reason: check.reason };

  const spec = composeBrew(sequence);
  return { ok: true, spec, sequence, formula: formulaFor(sequence.map((s) => s.id))?.id };
}

export interface BrewResult {
  flask: BrewedFlask;
  spec: BrewSpec;
}

/**
 * Work the alembic. Spends the sequence and stocks the flask.
 *
 * There is no failure roll and no quality roll — the sequence IS the recipe,
 * and a badly written one produces residue rather than nothing. Losing the
 * reagents to a die on top of having sequenced them wrong would be punishing
 * twice for one mistake, which is the rule cooking already follows.
 */
export function brew(
  state: GameState,
  bus: EventBus,
  placement: Placement,
  disc: CraftDisciplineDef = ALCHEMY,
): BrewResult | null {
  const check = previewBrew(state, placement, disc);
  if (!check.ok || !check.spec || !check.sequence) {
    if (check.reason) bus.emit({ type: 'log', msg: text('common.locked', { reason: check.reason }), kind: 'danger' });
    return null;
  }
  if (!consumePlacement(state, disc, placement)) return null;

  const flask: BrewedFlask = { steps: check.sequence.map((s) => ({ ...s })) };
  state.flasks ??= [];
  state.flasks.push(flask);

  // A bench manifests the trade it teaches. It never did: `checkDiscovery`
  // was only ever reached from the craft ACTIVITY, whose bare 'craft' tag
  // every craft skill claimed — so cooking a stew manifested Smithing, and
  // the benches themselves manifested nothing. Now that each skill claims
  // only its own discipline, the bench has to say its own name.
  checkDiscovery(state, bus, [disc.tag]);
  grantSkillXp(
    state,
    bus,
    ['craft', disc.tag],
    disc.xp * (1 + check.sequence.length * 0.2),
    noveltyKeys(disc, placement),
  );

  // One prefix for the whole run: a tallied line groups several brews, and a
  // run that made one formula and one ordinary flask must not describe both as
  // known work. The 📜 rides the ENTRY instead.
  const spec = check.spec;
  // Quest familiarization hears bench work the same way it hears recipes.
  bus.emit({ type: 'craft', discipline: disc.id });
  logRepeat(bus, {
    group: `bench:${disc.id}`,
    prefix: '⚗️ Brewed:',
    tally: [{ label: `${spec.icon} ${spec.name}${check.formula ? ' 📜' : ''}`, qty: 1 }],
    kind: 'item',
  });
  return { flask, spec };
}

// ---------- Using what came out ----------

export function flaskCooldownLeft(state: GameState): number {
  return Math.max(0, (state.useCooldowns?.[FLASK_COOLDOWN_KEY] ?? 0) - state.totalTicks);
}

export interface FlaskCheck {
  ok: boolean;
  reason?: string;
}

export function canUseFlask(state: GameState, index: number): FlaskCheck {
  const flask = state.flasks?.[index];
  if (!flask) return { ok: false, reason: text('alchemy.reason.no_such_flask') };
  const spec = resolveBrew(flask);
  if (spec.form === 'residue') return { ok: false, reason: text('alchemy.reason.residue') };
  if (spec.form === 'oil' && !state.equipment.weapon) {
    return { ok: false, reason: text('alchemy.reason.no_weapon') };
  }
  if (BREW_FORMS[spec.form].thrown && !state.combat) {
    return { ok: false, reason: text('alchemy.reason.no_target') };
  }
  const left = flaskCooldownLeft(state);
  if (left > 0) return { ok: false, reason: text('alchemy.reason.cooldown', { seconds: (left / 10).toFixed(1) }) };
  return { ok: true };
}

/**
 * Use one flask, whichever way its form is used. Returns the brew that was
 * spent, or null when it could not be used at all — in which case nothing is
 * consumed, so a mis-click costs a flask nothing.
 *
 * All three halves — thrown, drunk and worked into a blade — go through here
 * because which one applies is a property of the SEQUENCE, not of a decision the
 * player makes afterwards. You do not choose to drink a bomb.
 */
export function useFlask(state: GameState, bus: EventBus, index: number): BrewSpec | null {
  const check = canUseFlask(state, index);
  if (!check.ok) {
    if (check.reason) bus.emit({ type: 'log', msg: text('common.locked', { reason: check.reason }), kind: 'danger' });
    return null;
  }
  const flask = state.flasks[index];
  const spec = resolveBrew(flask);
  state.flasks.splice(index, 1);
  state.useCooldowns ??= {};
  state.useCooldowns[FLASK_COOLDOWN_KEY] = state.totalTicks + FLASK_COOLDOWN;

  if (BREW_FORMS[spec.form].thrown) hurl(state, bus, spec);
  else if (spec.form === 'oil') anoint(state, bus, spec, flask);
  else swallow(state, bus, spec);

  grantAttrXp(state, bus, 'int', 1);
  return spec;
}

/**
 * Work an oil into the blade. One coating at a time — a second one wipes the
 * first off rather than layering, which keeps a satchel of oils a choice about
 * what this fight needs instead of a stacking ritual before every fight.
 */
function anoint(state: GameState, bus: EventBus, spec: BrewSpec, brew: BrewedFlask): void {
  const weapon = state.equipment.weapon!;
  const had = state.coating;
  state.coating = { brew, weaponUid: weapon.uid, blowsLeft: spec.blows ?? 1 };
  bus.emit({
    type: 'log',
    msg:
      text('alchemy.oiled', {
        icon: spec.icon,
        name: spec.name,
        weapon: itemName(weapon),
        blows: spec.blows,
        wiped: had ? text('alchemy.oil_wiped') : text('alchemy.oil_done'),
      }),
    kind: 'action',
  });
}

// ---------- What a coated blade carries ----------

/** One blow's worth of oil: typed bites for the swing, riders for what it hits. */
export interface CoatingBite {
  name: string;
  typed: { type: DamageType; value: number; source: string; penetration?: number }[];
  inflicts: StatusApplication[];
  /** True when that was the last blow the coating had in it. */
  exhausted: boolean;
}

/** The coating on the blade actually in hand, if the oil was worked into THAT one. */
export function activeCoating(state: GameState): { coat: WeaponCoating; spec: BrewSpec } | null {
  const coat = state.coating;
  if (!coat || coat.blowsLeft <= 0) return null;
  const weapon = state.equipment.weapon;
  if (!weapon || weapon.uid !== coat.weaponUid) return null;
  return { coat, spec: resolveBrew(coat.brew) };
}

/**
 * Spend one blow of the coating, and report what that blow carries. Returns
 * null when there is nothing on the blade — including when the blade that was
 * coated is not the one being swung.
 *
 * Called from the weapon path in combat, which is why nothing in here reaches
 * back into combat: it reads state, decrements, and answers.
 */
export function spendCoating(state: GameState): CoatingBite | null {
  const held = activeCoating(state);
  if (!held) return null;
  const { coat, spec } = held;
  coat.blowsLeft -= 1;
  const exhausted = coat.blowsLeft <= 0;
  if (exhausted) state.coating = null;
  return {
    name: spec.name,
    typed: spec.strikes.map((s) => ({
      type: s.type,
      value: s.power,
      source: spec.name,
      penetration: s.penetration,
    })),
    inflicts: spec.inflicts,
    exhausted,
  };
}

/** Drunk or worn: everything lands on the alchemist. */
function swallow(state: GameState, bus: EventBus, spec: BrewSpec): void {
  const stats = getDerivedStats(state);
  const gained: string[] = [];

  for (const r of spec.restore) {
    if (r.amount <= 0) continue;
    const before = state.resources[r.resource];
    if (r.resource === 'hp') heal(state, stats, r.amount, 'salve');
    else restoreResource(state, stats, r.resource, r.amount);
    const got = Math.round(state.resources[r.resource] - before);
    if (got > 0) gained.push(`+${got} ${RESOURCES[r.resource].name}`);
  }
  for (const app of spec.grants) {
    const inst = applyStatus(state, state, app, spec.name);
    if (inst) gained.push(STATUSES[inst.id]?.name ?? inst.id);
  }
  for (const tag of spec.cures) {
    const before = statusesOf(state).map((s) => s.id);
    fireStatusEvent(state, state, 'cure', { tag });
    const after = new Set(statusesOf(state).map((s) => s.id));
    for (const id of before) {
      if (!after.has(id)) gained.push(`cured ${STATUSES[id]?.name ?? id}`);
    }
  }

  bus.emit({
    type: 'log',
    msg: text(BREW_FORMS[spec.form].verb === 'Apply' ? 'alchemy.applied' : 'alchemy.drank', {
      icon: spec.icon,
      name: spec.name,
      gained: gained.length ? text('alchemy.gained', { list: gained.join(', ') }) : '',
    }),
    kind: 'action',
  });
}

/**
 * Thrown: a flask goes off on the formation, not on one enemy. It does not
 * scale with spell power and never will — this is chemistry, and the whole of
 * what it is worth was decided at the bench.
 */
function hurl(state: GameState, bus: EventBus, spec: BrewSpec): void {
  const c = state.combat;
  if (!c) return;
  feed(state, `${spec.icon} You throw ${spec.name}.`);

  for (let i = 0; i < c.enemies.length; i++) {
    const target = c.enemies[i];
    if (!target) continue;
    // The front slot takes the burst; the rest are caught by the edge of it.
    const share = i === 0 ? 1 : 0.5;
    let total = 0;
    for (const strike of spec.strikes) {
      const raw = strike.power * share * (0.9 + rand(state) * 0.2);
      const slice = monsterSlice(target, strike.type, spec.name, raw, strike.penetration ?? 0);
      total += slice.dealt;
      if (slice.dealt > 0) {
        for (const app of strike.inflicts ?? []) applyStatus(state, target, app, spec.name);
      }
    }
    // A fume has no blow to land behind — it settles on everyone regardless.
    for (const app of spec.inflicts) applyStatus(state, target, app, spec.name);

    if (total > 0) {
      // An ambushed target takes the burst harder (StatusDef.incomingBite);
      // the damageTaken event just below is what spends the surprise.
      const dealt = Math.max(1, Math.round(total * statusIncomingDamageMult(target)));
      target.hp -= dealt;
      fireStatusEvent(state, target, 'damageTaken');
      feed(state, `${spec.icon} ${spec.name} hits the ${target.name} for ${dealt}.`);
    } else if (spec.inflicts.length) {
      feed(state, `${spec.icon} ${spec.name} lands on the ${target.name}.`);
    }
  }

  grantSkillXp(state, bus, ['combat', 'craft', 'alchemy'], 4);
  sweepDead(state, bus);
}

// ---------- For the bench to read out ----------

/** The grade a sequence reads as, for a colour and a word. Display only. */
export function brewGrade(spec: BrewSpec): keyof typeof QUALITY_TIERS {
  const scale = spec.potency;
  if (scale >= 18) return 's';
  if (scale >= 12) return 'a';
  if (scale >= 8) return 'b';
  if (scale >= 5) return 'c';
  if (scale >= 2.5) return 'd';
  if (scale > 0) return 'e';
  return 'f';
}
