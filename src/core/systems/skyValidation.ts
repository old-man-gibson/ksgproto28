import { SKY_TABLES, WEATHER_KINDS } from '../data/climate.data';

/**
 * Region skies (`RegionDef.sky`, data/climate.data.ts SKY_TABLES) and the
 * encounter lines that wait on them (`SpotEncounter.sky`), checked against the
 * rest of the content. Pure, so tests/content.test.ts runs it on the live
 * registry and forge/lib/validate.ts on the staged copy: one implementation,
 * two callers (the floorRules.ts pattern).
 */

interface RegionRef {
  id: string;
  sky?: string;
  world?: unknown;
  sheltered?: boolean;
  tags?: string[];
}

interface AreaRef {
  id: string;
  regionId: string;
  sheltered?: boolean;
  tags?: string[];
}

interface SpotRef {
  id: string;
  areaId: string;
  tags?: string[];
  encounters?: { monsterId: string; sky?: string[] }[];
}

export interface SkyIssue {
  kind: 'region' | 'spot';
  id: string;
  message: string;
}

/** Kinds only a region sky table produces; the noise field never draws them. */
const TABLE_ONLY = new Set(['heatwave', 'calm']);

const KINDS = new Set<string>(WEATHER_KINDS);

export function skyContentIssues(refs: {
  regions: Record<string, RegionRef>;
  areas: Record<string, AreaRef>;
  spots: Record<string, SpotRef>;
}): SkyIssue[] {
  const issues: SkyIssue[] = [];

  for (const region of Object.values(refs.regions)) {
    if (region.sky === undefined) continue;
    const add = (message: string) => issues.push({ kind: 'region', id: region.id, message });
    if (!SKY_TABLES[region.sky]) add(`sky '${region.sky}' is not in SKY_TABLES`);
    if (!region.world) add('a sky table needs an atlas pin (world): an unplaced region has no weather');
  }

  for (const spot of Object.values(refs.spots)) {
    const lines = (spot.encounters ?? []).filter((e) => e.sky !== undefined);
    if (!lines.length) continue;
    const add = (message: string) => issues.push({ kind: 'spot', id: spot.id, message });
    const area = refs.areas[spot.areaId];
    const region = area && refs.regions[area.regionId];
    // The same test skyKindAt (systems/exposure.ts) runs: the area's `sheltered`
    // overrides the region's, and an `indoor` tag at any level is a roof.
    const sheltered = area?.sheltered ?? region?.sheltered ?? false;
    const roofed = [...(region?.tags ?? []), ...(area?.tags ?? []), ...(spot.tags ?? [])].includes('indoor');
    for (const e of lines) {
      const who = `${e.monsterId}: sky`;
      const kinds = e.sky ?? [];
      if (!kinds.length) add(`${who} is empty, so the line never rolls`);
      for (const k of kinds) {
        if (!KINDS.has(k)) add(`${who} names '${k}', which is not a weather kind`);
        else if (TABLE_ONLY.has(k) && !region?.sky) {
          add(`${who} names '${k}', which only a region sky table produces, and this region has none`);
        }
      }
      if (sheltered || roofed) add(`${who} waits on a sky this spot never has (sheltered or indoor)`);
      else if (!region?.world) add(`${who} waits on a sky this spot never has (its region is not on the atlas)`);
    }
  }

  return issues;
}
