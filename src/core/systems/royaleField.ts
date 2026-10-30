import type { FieldFighter, RoyaleField, RoyaleMove, RoyaleStrategyDef } from '../types';
import { ROYALE_FIELD, SURVIVORS, SURVIVOR_SPECIES } from '../data/festival.data';

/**
 * The royale's field as a pure simulation (docs/FLOOR_IDEAS.md §5.3 items 13
 * and 18): positions, walking, the strategies that pick where to walk, duels
 * between survivors, and which survivors have reached the player. It reads
 * and writes only the field it is handed and calls the `rng` it is handed, so
 * it knows nothing of combat or the battle stage: systems/royale.ts turns an
 * engagement into an ordinary staged fight and reports the result back.
 *
 * Coarse on purpose. A duel between two survivors is a timer and one weighted
 * roll; only the player's fights are fought out in full. Work per step is
 * one pass to read positions out, an all-pairs distance pass over at most a
 * hundred bodies, and one pass to write back what moved.
 */

export interface FieldStep {
  now: number;
  rng: () => number;
  /** The player can be engaged: not already in a fight. */
  playerFree: boolean;
  /** The player's health share, 0–1, for the strategies that read it. */
  playerHp: number;
  /** The player's strength as the survivors size it up, on their scale (a level). */
  playerPower: number;
  /** The player's walking pace as a multiple of the field's. */
  playerSpeed: number;
  /** The player's strategies, in priority order. */
  plan: RoyaleStrategyDef[];
  /** A survivor species' strategies, in priority order. */
  planOf: (monsterId: string) => RoyaleStrategyDef[];
}

export interface FieldStepResult {
  /** Survivors who fell to other survivors this step. */
  fallen: number;
  /** Survivors who reached the player this step: the player's next fight. */
  engaged: FieldFighter[];
}

/** A point on the field. */
interface Point {
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** A species' share of strength in a duel between survivors. */
function speciesWeight(monsterId: string): number {
  return SURVIVOR_SPECIES.find((s) => s.monsterId === monsterId)?.weight ?? 1;
}

/**
 * A survivor's strength as the field reads it: duels won make it stronger,
 * wounds weaker. On the player's scale (a level) so the two can be compared.
 */
export function fighterPower(f: Pick<FieldFighter, 'monsterId' | 'wins' | 'hp'>, baseLevel: number): number {
  return (baseLevel + f.wins) * speciesWeight(f.monsterId) * (0.5 + 0.5 * f.hp);
}

/**
 * The field the climb into the royale opens on: the survivors scattered over
 * it, the player on the near edge. Species come in equal shares, in turn.
 */
export function createField(rng: () => number): RoyaleField {
  const size = ROYALE_FIELD.size;
  const fighters: FieldFighter[] = [];
  for (let i = 0; i < SURVIVORS; i++) {
    fighters.push({
      id: i + 1,
      monsterId: SURVIVOR_SPECIES[i % SURVIVOR_SPECIES.length].monsterId,
      x: round2(2 + rng() * (size - 4)),
      y: round2(2 + rng() * (size - 12)),
      hp: 1,
      wins: 0,
    });
  }
  return { size, fighters, player: { x: size / 2, y: size - 2 }, fallen: 0 };
}

/** Two decimals: positions are drawn, not measured, and the save stays small. */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * The first strategy in a plan whose condition holds, or null. `hp` is the
 * bearer's health share, `alive` the survivors on the field.
 */
export function activeStrategy(plan: RoyaleStrategyDef[], hp: number, alive: number): RoyaleStrategyDef | null {
  for (const s of plan) {
    const w = s.when;
    if (w?.hpBelow !== undefined && !(hp < w.hpBelow)) continue;
    if (w?.fieldAbove !== undefined && !(alive > w.fieldAbove)) continue;
    if (w?.fieldBelow !== undefined && !(alive < w.fieldBelow)) continue;
    return s;
  }
  return null;
}

/** One body on the field, as the walking pass sees it: the player is index −1. */
interface Body {
  id: number;
  x: number;
  y: number;
  power: number;
}

/**
 * Where a strategy's move sends a fighter standing at `at`, given everyone
 * else (`others`, never itself). Falls back on the nearest when a move has
 * nothing to work with, so a plan never leaves anyone standing for good.
 */
export function goalFor(move: RoyaleMove, at: Point, others: Body[], size: number): Point {
  const nearest = (): Body | null => {
    let best: Body | null = null;
    let bestD = Infinity;
    for (const o of others) {
      const d = dist(at.x, at.y, o.x, o.y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  };
  switch (move) {
    case 'hold':
      return { x: at.x, y: at.y };
    case 'centre':
      return { x: size / 2, y: size / 2 };
    case 'edge': {
      // The nearest of the four edges, a step inside it.
      const options = [
        { x: 1, y: at.y },
        { x: size - 1, y: at.y },
        { x: at.x, y: 1 },
        { x: at.x, y: size - 1 },
      ];
      return options.reduce((a, b) => (dist(at.x, at.y, a.x, a.y) <= dist(at.x, at.y, b.x, b.y) ? a : b));
    }
    case 'away': {
      const n = nearest();
      if (!n) return { x: at.x, y: at.y };
      const d = Math.max(0.001, dist(at.x, at.y, n.x, n.y));
      return {
        x: clamp(at.x + ((at.x - n.x) / d) * 10, 0, size),
        y: clamp(at.y + ((at.y - n.y) / d) * 10, 0, size),
      };
    }
    case 'weakest': {
      let best: Body | null = null;
      for (const o of others) {
        if (dist(at.x, at.y, o.x, o.y) > ROYALE_FIELD.sight) continue;
        if (!best || o.power < best.power) best = o;
      }
      const target = best ?? nearest();
      return target ? { x: target.x, y: target.y } : { x: at.x, y: at.y };
    }
    case 'nearest': {
      const n = nearest();
      return n ? { x: n.x, y: n.y } : { x: at.x, y: at.y };
    }
  }
}

/** Walk from `at` toward `goal` by at most `pace`. */
function walk(at: Point, goal: Point, pace: number, size: number): Point {
  const d = dist(at.x, at.y, goal.x, goal.y);
  if (d <= pace) return { x: clamp(goal.x, 0, size), y: clamp(goal.y, 0, size) };
  return {
    x: clamp(at.x + ((goal.x - at.x) / d) * pace, 0, size),
    y: clamp(at.y + ((goal.y - at.y) / d) * pace, 0, size),
  };
}

/**
 * One tick of the field. In order: duels whose time is up are decided and
 * the loser falls; the wounded recover; everyone free picks where to walk
 * (every `thinkTicks`, staggered by id) and walks; survivors who reached a
 * free player are the player's next fight; free survivors who meet duel.
 *
 * The last survivor is the champion, fought alone: a fight with the player
 * never takes every survivor left, and two survivors can only duel while a
 * third stands, so the field never empties except through the player.
 */
export function stepField(field: RoyaleField, step: FieldStep, baseLevel: number): FieldStepResult {
  const cfg = ROYALE_FIELD;
  const size = field.size;
  const result: FieldStepResult = { fallen: 0, engaged: [] };
  const fighters = field.fighters;

  // ---- Duels whose time is up ----
  const byId = new Map(fighters.map((f) => [f.id, f]));
  const fallen = new Set<number>();
  for (const f of fighters) {
    const duel = f.duel;
    if (!duel || duel.until > step.now || fallen.has(f.id)) continue;
    const foe = byId.get(duel.foe);
    if (!foe || fallen.has(foe.id)) {
      delete f.duel;
      continue;
    }
    const pa = fighterPower(f, baseLevel);
    const pb = fighterPower(foe, baseLevel);
    const [winner, loser] = step.rng() < pa / (pa + pb) ? [f, foe] : [foe, f];
    fallen.add(loser.id);
    delete winner.duel;
    winner.wins += 1;
    winner.hp = Math.max(0.1, winner.hp - cfg.duelWound);
  }
  if (fallen.size) {
    field.fighters = fighters.filter((f) => !fallen.has(f.id));
    field.fallen += fallen.size;
    result.fallen = fallen.size;
  }
  const live = field.fighters;
  const alive = live.length;

  // ---- Positions out, once ----
  const xs = live.map((f) => f.x);
  const ys = live.map((f) => f.y);
  const busy = live.map((f) => !!f.duel || !!f.engaged);
  const powers = live.map((f) => fighterPower(f, baseLevel));
  const player = field.player;
  let px = player.x;
  let py = player.y;

  // ---- Recovery, walking ----
  for (let i = 0; i < alive; i++) {
    const f = live[i];
    // Health is not rounded: a tick's recovery is smaller than a position's step.
    if (f.hp < 1 && !busy[i]) f.hp = Math.min(1, f.hp + cfg.healPerTick);
    if (busy[i]) continue;
    if (!f.goal || (step.now + f.id) % cfg.thinkTicks === 0) {
      // Other survivors count only while two of them may still duel (a third
      // stands); after that the player is the only one left to walk at.
      const others: Body[] = [{ id: -1, x: px, y: py, power: step.playerPower * (0.5 + 0.5 * step.playerHp) }];
      for (let j = 0; j < alive && alive > 2; j++) {
        if (j !== i) others.push({ id: live[j].id, x: xs[j], y: ys[j], power: powers[j] });
      }
      const s = activeStrategy(step.planOf(f.monsterId), f.hp, alive);
      const goal = goalFor(s?.move ?? 'nearest', { x: xs[i], y: ys[i] }, others, size);
      f.goal = { x: round2(goal.x), y: round2(goal.y) };
    }
    const next = walk({ x: xs[i], y: ys[i] }, f.goal, cfg.speed, size);
    xs[i] = round2(next.x);
    ys[i] = round2(next.y);
  }

  // The player walks only between fights: a click's target first, then the plan.
  if (step.playerFree) {
    const pace = cfg.speed * step.playerSpeed;
    if (player.target) {
      const next = walk({ x: px, y: py }, player.target, pace, size);
      px = next.x;
      py = next.y;
      if (dist(px, py, player.target.x, player.target.y) < 0.01) delete player.target;
    } else {
      if (!player.goal || step.now % cfg.thinkTicks === 0) {
        const others: Body[] = live.map((f, j) => ({ id: f.id, x: xs[j], y: ys[j], power: powers[j] }));
        const s = activeStrategy(step.plan, step.playerHp, alive);
        const goal = goalFor(s?.move ?? 'nearest', { x: px, y: py }, others, size);
        player.goal = { x: round2(goal.x), y: round2(goal.y) };
      }
      const next = walk({ x: px, y: py }, player.goal, pace, size);
      px = next.x;
      py = next.y;
    }
  }

  // ---- Positions back ----
  for (let i = 0; i < alive; i++) {
    if (live[i].x !== xs[i]) live[i].x = xs[i];
    if (live[i].y !== ys[i]) live[i].y = ys[i];
  }
  px = round2(px);
  py = round2(py);
  if (player.x !== px) player.x = px;
  if (player.y !== py) player.y = py;

  // ---- The player's next fight ----
  if (step.playerFree && alive > 0) {
    const near: number[] = [];
    for (let i = 0; i < alive; i++) {
      if (!busy[i] && dist(px, py, xs[i], ys[i]) <= cfg.engageRadius) near.push(i);
    }
    near.sort((a, b) => dist(px, py, xs[a], ys[a]) - dist(px, py, xs[b], ys[b]));
    // Never every survivor left: the last one is the champion, fought alone.
    const take = alive === 1 ? near.slice(0, 1) : near.slice(0, Math.min(cfg.maxGroup, alive - 1));
    for (const i of take) {
      live[i].engaged = true;
      delete live[i].goal;
      busy[i] = true;
      result.engaged.push(live[i]);
    }
  }

  // ---- Duels between survivors ----
  // Only while a third stands: each duel takes one of a disjoint pair, so
  // duels alone never bring the field below two, and the player's fight
  // never takes the last free survivor. The last one left is the champion.
  for (let i = 0; i < alive && alive > 2; i++) {
    if (busy[i]) continue;
    for (let j = i + 1; j < alive; j++) {
      if (busy[j] || dist(xs[i], ys[i], xs[j], ys[j]) > cfg.engageRadius) continue;
      const until = step.now + cfg.duelTicks;
      live[i].duel = { foe: live[j].id, until };
      live[j].duel = { foe: live[i].id, until };
      delete live[i].goal;
      delete live[j].goal;
      busy[i] = busy[j] = true;
      break;
    }
  }

  return result;
}

/** Take the player's fight off the field once it is won: its survivors are gone. */
export function clearEngaged(field: RoyaleField): number {
  const before = field.fighters.length;
  field.fighters = field.fighters.filter((f) => !f.engaged);
  return before - field.fighters.length;
}
