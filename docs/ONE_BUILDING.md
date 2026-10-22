# Floors 2 and 3 — the Long Hall and the Descent

*What band 1's second and third floors are, how they are wired, and how to change them.*

Built 2026-10-21 (save v57) on the user's direction: floors 1 to 3 are one
office building with three different maps. Floor 1, the Flooded Offices, is
[FLOODED_FLOOR.md](FLOODED_FLOOR.md). Plan card:
[plans/alpha-band-one-floors.md](plans/alpha-band-one-floors.md), "One building".
All names and prose are placeholders for the user to recaption.

Files:

- `src/core/data/locations.data.ts` — spots `f2_*` and `f3_*`, areas `ascent_f2_area` and `ascent_f3_area`
- `src/core/data/towers.data.ts` — floors `ascent_f2` and `ascent_f3` (gates and clears)
- `src/core/data/monsters.data.ts` — the hall's four enemies and `puppet_bureaucrat`
- `src/core/data/npcs.data.ts` — `hall_tutor` (teacher), `hall_quartermaster` (shop)
- `src/core/data/martial.data.ts` — `lunge`
- `src/core/data/prestige.data.ts` — `PRESTIGE_UNLOCK` (the bureaucrat's kill)
- `src/core/text/locations.text.ts`, `npcs.text.ts`, `monsters.text.ts`, `towers.text.ts` — the words
- `tests/john.ts`, `tests/john.test.ts` — the pacing harness and its bounds (`npm run pacing`)

---

## 1. Floor 2, the Long Hall

Gate: 150 gold earned. A straight corridor, drawn left to right:

| Spot | What is there |
|---|---|
| The Stairhead (`f2_stairhead`) | Landing, camp (haven) |
| The Mail Carts (`f2_hall_1`) | 3 fights: Bound Ledgers, Filing Automatons, lv 3–4 |
| ↳ The Cleared Office (`f2_gym`) | The tutor (Gather, then Lunge), Work the Heavy Bag (Strength) |
| The Filing Bays (`f2_hall_2`) | 3 fights, lv 4–5, pairs possible |
| ↳ The Quartermaster's Cage (`f2_stores`) | Salve, broth, ration, loaf |
| Copy Room Row (`f2_hall_3`) | 3 fights: Sorting Automatons, Living Dolls, lv 5–6 |
| ↳ The Break Room (`f2_break_room`) | Rest (haven), a petty-cash find (70–110 gold) |
| The Far End (`f2_hall_4`) | 3 fights, lv 6–7. The third win is the floor's clear |

Each stretch's `fightLimit` is 3; spending it reveals the road to the next
(`requires` + `revealWhen` on `fights:f2_hall_N`). The clear reads
`fights:f2_hall_4`, the same number as that stretch's `fightLimit`.

The enemies answer the tutorial's spells: heat burns ledgers (−50%
resistance), lightning shorts automatons (−50%), dolls have no answer but a
blade. Measured: floor 2 takes about 2.5 minutes for John, with 16
knockouts over 18 climbs; the user accepted it easier than the cistern.

**The tutor** is the game's first teacher (`NpcDef.teaches`, CONTENT_GUIDE
"Teacher"). Gather (neutral → coiled) and Lunge (coiled → extended, any
weapon), both free; Lunge is held until Gather because of the reach rule
(MARTIAL.md §6). Martial is shut in the alpha, so these two are the only
techniques a band-1 player can have.

## 2. Floor 3, the Descent

Gate: 600 gold earned. Down the building's stairwell, drawn top to bottom:

| Spot | What is there |
|---|---|
| The Stairwell Head (`f3_stairhead`) | Landing, camp (haven) |
| ↳ The Mail Room (`f3_mail_room`) | Search: plan (opens flight 1), purse 60–90, string anchor |
| The Second Landing (`f3_landing_2`) | 2 fights: Living Dolls, Sorting Automatons, lv 6–7 |
| ↳ The Archive Stacks (`f3_archive`) | Search: plan (flight 2), oak club, string anchor |
| The Third Landing (`f3_landing_3`) | 2 fights: Living Dolls, Filing Automatons, lv 7–8 |
| ↳ The Records Annex (`f3_annex`) | Search: plan (to the Hearing Room), two salves, string anchor |
| The Hearing Room (`f3_hearing_room`) | Forced, one fight: the Puppet Bureaucrat |

**The way down.** Each landing's flight down `requires` (and `revealWhen`)
the flag its side room's floor plan sets: `flag:f3_stairs_1` to `_3`. The
plan is the first find in each room (30% searched), so going down means
exploring.

**Preparation.** Each side room's last find (75%) bumps
`flag:f3_strings_cut`. The Hearing Room's table has one line per count:
level 12 uncut, 11, 10, 9 with all three. The Archive's oak club is the
other answer: the bureaucrat is a construct (bludgeoning −35%, slashing and
piercing +30%). The fight stays winnable uncut (COMPLETABILITY: no terminal
states), only harder.

**The boss.** Arriving forces the fight (`forced`), and the room holds one
fight (`fightLimit: 1`); once won it stops forcing. The lines are `once`,
which is what latches `slain:f3_hearing_room:puppet_bureaucrat`: the floor's
clear and `PRESTIGE_UNLOCK`. Rarity is pinned to normal
(`modifierWeights`). Tuned 2026-10-21 by sweeping four stat sets against
John: plain John goes down about 3 times before he wins; attentive John
(strings cut, club in hand) under once. Duel at attributes 16, wins of 20:
sword 0 uncut → 8 with three cuts; club 11 → 20.

## 3. Changing it

- **A stretch's length**: its `fightLimit`, the `value` on the road it opens,
  and for the Far End, `ascent_f2.clear`. Both validation layers fail a
  clear that asks for more fights than the limit allows.
- **The boss's difficulty**: the levels in the Hearing Room's four lines, or
  the bureaucrat's attrs and growth. Rerun `npm run pacing` (and
  `-- --attentive`) and check `tests/john.test.ts`.
- **More lessons**: add to `hall_tutor.teaches`, in reach order.
- **Words**: the text files above. Numbers in the prose are numbers in the
  data; change both.

## 4. Saves

Save v57 (`migrations.ts`, step 56): a save standing on the old floors 2 or
3 (the Flooded Stair, the Silk Gallery, now on the shelf, LONGTERM.md) wakes
on the new floor's landing; a save that had cleared them gets the new clears
stamped, so floor 3 stays open and prestige stays unlocked. Lost spots are
pruned by `pruneLostSpots`, the content-agnostic helper the v48 shelving
introduced.
