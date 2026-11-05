/**
 * Display themes. A per-browser preference, not game state: it lives under its
 * own localStorage key, outside the save's `ksgproto28:save` prefix, so a hard
 * reset keeps it and no save ever carries it. The theme itself is plain CSS
 * keyed on `data-theme` on <html> (src/themes/).
 *
 * Gothic is the theme a browser gets until its player picks one. Only a pick
 * is stored (`chooseTheme`); applying the theme at boot stores nothing, so a
 * browser that never opened the Menu's theme control keeps following
 * `DEFAULT_THEME`.
 */
export const THEMES = ['default', 'gothic', 'castle', 'survey'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_NAMES: Record<Theme, string> = {
  default: 'Default',
  gothic: 'Gothic',
  castle: 'Castle',
  survey: 'Survey',
};

/** The theme for a browser with no stored pick. */
export const DEFAULT_THEME: Theme = 'gothic';

/**
 * The key holds a pick and nothing else. The first prototype's key,
 * `ksgproto28-theme`, was written at every boot, so a stored value there does
 * not show a choice was made; it is no longer read.
 */
const THEME_KEY = 'ksgproto28-theme-choice';

type ThemeStore = Pick<Storage, 'getItem' | 'setItem'>;

function browserStore(): ThemeStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The stored pick, else `DEFAULT_THEME`. */
export function loadTheme(store: ThemeStore | null = browserStore()): Theme {
  try {
    const stored = store?.getItem(THEME_KEY) ?? '';
    return (THEMES as readonly string[]).includes(stored) ? (stored as Theme) : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Put the theme on the page. Stores nothing. */
export function applyTheme(theme: Theme, root: { dataset: DOMStringMap } = document.documentElement): void {
  if (theme === 'default') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/** The player picked a theme: apply it and remember the pick. */
export function chooseTheme(
  theme: Theme,
  store: ThemeStore | null = browserStore(),
  root?: { dataset: DOMStringMap },
): void {
  applyTheme(theme, root);
  try {
    store?.setItem(THEME_KEY, theme);
  } catch {
    // Private windows and blocked storage: the theme still applies this visit.
  }
}
