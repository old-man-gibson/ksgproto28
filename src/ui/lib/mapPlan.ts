import type { GameState, SceneId, SpotDef } from '../../core/types';
import { AREAS, REGIONS, SPOTS } from '../../core/registry';
import { OFFICE_ROOMS } from '../../core/systems/floodedFloor';
import { visibleEdges } from '../../core/systems/locations';
import { spotCleared } from '../../core/systems/combat';
import { conditionsMet } from '../../core/systems/conditions';
import { condsText } from './format';
import {
  arrowhead,
  diagramFrame,
  FULL_LABELS_MIN_W,
  labelBox,
  mapNodes,
  pinBox,
  placeDistrictName,
  placeLabels,
  roadClasses,
  shutGap,
  textWidth,
  tiledFrame,
  voronoiCell,
  type DistrictName,
  type LabelPin,
  type MapBox,
  type MapFrame,
  type Pt,
  type RoadClass,
} from './map';
import { spotFeatures, spotThreat, type RouteLeg } from './navigation';
import { sceneFor } from './scenes';

/**
 * The surveyed plan (docs/NAVIGATION.md §3): everything MapPlan.svelte draws
 * for one region or floor, worked out in frame pixels from game state and a
 * width. Pure: the same state and width give the same plan, and nothing here
 * reads the DOM, so tests/mapplan.test.ts checks it directly.
 *
 * What the plan may say follows the secret-content law: a place is named, tinted,
 * given a level or counted into a district only when the player has discovered
 * it. A "?" pin one road past known ground is a pin, a road and a ring if its
 * arrival is a forced fight, and nothing else.
 */

// ---------- Ground ----------

/** What a diagram's ground is drawn as, in code. */
export type GroundKind = 'grass' | 'cobbles' | 'flags' | 'water' | 'crypt' | 'webs';

const SCENE_GROUND: Record<SceneId, GroundKind> = {
  town: 'cobbles',
  hall: 'flags',
  crypt: 'crypt',
  cistern: 'water',
  webs: 'webs',
};

/**
 * Areas whose ground is not the one their scene gives. This is the seam for an
 * `AreaDef.ground` field: when the core data carries one, it replaces this
 * table and the default (`sceneFor`) stays.
 */
const AREA_GROUND: Record<string, GroundKind> = {
  ascent_f4_area: 'grass',
};

export function groundFor(spot: SpotDef): GroundKind {
  return AREA_GROUND[spot.areaId] ?? SCENE_GROUND[sceneFor(spot)];
}

// ---------- The model ----------

/** A feature chip: one icon of what stands at a place, centred at (x, y). */
export interface PlanChip {
  key: string;
  icon: string;
  label: string;
  x: number;
  y: number;
}

export const CHIP = 16;
const CHIP_GAP = 2;
const CHIPS_MAX = 4;

export interface PlanNode {
  id: string;
  known: boolean;
  x: number;
  y: number;
  /** The glyph in the pin: the place's icon, or ❓ for a place not yet visited. */
  icon: string;
  aria: string;
  /** Underfoot. */
  here: boolean;
  /** The tutorial's pointer is on this pin. */
  pointed: boolean;
  /** Arriving here starts a fight with no way out, by any road or by the road drawn to it. */
  ringed: boolean;
  /** The spot itself forces the fight (⚔️ on the pin). */
  menace: boolean;
  chips: PlanChip[];
  /** Features past the chips drawn. */
  more: { x: number; y: number; n: number } | null;
  /** The name, or null when the frame is too narrow to label this pin. */
  label: { name: string; threat: string | null; x: number; y: number; anchor: 'start' | 'middle' | 'end' } | null;
  /** The tutorial's ▼ over the pin. */
  arrow: Pt | null;
  menaceAt: Pt;
}

export interface PlanRoad {
  key: string;
  a: Pt;
  b: Pt;
  from: string;
  to: string;
  cls: RoadClass;
  /** One end is a "?" pin. */
  ghost: boolean;
  /** Arriving by this road, from either end, starts a fight with no way out. */
  forced: boolean;
  /** No road back: the triangle at the pin it leads into. */
  head: Pt[] | null;
  /** Shut: the pieces of road on either side of the gap and the bar across it. */
  shut: { pieces: [Pt, Pt][]; bar: [Pt, Pt]; terms: string } | null;
}

export interface PlanExit {
  to: string;
  label: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  pointed: boolean;
  arrow: Pt | null;
}

export interface PlanDistrict {
  area: string;
  tint: string;
  cells: Pt[][];
  name: DistrictName | null;
}

export interface MapPlan {
  frame: MapFrame;
  ground: GroundKind | null;
  districts: PlanDistrict[];
  roads: PlanRoad[];
  exits: PlanExit[];
  nodes: PlanNode[];
  /** Everything drawn that text must keep clear of: pins, chips, names, exits. */
  occupied: MapBox[];
}

export interface PlanOptions {
  region: string;
  area: string | null;
  /** The measured width of the column. */
  width: number;
  tiled: boolean;
  /** The spot the map is about; a frame too narrow for every name labels it and its neighbours. */
  focus: string;
  /** The tutorial's pointer (`spot:<id>`, `exit:<id>`), or null. */
  target: string | null;
  /** Level ranges by spot, when the caller keeps them (they follow the clock); else read here. */
  threats?: ReadonlyMap<string, string>;
}

/**
 * District tints, taken in the order the region lists its areas. They are
 * theme tokens (app.css), drawn at a low opacity, so a theme restyles them.
 */
const TINTS = [
  'var(--mana)',
  'var(--spirit)',
  'var(--hp)',
  'var(--xp)',
  'var(--accent)',
  'var(--skill)',
  'var(--focus)',
  'var(--stamina)',
  'var(--mat-wood)',
];

export function districtTint(areaId: string): string {
  const mates = Object.values(AREAS).filter((a) => a.regionId === AREAS[areaId].regionId);
  const i = mates.findIndex((a) => a.id === areaId);
  return TINTS[Math.max(0, i) % TINTS.length];
}

/** The level range of each known place that has one, as the label prints it. */
export function planThreats(state: GameState, region: string, area: string | null): Map<string, string> {
  const out = new Map<string, string>();
  for (const n of mapNodes(state, region, area)) {
    if (!n.known) continue;
    const t = spotThreat(state, n.spot);
    if (t) out.set(n.spot.id, t);
  }
  return out;
}

/**
 * `next`, or `prev` itself when it holds the same ranges. `planThreats` builds
 * a new Map on every call, so identity is what tells a Svelte derived (and
 * with it `buildPlan`) that nothing changed.
 */
export function stableThreats(
  prev: ReadonlyMap<string, string>,
  next: ReadonlyMap<string, string>,
): ReadonlyMap<string, string> {
  if (prev.size !== next.size) return next;
  for (const [id, text] of next) if (prev.get(id) !== text) return next;
  return prev;
}

/** How far a district's tint reaches from a pin of it, px, along either axis. */
const TINT_REACH = 130;

export function buildPlan(state: GameState, opts: PlanOptions): MapPlan {
  const nodes = mapNodes(state, opts.region, opts.area);
  const frame = opts.tiled
    ? tiledFrame(opts.width)
    : diagramFrame(nodes.map((n) => n.spot.map!), opts.width);
  const at = new Map(nodes.map((n) => [n.spot.id, frame.project(n.spot.map!)]));
  const known = new Map(nodes.map((n) => [n.spot.id, n.known]));
  const threats = opts.threats ?? planThreats(state, opts.region, opts.area);
  const r = frame.pinR;
  const font = frame.font;

  // ---------- Roads and exits, from the roads the player can see ----------
  const rendered = new Set(nodes.map((n) => n.spot.id));
  const seen = new Set<string>();
  const drawn: { from: SpotDef; to: SpotDef; oneWay: boolean; forced: boolean; shut: string | null }[] = [];
  const exitList: { from: SpotDef; to: string; label: string; offset: number }[] = [];
  const ringed = new Set<string>();
  for (const n of nodes) {
    if (!n.known) continue;
    let exitCount = 0;
    for (const e of visibleEdges(state, n.spot.id)) {
      if (OFFICE_ROOMS.includes(n.spot.id) && OFFICE_ROOMS.includes(e.to)) continue;
      const target = SPOTS[e.to];
      const targetRegion = AREAS[target.areaId].regionId;
      if (targetRegion !== opts.region) {
        exitList.push({ from: n.spot, to: e.to, label: REGIONS[targetRegion].name, offset: exitCount++ });
        continue;
      }
      if (!rendered.has(e.to)) continue;
      const key = [n.spot.id, e.to].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const reverse = visibleEdges(state, e.to).find((x) => x.to === n.spot.id);
      // A road is red when EITHER direction walks into a fight with no way
      // out: a flag on the road, or a forced spot at an end. A cleared spot no
      // longer menaces anybody (see SpotDef.fightLimit). The pin it leads into
      // wears the ring.
      const into = (dest: SpotDef, edgeForced?: boolean) =>
        !!(edgeForced || dest.forced) && !spotCleared(state, dest);
      const forwardForced = into(target, e.forced);
      const backForced = into(n.spot, reverse?.forced);
      if (forwardForced) ringed.add(target.id);
      if (backForced) ringed.add(n.spot.id);
      // Locks are directional (Connection.requires); the road shows either.
      const shutEdge = [e, reverse].find((x) => x?.requires && !conditionsMet(state, x.requires));
      drawn.push({
        from: n.spot,
        to: target,
        oneWay: !reverse,
        forced: forwardForced || backForced,
        shut: shutEdge ? condsText(shutEdge.requires) : null,
      });
    }
  }
  const classes = roadClasses(drawn.map((d): [string, string] => [d.from.id, d.to.id]));
  const roads: PlanRoad[] = drawn.map((d, i) => {
    const a = at.get(d.from.id)!;
    const b = at.get(d.to.id)!;
    return {
      key: [d.from.id, d.to.id].sort().join('|'),
      a,
      b,
      from: d.from.id,
      to: d.to.id,
      cls: classes[i],
      ghost: !known.get(d.from.id) || !known.get(d.to.id),
      forced: d.forced,
      head: d.oneWay ? arrowhead(a, b, r) : null,
      shut: d.shut ? { ...shutGap(a, b), terms: d.shut } : null,
    };
  });

  // ---------- Pins, with what stands on them ----------
  const taken: MapBox[] = [];
  const pinNodes: PlanNode[] = nodes.map((n) => {
    const p = at.get(n.spot.id)!;
    const feats = n.known ? spotFeatures(state, n.spot) : [];
    const shown = feats.slice(0, CHIPS_MAX);
    const extra = feats.length - shown.length;
    const cells = shown.length + (extra > 0 ? 1 : 0);
    const rowW = cells * CHIP + (cells - 1) * CHIP_GAP;
    const rowY = p.y - r - 3 - CHIP / 2;
    const chips: PlanChip[] = shown.map((f, i) => ({
      key: f.key,
      icon: f.icon,
      label: f.label,
      x: p.x - rowW / 2 + CHIP / 2 + i * (CHIP + CHIP_GAP),
      y: rowY,
    }));
    const more =
      extra > 0 ? { x: p.x - rowW / 2 + CHIP / 2 + shown.length * (CHIP + CHIP_GAP), y: rowY, n: extra } : null;
    const pointed = opts.target === `spot:${n.spot.id}`;
    const menace = !!n.spot.forced && !spotCleared(state, n.spot);
    const lift = cells > 0 ? CHIP + 3 : 0;
    return {
      id: n.spot.id,
      known: n.known,
      x: p.x,
      y: p.y,
      icon: n.known ? n.spot.icon : '❓',
      aria: n.known ? n.spot.name : 'Unexplored place',
      here: n.spot.id === state.spot,
      pointed,
      ringed: menace || ringed.has(n.spot.id),
      menace,
      chips,
      more,
      label: null,
      arrow: pointed ? { x: p.x, y: p.y - r - 6 - lift } : null,
      menaceAt: { x: p.x - r * 0.85, y: p.y - r * 0.85 },
    };
  });

  // ---------- Region exits: right of the pin, left when that runs off the frame ----------
  const exits: PlanExit[] = exitList.map((e) => {
    const p = at.get(e.from.id)!;
    const text = `→ ${e.label}`;
    const w = textWidth(text, font);
    const right = p.x + r + 6 + w <= frame.w - 4;
    const x = right ? p.x + r + 6 : p.x - r - 6;
    const y = p.y - 3 + e.offset * (font + 4);
    const pointed = opts.target === `exit:${e.to}`;
    return {
      to: e.to,
      label: e.label,
      x,
      y,
      anchor: right ? 'start' : 'end',
      pointed,
      arrow: pointed ? { x: right ? x + 8 : x - 8, y: y - font - 3 } : null,
    };
  });

  // ---------- Names: every pin, or the pin underfoot and its neighbours in a narrow frame ----------
  const near = new Set<string>([opts.focus, ...visibleEdges(state, opts.focus).map((e) => e.to)]);
  const labelled = frame.tiled || frame.w >= FULL_LABELS_MIN_W ? null : near; // null: label every pin
  const textOf = (n: PlanNode) => {
    const threat = threats.get(n.id) ?? null;
    return { name: n.known ? SPOTS[n.id].name : '???', threat };
  };
  const labelText = (n: PlanNode) => {
    const t = textOf(n);
    return t.threat ? `${t.name} · ${t.threat}` : t.name;
  };
  const boxOfNode = (n: PlanNode): MapBox[] => {
    const out: MapBox[] = [];
    const cells = n.chips.length + (n.more ? 1 : 0);
    if (cells > 0) {
      const w = cells * CHIP + (cells - 1) * CHIP_GAP;
      out.push({ x0: n.x - w / 2, x1: n.x + w / 2, y0: n.y - r - 3 - CHIP, y1: n.y - r - 3 });
    }
    if (n.menace) out.push({ x0: n.menaceAt.x - 8, x1: n.menaceAt.x + 8, y0: n.menaceAt.y - 8, y1: n.menaceAt.y + 8 });
    if (n.arrow) out.push({ x0: n.arrow.x - 8, x1: n.arrow.x + 8, y0: n.arrow.y - 14, y1: n.arrow.y + 2 });
    return out;
  };
  const exitBoxes = exits.map((e) =>
    labelBox(`→ ${e.label}`, { x: e.x, y: e.y, anchor: e.anchor }, font),
  );
  const pins: LabelPin[] = pinNodes
    .filter((n) => !labelled || labelled.has(n.id))
    .map((n) => {
      const avoid = boxOfNode(n);
      const lift = Math.max(0, ...avoid.filter((b) => b.y1 <= n.y - r).map((b) => n.y - r - b.y0));
      return { id: n.id, x: n.x, y: n.y, r, text: labelText(n), avoid, lift };
    });
  // Pins with no name still stand in the way of the names that are drawn.
  const bare = pinNodes.filter((n) => labelled && !labelled.has(n.id)).flatMap((n) => [pinBox(n, r), ...boxOfNode(n)]);
  const spots = placeLabels(pins, [...exitBoxes, ...bare], frame);
  for (const n of pinNodes) {
    const place = spots.get(n.id);
    if (!place) continue;
    const t = textOf(n);
    n.label = { ...t, x: place.x, y: place.y, anchor: place.anchor };
    taken.push(labelBox(labelText(n), place, font));
  }
  for (const n of pinNodes) taken.push(pinBox(n, r), ...boxOfNode(n));
  taken.push(...exitBoxes);

  // ---------- Districts: a cell per known pin, named inside their own cells ----------
  const districts: PlanDistrict[] = [];
  const knownPins = pinNodes.filter((n) => n.known);
  const areaOf = (id: string) => SPOTS[id].areaId;
  const areas = [...new Set(knownPins.map((n) => areaOf(n.id)))];
  if (!frame.tiled && areas.length > 1) {
    const pts = knownPins.map((n) => ({ x: n.x, y: n.y }));
    const cellOf = pts.map((_, i) => voronoiCell(pts, i, frame.w, frame.h, TINT_REACH));
    const middle = {
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    };
    for (const area of areas) {
      const idx = knownPins.map((n, i) => (areaOf(n.id) === area ? i : -1)).filter((i) => i >= 0);
      const cells = idx.map((i) => cellOf[i]).filter((c) => c.length > 2);
      const name = AREAS[area].name;
      // A district of one pin is named by that pin.
      const named =
        idx.length > 1
          ? placeDistrictName(name.toUpperCase(), idx.map((i) => pts[i]), cells, middle, taken, frame)
          : null;
      districts.push({ area, tint: districtTint(area), cells, name: named });
    }
  }

  return {
    frame,
    ground: frame.tiled || !nodes.length ? null : groundFor(nodes[0].spot),
    districts,
    roads,
    exits,
    nodes: pinNodes,
    occupied: taken,
  };
}

// ---------- The route drawn over a plan ----------

export type LegState = 'preview' | 'done' | 'now' | 'todo';

export interface RouteDrawLeg {
  key: string;
  a: Pt;
  b: Pt;
  state: LegState;
  time: string;
  /** Where the time is written, clear of pins and names where it can be. */
  at: Pt;
}

/** A route as it lies on one plan: only the legs whose two ends are both on it. */
export interface RouteDraw {
  legs: RouteDrawLeg[];
  /** The ladder mark (7 × 14 px) on each pin a ride leaves from: its top-left corner. */
  ladders: Pt[];
  /** The travel marker on the leg under way. */
  marker: Pt | null;
}

export interface RouteProgress {
  /** The index of the leg under way; legs before it are done. */
  current: number;
  /** How far along that leg, 0 to 1. */
  fraction: number;
}

/**
 * Lays a route over a plan. Legs between two pins of the plan are drawn; a
 * ride leg draws no line and marks the pin it leaves from; a leg with an end
 * on another map or floor is not drawn. `time` writes a leg's time in text.
 */
export function buildRouteDraw(
  plan: MapPlan,
  legs: RouteLeg[],
  time: (ticks: number) => string,
  progress: RouteProgress | null,
): RouteDraw {
  const pin = new Map(plan.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const font = 11;
  const out: RouteDraw = { legs: [], ladders: [], marker: null };
  const placed: MapBox[] = [];
  legs.forEach((leg, i) => {
    const a = pin.get(leg.from);
    const b = pin.get(leg.to);
    const state: LegState = !progress ? 'preview' : i < progress.current ? 'done' : i === progress.current ? 'now' : 'todo';
    if (leg.ride) {
      if (a) {
        // Above and right of the pin, clear of its icon.
        const mark = { x: a.x + plan.frame.pinR * 0.7, y: a.y - plan.frame.pinR * 0.7 - 14 };
        out.ladders.push(mark);
        if (state === 'now') out.marker = { x: mark.x + 3.5, y: mark.y + 7 };
      }
      return;
    }
    if (!a || !b) return;
    const text = time(leg.ticks);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    // Beside the road, far enough off that the text clears its width: the
    // half of the text that points across the road, and the road's own half.
    const size = labelBox(text, { x: 0, y: 0, anchor: 'middle' }, font);
    const clear = 7 + (Math.abs(nx) * (size.x1 - size.x0)) / 2 + (Math.abs(ny) * (size.y1 - size.y0)) / 2;
    // The middle of the road on either side; then further along it and further off, for the spot with the least on it.
    let best: { at: Pt; cost: number } | null = null;
    search: for (const extra of [0, 10]) {
      for (const t of [0.5, 0.38, 0.62, 0.28, 0.72]) {
        for (const side of [1, -1]) {
          const off = (clear + extra) * side;
          const at = { x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off + font * 0.35 };
          const box = labelBox(text, { ...at, anchor: 'middle' }, font);
          const cost = [...plan.occupied, ...placed].reduce((s, o) => {
            const w = Math.min(box.x1, o.x1) - Math.max(box.x0, o.x0);
            const h = Math.min(box.y1, o.y1) - Math.max(box.y0, o.y0);
            return s + (w > 0 && h > 0 ? w * h : 0);
          }, 0);
          if (!best || cost < best.cost) best = { at, cost };
          if (cost === 0) break search;
        }
      }
    }
    const at = best!.at;
    placed.push(labelBox(text, { ...at, anchor: 'middle' }, font));
    out.legs.push({ key: `${leg.from}>${leg.to}`, a, b, state, time: text, at });
    if (state === 'now' && progress) {
      out.marker = { x: a.x + dx * progress.fraction, y: a.y + dy * progress.fraction };
    }
  });
  return out;
}
