import type { EventBus } from '../engine/events';
import type { ActivityDef, GameState } from '../types';
import { MATERIALS } from '../data/materials.data';
import { mercyChance } from '../engine/mercy';
import { grantMaterial, knowsRecipe, stockOf } from './disciplines';
import { text } from '../text/log';

/**
 * Rare finds on ordinary work (`ActivityDef.drops`, user 2026-10-17): one roll
 * per completed cycle of a train/gather/job activity. The first consumer is the
 * Reading Hall, whose reading turns up a recipe card no counter sells.
 *
 * Rolls under 15% are drought-protected by the shared mercy curve
 * (engine/mercy.ts), keyed per activity and material, so "very rare" has a
 * bounded worst case and an unchanged average.
 *
 * A card that teaches a recipe the player knows, or already holds, is not
 * rolled at all: a second copy would be clutter, and skipping keeps its mercy
 * counter from climbing on rolls that could never pay.
 */
export function rollActivityDrops(state: GameState, bus: EventBus, act: ActivityDef): void {
  const drops = 'drops' in act ? act.drops : undefined;
  if (!drops?.length) return;
  for (const d of drops) {
    const def = MATERIALS[d.material];
    if (!def) continue;
    const teaches = def.consumable?.teaches;
    if (teaches && (knowsRecipe(state, teaches) || held(state, d.material) > 0)) continue;
    if (!mercyChance(state, `drop:${act.id}:${d.material}`, d.chance)) continue;
    grantMaterial(state, d.material, 1);
    bus.emit({
      type: 'log',
      msg: text('activitydrops.found', { icon: def.icon, name: def.name, activity: act.name }),
      kind: 'loot',
    });
  }
}

function held(state: GameState, id: string): number {
  if (!MATERIALS[id]?.graded) return state.materials[id] ?? 0;
  return Object.keys(state.stock?.[id] ?? {}).reduce(
    (n, q) => n + stockOf(state, id, q as Parameters<typeof stockOf>[2]),
    0,
  );
}
