import type { DeityDef } from '../../core/types';

/**
 * Deity portraits. Vite hashes and copies everything under assets/deities at
 * build time; this maps the plain filename a DeityDef declares to the final
 * URL — the same arrangement enemy art uses, so dropping a PNG in the folder
 * and naming it on the god is the whole of adding a portrait.
 *
 * Core stays browser-free: art never leaves the UI layer.
 */
const ART = import.meta.glob('../../assets/deities/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const BY_FILE: Record<string, string> = Object.fromEntries(
  Object.entries(ART).map(([path, url]) => [path.split('/').pop()!, url]),
);

/** Portrait URL for a deity, or null when it only has an emoji. */
export function deityArt(def: DeityDef): string | null {
  if (!def.art) return null;
  return BY_FILE[def.art] ?? null;
}
