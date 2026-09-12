---
id: alpha-threshold-quests
title: Threshold speaks — the Warden's onboarding
kind: story
status: review
system: meta
parent: alpha-band-one
save: '48'
updated: 2026-09-06
invariants:
- completability
- two-validation-layers
done:
- The user's first quest list (meet the nine, try the systems) is built and walkable
- Prose placeholders recaptioned by the user; NPC names and placements confirmed
- The goldfish closes the Warden's chain on seed 42
- Numbers tuned (favor 4+1, starter bundle sizes, cage levels)
---

# Built 2026-09-06 (save v48) — the user's first quest list

**Quest 1 — The Faces of Threshold** (`faces_of_threshold`, Warden of the
Foot). Eight `talk` objectives, one per new NPC. Talking is new machinery:
`talkTo` stamps `met:<npcId>` (engine counter, `slain:*`'s sibling), the UI
grows a "🤝 Say hello" button per stranger, and talk objectives read the
counter LIVE — a greeting made before accepting still counts. Greeting also
pays the social lesson (it manifested Speechcraft on the very first hello in
the live walk). The goldfish greets strangers readily (weight 30), which is
what keeps its quest test honest — seed 42 closes this chain.

The nine faces (**names, descs and dialogue are drafts against
docs/VOICE.md** — one speech deformation each; recaption freely):

| id | placement | one-liner |
|---|---|---|
| warden_of_the_foot | ascent_foot | gatekeeper; gives both quests |
| master_smith | the_forges | counts in heats |
| lectory_wizard | the_reading_hall | corrects his own word choice |
| chapel_priest | the_nine_chapels | favor as a ledger |
| militia_captain | ironyard_gate | drops sentence subjects |
| head_chef | granary_kitchens (NEW spot) | measures time in bells |
| row_alchemist | the_alembics | behaviours, never substances |
| psionic_shaper | censer_walk ⚠️ placement is a guess | answers the unasked question |
| dojo_master | the_sand | footwork, footwork |

Rewards: 60 gold, **favor 4** (plus the turn-in's own 1 = exactly the
cheapest miracle at 5 — `QuestRewards.favor` is new, paid to KNOWN gods
only), and the Warden's crates: iron_scrap ×6, raw_meat ×4, common_herb ×4,
spring_water ×3, mendroot ×3 — the free materials for quest 2, routed through
`grantMaterial` so the graded ones land in stock where benches read them.

**Quest 2 — A Taste of Everything** (`a_taste_of_everything`, requires
quest 1). Seven objectives, one per open system:

- smith: `craft` iron_ingot (recipes now listed at the_forges)
- cook: `craft discipline: cooking` (NEW: bench work emits the craft event
  with its discipline; the Granary Kitchens are a NEW spot with stove + prep)
- brew: `craft discipline: alchemy`
- bestiary: `stat bestiary:entries ≥ 3` (NEW counter, bumped on first kill of
  a species) — fed by **the Cages** (NEW spot, the_ironyard):
  `SpotDef.caged` skips the bestiary insight roll, so every fact lands
  exactly at its `minKills` — the "defined rates" the user asked for
- martial: `stat kills ≥ 5` ⚠️ interpretation — see open questions
- magic: `stat spells:inscribed ≥ 1` (NEW counter in inscribeArcane);
  `fire pierce` is legal at Arcana 0
- miracle: `stat miracles:learned ≥ 1` (counter already existed)

`{ type: 'stat' }` and `{ type: 'talk' }` are new objective kinds, both
live-read like collect; both linted in both layers (npc exists, discipline
exists, stat counter is actually bumped, bar positive).

**The system gates from the same list** (shipped alongside, documented in
[alpha-scope-locks](alpha-scope-locks.md)): the STARTER_LEXICON (fire, ice,
spark; pierce, ward, mend; quickly, slowly; one, me, others — no
conjunctions, so single-clause speech is the opening game) gated in
`checkSentence` legality + bench UI, and STARTER_DEITIES (denjalle, usvylgr)
gating both the divine tab and `grantFavorAll`. Migration v48 stamps the full
lexicon and pantheon onto older saves.

# Quest 3 — The First Ascent (built 2026-09-06, same day)

`the_first_ascent` (Warden, requires quest 2): clear floor 1. The user's
design, and what it became:

- **The keeper changes with the clock** — `SpotEncounter.daypart`, on the
  darkness system's own boundary (night = dusk through dawn): a **hobgoblin**
  by day (NEW monster, ⚠️ stats are my guesses — the user has real hobgoblin
  info incoming), an advanced slime by night.
- **One latch for many keepers** — `SpotEncounter.boss`: any boss-flagged
  kill bumps `boss:<spotId>` (engine counter, announced first time only).
  The floor's clear and the quest both read `boss:f1_toll_hall ≥ 1`, so four
  possible bosses need no OR in the condition language.
- **The ambush** — `SpotEncounter.window: { min: 0.9, max: 0.98 }`: the
  **Hobgoblin Champion** (NEW, deliberately rich loot) by day and the
  **Slime King** (existing — his desc already says he lives in the ascent!)
  by night, rolled only while playerPower/spawnPower sits in the window.
  Power = damage × maxHp both sides (`encounterPowerRatio`, combat.ts — a
  spawn gate, not a balance oracle); the spawn priced at its level-band
  midpoint, mid tier roll. Unfarmable from above by construction: outgrow
  the window and the champion stops existing.
- **"Don't stray from the explored path"** — made literal: the Bonded Deep,
  a hidden room off the storerooms (revealed by combing them), guarded at
  levels 8–11 with a rich strongroom find.
- **Lints, both layers**: window needs 0 < min < max; a boss-cleared spot
  must keep at least one WINDOWLESS boss (a power window can wall a player
  forever; the clock cannot — time passes on its own); `boss:` clears need a
  boss-flagged spawn. Tests: tests/keeper.test.ts proves who appears when,
  and that the window opens and closes in order.
- **Tuning note for review**: near band-1 power one uniform attribute level
  moves the power score by more than the window's whole width — single-
  attribute steps and gear are what land inside it, which reads as intended
  ("planned it well") but is worth feeling out in play.
- Witnessed working end-to-end: the dev-test character left hunting the hall
  overnight came back with the keeper down and floor 2 open — the clear
  happens through ordinary offline combat, no scripted path.

# Open questions for the user (batched)

1. **Psionic shaper's spot.** Censer Walk was my guess ("talking to people
   who would rather not be seen") — say the word and they move.
2. **"Martial Combat" familiarization = win five fights?** The cages satisfy
   it while feeding the bestiary line. If you meant something more martial —
   learn a technique, win at the Sand, land a parry — the `stat` objective
   can point at any counter (`combat:parries` exists, e.g.).
3. **Free materials via quest 1's turn-in** — one bundle from the Warden,
   rather than each specialist handing theirs over. Cheaper and it makes
   quest 1 the visible prerequisite; but per-NPC gifts are buildable if the
   fiction matters to you.
4. **Caged fights pay normal gold/xp/loot** at level 1–3 — trivially
   farmable, trivially paid. Accepted for alpha; flag if the cages should pay
   nothing.
5. **Day ↔ hobgoblin, night ↔ slime** was my mapping (goblins as daylight
   toll-collectors, slimes as things of the damp dark). Swap freely.
6. **Hobgoblin stats are placeholders** awaiting the user's hobgoblin info
   (offered 2026-09-06); the Champion's loot table is a first cut of "big
   reward".

# Next lists

Future quest lists land in this card's lane: the objective vocabulary is now
kill / craft(recipe|discipline) / collect / reach / talk / stat, which covers
everything the first list needed. The known gap: `collect` with GRADED
materials reads the wrong bucket (spawned as its own task, 2026-09-06) — keep
graded ids out of collect objectives until it lands.
