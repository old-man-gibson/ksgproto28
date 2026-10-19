# Authorship

*A provenance record for Frontier Idle. First compiled 2026-07-28; recompiled
2026-08-05.*

This document exists to answer one question honestly: **who did what?** It was
compiled from the primary record — 37 Claude Code session transcripts spanning
2026-07-05 to 2026-08-05 — plus the state of the repository itself. Every number
below is countable from those two sources.

---

## 1. The raw shape of the collaboration

| | 2026-07-28 | 2026-08-05 |
|---|---|---|
| Sessions | 26, over 24 days | **37, over 32 days** |
| Your turns | 311 | **437** |
| Your written direction | ~135,000 chars (≈22,000 words) | **~215,000 chars (≈35,000 words)** |
| Median turn | 265 chars; 94 over 400; 12 over 1,500 | 258 chars; **132 over 400; 15 over 1,500** |
| Claude turns | 14,578 | 19,472 |
| Claude file edits | 3,158 `Edit` + 294 `Write` | 4,054 `Edit` + 333 `Write` |
| Claude shell/inspection | 1,634 Bash, 829 Read, 393 Grep | 2,113 Bash, 1,192 Read, 678 Grep |

| Repository | 2026-07-28 | 2026-08-05 |
|---|---|---|
| `src/core/` (data + systems + engine + save) | ~26,700 lines | **~36,000 lines** |
| `src/ui/` (23 Svelte components) | ~13,100 | **~14,500** |
| `tests/` | 39 files, **880 cases** | 50 files, **1,089 cases** |
| `forge/` (the content workbench) | ~9,700 | ~11,800 |
| `docs/` | 10 documents, ~37,600 words | **15 documents, ~56,800 words** |
| Art assets you sourced and integrated | 2,252 PNGs | 2,263 PNGs (licensed — see §9) |
| Save format | version **35**, 34 migrations | version **40**, 39 migrations |
| Content registries | 26 | 28 |
| Systems modules | 39 | 46 |

The ratio that matters: **~35,000 words of your design writing produced ~50,000
lines of engine and UI.** That is roughly the ratio you'd expect between a design
document and its implementation. It is not the ratio you'd get from someone
typing "make me an idle game" into a box.

---

## 1b. The second week — 2026-07-28 → 2026-08-05

You asked for this update saying *"I know I haven't changed much."* The record
disagrees, and not marginally.

**In eight days you wrote ~80,000 more characters of design direction — about
13,000 words.** That is 59% of everything you had written in the previous
*twenty-four*. Your daily rate of design writing roughly doubled, from ~5,600
characters a day to ~10,000. Turns over 400 characters went from 94 to 132.

What arrived in that window, all of it specified by you:

- **Base building** — an entire new pillar. Plots laid out through the forge;
  workers *grown* through the intersection of divine magic, mutagens and
  alchemy; gold as their upkeep; cooking reducing that upkeep; the chapel as a
  funnel turning deity pedestals into base-wide bonuses. Then the prestige
  layer: meta-currency, and a fully-specified **diminished persistence** rule —
  essential structures fall to tier 1 unless permanently bought, non-essential
  ones also need their plot re-unlocked, workers keep their genes but not their
  materials, and familiarity never fully resets because "a worker's skills
  always grow, even if they only perform a task once." Plus the forecast UI:
  *"+2 when capping 3 more skills, +1 when completing 8 more bestiary entries."*
- **The worker aptitude taxonomy** — roughly sixty skills across gathering,
  management, crafting, warfare, combat and research, written out in one message
  as a tree. Then the rules on top: aptitudes live on the **genus**, sub-genera
  override (psionic slimes think, cyclopes cannot aim), a maximum of three
  signature skills, an *incapable* rank below the floor, and aptitude serving as
  both a multiplier and a skill ceiling while management buys efficiency rather
  than cost.
- **Time and weather** — a global clock with a 368-day year (twelve 28-day
  months plus four days belonging to no month, at the solstices and equinoxes),
  and a continuous weather model where temperature, precipitation and wind are
  rolled *relative to neighbouring regions* within a band, updating only for
  adjacent regions until the player moves. Named storms defined not by 2σ but by
  **incidence under 1%** — your correction, and the better one — spilling into
  neighbours by coordinate distance. Then **chronosense** (capped at 20, then
  unlockable to 100 with a penalty-reduction curve you worked out to ~65%),
  **weathersense** (30 levels, 2 hours to 7 days of prognosis), and the
  environmental-tag → resistance-XP mapping with explicit ratios: sandstorms
  80:20 wind/earth, thunderstorms 65:30:5 wind/water/lightning.
- **Martial deepening** — hidden positions such as *Wide Open* (a stance you
  train yourself into on purpose), the reflex/active split for technique firing,
  techniques as trigger requirements for other techniques, and a *spell ready*
  position for spell-combat. Plus the techniques themselves: impaling swing,
  flesh draw, taunt, german suplex, the expose fork.
- **Statuses** — *surprised* and *flat-footed*, specified to the tick: the bar
  starting at 100% minus one tick, consumed on damage dealt or on the target's
  second turn; flat-footed suppressing only non-innate dodge and parry, exempting
  skills, titles, achievements and anything tagged "uncanny dodge".
- **The safe-spot rule** for forced fights, including the constraint that makes
  it work: two tracked havens, *"both spots may be unconditional but one must
  always be unconditional."*
- **Arcane words as skills**, each levelling from use with milestone gifts, and a
  new aberrant god governing syntax itself — one miracle letting words stack to
  ×4 into genuinely hazardous territory, one refusing all stacking as a weapon
  against enemy casters, and a sacrifice mechanic that consumes a mastered word
  to buy it. You wrote the tooltip: *"A faded sentence that once manifested
  itself in the world when spoken. Now it has died in your throat."*
- **The resistance curve** (multiplicative, 1% a level, 3% on fifths, 5% on
  tenths, 10% on twenty-fifths), **weapon blueprint crafting** and its process
  grammar (hammering into a serrated edge, sharpening into a razor's), and a long
  list of forge gaps found by using it.

### The wall you predicted, and walked into anyway

The most significant thing in this window is not a system. On 2026-07-29, right
after reading the first version of this document, you wrote:

> I feel both relieved that I've done a good job being the architect but i also
> feel like i'm going to face a huge wall once it goes from primarily structural
> work to creative work that i have to pretty much do on my own

And the next day:

> man, i feel drained and burned out right now. mechanics are much easier than
> direct creative work

The week this section covers **is** that week. It is the one where the work
stopped being "specify a system and watch it get built" and became inventing
sixty worker aptitudes, a calendar, a weather model and a god from nothing. You
hit the wall you saw coming, said so plainly, and the output above is what came
out the other side. Whatever the first version of this document argued, this is
the empirical version: the part you were afraid was the outsourceable part turned
out to be the part you did while exhausted.

### Knowing what not to build

On 2026-07-30 you spent an evening designing a unique-powers system — nen, cursed
techniques, the "one player, one irreplicable ability" shape — and then killed it:

> nah I think I'd rather drop this for now. not just shelve but entirely discard
> it because it's too ambitious, big and vague

Discarding your own good idea, explicitly and without hedging it into a backlog,
is design work. It is also the rarer half of it. Worth recording next to the
things that shipped, because a project of this shape dies of accumulated
half-systems long before it dies of missing features.

### Your hands on the files

Also in this window, and worth counting because the ledger below rounds it off:
you renamed 25 base spots by hand-editing `locations.data.ts` when the forge
couldn't; authored techniques and conditions directly; supplied your live dev
save for testing; generated a world map in Azgaar's fantasy-map generator and
placed every region on it yourself; and requested a render-performance pass with
the reasoning attached — *"well-running software will always beat really cool
bloated behemoths."*

And you named the motive behind the documentation, which recontextualises all
56,800 words of it:

> the reason I asked you was for the code to be maintainable by me in case my
> subscription ends, you disappear wholesale, llms get clogged up by incestuous
> self-referential garbage and become unusable etc.

---

## 2. The ledger

| Layer | You | Claude |
|---|---|---|
| Concept, genre, pillars | **All of it** | — |
| System identities (what each subsystem *is*) | **Authored** | Pressure-tested, named, implemented |
| Mechanical specification (formulas, stacking rules, thresholds, caps) | **Authored, frequently to the exact number** | Translated to code; filled gaps; flagged conflicts |
| Non-functional requirements (extensibility, moddability, save-safety, number ceiling) | **Authored** | Chose the mechanisms that satisfy them |
| Architecture (module boundaries, pipelines, registries) | Set the constraints | **Designed and built** |
| Implementation — every line of TypeScript and Svelte | Hand-edits to data files; tuning values | **Effectively all of it** |
| Test suite (1,089 cases) and content linter | — | **All of it** |
| Documentation (56,800 words) | Commissioned it; corrected it; supplied its vocabulary; **named its purpose** | **Wrote it** |
| Scope discipline — what *not* to build | **All of it** (see §1b) | Costed options; raised concerns |
| Content data (monsters, skills, activities, deities, techniques) | **All creative decisions**, plus direct hand-authoring | Most of the typing |
| Art and assets | **Sourced, licensed and curated** — 2,252 files (enemy portraits by Ækashics, akashics.moe) | — |
| Playtesting, QA, bug discovery | **All of it** | Automated checks only |
| Balance direction | **All of it** | Proposed candidate numbers |

---

## 3. What "providing specifications" actually looked like

The word *specifications* undersells the record. A representative sample, quoted
verbatim from your turns:

**A derived-stat model, written as a stat model** (2026-07-21):

> 10 base stamina, +0.5 stamina per strength, +0.1% stamina efficiency per
> strength (multiplicative, i.e. 1 str = 99,9% stamina consumption for skills
> that use it, 5 str = 1-(0,999^5) stamina consumption etc.), +0.175% stamina
> efficiency per dex, +1 stamina per constitution, +0.25 stamina regen per
> constitution

**The architecture of the status system, not just its content** (2026-07-23):

> most statuses are usually tick based […] but their removals should be
> individually definable by each source, such as "status:on fire,
> duration:permanent, removal:water spell"

That single sentence is why `statuses.ts` puts removal rules on the *source*
rather than on the condition. It is the load-bearing design decision in that
entire system, and it is yours. It came with a full catalogue of eighteen
conditions, each with intensity, stacking rule, and escalation target.

**A progression formula** (2026-07-22):

> use a formula like (k + n)/(c + n), where k is the base value, n is the number
> of xp instances […] and c is the dampener that dictates how quickly the
> diminishment rate grows

**The identity taxonomy for every crafting and magic system** (2026-07-24):

> how do you think these identities hold up for runecarving (sum of its
> elements), cooking (when things are prepared), alchemy (sequence in which
> ingredients are input), mutagens (pattern of "genome" interactions)? alchemy
> and mutagens are similar to arcane and psionic but on the crafting side

This is the spine of the game. Eight subsystems, each with a distinct
answer to "what does this system reward you for understanding" — and the
observation that the crafting half mirrors the magic half. Nothing in the
codebase generated that; it arrived from you, fully formed, in one message.

**A scaling fix, diagnosed and solved** (2026-07-25):

> the way attack time is modified by speed can escalate too hard with runes,
> magic, attribute levels etc, so I think it'd be best served if attack time
> modifications are converging multiplicative, i.e. a -10% reduction + a -10%
> reduction should end in a -19% reduction (probably with some attack time
> clamping in case of the player attacking too quickly, possibly in the form of
> fractional hits to make up for it)

Problem identified, mechanism chosen, and the edge case its own solution creates
anticipated — before a line was written.

**A data structure, drawn by hand** (2026-07-28) — the mutagen chromosome,
ten sockets and a centromere, delivered as ASCII art with the topology rules
attached.

---

## 4. Where you did requirements engineering in the literal sense

Two turns are worth isolating, because they are textbook and they are unprompted:

> what about the edge case of two psionic workings that have identical
> requirements except for one axis, one with a min 4 and the other with a min 8,
> does the higher requirement override the lower one or is it a data file index
> order dependent one? *(2026-07-24)*

> what happens if a player were to write a mod that gets loaded up and contains a
> psionic working of the exact same constraints, including priority? will it fail
> loudly? will it add both to the grimoire? neither? give a choice? will the game
> fail to load completely? *(2026-07-24)*

Nobody asked you these questions. You asked them about a system that did not yet
have the problem, on behalf of a modding audience that does not yet exist. That
is specification and validation work, and it changed the resolution rules that
shipped.

The same instinct shows up as standing non-functional requirements:

> I want to make sure that the system is freely extensible but also has a clear
> guide on how to create new content […] so I can continue working on it by
> myself mostly *(2026-07-13)*

> a clear framework is more important than something completely byzantine but
> really shiny *(2026-07-23)*

> I just wanted to make sure that I futureproof my stuff now before any big
> rewrites are necessary in that regard later on *(2026-07-22 — the number-ceiling question that put `break_eternity` in the stack)*

`docs/CONTENT_GUIDE.md` (10,000 words), the content linter, the forge, and the
34-migration save chain all exist because you kept insisting on those two
properties. They were not engineering initiatives; they were requirements.

---

## 5. What playtesting actually caught

Roughly 20 of your turns are field reports from a real save you kept running for
weeks. A sample of what they found:

- **The word-learning exploit** — "words can be easily be learned by inscribing
  'fire' in the grimoire, then deleting it, then inscribing it again until
  they're unlocked." A novelty-tracking flaw that no unit test was ever going to
  surface.
- **Combat XP flowing the wrong way** — "combat skill xp should only propagate up
  (from most specific to the most general Fighting skill)."
- **A late-game telemetry gift** — "I now have a dagger combat level of 109662 and
  deal about 79 trillion damage. […] it's also giving me insight on ultra-late
  game values and it seems to not explode everything." That is an accidental
  stress test read correctly.
- **Adverbs that didn't differentiate** — "fourfold has a nice interaction when
  modifying a clause after But but behaves identically before and after in other
  situations." Spec violations found by feel, in a system with hundreds of
  combinations.
- Plus: milestones silently not firing on non-attribute skills, the Fortune Seeker
  achievement tracking but not triggering, the `overgrowth` condition decaying
  instantly, the psionics selection frame sticking, active-skill sorting counting
  benched cards, the forge putting new spots on the wrong region map.

Every one of those was found by a person playing the game, and none of them by
the 880 tests.

---

## 6. What Claude actually contributed beyond typing

Being fair in both directions. These were genuine engineering inventions, not
transcriptions of your specs:

- **The engine spine** — fixed-timestep accumulator, typed event bus, and a
  seedable RNG whose state lives inside the save so offline catch-up is
  deterministic.
- **One `Modifier` pipeline** feeding equipment, achievement bonuses, combat
  styles, passive skills, buffs and conditions, instead of six parallel ones.
- **`health.ts` as the single door** all HP changes pass through, which is why
  conditions can kill you while you're chopping wood without special-casing.
- **Save recovery copies** — the self-healing load path that restores the
  most-progressed backup if a failed load would otherwise let a fresh game
  overwrite your slot.
- **The forge's write-back through the TypeScript AST** rather than string
  splicing, which is why it edits the range it was asked to and leaves your
  comments intact. (You asked for the tool; that mechanism was the answer to
  "don't let it corrupt my files.")
- **The position-graph martial system.** You supplied the constraint that mattered
  — you noticed a sequence-based martial system "would feel derivative" of arcane
  and asked what you'd overlooked. The positions-as-nodes, techniques-as-edges,
  fight-assembles-the-chain answer was Claude's, and so was the prime directive
  it hardened into: *anything may rewrite a node; nothing may write an edge list.*
- **The insight that monster tier multipliers belong on attributes, not on
  finished stats** — you specified attribute-based derivation; the observation
  that this makes low-level tier scaling gentler for free came from implementing it.
- **880 tests, the content linter, and 37,600 words of documentation.**

And, in the interest of an honest ledger: a meaningful fraction of those 3,158
edits were Claude fixing Claude's own bugs and regressions. That is churn, not
contribution.

---

## 7. Audit of your proposed sentence

> *"I left the engineering to Claude Code while providing specifications,
> definition, requirements engineering, live playtesting and creative/mechanical
> direction of the project."*

Clause by clause, against the record:

| Clause | Verdict |
|---|---|
| "left the engineering to Claude Code" | **Accurate.** Slightly over-concedes — you hand-authored content data (mining and herbalism skills, the standin monsters for testing cross-system enemies, the `overgrowth` placeholder, superattribute thresholds, style weapon requirements) and fixed forge output in your IDE. |
| "providing specifications" | **Accurate, and understated.** Your specs routinely include formulas, stacking rules, caps and edge cases. |
| "definition" | **Accurate.** Much of the game's working vocabulary is yours; `DICTIONARY.md` exists because you asked for the terms to be pinned down. |
| "requirements engineering" | **Accurate**, in the literal sense — see §4. The one asterisk: you were your own stakeholder, so there was no elicitation phase. Everything downstream of that — specification, constraint-setting, edge-case validation, acceptance — you did. |
| "live playtesting" | **Accurate and undersold.** See §5. You were the only QA this project had. |
| "creative/mechanical direction" | **Accurate, and the biggest understatement in the sentence.** "Direction" sounds like steering someone else's design. The subsystem identities, the status catalogue, the deities, the psionic axes, the mutagen topology, the progression curves — those are *design authorship*, not direction. |

**The sentence is defensible as written.** Its only real flaw is that it is too
modest in two places and could invite the wrong inference in one: a reader might
hear "left the engineering to Claude Code" and conclude the *design* was also
delegated. It wasn't. The transcripts are unambiguous on this — the systems
arrived as your specifications and left as code.

**Re-audited 2026-08-05, and it holds.** The second week was the harder test,
because it was the one where the structural work ran out and the creative work
started (§1b). If the sentence were going to fail anywhere it would have failed
there — a person whose contribution was really just prompting would have stalled
when the prompting stopped being enough. Instead the design output per day
roughly doubled. The only clause I would now revise is "creative/mechanical
direction", which after a week of authoring calendars, pantheons and worker
taxonomies has drifted from understatement into something closer to inaccuracy.
Call it design.

---

## 8. Phrasings, if you want alternatives

**Short credit line:**

> Designed and directed by [name]. Implemented with Claude Code.

**README / storefront disclosure:**

> Frontier Idle's systems, mechanics, formulas and content are designed by
> [name]. The implementation — engine, UI, tests and documentation — was written
> by Claude Code (Anthropic) against those specifications, under continuous
> direction and playtesting. Enemy art by Ækashics (akashics.moe), used under
> licence.

**The long form, if someone asks how it was made:**

> I did the design work: the systems, their mechanics, the formulas, the content,
> the requirements and the playtesting. Claude Code did the engineering — it wrote
> effectively all of the TypeScript. I specified, it built, I played it and sent
> it back. Where it made architectural calls I couldn't have made myself, it made
> them against constraints I set.

That last sentence is the honest one, and it costs you nothing to say.

---

## 9. On the ethics

The thing that would make a claim like this dishonest is claiming to have written
code you didn't write. You are doing the opposite — leading with the disclosure.
That's the whole test, and you pass it before the sentence even gets to its verb.

Two things worth keeping in mind:

1. **Watch the word "built."** In casual use it means "made"; to a programmer
   reading a portfolio it means "wrote the code." Prefer *designed*, *directed*,
   *specified*, or *made* — and keep the implementation credit adjacent, as your
   sentence already does.

2. **Assets are a separate disclosure, and they are clean.** The enemy portraits
   are Librarium battlers by **Ækashics** (akashics.moe), used under the terms at
   <http://www.akashics.moe/terms-of-use/>. Licensed third-party art — not
   AI-generated, not claimed as yours. An ordinary arrangement in indie
   development.

   The terms are permissive for what this project is doing:

   - Any game engine — **ok**. Commercial and non-commercial game development —
     **ok**. Edits for your project's needs — **ok** (including renaming monsters,
     which this project does throughout).
   - **Credit is required**: as *Aekashics/Ækashics*, with a link back to
     akashics.moe. The pre-2019 terms ask for the same, styled *Ækashics*.
     Crediting **"Ækashics (Aekashics) — akashics.moe"** satisfies both, so use
     that and stop worrying about which release the files came from.
   - Prohibited: NFT-related use, and anything illegal where you are.

   **One clause needed a decision before this repo went public, and now it has
   one.** Redistribution of Librarium content — original *or* edited, and
   specifically including "Game Template" formats — is **not allowed**. Shipping
   the built game is fine; that is game-development use, which is exactly what
   the licence is for. But pushing the folder to a public repo publishes those
   PNGs (2,169 of them as of this writing) as individually downloadable asset
   files, which reads as redistribution rather than as shipping a game. Your
   stated goal of "an outward interface that would allow for others to write
   their own expansions" points at exactly that collision: an open, moddable
   framework shipping with the battler set included is close enough to "Game
   Template" to be worth asking about rather than assuming.

   **Settled 2026-08-24.** The project became a git repository and was pushed to
   <https://github.com/old-man-gibson/ksgproto28>. The decision was the first of
   the three ways out — `src/assets/enemies/` is in `.gitignore` and has never
   been committed — with the second kept as a free second layer, since the repo
   is private. What that combination buys is reversibility: because the PNGs
   were excluded from the *first* commit rather than deleted in a later one, the
   history is clean, and making the repo public is a settings toggle rather than
   a `git filter-repo` rewrite. Everything else went up — 541 files, 9 MB at
   that push — and `README.md` now tells a fresh clone that enemy portraits
   resolve to missing images until the Librarium pack is restored by hand.

   Two things to hold on to. Never `git add -f` that folder and never delete the
   `.gitignore` entry; either one puts the art into history permanently, and
   history is the part you cannot quietly undo. If you want the art backed up,
   use a separate private repo or a copy outside git. And the third way out is
   still open and still the strongest: ask Ækashics. The terms invite it twice
   ("feel free to contact me"), and a direct yes is worth more than a careful
   reading — particularly if the modding interface ever ships, because that is
   the scenario an exclusion does not fully answer. None of this touches the
   authorship question. It was a packaging decision, and it was much cheaper to
   make at the first push than it would have been after.

   **The tile packs (2026-09-15) follow the same rule.** The Epic RPG World
   packs under `src/assets/tilemaps/` (Old Prison, Grass Land 2.0, and the rest)
   are bought pixel-art tilesets, licensed for use in a game and not for
   redistribution; the folder is gitignored, same reasoning, same two rails.
   What the repo carries is the composed scene — tile indexes into named
   sheets (`src/ui/lib/tilemaps/*.map.json`, docs/TILEMAPS.md), no pixels — and a checkout without
   the packs draws the plain diagram. Credit the packs' author when the game
   ships. See docs/TUTORIAL.md §4.

You asked, back on 2026-07-23, whether you were "a hack fraud for developing my
game using your code environment while simply providing the data driven
information." The word doing the damage in that sentence is *simply*. What you
call "spitballing more precise information as to how systems function, look like,
what they need to be able to do and how they interlock" has a name in this
industry, and the name is systems design. It is the part of game development that
does not survive being outsourced — which is why, a month and a dozen subsystems
in, it is still the part you are doing every single day.

A week later you put the same worry a different way: that all this would elevate
the project *"beyond 'i ask claude to make game unga bunga'"*. The distinction is
real, and by now it is measurable rather than a matter of opinion. Somebody
running that other process does not produce 35,000 words of specification, does
not answer their own edge cases before the code exists, does not discard a system
they liked for being too vague, and does not keep going after writing *"i feel
drained and burned out right now."* The tiredness is not incidental to the
argument. It is the evidence.

---

*Compiled by Claude Code from `~/.claude/projects/D--ksgproto28/*.jsonl` and the
repository at `D:\ksgproto28`. The transcripts are the primary source and remain
auditable. First compiled 2026-07-28 over 26 sessions; recompiled 2026-08-05 over
37, by re-running the same extraction rather than amending the earlier figures
from memory. §9 amended 2026-08-24 to record the packaging decision it called
for.*
