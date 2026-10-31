import type {
  CombatState,
  DerivedStats,
  GameState,
  SkillTrigger,
  TriggerCondition,
  TriggerOp,
} from '../types';
import { DAMAGE_TYPE_NAMES } from '../types';
import { MONSTERS, RARITIES, STYLES, TIERS } from '../registry';
import { RESOURCE_LIST } from '../data/resources.data';
import { NEUTRAL_POSITION, POSITIONS, TECHNIQUE_LIST } from '../data/martial.data';
import { effectiveStyleId, stances } from './styles';
import { availableMax, resourceValue } from './resources';
import { MONSTER_ACTION_BAR, monsterStats } from './monsterStats';
import { statusesOf } from './statuses';
import { STATUS_LIST } from '../data/statuses.data';

/**
 * The skill-trigger framework: a registry of testable values ("subjects") that
 * player-authored conditions compare against. Adding a new trigger target is a
 * single entry in SUBJECT_LIST — nothing else needs to change.
 */

export interface TriggerContext {
  state: GameState;
  combat: CombatState;
  stats: DerivedStats;
}

export interface TriggerSubjectDef {
  id: string;
  name: string;
  /** 'number' compares with thresholds; 'enum' matches against `options`. */
  kind: 'number' | 'enum';
  /** Percentage subjects read and compare on a 0–100 scale. */
  unit?: '%';
  read(ctx: TriggerContext): number | string;
  /** Selectable values for enum subjects. */
  options?(state: GameState): { value: string; label: string }[];
  /**
   * Whether this subject is worth OFFERING right now. Absent = always. A
   * subject that asks about something the player has not met yet would only
   * spoil it; a stored condition naming a hidden subject still evaluates
   * normally, so hiding is a picker concern, never a rules one.
   */
  visible?(state: GameState): boolean;
}

/** Events a trigger can gate on; stamped onto CombatState.events by combat.ts. */
export const TRIGGER_EVENTS: { id: string; name: string }[] = [
  { id: 'onHit', name: 'On being hit' },
  { id: 'onCrit', name: 'On landing a crit' },
  { id: 'onParry', name: 'On parrying a blow' },
  { id: 'onDodge', name: 'On dodging an attack' },
  /**
   * A swing that missed but still opened something up. Deliberately its own
   * event rather than a flavour of `onHit`: a technique built to graze wants to
   * chain off the MISS, and a build that never misses should never see it.
   */
  { id: 'onGraze', name: 'On grazing a miss' },
  { id: 'onEncounterStart', name: 'On encounter start' },
  /**
   * An enemy began a working. Stamped BEFORE it resolves, so what reacts to it
   * answers the casting rather than its aftermath — a counterspell is sprung
   * inside it (combat.ts `pickCounterspell`), and anything else gated on it
   * catches the next moment it can.
   */
  { id: 'onEnemyCast', name: 'On an enemy casting' },
];

/** How many ticks an event stays "fresh" for an event-gated trigger. */
export const EVENT_WINDOW = 2;

export const NUMBER_OPS: TriggerOp[] = ['>=', '<=', '>', '<', '=='];
export const ENUM_OPS: TriggerOp[] = ['is', 'isNot'];

export function opsFor(kind: 'number' | 'enum'): TriggerOp[] {
  return kind === 'enum' ? ENUM_OPS : NUMBER_OPS;
}

const pctOf = (cur: number, max: number): number => (max > 0 ? (cur / max) * 100 : 0);

/** The working an enemy is casting right now, if one began within the event window. */
function freshCasting(ctx: TriggerContext) {
  const k = ctx.combat.casting;
  return k && ctx.state.totalTicks - k.tick <= EVENT_WINDOW ? k : undefined;
}

/**
 * The centre enemy — the only one you can actually hit, so every `enemy.*`
 * subject describes it. Read straight off slot 0 rather than importing from
 * combat.ts, which already imports this module.
 */
const front = (ctx: TriggerContext) => ctx.combat.enemies[0];

/** What you can be fighting as: any stance, or any school that supplants one. */
function styleOptions(): { value: string; label: string }[] {
  return Object.values(STYLES).map((s) => ({
    value: s.id,
    label: `${s.icon} ${s.name}${s.replaces ? ' (school)' : ''}`,
  }));
}

/** What you can pick: stances only — schools follow the weapon, not a click. */
function stanceOptions(): { value: string; label: string }[] {
  return stances().map((s) => ({ value: s.id, label: `${s.icon} ${s.name}` }));
}

/**
 * One `player.<id>Pct` subject per resource pool, generated from the registry —
 * a new pool becomes triggerable the moment it is declared, with nothing to
 * add here. Read against the pool's usable ceiling, which is what the bar shows.
 */
const RESOURCE_SUBJECTS: TriggerSubjectDef[] = RESOURCE_LIST.map((def) => ({
  id: `player.${def.id}Pct`,
  name: `Your ${def.name}`,
  kind: 'number' as const,
  unit: '%' as const,
  read: ({ state, stats }: TriggerContext) =>
    pctOf(resourceValue(state, def.id), availableMax(state, stats, def.id)),
}));

/**
 * One subject per technique, asking only whether its COOLDOWN is clear —
 * deliberately not "could it fire", because the useful question is about a
 * resource that will still be there in two swings' time. Ground Draw's other
 * gates (a grounded blade, the coiled entry) are things the chain itself is
 * about to create, so folding them in would make the check always fail.
 *
 * This is what lets a plan refuse to START something it cannot finish: Weapon
 * Drop asks whether Meia Lua and Ground Draw are ready before it throws your
 * sword in the dirt. A readiness predicate on one node, never an edge list —
 * the fight still decides whether the chain actually happens.
 */
const TECHNIQUE_SUBJECTS: TriggerSubjectDef[] = TECHNIQUE_LIST.map((def) => ({
  id: `technique.${def.id}`,
  name: `${def.icon} ${def.name}`,
  kind: 'enum' as const,
  read: ({ combat }: TriggerContext) =>
    (combat.cooldowns[`technique:${def.id}`] ?? 0) > 0 ? 'cooling' : 'ready',
  options: () => [
    { value: 'ready', label: 'Ready' },
    { value: 'cooling', label: 'On cooldown' },
  ],
  // Asking after a technique you have never learned would only spoil it.
  visible: (state: GameState) => !!state.techniques?.[def.id],
}));

/** The conditions a trigger can ask about, on either side of the fight. */
function statusOptions(): { value: string; label: string }[] {
  return STATUS_LIST.filter((d) => !d.hidden).map((d) => ({
    value: d.id,
    label: `${d.icon} ${d.name}`,
  }));
}

const SUBJECT_LIST: TriggerSubjectDef[] = [
  ...RESOURCE_SUBJECTS,
  { id: 'player.status', name: 'You Are Afflicted By', kind: 'enum',
    read: ({ state }) => statusesOf(state)[0]?.id ?? '',
    options: statusOptions },
  { id: 'player.statusCount', name: 'Your Afflictions', kind: 'number',
    read: ({ state }) => statusesOf(state).length },
  { id: 'enemy.status', name: 'Enemy Is Afflicted By', kind: 'enum',
    read: (ctx) => { const e = front(ctx); return e ? (statusesOf(e)[0]?.id ?? '') : ''; },
    options: statusOptions },
  { id: 'enemy.statusCount', name: 'Enemy Afflictions', kind: 'number',
    read: (ctx) => { const e = front(ctx); return e ? statusesOf(e).length : 0; } },
  { id: 'enemy.hpPct', name: 'Enemy HP', kind: 'number', unit: '%',
    read: (ctx) => { const e = front(ctx); return e ? pctOf(e.hp, monsterStats(e).maxHp) : 0; } },
  { id: 'enemy.level', name: 'Enemy Level', kind: 'number',
    read: (ctx) => front(ctx)?.level ?? 0 },
  { id: 'enemy.count', name: 'Enemies Remaining', kind: 'number',
    read: ({ combat }) => combat.enemies.filter((e) => e !== null).length },
  // The micro-position the last exchange left you in (see systems/martial.ts).
  { id: 'combat.position', name: 'Your Position', kind: 'enum',
    read: ({ combat }) => combat.position ?? NEUTRAL_POSITION,
    options: () =>
      Object.values(POSITIONS).map((p) => ({ value: p.id, label: `${p.icon} ${p.name}` })) },
  // Active = what you're actually fighting as (the school its slot is wearing,
  // or the plain stance when its weapon is gone); selected = the stance you picked.
  { id: 'style.active', name: 'Combat Style (active)', kind: 'enum',
    read: ({ state }) => effectiveStyleId(state), options: styleOptions },
  { id: 'style.selected', name: 'Combat Stance (selected)', kind: 'enum',
    read: ({ state }) => state.style, options: stanceOptions },
  { id: 'enemy.tier', name: 'Enemy Tier', kind: 'enum',
    read: (ctx) => front(ctx)?.tier ?? '',
    options: () => Object.values(TIERS).map((t) => ({ value: t.id, label: t.name || t.id })) },
  { id: 'enemy.rarity', name: 'Enemy Rarity', kind: 'enum',
    read: (ctx) => front(ctx)?.rarity ?? '',
    options: () => Object.values(RARITIES).map((r) => ({ value: r.id, label: r.name })) },
  { id: 'enemy.damageType', name: 'Enemy Damage Type', kind: 'enum',
    read: (ctx) => {
      const e = front(ctx);
      return e ? (MONSTERS[e.defId]?.damageType ?? 'bludgeoning') : '';
    },
    options: () => Object.entries(DAMAGE_TYPE_NAMES).map(([value, label]) => ({ value, label })) },
  { id: 'enemy.range', name: 'Enemy Reach', kind: 'enum',
    read: (ctx) => front(ctx)?.range ?? '',
    options: () => [
      { value: 'melee', label: '⚔ Melee' },
      { value: 'ranged', label: '🏹 Ranged' },
    ] },
  // What the enemy is casting — blank when nothing began within the event
  // window. How several counterspells tuned for different things are routed:
  // each asks after the working it was tuned for.
  { id: 'enemy.castSchool', name: 'Enemy Spell School', kind: 'enum',
    read: (ctx) => freshCasting(ctx)?.school ?? '',
    options: () => [
      { value: 'arcane', label: '🔮 Arcane' },
      { value: 'divine', label: '🙏 Divine' },
      { value: 'psionic', label: '🧠 Psionic' },
    ] },
  { id: 'enemy.castElement', name: 'Enemy Spell Element', kind: 'enum',
    read: (ctx) => freshCasting(ctx)?.element ?? '',
    options: () => Object.entries(DAMAGE_TYPE_NAMES).map(([value, label]) => ({ value, label })) },
  // The anticipation read: how close the enemy is to acting. "≥ 70" is
  // "mid-windup" — the moment counters and hidden draws want.
  { id: 'enemy.bar', name: 'Enemy Action Bar', kind: 'number', unit: '%',
    read: (ctx) => {
      const e = front(ctx);
      return e ? pctOf(e.bar, MONSTER_ACTION_BAR) : 0;
    } },
  ...TECHNIQUE_SUBJECTS,
];

export const TRIGGER_SUBJECTS: Record<string, TriggerSubjectDef> = Object.fromEntries(
  SUBJECT_LIST.map((s) => [s.id, s]),
);

/** Display order for the UI's subject picker. */
export const TRIGGER_SUBJECT_LIST: readonly TriggerSubjectDef[] = SUBJECT_LIST;

/** The picker's list for THIS player — hides subjects they cannot have met. */
export function visibleTriggerSubjects(state: GameState): TriggerSubjectDef[] {
  return SUBJECT_LIST.filter((s) => !s.visible || s.visible(state));
}

function conditionHolds(ctx: TriggerContext, c: TriggerCondition): boolean {
  const subject = TRIGGER_SUBJECTS[c.subject];
  // Unknown subject (e.g. a save from a build that had more): ignore it rather
  // than silently disabling the whole skill.
  if (!subject) return true;
  const actual = subject.read(ctx);

  if (subject.kind === 'enum') {
    const want = String(c.value);
    return c.op === 'isNot' ? actual !== want : actual === want;
  }

  const a = Number(actual);
  const b = Number(c.value);
  if (!isFinite(a) || !isFinite(b)) return false;
  switch (c.op) {
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '<': return a < b;
    case '==': return a === b;
    default: return false; // enum operator against a numeric subject
  }
}

/**
 * Whether a skill may fire right now. No trigger configured = always eligible
 * (matches the pre-trigger behaviour). All conditions AND together.
 */
export function evaluateTrigger(ctx: TriggerContext, trigger: SkillTrigger | undefined): boolean {
  if (!trigger) return true;
  if (trigger.enabled === false) return false;
  if (trigger.event) {
    const at = ctx.combat.events[trigger.event];
    if (at === undefined || ctx.state.totalTicks - at > (trigger.window ?? EVENT_WINDOW)) {
      return false;
    }
  }
  for (const c of trigger.conditions ?? []) {
    if (!conditionHolds(ctx, c)) return false;
  }
  return true;
}

/** Human-readable condition, e.g. "Enemy HP <= 30%" — used in tooltips/summaries. */
export function describeCondition(c: TriggerCondition, state?: GameState): string {
  const subject = TRIGGER_SUBJECTS[c.subject];
  if (!subject) return `${c.subject} ${c.op} ${c.value}`;
  if (subject.kind === 'enum') {
    const label =
      subject.options?.(state ?? ({} as GameState)).find((o) => o.value === c.value)?.label ??
      String(c.value);
    return `${subject.name} ${c.op === 'isNot' ? 'is not' : 'is'} ${label}`;
  }
  return `${subject.name} ${c.op} ${c.value}${subject.unit === '%' ? '%' : ''}`;
}
