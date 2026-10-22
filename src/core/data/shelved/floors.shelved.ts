import type { AreaDef, Connection, SpotDef } from '../../types';

/**
 * THE SHELF — tower floors replaced by the "one building" redesign
 * (plans/alpha-band-one-floors.md, 2026-10-21). Same rules as
 * locations.shelved.ts: nothing here is loaded by the game, and
 * tests/fixtures/shelved-world.ts mounts it so it stays valid content.
 *
 * Their area ids are renamed so they never collide with the live floors that
 * reuse the old ones; spot ids, counters and flags are the originals, so a
 * floor brought back is a paste plus a FloorDef pointing at its area.
 */

export const SHELVED_FLOOR_AREAS: Record<string, AreaDef> = {
  // The Flooded Stair: floor 2 from 2026-09-06 to 2026-10-21. The forced
  // cistern's eight fights, the sluice wheel that drains it, the oak club.
  flooded_stair_area: { id: 'flooded_stair_area', name: 'The Flooded Stair', regionId: 'the_ascent', scene: 'cistern' },
  // The Silk Gallery: floor 3 from 2026-09-06 to 2026-10-21. The brood's
  // fight budget opens the den; three burned egg sacs draw out the Giant
  // Spider Queen, whose kill cleared the floor and opened prestige.
  silk_gallery_area: { id: 'silk_gallery_area', name: 'The Silk Gallery', regionId: 'the_ascent', scene: 'webs' },
};

export const SHELVED_FLOOR_SPOTS: Record<string, SpotDef> = {
  // --- Floor 2: the Flooded Stair (clear: spend the cistern's fight budget) ---
  f2_landing: {
    id: 'f2_landing',
    name: 'The Waterline',
    desc: 'Landing of floor 2. Camp on the Landing is a rest activity, and the landing is a haven. Connects to the Sluice Gallery and the Broken Cistern; arriving at the cistern starts a fight that cannot be fled.',
    icon: '🪜',
    areaId: 'flooded_stair_area',
    map: { x: 18, y: 15 },
    activities: [{ id: 'camp_f2', kind: 'rest', name: 'Camp on the Landing', icon: '🏕️' }],
    connections: [
      { to: 'f2_sluice', ticks: 40 },
      // The way to the cistern is walked knowing: the spot is forced, and the
      // travel button says so before the click.
      { to: 'f2_cistern', ticks: 50 },
    ],
  },
  f2_sluice: {
    id: 'f2_sluice',
    name: 'The Sluice Gallery',
    desc: 'Trace the Channels explores the gallery (42 s) for two finds. Cross the Wet Stones trains Dexterity. Turn the Sluice Wheel drains the Broken Cistern in four turns (8 s each): its slimes drop two levels, and the Dry Channel opens from here into the cistern, arriving behind the first slimes (surprised).',
    icon: '🚰',
    areaId: 'flooded_stair_area',
    map: { x: 8, y: 8 },
    exploreTicks: 420,
    activities: [
      { id: 'explore_f2', kind: 'explore', name: 'Trace the Channels', icon: '🔍' },
      { id: 'train_dex_sluice', kind: 'train', attr: 'dex', name: 'Cross the Wet Stones', icon: '👣' },
      // The cistern's other answer: drain it. Three quarter-turns, and the
      // fourth empties it — `drained` requires all three turns, so the
      // search always takes exactly four and never pays early. Drained, the
      // cistern rolls its stranded table and the dry channel below opens.
      {
        id: 'turn_wheel',
        kind: 'search',
        name: 'Turn the Sluice Wheel',
        icon: '☸️',
        ticksPer: 80,
        rewards: [
          { id: 'turn', weight: 1, limit: 3, stat: { key: 'flag:f2_wheel_turns' }, desc: '☸️ The sluice wheel gives a quarter turn. The cistern drains on the fourth.' },
          {
            id: 'drained',
            desc: '🌊 The fourth turn opens the sluice and the Broken Cistern drains. Its slimes are stranded two levels down, and the Dry Channel leads from here into the cistern behind them.',
            weight: 1,
            limit: 1,
            requires: [{ type: 'stat', key: 'flag:f2_wheel_turns', value: 3 }],
            stat: { key: 'flag:f2_cistern_drained', set: 1 },
          },
        ],
      },
    ],
    // The floor hands over its own answer: the cistern's slimes shrug off
    // blades and points but not a club. Found before the purse, so a player
    // who looks around before wading in carries the right tool into the den.
    finds: [
      {
        id: 'f2_snagged_club',
        desc: '🏏 An oak club snagged in a grate. A club deals bludgeoning damage, which the cistern’s slimes take more of; blades and points they mostly shrug off.',
        at: 0.2,
        item: 'oak_club',
      },
      {
        id: 'f2_drowned_purse',
        desc: '💰 A purse wedged in a sluice gate: 70 to 110 gold.',
        at: 0.45,
        gold: [70, 110],
      },
    ],
    connections: [
      // The drained cistern's back door, and the first consumer of
      // `approach`: walked this way, the first slimes are caught from
      // behind (surprised). One-way, so the cistern lists no road back up a
      // channel that is not there yet; the front door is still forced.
      {
        to: 'f2_cistern',
        ticks: 40,
        oneWay: true,
        label: 'Down the Dry Channel',
        requires: [{ type: 'stat', key: 'flag:f2_cistern_drained', value: 1 }],
        revealWhen: [{ type: 'stat', key: 'flag:f2_cistern_drained', value: 1 }],
        approach: { enemies: [{ id: 'surprised' }] },
      },
    ],
  },
  f2_cistern: {
    id: 'f2_cistern',
    name: 'The Broken Cistern',
    desc: 'Den of floor 2. Arriving starts a fight that cannot be fled. Wade In fights Water Slimes and Slimers (levels 4 to 7; 2 to 5 once the Sluice Wheel has drained it), mostly one at a time. The cistern holds 8 winnable fights; the eighth win clears the floor, ends the forced fights and empties the hunts.',
    icon: '💧',
    areaId: 'flooded_stair_area',
    map: { x: 26, y: 22 },
    // Arrival is an ambush by ANY route, and the fight budget is the floor's
    // clear: fightLimit here and ascent_f2.clear name the same number (linted
    // to agree). At the limit the cistern is CLEARED — it stops forcing, the
    // hunts go quiet, and the stair above opens.
    forced: true,
    fightLimit: 8,
    // Mostly one at a time: a forced spot cannot be walked away from, and a
    // pair of slimers at the top of the old range knocked a blade-user out
    // three to five times across the eight.
    groupWeights: { 1: 80, 2: 20 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Wade In', icon: '⚔️' }],
    // Flooded (the default) or drained (the sluice wheel): one table each,
    // switched on the wheel's flag. Stranded slimes are the same species two
    // levels down — out of the water, not a different monster.
    encounters: [
      { monsterId: 'slime_water', weight: 60, level: [4, 6], requires: [{ type: 'statMax', key: 'flag:f2_cistern_drained', value: 0 }] },
      { monsterId: 'slime_base_advanced', weight: 40, level: [5, 7], requires: [{ type: 'statMax', key: 'flag:f2_cistern_drained', value: 0 }] },
      { monsterId: 'slime_water', weight: 60, level: [2, 4], requires: [{ type: 'stat', key: 'flag:f2_cistern_drained', value: 1 }] },
      { monsterId: 'slime_base_advanced', weight: 40, level: [3, 5], requires: [{ type: 'stat', key: 'flag:f2_cistern_drained', value: 1 }] },
    ],
    connections: [],
  },
  // --- Floor 3: the Silk Gallery (clear: kill the brood queen) ---
  f3_landing: {
    id: 'f3_landing',
    name: 'The Hushed Landing',
    desc: 'Landing of floor 3. Camp on the Landing is a rest activity, and the landing is a haven. Connects to the Silk Gallery; the road to the Brood Den appears once the gallery’s brood is driven off.',
    icon: '🪜',
    areaId: 'silk_gallery_area',
    map: { x: 86, y: 68 },
    activities: [{ id: 'camp_f3', kind: 'rest', name: 'Camp on the Landing', icon: '🏕️' }],
    connections: [
      { to: 'f3_web_gallery', ticks: 40 },
      // The den is reached by thinning the brood first: the gallery's fight
      // budget spent, the road appears. The same shape as the first floor's
      // Records Passage, and what keeps the queen from being the first thing
      // a newcomer to this floor meets.
      {
        to: 'f3_brood_den',
        ticks: 60,
        label: 'Follow the Silk to the Den',
        requires: [{ type: 'stat', key: 'fights:f3_web_gallery', value: 4 }],
        revealWhen: [{ type: 'stat', key: 'fights:f3_web_gallery', value: 4 }],
      },
    ],
  },
  f3_web_gallery: {
    id: 'f3_web_gallery',
    name: 'The Silk Gallery',
    desc: 'Cut Through the Webs explores the gallery (48 s) for two finds. Hunt the Gallery fights Cave Spiders and Slime Spiders (levels 4 to 7). The gallery holds 6 winnable fights; the sixth win opens the road to the Brood Den and empties the hunt.',
    icon: '🕸️',
    areaId: 'silk_gallery_area',
    map: { x: 78, y: 62 },
    exploreTicks: 480,
    activities: [
      { id: 'explore_f3', kind: 'explore', name: 'Cut Through the Webs', icon: '🔍' },
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Gallery', icon: '⚔️' },
    ],
    // The brood. Four wins spend it and open the road to the den; after that
    // the gallery's hunt goes quiet and the den is where spiders are farmed.
    // Six (2026-10-10) chained into knockouts: a won spider fight costs half
    // a band-1 climber's health and the hunt rolls the next one straight
    // away, so most falls came on the second or third fight in a row.
    fightLimit: 4,
    groupWeights: { 1: 80, 2: 20 },
    // One level down from the 2026-10-10 table (5–7 / 6–8), which still put
    // every build on the floor three to six times here.
    encounters: [
      { monsterId: 'cave_spider', weight: 60, level: [4, 6] },
      { monsterId: 'slime_spider', weight: 40, level: [5, 7] },
    ],
    // The queen takes half again from a point and shrugs off a third of an
    // edge; a spear cut out of the webs is the floor's answer to her, the way
    // the sluice's club is the answer to the cistern.
    finds: [
      {
        id: 'f3_webbed_spear',
        desc: '🔱 An old spear bound into the webs. A spear deals piercing damage, which the Giant Spider Queen takes half again of.',
        at: 0.25,
        item: 'old_spear',
      },
      {
        id: 'f3_wrapped_valuables',
        desc: '💰 A cocooned satchel: 120 to 180 gold.',
        at: 0.5,
        gold: [120, 180],
      },
    ],
    connections: [],
  },
  f3_brood_den: {
    id: 'f3_brood_den',
    name: 'The Brood Den',
    desc: 'Den of floor 3. Go to the Centre fights Cave Spiders (levels 6 to 8), at most two at a time. Burn the Egg Sacs burns one sac per search (6 s); after the third, the next fight at the centre is the Giant Spider Queen (level 9), who always fights alone. Killing the queen clears the floor, and the spiders return.',
    icon: '🕷️',
    areaId: 'silk_gallery_area',
    map: { x: 94, y: 74 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Go to the Centre', icon: '⚔️' },
      // The queen is drawn out, not rolled: burn three egg sacs and the next
      // fight at the centre is hers. A search, so burning is never a fight —
      // walking to the centre afterwards is the decision. Each sac requires
      // the one before, so the three lines always arrive in order.
      {
        id: 'burn_sacs',
        kind: 'search',
        name: 'Burn the Egg Sacs',
        icon: '🔥',
        ticksPer: 60,
        rewards: [
          { id: 'sac_1', weight: 1, limit: 1, desc: '🔥 Egg sac burned (1 of 3).', stat: { key: 'flag:f3_sacs_burned' } },
          { id: 'sac_2', weight: 1, limit: 1, desc: '🔥 Egg sac burned (2 of 3).', requires: [{ type: 'stat', key: 'flag:f3_sacs_burned', value: 1 }], stat: { key: 'flag:f3_sacs_burned' } },
          { id: 'sac_3', weight: 1, limit: 1, desc: '🔥 Egg sac burned (3 of 3). The Giant Spider Queen comes out: the next fight at the centre is hers.', requires: [{ type: 'stat', key: 'flag:f3_sacs_burned', value: 2 }], stat: { key: 'flag:f3_sacs_burned' } },
        ],
      },
    ],
    // Pairs at most: the default table's packs of three and four were death
    // sentences for a band-1 build and most of the old floor's knockouts.
    groupWeights: { 1: 75, 2: 25 },
    // Three states, one table each: the brood guards its eggs (sacs 0–2);
    // the queen alone once the third burns; the brood again once she is
    // dead, so the den stays a place to hunt spiders.
    encounters: [
      { monsterId: 'cave_spider', weight: 70, level: [6, 8], requires: [{ type: 'statMax', key: 'flag:f3_sacs_burned', value: 2 }] },
      // The floor's clear: `once`, latching slain:f3_brood_den:giant_spider_queen.
      // She is solitary (`group.max: 1` on the def), so she always comes alone
      // and is never drafted into a spider's escort.
      { monsterId: 'giant_spider_queen', weight: 30, level: [9, 9], once: true, requires: [{ type: 'stat', key: 'flag:f3_sacs_burned', value: 3 }] },
      { monsterId: 'cave_spider', weight: 70, level: [6, 8], requires: [{ type: 'stat', key: 'slain:f3_brood_den:giant_spider_queen', value: 1 }] },
    ],
    connections: [],
  },
};

/**
 * A floor hangs off the tower’s ladder, not a road, and a shelved floor has no
 * FloorDef. When the fixture mounts the shelf, this road from the Foot stands
 * in for the rung so the floor stays reachable and the world-graph lints run
 * over it. A revived floor gets its FloorDef back instead of this road.
 */
export const SHELVED_FLOOR_ROADS: { from: string; connection: Connection }[] = [
  { from: 'ascent_foot', connection: { to: 'f2_landing', ticks: 10 } },
  { from: 'ascent_foot', connection: { to: 'f3_landing', ticks: 10 } },
];
