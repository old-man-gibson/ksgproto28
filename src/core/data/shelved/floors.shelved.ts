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
};

/**
 * A floor hangs off the tower’s ladder, not a road, and a shelved floor has no
 * FloorDef. When the fixture mounts the shelf, this road from the Foot stands
 * in for the rung so the floor stays reachable and the world-graph lints run
 * over it. A revived floor gets its FloorDef back instead of this road.
 */
export const SHELVED_FLOOR_ROADS: { from: string; connection: Connection }[] = [
  { from: 'ascent_foot', connection: { to: 'f2_landing', ticks: 10 } },
];
