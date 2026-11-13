/**
 * The glyph table (docs/plans/pixel-icons.md §4.1, the second layer): emoji →
 * a name in manifest.json. One entry draws that emoji as pixel art in every
 * place that goes through `<Icon>` (a def with no `art` of its own) or
 * `<GlyphText>` (a string: log lines, tooltips, button labels), old log lines
 * saved with the emoji inside included. An emoji with no entry stays an emoji.
 *
 * One emoji, one drawing. Where an emoji stands for several things (🗡️ on four
 * blades, 🛡️ on shields, an attribute and a stance) the def says which with its
 * own `art`, and the table holds the most common reading.
 *
 * Keys are matched with the variation selector (U+FE0F) stripped from both
 * sides, so '⚔' and '⚔️' are one key.
 */
export const GLYPH_ART: Record<string, string> = {
  '📦': 'chest',
  '⚔️': 'crossed_swords',
  '❓': 'unknown',
  '📖': 'book',
  '📜': 'scroll',
  '🏆': 'trophy',
};

const VS16 = /️/g;

/** An emoji without its variation selector: the form the table is matched in. */
export function bareGlyph(emoji: string): string {
  return emoji.replace(VS16, '');
}

const BY_BARE = new Map<string, string>(Object.entries(GLYPH_ART).map(([emoji, name]) => [bareGlyph(emoji), name]));

/** The manifest name drawn for an emoji, or undefined when the table has none. */
export function glyphName(emoji: string): string | undefined {
  return BY_BARE.get(bareGlyph(emoji));
}

// Longest key first, so a sequence beats its own first character; the optional
// selector is swallowed with the match.
const GLYPH_PATTERN = new RegExp(
  `(?:${[...BY_BARE.keys()]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})\\uFE0F?`,
  'gu',
);

export type GlyphPart = { text: string } | { glyph: string; name: string };

/**
 * A string cut into plain text and the emoji the table draws, in order. Joined
 * back (`text` and `glyph`), the parts are the input. Pure: no art is looked up
 * here, so the split is the same with and without the packs.
 */
export function splitGlyphs(text: string): GlyphPart[] {
  const parts: GlyphPart[] = [];
  let from = 0;
  for (const m of text.matchAll(GLYPH_PATTERN)) {
    const at = m.index ?? 0;
    if (at > from) parts.push({ text: text.slice(from, at) });
    parts.push({ glyph: m[0], name: glyphName(m[0]) as string });
    from = at + m[0].length;
  }
  if (from < text.length) parts.push({ text: text.slice(from) });
  return parts;
}
