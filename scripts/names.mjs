// Rolls two-word ability names from scripts/names.txt: one twist, one medium,
// always from different registers. The deck never ships; a person picks.
//
//   npm run names                 twenty names
//   npm run names -- 50           fifty
//   npm run names -- --seed 7     the same batch again
//   npm run names -- --twist economy,time --medium creature
//   npm run names -- --sep ": "   Twist: Medium
//   npm run names -- --list       registers and word counts

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function parseDeck(text) {
  const deck = { twist: [], medium: [] };
  let side = null;
  let register = null;
  let hot = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let m;
    if ((m = /^\[(twist|medium)\]$/.exec(line))) {
      side = m[1];
      register = null;
      continue;
    }
    if ((m = /^\(([a-z-]+)\)(\s+hot)?$/.exec(line))) {
      register = m[1];
      hot = Boolean(m[2]);
      continue;
    }
    if (!side || !register) throw new Error(`names.txt: "${line}" appears before a [side] and (register) header`);
    deck[side].push({ word: line, register, hot });
  }
  return deck;
}

function parseArgs(argv) {
  const opts = { count: 20, seed: null, twist: null, medium: null, sep: ' ', list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed') opts.seed = Number(argv[++i]);
    else if (a === '--twist') opts.twist = argv[++i].split(',');
    else if (a === '--medium') opts.medium = argv[++i].split(',');
    else if (a === '--sep') opts.sep = argv[++i];
    else if (a === '--list') opts.list = true;
    else if (/^\d+$/.test(a)) opts.count = Number(a);
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

// mulberry32 when seeded, so a batch can be rolled again.
function rng(seed) {
  if (seed === null || Number.isNaN(seed)) return Math.random;
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cap(word) {
  return word.replace(/(^|\s)(\S)/g, (_, s, c) => s + c.toUpperCase());
}

function registersOf(list) {
  const out = new Map();
  for (const w of list) out.set(w.register, (out.get(w.register) ?? 0) + 1);
  return out;
}

function restrict(list, names, side) {
  if (!names) return list;
  const known = registersOf(list);
  for (const n of names) {
    if (!known.has(n)) {
      console.error(`no ${side} register "${n}" (have: ${[...known.keys()].join(', ')})`);
      process.exit(2);
    }
  }
  return list.filter((w) => names.includes(w.register));
}

// Without replacement on both sides: each word appears at most once per batch.
function roll(twists, mediums, count, random) {
  const out = [];
  const pending = shuffle(mediums, random);
  for (const t of shuffle(twists, random)) {
    if (out.length >= count) break;
    const i = pending.findIndex((m) => m.register !== t.register && !(m.hot && t.hot));
    if (i < 0) continue;
    const [m] = pending.splice(i, 1);
    out.push({ t, m });
  }
  return out;
}

const opts = parseArgs(process.argv.slice(2));
const deck = parseDeck(readFileSync(join(here, 'names.txt'), 'utf8'));

if (opts.list) {
  for (const side of ['twist', 'medium']) {
    console.log(`[${side}] ${deck[side].length} words`);
    for (const [r, n] of registersOf(deck[side])) {
      const hot = deck[side].find((w) => w.register === r).hot ? ' hot' : '';
      console.log(`  (${r})${hot} ${n}`);
    }
  }
  process.exit(0);
}

const twists = restrict(deck.twist, opts.twist, 'twist');
const mediums = restrict(deck.medium, opts.medium, 'medium');
const names = roll(twists, mediums, opts.count, rng(opts.seed));
const width = Math.max(...names.map(({ t, m }) => (cap(t.word) + opts.sep + cap(m.word)).length)) + 2;
for (const { t, m } of names) {
  console.log((cap(t.word) + opts.sep + cap(m.word)).padEnd(width) + `${t.register} / ${m.register}`);
}
if (names.length < opts.count) console.error(`(deck ran out after ${names.length})`);
