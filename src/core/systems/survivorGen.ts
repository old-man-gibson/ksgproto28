import type { AttributeId, DamageType, FieldFighter, ItemDef, MonsterAction, MonsterKit, SpellSource } from '../types';
import { RES_STAT_BY_TYPE } from '../types';
import { ITEMS, MATERIALS, MONSTERS, TECHNIQUES } from '../registry';
import { ATTRIBUTE_LIST } from '../data/attributes.data';
import { NEUTRAL_POSITION } from '../data/martial.data';
import { SURVIVOR_CHAMPION, SURVIVOR_LEVELS } from '../data/festival.data';
import {
  SURVIVOR_ARCHETYPES,
  SURVIVOR_FAMILIES,
  SURVIVOR_FAMILY_ORDER,
  SURVIVOR_MENDING,
  SURVIVOR_NAME_FIRST,
  SURVIVOR_NAME_LAST,
  SURVIVOR_NAME_MID,
  SURVIVOR_TOOLS,
  SURVIVOR_WEAPON_INFLICTS,
  type SurvivorArchetype,
  type SurvivorFamily,
  type SurvivorWorking,
} from '../data/survivors.data';
import type { StagedMember } from './combat';
import { declaredPositions } from './martial';
import { baseMonsterAttrs } from './monsterStats';

/**
 * The enemy generator for the royale's survivors (docs/FESTIVAL.md §9.6): a
 * survivor is not a stat block with a species' name but a person with a kit.
 * `survivorBuild` turns the field's seed, a survivor's id and species and the
 * tools it has taken into a name, an archetype, a weapon, a `MonsterKit`
 * (rotation, damage type, reach, resistances, armour, riders) and an attribute
 * emphasis. It is pure and deterministic and keeps its own random streams,
 * never the game's: nothing but `FieldFighter.tools` is saved, and the same
 * inputs always give the same build.
 *
 * The streams are separate per concern (name, archetype and weapon, techniques,
 * workings, body), so editing one table moves only what it feeds.
 */

/** What the generator reads of a survivor. */
export type SurvivorSubject = Pick<FieldFighter, 'id' | 'monsterId' | 'tools'>;

export interface SurvivorBuild {
  /**
   * The display name: the archetype as a title before the given name,
   * "Spearman Tamsin", so combat's "The <name> hits you" lines read as
   * English.
   */
  name: string;
  /** The given name alone. */
  given: string;
  /** SURVIVOR_ARCHETYPES id. */
  archetype: string;
  /** SURVIVOR_FAMILIES id of the weapon it fights with. */
  family: string;
  /** ItemDef id of the weapon; null for bare hands. */
  weapon: string | null;
  /** What `startStagedGroup` lays over the species' def (`MonsterInstance.kit`). */
  kit: MonsterKit;
  /** Multipliers on the species' attributes, scaled so the total is kept (`biasAttrs` re-applies that exactly). */
  attrBias: Partial<Record<AttributeId, number>>;
  /** Bonus levels for duels between survivors, 0 to SURVIVOR_TOOLS.power.cap. */
  power: number;
}

// ---------- Random streams ----------

type Rng = () => number;

/** Which concern a stream feeds; a salt keeps the streams of one survivor apart. */
const SALT = { name: 1, archetype: 2, techniques: 3, workings: 4, body: 5 } as const;

function mix32(h: number, v: number): number {
  h = Math.imul(h ^ v, 0x9e3779b1);
  return (h ^ (h >>> 15)) >>> 0;
}

/** A 32-bit seed from numbers, fractions included. */
function seedOf(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const whole = Math.floor(p);
    h = mix32(h, whole);
    h = mix32(h, Math.floor((p - whole) * 0x100000000));
  }
  return h;
}

/** Mulberry32, the same generator the game's own stream runs on. */
function stream(fieldSeed: number, id: number, salt: number): Rng {
  let a = seedOf(fieldSeed, id, salt);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: Rng, xs: readonly T[]): T {
  return xs[Math.min(xs.length - 1, Math.floor(r() * xs.length))];
}

function weightedPick<T>(r: Rng, entries: readonly { value: T; weight: number }[]): T {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let roll = r() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll < 0) return e.value;
  }
  return entries[entries.length - 1].value;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

// ---------- Names ----------

/**
 * The survivor's given name. A field walks each syllable list in its own
 * stride from its own start (both drawn from the field's seed, the same for
 * every survivor on it) and the id is the number of steps taken. With the
 * lists' lengths pairwise coprime and each stride coprime to its list's
 * length, the three positions together repeat only after every combination
 * has been used (the Chinese remainder theorem), so ids that differ by less
 * than the product of the lengths never share a name.
 */
export function givenName(fieldSeed: number, id: number): string {
  const r = stream(fieldSeed, 0, SALT.name);
  const at = (list: readonly string[]): string => {
    const start = Math.floor(r() * list.length);
    // A stride of 2 to length - 2, so neighbouring ids do not read down the list.
    let stride = 2 + Math.floor(r() * (list.length - 3));
    while (gcd(stride, list.length) !== 1) stride = stride >= list.length - 2 ? 2 : stride + 1;
    return list[(start + stride * Math.abs(Math.trunc(id))) % list.length];
  };
  return at(SURVIVOR_NAME_FIRST) + at(SURVIVOR_NAME_MID) + at(SURVIVOR_NAME_LAST);
}

// ---------- Items as tools ----------

const sumOf = (item: ItemDef, stat: string, op: 'add' | 'mult'): number =>
  item.mods.reduce((s, m) => (m.stat === stat && m.op === op && !m.fromStat ? s + m.value : s), 0);

/**
 * How good a weapon is, for deciding whether a found one beats the one in
 * hand: its damage over its speed, a crit bonus weighted to match, and a
 * staff's spell power. Bare hands are 0.
 */
export function weaponQuality(item: ItemDef | undefined): number {
  if (!item) return 0;
  return (
    sumOf(item, 'damage', 'add') * (1 + sumOf(item, 'attackSpeed', 'mult')) +
    sumOf(item, 'crit', 'add') * 40 +
    sumOf(item, 'spellPower', 'add')
  );
}

/** The SURVIVOR_FAMILIES id an ItemDef is wielded as, from its tags; undefined when none fits. */
export function weaponFamilyOf(item: ItemDef): string | undefined {
  return SURVIVOR_FAMILY_ORDER.find((f) => item.tags.includes(f) && f in SURVIVOR_FAMILIES);
}

/** A registry entry by id, and nothing inherited: a tool id is data from the save. */
const own = <T>(table: Record<string, T>, id: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(table, id) ? table[id] : undefined;

interface Tools {
  weapon?: { item: ItemDef; family: string };
  /** The best piece per body slot. */
  worn: ItemDef[];
  accessories: ItemDef[];
  heals: number;
}

/**
 * Sort a survivor's tools into what it wields, wears and drinks. A survivor
 * wields its best weapon, wears the best piece of each slot and at most two
 * accessories; healing tools (a consumable restoring health) count up to
 * SURVIVOR_TOOLS.heals. An id nothing knows is ignored.
 */
function sortTools(ids: readonly string[]): Tools {
  const worn = new Map<string, ItemDef>();
  const accessories = new Map<string, ItemDef>();
  let weapon: Tools['weapon'];
  let heals = 0;
  for (const id of ids) {
    const item = own(ITEMS, id);
    if (item) {
      if (item.slot === 'weapon') {
        const family = weaponFamilyOf(item);
        if (family && (!weapon || weaponQuality(item) > weaponQuality(weapon.item))) weapon = { item, family };
      } else if (item.slot === 'accessory') {
        if (accessories.size < 2) accessories.set(item.id, item);
      } else {
        const held = worn.get(item.slot);
        if (!held || sumOf(item, 'armor', 'add') > sumOf(held, 'armor', 'add')) worn.set(item.slot, item);
      }
    } else if (own(MATERIALS, id)?.consumable?.restore?.some((r) => r.resource === 'hp')) {
      heals++;
    }
  }
  return {
    weapon,
    worn: [...worn.values()],
    accessories: [...accessories.values()],
    heals: Math.min(heals, SURVIVOR_TOOLS.heals),
  };
}

// ---------- Techniques ----------

/** Armour grows this share of its level-1 value per level above 1 (monsterStats.statsFromAttrs). */
const ARMOR_GROWTH = 0.05;

/** A technique can be run from `reach` when it can be entered from any position in it. */
function openFrom(id: string, reach: ReadonlySet<string>): boolean {
  const from = declaredPositions(TECHNIQUES[id]);
  return from === 'any' || from.some((p) => reach.has(p));
}

/**
 * Two to four techniques of the family, each reachable: the first is enterable
 * from neutral, each next from where the ones already drawn can leave a
 * fighter (a plain swing always recovers to neutral). A survivor therefore
 * never holds a technique its other moves can never reach. Signature
 * techniques draw three times as often.
 */
function drawTechniques(r: Rng, family: SurvivorFamily): string[] {
  const count = 2 + Math.floor(r() * 3);
  const chosen: string[] = [];
  const reach = new Set<string>([NEUTRAL_POSITION]);
  while (chosen.length < count) {
    const open = family.techniques.filter((id) => TECHNIQUES[id] && !chosen.includes(id) && openFrom(id, reach));
    if (!open.length) break;
    const id = weightedPick(
      r,
      open.map((value) => ({ value, weight: family.signature.includes(value) ? 3 : 1 })),
    );
    chosen.push(id);
    reach.add(TECHNIQUES[id].to);
  }
  return chosen;
}

/**
 * Rotation order for a set of techniques: the deepest position first. A
 * monster takes the first entry that is ready and open from where it stands,
 * so listing a chain's end ahead of its start lets the chain run (gather
 * opens coiled, lunge spends the coil, thrust finishes from extended) instead
 * of the start firing every time. Depth is the fewest exchanges from neutral
 * to an entry position; ties keep the order given.
 */
export function orderTechniques(ids: readonly string[]): string[] {
  const depth = new Map<string, number>([[NEUTRAL_POSITION, 0]]);
  const entryDepth = (id: string): number | undefined => {
    const from = declaredPositions(TECHNIQUES[id]);
    if (from === 'any') return 0;
    let best: number | undefined;
    for (const p of from) {
      const d = depth.get(p);
      if (d !== undefined && (best === undefined || d < best)) best = d;
    }
    return best;
  };
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of ids) {
      const d = entryDepth(id);
      if (d === undefined) continue;
      const to = TECHNIQUES[id].to;
      if (!depth.has(to) || depth.get(to)! > d + 1) {
        depth.set(to, d + 1);
        changed = true;
      }
    }
  }
  return ids
    .map((id, i) => ({ id, i, d: entryDepth(id) ?? 0 }))
    .sort((a, b) => b.d - a.d || a.i - b.i)
    .map((e) => e.id);
}

function drawWorkings(r: Rng, spec: NonNullable<SurvivorArchetype['workings']>): SurvivorWorking[] {
  const pool = [...spec.pool];
  const out: SurvivorWorking[] = [];
  while (out.length < spec.count && pool.length) {
    const w = pool.splice(Math.floor(r() * pool.length), 1)[0];
    if (!out.some((o) => o.group === w.group)) out.push(w);
  }
  return out;
}

const copyOf = (cast: SpellSource): SpellSource => JSON.parse(JSON.stringify(cast)) as SpellSource;

// ---------- The build ----------

function pickArchetype(r: Rng, species: string): SurvivorArchetype {
  return weightedPick(
    r,
    SURVIVOR_ARCHETYPES.map((value) => ({ value, weight: value.species[species] ?? 1 })),
  );
}

const round = (v: number, places: number): number => {
  const k = 10 ** places;
  return Math.round(v * k) / k;
};

export function survivorBuild(fieldSeed: number, fighter: SurvivorSubject): SurvivorBuild {
  const id = fighter.id;
  const given = givenName(fieldSeed, id);
  const ra = stream(fieldSeed, id, SALT.archetype);
  const arch = pickArchetype(ra, fighter.monsterId);
  let weaponId: string | null = arch.weapons.length ? pick(ra, arch.weapons) : null;
  let family = SURVIVOR_FAMILIES[arch.family];
  let swapped = false;

  const rt = stream(fieldSeed, id, SALT.techniques);
  let techniques = drawTechniques(rt, family);
  const workings = arch.workings ? drawWorkings(stream(fieldSeed, id, SALT.workings), arch.workings) : [];
  const rb = stream(fieldSeed, id, SALT.body);
  const armor0 = arch.armor[0] + rb() * (arch.armor[1] - arch.armor[0]);
  const jitter = ATTRIBUTE_LIST.map(() => 0.9 + rb() * 0.2);

  // ----- Tools merge in -----
  const tools = sortTools(fighter.tools ?? []);
  // A better weapon replaces the one in hand: its damage type and reach follow
  // it, and the techniques are drawn again from its family (the same stream).
  // A focus archetype keeps its own family: a caster does not drop its staff.
  if (tools.weapon && weaponQuality(tools.weapon.item) > weaponQuality(weaponId ? ITEMS[weaponId] : undefined)) {
    const sameFamily = tools.weapon.family === family.id;
    if (!arch.keepsFocus || sameFamily) {
      weaponId = tools.weapon.item.id;
      if (!sameFamily) {
        family = SURVIVOR_FAMILIES[tools.weapon.family];
        techniques = drawTechniques(rt, family);
        swapped = true;
      }
    }
  }
  const weapon = weaponId ? ITEMS[weaponId] : undefined;

  // Worn pieces add their flat armour at the survivors' level (see SURVIVOR_TOOLS);
  // resistances add as they are.
  const factor = 1 + ARMOR_GROWTH * (SURVIVOR_LEVELS.base + SURVIVOR_LEVELS.growth - 1);
  const resistances: Partial<Record<DamageType, number>> = { ...arch.resistances };
  let armor = armor0;
  for (const item of [...tools.worn, ...tools.accessories]) {
    armor += item.slot === 'accessory' ? SURVIVOR_TOOLS.accessoryArmor : sumOf(item, 'armor', 'add') / factor;
    for (const type of Object.keys(RES_STAT_BY_TYPE) as DamageType[]) {
      const value = sumOf(item, RES_STAT_BY_TYPE[type], 'add');
      if (value) resistances[type] = (resistances[type] ?? 0) + value;
    }
  }
  armor = Math.min(armor, SURVIVOR_TOOLS.armorCap);
  for (const type of Object.keys(resistances) as DamageType[]) resistances[type] = round(resistances[type]!, 3);

  // ----- The rotation: workings first, the techniques deepest-first, mendings last -----
  // A mending has no condition on health, so it fires at its first opening;
  // listing it last leaves that to the turns nothing else is ready.
  const rotation: MonsterAction[] = [
    ...workings.map((w): MonsterAction => ({ cast: copyOf(w.cast) })),
    ...orderTechniques(techniques).map((technique): MonsterAction => ({ technique })),
  ];
  if (arch.mending) rotation.push({ cast: copyOf(SURVIVOR_MENDING), uses: arch.mending });
  for (let i = 0; i < tools.heals; i++) rotation.push({ cast: copyOf(SURVIVOR_MENDING), uses: 1 });

  const inflicts = [...(arch.inflicts ?? []), ...(weaponId ? SURVIVOR_WEAPON_INFLICTS[weaponId] ?? [] : [])].map((a) => ({
    ...a,
  }));
  const kit: MonsterKit = {
    rotation,
    damageType: weapon?.damageType ?? family.damageType,
    range: swapped ? family.range : (arch.range ?? family.range),
    resistances,
    armor: round(armor, 2),
    inflicts,
  };

  // ----- Emphasis: the archetype's, jittered a tenth either way, scaled to keep the total -----
  const bias: Partial<Record<AttributeId, number>> = {};
  ATTRIBUTE_LIST.forEach((a, i) => {
    bias[a.id] = (arch.attrs[a.id] ?? 1) * jitter[i];
  });
  const def = MONSTERS[fighter.monsterId];
  const reference = def ? baseMonsterAttrs(def, SURVIVOR_LEVELS.base + SURVIVOR_LEVELS.growth) : undefined;
  let weights = 0;
  let weighted = 0;
  for (const a of ATTRIBUTE_LIST) {
    const w = reference ? Math.max(0, reference[a.id]) : 1;
    weights += w;
    weighted += w * bias[a.id]!;
  }
  const scale = weighted > 0 ? weights / weighted : 1;
  for (const a of ATTRIBUTE_LIST) bias[a.id] = round(bias[a.id]! * scale, 3);

  // ----- Power: the archetype's, the wielded weapon's, then each tool's -----
  const P = SURVIVOR_TOOLS.power;
  let power = arch.power + Math.min(P.weaponMax, weaponQuality(weapon) / P.weaponPer);
  for (const item of tools.worn) power += P.piece + sumOf(item, 'armor', 'add') * P.perArmor;
  power += tools.accessories.length * P.accessory + tools.heals * P.heal;

  return {
    name: `${titleCase(arch.name)} ${given}`,
    given,
    archetype: arch.id,
    family: family.id,
    weapon: weaponId,
    kit,
    attrBias: bias,
    power: round(Math.max(0, Math.min(P.cap, power)), 2),
  };
}

/**
 * The `startStagedGroup` member for one survivor meeting the player: its
 * species (the champion's def for the last one), its level and wounds, and
 * its build as kit, name and attribute emphasis. The champion is titled
 * "Champion <given name>".
 */
export function survivorMember(
  fieldSeed: number,
  fighter: SurvivorSubject,
  level: number,
  hpShare: number,
  champion = false,
): StagedMember {
  const build = survivorBuild(fieldSeed, fighter);
  return {
    monsterId: champion ? SURVIVOR_CHAMPION : fighter.monsterId,
    level,
    hpShare,
    kit: build.kit,
    name: champion ? `Champion ${build.given}` : build.name,
    attrBias: build.attrBias,
  };
}

/** "spearman" → "Spearman": an archetype noun as a title. */
function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
