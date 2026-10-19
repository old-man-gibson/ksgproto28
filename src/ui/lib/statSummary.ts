import type { DamageType, DerivedStats } from '../../core/types';
import { actionTicks, attackFillRate } from '../../core/systems/derived';
import { incomingSlice } from '../../core/systems/combat';
import { TPS } from '../../core/engine/loop';

/**
 * The sidebar's group summaries (user, 2026-10-17): one rough number per
 * group, so the first screen reads at a glance and the full stat list sits
 * one click below. Rough on purpose — each says what it leaves out.
 */

/** Seconds between your attacks: the Attack Time row. */
export function attackSeconds(stats: DerivedStats): number {
  return actionTicks(stats.actionBar, attackFillRate(stats)) / TPS;
}

/**
 * Weapon damage per second before the target's armour and resistances:
 * damage × hits per swing × the average crit bonus ÷ attack time. Spells,
 * techniques, penetration and splash are not in it.
 */
export function roughDps(stats: DerivedStats): number {
  const secs = attackSeconds(stats);
  if (!(secs > 0)) return 0;
  const hits = 1 + Math.max(0, stats.extraSwings);
  const crit = Math.min(1, Math.max(0, stats.crit));
  const critBonus = 1 + crit * Math.max(0, stats.critDamage - 1);
  return (stats.damage * hits * critBonus) / secs;
}

/** The blow the defense summary is measured against. */
export const REFERENCE_BLOW = 20;
const PHYSICAL: DamageType[] = ['slashing', 'piercing', 'bludgeoning'];

/**
 * What you expect to take from one typical physical blow of `raw` damage:
 * the blow must get past your dodge, then your parry, then armour,
 * resistance, damage taken and ward (`incomingSlice`, the fight's own
 * arithmetic), averaged over slashing, piercing and bludgeoning. Crits and
 * stance bracing are not in it.
 */
export function expectedHitTaken(stats: DerivedStats, raw = REFERENCE_BLOW): number {
  const landed = PHYSICAL.reduce((sum, t) => sum + incomingSlice(stats, t, '', raw).dealt, 0) / PHYSICAL.length;
  const dodge = Math.min(0.95, Math.max(0, stats.dodge));
  const parry = Math.min(0.95, Math.max(0, stats.parry));
  return landed * (1 - dodge) * (1 - parry);
}
