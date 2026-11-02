// Band 2 against the player band 1 makes. John (tests/john.ts) climbs floors
// 0-3, and the save he ends with meets every band 2 hunt and boss. Growth is
// held at the entry values every tick and HP is full at the start of every
// fight, so each row reads "this den, for the player who just cleared floor 3".
// `--offsets` adds levels to every encounter of the measured spot (in this
// process only, the data files are untouched): the dial a retune would turn.
//
//   npx vite-node scripts/band2-entry.ts
//   npx vite-node scripts/band2-entry.ts -- --seeds 7,42 --weapons sword --fights 30 --offsets 0,3,6

import { Game } from '../src/core/game';
import { TPS } from '../src/core/engine/loop';
import { getDerivedStats } from '../src/core/systems/derived';
import { effectiveAttr } from '../src/core/systems/attributes';
import { knownTechniques } from '../src/core/systems/martial';
import { startForcedFight } from '../src/core/systems/combat';
import { BANDS, FLOORS, SKILLS, SPOTS } from '../src/core/registry';
import type { GameState, TutorialWeapon } from '../src/core/types';
import { runJohn, type ClimbReport } from '../tests/john';

const args = process.argv.slice(2);
const opt = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const seeds = opt('--seeds', '7,42,1234').split(',').map(Number);
const weapons = opt('--weapons', 'skip,sword').split(',') as (TutorialWeapon | 'skip')[];
const FIGHTS = Number(opt('--fights', '15'));
const offsets = opt('--offsets', '0,2,4,6').split(',').map(Number);
/** Group-size weights for 1, 2 and 3 foes, laid over every measured hunt: the other dial. */
const groups = args.includes('--groups') ? opt('--groups', '').split(',').map(Number) : null;
/** Measure only these hunts (comma list) and skip the bosses; default every band 2 hunt. */
const only = args.includes('--spots') ? opt('--spots', '').split(',') : null;
// `--dyn factor,cap` replaces band 2's dynamic levels in this process (towers.data.ts holds the real ones).
if (args.includes('--dyn')) {
  const [factor, cap] = opt('--dyn', '').split(',').map(Number);
  BANDS.ascent_middle.dynamicLevel = cap > 0 ? { factor, cap } : undefined;
}

const BAND2 = ['ascent_f4', 'ascent_f5', 'ascent_f6'];
const BOSSES = ['f4_ravine_floor', 'f5_back_door', 'f6_great_hall'];
const HUNTS = Object.values(SPOTS)
  .filter((s) => BAND2.some((f) => FLOORS[f].areaId === s.areaId) && s.encounters?.length && !BOSSES.includes(s.id))
  .map((s) => s.id)
  .filter((id) => !only || only.includes(id));

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f1 = (x: number) => (Number.isNaN(x) ? '—' : x.toFixed(1));
const pct = (x: number) => (Number.isNaN(x) ? '—' : `${Math.round(x * 100)}%`);

interface Fight {
  won: boolean;
  ticks: number;
  hpLost: number;
}

/** A game on a copy of `entry`, its RNG moved to `salt` so copies differ. */
function fork(entry: GameState, salt: number): Game {
  const s = structuredClone(entry);
  s.rngState = (entry.rngState ^ Math.imul(salt + 1, 0x9e3779b1)) | 0;
  return new Game(s);
}

/** Hold attributes, skills and character level at the values `s` has now. */
function freezer(s: GameState): () => void {
  const held = structuredClone({ attrs: s.attrs, skills: s.skills, level: s.level, levelXp: s.levelXp });
  return () => {
    for (const [k, v] of Object.entries(held.attrs)) Object.assign(s.attrs[k as keyof typeof s.attrs], v);
    s.skills = structuredClone(held.skills);
    s.level = held.level;
    s.levelXp = held.levelXp;
  };
}

function full(s: GameState) {
  const st = getDerivedStats(s);
  s.statuses = [];
  s.resources.hp = st.maxHp;
  s.resources.stamina = st.maxStamina;
  s.resources.mana = st.maxMana;
}

/** Shift every encounter of `spotId` by `k` levels for the duration of `fn`. */
function withOffset<T>(spotId: string, k: number, fn: () => T): T {
  const enc = SPOTS[spotId].encounters!;
  const saved = enc.map((e) => e.level);
  const savedGroups = SPOTS[spotId].groupWeights;
  if (groups && !BOSSES.includes(spotId)) SPOTS[spotId].groupWeights = { 1: groups[0], 2: groups[1], 3: groups[2] ?? 0 };
  enc.forEach((e) => {
    if (e.level) e.level = [e.level[0] + k, e.level[1] + k];
  });
  try {
    return fn();
  } finally {
    enc.forEach((e, i) => (e.level = saved[i]));
    SPOTS[spotId].groupWeights = savedGroups;
  }
}

/** `n` hunt fights at `spotId`, each from full HP, growth frozen. */
function hunt(entry: GameState, spotId: string, n: number, salt: number): Fight[] {
  const g = fork(entry, salt);
  const s = g.state;
  const hold = freezer(s);
  const out: Fight[] = [];
  let start = 0;
  let hp0 = 0;
  let max0 = 1;
  for (let t = 0, idle = 0; out.length < n && idle < 600 * TPS; t++) {
    if (!s.combat && (s.spot !== spotId || s.activity !== 'hunt' || s.recovering)) {
      s.combat = null;
      s.recovering = false;
      s.travel = null;
      s.travelPlan = [];
      s.spot = spotId;
      s.respawnTimer = 0;
      full(s);
      g.selectActivity('hunt');
    }
    const before = !!s.combat;
    g.tick();
    hold();
    if (!before && s.combat) {
      start = t;
      hp0 = s.resources.hp;
      max0 = getDerivedStats(s).maxHp;
    } else if (before && !s.combat) {
      const won = !s.recovering;
      out.push({ won, ticks: t - start, hpLost: won ? (hp0 - s.resources.hp) / max0 : hp0 / max0 });
      if (won) {
        full(s);
        s.respawnTimer = 0;
      }
    }
    idle = s.combat ? 0 : idle + 1;
  }
  return out;
}

/** One walk into a boss room from full HP, growth frozen. */
function boss(entry: GameState, spotId: string, salt: number): Fight {
  const g = fork(entry, salt);
  const s = g.state;
  const hold = freezer(s);
  s.spot = spotId;
  s.activity = null;
  full(s);
  startForcedFight(s, g.bus, SPOTS[spotId]);
  if (!s.combat) throw new Error(`no fight at ${spotId}`);
  const hp0 = s.resources.hp;
  const max0 = getDerivedStats(s).maxHp;
  let t = 0;
  for (; s.combat && t < 30 * 60 * TPS; t++) {
    g.tick();
    hold();
  }
  const won = !s.recovering && !s.combat;
  return { won, ticks: t, hpLost: won ? (hp0 - s.resources.hp) / max0 : hp0 / max0 };
}

// ---------- Band 1, as John plays it ----------

const climbs: ClimbReport[] = [];
for (const seed of seeds) for (const weapon of weapons) climbs.push(runJohn({ seed, weapon }));
const done = climbs.filter((r) => r.done.floor3 !== null);

console.log(`\nBand 1 exit: John (skip = bare hands, rusty sword left in the pack; sword = tutorial rack), seeds ${seeds.join(',')}`);
console.log('climb               band 1 min  fights  KOs  lvl  STR   DEX   CON   max HP  fighting  weapon skill  techniques');
for (const r of climbs) {
  const s = r.state;
  const label = `${r.opts.weapon === 'skip' ? 'john' : r.opts.weapon} / ${r.opts.seed}`;
  if (r.done.floor3 === null) {
    console.log(`${label.padEnd(19)} never cleared floor 3`);
    continue;
  }
  const fights = r.fights.filter((f) => f.at <= r.done.floor3!).length;
  const kos = r.knockouts.tutorial + r.knockouts.vermin + r.knockouts.floor1 + r.knockouts.floor2 + r.knockouts.gate3 + r.knockouts.descent + r.knockouts.floor3;
  const weaponSkill = Object.entries(s.skills)
    .filter(([id]) => SKILLS[id]?.parent === 'fighting')
    .map(([id, v]) => `${id} ${v.level}`)
    .join(', ');
  console.log(
    [
      label.padEnd(19),
      f1(r.done.floor3 / TPS / 60).padStart(10),
      String(fights).padStart(7),
      String(kos).padStart(4),
      String(s.level).padStart(4),
      f1(effectiveAttr(s, 'str')).padStart(5),
      f1(effectiveAttr(s, 'dex')).padStart(5),
      f1(effectiveAttr(s, 'con')).padStart(5),
      String(Math.round(getDerivedStats(s).maxHp)).padStart(7),
      String(s.skills.fighting?.level ?? 0).padStart(9),
      `  ${weaponSkill || '—'}`.padEnd(15),
      '  ' + (knownTechniques(s).map((t) => t.id).join(', ') || '—'),
    ].join(' '),
  );
}

// Band 1's own dens as John played them (growth on): the feel band 1 sets.
const DENS: Record<string, { spots: (id: string) => boolean; kos: (r: ClimbReport) => number }> = {
  'floor 1 storerooms': { spots: (id) => id === 'f1_storerooms', kos: (r) => r.knockouts.vermin },
  'floor 2 long hall': { spots: (id) => id.startsWith('f2_hall_'), kos: (r) => r.knockouts.floor2 },
  'floor 3 landings': { spots: (id) => id.startsWith('f3_landing_'), kos: (r) => r.knockouts.descent },
};
console.log('\nBand 1 dens as played (growth on), all climbs:');
console.log('den                   win rate  kill s  HP lost/win');
for (const [name, d] of Object.entries(DENS)) {
  const wins = done.flatMap((r) => r.fights.filter((f) => d.spots(f.spot)));
  const kos = done.reduce((n, r) => n + d.kos(r), 0);
  console.log(
    [
      name.padEnd(21),
      pct(wins.length / (wins.length + kos)).padStart(8),
      f1(mean(wins.map((f) => f.ticks / TPS))).padStart(7),
      pct(mean(wins.map((f) => (f.hpBefore - f.hpAfter) / f.maxHp))).padStart(12),
    ].join(' '),
  );
}

// ---------- Band 2 against that save ----------

console.log(`\nBand 2 against the band 1 exit save: ${done.length} saves × ${FIGHTS} fights per cell, each fight from full HP, growth frozen.`);
console.log(`cells: win rate / kill s / HP lost per win. Offset = levels added to the spot's encounters.`);
if (groups) console.log(`Group weights forced to ${groups.join('/')} for 1/2/3 foes on every measured hunt.`);
console.log('spot                  levels    groups    ' +offsets.map((k) => `+${k}`.padEnd(20)).join(''));
for (const spotId of HUNTS) {
  const levels = [...new Set(SPOTS[spotId].encounters!.map((e) => e.level?.join('–')))].join(',');
  const cells = offsets.map((k) =>
    withOffset(spotId, k, () => {
      const fights = done.flatMap((r, i) => hunt(r.state, spotId, FIGHTS, i * 1000 + k));
      const won = fights.filter((f) => f.won);
      return `${pct(won.length / fights.length)} / ${f1(mean(won.map((f) => f.ticks / TPS)))} / ${pct(mean(won.map((f) => f.hpLost)))}`.padEnd(20);
    }),
  );
  const gw = groups ? { 1: groups[0], 2: groups[1], 3: groups[2] ?? 0 } : (SPOTS[spotId].groupWeights ?? { 1: 100 });
  console.log(`${spotId.padEnd(21)} ${levels.padEnd(9)} ${[gw[1] ?? 0, gw[2] ?? 0, gw[3] ?? 0].join('/').padEnd(9)} ${cells.join('')}`);
}

if (only) process.exit(0);

console.log('\nBosses, five walk-ins per save (sabotage 0 at the warchief). Cells add L = mean length of a lost fight, s:');
for (const spotId of BOSSES) {
  const levels = SPOTS[spotId].encounters!.map((e) => e.level?.join('–')).join(',');
  const cells = offsets.map((k) =>
    withOffset(spotId, k, () => {
      const fights = done.flatMap((r) => Array.from({ length: 5 }, (_, i) => boss(r.state, spotId, i * 7919 + k)));
      const won = fights.filter((f) => f.won);
      const lost = fights.filter((f) => !f.won);
      return `${pct(won.length / fights.length)} / ${f1(mean(won.map((f) => f.ticks / TPS)))} / ${pct(mean(won.map((f) => f.hpLost)))} / L${f1(mean(lost.map((f) => f.ticks / TPS)))}`.padEnd(26);
    }),
  );
  console.log(`${spotId.padEnd(21)} ${levels.slice(0, 9).padEnd(9)} ${cells.join('')}`);
}
