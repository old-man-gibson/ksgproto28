/**
 * The text tables (`src/core/text/*.text.ts`) must stay total: every key names
 * a real entry, and every registry that was fully described stays fully
 * described. A description that goes missing is a player reading a blank.
 */
import { describe, expect, it } from 'vitest';
import '../src/core/registry';
import { PROSE_ORPHANS, PROSE_TABLES } from '../src/core/text/prose';

/**
 * Registries where EVERY top-level entry carries a description. The ones left
 * out are partial on purpose: `MONSTER_TAGS` describes only the tags the
 * bestiary shows, `BESTIARY_FACTS` uses `hint` rather than `desc`, `MIRACLES`
 * and `MAIN_GENES` still have undescribed drafts, `MATERIALS` and `ITEMS`
 * include generated entries whose text is built at runtime.
 */
const FULLY_DESCRIBED = [
  'ARCANE_WORDS', 'BANDS', 'BREW_FORMS', 'BREW_FORMULAS', 'DEITIES', 'DISCIPLINES', 'FLOORS',
  'FORK_ARCHETYPES', 'HAND_WRITTEN', 'MUSIC_ARCHETYPES', 'MUSIC_METERS', 'MUSIC_SCALES', 'NAMED_RUNES',
  'NPCS', 'NUCLEASES', 'POSITIONS', 'PREPS', 'PRESTIGE_BOONS', 'PSI_AXES', 'PSI_QUANTITIES',
  'PSI_RECOGNITIONS', 'QUESTS', 'REAGENTS', 'RUNES', 'RUNE_PATTERNS', 'SPOTS', 'STATUSES', 'STYLES',
  'SUPERATTRS', 'TECHNIQUES', 'TITLES', 'TOWERS',
];

function entriesOf(root: unknown): { id?: string; desc?: unknown; dialogue?: unknown }[] {
  return Array.isArray(root) ? root : Object.values(root as object);
}

describe('prose tables', () => {
  it('every text key names an entry', () => {
    expect(PROSE_ORPHANS).toEqual([]);
  });

  it('every described registry was loaded', () => {
    const labels = PROSE_TABLES.map((t) => t.label);
    for (const root of FULLY_DESCRIBED) expect(labels, `${root} never applied a text table`).toContain(root);
  });

  it('fully described registries stay fully described', () => {
    const missing: string[] = [];
    for (const { label, root } of PROSE_TABLES) {
      if (!FULLY_DESCRIBED.includes(label)) continue;
      entriesOf(root).forEach((e, i) => {
        if (typeof e.desc !== 'string' || e.desc.length === 0) missing.push(`${label}.${e.id ?? i}`);
      });
    }
    expect(missing).toEqual([]);
  });

  it('every NPC has something to say', () => {
    const npcs = PROSE_TABLES.find((t) => t.label === 'NPCS')!;
    for (const npc of entriesOf(npcs.root)) {
      expect(Array.isArray(npc.dialogue) && npc.dialogue.length > 0, `${npc.id} has no dialogue`).toBe(true);
    }
  });

  it('text values are strings, and dialogue is a list of them', () => {
    for (const { label, table } of PROSE_TABLES) {
      for (const [key, value] of Object.entries(table)) {
        const field = key.split('.').pop();
        if (field === 'dialogue') {
          expect(Array.isArray(value), `${label}: ${key}`).toBe(true);
          for (const line of value as unknown[]) expect(typeof line, `${label}: ${key}`).toBe('string');
        } else {
          expect(typeof value, `${label}: ${key}`).toBe('string');
        }
      }
    }
  });
});
