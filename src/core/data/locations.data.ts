import type { AreaDef, RegionDef, SpotDef } from '../types';

export const REGIONS: Record<string, RegionDef> = {
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
  // The stack itself: everything on the far side of the tower door. Floors
  // live here; the door and the city around it stay in `threshold`.
  //
  // TODO: the base yard's weather question moved here with it, and being
  // inside a tower changes the answer. The old SPEC was "entirely exposed to
  // the weather at the start, upgradeable to entirely sheltered so it always
  // functions at 100%" — which read naturally for a yard behind a house and
  // reads oddly for a floor of a tower. `sheltered: true` is carried over
  // unchanged for now, so nothing about exposure has silently shifted; decide
  // whether the hold keeps an open yard (drop `sheltered`, tag the indoor
  // rooms individually) or is simply indoors now.
  the_ascent: { id: 'the_ascent', name: 'The Ascent', terrain: 'plains', sheltered: true, world: { x: 14.3, y: 21.6 } },
  // The city that grew around the tower's foot, and where a new life now
  // opens. `settlement` on the REGION is lamplight everywhere inside the
  // walls — no darkness training anywhere in Threshold, and no night-fighting
  // penalty either. Districts that want a dark room say so on the spot.
  threshold: { id: 'threshold', name: 'Threshold', terrain: 'plains', tags: ['settlement'], world: { x: 14, y: 22 } },
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

export const AREAS: Record<string, AreaDef> = {
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
  // Your hold — a floor of the tower rather than a place in the countryside.
  // Declared as a FLOOR in towers.data.ts (`ascent_hold`), which is what makes
  // it personal and what marks it as the one thing a prestige does not take.
  player_base_v1_area: { id: 'player_base_v1_area', name: 'Your Hold', regionId: 'the_ascent' },
  // Threshold's eight districts. Each one has a SIGNATURE subsystem rather
  // than a monopoly on it — the Ironyard is where martial training is best
  // supported, not the only place a blade is welcome. Keeping them signatures
  // is what stops a district becoming a mandatory stop for a discipline.
  scholars_quarter: { id: 'scholars_quarter', name: "Scholars' Quarter", regionId: 'threshold' },
  temple_rise: { id: 'temple_rise', name: 'Temple Rise', regionId: 'threshold' },
  the_ironyard: { id: 'the_ironyard', name: 'The Ironyard', regionId: 'threshold' },
  alembic_row: { id: 'alembic_row', name: 'Alembic Row', regionId: 'threshold' },
  the_chancery: { id: 'the_chancery', name: 'The Chancery', regionId: 'threshold' },
  the_assize: { id: 'the_assize', name: 'The Assize', regionId: 'threshold' },
  wrights_ward: { id: 'wrights_ward', name: "Wrights' Ward", regionId: 'threshold' },
  the_granaries: { id: 'the_granaries', name: 'The Granaries', regionId: 'threshold' },
  // The tower's mouth is part of the CITY, not the stack: it sits at the
  // centre of Threshold's map with all eight roads running to it, and the
  // stack proper begins on the far side of the door.
  ascent_foot_area: { id: 'ascent_foot_area', name: 'The Foot', regionId: 'threshold' },
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

/**
 * The demo world. Connections are declared on the source spot; unless marked
 * oneWay, the registry adds the reverse edge automatically. The slide from the
 * deep woods into the ravine is one-way AND hidden until the spot is explored —
 * the long climb via the rim is the way back.
 */
export const SPOTS: Record<string, SpotDef> = {
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
  base_entrance: {
    id: 'base_entrance',
    name: 'Player Base Entrance',
    icon: '🚪',
    areaId: 'player_base_v1_area',
    map: { x: 48, y: 68 },
    waypoint: true,
    desc: 'A gate that started life as a garden fence and has ambitions. Everything you are building lies through it.',
    activities: [],
    connections: [
      { to: 'base_main_hall', ticks: 60 },
    ],
  },
  base_equipment_depot: {
    id: 'base_equipment_depot',
    name: 'Equipment Depot',
    icon: '🎒',
    areaId: 'player_base_v1_area',
    map: { x: 30, y: 52.5 },
    desc: 'Racks, pegs and chests for gear between outings. Mostly empty, which is either a problem or an invitation.',
    activities: [],
    connections: [
      { to: 'base_main_hall', ticks: 75 },
      { to: 'base_training_area', ticks: 40 },
    ],
  },
  base_main_hall: {
    id: 'base_main_hall',
    name: 'Player Base Main Hall',
    icon: '🏛️',
    areaId: 'player_base_v1_area',
    map: { x: 48, y: 40 },
    desc: 'The crossroads of the whole place. Every wing opens off it, and every plan crosses it sooner or later.',
    activities: [],
    connections: [
      { to: 'base_research_hallway', ticks: 60 },
      { to: 'base_trophy_hallway', ticks: 60 },
    ],
  },
  base_trophy_hallway: {
    id: 'base_trophy_hallway',
    name: 'Trophy Hallway',
    icon: '🏆',
    areaId: 'player_base_v1_area',
    map: { x: 48, y: 27 },
    desc: 'Bare plinths and empty mounts, spaced with great confidence. The walk to the throne is meant to be earned.',
    activities: [],
    connections: [
      { to: 'base_throneroom', ticks: 40 },
    ],
  },
  base_arcane_library: {
    id: 'base_arcane_library',
    name: 'Arcane Library',
    icon: '📚',
    areaId: 'player_base_v1_area',
    map: { x: 75, y: 26 },
    desc: 'Shelves that will one day groan. For now: a good desk, a better chair, and room to be wrong in private.',
    activities: [
      { id: 'study_stacks', kind: 'train', attr: 'int', name: 'Study the Stacks', icon: '📖' },
    ],
    // The proper spellcrafting table — the base's copy of the one at my_home.
    benches: ['spelltable'],
    connections: [
      { to: 'base_research_hallway', ticks: 60 },
      { to: 'base_psionics_lab', ticks: 60 },
      { to: 'base_library_annex', ticks: 30 },
    ],
  },
  base_research_hallway: {
    id: 'base_research_hallway',
    name: 'Research Hallway',
    icon: '🧪',
    areaId: 'player_base_v1_area',
    map: { x: 75, y: 40 },
    desc: 'A corridor of doors with increasingly specific warnings on them. The smell changes every few steps.',
    activities: [],
    connections: [
      { to: 'base_alchemy_lab', ticks: 60 },
      { to: 'base_mutagen_lab', ticks: 60 },
      { to: 'base_psionics_lab', ticks: 85 },
    ],
  },
  base_alchemy_lab: {
    id: 'base_alchemy_lab',
    name: 'Alchemy Lab',
    icon: '⚗️',
    areaId: 'player_base_v1_area',
    map: { x: 75, y: 60 },
    desc: 'Glassware in ranks, a drain in the floor, and scorch marks with dates next to them. A proper place to argue with solvents.',
    activities: [
      { id: 'train_skill', kind: 'train', attr: 'int', name: 'Study Alchemical ', icon: '🛠️', tags: ['alchemy'], attrXp: { str: 0, dex: 0, con: 0, int: 0.33, wis: 0, cha: 0 } },
    ],
    benches: ['alchemy'],
    connections: [
      { to: 'base_clone_vats', ticks: 60 },
    ],
  },
  base_mutagen_lab: {
    id: 'base_mutagen_lab',
    name: 'Mutagen Lab',
    icon: '🧬',
    areaId: 'player_base_v1_area',
    map: { x: 90, y: 46.5 },
    desc: 'Cleaner than the basement, better lit, and the wobbling is kept behind glass now. Genes come here to be argued into shape.',
    activities: [],
    // Same culture bench as the basement — the lab is where the work moves
    // once the base exists; the basement keeps its copy for the slimes.
    benches: ['mutagens'],
    connections: [
      { to: 'base_psionics_lab', ticks: 60 },
      { to: 'base_clone_vats', ticks: 60 },
    ],
  },
  base_clone_vats: {
    id: 'base_clone_vats',
    name: 'Clone Vats',
    icon: '🧫',
    areaId: 'player_base_v1_area',
    map: { x: 90, y: 60 },
    desc: 'Great glass vessels, plumbed and ready, holding nothing but faintly luminous fluid. They seem to be waiting.',
    activities: [],
    connections: [],
  },
  base_psionics_lab: {
    id: 'base_psionics_lab',
    name: 'Psionics Lab',
    icon: '🧠',
    areaId: 'player_base_v1_area',
    map: { x: 90, y: 32 },
    desc: 'A bare room, deliberately. Nothing in it to move, so anything that moves is you.',
    activities: [
      { id: 'meditate_will', kind: 'train', attr: 'cha', name: 'Meditate on the Will', icon: '🧘' },
    ],
    connections: [],
  },
  base_dining_hall: {
    id: 'base_dining_hall',
    name: 'Dining Hall',
    icon: '🍽️',
    areaId: 'player_base_v1_area',
    map: { x: 30, y: 40 },
    desc: 'One long table with far more chairs than the household currently justifies. Optimism, in furniture form.',
    activities: [],
    connections: [
      { to: 'base_main_hall', ticks: 60 },
      { to: 'base_staff_quarters', ticks: 85 },
      { to: 'base_equipment_depot', ticks: 60 },
    ],
  },
  base_chapel: {
    id: 'base_chapel',
    name: 'Chapel',
    icon: '⛪',
    areaId: 'player_base_v1_area',
    map: { x: 34.5, y: 7 },
    desc: 'Quiet, candlelit, and pointedly unconsecrated to anyone in particular. The pedestals stand empty for now.',
    activities: [
      { id: 'keep_vigil', kind: 'train', attr: 'wis', name: 'Keep a Vigil', icon: '🕯️' },
    ],
    connections: [
      { to: 'base_chapel_annex', ticks: 30 },
    ],
  },
  base_farm: {
    id: 'base_farm',
    name: 'Farm',
    icon: '🌾',
    areaId: 'player_base_v1_area',
    map: { x: 10, y: 20 },
    desc: 'Vegetable rows, a henhouse, and herb beds staked out with more hope than order. Staple ground — the table it feeds is meant to grow.',
    activities: [
      {
        id: 'tend_rows',
        kind: 'gather',
        material: 'wild_onion',
        ticksPer: 120,
        name: 'Tend the Vegetable Rows',
        icon: '🧅',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { skill: 'herbalism', weight: 0.01 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        id: 'keep_henhouse',
        kind: 'gather',
        material: 'bird_egg',
        ticksPer: 160,
        name: 'Keep the Henhouse',
        icon: '🥚',
        speedFactors: [{ attr: 'wis', weight: 0.008 }],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        id: 'cut_herb_beds',
        kind: 'gather',
        material: 'common_herb',
        ticksPer: 140,
        name: 'Cut the Herb Beds',
        icon: '🌿',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { skill: 'herbalism', weight: 0.01 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
    ],
    connections: [
      { to: 'base_dining_hall', ticks: 85 },
      { to: 'base_pantry', ticks: 60 },
    ],
  },
  base_kitchen: {
    id: 'base_kitchen',
    name: 'Kitchen',
    icon: '🍳',
    areaId: 'player_base_v1_area',
    map: { x: 15, y: 40 },
    desc: 'The full battery: board, counter, stove, oven and grill, arranged by someone who has burned things and learned. Built to feed more mouths than it currently has.',
    activities: [],
    // The whole cooking line — the base's working copies of the my_home set.
    benches: [
      'preparing',
      'assembling',
      'cooking',
      'baking',
      'grilling',
    ],
    connections: [
      { to: 'base_dining_hall', ticks: 45 },
      { to: 'base_farm', ticks: 60 },
      { to: 'base_staff_quarters', ticks: 60 },
    ],
  },
  base_staff_quarters: {
    id: 'base_staff_quarters',
    name: 'Staff Quarters',
    icon: '🛖',
    areaId: 'player_base_v1_area',
    map: { x: 9.5, y: 52.5 },
    desc: 'Rows of neat, empty bunks and pegs with no coats on them. Whoever ends up living here has not been made yet.',
    activities: [],
    connections: [
      { to: 'base_equipment_depot', ticks: 65 },
      { to: 'base_infirmary', ticks: 40 },
    ],
  },
  base_chapel_annex: {
    id: 'base_chapel_annex',
    name: 'Chapel Annex',
    icon: '🕯️',
    areaId: 'player_base_v1_area',
    map: { x: 22.5, y: 10 },
    desc: 'Vestments, candle stores, and room for whatever the chapel grows into needing. Smells of wax and patience.',
    activities: [],
    connections: [],
  },
  base_bedroom: {
    id: 'base_bedroom',
    name: 'Player Bedroom',
    icon: '🛏️',
    areaId: 'player_base_v1_area',
    map: { x: 60, y: 5 },
    desc: 'Your own bed, at last, in a room with a bar on the door and a window that catches the morning. The best sleep in the world is up these stairs.',
    activities: [
      { id: 'sleep_own_bed', kind: 'rest', name: 'Sleep in Your Own Bed', icon: '🛏️' },
    ],
    connections: [
      { to: 'base_library_annex', ticks: 35 },
    ],
  },
  base_throneroom: {
    id: 'base_throneroom',
    name: 'Throneroom',
    icon: '👑',
    areaId: 'player_base_v1_area',
    map: { x: 48, y: 14 },
    desc: 'A big chair in a bigger room. Sitting in it is faintly ridiculous with nobody here yet, and you do it anyway.',
    activities: [
      { id: 'hold_court', kind: 'train', attr: 'cha', name: 'Hold Court', icon: '👑' },
    ],
    connections: [
      { to: 'base_bedroom', ticks: 30 },
      { to: 'base_chapel', ticks: 30, label: 'To the Chapel', returnLabel: 'To the Throneroom' },
      { to: 'base_library_annex', ticks: 60 },
    ],
  },
  base_strategy_room: {
    id: 'base_strategy_room',
    name: 'Strategy Room',
    icon: '🗺️',
    areaId: 'player_base_v1_area',
    map: { x: 60.5, y: 23.5 },
    desc: 'Maps on every surface, weighted down with whatever was to hand. The pins mark places that owe you nothing yet.',
    activities: [
      { id: 'draw_campaigns', kind: 'train', attr: 'int', name: 'Draw Up Campaigns', icon: '🗺️' },
    ],
    connections: [
      { to: 'base_throneroom', ticks: 70 },
      { to: 'base_main_hall', ticks: 70 },
    ],
  },
  base_pantry: {
    id: 'base_pantry',
    name: 'Pantry',
    icon: '🫙',
    areaId: 'player_base_v1_area',
    map: { x: 5.5, y: 40 },
    desc: 'Cool, dark shelving with room for far more jars than exist. One day something down here will be fermenting on purpose.',
    activities: [],
    connections: [
      { to: 'base_kitchen', ticks: 30 },
    ],
  },
  base_library_annex: {
    id: 'base_library_annex',
    name: 'Library Annex',
    icon: '📖',
    areaId: 'player_base_v1_area',
    map: { x: 70, y: 14 },
    desc: 'The quiet overflow room — margins to annotate, thoughts to finish. The library proper is for finding; this is for keeping.',
    activities: [
      { id: 'annotate_margins', kind: 'train', attr: 'wis', name: 'Annotate the Margins', icon: '✒️' },
    ],
    connections: [],
  },
  base_training_area: {
    id: 'base_training_area',
    name: 'Training Area',
    icon: '🎯',
    areaId: 'player_base_v1_area',
    map: { x: 30, y: 64 },
    desc: 'A packed-earth yard with your own rank of dummies, set where the noise bothers nobody. The infirmary is deliberately close.',
    activities: [
      { id: 'drill_forms', kind: 'train', attr: 'str', name: 'Drill Forms', icon: '🤺', tags: ['combat'] },
      { id: 'hunt', kind: 'hunt', name: 'Work the Dummies', icon: '🎯' },
    ],
    // Same rule as the village yard: dummies never roll a modifier, so the
    // numbers you measure here are the numbers you measured last time.
    encounters: [{ monsterId: 'training_dummy', weight: 100, level: [1, 1] }],
    modifierWeights: { normal: 100 },
    connections: [],
  },
  base_infirmary: {
    id: 'base_infirmary',
    name: 'Infirmary',
    icon: '🩹',
    areaId: 'player_base_v1_area',
    map: { x: 15.5, y: 64 },
    desc: 'Clean cots, boiled linen, and a cabinet of salves arranged by how much they sting. Built close to the training yard for honest reasons.',
    activities: [
      { id: 'convalesce', kind: 'rest', name: 'Convalesce', icon: '🛌' },
    ],
    connections: [
      { to: 'base_equipment_depot', ticks: 55 },
      { to: 'base_training_area', ticks: 45 },
    ],
  },
  base_workshop: {
    id: 'base_workshop',
    name: 'Workshop',
    icon: '🛠️',
    areaId: 'player_base_v1_area',
    map: { x: 62, y: 50.5 },
    desc: 'Benches, vices, and tool-shadows painted on the wall so everything has a home. The trades that will build this place start here.',
    activities: [],
    benches: ['runecarving'],
    connections: [
      { to: 'base_material_storage', ticks: 35 },
      { to: 'base_research_hallway', ticks: 50 },
    ],
  },
  base_material_storage: {
    id: 'base_material_storage',
    name: 'Material Storage',
    icon: '📦',
    areaId: 'player_base_v1_area',
    map: { x: 62, y: 62.5 },
    desc: 'Deep shelves, labelled bins, and a ledger nobody has written in yet. Storage worth paying for, eventually.',
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

  // ---------- Threshold ----------
  //
  // Eight districts in a ring, each with its own road to the tower's foot at
  // the centre, and each joined to its two neighbours so the city is walkable
  // without routing through the door every time. The eight roads are the
  // point: the stack has one mouth, so the 'every spot can get home' lint is
  // satisfied by construction, and no district can become the only way in.
  //
  // District subsystems are SIGNATURES, never monopolies. The Ironyard is
  // where martial training is best supported; it is not the only place a
  // blade is welcome, and nothing on a critical path may ever require a
  // particular district.

  ascent_foot: {
    id: 'ascent_foot',
    name: 'The Foot of the Ascent',
    icon: '🗼',
    areaId: 'ascent_foot_area',
    map: { x: 50, y: 37.5 },
    waypoint: true,
    desc: 'Eight roads end here at one door. The stone above it has been rubbed smooth by people touching it on the way past, which is not a custom anyone will admit to starting.',
    // The hub is the haven: resting here is what makes the whole city the
    // place a lost fight returns you to.
    activities: [
      { id: 'rest_foot', kind: 'rest', name: 'Rest at the Doorstep Inn', icon: '🛏️' },
    ],
    connections: [
      // Through the door and along to your own floor. It is the only stretch
      // of the stack that asks nothing of you, which is the point of it.
      { to: 'base_entrance', ticks: 90, label: 'the door', returnLabel: 'back out to the Foot' },
    ],
  },

  // --- Scholars' Quarter (signature: arcane) ---
  lectory_steps: {
    id: 'lectory_steps',
    name: 'The Lectory Steps',
    icon: '📐',
    areaId: 'scholars_quarter',
    map: { x: 50, y: 17.5 },
    desc: 'Wide shallow steps that students sit on to argue. The arguing is most of the curriculum.',
    activities: [
      { id: 'train_int_steps', kind: 'train', attr: 'int', name: 'Argue on the Steps', icon: '💬' },
    ],
    connections: [
      { to: 'ascent_foot', ticks: 60, label: 'the Scholars’ Road' },
      { to: 'temple_rise_gate', ticks: 90 },
      { to: 'the_reading_hall', ticks: 40 },
      { to: 'chalk_yard', ticks: 40 },
    ],
  },
  the_reading_hall: {
    id: 'the_reading_hall',
    name: 'The Reading Hall',
    icon: '📖',
    areaId: 'scholars_quarter',
    map: { x: 38, y: 5 },
    tags: ['indoor'],
    desc: 'Long tables, low lamps, and a rule about silence that is enforced by glare rather than by anybody official.',
    activities: [
      { id: 'train_int_hall', kind: 'train', attr: 'int', name: 'Read Until It Sticks', icon: '📚' },
      { id: 'train_wis_hall', kind: 'train', attr: 'wis', name: 'Sit With a Hard Passage', icon: '🧘', tags: ['magic'] },
    ],
    benches: ['spelltable'],
    connections: [],
  },
  chalk_yard: {
    id: 'chalk_yard',
    name: 'The Chalk Yard',
    icon: '🔠',
    areaId: 'scholars_quarter',
    map: { x: 62, y: 5 },
    desc: 'A flagged courtyard covered corner to corner in half-erased working. Nobody washes it down; the good lines are load-bearing.',
    exploreTicks: 420,
    activities: [
      { id: 'explore_chalk', kind: 'explore', name: 'Read the Old Working', icon: '🔍' },
      { id: 'train_int_chalk', kind: 'train', attr: 'int', name: 'Copy Out a Proof', icon: '✏️' },
    ],
    connections: [],
  },

  // --- Temple Rise (signature: divine) ---
  temple_rise_gate: {
    id: 'temple_rise_gate',
    name: "Pilgrims' Stair",
    icon: '🪜',
    areaId: 'temple_rise',
    map: { x: 68.4, y: 23.4 },
    desc: 'The shallow end of a very long climb. Vendors at the bottom sell water to people who have not yet realised they will want it.',
    activities: [
      { id: 'train_con_stair', kind: 'train', attr: 'con', name: 'Walk the Stair', icon: '🚶' },
    ],
    connections: [
      { to: 'ascent_foot', ticks: 60, label: 'the Pilgrim Way' },
      { to: 'ironyard_gate', ticks: 90 },
      { to: 'the_nine_chapels', ticks: 40 },
      { to: 'censer_walk', ticks: 40 },
    ],
  },
  the_nine_chapels: {
    id: 'the_nine_chapels',
    name: 'The Nine Chapels',
    icon: '⛪',
    areaId: 'temple_rise',
    map: { x: 80, y: 10 },
    tags: ['indoor'],
    desc: 'Nine doors off one cloister. Two of them are kept locked, and the city has agreed not to discuss which gods those belonged to.',
    activities: [
      { id: 'train_wis_chapels', kind: 'train', attr: 'wis', name: 'Keep a Vigil', icon: '🕯️', tags: ['magic'] },
    ],
    connections: [],
  },
  censer_walk: {
    id: 'censer_walk',
    name: 'Censer Walk',
    icon: '🪔',
    areaId: 'temple_rise',
    map: { x: 90, y: 20 },
    desc: 'A colonnade thick enough with incense that the far end is a rumour. Good for talking to people who would rather not be seen talking to you.',
    activities: [
      { id: 'train_cha_censer', kind: 'train', attr: 'cha', name: 'Work the Colonnade', icon: '🎭' },
    ],
    connections: [],
  },

  // --- The Ironyard (signature: martial; wuxia once it lands) ---
  ironyard_gate: {
    id: 'ironyard_gate',
    name: 'The Muster Gate',
    icon: '🛡️',
    areaId: 'the_ironyard',
    map: { x: 76, y: 37.5 },
    desc: 'Where the companies form up when there is anything to form up for. Mostly it is a very large empty square with excellent acoustics.',
    activities: [
      { id: 'train_str_muster', kind: 'train', attr: 'str', name: 'Drill in Formation', icon: '🪖' },
    ],
    connections: [
      { to: 'ascent_foot', ticks: 60, label: 'the Muster Road' },
      { to: 'alembic_row_gate', ticks: 90 },
      { to: 'the_sand', ticks: 40 },
      { to: 'long_gallery', ticks: 40 },
    ],
  },
  the_sand: {
    id: 'the_sand',
    name: 'The Sand',
    icon: '🤺',
    areaId: 'the_ironyard',
    map: { x: 93, y: 28 },
    desc: 'Raked every morning so the footwork shows. Everyone claims not to check their own prints afterwards.',
    activities: [
      { id: 'train_dex_sand', kind: 'train', attr: 'dex', name: 'Footwork on the Sand', icon: '👣' },
      { id: 'spar_sand', kind: 'train', attr: 'str', name: 'Spar', icon: '⚔️', tags: ['combat'] },
    ],
    connections: [],
  },
  long_gallery: {
    id: 'long_gallery',
    name: 'The Long Gallery',
    icon: '🏹',
    areaId: 'the_ironyard',
    map: { x: 93, y: 47 },
    tags: ['indoor'],
    desc: 'A shooting gallery long enough that the far butts are lit separately. The roof is a recent addition and the city is very proud of it.',
    activities: [
      { id: 'train_dex_gallery', kind: 'train', attr: 'dex', name: 'Shoot the Long Butts', icon: '🎯' },
      { id: 'train_con_gallery', kind: 'train', attr: 'con', name: 'Draw Until It Hurts', icon: '💪' },
    ],
    connections: [],
  },

  // --- Alembic Row (signature: alchemy, mutagens) ---
  alembic_row_gate: {
    id: 'alembic_row_gate',
    name: 'The Retort Gate',
    icon: '⚗️',
    areaId: 'alembic_row',
    map: { x: 68.4, y: 51.6 },
    desc: 'The wind decides what Alembic Row smells like on any given day, and the gate is where you find out.',
    activities: [],
    connections: [
      { to: 'ascent_foot', ticks: 60, label: 'the Retort Road' },
      { to: 'chancery_arch', ticks: 90 },
      { to: 'the_alembics', ticks: 40 },
      { to: 'the_vivarium', ticks: 40 },
    ],
  },
  the_alembics: {
    id: 'the_alembics',
    name: 'The Alembics',
    icon: '🧪',
    areaId: 'alembic_row',
    map: { x: 90, y: 55 },
    tags: ['indoor', 'heat'],
    desc: 'Glass, condensate, and a great deal of waiting. The waiting is the craft; the glass is just where it happens.',
    activities: [],
    benches: ['alchemy', 'preparing'],
    connections: [],
  },
  the_vivarium: {
    id: 'the_vivarium',
    name: 'The Vivarium',
    icon: '🧫',
    areaId: 'alembic_row',
    map: { x: 80, y: 65 },
    tags: ['indoor'],
    desc: 'Warm, humid, and full of things in tanks that are doing better than expected. The keepers speak of their charges in the third person and with some caution.',
    activities: [],
    benches: ['mutagens'],
    connections: [],
  },

  // --- The Chancery (signature: administrative) ---
  chancery_arch: {
    id: 'chancery_arch',
    name: 'The Chancery Arch',
    icon: '🏛️',
    areaId: 'the_chancery',
    map: { x: 50, y: 57.5 },
    desc: 'Every writ in Threshold passes under this arch, which is why there is always a queue and never an emergency.',
    activities: [],
    connections: [
      { to: 'ascent_foot', ticks: 60, label: 'the Chancery Road' },
      { to: 'assize_gate', ticks: 90 },
      { to: 'the_rolls', ticks: 40 },
      { to: 'seal_room', ticks: 40 },
    ],
  },
  the_rolls: {
    id: 'the_rolls',
    name: 'The Rolls',
    icon: '📜',
    areaId: 'the_chancery',
    map: { x: 62, y: 70 },
    tags: ['indoor'],
    desc: 'The city’s memory, stored in tubes, indexed by a system that four people understand and none of them agree on.',
    activities: [
      { id: 'job_copying', kind: 'job', gold: 12, ticksPer: 220, name: 'Copy Out Writs', icon: '🖋️', staticTime: true },
      { id: 'train_int_rolls', kind: 'train', attr: 'int', name: 'Read the Indexes', icon: '🗂️' },
    ],
    connections: [],
  },
  seal_room: {
    id: 'seal_room',
    name: 'The Seal Room',
    icon: '🔏',
    areaId: 'the_chancery',
    map: { x: 38, y: 70 },
    tags: ['indoor'],
    desc: 'Wax, presses, and a clerk whose entire authority rests on knowing which of forty stamps a document actually needs.',
    activities: [
      { id: 'train_wis_seals', kind: 'train', attr: 'wis', name: 'Learn Which Stamp', icon: '🧠' },
    ],
    connections: [],
  },

  // --- The Assize (signature: law) ---
  assize_gate: {
    id: 'assize_gate',
    name: 'The Assize Gate',
    icon: '⚖️',
    areaId: 'the_assize',
    map: { x: 31.6, y: 51.6 },
    desc: 'Open to anyone, which is the whole design, and consequently never quiet.',
    activities: [
      { id: 'train_cha_assize', kind: 'train', attr: 'cha', name: 'Watch a Case Argued', icon: '👂' },
    ],
    connections: [
      { to: 'ascent_foot', ticks: 60, label: 'the Assize Road' },
      { to: 'wrights_gate', ticks: 90 },
      { to: 'the_high_bench', ticks: 40 },
      { to: 'the_holding', ticks: 40 },
    ],
  },
  the_high_bench: {
    id: 'the_high_bench',
    name: 'The High Bench',
    icon: '🪑',
    areaId: 'the_assize',
    map: { x: 20, y: 65 },
    tags: ['indoor'],
    desc: 'Deliberately uncomfortable seating for everyone including the judges, on the theory that it shortens proceedings. It does not.',
    activities: [
      { id: 'train_cha_bench', kind: 'train', attr: 'cha', name: 'Plead a Small Matter', icon: '🗣️' },
      { id: 'train_wis_bench', kind: 'train', attr: 'wis', name: 'Weigh Both Sides', icon: '⚖️' },
    ],
    connections: [],
  },
  the_holding: {
    id: 'the_holding',
    name: 'The Holding',
    icon: '🔒',
    areaId: 'the_assize',
    map: { x: 10, y: 55 },
    tags: ['indoor'],
    desc: 'Six cells, rarely more than two in use, and a duty roster nobody volunteers for twice.',
    activities: [
      { id: 'job_watch', kind: 'job', gold: 14, ticksPer: 260, name: 'Stand the Night Watch', icon: '🌙', staticTime: true },
    ],
    connections: [],
  },

  // --- Wrights' Ward (signature: crafting) ---
  wrights_gate: {
    id: 'wrights_gate',
    name: "The Wrights' Gate",
    icon: '⚒️',
    areaId: 'wrights_ward',
    map: { x: 24, y: 37.5 },
    desc: 'You hear this district before you reach it, and on a still day you hear it from the tower steps.',
    activities: [],
    connections: [
      { to: 'ascent_foot', ticks: 60, label: 'the Wrights’ Road' },
      { to: 'granary_gate', ticks: 90 },
      { to: 'the_forges', ticks: 40 },
      { to: 'the_long_bench', ticks: 40 },
    ],
  },
  the_forges: {
    id: 'the_forges',
    name: 'The Forges',
    icon: '🔥',
    areaId: 'wrights_ward',
    map: { x: 7, y: 47 },
    tags: ['heat'],
    desc: 'A row of them under one long roof, sharing a chimney that was somebody’s clever idea and remains, on balance, a clever idea.',
    activities: [
      { id: 'job_bellows_threshold', kind: 'job', gold: 14, ticksPer: 250, name: 'Work the Bellows', icon: '🔥' },
      { id: 'train_str_forges', kind: 'train', attr: 'str', name: 'Swing the Sledge', icon: '🔨', tags: ['blunt'] },
    ],
    benches: ['assembling'],
    connections: [],
  },
  the_long_bench: {
    id: 'the_long_bench',
    name: 'The Long Bench',
    icon: '🔣',
    areaId: 'wrights_ward',
    map: { x: 7, y: 28 },
    tags: ['indoor'],
    desc: 'Fine work, done sitting down, by people who resent being called smiths and are technically correct.',
    activities: [],
    benches: ['runecarving'],
    connections: [],
  },

  // --- The Granaries (signature: resources & logistics) ---
  granary_gate: {
    id: 'granary_gate',
    name: 'The Granary Gate',
    icon: '🌾',
    areaId: 'the_granaries',
    map: { x: 31.6, y: 23.4 },
    desc: 'Carts in, carts out, and a tally clerk who has never once been wrong in a way anyone could prove.',
    activities: [],
    connections: [
      { to: 'ascent_foot', ticks: 60, label: 'the Granary Road' },
      { to: 'lectory_steps', ticks: 90 },
      { to: 'the_weighbridge', ticks: 40 },
      { to: 'the_undercrofts', ticks: 40 },
    ],
  },
  the_weighbridge: {
    id: 'the_weighbridge',
    name: 'The Weighbridge',
    icon: '⚓',
    areaId: 'the_granaries',
    map: { x: 10, y: 20 },
    desc: 'Everything entering Threshold is weighed here, including, once, a visiting dignitary who insisted.',
    activities: [
      { id: 'job_hauling', kind: 'job', gold: 11, ticksPer: 180, name: 'Haul and Stack', icon: '📦' },
      { id: 'train_str_haul', kind: 'train', attr: 'str', name: 'Shift the Heavy Lots', icon: '🪨' },
    ],
    connections: [
      // The road out. Everything the carts carry comes up this way, which
      // makes the logistics district the honest place for Threshold's only
      // land link to the rest of the world.
      { to: 'hamlet_square', ticks: 240, label: 'the Hamlet Road', returnLabel: 'the road up to Threshold' },
    ],
  },
  the_undercrofts: {
    id: 'the_undercrofts',
    name: 'The Undercrofts',
    icon: '🪵',
    areaId: 'the_granaries',
    map: { x: 20, y: 10 },
    tags: ['indoor'],
    desc: 'Cool vaulted cellars running further under the district than the maps admit. The stores at the front are catalogued. The stores at the back are not.',
    exploreTicks: 520,
    activities: [
      { id: 'explore_undercrofts', kind: 'explore', name: 'Go Through the Back Stores', icon: '🔍' },
      { id: 'train_con_undercrofts', kind: 'train', attr: 'con', name: 'Shift Barrels All Day', icon: '🛢️' },
    ],
    connections: [],
  },

};

/**
 * A new life opens at the foot of the tower, in the city that grew around it.
 * The Foot is the right root for three reasons rather than one: it is the
 * haven (the only `rest` in Threshold), it is the city's waypoint, and it is
 * the one spot all eight districts already reach — so the reachability lint
 * anchors on the same place the fiction does.
 */
export const STARTING_SPOT = 'ascent_foot';
/**
 * The classic dev start — everything hangs off the square, which is exactly
 * why it stays available behind the DebugPanel's "start new games here"
 * toggle (and why it is no longer where the STORY starts).
 */
export const DEBUG_STARTING_SPOT = 'village_square';
