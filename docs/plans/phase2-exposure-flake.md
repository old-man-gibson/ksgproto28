---
id: phase2-exposure-flake
title: Heat Resistance exposure test flakes under full-suite load
kind: story
status: todo
system: meta
parent:
save:
updated: 2026-08-09
invariants: []
done:
  - npm run verify is green on repeated consecutive runs, not just usually
  - The fix is a real one — a raised timeout is acceptable only if the test is genuinely slow, not if it is genuinely racy
---

# `phase2.test.ts` exposure flake

Observed 2026-08-09 during unrelated work.

**"exposure resistance skills > getting burned by fire slimes manifests and
levels Heat Resistance"** timed out at 5627ms against vitest's 5000ms default,
in a full `vitest run`. The same file passed 17/17 on three consecutive
isolated runs, and the full suite had passed 1519/1519 an hour earlier.

## Why it tips

In isolation the whole file takes ~3.2s of test time. Under the full suite's
parallelism it loses enough CPU to cross 5s. So it is not obviously *racy* —
it looks like a genuinely slow test sitting too close to the default budget.

## Why it matters more than one red line

`npm run verify` is the gate every card has to pass to leave `execution`. A
gate that fails once in a while for reasons unrelated to the change teaches you
to re-run it and shrug, and that habit is how a real failure gets waved through.
An intermittently-green gate is worse than a slow one.

## Before raising the timeout

Check whether the test is slow because the *system* is slow — exposure XP runs
per tick, and if it needs thousands of ticks to manifest a skill, that is a cost
the game pays too, not just the test.
