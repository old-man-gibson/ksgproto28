import type {
  GameState,
  Loadout,
  Placement as ForgePlacement,
  SkillTrigger,
  TriggerCondition,
  TutorialWeapon,
} from './types';
import { activeRotation } from './systems/combat';
import { EventBus } from './engine/events';
import { TPS } from './engine/loop';
import { registerAchievementListeners } from './systems/achievements';
import { registerSuperAttrListeners } from './systems/superattrs';
import { acceptQuest, registerQuestListeners, talkTo, turnInQuest } from './systems/quests';
import { buy } from './systems/shops';
import { registerTitleListeners, setTitle } from './systems/titles';
import {
  chooseTutorialSpell,
  chooseTutorialWeapon,
  confirmTutorialStance,
  registerTutorialListeners,
  skipTutorial,
} from './systems/tutorial';
import { registerBestiaryListeners } from './systems/bestiary';
import { answerDare, dareHolds, registerTrainingListeners } from './systems/training';
import { registerLevelListeners } from './systems/levels';
import { setHuntRest } from './systems/huntrest';
import { registerMutagenListeners, syncGeneStatuses } from './systems/mutagens';
import {
  socketRune,
  unsocketRune,
  sellRune,
  discardRune,
  sellRunesBatch,
  discardRunesBatch,
} from './systems/runes';
import { carveRune } from './systems/runecarving';
import { brew, useFlask } from './systems/alchemy';
import { cook } from './systems/cooking';
import { startBenchWork, stopBenchWork, tickBenchWork, type BenchWorkStart } from './systems/benchwork';
import {
  createComposition,
  deleteComposition,
  startPerformance,
  stopPerformance,
  tickPerformance,
} from './systems/music';
import { tickChronosense } from './systems/chronosense';
import { tickExposure } from './systems/exposure';
import { DISCIPLINES } from './data/disciplines.data';
import { useConsumable } from './systems/consumables';
import { cancelQueuedMeal, eat, tickMeals } from './systems/eating';
import { handOffMeals, noteForeignDoses, tickMealClaims } from './systems/meals';
import {
  findSpell,
  forgetSpell,
  castUtility,
  inscribeArcane,
  preparedSpells,
  renameSpell,
  setPrepared,
  shapePsionic,
} from './systems/spellcraft';
import { forgetPsiShape, memorizePsiShape } from './systems/psionic';
import { assignFloatingFavor, learnMiracle } from './systems/divine';
import { chooseFork, teachSchool, teachTechnique, toggleDrill, toggleSheathe } from './systems/martial';
import { TECHNIQUES } from './data/martial.data';
import type { Placement } from './systems/disciplines';
import { tickAction, selectActivity, conditionClockRate } from './systems/actions';
import {
  tickTravel,
  startTravel,
  travelPlanTo,
  cancelTravelPlan,
  fastTravelTo,
  goAndDo,
  setJourneyIntent,
} from './systems/locations';
import { climbTo } from './systems/towers';
import { accrueBonusTime, bankTick, setBonusSpending, spendsBonusTick } from './systems/bonustime';
import {
  canEquip,
  equipItem,
  unequipSlot,
  sellItem,
  sellItems,
  sellMaterial,
  sellStackable,
  discardStackable,
  sellStackablesBatch,
  discardStackablesBatch,
  type StackRef,
} from './systems/equipment';
import { effectiveStyleId, stanceIdFor, styleUnlocked } from './systems/styles';
import { STYLES } from './registry';
import { appendLog } from './systems/log';
import { RESOURCE_LIST } from './data/resources.data';
import { resourceLock } from './systems/resources';
import { buyBoon, leaveReview, prestigeNow } from './systems/prestige';
import type { PsionicShape, QualityTier, ResourceId, ResourceLock, SlotId } from './types';
import { text } from './text/log';

/**
 * Copy the trigger overlays for `ids`, deeply. Both directions of a loadout
 * need this: a saved plan must not alias live state (editing a condition
 * would silently rewrite the plan), and applying one must not hand the live
 * state the plan's own arrays (the next edit would rewrite the plan again).
 * Entries with no overlay are simply absent — that IS "no conditions".
 */
function cloneTriggers(
  source: Record<string, SkillTrigger>,
  ids: string[],
): Record<string, SkillTrigger> {
  const out: Record<string, SkillTrigger> = {};
  for (const id of ids) {
    const trigger = source[id];
    if (!trigger) continue;
    out[id] = { ...trigger, conditions: trigger.conditions.map((c) => ({ ...c })) };
  }
  return out;
}

/**
 * The orchestrator. Owns the event bus wiring and exposes the tick function
 * plus every command the UI can issue. Holds a reference to the state object
 * it is given (which may be a reactive proxy created by the UI layer).
 */
export class Game {
  readonly bus = new EventBus();
  /** When true (offline catch-up), log events are counted but not stored. */
  suppressLog = false;
  /** Last style actually fought with, to announce loadout-driven swaps. */
  private lastEffectiveStyle: string;
  /** Last lockout seen per pool, to announce each transition exactly once. */
  private lastLocks: Partial<Record<ResourceId, ResourceLock>> = {};

  constructor(public state: GameState) {
    this.lastEffectiveStyle = effectiveStyleId(state);
    this.resyncAnnouncers();
    // Order matters: achievements bump counters (e.g. kills) that fusion
    // conditions may read, so they register first.
    registerAchievementListeners(state, this.bus);
    registerSuperAttrListeners(state, this.bus);
    registerQuestListeners(state, this.bus);
    registerBestiaryListeners(state, this.bus);
    // After the bestiary: a gene is harvested off the same kill the book
    // records, and the book should have the entry first.
    registerMutagenListeners(state, this.bus);
    // Titles last: their checks read counters the earlier listeners bump.
    registerTitleListeners(state, this.bus);
    // The tutorial only watches arrivals at the Foot (its exit).
    registerTutorialListeners(state, this.bus);
    // Training spots heal and dare off a won fight (systems/training.ts).
    registerTrainingListeners(state, this.bus);
    registerLevelListeners(state, this.bus);
    this.bus.on('log', (ev) => {
      if (this.suppressLog) return;
      appendLog(this.state, {
        msg: ev.msg,
        kind: ev.kind ?? 'info',
        t: this.state.totalTicks,
        ...(ev.group ? { group: ev.group, prefix: ev.prefix, tally: ev.tally } : {}),
      });
    });
  }

  /**
   * Advance the simulation by one logic tick (100 ms of game time). A paused
   * world does not advance for ANY caller — the real-time driver, offline
   * catch-up, or anything added later — so the only thing a pause can ever buy
   * you is time to look. `step()` is the one deliberate way past it.
   */
  tick(): void {
    if (this.state.paused) return;
    // A question the game is waiting on (the keeper's dare) holds the world.
    // The wall time spent deciding is banked as bonus time, not lost — which
    // is also what happens when the question lands while the player is away.
    if (dareHolds(this.state)) {
      bankTick(this.state);
      return;
    }
    this.advance();
    // Banked idle time, spent as a second tick. A whole extra advance, clock
    // included: double speed means the world runs double, not just the bar.
    if (spendsBonusTick(this.state)) {
      this.state.bonusTime.banked -= 1;
      this.advance();
    }
  }

  /**
   * Re-align the transition trackers with the current state. Required after
   * the state's CONTENTS are replaced wholesale under this Game — offline
   * catch-up, save import, hard reset — where the style or a pool lock may
   * have moved without ticking through here. Skipping it would announce a
   * phantom style swap or lock transition on the next tick.
   */
  resyncAnnouncers(): void {
    this.lastEffectiveStyle = effectiveStyleId(this.state);
    for (const def of RESOURCE_LIST) this.lastLocks[def.id] = resourceLock(this.state, def.id);
  }

  /**
   * One tick. The pause check lives in `tick()`; a held dare stops this too, so
   * the step buttons cannot walk past the question (or bank time doing it).
   */
  private advance(): void {
    if (dareHolds(this.state)) return;
    this.state.totalTicks += 1;
    // How far the conditions' clocks will advance this tick (none while
    // travelling, faster while knocked out): the dish slots keep time with them.
    const clock = this.state.travel ? 0 : conditionClockRate(this.state);
    // Idleness is judged before anything moves, so the tick that starts or
    // ends work is not banked as time spent doing nothing.
    accrueBonusTime(this.state);
    // What the body simply WEARS, kept in step with what the body currently is
    // — before anything ticks, so a gene slotted this tick is already knitting.
    // Outside the travel branch's else, because a poison does not care whether
    // you are walking and neither does the thing that stops you closing.
    syncGeneStatuses(this.state);
    // Before the world moves, so a queued dish is eaten on the first tick that
    // opens with no fight and no recovery, ahead of the hunt's next encounter
    // (a reloaded save has no fight and may start one on its first tick).
    tickMeals(this.state, this.bus);
    // After the queued dish: a dish that lands reconciles each condition onto its
    // leading claim, which may be the one lapsing this very tick; only a hand-off
    // that runs after it moves the condition on instead of letting it expire.
    handOffMeals(this.state, clock);
    if (this.state.travel) {
      tickTravel(this.state, this.bus);
    } else {
      tickAction(this.state, this.bus);
      tickBenchWork(this.state, this.bus);
      tickPerformance(this.state, this.bus);
    }
    // Time passes whatever you are doing — travel included — and the sense of
    // it grows from exactly that. The weather is equally indifferent.
    tickChronosense(this.state, this.bus);
    tickExposure(this.state, this.bus);
    // After the conditions have ticked: the dish slots' own clocks run down by
    // the same amount, and a claim that ran out stops counting.
    tickMealClaims(this.state, clock);
    this.checkStyleSwap();
    this.checkResourceLocks();
  }

  // ---------- Pause & stepping ----------

  /**
   * Freeze or resume the world. Global on purpose: pausing to read a fight
   * line by line must not double as a way to bank free gathering, crafting,
   * regen or respawn timers, so everything stops together.
   */
  setPaused(on: boolean): void {
    this.state.paused = on;
  }

  /** Flip the freeze; returns the state it landed in. */
  togglePause(): boolean {
    this.state.paused = !this.state.paused;
    return this.state.paused;
  }

  /**
   * Hand-crank the simulation, pause or no pause — this is what a step button
   * calls. One tick is 100 ms of game time; TPS ticks are a second.
   */
  step(ticks = 1): void {
    for (let i = 0; i < ticks; i++) this.advance();
  }

  /**
   * Step until the fight has something new to say, so a "turn" is one thing
   * happening rather than one tick. Gives up after `maxTicks` (ten seconds of
   * game time) so a lull — a respawn timer, a bar mid-fill, or not hunting at
   * all — can't run away with the loop. Returns the ticks actually taken,
   * which is how long the game waited for that line.
   */
  stepToEvent(maxTicks = 10 * TPS): number {
    const feed = this.state.combatFeed;
    const wasLen = feed.length;
    const wasLast = feed[wasLen - 1];
    for (let i = 1; i <= maxTicks; i++) {
      this.advance();
      const now = this.state.combatFeed;
      if (now.length !== wasLen || now[now.length - 1] !== wasLast) return i;
    }
    return maxTicks;
  }

  /**
   * Running a pool dry changes how you fight, so say so — once per transition,
   * not once per tick. Any source counts: your own stance, a drain, a poison.
   * The lines belong to the pool (resources.data.ts), so a new resource
   * announces itself without touching this method.
   */
  private checkResourceLocks(): void {
    for (const def of RESOURCE_LIST) {
      const reserve = def.reserve;
      if (!reserve) continue;
      const lock = resourceLock(this.state, def.id);
      if (lock === (this.lastLocks[def.id] ?? 'none')) continue;
      this.lastLocks[def.id] = lock;
      const msg =
        lock === 'empty' ? reserve.emptyMsg : lock === 'low' ? reserve.lowMsg : reserve.clearedMsg;
      this.bus.emit({ type: 'log', msg, kind: 'combat' });
    }
  }

  /**
   * Schools follow the loadout, so the style can change without the player
   * touching the stance buttons — say the word when it does.
   */
  private checkStyleSwap(): void {
    const id = effectiveStyleId(this.state);
    if (id === this.lastEffectiveStyle) return;
    const was = STYLES[this.lastEffectiveStyle];
    this.lastEffectiveStyle = id;
    const msg = STYLES[id].replaces
      ? text('game.school_engaged', { icon: STYLES[id].icon, was: was.name, now: STYLES[id].name })
      : text('game.school_released', { was: was.name, now: STYLES[id].name });
    this.bus.emit({ type: 'log', msg, kind: 'combat' });
  }

  // ---------- Commands (called by the UI) ----------

  selectActivity(id: string | null): void {
    selectActivity(this.state, this.bus, id);
  }

  travelTo(spotId: string): boolean {
    return startTravel(this.state, this.bus, spotId);
  }

  /** Auto-routed multi-leg walk to any discovered spot (map clicks). */
  travelPlanTo(spotId: string): boolean {
    return travelPlanTo(this.state, this.bus, spotId);
  }

  cancelTravelPlan(): void {
    cancelTravelPlan(this.state, this.bus);
  }

  /** Walk to a spot and start an activity on arrival (or now, if already there). */
  goAndDo(spotId: string, activityId: string): boolean {
    return goAndDo(this.state, this.bus, spotId, activityId);
  }

  /** Set (or with null, clear) the activity the journey in progress ends in. */
  setJourneyIntent(activityId: string | null): boolean {
    return setJourneyIntent(this.state, activityId);
  }

  /** Spend banked idle time as double speed, or stop spending it. */
  setBonusSpending(on: boolean): void {
    setBonusSpending(this.state, on);
  }

  fastTravelTo(spotId: string): boolean {
    return fastTravelTo(this.state, this.bus, spotId);
  }

  /** Ride a tower's ladder to a floor — or, with null, back down to its hub. */
  climbTo(floorId: string | null): boolean {
    return climbTo(this.state, this.bus, floorId);
  }

  /** Equip an item; `slot` forces a hand (off-hand sword, main-hand buckler). */
  equip(uid: number, slot?: SlotId): void {
    equipItem(this.state, this.bus, uid, slot);
  }

  unequip(slot: keyof GameState['equipment']): void {
    unequipSlot(this.state, slot);
  }

  sell(uid: number): void {
    sellItem(this.state, this.bus, uid);
  }

  /** Sell a batch as one transaction — a single log line for the whole lot. */
  sellMany(uids: number[]): void {
    sellItems(this.state, this.bus, uids);
  }

  sellMaterial(materialId: string): void {
    sellMaterial(this.state, this.bus, materialId);
  }

  /** Sell some of a held provision/ingredient grade. */
  sellStackable(id: string, quality: QualityTier, qty: number): void {
    sellStackable(this.state, this.bus, id, quality, qty);
  }

  /** Dump some of a held provision/ingredient grade — no gold. */
  discardStackable(id: string, quality: QualityTier, qty: number): void {
    discardStackable(this.state, this.bus, id, quality, qty);
  }

  /** Sell many whole stacks at once (pouch housekeeping). */
  sellStackablesBatch(refs: StackRef[], noun?: string): void {
    sellStackablesBatch(this.state, this.bus, refs, noun);
  }

  /** Dump many whole stacks at once (pouch housekeeping). */
  discardStackablesBatch(refs: StackRef[], noun?: string): void {
    discardStackablesBatch(this.state, this.bus, refs, noun);
  }

  /** Sell many loose runes at once. */
  sellRunesBatch(refs: string[]): void {
    sellRunesBatch(this.state, this.bus, refs);
  }

  /** Dump many loose runes at once. */
  discardRunesBatch(refs: string[]): void {
    discardRunesBatch(this.state, this.bus, refs);
  }

  /** Sell one loose rune (catalogue id or `carved:<i>`). */
  sellRune(ref: string): void {
    sellRune(this.state, this.bus, ref);
  }

  /** Throw one loose rune away. */
  discardRune(ref: string): void {
    discardRune(this.state, this.bus, ref);
  }

  acceptQuest(questId: string): void {
    acceptQuest(this.state, this.bus, questId);
  }

  /** A first greeting with whoever is standing here (see systems/quests.ts). */
  talkTo(npcId: string): boolean {
    return talkTo(this.state, this.bus, npcId);
  }

  /** Take a lesson from a teacher (`NpcDef.teaches`); see systems/martial.ts. */
  learnFromTeacher(npcId: string, techniqueId: string): boolean {
    return teachTechnique(this.state, this.bus, npcId, techniqueId);
  }

  /** Take a school lesson from a teacher: manifests the school's skill; see systems/martial.ts. */
  learnSchoolFromTeacher(npcId: string, skillId: string): boolean {
    return teachSchool(this.state, this.bus, npcId, skillId);
  }

  /** Buy from a vendor's shelf; see systems/shops.ts. Returns how many were bought. */
  buy(npcId: string, index: number, qty = 1): number {
    return buy(this.state, this.bus, npcId, index, qty);
  }

  turnInQuest(questId: string): void {
    turnInQuest(this.state, this.bus, questId);
  }

  socketRune(uid: number, runeId: string): void {
    socketRune(this.state, this.bus, uid, runeId);
  }

  unsocketRune(uid: number, index: number): void {
    unsocketRune(this.state, this.bus, uid, index);
  }

  /** Work the carving bench with whatever is laid out on it. */
  carveRune(placement: Placement) {
    return carveRune(this.state, this.bus, placement);
  }

  /** Work a cooking bench — the stove by default, or any method bench by id. */
  cook(placement: Placement, disciplineId = 'cooking', duration?: number) {
    return cook(this.state, this.bus, placement, DISCIPLINES[disciplineId], duration);
  }

  /** Work the alembic: read the sequence laid out and bottle what it spells. */
  brew(placement: Placement, disciplineId = 'alchemy') {
    return brew(this.state, this.bus, placement, DISCIPLINES[disciplineId]);
  }

  /** Drink, apply or throw a flask — its sequence already decided which. */
  useFlask(index: number) {
    const used = useFlask(this.state, this.bus, index);
    // A flask's dose may be ignored by a stronger dish's condition; the dish
    // slots still record it, with its own clock (systems/meals.ts).
    if (used) noteForeignDoses(this.state, used.grants);
    return used;
  }

  /** Start a repeating run at a bench (batch prepping). */
  startBenchWork(disciplineId: string, placement: Placement, opts: BenchWorkStart): boolean {
    return startBenchWork(this.state, this.bus, disciplineId, placement, opts);
  }

  stopBenchWork(): void {
    stopBenchWork(this.state, this.bus);
  }

  /**
   * Start forging at the anvil: one placement, `count` pieces (null = until the
   * stock runs out). Nothing is spent until a piece lands, and leaving or
   * fighting cancels the job at no cost. Refused, with the reason logged, when
   * the placement is not forgeable right now (`previewForge` says why first).
   */
  forge(placement: ForgePlacement, count: number | null = 1): boolean {
    return startBenchWork(this.state, this.bus, 'forging', {}, { count, forge: placement });
  }

  /** Eat, drink or apply something from stock. */
  useConsumable(id: string, quality: QualityTier = 'c') {
    return useConsumable(this.state, this.bus, id, quality);
  }

  /**
   * What the Eat button calls: use it now, or, for a dish during a fight, queue
   * it for the end of the fight (systems/eating.ts).
   */
  eat(id: string, quality: QualityTier = 'c') {
    return eat(this.state, this.bus, id, quality);
  }

  /** Take the queued dish off the queue. */
  cancelQueuedMeal() {
    return cancelQueuedMeal(this.state, this.bus);
  }

  // ---------- Music ----------

  /** A fresh four-bar sheet. Note editing goes through systems/music.ts directly. */
  createComposition() {
    return createComposition(this.state);
  }

  deleteComposition(id: number): void {
    deleteComposition(this.state, this.bus, id);
  }

  /** Take the stage with a finished sheet. */
  startPerformance(compositionId: number): boolean {
    return startPerformance(this.state, this.bus, compositionId);
  }

  stopPerformance(): void {
    stopPerformance(this.state, this.bus);
  }

  // ---------- Spellcraft ----------

  /** Speak an arcane sentence into the grimoire. */
  inscribeArcane(words: string[]) {
    return inscribeArcane(this.state, this.bus, words);
  }

  /** Receive a miracle, spending favor with its deity. */
  learnMiracle(miracleId: string) {
    return learnMiracle(this.state, this.bus, miracleId);
  }

  /** Place one unassigned favor (later votive tokens) with a known god. */
  assignFloatingFavor(deityId: string) {
    return assignFloatingFavor(this.state, this.bus, deityId);
  }

  /** Rest before the next fight below `at` (share of max HP, 0 = off), to full or to `at`. */
  setHuntRest(at: number, toFull: boolean) {
    setHuntRest(this.state, at, toFull);
  }

  /** Answer the keeper's waiting dare: fight it (true) or pass (false). */
  answerDare(accept: boolean) {
    return answerDare(this.state, this.bus, accept);
  }

  /** Shape a psionic working from force/reach/grip points. */
  shapePsionic(shape: PsionicShape) {
    return shapePsionic(this.state, this.bus, shape);
  }

  /** Hold an allocation in mind, so it can be recalled without re-dialling it. */
  memorizePsiShape(shape: PsionicShape, name?: string) {
    return memorizePsiShape(this.state, shape, name);
  }

  forgetPsiShape(index: number) {
    return forgetPsiShape(this.state, index);
  }

  /** Ready a spell for combat, or stand it down. */
  prepareSpell(uid: number, prepared: boolean) {
    return setPrepared(this.state, this.bus, uid, prepared);
  }

  /** Cast a working on yourself with no fight on (hastes, wards, mendings). */
  castUtility(uid: number) {
    return castUtility(this.state, this.bus, uid);
  }

  renameSpell(uid: number, name: string) {
    return renameSpell(this.state, uid, name);
  }

  forgetSpell(uid: number) {
    return forgetSpell(this.state, uid);
  }

  setTitle(titleId: string | null): void {
    setTitle(this.state, this.bus, titleId);
  }

  /**
   * Pick a stance. Selection is always stored as the generic stance — a school
   * id (from an old save or a stale UI) normalizes to the stance it replaces,
   * since schools are worn by the loadout, not chosen.
   */
  setStyle(styleId: string): void {
    const stanceId = stanceIdFor(styleId);
    const def = STYLES[stanceId];
    if (!def || this.state.style === stanceId) return;
    if (!styleUnlocked(this.state, def)) return;
    this.state.style = stanceId;
    this.lastEffectiveStyle = effectiveStyleId(this.state);
    const active = STYLES[this.lastEffectiveStyle];
    this.bus.emit({ type: 'log', msg: text('game.style_changed', { name: active.name }), kind: 'combat' });
  }

  /**
   * Opt in or out of the current style's stamina bargain. Fighting always
   * costs a little; this is the switch for spending real reserves on it.
   */
  setExerting(on: boolean): void {
    if (this.state.exerting === on) return;
    this.state.exerting = on;
    this.bus.emit({
      type: 'log',
      msg: on
        ? text('game.exerting_on', { style: STYLES[effectiveStyleId(this.state)].name })
        : text('game.exerting_off'),
      kind: 'combat',
    });
  }

  // ---------- The tutorial (floor 0) ----------

  /** The rack in the holding cell: one weapon, a shield beside a one-handed pick. Once per life. */
  chooseTutorialWeapon(weapon: TutorialWeapon, shield = false): boolean {
    return chooseTutorialWeapon(this.state, this.bus, weapon, shield);
  }

  /** Set the stance through the real control, then stamp the tutorial's step. */
  chooseTutorialStance(styleId: string): boolean {
    this.setStyle(styleId);
    return confirmTutorialStance(this.state, this.bus);
  }

  /** One word into the grimoire, prepared, with the Intelligence to cast it. Once per life. */
  chooseTutorialSpell(word: string): boolean {
    return chooseTutorialSpell(this.state, this.bus, word);
  }

  /** End the tutorial now: defaults for every choice not made, and the Foot. */
  skipTutorial(): boolean {
    return skipTutorial(this.state, this.bus);
  }

  // ---------- Active-skill rotation & triggers ----------

  /** The stored trigger for a skill, created on demand. */
  private trigger(skillId: string): SkillTrigger {
    const existing = this.state.skillTriggers[skillId];
    if (existing) return existing;
    const fresh: SkillTrigger = { conditions: [] };
    this.state.skillTriggers[skillId] = fresh;
    return fresh;
  }

  setSkillEnabled(skillId: string, enabled: boolean): void {
    this.trigger(skillId).enabled = enabled;
  }

  setSkillEvent(skillId: string, event: string | undefined): void {
    const t = this.trigger(skillId);
    if (event) t.event = event;
    else delete t.event;
  }

  addSkillCondition(skillId: string, cond: TriggerCondition): void {
    this.trigger(skillId).conditions.push(cond);
  }

  updateSkillCondition(skillId: string, index: number, patch: Partial<TriggerCondition>): void {
    const cond = this.trigger(skillId).conditions[index];
    if (cond) Object.assign(cond, patch);
  }

  removeSkillCondition(skillId: string, index: number): void {
    this.trigger(skillId).conditions.splice(index, 1);
  }

  /**
   * The stored order, materialised: seeded from the effective rotation the
   * first time it is touched, with anything that joined since (a newly
   * prepared spell, a newly learned technique) appended.
   */
  private materialisedOrder(): string[] {
    if (this.state.skillOrder.length === 0) this.state.skillOrder = activeRotation(this.state);
    const order = this.state.skillOrder;
    for (const id of activeRotation(this.state)) if (!order.includes(id)) order.push(id);
    return order;
  }

  /** Move a skill (or prepared spell) up (-1) or down (+1) in the rotation. */
  moveSkill(skillId: string, delta: number): void {
    const order = this.materialisedOrder();
    const from = order.indexOf(skillId);
    if (from === -1) return;
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
  }

  /**
   * Place `skillId` immediately before `beforeId` (or at the end when null) —
   * the drag-and-drop primitive, and what the arrows use to step across
   * VISIBLE neighbours: hidden (benched) entries between two cards simply
   * travel along instead of eating the click.
   */
  moveSkillTo(skillId: string, beforeId: string | null): void {
    const order = this.materialisedOrder();
    const from = order.indexOf(skillId);
    if (from === -1 || skillId === beforeId) return;
    order.splice(from, 1);
    const at = beforeId === null ? order.length : order.indexOf(beforeId);
    if (at === -1) order.splice(from, 0, skillId); // unknown target: put it back
    else order.splice(at, 0, skillId);
  }

  // ---------- Loadouts ----------

  /**
   * Snapshot the current plan — order, bench switches, drills, firing
   * conditions, prepared spells and worn equipment — under a name. A whole
   * fighting identity in one slot, not just the active-skill rotation.
   */
  saveLoadout(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const order = [...this.materialisedOrder()];
    const equipment: Partial<Record<SlotId, number>> = {};
    for (const [slot, item] of Object.entries(this.state.equipment) as [SlotId, GameState['equipment'][SlotId]][]) {
      if (item) equipment[slot] = item.uid;
    }
    const loadout: Loadout = {
      name: trimmed,
      order,
      benched: order.filter((id) => this.state.skillTriggers[id]?.enabled === false),
      drilling: [...this.state.drilling],
      triggers: cloneTriggers(this.state.skillTriggers, order),
      spells: preparedSpells(this.state).map((s) => s.uid),
      equipment,
    };
    const at = this.state.loadouts.findIndex((l) => l.name === trimmed);
    if (at >= 0) this.state.loadouts[at] = loadout;
    else this.state.loadouts.push(loadout);
  }

  /**
   * Apply a saved plan. Grants nothing: unknown ids in the order are inert
   * (the rotation already ignores them), drilling filters to techniques still
   * known, spells re-prepare only if still in the grimoire (and within the
   * prepared cap), and equipment re-equips a slot only if its uid is still
   * owned and still equippable — everything else is left exactly as it was.
   *
   * Firing conditions are restored WHOLESALE when the plan carries them: an
   * ordered entry the plan doesn't mention has its overlay cleared, because a
   * plan you saved should be the plan you get back, not the plan plus
   * whatever you have fiddled with since. Plans from before triggers were
   * captured fall back to their bench switches, which is all they ever knew.
   */
  applyLoadout(name: string): void {
    const loadout = this.state.loadouts.find((l) => l.name === name);
    if (!loadout) return;
    this.state.skillOrder = [...loadout.order];
    if (loadout.triggers) {
      for (const id of loadout.order) delete this.state.skillTriggers[id];
      Object.assign(this.state.skillTriggers, cloneTriggers(loadout.triggers, loadout.order));
    } else {
      for (const id of loadout.order) this.setSkillEnabled(id, !loadout.benched.includes(id));
    }
    this.state.drilling = loadout.drilling.filter((id) => !!this.state.techniques[id]);

    const wantSpells = new Set(loadout.spells ?? []);
    for (const spell of preparedSpells(this.state)) {
      if (!wantSpells.has(spell.uid)) setPrepared(this.state, this.bus, spell.uid, false);
    }
    for (const uid of wantSpells) {
      if (findSpell(this.state, uid)) setPrepared(this.state, this.bus, uid, true);
    }

    for (const [slot, uid] of Object.entries(loadout.equipment ?? {}) as [SlotId, number][]) {
      if (this.state.equipment[slot]?.uid === uid) continue; // already worn there
      // equipItem only pulls from the pack — a piece worn in a DIFFERENT slot
      // right now (not this one) is a rare enough case to just leave be.
      const owned = this.state.inventory.find((i) => i.uid === uid);
      if (owned && canEquip(this.state, owned)) this.equip(uid, slot);
    }

    this.bus.emit({ type: 'log', msg: text('game.loadout_applied', { name: loadout.name }), kind: 'combat' });
  }

  deleteLoadout(name: string): void {
    const at = this.state.loadouts.findIndex((l) => l.name === name);
    if (at >= 0) this.state.loadouts.splice(at, 1);
  }

  /** Add or remove a technique from the drill slots (see systems/martial.ts). */
  toggleDrill(techniqueId: string): void {
    toggleDrill(this.state, techniqueId);
  }

  /** Commit a technique's Honed fork choice — permanent (see systems/martial.ts). */
  chooseFork(techniqueId: string, archetypeId: string): void {
    const def = TECHNIQUES[techniqueId];
    if (def) chooseFork(this.state, def, archetypeId);
  }

  /** Sheathe the wielded dagger (concealed carry) or draw it back by hand. */
  toggleSheathe(): void {
    toggleSheathe(this.state);
  }

  // ---- Prestige (systems/prestige.ts) ----

  /**
   * End the run. The next run's state is assigned INTO the state object so
   * every listener registered against it keeps working — the same move
   * `hardReset` makes. False if the run cannot prestige yet.
   */
  prestige(now = Date.now()): boolean {
    const next = prestigeNow(this.state, now);
    if (!next) return false;
    Object.assign(this.state, next);
    this.resyncAnnouncers();
    this.bus.emit({
      type: 'log',
      msg: text('game.prestiged', { count: next.prestige.count, points: next.prestige.lastHarvest?.total ?? 0 }),
      kind: 'info',
    });
    return true;
  }

  buyBoon(boonId: string): boolean {
    return buyBoon(this.state, this.bus, boonId);
  }

  leavePrestigeReview(): void {
    leaveReview(this.state);
  }
}
