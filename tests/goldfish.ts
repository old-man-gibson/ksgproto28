
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { npcsAt, availableQuests, canTurnIn, questComplete } from '../src/core/systems/quests';
import { visibleEdges } from '../src/core/systems/locations';
import { spotActivities } from '../src/core/systems/actions';
import { getSpot, NPCS, QUESTS, STYLES } from '../src/core/registry';
import type { GameState } from '../src/core/types';

/**
 * COMPLETABILITY (docs/COMPLETABILITY.md, Invariant A) — the idiot's half,
 * played rather than proved.
 *
 * The lints in content.test.ts reason about the content graph. This reasons
 * about nothing: it drives the real `Game` through the same methods the UI
 * calls, choosing at random from whatever is legal in front of it. It does not
 * plan, does not read, does not compare two swords, and forgets what it was
 * doing every few seconds. If the game is completable by someone who never
 * makes a correct decision, this thing makes progress. If it can be stranded,
 * starved or crashed by inattention, this thing finds it.
 *
 * It is a fuzzer with a persona, and it works because `src/core` is DOM-free
 * and every player action is a `Game` method.
 *
 * Determinism: the goldfish carries its OWN prng, separate from the save's
 * `rngState`, so its decisions never consume the game's randomness. Seed in,
 * same run out — a failure here is replayable.
 */

/** Small, fast, seedable — the goldfish's own stream of bad ideas. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Everything that has gone right for this character. Every term is something
 * the game hands out for ACTING rather than for choosing well — which is the
 * property archetype 1 depends on, so it is the right thing to watch.
 */
function progress(s: GameState): number {
  const attrs = Object.values(s.attrs).reduce((n, a) => n + a.level, 0);
  const skills = Object.values(s.skills).reduce((n, k) => n + k.level, 0);
  const done = Object.values(s.quests).filter((q) => q.status === 'done').length;
  return attrs + skills + done * 10 + s.discovered.length + Object.keys(s.bestiary).length;
}

export interface GoldfishReport {
  ticks: number;
  decisions: number;
  /** Decision points at which nothing legal was on offer. Must stay 0. */
  blanked: number;
  /** Decision points where it was carrying a finished quest it had not delivered. */
  hadDelivery: number;
  /** Longest run of ticks with no progress at all. */
  longestStall: number;
  start: number;
  end: number;
  skillsLearned: number;
  questsDone: number;
  spotsSeen: number;
  visited: Set<string>;
}

/**
 * Drive a game at random through legal actions.
 *
 * `attention` is how many ticks pass between decisions — the goldfish keeps
 * doing whatever it was doing until it forgets, which is also what makes it a
 * plausible idle player rather than a button masher.
 */
export function runGoldfish(seed: number, ticks: number, attention = 60): GoldfishReport {
  const rng = mulberry32(seed);
  const game = new Game(createInitialState(seed));
  const state = game.state;
  const pick = <T>(xs: T[]): T | undefined =>
    xs.length ? xs[Math.floor(rng() * xs.length)] : undefined;

  const report: GoldfishReport = {
    ticks,
    decisions: 0,
    blanked: 0,
    hadDelivery: 0,
    longestStall: 0,
    start: progress(state),
    end: 0,
    skillsLearned: 0,
    questsDone: 0,
    spotsSeen: 0,
    visited: new Set([state.spot]),
  };

  let lastProgress = report.start;
  let stall = 0;
  let sinceDecision = 0;

  for (let t = 0; t < ticks; t++) {
    game.tick();
    report.visited.add(state.spot);

    const now = progress(state);
    if (now > lastProgress) {
      lastProgress = now;
      stall = 0;
    } else {
      stall++;
      if (stall > report.longestStall) report.longestStall = stall;
    }

    if (++sinceDecision < attention) continue;
    sinceDecision = 0;
    report.decisions++;

    // Everything legal right now, as the UI would offer it, grouped by kind.
    // Each entry is a thunk so nothing runs while we are only counting.
    const activities = spotActivities(getSpot(state.spot))
      .filter((a) => a.id !== state.activity)
      .map((a) => () => game.selectActivity(a.id));
    const travels = visibleEdges(state, state.spot).map((e) => () => game.travelTo(e.to));
    const accepts = npcsAt(state.spot)
      .flatMap((npc) => availableQuests(state, npc))
      .map((q) => () => game.acceptQuest(q.id));
    const turnIns = Object.entries(state.quests)
      .filter(([id, q]) => q.status === 'active' && QUESTS[id] && canTurnIn(state, QUESTS[id]))
      .map(([id]) => () => game.turnInQuest(id));
    /*
     * The one thing that gives this creature a destination. `canTurnIn`
     * requires standing in front of the giver, so a finished quest is worth
     * nothing until it walks back — and walking back at random essentially
     * never happens: without this, seeds other than 7 finish no quest at all
     * in 250k ticks while carrying completed objectives around.
     *
     * This is not the goldfish getting clever. `travelPlanTo` IS the map
     * click, auto-routing over discovered spots exactly as the Location tab
     * does, and heading back to the person who asked is the least
     * sophisticated intention a player can form.
     */
    const deliveries = Object.entries(state.quests)
      .filter(([id, q]) => q.status === 'active' && QUESTS[id] && questComplete(state, QUESTS[id]))
      .map(([id]) => NPCS[QUESTS[id].giver]?.spotId)
      .filter((spotId): spotId is string => !!spotId && spotId !== state.spot)
      .map((spotId) => () => game.travelPlanTo(spotId));
    // Wears whatever it just picked up, with no idea whether it is an upgrade.
    const equips = state.inventory.map((item) => () => game.equip(item.uid));
    const styles = Object.values(STYLES).map((s) => () => game.setStyle(s.id));

    if (
      activities.length + travels.length + accepts.length + turnIns.length + equips.length ===
      0
    ) {
      report.blanked++;
      continue;
    }
    if (deliveries.length) report.hadDelivery++;

    /*
     * "Reasonable enough choices, gone about randomly."
     *
     * Weighting is by CATEGORY, then uniform inside it, which matters: the
     * player base is a 25-room cluster, so per-option weights would make
     * "wander" scale with door count and the goldfish would do nothing else
     * indoors.
     *
     * The shape of the weights is the whole persona. Carrying on is the most
     * likely thing it does, because an idle player who forgets they were
     * playing still leaves the activity running — uniform choice re-picks the
     * activity every few seconds and grinds out nothing at all, which is a
     * worse model of inattention than stickiness is. Turning in a finished
     * quest is near-certain for the opposite reason: clicking the reward is
     * the one thing every player does, however little else they understand.
     */
    const menu: { weight: number; options: (() => void)[] }[] = [
      { weight: 100, options: turnIns },
      { weight: 40, options: deliveries },
      { weight: 25, options: accepts },
      { weight: 30, options: activities },
      { weight: 10, options: travels },
      { weight: 8, options: equips },
      { weight: 2, options: styles },
      { weight: 60, options: [() => {}] }, // carry on doing whatever it was doing
    ].filter((m) => m.options.length > 0);

    let roll = rng() * menu.reduce((n, m) => n + m.weight, 0);
    for (const entry of menu) {
      roll -= entry.weight;
      if (roll <= 0) {
        pick(entry.options)!();
        break;
      }
    }
  }

  report.end = progress(state);
  report.skillsLearned = Object.keys(state.skills).length;
  report.questsDone = Object.values(state.quests).filter((q) => q.status === 'done').length;
  report.spotsSeen = state.discovered.length;
  return report;
}
