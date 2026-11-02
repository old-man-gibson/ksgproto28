// A fresh character at the Woods Edge (floor 4), attempt after attempt, with
// and without the martial shutter open and with each bank ability. Prints
// how the fights go as the attempts pile up: wins per attempt, kill time, HP
// lost per fight, and the skill and character levels that carry it.
//
// "Fresh" is Skip tutorial with the rusty sword equipped: level 1, every
// attribute 1, no technique, no spell. That is a prestiged run with the band 1
// pass (prestige.data.ts pass_lower) and no Head Start. One attempt: rest to
// full at the floor's landing camp (where a knockout there wakes), walk to the
// spot, hunt until knocked out or --cap fights won. XP, levels, techniques
// and ability cells carry between attempts, which is the point.
//
// Variants: martial shutter open or shut; each bank ability (granted the way
// the debug panel grants it); `frozen-*` hold attributes, skills or character
// level at the fresh values every tick, which ranks what carries the climb;
// `loss-xp-*` emulate a candidate fix (a knockout keeps only part of the XP
// earned in that fight) without touching game code.
//
//   npx vite-node scripts/woods-edge.ts
//   npx vite-node scripts/woods-edge.ts -- --seeds 1,2,3 --attempts 12 --spot f6_tunnels
//   npx vite-node scripts/woods-edge.ts -- --variants base,martial
//   npx vite-node scripts/woods-edge.ts -- --john        John's floor 4 fights, the expected numbers
//   npx vite-node scripts/woods-edge.ts -- --verbose     every attempt of every run
//
// Deterministic: seeds in, same runs out. Variants on the same seed share the
// opening and drift apart once their RNG draws differ, so read the seed means.

import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { TPS } from '../src/core/engine/loop';
import { getDerivedStats } from '../src/core/systems/derived';
import { effectiveAttr } from '../src/core/systems/attributes';
import { knownTechniques } from '../src/core/systems/martial';
import { bindFacets, grantFacet, installFacet } from '../src/core/facet/host';
import { BANDS, FLOORS, SPOTS } from '../src/core/registry';
import { noteSafeSpot } from '../src/core/systems/safety';
import { bandedXpNeeded } from '../src/core/systems/progression';
import { skillXpNeeded } from '../src/core/systems/skills';
import { ATTRIBUTE_PROGRESSION } from '../src/core/data/progression.data';
import type { GameState } from '../src/core/types';
import { runJohn } from '../tests/john';

const args = process.argv.slice(2);
const opt = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const seeds = opt('--seeds', '1,2,3,4,5,6,7,8').split(',').map(Number);
const ATTEMPTS = Number(opt('--attempts', '15'));
/** Wins in one attempt before it is called a clean run and ended. */
const CAP = Number(opt('--cap', '20'));
const SPOT = opt('--spot', 'f4_woods_edge');
const verbose = args.includes('--verbose');
// `--dyn factor,cap` replaces band 2's dynamic levels in this process (towers.data.ts holds the real ones; 0,0 = off).
if (args.includes('--dyn')) {
  const [factor, cap] = opt('--dyn', '').split(',').map(Number);
  BANDS.ascent_middle.dynamicLevel = cap > 0 ? { factor, cap } : undefined;
}
/** The landing of the spot's floor: its camp is where a knockout there wakes. */
const CAMP = Object.values(FLOORS).find((f) => f.areaId === SPOTS[SPOT].areaId)!.landing!;

interface Variant {
  id: string;
  martial: boolean;
  ability?: string;
  /** Growth held at the fresh character's values every tick: what the climb is without it. */
  freeze?: ('attrs' | 'skills' | 'level')[];
  /**
   * A candidate fix, emulated here rather than built: the share of the
   * attribute and skill XP earned during a fight that a knockout lets the
   * player keep. Undefined = all of it, as the game does today.
   */
  lossXp?: number;
}
const VARIANTS: Variant[] = [
  { id: 'base', martial: false },
  { id: 'martial', martial: true },
  { id: 'solar', martial: false, ability: 'solar_charge' },
  { id: 'zenkai', martial: false, ability: 'zenkai' },
  { id: 'moons', martial: false, ability: 'little_moons' },
  { id: 'martial+zenkai', martial: true, ability: 'zenkai' },
  { id: 'frozen-attrs', martial: false, freeze: ['attrs'] },
  { id: 'frozen-skills', martial: false, freeze: ['skills'] },
  { id: 'frozen-level', martial: false, freeze: ['level'] },
  { id: 'frozen-all', martial: false, freeze: ['attrs', 'skills', 'level'] },
  { id: 'loss-xp-50', martial: true, lossXp: 0.5 },
  { id: 'loss-xp-0', martial: true, lossXp: 0 },
];

/** Progress as the game stores it: a level and the XP banked toward the next. */
type Progress = { level: number; xp: number };
/**
 * Keep `share` of what was earned between `from` and `now`, in place on `now`.
 * `need(level)` is the curve: the XP to advance from `level`.
 */
function keepShare(now: Progress, from: Progress, share: number, need: (level: number) => number): void {
  let gained = now.xp - from.xp;
  for (let l = from.level; l < now.level; l++) gained += need(l);
  now.level = from.level;
  now.xp = from.xp + Math.max(0, gained) * share;
  while (now.xp >= need(now.level)) {
    now.xp -= need(now.level);
    now.level++;
  }
}
const picked = opt('--variants', VARIANTS.map((v) => v.id).join(',')).split(',');

interface Fight {
  attempt: number;
  won: boolean;
  ticks: number;
  /** HP lost as a share of max HP (a lost fight counts down to the knockout). */
  hpLost: number;
  foes: string[];
}
interface Snapshot {
  attempt: number;
  wins: number;
  level: number;
  fighting: number;
  sword: number;
  str: number;
  dex: number;
  con: number;
  techniques: string[];
  /** Game minutes played when the attempt started: fights, rests and walks. */
  minute: number;
  maxMana: number;
}
interface Run {
  seed: number;
  variant: Variant;
  fights: Fight[];
  /** Taken at the start of each attempt, plus one after the last. */
  snaps: Snapshot[];
}

const skill = (s: GameState, id: string) => s.skills[id]?.level ?? 0;

function snapshot(s: GameState, attempt: number, wins: number, t: number): Snapshot {
  return {
    attempt,
    wins,
    level: s.level,
    fighting: skill(s, 'fighting'),
    sword: skill(s, 'swordsmanship'),
    str: Math.round(effectiveAttr(s, 'str') * 10) / 10,
    dex: Math.round(effectiveAttr(s, 'dex') * 10) / 10,
    con: Math.round(effectiveAttr(s, 'con') * 10) / 10,
    techniques: knownTechniques(s).map((x) => x.id),
    minute: t / TPS / 60,
    maxMana: getDerivedStats(s).maxMana,
  };
}

function run(seed: number, variant: Variant): Run {
  const g = new Game(createInitialState(seed));
  const s = g.state;
  g.skipTutorial();
  const sword = s.inventory.find((i) => i.defId === 'rusty_sword');
  if (sword && !s.equipment.weapon) g.equip(sword.uid, 'weapon');
  if (variant.martial) s.stats['flag:unlock_martial'] = 1;
  if (variant.ability) {
    installFacet();
    bindFacets(s, true);
    if (!grantFacet(s, variant.ability)) throw new Error(`grant failed: ${variant.ability}`);
  }
  // Start at the floor's landing, which has the camp: the haven a knockout
  // at the spot falls back to.
  s.spot = CAMP;
  if (!s.discovered.includes(CAMP)) s.discovered.push(CAMP);
  noteSafeSpot(s, CAMP);

  const out: Run = { seed, variant, fights: [], snaps: [] };
  const fresh = structuredClone({ attrs: s.attrs, skills: s.skills });
  const freeze = new Set(variant.freeze ?? []);
  const step = () => {
    g.tick();
    if (freeze.has('attrs')) for (const [k, v] of Object.entries(fresh.attrs)) Object.assign(s.attrs[k as keyof typeof s.attrs], v);
    if (freeze.has('skills')) s.skills = structuredClone(fresh.skills);
    if (freeze.has('level')) {
      s.level = 1;
      s.levelXp = 0;
    }
  };
  let t = 0;
  const until = (done: () => boolean, max: number) => {
    for (let i = 0; !done() && i < max; i++, t++) step();
  };
  const walk = (to: string) => {
    if (s.spot === to) return;
    if (!(g.travelTo(to) || g.travelPlanTo(to))) throw new Error(`no road ${s.spot} -> ${to}`);
    until(() => !s.travel && s.travelPlan.length === 0, 10 * 60 * TPS);
    if (s.spot !== to) throw new Error(`walk to ${to} ended at ${s.spot}`);
  };
  let wins = 0;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    out.snaps.push(snapshot(s, attempt, wins, t));
    // Rest at the camp to full, then walk out to the spot.
    g.selectActivity(null);
    walk(CAMP);
    g.selectActivity(SPOTS[CAMP].activities.find((a) => a.kind === 'rest')!.id);
    until(() => !s.recovering && s.resources.hp >= getDerivedStats(s).maxHp * 0.98, 30 * 60 * TPS);
    walk(SPOT);
    g.selectActivity('hunt');
    if (s.activity !== 'hunt') throw new Error(`no hunt at ${SPOT}: activity ${s.activity}`);

    let start = 0;
    let hp0 = 0;
    let max0 = 1;
    let foes: string[] = [];
    let atStart = structuredClone({ attrs: s.attrs, skills: s.skills });
    let attemptWins = 0;
    // Ten game minutes with no fight starting means the hunt stalled.
    for (let idle = 0; idle < 600 * TPS; t++) {
      const before = !!s.combat;
      step();
      const after = !!s.combat;
      if (!before && after) {
        start = t;
        hp0 = s.resources.hp;
        max0 = getDerivedStats(s).maxHp;
        foes = s.combat!.enemies.filter((m) => m !== null).map((m) => `${m!.defId} L${m!.level}`);
        atStart = structuredClone({ attrs: s.attrs, skills: s.skills });
      } else if (before && !after) {
        const won = !s.recovering;
        if (!won && variant.lossXp !== undefined) {
          for (const [k, from] of Object.entries(atStart.attrs))
            keepShare(s.attrs[k as keyof typeof s.attrs], from, variant.lossXp, (l) => bandedXpNeeded(ATTRIBUTE_PROGRESSION, l));
          // A skill discovered mid-fight is left as it is.
          for (const [id, from] of Object.entries(atStart.skills))
            if (s.skills[id]) keepShare(s.skills[id], from, variant.lossXp, (l) => skillXpNeeded(id, l));
        }
        out.fights.push({
          attempt,
          won,
          ticks: t - start,
          hpLost: won ? (hp0 - s.resources.hp) / max0 : hp0 / max0,
          foes,
        });
        if (!won) {
          t++;
          break;
        }
        wins++;
        if (++attemptWins >= CAP) {
          t++;
          break;
        }
      }
      if (s.recovering && !s.combat) {
        t++;
        break; // put down outside a fight
      }
      idle = s.combat ? 0 : idle + 1;
    }
  }
  out.snaps.push(snapshot(s, ATTEMPTS + 1, wins, t));
  if (variant.ability) globalThis.Facet.uninstall();
  return out;
}

// ---------- Report ----------

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f1 = (x: number) => (Number.isNaN(x) ? '—' : x.toFixed(1));
const pct = (x: number) => (Number.isNaN(x) ? '—' : `${Math.round(x * 100)}%`);

/** Attempt windows the table is cut into. */
const WINDOWS: [number, number][] = [
  [1, 1],
  [2, 3],
  [4, 6],
  [7, 10],
  [11, ATTEMPTS],
].filter(([a]) => a <= ATTEMPTS) as [number, number][];

const runs: Run[] = [];
for (const v of VARIANTS.filter((x) => picked.includes(x.id))) for (const seed of seeds) runs.push(run(seed, v));

console.log(`\n${SPOT}: ${SPOTS[SPOT].name}. Fresh character (Skip tutorial, rusty sword equipped), ${seeds.length} seeds, ${ATTEMPTS} attempts, an attempt ends at a knockout or ${CAP} wins.`);
for (const e of SPOTS[SPOT].encounters ?? []) console.log(`  ${e.monsterId} L${e.level?.join('–')} weight ${e.weight}`);
console.log(`  group sizes ${JSON.stringify(SPOTS[SPOT].groupWeights ?? { 1: 100 })}`);

for (const v of VARIANTS.filter((x) => picked.includes(x.id))) {
  const mine = runs.filter((r) => r.variant.id === v.id);
  console.log(`\n== ${v.id} ==  martial ${v.martial ? 'open' : 'shut'}${v.ability ? `, ability ${v.ability}` : ''}${v.freeze ? `, frozen: ${v.freeze.join(', ')}` : ''}${v.lossXp !== undefined ? `, a knockout keeps ${v.lossXp * 100}% of the fight's XP (emulated fix)` : ''}`);
  console.log('attempts  min   win rate  wins/att  kill s   HP lost/win  lvl  fighting  sword  str   dex   con   techniques known (runs of ' + mine.length + ')');
  for (const [a, b] of WINDOWS) {
    const fights = mine.flatMap((r) => r.fights.filter((f) => f.attempt >= a && f.attempt <= b));
    const won = fights.filter((f) => f.won);
    const atts = (b - a + 1) * mine.length;
    const snaps = mine.map((r) => r.snaps.find((x) => x.attempt === a)!);
    const tech = new Map<string, number>();
    for (const sn of snaps) for (const t of sn.techniques) tech.set(t, (tech.get(t) ?? 0) + 1);
    console.log(
      [
        `${a}–${b}`.padEnd(9),
        f1(mean(snaps.map((x) => x.minute))).padStart(4),
        pct(won.length / fights.length).padStart(8),
        f1(won.length / atts).padStart(9),
        f1(mean(won.map((f) => f.ticks / TPS))).padStart(7),
        pct(mean(won.map((f) => f.hpLost))).padStart(12),
        f1(mean(snaps.map((x) => x.level))).padStart(5),
        f1(mean(snaps.map((x) => x.fighting))).padStart(9),
        f1(mean(snaps.map((x) => x.sword))).padStart(6),
        f1(mean(snaps.map((x) => x.str))).padStart(5),
        f1(mean(snaps.map((x) => x.dex))).padStart(5),
        f1(mean(snaps.map((x) => x.con))).padStart(5),
        '  ' + ([...tech].map(([t, n]) => `${t} ${n}`).join(', ') || '—'),
      ].join(' '),
    );
  }
  const end = mine.map((r) => r.snaps[r.snaps.length - 1]);
  console.log(
    `after ${ATTEMPTS}: lvl ${f1(mean(end.map((x) => x.level)))}, fighting ${f1(mean(end.map((x) => x.fighting)))}, sword ${f1(mean(end.map((x) => x.sword)))}, total wins ${f1(mean(end.map((x) => x.wins)))}`,
  );
  // The attempt by which a run first wins more fights than it loses (wins > 1 in one attempt).
  const turn = mine.map((r) => {
    for (let a = 1; a <= ATTEMPTS; a++) if (r.fights.filter((f) => f.attempt === a && f.won).length >= 2) return a;
    return null;
  });
  console.log(`first attempt with 2+ wins, per seed: ${turn.map((x) => x ?? '—').join(' ')}`);
  const at = mine.map((r, i) => (turn[i] ? r.snaps[turn[i]! - 1].minute : null));
  console.log(`  ...game minutes played by then: ${at.map((x) => (x === null ? '—' : x.toFixed(0))).join(' ')}`);
  if (verbose)
    for (const r of mine) {
      console.log(`  seed ${r.seed}`);
      for (let a = 1; a <= ATTEMPTS; a++) {
        const fs = r.fights.filter((f) => f.attempt === a);
        const sn = r.snaps[a - 1];
        console.log(
          `    #${a} ${sn.minute.toFixed(1)}m lvl ${sn.level} fight ${sn.fighting} sword ${sn.sword} mana ${Math.round(sn.maxMana)} | ` +
            fs.map((f) => `${f.won ? 'W' : 'L'} ${Math.round(f.ticks / TPS)}s -${Math.round(f.hpLost * 100)}% [${f.foes.join('+')}]`).join('  '),
        );
      }
    }
}

// ---------- The expected numbers: John at floor 4 ----------
//
// John (tests/john.ts) is the design's player: he climbs band 1 first, so he
// meets floor 4 with band 1's levels. tests/band2.test.ts holds him to floor 6
// inside 45 minutes and 30 band 2 knockouts. His floor 4 fights are the
// curve the band was tuned to.
if (args.includes('--john')) {
  console.log('\n== John through floor 4 (skip = rusty sword in the pack, Neutral; sword = tutorial rack) ==');
  console.log('climb                lvl at f4  f4 fights  win rate  kill s  HP lost/win  f4 KOs  f4 minutes  band 1 min  floor 6 min  band 2 KOs');
  for (const weapon of ['skip', 'sword'] as const)
    for (const seed of [7, 1234]) {
      const r = runJohn({ seed, weapon, through: 6, budget: 3 * 3600 * TPS });
      const t0 = r.done.floor3 ?? 0;
      const t1 = r.done.floor4 ?? Infinity;
      const f4 = r.fights.filter((f) => f.at > t0 && f.at <= t1);
      // A knockout ends the fight at the camp it wakes in, so a fight recorded
      // at a spot with a bed is a loss. The raid leader's win is the clear,
      // not a hunt, and is left out.
      const lostFights = f4.filter((f) => SPOTS[f.spot].activities.some((x) => x.kind === 'rest'));
      const winsOnly = f4.filter((f) => !lostFights.includes(f) && f.spot !== 'f4_ravine_floor');
      const lost = lostFights.length;
      const wins = winsOnly.length;
      console.log(
        [
          `${weapon} / seed ${seed}`.padEnd(20),
          String(r.levels.floor3 ?? '—').padStart(10),
          String(wins + lost).padStart(10),
          pct(wins / (wins + lost)).padStart(9),
          f1(mean(winsOnly.map((f) => f.ticks / TPS))).padStart(7),
          pct(mean(winsOnly.map((f) => (f.hpBefore - f.hpAfter) / f.maxHp))).padStart(12),
          String(lost).padStart(7),
          (r.done.floor4 && r.done.floor3 ? ((r.done.floor4 - r.done.floor3) / TPS / 60).toFixed(1) : '—').padStart(11),
          (r.done.floor3 ? (r.done.floor3 / TPS / 60).toFixed(1) : '—').padStart(11),
          (r.done.floor6 ? (r.done.floor6 / TPS / 60).toFixed(1) : '—').padStart(12),
          String(r.knockouts.floor4 + r.knockouts.gate5 + r.knockouts.floor5 + r.knockouts.gate6 + r.knockouts.floor6).padStart(11),
        ].join(' '),
      );
    }
}
