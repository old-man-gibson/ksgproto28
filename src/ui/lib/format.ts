import type {
  ActivityFactor,
  DamageReport,
  DamageStep,
  ExertionSpec,
  Modifier,
  MutagenArm,
  MutagenDef,
  SpellSpec,
  SpellTarget,
  StatusApplication,
  TechniqueDef,
  UnlockCondition,
} from '../../core/types';
import type {
  AttributeId,
  Big,
  GameState,
  MonsterInstance,
  RuneEffect,
  StatKey,
  StatusInstance,
  StatusRemoval,
} from '../../core/types';
import { DAMAGE_TYPE_NAMES, RES_STAT_BY_TYPE, STAT_NAMES } from '../../core/types';
import { RESOURCES } from '../../core/data/resources.data';
import { TPS } from '../../core/engine/loop';
import { ATTRIBUTE_LIST } from '../../core/data/attributes.data';
import { BASE_SPEED, getDerivedStats, statBreakdown } from '../../core/systems/derived';
import { monsterStats } from '../../core/systems/monsterStats';
import { escalationPrimed } from '../../core/systems/statuses';
import {
  attrBreakdown,
  attrName,
  attrValue,
  type BreakdownLine,
} from '../../core/systems/attributes';
import { ITEMS, MONSTER_TAGS, QUESTS, SKILLS, STATUSES, STYLES } from '../../core/registry';
import { resolveModValue } from '../../core/systems/derived';
import { resolveRune } from '../../core/systems/runes';
import { resolvedMove } from '../../core/systems/martial';
import type { GeneSpec } from '../../core/systems/mutagens';
import {
  atGrade,
  chromosomeOf,
  expressedMain,
  geneAbility,
  grantIsLive,
  priceGeneAbility,
  pricesABlow,
} from '../../core/systems/mutagens';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/**
 * The one seam every number passes through on its way to the screen — and so
 * the one place that has to learn about `Big` if the game ever outgrows doubles.
 *
 * Past the named tiers (1e36) it switches to scientific notation rather than
 * padding a suffix it does not have. Without that, 1e24 reads "1000000Qi" and
 * anything near the top of the double range renders as a 300-digit string.
 */
export function fmt(n: Big): string {
  if (!isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs < 1000) {
    if (n % 1 === 0) return Math.round(n).toString();
    // Sub-1 bonuses (a +0.03 craft-speed milestone) must not read as "0.0".
    if (abs < 1) return parseFloat(n.toFixed(3)).toString();
    return abs < 10 ? n.toFixed(1) : Math.round(n).toString();
  }
  const tier = Math.floor(Math.log10(abs) / 3);
  if (tier >= SUFFIXES.length) return n.toExponential(2).replace('e+', 'e');
  const scaled = n / Math.pow(10, tier * 3);
  return scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2) + SUFFIXES[tier];
}

export function pct(p: number, digits = 1): string {
  return (p * 100).toFixed(digits).replace(/\.0+$/, '') + '%';
}

/**
 * Resource pool readout. Capacities are whole numbers, so a full pool reads
 * cleanly as "50 / 50"; a partial one keeps 2 decimals of precision so slow
 * regen is still visible.
 */
export function poolText(current: number, max: number): string {
  const cur = Math.max(0, current);
  return cur >= max ? `${max} / ${max}` : `${cur.toFixed(2)} / ${max}`;
}

/**
 * One line saying what a technique's move DOES, with practice-honed numbers
 * (resolvedMove) — shared by the combat card tooltip and the skill tree row.
 */
export function techniqueMoveText(state: GameState, def: TechniqueDef): string {
  const move = resolvedMove(state, def);
  const parts: string[] = [];
  if (move.damageMult !== undefined) {
    const hits = move.hits && move.hits > 1 ? `${move.hits} × ` : '';
    parts.push(`${hits}${Math.round(move.damageMult * 100)}% weapon damage`);
  }
  // A counter states its bargain first — it is the only kind that answers
  // during the enemy's swing, so "what it takes off the blow" is the headline.
  if (move.counter) {
    parts.unshift(`🛡️ takes ${pct(move.counter.reduce)} off the blow it answers`);
  }
  if (move.preventedMult) {
    const stopped = move.counter ? 'of what it blocked' : 'of the force it turned aside';
    const type = move.damageType ? ` as ${DAMAGE_TYPE_NAMES[move.damageType].toLowerCase()}` : '';
    parts.push(`+${Math.round(move.preventedMult * 100)}% ${stopped}${type}`);
  }
  if (move.penetration) parts.push(`+${pct(move.penetration)} penetration`);
  if (move.splash) parts.push(`${pct(move.splash)} splash`);
  for (const app of move.inflicts ?? []) {
    const status = STATUSES[app.id];
    parts.push(`${pct(app.chance ?? 1, 0)} to inflict ${status?.name ?? app.id}`);
  }
  if (move.buff) {
    // ⌛ is duration everywhere; ⟳ is "how often". Two different questions,
    // so they never share a glyph.
    parts.push(
      `${move.buff.mods.map((m) => describeMod(m)).join(', ')} ⌛ ${ticksToTime(move.buff.duration)}`,
    );
  }
  if (move.staminaCost) parts.push(`${pct(move.staminaCost)} stamina`);
  if (move.momentum) parts.push(`+${pct(move.momentum)} momentum`);
  parts.push(`⟳ ${ticksToTime(move.cooldown)}`);
  return parts.join(' · ');
}

export function ticksToTime(ticks: number): string {
  const s = ticks / 10;
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

export function msToTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Human-readable unlock condition, e.g. "Fighting 10" or "sword equipped". */
export function condText(cond: UnlockCondition): string {
  switch (cond.type) {
    case 'skill':
      return `${SKILLS[cond.id]?.name ?? cond.id} ${cond.level}`;
    case 'attr':
      return `${ATTRIBUTE_LIST.find((a) => a.id === cond.attr)?.name ?? cond.attr} ${cond.level}`;
    case 'equippedTag':
      return `${cond.tag} equipped`;
    case 'stat':
      return `${cond.key} ≥ ${cond.value}`;
    case 'statMax':
      return `${cond.key} ≤ ${cond.value}`;
    case 'quest':
      return `quest "${QUESTS[cond.id]?.name ?? cond.id}" completed`;
  }
}

export function condsText(conds: UnlockCondition[] | undefined): string {
  return (conds ?? []).map(condText).join(', ');
}

const PERCENT_STATS = new Set<string>([
  'dodge',
  'crit',
  'penetration',
  'splash',
  'parry',
  'riposte',
  // Every resistance is a share of a blow, not a count of anything — derived
  // from the damage-type table so a new element can never fall out of this
  // list again (resWater/Wind/Earth/Light/Dark once did, and read "+0.05").
  ...Object.values(RES_STAT_BY_TYPE),
]);

/**
 * Stats that are SWITCHES rather than magnitudes: any value above zero arms a
 * rule and the number itself means nothing to a reader. A troll's regeneration
 * weakness printed as "+1 Regeneration Doused by Heat/Acid", which is true, is
 * the whole of what that gene costs you, and tells nobody anything.
 */
const SWITCH_STATS: Record<string, string> = {};

const statName = (key: string): string =>
  (STAT_NAMES as Record<string, string>)[key] ??
  ATTRIBUTE_LIST.find((a) => a.id === key)?.name ??
  key;

/** Human-readable modifier, e.g. "+10% Damage", "+3 Armor", or "+2 Strength". */
export function describeMod(mod: Modifier, level = 0): string {
  const value = resolveModValue(mod, level);
  const flag = SWITCH_STATS[mod.stat];
  if (flag) return value > 0 ? flag : `${flag} — off`;
  const name = statName(mod.stat);
  const sign = value >= 0 ? '+' : '−';
  const abs = Math.abs(value);
  // A hunter bonus reads as a flat buff unless its quarry is named.
  const vs = mod.requiresMonsterTag
    ? ` vs ${MONSTER_TAGS[mod.requiresMonsterTag]?.name ?? mod.requiresMonsterTag}`
    : '';
  // `fromStat` IS the meaning of the number: the value is multiplied by whatever
  // that stat finally reads (derived.ts layer 3), so the bare figure is not a
  // bonus at all — it is a conversion rate, and printing it as a bonus made a
  // troll's "+50% Damage" and its "+15% Damage" read as the same kind of thing
  // when one is a share of your bludgeoning resistance and the other wants a
  // bone weapon in your hands.
  const from = mod.fromStat ? ` × ${statName(mod.fromStat)}` : '';
  if (mod.op === 'mult' || PERCENT_STATS.has(mod.stat)) return `${sign}${pct(abs)} ${name}${from}${vs}`;
  return `${sign}${fmt(abs)} ${name}${from}${vs}`;
}

/**
 * What a `fromStat` modifier comes to RIGHT NOW — the number the character
 * actually feels, as opposed to the conversion rate the definition carries.
 * Null for an ordinary modifier, which already states its own value.
 */
export function modEffective(state: GameState, mod: Modifier): string | null {
  if (!mod.fromStat) return null;
  const source = getDerivedStats(state)[mod.fromStat];
  if (!Number.isFinite(source)) return null;
  return describeMod({ ...mod, value: mod.value * source, fromStat: undefined });
}

/**
 * A capability in words, and whether any system asks about it.
 *
 * `onehand:*` and `arms:+N` are read by systems/wield.ts. The mutagen family is
 * authored, routed and displayed and consumed by nobody (docs/MUTAGENS.md
 * §12.2) — `grantIsLive` owns that fact, so this never has to guess.
 */
const GRANT_WORDS: Record<string, string> = {
  ignores_dodge: 'the ability cannot be dodged',
  splits_target: 'the ability carries into every flanker',
};

/**
 * `arm` matters: the mutagen capabilities are read only where they landed
 * (Active), so the same chip is a real trick in one card and a dead letter in
 * the next. Pass the arm whenever you know it; omit it to ask the weaker
 * question "does anything, anywhere, read this?".
 */
export function describeGrant(
  grant: string,
  arm?: MutagenArm,
  spec?: GeneSpec | null,
): { text: string; live: boolean } {
  if (grant === 'onehand:*') return { text: '🤏 any two-hander in one hand', live: true };
  if (grant.startsWith('onehand:')) {
    return { text: `🤏 two-handed ${grant.slice(8)} in one hand`, live: true };
  }
  if (grant.startsWith('arms:+')) {
    const n = grant.slice(6);
    return { text: `🤚 ${n} extra arm${n === '1' ? '' : 's'}`, live: true };
  }
  if (grant.startsWith('telekinetic:')) {
    const n = grant.slice(12);
    return {
      text:
        `🌀 ${n} grip${n === '1' ? '' : 's'} held by the mind — those weapons fight on their own,` +
        ` and Wisdom is how hard the mind holds`,
      live: true,
    };
  }
  const live = grantIsLive(grant, arm, spec);
  // Conditions are open-ended — one per element, and more whenever a status is
  // written — so they are read off the status rather than listed by hand.
  if (grant.startsWith('inflicts_')) {
    const id = grant.slice('inflicts_'.length);
    const status = STATUSES[id];
    if (status) {
      return { text: `${status.icon} the ability leaves ${status.name}`, live };
    }
  }
  return { text: `✦ ${GRANT_WORDS[grant] ?? grant.replace(/_/g, ' ')}`, live };
}

// ---------- What a spell does ----------
// Shared by the grimoire, the combat card's tooltip and the config window, so
// a spell can never describe itself differently in two places.

const TARGET_LABEL: Record<SpellTarget, string> = {
  one: '👤 one foe',
  others: '👥 every foe',
  self: '🙋 yourself',
};

/**
 * Where the working actually lands. A spell that neither strikes nor pours
 * healing into somebody else touches only its speaker, whatever address the
 * sentence carried — "water mend" tends your own wounds even though its
 * default address reads as an enemy.
 */
export function targetLabel(spec: SpellSpec): string {
  // Anything aimed at somebody else makes this an outward working — including
  // a spell that only lays conditions on them and never strikes.
  const outward =
    spec.strikes.length > 0 || spec.healsEnemy === true || (spec.afflicts?.length ?? 0) > 0;
  return TARGET_LABEL[outward ? spec.target : 'self'];
}

/**
 * What being granted a condition actually DOES — read off the StatusDef, so
 * a blessing's card can never disagree with the blessing itself.
 */
/**
 * What a condition DOES at a given intensity, as short phrases.
 *
 * Intensity is the dial every condition scales off (see systems/statuses.ts),
 * so a card that reports only "×3.9" has told the player a multiplier and
 * nothing else. This states the actual rate — the same arithmetic the
 * affliction's own tooltip uses, so a previewed condition and a held one can
 * never disagree about what it is doing.
 *
 * `self` flips the perspective for the handful of effects that read
 * differently depending on who is wearing them.
 */
export function conditionEffects(id: string, intensity = 1, self = false): string[] {
  const def = STATUSES[id];
  if (!def) return [];
  const bits: string[] = [];

  // The rate, first: it is what "how bad is this" actually means.
  const dot = def.dot;
  if (dot) {
    const parts: string[] = [];
    if (dot.flat) parts.push(fmt(dot.flat * intensity * TPS));
    if (dot.currentHp) parts.push(`${pct(dot.currentHp * intensity * TPS, 2)} of current HP`);
    if (dot.maxHp) parts.push(`${pct(dot.maxHp * intensity * TPS, 2)} of max HP`);
    if (parts.length) parts.push(`${DAMAGE_TYPE_NAMES[dot.type]} per second`);
    if (parts.length) bits.push(parts.join(' + '));
  }
  for (const r of def.restores ?? []) {
    const per: string[] = [];
    if (r.flat) per.push(fmt(r.flat * intensity * TPS));
    if (r.ofMax) per.push(`${pct(r.ofMax * intensity * TPS, 2)} of max`);
    bits.push(`${per.join(' + ')} ${RESOURCES[r.resource]?.name ?? r.resource} per second`);
  }

  if (def.pacifiesFlankers) bits.push('enemies beyond the front cannot act');
  if (def.incomingMissChance) {
    bits.push(
      `${Math.round(def.incomingMissChance * intensity * 100)}% of blows against ${self ? 'you' : 'them'} miss (after dodge)`,
    );
  }
  if (def.missChance) {
    bits.push(`${Math.round(def.missChance * intensity * 100)}% of ${self ? 'your' : 'their'} attacks go wide`);
  }
  if (def.invertsDots?.length) {
    bits.push(
      `${def.invertsDots.map((i) => STATUSES[i]?.name ?? i).join('/')} heals ${self ? 'you' : 'them'} instead of harming`,
    );
  }
  for (const b of def.blocks ?? []) bits.push(`cannot ${b === 'spell' ? 'cast' : 'attack'}`);
  // Mods are stated per unit of intensity and scaled when they are read
  // (see systems/statuses.ts statusMods), so the card must scale them too —
  // a psionic haste granted at intensity 10 is +30% speed, not the +3% the
  // definition carries.
  for (const m of def.mods ?? []) bits.push(describeMod({ ...m, value: m.value * intensity }));
  return bits;
}

/**
 * What a purely-flat condition will deal over its whole life, when that life
 * is known. Only flat dots can be totalled honestly — anything priced off the
 * target's health depends on a target we do not have while previewing.
 */
function conditionTotal(id: string, intensity: number, ticks: number | null): string | null {
  const dot = STATUSES[id]?.dot;
  if (!dot || !ticks || !dot.flat || dot.currentHp || dot.maxHp) return null;
  return fmt(dot.flat * intensity * ticks);
}

export function grantLine(app: StatusApplication): string {
  const def = STATUSES[app.id];
  if (!def) return app.id;
  const strength = app.intensity ?? 1;
  const bits = conditionEffects(app.id, strength, true);
  // The application may set its own lifetime (psionic coherence buys duration).
  const held = app.duration ?? def.duration;
  const time = typeof held === 'number' && held ? ` ⌛ ${Math.round(held / TPS)}s` : '';
  return `${def.icon} ${def.name}${time}${bits.length ? ` — ${bits.join(', ')}` : ''}`;
}

const statusNames = (ids: string[]) => ids.map((i) => STATUSES[i]?.name ?? i).join('/');

/**
 * A gene's description, split back into the arms it was written for.
 *
 * The descs are authored as "Special: … Active: … Attacks: … Defenses: …" —
 * already one sentence per arm — so showing the whole blob under the gene's
 * name both buried it and repeated whatever the ability block said again. Each
 * segment goes to its own arm card instead; `rest` is whatever came before any
 * label, for the genes written as plain prose ("As the slime, further along").
 */
export function geneArmNotes(desc: string | undefined): {
  rest: string;
  arms: Partial<Record<'special' | 'active' | 'attacks' | 'defenses', string>>;
} {
  const arms: Partial<Record<'special' | 'active' | 'attacks' | 'defenses', string>> = {};
  if (!desc) return { rest: '', arms };
  const parts = desc.split(/\b(Special|Active|Attacks|Defenses):\s*/);
  // split() with one capture group yields [before, label, body, label, body…].
  const rest = parts[0].trim();
  for (let i = 1; i < parts.length - 1; i += 2) {
    const key = parts[i].toLowerCase() as keyof typeof arms;
    arms[key] = parts[i + 1].trim().replace(/\s+/g, ' ');
  }
  return { rest, arms };
}

/**
 * What a secondary mutagen does, one line per thing — DERIVED from the def
 * rather than written beside it, so a description can never drift from the
 * data it describes. `MutagenDef` carries no prose at all, which is why the
 * picker showed nine names and no meaning.
 *
 * Two halves, and the distinction is the system: what it contributes when it
 * ARRIVES (its own effect) versus what it does to everything ROUTED THROUGH it
 * (its transform). The second is what makes placement a puzzle.
 *
 * ⚠️ Parts of this are wired to nothing yet — grants are read by no system and
 * an arriving damage type is discarded (docs/MUTAGENS.md §12). Those lines are
 * marked rather than hidden: silence would be worse, and a confident claim
 * would be a lie.
 */
export function mutagenLines(def: MutagenDef): string[] {
  const out: string[] = [];
  const PENDING = ' — not wired yet';
  // A fused mutagen carries a rekey and NOTHING else — its parent's effect and
  // transform were spent in the fusing. So it gets its own line, or the picker
  // would show a thing that appears to do nothing at all.
  if (def.rekey) {
    const element = DAMAGE_TYPE_NAMES[def.rekey.to].toLowerCase();
    if (def.rekey.kind === 'vulnerability') {
      out.push(`Rewrites a weakness of this body to ${element} — the same size, pointed elsewhere`);
      out.push('Nearest to the centromere rewrites the first; a body with no weakness is untouched');
    } else {
      out.push(`Rewrites ${def.rekey.kind} to ${element}${PENDING}`);
    }
    return out;
  }
  const grant = (g: string) => {
    const { text, live } = describeGrant(g);
    return `${text}${live ? '' : PENDING}`;
  };
  for (const mod of def.effect?.mods ?? []) out.push(describeMod(mod));
  for (const g of def.effect?.grants ?? []) out.push(grant(g));
  if (def.effect?.type) out.push(`Carries ${DAMAGE_TYPE_NAMES[def.effect.type].toLowerCase()}${PENDING}`);
  const t = def.transform;
  if (t?.mult !== undefined) {
    out.push(`Routed through it: ×${t.mult.toFixed(2)} to what passes`);
  }
  if (t?.retype) {
    out.push(`Routed through it: rewritten as ${DAMAGE_TYPE_NAMES[t.retype].toLowerCase()}${PENDING}`);
  }
  for (const g of t?.grants ?? []) {
    out.push(`Routed through it: picks up ${grant(g).replace(/^✦ /, '')}`);
  }
  if (out.length === 0) out.push('Nothing yet — a placeholder.');
  return out;
}

/**
 * What the body's own tool actually does, one line per thing.
 *
 * Lives here rather than in a panel because two of them ask — the rotation card
 * and the skills list — and because the headline is unusual enough to be worth
 * saying once: a gene ability reads a STAT, and which stat it reads is the
 * whole of what makes it different from every other active in the game.
 */
/**
 * What the body's tool lands for RIGHT NOW, or null when it has no headline
 * damage. Resolved, not the coefficient: the stat it reads comes off the live
 * pipeline, so anything the chromosome routed into that stat moves this number
 * — which is the only way routing is visible on the ability at all. (What
 * routing still cannot touch is the spec itself: docs/MUTAGENS.md §12.)
 *
 * Its own function because the combat card wants the figure without the
 * sentence around it, and two places computing one number is how they start
 * disagreeing.
 */
export function geneAbilityLanded(state: GameState): number | null {
  const ability = geneAbility(state);
  if (!ability || ability.spec.type !== 'gene') return null;
  const spec = ability.spec;
  // A price with no terms in it is not a blow worth nothing, it is an ability
  // that does not work that way — and "0" is the one thing the card must not
  // say about it. `pricesABlow` is the engine's own answer, so the readout and
  // the fight cannot disagree about whether there is a number here at all.
  if (!pricesABlow(spec)) return null;
  const stats = getDerivedStats(state);
  const priced = priceGeneAbility(state, spec, stats, ability.name).damage;
  // A wind-up lands CERTAIN — `landIncantation` multiplies by crit damage every
  // time — so quoting the unmultiplied figure understates it by the whole of
  // your crit build, which is exactly the build the ability asks you to make.
  return spec.incant ? priced * Math.max(1, stats.critDamage) : priced;
}

export function geneAbilityLines(state: GameState): string[] {
  const ability = geneAbility(state);
  if (!ability) return [];
  const spec = ability.spec;
  const out: string[] = [];
  if (spec.type === 'buff') {
    out.push(spec.mods.map((m) => describeMod(m)).join(' · '));
    out.push(`Holds for ${ticksToTime(spec.duration)}`);
    return out;
  }
  if (spec.type !== 'gene') return out;
  const stats = getDerivedStats(state);
  const grade = expressedMain(chromosomeOf(state));
  const landed = geneAbilityLanded(state);
  // The whole of `(flat + power × fromStat) × speed × (1 + amplifiedBy)`, said
  // in the order it is worked out — and only the terms this ability actually
  // uses, so a giant's line never mentions a multiplier it does not have.
  const base: string[] = [];
  if (spec.flat) base.push(`${fmt(spec.flat)} base`);
  if (spec.power !== undefined) {
    const rate = spec.power === 1 ? '' : `${pct(spec.power)} of `;
    // Priced off a stat or off an ATTRIBUTE — `priceGeneAbility` reads either,
    // and a breakdown that knows about only one prints a total its own terms do
    // not add up to.
    if (spec.fromStat !== undefined) {
      base.push(`${rate}your ${STAT_NAMES[spec.fromStat]} (${fmt(stats[spec.fromStat])})`);
    } else if (spec.fromAttr !== undefined) {
      base.push(
        `${rate}your ${attrName(spec.fromAttr)} (${fmt(attrValue(state, spec.fromAttr))})`,
      );
    }
  }
  const mults: string[] = [];
  if (spec.scalesWithSpeed) {
    mults.push(`×${(stats.speed / BASE_SPEED).toFixed(2)} for Speed (${fmt(stats.speed)})`);
  }
  if (spec.amplifiedBy) {
    const held = stats[spec.amplifiedBy];
    mults.push(
      `×${Math.max(0, 1 + held).toFixed(2)} for ${STAT_NAMES[spec.amplifiedBy]} (${pct(held)})`,
    );
  }
  if (spec.incant) {
    mults.push(`×${Math.max(1, stats.critDamage).toFixed(2)} for a crit it cannot miss`);
  }
  // The headline, only when there IS one. An ability that lands no blow of its
  // own says what it does instead, below.
  // …and a blow deliberately priced at nothing says so in words. "0 arcane
  // damage" is true of Kritavya and useless: it reads as a broken number rather
  // than as the point, which is the ward underneath it.
  const doesElse = !!spec.grants?.length || !!spec.inflicts?.length || !!spec.clearsField;
  if (landed !== null && Math.round(landed) === 0 && doesElse) {
    out.push('Lands for nothing on its own — what it does, it does by what it leaves');
  } else if (landed !== null) {
    const type = DAMAGE_TYPE_NAMES[spec.damageType ?? 'bludgeoning'].toLowerCase();
    out.push(
      `${fmt(landed)} ${type} damage${spec.incant ? ' when it lands' : ''}` +
        (base.length ? ` — ${base.join(' + ')}` : '') +
        (mults.length ? `, ${mults.join(', ')}` : ''),
    );
  }
  /*
   * WHAT IT DOES INSTEAD OF, OR AS WELL AS, LANDING.
   *
   * These four shapes are the reason the headline above became conditional: a
   * volley never lands, a wind-up lands later, an erasure is worth whatever it
   * erased, and a ward is the whole point of the blow it rides on. Each one used
   * to be described by nothing at all.
   */
  if (spec.volley) {
    const hits = Math.max(1, Math.round(atGrade(spec.volley.hits, grade)));
    out.push(
      `Turns every floating grip at once — ${hits} strikes over ${ticksToTime(spec.volley.ticks)}`,
    );
    out.push('Lands no blow of its own: each strike is an ordinary swing of whatever that grip holds.');
  }
  if (spec.incant) {
    const ticks = Math.max(1, Math.round(atGrade(spec.incant.ticks, grade)));
    out.push(
      `Begins rather than lands — the blow falls ${ticksToTime(ticks)} later, and your bar fills` +
        ` at ${pct(spec.incant.fillMult)} of its rate until it does`,
    );
  }
  if (spec.clearsField) {
    out.push('Tears every condition out of the air — yours as readily as theirs');
    out.push('Worth as much again for each one it unsaid');
  }
  for (const app of spec.grants ?? []) {
    const held = spec.grantDuration
      ? ` for ${ticksToTime(Math.max(1, Math.round(atGrade(spec.grantDuration, grade))))}`
      : '';
    out.push(`Puts ${STATUSES[app.id]?.name ?? app.id} on you${held}`);
  }
  if (spec.sure) out.push('Cannot be dodged');
  if (spec.riders?.length) {
    out.push(
      `Carries ${spec.riders
        .map((r) => `${fmt(r.value)} ${DAMAGE_TYPE_NAMES[r.type].toLowerCase()}`)
        .join(' and ')}`,
    );
  }
  // `splashAll` is a capability and `splash` is a share; a spec that declares
  // only the first was advertising "every enemy, for 0% of the blow".
  if (spec.splashAll && spec.splash) {
    out.push(`Reaches every enemy for ${pct(spec.splash)} of the blow`);
  } else if (spec.splashAll) out.push('Carries into every flanker standing');
  else if (spec.splash) out.push(`${pct(spec.splash)} carries into a flanker`);
  if (spec.sizeDouble) {
    out.push(`Doubles for every ${spec.sizeDouble} sizes the target is beneath you`);
  }
  if (spec.execute) {
    out.push(`Finishes anything left standing under ${pct(spec.execute)} of what landed`);
  }
  if (spec.stun) out.push(`Costs the target ${spec.stun} ticks of its action bar`);
  if (spec.selfDelay) out.push(`Costs you ${spec.selfDelay} ticks of your own`);
  if (spec.inflicts?.length) out.push(`Leaves ${statusNames(spec.inflicts.map((a) => a.id))}`);
  return out;
}

/** A spell's mechanics, one line per thing it does. */
export function specLines(spec: SpellSpec): string[] {
  const lines: string[] = [];
  for (const s of spec.strikes) {
    let line = s.untyped
      ? `${s.power.toFixed(2)}× spell power, untyped — ignores resistance and weakness alike`
      : `${s.power.toFixed(2)}× spell power ${DAMAGE_TYPE_NAMES[s.type]}`;
    // A twin-natured strike explains its own opportunism.
    if (s.orType && !s.untyped) line += ` or ${DAMAGE_TYPE_NAMES[s.orType]} — whichever they resist less`;
    if ((s.hits ?? 1) > 1) line += ` ×${s.hits}`;
    // Penetration has nothing to pierce when the strike is untyped.
    if (s.penetration && !s.untyped) line += `, ${Math.round(s.penetration * 100)}% penetration`;
    if (s.critBonus) {
      line += ` · ${s.critBonus > 0 ? '+' : '−'}${Math.abs(Math.round(s.critBonus * 100))}% crit chance`;
    }
    if (s.critDamageBonus) {
      line += ` · ${s.critDamageBonus > 0 ? '+' : '−'}${Math.abs(Math.round(s.critDamageBonus * 100))}% crit damage`;
    }
    if (s.followUp) line += ` · ×${s.followUp} if the strike before it landed`;
    if (s.altGroup !== undefined) line += ` · an "or" alternative — one is rolled per cast`;
    if (s.onlyIf) {
      line += s.onlyIf.length
        ? ` · only while the target is ${s.onlyIf.map((i) => STATUSES[i]?.name ?? i).join('/')}`
        : ` · conditioned on nothing — it never fires`;
    }
    // Identical applications group — "fourfold glacier" reads as one line
    // with a count, not four copies of the same chill.
    const grouped = new Map<string, { a: StatusApplication; n: number }>();
    for (const a of s.inflicts ?? []) {
      const key = `${a.id}|${a.intensity ?? 1}|${a.chance ?? 1}|${a.duration ?? ''}`;
      const g = grouped.get(key);
      if (g) g.n += 1;
      else grouped.set(key, { a, n: 1 });
    }
    const inflicts = [...grouped.values()]
      .map(({ a, n }) => {
        const name = STATUSES[a.id]?.name ?? a.id;
        const intensity = a.intensity ?? 1;
        const strength = intensity !== 1 ? ` ×${intensity.toFixed(1)}` : '';
        const times = n > 1 ? `, applied ${n} times` : '';
        // The clock matters as much as the bite — slowly and quickly move it.
        const base = a.duration === 'permanent' ? null : (a.duration ?? STATUSES[a.id]?.duration);
        const clock = base ? ` ⌛ ${Math.round(base / TPS)}s` : ' until removed';
        /*
         * …and the RATE matters as much as the clock. "×3.9 for 8s" states a
         * multiplier and a lifetime while saying nothing about what the
         * affliction is actually doing, which is the whole point of intensely
         * and dimly. Where the whole life can be totalled honestly (a flat
         * dot, a known lifetime) say that too, because that is what makes
         * concentrating visibly different from merely deepening.
         */
        const effects = conditionEffects(a.id, intensity);
        const total = conditionTotal(a.id, intensity, base ?? null);
        const does = effects.length
          ? ` — ${effects.join(', ')}${total ? ` ≈ ${total} in all` : ''}`
          : '';
        return `${Math.round((a.chance ?? 1) * 100)}% ${name}${strength}${clock}${times}${does}`;
      })
      .join('; ');
    if (inflicts) line += ` · ${inflicts}`;
    lines.push(line);
  }
  if (spec.splash) lines.push(`Spills ${Math.round(spec.splash * 100)}% into a flanker`);
  if (spec.heal && spec.healsEnemy) {
    lines.push(
      `Forces ${spec.heal.toFixed(2)}× spell power of life into the target — all of it swells them, and any wound it closes is the price`,
    );
  } else if (spec.heal) {
    lines.push(`Restores ${spec.heal.toFixed(2)}× spell power health`);
  }
  if (spec.buff) {
    lines.push(
      `Wears ${spec.buff.name} ⌛ ${Math.round(spec.buff.duration / TPS)}s — ${spec.buff.mods.map((m) => describeMod(m)).join(', ')}`,
    );
  }
  for (const app of spec.grants ?? []) lines.push(`Grants ${grantLine(app)}`);
  // Laid on the target by the working itself, with or without a blow.
  for (const app of spec.afflicts ?? []) lines.push(`Afflicts ${grantLine(app)}`);
  if (spec.transfers) {
    lines.push(
      `Strips your own ${statusNames(spec.transfers.statuses)} and inflicts it on the target ×${spec.transfers.mult}`,
    );
  }
  if (spec.amplify) {
    lines.push(
      `${statusNames(spec.amplify.statuses)} already on the target is intensified ×${spec.amplify.mult} and refreshed`,
    );
  }
  if (spec.empowered) {
    lines.push(
      `×${spec.empowered.mult} while anyone in the fight is afflicted by ${statusNames(spec.empowered.statuses)}`,
    );
  }
  if (spec.sure) lines.push('Cannot be dodged');
  if (!lines.length) lines.push('Does nothing at all');
  return lines;
}

/**
 * When a modifier applies, as a trailing note: the weapon it needs in hand, or
 * the art it only pays off while you are actually fighting in. '' when it
 * always applies.
 */
export function modCondition(mod: Modifier): string {
  if (mod.requiresStyle) {
    return ` (while fighting ${STYLES[mod.requiresStyle]?.name ?? mod.requiresStyle})`;
  }
  return mod.requiresTag ? ` (while ${mod.requiresTag})` : '';
}

/**
 * A style's stamina bargain, as tooltip lines: what each exchange costs, and
 * what the spend buys. Payoffs shown are the full-price values — a partial
 * payment (a nearly empty bar) buys a proportional share.
 */
export function exertionLines(spec: ExertionSpec | undefined, level = 0): string[] {
  if (!spec) return ['Costs no stamina — and buys none of its bonuses'];
  const per = spec.on === 'attack' ? 'per attack' : 'per incoming attack';
  const lines = [
    spec.drain
      ? `🫁 Spends your whole stamina bar ${per} — straight into exhaustion`
      : `🫁 Spends ${pct(spec.cost)} of max stamina ${per}`,
  ];
  if (spec.note) lines.push(spec.note);
  if (spec.mods?.length) {
    lines.push(`While you have stamina to burn: ${spec.mods.map((m) => describeMod(m, level)).join(', ')}`);
  }
  const hit = spec.hit;
  if (hit?.damage) lines.push(`+${pct(hit.damage)} damage on the blow`);
  if (hit?.penetration) lines.push(`+${pct(hit.penetration)} penetration on the blow`);
  if (hit?.splash) lines.push(`+${pct(hit.splash)} of the blow onto a random flanker`);
  if (hit?.extraHits) lines.push(`+${fmt(hit.extraHits)} simultaneous hit(s)`);
  if (hit?.dodge) lines.push(`+${pct(hit.dodge)} dodge against that attack`);
  if (hit?.armor) lines.push(`+${pct(hit.armor)} armor against that attack`);
  if (hit?.parry) lines.push(`+${pct(hit.parry)} parry against that attack`);
  if (spec.ramp) {
    lines.push(
      `Builds +${pct(spec.ramp.per)} ${STAT_NAMES[spec.ramp.stat]} per blow, up to +${pct(spec.ramp.cap)} (resets each fight)`,
    );
  }
  return lines;
}

/**
 * Aggregate a pile of modifiers into one readable line, e.g. "+3 Strength, +2%
 * Strength". Same stat+op are combined the way the pipeline combines them:
 * flats sum, multipliers compound. Returns '' for an empty list.
 */
export function sumMods(mods: Modifier[]): string {
  const groups = new Map<string, Modifier>();
  for (const mod of mods) {
    const key = `${mod.stat}|${mod.op}`;
    const seen = groups.get(key);
    if (!seen) groups.set(key, { ...mod, perLevel: undefined });
    else if (mod.op === 'mult') seen.value = (1 + seen.value) * (1 + mod.value) - 1;
    else seen.value += mod.value;
  }
  return [...groups.values()].map((m) => describeMod(m)).join(', ');
}

// ---------- Stat & attribute tooltips ----------

/** Format a value of the given stat for tooltip display. */
function statVal(key: StatKey, value: number): string {
  if (PERCENT_STATS.has(key)) return pct(value);
  // Keep fractions visible so a floored total (e.g. base 11.50 → 11) doesn't
  // look like it shrank; only large numbers fall back to compact notation.
  return value % 1 !== 0 && Math.abs(value) < 1000 ? value.toFixed(2) : fmt(value);
}

function bonusLine(l: BreakdownLine, format: (v: number) => string): string {
  const v = l.op === 'mult' ? pct(Math.abs(l.value)) : format(Math.abs(l.value));
  return `${l.value >= 0 ? '+' : '−'}${v} — ${l.source}`;
}

/** Tooltip lines for a derived stat: base formula, each bonus source, total. */
export function statTipLines(state: GameState, key: StatKey): string[] {
  const bd = statBreakdown(state, key);
  const lines = [`Base ${statVal(key, bd.base)}  (${bd.baseText})`];
  for (const l of bd.lines) lines.push(bonusLine(l, (v) => statVal(key, v)));
  lines.push(`Total ${statVal(key, bd.total)}${bd.capped ? ' — CAPPED' : ''}`);
  // Typed on-hit extras (enchants, weapon runes) ride along with Damage.
  if (key === 'damage') {
    const weapon = state.equipment.weapon;
    const wdef = weapon ? ITEMS[weapon.defId] : undefined;
    if (wdef?.bonusDamage) {
      lines.push(
        `on hit: +${fmt(wdef.bonusDamage.value)} ${DAMAGE_TYPE_NAMES[wdef.bonusDamage.type]} — ${wdef.name}`,
      );
    }
    for (const ref of weapon?.runes ?? []) {
      const rune = resolveRune(ref);
      const eff = rune.effects.weapon;
      if (eff?.bonusDamage) {
        lines.push(
          `on hit: +${fmt(eff.bonusDamage.value)} ${DAMAGE_TYPE_NAMES[eff.bonusDamage.type]} — ${rune.name}`,
        );
      }
      if (eff?.bonusDamagePct) {
        lines.push(
          `on hit: +${pct(eff.bonusDamagePct.value)} as ${DAMAGE_TYPE_NAMES[eff.bonusDamagePct.type]} — ${rune.name}`,
        );
      }
    }
  }
  return lines;
}

/** Tooltip lines for an attribute: trained base, each bonus source, effective, fusion. */
export function attrTipLines(state: GameState, attr: AttributeId): string[] {
  const bd = attrBreakdown(state, attr);
  const name = ATTRIBUTE_LIST.find((a) => a.id === attr)?.name ?? attr;
  const lines = [`Trained ${bd.trained}  (base level from XP)`];
  for (const l of bd.lines) lines.push(bonusLine(l, fmt));
  lines.push(`Effective ${name}: ${fmt(bd.effective)}`);
  if (bd.fusion) {
    const partner = ATTRIBUTE_LIST.find((a) => a.id === bd.fusion!.partner)?.name ?? bd.fusion.partner;
    lines.push(
      `⚛ ${bd.fusion.name}: + effective ${partner} (${fmt(bd.fusion.partnerValue)}) → reads as ${fmt(bd.fusion.total)}`,
    );
  }
  return lines;
}

// ---------- Damage tooltips ----------

/** A tooltip row: `kind` picks the class the panel renders it with. */
export interface DamageTipLine {
  kind: 'base' | 'line' | 'note' | 'sub' | 'total';
  text: string;
}

/** One assembly step: "Damage 34", "×1.5 Heavy Strike", or a bare note. */
function stepText(step: DamageStep): string {
  if (step.mult !== undefined) return `×${+step.mult.toFixed(2)} ${step.label}`;
  if (step.value !== undefined) return `${step.label} ${fmt(step.value)}`;
  return step.label;
}

/**
 * The whole story behind one fight-feed number: how the blow was built, what
 * types it arrived as, what each defence took out of it, and what landed.
 * Rows that would read as zero are left out — a plain unresisted hit stays
 * short.
 */
export function damageTipLines(report: DamageReport): DamageTipLine[] {
  const out: DamageTipLine[] = [
    { kind: 'base', text: `${report.label} → ${report.target}` },
    { kind: 'sub', text: report.hits > 1 ? `Swing (×${report.hits} hits):` : 'Swing:' },
  ];
  for (const s of report.steps) out.push({ kind: 'line', text: stepText(s) });

  out.push({ kind: 'sub', text: report.slices.length > 1 ? 'Damage types:' : 'Damage type:' });
  for (const s of report.slices) {
    out.push({
      kind: 'line',
      text: `${DAMAGE_TYPE_NAMES[s.type]} — ${s.source}: ${fmt(s.raw)} → ${fmt(s.dealt)}`,
    });
    if (s.armor > 0.005) out.push({ kind: 'note', text: `🛡 armor absorbed ${fmt(s.armor)}` });
    if (s.resisted > 0.005) {
      out.push({ kind: 'note', text: `⛨ ${pct(s.resistance)} resistance shed ${fmt(s.resisted)}` });
    } else if (s.resisted < -0.005) {
      out.push({
        kind: 'note',
        text: `⚠ vulnerable to it — ${fmt(-s.resisted)} extra (${pct(-s.resistance)})`,
      });
    }
    if (s.pierced > 0.0001) {
      out.push({
        kind: 'note',
        text: `⟂ penetration erased ${pct(s.pierced)} of its ${DAMAGE_TYPE_NAMES[s.type]} resistance`,
      });
    }
    if ((s.warded ?? 0) > 0.005) {
      out.push({ kind: 'note', text: `✷ a ward ate the last ${fmt(s.warded!)}` });
    }
  }

  const raw = report.slices.reduce((sum, s) => sum + s.raw, 0);
  const blocked = report.slices.reduce(
    (sum, s) => sum + s.armor + Math.max(0, s.resisted) + (s.warded ?? 0),
    0,
  );
  const extra = report.slices.reduce((sum, s) => sum + Math.max(0, -s.resisted), 0);
  // Only worth totalling when more than one defence (or more than one type) had
  // a say — otherwise it just repeats the single line above it.
  const layered = report.slices.length > 1 || report.slices.some((s) => s.armor > 0.005 && s.resisted > 0.005);
  if (blocked > 0.005 && layered) {
    out.push({ kind: 'line', text: `Stopped ${fmt(blocked)} of ${fmt(raw)} (${pct(blocked / raw)})` });
  }
  if (extra > 0.005) out.push({ kind: 'line', text: `Vulnerability added ${fmt(extra)}` });
  // Armor and resistance can eat a blow whole — it still lands for 1. Incoming
  // blows carry that floor in the slice; your own carry it on the total.
  const landed = report.slices.reduce((sum, s) => sum + s.dealt, 0);
  const swallowed = report.slices.some((s) => Math.round(s.raw - s.armor - s.resisted) < s.dealt);
  if (swallowed || Math.round(landed) < report.total) {
    out.push({ kind: 'note', text: '⤓ every blow lands for at least 1' });
  }
  out.push({
    kind: 'total',
    text: `${fmt(report.total)} damage ${report.incoming ? 'taken' : 'dealt'}`,
  });
  return out;
}

/**
 * An activity's attribute XP split, e.g. "Charisma ×0.5, Strength ×0.25". A
 * weight of exactly 1 is the plain case and drops the multiplier. '' when
 * nothing is trained.
 */
export function attrSplitText(weights: Partial<Record<AttributeId, number>>): string {
  return Object.entries(weights)
    .filter(([, w]) => w)
    .map(([id, w]) => {
      const name = ATTRIBUTE_LIST.find((a) => a.id === id)?.name ?? id;
      return w === 1 ? name : `${name} ×${w}`;
    })
    .join(', ');
}

/** Display name for one activity factor source (skills not yet built are flagged "planned"). */
export function factorLabel(f: ActivityFactor): string {
  if (f.attr) return ATTRIBUTE_LIST.find((a) => a.id === f.attr)?.name ?? f.attr;
  if (f.stat) return STAT_NAMES[f.stat];
  if (f.skill) return SKILLS[f.skill]?.name ?? `${f.skill} (planned)`;
  return '?';
}

/** Human-readable rune effect for one context, e.g. "+4 Damage" or "+12% damage as Lightning". */
export function describeRuneEffect(effect: RuneEffect | undefined): string {
  if (!effect) return 'inert';
  const parts = (effect.mods ?? []).map((m) => describeMod(m));
  if (effect.bonusDamage) {
    parts.push(`+${fmt(effect.bonusDamage.value)} ${DAMAGE_TYPE_NAMES[effect.bonusDamage.type]} damage`);
  }
  if (effect.bonusDamagePct) {
    parts.push(`+${pct(effect.bonusDamagePct.value)} damage as ${DAMAGE_TYPE_NAMES[effect.bonusDamagePct.type]}`);
  }
  return parts.length ? parts.join(', ') : 'inert';
}

/**
 * Everything worth saying about one affliction: what it is doing, how much
 * longer, and how it ends. The first line is the header; lines opening with an
 * em dash are sub-notes.
 */
export function statusTipLines(
  bearer: GameState | MonsterInstance,
  held: StatusInstance,
): string[] {
  const def = STATUSES[held.id];
  if (!def) return [held.id];
  const lines: string[] = [`${def.icon} ${def.name}`];
  lines.push(def.desc);

  const dot = def.dot;
  if (dot) {
    const parts: string[] = [];
    if (dot.flat) parts.push(fmt(dot.flat * held.intensity * TPS));
    if (dot.currentHp) parts.push(`${pct(dot.currentHp * held.intensity * TPS, 2)} of current HP`);
    if (dot.maxHp) parts.push(`${pct(dot.maxHp * held.intensity * TPS, 2)} of max HP`);
    lines.push(`— ${parts.join(' + ')} ${DAMAGE_TYPE_NAMES[dot.type]} per second`);
  }

  for (const mod of def.mods ?? []) {
    lines.push(`— ${describeMod({ ...mod, value: mod.value * held.intensity })}`);
  }
  for (const c of def.ceilings ?? []) {
    const sealed = Math.min(c.max ?? 1, c.per * held.intensity);
    lines.push(`— ${pct(sealed)} of your ${RESOURCES[c.resource]?.name ?? c.resource} is closed off`);
  }
  if (def.damp) {
    const dulled = Math.min(def.damp.max ?? 1, def.damp.per * held.intensity);
    lines.push(`— ${def.damp.slot ?? 'Equipment'} bonuses reduced ${pct(dulled)}`);
  }
  if (def.healCap !== undefined) {
    const dealt = held.data?.dealt ?? 0;
    const left = Math.max(0, dealt * def.healCap - (held.data?.healed ?? 0));
    lines.push(`— Healing may undo only ${pct(def.healCap, 0)} of its damage (${fmt(left)} left)`);
  }
  const debt = held.data?.debt ?? 0;
  if (debt > 0) {
    lines.push(`— ${pct(debt)} of the pool eaten so far`);
  }

  /*
   * A surplus condition IS its ledger — the swelling's whole substance is
   * how much unwanted life has been forced in, so showing only the stat
   * penalties tells you nothing about how close it is to turning. Report the
   * ledger, what it is worth against the body carrying it, and how far the
   * next rung of the ladder still is.
   */
  if (def.surplus) {
    const surplus = held.data?.surplus ?? 0;
    const maxHp = bearerMaxHp(bearer);
    lines.push(
      `— ${fmt(surplus)} forced in so far${maxHp ? ` (${pct(surplus / maxHp)} of its body)` : ''}`,
    );
    const rung = (at: number | undefined, what: string) => {
      if (at === undefined || !maxHp) return;
      const need = maxHp * at;
      const left = Math.max(0, need - surplus);
      lines.push(`— ${what} at ${fmt(need)}${left > 0 ? ` — ${fmt(left)} to go` : ' — any moment now'}`);
    };
    rung(def.surplus.escalateAt, 'Takes on a will of its own');
    rung(def.surplus.detonateAt, 'Bursts');
    if (def.surplus.decayShare) {
      // Per-tick share, read as the second the player actually watches.
      lines.push(`— Subsides ${pct(1 - Math.pow(1 - def.surplus.decayShare, TPS))} per second`);
    }
  }

  if (held.stacks > 1) lines.push(`— ${held.stacks} stacks, intensity ${fmt(held.intensity)}`);

  // A capped condition ticks along looking exactly as it did — say plainly
  // that it is one dose from turning into something worse.
  if (escalationPrimed(bearer, held)) {
    const next = STATUSES[def.escalatesTo!];
    lines.push(`⚠ The next application becomes ${next?.icon ?? ''} ${next?.name ?? def.escalatesTo}`);
  }

  if (held.ticksLeft !== null) lines.push(`${ticksToTime(held.ticksLeft)} remaining`);
  else {
    const rules = held.removal ?? def.removal ?? [];
    lines.push(
      rules.length
        ? `Ends: ${rules.map(describeRemoval).join('; ')}`
        : // A ledger-borne condition has no clock because the ledger IS one.
          def.surplus?.decayShare
          ? 'Ends when the swelling has entirely subsided'
          : 'Will not pass on its own',
    );
  }
  return lines;
}

/**
 * The bearer's maximum health, from whichever side of the fight it is on.
 * Used to say what a surplus ledger is worth against the body carrying it.
 */
function bearerMaxHp(bearer: GameState | MonsterInstance): number {
  if ('defId' in bearer) return monsterStats(bearer).maxHp;
  return getDerivedStats(bearer).maxHp;
}

/** One removal rule in words: "when you are tended to", "when struck". */
function describeRemoval(rule: StatusRemoval): string {
  const what =
    rule.effect === 'deescalate' ? 'eases' : rule.effect === 'reduce' ? 'weakens' : 'clears';
  switch (rule.on) {
    case 'heal':
      return rule.healKinds?.length
        ? `${what} on ${rule.healKinds.join(' / ')}`
        : `${what} when you are tended to`;
    case 'damageTaken':
      return `${what} when struck`;
    case 'damageDealt':
      return `${what} when you strike`;
    case 'barFill':
      return `${what} on your next action`;
    case 'barDeplete':
      return `${what} when your action bar empties`;
    case 'combatEnd':
      return `${what} when the fight ends`;
    case 'cure':
      return `${what} with ${rule.tag ?? 'a cure'}`;
  }
}
