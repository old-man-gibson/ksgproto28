import { describe, expect, it } from 'vitest';
import { COVER_SIGHT, RADAR_TICKS, ROYALE_CACHES, ROYALE_DENS, ROYALE_FIELD, ROYALE_SECTIONS } from '../src/core/data/festival.data';
import { SECTION_IDS, type RoyaleMap } from '../src/core/systems/royaleMap';
import { sees } from '../src/core/systems/royaleTerrain';
import type { FieldFighter, RoyaleField } from '../src/core/types';
import {
  ISO_K,
  PALETTE_RECIPE,
  VIEW_PAD,
  VIEW_SPAN,
  cameraBox,
  compassDirection,
  festivalMinutes,
  fieldBounds,
  fieldPoint,
  isoDirection,
  isoEllipse,
  isoPoint,
  mapPalette,
  mixColor,
  paletteKey,
  parseColor,
  radarText,
  radarView,
  royaleMapPixels,
  sectionCentres,
  visibleFeatures,
  visibleFighters,
} from '../src/ui/lib/royaleView';

// The royale map's pure reads (ui/lib/royaleView.ts): the projection the
// terrain image is placed by, the camera window, the compass, the fog (which
// features and fighters the player's map shows), the radar line and the
// colour of each section's cells.

const SIZE = 100;
const cellOf = (id: string | undefined) => (id ? SECTION_IDS.indexOf(id) + 1 : 0);

/** A square map of `SIZE` cells painted by `paint(x, y)`, with the places given. */
function mapWith(
  paint: (x: number, y: number) => string | undefined,
  places: Partial<Pick<RoyaleMap, 'caches' | 'dens' | 'buildings'>> = {},
): RoyaleMap {
  const cells = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) cells[y * SIZE + x] = cellOf(paint(x, y));
  return { seed: 1, size: SIZE, cells, buildings: [], caches: {}, dens: {}, start: { x: 50, y: 98 }, ...places };
}

const meadow = () => mapWith(() => undefined);

const fighter = (id: number, x: number, y: number, extra: Partial<FieldFighter> = {}): FieldFighter => ({
  id,
  monsterId: 'ph_survivor_blade',
  x,
  y,
  hp: 1,
  wins: 0,
  ...extra,
});

function fieldWith(fighters: FieldFighter[], player = { x: 50, y: 50 }, extra: Partial<RoyaleField> = {}): RoyaleField {
  return { size: SIZE, fighters, player: { ...player }, fallen: 0, openedAt: 0, ...extra };
}

describe('the projection', () => {
  it('is the matrix the terrain image is placed by, and its own inverse', () => {
    // transform="matrix(K, K/2, -K, K/2, 0, 0)" sends (x, y) to (K x - K y, K x / 2 + K y / 2).
    for (const [x, y] of [[0, 0], [180, 0], [0, 180], [37.5, 91], [180, 180]]) {
      const p = isoPoint(x, y);
      expect(p.sx).toBeCloseTo(ISO_K * x - ISO_K * y);
      expect(p.sy).toBeCloseTo((ISO_K / 2) * x + (ISO_K / 2) * y);
      const back = fieldPoint(p.sx, p.sy);
      expect(back.x).toBeCloseTo(x);
      expect(back.y).toBeCloseTo(y);
    }
  });

  it('turns a field direction into a unit vector on the screen', () => {
    // North (low y) goes up and to the right, east (high x) down and to the right.
    const north = isoDirection(0, -1)!;
    expect(north.ux).toBeGreaterThan(0);
    expect(north.uy).toBeLessThan(0);
    const east = isoDirection(1, 0)!;
    expect(east.ux).toBeGreaterThan(0);
    expect(east.uy).toBeGreaterThan(0);
    expect(Math.hypot(east.ux, east.uy)).toBeCloseTo(1);
    expect(isoDirection(0, 0)).toBeNull();
  });

  it('draws a circle of field units as an ellipse twice as wide as tall', () => {
    const { rx, ry } = isoEllipse(10);
    expect(rx).toBeCloseTo(2 * ry);
    // The circle's extreme points: (r, -r)/sqrt2 on the diamond's horizontal axis.
    const edge = isoPoint(10 / Math.SQRT2, -10 / Math.SQRT2);
    expect(edge.sx).toBeCloseTo(rx);
  });
});

describe('the compass', () => {
  it('reads north as the far edge (low y) and east as high x', () => {
    expect(compassDirection(0, -5)).toBe('north');
    expect(compassDirection(5, 0)).toBe('east');
    expect(compassDirection(0, 5)).toBe('south');
    expect(compassDirection(-5, 0)).toBe('west');
  });

  it('names the diagonals and splits each sector at 22.5 degrees', () => {
    expect(compassDirection(4, -4)).toBe('north-east');
    expect(compassDirection(4, 4)).toBe('south-east');
    expect(compassDirection(-4, 4)).toBe('south-west');
    expect(compassDirection(-4, -4)).toBe('north-west');
    // 20 degrees off north toward east is still north; 25 degrees is north-east.
    expect(compassDirection(Math.tan((20 * Math.PI) / 180), -1)).toBe('north');
    expect(compassDirection(Math.tan((25 * Math.PI) / 180), -1)).toBe('north-east');
    // Across the wrap at north.
    expect(compassDirection(-Math.tan((20 * Math.PI) / 180), -1)).toBe('north');
    expect(compassDirection(-Math.tan((25 * Math.PI) / 180), -1)).toBe('north-west');
  });

  it('has an answer for a zero vector', () => {
    expect(compassDirection(0, 0)).toBe('north');
  });
});

describe('the camera', () => {
  const size = ROYALE_FIELD.size;
  const bounds = fieldBounds(size);
  const inside = (b: { x: number; y: number; w: number; h: number }) =>
    b.x >= bounds.x - 1e-9 && b.y >= bounds.y - 1e-9 && b.x + b.w <= bounds.x + bounds.w + 1e-9 && b.y + b.h <= bounds.y + bounds.h + 1e-9;

  it('centres on the player, VIEW_SPAN units across', () => {
    const c = isoPoint(90, 90);
    const box = cameraBox(c, size, false);
    expect(box.w).toBeCloseTo(2 * VIEW_SPAN * ISO_K);
    expect(box.h).toBeCloseTo(VIEW_SPAN * ISO_K);
    expect(box.x + box.w / 2).toBeCloseTo(c.sx);
    expect(box.y + box.h / 2).toBeCloseTo(c.sy);
  });

  it('stays inside the field wherever the player stands', () => {
    for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, size], [3, 170], [90, 178], [175, 5], [90, 90]]) {
      expect(inside(cameraBox(isoPoint(x, y), size, false)), `at ${x},${y}`).toBe(true);
    }
  });

  it('slides along the edge instead of leaving the field', () => {
    // The far corner is the top of the diamond; the view stops at the field's top.
    const top = cameraBox(isoPoint(0, 0), size, false);
    expect(top.y).toBeCloseTo(bounds.y);
    const right = cameraBox(isoPoint(size, 0), size, false);
    expect(right.x + right.w).toBeCloseTo(bounds.x + bounds.w);
  });

  it('keeps the player in view, with room for the sprite and its label', () => {
    for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, size], [3, 170], [90, 178], [175, 5], [90, 90], [20, 60], [150, 120]]) {
      const c = isoPoint(x, y);
      const box = cameraBox(c, size, false);
      const near = x === 0 || y === 0 || x === size || y === size;
      // A player on the field's very edge may stand at the window's border (the bounds stop it), no nearer.
      const padX = near ? 0 : VIEW_PAD.x;
      const padY = near ? 0 : VIEW_PAD.y;
      const at = `at ${x},${y}`;
      expect(c.sx, `left of the window ${at}`).toBeGreaterThanOrEqual(box.x + padX - 1e-9);
      expect(c.sx, `right of the window ${at}`).toBeLessThanOrEqual(box.x + box.w - padX + 1e-9);
      expect(c.sy, `above the window ${at}`).toBeGreaterThanOrEqual(box.y + padY - 1e-9);
      expect(c.sy, `below the window ${at}`).toBeLessThanOrEqual(box.y + box.h - padY + 1e-9);
    }
  });

  it('pulls the window toward the middle so an edge does not leave it half empty', () => {
    // The diamond: |sx| / (size K) + |sy - size K / 2| / (size K / 2) <= 1.
    const emptyShare = (b: { x: number; y: number; w: number; h: number }) => {
      let out = 0;
      let n = 0;
      for (let i = 0; i < 24; i++) {
        for (let j = 0; j < 12; j++) {
          const sx = b.x + ((i + 0.5) / 24) * b.w;
          const sy = b.y + ((j + 0.5) / 12) * b.h;
          n++;
          if (Math.abs(sx) / (size * ISO_K) + Math.abs(sy - (size * ISO_K) / 2) / ((size * ISO_K) / 2) > 1) out++;
        }
      }
      return out / n;
    };
    const start = isoPoint(90, size - 2);
    const centred = { x: start.sx - VIEW_SPAN * ISO_K, y: start.sy - (VIEW_SPAN * ISO_K) / 2, w: 2 * VIEW_SPAN * ISO_K, h: VIEW_SPAN * ISO_K };
    expect(emptyShare(centred)).toBeGreaterThan(0.4);
    expect(emptyShare(cameraBox(start, size, false))).toBeLessThan(0.1);
    // In the middle of the field the window sits on the player.
    const mid = isoPoint(size / 2, size / 2);
    const box = cameraBox(mid, size, false);
    expect(box.x + box.w / 2).toBeCloseTo(mid.sx);
    expect(box.y + box.h / 2).toBeCloseTo(mid.sy);
    expect(emptyShare(box)).toBe(0);
  });

  it('shows the whole field on request, and when the span covers it', () => {
    expect(cameraBox(isoPoint(10, 10), size, true)).toEqual(bounds);
    expect(cameraBox(isoPoint(10, 10), 60, false)).toEqual(fieldBounds(60));
    expect(cameraBox(isoPoint(10, 10), size, false, size)).toEqual(bounds);
  });

  it('bounds the diamond with room around it', () => {
    const corners = [isoPoint(0, 0), isoPoint(size, 0), isoPoint(size, size), isoPoint(0, size)];
    for (const p of corners) {
      expect(p.sx).toBeGreaterThan(bounds.x);
      expect(p.sx).toBeLessThan(bounds.x + bounds.w);
      expect(p.sy).toBeGreaterThan(bounds.y);
      expect(p.sy).toBeLessThan(bounds.y + bounds.h);
    }
  });
});

describe('section centres', () => {
  it('puts a name on a cell of its section, near the middle of a blob', () => {
    const map = mapWith((x, y) => (x >= 10 && x < 30 && y >= 40 && y < 60 ? 'forest' : undefined));
    const forest = sectionCentres(map).find((c) => c.id === 'forest')!;
    expect(forest.cells).toBe(400);
    expect(forest.x).toBeGreaterThan(19);
    expect(forest.x).toBeLessThan(21);
    expect(forest.y).toBeGreaterThan(49);
    expect(forest.y).toBeLessThan(51);
  });

  it('keeps a bent section’s name on the section, where the centroid is not', () => {
    // An L: the centroid of its cells lies in the empty corner of the bend.
    const map = mapWith((x, y) => ((x < 10 && y < 60) || (y >= 50 && y < 60 && x < 60) ? 'river' : undefined));
    const river = sectionCentres(map).find((c) => c.id === 'river')!;
    expect(map.cells[Math.floor(river.y) * SIZE + Math.floor(river.x)]).toBe(cellOf('river'));
  });

  it('names no section that has no cells, and lists the rest', () => {
    const map = mapWith((x) => (x < 10 ? 'cliff' : x >= 90 ? 'cave' : undefined));
    expect(sectionCentres(map).map((c) => c.id).sort()).toEqual(['cave', 'cliff']);
    expect(sectionCentres(meadow())).toEqual([]);
  });

  it('is read once per map', () => {
    const map = meadow();
    expect(sectionCentres(map)).toBe(sectionCentres(map));
  });
});

describe('what the map shows of the features', () => {
  const den = ROYALE_DENS[0];
  const guarded = ROYALE_CACHES.find((c) => c.den)!;
  const free = ROYALE_CACHES.find((c) => !c.den)!;
  const guard = ROYALE_DENS.find((d) => d.id === guarded.den)!;

  // Every den at the north-west corner, every cache at the south-east one.
  const map = mapWith(() => undefined, {
    dens: Object.fromEntries(ROYALE_DENS.map((d) => [d.id, { x: 10, y: 10 }])),
    caches: Object.fromEntries(ROYALE_CACHES.map((c) => [c.id, { x: 90, y: 90 }])),
  });
  const none = () => false;
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  it('shows nothing a player has neither scouted nor come near', () => {
    expect(visibleFeatures(map, undefined, none)).toEqual([]);
    expect(visibleFeatures(map, fieldWith([]), none, { x: 50, y: 50 })).toEqual([]);
  });

  it('shows the dens and caches of a known section, wherever the player stands', () => {
    const shown = visibleFeatures(map, undefined, (s) => s === den.section);
    expect(shown.filter((f) => f.kind === 'den').map((f) => f.id)).toContain(den.id);
    expect(shown.every((f) => f.section === den.section)).toBe(true);
    const all = visibleFeatures(map, undefined, () => true);
    expect(ids(all.filter((f) => f.kind === 'den')).sort()).toEqual(ROYALE_DENS.map((d) => d.id).sort());
    expect(ids(all.filter((f) => f.kind === 'cache')).sort()).toEqual(ROYALE_CACHES.map((c) => c.id).sort());
  });

  it('shows a feature in the viewer’s sight, with no scouting', () => {
    const near = visibleFeatures(map, fieldWith([]), none, { x: 14, y: 10 });
    expect(near.map((f) => f.id)).toContain(den.id);
    expect(near.some((f) => f.kind === 'cache')).toBe(false);
    // The same viewer, out of range: nothing.
    expect(visibleFeatures(map, fieldWith([]), none, { x: 10 + ROYALE_FIELD.sight + 1, y: 10 })).toEqual([]);
  });

  it('uses the simulation’s own sight, cover included', () => {
    const forest = mapWith((x, y) => (x >= 85 && y >= 85 ? 'forest' : undefined), {
      caches: { [free.id]: { x: 90, y: 90 } },
      dens: {},
    });
    // In meadow the viewer sees a cache just inside its range; in cover it must be nearer.
    const range = ROYALE_FIELD.sight;
    const far = { x: 90 - range * 0.8, y: 90 };
    expect(sees(forest, far, { x: 90, y: 90 })).toBe(false);
    expect(visibleFeatures(forest, fieldWith([]), none, far).some((f) => f.id === free.id)).toBe(false);
    const near = { x: 90 - range * COVER_SIGHT * 0.8, y: 90 };
    expect(sees(forest, near, { x: 90, y: 90 })).toBe(true);
    expect(visibleFeatures(forest, fieldWith([]), none, near).some((f) => f.id === free.id)).toBe(true);
  });

  it('dims a cache that is taken and a den that is cleared', () => {
    const field = { taken: [free.id], cleared: [guard.id] };
    const shown = visibleFeatures(map, field, () => true);
    const get = (id: string) => shown.find((f) => f.id === id)!;
    expect(get(free.id).spent).toBe(true);
    expect(get(guard.id).spent).toBe(true);
    const other = ROYALE_DENS.find((d) => d.id !== guard.id)!;
    expect(get(other.id).spent).toBe(false);
    const fresh = visibleFeatures(map, { taken: [], cleared: [] }, () => true);
    expect(fresh.every((f) => !f.spent)).toBe(true);
  });

  it('marks a cache shut until its den is cleared, and gives the den', () => {
    const closed = visibleFeatures(map, { taken: [], cleared: [] }, () => true).find((f) => f.id === guarded.id)!;
    expect(closed.shut).toBe(true);
    expect(closed.guard).toBe(guard.id);
    const opened = visibleFeatures(map, { taken: [], cleared: [guard.id] }, () => true).find((f) => f.id === guarded.id)!;
    expect(opened.shut).toBe(false);
    const taken = visibleFeatures(map, { taken: [guarded.id], cleared: [guard.id] }, () => true).find((f) => f.id === guarded.id)!;
    expect(taken.shut).toBe(false);
    expect(taken.spent).toBe(true);
    expect(visibleFeatures(map, undefined, () => true).find((f) => f.id === free.id)!.shut).toBe(false);
  });

  it('carries a den’s radius and skips anything the map has no place for', () => {
    const shown = visibleFeatures(map, undefined, () => true);
    expect(shown.find((f) => f.id === den.id)!.radius).toBe(den.radius);
    expect(shown.find((f) => f.id === free.id)!.radius).toBeUndefined();
    const bare = mapWith(() => undefined);
    expect(visibleFeatures(bare, undefined, () => true)).toEqual([]);
  });
});

describe('fog and the radar', () => {
  const map = meadow();

  it('draws the survivors in sight, and no others', () => {
    const near = fighter(1, 60, 50);
    const far = fighter(2, 50 + ROYALE_FIELD.sight + 5, 50);
    const field = fieldWith([near, far]);
    const radar = radarView(field, 0);
    expect(radar.state).toBe('off');
    expect(visibleFighters(map, field, radar).map((f) => f.id)).toEqual([1]);
  });

  it('draws the fighters in the player’s own fight, in sight or not', () => {
    const held = fighter(1, 50 + ROYALE_FIELD.sight + 5, 50, { engaged: true });
    const field = fieldWith([held]);
    expect(visibleFighters(map, field, radarView(field, 0)).map((f) => f.id)).toEqual([1]);
  });

  it('adds the radar’s target once the radar is on, and only the nearest', () => {
    const nearest = fighter(1, 50 + ROYALE_FIELD.sight + 5, 50);
    const farther = fighter(2, 50 + ROYALE_FIELD.sight + 30, 50);
    const field = fieldWith([nearest, farther]);
    expect(visibleFighters(map, field, radarView(field, RADAR_TICKS - 1))).toEqual([]);
    const radar = radarView(field, RADAR_TICKS);
    expect(radar.state).toBe('on');
    expect(visibleFighters(map, field, radar).map((f) => f.id)).toEqual([1]);
  });

  it('counts the radar’s hour from the last fight, or from the field’s opening', () => {
    const field = fieldWith([fighter(1, 10, 10)], { x: 50, y: 50 }, { openedAt: 1000 });
    expect(radarView(field, 1000 + RADAR_TICKS - 1)).toEqual({ state: 'off', left: 1 });
    expect(radarView(field, 1000 + RADAR_TICKS).state).toBe('on');
    field.player.lastFight = 5000;
    expect(radarView(field, 5000 + 100)).toEqual({ state: 'off', left: RADAR_TICKS - 100 });
    expect(radarView(field, 5000 + RADAR_TICKS).state).toBe('on');
  });

  it('reads the nearest fighter’s distance and compass direction', () => {
    // 30 units north-east: 21.2 across and 21.2 up.
    const a = 30 / Math.SQRT2;
    const field = fieldWith([fighter(1, 50 + a, 50 - a), fighter(2, 5, 95)]);
    const radar = radarView(field, RADAR_TICKS);
    expect(radar.state === 'on' && radar.target?.id).toBe(1);
    expect(radar.state === 'on' && radar.target?.dir).toBe('north-east');
    expect(radarText(radar)).toBe('Radar: nearest fighter 30 units, north-east');
  });

  it('says what it can when nobody is left, and counts down while off', () => {
    const empty = fieldWith([]);
    expect(radarText(radarView(empty, RADAR_TICKS))).toBe('Radar: no fighters left');
    const waiting = fieldWith([fighter(1, 5, 5)]);
    expect(radarText(radarView(waiting, 0))).toBe(`Radar in ${festivalMinutes(RADAR_TICKS)} min`);
    expect(festivalMinutes(1)).toBe(1);
    expect(festivalMinutes(0)).toBe(0);
    expect(radarText({ state: 'on', target: { id: 1, x: 0, y: 0, dist: 1, dx: 0, dy: -1, dir: 'north' } })).toBe(
      'Radar: nearest fighter 1 unit, north',
    );
  });
});

describe('the terrain image', () => {
  const tokens: Record<string, string> = {
    '--accent': '#e8b84b',
    '--bg-raised': '#232a35',
    '--bg-sunken': '#0d1014',
    '--text': '#d7dee8',
    '--text-dim': '#8b96a5',
    '--mana': 'rgb(85, 145, 224)',
    '--mat-wood': '#a07a46',
    '--spirit': '#a06fd6',
    '--xp': '#4caf7d',
    '--stamina': '#5cbb6a',
    '--mat-leather': '#7a4a3a',
  };
  const read = (t: string) => tokens[t];

  it('parses the colours the theme tokens are written in', () => {
    expect(parseColor('#e8b84b')).toEqual([232, 184, 75]);
    expect(parseColor('  #FFF ')).toEqual([255, 255, 255]);
    expect(parseColor('rgb(85, 145, 224)')).toEqual([85, 145, 224]);
    expect(parseColor('rgb(85 145 224 / 50%)')).toEqual([85, 145, 224]);
    expect(parseColor('#11223344')).toEqual([17, 34, 51]);
    expect(parseColor('')).toBeNull();
    expect(parseColor('var(--x)')).toBeNull();
  });

  it('mixes by share of the first colour', () => {
    expect(mixColor([200, 100, 0], [0, 0, 100], 1)).toEqual([200, 100, 0]);
    expect(mixColor([200, 100, 0], [0, 0, 100], 0)).toEqual([0, 0, 100]);
    expect(mixColor([200, 100, 0], [0, 0, 100], 0.5)).toEqual([100, 50, 50]);
  });

  it('gives meadow and every section a colour from the tokens, so a theme restyles the map', () => {
    const palette = mapPalette(read);
    expect(Object.keys(palette).sort()).toEqual(['meadow', ...SECTION_IDS].sort());
    const [token, base, share] = PALETTE_RECIPE.forest;
    expect(palette.forest).toEqual(mixColor(parseColor(tokens[token])!, parseColor(tokens[base])!, share));
    const dark = mapPalette((t) => (t === '--stamina' ? '#000000' : tokens[t]));
    expect(dark.forest).not.toEqual(palette.forest);
    expect(paletteKey(dark)).not.toBe(paletteKey(palette));
    expect(paletteKey(mapPalette(read))).toBe(paletteKey(palette));
  });

  it('keeps every section distinct from the meadow and from the others', () => {
    const palette = mapPalette(read);
    const seen = new Set<string>();
    for (const [id, rgb] of Object.entries(palette)) {
      const key = rgb.join(',');
      expect(seen.has(key), `${id} repeats a colour`).toBe(false);
      seen.add(key);
    }
  });

  it('falls back to grey for a token that cannot be read, never to nothing', () => {
    const palette = mapPalette(() => undefined);
    for (const rgb of Object.values(palette)) expect(rgb).toEqual([90, 90, 90]);
  });

  it('has a recipe only for meadow and real sections', () => {
    expect(Object.keys(PALETTE_RECIPE).filter((id) => id !== 'meadow').every((id) => id in ROYALE_SECTIONS)).toBe(true);
  });

  it('paints one opaque pixel per cell in its section’s colour', () => {
    const map = mapWith((x, y) => (x === 3 && y === 2 ? 'cave' : x === 4 && y === 2 ? 'river' : undefined));
    const palette = mapPalette(read);
    const px = royaleMapPixels(map, palette);
    expect(px.length).toBe(SIZE * SIZE * 4);
    const at = (x: number, y: number) => Array.from(px.slice((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 4));
    expect(at(3, 2)).toEqual([...palette.cave, 255]);
    expect(at(4, 2)).toEqual([...palette.river, 255]);
    expect(at(0, 0)).toEqual([...palette.meadow, 255]);
    expect(at(99, 99)).toEqual([...palette.meadow, 255]);
  });
});
