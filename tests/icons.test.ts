import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { RESOURCE_LIST } from '../src/core/data/resources.data';
import { REAGENTS, RUNES, SKILLS, STATUSES, SUPERATTRS } from '../src/core/registry';
import { ARCANE_WORDS } from '../src/core/data/spellcraft.data';
import { WEATHER_ICONS } from '../src/core/systems/weather';
import manifest from '../src/ui/lib/icons/manifest.json';
import { NAV } from '../src/ui/lib/nav';
import { artName, artUrl, iconUrl } from '../src/ui/lib/icons/iconArt';
import { GLYPH_ART, bareGlyph, glyphName, splitGlyphs } from '../src/ui/lib/icons/glyphs';
// @ts-expect-error — a plain .mjs script with no type declarations
import { ART_GEN_PATH, renderArtGen } from '../scripts/icons.mjs';

/**
 * Pixel icons (docs/plans/pixel-icons.md §4.4). The manifest and the defs are
 * text and always checked; the files live in the gitignored packs, so their
 * existence is checked only where the packs are present, and skipped with a
 * reason elsewhere (a worktree, a fresh clone) instead of failing.
 */
const MANIFEST: Record<string, string> = manifest;
const ASSETS = join(__dirname, '../src/assets');
const HAVE_PACKS = existsSync(join(ASSETS, 'packs'));

interface IconDef {
  id: string;
  icon: string;
  art?: string;
}

// The eight abstract words (grammar, not substances) have no icon on the sheet.
const ABSTRACT_WORDS = ['undo', 'twice', 'then', 'and', 'but', 'one', 'others', 'me'];

/**
 * Every registry converted so far, by group: a group switches only when every
 * entry has art, its own or the glyph table's. `pending` names the entries
 * that keep their emoji until an icon exists for them.
 */
const GROUPS: Record<string, { defs: readonly IconDef[]; pending?: readonly string[] }> = {
  attributes: { defs: ATTRIBUTE_LIST },
  resources: { defs: RESOURCE_LIST },
  superattributes: { defs: Object.values(SUPERATTRS) },
  // The sheet has no DNA and no yin-yang (docs/plans/pixel-icons.md §5.1).
  tabs: { defs: NAV, pending: ['chromosome', 'wuxin'] },
  statuses: { defs: Object.values(STATUSES) },
  arcaneWords: { defs: Object.values(ARCANE_WORDS), pending: ABSTRACT_WORDS },
  // Skills convert by category (SkillsPanel): resistance is whole, magic holds the abstract words.
  resistanceSkills: { defs: Object.values(SKILLS).filter((s) => s.category === 'resistance') },
  wordSkills: { defs: Object.values(SKILLS).filter((s) => s.id.startsWith('word_')), pending: ABSTRACT_WORDS.map((w) => `word_${w}`) },
  // Drawn in no list yet: runes and reagents show through the generic item and material rows.
  runes: { defs: Object.values(RUNES) },
  reagents: { defs: Object.values(REAGENTS) },
  // No plain cloud, thermometer or hole on the sheet; the sky chip shows one kind at a time.
  weather: { defs: Object.entries(WEATHER_ICONS).map(([id, icon]) => ({ id, icon })), pending: ['still', 'overcast', 'heatwave'] },
};

function covered(group: string): IconDef[] {
  const { defs, pending = [] } = GROUPS[group];
  return defs.filter((d) => !pending.includes(d.id));
}

describe('pixel icons: manifest and defs', () => {
  it('every art a def declares is a name in the manifest', () => {
    for (const [group, { defs }] of Object.entries(GROUPS)) {
      for (const def of defs) {
        if (def.art) expect(MANIFEST[def.art], `${group}.${def.id}: art '${def.art}' is not in manifest.json`).toBeDefined();
      }
    }
  });

  it('a converted group has art on every entry, its own or from the glyph table (no half-pixel, half-emoji rows)', () => {
    for (const group of Object.keys(GROUPS)) {
      const defs = covered(group);
      const missing = defs.filter((d) => !artName(d)).map((d) => d.id);
      expect(missing, `${group}: no art for ${missing.join(', ')}`).toEqual([]);
    }
  });

  it('every def keeps its emoji: it is the fallback without the packs', () => {
    for (const { defs } of Object.values(GROUPS)) for (const def of defs) expect(def.icon, def.id).toBeTruthy();
  });

  it('a pending entry names an entry of its group and has no art yet', () => {
    for (const [group, { defs, pending = [] }] of Object.entries(GROUPS)) {
      for (const id of pending) {
        const def = defs.find((d) => d.id === id);
        expect(def, `${group}: pending '${id}' is not an entry`).toBeDefined();
        expect(artName(def!), `${group}.${id} has art: drop it from pending`).toBeUndefined();
      }
    }
  });

  it('manifest files live in the packs or in the committed own-icons folder', () => {
    for (const [name, file] of Object.entries(MANIFEST)) {
      expect(file.startsWith('packs/') || file.startsWith('icons/own/'), `${name}: ${file}`).toBe(true);
      expect(file.endsWith('.png'), `${name}: ${file}`).toBe(true);
    }
  });

  it('art.gen.ts is what `npm run icons` writes for this manifest', () => {
    const committed = readFileSync(ART_GEN_PATH, 'utf8').replace(/\r\n/g, '\n');
    expect(committed, 'art.gen.ts is stale: run `npm run icons`').toBe(renderArtGen(MANIFEST));
  });
});

describe('pixel icons: files on disk', () => {
  it('committed own icons exist', () => {
    for (const [name, file] of Object.entries(MANIFEST)) {
      if (file.startsWith('icons/own/')) expect(existsSync(join(ASSETS, file)), `${name}: ${file}`).toBe(true);
    }
  });

  it.skipIf(!HAVE_PACKS)('every manifest file in the packs is on disk (skipped: no src/assets/packs here)', () => {
    for (const [name, file] of Object.entries(MANIFEST)) {
      if (file.startsWith('packs/')) expect(existsSync(join(ASSETS, file)), `${name}: ${file}`).toBe(true);
    }
  });

  it('a def with no art, or an unknown name, resolves to no URL (the emoji shows)', () => {
    expect(artUrl(undefined)).toBeNull();
    expect(artUrl('no_such_icon')).toBeNull();
    expect(iconUrl({})).toBeNull();
  });

  it.skipIf(!HAVE_PACKS)('with the packs present, every converted def resolves to a URL', () => {
    for (const group of Object.keys(GROUPS)) {
      for (const def of covered(group)) expect(iconUrl(def), `${group}.${def.id}`).toBeTruthy();
    }
  });

  it.skipIf(!HAVE_PACKS)('with the packs present, every glyph in the table resolves to a URL', () => {
    for (const emoji of Object.keys(GLYPH_ART)) expect(iconUrl({ icon: emoji }), emoji).toBeTruthy();
  });
});

describe('pixel icons: the glyph table', () => {
  it('every glyph names an icon in the manifest', () => {
    for (const [emoji, name] of Object.entries(GLYPH_ART)) {
      expect(MANIFEST[name], `${emoji}: '${name}' is not in manifest.json`).toBeDefined();
    }
  });

  it('no two keys are one emoji once the variation selector is dropped', () => {
    const bare = Object.keys(GLYPH_ART).map(bareGlyph);
    expect(new Set(bare).size).toBe(bare.length);
  });

  it('matches an emoji with or without its variation selector', () => {
    expect(glyphName('⚔️')).toBe('crossed_swords');
    expect(glyphName('⚔')).toBe('crossed_swords');
    expect(glyphName('a')).toBeUndefined();
  });

  it('splits a string into text and drawn glyphs, and joins back to the input', () => {
    const text = '📦 Loot: 🗡️ Rusty Sword ⚔ x2 ❓';
    const parts = splitGlyphs(text);
    expect(parts.map((p) => ('glyph' in p ? p.name : null)).filter(Boolean)).toEqual(['chest', 'crossed_swords', 'unknown']);
    expect(parts.map((p) => ('glyph' in p ? p.glyph : p.text)).join('')).toBe(text);
    expect(splitGlyphs('plain')).toEqual([{ text: 'plain' }]);
    // A joined sequence is one emoji: the winded face holds a gust and stays whole.
    expect(splitGlyphs('😮‍💨 Winded 💨')).toEqual([{ text: '😮‍💨 Winded ' }, { glyph: '💨', name: 'gust' }]);
    expect(splitGlyphs('')).toEqual([]);
  });

  it('a def with its own art ignores the glyph table', () => {
    expect(artName({ icon: '⚔️', art: 'tab_combat' })).toBe('tab_combat');
    expect(artName({ icon: '⚔️' })).toBe('crossed_swords');
    expect(artName({ icon: '🗡️' })).toBeUndefined();
  });
});
