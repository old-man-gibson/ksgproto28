import type { GameState, SpotDef } from '../../core/types';
import { AREAS, FLOOR_BY_AREA, SPOTS, getSpot } from '../../core/registry';
import { visibleEdges } from '../../core/systems/locations';

/**
 * Known places and adjacent unexplored places, scoped to the displayed
 * region/floor. `floorArea` is the floor the map's tabs picked; without one,
 * the floor you stand on when the region is your own.
 */
export function mapNodes(
  state: GameState,
  shownRegion: string,
  floorArea?: string | null,
): { spot: SpotDef; known: boolean }[] {
  const here = getSpot(state.spot);
  const floor = FLOOR_BY_AREA.get(here.areaId);
  const currentRegion = AREAS[here.areaId].regionId;
  const scope = floorArea ?? (shownRegion === currentRegion ? floor?.areaId : undefined);
  const discovered = new Set(state.discovered);
  const ghosts = new Set<string>();
  for (const id of discovered) {
    for (const edge of visibleEdges(state, id)) {
      if (!discovered.has(edge.to)) ghosts.add(edge.to);
    }
  }
  return Object.values(SPOTS)
    .filter((spot) => spot.map && AREAS[spot.areaId].regionId === shownRegion)
    .filter((spot) => !scope || spot.areaId === scope)
    .filter((spot) => discovered.has(spot.id) || ghosts.has(spot.id))
    .map((spot) => ({ spot, known: discovered.has(spot.id) }));
}

// ---------- Label placement ----------

/** An axis-aligned box in map units. */
export interface MapBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** One pin as the label pass sees it: where it is, what it says, what it wears. */
export interface LabelPin {
  id: string;
  x: number;
  y: number;
  text: string;
  /** A feature icon above the pin (MapCard's `.feat`). */
  badge?: boolean;
  /** The ⚡ at its upper right (`.wp`). */
  waypoint?: boolean;
  /** The ⚔️ at its upper left (`.menace`). */
  menace?: boolean;
}

export interface LabelPlace {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

/**
 * MapCard's label metrics, in map units: `.label` is 2.4 px of a 100-wide
 * viewBox. A character is measured at 1.1–1.25 wide in the default font, so
 * 1.25 errs wide; the box runs from cap height to descender.
 */
const CHAR_W = 1.25;
const ASCENT = 2.6;
const DESCENT = 0.6;
const DOT_R = 3.4;
const VIEW: MapBox = { x0: 0, y0: -6, x1: 100, y1: 78 };

function overlap(a: MapBox, b: MapBox): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The box a line of map text covers at a place; `size` is its font size (a label's is 2.4). */
export function labelBox(text: string, at: LabelPlace, size = 2.4): MapBox {
  const k = size / 2.4;
  const w = text.length * CHAR_W * k;
  const x0 = at.anchor === 'middle' ? at.x - w / 2 : at.anchor === 'start' ? at.x : at.x - w;
  return { x0, x1: x0 + w, y0: at.y - ASCENT * k, y1: at.y + DESCENT * k };
}

/**
 * Where each pin's name goes. Under the pin unless that lands on another
 * pin, badge or name; then above, right, left, and the four diagonals. Pins
 * are taken top to bottom so the result is stable, and a name that fits
 * nowhere takes the place it overlaps least. A centred name is slid back
 * inside the viewBox rather than cut at its edge. Crowded corners still need
 * their pins spread in the data: tests/map.test.ts holds Threshold to zero
 * overlaps.
 */
export function placeLabels(pins: LabelPin[], obstacles: MapBox[] = []): Map<string, LabelPlace> {
  const fixed: MapBox[] = [...obstacles];
  const dots = new Map<string, MapBox>();
  for (const p of pins) {
    dots.set(p.id, { x0: p.x - DOT_R, y0: p.y - DOT_R, x1: p.x + DOT_R, y1: p.y + DOT_R });
    if (p.badge) fixed.push({ x0: p.x - 1.8, y0: p.y - 7.8, x1: p.x + 3, y1: p.y - 4.2 });
    if (p.waypoint) fixed.push({ x0: p.x + 2.6, y0: p.y - 5, x1: p.x + 5.4, y1: p.y - 2 });
    if (p.menace) fixed.push({ x0: p.x - 5.2, y0: p.y - 5, x1: p.x - 2.4, y1: p.y - 2 });
  }
  type Choice = { at: LabelPlace; box: MapBox; cost: number };
  const chosen = new Map<string, Choice>();

  const choose = (p: LabelPin): Choice => {
    const w = p.text.length * CHAR_W;
    const candidates: LabelPlace[] = [
      { x: p.x, y: p.y + 6.4, anchor: 'middle' },
      { x: p.x, y: p.y - (p.badge ? 8.6 : 4.4), anchor: 'middle' },
      { x: p.x + 4.2, y: p.y + 0.9, anchor: 'start' },
      { x: p.x - 4.2, y: p.y + 0.9, anchor: 'end' },
      { x: p.x + 3.2, y: p.y + 4.6, anchor: 'start' },
      { x: p.x - 3.2, y: p.y + 4.6, anchor: 'end' },
      { x: p.x + 3.2, y: p.y - 2.6, anchor: 'start' },
      { x: p.x - 3.2, y: p.y - 2.6, anchor: 'end' },
    ];
    let best: Choice | null = null;
    for (const c of candidates) {
      const at = { ...c };
      if (at.anchor === 'middle') at.x = Math.min(Math.max(at.x, VIEW.x0 + w / 2), VIEW.x1 - w / 2);
      const box = labelBox(p.text, at);
      if (box.x0 < VIEW.x0 || box.x1 > VIEW.x1 || box.y0 < VIEW.y0 || box.y1 > VIEW.y1) continue;
      let cost = 0;
      for (const [id, dot] of dots) if (id !== p.id) cost += overlap(box, dot);
      for (const o of fixed) cost += overlap(box, o);
      for (const [id, o] of chosen) if (id !== p.id) cost += overlap(box, o.box);
      if (!best || cost < best.cost) best = { at, box, cost };
      if (cost === 0) break;
    }
    return best ?? { at: candidates[0], box: labelBox(p.text, candidates[0]), cost: Infinity };
  };

  const order = [...pins].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const p of order) chosen.set(p.id, choose(p));
  // A name placed early may sit where a later one needed to go; give the
  // ones still touching something another look now that every name is down.
  for (let round = 0; round < 3; round++) {
    for (const p of order) if (chosen.get(p.id)!.cost > 0) chosen.set(p.id, choose(p));
  }
  return new Map([...chosen].map(([id, c]) => [id, c.at]));
}
