import type { NpcDef } from '../types';
import { prose } from '../text/prose';
import { NPCS_TEXT } from '../text/npcs.text';

/** NPCs stand at spots, chat, and hand out quests (ported/extended from proto26). */
export const NPCS = prose<NpcDef>('NPCS', NPCS_TEXT, {
  // ---------- Threshold (plans/alpha-threshold-quests.md) ----------
  //
  // The nine faces of the user's first quest list (2026-09-06). PLACEHOLDER
  // PROSE throughout — names, descs and dialogue are drafts against
  // docs/VOICE.md (one speech deformation each, quests as deals) for the
  // user to recaption; placements and the talk mechanism are the settled
  // part. ⚠️ The psionic shaper's placement (Censer Walk) is a guess — the
  // system is shuttered, the person is not, and where such a person loiters
  // is the user's call.
  warden_of_the_foot: {
    id: 'warden_of_the_foot',
    name: 'The Warden of the Foot',
    icon: '🗝️',
    spotId: 'ascent_foot',
    quests: ['the_first_ascent', 'faces_of_threshold', 'a_taste_of_everything'],
  },
  master_smith: {
    id: 'master_smith',
    name: 'Ferra Ostwind',
    icon: '⚒️',
    spotId: 'the_forges',
    quests: [],
    // The smith sells what the forge eats: ore, scrap, wood, an ingot for
    // the impatient. Never a finished blade — that is the outfitter.
    shop: {
      name: 'The Scrap Bin',
      lines: [
        { kind: 'material', id: 'iron_scrap' },
        { kind: 'material', id: 'copper_ore' },
        { kind: 'material', id: 'tin_ore' },
        { kind: 'material', id: 'hardwood' },
        { kind: 'material', id: 'leather' },
        { kind: 'material', id: 'iron_ingot' },
      ],
    },
  },
  lectory_wizard: {
    id: 'lectory_wizard',
    name: 'Docent Marell',
    icon: '🧙',
    spotId: 'the_reading_hall',
    quests: [],
  },
  chapel_priest: {
    id: 'chapel_priest',
    name: 'Prior Ashvane',
    icon: '🕯️',
    spotId: 'the_nine_chapels',
    quests: [],
  },
  militia_captain: {
    id: 'militia_captain',
    name: 'Captain Hurst',
    icon: '💂',
    spotId: 'ironyard_gate',
    quests: [],
  },
  head_chef: {
    id: 'head_chef',
    name: 'Bryva Coll',
    icon: '👨‍🍳',
    spotId: 'granary_kitchens',
    quests: [],
    // Raw ingredients only. Dishes are sold at the Granary Gate, cooked here.
    shop: {
      name: 'The Larder Door',
      lines: [
        { kind: 'material', id: 'raw_meat' },
        { kind: 'material', id: 'river_fish' },
        { kind: 'material', id: 'wild_onion' },
        { kind: 'material', id: 'cave_mushroom' },
        { kind: 'material', id: 'rock_salt' },
        { kind: 'material', id: 'rough_flour' },
        { kind: 'material', id: 'bird_egg' },
        { kind: 'material', id: 'forest_berries' },
        { kind: 'material', id: 'wild_honey' },
        // Recipe cards (ConsumableSpec.teaches): the stove's learned dishes.
        { kind: 'material', id: 'recipe_herb_rubbed_meat' },
        { kind: 'material', id: 'recipe_fish_onion_pot' },
        // The windowed dishes (CraftOutcomeDef.heat): each card names its window.
        { kind: 'material', id: 'recipe_seared_stew' },
        { kind: 'material', id: 'recipe_braised_meat' },
        { kind: 'material', id: 'recipe_steeped_broth' },
      ],
    },
  },
  row_alchemist: {
    id: 'row_alchemist',
    name: 'Odri Venn',
    icon: '⚗️',
    spotId: 'the_alembics',
    quests: [],
    // Menstruums, the common essences, the cheap operators. What the Row
    // gathers, not what it brews — the brews are the bench.
    shop: {
      name: 'The Reagent Shelf',
      lines: [
        { kind: 'material', id: 'spring_water' },
        { kind: 'material', id: 'pressed_oil' },
        { kind: 'material', id: 'grain_spirit' },
        { kind: 'material', id: 'common_herb' },
        { kind: 'material', id: 'mendroot' },
        { kind: 'material', id: 'bloodwort' },
        { kind: 'material', id: 'fixing_salt' },
        { kind: 'material', id: 'bone_ash' },
        { kind: 'material', id: 'brimstone' },
      ],
    },
  },
  psionic_shaper: {
    id: 'psionic_shaper',
    name: 'Ilex',
    icon: '🧠',
    spotId: 'censer_walk',
    quests: [],
  },
  dojo_master: {
    id: 'dojo_master',
    name: 'Master Ekwe',
    icon: '🥋',
    spotId: 'the_sand',
    quests: [],
  },
  // ---------- Counters (shops, 2026-09-12) ----------
  //
  // General vendors stand at the district gates so the goods are on the way
  // in, not behind the bench. Prices derive from value (systems/shops.ts);
  // gated lines come out when the counter they name is stamped.
  ward_outfitter: {
    id: 'ward_outfitter',
    name: 'Pell Marrow',
    icon: '🛡️',
    spotId: 'wrights_gate',
    quests: [],
    shop: {
      name: 'The Rack',
      lines: [
        { kind: 'item', id: 'cloth_tunic' },
        { kind: 'item', id: 'leather_cap' },
        { kind: 'item', id: 'leather_vest' },
        { kind: 'item', id: 'leather_boots' },
        { kind: 'item', id: 'iron_gauntlets' },
        { kind: 'item', id: 'oak_club' },
        { kind: 'item', id: 'iron_dagger' },
        { kind: 'item', id: 'old_spear' },
        { kind: 'item', id: 'iron_sword' },
        { kind: 'item', id: 'hunting_bow' },
        { kind: 'item', id: 'oak_staff' },
        { kind: 'item', id: 'wooden_shield' },
        // The second rack: out once the first floor has been cleared.
        { kind: 'item', id: 'leather_jerkin', requires: [{ type: 'stat', key: 'boss:f1_toll_hall', value: 1 }] },
        { kind: 'item', id: 'iron_breastplate', requires: [{ type: 'stat', key: 'boss:f1_toll_hall', value: 1 }] },
        { kind: 'item', id: 'soldier_greaves', requires: [{ type: 'stat', key: 'boss:f1_toll_hall', value: 1 }] },
        { kind: 'item', id: 'rapier', requires: [{ type: 'stat', key: 'boss:f1_toll_hall', value: 1 }] },
      ],
    },
  },
  row_apothecary: {
    id: 'row_apothecary',
    name: 'Sister Nim',
    icon: '🩹',
    spotId: 'alembic_row_gate',
    quests: [],
    shop: {
      name: 'The Dispensary Hatch',
      lines: [
        { kind: 'material', id: 'healing_salve' },
        { kind: 'material', id: 'mushroom_broth' },
        { kind: 'material', id: 'mendroot' },
        { kind: 'material', id: 'spring_water' },
      ],
    },
  },
  granary_provisioner: {
    id: 'granary_provisioner',
    name: 'Orrin Tallow',
    icon: '🧺',
    spotId: 'granary_gate',
    quests: [],
    shop: {
      name: 'The Cart',
      lines: [
        { kind: 'material', id: 'travelers_ration' },
        { kind: 'material', id: 'rustic_loaf' },
        { kind: 'material', id: 'charred_roots' },
        { kind: 'material', id: 'skewered_fish' },
        { kind: 'material', id: 'hearty_stew' },
        { kind: 'material', id: 'hearty_sandwich' },
        { kind: 'material', id: 'seared_steak' },
      ],
    },
  },

  // ---------- Floor 2, the Long Hall (plans/alpha-band-one-floors.md) ----------
  //
  // The first teacher in the game (NpcDef.teaches, MARTIAL.md §10). A
  // placeholder person in a placeholder room: the user's brief is that the
  // fiction need not explain a gym in an office. Both lessons are free. Lunge
  // is held until something the player knows leads into Coiled — Gather,
  // here (martial.ts, Reach): no technique is taught that could never fire.
  // Magic Combat is taught, not found (user, 2026-10-25): the school's skill
  // waits on `taught:school_magic_combat`, and this lesson's requirements are
  // the ones the skill used to manifest on by itself.
  hall_tutor: {
    id: 'hall_tutor',
    name: 'Old Brannoc',
    icon: '🥋',
    spotId: 'f2_gym',
    quests: [],
    teaches: [
      { technique: 'gather' },
      { technique: 'lunge' },
      {
        school: 'school_magic_combat',
        requires: [
          { type: 'skill', id: 'fighting', level: 10 },
          { type: 'skill', id: 'magic', level: 10 },
          { type: 'attr', attr: 'int', level: 20 },
        ],
      },
    ],
  },
  hall_quartermaster: {
    id: 'hall_quartermaster',
    name: 'Quartermaster Pell',
    icon: '📦',
    spotId: 'f2_stores',
    quests: [],
    // The tower's one counter: salve and food, the things a climber runs out
    // of between stretches. Same wares as town, same derived prices.
    shop: {
      name: 'The Cage',
      lines: [
        { kind: 'material', id: 'healing_salve' },
        { kind: 'material', id: 'mushroom_broth' },
        { kind: 'material', id: 'travelers_ration' },
        { kind: 'material', id: 'rustic_loaf' },
      ],
    },
  },
});
