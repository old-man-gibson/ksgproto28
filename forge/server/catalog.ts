/**
 * What the forge can browse and edit: one entry per content registry, naming
 * the file it lives in, the exported const inside it, and the shape rules for
 * printing new entries.
 *
 * This is the ONLY place that knows where content lives. The client never
 * hardcodes a path — it asks for the catalog and renders whatever it gets, so
 * adding a registry to the forge is one entry here.
 */

import { isTileFile } from './tilemaps';

export interface CatalogEntry {
  /** Stable key used in URLs and patch ops. */
  kind: string;
  label: string;
  icon: string;
  /** Repo-relative path of the data file. */
  file: string;
  /** Exported const holding the `Record<string, Def>`. */
  root: string;
  /** Field-order name from print.ts KEY_ORDER (optional). */
  keyOrder?: string;
  /** Module export name on the ssr-loaded registry. */
  exportName: string;
  /** Where it comes from, when not `src/core/registry.ts`. */
  module?: string;
  /** One-line note shown in the browser's empty state. */
  hint?: string;
}

export const CATALOG: CatalogEntry[] = [
  { kind: 'keyItem', label: 'Key Items', icon: '🗝️', file: 'src/core/data/keyitems.data.ts', root: 'KEY_ITEMS', exportName: 'KEY_ITEMS' },
  { kind: 'region', label: 'Regions', icon: '🗺️', file: 'src/core/data/locations.data.ts', root: 'REGIONS', keyOrder: 'region', exportName: 'REGIONS' },
  { kind: 'area', label: 'Areas', icon: '🏞️', file: 'src/core/data/locations.data.ts', root: 'AREAS', keyOrder: 'area', exportName: 'AREAS' },
  { kind: 'spot', label: 'Spots', icon: '📍', file: 'src/core/data/locations.data.ts', root: 'SPOTS', keyOrder: 'spot', exportName: 'SPOTS', hint: 'Places you stand, act, and travel between.' },
  { kind: 'tower', label: 'Towers', icon: '🗼', file: 'src/core/data/towers.data.ts', root: 'TOWERS', keyOrder: 'tower', exportName: 'TOWERS', hint: 'A stack of floors hanging off one hub spot. `foreknown` is the real tower/dungeon split — whether you can see the ladder ahead; `direction` is only the word for it. Several stacks may share a hub, and that is the point: bands are per-stack, so a player walled on one ladder always has another open.' },
  { kind: 'band', label: 'Bands', icon: '🪜', file: 'src/core/data/towers.data.ts', root: 'BANDS', keyOrder: 'band', exportName: 'BANDS', hint: 'Floors that open as a unit. The band IS the disjunction — gate conditions are a pure AND with no `any`, so alternatives live here in the topology instead. Keep at least one floor per band gated on plain accumulation (gold, quest counts, discoveries), since that is what accrues from acting at all.' },
  { kind: 'floor', label: 'Floors', icon: '🧱', file: 'src/core/data/towers.data.ts', root: 'FLOORS', keyOrder: 'floor', exportName: 'FLOORS', hint: 'A floor IS an area — `areaId` names the AreaDef whose spots make it up, so travel, exploration and every world lint work unchanged. No `bandId` means off the ladder: it advances nothing and gates nothing, which is what makes it optional by construction.' },
  { kind: 'seaSide', label: 'Sea Sides', icon: '⚓', file: 'src/core/data/sea.data.ts', root: 'SEA_SIDES', exportName: 'SEA_SIDES', hint: 'A side of the harbor band (floors 11 to 14). Accepting `joinQuest` picks it for the run; `flow` names the convoy formula it uses (systems/sea.ts); kills of `prey` on a water count against the leg in progress.' },
  { kind: 'convoy', label: 'Convoys', icon: '⛵', file: 'src/core/data/sea.data.ts', root: 'CONVOYS', exportName: 'CONVOYS', hint: 'One water spot’s convoy, keyed by the spot id. Each leg rolls raiders, monsters and guard from these ranges; each crate won pays one material from `cargo`.' },
  { kind: 'npc', label: 'NPCs', icon: '🧑', file: 'src/core/data/npcs.data.ts', root: 'NPCS', keyOrder: 'npc', exportName: 'NPCS' },
  { kind: 'quest', label: 'Quests', icon: '📜', file: 'src/core/data/quests.data.ts', root: 'QUESTS', keyOrder: 'quest', exportName: 'QUESTS' },
  { kind: 'monster', label: 'Monsters', icon: '🐺', file: 'src/core/data/monsters.data.ts', root: 'MONSTERS', keyOrder: 'monster', exportName: 'MONSTERS' },
  { kind: 'item', label: 'Items', icon: '⚔️', file: 'src/core/data/items.data.ts', root: 'ITEMS', keyOrder: 'item', exportName: 'ITEMS' },
  { kind: 'material', label: 'Materials', icon: '🪵', file: 'src/core/data/materials.data.ts', root: 'MATERIALS', keyOrder: 'material', exportName: 'MATERIALS' },
  { kind: 'part', label: 'Smith Parts', icon: '🔩', file: 'src/core/data/parts.data.ts', root: 'PART_KINDS', keyOrder: 'part', exportName: 'PART_KINDS', hint: 'A rectangle of cells, width × length as written: a dagger blade is 2×3, a sword blade 2×6. The cells are the metal bill, and the proportions of the parts name the item (Item Classes). `accepts` names material tags, not materials.' },
  { kind: 'itemClass', label: 'Item Classes', icon: '🗡️', file: 'src/core/data/itemclasses.data.ts', root: 'ITEM_CLASSES', keyOrder: 'itemClass', exportName: 'ITEM_CLASSES', hint: 'What the anvil can make. Classes are tried highest `priority` first and the first `match` that accepts the placement wins; the last class has an empty match so every combination resolves. Ranges are inclusive and 99 means no upper bound. Classes carry no numbers — the kernel reads the parts.' },
  { kind: 'recipe', label: 'Recipes', icon: '⚒️', file: 'src/core/data/recipes.data.ts', root: 'RECIPES', keyOrder: 'recipe', exportName: 'RECIPES' },
  { kind: 'skill', label: 'Skills', icon: '📈', file: 'src/core/data/skills.data.ts', root: 'SKILLS', exportName: 'SKILLS' },
  { kind: 'style', label: 'Styles', icon: '🥋', file: 'src/core/data/styles.data.ts', root: 'STYLES', exportName: 'STYLES' },
  { kind: 'status', label: 'Statuses', icon: '🌀', file: 'src/core/data/statuses.data.ts', root: 'STATUSES', exportName: 'STATUSES' },
  { kind: 'rune', label: 'Runes', icon: '🔣', file: 'src/core/data/runes.data.ts', root: 'RUNES', exportName: 'RUNES' },
  { kind: 'achievement', label: 'Achievements', icon: '🏆', file: 'src/core/data/achievements.data.ts', root: 'ACHIEVEMENTS', exportName: 'ACHIEVEMENTS' },
  { kind: 'title', label: 'Titles', icon: '🎖️', file: 'src/core/data/titles.data.ts', root: 'TITLES', exportName: 'TITLES' },
  { kind: 'discipline', label: 'Disciplines', icon: '🔧', file: 'src/core/data/disciplines.data.ts', root: 'DISCIPLINES', exportName: 'DISCIPLINES' },
  { kind: 'reagent', label: 'Reagents', icon: '⚗️', file: 'src/core/data/alchemy.data.ts', root: 'REAGENTS', exportName: 'REAGENTS', hint: 'What a material DOES in the alembic. The material itself lives under Materials.' },
  { kind: 'technique', label: 'Techniques', icon: '🌀', file: 'src/core/data/martial.data.ts', root: 'TECHNIQUES', exportName: 'TECHNIQUES' },
  { kind: 'position', label: 'Positions', icon: '🧍', file: 'src/core/data/martial.data.ts', root: 'POSITIONS', exportName: 'POSITIONS' },
  { kind: 'genus', label: 'Genera', icon: '🧬', file: 'src/core/data/mutagens.data.ts', root: 'GENERA', exportName: 'GENERA', hint: 'Two numbers decide a genus: how many tiers, and how many quality grades one tier step is worth. Four tiers at two grades is the baseline — three steps of two grades is exactly the F→S span, so an S bottom tier and an F top tier are level.' },
  { kind: 'maingene', label: 'Main Genes', icon: '🦴', file: 'src/core/data/mutagens.data.ts', root: 'MAIN_GENES', exportName: 'MAIN_GENES', hint: 'One species drops one gene, and its tier is fixed at the drop forever — refinement only moves quality. Tier sets flatBase AND ceiling; quality decides how close to the ceiling you get.' },
  { kind: 'mutagen', label: 'Mutagens', icon: '🧫', file: 'src/core/data/mutagens.data.ts', root: 'MUTATIONS', exportName: 'MUTATIONS', hint: 'Keyed on a monster TAG, never a species — a flaming rat and a flaming ogre drop the same one. `effect` is what it contributes on arrival; `transform` is what it does to anything passing THROUGH it, and that is where the sequence identity lives.' },
  { kind: 'chromosome', label: 'Chromosomes', icon: '⛓️', file: 'src/core/data/mutagens.data.ts', root: 'LAYOUTS', exportName: 'LAYOUTS', hint: 'Edge `length` is intensity only — routing counts edges and never reads it. Put the hop count in the deep cluster and the length in the ring, and set `arm` on every edge touching the centromere: that mapping travels with the layout rather than being global.' },
  { kind: 'deity', label: 'Deities', icon: '🕯️', file: 'src/core/data/deities.data.ts', root: 'DEITIES', exportName: 'DEITIES', hint: 'Content three ways at once: `tags` are the aspects its miracles are cut from, the relation rules decide whose miracles may share a grimoire page, and the miracles themselves live under Miracles. Rules are written from each deity\'s own point of view and resolved pairwise — one side\'s grudge outweighs the other side\'s fondness, always.' },
  { kind: 'miracle', label: 'Miracles', icon: '🙏', file: 'src/core/data/spellcraft.data.ts', root: 'MIRACLES', exportName: 'MIRACLES', hint: 'Keyed by `deity`. Divine magic is received, not composed — unlike an arcane sentence, every `spec` is stated whole, because the shape of the prayer was fixed before the supplicant was born. Favor with that one deity is the only currency.' },
  { kind: 'musicArchetype', label: 'Music Archetypes', icon: '🎼', file: 'src/core/data/music.data.ts', root: 'MUSIC_ARCHETYPES', exportName: 'MUSIC_ARCHETYPES', hint: 'What a performance can be READ as. Nearest-centroid over the declared 0–1 axes — omitted axes don\'t pull, `contours` shave a little distance. Classification is total: every sheet lands on something, so tune targets to move what the world hears, never to make a combo "fail".' },
  { kind: 'musicScale', label: 'Music Scales', icon: '🎵', file: 'src/core/data/music.data.ts', root: 'MUSIC_SCALES', exportName: 'MUSIC_SCALES', hint: 'Degrees are semitones above the tonic: ascending, starting at 0, all within 0–11. The octave row is implied. Everything but the major is gated behind MUSIC_UNLOCKS.scales.' },
  { kind: 'musicMeter', label: 'Music Meters', icon: '🕰️', file: 'src/core/data/music.data.ts', root: 'MUSIC_METERS', exportName: 'MUSIC_METERS', hint: 'A time signature is a bar length + an accent pattern, never a speed. Capacity = beats × beatUnits (a quarter is 60 units); `accents` are the secondary strong pulses (the downbeat is implied) and must sit on beat boundaries. 6/8 vs 3/4: same capacity, different heartbeat — that difference is the whole entry.' },
  { kind: 'royaleStrategy', label: 'Royale Strategies', icon: '🏟️', file: 'src/core/data/festival.data.ts', root: 'ROYALE_STRATEGIES', exportName: 'ROYALE_STRATEGIES', hint: 'How a fighter walks on the Vermin Festival\'s royale field. The player ranks up to three; each survivor species in SURVIVOR_SPECIES fights with its own list. The first whose `when` holds decides the move: `nearest`, `weakest` (within sight), `centre`, `away`, `edge`, `hold`, `loot` (the nearest known open cache), `roam` (a point in another section) or `cover` (the nearest section with cover).' },
];

export function catalogFor(kind: string): CatalogEntry {
  const entry = CATALOG.find((c) => c.kind === kind);
  if (!entry) throw new Error(`Unknown content kind: ${kind}`);
  return entry;
}

/**
 * Files the forge is allowed to write. Anything else is refused outright.
 * Each data file's text file (`src/core/text/<name>.text.ts`, where the prose
 * lives — see `forge/server/prose.ts`) is writable alongside it.
 */
export const WRITABLE = new Set(
  CATALOG.flatMap((c) => [c.file, c.file.replace(/\/data\/([^/]+)\.data\.ts$/, '/text/$1.text.ts')]),
);

/**
 * The full gate: catalog files, their text files, and the drawn-map family
 * (`src/ui/lib/tilemaps/<region>.map.json` plus the two generated modules),
 * which the forge reprints whole rather than editing — see
 * forge/server/tilemaps.ts for why that is safe there and nowhere else.
 */
export function isWritable(rel: string): boolean {
  return WRITABLE.has(rel) || isTileFile(rel);
}
