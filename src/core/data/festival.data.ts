import type { Modifier, RoyaleStrategyDef } from '../types';
import { prose } from '../text/prose';
import { ROYALE_STRATEGIES_TEXT } from '../text/festival.text';
import { HOURS_PER_DAY, MINUTES_PER_HOUR, TICKS_PER_GAME_MINUTE } from './climate.data';

/**
 * The Vermin Festival, floors 15–16 (docs/FLOOR_IDEAS.md §5.3 items 6, 10–20,
 * 23–25): the dials and ids the runtime in systems/festival.ts reads. The
 * floors, spots and monsters themselves are ordinary content under the
 * FESTIVAL markers of the shared data files.
 *
 * The arithmetic is the Gu ritual's: ten rooms of ten, one survivor each,
 * then one of a hundred. The player wakes in one of the rooms.
 */

export const FESTIVAL_BAND = 'ascent_festival';
/** Floor 15: the dark room and the hub behind its door. */
export const DARK_FLOOR = 'ascent_f15';
/** Floor 16: the royale. */
export const ROYALE_FLOOR = 'ascent_f16';
/** Floor 15's landing, where every attempt starts. */
export const DARK_ROOM = 'f15_dark_room';
/** Floor 16's landing, the royale's field. */
export const ARENA = 'f16_arena';
/** The hub's stores: a search whose limits reset with every attempt. */
export const FESTIVAL_STORES = 'f15_stores';

const TICKS_PER_HOUR = TICKS_PER_GAME_MINUTE * MINUTES_PER_HOUR;
const TICKS_PER_DAY = TICKS_PER_HOUR * HOURS_PER_DAY;

/** Ten festival days between the door opening and the royale (§5.3 item 6). */
export const PREP_TICKS = 10 * TICKS_PER_DAY;
/** A lost attempt shuts floors 15–16 for three days of the world clock (§5.3 item 16). */
export const LOCKOUT_TICKS = 3 * TICKS_PER_DAY;

/**
 * Counters the festival writes. `festival:door` is 1 while this attempt's
 * dark room door stands open (the hub's road reads it) and 0 from the start
 * of the next attempt. `festival:wins` counts royales won this run. The
 * floors' clears read the two boss lines instead (`boss:f15_dark_room`,
 * `boss:f16_arena`), which only ever fall at the end of a room or a field.
 */
export const FESTIVAL_DOOR_KEY = 'festival:door';
export const FESTIVAL_WINS_KEY = 'festival:wins';

/** One member of a staged festival fight: pinned level, no rolled modifier or rarity. */
export interface FestivalFoe {
  monsterId: string;
  level: number;
}

/**
 * The dark room's nine, as four waves. The last is fought alone, and it is
 * the dark room's boss line (`boss:f15_dark_room`, floor 15's clear), so the
 * clear latches only when a room is emptied in one attempt.
 */
export const DARK_ROOM_WAVES: FestivalFoe[][] = [
  [
    { monsterId: 'ph_room_brawler', level: 32 },
    { monsterId: 'ph_room_bruiser', level: 32 },
  ],
  [
    { monsterId: 'ph_room_brawler', level: 32 },
    { monsterId: 'ph_room_brawler', level: 33 },
    { monsterId: 'ph_room_bruiser', level: 33 },
  ],
  [
    { monsterId: 'ph_room_bruiser', level: 33 },
    { monsterId: 'ph_room_brawler', level: 33 },
    { monsterId: 'ph_room_bruiser', level: 33 },
  ],
  [{ monsterId: 'ph_room_last', level: 35 }],
];

/** Ticks between one dark room wave falling and the next stepping up. */
export const WAVE_PAUSE_TICKS = 30;

/**
 * The issued weapon (§5.4 Q4, approved): the family whose skill is highest,
 * ties broken by kills with that family, then by this order. A plain issue:
 * the family's starter item with no affix and no rune slots. `unarmed` issues
 * nothing. `family` is the item tag the family's skill reads.
 */
export const ISSUED_WEAPONS: { family: string; skill: string; item: string | null }[] = [
  { family: 'sword', skill: 'swordsmanship', item: 'rusty_sword' },
  { family: 'spear', skill: 'spear_combat', item: 'old_spear' },
  { family: 'dagger', skill: 'dagger_combat', item: 'iron_dagger' },
  { family: 'blunt', skill: 'club_combat', item: 'old_hammer' },
  { family: 'greatsword', skill: 'greatsword_combat', item: 'steel_greatsword' },
  { family: 'staff', skill: 'staff_combat', item: 'oak_staff' },
  { family: 'bow', skill: 'bow_combat', item: 'hunting_bow' },
  { family: 'unarmed', skill: 'unarmed_combat', item: null },
];

/** Where each weapon family's kills are counted (systems/festival.ts, on every kill). */
export const weaponKillsKey = (family: string): string => `kills:weapon:${family}`;

// ---------- Rewards (§5.3 items 6, 14, 17, 23, 24) ----------

/** A win pays this piece, the first win of a run only: reruns pay nothing. */
export const FESTIVAL_REWARD = 'festival_laurel';

/**
 * Every hundredth win in a run puts one festival token in the stronghold
 * stash (200 earns two); the count is a run counter and restarts each run.
 */
export const TOKEN_EVERY_WINS = 100;
export const FESTIVAL_TOKEN = { name: 'Festival Token', icon: '🎟️' };

/**
 * A token's three choices. The permanent bonus: `mods` per stack, stacking up
 * to `cap` stacks (the dial, §5.3 item 24). The technique: one of
 * `offer` drawn from `pool` with the token's seed; the pool is a placeholder
 * of existing techniques until the festival's own are written. The
 * equipment: `regalia`, above the normal reward and keep-marked.
 */
export const TOKEN_BONUS: { cap: number; mods: Modifier[] } = {
  cap: 5,
  mods: [
    { stat: 'damage', op: 'mult', value: 0.03 },
    { stat: 'maxHp', op: 'mult', value: 0.03 },
  ],
};
export const TOKEN_TECHNIQUES = { offer: 3, pool: ['riposte', 'sidestep', 'thrust', 'whirl_kick', 'taunt', 'ginga'] };
export const TOKEN_REGALIA = 'festival_regalia';

/**
 * The hidden title (§5.3 item 14): enter floor 16 within twelve festival
 * hours of the dark room's door opening, then win. Written only by that win;
 * nothing shows before it (secret-content rules).
 */
export const SWIFT_ENTRY_TICKS = 12 * TICKS_PER_HOUR;
export const FESTIVAL_SWIFT_KEY = 'festival:swift_wins';

// ---------- The royale ----------

/** The others: ninety-nine survivors of the other rooms. */
export const SURVIVORS = 99;

/**
 * Survivor levels. The ninety-nine prepare too (§5.3 item 14): over the ten
 * days they gain `growth` levels on a straight line, and the royale always
 * opens at the end of that line, waited out or jumped (§5.4 Q7). On the field
 * each duel a survivor wins adds `perWin` levels, up to `winCap`, so the
 * field gets stronger as it empties. The last one standing is the champion,
 * `champion` levels above that.
 */
export const SURVIVOR_LEVELS = { base: 34, growth: 3, perWin: 1, winCap: 2, champion: 1 };

/**
 * The royale's survivor species, in equal shares, each with the strategies it
 * fights with: the same registry the player ranks from, so a survivor moves
 * by the rules the player can pick. `weight` scales its strength in duels
 * between survivors. The last survivor is the champion, fought alone.
 */
export const SURVIVOR_SPECIES: { monsterId: string; weight: number; plan: string[] }[] = [
  { monsterId: 'ph_survivor_blade', weight: 1, plan: ['fall_back_hurt', 'hunt_weakest'] },
  { monsterId: 'ph_survivor_brute', weight: 1.1, plan: ['press_nearest'] },
];
export const SURVIVOR_CHAMPION = 'ph_survivor_champion';

/**
 * The field (§5.3 items 13 and 18; systems/royaleField.ts). Units are field
 * units on a square `size` across, drawn isometrically. A fighter walks
 * `speed` a tick (the player's pace is scaled by their travel speed) and
 * picks where to walk every `thinkTicks`. Two fighters closer than
 * `engageRadius` fight: two survivors duel for `duelTicks` and the loser
 * falls; survivors who reach the player, up to `maxGroup` of them, are the
 * player's next fight. A duel's winner is wounded by `duelWound` of its
 * health and recovers `healPerTick`. `sight` is how far `weakest` looks.
 */
export const ROYALE_FIELD = {
  size: 60,
  speed: 0.2,
  thinkTicks: 5,
  engageRadius: 2.5,
  maxGroup: 3,
  duelTicks: 100,
  duelWound: 0.35,
  healPerTick: 0.002,
  sight: 20,
};

/** The player's strategies until they rank their own. */
export const DEFAULT_ROYALE_PLAN = ['fall_back_hurt', 'press_nearest'];

/** Strategies a player may rank at once. */
export const ROYALE_PLAN_SLOTS = 3;

/**
 * Ways to move on the field (§5.3 item 18): the player ranks up to three, and
 * the first whose condition holds decides where the player walks. A plan
 * alone can win, and a click on the field overrides it until the player gets
 * there. Every survivor species moves by a list from this registry too.
 */
export const ROYALE_STRATEGIES = prose<RoyaleStrategyDef>('ROYALE_STRATEGIES', ROYALE_STRATEGIES_TEXT, {
  press_nearest: { id: 'press_nearest', name: 'Press the Nearest', icon: '⚔️', move: 'nearest' },
  hunt_weakest: { id: 'hunt_weakest', name: 'Hunt the Weakest', icon: '🎯', move: 'weakest' },
  hold_centre: { id: 'hold_centre', name: 'Hold the Centre', icon: '⭕', move: 'centre' },
  keep_away: { id: 'keep_away', name: 'Keep Away', icon: '🏃', move: 'away' },
  wait_at_edge: { id: 'wait_at_edge', name: 'Wait at the Edge', icon: '🧱', move: 'edge' },
  fall_back_hurt: { id: 'fall_back_hurt', name: 'Fall Back When Hurt', icon: '🩹', move: 'away', when: { hpBelow: 0.5 } },
  lie_low: { id: 'lie_low', name: 'Lie Low While Crowded', icon: '🫥', move: 'away', when: { fieldAbove: 30 } },
});
