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
// earned in that fight) without touching game code. `class-*` replace the +1
// to all six per character level with a class growth vector (Barbarian;
// Wizard, with the tutorial Fire; `class-wizard3` with fire:3, ward:3 and
// mend:3 instead); `pts5-con` is 5 free points a level all in CON, the extreme
// reference.
//
//   npx vite-node scripts/woods-edge.ts
//   npx vite-node scripts/woods-edge.ts -- --seeds 1,2,3 --attempts 12 --spot f6_tunnels
//   npx vite-node scripts/woods-edge.ts -- --variants base,martial
//   npx vite-node scripts/woods-edge.ts -- --john        John's floor 4 fights, the expected numbers
//   npx vite-node scripts/woods-edge.ts -- --verbose     every attempt of every run
//   npx vite-node scripts/woods-edge.ts -- --variants base,class-barbarian,base-fire,class-wizard,pts5-con   per-level growth
//   npx vite-node scripts/woods-edge.ts -- --variants none --power             power by level, no fights
//   npx vite-node scripts/woods-edge.ts -- --variants none --duels --seeds 1,2,3,4   levels 5/10/15 vs strong spots
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
import { FLOORS, SPOTS } from '../src/core/registry';
import { noteSafeSpot } from '../src/core/systems/safety';
import { bandedXpNeeded } from '../src/core/systems/progression';
import { skillXpNeeded } from '../src/core/systems/skills';
import { ATTRIBUTE_PROGRESSION } from '../src/core/data/progression.data';
import type { AchievementDef, AttributeId, GameState, Modifier } from '../src/core/types';
import { runJohn } from '../tests/john';
import { ACHIEVEMENTS } from '../src/core/registry';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { LEVEL_ATTR_BONUS } from '../src/core/data/levels.data';
import { expectedHitTaken, roughDps } from '../src/ui/lib/statSummary';
import { incomingSlice, startForcedFight } from '../src/core/systems/combat';
import { MONSTERS } from '../src/core/registry';
import { baseMonsterAttrs } from '../src/core/systems/monsterStats';
import { addSpell } from '../src/core/systems/spellcraft';

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
  /**
   * What each character level adds, replacing +1 to all six: a class growth
   * vector, fractions allowed (emulated, see installGrowth).
   */
  growth?: Partial<Record<AttributeId, number>>;
  /** The tutorial's one-word spell, prepared before the skip (INT 2). */
  spell?: string;
  /** One-word sentences put in the grimoire and prepared, e.g. a mastered `fire:3`. */
  spells?: string[];
}

/** The user's basic three (2026-11-02): Blaze, Sanctum, Renew. Not optimal on purpose. */
const WIZARD_SPELLS = ['fire:3', 'ward:3', 'mend:3'];

/**
 * Per-level growth to compare (user, 2026-11-02): +1 to all six stays until
 * classes exist; a class will set a vector like these. Each sums to about 6.
 * `pts5-con` (5 free points a level, all CON) is the extreme reference.
 */
const GROWTH_VARIANTS: Variant[] = [
  { id: 'class-barbarian', martial: false, growth: { str: 1.3, dex: 1, con: 2, int: 0.3, wis: 0.8, cha: 0.6 } },
  { id: 'class-wizard', martial: false, spell: 'fire', growth: { str: 0.33, dex: 0.33, con: 0.33, int: 3, wis: 1.2, cha: 0.8 } },
  { id: 'class-wizard3', martial: false, spells: WIZARD_SPELLS, growth: { str: 0.33, dex: 0.33, con: 0.33, int: 3, wis: 1.2, cha: 0.8 } },
  { id: 'pts5-con', martial: false, growth: { con: 5 } },
];

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
  { id: 'base-fire', martial: false, spell: 'fire' },
  ...GROWTH_VARIANTS,
];

/**
 * Per-level growth, emulated in process: a sim-only achievement whose every
 * tier is one level's worth. A tier takes LEVEL_ATTR_BONUS back off all six
 * and adds the growth vector. `syncPoints` keeps the claimed tiers at
 * level − 1 every tick; modFingerprint keys on `a<id>:<tiers>`, so the stat
 * cache rebuilds whenever the level moves. No game code changes.
 */
const POINTS_ID = 'sim_level_growth';
function installGrowth(growth: NonNullable<Variant['growth']>): void {
  const bonus: Modifier[] = [
    ...ATTRIBUTE_LIST.map((a): Modifier => ({ stat: a.id, op: 'add', value: -LEVEL_ATTR_BONUS })),
    ...Object.entries(growth).map(([a, v]): Modifier => ({ stat: a as AttributeId, op: 'add', value: v ?? 0 })),
  ];
  (ACHIEVEMENTS as Record<string, AchievementDef>)[POINTS_ID] = {
    id: POINTS_ID,
    name: 'Level growth (sim)',
    icon: '•',
    statKey: 'sim:never',
    descTemplate: '',
    tiers: Array.from({ length: 500 }, () => ({ threshold: Infinity, bonus })),
  };
}
function uninstallPoints(): void {
  delete (ACHIEVEMENTS as Record<string, AchievementDef>)[POINTS_ID];
}
function syncPoints(s: GameState): void {
  if (s.level > 1) s.achievements[POINTS_ID] = s.level - 1;
  else delete s.achievements[POINTS_ID];
}

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
  if (variant.spell && !g.chooseTutorialSpell(variant.spell)) throw new Error(`no spell ${variant.spell}`);
  g.skipTutorial();
  for (const w of variant.spells ?? []) addSpell(s, { school: 'arcane', words: [w] }).prepared = true;
  const sword = s.inventory.find((i) => i.defId === 'rusty_sword');
  if (sword && !s.equipment.weapon) g.equip(sword.uid, 'weapon');
  if (variant.martial) s.stats['flag:unlock_martial'] = 1;
  if (variant.growth) installGrowth(variant.growth);
  else uninstallPoints();
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
    if (variant.growth) syncPoints(s);
    g.tick();
    if (variant.growth) syncPoints(s);
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
  console.log(`knockouts per run over ${ATTEMPTS} attempts: ${f1(mean(mine.map((r) => r.fights.filter((f) => !f.won).length)))}`);
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

// ---------- Static power by level: class growth against +1 to all six ----------
//
// `--power`: a fresh character (trained attributes 1, rusty sword; INT 2 and
// the prepared Fire where the row says so) set straight to a level, no fights.
// - melee = rough weapon DPS × effective HP, where effective HP = max HP /
//   expected damage from a 20-damage physical blow (the sidebar's Offense
//   and Defense, src/ui/lib/statSummary.ts).
// - burst = max mana × spell power; sustained = mana regen × spell power.
// - P = the mean of the three highest attributes, what band 2's dynamic
//   levels read (branch dynamic-levels, levels.ts dynamicLevelBonus), and the
//   levels that would add to a L8 goblin and a L8 rat at factor 0.5, cap 8.
if (args.includes('--power')) {
  const rows: Variant[] = [{ id: 'today', martial: false }, { id: 'today-fire', martial: false, spell: 'fire' }, ...GROWTH_VARIANTS];
  /** The dynamic-levels formula, inlined: this branch does not carry it. */
  const bonusVs = (p: number, monsterId: string, level: number) => {
    const def = MONSTERS[monsterId];
    const book = baseMonsterAttrs(def, level);
    const top = ATTRIBUTE_LIST.map((a) => a.id)
      .sort((a, b) => book[b] - book[a])
      .slice(0, 3);
    const m = top.reduce((n, id) => n + book[id], 0) / 3;
    const g = top.reduce((n, id) => n + (def.growth[id] ?? 0), 0) / 3;
    return Math.min(8, Math.max(0, Math.floor((0.5 * (p - m)) / g)));
  };
  const statsAt = (v: Variant, level: number) => {
    const g = new Game(createInitialState(1));
    const s = g.state;
    if (v.spell) g.chooseTutorialSpell(v.spell);
    g.skipTutorial();
    const blade = s.inventory.find((i) => i.defId === 'rusty_sword');
    if (blade) g.equip(blade.uid, 'weapon');
    if (v.growth) installGrowth(v.growth);
    else uninstallPoints();
    s.level = level;
    if (v.growth) syncPoints(s);
    const st = getDerivedStats(s);
    const landed = (['slashing', 'piercing', 'bludgeoning'] as const).reduce((n, t) => n + incomingSlice(st, t, '', 20).dealt, 0) / 3;
    const ehp = st.maxHp / Math.max(0.01, expectedHitTaken(st));
    const attrs = ATTRIBUTE_LIST.map((a) => effectiveAttr(s, a.id));
    const top = [...attrs].sort((a, b) => b - a).slice(0, 3);
    const p = (top[0] + top[1] + top[2]) / 3;
    return {
      attrs,
      dps: roughDps(st),
      ehp,
      landed,
      melee: roughDps(st) * ehp,
      burst: st.maxMana * st.spellPower,
      sustained: st.manaRegen * st.spellPower,
      p,
      goblin: bonusVs(p, 'goblin', 8),
      rat: bonusVs(p, 'forest_rat', 8),
    };
  };
  for (const level of [5, 10, 15]) {
    const today = statsAt(rows[0], level);
    const todayFire = statsAt(rows[1], level);
    console.log(`\n== Level ${level}, fresh trained attributes. × columns: against 'today' (melee) and 'today-fire' (spells) ==`);
    console.log('variant          STR   DEX   CON   INT   WIS   CHA   DPS ×   EHP ×   melee ×  burst ×  sustain ×  20-blow lands  P     +lv gob L8  +lv rat L8');
    for (const v of rows) {
      const r = statsAt(v, level);
      console.log(
        [
          v.id.padEnd(15),
          ...r.attrs.map((x) => f1(x).padStart(5)),
          f1(r.dps / today.dps).padStart(6),
          f1(r.ehp / today.ehp).padStart(7),
          f1(r.melee / today.melee).padStart(9),
          f1(r.burst / todayFire.burst).padStart(8),
          f1(r.sustained / todayFire.sustained).padStart(10),
          f1(r.landed).padStart(14),
          f1(r.p).padStart(5),
          String(r.goblin).padStart(10),
          String(r.rat).padStart(11),
        ].join(' '),
      );
    }
  }
  // Where each growth stops taking damage from a 20-damage blow.
  for (const v of [rows[0], ...GROWTH_VARIANTS.filter((x) => x.id !== 'class-wizard')]) {
    let at: number | null = null;
    for (let level = 1; level <= 200 && at === null; level++) if (statsAt(v, level).landed <= 1) at = level;
    console.log(`20-damage blow lands for 1 or less: ${v.id} at level ${at ?? '>200'}`);
  }
  uninstallPoints();
}

// ---------- Duels: a fixed level against the strong spots ----------
//
// `--duels`: a fresh character (trained attributes 1, rusty sword) set straight
// to level 5, 10 and 15 with each row's growth and spells, then N fights per
// spot and seed, each from full HP and mana, growth held. The rows differ only
// in per-level growth and the grimoire, so this reads what a class vector
// plus three basic spells buys against monsters well above level 1. A cast is
// counted as a drop of 5 mana or more in one tick.
if (args.includes('--duels')) {
  const rows: Variant[] = [
    { id: 'today', martial: false },
    { id: 'today+3 spells', martial: false, spells: WIZARD_SPELLS },
    GROWTH_VARIANTS.find((v) => v.id === 'class-barbarian')!,
    GROWTH_VARIANTS.find((v) => v.id === 'class-wizard3')!,
  ];
  const spots = opt('--duel-spots', 'f4_woods_edge,f4_deep_woods,f5_hollows,f6_tunnels,f6_drop,f6_great_hall').split(',');
  const levels = opt('--duel-levels', '5,10,15').split(',').map(Number);
  const FIGHTS = Number(opt('--fights', '15'));
  const character = (v: Variant, seed: number, level: number) => {
    const g = new Game(createInitialState(seed));
    const s = g.state;
    g.skipTutorial();
    for (const w of v.spells ?? []) addSpell(s, { school: 'arcane', words: [w] }).prepared = true;
    const blade = s.inventory.find((i) => i.defId === 'rusty_sword');
    if (blade) g.equip(blade.uid, 'weapon');
    if (v.growth) installGrowth(v.growth);
    else uninstallPoints();
    s.level = level;
    if (v.growth) syncPoints(s);
    return g;
  };
  const full = (s: GameState) => {
    const st = getDerivedStats(s);
    s.statuses = [];
    s.resources.hp = st.maxHp;
    s.resources.stamina = st.maxStamina;
    s.resources.mana = st.maxMana;
  };
  type Duel = { won: boolean; ticks: number; hpLost: number; casts: number };
  /** `n` fights at a hunt spot, or `n` walk-ins at a forced (boss) spot. */
  const duels = (v: Variant, seed: number, level: number, spotId: string, n: number): Duel[] => {
    const g = character(v, seed, level);
    const s = g.state;
    const held = structuredClone({ attrs: s.attrs, skills: s.skills });
    const hold = () => {
      for (const [k, x] of Object.entries(held.attrs)) Object.assign(s.attrs[k as AttributeId], x);
      s.skills = structuredClone(held.skills);
      s.level = level;
      s.levelXp = 0;
      if (v.growth) syncPoints(s);
    };
    const forced = !!SPOTS[spotId].forced;
    const out: Duel[] = [];
    let start = 0;
    let hp0 = 0;
    let max0 = 1;
    let casts = 0;
    let mana = 0;
    for (let t = 0, idle = 0; out.length < n && idle < 600 * TPS; t++) {
      if (!s.combat) {
        if (forced || s.spot !== spotId || s.activity !== 'hunt' || s.recovering) {
          s.recovering = false;
          s.travel = null;
          s.travelPlan = [];
          s.spot = spotId;
          s.respawnTimer = 0;
          full(s);
          if (forced) {
            // A fresh walk-in: the boss row is `once`, so its kill is wiped.
            for (const k of Object.keys(s.stats)) if (k.startsWith(`slain:${spotId}:`) || k === `fights:${spotId}`) delete s.stats[k];
            startForcedFight(s, g.bus, SPOTS[spotId]);
          } else g.selectActivity('hunt');
        }
      }
      const before = !!s.combat;
      if (before && s.resources.mana < mana - 5) casts++;
      mana = s.resources.mana;
      g.tick();
      hold();
      if (!before && s.combat) {
        start = t;
        hp0 = s.resources.hp;
        max0 = getDerivedStats(s).maxHp;
        casts = 0;
        mana = s.resources.mana;
      } else if (before && !s.combat) {
        const won = !s.recovering;
        out.push({ won, ticks: t - start, hpLost: won ? (hp0 - s.resources.hp) / max0 : hp0 / max0, casts });
        if (won && !forced) {
          full(s);
          s.respawnTimer = 0;
        }
      }
      idle = s.combat ? 0 : idle + 1;
    }
    return out;
  };
  for (const level of levels) {
    console.log(`\n== Duels at level ${level}: ${seeds.length} seeds × ${FIGHTS} fights per cell, full HP and mana each fight ==`);
    console.log('cells: win rate / kill s / HP lost per win / casts per fight');
    console.log('row              ' + spots.map((x) => x.padEnd(26)).join(''));
    for (const v of rows) {
      const cells = spots.map((spotId) => {
        const fights = seeds.flatMap((seed) => duels(v, seed, level, spotId, FIGHTS));
        const won = fights.filter((f) => f.won);
        return `${pct(won.length / fights.length)} / ${f1(mean(won.map((f) => f.ticks / TPS)))} / ${pct(mean(won.map((f) => f.hpLost)))} / ${f1(mean(fights.map((f) => f.casts)))}`.padEnd(26);
      });
      console.log(`${v.id.padEnd(16)} ${cells.join('')}`);
    }
  }
  uninstallPoints();
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
