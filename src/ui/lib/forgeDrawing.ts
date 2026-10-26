import type { ItemClassDef, PartKindDef, PlacedPart, Placement } from '../../core/types';
import { PART_KINDS } from '../../core/registry';
import { classifyPlacement } from '../../core/systems/assembly';
import { materialColor } from './anvilView';

/**
 * The anvil's drawing: a smith's pattern. Every part is an ink outline at its
 * true size in cells (one grid square is one cell), with a bracket beside it
 * giving its w×l. Weapons stand on one axis, blade up; armour and jewellery lay
 * their pieces side by side; a shield gets a front view and a side view so its
 * grip can be shown behind the face instead of hanging below it.
 *
 * Pure geometry, in cell units: `ForgeSilhouette.svelte` scales it and draws
 * the grid. Every part on the anvil is drawn, which a test sweeps over the
 * whole catalogue (removing any part changes the drawing).
 */

/** How a stroke is inked: a part's outline, a detail inside it, or a hidden line behind something. */
export type Ink = 'line' | 'detail' | 'hidden';

export interface Stroke {
  /** SVG path data in cell units. */
  d: string;
  ink: Ink;
  /** A faint tint of the part's material inside an outline, as a CSS colour. */
  tint?: string;
}

/** A size bracket: a span along one side of a part and its w×l. */
export interface Measure {
  /** The span the bracket covers. Vertical when `side` is left or right, horizontal otherwise. */
  from: number;
  to: number;
  /** Where the bracket stands: an x for left and right, a y for below. */
  at: number;
  side: 'left' | 'right' | 'below';
  label: string;
}

export interface Caption {
  x: number;
  y: number;
  text: string;
}

export interface Drawing {
  strokes: Stroke[];
  measures: Measure[];
  captions: Caption[];
  /** Bounds in cell units, measures and captions included. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** A part resolved for drawing. */
interface Piece {
  kind: PartKindDef;
  tint: string;
  qty: number;
}

function pieceOf(part: PlacedPart | undefined): Piece | undefined {
  const kind = part ? PART_KINDS[part.kind] : undefined;
  if (!part || !kind) return undefined;
  const qty = Math.max(1, Math.min(kind.qtyMax ?? 1, Math.floor(part.qty ?? 1) || 1));
  return { kind, tint: tintOf(materialColor(part.mat)), qty };
}

/** The material colour at a low strength: enough to tell wood from metal, not enough to compete with the ink. */
function tintOf(color: string): string {
  return `color-mix(in srgb, ${color} 22%, transparent)`;
}

const n = (v: number) => +v.toFixed(3);
/** A bracket's label, the size alone as on a smith's pattern: "2×6", "1×1 ×8". The part names are in the slot list beside it. */
const sizeLabel = (p: Piece) => `${p.kind.w}×${p.kind.l}${p.qty > 1 ? ` ×${p.qty}` : ''}`;

/** The axis every weapon stands on: the middle of a one-cell haft. */
const AXIS = 0.5;

/** Collects strokes and keeps the bounds. */
class Sheet {
  strokes: Stroke[] = [];
  measures: Measure[] = [];
  captions: Caption[] = [];
  minX = Infinity;
  minY = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;

  box(x0: number, y0: number, x1: number, y1: number) {
    this.minX = Math.min(this.minX, x0, x1);
    this.minY = Math.min(this.minY, y0, y1);
    this.maxX = Math.max(this.maxX, x0, x1);
    this.maxY = Math.max(this.maxY, y0, y1);
  }

  line(d: string, tint?: string) {
    this.strokes.push({ d, ink: 'line', ...(tint ? { tint } : {}) });
  }

  detail(d: string) {
    this.strokes.push({ d, ink: 'detail' });
  }

  hidden(d: string) {
    this.strokes.push({ d, ink: 'hidden' });
  }

  measure(m: Measure) {
    this.measures.push(m);
    // A label is about 0.36 cells a character at the drawn size.
    const width = 0.36 * m.label.length + 0.5;
    if (m.side === 'right') this.box(m.at, m.from, m.at + 0.45 + width, m.to);
    else if (m.side === 'left') this.box(m.at - 0.45 - width, m.from, m.at, m.to);
    else {
      // Centred under the bracket.
      const mid = (m.from + m.to) / 2;
      this.box(Math.min(m.from, mid - width / 2), m.at, Math.max(m.to, mid + width / 2), m.at + 0.9);
    }
  }

  caption(c: Caption) {
    this.captions.push(c);
    this.box(c.x, c.y - 0.7, c.x + 0.36 * c.text.length, c.y);
  }

  done(): Drawing {
    if (!isFinite(this.minX)) return { strokes: [], measures: [], captions: [], minX: 0, minY: 0, maxX: 1, maxY: 1 };
    return {
      strokes: this.strokes,
      measures: this.measures,
      captions: this.captions,
      minX: this.minX,
      minY: this.minY,
      maxX: this.maxX,
      maxY: this.maxY,
    };
  }
}

// ---------- Shapes: path data for one part in its box ----------

const rect = (x: number, y: number, w: number, h: number) => `M${n(x)},${n(y)} h${n(w)} v${n(h)} h${n(-w)} Z`;
const circle = (cx: number, cy: number, r: number) =>
  `M${n(cx - r)},${n(cy)} a${n(r)},${n(r)} 0 1 0 ${n(2 * r)},0 a${n(r)},${n(r)} 0 1 0 ${n(-2 * r)},0 Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${n(cx - rx)},${n(cy)} a${n(rx)},${n(ry)} 0 1 0 ${n(2 * rx)},0 a${n(rx)},${n(ry)} 0 1 0 ${n(-2 * rx)},0 Z`;
const segment = (x1: number, y1: number, x2: number, y2: number) => `M${n(x1)},${n(y1)} L${n(x2)},${n(y2)}`;
const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
  const q = Math.min(r, w / 2, h / 2);
  return (
    `M${n(x + q)},${n(y)} H${n(x + w - q)} Q${n(x + w)},${n(y)} ${n(x + w)},${n(y + q)} V${n(y + h - q)} ` +
    `Q${n(x + w)},${n(y + h)} ${n(x + w - q)},${n(y + h)} H${n(x + q)} Q${n(x)},${n(y + h)} ${n(x)},${n(y + h - q)} ` +
    `V${n(y + q)} Q${n(x)},${n(y)} ${n(x + q)},${n(y)} Z`
  );
};

/** Mirrors a y coordinate inside a box when the part points down. */
const flip = (down: boolean, y: number, top: number, l: number) => (down ? top + l - (y - top) : y);

/** A straight blade, tip up (or down), with a fuller and edge bevels. */
function blade(s: Sheet, p: Piece, x: number, top: number, down = false) {
  const { w, l } = p.kind;
  const tip = Math.min(l * (w >= 2 ? 0.3 : 0.35), w >= 2 ? 1.4 : 1.2);
  const Y = (y: number) => flip(down, y, top, l);
  const cx = x + w / 2;
  s.line(
    `M${n(cx)},${n(Y(top))} L${n(x + w)},${n(Y(top + tip))} L${n(x + w)},${n(Y(top + l))} L${n(x)},${n(Y(top + l))} L${n(x)},${n(Y(top + tip))} Z`,
    p.tint,
  );
  if (w >= 2 && l >= 3) s.detail(segment(cx, Y(top + tip + 0.4), cx, Y(top + l - 0.35)));
  if (w >= 2) {
    s.detail(segment(x + 0.2, Y(top + tip + 0.15), x + 0.2, Y(top + l)));
    s.detail(segment(x + w - 0.2, Y(top + tip + 0.15), x + w - 0.2, Y(top + l)));
  }
  s.box(x, top, x + w, top + l);
}

/** A curved blade: its tip sweeps toward the back by up to a cell. */
function curvedBlade(s: Sheet, p: Piece, x: number, top: number, down = false) {
  const { w, l } = p.kind;
  const sweep = Math.min(1.2, l * 0.16);
  const Y = (y: number) => flip(down, y, top, l);
  const tipX = x + w * 0.55 + sweep;
  s.line(
    `M${n(x)},${n(Y(top + l))} L${n(x + w)},${n(Y(top + l))} Q${n(x + w + sweep * 0.25)},${n(Y(top + l * 0.45))} ${n(tipX)},${n(Y(top))} ` +
      `Q${n(x + sweep * 0.55)},${n(Y(top + l * 0.35))} ${n(x)},${n(Y(top + l))} Z`,
    p.tint,
  );
  // The ridge line, parallel to the back.
  s.detail(
    `M${n(x + w * 0.62)},${n(Y(top + l))} Q${n(x + w * 0.62 + sweep * 0.3)},${n(Y(top + l * 0.45))} ${n(tipX - 0.15)},${n(Y(top + 0.45))}`,
  );
  s.box(x, top, tipX + 0.1, top + l);
}

/** A spearhead: a leaf on a socket, with a midrib. */
function spearhead(s: Sheet, p: Piece, x: number, top: number, down = false) {
  const { w, l } = p.kind;
  const Y = (y: number) => flip(down, y, top, l);
  const cx = x + w / 2;
  const half = Math.max(0.42, w * 0.5);
  s.line(
    `M${n(cx)},${n(Y(top))} Q${n(cx + half + 0.25)},${n(Y(top + l * 0.5))} ${n(cx + 0.2)},${n(Y(top + l))} L${n(cx - 0.2)},${n(Y(top + l))} ` +
      `Q${n(cx - half - 0.25)},${n(Y(top + l * 0.5))} ${n(cx)},${n(Y(top))} Z`,
    p.tint,
  );
  s.detail(segment(cx, Y(top + 0.35), cx, Y(top + l - 0.1)));
  s.box(cx - half - 0.15, top, cx + half + 0.15, top + l);
}

/** An axe head mounted across the haft: its cheek on the axis, its edge curving out to the left. */
function axeHead(s: Sheet, p: Piece, top: number): void {
  const { w, l } = p.kind;
  const right = AXIS + 0.35;
  const x = right - w;
  s.line(
    `M${n(right)},${n(top + l * 0.22)} L${n(right)},${n(top + l * 0.78)} L${n(x + 1.3)},${n(top + l * 0.78)} ` +
      `Q${n(x + 0.7)},${n(top + l + 0.05)} ${n(x)},${n(top + l + 0.15)} Q${n(x - 0.45)},${n(top + l / 2)} ${n(x)},${n(top - 0.15)} ` +
      `Q${n(x + 0.7)},${n(top - 0.05)} ${n(x + 1.3)},${n(top + l * 0.22)} Z`,
    p.tint,
  );
  s.detail(`M${n(x + 0.22)},${n(top + 0.05)} Q${n(x - 0.15)},${n(top + l / 2)} ${n(x + 0.22)},${n(top + l + 0.05)}`);
  s.box(x - 0.4, top - 0.15, right, top + l + 0.15);
}

/** A maul head: a block across the haft with two bands. */
function maulHead(s: Sheet, p: Piece, top: number): void {
  const { w, l } = p.kind;
  const x = AXIS - w / 2;
  s.line(roundRect(x, top, w, l, 0.25), p.tint);
  s.detail(segment(x + 0.55, top, x + 0.55, top + l));
  s.detail(segment(x + w - 0.55, top, x + w - 0.55, top + l));
  s.box(x, top, x + w, top + l);
}

/** A plain plate: rounded corners, rivets. */
function plate(s: Sheet, p: Piece, x: number, top: number) {
  const { w, l } = p.kind;
  s.line(roundRect(x, top, w, l, 0.2), p.tint);
  for (const [rx, ry] of [
    [x + 0.3, top + 0.3],
    [x + w - 0.3, top + 0.3],
    [x + 0.3, top + l - 0.3],
    [x + w - 0.3, top + l - 0.3],
  ]) {
    s.detail(circle(rx, ry, 0.07));
  }
  s.box(x, top, x + w, top + l);
}

/** A shield's face: a round buckler, a heater, or a tall tower shield, by proportion. */
function shieldFace(s: Sheet, p: Piece, x: number, top: number) {
  const { w, l } = p.kind;
  if (l <= w && w <= 2) {
    s.line(ellipse(x + w / 2, top + l / 2, w / 2, l / 2), p.tint);
  } else if (l > w * 1.4) {
    s.line(
      `M${n(x)},${n(top + 0.6)} Q${n(x)},${n(top)} ${n(x + w / 2)},${n(top)} Q${n(x + w)},${n(top)} ${n(x + w)},${n(top + 0.6)} ` +
        `V${n(top + l)} H${n(x)} Z`,
      p.tint,
    );
  } else {
    s.line(
      `M${n(x)},${n(top)} H${n(x + w)} V${n(top + l * 0.45)} Q${n(x + w)},${n(top + l * 0.92)} ${n(x + w / 2)},${n(top + l + 0.35)} ` +
        `Q${n(x)},${n(top + l * 0.92)} ${n(x)},${n(top + l * 0.45)} Z`,
      p.tint,
    );
  }
  s.box(x, top, x + w, top + l + 0.35);
}

/** A breastplate: neckline, shoulders, a waist, a centre ridge, two rivets. */
function cuirass(s: Sheet, p: Piece, x: number, top: number) {
  const { w, l } = p.kind;
  s.line(
    `M${n(x + 0.3)},${n(top)} L${n(x + w * 0.33)},${n(top)} Q${n(x + w / 2)},${n(top + 0.7)} ${n(x + w * 0.67)},${n(top)} ` +
      `L${n(x + w - 0.3)},${n(top)} Q${n(x + w)},${n(top)} ${n(x + w)},${n(top + 0.55)} L${n(x + w - 0.3)},${n(top + l - 0.3)} ` +
      `Q${n(x + w / 2)},${n(top + l + 0.25)} ${n(x + 0.3)},${n(top + l - 0.3)} L${n(x)},${n(top + 0.55)} Q${n(x)},${n(top)} ${n(x + 0.3)},${n(top)} Z`,
    p.tint,
  );
  s.detail(segment(x + w / 2, top + 0.85, x + w / 2, top + l - 0.05));
  s.detail(circle(x + 0.42, top + 0.45, 0.07));
  s.detail(circle(x + w - 0.42, top + 0.45, 0.07));
  s.box(x, top, x + w, top + l + 0.1);
}

/** Bent metal, shaped by what it becomes: a helm, a gauntlet, a boot, a greave. */
function bentPiece(s: Sheet, p: Piece, x: number, top: number, cls: ItemClassDef) {
  const { w, l } = p.kind;
  if (cls.id === 'boots') {
    s.line(
      `M${n(x)},${n(top)} H${n(x + w * 0.62)} V${n(top + l * 0.58)} Q${n(x + w)},${n(top + l * 0.62)} ${n(x + w)},${n(top + l)} H${n(x)} Z`,
      p.tint,
    );
    s.detail(segment(x, top + 0.3, x + w * 0.62, top + 0.3));
  } else {
    s.line(
      `M${n(x)},${n(top + l)} L${n(x)},${n(top + l * 0.45)} Q${n(x)},${n(top)} ${n(x + w / 2)},${n(top)} ` +
        `Q${n(x + w)},${n(top)} ${n(x + w)},${n(top + l * 0.45)} L${n(x + w)},${n(top + l)} Z`,
      p.tint,
    );
    if (cls.id === 'helm') s.detail(segment(x - 0.15, top + l - 0.25, x + w + 0.15, top + l - 0.25));
    else if (cls.id === 'gauntlets') {
      for (let i = 1; i < 4; i++) s.detail(segment(x + (w * i) / 4, top + l * 0.35, x + (w * i) / 4, top + l * 0.75));
    } else s.detail(segment(x + w / 2, top + 0.35, x + w / 2, top + l - 0.1));
  }
  s.box(x - 0.15, top, x + w + 0.15, top + l);
}

/** A ring: an annulus one cell across. */
function ring(s: Sheet, p: Piece, cx: number, cy: number) {
  s.line(circle(cx, cy, 0.42), p.tint);
  s.detail(circle(cx, cy, 0.24));
  s.box(cx - 0.42, cy - 0.42, cx + 0.42, cy + 0.42);
}

/** A bent piece on a haft: a sickle's hook, opening to the left. */
function hook(s: Sheet, p: Piece, top: number) {
  const { w, l } = p.kind;
  const ax = AXIS;
  s.line(
    `M${n(ax + 0.25)},${n(top + l)} Q${n(ax - w - 0.6)},${n(top + l * 0.35)} ${n(ax + w * 0.4)},${n(top)} ` +
      `Q${n(ax - w * 0.35)},${n(top + l * 0.4)} ${n(ax - 0.25)},${n(top + l * 0.85)} Z`,
    p.tint,
  );
  s.box(ax - w - 0.3, top, ax + w * 0.45, top + l);
}

/** A guard on the axis: a crossbar, a swept hilt, or a disc seen edge-on. */
function guard(s: Sheet, p: Piece, top: number) {
  const { w, l } = p.kind;
  const x = AXIS - w / 2;
  if (p.kind.id === 'boss') {
    s.line(ellipse(AXIS, top + l / 2, w / 2, Math.min(l, 0.7) / 2), p.tint);
  } else {
    const h = 0.5;
    const y = top + Math.min(l, 1) / 2 - h / 2;
    s.line(
      `M${n(x + 0.2)},${n(y)} H${n(x + w - 0.2)} Q${n(x + w + 0.05)},${n(y + h / 2)} ${n(x + w - 0.2)},${n(y + h)} H${n(x + 0.2)} ` +
        `Q${n(x - 0.05)},${n(y + h / 2)} ${n(x + 0.2)},${n(y)} Z`,
      p.tint,
    );
    // A swept guard curls down beside the grip by its length.
    if (l > 1) s.line(`M${n(x + w - 0.3)},${n(y + h)} Q${n(x + w + 0.35)},${n(top + l)} ${n(AXIS + 0.35)},${n(top + l + 0.25)}`);
  }
  s.box(x, top, x + w, top + l);
}

/**
 * A haft along the axis. A short grip gets wrap lines and, under a head, a
 * pommel; a pole gets a butt cap; a thick bar tapers like a club.
 */
function haft(s: Sheet, p: Piece, top: number, opts: { pommel: boolean; length?: number }) {
  const l = opts.length ?? p.kind.l;
  const w = p.kind.w;
  if (w >= 2) {
    const x = AXIS - w / 2;
    s.line(
      `M${n(x)},${n(top + 0.3)} Q${n(x)},${n(top)} ${n(AXIS)},${n(top)} Q${n(x + w)},${n(top)} ${n(x + w)},${n(top + 0.3)} ` +
        `L${n(AXIS + 0.3)},${n(top + l)} H${n(AXIS - 0.3)} Z`,
      p.tint,
    );
    s.box(x, top, x + w, top + l);
    return;
  }
  const width = l <= 4 ? 0.5 : 0.42;
  const x = AXIS - width / 2;
  s.line(rect(x, top, width, l), p.tint);
  if (l <= 4) {
    for (let y = top + 0.4; y < top + l - 0.1; y += 0.4) s.detail(segment(x, y + 0.15, x + width, y - 0.05));
    if (opts.pommel) {
      s.line(circle(AXIS, top + l + 0.28, 0.3));
      s.box(AXIS - 0.3, top, AXIS + 0.3, top + l + 0.6);
    }
  } else {
    s.line(rect(x - 0.05, top + l - 0.35, width + 0.1, 0.35));
  }
  s.box(x, top, x + width, top + l);
}

/** A binding on a weapon: cord or strap wound round the haft's top, drawn as diagonal turns. */
function wraps(s: Sheet, top: number, length: number) {
  const x = AXIS - 0.3;
  for (let y = top + 0.1; y < top + length - 0.05; y += 0.22) s.line(segment(x, y + 0.14, x + 0.6, y));
  s.box(x, top, x + 0.6, top + length);
}

// ---------- Layouts ----------

/** Expands a piece into its copies (rings and bent pairs count). */
const copies = (p: Piece) => Array.from({ length: p.qty }, () => p);

const isCrossHead = (p: Piece) => p.kind.cross === true;

/**
 * The drawing of a placement. Every billed part appears: a test removes each
 * part of every enumerated placement and checks the drawing changes.
 */
export function drawingOf(placement: Placement): Drawing {
  const s = new Sheet();
  const heads = [pieceOf(placement.head), pieceOf(placement.head2)].filter((p): p is Piece => !!p);
  const haftP = pieceOf(placement.haft);
  const guardP = pieceOf(placement.guard);
  const bindP = pieceOf(placement.bind);
  if (!heads.length && !haftP && !guardP && !bindP) return s.done();
  const cls = classifyPlacement(placement);
  const weaponLike = cls.slot === 'weapon' || cls.slot === 'offhand';

  if (cls.id === 'bow' && heads[0]) drawBow(s, heads, guardP, bindP);
  else if (cls.slot === 'offhand' && heads[0]?.kind.shape === 'plate') drawShield(s, heads, haftP, guardP, bindP);
  else if (weaponLike || !heads.length) drawStack(s, heads, haftP, guardP, bindP);
  else drawSideBySide(s, heads, guardP, bindP, cls);
  return s.done();
}

/** Weapons on one axis: tip heads on top, guard, haft; cross heads ride the haft's top; a second tip head points down from the haft's end. */
function drawStack(s: Sheet, heads: Piece[], haftP?: Piece, guardP?: Piece, bindP?: Piece) {
  const tipPieces = heads.filter((p) => !isCrossHead(p));
  const crosses = heads.filter(isCrossHead).flatMap(copies);
  const right = () => Math.max(AXIS + 1.2, s.maxX) + 0.35;
  // One bracket per part, spanning all its copies: "metal ring 1×1 ×8" once, not eight times.
  const spans: { piece: Piece; from: number; to: number; side: 'left' | 'right' }[] = [];
  const span = (piece: Piece, from: number, to: number, side: 'left' | 'right') => {
    const prev = spans.find((sp) => sp.piece === piece && sp.side === side);
    if (prev) {
      prev.from = Math.min(prev.from, from);
      prev.to = Math.max(prev.to, to);
    } else spans.push({ piece, from, to, side });
  };

  // The first tip head, every copy of it, stands on top; a second one points down from the haft's end.
  let y = 0;
  const first = tipPieces[0];
  if (first) {
    for (let i = 0; i < first.qty; i++) {
      drawTip(s, first, y, false);
      span(first, y, y + first.kind.l, 'right');
      y += first.kind.l;
    }
  }
  const tips = tipPieces.slice(1).flatMap(copies);
  if (guardP) {
    guard(s, guardP, y);
    span(guardP, y, y + guardP.kind.l, 'right');
    y += guardP.kind.l;
  }
  // Cross heads sit on the haft's top end; with nothing above them, the haft pokes through.
  const crossTop = y;
  const haftTop = crosses.length && !first && !guardP ? 0.15 : y;
  let end = y;
  let cy = crossTop;
  for (const c of crosses) {
    if (c.kind.shape === 'mass') maulHead(s, c, cy);
    else axeHead(s, c, cy);
    span(c, cy, cy + c.kind.l, 'left');
    cy += c.kind.l + 0.15;
    end = Math.max(end, cy);
  }
  if (haftP) {
    // A grip under a blade ends in a pommel unless a second blade points down from it.
    haft(s, haftP, haftTop, { pommel: !!first && tips.length === 0 && haftP.kind.l <= 4 });
    span(haftP, haftTop, haftTop + haftP.kind.l, 'right');
    if (bindP) wraps(s, haftTop, Math.min(bindP.kind.l, haftP.kind.l));
    end = Math.max(end, haftTop + haftP.kind.l);
  } else if (bindP) {
    // No haft: the cord or strap is wound below whatever is there.
    wraps(s, end, bindP.kind.l);
    end += bindP.kind.l;
  }
  if (bindP) {
    const from = haftP ? haftTop : end - bindP.kind.l;
    span(bindP, from, from + bindP.kind.l, 'left');
  }
  // The second tip head points down from the haft's end; its copies continue below it.
  for (const t of tips) {
    drawTip(s, t, end, true);
    span(t, end, end + t.kind.l, 'right');
    end += t.kind.l;
  }
  // Brackets: right-hand ones in a column clear of the drawing, left-hand ones clear of the cross heads.
  const rx = right();
  const lx = Math.min(AXIS - 1.2, s.minX) - 0.35;
  for (const sp of spans) {
    s.measure({ from: sp.from, to: sp.to, at: sp.side === 'right' ? rx : lx, side: sp.side, label: sizeLabel(sp.piece) });
  }
}

/** A head that sits on the axis: blade, curved blade, spearhead, ring, hook or plate. */
function drawTip(s: Sheet, p: Piece, top: number, down: boolean) {
  const x = AXIS - p.kind.w / 2;
  switch (p.kind.shape) {
    case 'edge':
      if (p.kind.curved) curvedBlade(s, p, x, top, down);
      else blade(s, p, x, top, down);
      return;
    case 'point':
      spearhead(s, p, x, top, down);
      return;
    case 'ring':
      ring(s, p, AXIS, top + 0.5);
      return;
    case 'bent':
      hook(s, p, top);
      return;
    case 'plate':
      plate(s, p, x, top);
      return;
    default:
      s.line(rect(x, top, p.kind.w, p.kind.l), p.tint);
      s.box(x, top, x + p.kind.w, top + p.kind.l);
  }
}

/** A shield in two views: the face with the grip behind it as a hidden line, and the side with the grip on the back. */
function drawShield(s: Sheet, heads: Piece[], haftP: Piece | undefined, guardP: Piece | undefined, bindP: Piece | undefined) {
  const face = heads[0];
  const { w, l } = face.kind;
  const x = AXIS - w / 2;
  shieldFace(s, face, x, 0);
  // The boss is the guard seen from the front; without one, a plain centre rivet.
  if (guardP) {
    s.line(ellipse(AXIS, l * 0.42, guardP.kind.w / 2.6, guardP.kind.l / 2.6), guardP.tint);
  }
  // A blade on a shield's rim, pointing up.
  let rimTop = 0;
  let layers = 0;
  for (const b of heads.slice(1)) {
    if (b.kind.shape === 'plate') {
      // A second plate doubles the face: drawn behind it, offset, with its own bracket.
      layers++;
      const off = 0.3 * layers;
      s.detail(roundRect(x + off, off, b.kind.w, b.kind.l, 0.2));
      s.box(x + off, off, x + off + b.kind.w, off + b.kind.l);
      s.measure({ from: x + off, to: x + off + b.kind.w, at: Math.max(l + 0.6, s.maxY + 0.25) + 0.9 * layers, side: 'below', label: sizeLabel(b) });
      continue;
    }
    // Anything else on the rim stands on it, every copy stacked, under one bracket.
    const bottom = rimTop;
    for (let i = 0; i < b.qty; i++) {
      rimTop -= b.kind.l;
      drawTip(s, b, rimTop, false);
    }
    s.measure({ from: rimTop, to: bottom, at: x + w + 0.35, side: 'right', label: sizeLabel(b) });
  }
  // The grip behind the face, dashed: centred, as long as it is.
  if (haftP) {
    const gl = haftP.kind.l;
    const gy = l / 2 - gl / 2;
    s.hidden(rect(AXIS - 0.22, gy, 0.44, gl));
    s.box(AXIS - 0.22, gy, AXIS + 0.22, gy + gl);
  }
  s.measure({ from: x, to: x + w, at: Math.max(l + 0.6, s.maxY + 0.25), side: 'below', label: sizeLabel(face) });

  // Side view: the face edge-on, the grip standing off its back.
  const sx = x + w + 2.6;
  const depth = 0.32;
  s.line(`M${n(sx)},${n(0)} Q${n(sx - 0.35)},${n(l / 2)} ${n(sx)},${n(l)} h${n(depth)} Q${n(sx + depth - 0.35)},${n(l / 2)} ${n(sx + depth)},${n(0)} Z`, face.tint);
  s.box(sx - 0.35, 0, sx + depth, l);
  if (guardP) s.line(`M${n(sx - 0.15)},${n(l * 0.42 - 0.35)} Q${n(sx - 0.7)},${n(l * 0.42)} ${n(sx - 0.15)},${n(l * 0.42 + 0.35)}`, guardP.tint);
  if (haftP) {
    const gl = haftP.kind.l;
    const gy = l / 2 - gl / 2;
    const gx = sx + depth + 0.45;
    s.line(`M${n(sx + depth)},${n(gy)} H${n(gx)} V${n(gy + gl)} H${n(sx + depth)}`, haftP.tint);
    if (bindP) wrapsAt(s, gx - 0.15, gy, Math.min(bindP.kind.l, gl));
    s.box(sx + depth, gy, gx + 0.1, gy + gl);
    s.measure({ from: gy, to: gy + gl, at: gx + 0.4, side: 'right', label: sizeLabel(haftP) });
  } else if (bindP) {
    wrapsAt(s, sx + depth + 0.2, 0.2, bindP.kind.l);
    s.box(sx + depth, 0.2, sx + depth + 0.6, 0.2 + bindP.kind.l);
  }
  if (guardP) s.measure({ from: sx - 1.2, to: sx - 1.2 + guardP.kind.w, at: s.maxY + 0.25, side: 'below', label: sizeLabel(guardP) });
  if (bindP) s.measure({ from: sx, to: sx + 1, at: s.maxY + 0.25, side: 'below', label: sizeLabel(bindP) });
  // Both captions on one line above everything drawn.
  const captionY = Math.min(rimTop, s.minY) - 0.3;
  s.caption({ x, y: captionY, text: 'Front' });
  s.caption({ x: sx - 0.4, y: captionY, text: 'Side' });
}

/** Wound turns at a given x, for a grip seen from the side. */
function wrapsAt(s: Sheet, x: number, top: number, length: number) {
  for (let y = top + 0.1; y < top + length - 0.05; y += 0.22) s.line(segment(x, y + 0.12, x + 0.3, y));
  s.box(x, top, x + 0.3, top + length);
}

/** A bow: the limb as two curves, the string from tip to tip, a grip at the middle; anything else billed hangs below. */
function drawBow(s: Sheet, heads: Piece[], guardP?: Piece, bindP?: Piece) {
  const limb = heads[0];
  const L = limb.kind.l + 1;
  const tipX = limb.kind.w;
  s.line(`M${n(tipX)},${n(0)} Q${n(-tipX * 0.9)},${n(L / 2)} ${n(tipX)},${n(L)} Q${n(-tipX * 0.55)},${n(L / 2)} ${n(tipX)},${n(0)} Z`, limb.tint);
  s.box(-tipX * 0.1, 0, tipX, L);
  s.line(rect(-0.05, L / 2 - 0.45, 0.35, 0.9));
  if (bindP) {
    s.line(segment(tipX, 0, tipX, L), bindP.tint);
    s.measure({ from: 0, to: L, at: tipX + 0.4, side: 'right', label: sizeLabel(bindP) });
  }
  s.measure({ from: -0.3, to: tipX, at: L + 0.35, side: 'below', label: sizeLabel(limb) });
  let y = L + 1.6;
  // Everything else hangs below, one bracket per part in one column: a second limb (its
  // count is already on the limb's bracket), then the second head's copies, then the guard.
  const extras = heads.slice(1);
  const col = Math.max(tipX, ...extras.map((h) => AXIS + h.kind.w / 2), guardP ? AXIS + guardP.kind.w / 2 : 0) + 0.45;
  const hang = (h: Piece) => {
    if (isCrossHead(h)) {
      if (h.kind.shape === 'mass') maulHead(s, h, y);
      else axeHead(s, h, y);
    } else drawTip(s, h, y, false);
    y += h.kind.l + 0.3;
  };
  for (let i = 1; i < limb.qty; i++) hang(limb);
  for (const h of extras) {
    const from = y;
    for (let i = 0; i < h.qty; i++) hang(h);
    s.measure({ from, to: y - 0.3, at: col, side: 'right', label: sizeLabel(h) });
  }
  if (guardP) {
    guard(s, guardP, y);
    s.measure({ from: y, to: y + guardP.kind.l, at: col, side: 'right', label: sizeLabel(guardP) });
  }
}

/** Armour and jewellery: pieces left to right, a guard beside them, a strap across or a cord above. */
function drawSideBySide(s: Sheet, heads: Piece[], guardP: Piece | undefined, bindP: Piece | undefined, cls: ItemClassDef) {
  let x = 0;
  let rings = 0;
  let ringX = 0;
  let tallest = 0;
  const below: { piece: Piece; from: number; to: number }[] = [];
  /** Every piece a strap can go on: each gets its own (the user: a strap is sized for one piece, not tying two together). */
  const strapped: { x: number; w: number; l: number }[] = [];
  for (const h of heads) {
    if (h.kind.shape === 'ring') {
      if (rings === 0) ringX = x;
      const startX = ringX;
      for (let i = 0; i < h.qty; i++) {
        const k = rings + i;
        // Rows of four, every other row shifted half a ring: the links interlock.
        const row = Math.floor(k / 4);
        ring(s, h, startX + 0.5 + (k % 4) * 0.78 + (row % 2) * 0.39, 0.5 + row * 0.72);
      }
      rings += h.qty;
      tallest = Math.max(tallest, 0.5 + Math.floor((rings - 1) / 4) * 0.72 + 0.5);
      below.push({ piece: h, from: startX, to: startX + Math.min(4, Math.max(1, rings)) * 0.78 + 0.3 });
      x = startX + 4 * 0.78 + 0.9;
      continue;
    }
    const from = x;
    for (let i = 0; i < h.qty; i++) {
      if (h.kind.shape === 'plate') {
        if (cls.id === 'breastplate') cuirass(s, h, x, 0);
        else plate(s, h, x, 0);
      } else if (h.kind.shape === 'bent') bentPiece(s, h, x, 0, cls);
      else {
        // A weapon head among armour (a degenerate form): drawn upright at its size.
        drawTipAt(s, h, x, 0);
      }
      strapped.push({ x, w: h.kind.w, l: h.kind.l });
      tallest = Math.max(tallest, h.kind.l);
      x += h.kind.w + 0.6;
    }
    below.push({ piece: h, from, to: x - 0.6 });
  }
  if (guardP) {
    const gx = x;
    s.line(roundRect(gx, 0, guardP.kind.w, Math.max(0.5, guardP.kind.l), 0.2), guardP.tint);
    s.box(gx, 0, gx + guardP.kind.w, guardP.kind.l);
    below.push({ piece: guardP, from: gx, to: gx + guardP.kind.w });
    x += guardP.kind.w + 0.6;
    tallest = Math.max(tallest, guardP.kind.l);
  }
  if (bindP) {
    if (heads[0]?.kind.shape === 'ring') {
      // A cord hung above the rings.
      const first = ringX + 0.5;
      const last = ringX + 0.5 + (Math.min(Math.max(rings, 1), 4) - 1) * 0.78;
      const mid = (first + last) / 2;
      const half = Math.max(1.6, (last - first) / 2 + 1.1);
      s.line(`M${n(mid - half)},${n(-2.2)} Q${n(mid)},${n(2.4)} ${n(mid + half)},${n(-2.2)}`);
      s.box(mid - half, -2.2, mid + half, 0.2);
    } else if (strapped.length) {
      // One strap per piece, fitted to it: a helm's runs under the chin, a boot's
      // round the ankle, a gauntlet's round the wrist, a plate's across the middle.
      for (const p of strapped) strapOn(s, bindP, p, cls);
    } else {
      // Nothing to strap (a guard alone): the strap lies on its own, at its length.
      s.line(rect(0, tallest + 0.4, bindP.kind.l, 0.35), bindP.tint);
      s.box(0, tallest + 0.4, bindP.kind.l, tallest + 0.75);
    }
    const first = strapped[0];
    below.push({ piece: bindP, from: first ? first.x : 0, to: first ? first.x + first.w : bindP.kind.l });
  }
  // One row per bracket: a piece's label never runs into its neighbour's.
  const at = s.maxY + 0.3;
  below.forEach((b, row) => {
    s.measure({ from: b.from, to: b.to, at: at + row * 1.1, side: 'below', label: sizeLabel(b.piece) });
  });
}

/** A strap fitted to one piece, with a buckle, placed where that kind of piece is fastened. */
function strapOn(s: Sheet, bindP: Piece, p: { x: number; w: number; l: number }, cls: ItemClassDef) {
  const band = 0.3;
  if (cls.id === 'helm') {
    // A chin strap: hung from both sides of the helm's rim.
    s.line(`M${n(p.x + 0.15)},${n(p.l - 0.1)} Q${n(p.x + p.w / 2)},${n(p.l + 1.1)} ${n(p.x + p.w - 0.15)},${n(p.l - 0.1)}`);
    s.line(rect(p.x + p.w / 2 - 0.15, p.l + 0.32, 0.3, 0.3));
    s.box(p.x, p.l - 0.1, p.x + p.w, p.l + 0.7);
    return;
  }
  // Where the piece is fastened, as a share of its length from the top.
  const at = cls.id === 'boots' ? 0.32 : cls.id === 'gauntlets' ? 0.78 : 0.55;
  // A boot's strap goes round its shaft, which is the narrower part of it.
  const w = cls.id === 'boots' ? p.w * 0.62 : p.w;
  const y = p.l * at - band / 2;
  s.line(rect(p.x - 0.12, y, w + 0.24, band), bindP.tint);
  s.line(rect(p.x + w / 2 - 0.16, y - 0.08, 0.32, band + 0.16));
  s.box(p.x - 0.12, y - 0.08, p.x + w + 0.12, y + band + 0.08);
}

/** A weapon head drawn upright at a given x (for degenerate armour forms). */
function drawTipAt(s: Sheet, p: Piece, x: number, top: number) {
  if (p.kind.shape === 'edge' && !p.kind.cross) {
    if (p.kind.curved) curvedBlade(s, p, x, top);
    else blade(s, p, x, top);
  } else if (p.kind.shape === 'point') spearhead(s, p, x, top);
  else {
    s.line(roundRect(x, top, p.kind.w, p.kind.l, 0.25), p.tint);
    s.box(x, top, x + p.kind.w, top + p.kind.l);
  }
}

