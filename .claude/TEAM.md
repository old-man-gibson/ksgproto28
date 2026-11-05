# Team

The main session (Opus) manages. Six agent definitions live in
`.claude/agents/`:

| Agent | Model | Effort | Writes code | Job |
|---|---|---|---|---|
| `builder` | sonnet | xhigh | yes, in its own worktree | build one scoped brief, verify, commit to its branch |
| `brainstormer` | sonnet | xhigh | no | 2–4 mechanism-first options per problem, plus a pick |
| `antagonist-design` | fable | max | no | attack a plan against the laws and as the troll player |
| `antagonist-code` | fable | max | scratch repro files only, in its own worktree | attack a branch's diff and reproduce the bugs |
| `scout` | sonnet | medium | no | answer one lookup question with `path:line` facts |
| `verifier` | sonnet | high | no | check UI changes on port 5599, PASS/FAIL per check |

Effort is set in each file's frontmatter (user, 2026-10-23: weekly usage
allows high effort). The antagonists get the top level because a missed
failure costs more than the tokens. `scout` and `verifier` sit lower on
purpose: they exist to take cheap work out of the manager's context.
`builder` and `antagonist-code` declare `isolation: worktree`, so the manager
does not have to pass it.

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
   (user's OK), runs `npm run verify` on the result, has a `verifier` check UI
   changes on port 5599, commits, and reports: done / tested / committed /
   not done. The manager opens a screenshot only when the verifier reports a
   FAIL or the user asks to see it.
9. **Close.** A landed task ends the session's job. If the next request is a
   different task, say so and suggest a fresh session (see `CLAUDE.md`,
   "Main session").

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
- Builders run on Sonnet. Overriding one to Opus is allowed for a brief that
  needs it, and the brief says why in one line. (2026-10-30: 6 of 11 builder
  spawns in one session were overridden with no reason written down.)
- Bulk critique (dozens of ideas per batch, as in an ability-generation
  workflow) runs its first pass at `high` effort, or on Sonnet, and keeps
  `max` for the re-review of survivors. Rejecting a weak idea is cheap; `max`
  is for plans and branches, where a miss costs a build.
- Small features go through a builder too, without the antagonist steps if
  the manager judges them low-risk. The manager's own edits are for merges,
  conflict resolution and one-file fixes it has already read.

## Measuring usage

Session transcripts record the main session's tokens only; agents and
workflows do not show up in them. To see where usage goes by agent:

- `/usage`, then the plan breakdown: share of the last 7 days per subagent,
  skill and plugin.
- OpenTelemetry, for numbers: in user settings (project `env` is ignored for
  these), set `CLAUDE_CODE_ENABLE_TELEMETRY=1`, an `OTEL_METRICS_EXPORTER`,
  and `OTEL_LOG_TOOL_DETAILS=1` so custom agent names are not reported as
  "custom". The metric `claude_code.token.usage` splits by model, by
  `query_source` (main or subagent) and by `agent.name`.

## Invoking

`team:` followed by the three lines runs the whole loop. A single step can be
asked for by name: "brainstorm X", "red-team this plan", "attack branch Y",
"build this brief".

The definitions load at session start. After editing a file in
`.claude/agents/`, start a new session before relying on the change.
