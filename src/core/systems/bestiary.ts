import type {
  BestiaryEntry,
  BestiaryFactDef,
  GameState,
  MonsterDef,
  MonsterTagCategory,
} from '../types';
import type { EventBus } from '../engine/events';
import { chance } from '../engine/rng';
import { sizeRank } from '../types';
import { MONSTERS, MONSTER_TAGS, SPOTS, TIERS } from '../registry';
import { BESTIARY_FACTS, BESTIARY_TUNING } from '../data/bestiary.data';
import { attackIntervalOf, innateArmor, scaledMonsterAttrs, statsFromAttrs } from './monsterStats';
import { attrValue } from './attributes';
import { grantDiscoveryXp } from './skills';
import { bumpStat } from './achievements';
import { text } from '../text/log';

/**
 * The bestiary: what the player has learned about each monster.
 *
 * The first kill opens an entry (name, art, tags). Everything else is earned —
 * each fact waits for a minimum kill count, then rolls once per kill against
 * the hunter's *insight* (Hunting skill + INT + WIS), and is granted outright
 * once the kill count passes its `sureKills` ceiling. Habitat is the exception:
 * it is learned per location, by simply showing up there often enough.
 */

// ---------- Tags ----------

/**
 * Every tag that applies to a monster: the intrinsic ones from the def, plus
 * the derived ones (tier, reach, group behaviour, and a `non_elemental`
 * fallback for anything that claims no element). Derived tags stay out of the
 * data files so they can never contradict the stats they describe.
 */
export function monsterTags(def: MonsterDef): string[] {
  const tags = [...def.tags];
  const add = (id: string) => {
    if (!tags.includes(id)) tags.push(id);
  };

  add(def.tier);
  if (def.range === 'ranged') add('ranged');
  if (def.escorts?.length) add('leader');
  if (def.group?.max === 1) add('solitary');
  if ((def.group?.min ?? 1) > 1) add('swarm');
  if (!tags.some((t) => MONSTER_TAGS[t]?.category === 'element')) add('non_elemental');

  return tags;
}

const TAG_SET_CACHE = new Map<string, ReadonlySet<string>>();

/**
 * Every tag of a monster as a set, memoised by def id. Monster content is
 * static, so this is computed once and reused — the combat path asks for it on
 * every blow to resolve target-gated bonuses.
 */
export function monsterTagSet(defId: string): ReadonlySet<string> {
  let set = TAG_SET_CACHE.get(defId);
  if (!set) {
    const def = MONSTERS[defId];
    set = new Set(def ? monsterTags(def) : []);
    TAG_SET_CACHE.set(defId, set);
  }
  return set;
}

export function tagCategory(tagId: string): MonsterTagCategory | null {
  return MONSTER_TAGS[tagId]?.category ?? null;
}

/**
 * Where a monster sits on the size ladder. A species that never says reads as
 * medium, which is the honest default — most things are person-sized, and the
 * ones that are not make a point of saying so.
 */
export function monsterSizeRank(defId: string): number {
  for (const tag of monsterTagSet(defId)) {
    if (MONSTER_TAGS[tag]?.category === 'size') return sizeRank(tag);
  }
  return sizeRank('medium');
}

/** Tag ids in use across all monsters, grouped by category (for filter rows). */
export function tagsInUse(): Record<MonsterTagCategory, string[]> {
  const groups = {} as Record<MonsterTagCategory, string[]>;
  for (const def of Object.values(MONSTERS)) {
    for (const tag of monsterTags(def)) {
      const cat = tagCategory(tag);
      if (!cat) continue;
      (groups[cat] ??= []).push(tag);
    }
  }
  for (const cat of Object.keys(groups) as MonsterTagCategory[]) {
    groups[cat] = [...new Set(groups[cat])].sort(
      (a, b) => tagOrder(a, cat) - tagOrder(b, cat) || MONSTER_TAGS[a].name.localeCompare(MONSTER_TAGS[b].name),
    );
  }
  return groups;
}

/** Tiers read as a ladder, so sort them by strength rather than alphabetically. */
function tagOrder(tagId: string, cat: MonsterTagCategory): number {
  if (cat !== 'tier') return 0;
  return Object.keys(TIERS).indexOf(tagId);
}

// ---------- Entry access ----------

export function entryOf(state: GameState, monsterId: string): BestiaryEntry | undefined {
  return state.bestiary[monsterId];
}

/** An entry exists in the book only once its subject has been killed. */
export function isDiscovered(state: GameState, monsterId: string): boolean {
  return (state.bestiary[monsterId]?.kills ?? 0) > 0;
}

export function knowsFact(state: GameState, monsterId: string, factId: string): boolean {
  return state.bestiary[monsterId]?.facts.includes(factId) ?? false;
}

/** Spot ids whose habitat entry the player has confirmed for this monster. */
export function knownSpots(state: GameState, monsterId: string): string[] {
  return state.bestiary[monsterId]?.spots ?? [];
}

export function bestiaryProgress(state: GameState): { known: number; total: number } {
  const total = Object.keys(MONSTERS).length;
  const known = Object.keys(MONSTERS).filter((id) => isDiscovered(state, id)).length;
  return { known, total };
}

function ensureEntry(state: GameState, monsterId: string): BestiaryEntry {
  const existing = state.bestiary[monsterId];
  if (existing) return existing;
  const fresh: BestiaryEntry = { kills: 0, seen: {}, facts: [], spots: [], firstKill: 0 };
  state.bestiary[monsterId] = fresh;
  return fresh;
}

// ---------- Insight ----------

/**
 * Per-kill chance a learnable fact of difficulty 1 comes to you. Hunting is the
 * craft of it; INT is what you notice, WIS is what you make of it.
 */
export function bestiaryInsight(state: GameState): number {
  const hunting = state.skills.hunting?.level ?? 0;
  const mind = attrValue(state, 'int') + attrValue(state, 'wis');
  return (
    BESTIARY_TUNING.base +
    hunting * BESTIARY_TUNING.perHuntingLevel +
    mind * BESTIARY_TUNING.perMind
  );
}

export function factChance(state: GameState, fact: BestiaryFactDef): number {
  return Math.min(BESTIARY_TUNING.maxChance, bestiaryInsight(state) * fact.difficulty);
}

/** Sightings needed at one spot before its habitat entry is confirmed. */
export function habitatNeeded(state: GameState): number {
  const hunting = state.skills.hunting?.level ?? 0;
  return Math.max(
    BESTIARY_TUNING.habitatFloor,
    BESTIARY_TUNING.habitatBase - Math.floor(hunting / BESTIARY_TUNING.habitatPerHunting),
  );
}

// ---------- Recording ----------

/**
 * Note that these monsters were seen here. Sightings accumulate before the
 * first kill too — the book just has nowhere to show them yet.
 */
export function recordEncounter(state: GameState, spotId: string, monsterIds: string[]): void {
  for (const id of new Set(monsterIds)) {
    if (!MONSTERS[id]) continue;
    const entry = ensureEntry(state, id);
    entry.seen[spotId] = (entry.seen[spotId] ?? 0) + 1;
  }
}

export function recordKill(state: GameState, bus: EventBus, monsterId: string): void {
  const def = MONSTERS[monsterId];
  if (!def) return;
  const entry = ensureEntry(state, monsterId);
  entry.kills += 1;

  if (entry.kills === 1) {
    entry.firstKill = state.totalTicks;
    // A species nobody has written down yet is the single biggest thing the
    // book can gain, so it pays several ordinary finds' worth.
    grantDiscoveryXp(state, bus, 'bestiary', 3);
    // The counter quest familiarization reads ({ type: 'stat' } objectives).
    bumpStat(state, bus, 'bestiary:entries');
    bus.emit({ type: 'bestiary:entry', monsterId });
    bus.emit({
      type: 'log',
      msg: text('bestiary.species_added', { icon: def.icon, name: def.name }),
      kind: 'bestiary',
    });
  }

  // A menagerie teaches on a syllabus: caged kills skip the insight roll, so
  // every fact lands OUTRIGHT at its `minKills` — defined rates, not rolled
  // ones (SpotDef.caged). The cage knows nothing about which monster; the
  // schedule is the fact's own.
  const caged = !!SPOTS[state.spot]?.caged;
  for (const fact of BESTIARY_FACTS) {
    if (entry.facts.includes(fact.id)) continue;
    if (entry.kills < fact.minKills) continue;
    if (!caged && entry.kills < fact.sureKills && !chance(state, factChance(state, fact))) continue;
    entry.facts.push(fact.id);
    grantDiscoveryXp(state, bus, 'bestiary', fact.difficulty <= 0.5 ? 2 : 1);
    bus.emit({ type: 'bestiary:fact', monsterId, factId: fact.id });
    bus.emit({
      type: 'log',
      msg: text('bestiary.fact_learned', { icon: fact.icon, name: fact.name, monster: def.name }),
      kind: 'bestiary',
    });
  }

  checkHabitats(state, bus, monsterId);
}

/** Confirm any spot whose sighting count has reached the threshold. */
function checkHabitats(state: GameState, bus: EventBus, monsterId: string): void {
  const entry = state.bestiary[monsterId];
  if (!entry || entry.kills === 0) return;
  const needed = habitatNeeded(state);
  for (const [spotId, count] of Object.entries(entry.seen)) {
    if (count < needed || entry.spots.includes(spotId)) continue;
    entry.spots.push(spotId);
    grantDiscoveryXp(state, bus, 'bestiary');
    const spot = SPOTS[spotId];
    bus.emit({ type: 'bestiary:habitat', monsterId, spot: spotId });
    bus.emit({
      type: 'log',
      msg: text('bestiary.den_learned', { monster: MONSTERS[monsterId].name, spot: spot?.name ?? spotId }),
      kind: 'bestiary',
    });
  }
}

export function registerBestiaryListeners(state: GameState, bus: EventBus): void {
  bus.on('encounter', (ev) => recordEncounter(state, ev.spot, ev.monsterIds));
  bus.on('kill', (ev) => recordKill(state, bus, ev.monster.defId));
}

// ---------- Derived knowledge (what an unlocked fact actually says) ----------

export interface MonsterProfile {
  /** Levels this monster is found at, across every spot that spawns it. */
  levels: [number, number];
  hp: [number, number];
  damage: [number, number];
  /** Seconds between attacks at an average roll. */
  attackInterval: number;
  dodge: number;
  xp: [number, number];
  gold: [number, number];
}

/** Level range a monster spawns at, including as somebody else's escort. */
export function spawnLevels(monsterId: string): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const spot of Object.values(SPOTS)) {
    for (const enc of spot.encounters ?? []) {
      const escorted = MONSTERS[enc.monsterId]?.escorts?.includes(monsterId);
      if (enc.monsterId !== monsterId && !escorted) continue;
      lo = Math.min(lo, enc.level[0]);
      hi = Math.max(hi, enc.level[1]);
    }
  }
  return Number.isFinite(lo) ? [lo, hi] : [1, 1];
}

/**
 * Averaged stats, as the book would record them: the mid-point of the tier's
 * roll range, a plain (non-modified, common) specimen, at each end of the level
 * band it is found at. The stat formulas come from systems/monsterStats.ts —
 * the same ones a live spawn uses — so the field notes cannot drift from what
 * the player actually meets. Only the *averaging* is the book's own work:
 * no per-specimen jitter, no rolled modifier or rarity.
 */
export function monsterProfile(monsterId: string): MonsterProfile {
  const def = MONSTERS[monsterId];
  const tier = TIERS[def.tier];
  const mult = (tier.multiplierRange[0] + tier.multiplierRange[1]) / 2;
  const levels = spawnLevels(monsterId);

  const statsAt = (level: number) =>
    statsFromAttrs(scaledMonsterAttrs(def, level, mult), undefined, innateArmor(monsterId), def.regen ?? 0, level);
  const lo = statsAt(levels[0]);
  const hi = statsAt(levels[1]);
  const xpAt = (level: number) => def.xp * (1 + 0.35 * (level - 1)) * tier.rewardMult;
  const goldAt = (level: number) =>
    def.gold ? ((def.gold[0] + def.gold[1]) / 2) * level * tier.rewardMult : 0;

  return {
    levels,
    hp: [lo.maxHp, hi.maxHp],
    damage: [lo.damage, hi.damage],
    // Speed grows with DEX, so the top of the band is the fastest it gets.
    attackInterval: attackIntervalOf(hi.speed),
    dodge: hi.dodge,
    xp: [xpAt(levels[0]), xpAt(levels[1])],
    gold: [goldAt(levels[0]), goldAt(levels[1])],
  };
}

/** Drop entries the `loot_common` fact covers; the rest need `loot_rare`. */
export const COMMON_DROP_WEIGHT = 10;

export function dropChance(def: MonsterDef, index: number): number {
  const total = def.loot.entries.reduce((s, e) => s + e.weight, 0);
  const per = def.loot.entries[index].weight / total;
  // Independent rolls: the chance of at least one across the table's rolls.
  return 1 - Math.pow(1 - per, def.loot.rolls);
}

// ---------- Search ----------

export interface BestiaryQuery {
  /** Free text over names and tag names. */
  search?: string;
  /** Selected tag ids: OR within a category, AND across categories. */
  tags?: string[];
}

export function matchesQuery(def: MonsterDef, query: BestiaryQuery): boolean {
  const tags = monsterTags(def);

  if (query.tags?.length) {
    const byCategory = new Map<MonsterTagCategory, string[]>();
    for (const id of query.tags) {
      const cat = tagCategory(id);
      if (!cat) continue;
      byCategory.set(cat, [...(byCategory.get(cat) ?? []), id]);
    }
    for (const wanted of byCategory.values()) {
      if (!wanted.some((t) => tags.includes(t))) return false;
    }
  }

  const search = query.search?.trim().toLowerCase();
  if (search) {
    const haystack = [def.name, ...tags.map((t) => MONSTER_TAGS[t]?.name ?? t)]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  return true;
}

/** Monsters matching a query, in tier order then alphabetically. */
export function queryMonsters(query: BestiaryQuery): MonsterDef[] {
  const order = Object.keys(TIERS);
  return Object.values(MONSTERS)
    .filter((def) => matchesQuery(def, query))
    .sort(
      (a, b) => order.indexOf(a.tier) - order.indexOf(b.tier) || a.name.localeCompare(b.name),
    );
}

// ---------- Taxonomy grouping ----------

/**
 * The supergroup a monster files under in the book: its FIRST taxon tag. A
 * Slime Spider is shelved with the slimes, not the vermin, because that is the
 * order its def lists them in — kinship beyond the first tag stays a filter.
 */
export function primaryTaxon(def: MonsterDef): string {
  return def.tags.find((t) => MONSTER_TAGS[t]?.category === 'taxon') ?? 'unclassified';
}

/** Heading for a taxon group ("Slimes", "Vermin"). */
export function taxonPlural(tagId: string): string {
  const tag = MONSTER_TAGS[tagId];
  if (!tag) return 'Unclassified';
  return tag.plural ?? `${tag.name}s`;
}

export interface TaxonGroup {
  tag: string;
  name: string;
  icon: string;
  defs: MonsterDef[];
}

/**
 * Shelve monsters by supergroup, ordered as the tag registry declares them so
 * the book's spine never reshuffles when the player learns something new.
 */
export function groupByTaxon(defs: MonsterDef[]): TaxonGroup[] {
  const order = Object.keys(MONSTER_TAGS);
  const byTag = new Map<string, MonsterDef[]>();
  for (const def of defs) {
    const tag = primaryTaxon(def);
    byTag.set(tag, [...(byTag.get(tag) ?? []), def]);
  }
  return [...byTag.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([tag, group]) => ({
      tag,
      name: taxonPlural(tag),
      icon: MONSTER_TAGS[tag]?.icon ?? '❔',
      defs: group,
    }));
}
