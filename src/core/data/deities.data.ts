import type { DeityDef, DeityTagDef, PantheonDef } from '../types';
import { prose } from '../text/prose';
import { DEITIES_TEXT } from '../text/deities.text';

/**
 * The pantheon. A deity is content three ways at once: its TAGS are the
 * aspects miracles are cut from, its RELATION RULES decide which other
 * powers' miracles may share a grimoire page, and its miracles (in
 * spellcraft.data.ts, keyed by `deity`) are what worship actually buys.
 *
 * Relation rules are written from each deity's own point of view and
 * resolved pairwise in systems/deities.ts — one side's grudge outweighs the
 * other side's fondness, always. That rule is doing real work: Xima and
 * Kenese Paea court each other through their Bestial/Tribal aspects, but
 * Kenese despises the Honorable, and Xima is nothing if not that. They are
 * hostile, whatever their tribes share.
 *
 * Tags are open vocabulary — 'evil' and 'light' appear in rules before any
 * deity here carries them, which is exactly how dispositions toward gods not
 * yet written should work.
 */
export const DEITIES = prose<DeityDef>('DEITIES', DEITIES_TEXT, {
  ikthelthe: {
    id: 'ikthelthe',
    name: "Ik'Thel'the",
    epithet: 'the Infinity between Zero and One',
    icon: '🌀',
    tags: ['aberrant', 'zero', 'curious', 'warping', 'outer'],
    // No synergies, but no hostilities: the Infinity is merely watching.
  },
  denjalle: {
    id: 'denjalle',
    name: "D'Enjalle",
    epithet: 'the Shining Rapier',
    icon: '🤺',
    tags: ['humanoid', 'honorable', 'fire', 'organized'],
    synergies: [
      { anyOf: ['organized', 'honorable'] },
      // Humanoid gods who aren't evil or tricksters — unless also honorable.
      { anyOf: ['humanoid'], unless: ['evil', 'trickster'], waiver: ['honorable'] },
    ],
  },
  usvylgr: {
    id: 'usvylgr',
    name: 'Usvýlgr',
    epithet: 'the Crafty Hammer',
    icon: '🔨',
    tags: ['gigantoid', 'earth', 'crafting', 'trickster', 'organized'],
    synergies: [{ anyOf: ['crafting', 'earth'] }],
    // Disagrees with tricksters that don't share any of his synergy tags.
    hostilities: [{ anyOf: ['trickster'], unless: ['crafting', 'earth'] }],
  },
  xima: {
    id: 'xima',
    name: 'Xima',
    epithet: 'the Cold Sun',
    icon: '🩸',
    tags: ['bestial', 'cold', 'honorable', 'sacrificial', 'tribal', 'yolixoch pantheon'],
    synergies: [{ anyOf: ['bestial', 'tribal', 'yolixoch pantheon'], unless: ['fire', 'poison'] }],
  },
  cuixtli: {
    id: 'cuixtli',
    name: 'Cuixtli and Ilhuitonal',
    epithet: 'the First Hunter',
    icon: '🩸',
    tags: [ 'bestial', 'honorable', 'tribal', 'humanoid', 'lightning', 'wind', 'yolixoch pantheon', ],
    synergies: [
      { anyOf: ['bestial', 'tribal', 'honorable', 'yolixoch pantheon'], unless: ['poison', 'evil', 'aberrant'] },
    ],
  },
  kenese_paea: {
    id: 'kenese_paea',
    name: 'Kenese Paea',
    epithet: 'the Doubled Viper',
    icon: '🐍',
    tags: ['humanoid', 'poison', 'dark', 'sacrificial', 'tribal', 'foai pantheon'],
    synergies: [{ anyOf: ['bestial', 'evil', 'poison', 'sacrificial'] }],
    hostilities: [{ anyOf: ['honorable', 'light'] }],
  },
  tuigamala: {
    id: 'tuigamala',
    name: 'Tuigamala',
    epithet: 'the Treebreaker',
    icon: '🌿',
    tags: ['humanoid', 'tribal', 'nature', 'honorable', 'unaligned', 'foai pantheon'],
    synergies: [
      { anyOf: ['honorable', 'nature', 'foai pantheon'], unless: ['evil', 'poison', 'fire'] },
    ],
    hostilities: [
      { anyOf: ['evil', 'poison', 'fire'] },
    ],
  },
  yshicna: {
    id: 'yshicna',
    name: "yShicna'",
    epithet: 'Logic Purified',
    icon: '⚛️',
    tags: ['aberrant', 'atomic', 'arcane', 'curious', 'warping', 'outer'],
    // Neutral to everything, like Ik'Thel'the: the outer gods do not interface
    // with other gods, so they declare nothing in either direction. Cuixtli's
    // synergy already excludes `aberrant`, which is all the distaste the
    // mortal-facing pantheons need. See docs/NEXT.md — when that changes it
    // will be authored on THEIR side; deityRelation reads both ways.
  },

  // ----- The goblin gods (docs/plans/bands-2-3.md M7) -----
  // Fire, mud and the hunt (rats, birds and worms), worshipped by band 2's
  // witch doctors. Names, epithets and words are placeholders for the user.
  // Thievery and witch magic are planned later. Not starter deities, so a
  // player cannot pray to them until something meets them (unlocks.ts).
  goblin_fire: {
    id: 'goblin_fire',
    name: 'Goblin Fire God',
    epithet: 'placeholder',
    icon: '🔥',
    tags: ['tribal', 'humanoid', 'fire', 'chaotic', 'goblin pantheon'],
    synergies: [{ anyOf: ['goblin pantheon'] }],
    hostilities: [{ anyOf: ['water', 'cold'], unless: ['goblin pantheon'] }],
  },
  goblin_mud: {
    id: 'goblin_mud',
    name: 'Goblin Mud God',
    epithet: 'placeholder',
    icon: '🟤',
    tags: ['tribal', 'humanoid', 'earth', 'water', 'goblin pantheon'],
    synergies: [{ anyOf: ['goblin pantheon', 'earth'] }],
  },
  goblin_hunt: {
    id: 'goblin_hunt',
    name: 'Goblin Hunting God',
    epithet: 'placeholder',
    icon: '🐀',
    tags: ['tribal', 'bestial', 'nature', 'goblin pantheon'],
    synergies: [{ anyOf: ['goblin pantheon', 'bestial'] }],
    hostilities: [{ anyOf: ['honorable'] }],
  },
});

export const DEITY_LIST: DeityDef[] = Object.values(DEITIES);

/**
 * The aspect vocabulary, for the UI and the content linter. Every tag a
 * deity carries or a rule names must be registered here — including aspects
 * no current deity has, which exist so rules can anticipate them.
 */
const tag = (
  id: string,
  name: string,
  icon: string,
  category: DeityTagDef['category'],
): [string, DeityTagDef] => [id, { id, name, icon, category }];

export const DEITY_TAGS: Record<string, DeityTagDef> = Object.fromEntries([
  // How the power is worshipped — the shape of its cult, not its character.
  tag('outer', 'Outer God', '🌌', 'scope'),
  tag('tribal', 'Tribal God', '🔥', 'scope'),
  tag('organized', 'Organized God', '⛪', 'scope'),
  tag('syncretic', 'Syncretized God', '🔗', 'scope'),
  tag('pantheon', 'Pantheonic God', '🏛️', 'scope'),

  // What group the god belongs to, if any
  tag('yolixoch pantheon', 'Yolixoch Pantheon', '🌴💧','membership'),
  tag('foai pantheon', 'Foai Pantheon', '🏝️🌊', 'membership'),
  tag('goblin pantheon', 'Goblin Pantheon', '👺', 'membership'),

  // What it IS, insofar as that means anything.
  tag('bestial', 'Bestial', '🐾', 'nature'),
  tag('humanoid', 'Humanoid', '🧍', 'nature'),
  tag('gigantoid', 'Gigantoid', '🗿', 'nature'),
  tag('aberrant', 'Aberrant', '👁️', 'nature'),
  tag('celestial', 'Celestial', '✨', 'nature'),
  tag('infernal', 'Infernal', '😈', 'nature'),
  tag('mechanical', 'Mechanical', '⚙️', 'nature'),

  tag('evil', 'Evil', '🖤', 'alignment'),
  tag('good', 'Good', '🤍', 'alignment'),
  tag('neutral', 'Neutral', '⚖️', 'alignment'),
  tag('unaligned', 'Unaligned', '🎲', 'alignment'),
  tag('chaotic', 'Chaotic', '🌀', 'alignment'),
  tag('lawful', 'Lawful', '📜', 'alignment'),

  // What it is LIKE to deal with.
  tag('zero', 'Zero', '⭕', 'temperament'),
  tag('infinite', 'Infinite', '♾️', 'temperament'),
  // Quantities as personality — the aberrants' shared register. Atomic is the
  // indivisible: a thing that can be neither built up nor broken down.
  tag('atomic', 'Atomic', '⚛️', 'temperament'),
  tag('curious', 'Curious', '🔍', 'temperament'),
  tag('warping', 'Warping', '🌀', 'temperament'),
  tag('honorable', 'Honorable', '🎖️', 'temperament'),
  tag('sacrificial', 'Sacrificial', '🩸', 'temperament'),
  tag('trickster', 'Trickster', '🎭', 'temperament'),
  tag('crafting', 'Crafting', '🔨', 'temperament'),
  tag('stalwart', 'Stalwart', '🛡️', 'temperament'),
  tag('mercurial', 'Mercurial', '🌗', 'temperament'),

  // What it holds sway over.
  tag('fire', 'Fire', '🔥', 'domain'),
  tag('water', 'Water', '💧', 'domain'),
  tag('earth', 'Earth', '🪨', 'domain'),
  tag('wind', 'Wind', '💨', 'domain'),
  tag('lightning', 'Lightning', '⚡', 'domain'),
  tag('cold', 'Cold', '❄️', 'domain'),
  tag('poison', 'Poison', '🐍', 'domain'),
  tag('arcane', 'Arcane', '🔮', 'domain'),
  tag('dark', 'Dark', '🌑', 'domain'),
  tag('light', 'Light', '☀️', 'domain'),
  tag('metal', 'Metal', '🧲', 'domain'),
  tag('nature', 'Nature', '🌿', 'domain'),
]);

/** Filter axes, in the order the divine bench offers them. */
export const DEITY_TAG_CATEGORIES: { id: DeityTagDef['category']; name: string }[] = [
  { id: 'scope', name: 'Worship' },
  // A membership tag IS the pantheon claim — it already carries the body's
  // name and glyph, so `deityGroups` reads it directly rather than making a
  // god state its allegiance twice.
  { id: 'membership', name: 'Pantheon' },
  { id: 'nature', name: 'Nature' },
  { id: 'alignment', name: 'Alignment' },
  { id: 'temperament', name: 'Temperament' },
  { id: 'domain', name: 'Domain' },
];

/**
 * Bodies of gods worshipped together. A pantheon keeps no roster — each deity
 * claims its own membership (`DeityDef.pantheon`), so adding a god to one is
 * a single field on the god.
 *
 * Standing alone is itself a statement: the powers here today are unaffiliated
 * on purpose, and the bench shows them under their own heading.
 */
export const PANTHEONS: Record<string, PantheonDef> = {};

export const PANTHEON_LIST: PantheonDef[] = Object.values(PANTHEONS);
