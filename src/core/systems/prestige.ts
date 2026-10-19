import type { EventBus } from '../engine/events';
import type { AttributeId, GameState, HarvestLine, HarvestReport, PrestigeSourceDef } from '../types';
import { PRESTIGE_BOONS, PRESTIGE_SOURCES, PRESTIGE_UNLOCK, TOWERS } from '../registry';
import { createInitialState } from '../state';
import { TUTORIAL_DONE_KEY, TUTORIAL_EXIT } from '../data/tutorial.data';
import { conditionsMet } from './conditions';
import { floorCleared, ladderFloors } from './towers';
import { boonRank } from './legacy';
import { revealMapped } from './mapped';
import { applyStartingLevel } from './levels';
import { text } from '../text/log';

/**
 * Prestige — the harvest re-climb (docs/PRESTIGE.md).
 *
 * A run ends by choice once band 1 is cleared (`PRESTIGE_UNLOCK`). The
 * harvest measures how far the run went along every axis in
 * `PRESTIGE_SOURCES`, pays whole points, and the next run starts fresh with
 * only `state.prestige` carried over — the legacy block. Points buy boons
 * that are re-applied at the start of every run.
 *
 * Two rules the code enforces rather than trusts:
 *
 * - **The preview IS the harvest.** `harvest(state)` is the one function;
 *   the pre-prestige tab shows its output and `prestigeNow` banks the same
 *   output. There is no second computation to drift.
 * - **The post-prestige overlay is save state**, not UI state
 *   (`prestige.review`). It survives a reload and closes only through
 *   `leaveReview`, which the UI calls once a point is spent or the player
 *   confirms leaving with points unspent.
 */

export function canPrestige(state: GameState): boolean {
  return conditionsMet(state, PRESTIGE_UNLOCK);
}

/** The tab shows once the run could prestige, or once any run has. */
export function prestigeVisible(state: GameState): boolean {
  return state.prestige.count > 0 || canPrestige(state);
}

/** The raw measure behind one source, before `per` divides it. */
export function sourceAmount(state: GameState, src: PrestigeSourceDef): number {
  switch (src.measure) {
    case 'stat':
      return Math.floor(state.stats[src.key ?? ''] ?? 0);
    case 'floors':
      return Object.keys(TOWERS).reduce(
        (n, towerId) => n + ladderFloors(towerId).filter((f) => floorCleared(state, f)).length,
        0,
      );
    case 'skillLevels':
      return Object.values(state.skills).reduce((n, s) => n + s.level, 0);
    case 'achievements':
      return Object.values(state.achievements).reduce((n, tiers) => n + tiers, 0);
  }
}

/** "1 entry", "2 entries", "3 quests", "40 gold" — the unit nouns the sources use. */
export function unitText(n: number, unit: string): string {
  if (unit === 'gold' || n === 1) return `${n} ${unit}`;
  return `${n} ${unit.endsWith('y') ? `${unit.slice(0, -1)}ies` : `${unit}s`}`;
}

/**
 * Whole points an amount pays under a source: `amount / per` linearly, or
 * with `growth` the number of thresholds `per, per×growth, per×growth², …`
 * the amount has reached.
 */
export function pointsFor(amount: number, src: PrestigeSourceDef): number {
  if (!src.growth) return Math.floor(amount / src.per);
  let points = 0;
  for (let threshold = src.per; amount >= threshold; threshold *= src.growth) points += 1;
  return points;
}

/** The amount at which the NEXT point is paid. */
export function nextThreshold(amount: number, src: PrestigeSourceDef): number {
  if (!src.growth) return (Math.floor(amount / src.per) + 1) * src.per;
  return src.per * src.growth ** pointsFor(amount, src);
}

/** "2 per point" or "next at 100000" — how a source's readout explains itself. */
function rateText(amount: number, src: PrestigeSourceDef): string {
  return src.growth ? `next at ${nextThreshold(amount, src)}` : `${src.per} per point`;
}

/** What a prestige would pay right now — and what it does pay, when it happens. */
export function harvest(state: GameState): HarvestReport {
  const lines: HarvestLine[] = Object.values(PRESTIGE_SOURCES).map((src) => {
    const amount = sourceAmount(state, src);
    return {
      id: src.id,
      name: src.name,
      icon: src.icon,
      points: pointsFor(amount, src),
      detail: `${unitText(amount, src.unit)} (${rateText(amount, src)})`,
    };
  });
  return {
    ordinal: state.prestige.count + 1,
    total: lines.reduce((n, l) => n + l.points, 0),
    lines,
  };
}

/**
 * The forecast: how far each source is from its next point. Same
 * arithmetic as `harvest`, one step ahead — "+1 at 3 more quests".
 */
export function forecast(state: GameState): { id: string; name: string; icon: string; need: number; unit: string }[] {
  return Object.values(PRESTIGE_SOURCES).map((src) => {
    const amount = sourceAmount(state, src);
    return { id: src.id, name: src.name, icon: src.icon, need: nextThreshold(amount, src) - amount, unit: src.unit };
  });
}

/** Cost of the NEXT rank of a boon, or null at max rank. */
export function nextBoonCost(state: GameState, boonId: string): number | null {
  const def = PRESTIGE_BOONS[boonId];
  if (!def) return null;
  const rank = boonRank(state, boonId);
  return rank < def.cost.length ? def.cost[rank] : null;
}

export function canBuyBoon(state: GameState, boonId: string): boolean {
  const cost = nextBoonCost(state, boonId);
  return cost !== null && state.prestige.points >= cost;
}

/**
 * Spend points on the next rank. Grants that pay per run (`startGold`) pay
 * now too, so a purchase made in the overlay is felt in the run in progress
 * and not only from the next one.
 */
export function buyBoon(state: GameState, bus: EventBus, boonId: string): boolean {
  const def = PRESTIGE_BOONS[boonId];
  const cost = nextBoonCost(state, boonId);
  if (!def || cost === null || state.prestige.points < cost) return false;
  state.prestige.points -= cost;
  state.prestige.purchases[boonId] = boonRank(state, boonId) + 1;
  if (state.prestige.review) state.prestige.spentThisReview += cost;
  if (def.effect.kind === 'startGold') state.gold += def.effect.amount;
  if (def.effect.kind === 'startLevel') applyStartingLevel(state);
  bus.emit({
    type: 'log',
    msg: text('prestige.boon_bought', {
      icon: def.icon,
      name: def.name,
      rank: boonRank(state, boonId),
      cost,
      plural: cost === 1 ? '' : 's',
    }),
    kind: 'info',
  });
  return true;
}

/** Close the post-prestige overlay. The UI decides when that is allowed. */
export function leaveReview(state: GameState): void {
  state.prestige.review = false;
  state.prestige.spentThisReview = 0;
}

/** Per-run grants, applied to a fresh run for every rank bought. */
export function applyRunStart(state: GameState): void {
  for (const def of Object.values(PRESTIGE_BOONS)) {
    const rank = boonRank(state, def.id);
    if (rank > 0 && def.effect.kind === 'startGold') state.gold += def.effect.amount * rank;
  }
  applyStartingLevel(state);
}

/**
 * End the run. Returns the NEXT run's state — fresh, with the legacy block
 * carried over and grown by this harvest — or null if the run cannot
 * prestige yet. Callers replace their state with it (the UI assigns into the
 * reactive proxy, as `hardReset` does).
 *
 * What carries: `prestige` (count, points, purchases, this harvest, the
 * review flag) and `createdAt` — the world seed, so the weather is the same
 * world's weather. Everything else is the run's and resets, per the
 * prestige economy settled 2026-07-31 ("most materials/unlockables reset").
 */
export function prestigeNow(state: GameState, now = Date.now()): GameState | null {
  if (!canPrestige(state)) return null;
  const report = harvest(state);
  const legacy = state.prestige;
  const next = createInitialState(now);
  next.createdAt = state.createdAt;
  // Peaks never lower: the run just ended raises a skill's record or leaves it.
  const peakLevels = { ...legacy.peakLevels };
  for (const [id, s] of Object.entries(state.skills)) {
    peakLevels[id] = Math.max(peakLevels[id] ?? 0, s.level);
  }
  const peakAttrs = { ...legacy.peakAttrs };
  for (const [id, a] of Object.entries(state.attrs) as [AttributeId, { level: number }][]) {
    peakAttrs[id] = Math.max(peakAttrs[id] ?? 0, a.level);
  }
  // Auto boons: rank 1 arrives with the first prestige, unasked and free.
  const purchases = { ...legacy.purchases };
  for (const def of Object.values(PRESTIGE_BOONS)) {
    if (def.auto && !(purchases[def.id] > 0) && def.cost[0] === 0) purchases[def.id] = 1;
  }
  next.prestige = {
    count: legacy.count + 1,
    points: legacy.points + report.total,
    purchases,
    peakLevels,
    peakAttrs,
    lastHarvest: report,
    review: true,
    spentThisReview: 0,
  };
  next.stats['prestige:count'] = next.prestige.count;
  // A second life skips the cell: the tutorial is stamped done and the run
  // opens at the Foot, where the door to the hold has just come open.
  next.stats[TUTORIAL_DONE_KEY] = 1;
  next.spot = TUTORIAL_EXIT;
  next.discovered = [TUTORIAL_EXIT];
  revealMapped(next);
  applyRunStart(next);
  return next;
}
