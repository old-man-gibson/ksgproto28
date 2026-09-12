import type { NpcDef } from '../types';

/** NPCs stand at spots, chat, and hand out quests (ported/extended from proto26). */
export const NPCS: Record<string, NpcDef> = {
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
    desc: 'Holds the door for everyone and vouches for no one. The keyring is ornamental; the memory is not.',
    dialogue: [
      'Eight roads, one door. You will learn both ends of all of them.',
      'The tower was here first. The city is just how people wait near it.',
      'Climb whenever you like. The floor does not care whether you were ready.',
    ],
    quests: ['faces_of_threshold', 'a_taste_of_everything', 'the_first_ascent'],
  },
  master_smith: {
    id: 'master_smith',
    name: 'Ferra Ostwind',
    icon: '⚒️',
    spotId: 'the_forges',
    desc: 'Runs the third forge from the chimney end. Everything about her is measured in heats, including patience.',
    dialogue: [
      'Scrap costs nothing and teaches everything. Start there.',
      'Two heats to an ingot. Three if you talk while you work.',
      'The tower eats blades. Good news, if you sell them.',
    ],
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
    desc: 'Keeps the quiet in the Reading Hall by outlasting everyone who breaks it.',
    dialogue: [
      'A word is a tool — an instrument, rather. Say it like you mean to use it.',
      'The table takes no fee. The words charge you themselves — bill you, I should say.',
      'Start with fire. Everyone starts with fire. There are reasons — precedents, rather.',
    ],
    quests: [],
  },
  chapel_priest: {
    id: 'chapel_priest',
    name: 'Prior Ashvane',
    icon: '🕯️',
    spotId: 'the_nine_chapels',
    desc: 'Keeps all nine doors, including the two nobody discusses. Counts devotion the way a clerk counts grain.',
    dialogue: [
      'Favor is a ledger. Deeds go in, miracles come out.',
      'D’Enjalle answers the honest and the theatrical alike. Usvýlgr prefers you bring tools.',
      'The locked doors stay locked. The gods behind them are not owed introductions.',
    ],
    quests: [],
  },
  militia_captain: {
    id: 'militia_captain',
    name: 'Captain Hurst',
    icon: '💂',
    spotId: 'ironyard_gate',
    desc: 'Third generation at the Muster Gate. Squares up paperwork the way others square up recruits.',
    dialogue: [
      'New face. Good. Roads stay safe when strangers stay busy.',
      'Cages first. Sand second. Tower last, if you must.',
      'Lost fights come home through my gate. Try to walk in.',
    ],
    quests: [],
  },
  head_chef: {
    id: 'head_chef',
    name: 'Bryva Coll',
    icon: '👨‍🍳',
    spotId: 'granary_kitchens',
    desc: 'Feeds the granary crews from a kitchen the size of a barn. Her forearms carry scars from two different careers.',
    dialogue: [
      'You have until the next bell. Everything here is measured in bells.',
      'Meat, herb, heat. The stove forgives one mistake a meal.',
      'Climbers eat first in this city. It is not a courtesy — full stomachs come back down.',
    ],
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
      ],
    },
  },
  row_alchemist: {
    id: 'row_alchemist',
    name: 'Odri Venn',
    icon: '⚗️',
    spotId: 'the_alembics',
    desc: 'Owns the cleanest glass on the Row and never names a substance if a behaviour will do.',
    dialogue: [
      'The one that settles goes in first. Then the one that argues.',
      'Order is the recipe. The Row learned that expensively.',
      'What you bottle is what the sequence spells. Not what you hoped.',
    ],
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
    desc: 'Sits where the incense is thickest, facing no particular direction. People find they have already been noticed.',
    dialogue: [
      'No, the tower does not think. You were going to ask.',
      'The mind is a grip. Most people never close the hand.',
      'Come back when the word psionics means something here again.',
    ],
    quests: [],
  },
  dojo_master: {
    id: 'dojo_master',
    name: 'Master Ekwe',
    icon: '🥋',
    spotId: 'the_sand',
    desc: 'Rakes the Sand personally every morning, then spends the day reading footprints like a ledger.',
    dialogue: [
      'Footwork. Everything else is decoration on footwork.',
      'The Sand shows what you did. Not what you meant.',
      'Spar until the prints stop apologising.',
    ],
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
    desc: 'Keeps a rack under the gate arch and a second rack he does not show strangers. Every piece on both has been worn once by somebody who came back.',
    dialogue: [
      'Plain steel. Plain leather. It all comes back down the stairs eventually — I just resell it.',
      'Sizes are approximate. The tower does not measure you either.',
      'Clear the first floor and I will show you the other rack.',
    ],
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
    desc: 'Runs the dispensary hatch in the gate wall, where the wind cannot reach the shelves. Labels everything twice.',
    dialogue: [
      'Salve for cuts, broth for the rest. Read the label; I wrote it for you.',
      'The Row makes it. I make sure it does what the jar says.',
      'Buy before the climb. Nobody has ever wished they had less.',
    ],
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
    desc: 'Sells from the back of a cart that has not moved in eleven years. The wheels are painted on.',
    dialogue: [
      'Rations keep. Stew does not. Buy the one you will eat before the stairs.',
      'The kitchens cook it, I carry it forty paces. That is the whole margin.',
      'Bells are for the crews. You eat when you are hungry.',
    ],
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
};
