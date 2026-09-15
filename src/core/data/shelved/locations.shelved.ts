import type { AreaDef, Connection, RegionDef, SpotDef } from '../../types';

/**
 * THE SHELF — the countryside outside Threshold (shelved 2026-09-12).
 *
 * Nothing in this file is loaded by the game. The registry does not import
 * it, the forge catalog does not list it, and no lint runs over it unless a
 * test mounts it on purpose (tests/fixtures/shelved-world.ts). It exists so
 * the authorship is not lost and so the tests written against this world
 * keep running — docs/LONGTERM.md carries the why.
 *
 * Eight regions: Verdant Frontier (Oakrest, the woods, the ravine), the
 * Westlands (the starter hamlet, the old player home and its yard, the
 * hometown forest and river, the Malgeri foothills), the three Malgeri
 * regions, Stillail Hamlet, and the two swamp placeholders. Their spots,
 * the four NPCs who lived there (npcs.shelved.ts) and the six quests they
 * gave (quests.shelved.ts) move with them.
 *
 * Bringing one back is a paste into the live files plus the road that led
 * to it (`SHELVED_ROADS` below); nothing else was cut.
 */

export const SHELVED_REGIONS: Record<string, RegionDef> = {
  verdant_frontier: { id: 'verdant_frontier', name: 'Verdant Frontier', terrain: 'forest', world: { x: 12, y: 28 } },
  // TODO: confirm terrain — mixed country (hamlet, forest, river, foothills); plains is a guess
  // SPEC: plains adjacent to forest in the south
  westlands: { id: 'westlands', name: 'Westlands', terrain: 'plains', world: { x: 12.5, y: 26 } },
  malgeri_mountainrange: { id: 'malgeri_mountainrange', name: 'Malgeri Mountainrange', terrain: 'mountains', world: { x: 16, y: 29 } },
  // 'dark' on the REGION darkens every chamber: Darkvision trains down there
  // at any hour, and so do the night-fighting penalties it erodes.
  malgeri_cave_system: { id: 'malgeri_cave_system', name: 'Malgeri Cave System', terrain: 'caves', sheltered: true, tags: ['dark'], world: { x: 17.5, y: 30.5 } },
  malgeri_eastern_mountains: { id: 'malgeri_eastern_mountains', name: 'Malgeri Eastern Mountains', terrain: 'mountains', world: { x: 17.5, y: 32.5 } },
  // TODO: confirm terrain — coast if Stillail sits on the water on the Arevilia map
  // SPEC: it's
  stillail_hamlet: { id: 'stillail_hamlet', name: 'Stillail Hamlet', terrain: 'hills', world: { x: 14.9, y: 26.6 } },
  placeholder_western_swamp_region: {
    id: 'placeholder_western_swamp_region',
    name: 'Western Swamp',
    terrain: 'forest',
    world: { x: 11.5, y: 30.5 },
  },
  placeholder_western_swamp_peninsula: {
    id: 'placeholder_western_swamp_peninsula',
    name: 'Western Swamp Peninsula',
    terrain: 'coast',
    world: { x: 9, y: 34 },
  },
};

export const SHELVED_AREAS: Record<string, AreaDef> = {
  oakrest: { id: 'oakrest', name: 'Oakrest Village', regionId: 'verdant_frontier' },
  whispering_woods: { id: 'whispering_woods', name: 'Whispering Woods', regionId: 'verdant_frontier' },
  cragfall: { id: 'cragfall', name: 'Cragfall Ravine', regionId: 'verdant_frontier' },
  starter_hamlet: { id: 'starter_hamlet', name: 'Starter Hamlet', regionId: 'westlands' },
  player_home: { id: 'player_home', name: 'Player Home', regionId: 'westlands' },
  hometown_forest: { id: 'hometown_forest', name: 'Hometown Forest', regionId: 'westlands' },
  hometown_river: { id: 'hometown_river', name: 'Hometown River', regionId: 'westlands' },
  malgeri_mountains: { id: 'malgeri_mountains', name: 'Malgeri Mountains', regionId: 'westlands' },
  malgeri_mountainrange_area: {    id: 'malgeri_mountainrange_area',    name: 'Malgeri Mountainrange',    regionId: 'malgeri_mountainrange',
  },
  malgeri_cave_system_area: { id: 'malgeri_cave_system_area', name: 'Malgeri Cave System', regionId: 'malgeri_cave_system' },
  placeholder_western_swamp_region_area: {
    id: 'placeholder_western_swamp_region_area',
    name: 'Western Swamp',
    regionId: 'placeholder_western_swamp_region',
  },
  placeholder_western_swamp_peninsula_area: {
    id: 'placeholder_western_swamp_peninsula_area',
    name: 'Western Swamp Peninsula',
    regionId: 'placeholder_western_swamp_peninsula',
  },
};

export const SHELVED_SPOTS: Record<string, SpotDef> = {
  village_square: {
    id: 'village_square',
    name: 'Village Square',
    icon: '⛲',
    areaId: 'oakrest',
    tags: ['settlement'],
    map: { x: 50, y: 22 },
    waypoint: true,
    desc: 'The heart of Oakrest. A well, a notice board, and folk who nod as you pass.',
    activities: [
      { id: 'rest_inn', kind: 'rest', name: 'Rest at the Inn', icon: '🛏️' },
      { id: 'train_cha', kind: 'train', attr: 'cha', name: 'Barter at the Market', icon: '🎭' },
    ],
    connections: [
      { to: 'training_grounds', ticks: 30 },
      { to: 'village_library', ticks: 30 },
      { to: 'woods_edge', ticks: 80 },
      { to: 'ravine_rim', ticks: 150, label: 'Old Road' },
    ],
  },
  training_grounds: {
    id: 'training_grounds',
    name: 'Training Grounds',
    icon: '🎯',
    areaId: 'oakrest',
    map: { x: 28, y: 12 },
    desc: 'Straw dummies, a sparring ring, and the smell of effort.',
    activities: [
      { id: 'train_str', kind: 'train', attr: 'str', name: 'Lift Stones', icon: '🪨' },
      { id: 'train_dex', kind: 'train', attr: 'dex', name: 'Footwork Drills', icon: '👣' },
      { id: 'train_con', kind: 'train', attr: 'con', name: 'Endurance Run', icon: '🏃' },
      { id: 'train_everything', kind: 'train', name: 'EVERYTHING', icon: '🏃',
	  // No `attr` — the split IS the definition. Weights are multipliers, so
        // six ×0.5 entries pay 3× a normal rep in total, not one rep divided.
        attrXp: { 
		str: 25.5, 
		dex: 25.5, 
		con: 25.5, 
		int: 25.5, 
		wis: 25.5, 
		cha: 25.5 },
      },
      { id: 'spar', kind: 'train', attr: 'str', name: 'Spar with the Militia', icon: '🤺', tags: ['combat'] },
      { id: 'hunt', kind: 'hunt', name: 'Work the Dummies', icon: '🎯' },
    ],
    // The test bench: dummies never spawn with a rolled modifier, so what you
    // measure on one is what you measure on the next.
    encounters: [{ monsterId: 'training_dummy', weight: 100, level: [1, 1] }],
    modifierWeights: { normal: 100 },
    connections: [
      { to: 'benchmark_post', ticks: 20 },
    ],
  },
  benchmark_post: {
    id: 'benchmark_post',
    name: 'The Post',
    icon: '🪵',
    areaId: 'oakrest',
    map: { x: 16, y: 4 },
    desc: 'One oak post at the far end of the yard, and a slate where recruits chalk up what they managed. Nobody has ever had to replace it.',
    // Its own spot so the benchmark target is never mixed in with the
    // breakable dummies — a hunt draws from the spot's table, so one table
    // per kind of practice.
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Beat the Post', icon: '🪵' }],
    encounters: [{ monsterId: 'benchmark_dummy', weight: 100, level: [1, 1] }],
    modifierWeights: { normal: 100 },
    groupWeights: { 1: 100 },
    connections: [],
  },
  village_library: {
    id: 'village_library',
    name: 'Old Library',
    icon: '📚',
    areaId: 'oakrest',
    map: { x: 72, y: 12 },
    desc: 'Dust, candlelight, and more books than the village has readers.',
    activities: [
      { id: 'train_int', kind: 'train', attr: 'int', name: 'Study Tomes', icon: '📖' },
      { id: 'train_wis', kind: 'train', attr: 'wis', name: 'Meditate', icon: '🧘', tags: ['magic'] },
    ],
    connections: [],
  },
  woods_edge: {
    id: 'woods_edge',
    name: 'Woods Edge',
    icon: '🌳',
    areaId: 'whispering_woods',
    map: { x: 30, y: 42 },
    desc: 'Where the fields give way to old trees. Rustling that isn’t always the wind.',
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' },
      { id: 'rest_camp', kind: 'rest', name: 'Make Camp', icon: '🏕️' },
    ],
    encounters: [
      { monsterId: 'forest_rat', weight: 60, level: [1, 3] },
      { monsterId: 'young_wolf', weight: 40, level: [2, 4] },
    ],
    exploreTicks: 120,
    // The shallow end of the search: things anyone would turn up given an
    // afternoon, so the first explore a player ever runs pays out early.
    finds: [
      {
        id: 'herb_patch',
        at: 0.25,
        desc: '🌿 A patch of common herbs, half-hidden under the leaf litter.',
        material: { id: 'common_herb', qty: 3 },
        skillXp: { tags: ['herbalism'], xp: 12 },
      },
      {
        id: 'berry_thicket',
        at: 0.6,
        desc: '🫐 A bramble heavy with berries the birds somehow missed.',
        material: { id: 'forest_berries', qty: 4 },
      },
      {
        id: 'lost_purse',
        at: 1,
        desc: '💰 A purse in the roots — someone left this wood in a hurry.',
        gold: [12, 30],
      },
    ],
    connections: [
      { to: 'deep_woods', ticks: 100 },
    ],
  },
  deep_woods: {
    id: 'deep_woods',
    name: 'Deep Woods',
    icon: '🌲',
    areaId: 'whispering_woods',
    map: { x: 14, y: 58 },
    desc: 'The canopy swallows the sky. Things with teeth consider you thoughtfully.',
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' },
      { id: 'rest_camp', kind: 'rest', name: 'Make Camp', icon: '🏕️' },
    ],
    encounters: [
      { monsterId: 'wolf', weight: 55, level: [4, 7] },
      { monsterId: 'boar', weight: 45, level: [5, 8] },
    ],
    exploreTicks: 200,
    // The chute used to open only at 100%. Finding it at 55% is the whole
    // point of a graded search: the shortcut is a reward for looking, not a
    // consolation prize for finishing.
    finds: [
      {
        id: 'mushroom_ring',
        at: 0.3,
        desc: '🍄 A ring of pale caps around a stump, thriving in the gloom.',
        material: { id: 'cave_mushroom', qty: 2 },
        skillXp: { tags: ['herbalism'], xp: 18 },
      },
      {
        id: 'mossy_chute',
        at: 0.55,
        desc: '🕳️ The moss gives under your boot — there is a chute here, and it goes down a long way.',
        path: 'ravine_floor',
      },
      {
        id: 'old_camp',
        at: 0.85,
        desc: '⛺ A cold camp: a rotted pack, a whetstone, and no bones, which is the good news.',
        material: { id: 'iron_scrap', qty: 2 },
        gold: [20, 45],
      },
      { id: 'find_4', at: 1, desc: '', path: 'western_swamp_central_hub', requires: [{ id: 'scouting', type: 'skill', level: 35 }, { type: 'attr', attr: 'con', level: 25 }] },
    ],
    connections: [
      {
        to: 'ravine_floor',
        ticks: 40,
        oneWay: true,
        hidden: true,
        label: 'Slide down the mossy chute',
      },
      { to: 'western_swamp_central_hub', ticks: 260, hidden: true, label: 'to the swamps', returnLabel: 'to the weoods' },
    ],
  },
  ravine_rim: {
    id: 'ravine_rim',
    name: 'Ravine Rim',
    icon: '🪨',
    areaId: 'cragfall',
    map: { x: 72, y: 45 },
    desc: 'Wind screams along the edge. Hawks ride it, watching for the careless.',
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' },
    ],
    encounters: [
      { monsterId: 'cliff_hawk', weight: 80, level: [6, 9] },
      { monsterId: 'slime_wind', weight: 20, level: [6, 9] },
    ],
    exploreTicks: 150,
    // A vantage point pays in knowledge: from up here you can SEE the floor
    // of the ravine, which puts it on the map without the climb.
    finds: [
      {
        id: 'hawk_nest',
        at: 0.4,
        desc: '🪶 A hawk nest wedged in the rock, lined with what its owner stole.',
        material: { id: 'gold_leaf', qty: 1 },
        gold: [8, 20],
      },
      {
        id: 'ravine_overlook',
        at: 0.75,
        desc: '🔭 The wind drops long enough to see all the way down. Something moves on the ravine floor.',
        spot: 'ravine_floor',
        skillXp: { tags: ['explore'], xp: 40 },
      },
    ],
    connections: [
      // The same rope in both directions, but not the same act: you go down
      // it one way and haul yourself up it the other.
      { to: 'ravine_floor', ticks: 250, label: 'Steep Descent', returnLabel: 'Steep Climb' },
    ],
  },
  ravine_floor: {
    id: 'ravine_floor',
    name: 'Ravine Floor',
    icon: '🕳️',
    areaId: 'cragfall',
    map: { x: 52, y: 62 },
    desc: 'Cold shadow, dripping stone, and webs thick as rope. Something enormous once walked here.',
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' },
      { id: 'rest_spring', kind: 'rest', name: 'Rest at the Hidden Spring', icon: '⛲' },
    ],
    encounters: [
      { monsterId: 'cave_spider', weight: 60, level: [8, 12] },
      { monsterId: 'stone_golem', weight: 22, level: [10, 14] },
      { monsterId: 'slime_dark', weight: 18, level: [10, 14] },
    ],
    modifierWeights: { normal: 78, demiboss: 14, boss: 6, aberrant: 2 },
    // Ambush country: whatever lives down here hunts alone.
    groupWeights: { 1: 85, 2: 15 },
    exploreTicks: 250,
    // Deepest search in the demo world, and the only one that pays in a rune —
    // the reward curve should feel like it tracks how far down you went.
    finds: [
      {
        id: 'salt_seam',
        at: 0.2,
        desc: '🧂 A seam of rock salt glitters where the damp has eaten the wall away.',
        material: { id: 'rock_salt', qty: 3 },
      },
      {
        id: 'web_cache',
        at: 0.5,
        desc: '🕸️ Something wrapped and forgotten in the webs. It has not been forgotten long enough to rot.',
        material: { id: 'raw_sapphire', qty: 1 },
        gold: [30, 70],
      },
      {
        id: 'carved_stone',
        at: 0.9,
        desc: '🪨 A slab under the silt, carved by a hand that was not human. The mark on it still holds power.',
        rune: 'earthbind_rune',
        // Runecarving claims 'runecarving' now. It used to claim the bare
        // 'craft' — which every craft in the game emitted, so one slab taught
        // six trades. The tag is still what skills claim; it is just no longer
        // a tag they all share.
        skillXp: { tags: ['runecarving'], xp: 60 },
      },
    ],
    connections: [],
  },

  // ==================== WESTLANDS (ported from proto26) ====================
  hamlet_square: {
    id: 'hamlet_square',
    name: 'Hamlet Square',
    icon: '🏘️',
    areaId: 'starter_hamlet',
    tags: ['settlement'],
    map: { x: 38, y: 16 },
    waypoint: true,
    desc: 'A quiet roadside hamlet known for its humble forge and vigilant watch. This is where people come to argue.',
    activities: [
      { id: 'train_cha_debates', kind: 'train', attr: 'cha', name: 'Participate in Debates', icon: '🎭' },
      {
        id: 'job_guard',
        kind: 'job',
        gold: 10,
        ticksPer: 200,
        name: 'Stand Guard',
        icon: '💂',
        // A shift is a shift — fixed time; the reward scales instead.
        staticTime: true,
        outputFactors: [
          { stat: 'goldGain', weight: 1, base: 1 },
          { stat: 'travelSpeed', weight: 0.5, base: 1 },
        ],
      },
      { id: 'rest_hamlet', kind: 'rest', name: 'Rest at the Well', icon: '⛲' },
      {
        id: 'mill_grain',
        kind: 'gather',
        material: 'rough_flour',
        ticksPer: 140,
        name: 'Turn the Handmill',
        icon: '🌾',
        speedFactors: [
          { attr: 'str', weight: 0.008 },
          { attr: 'con', weight: 0.008 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
    ],
    connections: [
      { to: 'my_home', ticks: 20 },
      { to: 'hamlet_forge', ticks: 20 },
      { to: 'town_gates', ticks: 30 },
    ],
  },
  hamlet_forge: {
    id: 'hamlet_forge',
    name: "Kystel's Anvil",
    icon: '⚒️',
    areaId: 'starter_hamlet',
    // The forge floor radiates: loitering here seeps Heat Resistance (exposure.ts).
    tags: ['settlement', 'heat'],
    map: { x: 56, y: 10 },
    desc: 'The hamlet forge. The anvil’s song rewards patience — and pays modestly.',
    activities: [
      { id: 'job_bellows', kind: 'job', gold: 14, ticksPer: 250, name: 'Work the Bellows', icon: '🔥' },
      { id: 'train_str_hammers', kind: 'train', attr: 'str', name: 'Swing Practice Hammers', icon: '🔨', tags: ['blunt'] },
    ],
    recipes: [
      'iron_ingot',
      'iron_dagger',
      'iron_sword',
      'rapier',
      'parrying_dagger',
      'iron_breastplate',
      'leather',
      'leather_cap',
      'leather_vest',
      'leather_boots',
      'hunting_bow',
      'herbal_charm',
      'wolf_cloak',
      'uchigatana',
	  'katana'
    ],
    connections: [],
  },
  town_gates: {
    id: 'town_gates',
    name: 'Town Gates',
    icon: '🚪',
    areaId: 'starter_hamlet',
    map: { x: 52, y: 28 },
    desc: 'This is where people come and go. A steady post keeps the roads safe.',
    activities: [
      {
        id: 'job_patrol',
        kind: 'job',
        gold: 16,
        ticksPer: 280,
        name: 'Patrol the Gate',
        icon: '🛡️',
        staticTime: true,
        outputFactors: [
          { stat: 'goldGain', weight: 1, base: 1 },
          { stat: 'travelSpeed', weight: 0.5, base: 1 },
        ],
      },
      { id: 'train_dex_drills', kind: 'train', attr: 'dex', name: 'Formation Drills', icon: '👣' },
    ],
    connections: [
      { to: 'old_path', ticks: 50 },
    ],
  },
  my_home: {
    id: 'my_home',
    name: 'My Home',
    icon: '🏠',
    areaId: 'player_home',
    tags: ['settlement'],
    map: { x: 26, y: 15.5 },
    desc: 'A cozy personal dwelling with all the basic amenities needed for comfortable living.',
    activities: [
      { id: 'rest_home', kind: 'rest', name: 'Rest and Recover', icon: '🛏️' },
      {
        id: 'tend_garden',
        kind: 'gather',
        material: 'wild_onion',
        ticksPer: 130,
        name: 'Tend the Kitchen Garden',
        icon: '🧅',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { skill: 'herbalism', weight: 0.01 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      // The two solvents an alchemist can always get hold of. Everything else
      // in the alembic has to be found; a brew has to be raised in something,
      // so the two that decide DELIVERY are the two that live at home.
      {
        id: 'draw_water',
        kind: 'gather',
        material: 'spring_water',
        ticksPer: 90,
        name: 'Draw Water from the Well',
        icon: '💧',
        speedFactors: [{ attr: 'con', weight: 0.008 }],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 3,
      },
      {
        id: 'press_oil',
        kind: 'gather',
        material: 'pressed_oil',
        ticksPer: 170,
        name: 'Press Seed Oil',
        icon: '🫙',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'str', weight: 0.006 },
          { skill: 'herbalism', weight: 0.008 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        // The slowest of the three, and the one that makes throwables. The
        // reagent's own level gate is what keeps a novice from bottling
        // explosions; the still merely takes its time.
        id: 'run_still',
        kind: 'gather',
        material: 'grain_spirit',
        ticksPer: 260,
        name: 'Run the Still',
        icon: '🍶',
        // The still is alchemy, not "crafting in general" — it used to carry the
        // bare tag and so levelled smithing.
        tags: ['alchemy'],
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { skill: 'alchemy', weight: 0.014 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 1,
      },
      // A backyard dummy, so a fresh working can be tried the moment it is
      // inscribed instead of after a walk across the map.
      { id: 'hunt', kind: 'hunt', name: 'Practice on the Backyard Dummy', icon: '🎯' },
    ],
    encounters: [{ monsterId: 'benchmark_dummy', weight: 100, level: [1, 1] }],
    // A small carving bench in the corner — the first modular craft you own —
    // a kitchen's worth of cooking benches (one skill, four ways to apply
    // heat or not), a spellcrafting table serving three schools, and the
    // alembic, which is the kitchen's argumentative cousin.
    benches: [
      'runecarving',
      'preparing',
      'cooking',
      'baking',
      'grilling',
      'assembling',
      'alchemy',
      'spelltable',
    ],
    connections: [
      { to: 'living_room', ticks: 5 },
      { to: 'basement', ticks: 20 },
      { to: 'practice_yard', ticks: 5 },
      // The old footpath from this house to the hold is gone: the hold is a
      // floor of the Ascent now, and you reach it through the tower door like
      // any other floor. Restoring it is one forge gesture if that turns out
      // to be wrong.
    ],
  },
  /*
   * THE PRACTICE YARD — five posts, five spots, one defence each.
   *
   * One spot per post rather than one yard holding all five, for the reason
   * `benchmark_post` already gives: a hunt draws from the SPOT's table, so a
   * shared table would roll a random instrument and you could never choose the
   * one you came to read. Five pins is the price of being able to point at one.
   *
   * They sit five ticks from the door because a benchmark you have to walk to
   * is a benchmark you stop running.
   */
  practice_yard: {
    id: 'practice_yard',
    name: 'Practice Yard',
    icon: '🎯',
    areaId: 'player_home',
    map: { x: 32, y: 20 },
    desc: 'A strip of packed dirt behind the house with five posts sunk along it, each rigged to be wrong in exactly one way. A slate on the fence keeps the numbers.',
    activities: [],
    connections: [
      { to: 'my_home', ticks: 5 },
      { to: 'yard_reinforced', ticks: 2 },
      { to: 'yard_swaying', ticks: 2 },
      { to: 'yard_flopping', ticks: 2 },
      { to: 'yard_warded', ticks: 2 },
      { to: 'yard_mending', ticks: 2 },
    ],
  },
  yard_reinforced: {
    id: 'yard_reinforced',
    name: 'The Reinforced Post',
    icon: '🛡️',
    areaId: 'player_home',
    map: { x: 38, y: 17 },
    desc: 'Iron banding, and a chalk line under it reading 100.',
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Beat the Reinforced Post', icon: '🛡️' }],
    encounters: [{ monsterId: 'reinforced_post', weight: 100, level: [1, 1] }],
    modifierWeights: { normal: 100 },
    groupWeights: { 1: 100 },
    connections: [{ to: 'practice_yard', ticks: 2 }],
  },
  yard_swaying: {
    id: 'yard_swaying',
    name: 'The Swaying Post',
    icon: '💨',
    areaId: 'player_home',
    map: { x: 38, y: 21 },
    desc: 'Sprung at the base, and still moving from the last person who tried.',
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Beat the Swaying Post', icon: '💨' }],
    encounters: [{ monsterId: 'swaying_post', weight: 100, level: [1, 1] }],
    modifierWeights: { normal: 100 },
    groupWeights: { 1: 100 },
    connections: [{ to: 'practice_yard', ticks: 2 }],
  },
  yard_flopping: {
    id: 'yard_flopping',
    name: 'The Flopping Post',
    icon: '🥊',
    areaId: 'player_home',
    map: { x: 38, y: 25 },
    desc: 'Counterweighted, so it comes back. The only one in the yard that hits you.',
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Let the Flopping Post Hit You', icon: '🥊' }],
    encounters: [{ monsterId: 'flopping_post', weight: 100, level: [1, 1] }],
    modifierWeights: { normal: 100 },
    groupWeights: { 1: 100 },
    connections: [{ to: 'practice_yard', ticks: 2 }],
  },
  yard_warded: {
    id: 'yard_warded',
    name: 'The Warded Post',
    icon: '✴️',
    areaId: 'player_home',
    map: { x: 26, y: 25 },
    desc: 'Chalked over so thoroughly the oak underneath is a rumour.',
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Beat the Warded Post', icon: '✴️' }],
    encounters: [{ monsterId: 'warded_post', weight: 100, level: [1, 1] }],
    modifierWeights: { normal: 100 },
    groupWeights: { 1: 100 },
    connections: [{ to: 'practice_yard', ticks: 2 }],
  },
  yard_mending: {
    id: 'yard_mending',
    name: 'The Mending Post',
    icon: '🌿',
    areaId: 'player_home',
    map: { x: 32, y: 27 },
    desc: 'Still rooted, still growing, and visibly closing over yesterday.',
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Beat the Mending Post', icon: '🌿' }],
    encounters: [{ monsterId: 'mending_post', weight: 100, level: [1, 1] }],
    modifierWeights: { normal: 100 },
    groupWeights: { 1: 100 },
    connections: [{ to: 'practice_yard', ticks: 2 }],
  },
  living_room: {
    id: 'living_room',
    name: 'Living Room',
    icon: '🛋️',
    areaId: 'player_home',
    tags: ['indoor'],
    map: { x: 12.5, y: 15 },
    desc: 'Soft furnishings and warm lighting. A perfect place to relax and contemplate.',
    activities: [
      { id: 'train_int_books', kind: 'train', attr: 'int', name: 'Read Books', icon: '📖' },
      { id: 'train_wis_contemplate', kind: 'train', attr: 'wis', name: 'Contemplate', icon: '🕯️' },
    ],
    connections: [
    ],
  },
  basement: {
    id: 'basement',
    name: 'Basement',
    icon: '🕳️',
    areaId: 'player_home',
    tags: ['indoor'],
    map: { x: 18, y: 24 },
    desc: 'A dimly lit storage area. Strange sounds echo from the darker corners, and something wobbles in the shadows.',
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Clear Out the Infestation', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' },
      {
        id: 'pick_mushrooms',
        kind: 'gather',
        material: 'cave_mushroom',
        ticksPer: 150,
        name: 'Pick Cellar Mushrooms',
        icon: '🍄',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { skill: 'herbalism', weight: 0.01 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      // Gloomcap wants somewhere light never gets to, and the cellar qualifies.
      // The invisibility line starts under the house.
      {
        id: 'pick_gloomcap',
        kind: 'gather',
        material: 'gloomcap',
        ticksPer: 210,
        name: 'Pick Gloomcaps',
        icon: '🌚',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.01 },
          { skill: 'herbalism', weight: 0.014 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 1,
      },
    ],
    encounters: [
      { monsterId: 'slime_base_basic', weight: 80, level: [1, 3] },
      { monsterId: 'forest_rat', weight: 20, level: [1, 3] },
    ],
    exploreTicks: 120,
    // The culture bench lives down here rather than in the workshop, and not
    // only for the atmosphere: the basement already spawns the slimes whose
    // genes are the first line anyone can actually collect, so harvesting and
    // refining happen in the same room. It stays hidden until the quest opens
    // the system — see LocationPanel, which filters it.
    benches: ['mutagens'],
    // Histones are spooled here too — the bulk a new connection is built from,
    // and the brake on how fast a chromosome can grow.
    recipes: ['histone'],
    connections: [
      {
        to: 'riverbank',
        ticks: 60,
        oneWay: true,
        hidden: true,
        label: 'Squeeze through the collapsed tunnel',
      },
    ],
  },
  old_path: {
    id: 'old_path',
    name: 'Path out of Town',
    icon: '🛤️',
    areaId: 'starter_hamlet',
    map: { x: 58, y: 42 },
    desc: 'The old road forks here: forest to the north, mountains looming beyond.',
    activities: [{ id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' }],
    exploreTicks: 80,
    connections: [
      { to: 'forest_edge_w', ticks: 60 },
      { to: 'malgeri_path', ticks: 120 },
    ],
  },
  forest_edge_w: {
    id: 'forest_edge_w',
    name: 'Edge of the Forest',
    icon: '🌳',
    areaId: 'hometown_forest',
    map: { x: 42, y: 52 },
    desc: 'Ancient trees loom ahead, a natural boundary between the hamlet and the mysterious depths.',
    activities: [
      {
        id: 'gather_herbs',
        kind: 'gather',
        material: 'common_herb',
        ticksPer: 150,
        name: 'Gather Forest Herbs',
        icon: '🌿',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.01 },
          { attr: 'dex', weight: 0.006 },
          { skill: 'herbalism', weight: 0.01 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        id: 'gather_berries',
        kind: 'gather',
        material: 'forest_berries',
        ticksPer: 130,
        name: 'Pick Wild Berries',
        icon: '🫐',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { attr: 'dex', weight: 0.008 },
          { skill: 'herbalism', weight: 0.01 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      // The starter reagents: one substance that reads hot and one that mends.
      // Both are herbs, so the alchemist's first shelf is stocked by the skill
      // that already gates the alembic.
      {
        id: 'cut_emberbloom',
        kind: 'gather',
        material: 'emberbloom',
        ticksPer: 175,
        name: 'Cut Emberbloom',
        icon: '🌺',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.01 },
          { skill: 'herbalism', weight: 0.012 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        id: 'dig_mendroot',
        kind: 'gather',
        material: 'mendroot',
        ticksPer: 160,
        name: 'Dig Mendroot',
        icon: '🌱',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { attr: 'str', weight: 0.006 },
          { skill: 'herbalism', weight: 0.012 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        id: 'raid_nests',
        kind: 'gather',
        material: 'bird_egg',
        ticksPer: 170,
        name: 'Raid Bird Nests',
        icon: '🥚',
        // Climbing, not botany: quick hands and steady nerves.
        speedFactors: [
          { attr: 'dex', weight: 0.012 },
          { attr: 'con', weight: 0.006 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      { id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' },
    ],
    encounters: [
      { monsterId: 'slime_base_basic', weight: 35, level: [2, 4] },
      { monsterId: 'goblin', weight: 35, level: [2, 5] },
      { monsterId: 'slime_nature', weight: 20, level: [2, 5] },
      { monsterId: 'slime_honey', weight: 10, level: [2, 4] },
    ],
    connections: [
      { to: 'deep_forest_w', ticks: 100 },
    ],
  },
  deep_forest_w: {
    id: 'deep_forest_w',
    name: 'Deep Forest',
    icon: '🌲',
    areaId: 'hometown_forest',
    map: { x: 25, y: 62 },
    desc: 'Sunlight filters through the thick canopy, creating an otherworldly atmosphere.',
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt Forest Wildlife', icon: '🏹' },
      {
        id: 'gather_wood',
        kind: 'gather',
        material: 'hardwood',
        ticksPer: 200,
        name: 'Cut Hardwood Trees',
        icon: '🪓',
		tags: ['woodcutting'],
        speedFactors: [
          { attr: 'str', weight: 0.01 },
          { attr: 'dex', weight: 0.006 },
		  { skill: 'woodcutting', weight: 0.025},
        ],
        outputFactors: [
		{ stat: 'loot', weight: 1, base: 1 },
			{skill: 'woodcutting', weight: 0.01}, ],
        outputCap: 2,
      },
      {
        id: 'smoke_hive',
        kind: 'gather',
        material: 'wild_honey',
        ticksPer: 220,
        name: 'Smoke Out a Wild Hive',
        icon: '🍯',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { attr: 'con', weight: 0.008 },
          { skill: 'herbalism', weight: 0.01 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      // The two reagents worth walking for: one that poisons and one that
      // drives the blood. Both deep enough in that nobody picks them by mistake.
      {
        id: 'gather_nightcap',
        kind: 'gather',
        material: 'nightcap',
        ticksPer: 200,
        name: 'Gather Nightcaps',
        icon: '🍄',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.012 },
          { skill: 'herbalism', weight: 0.014 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        id: 'pull_bloodwort',
        kind: 'gather',
        material: 'bloodwort',
        ticksPer: 190,
        name: 'Pull Bloodwort',
        icon: '🌡️',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { attr: 'str', weight: 0.008 },
          { skill: 'herbalism', weight: 0.012 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      { id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' },
      { id: 'rest_camp', kind: 'rest', name: 'Make Camp', icon: '🏕️' },
    ],
    encounters: [
      { monsterId: 'goblin', weight: 35, level: [3, 6] },
      { monsterId: 'slime_ice_basic', weight: 22, level: [2, 5] },
      { monsterId: 'slime_base_advanced', weight: 20, level: [4, 6] },
      { monsterId: 'slime_nature', weight: 13, level: [3, 6] },
      { monsterId: 'slime_spider', weight: 10, level: [4, 7] },
    ],
    exploreTicks: 180,
    connections: [
      { to: 'riverbank', ticks: 90 },
    ],
  },
  riverbank: {
    id: 'riverbank',
    name: 'Riverbank',
    icon: '🏞️',
    areaId: 'hometown_river',
    map: { x: 8.5, y: 66 },
    desc: 'Cold, quick water over smooth stones. Slimes gather here for reasons known only to slimes.',
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' },
      {
        id: 'gather_herbs',
        kind: 'gather',
        material: 'common_herb',
        ticksPer: 140,
        name: 'Gather Riverside Herbs',
        icon: '🌿',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.01 },
          { attr: 'dex', weight: 0.006 },
          { skill: 'herbalism', weight: 0.01 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        id: 'fish_shallows',
        kind: 'gather',
        material: 'river_fish',
        ticksPer: 170,
        name: 'Fish the Shallows',
        icon: '🎣',
        speedFactors: [
          { attr: 'dex', weight: 0.01 },
          { attr: 'wis', weight: 0.006 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        id: 'scrape_frostmoss',
        kind: 'gather',
        material: 'frostmoss',
        ticksPer: 165,
        name: 'Scrape Frostmoss',
        icon: '🧊',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { attr: 'dex', weight: 0.008 },
          { skill: 'herbalism', weight: 0.012 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      { id: 'rest_camp', kind: 'rest', name: 'Make Camp', icon: '🏕️' },
    ],
    encounters: [
      { monsterId: 'slime_ice_basic', weight: 30, level: [3, 6] },
      { monsterId: 'slime_base_advanced', weight: 25, level: [4, 7] },
      { monsterId: 'slime_water', weight: 25, level: [3, 6] },
      { monsterId: 'slime_water_advanced', weight: 12, level: [5, 8] },
      { monsterId: 'slime_ice_advanced', weight: 8, level: [5, 8] },
    ],
    connections: [],
  },
  malgeri_path: {
    id: 'malgeri_path',
    name: 'Path to the Malgeri Mountains',
    icon: '⛰️',
    areaId: 'malgeri_mountains',
    map: { x: 81, y: 38.5 },
    desc: 'The air thins and the trees give way to stone. Something glows faintly on the slopes above.',
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' }],
    encounters: [
      { monsterId: 'goblin', weight: 35, level: [5, 8] },
      { monsterId: 'slime_fire', weight: 25, level: [4, 7] },
      { monsterId: 'slime_earth', weight: 20, level: [4, 7] },
      { monsterId: 'slime_wind', weight: 12, level: [4, 7] },
      { monsterId: 'slime_thunder', weight: 8, level: [5, 8] },
    ],
    connections: [
      { to: 'old_path', ticks: 120 },
      { to: 'malgeri_base', ticks: 100 },
      { to: 'ravine_rim', ticks: 400, label: 'Mountain Trade Road' },
    ],
  },
  malgeri_base: {
    id: 'malgeri_base',
    name: 'Malgeri Mountains Base',
    icon: '🏔️',
    areaId: 'malgeri_mountains',
    map: { x: 79, y: 24 },
    waypoint: true,
    desc: 'A wind-scoured camp at the mountain’s foot. The rocks are warm where they shouldn’t be.',
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' },
      {
        id: 'mine_scree',
        kind: 'gather',
        material: 'iron_scrap',
        ticksPer: 180,
        name: 'Mine the Scree',
        icon: '⛏️',
        tags: ['mining'],
        // Faster with muscle, stamina, and mining know-how.
        speedFactors: [
          { attr: 'str', weight: 0.01 },
          { attr: 'con', weight: 0.008 },
          { skill: 'mining', weight: 0.02 },
        ],
        // Bigger hauls from mining skill and loot luck, capped.
        outputFactors: [
          { skill: 'mining', weight: 0.01 },
          { stat: 'loot', weight: 1, base: 1 },
        ],
        outputCap: 2,
      },
      {
        id: 'chip_salt',
        kind: 'gather',
        material: 'rock_salt',
        ticksPer: 160,
        name: 'Chip Rock Salt',
        icon: '🧂',
        tags: ['mining'],
        speedFactors: [
          { attr: 'str', weight: 0.008 },
          { skill: 'mining', weight: 0.02 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      /*
       * The mineral half of the shelf. Every OPERATOR is dug out of a mountain
       * rather than picked in a wood, which is the split the two halves of
       * alchemy deserve: the forest tells you what a brew is OF, the rock tells
       * you what to DO to it. The rocks here being warm where they shouldn't be
       * is the reason brimstone and vitriol are here at all.
       */
      {
        id: 'pan_quicksilver',
        kind: 'gather',
        material: 'quicksilver',
        ticksPer: 230,
        name: 'Pan for Quicksilver',
        icon: '🪙',
        tags: ['mining'],
        speedFactors: [
          { attr: 'dex', weight: 0.01 },
          { skill: 'mining', weight: 0.018 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 1,
      },
      {
        id: 'sweep_fixing_salt',
        kind: 'gather',
        material: 'fixing_salt',
        ticksPer: 150,
        name: 'Sweep the Salt Pan',
        icon: '🧂',
        tags: ['mining'],
        speedFactors: [
          { attr: 'str', weight: 0.006 },
          { skill: 'mining', weight: 0.018 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        id: 'burn_bone_ash',
        kind: 'gather',
        material: 'bone_ash',
        ticksPer: 185,
        name: 'Burn Bone to Ash',
        icon: '🦴',
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { attr: 'con', weight: 0.006 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        id: 'break_brimstone',
        kind: 'gather',
        material: 'brimstone',
        ticksPer: 210,
        name: 'Break Brimstone from the Warm Rock',
        icon: '🟡',
        tags: ['mining'],
        speedFactors: [
          { attr: 'str', weight: 0.01 },
          { skill: 'mining', weight: 0.02 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      { id: 'rest_camp', kind: 'rest', name: 'Shelter in the Lee', icon: '🏕️' },
    ],
    encounters: [
      { monsterId: 'slime_fire_advanced', weight: 30, level: [6, 9] },
      { monsterId: 'goblin_boss', weight: 12, level: [6, 8] },
      { monsterId: 'goblin', weight: 18, level: [7, 9] },
      { monsterId: 'slime_earth_advanced', weight: 15, level: [6, 9] },
      { monsterId: 'slime_thunder_advanced', weight: 10, level: [7, 10] },
      { monsterId: 'slime_wind_advanced', weight: 8, level: [6, 9] },
      { monsterId: 'slime_zombie', weight: 5, level: [6, 9] },
      { monsterId: 'slime_coin', weight: 2, level: [7, 10] },
    ],
    // Goblin country — they come in packs.
    groupWeights: { 1: 20, 2: 25, 3: 30, 4: 15, 5: 10 },
    connections: [
      { to: 'malgeri_path', ticks: 100 },
      { to: 'malgeri_peak', ticks: 250, label: 'Switchback Ascent' },
    ],
  },
  malgeri_peak: {
    id: 'malgeri_peak',
    name: 'Malgeri Peak',
    icon: '🗻',
    areaId: 'malgeri_mountains',
    map: { x: 89.5, y: 9 },
    desc: 'Above the clouds, something colossal and gelatinous once walked. It may still.',
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' },
      // The two things at the top of the mountain worth carrying down: a flower
      // that never stopped storming, and the acid nothing else will hold.
      {
        id: 'cut_thunderbloom',
        kind: 'gather',
        material: 'thunderbloom',
        ticksPer: 260,
        name: 'Cut Thunderbloom',
        icon: '⚡',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.012 },
          { attr: 'dex', weight: 0.008 },
          { skill: 'herbalism', weight: 0.016 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 1,
      },
      {
        id: 'draw_vitriol',
        kind: 'gather',
        material: 'green_vitriol',
        ticksPer: 280,
        name: 'Draw Green Vitriol',
        icon: '🧪',
        tags: ['mining'],
        speedFactors: [
          { attr: 'wis', weight: 0.01 },
          { skill: 'mining', weight: 0.018 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 1,
      },
    ],
    encounters: [
      { monsterId: 'slime_fire_elite', weight: 18, level: [9, 11] },
      { monsterId: 'slime_base_elite', weight: 18, level: [8, 10] },
      { monsterId: 'slime_golem', weight: 8, level: [12, 16] },
      { monsterId: 'slime_ice_elite', weight: 12, level: [9, 12] },
      { monsterId: 'slime_earth_elite', weight: 10, level: [10, 13] },
      { monsterId: 'slime_thunder_elite', weight: 8, level: [10, 13] },
      { monsterId: 'slime_arcane', weight: 6, level: [10, 14] },
      { monsterId: 'slime_holy', weight: 6, level: [10, 14] },
      { monsterId: 'slime_soldier_spear', weight: 6, level: [10, 13] },
      { monsterId: 'slime_soldier_bow', weight: 5, level: [10, 13] },
      { monsterId: 'boss_slime_guardian', weight: 2, level: [14, 18] },
      { monsterId: 'slime_king', weight: 1, level: [15, 20] },
      // Almost never, and gone the moment it sees you.
      { monsterId: 'slime_metal', weight: 1, level: [12, 16] },
    ],
    modifierWeights: { normal: 72, demiboss: 16, boss: 8, aberrant: 4 },
    exploreTicks: 250,
    connections: [{ to: 'malgeri_base', ticks: 250, label: 'Switchback Ascent' }, { to: 'malgeri_mountainrange_west', ticks: 120 }],
  },
  malgeri_mountainrange_west: {
    id: 'malgeri_mountainrange_west',
    name: 'Malgeri West Peak',
    icon: '📍',
    areaId: 'malgeri_mountainrange_area',
    map: { x: 8.5, y: 6.5 },
    desc: 'The Western side of the mountain range.',
    activities: [
      { id: 'malgeri_mountainrange_west_rest', kind: 'rest', name: 'Rest', icon: '🔥' },
      { id: 'malgeri_mountainrange_west_explore', kind: 'explore', name: 'Explore', icon: '🔍' },
    ],
    exploreTicks: 150,
    finds: [
      { id: 'find_1', at: 0.69, desc: '"I heard a master hides at Malgeri Peak if you meet his requirements."', spot: 'malgeri_peak' },
      { id: 'find_2', at: 0.24, desc: 'Founds some iron scrap', material: { id: 'iron_scrap', qty: 5 } },
      { id: 'find_3', at: 1, desc: 'Found some gold', gold: [20, 45] },
      { id: 'find_4', at: 0.44, desc: 'Found thunderbloom', material: { id: 'thunderbloom', qty: 5 } },
    ],
    connections: [
      { to: 'malgeri_west_ridge', ticks: 100 },
      { to: 'malgeri_westside_cliff_top', ticks: 75, hidden: true },
    ],
  },
  malgeri_west_ridge: {
    id: 'malgeri_west_ridge',
    name: 'Malgeri West Ridge',
    icon: '📦',
    areaId: 'malgeri_mountainrange_area',
    map: { x: 40.5, y: 14 },
    desc: '',
    activities: [],
    encounters: [],
    connections: [
      { to: 'malgeri_east_ridge', ticks: 70 },
    ],
  },
  malgeri_westside_cliff_top: {
    id: 'malgeri_westside_cliff_top',
    name: 'Malgeri Westside Cliff Top',
    icon: '📦',
    areaId: 'malgeri_mountainrange_area',
    map: { x: 21, y: 20.5 },
    desc: '',
    activities: [],
    encounters: [],
    connections: [
      { to: 'malgeri_westside_cliff_descent', ticks: 50, oneWay: true },
    ],
  },
  malgeri_westside_cliff_descent: {
    id: 'malgeri_westside_cliff_descent',
    name: 'Malgeri Westside Cliff Descent',
    icon: '📦',
    areaId: 'malgeri_mountainrange_area',
    map: { x: 7, y: 44.5 },
    desc: '',
    activities: [],
    encounters: [],
    connections: [
      { to: 'malgeri_westside_cliff_bottom', ticks: 70 },
    ],
  },
  malgeri_westside_cliff_bottom: {
    id: 'malgeri_westside_cliff_bottom',
    name: 'Malgeri Westside Cliff Bottom',
    icon: '📦',
    areaId: 'malgeri_mountainrange_area',
    map: { x: 18.5, y: 68.5 },
    desc: '',
    activities: [],
    encounters: [],
    connections: [
      { to: 'malgeri_westside_caves', ticks: 55 },
    ],
  },
  malgeri_westside_caves: {
    id: 'malgeri_westside_caves',
    name: 'Malgeri Westside Caves',
    icon: '📦',
    areaId: 'malgeri_mountainrange_area',
    map: { x: 35, y: 61 },
    desc: '',
    activities: [],
    encounters: [],
    connections: [
      { to: 'malgeri_central_caves', ticks: 65 },
    ],
  },
  malgeri_central_caves: {
    id: 'malgeri_central_caves',
    name: 'Malgeri Central Caves',
    icon: '📦',
    areaId: 'malgeri_mountainrange_area',
    map: { x: 57, y: 61.5 },
    desc: '',
    activities: [
      { id: 'malgeri_central_caves_explore', kind: 'explore', name: 'Explore', icon: '🔍' },
    ],
    encounters: [],
    exploreTicks: 260,
    finds: [
      { id: 'find_1', at: 1, desc: 'This looks like a path to the deep caves.', path: 'malgeri_deep_cave_entrance' },
    ],
    connections: [
      { to: 'malgeri_eastern_caves', ticks: 100 },
      { to: 'malgeri_deep_cave_entrance', ticks: 55, hidden: true },
    ],
  },
  malgeri_eastern_caves: {
    id: 'malgeri_eastern_caves',
    name: 'Malgeri Eastern Caves',
    icon: '📦',
    areaId: 'malgeri_mountainrange_area',
    map: { x: 90, y: 67 },
    desc: '',
    activities: [],
    encounters: [],
    connections: [
    ],
  },
  malgeri_deep_cave_entrance: {
    id: 'malgeri_deep_cave_entrance',
    name: 'Malgeri Deep Cave Entrance',
    icon: '📦',
    areaId: 'malgeri_mountainrange_area',
    map: { x: 44.5, y: 47 },
    desc: '',
    activities: [],
    encounters: [],
    connections: [],
  },
  malgeri_eastern_ascent: {
    id: 'malgeri_eastern_ascent',
    name: 'Malgeri Eastern Ascent',
    icon: '📍',
    areaId: 'malgeri_mountainrange_area',
    map: { x: 80, y: 37 },
    desc: '',
    activities: [],
    connections: [
      { to: 'malgeri_east_peak', ticks: 100, label: 'path to the eastern peak' },
      { to: 'malgeri_eastern_caves', ticks: 95, label: 'path to the caves' },
    ],
  },
  malgeri_east_peak: {
    id: 'malgeri_east_peak',
    name: 'Malgeri East Peak',
    icon: '📍',
    areaId: 'malgeri_mountainrange_area',
    map: { x: 92, y: 6.5 },
    desc: '',
    activities: [],
    connections: [],
  },
  malgeri_east_ridge: {
    id: 'malgeri_east_ridge',
    name: 'Malgeri East Ridge',
    icon: '📍',
    areaId: 'malgeri_mountainrange_area',
    map: { x: 64.5, y: 14.5 },
    desc: '',
    activities: [],
    connections: [
      { to: 'malgeri_east_peak', ticks: 90 },
    ],
  },

  malgeri_dc_central_hub: {
    id: 'malgeri_dc_central_hub',
    name: 'Malgeri Deep Caves - Central Hub',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 43, y: 38 },
    desc: 'the cave system deep in the malgeri mountains. ',
    activities: [
      { id: 'job_x', kind: 'job', gold: 10, ticksPer: 300, name: 'Mine for coal', icon: '💰', tags: ['mining'] },
      { id: 'gather_x', kind: 'gather', material: 'copper_ore', ticksPer: 120, name: 'Gather', icon: '🧺' },
    ],
    connections: [
      { to: 'malgeri_deep_cave_entrance', ticks: 30 },
      { to: 'new_spot_17', ticks: 75 },
    ],
  },
  malgeri_dc_west_1: {
    id: 'malgeri_dc_west_1',
    name: 'Malgeri Deep Caves - Western Room',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 20, y: 42.5 },
    desc: 'the cave system deep in the malgeri mountains. ',
    activities: [
      { id: 'job_x', kind: 'job', gold: 10, ticksPer: 300, name: 'Mine for coal', icon: '💰', tags: ['mining'] },
      { id: 'gather_x', kind: 'gather', material: 'copper_ore', ticksPer: 120, name: 'Gather', icon: '🧺' },
      { id: 'malgeri_dc_west_1_explore', kind: 'explore', name: 'Explore', icon: '🔍' },
    ],
    exploreTicks: 250,
    finds: [
      { id: 'find_2', at: 1, desc: '', path: 'new_spot_4' },
    ],
    connections: [
      { to: 'malgeri_dc_central_hub', ticks: 30 },
      { to: 'new_spot_4', ticks: 50, hidden: true, label: 'Wide crack, steeped in darkness.', returnLabel: 'Wide crack, with a small light shining through.' },
    ],
  },
  malgeri_dc_west_2: {
    id: 'malgeri_dc_west_2',
    name: 'Malgeri Deep Caves - Western Room',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 12.5, y: 31 },
    desc: 'the cave system deep in the malgeri mountains. ',
    activities: [
      { id: 'job_x', kind: 'job', gold: 10, ticksPer: 300, name: 'Mine for coal', icon: '💰', tags: ['mining'] },
      { id: 'gather_x', kind: 'gather', material: 'copper_ore', ticksPer: 120, name: 'Gather', icon: '🧺' },
    ],
    connections: [
      { to: 'malgeri_dc_west_1', ticks: 30 },
      { to: 'new_spot_1', ticks: 55 },
    ],
  },
  new_spot_1: {
    id: 'new_spot_1',
    name: 'North-Western Hub',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 22.5, y: 16 },
    waypoint: true,
    desc: '',
    activities: [
      { id: 'new_spot_1_explore', kind: 'explore', name: 'Explore', icon: '🔍' },
      { id: 'new_spot_1_rest', kind: 'rest', name: 'Rest', icon: '🔥' },
    ],
    exploreTicks: 120,
    finds: [
      { id: 'find_1', at: 1, desc: '', path: 'new_spot_7' },
    ],
    connections: [
      { to: 'new_spot_2', ticks: 45 },
      { to: 'new_spot_3', ticks: 35 },
      { to: 'new_spot_7', ticks: 45, oneWay: true, hidden: true },
    ],
  },
  new_spot_2: {
    id: 'new_spot_2',
    name: 'North-Western Chamber',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 5, y: 8.5 },
    desc: '',
    activities: [],
    connections: [],
  },
  new_spot_3: {
    id: 'new_spot_3',
    name: 'Northern Chamber',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 26.5, y: 5 },
    desc: '',
    activities: [],
    connections: [
      { to: 'new_spot_5', ticks: 75, label: 'A path littered with coccoons.' },
    ],
  },
  new_spot_4: {
    id: 'new_spot_4',
    name: 'Hidden Chamber',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 10, y: 56.5 },
    desc: 'A hidden chamber that cannot normally be accessed.',
    activities: [],
    connections: [
      { to: 'new_spot_12', ticks: 50 },
    ],
  },
  new_spot_5: {
    id: 'new_spot_5',
    name: 'Spider\'s Antechamber',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 51.5, y: 5.5 },
    desc: '',
    activities: [],
    connections: [
      { to: 'new_spot_6', ticks: 50,},
    ],
  },
  new_spot_6: {
    id: 'new_spot_6',
    name: 'Spider\'s Nest',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 52, y: 15.5 },
    forced: true,
    desc: '',
    activities: [],
    encounters: [
      { monsterId: 'giant_spider_queen', weight: 10, level: [20, 20] },
    ],
    connections: [],
  },
  new_spot_7: {
    id: 'new_spot_7',
    name: 'Small Chamber',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 34, y: 27.5 },
    desc: '',
    activities: [],
    connections: [
      { to: 'new_spot_6', ticks: 55, oneWay: true, label: 'A crack in the back of the spider\'s nest' },
    ],
  },
  new_spot_8: {
    id: 'new_spot_8',
    name: 'New Spot 8',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 78, y: 21 },
    desc: '',
    activities: [],
    connections: [
      { to: 'new_spot_9', ticks: 60 },
    ],
  },
  new_spot_9: {
    id: 'new_spot_9',
    name: 'New Spot 9',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 90, y: 5.5 },
    desc: '',
    activities: [],
    connections: [
      { to: 'new_spot_18', ticks: 65 },
    ],
  },
  new_spot_10: {
    id: 'new_spot_10',
    name: 'New Spot 10',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 83.5, y: 41.5 },
    desc: '',
    activities: [],
    connections: [],
  },
  new_spot_11: {
    id: 'new_spot_11',
    name: 'New Spot 11',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 90, y: 57 },
    desc: '',
    activities: [],
    connections: [],
  },
  new_spot_12: {
    id: 'new_spot_12',
    name: 'New Spot 12',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 24.5, y: 66 },
    desc: '',
    activities: [],
    connections: [
      { to: 'new_spot_13', ticks: 55 },
    ],
  },
  new_spot_13: {
    id: 'new_spot_13',
    name: 'New Spot 13',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 42, y: 59 },
    desc: '',
    activities: [],
    connections: [
      { to: 'new_spot_15', ticks: 65 },
      { to: 'new_spot_14', ticks: 55 },
    ],
  },
  new_spot_14: {
    id: 'new_spot_14',
    name: 'New Spot 14',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 58, y: 48.5 },
    desc: '',
    activities: [],
    connections: [
      { to: 'new_spot_16', ticks: 65 },
      { to: 'new_spot_10', ticks: 80 },
    ],
  },
  new_spot_15: {
    id: 'new_spot_15',
    name: 'New Spot 15',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 57.5, y: 67 },
    desc: '',
    activities: [],
    connections: [
      { to: 'new_spot_16', ticks: 50 },
    ],
  },
  new_spot_16: {
    id: 'new_spot_16',
    name: 'New Spot 16',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 74, y: 63 },
    desc: '',
    activities: [],
    connections: [
      { to: 'new_spot_11', ticks: 50 },
    ],
  },
  new_spot_17: {
    id: 'new_spot_17',
    name: 'New Spot 17',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 64.5, y: 25.5 },
    desc: '',
    activities: [],
    connections: [
      { to: 'new_spot_8', ticks: 45 },
    ],
  },
  new_spot_18: {
    id: 'new_spot_18',
    name: 'New Spot 18',
    icon: '📍',
    areaId: 'malgeri_cave_system_area',
    map: { x: 93, y: 26.5 },
    desc: '',
    activities: [],
    connections: [],
  },
  western_swamp_central_hub: {
    id: 'western_swamp_central_hub',
    name: 'Swamp Center',
    icon: '📍',
    areaId: 'placeholder_western_swamp_region_area',
    map: { x: 49, y: 32.5 },
    waypoint: true,
    desc: '',
    activities: [
      {
        id: 'western_swamp_central_hub_gather',
        kind: 'gather',
        material: 'cave_mushroom',
        ticksPer: 20,
        name: 'Gather',
        icon: '🧺',
      },
    ],
    connections: [
      { to: 'western_swamp_sw_connection', ticks: 125 },
    ],
  },
  western_swamp_sw_connection: {
    id: 'western_swamp_sw_connection',
    name: 'Southwestern Estuarine',
    icon: '📍',
    areaId: 'placeholder_western_swamp_region_area',
    map: { x: 15, y: 55.5 },
    desc: '',
    activities: [
      { id: 'western_swamp_sw_connection_hunt', kind: 'hunt', name: 'Hunt', icon: '🗡️' },
    ],
    encounters: [
      { monsterId: 'slime_nature', weight: 10, level: [13, 18] },
    ],
    connections: [
      { to: 'western_peninsula_hub', ticks: 110, label: 'to the peninsula', returnLabel: 'to the swamp' },
    ],
  },
  western_peninsula_hub: {
    id: 'western_peninsula_hub',
    name: 'Swampish Peninsula',
    icon: '📍',
    areaId: 'placeholder_western_swamp_peninsula_area',
    map: { x: 46, y: 36.5 },
    waypoint: true,
    desc: '',
    activities: [],
    connections: [],
  },
};

/**
 * The roads that joined the countryside to the city, declared from the LIVE
 * side. Exactly the Hamlet Road as it was cut — including the alpha world
 * lock (`flag:world_open`), which was the countryside's latch while it was
 * merely shut rather than shelved.
 */
export const SHELVED_ROADS: { from: string; connection: Connection }[] = [
  {
    from: 'the_weighbridge',
    connection: {
      to: 'hamlet_square',
      ticks: 240,
      requires: [{ type: 'stat', key: 'flag:world_open', value: 1 }],
      label: 'the Hamlet Road',
      returnLabel: 'the road up to Threshold',
    },
  },
];
