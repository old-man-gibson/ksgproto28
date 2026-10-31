import type { FieldFighter, RoyaleCacheDef, RoyaleDenDef, RoyaleField, RoyaleMove, RoyaleStrategyDef } from '../types';
import {
  CACHE_WEAPONS,
  ROYALE_CACHES,
  ROYALE_DENS,
  ROYALE_FIELD,
  ROYALE_LAYOUT_VERSION,
  ROYALE_SECTIONS,
  SURVIVORS,
  SURVIVOR_SPECIES,
  denPower,
} from '../data/festival.data';
import type { RoyaleMap } from './royaleMap';
import { cacheOpen, denLive, mapOf, radarOn, sectionAt, sees } from './royaleTerrain';
import { survivorPower } from './survivorGen';

/**
 * The royale's field as a pure simulation (docs/FLOOR_IDEAS.md §5.3 items 13
 * and 18, docs/FESTIVAL.md §9.2): positions, walking over terrain, what each
 * fighter sees, the strategies that pick where to walk, duels between
 * survivors and with dens, caches, and which survivors have reached the
 * player. It reads and writes only the field it is handed and calls the `rng`
 * it is handed, so it knows nothing of combat or the battle stage:
 * systems/royale.ts turns an engagement into an ordinary staged fight and
 * reports the result back.
 *
 * Coarse on purpose. A duel between two survivors, or with a den, is a timer
 * and one weighted roll; only the player's fights are fought out in full.
 * Work per step is one pass to read positions out, a pruned look-around for
 * the survivors that think this tick (a fifth of them), an all-pairs distance
 * pass over at most a hundred bodies, and one pass to write back what moved.
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
  /**
   * The player knows the caches of this section: scouted in the hub, or stood
   * in this attempt (`sectionKnown`). Default: the sections in `field.seen`.
   */
  knows?: (sectionId: string) => boolean;
}

export interface FieldStepResult {
  /** Survivors who fell to other survivors or to dens this step. */
  fallen: number;
  /** Survivors who reached the player this step: the player's next fight. */
  engaged: FieldFighter[];
  /** The live den the free player has walked into: its staged fight. Never with `engaged`. */
  den?: RoyaleDenDef;
  /** Caches the free player reached this step, now in `field.taken`. */
  playerCaches: RoyaleCacheDef[];
  /** Share of max health the section under the free player restores this tick (the spring). */
  playerHeal: number;
  /** Dens survivors cleared this step. */
  cleared: string[];
}

/** A point on the field. */
interface Point {
  x: number;
  y: number;
}

/** One body on the field, as the walking pass sees it: the player is id −1. */
export interface Body {
  id: number;
  x: number;
  y: number;
  power: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** A species' share of strength in a duel between survivors. */
function speciesWeight(monsterId: string): number {
  return SURVIVOR_SPECIES.find((s) => s.monsterId === monsterId)?.weight ?? 1;
}

/**
 * A survivor's strength as the field reads it: duels won make it stronger,
 * wounds weaker, and each tool from a cache adds a little (`toolBonus`, up to
 * `toolCap` tools). On the player's scale (a level) so the two can be compared.
 */
export function fighterPower(
  f: Pick<FieldFighter, 'monsterId' | 'wins' | 'hp' | 'tools'> & Partial<Pick<FieldFighter, 'id'>>,
  baseLevel: number,
  seed?: number,
): number {
  // On a seeded field the survivor's generated build sizes it: archetype,
  // weapon and every tool (systems/survivorGen.ts, capped). Without a seed
  // or an id, a flat bonus per tool.
  const gear =
    seed === undefined || f.id === undefined
      ? Math.min(ROYALE_FIELD.toolCap, f.tools?.length ?? 0) * ROYALE_FIELD.toolBonus
      : survivorPower(seed, { id: f.id, monsterId: f.monsterId, tools: f.tools });
  return (baseLevel + f.wins + gear) * speciesWeight(f.monsterId) * (0.5 + 0.5 * f.hp);
}

/** Two decimals: positions are drawn, not measured, and the save stays small. */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Placements tried for one survivor before the spacing is relaxed. */
const SCATTER_TRIES = 40;

/**
 * Where the survivors start: random, at least `spread` apart and `cacheClear`
 * from every cache (both relaxed by a quarter whenever a survivor runs out of
 * tries, so placement always ends), `startClear` from the player's start and
 * `denMargin` beyond every den's radius (rejection sampling, after
 * InfiniteGacha's `scatter`).
 */
function scatter(rng: () => number, map: RoyaleMap): Point[] {
  const cfg = ROYALE_FIELD;
  const size = cfg.size;
  const dens = ROYALE_DENS.flatMap((d) => (map.dens[d.id] ? [{ at: map.dens[d.id], reach: d.radius + cfg.denMargin }] : []));
  const caches = ROYALE_CACHES.flatMap((c) => (map.caches[c.id] ? [map.caches[c.id]] : []));
  const placed: Point[] = [];
  let spread = cfg.spread;
  let cacheClear = cfg.cacheClear;
  for (let n = 0; n < SURVIVORS; n++) {
    for (let tries = 0; ; tries++) {
      if (tries > 0 && tries % SCATTER_TRIES === 0) {
        spread *= 0.75;
        cacheClear *= 0.75;
      }
      const p = { x: round2(2 + rng() * (size - 4)), y: round2(2 + rng() * (size - 12)) };
      // A bound on the whole search, so a map that fills the field still ends.
      const last = tries >= SCATTER_TRIES * 12;
      if (!last) {
        if (dist(p.x, p.y, map.start.x, map.start.y) < cfg.startClear) continue;
        if (dens.some((d) => dist(p.x, p.y, d.at.x, d.at.y) <= d.reach)) continue;
        if (caches.some((c) => dist(p.x, p.y, c.x, c.y) < cacheClear)) continue;
        if (placed.some((q) => dist(p.x, p.y, q.x, q.y) < spread)) continue;
      }
      placed.push(p);
      break;
    }
  }
  return placed;
}

/**
 * The field the climb into the royale opens on: the survivors scattered over
 * the seed's terrain, the player at its start. Species come in equal shares,
 * in turn. `seed` is the attempt's (`FestivalRun.fieldSeed`); without one the
 * field draws its own. `now` is the world tick it opens at, the radar's clock
 * for anyone who has not fought yet.
 */
export function createField(rng: () => number, seed?: number, now = 0): RoyaleField {
  const size = ROYALE_FIELD.size;
  const fieldSeed = seed ?? Math.floor(rng() * 0x100000000);
  const map = mapOf({ seed: fieldSeed });
  const fighters = scatter(rng, map).map(
    (p, i): FieldFighter => ({
      id: i + 1,
      monsterId: SURVIVOR_SPECIES[i % SURVIVOR_SPECIES.length].monsterId,
      x: p.x,
      y: p.y,
      hp: 1,
      wins: 0,
    }),
  );
  return {
    size,
    fighters,
    player: { x: map.start.x, y: map.start.y },
    fallen: 0,
    layout: ROYALE_LAYOUT_VERSION,
    seed: fieldSeed,
    openedAt: now,
    taken: [],
    cleared: [],
    seen: [],
  };
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

// ---------- Where a move walks ----------

/** What a fighter knows when it picks a goal. */
export interface GoalContext {
  /** Fighters it knows of: in sight, or the radar's target. Never itself. */
  others: Body[];
  /** Where the open caches it knows of lie. */
  caches: Point[];
  size: number;
  map: RoyaleMap;
  /**
   * The goal it holds now. A move with nothing to work with falls back on
   * `roam`, which keeps this goal until it is reached.
   */
  keep?: Point;
  rng: () => number;
}

/** A roam goal is reached within this many units. */
const ROAM_REACH = 1;
/** A new roam goal lies at least this far away, in another section when one is found. */
const ROAM_MIN = 15;
/** Random points tried for a roam goal in another section. */
const ROAM_TRIES = 12;
/** Sample spacing for the cover search: the nearest cell of cover is found to within this. */
const COVER_STRIDE = 4;

/** Cover sample points per map, built on first use. Maps are memoised per seed (royaleMap), so the key is stable. */
const COVER_POINTS = new WeakMap<RoyaleMap, Point[]>();

function coverPoints(map: RoyaleMap): Point[] {
  let points = COVER_POINTS.get(map);
  if (!points) {
    points = [];
    for (let y = COVER_STRIDE / 2; y < map.size; y += COVER_STRIDE) {
      for (let x = COVER_STRIDE / 2; x < map.size; x += COVER_STRIDE) {
        if (sectionAt(map, x, y)?.cover) points.push({ x, y });
      }
    }
    COVER_POINTS.set(map, points);
  }
  return points;
}

function nearestPoint(at: Point, points: Point[]): Point | null {
  let best: Point | null = null;
  let bestD = Infinity;
  for (const p of points) {
    const d = dist(at.x, at.y, p.x, p.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * The `roam` move: keep walking to the point already held until it is
 * reached, then pick a point in another section than the one under `at`
 * (open meadow counts as a section of its own), at least ROAM_MIN away.
 */
function roamGoal(at: Point, ctx: GoalContext): Point {
  const keep = ctx.keep;
  if (keep && dist(at.x, at.y, keep.x, keep.y) > ROAM_REACH) return keep;
  const here = sectionAt(ctx.map, at.x, at.y)?.id ?? '';
  let pick: Point = at;
  for (let n = 0; n < ROAM_TRIES; n++) {
    pick = { x: 1 + ctx.rng() * (ctx.size - 2), y: 1 + ctx.rng() * (ctx.size - 2) };
    if ((sectionAt(ctx.map, pick.x, pick.y)?.id ?? '') !== here && dist(at.x, at.y, pick.x, pick.y) >= ROAM_MIN) break;
  }
  return pick;
}

/**
 * Where a strategy's move sends a fighter standing at `at`, given what it
 * knows (`ctx`). A move with nothing to work with (no one known to walk at or
 * from, no cache known and open, no cover on the map) falls back on `roam`,
 * so a plan never leaves anyone standing for good; only `hold` stands.
 */
export function goalFor(move: RoyaleMove, at: Point, ctx: GoalContext): Point {
  const { others, size } = ctx;
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
      if (!n) return roamGoal(at, ctx);
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
      return target ? { x: target.x, y: target.y } : roamGoal(at, ctx);
    }
    case 'nearest': {
      const n = nearest();
      return n ? { x: n.x, y: n.y } : roamGoal(at, ctx);
    }
    case 'loot': {
      const c = nearestPoint(at, ctx.caches);
      return c ? { x: c.x, y: c.y } : roamGoal(at, ctx);
    }
    case 'cover': {
      // Already under cover: stay.
      if (sectionAt(ctx.map, at.x, at.y)?.cover) return { x: at.x, y: at.y };
      const c = nearestPoint(at, coverPoints(ctx.map));
      return c ? { x: c.x, y: c.y } : roamGoal(at, ctx);
    }
    case 'roam':
      return roamGoal(at, ctx);
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

/** The farthest anyone sees, in field units: the pre-check before the exact `sees` read. */
const MAX_SIGHT = ROYALE_FIELD.sight * Math.max(1, ...Object.values(ROYALE_SECTIONS).map((s) => s.sight));

/** The dens by id. */
const DENS = new Map(ROYALE_DENS.map((d) => [d.id, d]));

/** A cache that is open and where it lies. */
interface OpenCache {
  cache: RoyaleCacheDef;
  x: number;
  y: number;
}

/** The weapon a survivor's weapon cache gives it: one of CACHE_WEAPONS, of a random family. */
function randomWeapon(rng: () => number): string | undefined {
  const ids = Object.values(CACHE_WEAPONS);
  return ids[Math.floor(rng() * ids.length)];
}

/**
 * One tick of the field. In order: duels whose time is up are decided (the
 * loser falls, a den is cleared or holds); the wounded recover; everyone free
 * picks where to walk (every `thinkTicks`, staggered by id) from what it
 * knows, and walks at the pace of the ground it stands on; caches are taken;
 * survivors who reached a free player are the player's next fight, or the
 * player has walked into a den; free survivors who meet duel, or enter a den.
 *
 * A fighter knows of another only if it sees it (`sees`: range scaled by the
 * section it stands in, halved on a target in cover), or through the radar:
 * after RADAR_TICKS without a fight a survivor walks at the nearest enemy
 * whatever its plan, and the player's plan reads that enemy as in sight. With
 * two or fewer survivors left every survivor walks at the player.
 *
 * The last survivor is the champion, fought alone: a fight with the player
 * never takes every survivor left, duels need a third standing, and a den
 * fells a survivor only while three stand and another free one remains
 * (docs/FESTIVAL.md §9.2a rule 1), so the field never empties except through
 * the champion's fall.
 */
export function stepField(field: RoyaleField, step: FieldStep, baseLevel: number): FieldStepResult {
  const cfg = ROYALE_FIELD;
  const size = field.size;
  const map = mapOf(field);
  const now = step.now;
  const result: FieldStepResult = { fallen: 0, engaged: [], playerCaches: [], playerHeal: 0, cleared: [] };
  // Saved before the rework, or hand-built: the lists start empty. Each is
  // assigned on its own line and read back through the field.
  field.taken ??= [];
  field.cleared ??= [];
  field.seen ??= [];
  const taken = field.taken;
  const cleared = field.cleared;
  const seen = field.seen;
  const fighters = field.fighters;

  // ---- Duels whose time is up ----
  const fallen = new Set<number>();
  for (const f of fighters) {
    const duel = f.duel;
    if (!duel || duel.until > now || fallen.has(f.id)) continue;
    if (duel.den !== undefined) {
      // A den: won, it is cleared. Lost, the survivor falls only while three
      // stand and another survivor is free of the player's fight; otherwise
      // it is spared and walks on.
      delete f.duel;
      f.lastFight = now;
      const den = DENS.get(duel.den);
      if (!den || !denLive(field, den)) continue;
      const pa = fighterPower(f, baseLevel, field.seed);
      const pd = denPower(den);
      if (step.rng() < pa / (pa + pd)) {
        cleared.push(den.id);
        result.cleared.push(den.id);
        f.wins += 1;
        f.hp = Math.max(0.1, f.hp - cfg.duelWound);
      } else if (fighters.length - fallen.size >= 3 && fighters.some((o) => o.id !== f.id && !fallen.has(o.id) && !o.engaged)) {
        fallen.add(f.id);
      }
      continue;
    }
    const foe = fighters.find((o) => o.id === duel.foe);
    if (!foe || fallen.has(foe.id)) {
      delete f.duel;
      continue;
    }
    const pa = fighterPower(f, baseLevel, field.seed);
    const pb = fighterPower(foe, baseLevel, field.seed);
    const [winner, loser] = step.rng() < pa / (pa + pb) ? [f, foe] : [foe, f];
    fallen.add(loser.id);
    delete winner.duel;
    winner.wins += 1;
    winner.hp = Math.max(0.1, winner.hp - cfg.duelWound);
    winner.lastFight = now;
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
  const powers = live.map((f) => fighterPower(f, baseLevel, field.seed));
  const player = field.player;
  let px = player.x;
  let py = player.y;

  // ---- What a fighter looks at ----
  const playerBody = (): Body => ({ id: -1, x: px, y: py, power: step.playerPower * (0.5 + 0.5 * step.playerHp) });
  /** Survivors that `from` sees; `self` is the looker's index, or −1 for the player. */
  const visibleTo = (from: Point, self: number): Body[] => {
    const out: Body[] = [];
    const reach2 = MAX_SIGHT * MAX_SIGHT;
    for (let j = 0; j < alive; j++) {
      if (j === self) continue;
      const dx = xs[j] - from.x;
      const dy = ys[j] - from.y;
      if (dx * dx + dy * dy > reach2) continue;
      if (sees(map, from, { x: xs[j], y: ys[j] })) out.push({ id: live[j].id, x: xs[j], y: ys[j], power: powers[j] });
    }
    return out;
  };
  /** The nearest enemy, sight or no sight: the radar's read. The player is an enemy to every survivor. */
  const nearestEnemy = (from: Point, self: number, withPlayer: boolean): Body | null => {
    let best: Body | null = null;
    let bestD = Infinity;
    for (let j = 0; j < alive; j++) {
      if (j === self) continue;
      const d = dist(from.x, from.y, xs[j], ys[j]);
      if (d < bestD) {
        bestD = d;
        best = { id: live[j].id, x: xs[j], y: ys[j], power: powers[j] };
      }
    }
    if (withPlayer && dist(from.x, from.y, px, py) < bestD) best = playerBody();
    return best;
  };
  let openCaches: OpenCache[] | null = null;
  const openCachesNow = (): OpenCache[] => {
    if (!openCaches) {
      openCaches = [];
      for (const cache of ROYALE_CACHES) {
        const at = map.caches[cache.id];
        if (!at || !cacheOpen(field, cache)) continue;
        openCaches.push({ cache, x: at.x, y: at.y });
      }
    }
    return openCaches;
  };
  const knows = step.knows ?? ((id: string) => seen.includes(id));

  /** A survivor's goal: the two-left rule, the radar, or its strategy. */
  const survivorGoal = (i: number, f: FieldFighter): Point => {
    const at = { x: xs[i], y: ys[i] };
    if (alive <= 2) return { x: px, y: py };
    if (radarOn(f.lastFight, field.openedAt, now)) {
      const n = nearestEnemy(at, i, true);
      return n ? { x: n.x, y: n.y } : { x: px, y: py };
    }
    const others = visibleTo(at, i);
    if (sees(map, at, { x: px, y: py })) others.push(playerBody());
    const s = activeStrategy(step.planOf(f.monsterId), f.hp, alive);
    // Caches are hidden: a survivor notices an open one only within `cacheNotice`, whatever its terrain's sight.
    const caches = openCachesNow().filter((c) => dist(at.x, at.y, c.x, c.y) <= cfg.cacheNotice);
    return goalFor(s?.move ?? 'nearest', at, { others, caches, size, map, keep: f.goal, rng: step.rng });
  };

  // ---- Recovery, walking ----
  for (let i = 0; i < alive; i++) {
    const f = live[i];
    const ground = sectionAt(map, xs[i], ys[i]);
    // Health is not rounded: a tick's recovery is smaller than a position's step.
    if (f.hp < 1 && !busy[i]) f.hp = Math.min(1, f.hp + cfg.healPerTick + (ground?.heal ?? 0));
    if (busy[i]) continue;
    if (!f.goal || (now + f.id) % cfg.thinkTicks === 0) {
      const goal = survivorGoal(i, f);
      f.goal = { x: round2(goal.x), y: round2(goal.y) };
    }
    // The ground's pace is `paceAt`, read off the section already looked up.
    const next = walk({ x: xs[i], y: ys[i] }, f.goal, cfg.speed * (ground?.pace ?? 1), size);
    xs[i] = round2(next.x);
    ys[i] = round2(next.y);
  }

  // The player walks only between fights: a click's target first, then the plan.
  if (step.playerFree) {
    const pace = cfg.speed * step.playerSpeed * (sectionAt(map, px, py)?.pace ?? 1);
    if (player.target) {
      const next = walk({ x: px, y: py }, player.target, pace, size);
      px = next.x;
      py = next.y;
      if (dist(px, py, player.target.x, player.target.y) < 0.01) {
        delete player.target;
        // The plan chooses afresh on arrival, not from a goal held before the click.
        delete player.goal;
      }
    } else {
      if (!player.goal || now % cfg.thinkTicks === 0) {
        const at = { x: px, y: py };
        const others = visibleTo(at, -1);
        // The radar's target counts as in sight.
        if (radarOn(player.lastFight, field.openedAt, now)) {
          const n = nearestEnemy(at, -1, false);
          if (n && !others.some((o) => o.id === n.id)) others.push(n);
        }
        // The player knows the caches of sections it has scouted or stood in, and those in sight.
        const caches = openCachesNow()
          .filter((c) => knows(c.cache.section) || sees(map, at, c))
          .map((c) => ({ x: c.x, y: c.y }));
        const s = activeStrategy(step.plan, step.playerHp, alive);
        const goal = goalFor(s?.move ?? 'nearest', at, { others, caches, size, map, keep: player.goal, rng: step.rng });
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

  // ---- Where the player stands ----
  const under = sectionAt(map, px, py);
  if (under && !seen.includes(under.id)) seen.push(under.id);
  if (step.playerFree && under?.heal) result.playerHeal = under.heal;

  // ---- Caches: the nearest free fighter within reach takes it ----
  const reach = cfg.cacheReach;
  for (const oc of openCachesNow()) {
    let by = -1;
    let bestD = reach;
    for (let i = 0; i < alive; i++) {
      if (busy[i]) continue;
      const d = dist(xs[i], ys[i], oc.x, oc.y);
      if (d <= bestD) {
        bestD = d;
        by = i;
      }
    }
    const playerTakes = step.playerFree && dist(px, py, oc.x, oc.y) <= bestD;
    if (!playerTakes && by < 0) continue;
    taken.push(oc.cache.id);
    if (playerTakes) {
      result.playerCaches.push(oc.cache);
      continue;
    }
    // A survivor: a heal cache heals it, anything else is a tool it keeps.
    const f = live[by];
    if (oc.cache.heal !== undefined) {
      f.hp = Math.min(1, f.hp + oc.cache.heal);
    } else {
      const tool = oc.cache.item ?? (oc.cache.weapon ? randomWeapon(step.rng) : undefined);
      if (tool) {
        f.tools ??= [];
        f.tools.push(tool);
      }
    }
  }

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

  // ---- Dens ----
  for (const den of ROYALE_DENS) {
    if (!denLive(field, den)) continue;
    const at = map.dens[den.id];
    if (!at) continue;
    // One survivor at a time duels a den; it must have been out of a fight a duel's length.
    if (!live.some((f) => f.duel?.den === den.id)) {
      let from = -1;
      let fromD = Infinity;
      for (let i = 0; i < alive; i++) {
        if (busy[i] || now - (live[i].lastFight ?? -Infinity) < cfg.duelTicks) continue;
        const d = dist(xs[i], ys[i], at.x, at.y);
        if (d <= den.radius && d < fromD) {
          fromD = d;
          from = i;
        }
      }
      if (from >= 0) {
        live[from].duel = { foe: 0, until: now + cfg.duelTicks, den: den.id };
        delete live[from].goal;
        busy[from] = true;
      }
    }
    if (step.playerFree && result.engaged.length === 0 && !result.den && dist(px, py, at.x, at.y) <= den.radius) {
      result.den = den;
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
      const until = now + cfg.duelTicks;
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

/**
 * The player's survivor fight held the champion: the last survivor on the
 * field, engaged, with no one else standing (docs/FESTIVAL.md §9.2a rule 2).
 * Read before `clearEngaged`.
 */
export function championFight(field: RoyaleField): boolean {
  return field.fighters.length === 1 && !!field.fighters[0].engaged;
}

/**
 * A field with no one on it and no champion fallen has lost its last
 * survivor some way the rules do not allow; a champion takes the far edge so
 * the royale can still end. True when it did.
 */
export function restoreChampion(field: RoyaleField): boolean {
  if (field.fighters.length > 0) return false;
  field.fighters.push({
    id: SURVIVORS + 1,
    monsterId: SURVIVOR_SPECIES[0].monsterId,
    x: field.size / 2,
    y: 2,
    hp: 1,
    wins: 0,
  });
  return true;
}
