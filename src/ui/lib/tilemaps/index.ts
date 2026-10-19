/**
 * Drawn maps by REGION id. A region listed here is painted from tiles in
 * MapCard, with its spots' `map` coordinates (0–100 × 0–75) laid over the
 * picture; a region not listed keeps the node diagram. The list itself is
 * `maps.gen.ts`, rewritten by the forge whenever a map is created or
 * deleted — paint a region in the forge's Tiles mode and it appears here.
 * See docs/TILEMAPS.md.
 */
export { TILEMAPS } from './maps.gen';
