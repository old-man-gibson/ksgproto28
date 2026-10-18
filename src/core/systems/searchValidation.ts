import type { SpotDef, SpotFind } from '../types';

interface SearchRefs {
  keyItems: Record<string, unknown>;
  items: Record<string, unknown>;
  materials: Record<string, unknown>;
  runes: Record<string, unknown>;
}

/** Shared by the content tests and forge so authoring feedback matches runtime contracts. */
export function searchContentIssues(spot: SpotDef, refs: SearchRefs): string[] {
  const issues: string[] = [];
  const payload = (r: Omit<SpotFind, 'at'>, owner: string) => {
    for (const [field, registry] of [['keyItem', refs.keyItems], ['item', refs.items], ['rune', refs.runes]] as const) {
      if (r[field] && !registry[r[field]!]) issues.push(`${owner}: unknown ${field} '${r[field]}'`);
    }
    if (r.material && (!refs.materials[r.material.id] || !Number.isFinite(r.material.qty ?? 1) || (r.material.qty ?? 1) <= 0)) issues.push(`${owner}: invalid material reward`);
    if (r.gold && (r.gold.some((n) => !Number.isInteger(n) || n < 0) || r.gold[0] > r.gold[1])) issues.push(`${owner}: invalid gold range`);
    if (r.skillXp && (!r.skillXp.tags.length || !Number.isFinite(r.skillXp.xp) || r.skillXp.xp <= 0)) issues.push(`${owner}: invalid skill XP`);
    if (r.stat && (!r.stat.key.startsWith('flag:') && !(r.stat.set !== undefined && /^(slain|fights):/.test(r.stat.key)))) issues.push(`${owner}: invalid stat namespace`);
    if (r.stat && (r.stat.set !== undefined && r.stat.amount !== undefined || !Number.isFinite(r.stat.set ?? r.stat.amount ?? 1))) issues.push(`${owner}: invalid stat reward`);
  };
  for (const f of spot.finds ?? []) if (f.keyItem && !refs.keyItems[f.keyItem]) issues.push(`${f.id}: unknown key item '${f.keyItem}'`);
  for (const act of spot.activities) {
    if (act.kind !== 'search') continue;
    if (!Number.isFinite(act.ticksPer) || act.ticksPer <= 0) issues.push(`${act.id}: search duration must be positive`);
    if (!act.rewards.length) issues.push(`${act.id}: search needs a reward table`);
    const ids = new Set<string>();
    for (const r of act.rewards) {
      const owner = `${act.id}/${r.id}`;
      if (!r.id || ids.has(r.id)) issues.push(`${owner}: missing or duplicate reward id`);
      ids.add(r.id);
      if (!Number.isFinite(r.weight) || r.weight <= 0) issues.push(`${owner}: weight must be positive`);
      for (const field of ['limit', 'guaranteedBy'] as const) {
        if (r[field] !== undefined && (!Number.isInteger(r[field]) || r[field]! <= 0)) issues.push(`${owner}: ${field} must be a positive integer`);
      }
      payload(r, owner);
    }
  }
  return issues;
}
