---
id: balance-harness
title: Headless batch fight simulator
kind: story
status: todo
system: meta
parent:
save:
updated: 2026-08-09
invariants:
  - completability
done:
  - N fights per monster across level bands, run headless, no UI
  - Reports time-to-kill, win rate, damage taken, and flags outliers against authored expectations
  - Batch-authoring ordinary monsters becomes safe, because outliers announce themselves
  - It reports; it never tunes. The numbers stay the author's call
---

# Headless batch fight simulator

Raised 2026-08-09, from the observation that **the marginal cost of content is
not declining** — adding monster #50 costs roughly what monster #5 did.

Splitting that cost shows where the tooling gap actually is:

- **Review** is largely automated — 57 test files, `content.test.ts` mirrored
  into `forge/lib/validate.ts`, `npm run verify` as the gate.
- **Tuning is not automated at all.** It means playing until it feels right,
  serially, in wall-clock time. That is the step eating the calendar.

## Why it is cheap to build

`tests/combat.test.ts` already runs fights headless. This is a **loop over
machinery that works**, not new infrastructure.

## The rule that keeps it honest

**It reports; it never tunes.** The author decides that an ordinary tier-2
should die in 8–15 seconds at band 3 — that call is irreducibly human. The
harness only says which of the 68 disagree. Same relationship the repo already
has with `content.test.ts`: the judgment in it is the author's, executed
repeatedly for free.

## Not a fix for the asurendras

Tier-5 mutagens break a rule of the game rather than bending a number, so each
one is a mini-feature and reviewing one means understanding the rule. **That
cost is irreducible and should not be optimised away** — it is what the tier is
for. This card is about the other 60-odd.
