import type { AttributeId, DamageType, MonsterRange, SpellSource, StatusApplication } from '../types';

/**
 * The royale's survivors as people (docs/FESTIVAL.md §9.6): the tables the
 * enemy generator (systems/survivorGen.ts) draws from. A survivor's build is
 * an archetype, a weapon of the archetype's family, two to four techniques of
 * that family, a working for casters and priests, worn armour and an
 * attribute emphasis. Nothing here is saved; the build is rebuilt from the
 * field's seed, the survivor's id and its species.
 *
 * Plain data, not a registry: SURVIVOR_SPECIES (festival.data.ts) is the same
 * kind of table. Ids named here are checked by tests/survivorGen.test.ts.
 */

// ---------- Weapon families ----------

/**
 * How a weapon family fights. `damageType` and `range` are what a blow of the
 * family deals and from where; `techniques` are the TECHNIQUES ids a survivor
 * of the family draws from, every one a damaging move a monster rotation can
 * run (no buff-only, counter or gear-dependent entries: a monster reads only
 * a technique's entry positions and its cooldown). `signature` are the ones
 * that make the family what it is; they are drawn three times as often.
 *
 * The registry has few family-bound techniques (sword, katana, unarmed), so
 * the other families draw from the shared ones that suit them.
 */
export interface SurvivorFamily {
  id: string;
  damageType: DamageType;
  range: MonsterRange;
  techniques: string[];
  signature: string[];
}

export const SURVIVOR_FAMILIES: Record<string, SurvivorFamily> = {
  sword: {
    id: 'sword', damageType: 'slashing', range: 'melee',
    techniques: ['gather', 'lunge', 'thrust', 'crosscut', 'riposte', 'dirty_stab'],
    signature: ['thrust', 'crosscut', 'riposte'],
  },
  katana: {
    id: 'katana', damageType: 'slashing', range: 'melee',
    techniques: ['gather', 'lunge', 'thrust', 'iai_draw', 'finishing_cut', 'riposte'],
    signature: ['iai_draw', 'finishing_cut'],
  },
  dagger: {
    id: 'dagger', damageType: 'piercing', range: 'melee',
    techniques: ['gather', 'lunge', 'dirty_stab', 'hamstring', 'pocket_sand', 'riposte'],
    signature: ['dirty_stab', 'pocket_sand'],
  },
  blunt: {
    id: 'blunt', damageType: 'bludgeoning', range: 'melee',
    techniques: ['gather', 'heavy_blow', 'lunge', 'hamstring'],
    signature: ['heavy_blow'],
  },
  spear: {
    id: 'spear', damageType: 'piercing', range: 'melee',
    techniques: ['gather', 'lunge', 'impaling_swing', 'hamstring', 'dirty_stab', 'riposte'],
    signature: ['impaling_swing', 'lunge'],
  },
  bow: {
    id: 'bow', damageType: 'piercing', range: 'ranged',
    techniques: ['gather', 'lunge', 'dirty_stab', 'hamstring', 'riposte'],
    signature: ['hamstring', 'dirty_stab'],
  },
  greatsword: {
    id: 'greatsword', damageType: 'slashing', range: 'melee',
    techniques: ['gather', 'heavy_blow', 'lunge', 'hamstring', 'riposte'],
    signature: ['heavy_blow', 'riposte'],
  },
  staff: {
    id: 'staff', damageType: 'bludgeoning', range: 'melee',
    techniques: ['gather', 'heavy_blow', 'hamstring', 'riposte'],
    signature: ['heavy_blow'],
  },
  unarmed: {
    id: 'unarmed', damageType: 'bludgeoning', range: 'melee',
    techniques: ['gather', 'heavy_blow', 'whirl_kick', 'clinch_knee', 'slip_jab', 'ginga', 'meia_lua', 'taunt', 'german_suplex', 'pocket_sand'],
    signature: ['whirl_kick', 'clinch_knee', 'meia_lua'],
  },
};

/**
 * The family an ItemDef belongs to, by its tags: the first family here whose
 * id is among them. A katana is also tagged sword, so katana comes first.
 */
export const SURVIVOR_FAMILY_ORDER = ['katana', 'greatsword', 'spear', 'dagger', 'bow', 'staff', 'blunt', 'sword'];

/** Conditions a particular weapon adds to its wielder's blows. */
export const SURVIVOR_WEAPON_INFLICTS: Record<string, StatusApplication[]> = {
  ember_knife: [{ id: 'on_fire', intensity: 1, chance: 0.2 }],
};

// ---------- Workings ----------

/** The self-mending a priest brings and a healing tool becomes: a miracle that closes the caster's own wounds. */
export const SURVIVOR_MENDING: SpellSource = { school: 'divine', litany: 'litany_mending' };

/**
 * One working a caster or priest can draw. `group` keeps one build from
 * drawing two of the same element or school; the rotation reads a working's
 * power off the specimen's spell power, so the INT and WIS emphasis is what
 * makes it land.
 */
export interface SurvivorWorking {
  cast: SpellSource;
  group: string;
}

// ---------- Archetypes ----------

/**
 * A kind of fighter. `family` and `weapons` give its weapon (empty = bare
 * hands); `range` overrides the family's reach (a caster fights from the back
 * with a staff). `armor` is a range in monster armour units AT LEVEL 1: it
 * grows 5% a level, so a level-36 survivor wears 2.75 times these. `attrs`
 * are multipliers on the species' attributes, scaled back so the total is
 * kept. `power` is a bonus in levels for duels between survivors: first
 * guesses, ordered by a staged-fight sample of damage dealt times effective
 * health (the knight and the berserker on top, the mage at the bottom).
 * `keepsFocus` archetypes never trade their weapon for a loose one of another
 * family: a caster does not drop its staff for a blade it has no strength for.
 * `species` weights how often each survivor species draws it, so a species
 * still means something; a species not listed draws at weight 1.
 */
export interface SurvivorArchetype {
  id: string;
  name: string;
  family: string;
  weapons: string[];
  range?: MonsterRange;
  armor: [number, number];
  resistances?: Partial<Record<DamageType, number>>;
  inflicts?: StatusApplication[];
  attrs: Partial<Record<AttributeId, number>>;
  power: number;
  keepsFocus?: boolean;
  /** Workings drawn into the rotation, ahead of the techniques. */
  workings?: { pool: SurvivorWorking[]; count: number };
  /** A self-mending kept in the rotation after the techniques, with this many uses. */
  mending?: number;
  species: Record<string, number>;
}

export const SURVIVOR_ARCHETYPES: SurvivorArchetype[] = [
  {
    id: 'duelist', name: 'duelist', family: 'sword', weapons: ['rapier', 'iron_sword'],
    armor: [1, 2],
    inflicts: [{ id: 'bleeding', intensity: 1, chance: 0.15 }],
    attrs: { dex: 1.35, str: 0.95, con: 0.85, int: 0.8, wis: 0.9 },
    power: 1,
    species: { ph_survivor_blade: 3, ph_survivor_brute: 0.5 },
  },
  {
    id: 'ronin', name: 'swordsman', family: 'katana', weapons: ['katana', 'uchigatana', 'moonlit_katana'],
    armor: [1, 3],
    inflicts: [{ id: 'bleeding', intensity: 1, chance: 0.2 }],
    attrs: { dex: 1.2, str: 1.15, con: 0.85, int: 0.8, wis: 0.9 },
    power: 1.5,
    species: { ph_survivor_blade: 2, ph_survivor_brute: 0.7 },
  },
  {
    id: 'assassin', name: 'assassin', family: 'dagger', weapons: ['iron_dagger', 'bronze_dagger', 'ember_knife'],
    armor: [0, 1],
    inflicts: [{ id: 'bleeding', intensity: 1, chance: 0.25 }],
    attrs: { dex: 1.5, str: 1, con: 0.7, int: 0.8, wis: 0.8 },
    power: 0.5,
    species: { ph_survivor_blade: 3, ph_survivor_brute: 0.4 },
  },
  {
    id: 'archer', name: 'archer', family: 'bow', weapons: ['hunting_bow'],
    armor: [0, 1],
    inflicts: [{ id: 'bleeding', intensity: 1, chance: 0.15 }],
    attrs: { dex: 1.4, str: 0.9, con: 0.85, int: 0.8, wis: 0.9 },
    power: 0.5,
    keepsFocus: true,
    species: { ph_survivor_blade: 2.5, ph_survivor_brute: 0.5 },
  },
  {
    id: 'spearman', name: 'spearman', family: 'spear', weapons: ['old_spear'],
    armor: [2, 3],
    inflicts: [{ id: 'bleeding', intensity: 1, chance: 0.12 }],
    attrs: { str: 1.1, dex: 1.1, con: 1, int: 0.8, wis: 0.9 },
    power: 1,
    species: { ph_survivor_blade: 1, ph_survivor_brute: 2 },
  },
  {
    id: 'knight', name: 'knight', family: 'blunt', weapons: ['oak_club', 'old_hammer'],
    armor: [4, 6],
    resistances: { slashing: 0.1, piercing: 0.1 },
    attrs: { con: 1.2, str: 1.1, dex: 0.7, int: 0.7, wis: 0.9 },
    power: 2,
    species: { ph_survivor_blade: 0.4, ph_survivor_brute: 3 },
  },
  {
    id: 'caster', name: 'mage', family: 'staff', weapons: ['oak_staff'],
    range: 'ranged',
    armor: [0, 1],
    resistances: { arcane: 0.15 },
    attrs: { int: 3, wis: 1, str: 0.45, con: 1, dex: 0.8 },
    power: 0,
    keepsFocus: true,
    workings: {
      count: 3,
      pool: [
        { group: 'heat', cast: { school: 'arcane', words: ['fire', 'pierce'] } },
        { group: 'heat', cast: { school: 'arcane', words: ['fire', 'burst'] } },
        { group: 'cold', cast: { school: 'arcane', words: ['ice', 'pierce'] } },
        { group: 'cold', cast: { school: 'arcane', words: ['ice', 'crush'] } },
        { group: 'lightning', cast: { school: 'arcane', words: ['spark', 'burst'] } },
        { group: 'earth', cast: { school: 'arcane', words: ['stone', 'crush'] } },
        { group: 'dark', cast: { school: 'arcane', words: ['viciously', 'gloom', 'pierce'] } },
        { group: 'poison', cast: { school: 'arcane', words: ['venom', 'cut'] } },
      ],
    },
    species: { ph_survivor_blade: 2, ph_survivor_brute: 0.4 },
  },
  {
    id: 'priest', name: 'priest', family: 'staff', weapons: ['oak_staff'],
    armor: [1, 2],
    resistances: { dark: 0.1, light: 0.1 },
    attrs: { int: 2.2, wis: 1, con: 1.1, str: 0.6, dex: 0.8 },
    power: 0.5,
    keepsFocus: true,
    workings: {
      count: 2,
      pool: [
        { group: 'holy', cast: { school: 'divine', litany: 'holy_fire' } },
        { group: 'holy', cast: { school: 'divine', litany: 'litany_retribution' } },
        { group: 'lance', cast: { school: 'divine', litany: 'fractal_lance' } },
        { group: 'venom', cast: { school: 'divine', litany: 'venom_feast' } },
      ],
    },
    mending: 2,
    species: { ph_survivor_blade: 0.6, ph_survivor_brute: 1.5 },
  },
  {
    id: 'berserker', name: 'berserker', family: 'greatsword', weapons: ['steel_greatsword'],
    armor: [1, 2],
    inflicts: [{ id: 'bleeding', intensity: 1, chance: 0.2 }],
    attrs: { str: 1.45, con: 1.1, dex: 0.8, int: 0.6, wis: 0.7 },
    power: 1.5,
    species: { ph_survivor_blade: 0.4, ph_survivor_brute: 3 },
  },
  {
    id: 'brawler', name: 'brawler', family: 'unarmed', weapons: [],
    armor: [2, 3],
    resistances: { bludgeoning: 0.1 },
    attrs: { str: 1.2, dex: 1.1, con: 1.2, int: 0.6, wis: 0.7 },
    power: 1.5,
    species: { ph_survivor_blade: 0.5, ph_survivor_brute: 3 },
  },
];

// ---------- Tools ----------

/**
 * What the tools a survivor took from caches (FieldFighter.tools) add to its
 * build (systems/survivorGen.ts). A tool is an ItemDef id, or a consumable
 * material that restores health.
 *
 *  - A kit's armour is a level-1 figure that grows 5% a level, while an item's
 *    is flat, so a worn piece adds its armour divided by the level factor at
 *    the survivors' starting level plus their ten days of growth
 *    (SURVIVOR_LEVELS.base + growth).
 *  - `accessoryArmor`: a level-1 armour figure per accessory, a stand-in for
 *    the maxHp, dodge and similar stats a monster's kit has no field for.
 *  - `armorCap`: the most level-1 armour a build can wear.
 *  - `heals`: at most this many healing tools count; each is a one-use mending.
 *  - `power`: bonus levels for duels. A weapon adds its quality over
 *    `weaponPer` (to `weaponMax`), a worn piece `piece` plus its armour times
 *    `perArmor`, an accessory or a heal a flat amount; the total is held to
 *    `cap`.
 */
export const SURVIVOR_TOOLS = {
  accessoryArmor: 1,
  armorCap: 12,
  heals: 2,
  power: { cap: 6, weaponPer: 14, weaponMax: 2.5, piece: 0.3, perArmor: 0.05, accessory: 0.3, heal: 0.3 },
};

// ---------- Names ----------

/**
 * Personal names, built from syllables in three places: first, middle (often
 * none) and last. A field walks each list in its own stride, so no two
 * survivors on one field share a name. That needs the three lists' lengths
 * pairwise coprime (25, 7 and 16), which tests/survivorGen.test.ts checks.
 */
export const SURVIVOR_NAME_FIRST = [
  'Tam', 'Bran', 'Cor', 'Dal', 'Ed', 'Fen', 'Gar', 'Hal', 'Iv', 'Jor', 'Kel', 'Lor', 'Mar',
  'Nor', 'Os', 'Per', 'Quen', 'Ros', 'Sel', 'Tav', 'Ul', 'Ver', 'Wil', 'Yor', 'Ber',
];
export const SURVIVOR_NAME_MID = ['', 'a', 'e', 'i', 'o', 'u', 'er'];
export const SURVIVOR_NAME_LAST = [
  'sin', 'wyn', 'ric', 'dan', 'mund', 'lin', 'ard', 'wick',
  'ley', 'ton', 'vel', 'dis', 'na', 'ra', 'ta', 'len',
];
