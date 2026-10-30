/**
 * Shapes for the list fields the game defines precisely.
 *
 * The generic editor infers structure from whatever a value already holds,
 * which is honest but useless when the list is EMPTY: it can only offer "text
 * items / numbers / groups" and hope. These templates are the missing half —
 * for `activities`, `objectives`, `unlock`, `mods` and friends the shape is
 * known exactly, including which discriminated-union variants exist, so the
 * editor can offer "＋ kill objective" and produce a correctly-typed element
 * instead of an empty group you fill in by guesswork.
 *
 * Kept as data next to the editor rather than derived from `types.ts`: the
 * compiler's types are erased at runtime, and a hand-written table that the
 * content linter will immediately contradict if it drifts is honest enough.
 */

export interface Variant {
  id: string;
  label: string;
  /** One correctly-shaped element, with sensible non-empty defaults. */
  make: () => Record<string, unknown>;
}

export interface ListTemplate {
  /** Singular noun for the button: "＋ activity". */
  noun: string;
  hint?: string;
  variants: Variant[];
}

const one = (noun: string, make: () => Record<string, unknown>, hint?: string): ListTemplate => ({
  noun,
  hint,
  variants: [{ id: noun, label: noun, make }],
});

/** UnlockCondition — shared by skills, items, techniques, styles and recipes. */
const UNLOCK: ListTemplate = {
  noun: 'condition',
  hint: 'All conditions must hold.',
  variants: [
    { id: 'skill', label: 'skill level', make: () => ({ type: 'skill', id: '', level: 5 }) },
    { id: 'attr', label: 'attribute level', make: () => ({ type: 'attr', attr: 'str', level: 10 }) },
    { id: 'stat', label: 'counter at least', make: () => ({ type: 'stat', key: '', value: 10 }) },
    { id: 'statMax', label: 'counter at most', make: () => ({ type: 'statMax', key: '', value: 1 }) },
    { id: 'equippedTag', label: 'equipped tag', make: () => ({ type: 'equippedTag', tag: '' }) },
    { id: 'quest', label: 'quest completed', make: () => ({ type: 'quest', id: '' }) },
    { id: 'boon', label: 'prestige boon owned', make: () => ({ type: 'boon', id: '' }) },
  ],
};

/** Modifier — the one pipeline behind equipment, titles, styles and statuses. */
const MODS: ListTemplate = {
  noun: 'modifier',
  hint: "`add` is flat; `mult` is a fraction — 0.05 means +5%.",
  variants: [
    { id: 'mult', label: 'percentage (mult)', make: () => ({ stat: 'damage', op: 'mult', value: 0.05 }) },
    { id: 'add', label: 'flat (add)', make: () => ({ stat: 'damage', op: 'add', value: 1 }) },
    {
      id: 'perLevel',
      label: 'scales per level',
      make: () => ({ stat: 'damage', op: 'mult', value: 0, perLevel: 0.01 }),
    },
    {
      id: 'requiresTag',
      label: 'only with a tagged weapon',
      make: () => ({ stat: 'damage', op: 'mult', value: 0.05, requiresTag: '' }),
    },
  ],
};

/**
 * Keyed by field name, with `kind.field` taking precedence — the same
 * owner-aware pattern the reference pickers use, because `materials` means
 * `{ id, qty }` in a quest reward and something else elsewhere.
 */
export const LIST_TEMPLATES: Record<string, ListTemplate> = {
  // ---------- World ----------
  'spot.activities': {
    noun: 'activity',
    hint: 'What you can do standing here. `tags` are what reach SKILLS — a skill only manifests from an activity that emits one of its tags.',
    variants: [
      {
        id: 'train',
        label: 'train an attribute',
        make: () => ({ id: 'train_str', kind: 'train', attr: 'str', name: 'Train', icon: '💪' }),
      },
      {
        // Every train activity needs an attr (or attrXp) — the linter rejects
        // one that trains nothing — so a "skill" activity is an attribute
        // activity that also emits the skill's tag. Working a forge really
        // does build arms; the tag is what makes Smithing show up.
        id: 'trainSkill',
        label: 'train a skill (tagged)',
        make: () => ({
          id: 'train_skill',
          kind: 'train',
          attr: 'str',
          name: 'Work',
          icon: '🛠️',
          tags: [''],
        }),
      },
      { id: 'hunt', label: 'hunt', make: () => ({ id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' }) },
      { id: 'rest', label: 'rest', make: () => ({ id: 'rest', kind: 'rest', name: 'Rest', icon: '🛏️' }) },
      {
        id: 'explore',
        label: 'explore',
        make: () => ({ id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' }),
      },
      {
        id: 'gather',
        label: 'gather a material',
        make: () => ({
          id: 'gather_x',
          kind: 'gather',
          material: '',
          ticksPer: 120,
          name: 'Gather',
          icon: '🧺',
        }),
      },
      {
        id: 'job',
        label: 'job (pays gold)',
        make: () => ({ id: 'job_x', kind: 'job', gold: 10, ticksPer: 200, name: 'Work', icon: '💰' }),
      },
    ],
  },
  'spot.encounters': one(
    'encounter',
    () => ({ monsterId: '', weight: 100, level: [1, 3] }),
    'Weights are relative within the spot, not percentages.',
  ),
  'spot.connections': one(
    'connection',
    () => ({ to: '', ticks: 60 }),
    'Two-way unless you set oneWay — the registry mirrors it for you.',
  ),
  'spot.finds': one('find', () => ({ id: 'find_1', at: 0.5, desc: '' }), '`at` is a share of exploreTicks.'),
  'spot.exploreGates': one(
    'gate',
    () => ({ at: 0.5, requires: [{ type: 'skill', id: '', level: 5 }], desc: '' }),
    'The search stops dead here until the conditions hold — a flooded passage needing a light.',
  ),
  requires: UNLOCK,

  // ---------- Quests ----------
  'quest.objectives': {
    noun: 'objective',
    variants: [
      { id: 'kill', label: 'kill monsters', make: () => ({ type: 'kill', monsterId: '', count: 5, desc: '' }) },
      { id: 'craft', label: 'craft items', make: () => ({ type: 'craft', recipeId: '', count: 1, desc: '' }) },
      {
        id: 'collect',
        label: 'collect materials',
        make: () => ({ type: 'collect', materialId: '', qty: 5, desc: '' }),
      },
      { id: 'reach', label: 'reach a spot', make: () => ({ type: 'reach', spotId: '', desc: '' }) },
    ],
  },
  'quest.materials': one('material reward', () => ({ id: '', qty: 1 })),
  'quest.skillXp': one('skill XP reward', () => ({ id: '', xp: 50 })),

  // ---------- Monsters ----------
  'monster.entries': {
    noun: 'drop',
    hint: 'Weights are relative; `nothing` is how you make a drop uncommon.',
    variants: [
      { id: 'material', label: 'material', make: () => ({ kind: 'material', id: '', weight: 50, qty: [1, 1] }) },
      { id: 'item', label: 'item', make: () => ({ kind: 'item', id: '', weight: 10 }) },
      { id: 'rune', label: 'rune', make: () => ({ kind: 'rune', id: '', weight: 5 }) },
      { id: 'gold', label: 'gold', make: () => ({ kind: 'gold', weight: 30, qty: [1, 10] }) },
      { id: 'nothing', label: 'nothing', make: () => ({ kind: 'nothing', weight: 40 }) },
    ],
  },
  'monster.inflicts': one('inflicted condition', () => ({ id: '', intensity: 1, chance: 0.2 })),
  'monster.rotation': {
    noun: 'action',
    hint:
      'ONE ordered list, read top-down: the first entry that is ready and open from where the ' +
      'specimen stands is what it does. Order is the whole of its character. A cast is the same ' +
      'SpellSource shape the player’s grimoire stores, so any school is sayable here — ' +
      'build one on the \u{1F9E0} Psionics bench and paste it in.',
    variants: [
      { id: 'technique', label: 'technique', make: () => ({ technique: '' }) },
      {
        id: 'arcane',
        label: 'arcane sentence',
        make: () => ({ cast: { school: 'arcane', words: [] } }),
      },
      {
        id: 'psionic',
        label: 'psionic shape',
        make: () => ({ cast: { school: 'psionic', shape: {} } }),
      },
      { id: 'divine', label: 'miracle', make: () => ({ cast: { school: 'divine', litany: '' } }) },
    ],
  },

  // ---------- Titles, achievements, skills, recipes ----------
  // Named differently from `mods` but the same Modifier list underneath.
  'title.passive': MODS,
  'title.equipped': MODS,
  'achievement.tiers': one(
    'tier',
    () => ({ threshold: 10, bonus: [{ stat: 'damage', op: 'mult', value: 0.02 }] }),
    'Thresholds on the achievement’s statKey; each tier carries its own bonus.',
  ),
  'achievement.bonus': MODS,
  'skill.progression': one(
    'band',
    () => ({ from: 1, base: 'novice', rate: 'normal' }),
    'Bands take effect from their `from` level. base: beginner…; rate: fast | normal | slow | glacial.',
  ),
  'skill.tierNames': one('tier name', () => ({ level: 10, name: '' }), 'A title shown at that level.'),
  'recipe.cost': one('ingredient', () => ({ id: '', qty: 1 })),
  'recipe.alts': one(
    'alternative route',
    () => ({ id: 'alt', cost: [{ id: '', qty: 1 }] }),
    'Another way to make the same thing. Tried in order after `cost`, so put the cheapest stock first; set `qty` to make a better input yield more.',
  ),

  // ---------- Techniques ----------
  'technique.conditions': one(
    'condition',
    () => ({ subject: 'self.hpPct', op: '<=', value: 50 }),
    'All must hold. Subjects and ops are in the 🔍 lookup under “Trigger subjects”.',
  ),

  // ---------- Shared shapes, matched by field name ----------
  unlock: UNLOCK,
  requirements: UNLOCK,
  // A floor's gate is an UnlockCondition[] like any other, so it offers the
  // same variants. What differs is the authoring advice, not the shape:
  // prefer accumulation (gold, quest counts, discoveries, skill totals) over
  // anything that reads as a power check, and never leave a band whose every
  // floor names a discipline.
  gate: UNLOCK,
  mods: MODS,
  effects: MODS,
  bonus: MODS,
};

export function templateFor(kind: string, key: string): ListTemplate | undefined {
  return LIST_TEMPLATES[`${kind}.${key}`] ?? LIST_TEMPLATES[key];
}

/**
 * String-list fields whose vocabulary is a real registry, so the editor can
 * suggest the whole thing and flag anything unregistered. `monster.tags` is
 * the one that bites: the content linter REQUIRES every tag to exist in
 * MONSTER_TAGS, so inventing one here breaks the build rather than
 * registering itself.
 */
export const TAG_VOCABULARIES: Record<
  string,
  { metaKey: string; note: string; excludeCategory?: string }
> = {
  'monster.tags': {
    metaKey: 'monsterTags',
    // 'tier' tags (divine, mythic…) are DERIVED from the monster's `tier`
    // field. Declaring one by hand lets the bestiary contradict the stat
    // block, so the linter rejects it — hence they are not offered here.
    excludeCategory: 'tier',
    note: 'Must already exist in MONSTER_TAGS (bestiary.data.ts); inventing one fails the linter. Needs exactly one material tag and at least one taxon tag. Tier tags are set via `tier`, never listed here.',
  },
  'spot.tags': {
    metaKey: 'spotTags',
    note: 'Element tags (heat, cold, dark…) seep passive resist XP into whoever loiters here; `dark` is darkness at any hour (trains Darkvision, applies night-fighting penalties); `indoor` roofs the weather out; `settlement` means lamplight. A spot also inherits its area\'s and region\'s tags. Vocabulary: systems/exposure.ts.',
  },
  'area.tags': {
    metaKey: 'spotTags',
    note: 'Same vocabulary as spot tags, applied to EVERY spot in the area (effective tags are the union region ∪ area ∪ spot).',
  },
  'region.tags': {
    metaKey: 'spotTags',
    note: 'Same vocabulary as spot tags, applied to EVERY spot in the region — `dark` here is how a whole cave system stays black at noon.',
  },
};
