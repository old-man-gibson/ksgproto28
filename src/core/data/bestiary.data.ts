import type { BestiaryFactDef, MonsterTagDef } from '../types';
import { prose, proseList } from '../text/prose';
import { MONSTER_TAGS_TEXT, BESTIARY_FACTS_TEXT } from '../text/bestiary.text';

/**
 * Bestiary vocabulary and pacing.
 *
 * Tags are the search axis: each monster carries its intrinsic ones (material,
 * taxon, element, trait, size) and the reader derives the rest (tier from the
 * def, `non_elemental` when nothing else applies). Adding a tag here is all it
 * takes for it to appear as a filter chip — the content test enforces that
 * every tag a monster uses is registered.
 */
export const MONSTER_TAGS = prose<MonsterTagDef>('MONSTER_TAGS', MONSTER_TAGS_TEXT, {
  // ---------- Material: what the thing is MADE of ----------
  living: { id: 'living', name: 'Living', category: 'material', icon: '🫀', },
  inorganic: { id: 'inorganic', name: 'Inorganic', category: 'material', icon: '🧱', },
  incorporeal: { id: 'incorporeal', name: 'Incorporeal', category: 'material', icon: '👻', },

  // ---------- Taxonomy: what family it belongs to ----------
  // The FIRST taxon tag a monster declares is its bestiary supergroup, so put
  // the family it files under ahead of any secondary kinship.
  slime: { id: 'slime', name: 'Slime', category: 'taxon', icon: '🟢' },
  beast: { id: 'beast', name: 'Beast', category: 'taxon', icon: '🐾' },
  vermin: { id: 'vermin', name: 'Vermin', category: 'taxon', icon: '🕷️', plural: 'Vermin' },
  humanoid: { id: 'humanoid', name: 'Humanoid', category: 'taxon', icon: '🧍' },
  goblin: { id: 'goblin', name: 'Goblin', category: 'taxon', icon: '👺' },
  construct: { id: 'construct', name: 'Construct', category: 'taxon', icon: '🗿' },
  undead: { id: 'undead', name: 'Undead', category: 'taxon', icon: '💀', plural: 'Undead' },
  spirit: { id: 'spirit', name: 'Spirit', category: 'taxon', icon: '🕯️' },
  dragon: { id: 'dragon', name: 'Dragon', category: 'taxon', icon: '🐉' },
  eldritch: { id: 'eldritch', name: 'Eldritch', category: 'taxon', icon: '🌀', plural: 'Eldritch', },
  plant: { id: 'plant', name: 'Plant', category: 'taxon', icon: '🌱' },

  // ---------- Element ----------
  non_elemental: { id: 'non_elemental', name: 'Non-elemental', category: 'element', icon: '⬜', },
  fire: { id: 'fire', name: 'Fire', category: 'element', icon: '🔥' },
  ice: { id: 'ice', name: 'Ice', category: 'element', icon: '❄️' },
  lightning: { id: 'lightning', name: 'Lightning', category: 'element', icon: '⚡' },
  earth: { id: 'earth', name: 'Earth', category: 'element', icon: '🪨' },
  wind: { id: 'wind', name: 'Wind', category: 'element', icon: '🌪️' },
  water: { id: 'water', name: 'Water', category: 'element', icon: '💧' },
  nature: { id: 'nature', name: 'Nature', category: 'element', icon: '🍃' },
  arcane: { id: 'arcane', name: 'Arcane', category: 'element', icon: '✨' },
  light: { id: 'light', name: 'Light', category: 'element', icon: '🔆' },
  dark: { id: 'dark', name: 'Dark', category: 'element', icon: '🌑' },
  toxic: { id: 'toxic', name: 'Toxic', category: 'element', icon: '☠️' },

  // ---------- Tier (derived from MonsterDef.tier — never authored by hand) ----------
  basic: { id: 'basic', name: 'Basic', category: 'tier', icon: '·' },
  veteran: { id: 'veteran', name: 'Veteran', category: 'tier', icon: '⭐' },
  elite: { id: 'elite', name: 'Elite', category: 'tier', icon: '🌟' },
  ancient: { id: 'ancient', name: 'Ancient', category: 'tier', icon: '🏛️' },
  legendary: { id: 'legendary', name: 'Legendary', category: 'tier', icon: '👑' },
  mythic: { id: 'mythic', name: 'Mythic', category: 'tier', icon: '🔱' },
  divine: { id: 'divine', name: 'Divine', category: 'tier', icon: '☀️' },

  // ---------- Traits: how it fights or behaves ----------
  flying: { id: 'flying', name: 'Flying', category: 'trait', icon: '🪽' },
  ranged: { id: 'ranged', name: 'Ranged', category: 'trait', icon: '🏹', },
  swarm: { id: 'swarm', name: 'Swarm', category: 'trait', icon: '🐝', },
  solitary: { id: 'solitary', name: 'Solitary', category: 'trait', icon: '🚪', },
  leader: { id: 'leader', name: 'Leader', category: 'trait', icon: '🎖️', },
  unique: { id: 'unique', name: 'Unique', category: 'trait', icon: '❗', },
  splitter: { id: 'splitter', name: 'Splitter', category: 'trait', icon: '✂️', },
  mimic: { id: 'mimic', name: 'Mimic', category: 'trait', icon: '🎭' },

  // ---------- Size ----------
  diminutive: { id: 'diminutive', name: 'Diminutive', category: 'size', icon: '🔸' },
  tiny: { id: 'tiny', name: 'Tiny', category: 'size', icon: '🔹' },
  small: {  id: 'small', name: 'Small', category: 'size', icon: '🔶' },
  medium: { id: 'medium', name: 'Medium', category: 'size', icon: '🔷' },
  large: { id: 'large', name: 'Large', category: 'size', icon: '🟠' },
  huge: { id: 'huge', name: 'Huge', category: 'size', icon: '🔵' },
  gargantuan: { id: 'gargantuan', name: 'Gargantuan', category: 'size', icon: '🟧' },
  colossal: { id: 'colossal', name: 'Colossal', category: 'size', icon: '🟦' },
});

/**
 * What a completed entry contains, and how hard each part is to learn.
 * Order here is the order the detail view renders in.
 */
export const BESTIARY_FACTS = proseList<BestiaryFactDef>('BESTIARY_FACTS', BESTIARY_FACTS_TEXT, [
  {
    id: 'lore',
    name: 'Field Notes',
    icon: '📝',
    minKills: 1,
    sureKills: 10,
    difficulty: 1.4,
  },
  {
    id: 'rewards',
    name: 'Worth',
    icon: '🪙',
    minKills: 2,
    sureKills: 20,
    difficulty: 1.2,
  },
  {
    id: 'vitals',
    name: 'Vitals',
    icon: '❤️',
    minKills: 3,
    sureKills: 30,
    difficulty: 1,
  },
  {
    id: 'offense',
    name: 'Offence',
    icon: '⚔️',
    minKills: 3,
    sureKills: 30,
    difficulty: 1,
  },
  {
    id: 'behavior',
    name: 'Behaviour',
    icon: '🧠',
    minKills: 5,
    sureKills: 45,
    difficulty: 0.8,
  },
  {
    id: 'defenses',
    name: 'Defences',
    icon: '🛡️',
    minKills: 8,
    sureKills: 70,
    difficulty: 0.6,
  },
  {
    id: 'loot_common',
    name: 'Common Spoils',
    icon: '🎒',
    minKills: 5,
    sureKills: 45,
    difficulty: 0.8,
  },
  {
    id: 'loot_rare',
    name: 'Rare Spoils',
    icon: '💎',
    minKills: 15,
    sureKills: 150,
    difficulty: 0.35,
  },
]);

/**
 * The pacing knobs. Per kill, a learnable fact rolls
 * `min(maxChance, (base + hunting×perHuntingLevel + (INT+WIS)×perMind) × difficulty)`.
 * Habitat is separate: it needs `habitatBase` sightings at a spot, minus one per
 * `habitatPerHunting` hunting levels, floored at `habitatFloor`.
 */
export const BESTIARY_TUNING = {
  base: 0.05,
  perHuntingLevel: 0.004,
  perMind: 0.0015,
  maxChance: 0.6,
  habitatBase: 10,
  habitatFloor: 5,
  habitatPerHunting: 10,
};
