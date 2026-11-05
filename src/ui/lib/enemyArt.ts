import type { MonsterDef } from '../../core/types';
import { ENEMY_ART } from './enemyArt.gen';
import { resolveArt } from './artPack/artPack.svelte';

/**
 * Enemy portraits. Vite hashes and copies the files enemyArt.gen.ts lists —
 * the ones some MonsterDef names, not the whole folder — and this maps the
 * plain filename a MonsterDef declares to the final URL. Naming new art means
 * rerunning `npm run enemy-art`; a content test fails until you do. A file the
 * build lacks (the art is gitignored) comes from the imported art pack under
 * the key `enemies/<file>` (artPack/artPack.svelte.ts). Core stays
 * browser-free — art never leaves the UI layer.
 */
const BY_FILE: Record<string, string> = Object.fromEntries(
  Object.entries(ENEMY_ART).map(([path, url]) => [path.split('/').pop()!, url]),
);

/** Portrait URL for a monster (bundled, else the art pack), or null when it only has an emoji. */
export function enemyArt(def: MonsterDef): string | null {
  if (!def.art) return null;
  return resolveArt(`enemies/${def.art}`, BY_FILE[def.art]);
}
