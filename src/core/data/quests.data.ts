import type { QuestDef } from '../types';
import { prose } from '../text/prose';
import { QUESTS_TEXT } from '../text/quests.text';

/**
 * Quests (adapted from proto26's firstPosting/hammerAndAnvil + new bridge
 * content). Chains are expressed with { type: 'quest' } requirements.
 * Turn-in requires standing at the giver's spot.
 */
export const QUESTS = prose<QuestDef>('QUESTS', QUESTS_TEXT, {
  // ---------- The Warden of the Foot (the user's first quest list, 2026-09-06) ----------
  //
  // Quest 1: meet the nine trades before trying the tower (talk objectives
  // read `met:*` live, so a greeting made early still counts). Quest 2:
  // familiarize with the open systems, on the Warden's own materials — the
  // starter bundle arrives as quest 1's reward, and the favor with it is what
  // makes the first miracle purchasable. PLACEHOLDER PROSE per docs/VOICE.md;
  // objectives and rewards are the settled part.
  faces_of_threshold: {
    id: 'faces_of_threshold',
    name: 'The Faces of Threshold',
    giver: 'warden_of_the_foot',
    objectives: [
      { type: 'talk', npcId: 'master_smith', },
      { type: 'talk', npcId: 'lectory_wizard', },
      { type: 'talk', npcId: 'chapel_priest', },
      { type: 'talk', npcId: 'militia_captain', },
      { type: 'talk', npcId: 'head_chef', },
      { type: 'talk', npcId: 'row_alchemist', },
      { type: 'talk', npcId: 'psionic_shaper', },
      { type: 'talk', npcId: 'dojo_master', },
    ],
    rewards: {
      gold: 60,
      levelXp: 50,
      // The introduction to the gods (the prior's doing, narratively): with
      // the turn-in's own +1 this reaches the cheapest miracle's price.
      favor: 4,
      // The Warden's crates: enough of everything to try each open craft.
      materials: [
        { id: 'iron_scrap', qty: 6 },
        { id: 'raw_meat', qty: 4 },
        { id: 'common_herb', qty: 4 },
        { id: 'spring_water', qty: 3 },
        { id: 'mendroot', qty: 3 },
      ],
      skillXp: [{ id: 'scouting', xp: 25 }],
    },
  },
  a_taste_of_everything: {
    id: 'a_taste_of_everything',
    name: 'A Taste of Everything',
    giver: 'warden_of_the_foot',
    requirements: [{ type: 'quest', id: 'faces_of_threshold' }],
    objectives: [
      { type: 'craft', recipeId: 'iron_ingot', count: 1, at: 'the_forges', },
      { type: 'craft', discipline: 'cooking', count: 1, at: 'granary_kitchens', },
      { type: 'craft', discipline: 'alchemy', count: 1, at: 'the_alembics', },
      { type: 'stat', key: 'bestiary:entries', value: 3, at: 'the_cages', },
      { type: 'stat', key: 'kills', value: 5, at: 'the_cages', },
      { type: 'stat', key: 'spells:inscribed', value: 1, at: 'the_reading_hall', },
      { type: 'stat', key: 'miracles:learned', value: 1, at: 'the_nine_chapels', },
    ],
    rewards: { gold: 250, levelXp: 75 },
  },
  the_first_ascent: {
    id: 'the_first_ascent',
    name: 'The First Ascent',
    giver: 'warden_of_the_foot',
    // Offered from the start and listed first: the recommended opening is
    // the tower. The two town quests are optional before it.
    // The collector pays the existing floor-clear latch when it yields the
    // toll stamp. Older saves that already cleared this floor still count.
    objectives: [{ type: 'stat', key: 'boss:f1_toll_hall', value: 1, }],
    rewards: { gold: 350, favor: 1, levelXp: 100 },
  },

  // ---- Floor 11, the stronghold (FLOOR_IDEAS.md §1.5, §5.3 item 2). The
  // repairs, in two quests; the second opens the wave on the wall. Offered
  // only before the stronghold is held (STRONGHOLD_KEY). Workers belong here
  // and are not built: worker creation is a later part of base building
  // (§5.3 item 8).
  f11_shore_up_the_gate: {
    id: 'f11_shore_up_the_gate',
    name: 'Shore Up the Gate',
    giver: 'f11_steward',
    requirements: [{ type: 'statMax', key: 'legacy:stronghold', value: 0 }],
    objectives: [
      { type: 'collect', materialId: 'hardwood', qty: 20, at: 'f11_yard' },
      { type: 'collect', materialId: 'iron_scrap', qty: 15, at: 'f11_road' },
    ],
    rewards: { gold: 200, levelXp: 150 },
  },
  f11_arm_the_wall: {
    id: 'f11_arm_the_wall',
    name: 'Arm the Wall',
    giver: 'f11_steward',
    requirements: [
      { type: 'quest', id: 'f11_shore_up_the_gate' },
      { type: 'statMax', key: 'legacy:stronghold', value: 0 },
    ],
    objectives: [
      { type: 'kill', monsterId: 'ph_siege_raider', count: 10, at: 'f11_yard' },
      { type: 'collect', materialId: 'iron_ingot', qty: 4, at: 'the_forges' },
    ],
    rewards: { gold: 250, levelXp: 200 },
  },

  // ==== HARBOR: quests (skeleton 2026-10-30; the harbor builder's section) ====

  // ==== FESTIVAL: quests (skeleton 2026-10-30; the festival builder's section) ====

  // ==== ABERRANT: quests (skeleton 2026-10-30; the aberrant builder's section) ====

  // ==== DESERT: quests (skeleton 2026-10-30; the desert builder's section) ====

  // ---- Vermin Festival quest chain -----
  /* DESC:
  whispers of a mysterious



   */
});
