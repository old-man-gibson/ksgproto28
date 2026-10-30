import type { NpcDef, QuestDef, SpotDef } from '../types';
import type { ConvoyDef, SeaSideDef } from '../data/sea.data';

/**
 * The harbor band's registries (data/sea.data.ts), checked against the rest
 * of the content. Pure, with type-only imports, so tests/content.test.ts runs
 * it on the live registry and forge/lib/validate.ts on the staged copy: one
 * implementation, two callers (the floorRules.ts pattern).
 */

interface SeaRefs {
  spots: Record<string, SpotDef>;
  npcs: Record<string, NpcDef>;
  quests: Record<string, QuestDef>;
  monsters: Record<string, unknown>;
  materials: Record<string, unknown>;
}

const FLOWS = new Set(['convoy', 'escort', 'raid', 'recover']);

/** The accept stamp a join quest writes (systems/quests.ts `acceptedKey`). */
const stamp = (questId: string): string => `flag:quest:${questId}:accepted`;

export interface SeaIssue {
  kind: 'seaSide' | 'convoy';
  id: string;
  message: string;
}

export function seaContentIssues(
  sides: Record<string, SeaSideDef>,
  convoys: Record<string, ConvoyDef>,
  refs: SeaRefs,
): SeaIssue[] {
  const issues: SeaIssue[] = [];
  const side = (id: string, message: string) => issues.push({ kind: 'seaSide', id, message });
  const convoy = (id: string, message: string) => issues.push({ kind: 'convoy', id, message });

  const joins = new Map<string, string>();
  for (const s of Object.values(sides)) {
    if (!FLOWS.has(s.flow)) side(s.id, `flow '${s.flow}' is not one of ${[...FLOWS].join(', ')}`);
    const npc = refs.npcs[s.giver];
    if (!npc) side(s.id, `giver '${s.giver}' is not an NPC`);
    else if (!npc.quests.includes(s.joinQuest)) side(s.id, `giver '${s.giver}' does not give '${s.joinQuest}'`);
    const quest = refs.quests[s.joinQuest];
    if (!quest) side(s.id, `join quest '${s.joinQuest}' does not exist`);
    else if (quest.giver !== s.giver) side(s.id, `join quest '${s.joinQuest}' is given by '${quest.giver}', not '${s.giver}'`);
    if (joins.has(s.joinQuest)) side(s.id, `join quest '${s.joinQuest}' is also ${joins.get(s.joinQuest)}'s`);
    joins.set(s.joinQuest, s.id);
    if (!s.prey.length) side(s.id, 'prey is empty: no kill on the water would count');
    for (const m of s.prey) if (!refs.monsters[m]) side(s.id, `prey '${m}' is not a monster`);
    const spot = refs.spots[s.mission.spot];
    if (!spot) side(s.id, `mission spot '${s.mission.spot}' does not exist`);
    else if (!spot.encounters?.some((e) => e.monsterId === s.mission.monsterId && e.once)) {
      side(s.id, `mission spot '${s.mission.spot}' has no 'once' spawn of '${s.mission.monsterId}'`);
    }
  }
  // One side per run: every join quest refuses while any other side's stamp is set.
  for (const s of Object.values(sides)) {
    const quest = refs.quests[s.joinQuest];
    if (!quest) continue;
    for (const other of Object.values(sides)) {
      if (other.id === s.id) continue;
      const locked = (quest.requirements ?? []).some(
        (c) => c.type === 'statMax' && c.key === stamp(other.joinQuest) && c.value === 0,
      );
      if (!locked) side(s.id, `join quest '${s.joinQuest}' must require ${stamp(other.joinQuest)} at 0 (one side per run)`);
    }
  }

  for (const [key, row] of Object.entries(convoys)) {
    if (row.id !== key) convoy(key, `id '${row.id}' does not match its key`);
    const spot = refs.spots[key];
    if (!spot) {
      convoy(key, 'names no spot');
    } else {
      if (!spot.activities.some((a) => a.kind === 'hunt')) convoy(key, 'the water has no hunt, so no kill there can count');
      if (spot.fightLimit !== undefined) convoy(key, 'a water never clears: drop its fightLimit (sea.ts counts its fights)');
    }
    for (const field of ['raiders', 'monsters', 'guard'] as const) {
      const [lo, hi] = row[field];
      if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 0 || lo > hi) {
        convoy(key, `${field} [${lo}, ${hi}] must be whole numbers with 0 <= low <= high`);
      }
    }
    if (!row.cargo.length) convoy(key, 'cargo is empty: a crate won would pay nothing');
    for (const m of row.cargo) if (!refs.materials[m]) convoy(key, `cargo '${m}' is not a material`);
  }
  return issues;
}
