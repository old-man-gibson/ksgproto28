import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { TPS } from '../src/core/engine/loop';
import { STRONGHOLD_WAVE } from '../src/core/data/prestige.data';
import { getDerivedStats } from '../src/core/systems/derived';
import { lockoutLeft } from '../src/core/systems/festivalRules';
import { hasKeyItem } from '../src/core/systems/keyitems';
import { clearMet } from '../src/core/systems/ladder';
import { checkFloorClears, floorXpKey, xpToReach } from '../src/core/systems/levels';
import { statsFromAttrs } from '../src/core/systems/monsterStats';
import { autoPrestigeDue } from '../src/core/systems/prestige';
import { acceptedKey, objectiveProgress } from '../src/core/systems/quests';
import { FLOORS, NPCS, QUESTS, SEA_SIDES, SPOTS } from '../src/core/registry';
import type { GameState, TutorialWeapon, UnlockCondition } from '../src/core/types';

/**
 * JOHN (docs/COMPLETABILITY.md §8) — the floor build, played up the tower.
 *
 * John Idle, Male, Fighter, Longsword: the most boring build there is, who
 * engages with no optional system on its own terms. The goldfish
 * (tests/goldfish.ts) never makes a correct decision and proves nothing
 * closes; John always makes the OBVIOUS one and proves the road exists. He
 * walks the floors in order, hunts where a floor says to hunt, searches where
 * it says to search, works a job in Threshold when a gate wants coin, and when
 * he is knocked out he rests at the haven he woke in and walks straight back.
 * He never shops, crafts, takes a quest or opens the bestiary, so what he
 * reports is the curve a player meets with nothing but persistence, and every
 * system Threshold offers is headroom on top of it (§6: difficulty becomes
 * pacing, not lethality). Past floor 6 the game itself asks for a few of
 * those, and he does exactly those (the notes at each floor).
 *
 * `weapon: 'skip'` is John exactly: Skip tutorial, which leaves the rusty
 * sword in the pack, Neutral and no spell. Nothing in his script wields the
 * sword, so he fights bare-handed (equipment.weapon is empty at floor 6). Any
 * rack weapon instead plays the tutorial and takes that pick and `spell`,
 * which is how the same road is measured for the builds the tutorial hands
 * out. A prestige starts the next run from a fresh state, so the pick does not
 * survive it: runs 2 and 3 below are the same kit whatever the first run took.
 *
 * `attentive` adds exactly one habit: he looks around a floor before fighting
 * on it and uses what the floor hands over (floor 3's side rooms read out:
 * every string anchor cut and the Archive's club in hand before the Hearing
 * Room). Comparing the two is how the floors' own answers are shown to be
 * worth picking up. Floor 2's answer is the tutor, whom both Johns visit:
 * the door is the first one off the hall and the lessons cost nothing.
 *
 * He reports; he never tunes. The judgement — how long a floor should take,
 * how often a boss may win — lives in tests/john.test.ts as the author's
 * expectations, and `npm run pacing` prints the whole table.
 *
 * THE ROAD PAST FLOOR 6 (`through` 7 to 20). The game's own rules make it
 * three runs, and John plays all three:
 *
 *   run 1  tutorial to floor 6, then prestige (the warchief opens it) and buy
 *          the Key to the City, the one boon the road needs.
 *   run 2  floors 1 to 6 again (the prestige reset them), the four wards of
 *          band 3 (floors 7 to 10, any order), then floor 11's stronghold:
 *          the steward's two repairs and the wave on the wall. Holding the
 *          wave ends the run unasked, an automatic prestige.
 *   run 3  floors 1 to 10 again, then the harbor (11 to 14), the festival
 *          (15 and 16), floor 17 and the desert (18 to 20). The stronghold
 *          only opens the harbor on a run after it was held.
 *
 * Walls. Every floor past 6 has a cap of game time (`floorCap`). A floor still
 * open at the cap is a wall: the report records `stuck` with what beat him,
 * and John takes a DEBUG SKIP (`debugSkipWall`), which is not a player action:
 * it writes the counters the floor's gate and clear read, pays no clear XP,
 * and the climb goes on with whatever level he has. Every segment played after
 * the first skip carries `skipBefore`, so a number measured past a wall reads
 * as such. A wall he met in run 2 is skipped without playing in run 3.
 *
 * Deterministic: everything rides the save's own seeded RNG; the prestiges
 * pass fixed seeds instead of the clock.
 */

/** Floor 2's corridor, in walking order: each stretch's budget opens the next. */
const HALL = ['f2_hall_1', 'f2_hall_2', 'f2_hall_3', 'f2_hall_4'];

/** Floor 3's stairwell, top down: each side room's plan opens the flight to `below`. */
const DESCENT = [
  { room: 'f3_mail_room', plan: 'flag:f3_stairs_1', below: 'f3_landing_2' },
  { room: 'f3_archive', plan: 'flag:f3_stairs_2', below: 'f3_landing_3' },
  { room: 'f3_annex', plan: 'flag:f3_stairs_3', below: null },
];

/** The stretches a climb is cut into, in the order they are played. */
export const SEGMENTS = [
  'tutorial', 'vermin', 'floor1', 'floor2', 'gate3', 'descent', 'floor3',
  // Band 2, run only with `through: 6` or more (docs/plans/bands-2-3.md).
  'floor4', 'gate5', 'floor5', 'gate6', 'floor6',
  // Run 2 (`through` 7 and up): floors 1 to 6 again, band 3's four wards in
  // the order `wards` gives (the ids name floors, not places in the order),
  // and floor 11's stronghold wall, whose hold ends the run.
  'reclimb2', 'floor7', 'floor8', 'floor9', 'floor10', 'siege',
  // Run 3: floors 1 to 10 again, then the harbor, the festival and the desert.
  'reclimb3', 'floor11', 'floor12', 'floor13', 'floor14',
  'floor15', 'floor16', 'floor17', 'floor18', 'floor19', 'floor20',
] as const;
export type ClimbSegment = (typeof SEGMENTS)[number];

export interface ClimbOptions {
  seed: number;
  /** The rack pick, or 'skip' for Skip tutorial (rusty sword, Neutral, no spell). */
  weapon: TutorialWeapon | 'skip';
  /** The tutorial's one-word spell: 'fire' | 'ice' | 'spark'. Unused on 'skip'. */
  spell?: string;
  attentive?: boolean;
  /** Give up after this many ticks of play. Default: two hours, 80 hours past floor 6. */
  budget?: number;
  /**
   * The last floor John climbs: 3 (band 1, the default), 6 (band 2 too) or
   * 7 to 20. 7 to 10 stop after those wards of run 2; 11 and up play the
   * stronghold and the third run too.
   */
  through?: number;
  /** Ticks of play one floor past 6 may take before it is a wall. Default: four hours. */
  floorCap?: number;
  /** After a wall, take the debug skip and measure on. False ends the climb at the first wall. Default true. */
  skipWalls?: boolean;
  /** The order of band 3's wards, by floor number. Default: ladder order. */
  wards?: number[];
  /** The harbor side John signs with: merchants, pirates, privateers or navy. Default: the first berth. */
  side?: string;
}

export interface FightRecord {
  /** Tick the fight ended. */
  at: number;
  ticks: number;
  spot: string;
  foes: string[];
  hpBefore: number;
  hpAfter: number;
  maxHp: number;
  /** The fight ended with John knocked out. */
  lost?: boolean;
  /** The foes' combined max HP at the start, and what they had left at the end (0 on a win). */
  foeMaxHp?: number;
  foeHpLeft?: number;
}

/** What a wall looked like when the cap ran out (floors past 6). */
export interface StuckRecord {
  /** Tick the cap ran out. */
  at: number;
  /** Ticks spent on the floor. */
  spent: number;
  /** Fights fought on the floor, and how many ended with John knocked out. */
  fights: number;
  lost: number;
  /** What knocked him out most often ("ph_bandit_thug L16"), where, and the mean foe level in those fights. */
  foe: string | null;
  spot: string | null;
  foeLevel: number | null;
  /** John's character level at the cap. */
  level: number;
  /** HP per second John took from the floor's foes, and the foes' HP per second he took off them, over every fight on the floor. */
  taken: number | null;
  dealt: number | null;
  /** True when the floor stayed shut for the whole cap; false when the script ran out of rules first. */
  wall: boolean;
  /** One line for the table: why the floor did not open. */
  why: string;
}

export interface ClimbReport {
  opts: Required<ClimbOptions>;
  /** Tick each segment finished on (cleared or skipped); null when the budget ran out first. */
  done: Record<ClimbSegment, number | null>;
  knockouts: Record<ClimbSegment, number>;
  /** The first walk into the toll collector's office. */
  firstBoss: { ticks: number; won: boolean } | null;
  bossAttempts: number;
  goldEarned: number;
  /** Character level when each segment finished (systems/levels.ts). */
  levels: Record<ClimbSegment, number | null>;
  /** Lifetime character-level XP at the end of the climb. */
  levelXp: number;
  /** Gold in hand when each segment finished. */
  gold: Record<ClimbSegment, number | null>;
  /** Fights started at the floor's boss spots, per segment (BOSSES): a try, won or lost. */
  bossTries: Record<ClimbSegment, number>;
  /** How many of those tries ended with John knocked out. */
  bossLost: Record<ClimbSegment, number>;
  /** Which run (1 first life, 2 after the first prestige, 3 after the stronghold) played each segment. */
  runs: Record<ClimbSegment, number | null>;
  /** Floors past 6 that did not open inside the cap, and what stopped John. */
  stuck: Partial<Record<ClimbSegment, StuckRecord>>;
  /** The first segment a debug skip ended; every segment after it is measured after skip. */
  firstSkip: ClimbSegment | null;
  /** The first debug skip before each segment (null: measured with none). */
  skipBefore: Record<ClimbSegment, ClimbSegment | null>;
  fights: FightRecord[];
  /** The save as the climb left it, for drivers that carry on from there. */
  state: GameState;
}

/** The office route the clerk's daybook gives (systems/floodedFloor.ts). */
const OFFICE_ROUTE = ['f1_scribe', 'f1_auditor', 'f1_break_room', 'f1_scribe', 'f1_toll_hall'];

/** Where John works for coin when a gate asks for more than he has. */
const JOB = { spot: 'the_rolls', via: 'chancery_arch', activity: 'job_copying' };

/** Game time John hunts a floor's den between boss tries, once a try has knocked him out. */
const GRIND = 6 * 60 * TPS;

/**
 * Where a try at a floor's boss starts, for `bossTries`. `foe` narrows it to
 * fights with that monster in them (the wall's waves, the dark room's early
 * fighters and the royale's survivors are not tries at the captain, the last
 * fighter or the champion).
 */
const BOSSES: Partial<Record<ClimbSegment, { spots: string[]; foe?: string }>> = {
  floor1: { spots: ['f1_toll_hall'] },
  floor3: { spots: ['f3_hearing_room'] },
  floor4: { spots: ['f4_ravine_floor'] },
  floor5: { spots: ['f5_back_door'] },
  floor6: { spots: ['f6_great_hall'] },
  floor7: { spots: ['f7_chiefs_tent', 'f7_burnt_camp'] },
  floor8: { spots: ['f8_lodge'] },
  floor9: { spots: ['f9_ossuary'] },
  floor10: { spots: ['f10_foundry'] },
  siege: { spots: ['f11_wall'], foe: 'ph_siege_captain' },
  floor14: { spots: ['f14_closed_port', 'f14_treasure_galleon', 'f14_flagship', 'f14_beast_lair'] },
  floor15: { spots: ['f15_dark_room'], foe: 'ph_room_last' },
  floor16: { spots: ['f16_arena'], foe: 'ph_survivor_champion' },
  floor17: { spots: ['f17_keeper'] },
  floor18: { spots: ['f18_forecourt'] },
  floor19: { spots: ['f19_door'] },
  floor20: { spots: ['f20_roadstead'] },
};

function gateValue(conds: UnlockCondition[] | undefined): number {
  const c = conds?.find((x) => x.type === 'stat' && x.key === 'gold:earned');
  return c && c.type === 'stat' ? c.value : 0;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function runJohn(options: ClimbOptions): ClimbReport {
  const through = options.through ?? 3;
  const opts: Required<ClimbOptions> = {
    spell: 'fire',
    attentive: false,
    budget: (through > 6 ? 80 : 2) * 3600 * TPS,
    floorCap: 4 * 3600 * TPS,
    skipWalls: true,
    wards: [7, 8, 9, 10],
    side: 'merchants',
    ...options,
    through,
  };
  const g = new Game(createInitialState(opts.seed));
  const s = g.state;
  const blank = <T>(v: T) => Object.fromEntries(SEGMENTS.map((k) => [k, v])) as Record<ClimbSegment, T>;
  const report: ClimbReport = {
    opts,
    done: blank(null),
    knockouts: blank(0),
    firstBoss: null,
    bossAttempts: 0,
    goldEarned: 0,
    levels: blank(null),
    levelXp: 0,
    gold: blank(null),
    bossTries: blank(0),
    bossLost: blank(0),
    runs: blank(null),
    stuck: {},
    firstSkip: null,
    skipBefore: blank(null),
    fights: [],
    state: s,
  };

  let t = 0;
  /** 1 the first life; each prestige starts the next. */
  let run = 1;
  /** A prestige's seed: fixed, so a climb repeats (Game.prestige defaults to the clock). */
  const runSeed = (n: number) => opts.seed * 1000 + n;
  let segment: ClimbSegment = 'tutorial';
  /** The tick the floor in play began, and the tick its cap ends. */
  let segStart = 0;
  let capEnd = Infinity;
  // Counted off the knocked-out state rather than the `defeat` event: a
  // condition that finishes you (a rot outlasting the fight, a poison on the
  // walk home) puts you down without a monster to name, and emits no defeat.
  let knockouts = 0;
  /** The stronghold's run as its last tick left it: the prestige that ends the run resets all of this. */
  let ended: { level: number; gold: number; run: number } | null = null;

  const maxHp = () => getDerivedStats(s).maxHp;
  let fightStart = 0;
  let fightHp = 0;
  let fightFoes: string[] = [];
  let fightFoeIds: string[] = [];
  let foeMax = 0;
  let foeLeft = 0;
  /** The segment whose boss the fight in progress is a try at, if it is one. */
  let fightBoss: ClimbSegment | null = null;
  const foeHp = () => sum((s.combat?.enemies ?? []).filter((m) => m !== null).map((m) => m!.hp));
  const tick = () => {
    // The stronghold ends the run unasked (Game.tick does this with the clock
    // for a seed); here the seed is fixed and the next run's counting starts.
    if (autoPrestigeDue(s)) {
      ended = { level: s.level, gold: s.gold, run };
      g.prestige(runSeed(run + 1));
      run++;
      g.leavePrestigeReview();
      t++;
      return;
    }
    const before = !!s.combat;
    const wasDown = s.recovering;
    g.tick();
    t++;
    if (!wasDown && s.recovering) {
      knockouts++;
      report.knockouts[segment]++;
    }
    const after = !!s.combat;
    if (!before && after) {
      fightStart = t;
      fightHp = s.resources.hp;
      const foes = s.combat!.enemies.filter((m) => m !== null);
      fightFoes = foes.map((m) => `${m!.defId} L${m!.level}`);
      fightFoeIds = foes.map((m) => m!.defId);
      foeMax = sum(foes.map((m) => statsFromAttrs(m!.attrs).maxHp));
      foeLeft = foeMax;
      const boss = BOSSES[segment];
      fightBoss = null;
      if (boss && boss.spots.includes(s.spot) && (!boss.foe || fightFoeIds.includes(boss.foe))) {
        fightBoss = segment;
        report.bossTries[segment]++;
      }
    } else if (after) {
      foeLeft = foeHp();
    } else if (before) {
      const lost = !wasDown && s.recovering;
      if (lost && fightBoss) report.bossLost[fightBoss]++;
      report.fights.push({
        at: t,
        ticks: t - fightStart,
        spot: s.spot,
        foes: fightFoes,
        hpBefore: Math.round(fightHp),
        hpAfter: Math.round(s.resources.hp),
        maxHp: Math.round(maxHp()),
        lost,
        foeMaxHp: Math.round(foeMax),
        foeHpLeft: lost ? Math.round(foeLeft) : 0,
      });
    }
  };
  const outOfTime = () => t >= opts.budget || t >= capEnd;
  const until = (done: () => boolean, max = opts.budget) => {
    for (let i = 0; !done() && i < max && !outOfTime(); i++) tick();
    return done();
  };
  const walk = (spot: string) => {
    // A forced arrival (a boarding) starts a fight that cannot be fled and
    // cuts a multi-stop route short: fight it out, then set out again.
    for (let leg = 0; leg < 8 && s.spot !== spot && !outOfTime(); leg++) {
      if (s.combat?.forced) until(() => !s.combat, 5 * 60 * TPS);
      if (!(g.travelTo(spot) || g.travelPlanTo(spot))) return false;
      until(() => !s.travel && s.travelPlan.length === 0, 10 * 60 * TPS);
    }
    return s.spot === spot;
  };
  /** Rest to full wherever John stands, if the spot offers a bed. */
  const restUp = () => {
    const bed = SPOTS[s.spot]?.activities.find((a) => a.kind === 'rest');
    if (!bed) return;
    g.selectActivity(bed.id);
    until(() => !s.recovering && s.resources.hp >= maxHp() * 0.98, 10 * 60 * TPS);
  };
  /**
   * Do `activity` at `spot` until `goal`, coming back after every knockout —
   * rested first, because the haven it wakes in has a bed.
   */
  const persist = (spot: string, activity: string | null, goal: () => boolean) => {
    while (!goal() && !outOfTime()) {
      if (s.spot !== spot) {
        restUp();
        if (!walk(spot)) return false;
      }
      if (activity) g.selectActivity(activity);
      const k0 = knockouts;
      const t0 = t;
      // An activity a forced fight cleared (a boarding) is picked up again.
      until(() => goal() || knockouts > k0 || s.spot !== spot || (!!activity && t > t0 && !s.activity));
    }
    return goal();
  };
  const stat = (key: string) => s.stats[key] ?? 0;
  const earned = () => stat('gold:earned');
  const wield = (defId: string) => {
    const item = s.inventory.find((i) => i.defId === defId);
    if (item) g.equip(item.uid, 'weapon');
  };
  /** Climb to a floor, working the job in Threshold first if its gate wants coin. */
  const climbTo = (floorId: string) => {
    if (!g.climbTo(floorId)) {
      g.climbTo(null);
      until(() => !s.travel, 60 * TPS);
      walk(JOB.via);
      persist(JOB.spot, JOB.activity, () => earned() >= gateValue(FLOORS[floorId].gate));
      walk('ascent_foot');
      if (!g.climbTo(floorId)) return false;
    }
    until(() => !s.travel, 60 * TPS);
    return s.spot === FLOORS[floorId].landing;
  };
  /** Close a segment of the first life and open the next. */
  const record = (seg: ClimbSegment) => {
    const at = seg === 'siege' && ended ? ended : { level: s.level, gold: s.gold, run };
    report.done[seg] = t;
    report.levels[seg] = at.level;
    report.gold[seg] = at.gold;
    report.runs[seg] = at.run;
    report.skipBefore[seg] = report.firstSkip;
  };
  const mark = (seg: ClimbSegment, next: ClimbSegment) => {
    // A replay (runs 2 and 3 climb floors 1 to 6 again) reports as one segment.
    if (run > 1) return;
    record(seg);
    segment = next;
  };
  // A floor starts fogged: the route planner only knows rooms John has stood
  // next to, so he walks a new floor in order, the way a player would.
  const scout = (route: string[]) => route.every((spot) => walk(spot));

  // ---- Floor 0: skipped outright, or played with its three choices made. ----
  if (opts.weapon === 'skip') {
    g.skipTutorial();
  } else {
    g.chooseTutorialWeapon(opts.weapon, false);
    g.chooseTutorialStance('neutral');
    walk('f0_cellblock');
    persist('f0_cellblock', 'hunt', () => stat('fights:f0_cellblock') >= (SPOTS.f0_cellblock.fightLimit ?? 1));
    walk('f0_field');
    g.chooseTutorialSpell(opts.spell);
    persist('f0_field', 'hunt', () => stat('fights:f0_field') >= (SPOTS.f0_field.fightLimit ?? 1));
    walk('f0_gate');
    walk('ascent_foot');
  }
  if (s.spot !== 'ascent_foot') return finish();
  mark('tutorial', 'vermin');

  /**
   * Floors 1 to 6, from the Foot. False when John ran out of time or the climb
   * is over (`through` reached on the first life). Runs again, unmarked, after
   * each prestige: the reset puts every floor back.
   */
  function lowerBands(): boolean {
    // ---- Floor 1: vermin, records, the office key, the route, the collector. ----
    if (!climbTo('ascent_f1')) return false;
    if (!persist('f1_storerooms', 'hunt', () => stat('fights:f1_storerooms') >= SPOTS.f1_storerooms.fightLimit!)) return false;
    mark('vermin', 'floor1');
    walk('f1_bonded_deep');
    persist('f1_archive', 'search', () => hasKeyItem(s, 'toll_clerk_book'));
    walk('f1_bonded_deep');
    walk('f1_forms');
    persist('f1_reception', 'explore_reception', () => hasKeyItem(s, 'toll_office_key'));
    for (let tries = 0; stat('boss:f1_toll_hall') < 1 && !outOfTime() && tries < 20; tries++) {
      // The office door says it is a fight that cannot be fled; John heals
      // before it, at the floor's only bed.
      walk('f1_landing');
      restUp();
      walk('f1_reception');
      for (const room of OFFICE_ROUTE) walk(room);
      if (run === 1) report.bossAttempts++;
      const t0 = t;
      until(() => !s.combat);
      if (run === 1) report.firstBoss ??= { ticks: t - t0, won: stat('boss:f1_toll_hall') >= 1 };
    }
    if (stat('boss:f1_toll_hall') < 1) return false;
    mark('floor1', 'floor2');

    // ---- Floor 2: the Long Hall. The tutor's door is the first one off the
    // hall, so even John walks in; the lessons are free. Then four stretches. ----
    if (!climbTo('ascent_f2')) return false;
    walk('f2_gym');
    for (const lesson of NPCS.hall_tutor.teaches ?? []) {
      if ('technique' in lesson) g.learnFromTeacher('hall_tutor', lesson.technique);
    }
    for (const stretch of HALL) {
      if (!persist(stretch, 'hunt', () => stat(`fights:${stretch}`) >= SPOTS[stretch].fightLimit!)) return false;
    }
    // The break room's cupboards, on the way out: most of the floor's coin.
    const breakFinds = SPOTS.f2_break_room.finds?.length ?? 0;
    persist('f2_break_room', 'explore_f2', () => (s.finds.f2_break_room ?? []).length >= breakFinds);
    mark('floor2', 'gate3');

    // ---- The third floor's gate, then the descent and the Hearing Room. ----
    if (!climbTo('ascent_f3')) return false;
    mark('gate3', 'descent');
    for (const { room, plan, below } of DESCENT) {
      // Each side room's floor plan opens the next flight. John stops reading
      // once he has it; attentive John reads the room out first (a string
      // anchor, the coin, the club) — the bureaucrat's preparation.
      if (!persist(room, 'search_room', () => stat(plan) >= 1)) return false;
      if (opts.attentive) {
        const finds = SPOTS[room].finds?.length ?? 0;
        persist(room, 'search_room', () => (s.finds[room] ?? []).length >= finds);
      }
      // The landing below holds a small fight budget on the way down.
      if (below && SPOTS[below].fightLimit) {
        if (!persist(below, 'hunt', () => stat(`fights:${below}`) >= SPOTS[below].fightLimit!)) return false;
      }
    }
    if (opts.attentive && s.equipment.weapon?.defId !== 'oak_club') wield('oak_club');
    mark('descent', 'floor3');
    // The Hearing Room forces its one fight on arrival.
    if (!persist('f3_hearing_room', 'hunt', () => stat('slain:f3_hearing_room:puppet_bureaucrat') >= 1)) return false;
    mark('floor3', opts.through >= 4 ? 'floor4' : 'floor3');
    if (run === 1 && opts.through < 4) return false;

    // ---- Band 2 (bands-2-3.md). Every hunt is endless, so John grinds where the
    // goblins are until the next gate's kill count is met, then takes the boss.
    const goblins = () => stat('kills:tag:goblin');
    const GATE5 = FLOORS.ascent_f5.gate?.find((c) => c.type === 'stat')?.value ?? 0;
    const GATE6 = FLOORS.ascent_f6.gate?.find((c) => c.type === 'stat')?.value ?? 0;
    if (!climbTo('ascent_f4')) return false;
    // The raid parties in the deep woods pay floor 5's gate and the levels the
    // raid leader asks for, in the same hunt.
    if (!scout(['f4_woods_edge', 'f4_deep_woods'])) return false;
    if (!persist('f4_deep_woods', 'hunt', () => goblins() >= GATE5)) return false;
    if (!scout(['f4_ravine_rim', 'f4_ravine_floor'])) return false;
    if (!persist('f4_ravine_floor', 'hunt', () => stat('slain:f4_ravine_floor:goblin_raid_leader') >= 1)) return false;
    mark('floor4', 'gate5');

    if (!climbTo('ascent_f5')) return false;
    mark('gate5', 'floor5');
    if (!scout(['f5_bog', 'f5_cave_mouth', 'f5_hollows'])) return false;
    if (!persist('f5_hollows', 'explore', () => stat('flag:f5_back_door') >= 1)) return false;
    if (!persist('f5_back_door', 'hunt', () => stat('slain:f5_back_door:hobgoblin_champion') >= 1)) return false;
    mark('floor5', 'gate6');

    // Floor 6's gate: goblins at the drowned village, firetongues counted too.
    if (!scout(['f5_cave_mouth', 'f5_bog', 'f5_drowned_village'])) return false;
    if (!persist('f5_drowned_village', 'hunt', () => goblins() >= GATE6)) return false;
    if (!climbTo('ascent_f6')) return false;
    mark('gate6', 'floor6');
    if (!scout(['f6_tunnels'])) return false;
    if (opts.attentive) {
      // The three sabotages, each a level off the warchief.
      for (const room of ['f6_pens', 'f6_kitchens', 'f6_shrine']) {
        const finds = SPOTS[room].finds?.length ?? 0;
        if (!persist(room, 'explore', () => (s.finds[room] ?? []).length >= finds)) return false;
      }
    }
    if (!scout(['f6_shrine', 'f6_drop'])) return false;
    if (!persist('f6_great_hall', 'hunt', () => stat('slain:f6_great_hall:goblin_warchief') >= 1)) return false;
    mark('floor6', 'floor6');
    return !(run === 1 && opts.through < 7);
  }

  if (!lowerBands()) return finish();

  // ---- The first prestige: the warchief opened it. John buys the one boon the
  // road needs, the Key to the City (3 of the harvest's points), and nothing
  // else: every other boon is headroom, as every optional system is. ----
  if (!g.prestige(runSeed(2))) return finish();
  run = 2;
  g.buyBoon('city_key');
  g.leavePrestigeReview();
  segment = 'reclimb2';
  segStart = t;
  if (!lowerBands()) return finish();
  record('reclimb2');

  // ---- Floor-level machinery for everything past floor 6. ----

  /** Settle what the last floor left: a knockout slept off, a fight that cannot be fled finished. */
  const settle = () => {
    if (s.combat?.forced) until(() => !s.combat, 5 * 60 * TPS);
    if (s.recovering) {
      restUp();
      until(() => !s.recovering, 10 * 60 * TPS);
    }
  };
  /**
   * DEBUG SKIP, not a player action. Writes the counters the floor's gate and
   * clear read and stamps its clear XP as paid, so the climb can go on past a
   * wall with the level John actually has. Every later segment is then
   * "measured after skip".
   */
  const debugSkipWall = (floorId: string) => {
    for (const c of [...(FLOORS[floorId].gate ?? []), ...(FLOORS[floorId].clear ?? [])]) {
      if (c.type === 'stat') s.stats[c.key] = Math.max(s.stats[c.key] ?? 0, c.value);
    }
    s.stats[floorXpKey(floorId)] = 1;
    checkFloorClears(s, g.bus);
  };
  /** What the floor looked like when the cap ran out, from the fights since it began. */
  const diagnose = (why: string, wall: boolean): StuckRecord => {
    const fights = report.fights.filter((f) => f.at > segStart);
    const lost = fights.filter((f) => f.lost);
    const tally = new Map<string, number>();
    for (const f of lost) for (const foe of f.foes) tally.set(foe, (tally.get(foe) ?? 0) + 1);
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const spots = new Map<string, number>();
    for (const f of lost) spots.set(f.spot, (spots.get(f.spot) ?? 0) + 1);
    const where = [...spots.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const levels = lost.flatMap((f) => f.foes.map((x) => Number(x.split(' L')[1])));
    const secs = sum(fights.map((f) => f.ticks)) / TPS;
    return {
      at: t,
      spent: t - segStart,
      fights: fights.length,
      lost: lost.length,
      foe: top,
      spot: where,
      foeLevel: levels.length ? Math.round(sum(levels) / levels.length) : null,
      level: s.level,
      taken: secs > 0 ? Math.round((sum(fights.map((f) => f.hpBefore - f.hpAfter)) / secs) * 10) / 10 : null,
      dealt: secs > 0 ? Math.round((sum(fights.map((f) => (f.foeMaxHp ?? 0) - (f.foeHpLeft ?? 0))) / secs) * 10) / 10 : null,
      wall,
      why,
    };
  };
  /**
   * Run `step` until `goal` holds, the clock runs out, or a pass spends no
   * time at all (a walk that is refused would otherwise spin forever).
   */
  const repeat = (goal: () => boolean, step: () => void) => {
    while (!goal() && !outOfTime()) {
      const t0 = t;
      step();
      if (t === t0) break;
    }
  };
  /**
   * Play one floor of run 2 or 3 inside its cap: climb to it, `work` it, and
   * close the segment when its clear (or `goal`) holds. A floor still open at
   * the cap is a wall: record it, take the debug skip (`skip` when the floor's
   * clear is not its own counters) and report whether the climb goes on.
   * `replay` is a floor John already played in run 2: no record, and a floor
   * that was a wall then is skipped without playing. `ride: false` leaves the
   * climb to `work` (the festival's ladder rules are its own). `prep` is work
   * the floor's gate asks for, done before the climb and inside the cap.
   */
  const attempt = (
    seg: ClimbSegment,
    floorId: string,
    work: () => void,
    o: { goal?: () => boolean; skip?: () => void; prep?: () => void; replay?: boolean; ride?: boolean } = {},
  ): boolean => {
    const goal = o.goal ?? (() => clearMet(s, FLOORS[floorId]));
    const skip = o.skip ?? (() => debugSkipWall(floorId));
    if (o.replay && report.stuck[seg]) {
      skip();
      return true;
    }
    if (!o.replay) segment = seg;
    segStart = t;
    capEnd = t + opts.floorCap;
    settle();
    o.prep?.();
    const entered = goal() || o.ride === false || climbTo(floorId);
    // A pass that ends early (a knockout moved him, a route was refused) is
    // taken up again until the floor opens, the cap runs out, or a pass does nothing.
    if (entered) repeat(goal, work);
    const capped = t >= capEnd;
    capEnd = Infinity;
    if (goal()) {
      if (!o.replay) record(seg);
      return true;
    }
    if (t >= opts.budget) return false;
    if (o.replay) {
      skip();
      return true;
    }
    const why = !entered
      ? 'the climb was refused (the floor gate is unmet)'
      : capped
        ? `open at the ${Math.round(opts.floorCap / TPS / 3600)} h cap`
        : 'the script stopped with the floor open (no rule left to try; not a measured wall)';
    report.stuck[seg] = diagnose(why, capped);
    if (!opts.skipWalls) return false;
    // Recorded as the floor stood, before the skip: the stronghold's skip
    // ends the run, and the prestige resets the level and the gold.
    record(seg);
    report.firstSkip ??= seg;
    skip();
    return true;
  };
  /**
   * Work a floor's keeper: walk in, fight, and after every knockout hunt the
   * den for a while before the next try, as a player who lost goes and levels.
   * The first try is made at once, with the level John arrived at.
   */
  const keeperLoop = (den: string, keeper: string, goal: () => boolean) =>
    repeat(goal, () => {
      const k0 = knockouts;
      persist(keeper, 'hunt', () => goal() || knockouts > k0);
      if (goal() || outOfTime()) return;
      restUp();
      const end = t + GRIND;
      persist(den, 'hunt', () => goal() || t >= end);
    });

  // ---- Band 3: the four wards (floors 7 to 10), in the order `wards` gives. ----
  // Each ward is worked as a floor of its own: the fights its form asks for,
  // then the keeper, with the district's patrol as the den. John reads the
  // ward's position (how many other wards are cleared) when he starts and
  // again each time a knockout sends him back.
  const wardWork: Record<number, () => void> = {
    7: () => {
      const done = () => clearMet(s, FLOORS.ascent_f7);
      const pos = () => stat('band:pos:ascent_f7');
      repeat(done, () => {
        const at = pos();
        const same = () => done() || pos() !== at;
        if (at === 0) {
          // The merchant road: twelve fights of two to four bandits.
          if (scout(['f7_merchant_road'])) persist('f7_merchant_road', 'hunt', same);
        } else if (at <= 2) {
          // The salt-flats camp: the stockade, the watchtowers, then the chief.
          // Another ward falling changes the form: the pass ends and the next one reads the position again.
          const fought = (spot: string, n: number) => persist(spot, 'hunt', () => same() || stat(`fights:${spot}`) >= n) && !same();
          if (!scout(['f7_stockade']) || !fought('f7_stockade', 4)) return;
          if (!scout(['f7_watchtowers']) || !fought('f7_watchtowers', 3)) return;
          if (scout(['f7_chiefs_tent'])) keeperLoop('f7_docks', 'f7_chiefs_tent', same);
        } else {
          // The demon in the burnt camp. Its window (24 in-game hours) runs
          // out on its own, so this ward cannot stay shut.
          if (scout(['f7_burnt_camp'])) keeperLoop('f7_docks', 'f7_burnt_camp', same);
        }
      });
    },
    8: () => {
      if (scout(['f8_old_forest', 'f8_lodge'])) keeperLoop('f8_old_forest', 'f8_lodge', () => clearMet(s, FLOORS.ascent_f8));
    },
    9: () => {
      if (scout(['f9_barrow_fields', 'f9_ossuary'])) keeperLoop('f9_barrow_fields', 'f9_ossuary', () => clearMet(s, FLOORS.ascent_f9));
    },
    10: () => {
      if (scout(['f10_quarry', 'f10_foundry'])) keeperLoop('f10_quarry', 'f10_foundry', () => clearMet(s, FLOORS.ascent_f10));
    },
  };
  /** `through` 7 to 9 stops after those wards; 10 and up plays all four. */
  const wardsFor = () => (opts.through >= 10 ? opts.wards : opts.wards.filter((n) => n <= opts.through));
  const playWards = (replay: boolean): boolean => {
    for (const n of wardsFor()) {
      if (!attempt(`floor${n}` as ClimbSegment, `ascent_f${n}`, wardWork[n], { replay })) return false;
    }
    return true;
  };
  if (!playWards(false)) return finish();
  if (opts.through <= 10) return finish();

  // ---- Floor 11 on the first climb: the stronghold. The steward's two repairs
  // (the game asks for them: timber and scrap for the gate; ten raiders and
  // four iron ingots, smelted at the Forges in Threshold, for the wall), then
  // eight fights on the wall. Holding the wave ends the run unasked. ----
  const siegeWork = () => {
    const toGatehouse = () => scout(['f11_gatehouse']);
    const take = (id: string) => {
      if (toGatehouse()) g.acceptQuest(id);
    };
    const handIn = (id: string) => {
      if (toGatehouse()) g.turnInQuest(id);
    };
    // The gate: twenty hardwood from the yard, fifteen iron scrap from the raiders on the road.
    take('f11_shore_up_the_gate');
    if (scout(['f11_yard'])) persist('f11_yard', 'gather_f11_timber', () => (s.materials.hardwood ?? 0) >= 20);
    persist('f11_road', 'hunt', () => (s.materials.iron_scrap ?? 0) >= 15);
    handIn('f11_shore_up_the_gate');
    // The wall: ten raiders, and the scrap for four ingots (three each).
    take('f11_arm_the_wall');
    const raiders = () => (s.quests.f11_arm_the_wall ? objectiveProgress(s, QUESTS.f11_arm_the_wall, 0).current : 0);
    persist('f11_road', 'hunt', () => raiders() >= 10 && (s.materials.iron_scrap ?? 0) + 3 * (s.materials.iron_ingot ?? 0) >= 12);
    if (raiders() < 10) return;
    // The ingots are smelted at the Forges, down in Threshold.
    g.climbTo(null);
    until(() => !s.travel, 60 * TPS);
    if (!walk('the_forges')) return;
    persist('the_forges', 'craft_iron_ingot', () => (s.materials.iron_ingot ?? 0) >= 4);
    if (!climbTo('ascent_f11')) return;
    handIn('f11_arm_the_wall');
    if (s.quests.f11_arm_the_wall?.status !== 'done') return;
    if (scout(['f11_yard', 'f11_wall'])) persist('f11_wall', 'hunt', () => s.prestige.stronghold);
  };
  const siegeSkip = () => {
    s.stats['fights:f11_wall'] = STRONGHOLD_WAVE;
    tick();
  };
  if (!attempt('siege', 'ascent_f11', siegeWork, { goal: () => s.prestige.stronghold, skip: siegeSkip })) return finish();
  if (run !== 3) return finish();

  // ---- Run 3: floors 1 to 10 again. A ward that was a wall in run 2 is skipped. ----
  segment = 'reclimb3';
  segStart = t;
  if (!lowerBands()) return finish();
  if (!playWards(true)) return finish();
  record('reclimb3');

  // ---- The harbor (floors 11 to 14). ----
  const side = SEA_SIDES[opts.side];
  /** Sign with the side: accepting its join quest at its berth is the pick. */
  const sign = () => {
    if (stat(acceptedKey(side.joinQuest)) >= 1) return;
    if (scout(['f11_quay', NPCS[side.giver].spotId])) g.acceptQuest(side.joinQuest);
  };
  /**
   * Floors 11 to 13 clear on crates won (any water, cumulative over the run)
   * and a fight won on the floor's last water, so John works that water: the
   * convoy sails past it and he is present. He fights what the water sends.
   */
  const water = (floorId: string, spot: string, route: string[]) => () => {
    if (scout(route)) persist(spot, 'hunt', () => clearMet(s, FLOORS[floorId]));
  };
  const harbor: Record<number, () => void> = {
    11: () => {
      sign();
      water('ascent_f11', 'f11_roadstead', ['f11_quay', 'f11_roadstead'])();
    },
    12: water('ascent_f12', 'f12_far_water', ['f12_strait', 'f12_isle', 'f12_far_water']),
    // Through the picket line: the pilot's channel costs a purchase.
    13: water('ascent_f13', 'f13_blockade', ['f13_picket', 'f13_blockade']),
    // The side's wing: the approach is the den, the mission boss the keeper.
    14: () => {
      const boss = side.mission.spot;
      const approach = Object.values(SPOTS).find((x) => x.areaId === FLOORS.ascent_f14.areaId && x.connections.some((c) => c.to === boss))!;
      if (scout([approach.id, boss])) keeperLoop(approach.id, boss, () => clearMet(s, FLOORS.ascent_f14));
    },
  };
  for (let n = 11; n <= 14 && n <= opts.through; n++) {
    if (!attempt(`floor${n}` as ClimbSegment, `ascent_f${n}`, harbor[n])) return finish();
  }
  if (opts.through <= 14) return finish();

  // ---- The festival (floors 15 and 16). One attempt runs from the dark room to
  // the end of the royale; a lost one shuts both floors for three world days.
  // John's rules: no preparation in the hall (he rides up to the royale the
  // day the door opens), the default strategy plan, no hub activity. ----
  const festivalRun = () => s.festival?.run;
  const attemptFestival = (upTo: 15 | 16) => {
    // An open door (the dark room won, the hall reached) is the way up to the royale.
    if (!(upTo === 16 && festivalRun()?.phase === 'prep')) {
      if (lockoutLeft(s) > 0) {
        settle();
        until(() => lockoutLeft(s) === 0);
      }
      if (!g.climbTo('ascent_f15')) return;
      until(() => !s.travel, 60 * TPS);
      until(() => !festivalRun() || festivalRun()!.phase !== 'dark');
    }
    if (upTo === 15 || !festivalRun()) return;
    if (!g.climbTo('ascent_f16')) return;
    until(() => !s.travel, 60 * TPS);
    until(() => !festivalRun());
  };
  for (const n of [15, 16] as const) {
    if (n > opts.through) return finish();
    const floorId = `ascent_f${n}`;
    const work = () => repeat(() => clearMet(s, FLOORS[floorId]), () => attemptFestival(n));
    if (!attempt(`floor${n}`, floorId, work, { ride: false })) return finish();
  }
  if (opts.through <= 16) return finish();

  // ---- Floor 17 and the desert (18 to 20). Desert gates are kill counts. ----
  const desert = () => stat('kills:tag:desert');
  const gateKills = (floorId: string) => {
    const c = FLOORS[floorId].gate?.find((x) => x.type === 'stat');
    return c && c.type === 'stat' ? c.value : 0;
  };
  const desertFloors: Record<number, { work: () => void; prep?: () => void }> = {
    17: { work: () => scout(['f17_keeper']) && keeperLoop('f17_landing', 'f17_keeper', () => clearMet(s, FLOORS.ascent_f17)) },
    18: {
      work: () => {
        if (scout(['f18_first_obelisk', 'f18_dune_den', 'f18_second_obelisk', 'f18_tomb_row', 'f18_third_obelisk', 'f18_forecourt'])) {
          keeperLoop('f18_dune_den', 'f18_forecourt', () => clearMet(s, FLOORS.ascent_f18));
        }
      },
    },
    19: {
      // Floor 19's gate: sixty desert kills, hunted at floor 18's den.
      prep: () => {
        if (scout(['f18_dune_den'])) persist('f18_dune_den', 'hunt', () => desert() >= gateKills('ascent_f19'));
      },
      work: () => {
        if (scout(['f19_entrance', 'f19_gallery', 'f19_chamber', 'f19_door'])) {
          keeperLoop('f19_gallery', 'f19_door', () => clearMet(s, FLOORS.ascent_f19));
        }
      },
    },
    20: {
      // Floor 20's gate: a hundred and fifty, hunted in floor 19's valley.
      prep: () => {
        if (scout(['f19_causeway', 'f19_valley'])) persist('f19_valley', 'hunt', () => desert() >= gateKills('ascent_f20'));
      },
      work: () => {
        if (scout(['f20_quay', 'f20_roadstead'])) keeperLoop('f20_river_road', 'f20_roadstead', () => clearMet(s, FLOORS.ascent_f20));
      },
    },
  };
  for (let n = 17; n <= opts.through; n++) {
    if (!attempt(`floor${n}` as ClimbSegment, `ascent_f${n}`, desertFloors[n].work, { prep: desertFloors[n].prep })) return finish();
  }
  return finish();

  function finish(): ClimbReport {
    report.goldEarned = earned();
    report.levelXp = Math.round(xpToReach(s.level) + s.levelXp);
    return report;
  }
}

/** Seconds, for reading. */
export const secs = (ticks: number | null): number | null => (ticks === null ? null : Math.round(ticks / TPS));
