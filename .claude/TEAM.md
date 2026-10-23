# Team

The main session (Opus) manages. Four agent definitions live in
`.claude/agents/`:

| Agent | Model | Writes code | Job |
|---|---|---|---|
| `builder` | sonnet | yes, in its own worktree | build one scoped brief, verify, commit to its branch |
| `brainstormer` | sonnet | no | 2–4 mechanism-first options per problem, plus a pick |
| `antagonist-design` | fable | no | attack a plan against the laws and as the troll player |
| `antagonist-code` | fable | scratch repro files only | attack a branch's diff and reproduce the bugs |

## The loop

1. **Ask.** The user gives three lines: what changes / what it must respect /
   what done looks like. The manager reads the docs and writes every brief.
   The user never writes a spec.
2. **Brainstorm** (design questions only). Two or three brainstormers in
   parallel, each with a different angle: smallest change, most systemic,
   monster side first. The manager merges them into a shortlist of at most
   three.
3. **Attack the plan.** `antagonist-design` gets the shortlist or plan text,
   not the brainstormers' case for it. The manager rules on each objection:
   accepted (the plan changes), rejected (reason written down), or sent to
   the user.
4. **User checkpoint.** The manager brings back the plan, the rejected
   objections with reasons, and the open questions batched. The user answers
   in fragments.
5. **Build.** One builder per independent set of files, each in its own
   worktree. Two builders never touch the same files.
6. **Attack the diff.** One `antagonist-code` per branch, given the branch and
   the brief, not the builder's report. The two Fable slots go to two
   branches, or to one plan and one branch in parallel.
7. **Fix.** CONFIRMED findings go back to the same builder through
   SendMessage, so it keeps its context. Two rounds at most; after that the
   manager decides.
8. **Land.** The manager merges the builder branches into one feature branch
   (user's OK), runs `npm run verify` on the result, screenshots UI changes on
   port 5599, commits, and reports: done / tested / committed / not done.

## Rules

- The manager decides. Antagonists cannot block on their own. The user
  overrides everyone.
- Antagonists get artifacts (plan text, branch), never the author's
  self-assessment. A reviewer handed the conclusion tends to confirm it.
- An objection or finding without a concrete failure scenario is dropped.
- No agent touches port 5173 or its localStorage (`docs/PITFALLS.md` §2).
- Size: a normal task is one brainstorm round, one or two builders, one or
  two antagonists, about six agents. Skip the steps a task does not need: a
  bug fix skips 2–3; a pure design question stops at 4.
- Every report is label: fact lines (engineer register).

## Invoking

`team:` followed by the three lines runs the whole loop. A single step can be
asked for by name: "brainstorm X", "red-team this plan", "attack branch Y",
"build this brief".

The definitions load at session start. After editing a file in
`.claude/agents/`, start a new session before relying on the change.
