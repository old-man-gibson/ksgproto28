import type { MonsterDef } from '../../core/types';

/**
 * Enemy portraits. Vite hashes and copies everything under assets/enemies at
 * build time; this maps the plain filename a MonsterDef declares to the final
 * URL. Core stays browser-free — art never leaves the UI layer.
 */
const ART = import.meta.glob('../../assets/enemies/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const BY_FILE: Record<string, string> = Object.fromEntries(
  Object.entries(ART).map(([path, url]) => [path.split('/').pop()!, url]),
);

/** Portrait URL for a monster, or null when it only has an emoji. */
export function enemyArt(def: MonsterDef): string | null {
  if (!def.art) return null;
  return BY_FILE[def.art] ?? null;
}
