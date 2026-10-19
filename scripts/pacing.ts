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

import { runJohn, secs, SEGMENTS, type ClimbReport } from '../tests/john';
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
  ['gallery KO', (r) => r.knockouts.gallery],
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
      const r = runJohn({ seed, weapon, spell, attentive });
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
    ` · knockouts ${SEGMENTS.map((k) => `${k} ${total(k)}`).join(', ')}`,
);
