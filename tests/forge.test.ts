import { describe, expect, it } from 'vitest';
import {
  addEntry,
  deleteAt,
  notesOf,
  renameEntry,
  reorderEntry,
  setAt,
  setNoteAt,
  sourceOf,
} from '../forge/server/edit';
import { printValue } from '../forge/server/print';
import { diffLines, diffStat } from '../forge/server/diff';
import { findReferences, refKindFor } from '../forge/lib/refs';
import { ITEM_CLASSES, MATERIALS, PART_KINDS, RECIPES } from '../src/core/registry';
import type { PlacedPart, Placement } from '../src/core/types';

/**
 * The forge writes to the real content files. These tests exist for one
 * promise above all others: **an edit changes the thing it
 * was asked to change and nothing else** — in particular, never a comment.
 */

const FILE = 'locations.data.ts';

const SAMPLE = `import type { SpotDef } from '../types';
import { prose } from '../text/prose';
import { SPOTS_TEXT } from '../text/locations.text';

// Prose (desc, dialogue, hint) lives in the text file; the forge sees through
// the prose() wrapper to the literal, so the sample is written the way the
// real data files are.
export const SPOTS = prose<SpotDef>('SPOTS', SPOTS_TEXT, {
  village_square: {
    id: 'village_square',
    name: 'Village Square',
    icon: '⛲',
    areaId: 'oakrest',
    map: { x: 50, y: 22 },
    waypoint: true,
    // The heart of the demo world; everything else hangs off it.
    activities: [
      { id: 'rest_inn', kind: 'rest', name: 'Rest at the Inn', icon: '🛏️' },
    ],
    connections: [
      { to: 'training_grounds', ticks: 30 },
      { to: 'woods_edge', ticks: 80 },
    ],
  },
  deep_woods: {
    id: 'deep_woods',
    name: 'Deep Woods',
    icon: '🌲',
    areaId: 'whispering_woods',
    map: { x: 14, y: 58 },
    activities: [
      { id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' },
    ],
    exploreTicks: 200,
    // The chute is the reward for looking, not for finishing.
    finds: [
      {
        id: 'mushroom_ring',
        at: 0.3,
        material: { id: 'cave_mushroom', qty: 2 },
      },
      {
        id: 'mossy_chute',
        at: 0.55,
        path: 'ravine_floor',
      },
    ],
    connections: [
      { to: 'woods_edge', ticks: 100 },
      {
        to: 'ravine_floor',
        ticks: 40,
        oneWay: true,
        hidden: true,
        label: 'Slide down the mossy chute',
      },
    ],
  },
});
`;

/** Every comment in the sample, so a test can assert none went missing. */
const COMMENTS = [
  '// The heart of the demo world; everything else hangs off it.',
  '// The chute is the reward for looking, not for finishing.',
];

function expectCommentsIntact(text: string): void {
  for (const comment of COMMENTS) expect(text, `lost comment: ${comment}`).toContain(comment);
}

/** Lines that differ between two versions of the file. */
function changedLines(before: string, after: string): { added: string[]; removed: string[] } {
  const hunks = diffLines(before, after, 0);
  const added: string[] = [];
  const removed: string[] = [];
  for (const h of hunks) {
    for (const l of h.lines) {
      if (l.kind === 'add') added.push(l.text);
      if (l.kind === 'del') removed.push(l.text);
    }
  }
  return { added, removed };
}

describe('forge printer', () => {
  it('writes TypeScript, not JSON', () => {
    expect(printValue({ id: 'a', at: 0.5 })).toBe("{ id: 'a', at: 0.5 }");
    expect(printValue(['a', 'b'])).toBe("['a', 'b']");
    expect(printValue({ 'not-ident': 1 })).toBe("{ 'not-ident': 1 }");
    // Numeric keys stay bare — groupWeights: { 1: 100 }.
    expect(printValue({ 1: 100, 3: 40 })).toBe('{ 1: 100, 3: 40 }');
  });

  it('escapes only what would break the literal', () => {
    // Typographic apostrophes and emoji are content, not syntax.
    expect(printValue('The anvil’s song 🔨')).toBe("'The anvil’s song 🔨'");
    expect(printValue("it's")).toBe("'it\\'s'");
    expect(printValue('back\\slash')).toBe("'back\\\\slash'");
  });

  it('trims float noise a slider would introduce', () => {
    expect(printValue(0.1 + 0.2)).toBe('0.3');
    expect(printValue(1 / 3)).toBe('0.333333');
  });

  it('orders known shapes and keeps unknown keys after them', () => {
    const printed = printValue(
      { desc: 'd', at: 0.5, mystery: 1, id: 'x' },
      { keyOrder: ['id', 'at', 'desc'] },
    );
    expect(printed).toBe("{ id: 'x', at: 0.5, desc: 'd', mystery: 1 }");
  });

  it('switches to the child shape inside a known field', () => {
    // The find prints id-first even though the spot order is in force outside.
    const printed = printValue(
      { finds: [{ desc: 'd', at: 0.5, id: 'x' }], id: 'spot' },
      { keyOrder: ['id', 'finds'] },
    );
    expect(printed).toContain("{ id: 'x', at: 0.5, desc: 'd' }");
  });
});

describe('forge edits are surgical', () => {
  it('moving a spot changes exactly one line', () => {
    const after = setAt(FILE, SAMPLE, 'SPOTS', ['village_square', 'map'], { x: 52.5, y: 20 }, 'spot').text;
    const { added, removed } = changedLines(SAMPLE, after);
    expect(removed).toEqual(['    map: { x: 50, y: 22 },']);
    expect(added).toEqual(['    map: { x: 52.5, y: 20 },']);
    expectCommentsIntact(after);
  });

  it('editing one find leaves its siblings and the comment above them alone', () => {
    const after = setAt(FILE, SAMPLE, 'SPOTS', ['deep_woods', 'finds', '#id=mossy_chute', 'at'], 0.45, 'spot').text;
    const { added, removed } = changedLines(SAMPLE, after);
    expect(removed).toEqual(['        at: 0.55,']);
    expect(added).toEqual(['        at: 0.45,']);
    expectCommentsIntact(after);
    expect(after).toContain("id: 'mushroom_ring'");
  });

  it('adds a property to a one-line object without breaking the line', () => {
    const after = setAt(FILE, SAMPLE, 'SPOTS', ['deep_woods', 'connections', '#to=woods_edge', 'label'], 'Game trail', 'spot').text;
    expect(after).toContain("{ to: 'woods_edge', ticks: 100, label: 'Game trail' },");
    const { added } = changedLines(SAMPLE, after);
    expect(added).toHaveLength(1);
  });

  // Region entries are hand-written one-liners; pinning one on the World Atlas
  // must stay a one-line change.
  const REGIONS_SAMPLE = `export const REGIONS: Record<string, RegionDef> = {
  // The starter continent.
  verdant_frontier: { id: 'verdant_frontier', name: 'Verdant Frontier' },
  westlands: { id: 'westlands', name: 'Westlands' },
};
`;

  it('pinning a region adds world coords inline', () => {
    const after = setAt(FILE, REGIONS_SAMPLE, 'REGIONS', ['westlands', 'world'], { x: 12, y: 30.5 }, 'region').text;
    const { added, removed } = changedLines(REGIONS_SAMPLE, after);
    expect(removed).toEqual(["  westlands: { id: 'westlands', name: 'Westlands' },"]);
    expect(added).toEqual(["  westlands: { id: 'westlands', name: 'Westlands', world: { x: 12, y: 30.5 } },"]);
    expect(after).toContain('// The starter continent.');
  });

  it('re-pinning a region changes only the two numbers', () => {
    const pinned = setAt(FILE, REGIONS_SAMPLE, 'REGIONS', ['westlands', 'world'], { x: 12, y: 30.5 }, 'region').text;
    const after = setAt(FILE, pinned, 'REGIONS', ['westlands', 'world'], { x: 40, y: 8 }, 'region').text;
    expect(after).toContain("westlands: { id: 'westlands', name: 'Westlands', world: { x: 40, y: 8 } },");
    expect(changedLines(pinned, after).added).toHaveLength(1);
  });

  it('re-pinning stays one line however long the entry is', () => {
    // A long id + name pushes `world` past the printer's width; replacing it
    // must not break the value into a staircase at column ninety.
    const LONG = `export const REGIONS: Record<string, RegionDef> = {
  malgeri_eastern_mountains: { id: 'malgeri_eastern_mountains', name: 'Malgeri Eastern Mountains', world: { x: 1, y: 2 } },
};
`;
    const after = setAt(FILE, LONG, 'REGIONS', ['malgeri_eastern_mountains', 'world'], { x: 17.5, y: 32.5 }, 'region').text;
    expect(after).toContain("name: 'Malgeri Eastern Mountains', world: { x: 17.5, y: 32.5 } },");
    expect(after.split('\n')).toHaveLength(LONG.split('\n').length);
  });

  it('unpinning a region removes the field and nothing else', () => {
    const pinned = setAt(FILE, REGIONS_SAMPLE, 'REGIONS', ['westlands', 'world'], { x: 12, y: 30.5 }, 'region').text;
    const after = deleteAt(FILE, pinned, 'REGIONS', ['westlands', 'world']).text;
    expect(after).toContain("westlands: { id: 'westlands', name: 'Westlands' },");
    expect(after).toContain('// The starter continent.');
  });
});

describe('entry notes — the TODO/SPEC lines the forge owns', () => {
  const NOTED = `export const SPOTS: Record<string, SpotDef> = {
  // The heart of the demo world; everything else hangs off it.
  // TODO: give the square a market day
  village_square: {
    id: 'village_square',
  },
  deep_woods: { id: 'deep_woods' }, // TODO: a trailing comment is not a note
  ravine_floor: {
    id: 'ravine_floor',
  },
};
`;

  it('reads notes, ignores hand comments and trailing comments', () => {
    const notes = notesOf(FILE, NOTED, 'SPOTS');
    expect(notes.village_square).toEqual({ TODO: 'give the square a market day' });
    // The trailing comment sits on deep_woods' own line — it belongs to that
    // line, not to ravine_floor's leading trivia, and is nobody's note.
    expect(notes.deep_woods).toBeUndefined();
    expect(notes.ravine_floor).toBeUndefined();
  });

  it('adds a note directly above the entry, under its hand comments', () => {
    const after = setNoteAt(FILE, NOTED, 'SPOTS', 'ravine_floor', 'SPEC', 'one-way exit only').text;
    const { added, removed } = changedLines(NOTED, after);
    expect(removed).toEqual([]);
    expect(added).toEqual(['  // SPEC: one-way exit only']);
    expect(after.indexOf('// SPEC: one-way exit only')).toBeLessThan(after.indexOf('ravine_floor:'));
  });

  it('rewrites only its own line and leaves the hand comment alone', () => {
    const after = setNoteAt(FILE, NOTED, 'SPOTS', 'village_square', 'TODO', 'market day AND a festival').text;
    const { added, removed } = changedLines(NOTED, after);
    expect(removed).toEqual(['  // TODO: give the square a market day']);
    expect(added).toEqual(['  // TODO: market day AND a festival']);
    expect(after).toContain('// The heart of the demo world; everything else hangs off it.');
  });

  it('removes its line cleanly and refuses to invent a removal', () => {
    const after = setNoteAt(FILE, NOTED, 'SPOTS', 'village_square', 'TODO', null).text;
    expect(after).not.toContain('// TODO: give the square a market day');
    expect(after).toContain('// The heart of the demo world; everything else hangs off it.');
    expect(after).toContain('village_square: {');
    // Removing a note that was never there changes nothing.
    expect(setNoteAt(FILE, NOTED, 'SPOTS', 'ravine_floor', 'TODO', null).text).toBe(NOTED);
  });

  it('TODO and SPEC coexist and edit independently', () => {
    const one = setNoteAt(FILE, NOTED, 'SPOTS', 'village_square', 'SPEC', 'the square is a haven').text;
    const notes = notesOf(FILE, one, 'SPOTS');
    expect(notes.village_square).toEqual({
      TODO: 'give the square a market day',
      SPEC: 'the square is a haven',
    });
    const two = setNoteAt(FILE, one, 'SPOTS', 'village_square', 'TODO', null).text;
    expect(notesOf(FILE, two, 'SPOTS').village_square).toEqual({ SPEC: 'the square is a haven' });
  });

  it('flattens newlines — a note is one comment line', () => {
    const after = setNoteAt(FILE, NOTED, 'SPOTS', 'ravine_floor', 'TODO', 'line one\nline two').text;
    expect(notesOf(FILE, after, 'SPOTS').ravine_floor).toEqual({ TODO: 'line one line two' });
  });

  it('a note survives its entry being renamed', () => {
    const renamed = renameEntry(FILE, NOTED, 'SPOTS', 'village_square', 'town_square').text;
    expect(notesOf(FILE, renamed, 'SPOTS').town_square).toEqual({ TODO: 'give the square a market day' });
  });

  it('deleting the entry takes its note with it', () => {
    const after = deleteAt(FILE, NOTED, 'SPOTS', ['village_square']).text;
    expect(after).not.toContain('TODO: give the square a market day');
    expect(after).not.toContain('village_square');
  });

  it('appends to a multiline array with a trailing comma', () => {
    const after = setAt(
      FILE,
      SAMPLE,
      'SPOTS',
      ['village_square', 'connections', '#to=ravine_rim'],
      { to: 'ravine_rim', ticks: 150, label: 'Old Road' },
      'spot',
    ).text;
    expect(after).toContain("      { to: 'ravine_rim', ticks: 150, label: 'Old Road' },\n    ],");
    expectCommentsIntact(after);
  });

  it('creates a missing container on the way down', () => {
    // village_square has no finds at all; one op should produce the whole field.
    const after = setAt(
      FILE,
      SAMPLE,
      'SPOTS',
      ['village_square', 'finds', '#id=lost_coin'],
      { id: 'lost_coin', at: 0.5, gold: [1, 5] },
      'spot',
    ).text;
    expect(after).toContain('finds: [');
    expect(after).toContain("{ id: 'lost_coin', at: 0.5, gold: [1, 5] },");
    expectCommentsIntact(after);
  });

  it('slots a new field where its shape says it belongs, not at the end', () => {
    const after = setAt(FILE, SAMPLE, 'SPOTS', ['village_square', 'exploreTicks'], 120, 'spot').text;
    const lines = after.split('\n');
    const explore = lines.findIndex((l) => l.includes('exploreTicks'));
    const connections = lines.findIndex((l) => l.includes('connections: ['));
    const activities = lines.findIndex((l) => l.includes('activities: ['));
    expect(explore).toBeGreaterThan(activities);
    expect(explore).toBeLessThan(connections);
  });

  it('deletes an array element cleanly, comma and all', () => {
    const after = deleteAt(FILE, SAMPLE, 'SPOTS', ['deep_woods', 'finds', '#id=mushroom_ring']).text;
    expect(after).not.toContain('mushroom_ring');
    expect(after).toContain('mossy_chute');
    expectCommentsIntact(after);
    // The array is still well-formed: no doubled or dangling commas.
    expect(after).not.toMatch(/,\s*,/);
    expect(after).not.toMatch(/\[\s*,/);
  });

  it('deletes a property without disturbing its neighbours', () => {
    const after = deleteAt(FILE, SAMPLE, 'SPOTS', ['village_square', 'waypoint']).text;
    expect(after).not.toContain('waypoint');
    expect(after).toContain("map: { x: 50, y: 22 },");
    expectCommentsIntact(after);
  });

  it('adds a whole entry at the registry indentation, not the brace column', () => {
    const after = addEntry(
      FILE,
      SAMPLE,
      'SPOTS',
      'old_mill',
      { id: 'old_mill', name: 'Old Mill', icon: '🌾', areaId: 'oakrest', activities: [], connections: [] },
      'spot',
    ).text;
    // Two spaces, like every other entry — the `{` of the declaration sits at
    // column 38 and must not be used as the anchor.
    expect(after).toContain('\n  old_mill: {\n');
    expect(after).toContain("    id: 'old_mill',");
    expectCommentsIntact(after);
  });

  it('fills an empty array at the line indent, not the bracket column', () => {
    // `from: []` puts its `[` mid-line; anchoring to that column produced a
    // staircase and a stray trailing comma in real authored content.
    const src = `export const T: Record<string, Def> = {
  flowing_shield: {
    id: 'flowing_shield',
    from: [],
    to: 'guarded',
  },
};
`;
    const once = setAt('t.ts', src, 'T', ['flowing_shield', 'from', 0], 'neutral').text;
    expect(once).toContain("    from: ['neutral'],");

    // A second element joins it without reformatting the line.
    const twice = setAt('t.ts', once, 'T', ['flowing_shield', 'from', 1], 'coiled').text;
    expect(twice).toContain("    from: ['neutral', 'coiled'],");

    // Something too big to inline breaks with the property's own indent.
    const big = setAt('t.ts', src, 'T', ['flowing_shield', 'from', 0], {
      id: 'a', desc: 'a description long enough that it cannot possibly stay on one line', at: 0.5,
    }).text;
    expect(big).toContain('    from: [\n      {');
    expect(big).toContain('\n    ],');
  });

  it('treats deleting something absent as a no-op, not a failure', () => {
    // Tick a checkbox and untick it before applying: the set never reached
    // disk, so the delete finds nothing. Failing the batch over that would
    // make ordinary fiddling impossible.
    const result = deleteAt(FILE, SAMPLE, 'SPOTS', ['village_square', 'exploreTicks']);
    expect(result.text).toBe(SAMPLE);
    expect(result.note).toContain('nothing there');

    // Same for a container that doesn't exist at all.
    expect(deleteAt(FILE, SAMPLE, 'SPOTS', ['village_square', 'finds', '#id=nope']).text).toBe(SAMPLE);
  });

  it('refuses to add an id that already exists', () => {
    expect(() => addEntry(FILE, SAMPLE, 'SPOTS', 'deep_woods', {}, 'spot')).toThrow(/already has/);
  });

  it('preserves CRLF files', () => {
    const crlf = SAMPLE.replace(/\n/g, '\r\n');
    const after = setAt(
      FILE,
      crlf,
      'SPOTS',
      ['village_square', 'finds', '#id=x'],
      { id: 'x', at: 0.5, gold: [1, 2] },
      'spot',
    ).text;
    expect(after).not.toMatch(/[^\r]\n/); // every LF still has its CR
  });

  it('a batch of edits applied in sequence stays consistent', () => {
    let text = SAMPLE;
    text = setAt(FILE, text, 'SPOTS', ['deep_woods', 'exploreTicks'], 240, 'spot').text;
    text = setAt(FILE, text, 'SPOTS', ['deep_woods', 'finds', '#id=mossy_chute', 'at'], 0.5, 'spot').text;
    text = setAt(FILE, text, 'SPOTS', ['deep_woods', 'map'], { x: 15, y: 60 }, 'spot').text;
    text = deleteAt(FILE, text, 'SPOTS', ['deep_woods', 'finds', '#id=mushroom_ring']).text;

    expect(text).toContain('exploreTicks: 240');
    expect(text).toContain('at: 0.5');
    expect(text).toContain('map: { x: 15, y: 60 }');
    expect(text).not.toContain('mushroom_ring');
    expectCommentsIntact(text);
  });

  it('reads back the exact source of an entry', () => {
    const source = sourceOf(FILE, SAMPLE, 'SPOTS', ['deep_woods']);
    expect(source).toContain("id: 'deep_woods'");
    expect(source).toContain('// The chute is the reward for looking');
    expect(source?.startsWith('deep_woods:')).toBe(true);
  });

  it('names the registry when it cannot find one', () => {
    expect(() => setAt(FILE, SAMPLE, 'NOPE', ['a'], 1)).toThrow(/NOPE/);
  });
});

describe('forge diff', () => {
  it('reports only the lines that moved', () => {
    const before = 'a\nb\nc\nd\ne\nf\ng\nh\n';
    const after = 'a\nb\nc\nD\ne\nf\ng\nh\n';
    const stat = diffStat(diffLines(before, after));
    expect(stat).toEqual({ added: 1, removed: 1 });
  });

  it('finds nothing to report when nothing changed', () => {
    expect(diffLines(SAMPLE, SAMPLE)).toEqual([]);
  });

  it('handles pure insertion', () => {
    const stat = diffStat(diffLines('a\nb\n', 'a\nnew\nb\n'));
    expect(stat).toEqual({ added: 1, removed: 0 });
  });
});

describe('renaming an entry', () => {
  const REG = `export const SPOTS: Record<string, SpotDef> = {
  village_square: {
    id: 'village_square',
    name: 'Village Square',
    // A comment that must survive the rename.
    connections: [{ to: 'ravine_floor', ticks: 150 }],
  },
  ravine_floor: {
    id: 'ravine_floor',
    name: 'Ravine Floor',
    connections: [{ to: 'village_square', ticks: 150 }],
  },
};
`;

  it('rewrites the key and its id, in place', () => {
    const after = renameEntry('t.ts', REG, 'SPOTS', 'ravine_floor', 'ravine_bottom').text;
    expect(after).toContain('  ravine_bottom: {');
    expect(after).toContain("    id: 'ravine_bottom',");
    // In place: still the SECOND entry, not moved to the end.
    expect(after.indexOf('ravine_bottom:')).toBeGreaterThan(after.indexOf('village_square:'));
    expect(after).toContain('// A comment that must survive the rename.');
    // References are the caller's job — untouched here.
    expect(after).toContain("{ to: 'ravine_floor', ticks: 150 }");
  });

  it('refuses to collide with an existing id', () => {
    expect(() => renameEntry('t.ts', REG, 'SPOTS', 'ravine_floor', 'village_square')).toThrow(/already has/);
  });

  it('refuses to rename something that is not there', () => {
    expect(() => renameEntry('t.ts', REG, 'SPOTS', 'nowhere', 'somewhere')).toThrow(/no entry/);
  });

  it('leaves an entry whose id field disagrees with its key alone', () => {
    // Only an `id` that MIRRORS the key is rewritten; a mismatch is a content
    // bug the linter reports, not something to paper over here.
    const odd = REG.replace("    id: 'ravine_floor',", "    id: 'something_else',");
    const after = renameEntry('t.ts', odd, 'SPOTS', 'ravine_floor', 'ravine_bottom').text;
    expect(after).toContain('  ravine_bottom: {');
    expect(after).toContain("    id: 'something_else',");
  });
});

const REGIONS = `import type { RegionDef } from '../types';

export const REGIONS: Record<string, RegionDef> = {
  // The starting country. Everything else is measured from here.
  oakrest: {
    id: 'oakrest',
    name: 'Oakrest',
    terrain: 'temperate',
  },
  whispering_woods: {
    id: 'whispering_woods',
    name: 'Whispering Woods',
    terrain: 'forest',
  },
  // Authored last, drawn last — the tab this op exists to be able to move.
  frostmarch: {
    id: 'frostmarch',
    name: 'The Frostmarch',
    terrain: 'tundra',
  },
};
`;

/** Top-level entry keys, in the order the file declares them. */
function entryOrder(text: string): string[] {
  return [...text.matchAll(/^  (\w+): \{$/gm)].map((m) => m[1]);
}

/** Every line in the file, order thrown away. */
function lineBag(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trimEnd())
    .sort();
}

describe('reordering entries — region tab order IS key order', () => {
  it('moves an entry before a sibling', () => {
    const { text } = reorderEntry(FILE, REGIONS, 'REGIONS', 'frostmarch', 'oakrest', true);
    expect(entryOrder(text)).toEqual(['frostmarch', 'oakrest', 'whispering_woods']);
  });

  it('moves an entry after a sibling', () => {
    const { text } = reorderEntry(FILE, REGIONS, 'REGIONS', 'oakrest', 'whispering_woods', false);
    expect(entryOrder(text)).toEqual(['whispering_woods', 'oakrest', 'frostmarch']);
  });

  it('relocates lines instead of reprinting them', () => {
    const { text } = reorderEntry(FILE, REGIONS, 'REGIONS', 'frostmarch', 'oakrest', true);
    expect(text).not.toBe(REGIONS);
    // Every line still present, none rewritten. A reorder that reprinted the
    // registry would pass an eyeball and fail here — this test doing its job.
    expect(lineBag(text)).toEqual(lineBag(REGIONS));
  });

  it('carries the comment above an entry along with it', () => {
    const { text } = reorderEntry(FILE, REGIONS, 'REGIONS', 'frostmarch', 'oakrest', true);
    const lines = text.split('\n');
    const moved = lines.findIndex((l) => l.includes('Authored last, drawn last'));
    expect(lines[moved + 1]).toContain('frostmarch: {');
    // And the comment it displaced stayed with the entry it was written above.
    const stayed = lines.findIndex((l) => l.includes('The starting country'));
    expect(lines[stayed + 1]).toContain('oakrest: {');
  });

  it('keeps every comment when a commented spot moves', () => {
    const { text } = reorderEntry(FILE, SAMPLE, 'SPOTS', 'deep_woods', 'village_square', true);
    expectCommentsIntact(text);
    expect(entryOrder(text)).toEqual(['deep_woods', 'village_square']);
    expect(lineBag(text)).toEqual(lineBag(SAMPLE));
  });

  it('gives the last entry the comma it never had before moving it inward', () => {
    const noTrailing = REGIONS.replace('  },\n};', '  }\n};');
    const { text } = reorderEntry(FILE, noTrailing, 'REGIONS', 'frostmarch', 'oakrest', true);
    expect(entryOrder(text)).toEqual(['frostmarch', 'oakrest', 'whispering_woods']);
    // Without it that closing brace runs straight into the comment above
    // oakrest, and the registry stops parsing.
    expect(text).toContain('  },\n  // The starting country');
  });

  it('treats a drop where the entry already sits as a no-op', () => {
    const cases: [string, string, boolean][] = [
      ['whispering_woods', 'oakrest', false],
      ['whispering_woods', 'frostmarch', true],
      ['oakrest', 'oakrest', true],
    ];
    for (const [key, anchor, before] of cases) {
      const { text } = reorderEntry(FILE, REGIONS, 'REGIONS', key, anchor, before);
      expect(text, key + (before ? ' before ' : ' after ') + anchor).toBe(REGIONS);
    }
  });

  it('refuses to move something that is not there', () => {
    expect(() => reorderEntry(FILE, REGIONS, 'REGIONS', 'nowhere', 'oakrest', true)).toThrow(
      /no entry/,
    );
    expect(() => reorderEntry(FILE, REGIONS, 'REGIONS', 'oakrest', 'nowhere', true)).toThrow(
      /no entry/,
    );
  });

  it('preserves CRLF files', () => {
    const crlf = REGIONS.replace(/\n/g, '\r\n');
    const { text } = reorderEntry(FILE, crlf, 'REGIONS', 'frostmarch', 'oakrest', true);
    // Splicing source carries the endings with it. There is no printer in this
    // path to get it wrong, and this is the test that says so.
    expect(text).not.toMatch(/[^\r]\n/);
    expect(entryOrder(text.replace(/\r\n/g, '\n'))).toEqual([
      'frostmarch',
      'oakrest',
      'whispering_woods',
    ]);
  });
});

describe('finding the references a rename must move', () => {
  const DATA = {
    spot: {
      woods_edge: {
        id: 'woods_edge',
        connections: [{ to: 'deep_woods', ticks: 40 }],
        finds: [
          { id: 'chute', at: 0.5, spot: 'deep_woods', stat: { key: 'fights:deep_woods', set: 0 } },
        ],
      },
      deep_woods: { id: 'deep_woods' },
    },
    npc: { pell: { id: 'pell', spotId: 'deep_woods' } },
    quest: { q1: { id: 'q1', objectives: [{ kind: 'reach', spotId: 'deep_woods' }] } },
    // The same string in a registry whose fields don't point at spots.
    item: { deep_woods: { id: 'deep_woods', name: 'Deep Woods (a painting)' } },
    achievement: { cull: { id: 'cull', statKey: 'slain:deep_woods:wolf' } },
  };

  it('matches by field kind, so an item sharing the name stays put', () => {
    const sites = findReferences(DATA, 'spot', 'deep_woods');
    expect(sites.some((s) => s.kind === 'item')).toBe(false);
    // The connection, the find's rumor and counter, the NPC, the quest
    // objective, and the achievement's slain counter. Never the spot's own id.
    expect(sites.map((s) => `${s.kind}:${s.id}`).sort()).toEqual([
      'achievement:cull',
      'npc:pell',
      'quest:q1',
      'spot:woods_edge',
      'spot:woods_edge',
      'spot:woods_edge',
    ]);
  });

  it('rewrites only the renamed segment of a composite counter key', () => {
    // `fights:{spot}` and `slain:{spot}:{monster}` embed the id mid-string, and
    // the content linter only checks their prefix — a rename that skipped them
    // would break silently.
    const counters = findReferences(DATA, 'spot', 'deep_woods').filter((s) => s.rewrite);
    expect(counters.map((s) => s.rewrite!('dark_woods')).sort()).toEqual([
      'fights:dark_woods',
      'slain:dark_woods:wolf',
    ]);
  });

  it('the monster half of a slain counter belongs to the monster', () => {
    const sites = findReferences(DATA, 'monster', 'wolf');
    expect(sites).toHaveLength(1);
    expect(sites[0].rewrite!('dire_wolf')).toBe('slain:deep_woods:dire_wolf');
  });

  it('kills:tag counters name a tag, not a monster', () => {
    const d = { achievement: { a: { id: 'a', statKey: 'kills:tag:wolf' } } };
    expect(findReferences(d, 'monster', 'wolf')).toEqual([]);
  });
});

describe('placed parts are references a rename must move', () => {
  // The real registries: every class exemplar and every recipe line names
  // parts and materials, so renaming either must carry them all.
  const DATA = { itemClass: ITEM_CLASSES, recipe: RECIPES, part: PART_KINDS, material: MATERIALS };
  const placedIn = (p: Placement | undefined) =>
    Object.values(p ?? {}).filter((x): x is PlacedPart => !!x);

  it('renaming a material reaches every exemplar and every recipe placement', () => {
    const sites = findReferences(DATA, 'material', 'iron_ingot');
    const ofKind = (k: string) => sites.filter((s) => s.kind === k);
    // Counted straight off the data: one site per placed part made of iron.
    const exemplarParts = Object.values(ITEM_CLASSES).flatMap((c) => placedIn(c.exemplar)).filter((p) => p.mat === 'iron_ingot');
    const recipeParts = Object.values(RECIPES).flatMap((r) => placedIn(r.forge)).filter((p) => p.mat === 'iron_ingot');
    expect(exemplarParts.length).toBeGreaterThanOrEqual(40);
    expect(ofKind('itemClass')).toHaveLength(exemplarParts.length);
    expect(ofKind('recipe')).toHaveLength(recipeParts.length);
    expect([...new Set(ofKind('recipe').map((s) => s.id))].sort()).toEqual(
      ['iron_breastplate', 'iron_dagger', 'iron_sword', 'katana', 'parrying_dagger', 'rapier'].sort(),
    );
    // Every site is a `mat` inside the placement, ready for a store op.
    for (const s of ofKind('itemClass')) expect([s.path[0], s.path.at(-1)]).toEqual(['exemplar', 'mat']);
    for (const s of ofKind('recipe')) expect([s.path[0], s.path.at(-1)]).toEqual(['forge', 'mat']);
    // The material's own entry is not a reference to itself.
    expect(ofKind('material')).toEqual([]);
  });

  it('renaming a part kind reaches the exemplars and recipe lines that use it, and not its own entry', () => {
    const sites = findReferences(DATA, 'part', 'long');
    const keys = sites.map((s) => `${s.kind}:${s.id}:${s.path.join('.')}`).sort();
    expect(keys).toEqual([
      'itemClass:sword:exemplar.head.kind',
      'itemClass:twin_blade:exemplar.head.kind',
      'itemClass:twin_blade:exemplar.head2.kind',
      'recipe:iron_sword:forge.head.kind',
    ]);
  });

  it('`kind` and `mat` are only references inside the placement', () => {
    // A recipe's result.kind is 'item' | 'material' | 'rune'; a class's
    // match.head.mat lists material TAGS ('wood'). Neither is a part or a material id.
    expect(findReferences(DATA, 'part', 'item')).toEqual([]);
    expect(findReferences(DATA, 'material', 'wood')).toEqual([]);
    expect(refKindFor('recipe', 'kind', 'result', ['result', 'kind'])).toBeUndefined();
    expect(refKindFor('itemClass', 'mat', 'head', ['match', 'head', 'mat'])).toBeUndefined();
    expect(refKindFor('itemClass', 'mat', 'head', ['exemplar', 'head', 'mat'])).toBe('material');
    expect(refKindFor('itemClass', 'kind', 'guard', ['exemplar', 'guard', 'kind'])).toBe('part');
    expect(refKindFor('recipe', 'mat', 'haft', ['forge', 'haft', 'mat'])).toBe('material');
    expect(refKindFor('recipe', 'kind', 'head', ['forge', 'head', 'kind'])).toBe('part');
  });
});
