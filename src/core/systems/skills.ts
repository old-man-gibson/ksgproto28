import type {
  GameState,
  NoveltyDomain,
  NoveltySpec,
  ProgressionBand,
  SkillCategoryDef,
  SkillDef,
} from '../types';
import { SKILL_CATEGORIES } from '../types';
import type { EventBus } from '../engine/events';
import { SKILLS } from '../registry';
import { DEFAULT_PROGRESSION } from '../data/progression.data';
import { bandedXpNeeded, settleLevels } from './progression';
import { getDerivedStats } from './derived';
import { conditionsMet } from './conditions';

/** The curve a skill levels on — its own bands, or the default shape. */
export function skillProgression(skillId: string): ProgressionBand[] {
  return SKILLS[skillId]?.progression ?? DEFAULT_PROGRESSION;
}

/**
 * XP to take `skillId` from `level` to the next. Skills no longer share one
 * curve: a skill's `progression` bands decide both what a level costs and how
 * that cost escalates as it crosses its tiers (see systems/progression.ts).
 */
export function skillXpNeeded(skillId: string, level: number): number {
  return bandedXpNeeded(skillProgression(skillId), level);
}

export function isUnlocked(state: GameState, skillId: string): boolean {
  return skillId in state.skills;
}

/** Cosmetic mastery-tier name for a skill at the given level, if defined. */
export function skillTierName(skillId: string, level: number): string | null {
  const tiers = SKILLS[skillId]?.tierNames;
  if (!tiers?.length) return null;
  let name: string | null = null;
  for (const t of tiers) {
    if (level >= t.level) name = t.name;
  }
  return name;
}

/**
 * A skill's OWN tags: the ones its parent doesn't already claim. Swordsmanship
 * declares ['combat', 'sword'] but inherits 'combat' from Fighting, so what it
 * actually claims for itself is ['sword'].
 */
function ownTags(def: SkillDef): string[] {
  const parent = def.parent ? SKILLS[def.parent] : undefined;
  return parent ? def.tags.filter((t) => !parent.tags.includes(t)) : def.tags;
}

/**
 * Whether an action trains a skill. Practice flows UP the tree — from the most
 * specific skill the action matches to the general one at the root — and never
 * sideways: an action must match a skill's own tags AND everything its parent
 * chain claims. So swinging a club trains Club Combat and Fighting, while
 * Swordsmanship (and every sword school under it) learns nothing, even though
 * all of them carry the generic 'combat' tag.
 *
 * A skill that adds no tags of its own (Ittou-ryu under Swordsmanship, Heavy
 * Swing under Fighting) simply trains whenever its parent does.
 */
export function skillTrainedBy(def: SkillDef, tags: string[]): boolean {
  const own = ownTags(def);
  if (own.length > 0 && !own.some((t) => tags.includes(t))) return false;
  const parent = def.parent ? SKILLS[def.parent] : undefined;
  if (parent) return skillTrainedBy(parent, tags);
  return own.length > 0;
}

/**
 * Skill manifestation: while performing an action that trains it (see
 * `skillTrainedBy`), any locked skill whose unlock conditions all hold is
 * discovered. This is how the tree branches (fighting → swordsmanship → …).
 */
export function checkDiscovery(state: GameState, bus: EventBus, tags: string[]): void {
  for (const def of Object.values(SKILLS)) {
    if (isUnlocked(state, def.id)) continue;
    if (!skillTrainedBy(def, tags)) continue;
    if (!conditionsMet(state, def.unlock)) continue;
    state.skills[def.id] = { level: 1, xp: 0 };
    bus.emit({ type: 'skill:unlock', id: def.id });
    bus.emit({ type: 'log', msg: `✨ Skill manifested: ${def.icon} ${def.name}!`, kind: 'skill' });
  }
}

/**
 * The level this skill may currently reach: its base `maxLevel` plus whatever
 * cap raises the save has earned (quests, events, prestige). Uncapped skills
 * answer Infinity.
 */
export function skillCap(state: GameState, id: string): number {
  const def = SKILLS[id];
  if (!def?.maxLevel) return Infinity;
  return def.maxLevel + (state.skills[id]?.capRaised ?? 0);
}

/**
 * Raise a capped skill's ceiling. The skill must have manifested — a wider
 * ceiling on a sense you don't have yet would be a reward the player can't
 * see. No-op on uncapped skills.
 */
export function raiseSkillCap(state: GameState, bus: EventBus, id: string, by = 1): void {
  const def = SKILLS[id];
  const s = state.skills[id];
  if (!def?.maxLevel || !s || by <= 0) return;
  s.capRaised = (s.capRaised ?? 0) + by;
  bus.emit({
    type: 'log',
    msg: `⏫ ${def.icon} ${def.name}'s ceiling rises — Lv ${skillCap(state, id)} is within reach.`,
    kind: 'skill',
  });
}

function addSkillXp(state: GameState, bus: EventBus, id: string, amount: number): void {
  const s = state.skills[id];
  if (!s) return;
  const cap = skillCap(state, id);
  // At the ceiling, XP is DISCARDED — not banked like a retuned curve's
  // leftovers. Time spent maxed buys nothing, which is what makes a cap raise
  // a real reward instead of the release of a spring.
  if (s.level >= cap) {
    s.xp = 0;
    return;
  }
  s.xp += amount;
  let gained = settleLevels(s, skillProgression(id));
  if (s.level >= cap) {
    gained -= s.level - cap;
    s.level = cap;
    s.xp = 0;
  }
  for (let i = gained; i > 0; i--) {
    bus.emit({ type: 'skill:levelup', id, level: s.level - i + 1 });
  }
}

// ---------- Novelty ----------

/**
 * What one more of the same input is worth, as a multiple of the ordinary
 * payout: `(k + n) / (c + n)`, opening at `k / c` for something never seen and
 * decaying towards 1. See `NoveltySpec`.
 */
export function noveltyYield(spec: NoveltySpec, n: number): number {
  return (spec.k + n) / (spec.c + n);
}

/**
 * The yield for this input, counting it as seen. Mutates — one call per input
 * offered, which is what makes the next one worth less.
 *
 * An input with no key is one the caller could not attribute (a quest reward, a
 * scripted grant). Those pay the floor rather than the novelty bonus: unnamed
 * information cannot be checked for whether it is new.
 */
function consumeNovelty(
  state: GameState,
  def: SkillDef,
  key: string | string[] | undefined,
): number {
  if (!def.novelty) return 1;
  if (!key) return 1;
  const counts = (state.novelty[def.id] ??= {});

  // Several inputs at once: a modular craft teaches you about the combination
  // AND about each thing you put into it, each wearing down at its own rate.
  // The payout is their MEAN, so breadth pays without one stale ingredient
  // dragging a genuinely new recipe down to nothing.
  const keys = typeof key === 'string' ? [key] : key;
  if (keys.length === 0) return 1;
  let total = 0;
  for (const k of keys) {
    const seen = counts[k] ?? 0;
    counts[k] = seen + 1;
    total += noveltyYield(def.novelty, seen);
  }
  return total / keys.length;
}

/** How novel `key` still is to a skill, without consuming it (for the UI). */
export function noveltyRemaining(state: GameState, skillId: string, key: string): number {
  const spec = SKILLS[skillId]?.novelty;
  if (!spec) return 1;
  return noveltyYield(spec, state.novelty[skillId]?.[key] ?? 0);
}

/**
 * Bonus XP for every skill that learns from `domain`, awarded when that domain
 * records something genuinely new — a species entered in the bestiary, a fact
 * pinned down, a habitat confirmed. This is the reward for filling the book in,
 * as opposed to the per-kill trickle, and it is why seeking out the unfamiliar
 * beats grinding the familiar.
 *
 * `weight` scales the flat `discovery` value for finds worth more than one
 * unit; the domain decides what a unit means.
 */
export function grantDiscoveryXp(
  state: GameState,
  bus: EventBus,
  domain: NoveltyDomain,
  weight = 1,
): void {
  const mult = getDerivedStats(state).skillXp;
  for (const id of Object.keys(state.skills)) {
    const spec = SKILLS[id]?.novelty;
    if (spec?.domain !== domain) continue;
    addSkillXp(state, bus, id, spec.discovery * weight * mult);
  }
}

/**
 * Grant XP to every unlocked skill the action trains (see `skillTrainedBy`).
 *
 * `sourceKey` names the specific input behind the payout — a monster id, a book
 * id, whoever was talked to. Skills that learn by drill ignore it entirely;
 * skills that learn from novelty use it to tell a first time from a hundredth.
 */
export function grantSkillXp(
  state: GameState,
  bus: EventBus,
  tags: string[],
  amount: number,
  /**
   * What the XP is FOR, so a novelty skill can tell new from familiar. A list
   * credits several inputs at once — see consumeNovelty.
   */
  sourceKey?: string | string[],
): void {
  if (amount <= 0) return;
  const mult = getDerivedStats(state).skillXp;
  for (const [id] of Object.entries(state.skills)) {
    const def = SKILLS[id];
    if (!def || !skillTrainedBy(def, tags)) continue;
    addSkillXp(state, bus, id, amount * mult * consumeNovelty(state, def, sourceKey));
  }
}

/** Grant XP to one specific skill (quest rewards); no-op if not yet unlocked. */
export function grantSkillXpDirect(state: GameState, bus: EventBus, skillId: string, amount: number): void {
  if (amount <= 0 || !state.skills[skillId]) return;
  addSkillXp(state, bus, skillId, amount * getDerivedStats(state).skillXp);
}

/**
 * Locked skills worth hinting at in the UI: children of a skill the player
 * already knows. Returns ids.
 */
export function hintedSkills(state: GameState): string[] {
  return Object.values(SKILLS)
    .filter((def) => !isUnlocked(state, def.id) && def.parent && isUnlocked(state, def.parent))
    .map((d) => d.id);
}

// ---------- Categorized skill tree (Skills panel) ----------

export interface SkillTreeNode {
  def: SkillDef;
  state: 'unlocked' | 'hinted';
  children: SkillTreeNode[];
}

function buildNode(state: GameState, def: SkillDef): SkillTreeNode | null {
  if (isUnlocked(state, def.id)) {
    const children = Object.values(SKILLS)
      .filter((d) => d.parent === def.id)
      .map((d) => buildNode(state, d))
      .filter((n): n is SkillTreeNode => n !== null);
    return { def, state: 'unlocked', children };
  }
  // Locked skills are hinted only when their parent is known; their own
  // subtree stays invisible (mystery preserved).
  if (def.parent && isUnlocked(state, def.parent)) {
    return { def, state: 'hinted', children: [] };
  }
  return null;
}

/**
 * The full skill forest, grouped by category in display order. Undiscovered
 * roots (Magic before INT 15, resistances before exposure) are absent; empty
 * categories are omitted.
 */
export function skillTreeByCategory(
  state: GameState,
): { category: SkillCategoryDef; nodes: SkillTreeNode[] }[] {
  return SKILL_CATEGORIES.map((category) => ({
    category,
    nodes: Object.values(SKILLS)
      .filter((d) => !d.parent && d.category === category.id)
      .map((d) => buildNode(state, d))
      .filter((n): n is SkillTreeNode => n !== null),
  })).filter((section) => section.nodes.length > 0);
}
