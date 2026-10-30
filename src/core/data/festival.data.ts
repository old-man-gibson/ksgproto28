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

// ---------- The royale ----------

/** The others: ninety-nine survivors of the other rooms. */
export const SURVIVORS = 99;

/**
 * Survivor levels. The ninety-nine prepare too (§5.3 item 14): over the ten
 * days they gain `growth` levels on a straight line, and the royale always
 * opens at the end of that line, waited out or jumped (§5.4 Q7). Survivors
 * who outlast the field gain up to `shrink` more as it empties. The last one
 * standing is the champion, `champion` levels above the rest.
 */
export const SURVIVOR_LEVELS = { base: 34, growth: 3, shrink: 1, champion: 1 };

/** The royale's survivor species, drawn in turn; the last survivor is the champion. */
export const SURVIVOR_SPECIES = ['ph_survivor_blade', 'ph_survivor_brute'];
export const SURVIVOR_CHAMPION = 'ph_survivor_champion';

/**
 * The counter field (§5.4 Q6's default, stage 1 of the build): every
 * `thinTicks` one survivor falls to another, and between the player's fights
 * the field sends one or two at the player after `engageGap` ticks. The last
 * survivor is never thinned: the champion waits for the player.
 */
export const ROYALE_COUNTER = { thinTicks: 25, engageGap: 60, firstEngage: 30 };
