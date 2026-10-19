import type { EventBus } from '../engine/events';
import type { ActivityDef, ActivityDrop, GameState } from '../types';
import { MATERIALS } from '../data/materials.data';
import { QUALITY_ORDER } from '../data/quality.data';
import { mercyChance } from '../engine/mercy';
import { grantGraded, grantMaterial, stockOf } from './disciplines';
import { bumpStat } from './achievements';
import { cardSpent, isCard } from './consumables';
import { text } from '../text/log';

/**
 * Rare finds on ordinary work (`ActivityDef.drops`, user 2026-10-17): one roll
 * per completed cycle of a train/gather/job activity. One per Threshold
 * district, each feeding that district's signature system, plus the Reading
 * Hall's recipe card. They are deliberately UNMARKED (user): no badge, no
 * hint in any description — players find them by doing the work.
 *
 * Rolls under 15% are drought-protected by the shared mercy curve
 * (engine/mercy.ts), keyed per activity and material, so a rare find has an
 * unchanged average and a bounded worst case. The house rate is about one
 * find per 40 minutes of the activity: per-cycle chance = base cycle ticks /
 * 24,000.
 *
 * Not rolled at all: a card whose effect has already happened (or one is
 * already held), and a `unique` drop while one is held — a second copy would
 * be clutter, and skipping keeps the mercy counter from climbing on rolls
 * that could never pay. `rarer` divides the chance by itself once per
 * previous find (`found:<material>`), so a repeatable find thins out.
 */
export function rollActivityDrops(state: GameState, bus: EventBus, act: ActivityDef): void {
  const drops = 'drops' in act ? act.drops : undefined;
  if (!drops?.length) return;
  for (const d of drops) {
    const def = MATERIALS[d.material];
    if (!def) continue;
    const spec = def.consumable;
    const oneTimeCard = isCard(spec) && !spec?.votive;
    if (oneTimeCard && (cardSpent(state, spec) || held(state, d.material) > 0)) continue;
    if (d.unique && held(state, d.material) > 0) continue;
    if (!mercyChance(state, `drop:${act.id}:${d.material}`, dropChance(state, d))) continue;
    const qty = d.qty ?? 1;
    if (d.quality && def.graded) grantGraded(state, d.material, d.quality, qty);
    else grantMaterial(state, d.material, qty);
    bumpStat(state, bus, foundKey(d.material));
    bus.emit({
      type: 'log',
      msg: text('activitydrops.found', {
        icon: def.icon,
        name: qty > 1 ? `${def.name} ×${qty}` : def.name,
        activity: act.name,
      }),
      kind: 'loot',
    });
  }
}

/** Times this material has been turned up by any activity. */
export const foundKey = (materialId: string): string => `found:${materialId}`;

/** The chance this cycle, after `rarer` has thinned it for every previous find. */
export function dropChance(state: GameState, d: ActivityDrop): number {
  if (!d.rarer || d.rarer <= 1) return d.chance;
  return d.chance / Math.pow(d.rarer, state.stats[foundKey(d.material)] ?? 0);
}

function held(state: GameState, id: string): number {
  if (!MATERIALS[id]?.graded) return state.materials[id] ?? 0;
  return QUALITY_ORDER.reduce((n, q) => n + stockOf(state, id, q), 0);
}
