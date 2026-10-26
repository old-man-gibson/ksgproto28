# Martial techniques

The fourth combat identity, and the mirror-image of the whole grimoire.

| school | composed | identity | progression |
| --- | --- | --- | --- |
| Arcane | before the fight | **sequence** — word order is meaning | novelty (new sentences) |
| Psionic | before the fight | **when** — thresholds realise patterns | taught (axes, tiers) |
| Divine | before the fight | **interaction** — who tolerates whom | received (favor) |
| **Martial** | **by the fight** | **response** — the fight offers, you answer | **repetition** (drilled reps) |

Every magic school resolves at authoring time: the player writes the sentence,
allocates the shape, prepares the miracle, and combat plays the result back. A
**technique** is the opposite: its trigger is baked into what it *is*, it can
only fire from the position the last exchange left you in, and the chains that
emerge — Gather → Heavy Blow, dodge → Riposte → Thrust — were never authored
anywhere. Two fights with the same loadout play out differently. That is the
point, and it is the rule every future technique must keep: **never let the
player script a sequence.** The player's entire authored surface is rotation
order, drill slots, and optional extra trigger conditions.

Files:

- `src/core/data/martial.data.ts` — positions, techniques, weapon families, `MAX_DRILLED`
- `src/core/systems/martial.ts` — gating, mastery, drill slots, the position graph
- `src/ui/panels/MartialPlanner.svelte` — the position-graph planner (§9b)
- `src/core/systems/combat.ts` — execution (buff slot + the swing branch)
- `src/core/systems/triggers.ts` — events, windows, the `combat.position` subject
- `tests/martial.test.ts`

---

## 1. The anatomy of a technique

```ts
riposte: {
  id: 'riposte', name: 'Riposte', icon: '⚡',
  desc: 'The answer to an attack that found nothing.',
  family: 'sword',                       // (optional) weapon tag that must be held
  trigger: { conditions: [], event: 'onDodge', window: 20 },
  from: 'any',                           // entry positions ('any' or POSITIONS ids)
  to: 'extended',                        // exit position
  move: { damageMult: 1.4, cooldown: 40 },
  unlock: [ { type: 'skill', id: 'fighting', level: 12 } ],  // ELIGIBILITY to learn
  learn: { self: { stat: 'combat:dodges', count: 50 } },     // how it crystallizes
  mastery: { 3: { name: 'Instinct' } },  // ladder annotations (see §6)
},
```

Four parts, four responsibilities:

- **`trigger`** — the reflex. *When* does the body answer? Reuses `SkillTrigger`
  verbatim, so a baked trigger and a player-authored one speak the same
  language; the baked one just cannot be edited away.
- **`from` / `to`** — the footwork. *Where* must you be, and where does it
  leave you? This is the entire sequencing system. `from` may be `'any'`, a
  position list, or a list of **ways in** (`[{ at, trigger? }]`) — one motion
  with a normal entry and an opportunistic one, each carrying its own read.
  Any one open way is enough; they are alternatives, not requirements. This
  stays inside §9: it correlates a read with the footing, which is still one
  node's eligibility, not an edge list.
- **`move`** — the payload. What actually happens when it fires.
- **`unlock` / `learn`** — the acquisition gate and path. `unlock` is
  *eligibility* (the body that could hold this), never knowledge; knowledge is
  the ledger (§6).

### `move` fields

| field | meaning | notes |
| --- | --- | --- |
| `damageMult` | weapon-damage multiplier | its **presence** makes the technique offensive (swings on the action bar); its absence makes it defensive (fires from the buff slot) |
| `preventedMult` | bonus damage as a share of the damage just stopped | reads `combat.prevented`. A **parry** stamps the blow's whole force (nothing reached you); a **blocked hit** stamps `thrown − dealt`, what armor, resistance and any counter took off it — so an `onParry` answer scales with their swing and an `onHit` answer scales with your guard. A dodge stamps nothing. Readings are keyed by event, so a bystander's blocked hit can never overwrite the parry a counter was about to answer. **Spent on use.** Scaled by mastery, forks and runes exactly like `damageMult` |
| `damageType` | type of the RETURNED share only | the `damageMult` half keeps the weapon's type, so a counter lands as two slices — your fist as bludgeoning, what you blocked as lightning |
| `counter` | `{ reduce, pool?, cost? }` — **the third execution kind** | fires *inside* the enemy's attack: takes `reduce` off the blow before armor, then answers immediately, free of the action bar. `trigger.event` names what it intercepts. Excluded from both ordinary paths, so it is never swung and never sits in the buff slot. An unaffordable `pool`/`cost` skips that blow rather than refusing the technique |
| `penetration` | added to the strike's penetration | stacks with stats + exertion, capped 0.95 |
| `splash` | share of the strike spilled onto a random flanker | stacks with stats + exertion |
| `inflicts` | `StatusApplication[]` left on the target | applied after the damage lands, only if the target still lives |
| `buff` | `{ mods, duration }` self-buff | the defensive payload |
| `staminaCost` | fraction of **max** stamina | on top of ordinary swing upkeep; trimmed by `staminaEff`; respects the 20% reserve |
| `momentum` | added to `combat.momentum` | only counts under a ramping stance (see §5) |
| `cooldown` | ticks (10/s) | keyed as `technique:<id>` in `combat.cooldowns` |

A technique is a **strike**, a **buff**, or a **counter**. `damageMult` decides
the first two (present = swings on the action bar, absent = fires from the buff
slot); `counter` overrides both — it lives inside the enemy's attack and is
skipped by either ordinary path. Do not give a strike both a `damageMult` and a
`buff` (the buff field is ignored on the attack path today).

---

## 2. Positions — sequencing without a script

`CombatState.position` is a single string: where the last exchange left the
fighter's body. The universal vocabulary (`POSITIONS`):

| id | | meaning |
| --- | --- | --- |
| `neutral` | ⚖️ | weight centred, options open — the home state |
| `coiled` | 🌀 | wound up; the next heavy motion is already paid for |
| `extended` | 🫱 | committed forward, reach at its longest |
| `off_balance` | 💫 | the follow-through carried you past your footing |
| `guarded` | 🛡️ | weight back, weapon between you and the world |

Movement rules (all in `combat.ts`):

- Every encounter **starts at `neutral`**.
- An executed technique moves you to its `to`.
- A **plain weapon swing resets to `neutral`** — recovery is free, it just
  costs you the swing. This is why no "return to stance" filler techniques are
  ever needed, and why `off_balance` is a real cost without being a lock.
- **Spells move the mind, not the feet** — a crafted-spell cast or spell-type
  active leaves position untouched.
- Defensive techniques (buff slot) also move you (`sidestep` exits `guarded`).

Design consequences worth internalising:

- `to` is the real balance lever. An exit into `off_balance` means the next
  swing is a plain one (nothing enters from off-balance yet) — a built-in
  tempo tax. An exit into `extended` is a gift to anything that enters from
  `extended`.
- Chains are **discovered, not declared**: `thrust` enters from `extended`, and
  automatically links behind *anything* that exits there — `riposte` today,
  every future extended-exit technique for free.
- The player can read position mid-fight (Combat panel, under the stance
  wheel) and gate their *other* actives on it: the `combat.position` trigger
  subject is available in every trigger editor.

Weapon families will eventually get their **own** vocabularies (a spear's reach
states, a dagger's grip states). Until then every family shares the universal
five. When family positions arrive, keep universal techniques on universal
positions — a family vocabulary is what makes a family feel bespoke, and
cross-family techniques would flatten that.

---

## 3. Triggers — the reflex layer

Trigger **events** are stamped by combat onto `combat.events[event] = totalTicks`
(`markCombatEvent`):

| event | stamped when |
| --- | --- |
| `onHit` | an enemy blow lands on you |
| `onCrit` | you land a critical hit |
| `onParry` | you parry |
| `onDodge` | you dodge an enemy attack |
| `onGraze` | your swing missed but still opened something up |
| `onEncounterStart` | the formation spawns |
| `onEnemyCast` | an enemy begins a working (ARCANE.md §14) |

An event-gated trigger passes while the stamp is at most `window` ticks old
(default `EVENT_WINDOW = 2`). **Reactive attack techniques must carry a wide
window** — the dodge happens during the enemies' turn, but the answering strike
waits for your action bar, which is many ticks away. `window: 20` (~2 s,
roughly one action-bar cycle) is the standing convention. Defensive techniques
are checked every tick, so they could live with the tight default, but 20 keeps
them from feeling like coin flips against fast bars.

Eligibility, in the exact order `pickActive` checks it:

1. off cooldown;
2. right slot (offensive ↔ attack, defensive ↔ buff);
3. **armed** — `family` tag among `equippedTags` (no family = always, even
   bare-handed);
4. **in position** — current position ∈ `entryPositions` (which includes any
   mastery-opened entries);
5. the **baked trigger** holds;
6. the **player's overlay trigger** (`skillTriggers['technique:<id>']`) holds —
   the player can *narrow* a reflex or switch it off, never widen it.

First eligible entry in rotation order wins the swing. Techniques ride
`activeRotation` as `technique:<id>` ids, after explicit `skillOrder` entries
and active skills, before prepared spells; stale ids in a saved order are
inert, exactly like unprepared grimoire uids.

---

## 4. Execution — what one technique swing does

The attack path (inside the bar-fill branch of `tickCombat`), in order:

1. dodge/fumble are rolled as for any swing — a technique **can** miss, and a
   miss neither costs its cooldown nor moves your position (the whole branch is
   skipped);
2. damage = `vs.damage × damageMult` (mastery-honed), through the normal
   crit/variance/typed-slice pipeline — hunter bonuses, weapon `bonusDamage`
   and socketed rune damage all apply, because a technique **is** a weapon hit;
3. cooldown is set; upkeep + `staminaCost` are drawn; exertion fires as usual
   (technique and stance bargain stack — they are orthogonal purchases);
4. `penetration`/`splash` add onto stats + exertion;
5. `inflicts` land on the target if it survived;
6. position moves to `to`;
7. the execution is **recorded** (see §6) and a newly crossed mastery tier is
   announced in the feed (`🎓 Heavy Blow — Drilled.`);
8. XP flows through the ordinary combat tags — so a sword technique trains
   Swordsmanship and its schools exactly like a plain sword swing.

The defensive path (buff slot, checked every tick): buff applied, stamina
drawn, cooldown set, position moved, execution recorded, small DEX + combat
XP. Fires as soon as its moment comes, without touching the action bar — the
same contract as skill buffs and self-targeted spells.

Feed lines: `⚔️ 🔨 Heavy Blow strikes the Wolf for 34`, with the full damage
breakdown behind the tooltip (`steps` carries a `{ label: <name>, mult }` row).

---

## 5. The economy

- **Stamina** is the price. Ordinary upkeep is unavoidable; `staminaCost` is
  the technique's own surcharge (fraction of max, so it keeps pace with
  growth). Bands, mirroring exertion's: none for setup/reactive moves, ~5%
  middling, ~8–12% for a payoff move. Winded fighters (< 20% reserve) simply
  stop paying — the technique still fires, its surcharge just isn't drawn,
  which matches how exertion degrades.
- **Momentum** is the within-fight currency. `move.momentum` feeds
  `combat.momentum`, but only while the effective stance has an exertion
  `ramp` (there is nothing for it to buy otherwise), and never past the ramp's
  cap. Magic's currencies (mana, favor) live *between* fights; martial's lives
  inside one and dies with it. In play it is extra attack speed: Quick
  (+3%/exchange, cap +45%) and Ittou-ryu (+3.5%, cap +50%) are the two
  ramping stances today. Every place a player reads the word now says so —
  the technique text, the technique tooltip (format.ts names the ramping
  stances from data), and the two stance descriptions (user found it
  unexplained, 2026-10-25).
- **Cooldowns** are the tempo knob. At 10 ticks/s and ~1.7 s swings, a 30-tick
  cooldown means "most swings", 60 means "every third or so", 120 means "once
  per short fight".
- **Attack speed converges** (see derived.ts): every attackSpeed source
  multiplies the *remaining attack time* by (1 − v), one source never erases
  more than half, and the interval floors at 0.5 s (`MIN_ATTACK_TICKS`) — speed
  past the floor becomes `extraSwings`, extra hits per swing that ride the
  same roll as flurry exertion. Technique swings benefit like any weapon hit,
  and every extra hit is an extra *execution-speed* multiplier on nothing —
  reps count per swing, not per hit, so the ladder is not inflated by it.

---

## 6. Progression — the ledger, forms, and the powers-of-ten ladder

**Knowledge is a ledger.** `state.techniques[id]` existing *is* knowing the
technique; `unlock` on the def is only eligibility. How an entry got there
brands its **form**:

- **rough** — self-taught. Crystallizes autodidactically: each technique
  declares `learn.self: { stat, count }`, and `checkTechniqueLearning` (called
  each combat tick) enters it — rough — the moment the fight counter crosses
  while eligibility holds. The counters are the fight noticing you:
  `combat:attacks` (landed swings), `combat:crits`, `combat:dodges`,
  `combat:hitsTaken`. Rough mechanics are all arm, no hips: **+25% stamina
  cost** (`ROUGH_STAMINA_MULT`) — but your own tricks internalize fast:
  **reps count double** on the ladder (`ROUGH_REP_MULT`).
  **Watching (user, 2026-10-24)** is the second autodidactic way: a technique
  with `learn.watch` crystallizes rough once a monster has used it on you that
  many times (`TECHNIQUE_WATCH_COUNT`, 50 for every technique). Each monster
  technique that reaches you (not dodged) bumps `seen:technique:<id>`
  (combat.ts). Same shutter, same eligibility, same Reach rule: sightings
  before a way in exists count from zero (`learnFrom['watch:<id>']`). Gather,
  Lunge and Heavy Blow can be watched; the goblin techniques can ONLY be
  watched — no teacher holds them.
- **canonical** — taught the clean form: a teacher (`NpcDef.teaches`, the
  floor-2 tutor is the first) or a drill manual (`ConsumableSpec.teachesTechnique`).
  No surcharge, full thresholds. Re-learning never downgrades: rough →
  canonical keeps banked reps; canonical never reverts.
- **syncretic** — reserved (see §10).

**Reach (user, 2026-10-21): nothing is learned that could never fire.** The
positions a fighter can stand in are `neutral` plus the exit of every known
technique that can itself be entered, to a fixpoint (`reachablePositions`;
displacement adds nothing, §9a). A technique whose entry is not among them is
*unreachable*: no teacher teaches it and no manual can be studied (both say
which position is missing), and its self-learning count has not started.
`state.learnFrom[id]` follows its counter while it is unreachable and stops
once a way in exists, so `selfLearnProgress` counts from that moment; absent
means reachable all along. Lunge (coiled → extended) is the worked case: held
until Gather. Known gap: a fork or a rune that changes an exit is noticed on
the next combat check, not at once.

**The alpha shutter.** While `martial` is shut (systems/unlocks.ts) nothing
self-learns; teachers and manuals still teach. The baselines keep moving, so
opening the shutter cashes what a reachable technique already earned.

**The ladder** is uniform and logarithmic — no per-technique thresholds:

```
tier I   Practiced   —      10 reps     ×1.05 dmg
tier II  Drilled     —     100 reps     ×1.12 dmg, ×0.92 cd
tier III Honed       —   1,000 reps     ×1.20 dmg, ×0.85 cd
tier IV  Perfected   —  10,000 reps     ×1.30 dmg, ×0.75 cd
```

Thresholds and generic bonuses live in code (`MASTERY_LADDER` etc.); data only
**annotates** a rung — a name override (`mastery: { 3: { name: 'Instinct' } }`)
or an `addFrom` that permanently opens entry positions (Perfected Heavy Blow
fires from neutral). And the summit resolves the forms: **tier IV dissolves
the rough surcharge** — ten thousand swings of your own way is its own
mastery. Refinement (teachers, future) is the shortcut; the ten thousand is
the proof; both roads truly arrive.

**The Honed fork** (`FORK_TIER = 3`, 1,000 reps): a technique with `forks:`
offers a choice of archetypes from the vocabulary (`FORK_ARCHETYPES`) — Split
(2 hits × 0.65), Overwhelming (×1.6, exits Off Balance), Economical (cd ×0.6,
×0.9), Sweeping (+0.35 splash, ×0.9), Flowing (exit becomes Extended);
Lasting/Sudden for defensive moves. The choice is surfaced on the technique's
skill-tree row, stored in `path`, and **permanent** — your practice history is
your build. Every archetype strictly advances the move as a whole (the EV
content test enforces it), the transform applies in `resolvedMove` /
`techniqueExit`, and the name reflects it everywhere ("Split Heavy Blow").
A **syncretic** form is offered the *whole* matching vocabulary instead of the
curated pair — mechanically live, though syncretic today is reachable only via
debug until the two-school acquisition rule ships (§10). Tier IV perfects
whatever you chose.

**Drill slots** (`state.drilling`, `MAX_DRILLED = 3`): executions are recorded
only for drilled techniques. A free slot claims a technique automatically on
its first execution; once full, choosing what to practice is a real decision —
the martial answer to the grimoire's prepared cap. An undrilled technique still fires; it just stops
learning. Reps are counted per technique, shared across weapons: the motion is
the motion, the weapon is an accent.

Family techniques additionally demand the weapon *in hand* at fire time —
known and armed are separate checks.

---

## 7. Current content

Positions: the universal five (§2). Techniques (`unlock` = eligibility;
`learn.self` = the counter that crystallizes the rough form):

| id | | trigger | from → to | move | eligibility | self-learn |
| --- | --- | --- | --- | --- | --- | --- |
| `gather` | 🌀 universal | — | neutral → coiled | 0.6×, +0.02 momentum, cd 30 | fighting 5 | 100 attacks |
| `heavy_blow` | 🔨 universal | — | coiled → off_balance | 2.0×, 8% stamina, cd 60 | fighting 5, STR 8 | 50 crits |
| `sidestep` | 💨 universal | onHit (w20) | any → guarded | +40% dodge 3 s, cd 120 | fighting 8, DEX 10 | 100 hits taken |
| `riposte` | ⚡ universal | onDodge (w20) | any → extended | 1.4×, cd 40 | fighting 12, DEX 12 | 50 dodges |
| `thrust` | 🗡️ sword | — | extended → neutral | 1.5×, +0.15 pen, cd 30 | swordsmanship 5 | 250 attacks |
| `crosscut` | ⚔️ sword | onCrit (w20) | neutral/extended → extended | 1.3×, 0.3 splash, cd 50 | swordsmanship 10 | 100 crits |
| `iai_draw` | 🌙 katana | onEncounterStart (w40) | neutral → extended | 1.9×, +0.1 pen, cd 300 | swordsmanship 15 + katana | 150 crits |
| `deflecting_moon` | 🌗 katana | onParry (w20) | any → coiled | +20% crit 3 s, cd 100 | swordsmanship 15, DEX 15 + katana | 25 parries |
| `finishing_cut` | 👁️ katana | enemy HP ≤ 25% | coiled/extended → neutral | 2.2×, 6% stamina, cd 80 | swordsmanship 25 + katana | 500 attacks |
| `slip_jab` | 🥊 unarmed | onDodge (w20) | any → neutral | 1.15×, cd 20 | unarmed_combat 10 | 75 dodges |
| `ginga` | 🕺 unarmed | — | off_balance → coiled | 0.8×, +0.03 momentum, cd 20 | unarmed_combat 12 | 120 hits taken |
| `meia_lua` | 🌜 unarmed | — | off_balance → neutral | 1.35×, 0.4 splash, 5% stam, cd 50 | unarmed_combat 18 | 100 dodges |
| `weapon_drop` | 🤲 universal | — | any → off_balance | 0.9×, grounds your weapon, cd 100 | fighting 15 + unarmed_combat 10 | 600 attacks |
| `ground_draw` | 🗡 universal | — | coiled → extended | 2.4×, +0.15 pen, recovers grounded blade, cd 120 | fighting 15 | 800 attacks |
| `hidden_draw` | 🔪 dagger (sheathed) | enemy.bar ≥ 65 | any → extended | 2.6×, +0.25 pen, draws sheathed dagger, cd 150 | dagger_combat 10 | 120 crits |
| `whirl_kick` | 🦵 unarmed | — | coiled → extended | 1.4×, 0.35 splash, 5% stamina, cd 50 | unarmed_combat 15 | 300 attacks |
| `clinch_knee` | 🐘 unarmed | onHit (w20) | any → guarded | 1.5×, dazes 35%, 5% stamina, cd 90 | unarmed_combat 20 | 150 hits taken |
| `flowing_shield` | 🛡️🌊 buckler | onParry (w20) | guarded → coiled | 1.0× **+ 120% of the force turned aside**, 4% stamina, cd 70 | shield_combat 10, deflection 5 + buckler | 40 parries |
| `electric_cross` | ⚡🥊 unarmed | onHit — **counter** | guarded → extended | takes 40% off the blow, then 1.0× **+ 100% of what it blocked as lightning**, 6% mana, cd 80 | school_magic_combat 10, school_boxing 15 + unarmed | 200 hits taken |
| `hamstring` | 🦵 goblin | — | coiled → extended | 0.9×, Unfooted 50%, cd 50 | fighting 5 | watched 50 times only |
| `dirty_stab` | 🩸 goblin | — | extended → neutral | 1.1×, Bleeding 50%, cd 40 | fighting 5 | watched 50 times only |
| `pocket_sand` | 🫳 goblin | — | any → neutral | 0.3×, Dazzled 60%, cd 120 | fighting 5 | watched 50 times only |

Hobgoblins fight with gather, hamstring, lunge, dirty_stab and pocket_sand;
the champion with heavy_blow, hamstring, dirty_stab and gather (monsters.data.ts).
`gather`, `lunge` and `heavy_blow` can also be learned by watching them 50 times.

Katana are also swords, so a katana hand holds thrust/crosscut too — the
katana entries are what only the curved blade teaches, flavored after its four
schools (Eishin's draw, the parry-deflection, Ittou's one-cut finisher).
`finishing_cut` demonstrates the conditional-finisher pattern: a baked trigger
with *conditions* instead of an event primes on the enemy's state. Counters
now also include `combat:parries`.

The intended loops, none of them authored:

- **Setup loop**: gather (→ coiled) → heavy blow (→ off balance) → plain swing
  (→ neutral) → repeat. Net ~1.3×/swing before mastery, paid in tempo and
  stamina.
- **Reactive line**: enemy misses → riposte (→ extended) → thrust (→ neutral).
  A dodge-stacked fighter *farms* this; a tank never sees it. Loadout changes
  which chains exist — that's the identity working.
- **Crit branch**: crit → crosscut (→ extended) → thrust. Crosscut re-enters
  from extended, so a crit streak can chain crosscuts.
- **Deflection line**: get hit → sidestep (→ guarded) → parry → flowing shield
  (→ coiled) → heavy blow. Sidestep is currently the main on-ramp into
  `guarded`, so the chain wants a fighter who takes blows *and* parries them;
  Drilled opens a `neutral` entry and the reflex stops needing the set guard.
  Note this is the one line whose damage scales with the ENEMY — it is worth
  the most against exactly the things that hurt the most.
- **Counter line** (`guarded` again, but the opposite temperament): Flowing
  Shield wants the blow *turned aside*, Electric Cross wants it *landed* —
  it eats a softened hit and answers with what the guard ate. Both sit in
  `guarded`, which is why shield, boxing and wrestling content all want
  entries into it; a fighter who never gets hit and never parries has no use
  for either.

Balance guardrail: `heavy_swing` the *skill* was 1.1× on an 80 cooldown with
no cost; `heavy_blow` the *technique* is 2.0× but demands a 0.6× setup swing,
8% stamina, and an off-balance exit. Keep that shape — techniques buy their
power with position and stamina, never for free.

---

## 8. Persistence & migration

- Save v25 (`migrations.ts` `24:`): seeds `techniques: {}` / `drilling: []`,
  sweeps the dissolved actives (`heavy_swing`, `active_dodge`, `fireball`)
  from `skills`, `skillOrder` and `skillTriggers`, and backfills
  `combat.position` on a live fight.
- Save v26 (`25:`): knowledge became the ledger. Anything a v25 save currently
  qualified for is grandfathered in as **canonical** (those fighters learned
  under the old dispensation), keeping banked reps; everything else goes back
  to the counters.
- Save v29 (`28:`): the loadout shelf (`loadouts: []`).
- Save v30 (`29:`): loadouts widen to a whole fighting identity — existing
  plans backfill `spells: []` / `equipment: {}`, which reapply as no-ops.
- `CombatState.position` is transient with the encounter; `techniques` and
  `drilling` persist.
- Rotation ids and trigger keys are namespaced (`technique:<id>`), so they can
  never collide with skill ids and go inert gracefully if content is renamed.

## 9. The prime directive, refined

The original rule was "the player never scripts a sequence." Design work has
sharpened it into its final form:

> **Anything may rewrite a single node. Nothing may write an edge list.**

A rune, a school, a fork may change what a technique *is* — its speed, its
payload, even its exit. None of them may say "and then." Chains are only ever
assembled by the fight, out of whatever nodes the player has collected. The
check for every future feature: "could the player author A-then-B-then-C with
this?" If yes, it belongs to arcana, not here. (One sanctioned edge case: a
data-baked follow-up trigger — `onTechnique:<id>` — may key a technique to a
BASE technique's execution, **one deep, never chained**. Content writing an
edge is fine; the player or a bench writing edge *lists* never is.)

## 9a. Displacement — moving a fighter who did not choose to move

Wind's conditions (`buffeted`, `unfooted`) override where a motion *ends*.
Whether that is legal turns out to be a sharper question than "does it write an
edge", and the answer split:

- **Overriding a technique's exit is explicitly sanctioned.** §9 names it:
  *"a rune, a school, a fork may change what a technique is — its speed, its
  payload, even its exit."* A status doing the same thing is the same class of
  rewrite. Legal, no new permission needed.
- **Pinning a fighter to a position is NOT.** The first design of `unfooted`
  held the bearer *at* `off_balance` so nothing could be entered. That survives
  §9 on a technicality — it writes no edge list — but it makes the position
  itself forbid action, which is exactly what §9c ("gating belongs on
  techniques, never on positions") exists to close. It would also put the
  planner in the position of drawing a graph that no longer describes what can
  happen.

So `unfooted` rewrites **every exit** instead of pinning any entry. Play is
near-identical — you can never arrive anywhere that enters anything, so the
chain game is gone — but the graph is untouched and the planner never lies.

Three rules for anything that moves a fighter it did not ask to move:

> 1. **Displace toward dead ends only.** `StatusDef.displaces.to` must name a
>    position nothing enters from. Landing someone in `coiled` or `extended`
>    would be handing out chain links — content spelling A-then-B through a
>    status, the prime directive violated by the back door. Wind may cost you
>    your footing; it may never buy you a follow-up. There is a test for this.
> 2. **Never displace a plain swing's recovery.** A plain swing resets to
>    neutral (§2), and that is the escape hatch every displacement effect is
>    balanced against. A displacement you cannot answer is a lock, and locks
>    belong to ice.
> 3. **Never route it through `techniqueExit`.** That is a pure query the
>    planner draws edges from (and `techniquesForFamilies` reads). Displacement
>    is applied at the call sites — `displacedExit` in combat.ts for the player,
>    `statusDisplacedExit` inline for monsters — so the graph stays the truth
>    about what CAN happen while the condition decides what DID.

## 9b. The position-graph planner — SHIPPED 2026-07-25

The loadout arranged **on the graph** instead of in a list. A collapsed
section on the Combat panel (`ui/panels/MartialPlanner.svelte`), below the
shipped Active Skills list — which stays the working surface; the graph is
where you go to see how the pieces connect.

- **Nodes** are positions, seated on a ring (the five universal ones hold
  fixed seats; anything content adds later — rune-private positions, §10 —
  is seated automatically after them). **Edges** are techniques, drawn on a
  gradient from entry colour to exit colour, so the strip, the cards and the
  graph all speak the same colour language. Parallel edges fan into lanes,
  and a technique that exits where it enters (Flowing Thrust, Crosscut) draws
  a real self-loop — the engine role made visible.
- **Reflexes orbit.** `'any'`-entry moves get no entry node, because no
  position is their home: they sit on a dashed outer ring and point inward at
  the one thing about them that IS a position — where they leave you.
- **Weapon groups** (`WEAPON_FAMILIES`) are a multi-select **lens**, not a
  loadout: picking "sword + unarmed" shows what those families would put on
  the graph, plus the universal moves, with unknown ones drawn faint and
  locked. It equips nothing and grants nothing. Anything already in your plan
  draws regardless of the filter — a view may never hide what you fight with.
- **Hover** pulses a move's entry position(s) *inward* and its exit *outward*:
  the two halves of "where must I be" and "where does this leave me".
- **Add / discard** is the shipped bench, reached from a new door: a family's
  dropdown (double-click the group, or its ▾) lists its roster and adds a
  known move to the rotation; ✕ on a plan row benches it, reps intact.
  Dragging writes through `moveSkillTo` — one order, one door into it.
- **Configuring one move** is the graph's job too: double-click a plan row
  (or hit its ⚙) and `ui/lib/EntryConfigModal.svelte` opens on the whole
  thing — description, payload, positions, the baked reflex (read-only, since
  your overlay can only narrow it), mastery and drill toggle, then the event
  and conditions. The window is deliberately id-agnostic: a rotation entry is
  a skill, a prepared spell or a technique, and all three carry the same
  `skillTriggers` overlay, so the Active Skills list opens the same window for
  anything. Conditions are a firing POLICY for one node — never an order.

The cards shrank to make room for it. Every rotation entry — technique or
prepared spell — is now a uniform **two-line card** (~44px, against a jittery
46–86px before), and the layout is the same shape for all four schools:

```
line 1   {icon} {Name} {⚡}                    {entry→exit pills} {🏋️}
line 2   {🥋|📖|⛩️|🧠} {reps | 💧cost}                        {⟳ when}
```

Line 1 is what it is; line 2 is what it costs and when it comes round again.
The right of line 1 is technique-only — nothing else has footwork or a drill
switch. The glyphs carry what words used to: `📖`/`⛩️`/`🧠` mark arcane,
divine and psionic (the word "spell" beside a book is redundant), `🥋` marks a
technique and is followed by its banked reps — a technique's reps are its
currency the way mana is a spell's.

Two glyphs that must never be confused: **`⟳` is cadence** (how soon it can
fire again — the live countdown when it is counting, the base cooldown when it
is not) and **`⌛` is duration** (how long an effect lasts). They answer
different questions, so `⌛` stays out of the card entirely and lives in
tooltips and the config window.

The **reorder arrows are gone** — dragging is the one way to order the
rotation, and the whole card is the handle. Everything that used to be printed
on the card (tier, form, "next in N", the trigger summary, the spelled-out
status) moved into its hover tooltip; everything editable moved into the
window.

Core owns which edges exist (`positionGraph`, `techniquesForFamilies`,
`techniqueBenched` in systems/martial.ts, all live-derived); the component
owns only geometry.

**The prime directive holds.** The graph reports that one move happens to
leave you where another starts. It has no notion of "first" or "next", the
plan is a priority list exactly as it always was, and nothing in it can be
made to spell A-then-B-then-C. Per-technique **triggers are deliberately not
drawn** — the designer parked that as "not a pressing problem". If they ever
arrive, they belong on the edge (a small glyph on the stroke, since a trigger
is a property of one node's firing, not of the pair) and must not become a
second authoring surface.

**Loadouts widened** the same day (save v30): `Loadout` gained `spells`
(grimoire uids) and `equipment` (worn uid per slot), so one click restores a
whole fighting identity. Applying stays grant-free — a forgotten spell, a sold
blade or a requirement you no longer meet simply doesn't come back, and
equipment goes through the ordinary `equipItem` path so wield rules and
requirements are respected.

**And then `triggers`**: the plan now carries each entry's firing conditions
whole (`enabled` + `event` + `conditions`), because when a move is allowed to
fire IS the build. It is **authoritative** when present — applying clears
overlays on ordered entries the plan doesn't mention, since a plan you saved
should be the plan you get back, not that plus whatever you fiddled with
since. Both directions deep-copy (`cloneTriggers` in game.ts): a saved plan
must never alias live state, or editing a condition would silently rewrite the
plan. The field is optional and needs no migration — a plan from before it
simply has none, and falls back to its `benched` list, which is all it ever
knew.

## 9c. Readiness, discovery and the spellblade seat — SHIPPED 2026-07-26

Three changes that turned out to be one idea: **gating belongs on techniques,
never on positions.**

**Technique-readiness conditions.** One trigger subject per technique
(`technique.<id>`, enum: Ready / On cooldown), generated the way
`RESOURCE_SUBJECTS` is. It reads the COOLDOWN only — deliberately not "could
this fire", because the useful question is about a resource that will still be
there in two swings; Ground Draw's other gates (a grounded blade, the coiled
entry) are things the chain is about to create, so folding them in would make
the check always fail.

This is what lets a plan refuse to start what it cannot finish: Weapon Drop
asks whether Meia Lua and Ground Draw are ready before throwing your sword in
the dirt — retiring the foot-gun that shipped with weapon states. It stays
legal under §9 because it is a **readiness predicate on one node**, not an edge
list: nothing forces B to follow A, the fight still decides. Subjects for
unlearned techniques are hidden from the picker (`TriggerSubjectDef.visible`,
a presentation concern — a stored condition naming a hidden subject still
evaluates normally).

**Positions discover themselves.** A position is drawn once the player knows a
technique that enters or leaves it (`positionKnown` / `knownPositions`);
Neutral is always shown. No new state — learning the move IS the discovery,
because you cannot stand somewhere you have no way of reaching. An optional
`PositionDef.unlock` hides one even then. The strip and the planner both filter
through this, so a newly learned technique lights its seat up. Positions also
gained `effects.dodgeMult` alongside `incomingMult`, read with `??` so a
declared **0** survives — a stance taken deliberately wide open dodges nothing,
which is the entire point of standing in it.

**The spellblade seat.** `spell_ready` (🔮, incoming ×1.1 — your attention is
in the working, not their footwork) plus a companion `CombatState.readiedSpell`
holding the grimoire uid: the position says you are holding something, the
field says *what*. Exactly the `grounded` / `sheathed` pattern.

- **Ready Spell** (neutral/guarded → spell_ready) takes up the first prepared
  working you can pay for and **spends its mana now**. Carrying it is the
  commitment. Its baked trigger is the anticipation read (`enemy.bar ≥ 55`):
  you take a working up *because* something is winding up to swing. Playtesting
  without it showed why it is not optional — the form fires the moment it is
  off cooldown, your own next swing drops the seat, and it becomes a mana
  furnace that readies and loses a spell every cycle without ever delivering.
- A held working is **out of the ordinary rotation** (`spellIsHeld`): a
  prepared spell that is being carried must not also cast itself, or the same
  working goes off twice and is paid for twice.
- **Spell Parry** (spell_ready → guarded, `onParry`, `requiresReadiedSpell`) is
  a **counter**, so it needed almost no new plumbing — counters already gate on
  position, cost from a named pool and fire free of the action bar. Its
  `move.deliversSpell` routes into `castCraftedAttack` with the held working.
- `setPosition()` is now the single place position changes, so **leaving the
  seat drops the working** — a plain swing costs you the spell and the mana.
  That risk is what makes carrying one a decision.

This is the magiknight rule made literal: martial supplies the structure (when,
from where), magic supplies the payload (what lands). Note what did NOT get
built — positions with conditional entry/exit. The technique gating already
does it, and plain-swing-to-neutral remains the anti-softlock valve.

**Known tension, for §2's sake.** Readying is currently free of the action bar
(it has no `damageMult`, so it rides the off-bar slot), which means holding a
working costs mana and tempo-nothing. The honest shape is that readying should
BE your action that turn — which needs the explicit `active | reflex` split
(§10 / the deferred #2 work). The baked `enemy.bar` read is the interim
governor, not the final answer.

## 10. Settled future design (not yet built)

Decisions below are settled with the designer; only implementation order is
open. Each is data-shaped — the complexity audit across the whole design came
to: one form enum value, `grantedForks`, `ExertionSpec.pool`, `deepExplore`,
position swing-mods, and rune technique-mods. Everything else is content.

**Acquisition lattice (teacher half).** Teachers grant CANONICAL forms:
`teaches: [{ technique, requires, reps?, cost? }]` on NPC defs, surfaced as a
Training section at their spot. `reps` requirements make curricula (the sword
master withholds Crosscut until 100 Thrusts — repetition gates, not gold
gates). **Glimpsed**: once a lesson has been *seen* but not taken, the
remaining self-learn count halves — you read the booklet and wing the rest
(result is still rough). **Refinement**: a teacher upgrades rough → canonical;
banked reps convert generously (doubled — "the master shows you what your
practice actually taught you"), so refining never demotes a held rung.
Visibility: unseen techniques are invisible (crystallization is a surprise);
glimpsed ones show their counter progress; lessons list requirements like
quests do.

**Syncretic forms** (mechanics shipped, acquisition pending). The form exists:
canonical-grade, offered the whole fork vocabulary instead of the curated
pair. What remains is the ACQUISITION rule: a technique taught by two schools
has two canonical forms; taught the second while **unsettled** (< tier III)
you synthesize into syncretic; settled means the second master just nods —
"your sweep is already yours." No per-family rep tracking, ever — the tier III
line carries the whole fiction, and delaying your own tier III to collect
perspectives is an intended strategy. Until teachers exist, syncretic is
reachable via debug only.

**Fork archetypes — SHIPPED** (see §6). Still open from the original spec:
bespoke display names via a name table (Heavy Blow + overwhelm rendering as
"Crushing Swing" instead of "Overwhelming Heavy Blow"), and master-granted
exclusive options (`state.techniques[id].grantedForks`) — one string pushed by
teacher content, merged into `forkOptions`.

**Teachers in the world.** Delivery mechanism: **deep exploration** —
`SpotDef.deepExplore: { requires, adds }` reopens a 100%-explored spot once
conditions hold ("something about these woods feels different now"), revealing
a hermit master, hidden path, or dungeon. Gates can be martial themselves
(expose rep counters as stats so "1,000 Heavy Blows thrown" can summon the
master). Schools teach technique families; itinerant masters are met-and-missed
(quest-gated, missable — not every run sees every lesson, deliberately).
Reputation gates lessons via existing `quest`/`stat` conditions; school rivalry
is dialogue and divergent quest branches, never mechanics — interaction stays
divine's identity. Time-gated presences wait on a global clock/weather system.

**Magiknight seams.** Magic may facilitate structure under the §9 rule, on a
three-tier severity ladder of rune surgery: **tempo** (wind-imbued armor →
Flash Step: Sidestep answers faster), **effect swap** (psionic rune → the
dodge becomes a force-shield advance), **exit rewrite** (dark rune → clone
decoy, exit into a rune-private position "Tumbling"). Runes may thus **add
positions to the graph**, which implies `PositionDef` gains optional swing
modifiers (Tumbling: next attack 0.7× but guaranteed crit) — worth
retrofitting to base positions (Off Balance carrying a small exposure) so
position costs are felt, not just chain-breaking. Plus: `ExertionSpec.pool:
'mana'` makes a mana-burning school style ("Magic Combat" replacing Finesse)
one field; exclusive school techniques ("First Stance — Half Moon", katana,
row-splash) are plain content. Modified techniques display their rune name
("Umbral Step") with the source badged.

**Cost positions are school seats** (designer, 2026-07-25, via capoeira). A
"bad" exit is a design promise: some school will claim it as home. Capoeira
(unarmed) enters from **off_balance** — the ginga; recovery moves that exit
COILED (the fall is the wind-up), sweeps that only exist mid-stumble — turning
excess aggression (Heavy Blow, Overwhelming forks) into a two-stroke engine
instead of a self-punishment. Family-gated: an Overwhelming swordsman still
pays full price unless a master teaches a universal rough form (teacher-layer
special). Pairs with position swing-mods: capoeira moves ignore or invert
off_balance's exposure. Same logic reserves **guarded** for a turtle/counter
school, and every family vocabulary's cost states for theirs.

**SHIPPED 2026-07-25** (this whole batch): position effects (`PositionDef.
effects.incomingMult` — off_balance ×1.15 in, guarded ×0.9), the `enemy.bar`
trigger subject, capoeira's off_balance entrants (ginga, meia_lua), weapon
states below (grounded + concealed; `state.sheathed`, `combat.grounded`,
`move.equipment` verbs, sheathe toggle on the Combat panel, restore hooks),
`ExertionSpec.pool` with the Magic Combat school (mana-fuelled Finesse), and
rune technique surgery (`RuneEffect.techniqueMods`: rename/tempo/exit/
`grantsFork`, demo runes gale/earthbind/umbral). Throw/retrieve remains
future. Original spec kept below for the reasoning:

**Weapon states** (designer, 2026-07-25 — generalized from two spitballs).
The primitive: a weapon is `wielded | grounded | concealed`, techniques are
the verbs that move it between states, and live `equippedTags` makes all
downstream identity (unarmed pseudo-tag, school stance-swaps, dormant
stats/runes) follow automatically. State-gated techniques check the weapon
slot itself, not `techniqueArmed` (tags read unarmed while the blade is
hidden/down). Restore hooks on encounter end/defeat/abandon. The archetypes:

- *Drop/Recover* (grounded — the aggression loop): "Weapon Drop" (any →
  off_balance) → capoeira flows the stumble to coiled → "Ground Draw"
  (grounded blade + coiled → extended), an iai with the earth for a sheath.
  Master-taught, cross-training gated (sword school + unarmed school); costs:
  weaponless stretch, off_balance transit, interruption strands you boxing
  over your own sword. The flagship biographical-graph build.
- *Conceal/Draw* (concealed — the deception burst, dagger identity): fight as
  genuinely unarmed (unarmed schools live — the boxer with a knife) until the
  concealed draw fires MID-FIGHT on an enemy-state read (winded/dazed/
  mid-windup), priced by the dagger's dormancy until then. Distinct from Iai
  Draw on purpose: iai is speed from stillness, an honest opener; this is
  deception, an anytime-burst. Auto-reconceal between fights.
- *Throw/Retrieve* (future): a thrown spear/dagger is grounded-at-a-distance —
  same slot, same retrieval problem, plus range.

**Combat breadth = fan-out.** Breadth grows by adding *entrants per position*,
disambiguated by baked triggers, tie-broken by rotation order; the player's
overlay triggers are a decision *policy*, never a script. Wanted: an
`enemy.bar` trigger subject (≈"the enemy is about to act") to unlock the
anticipation category (Viper Strike out of the coil), and enemy-state finisher
conditions (already expressible). Schools are families of entrants for shared
positions; syncretic forms and masters widen personal fan-out.

**What stays rejected**: free trigger×move pairing, technique crafting, any
martial bench, mechanical school rivalry, per-family rep ledgers, and
knowledge slots/forgetting (drill slots ration progression; knowledge is a
collection).

## 11. Authoring techniques — the loop cookbook

The goal of the pool is not size, it is **exploitable emergent patterns**: the
martial answer to "blaze then blaze then blaze fourfold", except the loop must
be re-won every fight. Design techniques as parts of engines the player
assembles, and let the fight decide whether the engine runs.

**The natural governor** (know it before tuning anything): plain swings reset
position to neutral, and a plain swing happens whenever the loop's next
technique is on cooldown. Loop uptime = cooldown vs. attack interval — which
means **attack-speed investment breaks your own loops** (more filler swings,
more neutral resets), while Economy forks tighten them AND accelerate mastery.
Slow heavy rhythms loop; fast tempo builds live on `any`-entry reflexes. Two
player archetypes from one interaction — protect it.

**The six roles.** Every new technique should knowingly be one of these:

| role | what it does | examples | rationing |
| --- | --- | --- | --- |
| **Engine** | exit feeds its own entry | Flowing Thrust (fork) | at most one per family, gated behind forks/mastery |
| **On-ramp** | cheap entry into a position from neutral or a reflex | Gather, Riposte | the supply side — more on-ramps into a position raise every exploiter of it |
| **Payoff valve** | expensive spender of a position | Heavy Blow, Finishing Cut | what the loop is FOR — big numbers, real costs (stamina, bad exits) |
| **Bridge** | A→B mover connecting two clusters | (none yet — e.g. a katana move exiting Guarded) | one bridge makes a whole position matter to a new audience |
| **Reflex wildcard** | `any`-entry, event-triggered | Sidestep, Slip Jab | entropy injectors; keep cooldowns short and payoffs small |
| **Enemy-keyed conditional** | primes on enemy state, not events | Finishing Cut (HP ≤ 25%) | makes MATCHUPS change rotations; the fan-out breadth lever |

**Positions are APIs.** Every technique that exits Extended implicitly buffs
every technique that enters Extended — including other families' and ones not
written yet. Before adding a technique, look at the position strip: a chip
with no badges is a position nobody exploits (today: Off Balance, Guarded
have no entrants — deliberate costs, but also open design space); a chip with
many is a hub whose on-ramps are valuable. Declare new positions sparingly —
each one is a promise that entrants will exist.

**Authoring checklist for one technique** (every keyword in DICTIONARY.md):
1. Role (above) and home `skill` — which school's fantasy is this?
2. `family` tag or universal; eligibility (`unlock`) and `learn.self` counter
   — what does the fight have to show you before your body learns it?
3. `trigger`: event (+ `window: 20` if reactive) or enemy-state conditions,
   or none for stance moves. The trigger IS the identity — bake the read.
4. `from`/`to`: which chains does it join, which does it open? Check the
   strip. An exit into off_balance/guarded is a real cost; into extended is
   a gift to the whole extended cluster.
5. `move` numbers within bands: damageMult ~0.6 setup / 1.2–1.5 mid / 2.0+
   valve; cooldown 20–30 rhythm / 50–80 beat / 100+ moment / 300 opener;
   staminaCost 0 reflex / ~0.05 mid / 0.08–0.12 valve.
6. `forks`: a curated pair that pulls the technique toward DIFFERENT roles
   (Split→sustain, Overwhelm→valve, Economy→engine-grease, Sweep→AoE,
   Flowing→engine). Pure-exit archetypes must actually move the exit.
7. `mastery` notes: name a rung if the school has flavor for it; `addFrom`
   only for genuinely earned graph growth (Perfected-tier, mostly).
8. Balance guardrail: power must be paid for in position, stamina, or
   trigger rarity — never free (heavy_swing 1.1×@80cd free vs Heavy Blow
   2.0× behind a 0.6× setup + 8% stamina + off-balance exit).
