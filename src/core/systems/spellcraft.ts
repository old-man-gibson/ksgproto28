import type { CraftedSpell, GameState, PsionicShape, SpellSource, SpellSpec } from '../types';
import type { EventBus } from '../engine/events';
import { checkDiscovery, grantDiscoveryXp, grantSkillXp } from './skills';
import { nextUid } from './equipment';
import {
  checkSentence,
  composeArcane,
  grantWordXp,
  splitWordId,
  wordLevels,
} from './arcane';
import { ARCANE_WORDS } from '../data/spellcraft.data';
import { miracleSpec } from './divine';
import { deityRelation } from './deities';
import { checkShape, psiBiasFrom, psiTier, recogniseShape, shapeSpec } from './psionic';
import { DEITIES } from '../data/deities.data';
import { TITLES } from '../data/titles.data';
import { STATUSES } from '../registry';
import { legacyPreparedPages } from './legacy';
import { applyStatus } from './statuses';
import { getDerivedStats } from './derived';
import { heal } from './health';
import { resourceValue, spendResource } from './resources';
import { bumpStat } from './achievements';

/**
 * The grimoire: one book, three schools.
 *
 * A crafted spell is stored as WHAT MADE IT — an arcane sentence, a divine
 * litany, a psionic shape — and resolved to a SpellSpec on read, memoised,
 * exactly the way a carved rune resolves to a RuneDef. The schools share
 * nothing else: how a spell comes to exist is each school's own affair
 * (arcane.ts, divine.ts, psionic.ts); this module only keeps the book.
 *
 * Prepared spells are the ones combat carries: a small number, chosen here,
 * cast automatically like active skills (see combat.ts).
 */

/** How many spells may be held ready for combat before any study earns more. */
export const BASE_PREPARED = 3;

/**
 * Levels of a school that buy one more page in the book.
 *
 * The three SCHOOL skills each count — Arcana, Psionics, Devotion — not their
 * shared `magic` parent, which would credit the same study twice. A page
 * earned in one school is spendable in any of them: what widens is the mind
 * holding the workings, not the workings themselves.
 *
 * Quests and skills are meant to add to this too; this is only the floor
 * that study alone guarantees.
 */
export const PREPARED_PER_LEVELS = 20;
export const PREPARED_SCHOOLS = ['arcana', 'psionics', 'devotion'] as const;

export function preparedCap(state: GameState): number {
  let cap = BASE_PREPARED + legacyPreparedPages(state);
  for (const id of PREPARED_SCHOOLS) {
    cap += Math.floor((state.skills[id]?.level ?? 0) / PREPARED_PER_LEVELS);
  }
  return cap;
}

/** A spell's identity — the combination itself, like carvedKey. */
export function spellKey(source: SpellSource): string {
  switch (source.school) {
    case 'arcane': {
      // Order is meaning, so the key preserves it — in COLLAPSED form, so
      // "fire fire pierce" and a mastered "flame pierce" are one spell.
      const toks: { id: string; n: number }[] = [];
      for (const raw of source.words) {
        const { id, tier } = splitWordId(raw);
        const last = toks[toks.length - 1];
        if (last && last.id === id && ARCANE_WORDS[id]?.kind !== 'target') last.n += tier;
        else toks.push({ id, n: tier });
      }
      return `arcane:${toks.map((t) => (t.n > 1 ? `${t.id}${t.n}` : t.id)).join(',')}`;
    }
    case 'divine':
      return `divine:${source.litany}`;
    case 'psionic':
      // Sorted axis:points pairs, zeros dropped — the shape's identity.
      return `psionic:${Object.entries(source.shape)
        .filter(([, n]) => (n ?? 0) > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([axis, n]) => `${axis}${n}`)
        .join(',')}`;
  }
}

/** What a reference that no longer resolves reads as (content removed). */
const FADED: Omit<SpellSpec, 'school'> = {
  name: 'Faded Inscription',
  icon: '📜',
  target: 'one',
  strikes: [],
  manaCost: 1,
  cooldown: 200,
};

/** Resolved specs, keyed by combination. A spell never changes once made. */
const SPELL_CACHE = new Map<string, SpellSpec>();

/**
 * What a combination MEANS, memoised — with no grimoire entry around it.
 *
 * The three schools each compose to the same type from pure inputs, which is
 * what lets anything that can hold a `SpellSource` cast: the player's book,
 * and a monster's authored list (MonsterDef.casts). Neither needs to know how
 * the other stores it.
 */
export function specForSource(source: SpellSource): SpellSpec {
  const key = spellKey(source);
  let spec = SPELL_CACHE.get(key);
  if (!spec) {
    switch (source.school) {
      case 'arcane':
        spec = composeArcane(source.words) ?? { ...FADED, school: 'arcane' };
        break;
      case 'divine':
        spec = miracleSpec(source.litany) ?? { ...FADED, school: 'divine' };
        break;
      case 'psionic':
        spec = shapeSpec(source.shape);
        break;
    }
    SPELL_CACHE.set(key, spec);
  }
  return spec;
}

/** The single door every reader goes through, resolveRune's twin. */
export function resolveSpell(spell: CraftedSpell): SpellSpec {
  const spec = specForSource(spell.source);
  // A player's name for it rides on top; the working underneath is unchanged.
  return spell.name ? { ...spec, name: spell.name } : spec;
}

/**
 * The spec as MATTER would have it — what this spell actually does in the
 * hands of whoever is holding it.
 *
 * Deliberately outside `SPELL_CACHE`. The memo is keyed by `spellKey`, which
 * knows only the combination; folding gear into it would map one key to as
 * many specs as there are loadouts and hand a bronze-dagger reading to
 * somebody holding nullsteel. So the cache keeps the BARE reading (what the
 * grimoire lists) and anything that cares about the real one recomputes —
 * cheap, being pure arithmetic over eight numbers.
 *
 * Two schools read context this way, for different reasons: psionics reads
 * MATTER (what you are holding), arcane reads VOCABULARY (how well you know
 * the words you are saying). A miracle reads neither — it was shaped long
 * before you picked anything up or learned anything.
 */
export function resolveSpellFor(state: GameState, spell: CraftedSpell): SpellSpec {
  // Arcane reads the speaker's VOCABULARY: a sentence of well-practised words
  // is heavier in a veteran's mouth than in a novice's, though it is the same
  // sentence (see composeArcane's `levels`).
  if (spell.source.school === 'arcane') {
    const spec = composeArcane(spell.source.words, wordLevels(state));
    if (!spec) return resolveSpell(spell);
    return spell.name ? { ...spec, name: spell.name } : spec;
  }
  if (spell.source.school !== 'psionic') return resolveSpell(spell);
  const bias = psiBiasFrom(getDerivedStats(state));
  const spec = shapeSpec(spell.source.shape, 12, bias);
  return spell.name ? { ...spec, name: spell.name } : spec;
}

// ---------- The book ----------

export function findSpell(state: GameState, uid: number): CraftedSpell | undefined {
  return state.grimoire.find((s) => s.uid === uid);
}

export function preparedSpells(state: GameState): CraftedSpell[] {
  return state.grimoire.filter((s) => s.prepared);
}

export function hasSpell(state: GameState, source: SpellSource): boolean {
  const key = spellKey(source);
  return state.grimoire.some((s) => spellKey(s.source) === key);
}

export function hasDivine(state: GameState, litanyId: string): boolean {
  return state.grimoire.some((s) => s.source.school === 'divine' && s.source.litany === litanyId);
}

// ---------- Casting outside a fight ----------

/**
 * Can this working do anything with nobody to do it to?
 *
 * A working that lands on its OWN caster does not need an enemy — a haste, a
 * ward, a mending. Strikes are simply not resolved out here; a shape that both
 * hits and buffs is still worth casting for the half of it that applies, and
 * it pays its full price for the privilege.
 *
 * Deliberately about the resolved spec rather than the school, so an arcane
 * ward and a divine blessing qualify on exactly the same terms a psionic
 * working does.
 */
export function isUtilityWorking(spec: SpellSpec): boolean {
  return (spec.grants?.length ?? 0) > 0 || (!!spec.heal && !spec.healsEnemy);
}

/** Ticks until this working can be cast outside a fight again. */
export function utilityCooldown(state: GameState, uid: number): number {
  return Math.max(0, (state.useCooldowns?.[`spell:${uid}`] ?? 0) - state.totalTicks);
}

export interface UtilityCheck {
  ok: boolean;
  reason?: string;
}

export function canCastUtility(state: GameState, uid: number): UtilityCheck {
  const spell = findSpell(state, uid);
  if (!spell) return { ok: false, reason: 'No such working' };
  const spec = resolveSpellFor(state, spell);
  if (!isUtilityWorking(spec)) {
    return { ok: false, reason: `${spec.name} has nothing to do without a target` };
  }
  if (state.combat) return { ok: false, reason: 'Already fighting — prepare it instead' };
  if (utilityCooldown(state, uid) > 0) return { ok: false, reason: `${spec.name} is not ready yet` };

  const stats = getDerivedStats(state);
  if (resourceValue(state, 'mana') < spec.manaCost * stats.manaEff) {
    return { ok: false, reason: 'Not enough mana' };
  }
  if (spec.focusCost && resourceValue(state, 'focus') < spec.focusCost) {
    return { ok: false, reason: 'Not enough focus' };
  }
  return { ok: true };
}

/**
 * Cast a working on yourself with no fight on. Costs exactly what it costs in
 * combat and runs on `useCooldowns` (the same clock consumables and flasks
 * use), so it is a real decision rather than free upkeep — a haste held
 * between errands is focus not available for the next fight.
 */
export function castUtility(state: GameState, bus: EventBus, uid: number): boolean {
  const check = canCastUtility(state, uid);
  if (!check.ok) {
    if (check.reason) bus.emit({ type: 'log', msg: `🔒 ${check.reason}`, kind: 'danger' });
    return false;
  }
  const spell = findSpell(state, uid)!;
  // What it does in YOUR hands, not what the book lists.
  const spec = resolveSpellFor(state, spell);
  const stats = getDerivedStats(state);

  spendResource(state, 'mana', spec.manaCost * stats.manaEff);
  if (spec.focusCost) spendResource(state, 'focus', spec.focusCost);
  state.useCooldowns ??= {};
  state.useCooldowns[`spell:${uid}`] = state.totalTicks + spec.cooldown;

  const worn: string[] = [];
  for (const app of spec.grants ?? []) {
    const inst = applyStatus(state, state, app, spec.name);
    if (inst) worn.push(STATUSES[inst.id]?.name ?? inst.id);
  }
  let healed = 0;
  if (spec.heal && !spec.healsEnemy) {
    healed = heal(state, stats, spec.heal * stats.spellPower, 'spell');
  }

  const did = [
    ...(healed > 0 ? [`knits ${Math.round(healed)} health back`] : []),
    ...(worn.length ? [`you are wearing ${worn.join(', ')}`] : []),
  ];
  bus.emit({
    type: 'log',
    msg: `${spec.icon} ${spec.name}${did.length ? ` — ${did.join('; ')}` : ''}.`,
    kind: 'info',
  });

  const tags = ['magic', spec.school];
  checkDiscovery(state, bus, tags);
  grantSkillXp(state, bus, tags, 3);
  return true;
}

/** Write a spell into the book. The caller has already checked legality. */
export function addSpell(state: GameState, source: SpellSource, name?: string): CraftedSpell {
  const spell: CraftedSpell = { uid: nextUid(state), source };
  if (name) spell.name = name;
  state.grimoire.push(spell);
  return spell;
}

export function forgetSpell(state: GameState, uid: number): boolean {
  const i = state.grimoire.findIndex((s) => s.uid === uid);
  if (i < 0) return false;
  state.grimoire.splice(i, 1);
  return true;
}

export function renameSpell(state: GameState, uid: number, name: string): boolean {
  const spell = findSpell(state, uid);
  if (!spell) return false;
  const trimmed = name.trim();
  if (trimmed) spell.name = trimmed;
  else delete spell.name;
  return true;
}

/** Whether the worn title exempts the wearer from the pantheon's dogma. */
function dogmaDefied(state: GameState): boolean {
  return !!(state.title && TITLES[state.title]?.defiesDogma);
}

/**
 * The pantheon's veto: hostile deities' miracles refuse to be held ready
 * together. Learning is unrestricted — this bites only at preparation, and
 * a worn dogma-defying title waives it entirely.
 */
function deityConflict(state: GameState, spell: CraftedSpell): string | null {
  const deity = resolveSpell(spell).deity;
  if (!deity || dogmaDefied(state)) return null;
  for (const other of preparedSpells(state)) {
    if (other.uid === spell.uid) continue;
    const otherDeity = resolveSpell(other).deity;
    if (otherDeity && deityRelation(deity, otherDeity) === 'hostile') {
      return `${DEITIES[deity]?.name ?? deity} refuses to share a page with ${DEITIES[otherDeity]?.name ?? otherDeity}.`;
    }
  }
  return null;
}

/** Ready a spell for combat, or stand it down. Enforces the prepared cap. */
export function setPrepared(state: GameState, bus: EventBus, uid: number, prepared: boolean): boolean {
  const spell = findSpell(state, uid);
  if (!spell) return false;
  const cap = preparedCap(state);
  if (prepared && !spell.prepared && preparedSpells(state).length >= cap) {
    bus.emit({
      type: 'log',
      msg: `🔒 You can hold ${cap} spells ready at once.`,
      kind: 'danger',
    });
    return false;
  }
  if (prepared) {
    const conflict = deityConflict(state, spell);
    if (conflict) {
      bus.emit({ type: 'log', msg: `⚡ ${conflict}`, kind: 'danger' });
      return false;
    }
  }
  if (prepared) spell.prepared = true;
  else delete spell.prepared;
  return true;
}

// ---------- Crafting: the two composed schools ----------
// (Divine inscription lives in divine.ts with the favor economy.)

/**
 * Inscribe an arcane sentence into the grimoire. Deterministic like every
 * craft: the sentence is checked, written, and paid for in Arcana XP that
 * rewards NEW sentences over recompositions — the reserved 'arcana' novelty
 * domain doing what it was reserved for.
 */
export function inscribeArcane(state: GameState, bus: EventBus, words: string[]): CraftedSpell | null {
  const check = checkSentence(state, words);
  if (!check.ok || !check.spec) {
    if (check.reason) bus.emit({ type: 'log', msg: `🔒 ${check.reason}`, kind: 'danger' });
    return null;
  }
  const source: SpellSource = { school: 'arcane', words: [...words] };
  if (hasSpell(state, source)) {
    bus.emit({ type: 'log', msg: '🔒 That sentence is already in your grimoire.', kind: 'danger' });
    return null;
  }

  // Speaking at the table may be what manifests the skill in the first place.
  // 'magic' rides along because Arcana sits under Magic in the tree, and a
  // skill only trains when its whole parent chain claims the action.
  checkDiscovery(state, bus, ['spellcraft', 'magic', 'arcane']);

  const key = spellKey(source);
  const firstEver = !(state.novelty.arcana?.[key]);
  const spell = addSpell(state, source);
  // The counter quest familiarization reads ({ type: 'stat' } objectives) —
  // the divine twin is `miracles:learned`, bumped where miracles arrive.
  bumpStat(state, bus, 'spells:inscribed');

  grantSkillXp(
    state,
    bus,
    ['spellcraft', 'magic', 'arcane'],
    14 * (1 + words.length * 0.15),
    // The sentence as a whole, and every word in it, each wearing down at its
    // own rate — the disciplines' novelty-key pattern, spoken instead of
    // placed. Word keys use the BASE word (speaking flame still deepens fire),
    // and these same counters are what word MASTERY is read from.
    [key, ...[...new Set(words.map((w) => splitWordId(w).id))].map((w) => `arcane:word:${w}`)],
  );
  if (firstEver && state.skills.arcana) grantDiscoveryXp(state, bus, 'arcana');
  // Writing a sentence out teaches the GRAMMAR (Arcana, above) and counts
  // toward mastery (the novelty keys). It does not practise the words: that
  // is speaking them, and only a cast speaks (`grantCastWordXp`). Inscribing
  // used to pay three casts' worth of practice — a bench that trained words
  // nobody ever said (user, 2026-09-12).

  bus.emit({ type: 'log', msg: `${check.spec.icon} Inscribed: ${check.spec.name}`, kind: 'item' });
  return spell;
}

/**
 * Pay the vocabulary for a casting.
 *
 * Called from every path a working actually goes off through, so practice
 * comes from USE rather than from writing a sentence down once. Silently
 * ignores anything that is not an arcane sentence — the other schools have
 * no words to wear in.
 */
export function grantCastWordXp(state: GameState, bus: EventBus, uid: number): void {
  const spell = findSpell(state, uid);
  if (spell?.source.school !== 'arcane') return;
  grantWordXp(state, bus, spell.source.words, resolveSpell(spell).manaCost);
}

/** Shape a psionic working and set it in the grimoire. */
export function shapePsionic(state: GameState, bus: EventBus, shape: PsionicShape): CraftedSpell | null {
  const check = checkShape(state, shape);
  if (!check.ok) {
    if (check.reason) bus.emit({ type: 'log', msg: `🔒 ${check.reason}`, kind: 'danger' });
    return null;
  }
  const source: SpellSource = { school: 'psionic', shape: { ...shape } };
  if (hasSpell(state, source)) {
    bus.emit({ type: 'log', msg: '🔒 You already hold that exact shape.', kind: 'danger' });
    return null;
  }

  /*
   * A shape landing in a region above the shaper's taught tier slips away
   * half-formed. The arithmetic is fine — every quantity resolves — but a
   * grimoire entry is resolved at full tier forever after (resolveSpell is
   * stateless and memoised by key), so this is the one place the teacher gate
   * can be held. Inscribing must wait; shaping something else need not.
   */
  const recognition = recogniseShape(shape, 12);
  if (recognition && (recognition.tier ?? 0) > psiTier(state)) {
    bus.emit({
      type: 'log',
      msg: `🔒 The shape settles toward ${recognition.name} and slips away — you need a teacher for it.`,
      kind: 'danger',
    });
    return null;
  }

  checkDiscovery(state, bus, ['spellcraft', 'magic', 'psionic']);
  const spell = addSpell(state, source);
  const spec = resolveSpell(spell);
  grantSkillXp(state, bus, ['spellcraft', 'magic', 'psionic'], 16, [spellKey(source)]);
  bus.emit({ type: 'log', msg: `${spec.icon} Shaped: ${spec.name}`, kind: 'item' });
  return spell;
}
