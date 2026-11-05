import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { QUESTS } from '../src/core/registry';
import { unlockKey } from '../src/core/systems/unlocks';
import type { GameState } from '../src/core/types';
import {
  NAV,
  NAV_CAPTION_AT,
  NAV_GROUPS,
  NAV_IDS,
  SHELL_KEY,
  initialSeen,
  isNewEntry,
  navListShown,
  navMark,
  navSections,
  readSeen,
  reconcileTab,
  visibleNav,
  writeSeen,
  type NavRow,
  type ShellStore,
} from '../src/ui/lib/nav';
import { tutorialScreen } from '../src/ui/lib/tutorialFocus';
import {
  DEFAULT_THEME,
  THEMES,
  applyTheme,
  chooseTheme,
  loadTheme,
  THEME_NAMES,
} from '../src/ui/lib/theme';

/** A post-tutorial save: the screens the tab bar showed to a player past floor 0. */
function postTutorial(seed = 1): GameState {
  const s = createInitialState(seed);
  s.stats['flag:tutorial_done'] = 1;
  return s;
}

const ids = (rows: readonly NavRow[]) => rows.map((r) => r.id);

describe('the NAV table', () => {
  it('lists every screen once, under the ids the tab bar used', () => {
    // These ids are the `ui.tab` values; tutorialFocus.ts names them too.
    expect(NAV_IDS).toEqual([
      'location',
      'combat',
      'skills',
      'ability',
      'equipment',
      'chromosome',
      'music',
      'wuxin',
      'bestiary',
      'quests',
      'achievements',
      'prestige',
    ]);
    expect(new Set(NAV_IDS).size).toBe(NAV.length);
    const groups = NAV_GROUPS.map((g) => g.id);
    for (const row of NAV) {
      expect(groups, row.id).toContain(row.group);
      expect(row.label.length, row.id).toBeGreaterThan(0);
      expect(row.icon.length, row.id).toBeGreaterThan(0);
    }
  });

  it('keeps the rows of one group together, in group order', () => {
    const order = NAV_GROUPS.map((g) => g.id);
    const seen = NAV.map((r) => order.indexOf(r.group));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});

describe('which screens are listed', () => {
  it('lists exactly the seven open screens on a fresh post-tutorial save', () => {
    const s = postTutorial();
    expect(ids(visibleNav(s))).toEqual([
      'location',
      'combat',
      'skills',
      'equipment',
      'bestiary',
      'quests',
      'achievements',
    ]);
  });

  it('adds each gated screen when its gate opens', () => {
    const s = postTutorial();
    s.facets = [{} as GameState['facets'][number]];
    expect(ids(visibleNav(s))).toContain('ability');

    for (const [id, sys] of [
      ['chromosome', 'genes'],
      ['music', 'music'],
      ['wuxin', 'wuxin'],
    ] as const) {
      expect(ids(visibleNav(s)), id).not.toContain(id);
      s.stats[unlockKey(sys)] = 1;
      expect(ids(visibleNav(s)), id).toContain(id);
    }

    expect(ids(visibleNav(s))).not.toContain('prestige');
    s.prestige.count = 1;
    expect(ids(visibleNav(s))).toContain('prestige');
    // Everything open: the whole table, in its own order.
    expect(ids(visibleNav(s))).toEqual([...NAV_IDS]);
  });

  it('shows a quest-ready count as the quests mark, and nothing otherwise', () => {
    const s = postTutorial();
    const quests = NAV.find((r) => r.id === 'quests')!;
    expect(navMark(quests, s)).toBeNull();
    const quest = Object.values(QUESTS).find((q) => q.objectives.every((o) => o.type === 'kill'));
    expect(quest, 'a quest made only of kills').toBeTruthy();
    s.quests[quest!.id] = {
      status: 'active',
      progress: quest!.objectives.map((o) => (o.type === 'kill' ? o.count : 0)),
    };
    expect(navMark(quests, s)).toBe('1 ready');
    // Only the quests row carries a mark.
    expect(NAV.filter((r) => 'mark' in r).map((r) => r.id)).toEqual(['quests']);
  });
});

describe('the list in the left column', () => {
  it('draws with a second entry, not before', () => {
    const rows = visibleNav(postTutorial());
    expect(navListShown([])).toBe(false);
    expect(navListShown(rows.slice(0, 1))).toBe(false);
    expect(navListShown(rows.slice(0, 2))).toBe(true);
  });

  it('never draws a group with no entries, whichever screens are open', () => {
    // Every subset of the twelve screens (4,096), in table order.
    const rows = [...NAV] as NavRow[];
    const order = NAV_GROUPS.map((g) => g.id);
    for (let mask = 0; mask < 1 << rows.length; mask++) {
      const chosen = rows.filter((_, i) => mask & (1 << i));
      const sections = navSections(chosen);
      expect(sections.flatMap((s) => s.entries)).toEqual(chosen);
      for (const sec of sections) {
        expect(sec.entries.length).toBeGreaterThan(0);
        expect(sec.entries.every((e) => e.group === sec.group)).toBe(true);
      }
      const at = sections.map((s) => order.indexOf(s.group));
      expect(at).toEqual([...at].sort((a, b) => a - b));
      // Captions draw only from six visible entries up.
      for (const sec of sections) {
        expect(sec.caption !== null, `mask ${mask}`).toBe(chosen.length >= NAV_CAPTION_AT);
      }
    }
  });

  it('names the groups Act, Build and Records', () => {
    const sections = navSections(visibleNav(postTutorial()));
    expect(sections.map((s) => s.caption)).toEqual(['Act', 'Build', 'Records']);
    expect(sections.map((s) => ids(s.entries))).toEqual([
      ['location', 'combat'],
      ['skills', 'equipment'],
      ['bestiary', 'quests', 'achievements'],
    ]);
  });
});

describe('the open screen and the list', () => {
  it('keeps a listed screen and falls back to Location for one that is not', () => {
    const s = postTutorial();
    const rows = visibleNav(s);
    for (const id of NAV_IDS) {
      const listed = ids(rows).includes(id);
      expect(reconcileTab(id, rows), id).toBe(listed ? id : 'location');
    }
  });

  it('moves off a screen whose gate closes behind it', () => {
    const s = postTutorial();
    s.facets = [{} as GameState['facets'][number]];
    s.prestige.count = 1;
    expect(reconcileTab('ability', visibleNav(s))).toBe('ability');
    expect(reconcileTab('prestige', visibleNav(s))).toBe('prestige');
    // A reset or an import swaps in a save with no ability and no prestige.
    s.facets = [];
    s.prestige.count = 0;
    expect(reconcileTab('ability', visibleNav(s))).toBe('location');
    expect(reconcileTab('prestige', visibleNav(s))).toBe('location');
    // A shuttered system shut again.
    s.stats[unlockKey('music')] = 1;
    expect(reconcileTab('music', visibleNav(s))).toBe('music');
    s.stats[unlockKey('music')] = 0;
    expect(reconcileTab('music', visibleNav(s))).toBe('location');
  });

  it('never returns a screen the list does not hold, in any state of the save', () => {
    const states: GameState[] = [];
    for (const gates of [0, 1]) {
      const s = postTutorial();
      if (gates) {
        s.facets = [{} as GameState['facets'][number]];
        s.prestige.count = 1;
        for (const sys of ['genes', 'music', 'wuxin'] as const) s.stats[unlockKey(sys)] = 1;
      }
      states.push(s);
    }
    states.push(createInitialState(31)); // floor 0, step 1
    for (const s of states) {
      const rows = visibleNav(s);
      for (const id of NAV_IDS) expect(ids(rows)).toContain(reconcileTab(id, rows));
    }
    // Floor 0 lists Location only, so every other screen falls back to it.
    expect(reconcileTab('skills', visibleNav(createInitialState(32)))).toBe('location');
  });
});

describe('floor 0 and the list', () => {
  function walk(g: Game): void {
    for (let i = 0; i < 10_000 && g.state.travel; i++) g.tick();
    expect(g.state.travel).toBeNull();
  }

  function winOneFight(g: Game, spot: string): void {
    const before = g.state.stats[`fights:${spot}`] ?? 0;
    g.selectActivity('hunt');
    for (let i = 0; i < 20_000 && (g.state.stats[`fights:${spot}`] ?? 0) === before; i++) g.tick();
    expect(g.state.stats[`fights:${spot}`] ?? 0).toBe(before + 1);
  }

  it('lists exactly the tutorial screen’s tabs at every step, and the list always has a sidebar', () => {
    const g = new Game(createInitialState(21));
    const s = g.state;
    let checked = 0;
    const check = () => {
      const screen = tutorialScreen(s);
      if (!screen) return;
      checked++;
      expect(new Set(ids(visibleNav(s)))).toEqual(new Set(screen.tabs));
      // The list sits in the left column: whenever it would draw, that column does.
      if (navListShown(visibleNav(s))) expect(screen.sidebar, screen.stepId).toBe(true);
    };

    check();
    g.chooseTutorialWeapon('sword', true);
    g.chooseTutorialStance('neutral');
    check();
    g.travelTo('f0_cellblock');
    walk(g);
    check();
    g.selectActivity('hunt');
    check();
    winOneFight(g, 'f0_cellblock');
    check();
    g.selectActivity(null);
    g.travelTo('f0_field');
    walk(g);
    check();
    g.chooseTutorialSpell('fire');
    check();
    winOneFight(g, 'f0_field');
    check();
    g.selectActivity(null);
    g.travelTo('f0_gate');
    walk(g);
    check();
    expect(checked).toBeGreaterThanOrEqual(8);
    // One screen at the start: no list.
    const first = new Game(createInitialState(22)).state;
    expect(ids(visibleNav(first))).toEqual(['location']);
    expect(navListShown(visibleNav(first))).toBe(false);
  });
});

// ---------- Seen entries ----------

function fakeStore(initial: string | null = null, opts: { throwGet?: boolean; throwSet?: boolean } = {}) {
  const data = new Map<string, string>();
  if (initial !== null) data.set(SHELL_KEY, initial);
  const store: ShellStore & { data: Map<string, string> } = {
    data,
    getItem(key) {
      if (opts.throwGet) throw new Error('blocked');
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      if (opts.throwSet) throw new Error('full');
      data.set(key, value);
    },
  };
  return store;
}

describe('the "new" mark', () => {
  it('marks every visible screen seen on the first load, and stores that', () => {
    const s = postTutorial();
    const store = fakeStore();
    const seen = initialSeen(s, store);
    expect(seen).toEqual(ids(visibleNav(s)));
    expect(readSeen(store)).toEqual(seen);
    for (const row of visibleNav(s)) expect(isNewEntry(row, seen)).toBe(false);
  });

  it('marks a screen that became visible and was never opened, until it is opened', () => {
    const s = postTutorial();
    const store = fakeStore();
    const seen = initialSeen(s, store);
    s.stats[unlockKey('music')] = 1;
    const music = visibleNav(s).find((r) => r.id === 'music')!;
    expect(isNewEntry(music, seen)).toBe(true);
    expect(isNewEntry(visibleNav(s).find((r) => r.id === 'combat')!, seen)).toBe(false);
    writeSeen([...seen, 'music'], store);
    expect(isNewEntry(music, readSeen(store)!)).toBe(false);
  });

  it('keeps the stored ids on a later load, so a screen still unopened stays marked', () => {
    const s = postTutorial();
    s.stats[unlockKey('wuxin')] = 1;
    const store = fakeStore(JSON.stringify({ seen: ['location', 'combat'] }));
    const seen = initialSeen(s, store);
    expect(seen).toEqual(['location', 'combat']);
    expect(isNewEntry(visibleNav(s).find((r) => r.id === 'wuxin')!, seen)).toBe(true);
  });

  it('treats an unreadable value like no value', () => {
    const s = postTutorial();
    for (const bad of ['{not json', '[]', '"seen"', 'null', JSON.stringify({ seen: 'location' })]) {
      const store = fakeStore(bad);
      expect(initialSeen(s, store), bad).toEqual(ids(visibleNav(s)));
    }
  });

  it('survives storage that is missing or throws', () => {
    const s = postTutorial();
    expect(initialSeen(s, null)).toEqual(ids(visibleNav(s)));
    expect(initialSeen(s, fakeStore(null, { throwGet: true }))).toEqual(ids(visibleNav(s)));
    expect(() => writeSeen(['location'], fakeStore(null, { throwSet: true }))).not.toThrow();
    expect(() => writeSeen(['location'], null)).not.toThrow();
    expect(readSeen(null)).toBeNull();
  });

  it('keeps the fields of the shell key it does not own', () => {
    const store = fakeStore(JSON.stringify({ hideNextStep: true, seen: ['location'] }));
    writeSeen(['location', 'combat'], store);
    expect(JSON.parse(store.data.get(SHELL_KEY)!)).toEqual({ hideNextStep: true, seen: ['location', 'combat'] });
  });

  it('reads only strings out of the stored list', () => {
    const store = fakeStore(JSON.stringify({ seen: ['location', 3, null, 'combat'] }));
    expect(readSeen(store)).toEqual(['location', 'combat']);
  });
});

// ---------- Theme ----------

describe('the display theme', () => {
  const root = () => ({ dataset: {} as DOMStringMap });

  it('is Gothic for a browser with no stored pick, and Default stays selectable', () => {
    expect(DEFAULT_THEME).toBe('gothic');
    expect(loadTheme(fakeStore())).toBe('gothic');
    expect(loadTheme(null)).toBe('gothic');
    expect(loadTheme(fakeStore(null, { throwGet: true }))).toBe('gothic');

    const store = fakeStore();
    const page = root();
    chooseTheme('default', store, page);
    expect(page.dataset.theme).toBeUndefined();
    expect(loadTheme(store)).toBe('default');
    chooseTheme('gothic', store, page);
    expect(page.dataset.theme).toBe('gothic');
    expect(loadTheme(store)).toBe('gothic');
  });

  it('stores nothing when a theme is only applied at boot', () => {
    const store = fakeStore();
    const page = root();
    applyTheme(loadTheme(store), page);
    expect(page.dataset.theme).toBe('gothic');
    expect(store.data.size).toBe(0);
  });

  it('ignores a value the old prototype wrote at every boot', () => {
    // The first prototype stored its theme at each boot, so a stored
    // "default" under the old key showed no choice.
    const store = fakeStore();
    store.data.set('ksgproto28-theme', 'default');
    expect(loadTheme(store)).toBe('gothic');
    store.data.set('ksgproto28-theme-choice', 'not a theme');
    expect(loadTheme(store)).toBe('gothic');
  });

  it('picks any listed theme by id, stores it, and names every one for the Menu select', () => {
    for (const id of THEMES) {
      const store = fakeStore();
      const page = root();
      chooseTheme(id, store, page);
      expect(loadTheme(store)).toBe(id);
      expect(page.dataset.theme).toBe(id === 'default' ? undefined : id);
      expect(THEME_NAMES[id].length).toBeGreaterThan(0);
    }
    expect(new Set(THEMES.map((id) => THEME_NAMES[id])).size).toBe(THEMES.length);
  });

  it('survives a store that refuses the write', () => {
    const page = root();
    expect(() => chooseTheme('default', fakeStore(null, { throwSet: true }), page)).not.toThrow();
    expect(page.dataset.theme).toBeUndefined();
  });
});
