/**
 * Which registry a field points into, inferred from its name and its owner.
 *
 * Key names are the only schema the forge has, so this table is what turns
 * `monsterId` into a picker over MONSTERS. It lives here rather than in the
 * editor because renaming an id needs exactly the same knowledge: to move
 * every reference to a spot you must know which strings ARE spot references,
 * and `'leather_vest'` is both an item and a recipe.
 */

export const REF_KIND: Record<string, string> = {
  monsterId: 'monster',
  monsterIds: 'monster',
  materialId: 'material',
  material: 'material',
  materials: 'material',
  itemId: 'item',
  item: 'item',
  items: 'item',
  recipeId: 'recipe',
  recipe: 'recipe',
  recipes: 'recipe',
  spotId: 'spot',
  spot: 'spot',
  spots: 'spot',
  to: 'spot',
  path: 'spot',
  exitTo: 'spot',
  areaId: 'area',
  regionId: 'region',
  npcId: 'npc',
  giver: 'npc',
  questId: 'quest',
  quests: 'quest',
  runeId: 'rune',
  rune: 'rune',
  runes: 'rune',
  skillId: 'skill',
  skill: 'skill',
  skillXp: 'skill',
  styleId: 'style',
  style: 'style',
  requiresStyle: 'style',
  forceStyle: 'style',
  statusId: 'status',
  statuses: 'status',
  disciplineId: 'discipline',
  benches: 'discipline',
  technique: 'technique',
  position: 'position',
  deity: 'deity',
};

/**
 * Keys whose target registry depends on WHO OWNS THEM. A flat key→registry
 * table cannot tell a spot connection's `to` (a spot) from a martial
 * technique's `to` (a position) or a status conversion's `to` (another
 * status) — and guessing wrong paints a perfectly good id red and offers a
 * picker full of the wrong vocabulary.
 */
export const REF_KIND_BY_OWNER: Record<string, Record<string, string>> = {
  technique: { from: 'position', to: 'position' },
  rune: { exitTo: 'position' },
  status: { from: 'status', to: 'status' },
  // A style supersedes another style. Left to the corpus heuristic this offered
  // only the six styles something already replaces — you could not supersede
  // anything else, which is precisely what a new style usually wants to do.
  style: { replaces: 'style' },
};

/**
 * Literals a reference field accepts besides real ids. `from: 'any'` is how a
 * technique says it fires from anywhere, and 'spelltable' is the one bench
 * that is furniture rather than a discipline.
 */
export const REF_SENTINELS: Record<string, string[]> = {
  'technique.from': ['any'],
  'spot.benches': ['spelltable'],
};

/** The registry `key` points into, for a field owned by `kind`. */
export function refKindFor(kind: string, key: string, parentKey?: string): string | undefined {
  if (key === 'parent') return kind === 'skill' ? 'skill' : undefined;
  const owned = REF_KIND_BY_OWNER[kind];
  if (owned?.[key]) return owned[key];
  if (key === 'id' && parentKey) return owned?.[parentKey] ?? REF_KIND[parentKey];
  return REF_KIND[key];
}

export function refAllowFor(kind: string, key: string): string[] | undefined {
  return REF_SENTINELS[`${kind}.${key}`];
}

export interface RefSite {
  /** Registry holding the reference. */
  kind: string;
  /** Entry id within that registry. */
  id: string;
  /** Path INSIDE the entry, ready to append to `[id]` for a store op. */
  path: (string | number)[];
  /**
   * Present when the id is a SEGMENT of a composite counter key
   * (`fights:woods_edge`) rather than the whole value — the replacement is the
   * old key with just that segment swapped, not the bare new id.
   */
  rewrite?: (next: string) => string;
}

/**
 * Counter keys embed ids as `:`-separated segments, and the linter only
 * prefix-checks the slain/fights family — so a rename that skipped them would
 * break silently, with no error anywhere. The grammar comes from
 * `statCounterValid` in tests/content.test.ts; `flag:*` is freeform and
 * `kills:tag:*` names a tag, so neither is an id reference.
 */
const COUNTER_KEY_FIELDS = new Set(['key', 'statKey']);
const COUNTER_SEGMENTS: Record<string, string[]> = {
  kills: ['monster'],
  gather: ['material'],
  fights: ['spot'],
  slain: ['spot', 'monster'],
};

function counterRewrite(
  value: string,
  targetKind: string,
  targetId: string,
): ((next: string) => string) | null {
  const parts = value.split(':');
  const spec = COUNTER_SEGMENTS[parts[0]];
  if (!spec || (parts[0] === 'kills' && parts[1] === 'tag')) return null;
  for (let i = 0; i < spec.length; i++) {
    if (spec[i] === targetKind && parts[i + 1] === targetId) {
      const at = i + 1;
      return (next) => parts.map((p, j) => (j === at ? next : p)).join(':');
    }
  }
  return null;
}

/**
 * Every place `targetId` is referenced as a `targetKind`.
 *
 * Matching is by exact value AND by inferred field kind, so renaming the spot
 * `leather_vest` would not touch an item called `leather_vest` — a plain
 * string search would rewrite both and quietly corrupt one.
 *
 * Array elements are addressed by `#id=`/`#to=` where the element carries one,
 * so a path stays valid if the list is reordered.
 */
export function findReferences(
  data: Record<string, Record<string, unknown>>,
  targetKind: string,
  targetId: string,
): RefSite[] {
  const sites: RefSite[] = [];

  for (const [kind, entries] of Object.entries(data)) {
    for (const [id, def] of Object.entries(entries ?? {})) {
      // An entry's own `id` field is its identity, not a reference to itself.
      const walk = (value: unknown, path: (string | number)[], key: string, parentKey?: string): void => {
        if (typeof value === 'string') {
          if (value === targetId) {
            if (kind === targetKind && path.length === 1 && key === 'id') return;
            if (refKindFor(kind, key, parentKey) === targetKind) sites.push({ kind, id, path });
            return;
          }
          if (COUNTER_KEY_FIELDS.has(key)) {
            const rewrite = counterRewrite(value, targetKind, targetId);
            if (rewrite) sites.push({ kind, id, path, rewrite });
          }
          return;
        }
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
          value.forEach((el, i) => {
            const step = elementStep(el, i);
            // A string element inherits the ARRAY's key: `recipes: ['x']`.
            walk(el, [...path, step], key, parentKey);
          });
          return;
        }
        for (const [k, child] of Object.entries(value)) {
          walk(child, [...path, k], k, key);
        }
      };
      walk(def, [], '', undefined);
    }
  }
  return sites;
}

/** Address an array element by identity where it has one, else by index. */
function elementStep(el: unknown, i: number): string | number {
  if (el && typeof el === 'object' && !Array.isArray(el)) {
    const rec = el as Record<string, unknown>;
    if (typeof rec.id === 'string') return `#id=${rec.id}`;
    if (typeof rec.to === 'string') return `#to=${rec.to}`;
  }
  return i;
}
