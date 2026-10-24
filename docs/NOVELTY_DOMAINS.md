# Novelty domains

Some skills advance on **new information** rather than on repetition. They declare a
`NoveltySpec` in `skills.data.ts` and a **domain** — the system that knows what "new"
means. Every payout is scaled by

```
(k + n) / (c + n)
```

where `n` is how many times that exact input has already been offered *to that skill*.
The yield opens at `k / c` and decays asymptotically to **1** — repetition never
becomes worthless, it just stops being remarkable. `c` is the half-life of the excess:
after `c` repeats, half the novelty is gone.

On top of that, a domain calls `grantDiscoveryXp(state, bus, domain, weight)` whenever
it records something genuinely new, paying the skill's flat `discovery` value times
`weight`. That is the reward for *filling the book in*, and unlike the per-input
trickle it never wears out.

The roadblock this produces is deliberate and needs no special-casing: once every input
is familiar the yield sits at its floor while the XP curve keeps climbing, so the only
way forward is to go and find something unfamiliar.

---

## Built

### `bestiary` — Hunting

`{ k: 20, c: 2, discovery: 40 }` — opens at 10x, half-life 2 kills.

| input | key | treatment |
| --- | --- | --- |
| a kill | monster def id | novelty-scaled (`combat.ts` `onKill`) |
| new species entered in the book | — | discovery x3 |
| a fact pinned down | — | discovery x2 hard / x1 easy |
| a habitat confirmed | — | discovery x1 |

### `dialogue` — Speechcraft

`{ k: 12, c: 1, discovery: 30 }` — opens at 12x, half-life **1**: a deliberately
harder falloff than hunting, because a second conversation with the same person
teaches much less than a second wolf does.

| input | key | treatment |
| --- | --- | --- |
| accepting work | **NPC id**, not quest id | novelty-scaled, base 8 (`quests.ts`) |
| completing a quest | — | discovery x4 |
| a new dialogue option | — | discovery x0.5 *(not yet implemented)* |

> **Why the giver is the key, not the quest.** A quest can only be accepted once, so
> keying novelty to it would leave `n` permanently at 0 and the multiplier permanently
> at its opening value. Novelty has to be keyed to something the player can *repeat*.
> This is the general rule for any new domain: **the key must be the thing that
> recurs.**

Still missing from this domain: talking to NPCs outside of quests, and asking
questions. Dialogue lines today are ambient text rotating on a timer
(`LocationPanel.svelte`), not an interaction.

### `cookery` — Cooking

`{ k: 8, c: 2, discovery: 20 }` — opens at 4x, half-life 2 cooks. Cooking has
about twenty dishes and a bench run repeats one for hours, so the opening is
the smallest of the built domains and the repeats wear off at hunting's rate.
Like every domain the yield only adds to the ordinary payout (it settles to 1x,
never below).

| input | key | treatment |
| --- | --- | --- |
| a dish cooked on any cooking bench | **dish material id** (`hearty_stew`) | novelty-scaled (`cooking.ts` `cook`) |
| a dish new to this run's Cook's Book (`cooked:<dish>` still 0) | — | discovery x1 |
| a cutting-board cut | none | ordinary rate: a cut is not a dish |

> **Why the dish is the key, not the basket.** The recurring thing is the dish.
> Keyed to the ingredient combination (what the craft framework's `noveltyKeys`
> returns), nearly every basket of different grades is "new" and the bonus never
> wears off. Keyed by dish, the Traveler's Ration cooked at the stove and at the
> grill is one input, and the Scorched Mess is an input like any other.

**Seeding: none.** The per-dish counters (`cooked:<dish>`, the Cook's Book in
`systems/cookbook.ts`) and `state.novelty.cooking` are new with save v58. Older
saves recorded no dish, so there is nothing honest to seed them from, and the
migration (v57 → v58) does not touch them. An existing save is paid one
first-time bonus per dish, then settles. The domain resets with the run, like
the Book: a prestige pays the dishes' first cooks again.

---

## Designed, not built

Both of these need their underlying systems first. Recorded here so the shape is
settled before the content exists.

### `arcana` — Spellcrafting

- Novelty input: **each novel combination** of spell components. Because the system is
  intended to be extensive, per-combination bonuses should be *small* — the payout
  comes from breadth, not from any single discovery.
- Casting a crafted spell or scroll pays too, crediting **the base spell and each
  modifier separately**.

> **Mechanism gap.** That last point needs something the engine does not have yet:
> `grantSkillXp` takes a single `sourceKey`, so one cast cannot currently wear down
> several inputs at once. Casting a modified spell has to credit the base spell *and*
> every modifier on it, each with its own `n`. Widening `sourceKey` to accept a list is
> a small change, but it should land with its first real consumer rather than sit
> unused.

### `library` — Reading

- Reading a book is a **continuous, interruptible, resumable activity**, like
  exploration — not an instant action.
- Novelty input: the book id.
- Additional bonuses every **x%** of the book, where x derives from its length and
  chapter count.

> **Mechanism gap.** Discovery today is one-shot: a domain calls `grantDiscoveryXp`
> once when a thing becomes known. Reading needs it fired repeatedly at progress
> milestones through a single input, which means the domain has to track "which
> milestones of this book have already paid" — book progress state that belongs to the
> reading system, not to `state.novelty`.

---

## Adding a domain

1. Add the name to `NoveltyDomain` in `types.ts`.
2. Give the skill a `novelty` spec in `skills.data.ts`. Pick `k`/`c` from the two
   questions: *what is a first encounter worth* (`k / c`) and *how many repeats until
   half the novelty is gone* (`c`).
3. In the system that owns the knowledge, pass a `sourceKey` to `grantSkillXp` — the
   thing that **recurs** — and call `grantDiscoveryXp` when something new is recorded.
   The system never names a skill; it names its domain.
4. Make sure something emits the skill's `tags`, or it can never manifest. There is a
   content test for exactly this (`content.test.ts`).
5. If the skill can already exist in live saves, seed its counters in a migration —
   see v14 → v15, which seeds Hunting from the bestiary so a returning player is not
   paid first-sighting rates for the five hundredth wolf.
