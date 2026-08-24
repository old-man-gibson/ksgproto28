# Magical music

*Spec + authoring guide. Shipped 2026-08-05 (save v41). Code:
`src/core/systems/music.ts`, content in `src/core/data/music.data.ts`, panel
in `src/ui/panels/MusicPanel.svelte`, tests in `tests/music.test.ts` plus
`tests/content.test.ts` §music content (mirrored in `forge/lib/validate.ts`
§Music).*

## What it is

The player writes sheet music — notes and rests placed into bars — and
performs it. What a piece **is** is decided by mathematical analysis of the
whole sheet, never by any single placement: key-finding, contour, motion,
syncopation and entropy are measured, and the nearest **archetype** names the
tune. Its crafting identity in the family:

| system | identity |
|---|---|
| cooking | sum |
| stove | when |
| alchemy | sequence |
| mutagens | topology |
| runecarving | breadth |
| *(parked weaponsmithing)* | proportion / count |
| **music** | **the analysis names the product** |

The effect **hook is live** — `conferredBy` → `applyStatuses` fires at
performance end (`music.ts`) — but **no archetype declares a `confers` yet**,
so nothing modifies a stat in practice. What a kind of music *does* is content
the user has not written; the scaffold is finished. See §Effects.

## The seam (do not move it)

Cut exactly where arcana cut it:

- **The reading is pure.** `analyzeBars(bars)` and
  `readComposition(comp)` are functions of the sheet alone. No state, no
  RNG, no level checks. This is why the panel can show a full analysis of a
  piece the player cannot legally perform — the bench parsing a sentence you
  cannot speak.
- **Legality is state.** `checkComposition(state, comp)` returns
  player-readable problems: unfinished bars, locked durations, too many
  bars, locked scale/tonic. Empty list = performable. All Musicianship
  gating lives here and in the edit helpers (`addEvent`, `setBarCount`,
  `setScale`, `setTonic`) — never in the reading.

## `compositionKey` — what a sheet IS

The music system's `carvedKey` / `spellKey` / `shapeKey`. Two properties,
both load-bearing:

- **Canonical.** Two sheets that read the same produce the same key. The `id`
  and the `name` are absent (identity is the music, not the paperwork),
  invalid repeat spans are dropped — `validRepeats` is the single definition
  `expandRepeats` also uses — and the survivors are sorted. Normalised
  accessors (`meterOf`, `tempoOf`, `pedalOf`) mean a sheet saved before
  meters existed keys identically to one that spells the defaults out.
- **Reconstructible.** Hand somebody the string and they have the piece, with
  no registry of yours. That is what would make compositions shareable.

```
scale:tonic/meter@bpm[~pedal]|bar/bar/bar[#from-toxtimes+…]
major:0/common@132~5|half.7,half.4/whole.0/…#0-1x2
```

**The rule for changing it: a field belongs in the key iff the READING
consumes it.** Everything `readComposition` touches is in there — scale and
tonic (they rule the key, see `keyIn`), meter, tempo, pedal, the written bars
including ties, and the repeat spans. Add an input to the reading and it must
join the key in the same commit, or two pieces that sound different will
claim to be the same piece.

Durations go in **by id, never by units**: the grid was rescaled once already
(48 → 60, when quintuplets forced a factor of five) and ids are what survived
it. If a compact form is ever needed, **hash the key** — do not shorten the
encoding.

Note that a repeat span and the same bars written out twice are deliberately
DIFFERENT keys. They expand to the same sequence, but `weightedAttacks` pays
the nth replay 1/n, so they do not read alike.

Nothing consumes this yet. It exists first because the thing that will
(performance momentum — see §Open items) is exploitable without it: key a
build-up to `comp.id` and a player fills the meter on a four-bar sheet, then
edits the notes into an eight-bar piece and keeps the level.

## The sheet

- A composition: `{ id, name, scale, tonic, bars }`, stored in
  `state.compositions` (uid from `state.uidCounter`). Bars are arrays of
  events `{ dur, pitch }`; `pitch: null` is a rest. A bar is a monophonic
  **sequence** — position is the running sum of durations, never stored, so
  overlaps and gaps cannot be represented.
- **The grid: `UNITS_PER_QUARTER = 60`** (so a common-time bar is
  `BAR_UNITS = 240`). 60 divides by 4, 3 AND 5, so sixteenths, triplets,
  QUINTUPLETS and dots are all integers: whole 240 · dotted half 180 · half
  120 · dotted quarter 90 · quarter 60 · dotted eighth 45 · eighth 30 ·
  sixteenth 15 · triplet quarter 40 · triplet eighth 20 · quintuplet eighth
  24 · quintuplet sixteenth 12. (The grid was 48 until quintuplets forced
  the factor of five — no save noticed, because notes store duration IDS.)
  Dots are ×1.5 and deliberately do NOT divide the bar; the invariant is
  integrality, not divisibility (linted so).
- **Meter (`Composition.meter`, MUSIC_METERS, forge kind `musicMeter`).** A
  time signature is a bar length + an accent pattern, NEVER a speed. Bar
  capacity = beats × beatUnits; `accents` lists the secondary strong pulses
  and feeds `metricWeight(pos, meter)` — the per-meter heartbeat the
  syncopation measure reads. Shipped: 4/4 (free), 3/4 @21, 6/8 @23, 5/4 as
  3+2 @25. The teaching pair: 3/4 and 6/8 hold the same 180 units and play
  nothing alike. Performance time follows capacity at fixed tempo
  (`performanceTicks`: a 4-bar waltz is 9 s where common time is 12); the
  staff draws shorter bars honestly, beat guides come from the meter, and
  its accents draw a shade firmer. Density normalizes per common-bar
  equivalent so waltzes aren't called sparse. Whole notes can't be written
  in 3/4 (palette disables oversized durations); re-ruling a written sheet
  flags overfull/unfinished bars honestly and reversibly, like scales.
- **Tempo (`Composition.bpm`, @9).** ♩ = bpm, 40–200, exactly as a score
  writes it — **quarter-referenced, so it is meter-independent**: re-ruling
  4/4 as 6/8 changes the bar and never the speed. `ticksPerUnit(bpm)` is
  simply 10/bpm; the stage clock and the audio both read it. Until the
  unlock every sheet plods at the default ♩=80, which is what the fixed
  clock was always giving. **The reading HEARS it** — see `pace` below;
  this is the one classifier input not found in the notes.
- **Pedal tone (`Composition.pedal`, @15) — the second voice.** One pitch
  sounding under the whole piece, unchanging: the bagpipe/hurdy-gurdy
  trick. Named `pedal` (organ pedal point), NOT "drone", because
  `MUSIC_ARCHETYPES.drone` already means a melody that stands still and the
  two sharing a word would be a permanent bug factory.
  It is the system's first VERTICAL dimension, and it does two things:
  - **`harmony` axis** — duration-weighted consonance of the melody
    against it (`harmonyAgainst`), so a long dissonance counts more than a
    passing one. **0.5 when there is no pedal**: one voice has no harmony
    to have an opinion about, and any other default would drift pedal-less
    pieces toward archetypes that care. Lullaby wants 0.9, incantation
    0.35, both at half weight.
  - **It joins key-finding at its full sounding length**, so laying a pedal
    genuinely pulls the key toward itself (a C-major arpeggio over an A
    pedal reads as A minor). That is not a side effect — it is what drones
    do to ears, and it makes cadence move too.
  Audio gives it a sustaining envelope at 0.55× level with a doubled
  detuned oscillator (a lute's pluck would have died long before the piece
  did; an undetuned drone reads as a test tone). Drawn as one unbroken line
  across every bar at its row.
- A bar must sum to exactly its meter's capacity to perform. Rests fill
  bars like sound does.
- **Ties (`NoteEvent.tie`, @13).** Joins a note to the NEXT written note of
  the same pitch, across the barline if need be; the two sound as one.
  `soundedEvents(bars)` folds them, and EVERYTHING melodic reads the folded
  stream — so a tie can never fabricate a unison interval or inflate the
  note count, and a note tied over a barline syncopates against the next
  bar's downbeat (long syncopation, the reason ties exist). Rhythmic
  *vocabulary* (rhythmEntropy) still reads what is written. Invalid ties
  (to a rest, to another pitch, off the end) are simply not honoured by the
  reading and are reported by `checkComposition` — the legality/reading
  seam again.
- **Repeats (`Composition.repeats`, @7).** `{ from, to, times }` spans, no
  overlaps, never straddling the theme/coda boundary (the coda is its own
  reading). `expandRepeats(comp)` unrolls them into the performed sequence
  with `source[]` and `pass[]`; the reading, the stage clock and the audio
  all consume the EXPANDED form — what is heard is what is read, so a
  repeated figure raises `motif` exactly as honestly as writing it twice.
  **The balance rule: `weightedAttacks` pays the nth verbatim replay 1/n**
  (harmonic decay), and both power and performance XP ride it, so a repeat
  mark is never free power or a free XP farm. It still buys real things:
  length, and an honest motif score.
- **Pitch** is absolute semitones above middle C. The scale + tonic are the
  staff's **ruling** (its key signature): `allowedPitches` returns the
  in-key rows, `STAFF_OCTAVES = 2` of them plus the top tonic — 15 lanes.
  The ruling is NOT a cage: `pitchAllowed` accepts any chromatic pitch
  inside the staff's range, reached with an **accidental** (a ♯/♭/♮ palette
  toggle applied to the next placement), exactly as real notation does.
  This matters — a system that can only say what its scale names cannot
  write a tritone, and some music is mostly tritone (the E1M1 stress test,
  2026-08-06). Only the ends of the staff are a wall.
  - Engraving from the ruling (`engrave` in the panel): an in-key pitch
    sits bare on its row; a chromatic one borrows a neighbouring in-key row
    and takes a sign. **Sharps win ties** — a pitch between two rows a whole
    tone apart draws as ♯ (so B♭ in C major engraves as A♯: the same sound,
    the other spelling). Notes outside the five lines get ledger lines.
  - Re-ruling a sheet does not transpose stored notes; it only changes which
    of them need signs, and can strand notes off the ENDS (reported).
- **Bars 1–4 are the THEME; 5–8 are the CODA** (see §Coda).

## The classifiers (`systems/music.ts`)

All pure, all total — every input, however degenerate, produces an answer.

- **Key (Krumhansl-Schmuckler).** Duration-weighted pitch-class profile,
  Pearson-correlated against the 24 rotated Krumhansl-Kessler probe-tone
  profiles (the standard tables, in the file). Best fit = key; its
  correlation = `clarity`. Null when nothing sounds.
- **Contour** (`contourOf`): zero direction changes → `rising`/`falling`;
  exactly one turn → `arch`/`valley`; more → `undulating`; a melody that
  never leaves its note → `level`.
- **Motion**: share of stepwise intervals (≤ 2 semitones) →
  `conjunct` ≥ 0.7, `disjunct` < 0.4, else `mixed`.
- **Interval content**: mean of a per-interval-class agreeableness table
  (`CONSONANCE`) — unison/fifth/fourth high, seconds/sevenths/tritone low. A
  single held tone scores 0.75 (nothing to disagree with itself about).
- **Syncopation** (Longuet-Higgins/Lee-flavoured): a note syncopates when it
  **sounds through** a grid position whose metric weight beats its onset's —
  the accent lands where no attack does. Metric weight from divisibility:
  downbeat 5, beat three 4, beats two/four 3, off-eighths 2, the
  sixteenth/triplet lattice 1, off-lattice 0. An off-beat note that resolves
  ON the next beat is not syncopation; one that ties across it is. Ties
  across BARLINES don't exist yet (see §Open).
- **Shannon entropy**: over pitch classes (÷ log₂ 12) and over the duration
  alphabet (÷ log₂ 7). One repeated pitch = 0 — no information.
- **Pace**: the composition's own tempo on the 0–1 axis scale
  (`paceOf`: MIN_BPM→MAX_BPM, so the ♩=80 default sits at 0.25). The only
  axis not read off the notes, and the reason it exists: **density was
  faking it**. A dirge and a reel can hold the very same notes and differ
  only in speed, so every archetype states a `pace` target (drone 0.06,
  dirge 0.1, lullaby 0.16, anthem 0.3, incantation 0.31, march 0.45,
  rhapsody 0.56, reel 0.69) and a content test requires it of new ones.
- **Cadence** (`cadenceOf`): how the last gesture lands, read against the
  detected key — the chordless melodic reading. Ends on the tonic →
  **closed**; dominant promises home and delivers the submediant (7→9) →
  **deceptive**; ends on the dominant or leading tone → **open**; anything
  else → **wandering**; nothing sounded → **silent**. Categorical, not an
  axis, so archetypes carry it as an affinity list like `contours`
  (`cadences`, discount `CADENCE_AFFINITY`); lullaby and anthem want
  `closed`. `CADENCE_WORDS` says each one plainly for logs and tooltips.
- Plus **density** (sounded notes per bar), **rest ratio**, **range**.

## Archetypes: naming what was heard

`classify` flattens the analysis onto ten 0–1 axes (`MusicAxis`; density
normalizes against a 16-note bar, range against an octave) and takes
**weighted RMS distance to each archetype's declared target** — omitted axes
don't pull. A matching contour shaves `CONTOUR_AFFINITY = 0.06` off.
Nearest wins; `purity = clamp01(1 − 1.5 × distance)`.

**The totality rule is load-bearing.** Every sheet is nearest to
*something*: one held note is a Drone, uniform chaos is a Rhapsody, even
total silence reads. There are no failure combos and must never be — if an
archetype could "reject" input, the system collapses into hidden recipes and
loses its identity. Tune targets to move what the world hears, never to
make a sheet fail. Discovery is the collection layer: the stats counters
`music:performed:<archetype>` fill a chart for free.

Shipped registry (`MUSIC_ARCHETYPES`, forge kind `musicArchetype`), thirteen:
lullaby, dirge, march, reel, anthem, incantation, rhapsody, drone, **ostinato,
perpetuum, patter, keening, knell**. The panel always shows the top three with
purities, so composing toward an archetype is learnable — nobody games what
they cannot see.

### Calibration: the targets are measured, not guessed (2026-08-06)

The first eight targets were written by ear and put the classifier **below
chance**. Measured over 6,000 random exact-fill sheets against a corpus of
hand-transcribed tunes: noise scored a median purity of **0.826** and real
music **0.749**. Brahms's *Wiegenlied* read as a dirge, Ode to Joy read as a
dirge, `lullaby` won nothing at all, and *At Doom's Gate* was filed as a reel
at 76%.

Three causes, all data:

1. **Targets parked in the noise cloud.** Random sheets sit at syncopation
   ~0.333; the shipped `reel: syncopation 0.30` was the noise median to three
   decimals. `rhapsody: rhythmEntropy 0.70` was worse than wrong — the
   duration palette tops out near 0.65, so it was a coordinate no sheet could
   occupy.
2. **`motif` and `rhythmEntropy` are the only reliable deliberateness
   detectors** (noise 0.157 / 0.808, written music ~0.70 / ~0.20), and five of
   eight archetypes never mentioned motif. All thirteen now declare both.
3. **`undulating` was a private bonus.** `contourOf` returns it for 5,944 of
   6,000 random sheets, and only reel and rhapsody claimed it — a flat +0.09
   purity handed to dice, and the sole reason a Doom riff outscored a march.
   **No archetype may claim it**; the affinity constant stays at 0.06, because
   it IS the >0.90 band once it rewards a contour that is not the default.

Plus one hole: nothing covered **high motif + near-zero rhythmic entropy +
high density + no syncopation** — a riff. That is `ostinato`, and E1M1 now
reads as one at **0.918** with a 0.216 margin.

After: noise median **0.643**, noise max 0.816, and every exemplar in
`tests/music-identity.test.ts` clears it. Nothing above 0.85 is reachable by
dice at all (0 of 6,000).

Those rules are enforced as content legality in `tests/content.test.ts` §music
content and mirrored in `forge/lib/validate.ts`, so the forge stops an author
before a miscalibrated archetype ships. **The reachability proof lives in
`tests/music-identity.test.ts`**: one hand-written exemplar per archetype, and
a test asserting the exemplar table and the registry have the same keys — so
adding a kind of music without proving a human can write one fails the build.

## The coda (bars 5–8)

Read **separately** from the theme, then related to it:

- Same archetype → **reprise**: magnifies the whole, ×(1 + 0.25 per coda
  bar) on `power`.
- Different archetype → **turn**: the piece changes direction — the metal /
  electronic *breakdown*, made mechanical. The coda's archetype is intended
  to colour the eventual effect; today it colours the log line.

`power` (dormant): sounded notes × (0.5 + 0.5 × theme purity) × reprise
magnifier. Computed and displayed now so composing against it is learnable
before it matters.

## Musicianship and the ladder

Skill `musicianship` (specialist curve, tag `music`, no stat effects).
It manifests **from the stage**: `tickPerformance` calls
`checkDiscovery(['music'])`, and nothing else emits the tag (registered in
the content test's emitted-tags list, like `time`). Composing is free at
level 0 — whole and half notes, four bars, C major.

`MUSIC_UNLOCKS` (all gating reads this): quarter 5 · **repeats 7** · bar5 8 ·
**tempo 9** · dots 10 · eighth 12 · **ties 13** · dotted eighth 14 ·
**pedal 15** · triplets 16 · bar6 18 ·
scales 20 · 3/4 @21 · 6/8 @23 · sixteenth 24 · 5/4 @25 · bar7 26 ·
quintuplets 27 · tuning 28 · bar8 30. Interleaved on purpose — notes, bars and rules arrive alternately
(the incremental-escalation house preference). Tier names sit on ladder
rungs: Busker / Time-Keeper / Melodist / Scale-Walker / Virtuoso.

Scales (`MUSIC_SCALES`, forge kind `musicScale`): major always; minor,
harmonic minor, dorian, mixolydian, both pentatonics behind the unlock.
Degrees are semitones above the tonic — ascending, starting at 0, within
0–11 (linted both layers). Tuning moves the tonic (0–11); K-S then hears
the transposition, which is its own feedback loop.

## The stage

`state.performance` is **benchWork's sibling** and follows its law:
starting one clears `activity`/`benchWork`/`travelPlan` (and vice versa —
`selectActivity` and `startBenchWork` both null it); it is bound to the spot
it began at; walking away abandons it; combat interrupts it. A set cut
short pays nothing but the per-tick trickle.

- Duration: `bars × TICKS_PER_BAR` (30 — 3 s/bar).
- Per tick: `MUSIC_XP_PER_TICK` (0.05) via `grantSkillXp(['music'])`.
- On completion: `notes × MUSIC_XP_PER_NOTE (0.75) × (0.5 + 0.5 × purity)`,
  counters `music:performances` and `music:performed:<archetype>`
  (achievement food), and a log line via `describeReading` — "an anthem in
  C major, its coda swelling the theme".
- Offline catch-up runs it for free: `tickPerformance` sits in
  `Game.advance` next to `tickBenchWork`.

### Audio (`src/ui/lib/musicAudio.ts`)

Sheets are audible. UI-side only — the core never knows: a Web Audio pluck
synth (triangle oscillator, fast attack, string-like decay, shared lowpass)
reads the same NoteEvent data the classifiers do. Timing is the game's own
`SECONDS_PER_UNIT` (3 s bars), and within a bar notes sit sample-accurately
on the AudioContext clock, so syncopation is *audible*. During a performance
App.svelte schedules each bar as its tick arrives (audible from any tab);
the panel's **Listen** button auditions a draft with no stage and no XP,
each measure carries **▶** (hear this bar alone) and **▶▶** (hear from here
to the end) — starting any audition stops whatever was sounding, so
clicking around while iterating always plays the latest thought — and a
🔊/🔇 toggle persists to `localStorage['ksg:music-muted']`.

**Voices** (`VOICES`): lute (triangle pluck), pipe (sustained sine), bell
(long decay, detuned), horn (sawtooth, sustained), growl (sawtooth into a
waveshaper — for music that wants to be a problem). Each is a small
subtractive patch: waveform, ADSR-ish envelope, its own lowpass, optional
drive and detune. There is deliberately no global tone filter any more — a
shared 2.4 kHz lowpass turned the driven sawtooth into a kazoo. The choice
is a **listening preference** in localStorage (`ksg:music-voice`), NOT a
Composition field: real instruments are a designed thing (gear, or a base
structure — §Open), and baking a voice into the sheet would pre-empt it.

Rules: the AudioContext is created/resumed ONLY inside click handlers
(`ensureAudio` — browser autoplay policy); `playBar` never creates one, so a
performance resumed from a loaded save is silent until the player next
touches the stage (deliberate — beats stale notes firing all at once on a
later click). Notes get 92% of written length so repeats articulate.

## Effects — the hook is LIVE; the content is yours

**What a kind of music does is now pure content.** Each archetype may carry

```ts
confers: { status: 'marching_order', perPower: 0.5, duration: 3000 }
```

and a piece carried to its end applies that condition to the performer at
`intensity = max(1, round(power × perPower))` (`duration` optional —
otherwise the status's own). Deliberately built on **statuses**, for three
reasons: statuses are already a fingerprinted mod source (zero
derived-stats work — the weather lesson satisfied for free, because the
bucket IS the status); they bring stacking, escalation, removal and decay
semantics along; and `applyStatuses` is side-agnostic, so the monster bard
lands its hymn through the same door with no new code.

Semantics (in `conferredBy`, pure and unit-tested):

- The **theme** confers at full power.
- A **reprise** coda never confers twice — its magnification is already
  inside `power`.
- A **turn** coda confers its OWN archetype's status too, scaled by the
  share of the sheet it occupies × its purity — the breakdown literally
  colours the effect.

**To author an effect**: write (or reuse) a StatusDef — buffs are just
pleasant conditions; cooking's dishes already model "good things over time"
— then add `confers` to the archetype (forge-editable; both lint layers
check the status resolves and `perPower > 0`). No archetype ships with one:
what music does is the user's content, not the scaffold's. The completion
log announces landed effects ("🎶 The music lingers: …").

Still unowned by the scaffold: instruments/venues (delivery modifiers) and
any effect aimed at *enemies* mid-combat — the current hook fires at
performance end, outside fights, on the performer.

## More music-math to mine (a menu)

Every entry here is computable from the sheet, no ear required — candidates
for new analysis axes or mechanics, roughly by bang-for-effort:

- ~~Tempo~~ — **SHIPPED 2026-08-06, save v44** (§The sheet, and `pace`).
- ~~Meter, dots, quintuplets~~ — **SHIPPED 2026-08-05, save v42** (see §The
  sheet). Meters are data (`musicMeter` in the forge) — adding 7/8 as
  2+2+3 is one entry: beats 7, beatUnits 30, accents [60, 120].
- **Windowed key-finding (modulation)** — run Krumhansl-Schmuckler per bar
  instead of whole-piece: a piece that *changes key* mid-theme is detectable
  ("pivots"), which is the coda-turn idea at finer grain.
- **Cadence detection** — how the last two implied harmonies resolve
  (V→I authentic, IV→I plagal, V→vi deceptive). "How it ends" is a natural
  effect trigger — a deceptive cadence that swaps the conferred status at
  the last moment is very on-brand.
- ~~Repeats~~, ~~ties~~, ~~cadence~~ — **SHIPPED 2026-08-05, save v43**
  (see §The sheet and §The classifiers).
- ~~Motif self-similarity~~ — **SHIPPED 2026-08-05**: `motifOf` slides the
  INTERVAL sequence (transposition-blind, so a figure restated a third up
  still matches) and the sounded-duration sequence against themselves at
  lags ≥ 2; best lag wins, halves averaged when both have ≥ 2 comparisons.
  It is the `motif` axis; march 0.85, incantation 0.9, rhapsody 0.15 target
  it. A uniform rhythm alone honestly floors the score near 0.5 — a
  rhythmic ostinato IS repetition.
- **Repeats** [MEDIUM] (user, 2026-08-05 — the ‖: :‖ barlines; voltas are
  the first/second-ending brackets): a `{ from, to, times }` span + a pure
  `expandRepeats(comp)`; the reading, stage clock and audio all consume the
  EXPANDED sequence — what is heard is what is read. WRINKLE, settle first:
  power scales with notes played, so a free ×2 repeat doubles power for
  zero composing — motif-similarity diminishing returns is the honest fix,
  which is why it builds first. Pairs with **ties across barlines**.
- **Dynamics & articulation** [EASY] — per-bar loud/soft (p/mf/f → audio
  gain + a dynamic-range axis) and a staccato flag (shortened sounding
  length, an articulation axis). Small fields, small glyphs, very "sheet".
- ~~Drone voice~~ — **SHIPPED 2026-08-06, save v45** as the PEDAL tone
  (§The sheet). Polyphony's gateway is open: there are two simultaneous
  pitches and a `harmony` axis measuring them.
- **Gap-fill (Meyer)** — after a leap, does the melody step back into the
  gap? A "resolution/longing" axis; cheap to compute from intervals.
- **Melodic expectancy (Narmour/Huron)** — how surprising each note is
  given the last interval; distinct from entropy (which ignores order).
- **Tension curve (Lerdahl-flavoured)** — per-bar distance from the tonic
  triad, giving the piece an arc *shape* — could shape the effect's
  envelope (front-loaded vs crescendo buffs).
- **nPVI** — normalized pairwise variability of durations; a rhythm
  fingerprint distinct from entropy (marches score low, speech-like lines
  high).
- **Cadence detection** [EASY-MEDIUM] — chordless melodic version: last
  stressed scale-degrees against the detected key (5→1 closed, ends on 5/7
  open, 5→6 deceptive). The classifier is small; deciding what endings DO
  (trigger timing, a deceptive cadence swapping the conferred status) is
  the real work.
- **Polyphony** [HARD — the one that changes the instrument]: a second
  voice rewrites the data model (bars per voice), makes every melodic
  classifier pick a lead, turns consonance vertical (Plomp-Levelt), and
  needs voice-selection UI + two-direction engraving. Defer; take the
  drone-voice gateway first. Suggested order overall: motif → repeats +
  ties → cadence → dynamics → tempo → drone → polyphony.

## Authoring quick-reference

- **New archetype**: entry in `MUSIC_ARCHETYPES` (forge: Music Archetypes).
  Declare only the axes you mean; targets 0–1; optional per-axis `weights`;
  optional `contours`. Both lint layers check axes/ranges. Keep totality in
  mind: you are moving Voronoi borders, not adding a recipe.
- **New scale**: `MUSIC_SCALES` — degrees ascending from 0, within the
  octave.
- **New duration**: units must divide 48; set `unlockLevel`; drawing hints
  (`head`/`stem`/`flags`/`triplet`) are engraving only.
- Registries are re-exported from `src/core/registry.ts` and catalogued in
  `forge/server/catalog.ts` (kinds `musicArchetype`, `musicScale`).

## UI notes (MusicPanel)

Real engraving, cheaply: vertical position comes from the **diatonic staff
step** (letter + octave), so a sharp is the same head with a ♯ in front —
which is what lets any scale render on five lines. Middle C gets its ledger
line.

**Editing model (2026-08-05, user-requested):** click a lane to append the
selected duration; **drag from the palette** to insert at any position;
**drag a placed note** to re-pitch (vertical), reorder, or move it between
bars (an accent caret + ghost head show the drop; capacity is enforced);
**drop a note on its written neighbour** to merge them when the sum is a
real duration (quarter+eighth = dotted quarter — target's pitch survives);
**right-click** splits a note or rest in half (refused when no half exists
or the finer duration is locked — splitting is never a back door past the
ladder); plain **click removes**. Core edits are `splitEvent` /
`mergeEvents` / `moveEvent` / `addEvent(…, index)` in systems/music.ts —
tested there, so the pointer choreography in the panel stays dumb. A
4-pixel travel threshold separates clicks from drags, and the click that
browsers fire after a drag's pointerup is deliberately swallowed.

**Shift-click** ties a note into the next of the same pitch (the arc is
drawn, crossing the barline when it must). **↻** on a bar label lays a
repeat — click the first bar, then the last; the opening bar gets a ×N
stepper and the staves get real ‖: :‖ barlines with dots. Both controls
disable themselves below their unlock level and say why. The palette locks with 🔒 and the level that opens it; the
reading card shows problems, the verdict, every measure, and the dormant
power. Measures flow left→right and wrap into systems like a real score.
The tab is currently always visible — gating it behind an instrument/quest
is an open piecemeal-unlock decision.

**Class-name warning:** the measure wrapper is `.measure`, NOT `.bar` —
app.css globally styles `.bar` as a 14px resource-bar husk that swallows
the staff whole (PITFALLS.md §8).

## What the E1M1 stress test found (2026-08-06)

The user rebuilt *At Doom's Gate* to find the walls. Four, in order of bite:

1. ~~**No chromatic notes.**~~ FIXED — accidentals (above). The riff is built
   on a ♭5; the staff physically could not say it. (The 12-tone
   `greater_harmonic` scale was a reasonable attempt at a workaround and
   cannot work: C and C♯ occupy the SAME diatonic staff step, so those lanes
   overlap and the topmost eats every click.)
2. ~~**One octave of range.**~~ FIXED — two, with ledger lines.
3. ~~**One timbre.**~~ FIXED — five voices, including a driven one.
4. **Polyphony — half answered.** The real score is two staves: melody over
   a palm-muted pedal bass. The **pedal tone** (shipped) gives you exactly
   that shape when the lower voice is static, which covers the E1M1 case.
   What remains genuinely unbuilt is a lower voice that MOVES — a second
   independent melody, with its own bars and its own rhythm.

~~Tempo~~ is now in (♩=110 is writable — and ♩=110 in sixteenths is exactly
how the published score writes it, so nothing about this piece is being
approximated). Still absent from that test: **dynamics** (the score opens *f*).

5. **It read as a Reel at 76%** — below the median random sheet. That one is
   the deepest of the four, because it was not a missing feature: the notation
   was faithful and the classifier was simply miscalibrated. See §Calibration.
   Fixed — it reads `Ostinato` at 92%, and the fixture is pinned in
   `tests/music-identity.test.ts` so it stays that way.

## Open items

- **Effect content** — the `confers` hook is live (§Effects) but no
  archetype declares one yet; what each kind of music does is the user's to
  author. Also unowned: instruments/venues, and enemy-facing mid-combat
  effects (the hook fires at performance end, on the performer).
- **Monster bards** (user, 2026-08-05): an enemy goblin playing a hymn to
  buff its allies. The seam already permits it — `readComposition` is pure
  and checks nobody's skill (the arcane-monster precedent: it didn't learn
  notation, it noticed drums help), so authored monster compositions read
  through the same classifier and **purity is the difficulty knob** (a
  clumsy warcamp march buffs at 40%; the choirmaster's anthem is a threat).
  Falls out for free: the audio module plays bare NoteEvents (you HEAR the
  enemy hymn — telegraph + comedy), interrupting the bard is the existing
  cut-short rule from the monster side, and the sheet is a natural drop —
  enemy songs as lootable compositions. Needs: effects first, then a
  MonsterAction kind for `perform`.
- **Momentum, the queue, and playing under fire** (user, 2026-08-06). The
  design, settled in conversation, not built:

  **You cannot overlap songs**, and that is the whole opportunity cost.
  `state.performance` is a single nullable slot, so it is unrepresentable
  rather than forbidden. Switching means either cancelling — which already
  pays nothing, "a set cut short teaches the fingers, never the crowd" — or
  **queueing** and riding the current piece out. Neither the queue nor any
  built-up state exists yet.

  **A piece ramps rather than landing whole**, and the opening fraction is
  INVERSE in the piece's length. That is a balance condition, not a dial:
  power already scales with length (`weightedAttacks`), so `s = D_ref / D`
  makes `P × s` constant — **every song's opening pass is worth the same,
  and length buys only the ceiling.** Length stops being power and becomes
  patience. Needs a second dial (time-to-full scaling with length too) or a
  long piece is strictly better rather than a commitment.

  **The build needs no new machinery.** Effects land as `StatusApplication`
  at an intensity; statuses already carry stacking, `escalatesTo`/`baseForm`
  and decay, and are already in `modFingerprint`. So momentum is a counter
  raising that intensity per completed pass, and the status's own drain is
  what makes cancelling cost something. Key it to **`compositionKey`, never
  `comp.id`** — see that section for the exploit.

  **Starting a performance IN COMBAT should be allowed** (today
  `startPerformance` refuses and `tickPerformance` interrupts), at the cost
  of a **start-up time that speed can only lower asymptotically** — the same
  converging-multiplicative shape attack time uses, so stacked haste
  approaches a floor it never reaches. This is what makes the whole thing a
  real decision: riding the piece out has to compete with swinging.
- **Performance setup** (instruments, venues) — nothing designed.
- **Tab gating / unlock quest** — piecemeal-unlock decision, user's call.
- **Balance**: XP constants and the archetype targets are first guesses;
  purity ~0.8 is reachable with 8 half notes, which feels right for a
  floor, but nothing is tuned against real play.
- 5/6/7/8-bar **magnify vs redirect** is binary (same/different archetype).
  A "related archetype" middle ground (march → anthem as kinship rather
  than turn) needs an archetype-relations table if ever wanted.
