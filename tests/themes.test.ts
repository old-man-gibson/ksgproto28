/**
 * The display-theme contract (docs/THEMES.md, docs/plans/display-themes.md).
 *
 * Parses app.css `:root` (the Default theme and the fallback for every token)
 * and each `src/themes/*.css` block `:root[data-theme='id']`, resolves the
 * tokens to colours, and checks every theme against the same thresholds:
 * contrast, hue drift, authored colours after the `ink()` remap, colour
 * vision, and a few source lints that keep cues out of component styles.
 *
 * A failing assertion lists the measured value, so a theme is tuned from the
 * failure text. A theme that needs an exception adds it to a list in this file
 * with the measured value and the reason; the test fails when the exception
 * stops matching.
 */
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/ui/lib/theme';
import { QUALITY_TIERS } from '../src/core/data/quality.data';
import { RARITIES } from '../src/core/data/monsters.data';
import { STATUSES } from '../src/core/data/statuses.data';
import { ANY_POSITION_COLOR, POSITIONS } from '../src/core/data/martial.data';
import { PSI_AXES } from '../src/core/data/spellcraft.data';
import { TALENT_LAP_COLORS } from '../src/ui/lib/talentBar';
import {
  contrast,
  deltaE00,
  hueDistance,
  remapInk,
  simulate,
  type Deficiency,
} from './themeColor';
import {
  ROOT,
  loadThemeTables,
  parseCss,
  readText,
  resolveColor,
  styleBlocks,
  svelteFiles,
} from './themeCss';
import { COLOR_LITERALS, OUTLINE_NONE, STATE_METRICS, type Allow } from './themeAllowlist';

// ---------- The contract ----------

const SURFACES = ['--bg-panel', '--bg-raised', '--bg-hover'] as const;

const LOG_TOKENS = [
  '--log-combat', '--log-danger', '--log-loot', '--log-skill', '--log-achievement',
  '--log-fusion', '--log-quest', '--log-travel', '--log-explore', '--log-plain',
];

/** Fills of the bars (resource, XP, skill and action bars). A bar's track is `--bar-track`. */
const BAR_FILLS = [
  '--hp', '--xp', '--skill', '--stamina', '--stamina-winded', '--stamina-exhausted',
  '--mana', '--manaburn', '--spirit', '--focus', '--action',
];

/** Colours whose hue carries a meaning. A theme may move them, not change what they mean. */
const SEMANTIC = [
  '--hp', '--xp', '--skill', '--stamina', '--stamina-winded', '--stamina-exhausted',
  '--mana', '--manaburn', '--spirit', '--focus', '--danger', '--action',
];

/**
 * The bars drawn together in the left column (Sidebar.svelte): the pool bars
 * (HP, stamina, mana, spirit, focus), the action bar and the XP bar under them.
 */
const SIDE_BY_SIDE = ['--hp', '--stamina', '--mana', '--spirit', '--focus', '--action', '--xp'];

const DISTRICTS = 'abcdefghi'.split('').map((c) => `--district-${c}`);

/** Identity colours and art ink: the same in every theme. A theme file does not declare them. */
const FIXED = [
  '--mat-iron', '--mat-steel', '--mat-bronze', '--mat-metal', '--mat-wood', '--mat-leather',
  '--tile-halo', '--art-ink', '--art-halo',
];

/** What a theme file declares itself. Everything else falls back to Default. */
const PER_THEME = [
  '--bg', '--bg-panel', '--bg-raised', '--bg-hover', '--bg-sunken', '--border',
  '--text', '--text-dim', '--accent', '--danger', '--warn',
  ...LOG_TOKENS,
  '--edge', '--ring', '--here', '--sel-bg', '--sel-ink', '--text-off',
  '--bar-ink', '--bar-halo', '--ink-lmin', '--ink-lmax',
];

/** Declared by Default (app.css) and optionally overridden by a theme. */
const SHARED = [
  '--frame', ...BAR_FILLS, '--ring-w', '--buff', '--night', '--night-edge',
  '--bar-track', '--road', ...DISTRICTS, '--scrim', '--scrim-deep', '--lift', '--hatch-lock', '--tint-mix',
  '--bg-deep', '--sel-ink-lmin', '--sel-ink-lmax',
];

const CONTRACT = [...new Set([...PER_THEME, ...SHARED, ...FIXED])];

const tables = loadThemeTables();
const THEME_IDS = ['default', ...Object.keys(tables.own).sort()];

const colorOf = (id: string, token: string): string => resolveColor(tables.merged[id], token);
const numberOf = (id: string, token: string): number => Number(tables.merged[id][token]);

/** Measured value to two decimals, for failure text. */
const r2 = (n: number): string => n.toFixed(2);

// ---------- Authored colours (the data the UI draws with ink()) ----------

type Family = {
  id: string;
  colors: string[];
  /** Compare the colours against each other after the remap. Off where colour is not the identity. */
  pairwise: boolean;
};

const lower = (list: (string | undefined)[]): string[] => [
  ...new Set(list.filter((c): c is string => !!c).map((c) => c.toLowerCase())),
];

/** Same-family colours are compared against each other after the remap. */
const FAMILIES: Family[] = [
  { id: 'quality tiers', colors: lower(Object.values(QUALITY_TIERS).map((t) => t.color)), pairwise: true },
  { id: 'monster rarities', colors: lower(Object.values(RARITIES).map((t) => t.color)), pairwise: true },
  // A status is told apart by its icon and its name; Default itself gives five statuses
  // nearly the same red, and a lifted red clips to one pink. Contrast is still checked.
  { id: 'statuses', colors: lower(Object.values(STATUSES).map((t) => t.color)), pairwise: false },
  { id: 'psionic axes', colors: lower(Object.values(PSI_AXES).map((t) => t.color)), pairwise: true },
  {
    id: 'martial positions',
    colors: lower([...Object.values(POSITIONS).map((t) => t.color), ANY_POSITION_COLOR]),
    pairwise: true,
  },
  { id: 'talent laps', colors: lower(TALENT_LAP_COLORS), pairwise: true },
];
const DATA_COLORS = lower(FAMILIES.flatMap((f) => f.colors));

function minPair(colors: string[]): { min: number; pair: string } {
  let min = Infinity;
  let pair = '';
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const d = deltaE00(colors[i], colors[j]);
      if (d < min) {
        min = d;
        pair = `${colors[i]} / ${colors[j]}`;
      }
    }
  }
  return { min, pair };
}

/** What Default keeps today per family: the floor a remapped family may not fall below is half of it. */
const FAMILY_FLOOR: Record<string, number> = Object.fromEntries(
  FAMILIES.map((f) => [f.id, minPair(f.colors).min * 0.5]),
);

/**
 * Default keeps its authored colours as they are (`--ink-lmin: 0`), so some of
 * them sit under 4.5:1 on its panels. The count is pinned: a new low-contrast
 * authored colour fails here instead of joining the list unseen. Raise
 * Default's `--ink-lmin` in app.css and set this to 0 to remove the exception.
 */
const DEFAULT_LOW_CONTRAST_DATA = { panelOrRaised: 22, selected: 34 };

// ---------- Colour-vision exceptions ----------

interface VisionException {
  a: string;
  b: string;
  kind: Deficiency;
  measured: number;
  reason: string;
}

const KEEPS_FILLS =
  'The theme keeps its bar fills (ruling 1 of the plan); the bars carry a text label and an icon.';

/** Pairs allowed under 8 ΔE00, per theme. The measured value must match within 0.15. */
const VISION_EXCEPTIONS: Record<string, VisionException[]> = {
  default: [
    { a: '--mana', b: '--spirit', kind: 'protan', measured: 6.4, reason: KEEPS_FILLS },
    { a: '--mana', b: '--spirit', kind: 'deutan', measured: 1.6, reason: KEEPS_FILLS },
    { a: '--stamina', b: '--xp', kind: 'protan', measured: 7.6, reason: KEEPS_FILLS },
    { a: '--hp', b: '--stamina', kind: 'deutan', measured: 7.1, reason: KEEPS_FILLS },
    { a: '--hp', b: '--focus', kind: 'deutan', measured: 7.99, reason: KEEPS_FILLS },
  ],
  gothic: [
    { a: '--mana', b: '--spirit', kind: 'protan', measured: 4.0, reason: KEEPS_FILLS },
    { a: '--mana', b: '--spirit', kind: 'deutan', measured: 1.8, reason: KEEPS_FILLS },
    { a: '--stamina', b: '--focus', kind: 'deutan', measured: 5.64, reason: KEEPS_FILLS },
  ],
};

// ---------- Tests ----------

describe('theme files', () => {
  it('every id in THEMES has a stylesheet block, and every block has an id', () => {
    const declared = THEMES.filter((t) => t !== 'default').sort();
    expect(Object.keys(tables.own).sort()).toEqual(declared);
  });

  it('Default (app.css :root) declares every contract token', () => {
    const missing = CONTRACT.filter((t) => tables.base[t] === undefined);
    expect(missing, 'missing from app.css :root').toEqual([]);
  });

  it.each(THEME_IDS.filter((t) => t !== 'default'))('%s declares the per-theme tokens', (id) => {
    const missing = PER_THEME.filter((t) => tables.own[id][t] === undefined);
    expect(missing, `missing from src/themes/${id}.css`).toEqual([]);
  });

  it.each(THEME_IDS.filter((t) => t !== 'default'))('%s leaves the fixed tokens alone', (id) => {
    const overridden = FIXED.filter((t) => tables.own[id][t] !== undefined);
    expect(overridden, 'identity colours and art ink are the same in every theme').toEqual([]);
  });

  it('every colour token resolves to a colour', () => {
    const colorTokens = CONTRACT.filter(
      (t) =>
        !['--ring-w', '--ink-lmin', '--ink-lmax', '--sel-ink-lmin', '--sel-ink-lmax', '--lift',
          '--hatch-lock', '--scrim', '--scrim-deep', '--tint-mix', '--road'].includes(t) && !DISTRICTS.includes(t),
    );
    const bad: string[] = [];
    for (const id of THEME_IDS) {
      for (const t of colorTokens) {
        try {
          resolveColor(tables.merged[id], t);
        } catch (e) {
          bad.push(`${id} ${t}: ${(e as Error).message}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('the remap bounds are numbers with lmin below lmax', () => {
    const bad: string[] = [];
    for (const id of THEME_IDS) {
      for (const [lo, hi] of [['--ink-lmin', '--ink-lmax'], ['--sel-ink-lmin', '--sel-ink-lmax']]) {
        const a = numberOf(id, lo);
        const b = numberOf(id, hi);
        if (!(a >= 0 && b <= 1 && a < b)) bad.push(`${id} ${lo}=${a} ${hi}=${b}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe.each(THEME_IDS)('theme %s: contrast and colour', (id) => {
  const c = (token: string) => colorOf(id, token);

  it('text is at least 7:1 on panel, raised and hover', () => {
    const bad = SURFACES.filter((s) => contrast(c('--text'), c(s)) < 7).map(
      (s) => `--text on ${s}: ${r2(contrast(c('--text'), c(s)))}`,
    );
    expect(bad).toEqual([]);
  });

  it('dim text, accent, danger, warn, xp and every log colour are at least 4.5:1 on panel, raised and hover', () => {
    const bad: string[] = [];
    for (const token of ['--text-dim', '--accent', '--danger', '--warn', '--xp', ...LOG_TOKENS]) {
      for (const s of SURFACES) {
        const ratio = contrast(c(token), c(s));
        if (ratio < 4.5) bad.push(`${token} on ${s}: ${r2(ratio)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('disabled text is at least 4.5:1 on raised', () => {
    expect(contrast(c('--text-off'), c('--bg-raised'))).toBeGreaterThanOrEqual(4.5);
  });

  it('edge and ring are at least 3:1 on panel and raised', () => {
    const bad: string[] = [];
    for (const token of ['--edge', '--ring']) {
      for (const s of ['--bg-panel', '--bg-raised']) {
        const ratio = contrast(c(token), c(s));
        if (ratio < 3) bad.push(`${token} on ${s}: ${r2(ratio)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('ring, here and accent are at least 12 ΔE00 apart', () => {
    const bad: string[] = [];
    for (const [a, b] of [['--ring', '--here'], ['--ring', '--accent'], ['--here', '--accent']]) {
      const d = deltaE00(c(a), c(b));
      if (d < 12) bad.push(`${a} / ${b}: ${r2(d)}`);
    }
    expect(bad).toEqual([]);
  });

  it('every bar fill is at least 3:1 on the bar track', () => {
    const bad = BAR_FILLS.filter((t) => contrast(c(t), c('--bar-track')) < 3).map(
      (t) => `${t} on --bar-track: ${r2(contrast(c(t), c('--bar-track')))}`,
    );
    expect(bad).toEqual([]);
  });

  it('bar label ink is at least 4.5:1 on every fill, or on its halo', () => {
    const onHalo = contrast(c('--bar-ink'), c('--bar-halo'));
    if (onHalo >= 4.5) return;
    const bad = BAR_FILLS.filter((t) => contrast(c('--bar-ink'), c(t)) < 4.5).map(
      (t) => `--bar-ink on ${t}: ${r2(contrast(c('--bar-ink'), c(t)))} (on --bar-halo ${r2(onHalo)})`,
    );
    expect(bad).toEqual([]);
  });

  it('selected ink is at least 4.5:1 on the selected fill', () => {
    expect(contrast(c('--sel-ink'), c('--sel-bg'))).toBeGreaterThanOrEqual(4.5);
  });

  it('semantic colours keep their hue within 30 degrees of Default (OKLCH)', () => {
    const bad: string[] = [];
    for (const token of SEMANTIC) {
      const d = hueDistance(c(token), colorOf('default', token));
      if (d > 30) bad.push(`${token}: ${d.toFixed(0)} degrees`);
    }
    expect(bad).toEqual([]);
  });

  it('bars drawn together differ by at least 8 ΔE00 for protan and deutan viewers', () => {
    const exceptions = VISION_EXCEPTIONS[id] ?? [];
    const unexplained: string[] = [];
    const seen = new Set<VisionException>();
    for (const kind of ['protan', 'deutan'] as Deficiency[]) {
      for (let i = 0; i < SIDE_BY_SIDE.length; i++) {
        for (let j = i + 1; j < SIDE_BY_SIDE.length; j++) {
          const [a, b] = [SIDE_BY_SIDE[i], SIDE_BY_SIDE[j]];
          const d = deltaE00(simulate(c(a), kind), simulate(c(b), kind));
          if (d >= 8) continue;
          const hit = exceptions.find(
            (e) => e.kind === kind && ((e.a === a && e.b === b) || (e.a === b && e.b === a)),
          );
          if (!hit) unexplained.push(`${a} / ${b} (${kind}): ${r2(d)}`);
          else {
            seen.add(hit);
            if (Math.abs(hit.measured - d) > 0.15)
              unexplained.push(`${a} / ${b} (${kind}): measured ${r2(d)}, exception says ${hit.measured}`);
          }
        }
      }
    }
    const stale = exceptions.filter((e) => !seen.has(e)).map((e) => `${e.a} / ${e.b} (${e.kind}) no longer under 8`);
    expect([...unexplained, ...stale]).toEqual([]);
  });
});

describe.each(THEME_IDS)('theme %s: authored colours after ink()', (id) => {
  const c = (token: string) => colorOf(id, token);
  const normal: [number, number] = [numberOf(id, '--ink-lmin'), numberOf(id, '--ink-lmax')];
  const selected: [number, number] = [numberOf(id, '--sel-ink-lmin'), numberOf(id, '--sel-ink-lmax')];
  const failing = (bounds: [number, number], surfaces: string[]) =>
    DATA_COLORS.filter((raw) => {
      const ink = remapInk(raw, bounds[0], bounds[1]);
      return surfaces.some((s) => contrast(ink, c(s)) < 4.5);
    });

  it('are at least 4.5:1 on panel and raised', () => {
    const bad = failing(normal, ['--bg-panel', '--bg-raised']);
    if (id === 'default') {
      expect(bad.length, `Default's low-contrast authored colours: ${bad.join(' ')}`).toBe(
        DEFAULT_LOW_CONTRAST_DATA.panelOrRaised,
      );
      return;
    }
    expect(
      bad.map((raw) => {
        const ink = remapInk(raw, normal[0], normal[1]);
        return `${raw} -> ${ink}: ${r2(Math.min(contrast(ink, c('--bg-panel')), contrast(ink, c('--bg-raised'))))}`;
      }),
    ).toEqual([]);
  });

  it('are at least 4.5:1 on the selected fill, with the selected-scope remap', () => {
    const bad = failing(selected, ['--sel-bg']);
    if (id === 'default') {
      expect(bad.length, `Default's low-contrast authored colours on --sel-bg: ${bad.join(' ')}`).toBe(
        DEFAULT_LOW_CONTRAST_DATA.selected,
      );
      return;
    }
    expect(
      bad.map((raw) => {
        const ink = remapInk(raw, selected[0], selected[1]);
        return `${raw} -> ${ink}: ${r2(contrast(ink, c('--sel-bg')))}`;
      }),
    ).toEqual([]);
  });

  it('keep their family apart: each family keeps half of Default separation, Refuse and Poor stay distinct', () => {
    const bad: string[] = [];
    for (const [label, bounds] of [['normal', normal], ['selected', selected]] as const) {
      for (const family of FAMILIES.filter((f) => f.pairwise)) {
        const { min, pair } = minPair(family.colors.map((raw) => remapInk(raw, bounds[0], bounds[1])));
        if (min < FAMILY_FLOOR[family.id])
          bad.push(`${family.id} (${label} scope): ${r2(min)} < ${r2(FAMILY_FLOOR[family.id])} at ${pair}`);
      }
      const refuse = remapInk(QUALITY_TIERS.f.color, bounds[0], bounds[1]);
      const poor = remapInk(QUALITY_TIERS.e.color, bounds[0], bounds[1]);
      const d = deltaE00(refuse, poor);
      if (d < 10) bad.push(`Refuse / Poor (${label} scope): ${r2(d)} < 10`);
    }
    expect(bad).toEqual([]);
  });
});

describe('authored colours', () => {
  it('every hex colour in src/core/data is in the families above', () => {
    const known = new Set(DATA_COLORS);
    const unknown: string[] = [];
    for (const file of readdirSync(`${ROOT}/src/core/data`).filter((f) => f.endsWith('.data.ts'))) {
      readText(`src/core/data/${file}`)
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(/(?<![\w&])#(?:[0-9a-fA-F]{6})(?![\w-])/g)) {
            if (!known.has(m[0].toLowerCase())) unknown.push(`${file}:${i + 1} ${m[0]}`);
          }
        });
    }
    expect(unknown, 'add the colour source to FAMILIES in tests/themes.test.ts').toEqual([]);
  });
});

describe('shared cue rules', () => {
  const cues = () => parseCss(readText('src/themes/cues.css'));
  const app = () => parseCss(readText('src/app.css'));
  const decl = (rules: ReturnType<typeof parseCss>, selector: string, prop: string): string | undefined =>
    rules.find((r) => r.selectors.includes(selector))?.decls.find(([p]) => p === prop)?.[1];

  it('bar labels draw --bar-ink with a --bar-halo outline', () => {
    const label = app().find((r) => r.selectors.includes('.bar > .label'));
    expect(label?.decls.find(([p]) => p === 'color')?.[1]).toBe('var(--bar-ink)');
    expect(label?.decls.find(([p]) => p === 'text-shadow')?.[1]).toContain('var(--bar-halo)');
  });

  it('the track of a bar reads --bar-track', () => {
    expect(decl(app(), '.bar', 'background')).toBe('var(--bar-track)');
  });

  it('keyboard focus draws a ring from --ring', () => {
    const ring = decl(cues(), ':focus-visible', 'outline');
    expect(ring).toContain('var(--ring)');
    expect(ring).toContain('var(--ring-w)');
  });

  it('a disabled button changes colour, border style and cursor, and nothing that moves layout', () => {
    const rule = cues().find((r) => r.selectors.includes(':root button:disabled'));
    expect(rule, ':root button:disabled in cues.css').toBeDefined();
    const props = Object.fromEntries(rule!.decls);
    expect(props['color']).toBe('var(--text-off)');
    expect(props['border-style']).toBe('dashed');
    expect(props['cursor']).toBe('not-allowed');
    expect(Object.keys(props).filter((p) => /^(padding|font|border-width|margin)/.test(p))).toEqual([]);
  });

  it('cues.css holds tokens, :focus-visible and button:disabled only', () => {
    const selectors = cues().flatMap((r) => r.selectors);
    expect(selectors.filter((s) => !/^(:root( button:disabled)?$|:focus-visible$)/.test(s))).toEqual([]);
  });
});

// ---------- Source lints ----------

/** Blank out comments, keeping line numbers. */
function blankComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(^|[\s;{}])\/\/[^\n]*/g, (m, lead) => lead + blank(m.slice(lead.length)));
}

const HEX = /(?<![\w&{])(?<!url\()(?<!href=")#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/;
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;
const NAMED =
  'white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|gold|silver|brown|cyan|magenta|teal|navy|maroon|lime|olive|aqua|fuchsia|tomato|crimson|coral|salmon|khaki|indigo|violet|beige|ivory|tan';
const NAMED_DECL = new RegExp(
  `(?:^|[;{\\s"'])(?:color|background(?:-color)?|border(?:-[\\w]+)?(?:-color)?|outline(?:-color)?|fill|stroke|stop-color|box-shadow|text-shadow|caret-color|accent-color|--[\\w-]+)\\s*:[^;}]*\\b(?:${NAMED})\\b`,
  'i',
);

function allowed(list: Allow[], file: string, line: string): Allow | undefined {
  return list.find((a) => a.file === file && (a.line === undefined || a.line === line.trim()));
}

function staleEntries(list: Allow[], seen: Set<Allow>): string[] {
  return list.filter((a) => !seen.has(a)).map((a) => `${a.file}${a.line ? `: ${a.line}` : ''} (${a.reason})`);
}

describe('source lints', () => {
  it('no colour literal in a .svelte file outside the allowlist', () => {
    const bad: string[] = [];
    const seen = new Set<Allow>();
    for (const file of svelteFiles()) {
      blankComments(readText(file))
        .split('\n')
        .forEach((line, i) => {
          if (!(HEX.test(line) || COLOR_FN.test(line) || NAMED_DECL.test(line))) return;
          const hit = allowed(COLOR_LITERALS, file, line);
          if (hit) seen.add(hit);
          else bad.push(`${file}:${i + 1}  ${line.trim().slice(0, 110)}`);
        });
    }
    expect(bad, 'use a token from app.css, or allow the line in tests/themeAllowlist.ts with a reason').toEqual([]);
    expect(staleEntries(COLOR_LITERALS, seen), 'allowlist entries that match nothing').toEqual([]);
  });

  const STATE = new RegExp(
    [
      '\\.selected(?![\\w-])',
      '\\.nav-on(?![\\w-])',
      '\\.here(?![\\w-])',
      '\\.picked(?![\\w-])',
      '\\.active(?![\\w-])',
      ':disabled(?![\\w-])',
      '\\[aria-current',
    ].join('|'),
  );
  const METRIC = /^(font-weight|font-size|font|padding(-[a-z]+)*|border-width|border-(top|right|bottom|left)-width)$/;

  /** Every CSS source: app.css, the theme files and each Svelte style block. */
  function cssSources(): { file: string; css: string }[] {
    const out = [{ file: 'src/app.css', css: readText('src/app.css') }];
    for (const f of readdirSync(`${ROOT}/src/themes`).filter((n) => n.endsWith('.css')))
      out.push({ file: `src/themes/${f}`, css: readText(`src/themes/${f}`) });
    for (const f of svelteFiles()) for (const css of styleBlocks(readText(f))) out.push({ file: f, css });
    return out;
  }

  it('state rules set no font size, font weight, padding or border width', () => {
    const bad: string[] = [];
    const seen = new Set<Allow>();
    for (const { file, css } of cssSources()) {
      for (const rule of parseCss(css)) {
        const states = rule.selectors.filter((s) => STATE.test(s));
        if (states.length === 0) continue;
        for (const [prop, value] of rule.decls) {
          if (!METRIC.test(prop)) continue;
          const text = `${states[0]} { ${prop}: ${value} }`;
          const hit = allowed(STATE_METRICS, file, text);
          if (hit) seen.add(hit);
          else bad.push(`${file}  ${text}`);
        }
      }
    }
    expect(bad, 'use colour, an inset shadow, a border colour or style, or a reserved marker').toEqual([]);
    expect(staleEntries(STATE_METRICS, seen)).toEqual([]);
  });

  it('no rule removes the focus outline without a replacement', () => {
    const bad: string[] = [];
    const seen = new Set<Allow>();
    for (const { file, css } of cssSources()) {
      for (const rule of parseCss(css)) {
        for (const [prop, value] of rule.decls) {
          const off = (prop === 'outline' && /^(none|0)\b/.test(value)) || (prop === 'outline-width' && /^0/.test(value));
          if (!off) continue;
          // `:focus:not(:focus-visible)` only silences the mouse; the keyboard ring stays.
          if (rule.selectors.every((s) => s.includes(':not(:focus-visible)'))) continue;
          const text = `${rule.selectors[0]} { ${prop}: ${value} }`;
          const hit = allowed(OUTLINE_NONE, file, text);
          if (hit) seen.add(hit);
          else bad.push(`${file}  ${text}`);
        }
      }
    }
    expect(bad, 'draw a ring on :focus-visible instead').toEqual([]);
    expect(staleEntries(OUTLINE_NONE, seen)).toEqual([]);
  });
});
