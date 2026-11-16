# Ability candidates

Unique abilities written by the agent team on 2026-10-30/31, not yet in the
bank. The bank is `docs/ABILITY_IDEAS.md` in the Facet repo
(`C:\Users\mersi\Documents\Facet`); an ability goes there only after the user
approves it.

How they were made: Sonnet generators (team 1) wrote abilities in the format
of the bank entries, one territory per generator. Fable antagonists (team 2)
reviewed each one as the user would. A failed ability got one rework and a
second review.

- **Passed team 2:** on the review applets (one artifact page per 100
  abilities, in sets of 10). The user marks each one Approve, Under
  consideration or Reject there.
- **Rejected by team 2:** `rejected-by-team-2/<round>.md`, one file per round.
  Each entry holds the last version, both reviews and the original. Kept so the
  user can overrule team 2.

## Overnight run 2026-10-30/31

682 abilities passed team 2 and 65 failed twice. Nine rounds. Round 8 was the
"go crazy" round: all experimental. Round 9 reran the four topics that came
back empty, with two writers of 8 abilities per topic.

| Page | Abilities | Link |
|---|---|---|
| 1 | 1–100 | https://claude.ai/artifact/5M3aq7U87akAxvLhTLxMyq |
| 2 | 101–200 | https://claude.ai/artifact/HzqeUeYcvWKPQ6eFmJyc36 |
| 3 | 201–300 | https://claude.ai/artifact/Lk8kt4dgEWyTzhogz4qP68 |
| 4 | 301–400 | https://claude.ai/artifact/B5a4RxEWTg4bD87ezdSsJv |
| 5 | 401–500 | https://claude.ai/artifact/NBJbqt6ahqmHKoiFNHH3LR |
| 6 | 501–600 | https://claude.ai/artifact/UrJMjYuBuhH2nJxFfbJcCH |
| 7 | 601–682 | https://claude.ai/artifact/HxjnRum23z592RE5oGSCjQ |

Each page stores marks in its db collection `decisions`: document id = ability
id, fields `verdict` (approve / consider / reject or null) and `note`.

| Round | Territories | Passed | Failed twice |
|---|---|---|---|
| R1 | meters, world as fuel, battlefield objects, rule-benders, enemy as object, outside the fight, genre classics | 134 | 15 |
| R2 | arcane, divine, martial, psionics, alchemy | 78 | 7 |
| R3 | cooking, music, mutagens, smithing and runes, weather and the three moons | 91 | 7 |
| R4 | taking hits, conditions and elements, fight length, body and form, vows | 87 | 3 |
| R5 | system crossovers, growth across the run, programmable, information, places and floors | 74 | 13 |
| R6 | weapons and gear, death and the dead, gold and loot, beasts and the hunt, luck and chance | 70 | 10 |
| R7 | light/dark/silence, pools and recovery, trades with a combat face, the gaps | 67 | 4 |
| R8 | the loadout comes alive, wild cards | 24 | 5 |
| R9 | numbers and counting, time out of joint, other genres, concepts as resources | 57 | 1 |

In R7 and R8 the writers for numbers, time, other genres and concepts hit the
128k output-token cap and returned nothing. R9 reran those topics with 8
abilities per writer, and every writer finished.

`general-feature-candidates.md` holds ideas the user marked as features every
player should get instead of one run's ability.
