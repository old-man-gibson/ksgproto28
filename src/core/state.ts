import type { AttributeId, AttrState, GameState } from './types';
import { STARTING_SPOT } from './data/locations.data';
import { freshMutagenState } from './data/mutagens.data';
import { freshPrestigeState } from './data/prestige.data';

export const SAVE_VERSION = 52;


function freshAttrs(): Record<AttributeId, AttrState> {
  return {
    str: { level: 1, xp: 0 },
    dex: { level: 1, xp: 0 },
    con: { level: 1, xp: 0 },
    int: { level: 1, xp: 0 },
    wis: { level: 1, xp: 0 },
    cha: { level: 1, xp: 0 },
  };
}

export function createInitialState(now = Date.now(), spot = STARTING_SPOT): GameState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSaved: now,
    // The story opens at 09:00 on the first morning, at home — tick zero
    // would be MIDNIGHT, and night is a mechanic now (exposure.ts): a newborn
    // save fumbling in the dark for its first hours is nobody's tutorial.
    totalTicks: 9 * 60 * 10,
    rngState: (now ^ 0x9e3779b9) | 0,
    uidCounter: 1,
    paused: false,

    attrs: freshAttrs(),
    fused: [],
    // Every pool starts full at its level-1 capacity (see derived.ts baseStats).
    resources: {
      hp: 50, // maxHp at con 1
      stamina: 11, // maxStamina (floored) at str 1 / con 1
      mana: 1, // maxMana at int 1
      spirit: 5, // maxSpirit at wis 1 / cha 1
      focus: 6, // maxFocus (floored) at cha 1 / wis 1
    },
    resourceLocks: {},
    statuses: [],
    useCooldowns: {},
    exerting: false, // opt in to the style's stamina bargain when you want it
    skills: {},
    style: 'balanced',
    skillOrder: [],
    skillTriggers: {},
    techniques: {},
    drilling: [],
    sheathed: null,
    loadouts: [],

    activity: null,
    activityProgress: 0,
    benchWork: null,
    recovering: false,
    combat: null,
    combatFeed: [],
    floatingFeed: [],
    fight: null,
    lastFight: null,
    notebook: [],
    respawnTimer: 0,

    spot,
    travel: null,
    travelPlan: [],
    discovered: [spot],
    explored: {},
    finds: {},
    // Nothing behind you yet — until you have stood somewhere you could rest,
    // a fall is caught by the world's first haven (see systems/safety.ts).
    safeSpots: { nearest: null, unconditional: null },
    pendingApproach: null,

    inventory: [{ uid: 1, defId: 'rusty_sword', slots: 1, runes: [] }],
    equipment: {},
    materials: {},
    runes: {},
    carved: [],
    flasks: [],
    coating: null,
    grimoire: [],
    compositions: [],
    performance: null,
    favor: {},
    // A fresh mind holds raw power and its spread; the rest is taught.
    psi: { axes: ['force', 'reach'], tier: 0 },
    mutagens: freshMutagenState(),
    stock: {},
    gold: 0,

    quests: {},
    achievements: {},
    prestige: freshPrestigeState(),
    titles: [],
    title: null,
    stats: {},
    mercy: {},
    bestiary: {},
    novelty: {},

    log: [],
  };
}
