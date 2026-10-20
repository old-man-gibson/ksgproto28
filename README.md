# Frontier Idle

A browser-first idle/incremental RPG in the vein of The Climb, Proto23 and Immortality Idle.
Vertical slice: attributes, branching skills, combat styles, tier/rarity monsters, modular
equipment, a traversable world with one-way paths, tiered achievements, saves and offline progress.

## Running

```sh
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # static production build in dist/ (deployable to any static host)
npm test         # core logic unit tests (vitest)
npm run check    # typecheck (svelte-check)
npm run pacing   # play band 1 headless (John, docs/COMPLETABILITY.md §8) and print the timeline
```

Requires Node.js (LTS). The build is a fully static site — `dist/` works on GitHub Pages,
itch.io, Netlify, etc. A standalone desktop executable is planned via Tauri (milestone 2+),
which wraps this same build.

## How to play

You start in Oakrest Village. Pick an activity at your current spot (train, hunt, explore,
rest) — it runs automatically, ten ticks per second. Skills *manifest* while you act:
spar or fight to discover Fighting; keep fighting with a sword to branch into Swordsmanship,
and beyond. Monsters come in tiers (Elite/Boss) and rarities (Uncommon → Epic) with better
loot. Combat styles (Balanced/Aggressive/Defensive) change your stats and which active
skills fire first. The game autosaves every 30 s and simulates up to 8 h while you're away.

**Pause and step.** `⏸️ Pause` (Space or `P`) freezes the *whole world* — fights, activities,
bench runs, travel, regen and respawn timers alike — so you can read a fight, plan a rotation
or check how a number was arrived at without the clock running. It buys time, never progress:
paused wall-clock time is dropped rather than banked, and the autosave keeps running so a long
pause can't be cashed in as offline time later. While frozen you can hand-crank the sim: `+1`
(→) one tick, `+1s` (Shift + →) one second, and `⏭ Next` (`N`) runs on until the fight has
something new to say — one thing happening rather than one tick, which is what makes combat
readable turn by turn. The same controls sit next to the Fight Feed on the Combat tab.

## Creating content

Everything is data in `src/core/data/*.data.ts` — items, monsters, skills,
quests, regions, styles, recipes, achievements. **Read
[docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md)** for copy-paste templates,
tag/counter reference tables, balancing formulas, and the save-safety rules.
The workflow: edit a data file, run `npm run verify`, playtest. The typecheck
and the content-linter test suite (`tests/content.test.ts`) catch broken
references, invalid values, and duplicate keys before they reach a save.

**One design law binds all content: the game stays completable by a player who
never reads, a player who only swings a longsword, and a player actively
hunting degenerate loops.** Breadth is this project's identity, so no subsystem
may ever become a toll on the road through it — every one of them needs a way
to use its output without engaging its grammar, and no reachable state may be
terminal. Before authoring a new system, read
**[docs/COMPLETABILITY.md](docs/COMPLETABILITY.md)**.

**Or use the forge.** `npm run forge` opens a content workbench (dev-only, at
`/forge/`): drag the world map to place spots and draw one-way or hidden paths,
put NPCs where they stand, set exploration find thresholds on a track, and
browse/cross-reference every registry — "what points at this monster" is a click
rather than a grep. It loads the *real* registries through Vite, so it can't
drift from the types, and writes back through the TypeScript AST, so it changes
the range it was asked to change and leaves your comments alone. Nothing lands
until you approve the diff. See **[docs/FORGE.md](docs/FORGE.md)**.

## Architecture

- `src/core/` — pure game logic, zero DOM/framework imports, fully unit-testable.
  - `engine/` — fixed-timestep accumulator, typed event bus, seedable RNG (state in the save).
  - `systems/` — attributes, skills (XP + unlock conditions), actions, combat, equipment,
    locations (directed graph), achievements. One shared `Modifier` pipeline powers
    equipment, achievement bonuses, combat styles, passive skills and buffs.
    `resources.ts` owns every pool generically (see below), `health.ts` is the one
    door HP changes through, and `monsterStats.ts` derives enemy stat blocks from
    enemy attributes the way `derived.ts` does for the player.
  - `data/` — all content (skills, monsters, items, spots, achievements) as typed data
    keyed by string ids. Adding content means adding an entry, not writing system code.
  - `save/` — versioned serialization + migration table, localStorage, export/import,
    capped offline catch-up.
- `src/ui/` — Svelte 5 components. `state.svelte.ts` wraps the game state in a deep-reactive
  `$state` proxy; the core mutates it directly and the UI updates automatically.
- `tests/` — vitest specs for the tick loop, skill branching, combat, saves, offline progress.

Measured notes on where the engine actually spends its time, what a phone port would
take, and what the docs do and don't cover live in
**[docs/ENGINEERING.md](docs/ENGINEERING.md)** — with the profiling probe that
regenerates the numbers as content grows.

## Proto26 content integration

Phase 1 of the proto26 data port is in: two regions (Verdant Frontier + Westlands),
intrinsic 7-tier monsters (basic → divine, multiplier rolled per spawn) with rolled
modifier tiers (demiboss/boss/aberrant) and rarities, weighted drop tables with
stackable sell-only materials, 9 equipment slots with attribute requirements,
gather/job activities, combat styles with unlock conditions and `replaces` upgrades
(Jigen-Ryu supersedes Frenzy), and weapon-family skills whose bonuses only apply
while the matching weapon (or bare fists) is equipped.

Phase 2 added **typed damage** (slashing/piercing/bludgeoning/heat/cold/poison/arcane):
weapons determine your damage type, every monster has resistances and vulnerabilities
(clubs wreck slimes; swords bounce off golems), armor only stops physical damage, and
resistance skills manifest and level through *exposure* — get burned enough and Heat
Resistance appears. It also added **crafting**: recipes at Kystel's Anvil turn mined
scrap, furs, herbs and hardwood into gear as an idle activity, leveling Smithing
(which unlocks the advanced recipes and speeds up crafting).

Phase 3 added **NPCs & quests**: quest givers stand at spots (Thora Ironbrand at the
forge, Captain Bren at the gates, Elder Maren in Oakrest) offering kill/craft/collect/
travel objectives with gold, item, material and skill-XP rewards. Progress is tracked
purely through the event bus; turn-ins require returning to the giver; chains unlock
follow-ups via quest-completion conditions (which skills, styles and recipes can also
use). Saves are self-healing: if a failed load ever lets a fresh game overwrite the
slot, the recovery copy with the most progress is restored automatically on the next
boot (hard reset wipes recovery copies so it stays deliberate).

Exploring is graded. A spot's `exploreTicks` is a search, and `finds` sit at
shares of it — a herb patch at 25%, a purse at 100%, and in Deep Woods the mossy
chute at 55%, which turns the shortcut into a reward for *looking* rather than a
consolation prize for finishing. A find can pay materials, an item, a rune, gold,
a rumor that marks another spot on your map, or an early way through a hidden
connection. Each fires once, at most one per tick.

Navigation: the Location tab has a **collapsible world map** (SVG, per region) —
click any discovered spot to auto-route a multi-leg walk (Dijkstra over discovered
spots, honoring one-way and hidden paths); undiscovered neighbors show as "???".
**⚡ Waypoints** (Village Square, Hamlet Square, Malgeri Base) offer instant caravan
fast travel for gold — the game's first gold sink.

Combat styles: **nine generic stances** (Neutral, Frenzy, Crush, Cleave, Quick,
Evasive, Finesse, Brace, Flurry) with distinct goals, plus **weapon schools** —
levelable skills that manifest by fighting in the stance they upgrade with the
right weapon, then *transform* that stance while the weapon is held (sword:
Ittou-ryu, Jigen-ryu, Niten-Ichi-ryu, Eishin-ryu, Destreza, Bolognese; unarmed:
Boxing, Taekwondo, Muay Thai, Wrestling). Schools scale with their skill level;
unequipping the weapon falls back to the generic stance. New stats: crit damage,
penetration, splash damage, parry and riposte.

**Two hands, and what fills them.** Every held item declares how it is wielded:
*light* (either hand, no cost), *one-handed* (60% effect off-hand),
*two-handed* (fills both hands — nothing else may be held), or *off-hand*
(shields, parrying blades; 75% effect if forced into the main hand). Anything
turned out goes back to the pack. Items can also carry **hand bonuses** that
exist only in one hand and may demand a partner — a parrying dagger is worth
+4% parry alone and +5% more beside a rapier; the Warden's Buckler has a
main-hand bonus, so punching it forward costs it nothing. **Parry** turns a
blow aside entirely and cuts back without touching your action bar.

**The parry line.** Dodge is trained by DEX and every evasive stance; armor by
CON and Shield Combat. Parry has its own three tiers now: **Deflection**, a
skill that levels from carrying anything tagged `parrying` (parrying dagger,
buckler, rapier) whatever stance you fight in; a **defend exertion** — fencing
stances buy parry per incoming blow the way Evasive buys dodge; and two schools
that take a *defensive* stance's slot — **Destreza** (rapier) supplants Evasive,
**Bolognese** (sword and buckler) supplants Brace. Parry chance caps at 50%, so
the growth axis is **riposte**: the share of your damage the free counter-attack
carries, base 30% and uncapped.

**Stamina makes the stances bite.** Swinging always costs a trickle — priced
per second of wind-up and set just under what you recover, so plain fighting is
sustainable. Beyond that, **Exert** is a switch you throw: while it is on, your
style pays its real cost for a payoff shaped to its identity: Crush pays the most for damage and armor
penetration, Frenzy trades dodge and armor for damage and speed, Cleave carries
part of the blow into a random flanker, Flurry buys extra simultaneous hits,
Finesse holds its breath (slower, far more crits), Quick builds momentum until
it caps, Evasive and Brace spend on *incoming* attacks for dodge and armor, and
Neutral pays a pittance for a small edge. Bonuses scale with the stamina
actually spent and with **Stamina Power** — every point of cost your training
saves comes back as payoff, so efficiency and potency grow together (with a 50%
floor on cost, so exertion never becomes free). Spending stops at a 20% reserve
— **winded**, you fight on technique alone until the bar refills. Bottom the bar out entirely (Jigen-ryu
throws everything into one strike; poisons will too) and you are **exhausted**:
the bar turns a sickly green, every action bar fills 15% slower, and regen
crawls until the pool is back over half.
Weapon taxonomy: supergroup tags (sword/dagger/unarmed/…) carry mastery skills;
subgroups (katana, …) refine them — katanas are swords.

**Pools are a registry.** HP, Stamina, Mana and Spirit are entries in
`data/resources.data.ts`, not four fields the engine knows by name. Each names
the derived stats holding its capacity, recovery and consumption multiplier, and
optionally a *reserve*: the floor ordinary spending stops at, what to call the
two lockouts, what running dry costs, and how slowly it crawls back. Everything
generic reads the registry — per-tick regen, clamping, the lockout announcements,
the trigger subjects a skill can fire on. Adding a pool is an id, its stat
formulas, and one entry.

Every pool has two capacities and they are deliberately different. Its **true
max** is the derived stat, and it is what the reserve floor is measured against;
its **available max** is what a wound has left you. Nothing lowers the latter
yet — status conditions will — but the split has to exist first, or a puncture
that seals off 5% of your stamina would drag the 20% reserve down with it and
quietly hand back spendable stamina as a reward for being injured.

**Monsters derive their stats too.** A spawn rolls *attributes* — the def's base
grown to its level, jittered per attribute, then scaled by tier × modifier ×
rarity — and stores only those plus the HP it has left. Damage, speed, evasion
and max HP all fall out of `monsterStats()` on read, from the same formulas the
bestiary's field notes use, so the book can never drift from what you meet.
Because the multipliers land on attributes rather than on finished stats, tier
scaling is gentler at low levels (a stat like `12 + 7 × CON` has a flat part that
never scaled) — and anything that wants to alter a living monster has one place
to apply.

**Status conditions.** Poison, burns, chills and wounds are entries in
`data/statuses.data.ts`, held by monsters and the player alike. Each is a single
condition with an *intensity* that everything scales off, a `stacking` rule
deciding what a second dose does (keep the stronger, fold part of it in, add up,
or count separate wounds), and a worse form waiting behind it — chill enough and
you freeze, leave a bleed alone and it becomes a laceration. Healing walks you
back down the ladder as readily as damage walked you up it.

Removal belongs to the **source**, not the condition: the same burn is eight
seconds of nuisance from a slime and a permanent curse that only water puts out,
because the thing inflicting it declares its own `duration` and `removal` rules.
Conditions reach into everything the foundations exposed — they modify stats
through the ordinary pipeline, seal off parts of resource pools (a laceration
cuts your usable HP without touching the reserve maths), dull *specific classes*
of modifier (a chill numbs your hands around your weapon, not your training),
ration how much of their own damage healing may undo, and can kill you while you
are chopping wood.

Twelve damage types now, with `earth`, `water`, `light` and `dark` joining the
original eight — each with its own resistance stat and its own signature
condition. The conditions act on *each other*, which is what makes an element
read as an element: water carries a chill three times as deep, sours venom into
rot on contact, and halves the jolts it takes to reach a shock, while deciding
outright what your fire, cold, lightning and poison resistances are rather than
nudging them.

**Modular crafting.** A *discipline* is a bench: slots that accept things by
tag, and outcomes matched against what you actually put in. Two shapes are in:
**runecarving** has one outcome and all its variety in the parts (patterns cut
into a slab, inlays and gems worked into the cuts), while **cooking** has many
outcomes and finds the right one by looking in the pot — meat and a vegetable
is a stew, add seasoning to fine ingredients and the same pot is a feast. Both
run on one engine; adding alchemy or mutagens is a data entry plus a small
module that knows what its results mean.

Everything a discipline consumes is **graded F–S**, and F genuinely bites: its
multiplier is negative, so one rotten ingredient drags a dish down and eating
the result makes you ill rather than doing nothing. Dishes are graded materials
with a `consumable` spec, which splits cleanly into **instant** effects (a
potion's full amount at once) and **sustained** ones (a dish that feeds you
across its duration). Sustained effects are ordinary status conditions, so they
inherit the three lifetimes conditions already had — a set duration, one that
runs until something happens to you, or one that never ends on its own.

**You are allowed to fail, because the game tells you why.** Every encounter is
tallied into a *ledger* — what hit you and for how much, credited to the thing
that actually did it rather than to whoever happened to be standing in front of
you when you dropped; what your armour, parries and footwork turned away; what
healing landed and what a condition refused to let land. Go down and it opens as
a full-screen summary, the same size every time whatever killed you. It is kept
for wins too — a fight you nearly lost is worth reading — and **📓 keeping** one
files it in the combat notebook to study while you plan the rematch, transcript
and all. The ledger is a rollup rather than a recording: its size follows the
number of things involved, never how long the fight ran.

**Fights are drawn.** The Combat tab opens on a battle stage: the place painted
behind the fight (the city, a torch-lit hall, the flooded cistern, the silk
gallery…), you on the left and the formation on the right in its slots, with
lunges, hit flashes, floating numbers and deaths read straight off the state
between ticks. Every place's header on the Location tab uses the same art, and
a spot with a fight budget shows it as a row of pips. A tower's map shows one
floor at a time, fitted to that floor's rooms. Portraits appear on the stage
wherever a monster has `art` and the licensed pack is present, and emoji
otherwise.

## Roadmap (milestone 2+)

- More quests & dialogue trees; NPC shops (charisma already affects prices)
- Monster mutations (typed as `mutation: string | null`, currently always null)
- Mana as a fighting resource (stamina already is), active-skill loadout management
- Tauri desktop build
- Prestige/rebirth layer

## Credits

Enemy artwork is from the **Librarium** battler library by **Ækashics
(Aekashics)** — [akashics.moe](http://www.akashics.moe/) — used under its
[terms of use](http://www.akashics.moe/terms-of-use/). Monster names in this
project are our own; the art is his.

> **Cloning this repo:** `src/assets/enemies/` is deliberately excluded from
> version control. The licence permits shipping the built game but not
> redistributing the battler files themselves. A fresh clone installs, builds
> and runs — enemy portraits simply resolve to missing images until you restore
> that folder from your own copy of the Librarium pack.
>
> The same goes for `src/assets/tilemaps/` — the Epic RPG World tile packs the
> drawn maps are painted from (floor 0 today). Without them the map falls back
> to the plain diagram; the composed scenes themselves are in the repo. See
> [docs/TUTORIAL.md](docs/TUTORIAL.md) §4.

Who wrote what — design, implementation, and the provenance of every layer of
this project — is recorded in [docs/AUTHORSHIP.md](docs/AUTHORSHIP.md).
