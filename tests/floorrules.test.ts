import { describe, expect, it } from 'vitest';
import * as registry from '../src/core/registry';
import { FLOORS, SPOTS, buildAdjacency, declaredConnections } from '../src/core/registry';
import {
  clearTableIssues,
  exploreIssues,
  floorStructureIssues,
  type FloorAdjacency,
  type FloorReport,
  type FloorRule,
} from '../src/core/systems/floorRules';
import { validate } from '../forge/lib/validate';
import type { ActivityDef, Connection, SpotDef, SpotEncounter } from '../src/core/types';

/**
 * Mutation tests for the floor standard's step-1 rules (docs/FLOOR_STANDARD.md
 * §2.2). tests/content.test.ts shows each rule passes on the live registry;
 * this file shows each one fails when content breaks it, on edited copies of
 * the live spots (the registry itself is never touched). The spent-search rule
 * is in tests/searchspent.test.ts.
 */

const F2 = 'ascent_f2_area';

type Spots = Record<string, SpotDef>;

function addSpot(s: Spots, id: string, areaId: string, connections: Connection[] = [], extra: Partial<SpotDef> = {}): void {
  s[id] = { id, name: id, icon: '·', areaId, desc: '', activities: [], connections, map: { x: 50, y: 50 }, ...extra };
}

const link = (to: string, extra: Partial<Connection> = {}): Connection => ({ to, ticks: 10, ...extra });

/** A copy of the live spots with `change` applied, and the adjacency the registry would build for it. */
function world(change: (s: Spots) => void = () => {}): { spots: Spots; adj: FloorAdjacency } {
  const spots = structuredClone(SPOTS) as Spots;
  change(spots);
  return { spots, adj: buildAdjacency(declaredConnections(spots)) };
}

function run(floorId: string, change?: (s: Spots) => void): FloorReport {
  const { spots, adj } = world(change);
  return floorStructureIssues(FLOORS[floorId], spots, adj);
}

const messages = (r: FloorReport, rule: FloorRule): string[] => r.issues.filter((i) => i.rule === rule).map((i) => i.message);

describe('the live floors pass every structure rule', () => {
  it.each(['ascent_f1', 'ascent_f2', 'ascent_f3'])('%s', (id) => {
    const r = run(id);
    expect(r.issues).toEqual([]);
    expect(r.skipped).toBeUndefined();
  });

  it('floor 1 puts the office block off the spine, joined at the reception and the toll hall', () => {
    const r = run('ascent_f1');
    expect(r.spine).toEqual(
      expect.arrayContaining(['f1_landing', 'f1_storerooms', 'f1_bonded_deep', 'f1_forms', 'f1_reception', 'f1_toll_hall']),
    );
    expect(r.spine).toHaveLength(6);
    // Without the way back (the oneWay "Return to Reception" edges and the
    // doors into the toll hall) the seven offices join the spine at the
    // reception alone, and the loop rule fails.
    const cut = run('ascent_f1', (s) => {
      for (const id of ['f1_registry', 'f1_scribe', 'f1_auditor', 'f1_break_room', 'f1_dispatch', 'f1_records', 'f1_supplies']) {
        s[id].connections = s[id].connections.filter((c) => c.to !== 'f1_reception' && c.to !== 'f1_toll_hall');
      }
    });
    expect(messages(cut, 'wing-loop')).toEqual([expect.stringContaining("only 'f1_reception'")]);
  });
});

describe('no skip: each floor-local gate is necessary', () => {
  it('(b) a free two-way room between the stairhead and the third stretch bypasses the gates it spans', () => {
    const r = run('ascent_f2', (s) => {
      addSpot(s, 'f2_x', F2, [link('f2_stairhead'), link('f2_hall_3')]);
    });
    const skips = messages(r, 'no-skip');
    expect(skips).toHaveLength(2);
    expect(skips[0]).toContain('[fights:f2_hall_1 >= 3]');
    expect(skips[0]).toContain('f2_stairhead -> f2_x -> f2_hall_3');
    expect(skips[1]).toContain('[fights:f2_hall_2 >= 3]');
    // The third gate still stands: the far end's only way in is its own door.
    expect(skips.some((m) => m.includes('fights:f2_hall_3'))).toBe(false);
  });

  it('(b) is invisible to authored edges alone: the bypass runs over mirrored edges', () => {
    const { spots } = world((s) => {
      addSpot(s, 'f2_x', F2, [link('f2_stairhead'), link('f2_hall_3')]);
    });
    const unmirrored: FloorAdjacency = new Map();
    for (const { from, connection } of declaredConnections(spots)) {
      unmirrored.set(from, [...(unmirrored.get(from) ?? []), connection]);
    }
    expect(messages(floorStructureIssues(FLOORS.ascent_f2, spots, unmirrored), 'no-skip')).toEqual([]);
    expect(messages(floorStructureIssues(FLOORS.ascent_f2, spots, buildAdjacency(declaredConnections(spots))), 'no-skip')).not.toEqual([]);
  });

  it('(c) the same room with a oneWay exit to the stairhead and its only entry from the third stretch passes', () => {
    const r = run('ascent_f2', (s) => {
      addSpot(s, 'f2_x', F2, [link('f2_stairhead', { oneWay: true })]);
      s.f2_hall_3.connections.push(link('f2_x'));
    });
    expect(r.issues).toEqual([]);
  });

  it('(d) an entry behind an attribute still bypasses: only floor counters count as gates', () => {
    const attr: Partial<Connection> = { requires: [{ type: 'attr', attr: 'str', level: 7 }] };
    const r = run('ascent_f2', (s) => {
      addSpot(s, 'f2_x', F2, [link('f2_hall_3')]);
      s.f2_stairhead.connections.push(link('f2_x', attr));
    });
    expect(messages(r, 'no-skip')).not.toEqual([]);
    // As a dead-end room, the same attribute door is a wing and passes.
    const wing = run('ascent_f2', (s) => {
      addSpot(s, 'f2_x', F2);
      s.f2_stairhead.connections.push(link('f2_x', attr));
    });
    expect(wing.issues).toEqual([]);
  });

  it('(e) a oneWay edge from a new room back to the stairhead, behind a floor flag, passes', () => {
    const lever = (s: Spots, back: Partial<Connection>) => {
      addSpot(s, 'f2_vent', F2, [
        link('f2_hall_1'),
        link('f2_stairhead', { requires: [{ type: 'stat', key: 'flag:f2_lever', value: 1 }], ...back }),
      ]);
      s.f2_break_room.finds = [...(s.f2_break_room.finds ?? []), { id: 'f2_lever_find', at: 0.9, stat: { key: 'flag:f2_lever' } }];
    };
    expect(run('ascent_f2', (s) => lever(s, { oneWay: true })).issues).toEqual([]);
    // The same edge as a two-way road is a gate on the landing itself, and
    // the mirror hands the landing a free road to the vent.
    expect(messages(run('ascent_f2', (s) => lever(s, {})), 'no-skip')).toEqual([
      expect.stringContaining('[flag:f2_lever >= 1]'),
    ]);
  });

  it('a find or a search reward at a floor spot makes its flag a floor counter', () => {
    // Floor 1's doors read key items granted by a search reward (the daybook in
    // the Archive) and by a find (the office key at the reception). A free road
    // from the records passage to the toll hall bypasses both, and names them.
    // The office-key gate is named even though the road makes the toll hall
    // 3 hops from the landing and the reception 4: a oneWay gate edge into the
    // toll hall is not a "shortcut home" just because it now points at a nearer
    // room, since the toll hall is not on every road to the reception.
    const r = run('ascent_f1', (s) => {
      s.f1_bonded_deep.connections.push(link('f1_toll_hall'));
    });
    const skips = messages(r, 'no-skip');
    expect(skips).toHaveLength(2);
    expect(skips.join('\n')).toContain('[flag:key_item:toll_clerk_book >= 1]');
    expect(skips.join('\n')).toContain('[flag:key_item:toll_office_key >= 1]');
  });

  it('a gated oneWay exit is a shortcut home only when its target is on every road to its source', () => {
    // v hangs off the second stretch; u hangs off the first. u is nearer the
    // landing than v, but u is not on the road to v, so v -> u behind a floor
    // flag is a gate on a room the first stretch already opens.
    const exit = (to: string) => (s: Spots) => {
      addSpot(s, 'f2_u', F2);
      addSpot(s, 'f2_v', F2, [link(to, { oneWay: true, requires: [{ type: 'stat', key: 'flag:f2_lever', value: 1 }] })]);
      s.f2_hall_1.connections.push(link('f2_u'));
      s.f2_hall_2.connections.push(link('f2_v'));
      s.f2_break_room.finds = [...(s.f2_break_room.finds ?? []), { id: 'f2_lever_find', at: 0.9, stat: { key: 'flag:f2_lever' } }];
    };
    expect(messages(run('ascent_f2', exit('f2_u')), 'no-skip')).toEqual([expect.stringContaining('[flag:f2_lever >= 1]')]);
    // Back to a room on the way in (the first stretch), it is a shortcut home.
    expect(run('ascent_f2', exit('f2_hall_1')).issues).toEqual([]);
  });

  it('edges that carry a gate\'s terms and more are shut with it', () => {
    // v is behind the lever on one road and behind lever + first stretch on
    // another. With the lever off both are shut, so the lever gate stands.
    // The stricter road adds nothing over the lever alone, and is named.
    const r = run('ascent_f2', (s) => {
      addSpot(s, 'f2_v', F2);
      s.f2_hall_1.connections.push(link('f2_v', { requires: [{ type: 'stat', key: 'flag:f2_lever', value: 1 }] }));
      s.f2_stairhead.connections.push(
        link('f2_v', {
          requires: [
            { type: 'stat', key: 'flag:f2_lever', value: 1 },
            { type: 'stat', key: 'fights:f2_hall_1', value: 3 },
          ],
        }),
      );
      s.f2_break_room.finds = [...(s.f2_break_room.finds ?? []), { id: 'f2_lever_find', at: 0.9, stat: { key: 'flag:f2_lever' } }];
    });
    const skips = messages(r, 'no-skip');
    expect(skips).toHaveLength(1);
    expect(skips[0]).toContain('[fights:f2_hall_1 >= 3 & flag:f2_lever >= 1]');
  });
});

describe('wing depth', () => {
  const chain = (n: number) => (s: Spots) => {
    for (let i = 1; i <= n; i++) addSpot(s, `f2_w${i}`, F2, i < n ? [link(`f2_w${i + 1}`)] : []);
    s.f2_hall_1.connections.push(link('f2_w1'));
  };

  it('a room 4 hops from the spine fails; 3 hops passes the depth rule', () => {
    expect(messages(run('ascent_f2', chain(4)), 'wing-depth')).toEqual([expect.stringContaining("'f2_w4' is 4 hops")]);
    expect(messages(run('ascent_f2', chain(3)), 'wing-depth')).toEqual([]);
  });

  it('is measured from the spine, not the landing: the far end of floor 2 is 4 hops from the landing', () => {
    const r = run('ascent_f2');
    expect(r.spine).toContain('f2_hall_4');
    expect(r.issues).toEqual([]);
  });

  it('a room nothing reaches fails', () => {
    expect(messages(run('ascent_f2', (s) => addSpot(s, 'f2_lost', F2)), 'wing-depth')).toEqual([
      expect.stringContaining("'f2_lost' cannot be reached"),
    ]);
  });
});

describe('wings loop', () => {
  const wing = (n: number, extra: (s: Spots) => void = () => {}) => (s: Spots) => {
    for (let i = 1; i <= n; i++) addSpot(s, `f2_w${i}`, F2, i < n ? [link(`f2_w${i + 1}`)] : []);
    s.f2_hall_1.connections.push(link('f2_w1'));
    extra(s);
  };

  it('a wing of 3 joined to the spine at one spot fails', () => {
    expect(messages(run('ascent_f2', wing(3)), 'wing-loop')).toEqual([
      expect.stringContaining("joins the spine at only 'f2_hall_1'"),
    ]);
  });

  it('a wing of 2 joined at one spot passes', () => {
    expect(run('ascent_f2', wing(2)).issues).toEqual([]);
  });

  it('a wing of 3 that also joins the stairhead passes', () => {
    const r = run('ascent_f2', wing(3, (s) => s.f2_w3.connections.push(link('f2_stairhead'))));
    expect(r.issues).toEqual([]);
  });

  it('a wing of 3 with a oneWay edge back to the spot it joins passes', () => {
    const r = run('ascent_f2', wing(3, (s) => s.f2_w3.connections.push(link('f2_hall_1', { oneWay: true }))));
    expect(r.issues).toEqual([]);
  });
});

describe("the clear spot's table never empties", () => {
  const line = (extra: Partial<SpotEncounter> = {}): SpotEncounter => ({ monsterId: 'forest_rat', weight: 1, level: [1, 1], ...extra });
  const table = (...encounters: SpotEncounter[]) => ({ id: 'fixture_spot', encounters });
  const stat = (key: string, value: number) => ({ type: 'stat' as const, key, value });
  const statMax = (key: string, value: number) => ({ type: 'statMax' as const, key, value });

  it("floor 3's Hearing Room (four lines partitioning flag:f3_strings_cut) passes", () => {
    expect(clearTableIssues(SPOTS.f3_hearing_room)).toEqual([]);
  });

  it('the same table with the value-2 line moved to 3 leaves a gap at 2', () => {
    const r = run('ascent_f3', (s) => {
      s.f3_hearing_room.encounters![2].requires = [stat('flag:f3_strings_cut', 3), statMax('flag:f3_strings_cut', 3)];
    });
    expect(messages(r, 'clear-table')).toEqual([expect.stringContaining('flag:f3_strings_cut = 2')]);
  });

  it('an open-ended top line (no statMax) covers every higher value', () => {
    expect(clearTableIssues(SPOTS.f3_hearing_room)).toEqual([]);
    expect(clearTableIssues(table(line({ requires: [statMax('flag:x', 0)] }), line({ requires: [stat('flag:x', 1)] })))).toEqual([]);
  });

  it('lines with a daypart or a window do not cover a gap', () => {
    expect(clearTableIssues(table(line({ daypart: 'night' })))).toHaveLength(1);
    expect(clearTableIssues(table(line({ window: { min: 1, max: 2 } })))).toHaveLength(1);
    expect(clearTableIssues(table(line({ daypart: 'night' }), line()))).toEqual([]);
  });

  it('a line gated on a counter alone leaves the counter-zero state empty', () => {
    const issues = clearTableIssues(table(line({ requires: [stat('flag:x', 2)] })));
    expect(issues).toEqual([expect.stringContaining('flag:x = 0')]);
  });

  it('a line gated on something that is not a counter cannot be counted on', () => {
    const attr = { type: 'attr' as const, attr: 'str' as const, level: 5 };
    expect(clearTableIssues(table(line({ requires: [attr] })))).toHaveLength(1);
    expect(clearTableIssues(table(line({ requires: [attr] }), line()))).toEqual([]);
  });

  it('a once line counts as eligible: the history is ignored', () => {
    expect(clearTableIssues(table(line({ once: true })))).toEqual([]);
  });

  it('refuses to enumerate an unreasonable number of counters', () => {
    const lines = Array.from({ length: 12 }, (_, i) => line({ requires: [stat(`flag:k${i}`, 1)] }));
    expect(clearTableIssues(table(...lines, line()))[0]).toContain('too many to check');
  });
});

describe('every explore pays something', () => {
  const explore: ActivityDef = { id: 'explore_x', kind: 'explore', name: 'Look', icon: '🔍' };
  const spot = (extra: Partial<SpotDef>): SpotDef => ({
    id: 'fixture_spot', name: 'x', icon: '·', areaId: F2, desc: '', activities: [explore], connections: [], ...extra,
  });

  it('fails with no finds and no hidden road, passes with either', () => {
    expect(exploreIssues([spot({})])).toEqual([{ spot: 'fixture_spot', message: expect.stringContaining('pays nothing') }]);
    expect(exploreIssues([spot({ finds: [{ id: 'f', at: 1, gold: [1, 1] }] })])).toEqual([]);
    expect(exploreIssues([spot({ connections: [{ to: 'somewhere', ticks: 5, hidden: true }] })])).toEqual([]);
    expect(exploreIssues([spot({ activities: [] })])).toEqual([]);
  });

  it('the Chalk Yard and the Undercrofts each pay one find; stripped of it, each fails', () => {
    expect(exploreIssues([SPOTS.chalk_yard, SPOTS.the_undercrofts])).toEqual([]);
    for (const id of ['chalk_yard', 'the_undercrofts']) {
      expect(SPOTS[id].finds).toHaveLength(1);
      expect(exploreIssues([{ ...SPOTS[id], finds: undefined }]).map((i) => i.spot)).toEqual([id]);
    }
  });
});

/**
 * forge/lib/validate.ts runs the same functions on the staged working copy.
 * These run validate() on a stand-in store built from the registry, with the
 * spots (and floors) swapped for edited copies.
 */
describe('the forge validator reports the same rules', () => {
  const KINDS: Record<string, unknown> = {
    area: registry.AREAS, region: registry.REGIONS, npc: registry.NPCS, quest: registry.QUESTS, material: registry.MATERIALS,
    item: registry.ITEMS, rune: registry.RUNES, monster: registry.MONSTERS, recipe: registry.RECIPES, skill: registry.SKILLS,
    discipline: registry.DISCIPLINES, status: registry.STATUSES, tower: registry.TOWERS, band: registry.BANDS,
    keyItem: registry.KEY_ITEMS, technique: registry.TECHNIQUES,
  };
  function forgeIssues(change: (s: Spots) => void = () => {}, floors: unknown = FLOORS) {
    const spots = structuredClone(SPOTS) as Spots;
    change(spots);
    const all = (kind: string): Record<string, unknown> =>
      kind === 'spot' ? spots : kind === 'floor' ? (floors as Record<string, unknown>) : ((KINDS[kind] as Record<string, unknown>) ?? {});
    const store = { all, get: (kind: string, id: string) => all(kind)[id], meta: {}, catalog: [] } as unknown as Parameters<typeof validate>[0];
    return validate(store);
  }
  const mine = (issues: ReturnType<typeof validate>) =>
    issues.filter((i) => /^(spine|no-skip|wing-depth|wing-loop|clear-table): |pays nothing|did not run/.test(i.message));

  it('says nothing about the live content', () => {
    expect(mine(forgeIssues())).toEqual([]);
  });

  it('flags a bypass on the floor, a lost wing, a table gap and an explore that pays nothing', () => {
    const issues = mine(
      forgeIssues((s) => {
        addSpot(s, 'f2_x', F2, [link('f2_stairhead'), link('f2_hall_3')]);
        s.f3_hearing_room.encounters![2].requires = [
          { type: 'stat', key: 'flag:f3_strings_cut', value: 3 },
          { type: 'statMax', key: 'flag:f3_strings_cut', value: 3 },
        ];
        s.chalk_yard.finds = undefined;
      }),
    );
    expect(issues.filter((i) => i.message.startsWith('no-skip: '))).toEqual([
      expect.objectContaining({ severity: 'error', subject: { kind: 'floor', id: 'ascent_f2' } }),
      expect.objectContaining({ severity: 'error', subject: { kind: 'floor', id: 'ascent_f2' } }),
    ]);
    expect(issues.filter((i) => i.message.startsWith('clear-table: '))).toEqual([
      expect.objectContaining({ severity: 'error', subject: { kind: 'floor', id: 'ascent_f3' } }),
    ]);
    expect(issues.filter((i) => i.message.includes('pays nothing'))).toEqual([
      expect.objectContaining({ severity: 'error', subject: { kind: 'spot', id: 'chalk_yard' } }),
    ]);
  });

  it('warns, and skips the spine rules, when a floor\'s clear names no spot', () => {
    const questClear = { ...FLOORS, ascent_f2: { ...FLOORS.ascent_f2, clear: [{ type: 'quest', id: 'wolf_hunt' }] } };
    expect(mine(forgeIssues(() => {}, questClear))).toEqual([
      expect.objectContaining({ severity: 'warn', subject: { kind: 'floor', id: 'ascent_f2' } }),
    ]);
  });
});
