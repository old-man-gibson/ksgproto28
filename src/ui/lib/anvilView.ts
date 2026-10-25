/**
 * What the anvil screens need that is not a click handler: the silhouette's
 * geometry, the stat lines, the form chart's cells, the material choices.
 * Pure functions over the registries and a placement, so the panels stay thin
 * and tests/anvilview.test.ts can pin them without a DOM.
 *
 * The resolver and the kernel are core (systems/assembly.ts, systems/forging.ts);
 * nothing here decides what a placement IS or what it is worth.
 */
import type {
  ForgeSlot,
  ItemClassDef,
  MaterialDef,
  Modifier,
  PartKindDef,
  PlacedPart,
  Placement,
  SlotId,
} from '../../core/types';
import { ITEM_CLASSES, MATERIALS, PART_KINDS } from '../../core/registry';
import { FORGE_SLOTS } from '../../core/data/parts.data';
import { classifyPlacement, type ForgeNeighbour, type ForgeStats } from '../../core/systems/assembly';
import { describeMod } from './format';

// ---------- Materials ----------

/** Materials the anvil can work: a smith profile, and not a graded stock. */
export function forgeableMaterials(): MaterialDef[] {
  return Object.values(MATERIALS).filter((m) => m.smith && !m.graded);
}

/**
 * The forgeable materials a part kind accepts, in the order the kind lists its
 * tags (a haft lists 'wood' before 'metal', so wood comes first), then in
 * registry order within a tag.
 */
export function materialsFor(kind: PartKindDef): MaterialDef[] {
  const out: MaterialDef[] = [];
  for (const tag of kind.accepts) {
    for (const m of forgeableMaterials()) {
      if (m.craftTags?.includes(tag) && !out.includes(m)) out.push(m);
    }
  }
  return out;
}

/** The first forgeable material carrying a tag: the stand-in for "any metal". */
export function stockMaterial(tag: string): MaterialDef | undefined {
  return forgeableMaterials().find((m) => m.craftTags?.includes(tag));
}

/**
 * The materials to offer for a part kind: those in the pack, plus whatever is
 * already in the slot. A player who holds only iron and hardwood is not shown
 * a metal they have never seen. When nothing accepted is held, one stand-in
 * per accepted tag (iron for 'metal') is offered as well, even if the slot's
 * own material is present, so a player is never left on one material they do
 * not have.
 */
export function offeredMaterials(kind: PartKindDef, held: Record<string, number>, current?: string): MaterialDef[] {
  const all = materialsFor(kind);
  const holds = (m: MaterialDef) => (held[m.id] ?? 0) > 0;
  const shown = new Set(all.filter((m) => holds(m) || m.id === current));
  if (!all.some(holds)) {
    for (const tag of kind.accepts) {
      const m = stockMaterial(tag);
      if (m && all.includes(m)) shown.add(m);
    }
  }
  // Canonical order, whatever order they were added in.
  return all.filter((m) => shown.has(m));
}

/**
 * The material a freshly chosen part kind takes: the first of `prefer` that
 * the kind accepts, else the first it lists (a haft is hardwood before it is
 * iron). Holdings do not decide it: a missing material is a line in the bill,
 * not a reason to swap a handle for an iron bar.
 */
export function pickMaterial(kind: PartKindDef, prefer: (string | undefined)[]): string | undefined {
  const all = materialsFor(kind);
  for (const id of prefer) {
    if (id && all.some((m) => m.id === id)) return id;
  }
  return all[0]?.id;
}

/**
 * The colour token a material is drawn in. Read off its tags, not its id, so
 * a steel ingot added later colours itself; an unknown metal gets the plain
 * metal token. The tokens are in app.css; no theme overrides them (a material
 * is the same colour wherever it is drawn).
 */
export function materialColor(matId: string): string {
  const tags = MATERIALS[matId]?.craftTags ?? [];
  for (const t of ['steel', 'bronze', 'iron', 'wood', 'leather']) {
    if (tags.includes(t)) return `var(--mat-${t})`;
  }
  return tags.includes('metal') ? 'var(--mat-metal)' : 'var(--text-dim)';
}

// ---------- Text ----------

/** A kind as the pickers write it: "Long blade 2×6". */
export function kindLabel(kind: PartKindDef): string {
  return `${kind.name} ${kind.w}×${kind.l}`;
}

/** One placed part as a line: "Metal ring 1×1 ×8 (Iron)". */
export function partText(part: PlacedPart): string {
  const kind = PART_KINDS[part.kind];
  const mat = MATERIALS[part.mat]?.smith?.label ?? MATERIALS[part.mat]?.name ?? part.mat;
  const qty = (part.qty ?? 1) > 1 ? ` ×${part.qty}` : '';
  return `${kind ? kindLabel(kind) : part.kind}${qty} (${mat})`;
}

/** The parts of a placement in slot order, joined: what a recipe line shows under its name. */
export function placementText(placement: Placement): string {
  const bits: string[] = [];
  for (const slot of FORGE_SLOTS) {
    const part = placement[slot];
    if (part) bits.push(partText(part));
  }
  return bits.join(' + ');
}

const SIGN = (v: number) => (v >= 0 ? '+' : '−');

/** A signed whole percent: +8%, −5%. */
function signedPct(v: number, digits = 0): string {
  return `${SIGN(v)}${Math.abs(v * 100).toFixed(digits)}%`;
}

/** Stats the kernel owns; a modifier on any other stat is the material's own. */
const KERNEL_STATS = new Set(['damage', 'attackSpeed', 'crit', 'critDamage', 'armor']);

export interface StatLine {
  label: string;
  value: string;
}

/**
 * The numbers an anvil piece would carry, at the grade the stats were drawn
 * at. Stats that do not apply to the form are absent (a helm has no damage).
 * `mods` are the definition's modifiers, so a material's own character (what
 * bronze adds to psionics) is listed after the kernel's numbers.
 */
export function statLines(stats: ForgeStats, mods: Modifier[]): StatLine[] {
  const lines: StatLine[] = [];
  if (stats.damage !== undefined) lines.push({ label: 'Damage', value: `+${stats.damage}` });
  if (stats.armour !== undefined) lines.push({ label: 'Armour', value: `+${stats.armour}` });
  if (Math.abs(stats.attackSpeed) >= 0.005) lines.push({ label: 'Attack speed', value: signedPct(stats.attackSpeed) });
  if (stats.crit !== undefined && stats.crit >= 0.0005) {
    lines.push({ label: 'Crit chance', value: signedPct(stats.crit, 1) });
  }
  if (stats.critDamage >= 0.005) lines.push({ label: 'Crit damage', value: signedPct(stats.critDamage) });
  if (stats.damage === undefined && stats.armour === undefined) lines.push({ label: 'Base stats', value: 'none' });
  for (const m of mods) {
    if (!KERNEL_STATS.has(m.stat)) lines.push({ label: 'Material', value: describeMod(m) });
  }
  lines.push({ label: 'Weight', value: stats.weight.toFixed(1) });
  lines.push({ label: 'Cells', value: String(stats.cells) });
  return lines;
}

// ---------- One change away ----------

/** "Long blade 2×6" for a swap or an addition, "no haft" for a removal, "Metal ring ×5" for a count. */
export function neighbourLabel(n: ForgeNeighbour, slotName: string): string {
  const kind = n.part ? PART_KINDS[n.part.kind] : undefined;
  if (n.change === 'remove') return `no ${slotName.toLowerCase()}`;
  if (!kind) return slotName;
  if (n.change === 'qty') return `${kind.name} ×${n.part?.qty ?? 1}`;
  const label = kindLabel(kind);
  return n.change === 'add' ? `+ ${slotName.toLowerCase()}: ${label}` : label;
}

/**
 * The single edits worth showing: one per distinct product, the first found,
 * and none that touch a slot this smith cannot use yet.
 */
export function distinctNeighbours(list: ForgeNeighbour[], locks: Partial<Record<ForgeSlot, number>>): ForgeNeighbour[] {
  const seen = new Set<string>();
  const out: ForgeNeighbour[] = [];
  for (const n of list) {
    if (locks[n.slot] !== undefined || seen.has(n.to.id)) continue;
    seen.add(n.to.id);
    out.push(n);
  }
  return out;
}

// ---------- Silhouette ----------

/** A drawn piece, in cell units: one unit is one cell of a part. */
export type Shape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { t: 'ring'; cx: number; cy: number; r: number; stroke: string }
  | { t: 'poly'; points: [number, number][]; fill: string }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string }
  | { t: 'arc'; x1: number; y1: number; cx: number; cy: number; x2: number; y2: number; stroke: string };

export interface Silhouette {
  shapes: Shape[];
  /** Bounds in cell units. Empty placements get a unit box. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** A part resolved for drawing: kind, material colour, copies. */
interface Piece {
  kind: PartKindDef;
  color: string;
  qty: number;
}

function pieceOf(part: PlacedPart | undefined): Piece | undefined {
  const kind = part ? PART_KINDS[part.kind] : undefined;
  if (!part || !kind) return undefined;
  const qty = Math.max(1, Math.min(kind.qtyMax ?? 1, Math.floor(part.qty ?? 1) || 1));
  return { kind, color: materialColor(part.mat), qty };
}

/**
 * The placement as cells. Weapons and shields stack head, guard and haft down
 * one axis; armour and jewellery lay their pieces side by side; a bow is
 * drawn as an arc with its string. One rect per cell, rings as circles, a
 * curved blade sheared toward its tip.
 */
export function silhouetteOf(placement: Placement): Silhouette {
  const shapes: Shape[] = [];
  const cell = (x: number, y: number, fill: string) => shapes.push({ t: 'rect', x, y, w: 1, h: 1, fill });
  const heads = [pieceOf(placement.head), pieceOf(placement.head2)].filter((p): p is Piece => !!p);
  const haft = pieceOf(placement.haft);
  const guard = pieceOf(placement.guard);
  const bind = pieceOf(placement.bind);
  const cls = classifyPlacement(placement);
  const weaponLike = cls.slot === 'weapon' || cls.slot === 'offhand';

  /** Stack one head part (every copy of it) down the axis from row `y`; returns the next free row. */
  const stackHead = (h: Piece, from: number): number => {
    let y = from;
    for (let copy = 0; copy < h.qty; copy++) {
      if (h.kind.shape === 'ring') {
        shapes.push({ t: 'ring', cx: 0.5, cy: y + 0.5, r: 0.38, stroke: h.color });
        y += 1;
        continue;
      }
      // A head mounted across the haft (an axe) hangs to one side of it.
      const x0 = h.kind.cross && h.kind.shape === 'edge' ? 1 - h.kind.w : -Math.floor((h.kind.w - 1) / 2);
      for (let r = 0; r < h.kind.l; r++) {
        const shear = h.kind.curved
          ? Math.round(Math.pow((h.kind.l - 1 - r) / Math.max(1, h.kind.l - 1), 2) * 2)
          : 0;
        const x = x0 + shear;
        if (h.kind.shape === 'point' && r === 0) {
          shapes.push({ t: 'poly', points: [[x, y + 1], [x + 0.5, y - 0.6], [x + 1, y + 1]], fill: h.color });
          continue;
        }
        // The tip of a plain blade is a cell narrower than the body.
        const width = h.kind.shape === 'edge' && !h.kind.cross && r === 0 && h.kind.w > 1 ? h.kind.w - 1 : h.kind.w;
        for (let c = 0; c < width; c++) cell(x + c, y + r, h.color);
      }
      y += h.kind.l;
    }
    return y;
  };
  /** Stack a guard or a haft below row `y`, centred on the axis; returns the next free row. */
  const stackBar = (part: Piece, y: number): number => {
    const x0 = -Math.floor((part.kind.w - 1) / 2);
    for (let r = 0; r < part.kind.l; r++) for (let c = 0; c < part.kind.w; c++) cell(x0 + c, y + r, part.color);
    return y + part.kind.l;
  };

  if (cls.id === 'bow' && heads[0]) {
    const h = heads[0];
    const offsets = [2, 1, 0, 0, 0, 1, 2];
    const length = h.kind.l + 2;
    for (let r = 0; r < length; r++) {
      cell(offsets[Math.round((r / (length - 1)) * (offsets.length - 1))], r, h.color);
    }
    if (bind) shapes.push({ t: 'line', x1: 2.5, y1: 0, x2: 2.5, y2: length, stroke: bind.color });
    // The bow rule reads the first head only: whatever else is billed hangs below the bow.
    let y = length;
    for (const extra of heads.slice(1)) y = stackHead(extra, y);
    if (guard) stackBar(guard, y);
  } else if (weaponLike || heads.length === 0) {
    let y = 0;
    for (const h of heads) y = stackHead(h, y);
    for (const part of [guard, haft]) if (part) y = stackBar(part, y);
    // A binding wraps the grip: drawn as a strip beside the piece.
    if (bind) for (let r = 0; r < bind.kind.l; r++) cell(3, r, bind.color);
  } else {
    let x = 0;
    // Rings from both head slots share one run of four to a row, starting where the first ring would sit.
    let rings = 0;
    let ringX = 0;
    for (const h of heads) {
      for (let copy = 0; copy < h.qty; copy++) {
        if (h.kind.shape === 'ring') {
          if (rings === 0) ringX = x;
          shapes.push({
            t: 'ring',
            cx: ringX + (rings % 4) * 1.1 + 0.5,
            cy: Math.floor(rings / 4) * 1.1 + 0.5,
            r: 0.4,
            stroke: h.color,
          });
          rings++;
          continue;
        }
        for (let r = 0; r < h.kind.l; r++) {
          for (let c = 0; c < h.kind.w; c++) {
            // A bent piece has its top corners curled in.
            if (h.kind.shape === 'bent' && r === 0 && (c === 0 || c === h.kind.w - 1) && h.kind.w > 1) continue;
            cell(x + c, r, h.color);
          }
        }
        x += h.kind.w + 1;
      }
      if (h.kind.shape === 'ring') x = ringX + 5;
    }
    // A guard stands beside the piece, in the first free column.
    if (guard) {
      for (let r = 0; r < guard.kind.l; r++) for (let c = 0; c < guard.kind.w; c++) cell(x + c, r, guard.color);
    }
    if (bind) {
      if (heads[0]?.kind.shape === 'ring') {
        // A cord hung from above, the rings on it: a curve centred on the first row of rings.
        const first = ringX + 0.5;
        const last = ringX + (Math.min(rings, 4) - 1) * 1.1 + 0.5;
        const mid = (first + last) / 2;
        const half = Math.max(1.8, (last - first) / 2 + 1.3);
        shapes.push({ t: 'arc', x1: mid - half, y1: -2.6, cx: mid, cy: 2.8, x2: mid + half, y2: -2.6, stroke: bind.color });
      } else {
        const across = Math.max(bind.kind.l, x - 1);
        for (let c = 0; c < across; c++) {
          shapes.push({ t: 'rect', x: c, y: Math.floor((heads[0]?.kind.l ?? 2) / 2), w: 1, h: 0.45, fill: bind.color });
        }
      }
    }
  }

  return { shapes, ...boundsOf(shapes) };
}

/** Bounds of the shapes in cell units, stroke widths included; a unit box when there are none. */
function boundsOf(shapes: Shape[]): Pick<Silhouette, 'minX' | 'minY' | 'maxX' | 'maxY'> {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const take = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const s of shapes) {
    if (s.t === 'rect') {
      take(s.x, s.y);
      take(s.x + s.w, s.y + s.h);
    } else if (s.t === 'ring') {
      take(s.cx - s.r - 0.12, s.cy - s.r - 0.12);
      take(s.cx + s.r + 0.12, s.cy + s.r + 0.12);
    } else if (s.t === 'poly') {
      for (const [x, y] of s.points) take(x, y);
    } else if (s.t === 'line') {
      take(s.x1 - 0.1, s.y1);
      take(s.x2 + 0.1, s.y2);
    } else {
      // A quadratic curve peaks halfway between its ends and its control point.
      take(s.x1, s.y1);
      take(s.x2, s.y2);
      take(s.cx, (s.y1 + s.cy) / 2);
    }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

// ---------- Form chart ----------

/** What the chart's selectors hold. */
export interface ChartSetup {
  guard: string | null;
  bind: string | null;
  /** Copies of a head that takes several (rings, bent pieces), clamped to the kind's maximum. */
  count: number;
}

/** One class a chart cell resolves to, and the placement that shows it. */
export interface ChartEntry {
  cls: ItemClassDef;
  placement: Placement;
}

/**
 * What a head kind and a haft kind resolve to under the chart's settings. A
 * head that accepts more than one kind of material (a long bent piece is wood
 * or metal) can resolve to more than one class, because the bow rule reads the
 * head's material; each distinct class gets its own entry. A cell with nothing
 * in it at all (no head, no haft, no guard, no binding) is not forgeable and
 * has no entries.
 */
export function chartEntries(head: string | null, haft: string | null, setup: ChartSetup): ChartEntry[] {
  const headKind = head ? PART_KINDS[head] : undefined;
  const haftKind = haft ? PART_KINDS[haft] : undefined;
  const guardKind = setup.guard ? PART_KINDS[setup.guard] : undefined;
  const bindKind = setup.bind ? PART_KINDS[setup.bind] : undefined;
  if (!headKind && !haftKind && !guardKind && !bindKind) return [];

  const stand = (kind: PartKindDef, tag: string | undefined): PlacedPart | undefined => {
    const mat = tag ? stockMaterial(tag) : undefined;
    return mat ? { kind: kind.id, mat: mat.id } : undefined;
  };

  // The head is tried in one stand-in material per accepted tag.
  const headTags: (string | undefined)[] = headKind ? headKind.accepts : [undefined];
  const out: ChartEntry[] = [];
  for (const tag of headTags) {
    const placement: Placement = {};
    if (headKind) {
      const part = stand(headKind, tag);
      if (part) {
        const qty = Math.max(1, Math.min(headKind.qtyMax ?? 1, setup.count));
        placement.head = qty > 1 ? { ...part, qty } : part;
      }
    }
    const haftPart = haftKind ? stand(haftKind, haftKind.accepts[0]) : undefined;
    if (haftPart) placement.haft = haftPart;
    const guardPart = guardKind ? stand(guardKind, guardKind.accepts[0]) : undefined;
    if (guardPart) placement.guard = guardPart;
    const bindPart = bindKind ? stand(bindKind, bindKind.accepts[0]) : undefined;
    if (bindPart) placement.bind = bindPart;
    const cls = classifyPlacement(placement);
    if (!out.some((e) => e.cls.id === cls.id)) out.push({ cls, placement });
  }
  return out;
}

/**
 * A chart placement dressed in the materials the anvil already holds, where
 * the part still accepts them and the product does not change (the bow rule
 * needs a wooden head, so a head's material is kept when swapping it would
 * change the class).
 */
export function adaptMaterials(placement: Placement, anvil: Placement): Placement {
  const target = classifyPlacement(placement).id;
  const next: Placement = {};
  for (const slot of FORGE_SLOTS) {
    const part = placement[slot];
    const kind = part ? PART_KINDS[part.kind] : undefined;
    if (!part || !kind) continue;
    // A head follows the anvil's head; a haft or binding keeps its own material.
    const follow = kind.role === 'head' ? anvil.head?.mat : undefined;
    const mat = pickMaterial(kind, [anvil[slot]?.mat, follow, part.mat]) ?? part.mat;
    next[slot] = { ...part, mat };
  }
  return classifyPlacement(next).id === target ? next : placement;
}

/** Cells of one material across the whole placement, quantities counted: what the bill rounds up from. */
export function cellsOfMaterial(placement: Placement, matId: string): number {
  let cells = 0;
  for (const slot of FORGE_SLOTS) {
    const part = placement[slot];
    const kind = part ? PART_KINDS[part.kind] : undefined;
    if (part && kind && part.mat === matId) cells += kind.w * kind.l * (part.qty ?? 1);
  }
  return cells;
}

/** The slots of the piece the chart shows against the anvil's: kinds and counts, not materials. */
export function sameShape(a: Placement, b: Placement): boolean {
  return FORGE_SLOTS.every((slot: ForgeSlot) => {
    const x = a[slot];
    const y = b[slot];
    if (!x || !y) return !x && !y;
    return x.kind === y.kind && (x.qty ?? 1) === (y.qty ?? 1);
  });
}

/** Display order of equipment slots for the list of known forms. */
const SLOT_ORDER: SlotId[] = ['weapon', 'offhand', 'head', 'chest', 'hands', 'legs', 'feet', 'back', 'accessory'];

/** Every class, weapons first, then by the order the resolver tries them. */
export function classesForIndex(): ItemClassDef[] {
  const rank = (s: SlotId) => {
    const i = SLOT_ORDER.indexOf(s);
    return i < 0 ? SLOT_ORDER.length : i;
  };
  return Object.values(ITEM_CLASSES).sort((a, b) => rank(a.slot) - rank(b.slot) || b.priority - a.priority);
}
