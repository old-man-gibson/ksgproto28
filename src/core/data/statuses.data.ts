import type { StatusDef } from '../types';
import { prose } from '../text/prose';
import { STATUSES_TEXT } from '../text/statuses.text';

/**
 * Negative status conditions.
 *
 * Each element has a *signature* condition — the one its damage usually
 * inflicts — but nothing here is the exclusive property of a damage type. Fire
 * is the usual way to be set alight; it is not the only one.
 *
 * Conditions come in pairs: a base and the worse thing it becomes when it is
 * pushed far enough. The base names its `escalatesTo`, the escalation names the
 * `baseForm` it can be talked back down to, and between them they describe a
 * ladder the player climbs by being careless and descends by being treated.
 *
 * Durations are in ticks (10 per second).
 *
 * Balance note: every number here is a first pass. Intensities are the dial —
 * a source declares how hard it hits, and everything below scales off that.
 */

const SECOND = 10;

export const STATUSES = prose<StatusDef>('STATUSES', STATUSES_TEXT, {
  toll_steam: {
    id: 'toll_steam', name: 'Steam-blinded', icon: '♨️', duration: 80,
    unresistable: "environmental: a phase of the Toll Collector's fight",
    stacking: { mode: 'highest', cap: 1, refreshDuration: true }, missChance: 0.65,
  },
  toll_ice: {
    id: 'toll_ice', name: 'Ice-locked Joints', icon: '🧊', duration: 80,
    unresistable: "environmental: a phase of the Toll Collector's fight",
    stacking: { mode: 'highest', cap: 1, refreshDuration: true },
    mods: [{ stat: 'dodge', op: 'mult', value: -1 }, { stat: 'armor', op: 'mult', value: -0.75 }],
  },
  toll_overdrive: {
    id: 'toll_overdrive', name: 'Stamping Overdrive', icon: '⚡', duration: 80,
    unresistable: "environmental: a phase of the Toll Collector's fight",
    stacking: { mode: 'highest', cap: 1, refreshDuration: true },
    mods: [{ stat: 'attackSpeed', op: 'mult', value: 0.65 }],
    bar: { onFill: { type: 'lightning', flat: 12 } },
  },
  /*
   * EYELESS — nothing to put out.
   *
   * Hidden and permanent, carrying no effect: like `knitting`, it is a PLACE
   * for a rule rather than a rule itself. Blindness and dazzle name it in their
   * `blockedBy`, so immunity is expressed by the conditions that would land
   * rather than by a check scattered wherever they are applied — and anything
   * else that wants to be immune only has to be given this.
   */
  eyeless: {
    id: 'eyeless',
    name: 'Eyeless',
    icon: '🕳️',
    hidden: true,
    stacking: { mode: 'highest', cap: 1 },
    duration: null,
    removal: [{ on: 'combatEnd', effect: 'remove' }],
  },

  /*
   * REFUTATION — a shield made of the argument itself.
   *
   * `ward` is a flat absorb after resistances, so this stops a fixed bite out
   * of every blow rather than a share of it — best against many small hits,
   * which is exactly what a caster refusing the world tends to be facing.
   * Half of it is flat and half reads off spell power, so it is worth having
   * early and worth building for later.
   *
   * `retaliate` is what makes it more than a wall: anything that strikes it
   * gets pierced for the trouble, and `onContact` (never `onAttack`) is what
   * makes it answer being HIT rather than answering your own swings.
   */
  refutation: {
    id: 'refutation',
    name: 'Refutation',
    icon: '🚫',
    stacking: { mode: 'highest', cap: 1 },
    duration: 15 * SECOND,
    mods: [
      { stat: 'ward', op: 'add', value: 40 },
      { stat: 'ward', op: 'add', value: 1.5, fromStat: 'spellPower' },
    ],
    retaliate: {
      type: 'piercing',
      flat: 6,
      onContact: true,
      inflicts: [{ id: 'punctured', intensity: 1 }],
    },
  },

  /*
   * KNITTING — the implicit half of a regenerating body.
   *
   * Hidden, permanent, and carrying no mods of its own: it is not an effect,
   * it is a PLACE for a rule to live. What douses a body used to be
   * `DOUSING_TYPES`, a constant in health.ts shared by everything alive, which
   * meant a troll's weakness was a property of the game rather than of the
   * troll. A condition carries its own `removal`, so the gene that confers this
   * writes its own trigger types into the application — and anything that
   * rewrites those types (a nuclease) has something to grip.
   *
   * `blockedBy: doused` is what makes the pair a state machine: the per-tick
   * sync cannot put knitting back on while the body is still burning, so
   * dousing lasts its four seconds rather than one tick.
   */
  knitting: {
    id: 'knitting',
    name: 'Knitting',
    icon: '🩹',
    hidden: true,
    stacking: { mode: 'highest', cap: 1 },
    duration: null,
    blockedBy: ['doused'],
    // The DEFAULT answer, for anything that confers this without naming its
    // own. A conferring gene overrides it wholesale (`StatusApplication.removal`
    // beats `def.removal`), which is the entire point — but a permanent
    // condition with no way out is a trap whoever applied it, so the pair that
    // used to be hardcoded in health.ts survives here as the fallback.
    removal: [
      { on: 'damageTaken', damageTypes: ['heat', 'acid'], effect: 'remove', becomes: 'doused' },
    ],
  },

  doused: {
    id: 'doused',
    name: 'Doused',
    icon: '💢',
    // No element of its own: what douses a regenerating body is the FACT of
    // heat or acid arriving, not any particular source of it.
    unresistable: 'ruled no resistance (2026-10-24)',
    stacking: { mode: 'highest', cap: 1 },
    duration: 4 * SECOND,
    // Zeroes regeneration rather than slowing it. A troll that is on fire is
    // not knitting slowly, it is not knitting.
    mods: [{ stat: 'hpRegen', op: 'mult', value: -1 }],
  },

  // ---------- Acid: corrosion ----------
  //
  // Acid's signature eats ARMOUR rather than health, which makes it the answer
  // to a thing that is HARD where poison answers a thing that is tough. Nothing
  // else in the roster attacks a defence instead of a pool.
  //
  // ⚠️ Both of these bite on the PLAYER only. Monsters carry no armour at all
  // (monsterStats.ts has none) and their resistances are def-level and static,
  // with MONSTER_STAT_KEYS gating status mods away from both. Until a monster
  // can be worn down, corroding one is inert — see docs/MUTAGENS.md.

  corroded: {
    id: 'corroded',
    name: 'Corroded',
    icon: '🧪',
    element: 'acid',
    escalatesTo: 'melting',
    // Doses ADD, because corrosion is cumulative in a way venom is not — a
    // second splash eats what the first one left, and enough of them stop
    // being a harness problem and start being a skin problem.
    stacking: { mode: 'sum', cap: 6, onCap: 'escalate' },
    duration: 25 * SECOND,
    // Linear in intensity, as specified: each point of corrosion is another
    // bite out of what you are wearing.
    mods: [{ stat: 'armor', op: 'mult', value: -0.12 }],
  },

  melting: {
    id: 'melting',
    name: 'Melting',
    icon: '🫗',
    element: 'acid',
    baseForm: 'corroded',
    stacking: { mode: 'highest', cap: 4 },
    duration: 15 * SECOND,
    mods: [
      // Armour stops giving anything at all, rather than merely giving less.
      { stat: 'armor', op: 'mult', value: -1 },
      // ...and the three the spec names, which are the ones a ruined harness
      // stops answering: nothing to spread a blow, nothing to hold a
      // temperature. These are the EXPLICIT penalties, on top of the implicit
      // ones that follow from having no armour left.
      { stat: 'resBludgeoning', op: 'add', value: -0.12 },
      { stat: 'resHeat', op: 'add', value: -0.12 },
      { stat: 'resCold', op: 'add', value: -0.12 },
    ],
  },

  // ---------- Nature: poison ----------

  poison: {
    id: 'poison',
    name: 'Poisoned',
    icon: '🤢',
    element: 'poison',
    escalatesTo: 'rotting',
    // A second bite of the same venom teaches the body nothing new — only a
    // STRONGER dose matters, and enough of them turn the wound septic.
    stacking: { mode: 'highest', cap: 4, onCap: 'escalate' },
    duration: 30 * SECOND,
    // An antidote ('poison' is the tag alchemy's Mendroot salve carries) ends it.
    removal: [{ on: 'cure', tag: 'poison', effect: 'remove' }],
    dot: { type: 'poison', flat: 0.05 },
    mods: [{ stat: 'staminaRegen', op: 'mult', value: -0.2 }],
  },

  rotting: {
    id: 'rotting',
    name: 'Rotting',
    icon: '🦠',
    element: 'poison',
    baseForm: 'poison',
    stacking: { mode: 'highest' },
    duration: 45 * SECOND,
    // One antidote brings it back to ordinary poison; the next one ends that.
    removal: [{ on: 'cure', tag: 'poison', effect: 'deescalate' }],
    dot: { type: 'poison', flat: 0.12 },
    mods: [{ stat: 'staminaRegen', op: 'mult', value: -0.35 }],
    // Half of everything you spend is eaten rather than merely used.
    ceilingFromSpend: { resource: 'stamina', share: 0.5, max: 0.6 },
    // What it ate does not return the moment the rot passes.
    expiresTo: 'rot_recovery',
  },

  rot_recovery: {
    id: 'rot_recovery',
    name: 'Wasted',
    icon: '🩹',
    stacking: { mode: 'highest' },
    duration: null, // ends when the debt has been paid back
    ceilingDecay: 0.0008, // ~20s to recover a 60% loss
    hidden: true,
  },

  // ---------- Heat: burning ----------

  on_fire: {
    id: 'on_fire',
    name: 'On Fire',
    icon: '🔥',
    element: 'heat',
    escalatesTo: 'blazing',
    // Half of each new flame feeds the existing one; the clock is untouched.
    stacking: { mode: 'absorb', absorb: 0.5, cap: 5, onCap: 'escalate' },
    duration: 8 * SECOND,
    dot: { type: 'heat', flat: 0.4 },
  },

  blazing: {
    id: 'blazing',
    name: 'Blazing',
    icon: '🔥',
    element: 'heat',
    baseForm: 'on_fire',
    stacking: { mode: 'absorb', absorb: 0.25 },
    duration: 4 * SECOND,
    dot: { type: 'heat', flat: 0.9 },
    /** Healing may undo at most half of what the blaze has burned off. */
    healCap: 0.5,
    // The flames go out quickly; the burn they leave does not.
    expiresTo: 'blaze_burn',
  },

  blaze_burn: {
    id: 'blaze_burn',
    name: 'Seared',
    icon: '🩸',
    element: 'heat',
    stacking: { mode: 'highest' },
    duration: null,
    healCap: 0.5,
    // Only deliberate treatment closes it. Idling at work will not.
    removal: [{ on: 'heal', healKinds: ['rest', 'salve', 'spell'], effect: 'remove' }],
  },

  // ---------- Cold: chill ----------

  chilled: {
    id: 'chilled',
    name: 'Chilled',
    icon: '🥶',
    element: 'cold',
    escalatesTo: 'frozen',
    // Chill accumulates plainly. At full depth it stops being a chill.
    stacking: { mode: 'sum', cap: 1, onCap: 'escalate' },
    duration: 20 * SECOND,
    dot: undefined,
    mods: [{ stat: 'speed', op: 'mult', value: -0.4 }],
    // Numb fingers get less out of a fine weapon (see statusDampingFor).
    damp: { slot: 'weapon', per: 0.5, max: 0.6 },
    blockedBy: ['frozen'],
  },

  frozen: {
    id: 'frozen',
    name: 'Frozen',
    icon: '🧊',
    element: 'cold',
    baseForm: 'chilled',
    stacking: { mode: 'highest' },
    duration: 3 * SECOND,
    // All but immobile: the action bar barely creeps.
    mods: [
      { stat: 'speed', op: 'mult', value: -0.95 },
      // Brittle: bludgeoning finds far more purchase than usual.
      { stat: 'resBludgeoning', op: 'add', value: -0.5 },
    ],
    // The ice cannot survive being hit.
    removal: [{ on: 'damageTaken', effect: 'remove' }],
  },

  // ---------- Slashing: bleeding ----------

  bleeding: {
    id: 'bleeding',
    name: 'Bleeding',
    icon: '🩸',
    element: 'slashing',
    escalatesTo: 'lacerated',
    // Every fresh cut is its own wound.
    stacking: { mode: 'count', cap: 5, onCap: 'escalate' },
    // Nothing but treatment stops it — that is what makes a bleed a bleed, and
    // the treatment has to be DELIBERATE. The passive trickle you get from
    // working quietly is not first aid; if it counted, a wound would close
    // itself one tick after the fight ended and `outOfCombat` below would never
    // mean anything.
    duration: null,
    removal: [
      { on: 'heal', healKinds: ['rest', 'salve', 'spell'], effect: 'remove' },
      // A styptic ('bleed' is the tag alchemy's Mendroot salve carries).
      { on: 'cure', tag: 'bleed', effect: 'remove' },
    ],
    // Several cuts bleed more blood (the flat part adds up), but they do not
    // each open you wider — the proportional part is the deepest cut alone.
    dot: {
      type: 'slashing',
      flat: 0.08,
      currentHp: 0.0015,
      fromPeak: ['currentHp'],
      outOfCombat: 0.3,
    },
  },

  lacerated: {
    id: 'lacerated',
    name: 'Lacerated',
    icon: '🔪',
    element: 'slashing',
    baseForm: 'bleeding',
    stacking: { mode: 'count', cap: 5 },
    duration: null,
    // One treatment brings it back to an ordinary bleed; the next one closes it.
    removal: [
      { on: 'heal', healKinds: ['rest', 'salve', 'spell'], effect: 'deescalate' },
      { on: 'cure', tag: 'bleed', effect: 'deescalate' },
    ],
    dot: { type: 'slashing', maxHp: 0.002, outOfCombat: 0.3 },
    ceilings: [{ resource: 'hp', per: 0.04, max: 0.3 }],
  },

  // ---------- Bludgeoning: concussion ----------

  concussed: {
    id: 'concussed',
    name: 'Concussed',
    icon: '💫',
    element: 'bludgeoning',
    escalatesTo: 'dazed',
    stacking: { mode: 'highest', cap: 3, onCap: 'escalate' },
    duration: 25 * SECOND,
    blocks: ['spell'],
    missChance: 0.12,
    // It clears with your head, which is to say: as you recover.
    removal: [{ on: 'heal', healKinds: ['rest', 'salve', 'spell'], effect: 'reduce', amount: 0.4 }],
  },

  dazed: {
    id: 'dazed',
    name: 'Dazed',
    icon: '😵',
    element: 'bludgeoning',
    baseForm: 'concussed',
    stacking: { mode: 'count', cap: 4 },
    duration: null,
    blocks: ['spell', 'attack'],
    bar: { skip: 1 },
    // One action lost per instance — the bar completing is what spends it.
    // The bar only turns in a fight, so the end of one has to let go of what
    // is left: otherwise being knocked out while dazed keeps the daze forever.
    removal: [
      { on: 'barFill', effect: 'unstack' },
      { on: 'combatEnd', effect: 'remove' },
    ],
  },

  // ---------- Piercing: puncture ----------

  punctured: {
    id: 'punctured',
    name: 'Punctured',
    icon: '🕳️',
    element: 'piercing',
    escalatesTo: 'perforated',
    stacking: { mode: 'sum', cap: 3, onCap: 'escalate' },
    // Slow to close, and it keeps weeping while it is open.
    duration: 40 * SECOND,
    costMult: { resource: 'stamina', per: 0.25, max: 1 },
    ceilingPerTick: { resource: 'stamina', per: 0.0004, max: 0.05 },
  },

  perforated: {
    id: 'perforated',
    name: 'Perforated',
    // The blade emoji belongs to the condition that has an actual blade in it
    // (weapon_impalement); this one is what is left AFTER things came out.
    icon: '🫗',
    element: 'piercing',
    // The colour the stance grid wears while this is dictating your footing.
    color: '#c2504f',
    baseForm: 'punctured',
    stacking: { mode: 'count', cap: 5 },
    duration: 60 * SECOND,
    // No stance survives this — you fight plainly or not at all.
    forceStyle: 'balanced',
    blocksRegen: ['stamina'],
    ceilings: [{ resource: 'stamina', per: 0.05, max: 0.4 }],
  },

  // ---------- Lightning: the jolt ----------

  jolted: {
    id: 'jolted',
    name: 'Jolted',
    icon: '⚡',
    element: 'lightning',
    escalatesTo: 'shocked',
    /*
     * Shocked is the most dangerous thing on this ladder — it runs the action
     * bar BACKWARDS — so reaching it is a roll rather than a sum you can
     * arrange. Past `escalateFrom` every dose rolls, with the odds riding the
     * charge until the cap makes it certain: you can see it coming, you cannot
     * schedule it. `escalateFrom` sits at 2 so a modest coating is a real
     * gamble rather than a locked door — a C-grade storm oil settles around
     * 2.7 and a perfect one blows straight past the cap.
     */
    stacking: { mode: 'absorb', absorb: 1, cap: 6, onCap: 'escalate', escalateFrom: 2 },
    duration: 20 * SECOND,
    bar: { onFill: { type: 'lightning', flat: 1.2 } },
    dropWeaponBelow: 0.5,
    /*
     * Another blow earths PART of it. This used to remove the charge outright,
     * which quietly made every per-hit lightning rider self-cancelling: the
     * blow delivering the jolt also earthed the one before it, so `jolted`
     * never saw a second application, never reached the stacking rules, and
     * `shocked` was unreachable by weapon, oil, enchant or rune alike —
     * measured at a flat 1.35 forever from a storm oil, and 5.40 from a perfect
     * one, both stuck at one stack. Bleeding the charge instead keeps the
     * counterplay honest (being hit still costs you most of it) while letting a
     * dedicated lightning kit outpace the grounding.
     */
    removal: [{ on: 'damageTaken', effect: 'reduce', amount: 0.5 }],
  },

  shocked: {
    id: 'shocked',
    name: 'Shocked',
    icon: '🌩️',
    element: 'lightning',
    baseForm: 'jolted',
    stacking: { mode: 'absorb', absorb: 1 },
    duration: null,
    // Reversing the bar is what costs you the action — there is nothing to
    // skip, because you never reach the swing in the first place.
    bar: { reverse: true, onDeplete: { type: 'lightning', flat: 2.5 } },
    // It goes off once, entirely, and is gone — but only a fight runs the bar
    // down, so a fight ending with the charge unspent has to release it too.
    removal: [
      { on: 'barDeplete', effect: 'remove' },
      { on: 'combatEnd', effect: 'remove' },
    ],
  },

  // ---------- Earth: shards ----------

  shardbound: {
    id: 'shardbound',
    name: 'Shardbound',
    icon: '🪨',
    element: 'earth',
    escalatesTo: 'shardbloom',
    stacking: { mode: 'sum', cap: 4, onCap: 'escalate' },
    duration: 30 * SECOND,
    retaliate: { type: 'piercing', flat: 0.8, onAttack: true, onContact: true },
  },

  shardbloom: {
    id: 'shardbloom',
    name: 'Shardbloom',
    icon: '💎',
    element: 'earth',
    baseForm: 'shardbound',
    stacking: { mode: 'sum', cap: 6 },
    duration: 25 * SECOND,
    retaliate: {
      type: 'piercing',
      flat: 0.4,
      onAttack: true,
      onContact: true,
      // A short, fierce bleed each time — one that never becomes a laceration.
      inflicts: [{ id: 'shard_bleed', intensity: 2 }],
    },
  },

  shard_bleed: {
    id: 'shard_bleed',
    name: 'Shard Cut',
    icon: '🩸',
    element: 'slashing',
    // Stacks like an ordinary bleed, but it is not on the road to anything.
    stacking: { mode: 'count', cap: 8 },
    duration: 4 * SECOND,
    dot: { type: 'slashing', flat: 0.3, currentHp: 0.001, fromPeak: ['currentHp'] },
  },

  // ---------- Water: drenching ----------

  wet: {
    id: 'wet',
    name: 'Wet',
    icon: '💧',
    element: 'water',
    escalatesTo: 'soaked',
    stacking: { mode: 'sum', cap: 5, onCap: 'escalate' },
    duration: 30 * SECOND,
    mods: [
      { stat: 'resHeat', op: 'add', value: 0.08 },
      { stat: 'resLightning', op: 'add', value: -0.06 },
      { stat: 'resCold', op: 'add', value: -0.06 },
      { stat: 'resPoison', op: 'add', value: -0.04 },
    ],
    // Fire drives it off a layer at a time. Nothing else does.
    removal: [{ on: 'damageTaken', damageTypes: ['heat'], effect: 'unstack' }],
  },

  soaked: {
    id: 'soaked',
    name: 'Soaked',
    icon: '🌊',
    element: 'water',
    baseForm: 'wet',
    stacking: { mode: 'highest' },
    duration: 60 * SECOND,
    // Not a nudge: a soaking DECIDES what these resistances are. Someone
    // already fireproof is topped up rather than dragged down to 80%.
    overrideRes: {
      heat: { to: 0.8, bonusIfMet: 0.1 },
      lightning: { to: -0.5 },
      cold: { to: -0.5 },
      poison: { to: -0.5 },
    },
    // Water carries what it touches deeper: venom sours on contact, cold bites
    // three times as hard, and a charge builds to a shock in half the jolts.
    converts: [{ from: 'poison', to: 'rotting', ratio: 2 / 3 }],
    amplifies: [{ id: 'chilled', mult: 3 }],
    capOverrides: [{ id: 'jolted', cap: 3 }],
    // It dries slowly, or is driven off by three hits of anything it conducts.
    removal: [
      {
        on: 'damageTaken',
        damageTypes: ['heat', 'poison', 'lightning', 'cold'],
        after: 3,
        effect: 'remove',
      },
    ],
  },
  // ---------- Wind: displacement ----------

  /*
   * Wind is the light word — it does not hurt much and was never going to. What
   * it takes is your FOOTING, and through it your sequencing: a buffeted motion
   * ends where the wind put you rather than where the technique meant to leave
   * you, and nothing enters from off-balance.
   *
   * It is a tempo tax rather than a lock, and deliberately so. A plain weapon
   * swing resets to neutral (MARTIAL.md §2), so the answer is always available:
   * spend a swing recovering before you try to chain again.
   *
   * (The two conditions that used to sit here, `deafen` and `suffocating`, were
   * cut. Hearing is not a modelled sense, so deafen had no dial to turn; and
   * stamina denial is already worked four times over by poison, rot, punctures
   * and perforation. Thin air survives as an ENVIRONMENTAL hazard, where an
   * ambient tax competes with nothing.)
   */
  buffeted: {
    id: 'buffeted',
    name: 'Buffeted',
    icon: '🍃',
    element: 'wind',
    color: '#8fc8b0',
    escalatesTo: 'unfooted',
    stacking: { mode: 'sum', cap: 5, onCap: 'escalate' },
    duration: 12 * SECOND,
    // Each point is a 12% chance that a given exit is stolen. It fades as it
    // runs down rather than holding full strength and vanishing.
    displaces: { to: 'off_balance', chancePer: 0.12 },
    decayWithDuration: true,
  },

  unfooted: {
    id: 'unfooted',
    name: 'Unfooted',
    icon: '💨',
    element: 'wind',
    color: '#5fa88c',
    baseForm: 'buffeted',
    stacking: { mode: 'sum', cap: 4 },
    duration: 20 * SECOND,
    // Not a lock: EVERY exit is overridden, but a plain swing still recovers to
    // neutral. What it costs is the chain, not the turn.
    displaces: { to: 'off_balance', always: true },
  },

  // ---------- Wood: the seed ----------

  /*
   * Wood is patient. Seeded does almost nothing when it lands — the weakest
   * arrival in this file — and then does two things nothing else does:
   *
   *   1. It GROWS while it is ignored (`tends`). Every other condition in here
   *      decays on a clock; this one decays on attention. Seed the back of the
   *      pack and it will have taken root by the time you get there.
   *   2. It REMEMBERS (`grafts`). Every other condition that lands while the
   *      seed is held goes into its ledger — and when it matures, the root
   *      network carries the whole ledger to everything else in the fight.
   *
   * The elemental relations are written into it rather than sitting in a table
   * somewhere: water feeds it, metal cuts it, and fire consumes it for a
   * payout. Poison-typed for now, the way iron's magnetism is piercing-typed —
   * a noun can own a condition without owning a damage type.
   */
  seeded: {
    id: 'seeded',
    name: 'Seeded',
    icon: '🌱',
    element: 'poison',
    color: '#7fa650',
    escalatesTo: 'rootbound',
    stacking: { mode: 'sum', cap: 6, onCap: 'escalate' },
    // The outer bound. Tending is what actually decides how long it lasts.
    duration: 60 * SECOND,
    tends: {
      // Untouched, a single seed matures in about forty seconds.
      growPerSecond: 0.15,
      prunePerHit: 0.5,
      // Metal cuts wood: iron's lane prunes at double rate.
      prunedBy: ['piercing'],
      // Water nourishes wood. Checked before pruning, so a soaking grows it
      // even though the blow itself was a blow.
      fedBy: ['water'],
      feedPerHit: 1,
    },
    grafts: {
      except: ['seeded', 'rootbound'],
      cap: 6,
      // This form only records. Propagation is what maturing buys.
      harvest: { on: ['heat'], type: 'heat', perIntensity: 4 },
    },
    // Fire is the one thing that ends it early — and is paid for the trouble.
    removal: [{ on: 'damageTaken', damageTypes: ['heat'], effect: 'remove' }],
  },

  rootbound: {
    id: 'rootbound',
    name: 'Rootbound',
    icon: '🌳',
    element: 'poison',
    color: '#4d7a2e',
    baseForm: 'seeded',
    stacking: { mode: 'sum', cap: 5 },
    duration: 45 * SECOND,
    mods: [
      { stat: 'speed', op: 'mult', value: -0.2 },
      { stat: 'dodge', op: 'add', value: -0.08 },
    ],
    // Entrenched: harder to prune back, and it still thickens when ignored.
    tends: {
      growPerSecond: 0.08,
      prunePerHit: 0.25,
      prunedBy: ['piercing'],
      fedBy: ['water'],
      feedPerHit: 0.5,
    },
    grafts: {
      except: ['seeded', 'rootbound'],
      cap: 6,
      // Every three seconds, a quarter of everything the ledger holds is
      // carried to every OTHER enemy in the fight.
      spreadShare: 0.25,
      spreadEvery: 3 * SECOND,
      harvest: { on: ['heat'], type: 'heat', perIntensity: 7 },
    },
    removal: [{ on: 'damageTaken', damageTypes: ['heat'], effect: 'remove' }],
  },

  // ---------- Life: overgrowth ----------
  /*
   * Manaburn's mirror: an overdraft of LIFE. Nothing inflicts these directly —
   * they are fed by EXCESS HEALING (see healEnemy in combat.ts): mend a body
   * that is already whole and the surplus has nowhere to go, so it grows.
   * The ledger lives in the instance's `data.surplus`; the thresholds below
   * are shares of the bearer's max HP. Swell far enough and the growth takes
   * on a will of its own; feed THAT far enough and the body bursts, showering
   * everything beside it.
   */
  overgrowth: {
    id: 'overgrowth',
    name: 'Overgrown',
    icon: '🌿',
    // Resisted through poison, the element its burst detonates as.
    element: 'poison',
    escalatesTo: 'proliferating',
    stacking: { mode: 'highest' },
    // No clock of its own: the LEDGER is the clock. A swelling lasts exactly
    // as long as there is unwanted life left in it (see surplus.decayShare).
    duration: null,
    mods: [
      { stat: 'speed', op: 'mult', value: -0.15 },
      { stat: 'dodge', op: 'add', value: -0.05 },
    ],
    // At half the bearer's max HP in surplus, the growth stops being growth.
    // ~2% of what is there subsides each second, so a swelling left alone
    // fades in a minute or so — the pressure has to be KEPT up — but a big
    // body no longer sheds it faster than any working could build it.
    surplus: { escalateAt: 0.5, decayShare: 0.002 },
  },

  proliferating: {
    id: 'proliferating',
    name: 'Proliferating',
    icon: '🧬',
    element: 'poison',
    baseForm: 'overgrowth',
    stacking: { mode: 'highest' },
    // Like its milder form, it lasts exactly as long as the ledger does.
    duration: null,
    mods: [
      { stat: 'speed', op: 'mult', value: -0.3 },
      { stat: 'dodge', op: 'add', value: -0.1 },
    ],
    // A full max-HP of surplus  it bursts: the bearer takes the whole
    // ledger, and everything fighting BESIDE it takes half as poison.
    // Entrenched growth sheds half as readily as a mere swelling.
    surplus: {
      detonateAt: 1,
      detonateType: 'poison',
      detonateShare: 0.5,
      decayShare: 0.001,
    },
  },

  // ---------- Iron: magnetize ----------
// TODO: cancerous growth and whatnot
  /*
   * Iron in the flesh. A magnetized body pulls what is aimed at it: some
   * share of its evasion simply stops applying, lightning cannot miss it at
   * all, and iron finds the seams. Press it far enough and the pull locks —
   * evasion ends entirely, and the charge waits to discharge into whichever
   * blow lands hardest.
   */
  magnetized: {
    id: 'magnetized',
    name: 'Magnetized',
    icon: '🧲',
    element: 'piercing',
    color: '#7ab0d8',
    escalatesTo: 'magnet_lock',
    stacking: { mode: 'sum', cap: 6, onCap: 'escalate' },
    duration: 10 * SECOND,
    magnetism: {
      // Each point of iron drags a tenth of their evasion off the table.
      dodgeIgnore: 0.1,
      alwaysHit: ['lightning'],
      // Iron knows where the iron is.
      critChancePer: 0.05,
      critTypes: ['piercing'],
    },
    // Harder to miss even when their footwork does apply.
    mods: [{ stat: 'dodge', op: 'add', value: -0.03 }],
  },

  magnet_lock: {
    id: 'magnet_lock',
    name: 'Magnet-Locked',
    icon: '🧲',
    element: 'piercing',
    color: '#5591e0',
    baseForm: 'magnetized',
    stacking: { mode: 'sum', cap: 5 },
    duration: 15 * SECOND,
    magnetism: {
      nullifyDodge: true,
      alwaysHit: ['lightning'],
      critChancePer: 0.05,
      critTypes: ['piercing'],
      // The lock collapses into the next critical hit, all at once.
      critDamagePerStack: 0.35,
    },
  },
  // ---------- Light: dazzle ----------

  dazzled: {
    // Blocked alongside `blinded` rather than instead of it: dazzle escalates
    // INTO blindness, so stopping only the far end would leave an eyeless body
    // catchable by the near one and quietly unable to climb off it.
    blockedBy: ['eyeless'],
    id: 'dazzled',
    name: 'Dazzled',
    icon: '😑',
    element: 'light',
    escalatesTo: 'blinded',
    // A second flash does not dazzle you worse — it dazzles you for longer.
    stacking: { mode: 'extend', cap: 4, onCap: 'escalate' },
    duration: 6 * SECOND,
    missChance: 0.08,
    mods: [{ stat: 'dodge', op: 'add', value: -0.05 }],
  },

  blinded: {
    // A body with no eyes has nothing to put out (see `eyeless`).
    blockedBy: ['eyeless'],
    id: 'blinded',
    name: 'Blinded',
    icon: '🙈',
    element: 'light',
    color: '#e8e3c0',
    baseForm: 'dazzled',
    stacking: { mode: 'highest' },
    duration: 25 * SECOND,
    // Every attack rolls to hit twice and keeps the worse of the two.
    disadvantage: true,
    mods: [{ stat: 'dodge', op: 'add', value: -0.25 }],
  },

  // ---------- Dark: taint ----------

  // TODO: check the condition in how well it works. it and corrupted might need a second look
  tainted: {
    id: 'tainted',
    name: 'Tainted',
    icon: '🌑',
    element: 'dark',
    color: '#7a5c9e',
    escalatesTo: 'corrupted',
    // Stacks add penalty AND dig the floor deeper, independently.
    stacking: { mode: 'sum', cap: 5, onCap: 'escalate' },
    duration: 45 * SECOND,
    // It loosens its grip as it fades, rather than holding on and vanishing.
    decayWithDuration: true,
    mods: [
      { stat: 'resSlashing', op: 'add', value: -0.05 },
      { stat: 'resPiercing', op: 'add', value: -0.05 },
      { stat: 'resBludgeoning', op: 'add', value: -0.05 },
      { stat: 'resHeat', op: 'add', value: -0.05 },
      { stat: 'resCold', op: 'add', value: -0.05 },
      { stat: 'resPoison', op: 'add', value: -0.05 },
      { stat: 'resArcane', op: 'add', value: -0.05 },
      { stat: 'resLightning', op: 'add', value: -0.05 },
      { stat: 'resEarth', op: 'add', value: -0.05 },
      { stat: 'resWind', op: 'add', value: -0.05 },
      { stat: 'resWater', op: 'add', value: -0.05 },
      // Its own element, and its opposite, suffer twice over.
      { stat: 'resLight', op: 'add', value: -0.1 },
      { stat: 'resDark', op: 'add', value: -0.1 },
    ],
    // However many stacks, it can only drag you so far — and each stack digs
    // that floor 5% deeper without making the penalty itself worse.
    resFloor: { base: -0.25, perStack: 0.05 },
  },

  // TODO: check the condition in how well it works. it and tainted might need a second look
  corrupted: {
    id: 'corrupted',
    name: 'Corrupted',
    icon: '👁️',
    element: 'dark',
    color: '#5b3a8c',
    baseForm: 'tainted',
    stacking: { mode: 'sum', cap: 10 },
    duration: null,
    /*
     * It takes your spirit by CLOSING it off rather than draining it: spirit is
     * a standing reserve that refills to its ceiling every tick (see its
     * `static` flag), so a drain would be refilled the instant it landed.
     *
     * DEVIATION worth knowing: the spec prices the other pools at a multiple of
     * the spirit *actually lost*, in absolute points. Spirit is a far smaller
     * pool than health, so an absolute multiple is either negligible or
     * catastrophic depending on the character. This is proportional instead —
     * it takes a tenth of your spirit per point of corruption, and half that
     * share of everything else — which behaves sanely at every scale.
     */
    ceilings: [
      { resource: 'spirit', per: 0.1, max: 1 },
      { resource: 'hp', per: 0.05, max: 0.6 },
      { resource: 'stamina', per: 0.05, max: 0.6 },
      { resource: 'mana', per: 0.05, max: 0.6 },
    ],
    // Spirit gone means you are gone — and half of it is waiting when you wake.
    fatalOnEmpty: { resource: 'spirit', retains: 0.5 },
    // NOTE: houses of worship and cleansing rituals do not exist yet, so this
    // rule currently has nothing that can satisfy it. That is deliberate — the
    // condition is meant to be permanent until they do.
    removal: [{ on: 'cure', tag: 'cleansing', effect: 'remove' }],
  },

  // ---------- Arcane: manaburn ----------

  manaburn: {
    id: 'manaburn',
    name: 'Manaburn',
    icon: '🔯',
    element: 'arcane',
    color: '#d648c8',
    stacking: { mode: 'absorb', absorb: 1, cap: 8 },
    duration: null,
    /*
     * It eats mana at a steady RATE — a share of the pool per tick — while
     * `intensity` is the total it has left to take. Those are deliberately
     * separate: scaling the rate by the total made a big burn evaporate in
     * under a second, which is the opposite of the threat it should be.
     */
    drains: { resource: 'mana', ofMax: 0.01 },
    // ...past zero, a quarter of the pool deeper per stack...
    negativeHeadroom: { resource: 'mana', base: 1, perStack: 0.25 },
    // ...and when the debt bottoms out, the overdraft detonates. Most arcane
    // warding is no help: this was already inside you.
    detonate: { type: 'arcane', ofDebt: 1, bypassRes: 0.8 },
  },

  // ---------- Nourishment ----------
  //
  // Beneficial conditions. The machinery does not care about the sign — a dish
  // that feeds you over ten minutes is the same shape as a poison that drains
  // you over thirty seconds, which is why cooking needed no system of its own.

  well_fed: {
    id: 'well_fed',
    name: 'Well Fed',
    icon: '🍲',
    color: '#c98a3c',
    stacking: { mode: 'highest' },
    duration: 600 * SECOND,
    // Sustained: the health arrives across the whole ten minutes.
    restores: [{ resource: 'hp', ofMax: 0.0006 }],
    mods: [
      { stat: 'maxHp', op: 'add', value: 8 },
      { stat: 'staminaRegen', op: 'mult', value: 0.1 },
    ],
  },

  steady_hand: {
    id: 'steady_hand',
    name: 'Steady Hand',
    icon: '🍢',
    color: '#7ab0d8',
    stacking: { mode: 'highest' },
    duration: 480 * SECOND,
    mods: [
      { stat: 'crit', op: 'add', value: 0.03 },
      { stat: 'parry', op: 'add', value: 0.02 },
    ],
  },

  clear_headed: {
    id: 'clear_headed',
    name: 'Clear-Headed',
    icon: '🍵',
    color: '#8f7ad8',
    stacking: { mode: 'highest' },
    duration: 480 * SECOND,
    restores: [{ resource: 'mana', ofMax: 0.001 }],
    mods: [
      { stat: 'spellPower', op: 'mult', value: 0.08 },
      { stat: 'skillXp', op: 'mult', value: 0.05 },
    ],
  },

  // The two below come from windowed stove dishes (CraftOutcomeDef.heat). Both
  // are elementless like the rest of this block: you do not resist your own
  // dinner. Per point of intensity; a dish's grade multiplies the intensity.

  stoked: {
    id: 'stoked',
    name: 'Stoked',
    icon: '🥩',
    color: '#d9692c',
    stacking: { mode: 'highest' },
    duration: 300 * SECOND,
    mods: [
      { stat: 'damage', op: 'mult', value: 0.05 },
      { stat: 'critDamage', op: 'add', value: 0.05 },
    ],
  },

  steeped: {
    id: 'steeped',
    name: 'Steeped',
    icon: '🫖',
    color: '#6f9a58',
    stacking: { mode: 'highest' },
    duration: 600 * SECOND,
    mods: [
      { stat: 'resPoison', op: 'add', value: 0.25 },
      { stat: 'resAcid', op: 'add', value: 0.1 },
    ],
  },

  queasy: {
    id: 'queasy',
    name: 'Queasy',
    icon: '🤮',
    // Spoiled food's illness. Poison resistance thins it, and an earned title
    // (Iron Stomach) can refuse it outright.
    element: 'poison',
    color: '#6f8a3c',
    stacking: { mode: 'highest' },
    duration: 90 * SECOND,
    dot: { type: 'poison', flat: 0.03 },
    mods: [{ stat: 'staminaRegen', op: 'mult', value: -0.25 }],
    // Settles once you have properly rested.
    removal: [{ on: 'heal', healKinds: ['rest'], effect: 'remove' }],
  },

  // ---------- Alchemy: what an Elixir grants ----------
  //
  // One condition per reagent that grants something. Alchemy does not hand out
  // a deity's signature (Xima's Rime, Veiled and Blood Communion stay with the
  // divine), so Frostmoss, Gloomcap and Bloodwort each carry their own. Sized
  // for a short flask: the Elixir sets the duration (45 s base, 150 s at most),
  // and a Fair-grade essence lands near 0.65 to 1.4 intensity, so each figure
  // here is per point of intensity and modest on purpose. Elementless like every
  // self-granted condition: you do not resist your own drink.

  frosted: {
    id: 'frosted',
    name: 'Frosted',
    icon: '🧊',
    color: '#7ab0d8',
    stacking: { mode: 'highest' },
    duration: 45 * SECOND,
    mods: [
      { stat: 'resCold', op: 'add', value: 0.2 },
      { stat: 'resHeat', op: 'add', value: 0.1 },
    ],
  },

  concealed: {
    id: 'concealed',
    name: 'Concealed',
    icon: '🌚',
    color: '#9aa4b0',
    stacking: { mode: 'highest' },
    duration: 45 * SECOND,
    // Not harder to hit, harder to find: a share of blows go wide after dodge,
    // and a little footwork on top.
    incomingMissChance: 0.1,
    mods: [{ stat: 'dodge', op: 'add', value: 0.03 }],
  },

  invigorated: {
    id: 'invigorated',
    name: 'Invigorated',
    icon: '🌡️',
    color: '#c94f4f',
    stacking: { mode: 'highest' },
    duration: 45 * SECOND,
    mods: [{ stat: 'staminaRegen', op: 'mult', value: 0.25 }],
  },

  // ---------- Miracles ----------
  //
  // What divine workings leave on the world: blessings worn by adherents and
  // marks left on their enemies. Same machinery as everything above — a
  // blessing is a beneficial condition, a broken shape is a debuff.

  unfolded: {
    id: 'unfolded',
    name: 'Unfolded',
    icon: '📐',
    unresistable: 'ruled no resistance (2026-10-24)',
    color: '#8f7ad8',
    stacking: { mode: 'highest' },
    duration: 15 * SECOND,
    // A broken shape guards badly against everything with an edge or a will.
    mods: [
      { stat: 'resSlashing', op: 'add', value: -0.12 },
      { stat: 'resPiercing', op: 'add', value: -0.12 },
      { stat: 'resBludgeoning', op: 'add', value: -0.12 },
      { stat: 'resArcane', op: 'add', value: -0.15 },
    ],
  },

  folded_space: {
    id: 'folded_space',
    name: 'Folded Space',
    icon: '📄',
    color: '#8f7ad8',
    stacking: { mode: 'highest' },
    duration: 40 * SECOND,
    mods: [{ stat: 'dodge', op: 'add', value: 0.12 }],
  },

  ximas_rime: {
    id: 'ximas_rime',
    name: "Xima's Rime",
    icon: '❄️',
    color: '#7ab0d8',
    stacking: { mode: 'highest' },
    duration: 60 * SECOND,
    mods: [
      { stat: 'resHeat', op: 'add', value: 0.12 },
      { stat: 'resCold', op: 'add', value: 0.12 },
      { stat: 'resLightning', op: 'add', value: 0.12 },
    ],
  },

  blood_communion: {
    id: 'blood_communion',
    name: 'Blood Communion',
    icon: '🩸',
    color: '#c94f4f',
    stacking: { mode: 'highest' },
    duration: 60 * SECOND,
    // The whole point of the rite: wounds become the offering, and the
    // offering comes back as vigor.
    invertsDots: ['bleeding', 'lacerated'],
    mods: [{ stat: 'damage', op: 'mult', value: 0.08 }],
  },

  honor_bound: {
    id: 'honor_bound',
    name: 'Honor Bound',
    icon: '⚔️',
    color: '#e8b84b',
    stacking: { mode: 'highest' },
    duration: 20 * SECOND,
    pacifiesFlankers: true,
    mods: [{ stat: 'damage', op: 'mult', value: 0.1 }],
  },

  veiled: {
    id: 'veiled',
    name: 'Veiled',
    icon: '🎭',
    color: '#9aa4b0',
    stacking: { mode: 'highest' },
    duration: 30 * SECOND,
    incomingMissChance: 0.12,
  },

  night_shroud: {
    id: 'night_shroud',
    name: 'Night Shroud',
    icon: '🌑',
    color: '#5b4a6e',
    stacking: { mode: 'highest' },
    duration: 30 * SECOND,
    incomingMissChance: 0.12,
  },

  unravelling: {
    id: 'unravelling',
    name: 'Unravelling',
    icon: '🧵',
    element: 'arcane',
    color: '#8f7ad8',
    /*
     * The buildup IS the universal payload: the arcane-resistance shred works
     * on anything that can be struck, mage or not. The ESCALATION is the
     * anti-mage jackpot — at three stacks the fraying catches and becomes
     * manaburn, which devastates a caster and (honestly) barely troubles a
     * creature with no mana to burn. Both halves are on purpose.
     */
    escalatesTo: 'manaburn',
    // ×8: three threads catch as a 24-point burn — debt territory for a
    // caster mid-fight, not a candle.
    stacking: { mode: 'sum', cap: 3, onCap: 'escalate', escalateMult: 8 },
    duration: 20 * SECOND,
    mods: [
      { stat: 'resArcane', op: 'add', value: -0.08 },
      { stat: 'spellPower', op: 'mult', value: -0.05 },
      { stat: 'manaRegen', op: 'mult', value: -0.15 },
    ],
  },

  kinetic_bulwark: {
    id: 'kinetic_bulwark',
    name: 'Kinetic Bulwark',
    icon: '🛡️',
    color: '#9aa4b0',
    stacking: { mode: 'highest' },
    duration: 25 * SECOND,
    blocksRanged: { except: ['light'] },
  },

  /*
   * ---------- Psionic: the will turned inward ----------
   *
   * These are the inward faces of the psionic quantities (see
   * systems/psionic.ts). Each is the same number that would otherwise have
   * been a blow, aimed at the shaper instead — so none of them is a fixed
   * package. Every one is granted at an intensity computed from the shape,
   * and the values below are what ONE UNIT of that quantity is worth;
   * `statusMods` scales from there. Their lifetime is set by the shape's
   * coherence, not here: structure is what makes a working persist.
   */

  psionic_haste: {
    id: 'psionic_haste',
    name: 'Kinetic Haste',
    icon: '💨',
    color: '#f2d024',
    stacking: { mode: 'highest' },
    duration: 20 * SECOND,
    /*
     * `speed` is the action-bar fill rate for EVERYTHING, so this already
     * quickens crafting and every activity as well as attacking (see
     * actions.ts: a craft bar fills at speed × craftSpeed). Travel is the one
     * thing measured on its own stat, so it is named explicitly — a working
     * that makes you faster and then leaves you walking would be a strange
     * kind of haste.
     */
    mods: [
      { stat: 'speed', op: 'mult', value: 0.03 },
      { stat: 'travelSpeed', op: 'mult', value: 0.03 },
    ],
  },

  psionic_bracing: {
    id: 'psionic_bracing',
    name: 'Braced',
    icon: '💢',
    color: '#e05555',
    stacking: { mode: 'highest' },
    duration: 20 * SECOND,
    mods: [{ stat: 'armor', op: 'add', value: 1 }],
  },

  psionic_root: {
    id: 'psionic_root',
    name: 'Rooted',
    icon: '🪨',
    color: '#9aa4b0',
    stacking: { mode: 'highest' },
    duration: 20 * SECOND,
    // Blunt force is the thing that moves people; here it finds no purchase.
    mods: [{ stat: 'resBludgeoning', op: 'add', value: 0.02 }],
    /*
     * A mind with its weight set is harder to rattle. Fixed rather than
     * scaled, deliberately: `amplifies` is read off the DEF, not the instance
     * (see amplifierFor), so it cannot vary with intensity. The scaling part
     * of being rooted is the resistance above.
     */
    amplifies: [
      { id: 'dazed', mult: 0.5 },
      { id: 'concussed', mult: 0.5 },
    ],
  },

  psionic_foresight: {
    id: 'psionic_foresight',
    name: 'Foresight',
    icon: '📍',
    color: '#8f7ad8',
    stacking: { mode: 'highest' },
    duration: 20 * SECOND,
    incomingMissChance: 0.03,
  },

  /*
   * The outward twin of the block above. Sight spent on someone rather than on
   * yourself is not a blow and never was — it is simply that they have been
   * seen, and a working aimed this way needs no force behind it to arrive.
   */
  psionic_compression: {
    id: 'psionic_compression',
    name: 'Compressed',
    icon: '🌀',
    unresistable: 'ruled no resistance (2026-10-24)',
    color: '#5591e0',
    stacking: { mode: 'highest' },
    duration: 20 * SECOND,
    // Structure imposed on someone is not a resistance debuff — that is
    // Ik'Thel'the's Unfold Geometry, and psionics does not borrow a deity's
    // signature. Thickened space costs you TIME.
    mods: [{ stat: 'speed', op: 'mult', value: -0.02 }],
  },

  psionic_read: {
    id: 'psionic_read',
    name: 'Read',
    icon: '🔍',
    unresistable: 'ruled no resistance (2026-10-24)',
    color: '#8f7ad8',
    stacking: { mode: 'highest' },
    duration: 20 * SECOND,
    mods: [
      { stat: 'dodge', op: 'add', value: -0.02 },
      { stat: 'parry', op: 'add', value: -0.02 },
    ],
  },

  psionic_wide_sight: {
    id: 'psionic_wide_sight',
    name: 'Wide Sight',
    icon: '👁️',
    color: '#5591e0',
    stacking: { mode: 'highest' },
    duration: 20 * SECOND,
    // Not avoidance — anticipation. You meet each blow at its worst angle.
    mods: [
      { stat: 'resSlashing', op: 'add', value: 0.012 },
      { stat: 'resPiercing', op: 'add', value: 0.012 },
      { stat: 'resBludgeoning', op: 'add', value: 0.012 },
    ],
  },

  artisans_cunning: {
    id: 'artisans_cunning',
    name: "Artisan's Cunning",
    icon: '🔨',
    color: '#c98a3c',
    stacking: { mode: 'highest' },
    duration: 120 * SECOND,
    mods: [
      { stat: 'craftSpeed', op: 'mult', value: 0.15 },
      { stat: 'loot', op: 'mult', value: 0.08 },
    ],
  },

  // ---------- Being caught out ----------

  /**
   * Caught with your guard down. This takes away the defences you were
   * WEARING — armour, enchantments, spells — and leaves the ones you ARE:
   * skills, titles, achievements, and anything a modifier marks `undampened`,
   * which is where an "uncanny dodge" lives.
   *
   * Measured in the victim's own turns rather than in ticks, so a slow fighter
   * is exposed for exactly as long as a fast one — two swings either way.
   */
  flat_footed: {
    id: 'flat_footed',
    name: 'Flat-Footed',
    icon: '😦',
    unresistable: 'state: caught off guard, not an element',
    color: '#c9a13c',
    stacking: { mode: 'highest' },
    // A long backstop; the removal rule below is what actually ends it.
    duration: 60 * SECOND,
    damp: {
      stats: ['dodge', 'parry'],
      kinds: ['item', 'affix', 'rune', 'handBonus', 'buff', 'status'],
      per: 1,
      max: 1,
    },
    removal: [{ on: 'barFill', after: 2, effect: 'remove' }],
  },

  /**
   * Struck before you knew there was a fight. The next blow to land does more,
   * and then it is gone — surprise is spent the moment it is used.
   *
   * The two-turn backstop matters as much as the damage: an enemy who is
   * surprised and then ignored recovers, so an ambush is worth something only
   * if you follow it up.
   */
  surprised: {
    id: 'surprised',
    name: 'Surprised',
    icon: '😲',
    unresistable: 'state: caught off guard, not an element',
    color: '#e0a855',
    stacking: { mode: 'highest' },
    duration: 60 * SECOND,
    // The bite: the next blow against a surprised target lands 30% harder per
    // intensity, and the removal below spends the surprise on that blow.
    incomingBite: 0.3,
    // The tempo: a fight opening on surprised enemies hands you the first
    // swing — your bar starts a single tick short of full.
    opensTempo: true,
    removal: [
      // Spent on use, or slept off — whichever comes first.
      { on: 'damageTaken', after: 1, effect: 'remove' },
      { on: 'barFill', after: 2, effect: 'remove' },
    ],
  },
  skewered: {
    id: 'skewered',
    name: 'Skewered',
    // The blade emoji, freed by Punctured's escalation becoming Perforated:
    // this is the condition that literally has one in it.
    icon: '🗡️',
    element: 'piercing',
    color: '#c2504f',
    // One blade at a time — a second impalement replaces rather than stacks.
    stacking: { mode: 'highest', cap: 1 },
    duration: 10 * SECOND,
    mods: [
      { stat: 'speed', op: 'mult', value: -0.05 },
      { stat: 'dodge', op: 'mult', value: -0.15 },
    ],
    // Left alone, the blade works itself loose — and that costs them. Torn out
    // deliberately (Flesh Draw) the clock never runs out, so this never pays:
    // the technique takes its opening instead, which is the whole trade.
    expireDamage: { type: 'piercing', flat: 12 },
  },

  // ---------- Anupama: the fast ----------
  //
  // Not element signatures like most of this file — these three belong to one
  // body, and are named for it. See docs/plans/anupama-fasting-amidst-sinners.md.

  /*
   * A PLACE for a rule rather than a rule itself, in `eyeless`'s sense: it
   * carries no effect of its own beyond the one gate, and exists so that both
   * halves of Anupama can say the same thing.
   *
   * The player gets it through the gene's `confers` and `syncGeneStatuses`; the
   * monster gets it through `MonsterDef.wears` at spawn. One condition, one
   * predicate, and combat never learns which side it is looking at.
   *
   * `swing` and not `attack`: the Special refuses the plain blow, not the
   * deliberate act. A working, a technique and the body's own ability all still
   * spend the bar — which they must, since casting is what FEEDS the hunger.
   */
  fasting: {
    id: 'fasting',
    name: 'Fasting',
    icon: '🕳️',
    unresistable: "unique: Anupama's rule, not an affliction",
    hidden: true,
    stacking: { mode: 'highest', cap: 1 },
    duration: null,
    blocks: ['swing'],
    removal: [{ on: 'combatEnd', effect: 'remove' }],
  },

  /*
   * The rule this breaks: EVERY OTHER STACKING CONDITION DECLARES A CAP.
   * Bleeding stops at 5, seeded at 6, chill at 1 before it stops being chill.
   * Hunger declares none, because a fast has no depth at which it is satisfied
   * — that omission is the whole mechanic, not an oversight, and it is what
   * earns Anupama its place at tier 5.
   *
   * `intensity` and `stacks` are deliberately doing different jobs here.
   * Intensity carries MAGNITUDE and arrives already scaled by the imparter's
   * wisdom, which is why the damage follows whoever inflicted it rather than
   * whoever is carrying it — Anupama's own hunger bites harder than the one a
   * player hands out, without either needing a separate condition. `stacks`
   * stays the raw count, and is what the defence arm reads when it totals the
   * hunger on the field.
   */
  hunger_anupama: {
    id: 'hunger_anupama',
    name: 'Hunger',
    icon: '🕳️',
    element: 'dark',
    stacking: { mode: 'sum' },
    // It fades if you stop acting, which is the counterplay: the fast is only
    // fed by appetite. Each fresh application refreshes the clock.
    duration: 15 * SECOND,
    // Half of it cannot be resisted at all — see StatusDot.pierce. Dark
    // resistance still blunts the other half, so the type is not decorative.
    dot: { type: 'dark', flat: 0.05, pierce: 0.5 },
    // Nobody walks out of a fight still starving.
    removal: [{ on: 'combatEnd', effect: 'remove' }],
  },

  /*
   * The active's aftermath. Deliberately short and self-clearing: it is a
   * stumble under accumulated weight, not a lasting slow, and the bar filling
   * IS the recovery. An action completed after it can feed hunger again, which
   * is why the removal is `barFill` rather than a plain timer alone.
   */
  weight_of_hunger: {
    id: 'weight_of_hunger',
    name: 'The Weight of Hunger',
    icon: '⚖️',
    element: 'dark',
    stacking: { mode: 'highest' },
    duration: 3 * SECOND,
    // Scaled by intensity, which the ability clamps to HUNGER_SLOW_CEILING —
    // the ceiling belongs to the ability ("at most 3× slower"), not to the
    // condition, so a future source could lean on this harder if it earned it.
    mods: [{ stat: 'speed', op: 'mult', value: -1 }],
    removal: [
      { on: 'barFill', effect: 'remove' },
      { on: 'combatEnd', effect: 'remove' },
    ],
  },
});

/**
 * Intensity of `hunger_anupama` per application, per point of the IMPARTER's
 * wisdom. Placeholder — the shape is settled, the number is not; balance it
 * against a real fight rather than at the desk.
 */
export const HUNGER_PER_WISDOM = 0.01;

/**
 * The most `weight_of_hunger` may slow a bar: −2/3 of speed, i.e. three times
 * slower. The design's stated envelope, clamped where the intensity is
 * computed rather than inside the condition.
 */
export const HUNGER_SLOW_CEILING = 2 / 3;

export const STATUS_LIST: StatusDef[] = Object.values(STATUSES);
