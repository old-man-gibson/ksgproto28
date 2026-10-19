/**
 * The short key a tile pack goes by in map files: its folder name with the
 * vendor prefix and the trailing version stripped, as a snake_case slug.
 *
 *   "EPIC RPG World Pack - Old Prison V1.7.1"          → old_prison
 *   "ERW - Grass Land 2.0 v2.1"                        → grass_land_2_0
 *   "ERW - Sea Adventures (GL 2.0 expansion) V1.5"     → sea_adventures
 *
 * Stripping the version is the point: a pack update changes the folder and
 * must not renumber every map that draws from it. The forge derives the key
 * on every scan and `sheets.gen.ts` records the folder it resolved to, so
 * the runtime never derives anything.
 */
export function packKeyOf(folder: string): string {
  let s = folder.trim();
  s = s.replace(/^(?:epic rpg world(?: pack)?|erw)\s*-\s*/i, '');
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ');
  s = s.replace(/\s+v\.?\s*\d+(?:\.\d+)*\s*$/i, '');
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
