import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { FLOORS, PRESTIGE_UNLOCK, SPOTS } from '../src/core/registry';
import { TPS } from '../src/core/engine/loop';
import { runJohn, secs, type ClimbReport } from './john';

// Band 2, the Wilds (docs/plans/bands-2-3.md): floors 4–6, prestige at the
// warchief, floor 0 behind every prestiged run.

const MINUTE = 60 * TPS;
const BAND_TWO = ['ascent_f4', 'ascent_f5', 'ascent_f6'];
const BOSS_ROOMS = new Set(['f4_ravine_floor', 'f5_back_door', 'f6_great_hall']);

describe('band 2 structure', () => {
  it('prestige opens on the floor 6 clear: the warchief', () => {
    expect(PRESTIGE_UNLOCK).toEqual(FLOORS.ascent_f6.clear);
  });

  it('floor 0 cannot be reached from the Foot, where every prestiged run starts', () => {
    // Every connection out of every spot, conditions ignored: the most a
    // player could ever walk. The tutorial's road out is one-way.
    const seen = new Set(['ascent_foot']);
    const queue = ['ascent_foot'];
    while (queue.length) {
      const at = queue.shift()!;
      for (const c of SPOTS[at]?.connections ?? []) {
        if (!seen.has(c.to)) {
          seen.add(c.to);
          queue.push(c.to);
        }
      }
    }
    expect([...seen].filter((id) => id.startsWith('f0_'))).toEqual([]);
    expect(FLOORS.ascent_f0.bandId).toBeUndefined(); // so climbTo never offers it
  });

  it('every hunt outside the three boss rooms is endless, and the gates read goblin kills', () => {
    for (const floor of BAND_TWO) {
      const spots = Object.values(SPOTS).filter((s) => s.areaId === FLOORS[floor].areaId);
      for (const s of spots) {
        if (BOSS_ROOMS.has(s.id)) expect(s.fightLimit, s.id).toBe(1);
        else expect(s.fightLimit, `${s.id} runs out`).toBeUndefined();
      }
    }
    for (const floor of ['ascent_f5', 'ascent_f6']) {
      expect(FLOORS[floor].gate?.every((c) => c.type === 'stat' && c.key === 'kills:tag:goblin'), floor).toBe(true);
    }
  });
});

describe('John through band 2', () => {
  // Two climbs that differ in weapon, seed and attention. Bounds are loose on
  // purpose: the numbers are first guesses (sketch fidelity), and the test is
  // that a plain longsword-style player clears the band by grinding.
  const climbs: ClimbReport[] = [
    runJohn({ seed: 7, weapon: 'skip', through: 6, budget: 3 * 3600 * TPS }),
    runJohn({ seed: 1234, weapon: 'spear', attentive: true, through: 6, budget: 3 * 3600 * TPS }),
  ];
  const label = (r: ClimbReport) => `seed ${r.opts.seed} ${r.opts.weapon}${r.opts.attentive ? ' attentive' : ''}`;

  it('clears floor 6 inside 45 minutes of play', () => {
    for (const r of climbs) {
      expect(r.done.floor6, `${label(r)}: never cleared floor 6`).not.toBeNull();
      expect(r.done.floor6!, `${label(r)}: took ${secs(r.done.floor6)} s`).toBeLessThanOrEqual(45 * MINUTE);
    }
  });

  it('knocks John down on the way, not out of the game', () => {
    for (const r of climbs) {
      const band = r.knockouts.floor4 + r.knockouts.gate5 + r.knockouts.floor5 + r.knockouts.gate6 + r.knockouts.floor6;
      expect(band, `${label(r)}: band 2 knockouts`).toBeLessThanOrEqual(30);
    }
  });
});
