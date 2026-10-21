/**
 * Display themes. A per-browser preference, not game state: it lives under its
 * own localStorage key, outside the save's `ksgproto28:save` prefix, so a hard
 * reset keeps it and no save ever carries it. The theme itself is plain CSS
 * keyed on `data-theme` on <html> (src/themes/).
 */
export const THEMES = ['default', 'gothic'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_NAMES: Record<Theme, string> = {
  default: 'Default',
  gothic: 'Gothic',
};

const THEME_KEY = 'ksgproto28-theme';

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return (THEMES as readonly string[]).includes(stored ?? '') ? (stored as Theme) : 'default';
  } catch {
    return 'default';
  }
}

export function applyTheme(theme: Theme): void {
  if (theme === 'default') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private windows and blocked storage: the theme still applies this visit.
  }
}

export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}
