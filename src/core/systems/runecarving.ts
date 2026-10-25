import type { CarvedRune, GameState, GradedStack, QualityTier } from '../types';
import type { EventBus } from '../engine/events';
import { chance } from '../engine/rng';
import { DISCIPLINES } from '../data/disciplines.data';
import { RUNE_PATTERNS } from '../data/runes.data';
import { MATERIALS } from '../data/materials.data';
import { QUALITY_TIERS, qualityAtLeast, qualityMult } from '../data/quality.data';
import { checkDiscovery, grantSkillXp } from './skills';
import { namedRuneFor, resolveRune } from './runes';
import {
  checkCraft,
  consumePlacement,
  noveltyKeys,
  openSlots,
  placed,
  skillLevel,
  slotPicks,
  type Placement,
} from './disciplines';
import { text } from '../text/log';

/**
 * Runecarving: the first discipline built on the modular framework.
 *
 * What the framework does not know, and this module does, is what a carving
 * MEANS — that the slab is what gets cut, that the middle slots hold patterns
 * the carver knows rather than things they own, and that the tool is worked
 * WITH rather than into the result.
 *
 * The tool lowers the chance the slab splits, and does nothing else. It leaves
 * no mark on the finished rune. A rune is a record of what it is made of, so a
 * tool that changed the result invisibly would break the promise that you can
 * hand somebody a rune and they can work out what it is. The same inputs make
 * the same rune; the only roll at the bench is whether the slab splits.
 */

export const RUNECARVING = DISCIPLINES.runecarving;

/** How many times each pattern appears, in first-appearance order. */
export function countPatterns(patterns: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of patterns) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/**
 * How good the slab must be to take the same pattern more than once.
 *
 * Repeating a cut is how a carver concentrates a rune rather than broadening
 * it, and a poor slab simply cannot hold two of the same figure without the
 * lines running into each other. Keyed by how many copies of one pattern.
 */
export const REPEAT_MIN_QUALITY: Record<number, QualityTier> = {
  2: 'b',
  3: 'a',
};

/** Patterns the carver is skilled enough to attempt. */
export function availablePatterns(state: GameState) {
  const level = skillLevel(state, RUNECARVING);
  return Object.values(RUNE_PATTERNS).filter((p) => (p.minLevel ?? 0) <= level);
}

/** The pattern slots currently open, in the order the bench draws them. */
export function patternSlots(state: GameState) {
  return openSlots(state, RUNECARVING).filter((s) => slotPicks(s) === 'design');
}

// ---------- What the tool buys ----------

/** Failure chance with no tool at all, before skill. */
export const BASE_FAILURE = 0.3;
/** Each pattern beyond the first is another thing that can go wrong. */
export const FAILURE_PER_EXTRA_PATTERN = 0.12;
/** Each level of Runecarving shaves this much off the remaining risk. */
export const FAILURE_PER_LEVEL = 0.02;

/**
 * How likely the slab is to split. A tool is the single biggest thing a carver
 * can do about it — bare-handed work on a three-pattern slab is a coin toss,
 * and a steel burin makes it routine.
 */
export function failureChance(state: GameState, placement: Placement): number {
  const patterns = patternSlots(state).filter((s) => placement[s.id]).length;
  const tool = placement.tool;
  // An F tool counts as no tool; it must never make the split chance worse.
  const toolGrade = tool ? Math.max(0, qualityMult(tool.quality)) : 0;

  let risk = BASE_FAILURE + Math.max(0, patterns - 1) * FAILURE_PER_EXTRA_PATTERN;
  risk -= skillLevel(state, RUNECARVING) * FAILURE_PER_LEVEL;
  // A tool removes a share of whatever risk is left rather than a flat amount,
  // so it stays worth having at every skill level.
  risk *= 1 - Math.min(0.85, toolGrade * 0.28);
  // No permanent floor: a master carver with a good tool genuinely stops
  // splitting slabs. Mastery ought to be able to finish the job.
  return Math.max(0, Math.min(0.95, risk));
}

// ---------- Previewing and carving ----------

export interface CarveCheck {
  ok: boolean;
  reason?: string;
  /** What would come out, if the cut went well. */
  preview?: CarvedRune;
  failure?: number;
}

/** Everything on the bench that is worked INTO the slab (not the slab, not the tool). */
function adornmentsOf(state: GameState, placement: Placement): GradedStack[] {
  return openSlots(state, RUNECARVING)
    .filter((s) => s.role === 'adornment' && slotPicks(s) === 'material')
    .map((s) => placement[s.id])
    .filter((a): a is GradedStack => !!a);
}

/** Build the carving this layout would produce, without spending anything. */
export function previewCarve(state: GameState, placement: Placement): CarveCheck {
  const level = skillLevel(state, RUNECARVING);
  const patterns: string[] = [];

  for (const slot of patternSlots(state)) {
    const chosen = placement[slot.id];
    if (!chosen) continue;
    const pattern = RUNE_PATTERNS[chosen.id];
    if (!pattern) return { ok: false, reason: text('runecarving.reason.no_such_pattern') };
    if ((pattern.minLevel ?? 0) > level) {
      return { ok: false, reason: text('runecarving.reason.pattern_level', { name: pattern.name, level: pattern.minLevel }) };
    }
    patterns.push(chosen.id);
  }
  if (patterns.length === 0) return { ok: false, reason: text('runecarving.reason.nothing_chosen') };

  // A Refuse (F) grade multiplies below zero: it would subtract from the rune.
  // Refused here so no new carving is ever made from one.
  const slab = placement.slab;
  if (slab && qualityMult(slab.quality) < 0) {
    return { ok: false, reason: text('runecarving.reason.slab_refuse') };
  }
  const adornments = adornmentsOf(state, placement);
  for (const a of adornments) {
    if (qualityMult(a.quality) < 0) {
      return { ok: false, reason: text('runecarving.reason.adornment_refuse', { name: MATERIALS[a.id]?.name ?? a.id }) };
    }
  }

  // Repeating a cut concentrates the rune, and needs a slab that can hold it.
  for (const [id, copies] of countPatterns(patterns)) {
    if (copies < 2) continue;
    const needed = REPEAT_MIN_QUALITY[copies];
    if (!needed) {
      // No entry in REPEAT_MIN_QUALITY: past the most copies any slab can hold.
      const max = Math.max(...Object.keys(REPEAT_MIN_QUALITY).map(Number));
      return { ok: false, reason: text('runecarving.reason.too_many_copies', { max }) };
    }
    if (!slab || !qualityAtLeast(slab.quality, needed)) {
      return {
        ok: false,
        reason: text('runecarving.reason.slab_grade', { copies, name: RUNE_PATTERNS[id].name, grade: QUALITY_TIERS[needed].name }),
      };
    }
  }

  const check = checkCraft(state, RUNECARVING, placement);
  if (!check.ok) return { ok: false, reason: check.reason };

  const stone = placement.slab;
  if (!stone) return { ok: false, reason: text('runecarving.reason.no_slab') };

  return {
    ok: true,
    preview: { patterns, stone, adornments },
    failure: failureChance(state, placement),
  };
}

export interface CarveResult {
  carved?: CarvedRune;
  failed?: boolean;
}

/**
 * Cut the runes. Spends the bench either way — a split slab is still a spent
 * slab — and pays the skill for what the attempt taught, which is why a failed
 * carving is a setback rather than a waste.
 */
export function carveRune(
  state: GameState,
  bus: EventBus,
  placement: Placement,
): CarveResult | null {
  const check = previewCarve(state, placement);
  if (!check.ok || !check.preview) {
    if (check.reason) bus.emit({ type: 'log', msg: text('common.locked', { reason: check.reason }), kind: 'danger' });
    return null;
  }
  if (!consumePlacement(state, RUNECARVING, placement)) return null;

  const keys = noveltyKeys(RUNECARVING, placement);
  const tags = ['craft', RUNECARVING.tag];
  // The bench names its own trade — see the note in cooking.ts.
  checkDiscovery(state, bus, [RUNECARVING.tag]);

  // The slab split. Half the lesson still lands.
  if (chance(state, check.failure ?? 0)) {
    grantSkillXp(state, bus, tags, RUNECARVING.xp * 0.4, keys);
    bus.emit({
      type: 'log',
      msg: text('runecarving.slab_split'),
      kind: 'danger',
    });
    return { failed: true };
  }

  const carving = check.preview;

  state.carved ??= [];
  state.carved.push(carving);
  const rune = resolveRune(carving);
  const named = namedRuneFor(carving);

  grantSkillXp(state, bus, tags, RUNECARVING.xp * (1 + placed(placement).length * 0.25), keys);
  bus.emit({
    type: 'log',
    msg: named
      ? text('runecarving.carved_named', { icon: rune.icon, name: rune.name })
      : text('runecarving.carved', { icon: rune.icon, name: rune.name }),
    kind: 'item',
  });
  return { carved: carving };
}
