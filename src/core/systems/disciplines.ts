import type {
  CraftDisciplineDef,
  CraftOutcomeDef,
  CraftSlotDef,
  GameState,
  GradedStack,
  MaterialDef,
  QualityTier,
} from '../types';
import { MATERIALS } from '../data/materials.data';
import { DISCIPLINES } from '../data/disciplines.data';
import { QUALITY_ORDER, qualityAtLeast, qualityMult, qualityRank } from '../data/quality.data';
import { weightedPick } from '../engine/rng';
import { text } from '../text/log';

/**
 * Modular crafting.
 *
 * A discipline is a bench with SLOTS. What you put in them decides what comes
 * out — matched by tag, not by looking up a recipe — which is what lets one
 * system serve cooking, runecarving, alchemy, mutagens and eventually
 * spellcrafting without any of them being special-cased here.
 *
 * Three things are deliberately kept apart:
 *
 *  - **The discipline** is content: its slots, what they accept, what
 *    combinations produce. It knows nothing about progression.
 *  - **Its skill** is progression: it gates which slots exist, which outcomes
 *    may be attempted, and how much a carver gets out of the same stone.
 *  - **The result's meaning** belongs to whatever owns it. This module hands
 *    back a `CraftResult` and stops; systems/runes.ts is what knows how a
 *    pattern and some gold leaf become a rune.
 */

export function discipline(id: string): CraftDisciplineDef | undefined {
  return DISCIPLINES[id];
}

export function skillLevel(state: GameState, disc: CraftDisciplineDef): number {
  return state.skills[disc.skill]?.level ?? 0;
}

// ---------- Slots ----------

/**
 * The slots actually open right now. This is how a discipline widens as its
 * skill grows — cooking's third ingredient, a carver's second pattern — with
 * nothing but a number in the data.
 */
export function openSlots(state: GameState, disc: CraftDisciplineDef): CraftSlotDef[] {
  const level = skillLevel(state, disc);
  return disc.slots.filter((s) => (s.unlockLevel ?? 0) <= level);
}

/** The next slot the skill will open, and at what level — for the UI to tease. */
export function nextSlot(
  state: GameState,
  disc: CraftDisciplineDef,
): { slot: CraftSlotDef; level: number } | undefined {
  const level = skillLevel(state, disc);
  const locked = disc.slots
    .filter((s) => (s.unlockLevel ?? 0) > level)
    .sort((a, b) => (a.unlockLevel ?? 0) - (b.unlockLevel ?? 0));
  return locked.length ? { slot: locked[0], level: locked[0].unlockLevel! } : undefined;
}

/** What a material carries into a discipline's slots. */
export function craftTagsOf(materialId: string): string[] {
  return MATERIALS[materialId]?.craftTags ?? [];
}

/** Whether a material is allowed in this slot at all. */
export function slotAccepts(slot: CraftSlotDef, materialId: string): boolean {
  const tags = craftTagsOf(materialId);
  return slot.accepts.some((t) => tags.includes(t));
}

/** What a slot draws its options from. Materials unless it says otherwise. */
export function slotPicks(slot: CraftSlotDef): 'material' | 'design' | 'tool' {
  return slot.picks ?? 'material';
}

/** Whether working the bench spends what is in this slot. Tools survive. */
export function slotConsumes(slot: CraftSlotDef): boolean {
  return slot.consumed ?? slotPicks(slot) === 'material';
}

/** Open slots that hold materials (as opposed to designs or implements). */
export function materialSlots(state: GameState, disc: CraftDisciplineDef): CraftSlotDef[] {
  return openSlots(state, disc).filter((s) => slotPicks(s) === 'material');
}

// ---------- Graded stock ----------

export function isGraded(materialId: string): boolean {
  return MATERIALS[materialId]?.graded === true;
}

/** How many of a material at a given grade the player holds. */
export function stockOf(state: GameState, id: string, quality: QualityTier): number {
  return state.stock?.[id]?.[quality] ?? 0;
}

/** Every grade the player holds of a material, best first. */
export function gradesHeld(state: GameState, id: string): { quality: QualityTier; qty: number }[] {
  const held = state.stock?.[id] ?? {};
  return QUALITY_ORDER.map((q) => ({ quality: q, qty: held[q] ?? 0 }))
    .filter((e) => e.qty > 0)
    .reverse();
}

export function grantGraded(state: GameState, id: string, quality: QualityTier, qty = 1): void {
  state.stock ??= {};
  state.stock[id] ??= {};
  const bucket = state.stock[id];
  bucket[quality] = (bucket[quality] ?? 0) + qty;
}

export function takeGraded(state: GameState, id: string, quality: QualityTier, qty = 1): boolean {
  const have = stockOf(state, id, quality);
  if (have < qty) return false;
  const bucket = state.stock[id]!;
  if (have - qty > 0) bucket[quality] = have - qty;
  else delete bucket[quality];
  if (Object.keys(bucket).length === 0) delete state.stock[id];
  return true;
}

/** Materials this discipline can actually use, for the bench's pickers. */
export function usableIn(state: GameState, slot: CraftSlotDef): MaterialDef[] {
  return Object.values(MATERIALS).filter(
    (m) => slotAccepts(slot, m.id) && gradesHeld(state, m.id).length > 0,
  );
}

/**
 * How often each grade turns up. Weighted hard toward the middle: most of what
 * you pick up is unremarkable, refuse is common enough to be a real nuisance,
 * and S-tier is meant to stop you in your tracks.
 */
const GRADE_WEIGHTS: Record<QualityTier, number> = {
  f: 10,
  e: 20,
  d: 32,
  c: 24,
  b: 10,
  a: 3.4,
  s: 0.6,
};

/**
 * Roll what grade a found thing is. `luck` shifts the whole distribution
 * upward — it is the player's loot stat, so a lucky forager genuinely finds
 * better ingredients rather than merely more of them.
 */
export function rollQuality(state: GameState, luck = 1): QualityTier {
  const entries = QUALITY_ORDER.map((q) => ({
    q,
    // Weight better grades up by luck, worse grades down by it.
    weight: GRADE_WEIGHTS[q] * Math.pow(Math.max(0.1, luck), (qualityRank(q) - 2) / 2),
  }));
  return weightedPick(state, entries).q;
}

/**
 * Put a material into stock, wherever it belongs. Graded materials get a rolled
 * grade and go into `state.stock`; everything else stays a plain count. Every
 * source of materials — loot, gathering, quest rewards — comes through here so
 * that opting a material into grading is a one-line content change.
 */
export function grantMaterial(
  state: GameState,
  id: string,
  qty = 1,
  luck = 1,
): { quality?: QualityTier } {
  if (!isGraded(id)) {
    state.materials[id] = (state.materials[id] ?? 0) + qty;
    return {};
  }
  // Each one is found separately, so a stack of five can hold five grades.
  let last: QualityTier = 'c';
  for (let i = 0; i < qty; i++) {
    last = rollQuality(state, luck);
    grantGraded(state, id, last, 1);
  }
  return { quality: qty === 1 ? last : undefined };
}

// ---------- Resolving a combination ----------

/** What the player has laid out on the bench, slot id → what is in it. */
export type Placement = Record<string, GradedStack | undefined>;

export function placed(placement: Placement): GradedStack[] {
  return Object.values(placement).filter((v): v is GradedStack => !!v);
}

/**
 * How good the combination is overall: the mean of what went in, weighted by
 * the tier multipliers. One piece of refuse drags the whole thing down, which
 * is the point of F being negative.
 */
export function combinedQuality(placement: Placement): number {
  const parts = placed(placement);
  if (!parts.length) return 0;
  return parts.reduce((sum, p) => sum + qualityMult(p.quality), 0) / parts.length;
}

/** The best single grade on the bench — what `minQuality` outcomes test. */
export function bestQuality(placement: Placement): QualityTier | undefined {
  const parts = placed(placement);
  if (!parts.length) return undefined;
  return parts.reduce((best, p) => (qualityRank(p.quality) > qualityRank(best) ? p.quality : best), 'f' as QualityTier);
}

/** Every craft tag present across the whole bench, with counts. */
function tagCounts(placement: Placement): Map<string, number> {
  const counts = new Map<string, number>();
  for (const part of placed(placement)) {
    for (const tag of craftTagsOf(part.id)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return counts;
}

/** Only what is spent INTO the result — a tool is not part of what you made. */
export function consumedParts(disc: CraftDisciplineDef, placement: Placement): GradedStack[] {
  const spend = new Set(disc.slots.filter((s) => slotConsumes(s)).map((s) => s.id));
  return Object.entries(placement)
    .filter(([id, v]) => v && spend.has(id))
    .map(([, v]) => v!);
}

/**
 * What this combination makes. Outcomes state what they need as tags, so the
 * data describes recipes without enumerating them; the most specific match
 * wins, and ties break on how much the outcome demanded.
 */
export function matchOutcome(
  state: GameState,
  disc: CraftDisciplineDef,
  placement: Placement,
): CraftOutcomeDef | undefined {
  const counts = tagCounts(placement);
  const level = skillLevel(state, disc);
  const best = bestQuality(placement);

  const matches = disc.outcomes.filter((o) => {
    if ((o.minLevel ?? 0) > level) return false;
    if (o.minQuality && (!best || !qualityAtLeast(best, o.minQuality))) return false;
    if (o.maxQuality && best && qualityRank(best) > qualityRank(o.maxQuality)) return false;
    return o.requires.every((r) => (counts.get(r.tag) ?? 0) >= (r.count ?? 1));
  });

  return matches.sort(
    (a, b) =>
      (b.priority ?? 0) - (a.priority ?? 0) ||
      b.requires.length - a.requires.length,
  )[0];
}

// ---------- Doing the work ----------

export interface CraftCheck {
  ok: boolean;
  /** Why not, when it isn't. */
  reason?: string;
  outcome?: CraftOutcomeDef;
}

/** Whether the bench as laid out could actually be worked. */
export function checkCraft(
  state: GameState,
  disc: CraftDisciplineDef,
  placement: Placement,
): CraftCheck {
  const open = openSlots(state, disc);
  // Slots that spend the same material at the same grade draw on one stack:
  // two slots of grade-D meat need two grade-D meat, not one seen twice.
  const demand = new Map<string, number>();

  for (const slot of open) {
    const put = placement[slot.id];
    if (!put) {
      if (slot.optional) continue;
      return { ok: false, reason: text('disciplines.reason.slot_empty', { slot: slot.name }) };
    }
    // Designs and tools are validated by whoever owns their catalogue; only
    // materials are checked against tags and stock here.
    if (slotPicks(slot) !== 'material') continue;
    const name = MATERIALS[put.id]?.name ?? put.id;
    if (!slotAccepts(slot, put.id)) {
      return { ok: false, reason: text('disciplines.reason.wrong_slot', { name, slot: slot.name }) };
    }
    const held = stockOf(state, put.id, put.quality);
    if (held < 1) {
      return { ok: false, reason: text('disciplines.reason.no_stock_at_grade', { name }) };
    }
    if (!slotConsumes(slot)) continue;
    const key = `${put.id}:${put.quality}`;
    const need = (demand.get(key) ?? 0) + 1;
    demand.set(key, need);
    if (held < need) {
      return { ok: false, reason: text('disciplines.reason.short_at_grade', { name, held, need }) };
    }
  }
  // Anything placed in a slot that isn't open yet is not a legal layout.
  for (const id of Object.keys(placement)) {
    if (placement[id] && !open.some((s) => s.id === id)) {
      return { ok: false, reason: text('disciplines.reason.slot_locked') };
    }
  }

  const outcome = matchOutcome(state, disc, placement);
  if (!outcome) return { ok: false, reason: text('disciplines.reason.no_outcome') };
  return { ok: true, outcome };
}

/**
 * Spend what is on the bench. Only called once the check has passed, so every
 * take is expected to succeed; a false return means the stock moved underneath
 * us and the caller should abandon the craft rather than hand out a free result.
 */
export function consumePlacement(
  state: GameState,
  disc: CraftDisciplineDef,
  placement: Placement,
): boolean {
  const spend = new Set(
    disc.slots.filter((s) => slotConsumes(s)).map((s) => s.id),
  );
  const parts = Object.entries(placement)
    .filter(([id, v]) => v && spend.has(id))
    .map(([, v]) => v!);
  const taken: GradedStack[] = [];
  for (const part of parts) {
    if (takeGraded(state, part.id, part.quality)) taken.push(part);
    else {
      // Put back whatever we already took — a half-spent bench is worse than
      // a refused craft.
      for (const back of taken) grantGraded(state, back.id, back.quality);
      return false;
    }
  }
  return true;
}

/**
 * The novelty keys a completed craft should credit — the combination as a
 * whole, and every part of it separately.
 *
 * This is what NOVELTY_DOMAINS.md called for and could not express: a craft
 * teaches you about the pattern AND about each thing you tried in it, each
 * wearing down at its own rate. Breadth pays; repetition dulls.
 *
 * On an ORDERED bench the combination key keeps its order, so that discovering
 * what salt does to a roused brew teaches you nothing about what it does to a
 * still one. On every other bench it is sorted, because there the same parts
 * laid out differently genuinely are the same craft.
 */
export function noveltyKeys(disc: CraftDisciplineDef, placement: Placement): string[] {
  const parts = disc.ordered
    ? disc.slots.map((s) => placement[s.id]).filter((p): p is GradedStack => !!p)
    : placed(placement);
  const ids = parts.map((p) => p.id);
  const combo = (disc.ordered ? ids : [...ids].sort()).join(disc.ordered ? '>' : '+');
  return [`${disc.id}:${combo}`, ...parts.map((p) => `${disc.id}:part:${p.id}`)];
}
