import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { TPS } from '../src/core/engine/loop';
import { getDerivedStats } from '../src/core/systems/derived';
import { hasKeyItem } from '../src/core/systems/keyitems';
import { xpToReach } from '../src/core/systems/levels';
import { FLOORS, NPCS, SPOTS } from '../src/core/registry';
import type { TutorialWeapon, UnlockCondition } from '../src/core/types';

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
 * pacing, not lethality).
 *
 * `weapon: 'skip'` is John exactly: Skip tutorial, which leaves the rusty
 * sword, Neutral and no spell. Any rack weapon instead plays the tutorial and
 * takes that pick and `spell`, which is how the same road is measured for the
 * builds the tutorial hands out.
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
 * Deterministic: everything rides the save's own seeded RNG.
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
export const SEGMENTS = ['tutorial', 'vermin', 'floor1', 'floor2', 'gate3', 'descent', 'floor3'] as const;
export type ClimbSegment = (typeof SEGMENTS)[number];

export interface ClimbOptions {
  seed: number;
  /** The rack pick, or 'skip' for Skip tutorial (rusty sword, Neutral, no spell). */
  weapon: TutorialWeapon | 'skip';
  /** The tutorial's one-word spell: 'fire' | 'ice' | 'spark'. Unused on 'skip'. */
  spell?: string;
  attentive?: boolean;
  /** Give up after this many ticks of play. Default: two hours. */
  budget?: number;
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
}

export interface ClimbReport {
  opts: Required<ClimbOptions>;
  /** Tick each segment finished on; null when the budget ran out first. */
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
  fights: FightRecord[];
}

/** The office route the clerk's daybook gives (systems/floodedFloor.ts). */
const OFFICE_ROUTE = ['f1_scribe', 'f1_auditor', 'f1_break_room', 'f1_scribe', 'f1_toll_hall'];

/** Where John works for coin when a gate asks for more than he has. */
const JOB = { spot: 'the_rolls', via: 'chancery_arch', activity: 'job_copying' };

function gateValue(conds: UnlockCondition[] | undefined): number {
  const c = conds?.find((x) => x.type === 'stat' && x.key === 'gold:earned');
  return c && c.type === 'stat' ? c.value : 0;
}

export function runJohn(options: ClimbOptions): ClimbReport {
  const opts: Required<ClimbOptions> = { spell: 'fire', attentive: false, budget: 2 * 3600 * TPS, ...options };
  const g = new Game(createInitialState(opts.seed));
  const s = g.state;
  const report: ClimbReport = {
    opts,
    done: Object.fromEntries(SEGMENTS.map((k) => [k, null])) as ClimbReport['done'],
    knockouts: Object.fromEntries(SEGMENTS.map((k) => [k, 0])) as ClimbReport['knockouts'],
    firstBoss: null,
    bossAttempts: 0,
    goldEarned: 0,
    levels: Object.fromEntries(SEGMENTS.map((k) => [k, null])) as ClimbReport['levels'],
    levelXp: 0,
    fights: [],
  };

  let t = 0;
  let segment: ClimbSegment = 'tutorial';
  // Counted off the knocked-out state rather than the `defeat` event: a
  // condition that finishes you (a rot outlasting the fight, a poison on the
  // walk home) puts you down without a monster to name, and emits no defeat.
  let knockouts = 0;

  const maxHp = () => getDerivedStats(s).maxHp;
  let fightStart = 0;
  let fightHp = 0;
  let fightFoes: string[] = [];
  const tick = () => {
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
      fightFoes = s.combat!.enemies.filter((m) => m !== null).map((m) => `${m!.defId} L${m!.level}`);
    } else if (before && !after) {
      report.fights.push({
        at: t,
        ticks: t - fightStart,
        spot: s.spot,
        foes: fightFoes,
        hpBefore: Math.round(fightHp),
        hpAfter: Math.round(s.resources.hp),
        maxHp: Math.round(maxHp()),
      });
    }
  };
  const outOfTime = () => t >= opts.budget;
  const until = (done: () => boolean, max = opts.budget) => {
    for (let i = 0; !done() && i < max && !outOfTime(); i++) tick();
    return done();
  };
  const walk = (spot: string) => {
    if (s.spot === spot) return true;
    if (!(g.travelTo(spot) || g.travelPlanTo(spot))) return false;
    until(() => !s.travel && s.travelPlan.length === 0, 10 * 60 * TPS);
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
      until(() => goal() || knockouts > k0 || s.spot !== spot);
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
  const mark = (seg: ClimbSegment, next: ClimbSegment) => {
    report.done[seg] = t;
    report.levels[seg] = s.level;
    segment = next;
  };

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

  // ---- Floor 1: vermin, records, the office key, the route, the collector. ----
  if (!climbTo('ascent_f1')) return finish();
  if (!persist('f1_storerooms', 'hunt', () => stat('fights:f1_storerooms') >= SPOTS.f1_storerooms.fightLimit!)) return finish();
  mark('vermin', 'floor1');
  walk('f1_bonded_deep');
  persist('f1_archive', 'search', () => hasKeyItem(s, 'toll_clerk_book'));
  walk('f1_bonded_deep');
  walk('f1_forms');
  persist('f1_reception', 'explore_reception', () => hasKeyItem(s, 'toll_office_key'));
  while (stat('boss:f1_toll_hall') < 1 && !outOfTime() && report.bossAttempts < 20) {
    // The office door says it is a fight that cannot be fled; John heals
    // before it, at the floor's only bed.
    walk('f1_landing');
    restUp();
    walk('f1_reception');
    for (const room of OFFICE_ROUTE) walk(room);
    report.bossAttempts++;
    const t0 = t;
    until(() => !s.combat);
    report.firstBoss ??= { ticks: t - t0, won: stat('boss:f1_toll_hall') >= 1 };
  }
  if (stat('boss:f1_toll_hall') < 1) return finish();
  mark('floor1', 'floor2');

  // ---- Floor 2: the Long Hall. The tutor's door is the first one off the
  // hall, so even John walks in; the lessons are free. Then four stretches. ----
  if (!climbTo('ascent_f2')) return finish();
  walk('f2_gym');
  for (const lesson of NPCS.hall_tutor.teaches ?? []) g.learnFromTeacher('hall_tutor', lesson.technique);
  for (const stretch of HALL) {
    if (!persist(stretch, 'hunt', () => stat(`fights:${stretch}`) >= SPOTS[stretch].fightLimit!)) return finish();
  }
  // The break room's cupboards, on the way out: most of the floor's coin.
  const breakFinds = SPOTS.f2_break_room.finds?.length ?? 0;
  persist('f2_break_room', 'explore_f2', () => (s.finds.f2_break_room ?? []).length >= breakFinds);
  mark('floor2', 'gate3');

  // ---- The third floor's gate, then the descent and the Hearing Room. ----
  if (!climbTo('ascent_f3')) return finish();
  mark('gate3', 'descent');
  for (const { room, plan, below } of DESCENT) {
    // Each side room's floor plan opens the next flight. John stops reading
    // once he has it; attentive John reads the room out first (a string
    // anchor, the coin, the club) — the bureaucrat's preparation.
    if (!persist(room, 'search_room', () => stat(plan) >= 1)) return finish();
    if (opts.attentive) {
      const finds = SPOTS[room].finds?.length ?? 0;
      persist(room, 'search_room', () => (s.finds[room] ?? []).length >= finds);
    }
    // The landing below holds a small fight budget on the way down.
    if (below && SPOTS[below].fightLimit) {
      if (!persist(below, 'hunt', () => stat(`fights:${below}`) >= SPOTS[below].fightLimit!)) return finish();
    }
  }
  if (opts.attentive && s.equipment.weapon?.defId !== 'oak_club') wield('oak_club');
  mark('descent', 'floor3');
  // The Hearing Room forces its one fight on arrival.
  if (!persist('f3_hearing_room', 'hunt', () => stat('slain:f3_hearing_room:puppet_bureaucrat') >= 1)) return finish();
  mark('floor3', 'floor3');
  return finish();

  function finish(): ClimbReport {
    report.goldEarned = earned();
    report.levelXp = Math.round(xpToReach(s.level) + s.levelXp);
    return report;
  }
}

/** Seconds, for reading. */
export const secs = (ticks: number | null): number | null => (ticks === null ? null : Math.round(ticks / TPS));
