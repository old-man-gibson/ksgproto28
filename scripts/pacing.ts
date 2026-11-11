// Sends John (docs/COMPLETABILITY.md §8) up band 1, headless, and prints how
// it went: when each stretch finished, where the knockouts were, how the first
// boss fight went, and what the climb was holding at the end. The driver and
// its rules live in tests/john.ts; the expectations it is held to live in
// tests/john.test.ts. This only prints.
//
//   npm run pacing                               John (skip) + every rack weapon, three seeds
//   npm run pacing -- --seeds 1,2,3,4,5          more seeds
//   npm run pacing -- --weapons sword,spear      fewer weapons
//   npm run pacing -- --spells fire,ice,spark    compare the tutorial spells
//   npm run pacing -- --attentive                explore first, wield the finds
//   npm run pacing -- --fights                   every fight of every climb
//   npm run pacing -- --through 20 --seeds 42 --weapons skip
//                                                climb past band 1: floors 4 to 20 (6 = band 2,
//                                                7 to 10 = band 3's wards, 11 and up = the harbor,
//                                                the festival, floor 17 and the desert). Prints a
//                                                per-floor table for each climb after the band 1 one.
//   npm run pacing -- --through 20 --side navy   the harbor side John signs with (default merchants)
//
// Past floor 6 a climb is three runs and takes seconds per climb at `--weapons skip` and
// about a minute with the whole rack; pass --weapons to keep it short.

import { runJohn, secs, SEGMENTS, type ClimbReport, type ClimbSegment } from '../tests/john';
import { TPS } from '../src/core/engine/loop';
import type { TutorialWeapon } from '../src/core/types';

const args = process.argv.slice(2);
const list = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return (i >= 0 && args[i + 1] ? args[i + 1] : fallback).split(',').filter(Boolean);
};
const seeds = list('--seeds', '42,7,1234').map(Number);
const weapons = list('--weapons', 'skip,sword,spear,dagger,hammer,unarmed') as (TutorialWeapon | 'skip')[];
const spells = list('--spells', 'fire');
const attentive = args.includes('--attentive');
const showFights = args.includes('--fights');
const through = Number(list('--through', '3')[0]);
const side = list('--side', 'merchants')[0];

const min = (ticks: number | null) => (ticks === null ? '—' : `${(ticks / 600).toFixed(1)}m`);
const gap = (a: number | null, b: number | null) => (a === null || b === null ? '—' : `${Math.round((b - a) / 10)}s`);

const columns: [string, (r: ClimbReport) => string | number][] = [
  ['weapon', (r) => (r.opts.weapon === 'skip' ? 'john' : r.opts.weapon)],
  ['spell', (r) => (r.opts.weapon === 'skip' ? '—' : r.opts.spell)],
  ['seed', (r) => r.opts.seed],
  ['tutorial', (r) => min(r.done.tutorial)],
  ['vermin KO', (r) => r.knockouts.vermin],
  ['boss fight', (r) => (r.firstBoss ? `${secs(r.firstBoss.ticks)}s ${r.firstBoss.won ? 'won' : 'lost'}` : '—')],
  ['boss tries', (r) => r.bossAttempts],
  ['floor 1', (r) => min(r.done.floor1)],
  ['f2 KO', (r) => r.knockouts.floor2],
  ['floor 2', (r) => min(r.done.floor2)],
  ['gate wait', (r) => gap(r.done.floor2, r.done.gate3)],
  ['descent KO', (r) => r.knockouts.descent],
  ['den KO', (r) => r.knockouts.floor3],
  ['band 1', (r) => min(r.done.floor3)],
  ['gold', (r) => r.goldEarned],
  ['lv f1', (r) => r.levels.floor1 ?? '—'],
  ['lv f2', (r) => r.levels.floor2 ?? '—'],
  ['lv end', (r) => r.levels.floor3 ?? '—'],
  ['level XP', (r) => r.levelXp],
];

const rows: ClimbReport[] = [];
for (const seed of seeds)
  for (const weapon of weapons)
    for (const spell of weapon === 'skip' ? spells.slice(0, 1) : spells) {
      const r = runJohn({ seed, weapon, spell, attentive, through, side });
      rows.push(r);
      if (showFights) {
        console.log(`\n${weapon} / ${spell} / seed ${seed}`);
        for (const f of r.fights)
          console.log(`  ${String(secs(f.at)).padStart(5)}s  ${f.spot.padEnd(16)} ${(secs(f.ticks) + 's').padStart(4)}  ${f.hpBefore} → ${f.hpAfter} / ${f.maxHp}   ${f.foes.join(', ')}`);
      }
    }

const cells = rows.map((r) => columns.map(([, get]) => String(get(r))));
const widths = columns.map(([h], i) => Math.max(h.length, ...cells.map((c) => c[i].length)));
const line = (c: string[]) => c.map((x, i) => x.padStart(widths[i])).join('  ');
console.log(`\nBand 1, John${attentive ? ', attentive' : ''} — ${rows.length} climbs ('john' = Skip tutorial: rusty sword, Neutral, no spell)`);
console.log(line(columns.map(([h]) => h)));
for (const c of cells) console.log(line(c));

const finished = rows.filter((r) => r.done.floor3 !== null);
const unfinished = rows.length - finished.length;
const total = (seg: (typeof SEGMENTS)[number]) => rows.reduce((n, r) => n + r.knockouts[seg], 0);
console.log(
  `\nfinished ${finished.length}/${rows.length}` +
    (unfinished ? ` (${unfinished} ran out of time)` : '') +
    ` · first boss lost ${rows.filter((r) => r.firstBoss && !r.firstBoss.won).length}/${rows.length}` +
    ` · knockouts ${SEGMENTS.filter((k) => rows.some((r) => r.done[k] !== null)).map((k) => `${k} ${total(k)}`).join(', ')}`,
);

// ---- Past band 1: one table per climb, a row per segment in the order it was played. ----

/** Game time as h:mm:ss. */
const clock = (ticks: number) => {
  const sec = Math.round(ticks / TPS);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(sec / 3600)}:${two(Math.floor(sec / 60) % 60)}:${two(sec % 60)}`;
};
/** The floor each segment is, for the first column. */
const FLOOR_OF: Partial<Record<ClimbSegment, string>> = {
  tutorial: 'f0', vermin: 'f1 vermin', floor1: 'f1', floor2: 'f2', gate3: 'f3 gate', descent: 'f3 stairs', floor3: 'f3',
  floor4: 'f4', gate5: 'f5 gate', floor5: 'f5', gate6: 'f6 gate', floor6: 'f6',
  reclimb2: 'f1-6 again', siege: 'f11 siege', reclimb3: 'f1-10 again',
};
const floorName = (k: ClimbSegment) => FLOOR_OF[k] ?? `f${k.replace('floor', '')}`;

if (through > 3) {
  for (const r of rows) {
    const played = SEGMENTS.filter((k) => r.done[k] !== null).sort((a, b) => r.done[a]! - r.done[b]! || SEGMENTS.indexOf(a) - SEGMENTS.indexOf(b));
    const head = ['floor', 'run', 'cleared at', 'took', 'KO', 'boss tries/lost', 'level', 'gold', 'note'];
    let prev = 0;
    const body = played.map((k) => {
      const stuck = r.stuck[k];
      const note = [
        stuck ? (stuck.wall ? 'WALL, debug skip' : 'SCRIPT STOPPED, debug skip') : '',
        r.skipBefore[k] ? `measured after skip at ${r.skipBefore[k]}` : '',
      ].filter(Boolean).join('; ');
      const row = [
        floorName(k),
        String(r.runs[k] ?? '—'),
        clock(r.done[k]!),
        clock(r.done[k]! - prev),
        String(r.knockouts[k]),
        r.bossTries[k] ? `${r.bossTries[k]}/${r.bossLost[k]}` : '—',
        String(r.levels[k] ?? '—'),
        String(r.gold[k] ?? '—'),
        note,
      ];
      prev = r.done[k]!;
      return row;
    });
    const w = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
    const fmt = (c: string[]) => c.map((x, i) => (i === 0 || i === c.length - 1 ? x.padEnd(w[i]) : x.padStart(w[i]))).join('  ').trimEnd();
    console.log(`\nJohn ${r.opts.weapon === 'skip' ? '(skip)' : r.opts.weapon}, seed ${r.opts.seed}, side ${r.opts.side}, through floor ${r.opts.through}: ${r.runs.reclimb2 ? 'three runs' : 'one run'}, ${clock(r.ticks)} of play, ${r.fights.length} fights, ${r.goldEarned} gold earned in the last run`);
    console.log(fmt(head));
    for (const b of body) console.log(fmt(b));
    // Bosses: the try that ended the segment (the last), with its foes against John's level.
    for (const k of played) {
      const tries = r.fights.filter((f) => f.segment === k && f.boss);
      const last = tries[tries.length - 1];
      if (last && SEGMENTS.indexOf(k) >= SEGMENTS.indexOf('floor7'))
        console.log(`  boss ${floorName(k)}: ${last.foes.join(', ')} vs John level ${last.level}, ${secs(last.ticks)} s, ${last.lost ? 'lost' : 'won'}; ${tries.length} tries, ${tries.filter((f) => f.lost).length} lost`);
    }
    for (const k of SEGMENTS) {
      const st = r.stuck[k];
      if (!st) continue;
      console.log(
        `  stuck ${floorName(k)}: ${st.why}; ${st.fights} fights, ${st.lost} lost` +
          (st.foe ? `; knocked out by ${st.foe} at ${st.spot}, foe level about ${st.foeLevel} vs John level ${st.level}` : '') +
          (st.taken !== null ? `; HP per second taken ${st.taken}, dealt ${st.dealt}` : ''),
      );
    }
  }
}
