import type { SpotDef, UnlockCondition } from '../types';

/**
 * Floor structure rules (docs/FLOOR_STANDARD.md §2.2): the pure checks behind
 * the floor standard. Every function reads plain data (spots, floors and the
 * registry's mirrored adjacency), so three callers share one implementation:
 * tests/content.test.ts runs them on the live registry, tests/floorrules.test.ts
 * runs them on fixtures with one rule broken, and forge/lib/validate.ts runs
 * them on the staged working copy.
 *
 * The adjacency is the one `buildAdjacency` makes (registry.ts): every
 * non-oneWay edge is mirrored WITHOUT its conditions, so a gated road is gated
 * one way and free the other. Every walk below runs over that graph with all
 * conditions ignored, except where a rule removes a gate on purpose. Reading
 * authored `connections` alone would miss every mirrored way round.
 *
 * Imports are types only, so the forge bundle takes this file without taking
 * the registry.
 */

/** The parts of a registry `Edge` the rules read. The forge's own `Edge` fits too. */
export interface FloorEdge {
  to: string;
  oneWay?: boolean;
  requires?: UnlockCondition[];
  revealWhen?: UnlockCondition[];
}

export type FloorAdjacency = Map<string, FloorEdge[]>;

/** The parts of a `FloorDef` the rules read. */
export interface RuledFloor {
  id: string;
  areaId: string;
  landing?: string;
  clear?: { type: string; key?: string }[];
}

export type FloorRule = 'spine' | 'no-skip' | 'wing-depth' | 'wing-loop' | 'clear-table';

export interface FloorIssue {
  rule: FloorRule;
  floor: string;
  message: string;
}

export interface FloorReport {
  issues: FloorIssue[];
  /** The spine's spots, or null when the spine rules were skipped (see `skipped`). */
  spine: string[] | null;
  /** Why the spine rules did not run: the clear names no spot, or the floor has no usable landing. */
  skipped?: 'no-clear-spot' | 'no-landing';
}

/** Every spot of a banded floor lies within this many hops of the spine. */
export const WING_DEPTH_MAX = 3;
/** A wing this big (or bigger) must loop back to the spine. */
export const WING_LOOP_MIN_SPOTS = 3;
/** The clear-table check refuses to enumerate more counter combinations than this. */
const CLEAR_TABLE_SAMPLE_CAP = 100_000;

// ---------- Graph walks ----------

interface Walk {
  /** Hops from the nearest source, for every spot reached. */
  dist: Map<string, number>;
  /** The spot each reached spot was first entered from. */
  via: Map<string, string>;
}

/** Breadth-first over directed edges, staying inside `within`. `skip` removes edges. */
function walk(
  adj: FloorAdjacency,
  sources: Iterable<string>,
  within: ReadonlySet<string>,
  skip?: (from: string, edge: FloorEdge) => boolean,
): Walk {
  const dist = new Map<string, number>();
  const via = new Map<string, string>();
  const queue: string[] = [];
  for (const s of sources) {
    if (within.has(s) && !dist.has(s)) {
      dist.set(s, 0);
      queue.push(s);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    for (const e of adj.get(at) ?? []) {
      if (!within.has(e.to) || dist.has(e.to) || skip?.(at, e)) continue;
      dist.set(e.to, dist.get(at)! + 1);
      via.set(e.to, at);
      queue.push(e.to);
    }
  }
  return { dist, via };
}

function routeTo(w: Walk, to: string): string {
  const path = [to];
  for (let at = w.via.get(to); at !== undefined; at = w.via.get(at)) path.unshift(at);
  return path.join(' -> ');
}

/**
 * The spots a floor's clear counters name: `fights:<spot>`, `boss:<spot>`,
 * `slain:<spot>:<monster>`, and, given the spot table, every spot whose
 * `stampOnClear` writes a key the clear reads (band 3's ward 7 finishes in
 * whichever of several spots its form put last, each writing one stamp).
 */
export function clearSpotIds(
  floor: Pick<RuledFloor, 'clear'>,
  spots?: Record<string, Pick<SpotDef, 'id' | 'stampOnClear'>>,
): string[] {
  const out = new Set<string>();
  for (const c of floor.clear ?? []) {
    if (c.type !== 'stat' || !c.key) continue;
    const m = /^(?:fights|boss):([^:]+)$/.exec(c.key) ?? /^slain:([^:]+):/.exec(c.key);
    if (m) out.add(m[1]);
    for (const spot of Object.values(spots ?? {})) {
      if (spot.stampOnClear === c.key) out.add(spot.id);
    }
  }
  return [...out];
}

// ---------- 1. The spine ----------

/**
 * The spots on every road from the landing to a clear spot (its dominators,
 * the landing and the clear spot included), over the full adjacency with every
 * condition ignored. With several clear spots, the union.
 */
function spineOf(floor: RuledFloor, adj: FloorAdjacency, within: ReadonlySet<string>, targets: string[]) {
  const landing = floor.landing!;
  const spine = new Set<string>();
  const problems: string[] = [];
  const reached = walk(adj, [landing], within).dist;
  for (const t of targets) {
    if (!within.has(t)) {
      problems.push(`the clear names '${t}', which is not a spot of this floor`);
    } else if (!reached.has(t)) {
      problems.push(`the clear spot '${t}' cannot be reached from the landing '${landing}'`);
    } else {
      for (const v of within) {
        if (v === landing || v === t) spine.add(v);
        else {
          const without = new Set(within);
          without.delete(v);
          if (!walk(adj, [landing], without).dist.has(t)) spine.add(v);
        }
      }
    }
  }
  return { spine, problems };
}

// ---------- 2. No skip ----------

/** One floor-local condition: a counter held at or above (`stat`) or at or below (`statMax`) a value. */
interface Term {
  key: string;
  type: 'stat' | 'statMax';
  value: number;
  text: string;
}

interface Gate {
  from: string;
  to: string;
  /** The floor-local conditions on the edge, deduplicated and sorted by text. */
  terms: Term[];
}

const termOf = (c: Extract<UnlockCondition, { type: 'stat' | 'statMax' }>): Term => ({
  key: c.key,
  type: c.type,
  value: c.value,
  text: `${c.key} ${c.type === 'stat' ? '>=' : '<='} ${c.value}`,
});

/** Whenever `strict` holds, `weak` holds: the same counter at a higher minimum or a lower maximum. */
const implies = (strict: Term, weak: Term): boolean =>
  strict.key === weak.key &&
  strict.type === weak.type &&
  (weak.type === 'stat' ? strict.value >= weak.value : strict.value <= weak.value);

/**
 * A predicate for the counters this floor writes: `fights:`, `slain:` and
 * `boss:` of its own spots, `flag:` keys set by a find or a search reward at
 * one of its spots, and the key-item flag of any key item those grant.
 */
function floorCounters(floorSpots: SpotDef[]): (key: string) => boolean {
  const ids = new Set(floorSpots.map((s) => s.id));
  const flags = new Set<string>();
  const note = (p: { stat?: { key: string }; keyItem?: string }) => {
    if (p.stat?.key.startsWith('flag:')) flags.add(p.stat.key);
    // `keyItemKey` in systems/keyitems.ts spells this key; the live-content
    // test pins the spelling by requiring floor 1's key-item doors to be found.
    if (p.keyItem) flags.add(`flag:key_item:${p.keyItem}`);
  };
  for (const spot of floorSpots) {
    for (const f of spot.finds ?? []) note(f);
    for (const act of spot.activities ?? []) {
      if (act.kind !== 'search') continue;
      for (const r of act.rewards) note(r);
    }
  }
  return (key) => {
    const [kind, spot] = key.split(':');
    if ((kind === 'fights' || kind === 'boss' || kind === 'slain') && ids.has(spot)) return true;
    return flags.has(key);
  };
}

/**
 * Edges inside the floor whose `requires` or `revealWhen` read a counter this
 * floor writes. A oneWay edge back to a spot that every road to its source
 * passes through is a shortcut home, not a gate: nothing is skipped by going
 * back. (That is "nearer the landing than its source" with the nearness fixed
 * by the graph's dominators. Plain hop counts would let a free road that
 * shortens the way to a gated room turn the gate into a "shortcut home".)
 */
function floorGates(
  adj: FloorAdjacency,
  within: ReadonlySet<string>,
  landing: string,
  isFloorCounter: (key: string) => boolean,
): Gate[] {
  const reachable = new Set(walk(adj, [landing], within).dist.keys());
  const cutBy = new Map<string, Set<string>>();
  // Whether `back` is on every road from the landing to `source`.
  const dominates = (back: string, source: string): boolean => {
    if (back === landing) return true;
    let reach = cutBy.get(back);
    if (!reach) {
      const without = new Set(within);
      without.delete(back);
      reach = new Set(walk(adj, [landing], without).dist.keys());
      cutBy.set(back, reach);
    }
    return !reach.has(source);
  };
  const gates: Gate[] = [];
  for (const [from, edges] of adj) {
    if (!within.has(from)) continue;
    for (const edge of edges) {
      if (!within.has(edge.to)) continue;
      const terms = new Map<string, Term>();
      for (const c of [...(edge.requires ?? []), ...(edge.revealWhen ?? [])]) {
        if ((c.type !== 'stat' && c.type !== 'statMax') || !isFloorCounter(c.key)) continue;
        const term = termOf(c);
        terms.set(term.text, term);
      }
      if (!terms.size) continue;
      if (edge.oneWay && reachable.has(from) && dominates(edge.to, from)) continue;
      gates.push({ from, to: edge.to, terms: [...terms.values()].sort((a, b) => (a.text < b.text ? -1 : 1)) });
    }
  }
  return gates;
}

/**
 * Each gate must be necessary. Gates are grouped by identical condition sets;
 * for each group, every other condition is assumed to hold (other gates,
 * attribute, skill, quest and equipment conditions, hidden edges), the group's
 * edges are removed, and none of the group's targets may still be reachable
 * from the landing. Edges whose terms imply all of the group's are removed with
 * it, because with the group shut they are shut too: an edge that carries the
 * group's terms and more, or the same counter at a higher minimum (`>= 20`
 * behind a `>= 10` group) or a lower maximum.
 */
function skipIssues(
  floor: RuledFloor,
  adj: FloorAdjacency,
  within: ReadonlySet<string>,
  gates: Gate[],
): FloorIssue[] {
  const groups = new Map<string, Gate[]>();
  for (const g of gates) {
    const key = g.terms.map((t) => t.text).join(' & ');
    const members = groups.get(key);
    if (members) members.push(g);
    else groups.set(key, [g]);
  }
  const issues: FloorIssue[] = [];
  for (const [name, members] of groups) {
    const terms = members[0].terms;
    const shut = new Set(
      gates.filter((g) => terms.every((t) => g.terms.some((u) => implies(u, t)))).map((g) => `${g.from}>${g.to}`),
    );
    const w = walk(adj, [floor.landing!], within, (from, e) => shut.has(`${from}>${e.to}`));
    const open = [...new Set(members.map((m) => m.to))].filter((t) => w.dist.has(t));
    if (!open.length) continue;
    const edges = members.map((m) => `${m.from} -> ${m.to}`).join(', ');
    issues.push({
      rule: 'no-skip',
      floor: floor.id,
      message:
        `the gate [${name}] (${edges}) is bypassed: ${open.join(', ')} can be reached from the landing without it, ` +
        `by ${routeTo(w, open[0])}`,
    });
  }
  return issues;
}

// ---------- 3 and 4. Wings ----------

function wingIssues(
  floor: RuledFloor,
  adj: FloorAdjacency,
  within: ReadonlySet<string>,
  spine: ReadonlySet<string>,
): FloorIssue[] {
  const issues: FloorIssue[] = [];

  // Depth: every spot is a few hops from the spine, so no wing is a long walk.
  const fromSpine = walk(adj, spine, within).dist;
  for (const id of within) {
    const d = fromSpine.get(id);
    if (d === undefined) {
      issues.push({ rule: 'wing-depth', floor: floor.id, message: `'${id}' cannot be reached from the spine` });
    } else if (d > WING_DEPTH_MAX) {
      issues.push({
        rule: 'wing-depth',
        floor: floor.id,
        message: `'${id}' is ${d} hops from the spine; the limit is ${WING_DEPTH_MAX}`,
      });
    }
  }

  // Loops: a wing is a connected component of the off-spine spots.
  const off = [...within].filter((id) => !spine.has(id));
  const near = new Map<string, Set<string>>(off.map((id) => [id, new Set<string>()]));
  for (const id of off) {
    for (const e of adj.get(id) ?? []) {
      if (!near.has(e.to)) continue;
      near.get(id)!.add(e.to);
      near.get(e.to)!.add(id);
    }
  }
  const seen = new Set<string>();
  for (const start of off) {
    if (seen.has(start)) continue;
    const wing = [start];
    seen.add(start);
    for (let i = 0; i < wing.length; i++) {
      for (const n of near.get(wing[i])!) {
        if (!seen.has(n)) {
          seen.add(n);
          wing.push(n);
        }
      }
    }
    if (wing.length < WING_LOOP_MIN_SPOTS) continue;
    const members = new Set(wing);
    const touches = new Set<string>();
    let shortcut = false;
    for (const id of wing) {
      for (const e of adj.get(id) ?? []) {
        if (!spine.has(e.to)) continue;
        touches.add(e.to);
        if (e.oneWay) shortcut = true;
      }
    }
    for (const id of spine) {
      for (const e of adj.get(id) ?? []) if (members.has(e.to)) touches.add(id);
    }
    if (touches.size < 2 && !shortcut) {
      issues.push({
        rule: 'wing-loop',
        floor: floor.id,
        message:
          `the wing of ${wing.length} spots (${wing.join(', ')}) joins the spine at ` +
          `${touches.size ? `only '${[...touches][0]}'` : 'no spot'}; ` +
          `it needs a second join or a oneWay edge back to the spine`,
      });
    }
  }
  return issues;
}

// ---------- 5. The clear spot's table never empties ----------

/**
 * Samples every counter the clear spot's encounter lines read (stat and
 * statMax) at 0, at each threshold and at threshold + 1, over the cartesian
 * product, and reports each sample at which no line is eligible among the lines
 * with no `daypart` and no `window`. A line with a condition that is not a
 * counter (attribute, skill, equipment, quest) cannot be counted on, so it
 * does not cover a sample. `once` history is ignored: a latched line is
 * counted as eligible, because the clear has already been paid by then.
 */
export function clearTableIssues(spot: Pick<SpotDef, 'id' | 'encounters'>): string[] {
  const lines = spot.encounters ?? [];
  if (!lines.length) return [];
  const marks = new Map<string, Set<number>>();
  for (const line of lines) {
    for (const c of line.requires ?? []) {
      if (c.type !== 'stat' && c.type !== 'statMax') continue;
      let set = marks.get(c.key);
      if (!set) {
        set = new Set([0]);
        marks.set(c.key, set);
      }
      set.add(c.value);
      set.add(c.value + 1);
    }
  }
  const keys = [...marks.keys()];
  const axes = keys.map((k) => [...marks.get(k)!].sort((a, b) => a - b));
  const total = axes.reduce((n, a) => n * a.length, 1);
  if (total > CLEAR_TABLE_SAMPLE_CAP) {
    return [`'${spot.id}' reads ${keys.length} counters (${total} combinations); too many to check`];
  }
  const plain = lines.filter((l) => !l.daypart && !l.window);
  const covers = (requires: UnlockCondition[] | undefined, sample: Record<string, number>): boolean =>
    (requires ?? []).every((c) =>
      c.type === 'stat' ? sample[c.key] >= c.value : c.type === 'statMax' ? sample[c.key] <= c.value : false,
    );

  const gaps: string[] = [];
  const at = keys.map(() => 0);
  for (let n = 0; n < total; n++) {
    const sample: Record<string, number> = {};
    keys.forEach((k, i) => (sample[k] = axes[i][at[i]]));
    if (!plain.some((l) => covers(l.requires, sample))) {
      gaps.push(keys.length ? keys.map((k) => `${k} = ${sample[k]}`).join(', ') : 'any state');
    }
    for (let i = keys.length - 1; i >= 0; i--) {
      if (++at[i] < axes[i].length) break;
      at[i] = 0;
    }
  }
  if (!gaps.length) return [];
  const shown = gaps.slice(0, 3).join('; ');
  const more = gaps.length > 3 ? `; and ${gaps.length - 3} more` : '';
  return [
    `no encounter line without a daypart or window is eligible at '${spot.id}' when ${shown}${more}`,
  ];
}

// ---------- All floor rules for one banded floor ----------

/**
 * Rules 1 to 5 for one banded floor. `spots` is the whole spot table (the
 * floor's own are picked by `areaId`); `adj` is the full mirrored adjacency.
 */
export function floorStructureIssues(
  floor: RuledFloor,
  spots: Record<string, SpotDef>,
  adj: FloorAdjacency,
): FloorReport {
  const floorSpots = Object.values(spots).filter((s) => s.areaId === floor.areaId);
  const within = new Set(floorSpots.map((s) => s.id));
  const targets = clearSpotIds(floor, spots);
  if (!floor.landing || !within.has(floor.landing)) return { issues: [], spine: null, skipped: 'no-landing' };
  if (!targets.length) return { issues: [], spine: null, skipped: 'no-clear-spot' };

  const { spine, problems } = spineOf(floor, adj, within, targets);
  const issues: FloorIssue[] = problems.map((message) => ({ rule: 'spine' as const, floor: floor.id, message }));
  if (problems.length) return { issues, spine: [...spine] };

  const gates = floorGates(adj, within, floor.landing, floorCounters(floorSpots));
  issues.push(...skipIssues(floor, adj, within, gates));
  issues.push(...wingIssues(floor, adj, within, spine));
  for (const id of targets) {
    for (const message of clearTableIssues(spots[id])) issues.push({ rule: 'clear-table', floor: floor.id, message });
  }
  return { issues, spine: [...spine] };
}

// ---------- 6. Every explore pays something ----------

export interface ExploreIssue {
  spot: string;
  message: string;
}

/**
 * An explore activity at a spot with no `finds` and no `hidden` connection
 * pays nothing at any depth: it fills a bar and ends.
 */
export function exploreIssues(spots: Iterable<SpotDef>): ExploreIssue[] {
  const issues: ExploreIssue[] = [];
  for (const spot of spots) {
    const act = (spot.activities ?? []).find((a) => a.kind === 'explore');
    if (!act) continue;
    if ((spot.finds?.length ?? 0) > 0 || (spot.connections ?? []).some((c) => c.hidden)) continue;
    issues.push({
      spot: spot.id,
      message: `explore '${act.id}' pays nothing: the spot has no finds and no hidden connection`,
    });
  }
  return issues;
}
