# ksgproto28

Svelte 5 + TypeScript idle RPG ("the kitchen sink game"): pure game core in
`src/core/`, UI in `src/ui/`, content forge in `forge/`. Read
`docs/PITFALLS.md` before touching `save.ts`, `derived.ts`, `statuses.ts` or
anything the UI proxy wraps.

## Environment

- Main checkout `D:\ksgproto28` on Windows (PowerShell and Git Bash). Tool
  shells may lack Node on PATH (`docs/PITFALLS.md` §9).
- Port 5173 holds the user's real save: never start a server there or write
  its localStorage. Test on 5599 (`dev-test` in `.claude/launch.json`).
- `npm run verify` is svelte-check, vitest and the build. Keep only the tail
  (`2>&1 | tail -25`, or `| Select-Object -Last 25`): whatever a command
  prints stays in context for the rest of the session.
- Worktrees have no licensed art; `docs/ENGINEERING.md` §5 says how to link
  it in.

## Main session

This section is for the main session (the manager); agents can skip it.

Measured over six sessions, 2026-10-27 to 11-05: re-reading the main
session's own context was most of the cost. Three quarters of its calls
carried more than 200k tokens. These rules keep that context small, and
`.claude/settings.json` compacts at 300k tokens instead of near 1M.

- **One task per session.** When a task has landed and the next request is
  unrelated, say so and suggest a fresh session. The longest session ran six
  days across several features and was half the measured usage.
- **Lookups go to `scout`.** If a question takes more than about three greps
  or file reads, spawn a scout and keep its `path:line` answer. Shell reads
  in the main thread were 12–43% of each session's re-read context.
- **Screenshots go to `verifier`.** Browser checks in the main thread were
  12–30% of re-read context, and a screenshot stays in context once taken.
- **Feature code goes to a `builder`**, small features included. The
  manager's own edits are for merges, conflict resolution and one-file fixes
  it has already read.
- **Parallel sessions use separate checkouts.** If another session is
  working in `D:\ksgproto28`, work in a worktree (EnterWorktree) instead of
  the shared `main`, and link the art in as above.
- The team loop and its agents: `.claude/TEAM.md` (`team:` plus three lines).
