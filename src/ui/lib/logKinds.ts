/**
 * How a log line shows its kind, shared by the open log (LogFeed) and the
 * folded row (LogTicker): a colour and a one-character glyph. The colours are
 * tokens (`--log-*` in app.css), so a theme can repaint the log without touching
 * a component (src/themes/). The glyph is the second channel, so the kind
 * reads without colour.
 */
const KIND_COLORS: Record<string, string> = {
  combat: 'var(--log-combat)',
  danger: 'var(--log-danger)',
  loot: 'var(--log-loot)',
  item: 'var(--log-loot)',
  skill: 'var(--log-skill)',
  achievement: 'var(--log-achievement)',
  fusion: 'var(--log-fusion)',
  quest: 'var(--log-quest)',
  travel: 'var(--log-travel)',
  explore: 'var(--log-explore)',
  action: 'var(--log-plain)',
  info: 'var(--log-plain)',
};

/** One glyph per kind. `item` shares `loot`'s, `action` and `info` share the plain dot. */
const KIND_GLYPHS: Record<string, string> = {
  danger: '!',
  combat: '×',
  loot: '+',
  item: '+',
  skill: '↑',
  achievement: '★',
  fusion: '≈',
  quest: '?',
  travel: '→',
  explore: '◦',
  action: '·',
  info: '·',
};

export function logColor(kind: string): string {
  return KIND_COLORS[kind] ?? 'var(--text)';
}

/** The kind's glyph; a kind the table does not name gets the plain dot. */
export function logGlyph(kind: string): string {
  return KIND_GLYPHS[kind] ?? '·';
}
