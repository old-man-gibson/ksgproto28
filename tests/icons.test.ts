import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { RESOURCE_LIST } from '../src/core/data/resources.data';
import { SUPERATTRS } from '../src/core/registry';
import manifest from '../src/ui/lib/icons/manifest.json';
import { artUrl, iconUrl } from '../src/ui/lib/icons/iconArt';
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

/** Every registry converted so far, by group: a group switches only when every entry has art. */
const GROUPS: Record<string, { id: string; icon: string; art?: string }[]> = {
  attributes: ATTRIBUTE_LIST,
  resources: RESOURCE_LIST,
  superattributes: Object.values(SUPERATTRS),
};

describe('pixel icons: manifest and defs', () => {
  it('every art a def declares is a name in the manifest', () => {
    for (const [group, defs] of Object.entries(GROUPS)) {
      for (const def of defs) {
        if (def.art) expect(MANIFEST[def.art], `${group}.${def.id}: art '${def.art}' is not in manifest.json`).toBeDefined();
      }
    }
  });

  it('a converted group has art on every entry (no half-pixel, half-emoji rows)', () => {
    for (const [group, defs] of Object.entries(GROUPS)) {
      const withArt = defs.filter((d) => d.art).length;
      expect([0, defs.length], `${group}: ${withArt} of ${defs.length} have art`).toContain(withArt);
    }
  });

  it('every def keeps its emoji: it is the fallback without the packs', () => {
    for (const defs of Object.values(GROUPS)) for (const def of defs) expect(def.icon, def.id).toBeTruthy();
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
    for (const [group, defs] of Object.entries(GROUPS)) {
      for (const def of defs) if (def.art) expect(iconUrl(def), `${group}.${def.id}`).toBeTruthy();
    }
  });
});
