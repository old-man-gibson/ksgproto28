import type { MonsterDef } from '../../core/types';
import { ENEMY_ART } from './enemyArt.gen';

/**
 * Enemy portraits. Vite hashes and copies the files enemyArt.gen.ts lists —
 * the ones some MonsterDef names, not the whole folder — and this maps the
 * plain filename a MonsterDef declares to the final URL. Naming new art means
 * rerunning `npm run enemy-art`; a content test fails until you do. Core stays
 * browser-free — art never leaves the UI layer.
 */
const BY_FILE: Record<string, string> = Object.fromEntries(
  Object.entries(ENEMY_ART).map(([path, url]) => [path.split('/').pop()!, url]),
);

/** Portrait URL for a monster, or null when it only has an emoji. */
export function enemyArt(def: MonsterDef): string | null {
  if (!def.art) return null;
  return BY_FILE[def.art] ?? null;
}
