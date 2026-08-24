# Engineering notes

Every other doc in `docs/` describes a system as *designed*. This one records what
was **measured**, on 2026-07-27, and what the measurement implies. Numbers go stale
as content grows — §1.1 carries the probe that regenerates them, and re-running it
is the point. A claim here without a number next to it is a guess.

The traps and hard-won rules — the things that fail silently or destroy saves —
live in [PITFALLS.md](PITFALLS.md). Read that one first when something is wrong
and nothing is erroring.

Files this doc is about:

- `src/core/systems/derived.ts` — `getDerivedStats`, the hot path
- `src/core/systems/attributes.ts` — `collectBaseMods`, what makes it hot
- `src/core/save/offline.ts` — the catch-up loop, where the cost lands
- `src/ui/App.svelte` — the layout grid, the one thing blocking phones
- `src/ui/lib/Tip.svelte` — hover-only tooltips

---

## 1. Performance

### 1.1 The probe

Not committed — it is scaffolding, not a test, and a perf assertion in CI would be
flaky on shared runners. Drop it in `tests/`, run it, read it, delete it.

```ts
// tests/zz-perf-probe.test.ts
import { describe, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { SKILLS, ACHIEVEMENTS } from '../src/core/registry';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import type { GameState } from '../src/core/types';

function developed(seed: number): GameState {
  const s = createInitialState(seed);
  for (const a of ATTRIBUTE_LIST) s.attrs[a.id].level = 60;
  for (const id of Object.keys(SKILLS)) s.skills[id] = { level: 40, xp: 0 };
  for (const id of Object.keys(ACHIEVEMENTS)) s.achievements[id] = ACHIEVEMENTS[id].tiers.length;
  return s;
}

function bench(label: string, iters: number, fn: () => void): number {
  fn();
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn();
  const us = ((performance.now() - t0) / iters) * 1000;
  console.log(`${label.padEnd(44)} ${us.toFixed(1).padStart(8)} µs/op`);
  return us;
}

describe('perf probe', () => {
  it('measures hot paths', () => {
    const dev = developed(2);
    bench('getDerivedStats — fresh', 20000, () => getDerivedStats(createInitialState(1)));
    bench('getDerivedStats — developed', 20000, () => getDerivedStats(dev));

    const hunt = new Game(developed(4));
    hunt.state.spot = 'training_grounds';
    hunt.selectActivity('hunt');
    const tick = bench('tick — hunting, developed', 30000, () => hunt.tick());

    const idle = new Game(developed(6));
    bench('tick — no activity, developed', 30000, () => idle.tick());

    console.log(`8h catch-up: ${((tick * 8 * 3600 * 10) / 1e6).toFixed(1)} s`);
  }, 300000);
});
```

`developed()` is the honest shape of the problem: cost scales with what a save
*owns*, not with what the registries contain.

### 1.2 What it says

| | µs/op |
| --- | ---: |
| `getDerivedStats` — fresh save | 4.3 |
| `getDerivedStats` — developed save | 31.3 |
| `getDerivedStats` — developed, wrapped in a `$state` proxy | 29.4 |
| one tick — hunting, developed | 104.3 |
| one tick — no activity, developed | 33.7 |

> ⚠️ **This table predates the chromosome.** Re-measured after mutagens landed,
> the within-run deltas for a worst-case chromosome (top-tier gene, all ten
> sockets filled, every edge established, two cuts) were: `getDerivedStats`
> cache **hit** +9% (that is `modFingerprint` growth — the gene, the sockets and
> the cut list all have to be in it, because one cut reroutes the whole board),
> cache **miss** +15% (the graph resolution itself), and a hunting tick **+8%**.
> Absolute numbers are machine-dependent; re-run the probe and compare within
> the run rather than against these figures.
>
> One known regression to fix when catch-up next matters: `monsterSlice` calls
> `monsterStats(target)` for armour, several times per blow, where it used to do
> two cheap lookups. That is a §1.4-step-1 case — thread the stats already in
> scope, via an optional `armor` parameter from the swing loop.

Three things follow.

**Live play is not a problem and never was.** 104 µs against a 100 ms tick budget is
0.1% utilization. Do not optimize for the real-time loop; there is nothing there.

**The Svelte proxy is free.** 29.4 vs 31.3 µs is noise — the core runs against a
`$state` proxy in the real app (`ui/state.svelte.ts`) and pays nothing for it, because
reads outside a reactive context never create signals. This is worth writing down
precisely because it is the intuitive suspect and the intuition is wrong.

**Cost tracks content owned, 7× between a new save and a full one.** `collectBaseMods`
re-walks every equipment slot, affix and socketed rune, every achievement tier, every
skill's effects and milestones, and every attribute's training ranks and milestones —
allocating a fresh object per modifier — on every call. Nothing is memoized. (Memo
tables do exist elsewhere: bestiary tag sets, carved runes, resolved spells. Just not
here.)

### 1.3 Where it actually hurts: offline catch-up

`offline.ts:47` is a synchronous loop of up to **288,000 ticks** (8 h cap ÷ 100 ms):

```ts
for (let i = 0; i < ticks; i++) game.tick();
```

At 104 µs that is **~30 seconds of blocked main thread** on a developed save, and it
grows with every skill, achievement and rune added. This is the only place the
per-tick cost is worth a line of code.

### 1.4 The fix ladder

Cheapest and safest first. Do not skip to 2.

**1 — Thread the stats already in scope.** Zero correctness risk. `tickCombat`
(`combat.ts:1376`) computes `stats` once and threads it correctly, but three call
sites throw that away and recompute:

| site | what it is |
| --- | --- |
| `combat.ts:1272` | `applyBarDamage` |
| `combat.ts:1313` | `applyRetaliation` |
| `combat.ts:514` | `getDerivedStats(state).goldGain` **inside a loot loop** |

Add a `stats` parameter. Should take a combat tick from ~3.3 recomputes to ~1.5.

Note `actions.ts:203` is **not** on this list — `tickAction` genuinely needs live
maxima for `tickResources`/`regen` every tick. That one is load-bearing.

**2 — Memoize `getDerivedStats` on a version counter.** The real win and the real
risk. A stale stat is the worst class of bug this codebase can have, because the
tests would still pass. The invalidation surface, as of writing: equipment, affixes,
socketed runes, achievements, skills, attribute levels, statuses (including damping),
buffs, titles, style, `exerting`, `combat.momentum`, resource locks. Miss one and a
number silently stops updating.

If you do it: **cache only the no-`vsTags` path.** Per-target resolution is
deliberately outside the global block (see CONTENT_GUIDE §1 on `requiresMonsterTag`)
and should stay uncached — it is called with a different tag set per enemy and would
poison a naive cache. Pair the change with a test that asserts every mutation path
bumps the counter.

**3 — Chunk the offline loop.** Yield between batches so the tab stays responsive,
with a progress bar. Coarsening the sim past some threshold would be faster still,
but it changes results — that is a design call about what offline progress *means*,
not an optimization, and it belongs in a different conversation.

---

## 2. Phone compatibility

Measured at 375×812 in the preview browser.

### 2.1 The current state

`index.html` has the viewport meta tag, and the panels are built out of flex/grid
that reflows. But the whole game UI has **four** `max-width` breakpoints —
`App.svelte:337` (1100px), `BestiaryPanel` (900), `MartialPlanner` (860),
`CombatPanel` (720) — and the top-level one keeps a fixed-width sidebar beside main:

```css
@media (max-width: 1100px) {
  .layout { grid-template-columns: 240px 1fr; ... }
}
```

At 375px that resolves to `grid-template-columns: 240px 99px`. **The entire content
area is 99 pixels.** Document scroll width: 798px, or 2.1× the viewport.

### 2.2 The experiment

Twelve lines of CSS — stack the grid to one column, let the header wrap:

```css
@media (max-width: 700px) {
  .layout {
    grid-template-columns: 1fr;
    grid-template-areas: 'header' 'main' 'sidebar' 'log';
    grid-template-rows: auto auto auto auto;
    height: auto;
  }
  header { flex-wrap: wrap; }
  main { overflow: visible; }
}
```

| tab | elements overflowing before | after |
| --- | ---: | ---: |
| Location | 8 | 0 |
| Combat | 25 | 0 |
| Skills | 43 | 4 |
| Equipment | 1 | 0 |
| Bestiary | 9 | 0 |
| Quests | 1 | 0 |
| Achievements | 161 | 0 |

Document scroll width 798px → exactly 375px. **The panels were never the problem.**
They were being handed 99 pixels. This is not a rewrite.

### 2.3 What is actually blocking, and it is not layout

**Tooltips are unreachable on touch.** `Tip.svelte` fires on `onmouseenter` /
`onmouseleave` only, and the popup is `pointer-events: none`. There are **37 `<Tip>`
call sites**, and they carry the stat breakdowns — `statBreakdown()` in `derived.ts`
exists to feed them. On a phone that entire information channel is simply absent.
Needs a tap-to-open / tap-away-to-dismiss mode. Positioning needs work too:

```ts
x = Math.min(rect.right + 10, window.innerWidth - 320);
```

At 375px that clamps to 55 for every tooltip on screen.

**Drag-and-drop reordering does not fire on touch.** Mobile browsers do not dispatch
HTML5 drag events from touch input. Three panels rely on it — `CombatPanel:679`,
`MartialPlanner:541`, `SpellcraftPanel:395`. The fallback already exists:
`moveSkill` / `moveSkillTo` (`game.ts:487`, `:502`) are the reorder primitives and the
arrow buttons already drive them. This is promotion work, not new mechanics.

**Everything else is a per-panel pass.** `BenchPanel` (992 lines) is the most spatial
UI in the game and wants a real look; map tap targets on a 0–100 canvas will be tiny
at 375px; a lot of the UI sits at 11–12px type.

**Offline catch-up gets worse here.** §1.3's ~30 s is desktop silicon. On a phone it
is meaningfully longer, which moves fix #3 from *nice* to *needed*.

### 2.4 Effort

| | |
| --- | --- |
| skeleton breakpoint + header wrap | half a day |
| `Tip` tap mode + repositioning | a day |
| touch reordering across 3 panels | one to two days |
| per-panel pass at 375px | two to four days |
| offline chunking | a day |

**Roughly a week** to genuinely playable. The forge is not worth porting — it is a
desktop authoring tool and should stay one.

The lasting cost is not the port, it is the tax: every new panel needs a phone pass
forever after.

---

## 3. Drought protection, measured

Added 2026-08-10 (`src/core/engine/mercy.ts`, `tests/mercy.test.ts`). Rare rolls
escalate with every miss and reset on a hit. The design and the dial live in the
module's own header; this section is the evidence.

### 3.1 The coefficient is not a constant

The chance after `n` misses is `base + n × slope`. Both are **solved** per rate
by bisection so the long-run rate is exactly the authored one. The solution is
strongly rate-dependent — expressed as the pure form's divisor `x / base`, it
runs from 3 at a 25% drop to 128 at a 0.5% one, roughly `0.64 / x`:

| authored rate | 25% | 12% | 5% | 3% | 1% | 0.5% |
|---|---|---|---|---|---|---|
| divisor `x / base` | 3.0 | 5.7 | 13.2 | 21.6 | 64.1 | 127.7 |

One shared constant would therefore move every drop rate off its authored weight
and in different directions. That is the whole reason `mercyCurve` is a solver
and not a number.

### 3.2 What it does to a real table

400k kills against the authored `wolf` table, same seed, plain against mercy at
the shipped `MERCY = 0.85`. Every rate lands within 0.03pp of authored on both
sides — mercy moves the *shape* of the wait, never its mean:

| entry | authored | 99th percentile wait | worst run seen |
|---|---|---|---|
| `torn_fur` | 18% — untracked | 23 → 22 | 55 → 55 |
| `raw_meat` | 12% | 35 → **19** | 91 → **30** |
| `leather_vest` | 4% | 116 → **62** | 269 → **99** |
| `pristine_fur` | 3% | 147 → **83** | 346 → **131** |
| `wolf_fang_blade` | 1% | 484 → **257** | 870 → **360** |
| `rune_swiftness` | 1% | 452 → **247** | 883 → **376** |

At loot luck 3 (rarity × the `loot` stat) the same table runs at its boosted
rates — fang blade 1.69% on both sides — and the worst run falls 554 → 198. Luck
and mercy compose without either eating the other.

Spawn rolls, 400k spawns at `ravine_floor` through the real `spawnMonster`:
boss (6%) realized 5.995%, worst run 64; aberrant (2%) 2.004%, worst 172; epic
rarity (2%, global) 2.021%, worst 179.

### 3.3 The costs, both real

- **The median moves the wrong way.** The mean is pinned, so cutting the tail
  has to push the middle right: the fang blade's median wait goes 71 → 91 kills.
  Half of all drops now arrive *later*. This is the price of the tail, it is
  asserted in the tests so nobody re-tunes `MERCY` believing it is free, and it
  is why `MERCY_MAX_RATE` exists — a 20% drop has no drought worth paying for.
- **Early luck mostly dies.** At 1% and `MERCY = 0.85` the first roll after a
  hit is 0.16% rather than 1%, so the odds of the drop inside the first 25 kills
  fall from 22% to about 6%. Raising `MERCY` to 1 would buy another 6% off the
  99th percentile and cost another order of magnitude of that.

### 3.4 Crits: the same machine, mirrored

Added alongside. Dota's pseudo-random distribution is a *proc* system first —
crit, evasion and bash share its coefficient table, and item drops are the part
that never used it — so crits get the same treatment here, on both sides of the
swing (`procChance`, keyed `proc:crit` for the player and `proc:crit:<defId>`
per monster species).

**The threshold inverts.** Escalation only pays over a run longer than about
`2/rate` rolls. For a drop the run is thousands of kills; for a proc it is the
dozen swings of one fight. Under that length the cold first rolls dominate and
mercy is *backwards* — odds of no crit across 8 swings:

| crit | plain | with mercy |
|---|---|---|
| 5% | 66.3% | 84.2% — worse |
| 10% | 43.0% | 56.2% — worse |
| 20% | 16.8% | **10.2%** |
| 30% | 5.8% | **0.1%** |

So `PROC_MIN_RATE = 0.15`: the game's floor of `5% + 0.15% × DEX` rolls exactly
as it always has, and smoothing arrives around DEX 67, where crits have become
a plan rather than a surprise.

**The counter must persist, and must be capped.** Both follow from procs being
separable in a way drops are not:

- *Persist.* A per-fight counter discards its accumulated debt at every fight
  end, so the realized rate falls below the authored one — measured at 20%
  nominal: 14.4% over 5-swing fights, 17.4% over 10, 19.5% over 50. That is a
  silent stat nerf, so the ledger persists (and monster counters are keyed by
  species, not by corpse, for the same reason).
- *Cap.* Persisting makes the counter buyable — warm up on the training dummy,
  spend the guaranteed crit on the boss. `min(rate × 3, 75%)` removes the
  certainty and costs essentially nothing: at 20% crit the odds of an 8-swing
  dry spell are 10.17% capped against 10.18% uncapped.

Drops need neither, because killing wolves is the only way to make a wolf owe
you anything.

### 3.5 Cost in the loop

One `rand()` per pick, exactly as before — the random stream does not shift
shape. The solver is memoized per rounded rate and runs a `6/rate`-term series
per bisection step: 12.6 µs to solve a proc rate cold, a few hundred for an
ordinary drop rate, a millisecond or two at the very rare end, once per
distinct rate per session. A DEX point is one such solve.

Per roll, against `chance()`'s 8.9 ns: 22.4 ns below the proc threshold (the
common case in the swing path — a rate check and a lookup), 66.7 ns tracked,
72.2 ns for a monster's keyed roll. At ~100 µs for a hunting tick, ten blows of
tracked crit is **half a percent of one tick**. The memo key is arithmetic
rather than a string precisely so this stays true.

`state.mercy` holds only droughts in progress (a key appears on the first miss,
and is deleted on the hit): 400k spawns through `ravine_floor` left 5 keys
standing, and a 400k-tick hunt at DEX 167 held a single-digit crit counter.

---

## 4. What the docs do and don't cover

Relevant to onboarding anyone — or anything — that has not been in the room.

`CONTENT_GUIDE.md` is unusually complete for a content contract. It carries not just
the schemas but the **tuning and the reasons**: base formulas, XP curves, every cap,
tier bands, `STACK_POWER` against `STACK_MANA`, and — more valuable — why `riposte` is
uncapped, why an `add` on a ×multiplier stat is deliberate, why `preventedMult` scales
with danger rather than with you, why psionic depth belongs in the quantities and
never in a recognition. Someone could rebuild the *engine* from it and get the feel
approximately right.

Three things it does not carry, by design or by omission:

- **The world.** `frost_wraith`, `frozen_hollow` and `hermit_ysolde` are invented
  teaching examples. The actual ~5k lines across `locations`, `monsters`, `skills` and
  `spellcraft` data are specific judgment calls documented nowhere.
- **The UI.** 39 Svelte files, touched only in passing ("add a branch in
  `BestiaryPanel.svelte`").
- **Systems internals.** `combat.ts` is 1784 lines. The guide gives the damage formula
  and the armor-then-resistance order, but not how counter interception, parry, dodge
  and the rotation arbitrate within a single tick.

The guide also points *at* code rather than restating it — `baseStats()`, `EXPOSURE`,
"thresholds in code". Correct for a working repo; a hole for anyone reading it cold.

Worth being explicit about why it is as good as it is: it was written **downstream**
of the implementation. The duplicate-key incident, the Mining-tagged-`craft` mistake,
the bare `{ on: 'heal' }` trap are scar tissue. A greenfield spec that read this
confidently would be missing exactly the parts that had to be discovered — and
nothing in the prose would give that away.
