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

/** The counter a learned recipe stamps. */
export const recipeKey = (id: string): string => `recipe:${id}`;

/** The bench and outcome a recipe unlocks, or null for an unknown id. */
export function recipeOutcome(
  id: string,
): { disc: CraftDisciplineDef; outcome: CraftOutcomeDef } | null {
  for (const disc of Object.values(DISCIPLINES)) {
    const outcome = disc.outcomes.find((o) => o.recipe === id);
    if (outcome) return { disc, outcome };
  }
  return null;
}

/** A recipe as the player reads it: the dish's name. */
export function recipeName(id: string): string {
  return recipeOutcome(id)?.outcome.name ?? id;
}

/** Recipes the player knows for one bench, in data order. */
export function knownRecipes(state: GameState, disc: CraftDisciplineDef): CraftOutcomeDef[] {
  return disc.outcomes.filter((o) => o.recipe && knowsRecipe(state, o.recipe));
}

/** Whether the player has learned this recipe (from a recipe card). */
export function knowsRecipe(state: GameState, id: string): boolean {
  return (state.stats[recipeKey(id)] ?? 0) > 0;
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

// ---------- Heat windows ----------

/** The duration a timed bench cooks for: the chosen one, or its default. */
export function timelineUnits(disc: CraftDisciplineDef, duration?: number): number | undefined {
  return disc.timeline ? (duration ?? disc.timeline.default) : undefined;
}

/**
 * The mean exposure, in timeline units, of the placed parts carrying `tag`:
 * duration × (1 − slot.at) per part, over timed slots only. Null when the bench
 * has no timeline or no timed part carries the tag. A part in a slot without
 * `at` (seasoning, cookware) stands outside time and is not counted.
 */
export function meanExposure(
  disc: CraftDisciplineDef,
  placement: Placement,
  tag: string,
  duration?: number,
): number | null {
  const units = timelineUnits(disc, duration);
  if (units === undefined) return null;
  let sum = 0;
  let n = 0;
  for (const [slotId, part] of Object.entries(placement)) {
    if (!part) continue;
    const at = disc.slots.find((s) => s.id === slotId)?.at;
    if (at == null || !craftTagsOf(part.id).includes(tag)) continue;
    sum += units * (1 - at);
    n++;
  }
  return n > 0 ? sum / n : null;
}

/** Whether a mean exposure lies in the half-open window [from, to). */
export function inHeatWindow(mean: number, window: { from?: number; to?: number }): boolean {
  return (window.from === undefined || mean >= window.from) && (window.to === undefined || mean < window.to);
}

/**
 * A hypothetical mean exposure for one tag, in timeline units. The UI's
 * cook-time row asks "what would this basket make if its meat averaged 9
 * units?" without moving any ingredient (`matchOutcome`'s last argument).
 */
export interface HeatOverride {
  tag: string;
  mean: number;
}

/** Whether a layout satisfies every heat window an outcome declares. */
function heatMatches(
  o: CraftOutcomeDef,
  disc: CraftDisciplineDef,
  placement: Placement,
  duration?: number,
  override?: HeatOverride,
): boolean {
  return (o.heat ?? []).every((w) => {
    const mean = override?.tag === w.tag ? override.mean : meanExposure(disc, placement, w.tag, duration);
    return mean !== null && inHeatWindow(mean, w);
  });
}

/** A window in the words the bench uses: "under 6", "14 or more", "8 to 14". */
export function describeHeatWindow(window: { from?: number; to?: number }): string {
  const { from, to } = window;
  if (from !== undefined && to !== undefined) return `${from} to ${to}`;
  if (to !== undefined) return `under ${to}`;
  return `${from ?? 0} or more`;
}

/** Every way to choose `size` of `items`, order ignored. */
function subsetsOf<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [[]];
  if (items.length < size) return [];
  const [head, ...rest] = items;
  return [...subsetsOf(rest, size - 1).map((tail) => [head, ...tail]), ...subsetsOf(rest, size)];
}

/**
 * Problems with the heat windows on one bench, as plain sentences keyed by
 * outcome id. Shared by `tests/content.test.ts` and `forge/lib/validate.ts`, so
 * the two layers cannot drift. `materials` is the material registry being
 * checked (the live one, or the forge's staged copy).
 *
 *  - A windowed outcome needs a bench with a `timeline`.
 *  - A window must not be empty (`from` at or above `to`).
 *  - Each windowed outcome needs a window-less fallback on the same bench: lower
 *    priority, no recipe, level, or grade gate, and requirements the windowed
 *    outcome's own requirements already cover. Without one, a player outside
 *    every window, or without the recipe card, would cook something other than
 *    what the same basket makes today.
 *  - Every window is reachable: some timeline option and some choice of open
 *    slots at the outcome's level put the tagged parts' MEAN exposure inside it.
 *    A tag the outcome requires `count` times is tried over every `count` slots
 *    that can hold it (a count above the number of slots is unreachable). When
 *    an outcome declares several windows, one option must reach all of them
 *    (distinct slots across windows are not checked).
 */
export function heatWindowProblems(
  disc: CraftDisciplineDef,
  materials: Record<string, { craftTags?: string[] }>,
): { outcome: string; message: string }[] {
  const problems: { outcome: string; message: string }[] = [];
  const stock = Object.values(materials);
  for (const o of disc.outcomes) {
    const windows = o.heat ?? [];
    if (windows.length === 0) continue;
    const say = (message: string) => problems.push({ outcome: o.id, message });
    if (!disc.timeline) {
      say(`${disc.id}/${o.id} has heat windows, but ${disc.id} has no timeline`);
      continue;
    }
    for (const w of windows) {
      if (w.from !== undefined && w.to !== undefined && w.from >= w.to) {
        say(`${disc.id}/${o.id}: the window on '${w.tag}' is empty (from ${w.from} is not below to ${w.to})`);
      }
    }

    const demand = (tag: string) =>
      o.requires.filter((r) => r.tag === tag).reduce((sum, r) => sum + (r.count ?? 1), 0);
    const fallback = disc.outcomes.find(
      (f) =>
        f !== o &&
        !f.heat?.length &&
        !f.recipe &&
        !f.minLevel &&
        !f.minQuality &&
        !f.maxQuality &&
        (f.priority ?? 0) < (o.priority ?? 0) &&
        f.requires.every((r) => demand(r.tag) >= (r.count ?? 1)),
    );
    if (!fallback) {
      say(
        `${disc.id}/${o.id} has no window-less fallback: needs an outcome of lower priority on this bench, ` +
          `with no recipe, minLevel, minQuality or maxQuality, whose requires its own requires cover`,
      );
    }

    const level = o.minLevel ?? 0;
    const entries = disc.slots.filter(
      (s) => s.at != null && slotPicks(s) === 'material' && (s.unlockLevel ?? 0) <= level,
    );
    const holders = (tag: string) =>
      entries.filter((s) =>
        stock.some((m) => {
          const tags = m.craftTags ?? [];
          return tags.includes(tag) && s.accepts.some((a) => tags.includes(a));
        }),
      );
    // Matching reads the MEAN over every tagged part, and the outcome needs at
    // least `count` of them, so a window is reachable when some `count` slots
    // average inside it: one slot landing there is not enough once two parts
    // have to carry the tag.
    const need = (tag: string) => Math.max(1, demand(tag));
    const reachable = disc.timeline.options.some((opt) =>
      windows.every((w) =>
        subsetsOf(holders(w.tag), need(w.tag)).some((set) =>
          inHeatWindow(set.reduce((sum, s) => sum + opt.units * (1 - s.at!), 0) / set.length, w),
        ),
      ),
    );
    if (!reachable) {
      const named = windows
        .map((w) => `${need(w.tag) > 1 ? `${need(w.tag)} × ` : ''}'${w.tag}' ${describeHeatWindow(w)}`)
        .join(' and ');
      say(
        `${disc.id}/${o.id}: no timeline option and entry slot open at level ${level} puts a part inside ` +
          `${named} — the dish could never be made`,
      );
    }
  }
  return problems;
}

/**
 * Problems with the `food` flag and Signatures, as plain sentences keyed by
 * material id. Shared by `tests/content.test.ts` and `forge/lib/validate.ts`
 * like `heatWindowProblems`. `statusIds` is the condition registry being checked
 * (optional: without it only the id-free rules run).
 *
 *  - Food is exactly what a cooking-skill bench makes: every material a bench
 *    with `skill: 'cooking'` produces is marked `consumable.food`, and nothing
 *    else is. An alchemy flask or a salve marked food would be scaled by the
 *    cook's skill; a dish left unmarked would not be.
 *  - A Signature belongs to food only, names real conditions, and repeats none
 *    of the dish's own grants (a second dose of a `highest` condition adds
 *    nothing).
 *  - Every dish carries one, except the bench's failure dish (a material only
 *    ever made by outcomes with `maxQuality`, like the Scorched Mess), which
 *    carries none.
 */
export function foodProblems(
  disciplines: CraftDisciplineDef[],
  materials: Record<string, MaterialDef>,
  statusIds?: ReadonlySet<string>,
): { material: string; message: string }[] {
  const problems: { material: string; message: string }[] = [];
  const say = (material: string, message: string) => problems.push({ material, message });

  const made = new Map<string, { from: string[]; failureOnly: boolean }>();
  for (const disc of disciplines) {
    if (disc.skill !== 'cooking') continue;
    for (const o of disc.outcomes) {
      if (o.result.kind !== 'material') continue;
      const entry = made.get(o.result.id) ?? { from: [], failureOnly: true };
      entry.from.push(`${disc.id}/${o.id}`);
      if (!o.maxQuality) entry.failureOnly = false;
      made.set(o.result.id, entry);
    }
  }

  for (const [id, entry] of made) {
    const mat = materials[id];
    if (!mat) continue; // an unresolved result is another lint's problem
    const spec = mat.consumable;
    if (!spec?.food) {
      say(id, `'${id}' is made by ${entry.from.join(', ')}, a cooking bench, but is not marked food`);
    } else if (entry.failureOnly && spec.signature?.length) {
      say(id, `'${id}' is a failure dish (only ${entry.from.join(', ')} make it) and carries a signature`);
    } else if (!entry.failureOnly && !spec.signature?.length) {
      say(id, `'${id}' is a dish and has no signature`);
    }
  }

  for (const mat of Object.values(materials)) {
    const spec = mat.consumable;
    if (!spec) continue;
    if (spec.food && !made.has(mat.id)) {
      say(mat.id, `'${mat.id}' is marked food but no cooking bench makes it`);
    }
    if (spec.signature?.length && !spec.food) {
      say(mat.id, `'${mat.id}' has a signature but is not food`);
    }
    const own = new Set((spec.grants ?? []).map((g) => g.id));
    for (const sig of spec.signature ?? []) {
      if (statusIds && !statusIds.has(sig.id)) say(mat.id, `'${mat.id}' signature names unknown condition '${sig.id}'`);
      if (own.has(sig.id)) say(mat.id, `'${mat.id}' signature repeats its own grant '${sig.id}'`);
    }
  }
  return problems;
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
 *
 * `duration` is a timed bench's chosen length (its default when absent); only
 * outcomes with `heat` windows read it. A bench without a timeline never
 * matches a windowed outcome. `override` replaces the measured mean exposure of
 * one tag with a stated one, for read-only what-ifs; the match is otherwise the
 * same, and nothing is changed.
 */
export function matchOutcome(
  state: GameState,
  disc: CraftDisciplineDef,
  placement: Placement,
  duration?: number,
  override?: HeatOverride,
): CraftOutcomeDef | undefined {
  const counts = tagCounts(placement);
  const level = skillLevel(state, disc);
  const best = bestQuality(placement);

  const matches = disc.outcomes.filter((o) => {
    if ((o.minLevel ?? 0) > level) return false;
    if (o.recipe && !knowsRecipe(state, o.recipe)) return false;
    if (o.minQuality && (!best || !qualityAtLeast(best, o.minQuality))) return false;
    if (o.maxQuality && best && qualityRank(best) > qualityRank(o.maxQuality)) return false;
    if (!o.requires.every((r) => (counts.get(r.tag) ?? 0) >= (r.count ?? 1))) return false;
    return heatMatches(o, disc, placement, duration, override);
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

/** Whether the bench as laid out could actually be worked (`duration`: see matchOutcome). */
export function checkCraft(
  state: GameState,
  disc: CraftDisciplineDef,
  placement: Placement,
  duration?: number,
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

  const outcome = matchOutcome(state, disc, placement, duration);
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
