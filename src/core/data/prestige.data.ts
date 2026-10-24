import type { PrestigeBoonDef, PrestigeSourceDef, PrestigeState, UnlockCondition } from '../types';
import { prose } from '../text/prose';
import { PRESTIGE_BOONS_TEXT } from '../text/prestige.text';

/**
 * Prestige: the harvest re-climb (docs/PRESTIGE.md). Numbers here are first
 * guesses, tuned in review; the shape is the settled part.
 *
 * Three tables, all declarative so the preview can be computed from them:
 * what OPENS prestige, what the harvest MEASURES, and what points BUY.
 */

/**
 * The button lights when this holds. Band 1 of the Ascent ends at its last
 * boss (towers.data.ts, `ascent_f3.clear`) — the user's call 2026-09-12 was
 * "show the tab when the player defeats the spider queen"; since the floors
 * redesign (2026-10-21) that boss is the puppet bureaucrat. Same latch the
 * floor's clear reads, so the two can never disagree.
 */
export const PRESTIGE_UNLOCK: UnlockCondition[] = [
  { type: 'stat', key: 'slain:f3_hearing_room:puppet_bureaucrat', value: 1 },
];

/**
 * What the harvest measures. Every source accrues from acting at all — the
 * same rule the tower's gates follow — so a player who engaged with no
 * subsystem on its own terms still harvests something. Order is display
 * order.
 */
export const PRESTIGE_SOURCES: Record<string, PrestigeSourceDef> = {
  floors: { id: 'floors', name: 'Floors cleared', icon: '🗼', measure: 'floors', per: 1, unit: 'floor' },
  quests: { id: 'quests', name: 'Quests completed', icon: '⭐', measure: 'stat', key: 'quests:completed', per: 2, unit: 'quest' },
  bestiary: { id: 'bestiary', name: 'Bestiary entries', icon: '📖', measure: 'stat', key: 'bestiary:entries', per: 5, unit: 'entry' },
  skills: { id: 'skills', name: 'Skill levels', icon: '📜', measure: 'skillLevels', per: 25, unit: 'level' },
  achievements: { id: 'achievements', name: 'Achievement tiers', icon: '🏆', measure: 'achievements', per: 3, unit: 'tier' },
  // Geometric, not linear (user, 2026-09-12: "gold can end up granting too
  // many points"): 1 point at 10,000 gold, 2 at 100,000, 3 at 1,000,000 —
  // each point ten times further than the last, so a fortune is worth a few
  // points and no run farms gold for the harvest.
  gold: { id: 'gold', name: 'Gold earned', icon: '💰', measure: 'stat', key: 'gold:earned', per: 10_000, growth: 10, unit: 'gold' },
};

/**
 * What points buy. Every effect is a one-shot grant at run start or a read
 * at its use site (skillCap, preparedCap) — never a Modifier. Head Start
 * sets the character level, which IS in the derived-stats fingerprint, so
 * the stat block follows it like any other level-up. The three ceilings are the
 * first consumers of the cap-raise lane WEATHER.md left unwired.
 */
export const PRESTIGE_BOONS = prose<PrestigeBoonDef>('PRESTIGE_BOONS', PRESTIGE_BOONS_TEXT, {
  // Rank 1 arrives with the first prestige, unasked (`auto`). The product
  // rank × peak × prestiges is what the user asked for (2026-09-12): it can
  // only grow with prestiges performed, sits at a fraction of a percent for
  // a modest run, and goes monumental only if one run climbs a skill very
  // far. `rate` is the one dial: 0.0001 = 0.01% per unit of the product.
  // Examples at rank 1: peak 30 after 1 prestige → +0.3%; peak 100 after 5 →
  // +5%; rank 5, peak 300, 10 prestiges → +150%.
  talent: {
    id: 'talent',
    name: 'Talent',
    icon: '✨',
    cost: [0, 2, 3, 4, 5],
    effect: { kind: 'talent', rate: 0.0001 },
    auto: true,
  },
  // Talent's twin for attributes, same product, same `auto` first rank. The
  // name: "aptitude" belongs to the creature table in base building, so this
  // is what a body is born with — an endowment. Renames cleanly.
  endowment: {
    id: 'endowment',
    name: 'Endowment',
    icon: '💪',
    cost: [0, 2, 3, 4, 5],
    effect: { kind: 'endowment', rate: 0.0001 },
    auto: true,
  },
  provisions: {
    id: 'provisions',
    name: 'Provisions',
    icon: '💰',
    cost: [1, 1, 2, 2, 3],
    effect: { kind: 'startGold', amount: 50 },
  },
  grimoire_page: {
    id: 'grimoire_page',
    name: 'Grimoire page',
    icon: '📕',
    cost: [2, 3],
    effect: { kind: 'preparedPages', pages: 1 },
  },
  chronosense_ceiling: {
    id: 'chronosense_ceiling',
    name: 'Chronosense ceiling',
    icon: '🕰️',
    cost: [1, 2, 2, 3],
    effect: { kind: 'skillCap', skill: 'chronosense', by: 5 },
  },
  weathersense_ceiling: {
    id: 'weathersense_ceiling',
    name: 'Weathersense ceiling',
    icon: '🌦️',
    cost: [1, 2, 2, 3],
    effect: { kind: 'skillCap', skill: 'weathersense', by: 5 },
  },
  darkvision_ceiling: {
    id: 'darkvision_ceiling',
    name: 'Darkvision ceiling',
    icon: '🌑',
    cost: [1, 2, 3],
    effect: { kind: 'skillCap', skill: 'darkvision', by: 10 },
  },
  // Knowledge of what is coming is itself the purchase (user, 2026-09-12):
  // a first run sees a locked skill or a milestone only when it is 90% of
  // the way there; a prestiged run can buy the whole map back.
  foresight: {
    id: 'foresight',
    name: 'Foresight',
    icon: '🔭',
    cost: [3],
    effect: { kind: 'foresight' },
  },
  // The map's "go and do" reaches every tab (user, 2026-09-13): the first run
  // learns where things are by walking; a prestiged run can buy the links.
  wayfinding: {
    id: 'wayfinding',
    name: 'Wayfinding',
    icon: '🧭',
    cost: [2],
    effect: { kind: 'wayfinding' },
  },
  // The character level resets with the run (user, 2026-10-18); each rank
  // starts the next one a level higher, attribute bonus included.
  head_start: {
    id: 'head_start',
    name: 'Head Start',
    icon: '⏫',
    cost: [1, 2, 3, 4, 5],
    effect: { kind: 'startLevel', levels: 1 },
  },
  // The Cook's Book resets with the run (user, 2026-10-23: "it resets but
  // prestige boons can carry some parts over"). Rank 1 keeps which dishes had
  // their cook time shown, rank 2 also keeps Signatures. What was reached is
  // stored at every prestige (`PrestigeState.cookbook`); the rank gates the
  // reading, so points spent in the overlay apply to every earlier run too.
  cooks_notes: {
    id: 'cooks_notes',
    name: "Cook's Notes",
    icon: '📒',
    cost: [1, 2],
    effect: { kind: 'cookbook' },
  },
});

/** A save that has never prestiged. */
export function freshPrestigeState(): PrestigeState {
  return {
    count: 0,
    points: 0,
    purchases: {},
    peakLevels: {},
    peakAttrs: {},
    cookbook: { timed: [], signed: [] },
    lastHarvest: null,
    review: false,
    spentThisReview: 0,
  };
}
