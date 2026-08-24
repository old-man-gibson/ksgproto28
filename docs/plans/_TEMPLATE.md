---
id: _template
title: Copy this file to start a card
kind: story
status: todo
system: meta
parent: ''
save: ''
updated: 2026-08-09
invariants: []
done: []
---

# The card format

Every file in `docs/plans/` is a card. The **frontmatter is the interface** —
it is what the board renders and what Claude greps; the prose below it is the
design, and nothing reads that but a human and whoever is building the thing.

Copy this file, rename it to the `id`, fill the header, write as little or as
much prose as the idea currently deserves. A card with three lines of body is a
legitimate card — that is what `todo` is for.

## Why the header is deliberately stupid

Flat scalars and `- item` lists, nothing nested, no quotes, no anchors. The
parser in `board/server/cards.ts` is fifty lines and has no dependency, which
means the format cannot rot into something only a library understands. If you
hand-edit a card in a text editor and the board still reads it, the format is
doing its job.

**The board is a view. The files are the truth.** Delete `board/` entirely and
you lose a rendering, not a backlog — the same rule that makes `docs/` the
survivable layer (see [AUTHORSHIP.md](../AUTHORSHIP.md)).

## Editing

The board writes `status` (drag, or the drawer's dropdown), `title`, `system`,
`parent`, `invariants`, `done`, and the prose body. Everything else — `id`,
`kind`, `save` — is edited in the file, deliberately: they are the fields that
change what a card *is*, and none of them should be a stray click away.

**A prose write is refused if the file changed on disk since the drawer was
opened.** The board is not the only thing that writes here — a text editor and
Claude both do — and there is no git to undo an overwrite. On a refusal your
typing is kept, not discarded; reload, then re-apply.

Unsaved edits survive selecting another card, and the card shows a `●`. Nothing
autosaves.

## Fields

| Field | What it holds |
|---|---|
| `id` | kebab-case, matches the filename. Referenced by `parent`. |
| `title` | One line, human. Shows on the card face. |
| `kind` | `epic` (a system-sized body of work) or `story` (one shippable change). |
| `status` | One of the six below. The only field the board writes. |
| `system` | Which `docs/<SYSTEM>.md` this answers to — `arcane`, `psionic`, `mutagens`, `music`, `combat`, `forge`, `meta`… Groups the board by colour. |
| `parent` | For a story, the epic's `id`. Empty for epics. |
| `save` | Save version that shipped it. Filled in at `complete`, empty before. |
| `updated` | ISO date, last time the card was touched. |
| `invariants` | What this must not break. Free tags, but prefer the names already used in the repo: `completability`, `modFingerprint`, `ast-surgical`, `two-validation-layers`, `no-terminal-states`. |
| `done` | Acceptance criteria, one line each. **This is the use-case layer** — write it as what is true when the card is finished, not as steps. |

## The six statuses, and who owns each

The column tells you whose turn it is. That is the whole point of having six
instead of three.

- **`todo`** — captured, not thought about. A seed, a sentence, an itch.
  *Yours.* Nothing here is a commitment and nothing here needs to be good.

- **`planning`** — being designed, in conversation. Rules are being settled and
  argued. A card sits here while the *identity* of the thing is still open —
  what makes it distinct, what it must never become.
  *Shared.* This is the part that cannot be delegated and also cannot be
  skipped.

- **`draft`** — the design is settled and written down. The prose below the
  header is a real spec: someone could build from it without asking you a
  question. No code exists yet.
  *Claude writes it, you tear it up.* A card should leave `planning` for
  `draft` as soon as the shape is agreed, because reacting to a written spec is
  cheaper for you than generating one.

- **`execution`** — being built. Code is being written against the draft.
  *Claude's.* If a design question surfaces here, the card goes **back to
  `planning`** rather than being resolved by guess. That bounce is the feature.

- **`review`** — built, `npm run verify` green, waiting on you: read the diff,
  understand the rule, tune the numbers.
  *Yours, and non-delegable.* Tests can prove it does not crash and does not
  break an invariant. They cannot tell you it is good. Nothing leaves this
  column without a human having read it.

- **`complete`** — shipped, docs updated, `save` stamped, and the corresponding
  section deleted out of [NEXT.md](../NEXT.md).
  A card is not complete because the code works. It is complete when the
  knowledge has been moved into `docs/` and would survive you not being here.

## Epics

An epic is a card whose body is the shared design, and whose stories carry
`parent: <epic-id>`. Stories show a `↳ parent` chip; epics render wider and
sort to the top of their column.

An epic's `status` is **written, not computed**. The convention is that it sits
at the *furthest-back* status of any open story under it — an epic is done when
its last story is, not when its first one ships — but the board will not
enforce that, because a view that silently overrules the file would break the
one rule everything here rests on. If the two disagree, the file is right and
the convention was not followed.

Epics are for system-sized work: a new deity, a crafting identity, a
cultivation layer. If you cannot name at least two stories under it, it is a
story.
