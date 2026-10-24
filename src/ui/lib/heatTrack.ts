import type { CraftDisciplineDef, CraftOutcomeDef, CraftSlotDef, GameState, GradedStack } from '../../core/types';
import { MATERIALS } from '../../core/registry';
import { exposureInfo, type CookCheck, type ExposureInfo } from '../../core/systems/cooking';
import {
  describeHeatWindow,
  knowsRecipe,
  matchOutcome,
  meanExposure,
  skillLevel,
  type Placement,
} from '../../core/systems/disciplines';

/**
 * What the heat track (lib/HeatTrack.svelte) draws, worked out from the
 * core's read functions. Nothing here changes game state, and nothing here
 * decides what a cook does: `exposureInfo`, `meanExposure` and `matchOutcome`
 * do, and this only lays their answers out along a time axis.
 */

/** The player's words for an `ExposureInfo.verdict`. */
export const COOKED_WORDS: Record<ExposureInfo['verdict'], string> = {
  'in its element': 'cooked right',
  undercooked: 'not cooked enough',
  overcooked: 'overcooked',
};

/** The longest cook the bench offers: the right edge of the time axis. */
export function axisMax(disc: CraftDisciplineDef, duration = 0): number {
  const longest = Math.max(0, ...(disc.timeline?.options.map((o) => o.units) ?? []));
  return Math.max(longest, duration);
}

// ---------- Rows: one per timed slot ----------

export type ZoneKind = 'raw' | 'ready' | 'burnt';

/** One stretch of a part's bar, in units from the start of the cook. */
export interface Zone {
  kind: ZoneKind;
  from: number;
  to: number;
}

export interface TrackRow {
  slot: CraftSlotDef;
  /** Units from the start of the cook at which this slot's content goes in. */
  entry: number;
  /** The skill does not open this slot yet. */
  locked: boolean;
  part?: GradedStack;
  /** What the heat does to the part; absent while the slot is empty or locked. */
  info?: ExposureInfo;
  /** The bar from entry to the end of the cook, split by the part's band. */
  zones: Zone[];
}

/**
 * A part's bar from the moment it goes in to the end of the cook: not cooked
 * enough until its band opens, cooked right inside it, overcooked after.
 */
export function zonesFor(entry: number, end: number, band: [number, number]): Zone[] {
  const spans: [ZoneKind, number, number][] = [
    ['raw', entry, entry + band[0]],
    ['ready', entry + band[0], entry + band[1]],
    ['burnt', entry + band[1], Infinity],
  ];
  return spans
    .map(([kind, from, to]) => ({ kind, from: Math.min(from, end), to: Math.min(to, end) }))
    .filter((z) => z.to - z.from > 1e-9);
}

/** The bench's timed slots in the order they enter the pot, locked ones included. */
export function trackRows(
  state: GameState,
  disc: CraftDisciplineDef,
  placement: Placement,
  duration: number,
): TrackRow[] {
  const level = skillLevel(state, disc);
  return disc.slots
    .filter((s) => s.at != null)
    .sort((a, b) => a.at! - b.at!)
    .map((slot) => {
      const entry = slot.at! * duration;
      const locked = (slot.unlockLevel ?? 0) > level;
      const part = locked ? undefined : placement[slot.id];
      const info = part ? (exposureInfo(disc, slot, part.id, duration) ?? undefined) : undefined;
      return { slot, entry, locked, part, info, zones: info ? zonesFor(entry, duration, info.band) : [] };
    });
}

/** Slots that stand outside time: seasoning and cookware. */
export function outsideSlots(disc: CraftDisciplineDef): CraftSlotDef[] {
  return disc.slots.filter((s) => s.at == null);
}

// ---------- The cook-time row: which dish the clock picks ----------

/** One stretch of the cook-time axis and the dish the basket makes inside it. */
export interface CookWindow {
  from: number;
  to: number;
  /** Absent when the basket makes nothing there (a missing ingredient). */
  outcome?: CraftOutcomeDef;
  /** Shorter than the default dish's stretch, the default dish, or longer. */
  side: 'before' | 'default' | 'after';
}

export interface CookTimeRow {
  /** The craft tag whose mean cook time picks the dish ("meat", "herb"). */
  tag: string;
  /** How long the placed parts carrying the tag cook, on average; null if none are placed. */
  mean: number | null;
  windows: CookWindow[];
  /** The window the mean falls in. */
  here?: CookWindow;
}

/**
 * The dishes the player can make with a heat window on them: the recipe card
 * read (or none needed) and the skill high enough. A window whose card is
 * unread is never shown: its numbers are the card's to teach, and drawing the
 * edge of the stretch beside it would print them.
 */
function windowedDishes(state: GameState, disc: CraftDisciplineDef): CraftOutcomeDef[] {
  const level = skillLevel(state, disc);
  return disc.outcomes.filter(
    (o) => o.heat?.length && (o.minLevel ?? 0) <= level && (!o.recipe || knowsRecipe(state, o.recipe)),
  );
}

/**
 * One row per tag that a readable window names. Each row cuts the time axis at
 * the edges of those windows and asks `matchOutcome`, with the tag's mean
 * stated, what the current basket would make inside each stretch: the windowed
 * dishes, and the default dish for the rest.
 */
export function cookTimeRows(
  state: GameState,
  disc: CraftDisciplineDef,
  placement: Placement,
  duration: number,
): CookTimeRow[] {
  const dishes = windowedDishes(state, disc);
  const max = axisMax(disc, duration);
  const tags = [...new Set(dishes.flatMap((o) => o.heat!.map((w) => w.tag)))];
  return tags.map((tag) => {
    const mean = meanExposure(disc, placement, tag, duration);
    if (mean === null) return { tag, mean, windows: [] };

    const edges = new Set<number>([0, max]);
    for (const o of dishes) {
      for (const w of o.heat!) {
        if (w.tag !== tag) continue;
        for (const edge of [w.from, w.to]) if (edge !== undefined && edge > 0 && edge < max) edges.add(edge);
      }
    }
    const cuts = [...edges].sort((a, b) => a - b);

    const stretches: { from: number; to: number; outcome?: CraftOutcomeDef }[] = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const [from, to] = [cuts[i], cuts[i + 1]];
      const outcome = matchOutcome(state, disc, placement, duration, { tag, mean: (from + to) / 2 });
      const last = stretches[stretches.length - 1];
      if (last && last.outcome?.id === outcome?.id) last.to = to;
      else stretches.push({ from, to, outcome });
    }

    // The default dish is the one with no window on this tag: it fills what the
    // windowed dishes leave. Colour and order read from where it sits.
    const firstDefault = stretches.findIndex((s) => s.outcome && !s.outcome.heat?.some((w) => w.tag === tag));
    const windows: CookWindow[] = stretches.map((s, i) => ({
      ...s,
      side:
        s.outcome && !s.outcome.heat?.some((w) => w.tag === tag)
          ? 'default'
          : firstDefault === -1 || i < firstDefault
            ? 'before'
            : 'after',
    }));
    const here = windows.find((w) => mean >= w.from && mean < w.to) ?? windows[windows.length - 1];
    return { tag, mean, windows, here };
  });
}

/** A stretch of the cook-time axis as a window the cards use: "under 6", "6 to 14", "14 or more". */
export function windowWords(w: CookWindow, max: number): string {
  return describeHeatWindow({
    ...(w.from > 0 ? { from: w.from } : {}),
    ...(w.to < max ? { to: w.to } : {}),
  });
}

// ---------- The hint line ----------

export interface Hint {
  /** 'fix' names an ingredient outside its range; 'ok' says what the cook makes; 'idle' prompts. */
  kind: 'fix' | 'ok' | 'idle';
  text: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const oneDecimal = (n: number) => n.toFixed(1);
/** 5.4 -> "5.4", 8 -> "8": trailing zeros dropped, for entry units and ranges. */
const plain = (n: number) => String(Math.round(n * 10) / 10);

/**
 * The single line under the track. The first ingredient (in time order) that
 * is outside its cooked-right range gets its range and the slot, or the cook
 * length, that would fix it. With every ingredient cooked right it says which
 * dish the cook time makes and what the other readable cook times make.
 */
export function heatHint(
  disc: CraftDisciplineDef,
  placement: Placement,
  duration: number,
  rows: TrackRow[],
  cook: CookTimeRow[],
  check: CookCheck,
): Hint {
  const bad = rows.find((r) => r.info && r.info.verdict !== 'in its element');
  if (bad?.part && bad.info) {
    const { info } = bad;
    const name = MATERIALS[bad.part.id]?.name ?? bad.part.id;
    const [lo, hi] = info.band;
    const head = `${name} cooks ${oneDecimal(info.exposure)} units; cooked right is ${plain(lo)} to ${plain(hi)}.`;
    const open = rows.filter((r) => !r.locked && r !== bad);
    // Empty slots first, then the one nearest to where the part sits now.
    const nearest = (slots: TrackRow[]) =>
      [...slots].sort(
        (a, b) => Number(!!a.part) - Number(!!b.part) || Math.abs(a.entry - bad.entry) - Math.abs(b.entry - bad.entry),
      )[0];
    const options = disc.timeline?.options ?? [];

    if (info.verdict === 'undercooked') {
      // Cooked right needs an entry no later than duration - lo.
      const slot = duration >= lo ? nearest(open.filter((r) => r.entry < bad.entry && r.entry <= info.window[1] + 1e-9)) : undefined;
      if (slot) return { kind: 'fix', text: `${head} Move it to ${slot.slot.name} (unit ${plain(slot.entry)}) or earlier.` };
      const longer = options.find((o) => o.units - bad.entry >= lo);
      if (longer) return { kind: 'fix', text: `${head} Cook for ${longer.name} (${longer.units}) or longer.` };
      return { kind: 'fix', text: head };
    }
    // Overcooked: an entry no earlier than duration - hi.
    const slot = nearest(open.filter((r) => r.entry > bad.entry && r.entry >= info.window[0] - 1e-9));
    if (slot) return { kind: 'fix', text: `${head} Move it to ${slot.slot.name} (unit ${plain(slot.entry)}) or later.` };
    const shorter = [...options].reverse().find((o) => o.units - bad.entry <= hi);
    if (shorter) return { kind: 'fix', text: `${head} Cook for ${shorter.name} (${shorter.units}) or shorter.` };
    return { kind: 'fix', text: head };
  }

  if (!rows.some((r) => r.part)) {
    return { kind: 'idle', text: 'Click a row’s square to put an ingredient in it.' };
  }

  const max = axisMax(disc, duration);
  const row = cook.find((c) => c.mean !== null && c.windows.length > 1) ?? cook.find((c) => c.mean !== null);
  if (row?.mean != null) {
    const mean = `${cap(row.tag)} cooks ${oneDecimal(row.mean)} units`;
    const dish = row.here?.outcome;
    if (!check.ok || !dish) return { kind: 'ok', text: `${mean}.` };
    const others = row.windows
      .filter((w) => w !== row.here && w.outcome)
      .map((w) => `${w.outcome!.name}: ${row.tag} ${windowWords(w, max)}`);
    return { kind: 'ok', text: `${mean} → ${dish.name}.${others.length ? ` ${others.join('. ')}.` : ''}` };
  }
  return { kind: 'ok', text: 'Every ingredient is cooked right.' };
}
