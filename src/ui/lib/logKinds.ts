/**
 * The colour of a log line by its kind, shared by the open log (LogFeed) and
 * the folded row (LogTicker). Each colour is a token with its default as the
 * fallback, so a theme can repaint the log without touching a component
 * (src/themes/).
 */
const KIND_COLORS: Record<string, string> = {
  combat: 'var(--log-combat, #e0a1a1)',
  danger: 'var(--log-danger, #ff6b6b)',
  loot: 'var(--log-loot, #e8b84b)',
  item: 'var(--log-loot, #e8b84b)',
  skill: 'var(--log-skill, #b58fe0)',
  achievement: 'var(--log-achievement, #ffd700)',
  fusion: 'var(--log-fusion, #ff9d3c)',
  quest: 'var(--log-quest, #e0cd7d)',
  travel: 'var(--log-travel, #7db4e0)',
  explore: 'var(--log-explore, #7de0c3)',
  action: 'var(--log-plain, #9aa4ad)',
  info: 'var(--log-plain, #9aa4ad)',
};

export function logColor(kind: string): string {
  return KIND_COLORS[kind] ?? 'var(--text)';
}
