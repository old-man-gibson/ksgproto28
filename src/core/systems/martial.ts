import type {
  DerivedStats,
  ForkArchetypeDef,
  GameState,
  ItemInstance,
  PositionDef,
  TechniqueDef,
  TechniqueEntry,
  TechniqueForm,
  TechniqueLesson,
  TechniqueMove,
  TechniqueState,
} from '../types';
import type { EventBus } from '../engine/events';
import {
  FORK_ARCHETYPES,
  FORK_ARCHETYPE_LIST,
  FORK_TIER,
  MASTERY_COOLDOWN,
  MASTERY_LADDER,
  MASTERY_NAMES,
  MASTERY_POWER,
  MAX_DRILLED,
  NEUTRAL_POSITION,
  POSITIONS,
  ROUGH_REP_MULT,
  SPELL_READY_POSITION,
  ROUGH_STAMINA_MULT,
  TECHNIQUES,
  TECHNIQUE_LIST,
} from '../data/martial.data';
import { conditionsMet, equippedTags } from './conditions';
import { evaluateTrigger, type TriggerContext } from './triggers';
import { weaponTechniqueMods } from './runes';
import { preparedSpells, resolveSpell } from './spellcraft';
import { resourceValue } from './resources';
import { subsystemUnlocked } from './unlocks';
import { NPCS } from '../registry';
import { itemDefOf } from './assembly';
import { text } from '../text/log';

/**
 * Martial techniques: response, where magic is composition.
 *
 * Arcane writes a sentence, psionics allocates a shape, divine petitions a god
 * — all before the fight, which then plays the result back. A technique is
 * composed BY the fight: its trigger is baked into its identity, it fires only
 * from the positions the last exchange left you in, and the chains that emerge
 * (gather → heavy blow, dodge → riposte → thrust) were never authored anywhere.
 *
 * KNOWLEDGE IS A LEDGER, not a checklist: `state.techniques[id]` existing is
 * knowing it, and how it got there brands the form (TechniqueForm) — a rough
 * form crystallizes autodidactically from the fight's own counters
 * (checkTechniqueLearning), a canonical one is taught. `unlock` on the def is
 * only ELIGIBILITY: the body that could hold the technique.
 *
 * Progression inverts arcana's novelty ledger: repetition, on the standard
 * powers-of-ten ladder (MASTERY_LADDER — the last rung is the proverbial ten
 * thousand swings). Executions count only for what the player is deliberately
 * drilling (MAX_DRILLED slots — the martial answer to the grimoire's prepared cap).
 */

// ---------- Knowing ----------

/** Known = in the ledger. */
export function techniqueKnown(state: GameState, def: TechniqueDef): boolean {
  return !!state.techniques?.[def.id];
}

export function knownTechniques(state: GameState): TechniqueDef[] {
  return TECHNIQUE_LIST.filter((t) => techniqueKnown(state, t));
}

export function techniqueForm(state: GameState, id: string): TechniqueForm | undefined {
  return state.techniques?.[id]?.form;
}

/** Whether the body could hold this technique — the gate on LEARNING it. */
export function eligibleToLearn(state: GameState, def: TechniqueDef): boolean {
  return !def.unlock || conditionsMet(state, def.unlock);
}

/**
 * Enter a technique in the ledger. Re-learning never downgrades: an existing
 * entry keeps its executions, and its form only moves rough → canonical.
 */
export function learnTechnique(
  state: GameState,
  def: TechniqueDef,
  form: TechniqueForm,
): TechniqueState {
  const ledger = (state.techniques ??= {});
  const held = ledger[def.id];
  if (!held) return (ledger[def.id] = { executions: 0, form });
  if (held.form === 'rough' && form === 'canonical') held.form = 'canonical';
  return held;
}

// ---------- Reach ----------

/**
 * The positions this fighter can actually stand in: neutral (every encounter
 * starts there and every plain swing returns there), plus the exit of every
 * known technique that can itself be entered, to a fixpoint. Displacement
 * adds nothing: it only ever lands on dead ends (MARTIAL.md §9a).
 */
export function reachablePositions(state: GameState): Set<string> {
  const known = knownTechniques(state);
  const reach = new Set<string>([NEUTRAL_POSITION]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const def of known) {
      const from = entryPositions(state, def);
      if (from !== 'any' && !from.some((p) => reach.has(p))) continue;
      const exit = techniqueExit(state, def);
      if (!reach.has(exit)) {
        reach.add(exit);
        grew = true;
      }
    }
  }
  return reach;
}

/** The positions a technique starts from that this fighter cannot reach yet. */
export function unreachedEntries(state: GameState, def: TechniqueDef, reach = reachablePositions(state)): string[] {
  const from = entryPositions(state, def);
  if (from === 'any' || from.some((p) => reach.has(p))) return [];
  return from;
}

/**
 * Whether a technique could ever fire for this fighter: it starts from
 * anywhere, or from a position its known techniques reach. One that cannot is
 * never taught and never counts toward self-learning (user, 2026-10-21):
 * Lunge means nothing to a fighter who has no way to coil.
 */
export function techniqueReachable(state: GameState, def: TechniqueDef, reach = reachablePositions(state)): boolean {
  return unreachedEntries(state, def, reach).length === 0;
}

/**
 * Self-learning progress toward `learn.self.count`, counted from when the
 * technique became reachable. `state.learnFrom[id]` is where the count
 * starts: it follows the counter while the technique is unreachable, so the
 * progress stays at zero, and stops moving once a way in exists. Absent means
 * reachable all along, and the whole counter counts.
 */
export function selfLearnProgress(state: GameState, def: TechniqueDef): number {
  const self = def.learn?.self;
  if (!self) return 0;
  return Math.max(0, (state.stats[self.stat] ?? 0) - (state.learnFrom?.[def.id] ?? 0));
}

/**
 * Autodidactic crystallization: an eligible, reachable, unknown technique
 * with a `learn.self` counter becomes known — ROUGH — once its progress
 * (counted from when it became reachable) crosses. Called from combat
 * wherever those counters are bumped.
 *
 * Off while the `martial` shutter is shut (systems/unlocks.ts, user
 * 2026-10-21): in the alpha the only way into the system is a teacher. The
 * baselines still move, so a technique reachable while the shutter is shut
 * keeps counting, and opening it later crystallizes what was earned.
 */
export function checkTechniqueLearning(state: GameState, bus: EventBus): void {
  const reach = reachablePositions(state);
  state.learnFrom ??= {};
  for (const def of TECHNIQUE_LIST) {
    const self = def.learn?.self;
    if (!self || techniqueKnown(state, def) || techniqueReachable(state, def, reach)) continue;
    state.learnFrom[def.id] = state.stats[self.stat] ?? 0;
  }
  if (!subsystemUnlocked(state, 'martial')) return;
  for (const def of TECHNIQUE_LIST) {
    const self = def.learn?.self;
    if (!self || techniqueKnown(state, def)) continue;
    if (!techniqueReachable(state, def, reach)) continue;
    if (selfLearnProgress(state, def) < self.count) continue;
    if (!eligibleToLearn(state, def)) continue;
    learnTechnique(state, def, 'rough');
    bus.emit({
      type: 'log',
      msg: text('martial.technique_learned', { icon: def.icon, name: def.name }),
      kind: 'combat',
    });
  }
}

// ---------- Teachers ----------

/**
 * Where a lesson stands for this player: `taught` once the canonical form is
 * held, `held` while the requirements are unmet or the technique cannot be
 * reached yet (nothing the player knows leads into its position), `open` when
 * it can be taken. A rough form counts as open — the teacher refines it
 * (MARTIAL.md §10).
 */
export type LessonState = 'open' | 'held' | 'taught';

export function lessonState(state: GameState, lesson: TechniqueLesson): LessonState {
  if (techniqueForm(state, lesson.technique) === 'canonical') return 'taught';
  if (lesson.requires && !conditionsMet(state, lesson.requires)) return 'held';
  const def = TECHNIQUES[lesson.technique];
  if (def && !techniqueReachable(state, def)) return 'held';
  return 'open';
}

/**
 * Take a lesson from a teacher: the canonical form, or a rough one refined in
 * place (executions kept). Refused for a technique this NPC does not teach,
 * an unmet requirement, or one already canonical. Eligibility (`unlock`) is
 * not checked: the teacher is the shortcut past it, the way a recipe card is.
 * Teaching ignores the `martial` shutter.
 */
export function teachTechnique(state: GameState, bus: EventBus, npcId: string, techniqueId: string): boolean {
  const lesson = NPCS[npcId]?.teaches?.find((l) => l.technique === techniqueId);
  const def = TECHNIQUES[techniqueId];
  if (!lesson || !def || lessonState(state, lesson) !== 'open') return false;
  const refined = techniqueForm(state, def.id) === 'rough';
  learnTechnique(state, def, 'canonical');
  bus.emit({
    type: 'log',
    msg: text(refined ? 'martial.technique_refined' : 'martial.technique_taught', {
      icon: def.icon,
      name: def.name,
      teacher: NPCS[npcId].name,
    }),
    kind: 'skill',
  });
  return true;
}

/** Whether the required weapon family is in hand (absent family = anything). */
export function techniqueArmed(state: GameState, def: TechniqueDef): boolean {
  return !def.family || equippedTags(state).has(def.family);
}

/**
 * The skill this technique is shown under in the skill tree: its declared
 * home if that skill is known, else the first skill its eligibility names
 * (a technique can be known before its school is — a rough Finishing Cut
 * belongs to Swordsmanship until Ittou-ryu manifests and claims it).
 */
export function techniqueHomeSkill(state: GameState, def: TechniqueDef): string {
  if (def.skill && state.skills[def.skill]) return def.skill;
  for (const cond of def.unlock ?? []) {
    if (cond.type === 'skill' && state.skills[cond.id]) return cond.id;
  }
  return 'fighting';
}

/** Known techniques that display under the given skill, in data order. */
export function techniquesUnderSkill(state: GameState, skillId: string): TechniqueDef[] {
  return knownTechniques(state).filter((t) => techniqueHomeSkill(state, t) === skillId);
}

/**
 * Every technique a weapon-group selection WOULD make available: the whole
 * content pool, not just what is known — the planner uses this as a preview
 * of what training into a family opens up, whether or not you're there yet.
 * A pure content query (no state): family membership never depends on play.
 * An empty selection still surfaces the universal (family-less) reflexes.
 */
export function techniquesForFamilies(families: string[]): TechniqueDef[] {
  return TECHNIQUE_LIST.filter((t) => !t.family || families.includes(t.family));
}

// ---------- The ladder ----------

export function techniqueExecutions(state: GameState, id: string): number {
  return state.techniques?.[id]?.executions ?? 0;
}

/** Reps as the ladder counts them: your own tricks internalize twice as fast. */
export function effectiveReps(state: GameState, id: string): number {
  const held = state.techniques?.[id];
  if (!held) return 0;
  return held.form === 'rough' ? held.executions * ROUGH_REP_MULT : held.executions;
}

/** The rung held (0 = none, 1–4), from the standard powers-of-ten ladder. */
export function masteryTier(state: GameState, def: TechniqueDef): number {
  const reps = effectiveReps(state, def.id);
  let tier = 0;
  for (const threshold of MASTERY_LADDER) {
    if (reps < threshold) break;
    tier += 1;
  }
  return tier;
}

/** The rung's display name: the data note's override, or the generic ladder name. */
export function masteryTierName(def: TechniqueDef, tier: number): string | undefined {
  if (tier < 1) return undefined;
  return def.mastery?.[tier as 1 | 2 | 3 | 4]?.name ?? MASTERY_NAMES[tier - 1];
}

/** Raw executions still needed for the next rung, or undefined at the summit. */
export function repsToNextTier(state: GameState, def: TechniqueDef): number | undefined {
  const tier = masteryTier(state, def);
  if (tier >= MASTERY_LADDER.length) return undefined;
  const held = state.techniques?.[def.id];
  const mult = held?.form === 'rough' ? ROUGH_REP_MULT : 1;
  return Math.ceil((MASTERY_LADDER[tier] - effectiveReps(state, def.id)) / mult);
}

/**
 * The ways a def DECLARES, normalized — no ledger consulted. This is the
 * reading for anything without practice behind it: a monster running an
 * authored rotation, and the content tests.
 */
export function declaredEntries(def: TechniqueDef): TechniqueEntry[] {
  if (def.from === 'any') return [{ at: 'any' }];
  if (def.from.length === 0) return [];
  return typeof def.from[0] === 'string'
    ? [{ at: def.from as string[] }]
    : (def.from as TechniqueEntry[]);
}

/** Declared entry positions, flattened and state-free. */
export function declaredPositions(def: TechniqueDef): string[] | 'any' {
  const entries = declaredEntries(def);
  if (entries.some((e) => e.at === 'any')) return 'any';
  return [...new Set(entries.flatMap((e) => e.at as string[]))];
}

/**
 * Every way into this technique, in the one shape the engine reads. Data may
 * write `'any'`, a bare position list, or the long `{ at, trigger }` form; all
 * three normalize here so nothing downstream has to know which was used.
 *
 * Practice adds a plain way of its own: a mastery `addFrom` opens the position
 * with no read attached, because what repetition buys is the motion becoming
 * available, not a new thing to notice.
 */
export function techniqueEntries(state: GameState, def: TechniqueDef): TechniqueEntry[] {
  const base = declaredEntries(def);
  const tier = masteryTier(state, def);
  const opened: string[] = [];
  for (let t = 1; t <= tier; t++) {
    const extra = def.mastery?.[t as 1 | 2 | 3 | 4]?.addFrom;
    if (extra) opened.push(...extra);
  }
  return opened.length ? [...base, { at: opened }] : base;
}

/**
 * Where the technique can fire from at all, flattened — what the graph and the
 * pills draw. Says nothing about the reads on individual ways; that is
 * `openEntry`'s business.
 */
export function entryPositions(state: GameState, def: TechniqueDef): string[] | 'any' {
  const entries = techniqueEntries(state, def);
  if (entries.some((e) => e.at === 'any')) return 'any';
  return [...new Set(entries.flatMap((e) => e.at as string[]))];
}

export function positionAllows(state: GameState, def: TechniqueDef, position: string): boolean {
  const from = entryPositions(state, def);
  return from === 'any' || from.includes(position);
}

/**
 * The way in that is actually open right now: standing somewhere it admits,
 * AND whatever that particular way wants to have just happened. Any one way
 * being open is enough — they are alternatives, not requirements.
 */
export function openEntry(
  state: GameState,
  def: TechniqueDef,
  position: string,
  ctx: TriggerContext,
): TechniqueEntry | undefined {
  return techniqueEntries(state, def).find(
    (e) => (e.at === 'any' || e.at.includes(position)) && evaluateTrigger(ctx, e.trigger),
  );
}

/**
 * One technique's move on the position graph: where it can enter from, where
 * it leaves you. An `'any'`-entry reflex has no single source — it answers
 * from wherever the fight left you — so its `from` is null and only its exit
 * is a real edge.
 *
 * The graph is a MAP, NOT A SCRIPT (§9). An edge states a fact about two
 * nodes — "this move happens to leave you where that one starts" — and never
 * an order to fire them in; the fight still assembles every chain. Nothing
 * built on this may grow into an authored sequence.
 */
export interface PositionEdge {
  def: TechniqueDef;
  /** Entry position id; null for an 'any'-entry reflex. */
  from: string | null;
  to: string;
}

/**
 * The graph the given techniques form right now. Live-derived on purpose:
 * entryPositions/techniqueExit already fold in mastery `addFrom`, the chosen
 * fork and rune surgery, so a graph drawn from this grows as practice does.
 */
export function positionGraph(state: GameState, defs: TechniqueDef[]): PositionEdge[] {
  const edges: PositionEdge[] = [];
  for (const def of defs) {
    const to = techniqueExit(state, def);
    const from = entryPositions(state, def);
    if (from === 'any') edges.push({ def, from: null, to });
    else for (const p of from) edges.push({ def, from: p, to });
  }
  return edges;
}

/**
 * Whether a known technique is benched: held in the ledger, kept out of the
 * rotation. The bench IS the player's own trigger switch, so benching from
 * the planner and from the skill tree are the same act on the same field.
 */
export function techniqueBenched(state: GameState, id: string): boolean {
  return state.skillTriggers?.[`technique:${id}`]?.enabled === false;
}

/**
 * The move as practice and provenance have shaped it: the held rung's generic
 * multipliers, the chosen fork's transform, plus the rough form's stamina
 * surcharge — which Perfected dissolves, because ten thousand swings of your
 * own way is its own mastery.
 */
export function resolvedMove(state: GameState, def: TechniqueDef): TechniqueMove {
  const tier = masteryTier(state, def);
  const rough = techniqueForm(state, def.id) === 'rough';
  const fork = chosenFork(state, def);
  const runes = weaponTechniqueMods(state, def.id);
  if (tier === 0 && !rough && !fork && runes.length === 0) return def.move;
  const move = { ...def.move };
  if (tier > 0) {
    if (move.damageMult !== undefined) move.damageMult *= MASTERY_POWER[tier - 1];
    // Practice sharpens the signature too — a deflection you have drilled ten
    // thousand times returns more of the blow, not just a harder swing.
    if (move.preventedMult !== undefined) move.preventedMult *= MASTERY_POWER[tier - 1];
    move.cooldown = Math.max(10, Math.round(move.cooldown * MASTERY_COOLDOWN[tier - 1]));
  }
  if (fork) {
    if (fork.damageMult && move.damageMult !== undefined) move.damageMult *= fork.damageMult;
    if (fork.damageMult && move.preventedMult !== undefined) move.preventedMult *= fork.damageMult;
    if (fork.hits) move.hits = fork.hits;
    if (fork.cooldownMult) move.cooldown = Math.max(10, Math.round(move.cooldown * fork.cooldownMult));
    if (fork.splashAdd) move.splash = (move.splash ?? 0) + fork.splashAdd;
    if (fork.staminaMult && move.staminaCost) move.staminaCost *= fork.staminaMult;
    if (fork.durationMult && move.buff) {
      move.buff = { ...move.buff, duration: Math.round(move.buff.duration * fork.durationMult) };
    }
  }
  // Rune graph surgery — the equipment layer applies last, on top of practice.
  for (const m of runes) {
    if (m.damageMult && move.damageMult !== undefined) move.damageMult *= m.damageMult;
    if (m.damageMult && move.preventedMult !== undefined) move.preventedMult *= m.damageMult;
    if (m.cooldownMult) move.cooldown = Math.max(10, Math.round(move.cooldown * m.cooldownMult));
    if (m.penetrationAdd) move.penetration = (move.penetration ?? 0) + m.penetrationAdd;
    if (m.splashAdd) move.splash = (move.splash ?? 0) + m.splashAdd;
  }
  if (rough && tier < MASTERY_LADDER.length && move.staminaCost) {
    move.staminaCost *= ROUGH_STAMINA_MULT;
  }
  return move;
}

// ---------- Forks ----------

/** The archetype this technique's path has committed to, if any. */
export function chosenFork(state: GameState, def: TechniqueDef): ForkArchetypeDef | undefined {
  const path = state.techniques?.[def.id]?.path;
  return path ? FORK_ARCHETYPES[path] : undefined;
}

/** Whether an archetype can apply to this technique's move at all. */
function forkApplies(def: TechniqueDef, arch: ForkArchetypeDef): boolean {
  const offensive = def.move.damageMult !== undefined;
  if ((arch.kind === 'strike') !== offensive) return false;
  // A pure-exit archetype (Flowing) must actually MOVE the exit — on a
  // technique that already ends there it would advance nothing, and every
  // fork must advance the move. (An archetype whose exitTo matches but pays
  // in numbers — Overwhelming on Heavy Blow — stays offerable: its drawback
  // is an exit you already live with, which is a synergy, not a no-op.)
  const numeric =
    arch.damageMult !== undefined ||
    arch.hits !== undefined ||
    arch.cooldownMult !== undefined ||
    arch.splashAdd !== undefined ||
    arch.staminaMult !== undefined ||
    arch.durationMult !== undefined;
  if (!numeric && arch.exitTo === def.to) return false;
  return true;
}

/**
 * The archetypes on offer at the Honed choice: the def's curated list — or,
 * for a SYNCRETIC form, the whole matching vocabulary (two schools' worth of
 * perspective is exactly what widens the fork).
 */
export function forkOptions(state: GameState, def: TechniqueDef): ForkArchetypeDef[] {
  const base =
    techniqueForm(state, def.id) === 'syncretic'
      ? FORK_ARCHETYPE_LIST.filter((a) => forkApplies(def, a))
      : (def.forks ?? [])
          .map((id) => FORK_ARCHETYPES[id])
          .filter((a): a is ForkArchetypeDef => !!a && forkApplies(def, a));
  // Socketed runes may widen the Honed offering (graph surgery on the choice).
  const out = [...base];
  for (const m of weaponTechniqueMods(state, def.id)) {
    if (!m.grantsFork) continue;
    const arch = FORK_ARCHETYPES[m.grantsFork];
    if (arch && forkApplies(def, arch) && !out.some((a) => a.id === arch.id)) out.push(arch);
  }
  return out;
}

/** Whether the Honed choice is open right now: rung reached, options, no path yet. */
export function forkAvailable(state: GameState, def: TechniqueDef): boolean {
  if (state.techniques?.[def.id]?.path) return false;
  if (masteryTier(state, def) < FORK_TIER) return false;
  return forkOptions(state, def).length > 0;
}

/**
 * Commit the Honed choice. PERMANENT — your practice history is your build.
 * Refused (false) unless the choice is actually open and offered.
 */
export function chooseFork(state: GameState, def: TechniqueDef, archetypeId: string): boolean {
  if (!forkAvailable(state, def)) return false;
  if (!forkOptions(state, def).some((a) => a.id === archetypeId)) return false;
  state.techniques![def.id]!.path = archetypeId;
  return true;
}

/**
 * The name as path and equipment have shaped it: a socketed rune's rename
 * wins outright ("Flash Step"), else the fork prefixes ("Split Heavy Blow").
 */
export function techniqueDisplayName(state: GameState, def: TechniqueDef): string {
  const rename = weaponTechniqueMods(state, def.id).find((m) => m.rename)?.rename;
  if (rename) return rename;
  const fork = chosenFork(state, def);
  return fork ? `${fork.name} ${def.name}` : def.name;
}

/** Where executing it leaves you — fork may rewrite the exit; a rune wins last. */
export function techniqueExit(state: GameState, def: TechniqueDef): string {
  const rune = weaponTechniqueMods(state, def.id).find((m) => m.exitTo)?.exitTo;
  return rune ?? chosenFork(state, def)?.exitTo ?? def.to;
}

// ---------- Weapon states ----------
// A weapon is wielded | grounded | concealed; techniques are the verbs that
// move it between states. Because equippedTags/derived stats read equipment
// LIVE, everything downstream (unarmed pseudo-tag, school stance swaps,
// dormant weapon stats and runes) follows automatically.

/** Give a reclaimed weapon back to the hand, or the pack if the hand filled. */
function reclaim(state: GameState, item: NonNullable<GameState['sheathed']>): void {
  if (!state.equipment.weapon) state.equipment.weapon = item;
  else state.inventory.push(item);
}

/**
 * Every item a live fight is holding on the player's behalf.
 *
 * ⚠️ **THE CONTRACT: a new `CombatState` field that holds an `ItemInstance`
 * must be listed here.** `state.combat` is transient and gets dropped WHOLE —
 * by `closeCombat` when a fight ends, and by `serialize` when the game saves —
 * so a player's property parked on it is destroyed unless this function knows
 * about it. That is how a grounded weapon used to vanish on reload: every path
 * that ended a fight recovered it, and saving was not one of them.
 */
export function fightHeldItems(c: GameState['combat']): ItemInstance[] {
  if (!c) return [];
  return [c.grounded, c.impaled].filter((i): i is ItemInstance => !!i);
}

/**
 * Equipment and inventory as they would be with the fight's held items handed
 * back — `reclaim`'s rule (hand if free, pack otherwise) without touching the
 * live state, because saving must never alter the game it is recording.
 *
 * Returns the originals untouched when the fight is holding nothing, so the
 * ordinary autosave copies no arrays it does not need to.
 */
export function reclaimedForSave(state: GameState): Pick<GameState, 'equipment' | 'inventory'> {
  const held = fightHeldItems(state.combat);
  if (!held.length) return { equipment: state.equipment, inventory: state.inventory };
  const toHand = !state.equipment.weapon;
  return {
    equipment: toHand ? { ...state.equipment, weapon: held[0] } : state.equipment,
    inventory: [...state.inventory, ...(toHand ? held.slice(1) : held)],
  };
}

/** The weapon-state requirement a technique can't currently meet, if any. */
export function weaponStateGate(
  state: GameState,
  def: TechniqueDef,
): 'wielded' | 'grounded' | 'sheathed' | 'impaled' | 'readied' | null {
  if (def.requiresWielded && !state.equipment.weapon) return 'wielded';
  if (def.requiresGrounded && !state.combat?.grounded) return 'grounded';
  if (def.requiresImpaled && !state.combat?.impaled) return 'impaled';
  if (def.requiresReadiedSpell && !state.combat?.readiedSpell) return 'readied';
  if (def.requiresSheathed) {
    const tags = state.sheathed ? (itemDefOf(state.sheathed)?.tags ?? []) : [];
    if (!tags.includes(def.requiresSheathed)) return 'sheathed';
  }
  return null;
}

/**
 * A technique's equipment side-effect. 'draw'/'recover' fire in the PRE phase
 * (the strike is made WITH the reclaimed weapon); 'ground' fires POST (the
 * drop is the follow-through of a final armed blow).
 */
export function applyTechniqueEquipment(
  state: GameState,
  def: TechniqueDef,
  phase: 'pre' | 'post',
): void {
  const effect = def.move.equipment;
  const c = state.combat;
  if (!effect || !c) return;
  if (phase === 'post' && effect === 'ground' && state.equipment.weapon) {
    c.grounded = state.equipment.weapon;
    delete state.equipment.weapon;
  } else if (phase === 'post' && effect === 'impale' && state.equipment.weapon) {
    // Left in them, not dropped: the blow lands first, and the blade stays
    // where it finished. Like grounding, this is the follow-through.
    c.impaled = state.equipment.weapon;
    delete state.equipment.weapon;
  } else if (phase === 'pre' && effect === 'recover' && c.grounded) {
    reclaim(state, c.grounded);
    c.grounded = null;
  } else if (phase === 'pre' && effect === 'wrench' && c.impaled) {
    // Torn back out before the blow is read, so the strike is made with it.
    reclaim(state, c.impaled);
    c.impaled = null;
  } else if (phase === 'pre' && effect === 'draw' && state.sheathed) {
    reclaim(state, state.sheathed);
    state.sheathed = null;
  }
}

// ---------- Readied spells (the magiknight seat) ----------

/**
 * The spell a Ready Spell technique should take up: the first PREPARED one
 * that can actually be paid for. Prepared, because the readied spell must be
 * one the player chose to carry — the grimoire is the magic half's loadout,
 * and this reads it rather than duplicating it.
 */
export function readyableSpell(
  state: GameState,
  stats: DerivedStats,
): { uid: number; cost: number } | null {
  for (const spell of preparedSpells(state)) {
    const spec = resolveSpell(spell);
    // A working with nothing to deliver is not worth holding — and a
    // counterspell is held for somebody else's casting, not a blade's opening.
    if (spec.strikes.length === 0 && !spec.heal) continue;
    if (spec.counter) continue;
    const cost = spec.manaCost * stats.manaEff;
    if (resourceValue(state, 'mana') < cost) continue;
    return { uid: spell.uid, cost };
  }
  return null;
}

/**
 * Whether this prepared working is currently being HELD rather than left to
 * cast on its own. A held spell is out of the ordinary rotation: you are
 * carrying it to deliver through an opening, and its mana was already paid
 * when you took it up — without this the same working goes off twice over.
 */
export function spellIsHeld(state: GameState, uid: number): boolean {
  return state.combat?.readiedSpell === uid;
}

/**
 * Let go of whatever was held — on delivery, on losing the position, or when
 * the fight ends. The mana is NOT refunded: it was spent holding it, and the
 * risk of that is what makes carrying one a decision.
 */
export function releaseReadiedSpell(state: GameState): void {
  if (state.combat) state.combat.readiedSpell = null;
}

/**
 * Move the fighter. The one place position changes, so that leaving the
 * spell-ready seat drops whatever was being held — a plain swing out of it
 * costs you the working AND the mana, which is exactly the risk that makes
 * carrying one a decision rather than free value.
 */
export function setPosition(state: GameState, next: string): void {
  const c = state.combat;
  if (!c) return;
  if (c.position === SPELL_READY_POSITION && next !== SPELL_READY_POSITION) {
    releaseReadiedSpell(state);
  }
  c.position = next;
}

/** The fight is over — nobody leaves their blade in the dirt. */
export function recoverGroundedWeapon(state: GameState): void {
  const c = state.combat;
  if (!c) return;
  // Whatever the fight left lying about or buried in somebody comes home.
  // Slots listed in `fightHeldItems` — keep the two in step.
  for (const slot of ['grounded', 'impaled'] as const) {
    const item = c[slot];
    if (!item) continue;
    c[slot] = null;
    reclaim(state, item);
  }
}

/**
 * Sheathe the wielded dagger (concealed carry: you become genuinely unarmed)
 * or draw the sheathed one back out by hand. Returns whether a weapon is
 * sheathed AFTER the call. Only daggers conceal.
 */
export function toggleSheathe(state: GameState): boolean {
  if (state.sheathed) {
    const item = state.sheathed;
    state.sheathed = null;
    reclaim(state, item);
    return false;
  }
  const weapon = state.equipment.weapon;
  if (!weapon) return false;
  if (!(itemDefOf(weapon)?.tags ?? []).includes('dagger')) return false;
  state.sheathed = weapon;
  delete state.equipment.weapon;
  return true;
}

/** What standing where you stand costs (or buys) against incoming blows. */
export function positionIncomingMult(state: GameState, stumbleTaken = 1): number {
  const pos = state.combat?.position;
  const mult = (pos && POSITIONS[pos]?.effects?.incomingMult) || 1;
  // Only the PENALTY is softened. A guarded stance's 0.9 is something you
  // earned by standing well, and a body that shrugs off stumbling has no
  // business also shrugging off its own guard.
  return mult > 1 ? 1 + (mult - 1) * Math.max(0, stumbleTaken) : mult;
}

/**
 * What your footing does to your dodge. Written to respect an explicit 0 —
 * a position taken deliberately wide open dodges NOTHING, and `|| 1` would
 * quietly hand that back.
 */
export function positionDodgeMult(state: GameState): number {
  const pos = state.combat?.position;
  const mult = pos ? POSITIONS[pos]?.effects?.dodgeMult : undefined;
  return mult ?? 1;
}

// ---------- Which positions the player knows about ----------

/**
 * Whether a position is worth showing. A position with no `unlock` reveals
 * itself once the player knows a technique that enters or leaves it: you
 * cannot stand somewhere you have no way of reaching, so learning the move IS
 * the discovery. Neutral is always shown — every plain swing returns there.
 *
 * This is a PRESENTATION gate. Combat never asks it: if some effect parks you
 * in a position you have not "discovered", the position still does its work.
 */
export function positionKnown(state: GameState, id: string): boolean {
  if (id === NEUTRAL_POSITION) return true;
  const def = POSITIONS[id];
  if (!def) return false;
  if (def.unlock && !conditionsMet(state, def.unlock)) return false;
  return knownTechniques(state).some((t) => {
    if (techniqueExit(state, t) === id) return true;
    const from = entryPositions(state, t);
    return from !== 'any' && from.includes(id);
  });
}

/** The positions to draw, in declaration order. */
export function knownPositions(state: GameState): PositionDef[] {
  return Object.values(POSITIONS).filter((p) => positionKnown(state, p.id));
}

// ---------- Legibility ----------

/**
 * Why a technique is or isn't about to fire — the card's one-line answer to
 * "what are you waiting for?". Mirrors pickActive's checks in pickActive's
 * order, so the reason shown is the first one the rotation would hit.
 */
export type TechniqueStatus =
  /** Out of combat, nothing statically wrong. */
  | { kind: 'ready' }
  /** In combat and eligible right now — fires at its next opportunity. */
  | { kind: 'primed' }
  /** Switched off by the player. */
  | { kind: 'off' }
  /** Its weapon family is not in hand. */
  | { kind: 'unarmed'; family: string }
  /** Its weapon-state requirement isn't met (nothing wielded/grounded/impaled/…). */
  | { kind: 'state'; needs: 'wielded' | 'grounded' | 'sheathed' | 'impaled' | 'readied' }
  | { kind: 'cooldown'; ticks: number }
  /** The fight hasn't put you where it fires from. */
  | { kind: 'position'; from: string[] }
  /** The baked reflex has nothing to answer (event stale / conditions unmet). */
  | { kind: 'trigger'; event?: string }
  /** The player's own overlay trigger is holding it back. */
  | { kind: 'gated' };

export function techniqueStatus(
  state: GameState,
  stats: DerivedStats,
  def: TechniqueDef,
): TechniqueStatus {
  const overlay = state.skillTriggers?.[`technique:${def.id}`];
  if (overlay?.enabled === false) return { kind: 'off' };
  if (!techniqueArmed(state, def)) return { kind: 'unarmed', family: def.family! };
  const gate = weaponStateGate(state, def);
  if (gate) return { kind: 'state', needs: gate };
  const combat = state.combat;
  if (!combat) return { kind: 'ready' };
  const cd = combat.cooldowns[`technique:${def.id}`] ?? 0;
  if (cd > 0) return { kind: 'cooldown', ticks: cd };
  const ctx: TriggerContext = { state, combat, stats };
  // The technique-wide read comes first: it gates every way in, so a stale one
  // is the honest answer even when the footing is right.
  if (!evaluateTrigger(ctx, def.trigger)) return { kind: 'trigger', event: def.trigger?.event };
  if (!openEntry(state, def, combat.position, ctx)) {
    // Standing somewhere a way admits, but that way is still waiting on its
    // own read — say THAT rather than blaming the footing.
    const here = techniqueEntries(state, def).find(
      (e) => e.at === 'any' || e.at.includes(combat.position),
    );
    if (here) return { kind: 'trigger', event: here.trigger?.event };
    const from = entryPositions(state, def);
    return { kind: 'position', from: from === 'any' ? [] : from };
  }
  if (!evaluateTrigger(ctx, overlay)) return { kind: 'gated' };
  return { kind: 'primed' };
}

// ---------- Debug hooks (DEV tooling writes through these) ----------

/** Wipe a technique back to unknown: entry, path, reps and drill slot. */
export function resetTechnique(state: GameState, id: string): void {
  if (state.techniques?.[id]) delete state.techniques[id];
  state.drilling = (state.drilling ?? []).filter((d) => d !== id);
}

/** Un-commit a fork path (debug only — in play the choice is permanent). */
export function clearFork(state: GameState, id: string): void {
  const held = state.techniques?.[id];
  if (held) delete held.path;
}

// ---------- Drilling ----------

export function isDrilled(state: GameState, id: string): boolean {
  return (state.drilling ?? []).includes(id);
}

/**
 * Add or remove a technique from the drill slots. Returns whether it is
 * drilled afterwards — a push into a full roster is refused, not queued.
 */
export function toggleDrill(state: GameState, id: string): boolean {
  const drilling = (state.drilling ??= []);
  const at = drilling.indexOf(id);
  if (at >= 0) {
    drilling.splice(at, 1);
    return false;
  }
  if (drilling.length >= MAX_DRILLED || !TECHNIQUES[id]) return false;
  drilling.push(id);
  return true;
}

/**
 * Count one execution toward mastery. Practice only counts for what is being
 * drilled; a free slot claims the technique automatically, so the roster only
 * needs managing once it is full. Returns a newly reached rung, for the feed.
 */
export function recordExecution(
  state: GameState,
  def: TechniqueDef,
): { tier: number; name: string } | undefined {
  const drilling = (state.drilling ??= []);
  if (!drilling.includes(def.id)) {
    if (drilling.length >= MAX_DRILLED) return undefined;
    drilling.push(def.id);
  }
  const held = state.techniques?.[def.id];
  if (!held) return undefined; // executing implies knowing; guard regardless
  const before = masteryTier(state, def);
  held.executions += 1;
  const after = masteryTier(state, def);
  if (after <= before) return undefined;
  return { tier: after, name: masteryTierName(def, after) ?? `tier ${after}` };
}
