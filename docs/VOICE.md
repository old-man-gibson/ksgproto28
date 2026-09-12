# Voice

*How the game's prose is written, and what to do when you get stuck writing it.*

This is the one layer of Frontier Idle that lived nowhere but in chat logs.
`DICTIONARY.md` holds identifiers, `CONTENT_GUIDE.md` holds mechanics; this
holds register. It exists for two readers: a drafter writing prose in your
voice, and **you, mid-sentence, losing faith.** S6 is the part for that.

---

## 1. The generator: panels

You compose in comic/manga panels, not paragraphs. Almost every habit below
falls out of that one fact, so if you only remember one line, remember this:

> **One sentence is one panel.**

- **The camera starts off-subject and pans in.** A market scene opens on three
  unattributed barkers; a tavern scene opens on the oni skull nailed above the
  door. Never on the person the scene is about.
- **Zoom that terminates in a caption.** Wide, mid, close, then a flat line that
  lands the point (S2). See S5 — this maps onto the spot graph.
- **Dialogue beats anchored to a hand doing something.** A talking-head panel is
  dead, so speakers flick, tap, ash, straighten, count on fingers, stretch.
- **Costume and design revealed by physics, never listed.** Wind opens a jacket
  to show a card holster. A thumb runs over a menu corner and a logo bleeds
  through.
- **Relative scale is always given** — "just shy of six feet", "taller than both
  her parents", "makes her appear a lot taller than she really is at just five
  and a half feet". You need to know how tall to draw them.
- **Cutaways carry interiority.** "Even the shadowy arms behind the counter
  stopped washing the remainder of the glassware" is how a character is shown to
  be stunned. Cut away from the face, not to it.

**Tense: present, always.** Panels have no tense, which is why longer prose
wobbles at the seams between beats. At one sentence per slot there is no seam.
The problem does not exist at the scale this game writes at.

---

## 2. The rules

**The last clause has to be drawable.** The load-bearing rule. Setups may be
abstract; payoffs may not. If the final clause is a concept, an inversion, or a
neat symmetry, it is wrong — replace it with a person doing a visible thing, or
a specific object.

| rejected | accepted |
|---|---|
| "make it back before noon" | "merchants have theirs set up before the sun's fully risen" |
| "the loss becomes your wage" | "he'll pay you with last week's meager earnings" |
| "and so does everything the heroes upstairs never come down to see" | cut entirely |

**Thesis lines are flat.** You do land summarizing lines, but never ornate ones
— they read as caption boxes, often built on a concession:

> It might be a family business, but it's a business nonetheless.

> It is this darkness where the influence of the powerful heroes living in this
> lawless city doesn't reach and crime has taken root.

No compression, no kicker, no rhythm trick. If a summary line sounds good out
loud, suspect it.

The rest, smaller:

- **Plain word over jargon.** "rent", not "frontage".
- **Prefer an agent.** The lanes *charge*; someone *pays*. Not "costs".
- **Time as image, not clock reading.** "before the sun's fully risen", not
  "before noon".
- **No counts in prose.** The number lives in `objectives`. Write "clear out the
  infestation", not "clear thirty of them" — otherwise a balance tweak silently
  makes the description a lie. (Distinct from the incentive numbers in S4, which
  are static world facts, not tuned values.)

---

## 3. Register

Your own description of the line that worked, and the target for everything:

> "mechanics with a bit of prose on top"

Plainness is not the failure mode here — **ornament is.** The least writerly
option is usually correct. When a draft feels too plain it is probably right;
when it feels clever, reread the last clause.

**Standing rule (2026-09-07): no mood language.** The player reads these lines
mid-play, often mid-decision. Write as if an engineer wrote them: what the thing
is, what it does, what it costs, who pays. Boring is acceptable; parseable is the
target. Where any habit in S1 or S2 would add atmosphere for its own sake, this
rule wins.

---

## 4. The narrator's toolkit

Impersonal ("one navigates", "one finding themselves"), present tense,
unhurried, no jokes. Game vocabulary is used unblinkingly inside fiction
(low-light vision, mana) — do not hide the game layer.

**Explain a place by its incentive structure, not its appearance.**

> profitable enough to pay for a regular spot in the market, but not valuable
> enough to be along the arteries of customer traffic

Most fantasy narration describes surfaces; this narrator describes equilibria —
who profits, what a place costs, why it is the way it is. It is the signature,
and it is the easiest register to write from a mechanism, which makes it the
safe default when confidence is low.

**Cite the number that explains the behaviour.** Not decoration — a figure that
accounts for why people act as they do. A fifteen percent down-payment is why
the performers stop flaking; a ninety-one-to-a-hundred return is why the patrons
keep coming. Two different characters, same authorial instinct. In a game where
everything has a rate, an NPC quoting a real one reads as characterization for
free.

**The body is a record of labour.** Bryva's arms carry battle scars and her
hands carry ten years of kitchen work — two careers legible on one person. This
transfers straight to items and NPCs: describe a thing by the work that marked
it.

**Lore arrives subordinate.** "a lifetime of fighting at the end of a world that
will no longer come to be" is a dependent clause, never explained, never
returned to. Two versions of the same character are present in one scene and it
is never addressed. It works. Trust this more than feels comfortable — a tooltip
can carry a large fact in a clause and owe the reader nothing.

**Power does chores.** An eight-sphere elemental oni stamps a menu, pours a
beer, washes glassware and chills a mug that got warm. Nothing asserts he is
formidable; the shadow arm doing dishes does all of it. Characterize by what
someone bothers to spend power on.

---

## 5. Structure: the zoom is a spot graph

The narrator's core move — start off-subject, push in, land a caption — is
executable as **content layout**, not as writing. A location's spots are the
panels:

    market_arteries   ->  market_alleys  ->  market_dark

One sentence each, one step further in and one step worse per spot. Done this
way the signature technique starts as a data structure, which is the half that
never stalls. See S6.

---

## 6. When you get stuck

The freeze is mid-draft, not blank-page (the historical case: a quest chain
opened with "whispers of a mysterious" and stopped four words in). That is a
missing definition of done, not missing ability. In order:

1. **Never open with the prose.** Fill `objectives` first — counts, a spot id, a
   recipe, a monster id. That is design work. The `desc` is then a caption on a
   picture that already exists.
2. **Ask what panel this is.** If you cannot picture it, the sentence is not
   ready — an information problem, not a talent problem.
3. **Ask who profits, or what the place costs.** The narrator's engine (S4). It
   will produce a first clause every time.
4. **Make the last clause drawable** (S2). The setup can be abstract.
5. **Stop rule.** A `desc` is finished when it says what the thing is *and*
   either explains one thing by its incentives or lands one concrete object. Two
   clauses. Ship it. It does not have to be good; it has to be true and
   drawable.
6. **Still stuck: write it flat and ugly and move on.** A plain accurate sentence
   is in-register (S3). Nothing downstream cares, and a bad `desc` is a one-line
   fix forever after.

**Naming an ability is the same freeze.** Roll `npm run names`, pick one pair
out of twenty, and write the mechanic from it. The name is a constraint, and
you write from constraints. See FORGE.md, "The name deck".

---

## 7. Differentiating characters

**One speech deformation per character, held consistently.** The deformation is
the character; do not give two NPCs the same one.

- *Nico* — phonetic elision throughout (dropped g's, and contractions like
  "o'", "a'", "fulla"), plus code-switched contempt aimed only at third parties,
  never at the person being negotiated with.
- *Angou* — zero elision. Instead: self-interruption ("like, I really do—but"),
  losing his own list (two things he does well, then three, then "actually
  forget about all that"), and warped idiom ("quite the cucumber you're
  pickling", "pull the same rope").

Both also run **three registers** — public speech, private thought, and a
narrator that reports control leaking ("the corners of his mouth twitched to
contain his pleasure"). Only the first survives into a one-sentence game slot.

---

## 8. Scenes are negotiations

Both source samples are negotiations that end in terms rather than violence: two
parties establish boundaries and part on decent footing. Even the one that opens
with a knife to an ear resolves into an agreement.

This is convenient, because **a quest is a deal.** The ask is a transaction with
a fairness claim attached — "Fork over the money you made today and I'll let you
leave with both ears. Is a fair deal, right?" is already the shape of a `desc`.
Write quest-givers as people proposing terms, not as people needing rescue.

---

## 9. Provenance

Built from two long RP samples (a market/crime scene and a tavern/domestic
scene; a second author's character was excluded from both extractions) plus one
calibration round of four lines, three of which were rewritten or cut. S1-S6 are
well evidenced and confirmed across both samples. S7-S8 are single-observation
patterns. Nothing here has been tested against an actual shipped `desc` yet.

Correct it in place as that happens rather than growing it — a guide consulted
mid-freeze has to stay short enough to read while stuck.
