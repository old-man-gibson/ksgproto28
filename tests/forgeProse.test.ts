/**
 * The forge edits prose through the text file, not the data file. These tests
 * pin the routing: a `desc` edit lands in `*.text.ts`, a new entry's prose is
 * split out of it, a rename carries the prose keys along, and a delete takes
 * them away.
 */
import { describe, expect, it } from 'vitest';
import { findRoot, parse } from '../forge/server/edit';
import { proseKeyFor, routeOp, splitProse, textFileFor, textKeys, textRootFor } from '../forge/server/prose';
import type { CatalogEntry } from '../forge/server/catalog';

const ENTRY: CatalogEntry = {
  kind: 'spot',
  label: 'Spots',
  icon: '📍',
  file: 'src/core/data/locations.data.ts',
  root: 'SPOTS',
  keyOrder: 'spot',
  exportName: 'SPOTS',
};

const DATA = `import type { SpotDef } from '../types';
import { prose } from '../text/prose';
import { SPOTS_TEXT } from '../text/locations.text';

export const SPOTS = prose<SpotDef>('SPOTS', SPOTS_TEXT, {
  // The heart of the demo world.
  oakrest_square: {
    id: 'oakrest_square',
    name: 'Oakrest Square',
    icon: '🏘️',
    areaId: 'oakrest',
    activities: [],
    finds: [
      { id: 'mossy_chute', at: 0.5 },
      { at: 0.9 },
    ],
    connections: [],
  },
});
`;

const TEXT = `import type { ProseTable } from './prose';

// ---------- SPOTS ----------
export const SPOTS_TEXT: ProseTable = {
  'oakrest_square.desc': 'The heart of Oakrest.',
  'oakrest_square.finds.mossy_chute.desc': 'A chute under the moss.',
  'oakrest_square.finds.1.desc': 'A loose coin.',
};
`;

/** Run routed edits against in-memory copies of both files. */
function run(op: Parameters<typeof routeOp>[0], data = DATA, text = TEXT): { data: string; text: string; notes: string[] } {
  const files: Record<string, string> = { [ENTRY.file]: data, [textFileFor(ENTRY.file)]: text };
  const notes: string[] = [];
  for (const edit of routeOp(op, ENTRY, data, text)) {
    const result = edit.apply(files[edit.file]);
    files[edit.file] = result.text;
    notes.push(result.note);
  }
  return { data: files[ENTRY.file], text: files[textFileFor(ENTRY.file)], notes };
}

describe('forge prose routing', () => {
  it('names the text file and root next to the data file', () => {
    expect(textFileFor('src/core/data/npcs.data.ts')).toBe('src/core/text/npcs.text.ts');
    expect(textRootFor('NPCS')).toBe('NPCS_TEXT');
  });

  it('sees through the prose() wrapper to the literal', () => {
    const sf = parse('locations.data.ts', DATA);
    const root = findRoot(sf, 'SPOTS');
    expect(root && root.kind).toBeTruthy();
    expect(root!.getText()).toMatch(/^\{/);
  });

  it('translates paths into prose keys by id where there is one', () => {
    expect(proseKeyFor(DATA, ENTRY, ['oakrest_square', 'desc'])).toBe('oakrest_square.desc');
    expect(proseKeyFor(DATA, ENTRY, ['oakrest_square', 'finds', '#id=mossy_chute', 'desc'])).toBe(
      'oakrest_square.finds.mossy_chute.desc',
    );
    expect(proseKeyFor(DATA, ENTRY, ['oakrest_square', 'finds', 0, 'desc'])).toBe(
      'oakrest_square.finds.mossy_chute.desc',
    );
    expect(proseKeyFor(DATA, ENTRY, ['oakrest_square', 'finds', 1, 'desc'])).toBe('oakrest_square.finds.1.desc');
    // A find that does not exist yet keeps the id from its lookup.
    expect(proseKeyFor(DATA, ENTRY, ['oakrest_square', 'finds', '#id=new_find', 'desc'])).toBe(
      'oakrest_square.finds.new_find.desc',
    );
  });

  it('splits prose out of a value at every depth', () => {
    const { stripped, prose } = splitProse({
      id: 'x',
      desc: 'top',
      finds: [{ id: 'a', at: 0.5, desc: 'find a' }, { at: 0.7, desc: 'find 1' }],
      dialogue: ['hi'],
    });
    expect(stripped).toEqual({ id: 'x', finds: [{ id: 'a', at: 0.5 }, { at: 0.7 }] });
    expect(prose).toEqual([
      { path: ['desc'], value: 'top' },
      { path: ['finds', 'a', 'desc'], value: 'find a' },
      { path: ['finds', '1', 'desc'], value: 'find 1' },
      { path: ['dialogue'], value: ['hi'] },
    ]);
  });

  it('routes a desc edit to the text file and leaves the data file alone', () => {
    const out = run({ op: 'set', kind: 'spot', path: ['oakrest_square', 'desc'], value: 'Oakrest. Four roads meet.' });
    expect(out.data).toBe(DATA);
    expect(out.text).toContain("'oakrest_square.desc': 'Oakrest. Four roads meet.',");
    expect(out.text).not.toContain('The heart of Oakrest.');
  });

  it('adds a new key for prose that had none', () => {
    const out = run({ op: 'set', kind: 'spot', path: ['oakrest_square', 'finds', '#id=new_find'], value: { id: 'new_find', at: 0.3, desc: 'A new find.' } });
    expect(out.data).toContain("id: 'new_find'");
    expect(out.data).not.toContain('A new find.');
    expect(out.text).toContain("'oakrest_square.finds.new_find.desc': 'A new find.'");
  });

  it('splits an added entry between the two files', () => {
    const out = run({
      op: 'add',
      kind: 'spot',
      key: 'mill',
      value: { id: 'mill', name: 'The Mill', icon: '🌾', areaId: 'oakrest', desc: 'Grain goes in.', activities: [], connections: [] },
    });
    expect(out.data).toContain('mill: {');
    expect(out.data).not.toContain('Grain goes in.');
    expect(out.text).toContain("'mill.desc': 'Grain goes in.'");
  });

  it('renames prose keys with the entry', () => {
    const out = run({ op: 'rename', kind: 'spot', from: 'oakrest_square', to: 'oakrest_green' });
    expect(out.data).toContain('oakrest_green: {');
    expect(textKeys(out.text, 'SPOTS_TEXT')).toEqual([
      'oakrest_green.desc',
      'oakrest_green.finds.mossy_chute.desc',
      'oakrest_green.finds.1.desc',
    ]);
  });

  it('deletes prose keys with the entry, and with a nested element', () => {
    const whole = run({ op: 'delete', kind: 'spot', path: ['oakrest_square'] });
    expect(textKeys(whole.text, 'SPOTS_TEXT')).toEqual([]);
    expect(whole.data).not.toContain('oakrest_square: {');

    const find = run({ op: 'delete', kind: 'spot', path: ['oakrest_square', 'finds', '#id=mossy_chute'] });
    expect(textKeys(find.text, 'SPOTS_TEXT')).toEqual(['oakrest_square.desc', 'oakrest_square.finds.1.desc']);
    expect(find.data).not.toContain('mossy_chute');
    // Comments outside the edited range survive, as everywhere in the forge.
    expect(find.data).toContain('// The heart of the demo world.');
  });
});
