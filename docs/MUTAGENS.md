# Mutagens

The crafting mirror of divine magic. Where a miracle asks *who tolerates whom*,
a chromosome asks *what sits next to what, and what reaches the centre* — and
both are read as a pattern of interactions rather than a list of parts.

> This is the internal spec: why it is shaped this way, what is settled, and
> what is still open. Nothing here is built yet. Where a number appears it is
> illustrative — the shapes are the commitments, the coefficients are not.

## 1. Where it sits

Each discipline earns its interest a different way, and the guards matter as
much as the designs:

| Discipline | Identity | Guard |
|---|---|---|
| Runecarving | **sum of its elements** | strictly additive — no pair synergies |
| Cooking | **when things are prepared** | cardinal: durations and exposure |
| Alchemy | **the order things go in** | ordinal: positions only, never durations |
| **Mutagens** | **pattern of interactions** | **topology: the player authors space, never order** |

The crafts mirror the magic schools, one identity each:

| identity | magic | crafting |
|---|---|---|
| sequence | Arcane — word order is meaning | Alchemy — the order things go in |
| when | Psionic — thresholds realise patterns | Cooking — durations and exposure |
| interaction | Divine — who tolerates whom | **Mutagens — pattern of interactions** |
| sum | — | Runecarving — strictly additive |

Runecarving has no magical counterpart because it is the additive baseline —
the craft you learn before any of the interesting identities apply.

Both MARTIAL.md §1 and the table above call *interaction* an identity. They are
scoped statements, not a contradiction: martial ranks itself among the four ways
of **fighting**, where interaction is divine's; alchemy ranks itself among the
**crafts**, where interaction is mutagens'. The pairing is deliberate.

## 2. The two laws

**Law 1 — Everything flows to the centromere.**

Effects propagate along active connections toward the main mutagen, always
inward, taking the path of **fewest hops**, and affecting every mutagen on that
path as they go. Where routes tie, the effect **splits evenly** between them —
50:50 for two, and evenly among however many tie. That halving *is* the cost of
a split; there is no separate diminishment on top of it.

### Two metrics, deliberately

Routing is **topological** — the count of edges traversed, and nothing else.
Edge length never enters the routing decision. Intensity is **geometric** — how
far the effect actually travelled. They must not be the same measure, or the
system defeats itself: routing by physical length would steer every effect away
from the long edges that make it strong.

A **3μm edge is the baseline**. Intensity is the total distance travelled over
that baseline:

```
multiplier = totalPathLength / 3
```

Summed, never multiplied. Distance is time is effect, and time accumulates by
adding — a product of per-edge ratios would put six doubled hops at ×64 instead
of ×12 and bury tier and quality under topology by orders of magnitude.

Which makes distance and hop count interchangeable contributors to one number,
but *not* interchangeable in what arrives:

> **Distance buys magnitude. Hops buy character.**

Six 3μm edges and one 18μm edge both deliver ×6. The single long edge delivers
a cold effect untouched; the six-hop route delivers it at the same strength
having been reinterpreted five times on the way. The player chooses which by
where they place things — which is Law 2 doing its work.

Edge lengths are a property of the **layout**, not something the player sets.
A socket one hop from the centre across a very long edge is premium geography,
and a layout's length distribution is a large part of what makes it a distinct
strategic shape (§3).

**Law 2 — You never write an order. You move things.**

Sequence is derived from pathing; adjacency is derived from geometry. There is
no field anywhere that says "apply cold, then crystal." If you want a different
sequence you must physically change the graph — move a gene, or cut a
connection so the shortest path runs somewhere else.

This is the guard that keeps mutagens out of alchemy's territory. Alchemy is an
authored ordinal sequence. Mutagens is a spatial arrangement that *produces* one.
Any proposed feature that lets the player specify an order directly is not a
mutagen feature.

## 3. The chromosome

Sockets, connections, and one centromere.

```
        a --- b --- c          upper cluster: 6 sockets, asymmetric,
         \         /           many hops, supports long chains
          d - e - f
           \     /
            [MAIN]             centromere: the main gene
           /     \
          /       \
         g -- h -- i           lower ring: 4 sockets, symmetric,
          \       /            long edges, frequent ties
           '- j -'
```

The centromere connects to `d` and `f` above, and to `g` and `i` below. `h` and
`j` each bridge `g` and `i`, closing the ring as a four-cycle
(`g–h–i–j–g`) with the centromere attached at opposite poles.

Four connections leave the centromere — two up, two down — and each is one
**arm**. The two clusters they lead into are shaped differently on purpose:

- **Upper cluster** — deep and asymmetric. Its currency is *how many hands an
  effect passes through*. Supports the full traversal
  `e → f → c → b → a → d → main`, which reaches the centre having been
  transformed five times.
- **Lower ring** — shallow and symmetric, and its edges should be **long**. Few
  hops across long distances is exactly §2's magnitude-without-character
  profile: an effect arrives strong and largely untransformed. That is intended
  — the ring is the diffuse half.

The ring's symmetry makes Law 1's split structural rather than incidental. `g`
and `i` sit one hop from the centre and deliver whole. `h` and `j` are two hops
from it *either way round*, so they tie permanently and split 50:50 into both
arms unless a cut breaks the symmetry. Half the ring always spreads; half of it
always concentrates, and which half a gene lands in is decided purely by
placement.

A ring of *short* edges would be weak on both counts at once (few hops, little
distance), so the baseline layout has to put its length in the ring and its hop
count in the cluster. The geometry is what encodes the assignment below.

Qualitative aspects therefore sit on the deep cluster and quantitative ones on
the ring, because many transforms change *character* while short routes deliver
*magnitude*.

**The arm → domain mapping is a property of the layout, not a global
constant.** Alternate layouts are planned; a layout that puts attacks on a deep
cluster is then a genuinely different strategic shape rather than a reskin, and
the general logic stays firm because the mapping is data.

## 4. The four arms

An arm is a **domain of the character sheet**, populated for every character
regardless of what is slotted. A gene does not invent four faces; it drops a
headline effect into a domain that already exists.

| arm | cluster | governs |
|---|---|---|
| **special** | upper | whatever this body's signature is — see below |
| **active** | upper | the gene's headline ability; `mana` `spirit` `focus` |
| **attacks** | ring | attack output (normal, styles, techniques); `stamina`; `riposte` |
| **defenses** | ring | `armor` `dodge` resistances; `hp` |

All five `ResourceId`s land in exactly one arm: `hp` → defenses, `stamina` →
attacks, `mana`/`spirit`/`focus` → active. No orphans.

`speed` sits under special despite also driving combat, and `riposte` sits under
attacks despite being triggered by a defensive action. Both were rulings, not
derivations — they cross domain boundaries and had to be assigned somewhere.

Because arms are domains rather than gene faces, **a modifier's native arm is
derivable from which stats it touches.** Crystal (light resistance at the cost
of bludgeon) is defenses. Elastic (attacks ignore dodge) is attacks. Nobody
authors a per-gene mapping.

### The elemental tripartition — one block, one axis

Every element splits into three secondary mutagens that each do exactly one
thing, so composing a body means picking axes rather than accepting bundles:

| leg | carries | routed into Active it… |
|---|---|---|
| **Edge** (Rime Edge, Searing Edge…) | the damage `type`, and re-types what passes through it | re-types the ability |
| **Brand** (Frostbite Brand, Kindling Brand…) | a condition, as `inflicts_<status>` | makes the ability leave that condition |
| **Ward** (Chill, Ember, Bedrock…) | resistance, and nothing else | nothing — it is a magnitude, and lands as a stat |

Chill used to be all three at once: cold resistance *and* a carried type *and* a
retype. "I want the cold, not the ice armour" was unsayable, which is why the
four pre-tripartition Wards were stripped back to resistance and their types
handed to the matching Edge.

`ELEMENT_LINES` in mutagens.data.ts is the table, one row per element tag, and
the eleven rows generate thirty-one blocks. Two rules for adding a row:

- **`tag` must be a monster tag something actually carries**, or the whole row
  is undroppable. All eleven are carried today.
- **A Brand names the BASE form of its condition** — `buffeted`, not `unfooted`;
  `shardbound`, not `shardbloom`. Escalation is the status system's job, so
  branding repeatedly climbs the ladder on its own and the mutagen never
  mentions it.

One row is not a clean bijection and is marked as such in the data: nature takes
`acid` for its Edge while its condition is `seeded`, which is poison-typed. And
`crystal` remains a deliberate crook — it drops from `earth` and wards *light*.

### The special arm is the only one whose contents depend on the gene

`skillXp`, `craftSpeed`, `loot`, `goldGain`, `speed` and luck are **bare's**
signature, not the arm's definition. Every other genus slots its own thing
there — usually something its physiology implies (a slime takes less from
critical hits; a slime king fields a bodyguard), though nothing forces that.

The other three arms are universal because their substrate is: everyone has hp,
stamina, resistances and a pool. Special is the leftover domain, so what it
holds is whatever this particular body is *for*. Read the table row as "the
signature slot", and treat the economy stats as one gene's answer to it.

⚠️ This narrows the §7 ceiling argument, which reasoned about special as *the*
compounding economy arm. That reasoning still holds — for bare, and for any gene
that puts economy multipliers there. It is not a statement about the arm.

### Arms may be coupled by content, never by the engine

Slime King's special fields a bodyguard, its active detonates that bodyguard,
and its attacks bonus rises while the bodyguard lives — three arms reading one
entity. The engine does **not** model that: arms resolve independently, and
routing a mutagen into one never reaches another.

That independence is the feature. It means the branches can be modified
separately, and the strategies fall out of the player's choices rather than out
of a rule: beef the bodyguard purely as suislime ammunition, ignore suislime and
keep it alive as a wall, or neglect it entirely and take the gene for its
resistances. Nothing needs to know those are strategies.

### Position in the chain does two jobs

A mutagen far from the centre is heavily **modified** — everything between it
and main rewrites what it sends. A mutagen adjacent to the centre is barely
modified but is the **last word** spoken over everything passing through. Same
gene, different role, decided entirely by where it sits.

That asymmetry is the main reason placement is the primary verb and toggling is
the secondary one.

## 5. Main genes: genus, tier, quality

A main gene belongs to a **genus** (gigantoid, draconoid, asuroid …) and sits at
a **tier** within it — troll, rock giant, hill giant, jötunn — with small
species-specific differences on top of the power step. Quality is the ordinary
F–S grade. A genus is a **tree, not a ladder**: two species at the same tier are
sidegrades, and the branches share rungs.

A genus is two numbers:

- **tier count** — baseline **4**; some genera run to six, some stop at two
- **grades per step** — baseline **2**, i.e. two quality grades equal one tier

At baseline that is three steps × two grades = **six grades of span**, exactly
the F→S range. An S-rank bottom tier and an F-rank top tier are dead level, and
tier and quality carry identical weight. Anything else is a deliberate skew:

- **Tight gap** (one grade per step) — species are near-peers and you choose
  between them on their specific differences. A **menu**.
- **Wide gap** (five grades per step, so a low S only matches a high E) —
  species are power rungs and you climb. A **ladder**.

Both are legitimate. They want to be an authoring choice per genus rather than
an accident of how many species got written.

### What tier and quality each buy

**Tier buys the ceiling. Quality buys how close you get to it.** That ceiling
applies to **all four arms**, not only to the headline ability — see §7.

An ability reads as a flat term plus a scaled term:

```
damage = flatBase(tier) + weaponDamage × coefficient(tier, quality)
```

The flat term decays into noise as gear improves; the coefficient rides gear
forever. So tier is what you feel early and quality is what you feel late —
and because tier also raises the coefficient's ceiling, high tiers stay
aspirational instead of becoming a decaying flat bonus you overpaid for.

### Uniques are a cut above their own rung

Most top-tier species are an **evolutionary stage** — every slime could in
principle become a slime king, so a slime king gene is the top of a ladder
anyone may climb. A **unique** is not that. There is one Balor and one Surtr.

Two rules follow, and both must hold in the numbers rather than in the fiction:

1. **A unique outranks its own tier.** It is not merely another species at
   tier 4; it beats the common species standing beside it.
2. **A unique is unreachable from more than one tier below**, at any quality.
   A perfect tier-2 gene must not match a raw tier-4 unique.

Rule 2 constrains `gradesPerStep`: with six quality grades, a genus whose
uniques sit at tier *n* needs `gradesPerStep > 6 / 2` for a tier *n−2* S-rank
to fall short. Gigantoid runs **4** for exactly this reason — 2 + 5/4 < 4.
Rule 1 lives in the **ceiling** rather than in `flatBase`, because the flat
term decays and the ceiling does not; a unique that led only on flat damage
would quietly stop leading once weapons got good.

The other half of the promise is acquisition: a unique should be as hard to
kill and harvest as it is good, so its capacity cost is meant to dominate a
chromosome rather than sit politely beside three mutations.

## 6. Capacity: the cost model

One pool. Everything draws on it.

**Tier cost is anchored to the bottom tier at C-rank**, then scales as a
function of the C-rank gap between successive tiers. It is keyed to measured
power, never to the ordinal tier index — otherwise a six-tier genus gets its
strongest species at a discount and every optimiser finds it immediately.

**Cost must grow faster than power as you climb.** Cut costs already compound,
so topology has diminishing returns on capacity spent. If tier cost were linear
in power it would have constant returns, constant beats diminishing at every
budget, and the optimum would pin to "highest tier you can fit, remainder into
graph" forever. Superlinear tier cost puts the optimum at an interior point that
moves with your total capacity. The exponent is tuning; that there is one is not.

**Quality: F is the cheapest, S is slightly more expensive.** Perfection at a
literal cost. This is why F-rank is a real pick rather than a consolation —
minimum-cost gene, maximum capacity left for topology — and why quality is a
trade rather than a free upgrade. Keep the S surcharge *slight*, so tier stays
the dominant capacity decision and the three costs do not muddy each other.

Which gives the player one legible rule:

> **Climb a tier for headroom, never for efficiency.** A refined low tier is
> always cheaper per point of output. You climb when you have capped quality and
> need a higher ceiling.

Cuts reserve capacity rather than spending a resource — reversible, bounded by
the pool, and compounding with the number of cuts held.

### Three commitment horizons

| layer | cost | reversible | horizon |
|---|---|---|---|
| **Cuts** | capacity, compounding | yes | moment to moment |
| **Connections** | **histones**, one-time | no | mid-term expansion |
| **Main gene** | biomass + craft time | at the same price | the run's commitment |

**A connection costs histones, priced by the micrometre** (`histoneCost` =
`HISTONE_PER_BASELINE × length / BASELINE_EDGE`). Length has to be paid for or
it is a free lunch: a 9μm ring arm delivers ×3 where a 3μm cluster edge delivers
×1, and if both were free there would never be a reason to prefer the short one.
Charging by length is what makes the premium geography genuinely premium.

Histones are a **recipe**, not a discipline — `RECIPES.histone`, spooled at the
basement, with `alts` so whatever you happen to be farming has a route to them.
That is deliberate: every discipline owns an identity, and inventing a fifth for
a bulk conversion with no interesting decision in it would muddy the table for
nothing. It is meant to be a grind, and that grind is the brake on how fast a
chromosome can grow.

Cuts being capacity-reserved rather than resource-spent is load-bearing: it is
the cheap frequent interaction that keeps a player in the panel between the
expensive ones. Without it, three layers of friction means nobody opens the
chromosome twice.

## 7. Capabilities are free; magnitudes are capped

The most important rule in the system for what it feels like to play.

- **Capabilities** — a bouncy rock throw, cold damage, a breath that inflicts
  `tainted`, an asuroid arm that lets a shield ride alongside a two-hander.
  A cheap gene should reach **every** trick. Sometimes the delivery mechanism
  *is* the build, and a shield at half stats that satisfies a shield-requiring
  technique next to a two-hand-requiring one is worth more than a bigger number.
- **Magnitudes** — capped by tier and quality, through the §5 ceiling.

The cap has to include the **special arm's economy multipliers specifically**.
Attacks and defenses self-limit, because multiplying a small base still gives a
small number. `skillXp` and `craftSpeed` do not care what the gene's base power
is, so without a ceiling the optimal build is a bottom-tier F-rank gene bought
for minimum capacity with everything poured into special. That would be found
on day one.

A cheap gene sculpted into a bouncy cold rock throw that applies `tainted`, at
unimpressive numbers, is **not** that exploit — it is the utility archetype, and
it is the most interesting thing the system offers.

### GAIN IS CAPPED TOO, and once was not

A transform's `mult` used to multiply `effect.mods` directly, inside
`applyTransform`. That put every multiplier **outside** the ceiling this section
promises: the clamp measured distance travelled, and a route's multipliers were
applied to the modifier values afterwards where nothing could see them.

Harmless while the only two were Elastic's ×1.15 and Fleet's ×1.10. The moment
amplifiers exist it is the only build worth playing — a chain of them multiplies
without bound, and no gene's ceiling ever hears about it.

So a contribution now carries three separate numbers:

| | what it is | set by |
|---|---|---|
| `intensity` | distance ÷ `BASELINE_EDGE` | geometry alone |
| `gain` | conduits passed through × catalysts feeding the origin | amplifiers |
| `magnitude` | `intensity × gain` | **what the ceiling is measured against** |

`contributionWeight` clamps `magnitude`, so amplifiers buy a way to **reach**
the ceiling from a cramped graph — which is genuinely valuable when the starting
kit is two edges — and never a way past it. That is the shape every future
multiplier has to take.

### Nucleases: changing WHAT, never how much

Every other thing on this graph moves a number — an effect contributes one, a
transform scales one, an amplifier multiplies one. A **nuclease** rewrites a
KEY and leaves every magnitude exactly where it was, which is what finally
gives the arms that are otherwise magnitude sinks something qualitative to
route. `MutagenDef.rekey`.

Three rules, all load-bearing:

- **Gradeless.** Grade scales magnitude and a nuclease has none, so a graded one
  would cost more capacity for nothing — the trap mutagen quality itself was in
  (§9).
- **The NUCLEASE is the product.** The mutation fused into it is spent purely
  for its elemental tag, and everything else it did is lost — so **any** poison
  mutagen makes the same *Poison Vulnerability*, whether it was the Venom Edge,
  the Miasma Brand or the poison Ward. A fused mutagen therefore carries a
  `rekey` and **nothing else**: no effect, no transform. "Changes what, never
  how much" has to be true of the whole product, not only of the part bolted on.
- **Fused mutagens are generated, not authored** — `NUCLEASES × ELEMENTS`, keyed
  on the element rather than on the parent, because three parents meaning
  "poison" must not become three different tools. Mutagens are stacks
  (`state.stock[id][quality]`, no room for per-instance data), so a fused one
  must be its own material id; it rides the same door genes and mutagens come
  through. It never drops (`mutagensFrom` filters it out) — otherwise the bench
  is optional — and is produced at grade **C**, since a rekey has no magnitude
  for a grade to scale. The honest thing to fuse is your worst spare.

A mutation "carries an element" whichever leg of the tripartition it is — an
Edge names the type, a Ward resists it, a Brand leaves its condition. All three
pair (`elementOf`), which is what "any cold mutation, not just resistance ones"
means.

**Vulnerability is the built one.** A body's weak points are, in order: the
negative `res*` mods in its `base`, then the dousing types on anything it
`confers`. Rekeying routes are taken NEAREST FIRST — by hops, the distance
routing already minimises, so no new ordering concept enters the system — and
matched one-to-one against that list. Surplus routes do nothing; a body with no
weak points is rewritten not at all.

⚠️ `rekeyGene` deep-copies. The def is shared content, and rewriting it in place
would rekey the species for every save in the process — a bug that only shows up
on the second character.

### Amplifiers: two of them, pointing opposite directions

- **Conduit** (`transform.mult`, e.g. Resonant Mutation) multiplies whatever
  passes THROUGH it and contributes nothing of its own. It wants to sit between
  a strong mutagen and the centromere.
- **Catalyst** (`MutagenDef.amplify`, e.g. Catalytic Mutation) multiplies the
  output of whatever its own route runs INTO. It wants to sit one step further
  out than the thing it is helping, and a catalyst pointed straight at the
  centromere helps nobody.

`amplify` is deliberately neither `effect` nor `transform`: an effect is what a
socket sends, a transform is what passing through it does to somebody else's
effect, and this is a third thing — what a socket does to its neighbour's
output. Resolved outermost-first in `amplification()`, which is both why
amplifiers compound through each other and why it terminates. Ties divide the
surplus, like every other magnitude here.

### 7a. The governing law: persistence is what makes the power safe

> **A mutagen may change what you are. It may never change which answer you
> pick.**

This is the constraint every capability, every arm semantic and every routed
effect is measured against, and it exists because of a specific contrast.

Both pillars of rule-alteration bend the game's own rules — divine miracles do
it from the magic side, mutagens from the craft side. They differ in **how many
you hold and when you choose**. Miracles are abundant and simultaneous: you
carry a shelf of them and pick the one the moment calls for. A chromosome holds
one body, and you are in it until you pay biomatter and a settling period to be
in a different one.

The temptation is to read persistence as the drawback that pays for the power.
It is the opposite: **persistence is the governor.** A miracle can afford to be
situational precisely because it is one of many. A mutagen cannot be situational
at all, so whatever it does is as true in the fight it is wrong for as in the
fight it is right for. That is what lets a gene be enormously strong without
being an exploit.

So the exploit vector in this pillar is **not power — it is conditionality.**

**Never build**, at any magnitude:

- Conditionality on a routed effect — a `requiresTag`-style "cold against fire
  monsters" is the exploit in its purest form. It is a shelf of miracles wearing
  a chromosome's clothes.
- Anything reactive, or keyed to the enemy's properties rather than your own.
- Two simultaneous typed outputs from one arm. That is conditionality with extra
  steps: hold both and you always have the right one, and the cost vanishes.

**Fine, however strong**, because you carry it into the fights it loses:

- `onehand:*`, `arms:+4` — a two-hander with a tower shield *should* be
  frightening. Gaming the system is the intended reward for committing to a body.
- `ignores_dodge` deleting an entire defensive stat from your game.
- Re-typing your damage, **replacing** rather than adding. Replacement is the
  version with a cost: you become genuinely worse against what resists the new
  type, permanently, with no opt-out. Additive re-typing widens your coverage of
  the resistance table for free and would be taken every time.

Note that "replaces, never adds" arrives from two independent directions — it is
what reinterpretation *means* (an effect passes through a mutagen and is
rewritten, not accompanied), and it is the only version that costs anything.
When an identity argument and a balance argument converge, take the answer.

#### Capabilities are free of cost, not free of scrutiny

The §7 cap governs **magnitude**. Nothing caps **kind**, and kind is exactly what
the four arms deliver — so each new capability owes one question at authoring
time that magnitudes never do:

> **Does this compound — with itself, or with another capability?**

`ignores_dodge` does not: dodge is either bypassed or it is not, and two sources
granting it set the same flag twice. `arms:+N` compounds by design and is
bounded by content. Anything whose second copy is worth as much as its first
needs its own bound written down, because the ceiling will not supply one.

This belongs in the forge's validation rather than in review.

#### The wield capabilities, and where they live

Three grants are read by `systems/wield.ts` rather than by anything in this
document, and they are **orthogonal on purpose** — each answers a different
question about a grip:

| Grant | Question | Answer |
| --- | --- | --- |
| `arms:+N` | how many grips? | the usual two, plus N |
| `onehand:<tag>` | what can one grip close around? | two-handers of that family |
| `telekinetic:N` | are they hands? | the last N are not |

They live in wield.ts and not here because **nothing downstream may learn where
a capability came from**. A fighting style that lifts a blade with the mind
grants `telekinetic:1` and gets exactly what Vashkāra gets, one grip's worth.
That is the same rule that lets a gigantoid's `onehand:*` and an asura's
`arms:+4` combine into six greatswords without either knowing about the other.

`telekinetic:N` counts **against** `arms`, not on top of it, and floats the
LAST grips — so one point on an ordinary body floats the off hand and leaves
the main hand swinging, which is the reading a player would guess. Its
consequences all fall out of `handSwingShare`:

- Weapons in floating grips fight on a clock of their own (`CombatState.floating`,
  one clock shared by all of them) and your action bar no longer swings them.
- Your damage is **split** between the two clocks and never paid twice.
- A body with **no** hands does not punch. "No unarmed attacks" is not a rule
  about one gene; it is what having no hands means, so anything else that takes
  the hands away inherits it.
- A bar that fills with nothing legal on it is **held**, not wasted, and says
  so in the feed. That is a real cost, and it is the player's to avoid.

It does compound with itself, and its bound is `arms` — you cannot float more
grips than you have, which is the bound the question above asks for.

### 7b. Abilities: the other half

A **special effect** alters how your body already works; an **ability** hands
you a new active tool. Both come off the main gene, and the split is the point —
a gene that only changed numbers would be an equipment slot with extra steps.

An ability is an ordinary `ActiveSpec`, so it swings on the action bar, sits in
the rotation, honours triggers and takes a cooldown like anything else. Genes
mostly use a **fourth variant**, `type: 'gene'`, which exists because the other
three cannot say the thing every gene ability says: **it reads an arbitrary
stat**. `strike` multiplies weapon damage and `spell` multiplies spell power;
neither can point at armour or at heat resistance. A slime bounce landing for
its *armour* is what turns a defensive build into an offensive plan rather than
merely a survivable one, and that reading is the whole identity.

Reading an arbitrary stat is not enough on its own, though — **how** it reads
one has to depend on what kind of stat it is, or the identity quietly dies at a
cap. See below.

#### How the blow is priced — and the trap that made this two shapes

    (flat + power × fromStat) × speed × (1 + amplifiedBy)

One formula in `priceGeneAbility`, read by combat AND by every readout, so the
card can never advertise a number the fight does not deal. Each ability uses the
terms it needs:

| body | reads |
| --- | --- |
| giants | `flat + power × damage` |
| basic slimes | `(flat + armor) × speed` |
| elemental slimes | `flat × speed × (1 + resistance)` |

**Never price a BOUNDED stat per point.** `power × fromStat` is right for
Damage, Armour and Max HP, which climb forever. A resistance does not: it runs
0…`resistCap` and has **no attribute behind it**, so the flaming bounce's
`power: 90, fromStat: 'resHeat'` produced a blow worth almost nothing early,
worth its ceiling the moment the cap was reached, and worth exactly that for the
rest of the game — which is what *"9000% of your Heat Res. (0.75)"* was saying
out loud on the card.

`amplifiedBy` is the shape a bounded stat wants: `× (1 + stat)`, so the cap
reads ×1.75, and a **negative** resistance legitimately takes damage off rather
than being clamped away. It is floored at zero only, so a body deep underwater
on a resistance loses the blow entirely and never heals what it hits.

Something must still grow after the cap pins, which is what `scalesWithSpeed`
is for: `× speed ÷ BASE_SPEED`, ×1 on an ordinary body. A bounce is a body
thrown at somebody, so how fast it moves is how hard it lands — and unlike a
resistance, speed has an attribute behind it.

The fields, and the content that demanded each:

| field | says | first asked for by |
| --- | --- | --- |
| `power` × `fromStat` | per-point pricing off an **unbounded** stat | slime bounce (armour) |
| `amplifiedBy` | `× (1 + stat)`, for a **bounded** one | flaming bounce (heat resistance) |
| `scalesWithSpeed` | `× speed ÷ BASE_SPEED` — the term that keeps growing | the bounce family |
| `flat` | the **species'** contribution, before any multiplier | the giant throws |
| `riders` | typed damage alongside, resisted separately | mountain crusher |
| `inflicts` | conditions left on everything it reached | troll bite |
| `stun` | ticks off the target's bar — not a condition, so nothing resists it | slime bounce |
| `selfDelay` | ticks off **your own** bar; a heavy body's wind-up | slime crash |
| `splash` / `splashAll` | carries past its target / is thrown at the room | slime crash / ragnarök |
| `sizeDouble` | doubles per N size steps — multiplicative where `vsSmaller` is linear | mountain throw |
| `execute` | finishes anything under a share of the blow that just landed | eye of balor, ragnarök |

`execute` measures against **the blow**, not against level, so it scales with
the build instead of expiring the moment you out-level the threshold.

#### Not every ability is a blow — and the readouts have to be told

Three shapes land nothing at the moment they are used, and each of them broke a
readout that had quietly assumed the formula above always applies:

| field | says | first asked for by |
| --- | --- | --- |
| `incant` | **begins** rather than lands; the blow falls later, certain to crit | Nirākṣa |
| `volley` | points; the floating grips strike on their own clock | Vashkāra |
| `clearsField` | the blow IS the erasure, worth what there was to erase | Kritavya |

Two functions carry the consequences, and **a new shape owes an answer to both**:

- **`pricesABlow(spec)`** — is there a number worth quoting? A price with no
  terms in it is not a blow worth nothing, it is an ability that does not work
  that way, and `0 bludgeoning damage` is the one thing a card must not say
  about it. A deliberate `flat: 0` (Kritavya's ward) IS a blow and stays true.
- **`abilityCarries(spec)`** — what may the **Active arm** hand it? A volley
  reads no type, no split, no condition and no unmissable flag, because nothing
  ever consults its spec; a wind-up reads the type and the conditions that land
  with it, and neither the splash nor a to-hit roll it was carried past.

`applyActiveArm` declines the writes rather than making them and hoping, exactly
as it already declines them for a plain `buff`. That is not tidiness: a
capability written onto a spec nothing reads is then reported by the card,
chipped live in the panel, and listed as a rewrite. §11 asks for a system a
player can see well enough to game — and a legible lie is worse than silence.

A gene ability may also be a plain `buff` (slime shield), in which case it fires
off the buff slot and costs no swing. Buffs used to look their owner up in
`SKILLS`; a gene is not a skill, so name, icon and credited tags come off the
ability itself.

Two things a body could want and cannot yet say: a **stacking** ability whose
each use widens the next (eye of balor's seven stacks), and a **summoned
entity** to attack, guard and be detonated (suislime). Both are noted where the
content sits rather than approximated.

## 8. The bare mutagen

"Normal" is a gene you manufacture, not an empty socket. There is no unequipped
state and no free undo: reverting costs the same biomass and time as
transforming, which is what makes being a monster a commitment.

- **No tier and no quality**, at least for now. A fixed reference point. It is
  *held* at `c` — the neutral anchor, so every quality-keyed curve reads it
  without a special case — but it is flagged `gradeless` and the player is never
  shown a grade for it. There is nothing to refine.
- **It is the DEFAULT, not an item.** An empty centromere expresses bare
  (`expressedMain`); there is no `bare` material to manufacture or hold. Three
  things follow: effects routed at an unfilled centromere land on a baseline
  body instead of evaporating — which is what makes leaving a slot open on a
  split chromosome a *choice* rather than a hole; spending your last biomatter
  in a body you regret cannot strand you in it; and the floor costs no capacity.
- **It is where prestige lands.** Raising or rewriting the bare sequence
  improves every build that ever falls back to it, including the unused half of
  a split chromosome — a permanent, universal gain with an obvious home.

> ⚠️ This costs one property the earlier design leaned on. Bare being scarce was
> what made reverting expensive: "being a monster is a commitment because
> stopping is one." With a free floor, that cost lives on the **swap** instead —
> see below. Same intent, no softlock.

### What a swap costs

Two costs doing two different jobs:

- **Biomatter**, scaled by what you are putting on (`swapBiomatterCost` =
  `mainCost × SWAP_BIOMATTER_PER_CAPACITY`). Writing yourself into a jötunn is a
  bigger job than into a slime, so it prices itself.
- **A settling period** (`SWAP_SETTLE_TICKS`), during which nothing about the
  centromere can be touched. This is what makes the change *deliberate* rather
  than merely expensive.

Reverting to bare costs **no material** — you are not manufacturing anything —
but it still has to settle. That is the piece that carries the old intent: a bad
body cannot be shrugged off mid-fight and put back afterwards.

The timer lives in `state.useCooldowns` under `SWAP_COOLDOWN_KEY`, which already
existed, so none of this needed a save change.
- It writes **attributes** (`str` `dex` `con` `int` `wis` `cha`) rather than
  derived stats — a minor buff across all six.

That last point is the whole design. Attributes feed base formulas across
several domains, so writing to them *spills*: a `dex` buff reaches dodge, which
lives in another arm. For every other gene that leak would be a bug. For bare it
is the mechanic.

> **A gene's write-channel is its strategic class.** Attributes → broad, spills
> across domains, generalist. Derived stats → lands precisely in one arm,
> specialist.

Which also opens a middle: a monster gene writing mostly attributes with one
derived-stat spike is a semi-generalist, with no new machinery.

Bare self-limits without needing a penalty. Having no headline ability, its
active arm holds only the resource pools — so it is structurally shut out of the
qualitative game and cannot be sculpted into a trickster build.

⚠️ **This is the one sanctioned exception to DICTIONARY.md §1's "styles may NOT
target attributes."** Mutagens own that channel deliberately: your body *is*
your attributes, so the system about rebuilding your body is the only one that
writes them. Recorded here so it reads as a decision rather than an
inconsistency.

## 9. Acquisition and refinement

> ⚠️ **ALPHA.** Mutagens currently start **open**, with the starting kit already
> granted (`freshMutagenState`). The gate below is fully wired — `unlocked`
> still gates every drop and every refinement, `unlockMutagens` still grants
> exactly the kit, and LocationPanel still hides the bench while it is false —
> but nothing closes it yet. Flipping that one default to `false` is the whole
> of what the unlock quest needs. It is open now because the architecture is
> what is being built, not the exploration around it.

Mutagens unlock through a quest. After that, **every monster has a low chance to
drop mutagen elements**, with the rate scaled by the skill — working name
**Geneshaping**, gating the `mutagens` discipline. (Ids may differ; nothing
stops a `mutagens` bench running on a `geneshaping` skill, and the craft and the
craftsmanship deserve separate names here.)

Rates follow hunting's model at slightly lower odds — `bestiary`'s
`{ k: 20, c: 2 }` is the reference point.

### What a mutagen's GRADE buys — it used to buy nothing

A main gene splits its power in two: tier buys the ceiling, quality buys how
close you get to it. **A mutagen has no tier, so quality is its whole power
axis** and it rides the same `QUALITY_APPROACH` curve — F works at 50%, S at
100%, and nothing is ever negative because §9 says F is weak and never harmful.

This was a real hole rather than a missing feature. `walk` never read
`held.quality`, so a mutagen's grade changed nothing at all — while
`QUALITY_COST` charged *more capacity* for a better one. F was therefore
strictly optimal, refining a mutagen was a self-inflicted wound, and the entire
refinement half of this section was a trap dressed as progression.

Grade scales **magnitudes only**, in exactly two places:

- the effect a socket SENDS (`scaleEffect`, at its own grade), and
- the surplus of a transform or amplifier — a ×1.5 conduit is ×1.25 at F
  (`transformGain`, at the *transforming* socket's grade).

`grants` are untouched, because §7 says a capability reads the same off a cheap
thing as an expensive one. A bottom-grade Brand still brands.

### Two drop keys, two collection axes

| drops | keyed on | already exists as |
|---|---|---|
| **genes** | monster **def id** | the same key `bestiary` novelty uses |
| **mutations** | monster **tags** | `requiresMonsterTag`'s vocabulary |

A flaming rat and a flaming ogre share a tag, not a species, so both drop the
same flaming mutation. The consequence is deliberate: **most mutations are
findable off a handful of species, but the gene collection needs the whole
bestiary.** Mutations arrive fast and early; genes are the exhaustive long tail,
which is why *Mutation Documenter* sits at 20 and *Life Transmuter* at 60.

This makes geneshaping permanently **downstream of hunting**, and gives hunting
a late-game purpose it would otherwise lose. A novel species pays into both
books at once — not a double-dip, the same event being genuinely new to two
different collections.

**Exploration is the tier axis. Grinding is the quality axis.** They do not
substitute for each other, which is precisely why both stay live for the whole
game. A jötunn gene has exactly one source — a jötunn — so "needs the full
bestiary" is literally true rather than true at the genus level. What the bench
offers is the other dimension entirely: luck into an S-rank hill giant on a
drop, or grind refinement until you have one.

That split yields two honest player profiles instead of one ladder. Deep farming
with shallow exploration gives **high-quality low-tier** genes: cheap in
capacity, richly sculptable, the §6 topology build. Deep exploration with
shallow farming gives **low-quality high-tier** genes: expensive, blunt, and
carrying a ceiling nothing has yet been refined toward. §6's *climb a tier for
headroom, never for efficiency* therefore means something concrete — climbing is
an expedition, not a purchase.

Provisional `tierNames`, on the craft ladder's usual 1/20/40/60. Each names an
activity, so the mechanical unlocks should hang off the same levels via
`milestones` — then the ladder reads as a roadmap rather than as flavour:

| level | name | unlocks |
|---|---|---|
| 1 | Biomatter Harvester | biomass drop rate — acquisition |
| 20 | Mutation Documenter | the catalogue / novelty domain |
| 40 | Master Geneshaper | refinement, quality raising |
| 60 | Life Transmuter | tier raising, genus work |

Names are not final. Tier 3 follows smithing's `Apprentice / Journeyman / Master
Smith / Forge Sage` shape deliberately — 60 escapes the ladder rather than
continuing it — but tier 1 currently reaches for the clinical register
(poison resistance's lane) where most tier 1s are humble, and tier 4 is a job
title where the house style puts something evocative.

Refinement is the bench: gene farming and mutation farming on top of biomass
farming, plus time. **Nothing about a mutagen rises passively** — there is no
level on one, only its tier and its grade.

**Tier is fixed at the drop and can never be raised.** It is a property of the
species that carried it: a hill giant drops a hill-giant gene, and no quantity
of bench work turns it into a jötunn. **Quality is the only thing refinement
moves** — and it is equally something you can luck into on the drop itself.

### Where the skill's XP comes from

Two flat channels and two escalating ones:

| source | shape | channel |
|---|---|---|
| biomatter acquired | linear | plain `grantSkillXp` |
| mutagens created | linear | plain `grantSkillXp` |
| main gene discovered | slow exponential | `grantDiscoveryXp` with a growing weight |
| secondary mutation discovered | slower exponential | same, flatter |

⚠️ **Biomatter must not go through the novelty domain.** NOVELTY_DOMAINS.md's
rule is that the key must be the thing that *recurs*; a single material pins `n`
high within minutes and leaves the multiplier stuck at its floor forever. It is
an ordinary grant. Mutagen *creation* could legitimately be novelty-keyed on
gene id if breadth pressure is wanted — flat is the right call only while
refinement is meant to be the grind.

⚠️ **Put the exponential in the payout, not in the curve — never both.**
`PROGRESSIONS.insightful` (hunting's curve) already implements "rarer inputs
teach more" on the cost side, easing its compounding rate from `slow` to `fast`
at level 25. Escalating discovery weights on top of that curve makes late levels
nearly free. Pair growing payouts with a curve that never eases — `esoteric`, or
a bespoke band list — because an escalating discovery number is *visible* to the
player where a bending cost curve is not, and invisible compounding does not
reward the behaviour it is meant to encourage.

Because quality is the axis a player advances most often, **refinement is the
loop that matters more than acquisition**, and its curve is the single most
important set of numbers in the system.

### F is weak, never harmful

A deliberate divergence from the discipline rule that F "genuinely bites" with a
negative multiplier. The target for an F-rank gene is *"this is lame, but I want
the mechanics"* — never *"this sucks and I'm stuck with it."*

The principle generalises: **F's harshness should scale inversely with the
input's scarcity.** You can throw away a bad carrot. You cannot throw away a
rare monster drop.

F still pays, just not in damage — at C-rank-anchored costs, a sub-C gene is
capacity-*inefficient*. It works fine and wastes budget you would rather have
spent on the graph.

## 10. The martial seam

Techniques may be gated on a gene: rock-throw techniques for gigantoid, breath
techniques for draconoid, multi-arm attacks for asuroid.

The gate is **one new `UnlockCondition` variant** and it is simple, because base
abilities exist unaided. The condition asks only *"is a draconoid gene
slotted"* — never anything about routes or active connections. Topology
modifies the breath; it never gates the technique that uses it. The martial
system needs no graph awareness at all.

For the attacks arm's qualitative effects, **reuse `RuneTechniqueMod`**
(DICTIONARY.md §12) rather than building a parallel modifier system. `exitTo`
and `grantsFork` are the interesting ones: an asuroid arm opening a fork out of
a two-handed technique into a shield position is new geography in the position
graph, which is exactly what a body-shaped change should look like. It also
inherits the martial planner's existing position-graph visualisation, which
helps with §11.

Reps bank rather than burn, and loadouts apply grant-free when a requirement is
no longer met — so swapping genus makes gene-gated techniques **dormant, not
lost**, and they wake intact on return. That is what makes drilling one safe
enough to be worth doing. Confirm it holds for a gene condition specifically.

## 11. Legibility is a mechanic, not polish

The design goal is that players **learn the system well enough to game it**.
That is only possible if the panel shows its work.

A lot is hidden here: shortest-path routing, tie splits, per-hop transforms in
order, tier and quality coefficients, compounding cut costs. If the interface
shows a graph and a final number, nobody games anything — they copy a layout
from a wiki.

The chromosome panel must show **resolved routes** and **what each hop did to
what passed through it**, so a player can reason: *"if I cut here, that gene
stops reaching my active arm and my breath loses the cold."* Cuts have global
consequences — cutting `f–main` reroutes `f` as well as `e` — so lit edges alone
are not enough; the resolved paths are the thing to draw.

This is the easiest item on this list to under-build, because the maths works
fine without it.

### What the panel owes the player, concretely

The list below is the standard, and every line of it is met today. It is written
down because each one was missing at some point and none of them announced its
absence — the panel looked finished the whole time.

1. **The outcome, not just the route.** Every arm names the modifiers routing
   delivered into it, and every route names its own share of them. See §12: this
   supersedes an earlier ruling that said to wait.
2. **One vocabulary between the words and the picture.** Routes are written
   `b → a → d → ◉`, so a filled socket keeps its letter on the diagram — it used
   to trade the letter for the mutagen's icon, and the moment the graph was worth
   reading, no route could be traced by eye.
3. **Where an effect lands, on the diagram.** The centromere has four doors and
   the edge you arrive on picks the arm; the doors are drawn and labelled.
4. **Conversion rates resolved.** A `fromStat` modifier is a rate, not a bonus.
   The card states the rate *and* what it comes to against the current sheet, so
   a troll's "+50% Damage × Bludgeoning Res." cannot read as a flat +50%.
5. **Inert things marked inert.** §12's three unwired parts print as arriving
   and unread. Never silently, never as if they worked.
6. **The ability's real numbers, and its real reach.** What the tool lands for
   right now, what it is priced off, and that the Active arm does not touch it.

## 12. Open

Genuinely undecided, as opposed to unbuilt.

- **⚠️ What an arriving effect MEANS per arm — the biggest open question in the
  system, and three parts of it are wired to nothing today.** §7a settles the
  law that answers must satisfy; it does not settle the answers.

  **ADOPTED FOR THE ACTIVE ARM, 2026-08-07.** The proposal below was taken up
  for one arm and one arm only, which is what §12.3 needed and no more:

  > **`type` re-types, `grants` add behaviour, `mods` add magnitude**, with each
  > arm owning exactly one typed thing — attacks → your weapon damage, active →
  > the gene ability's damage type, defenses → resistance to that type, special
  > → nothing typed lives here.

  In the Active arm, `applyActiveArm` now folds the resolution into the ability:
  the heaviest arriving type REPLACES `damageType`, `ignores_dodge` sets `sure`,
  `splits_target` sets `splashAll`, and `inflicts_<statusId>` appends to the
  ability's `inflicts`. Replacement rather than addition is §7a's ruling, not a
  convenience: additive re-typing widens your resistance coverage for free,
  replacement costs you against the new type permanently and with no opt-out.
  Conditions name the BASE form so stacking escalates on its own.

  `geneAbility(state)` returns the RESOLVED ability and is the single seam every
  consumer goes through — combat's `pickActive`, the rotation card, the panel.
  `geneAbilityBase` is the unmodified species, for "the gene says X, the graph
  made it Y" and for the hot path that only asks whether an ability exists.

  **Routed `mods` are deliberately NOT read there.** They land as ordinary stats
  as they always have, and an ability priced off a stat already feels them —
  paying twice is the one thing §7a's ceiling argument cannot absorb.

  What is still inert, in the code, right now:

  1. **`MutagenEffect.type` reaches nothing OUTSIDE the Active arm.** In attacks
     and defenses the retype chain is still computed, printed and discarded, so
     "does a cold mutation routed into Defenses do anything?" answers **no**.
     The proposal's other three rows are not adopted.
  2. **`ignores_dodge` and `splits_target` are read only in Active.** Their
     natural home is Attacks, and Attacks does not read them. `grantIsLive`
     takes an arm for exactly this reason, and the panel says which is which.

  Do not wire the remaining rows piecemeal. Each one is a balance surface, and
  the reason Active went first is that its hole was structural — the arm named
  after an ability did everything except touch one.

  **The panel now reports routed outcomes, and this section's earlier ruling
  against that is withdrawn.** It said: do not widen the panel until the three
  above are settled, because stating an outcome confidently while a third of it
  is inert would only make the panel lie more legibly. The objection was sound
  and the conclusion was not — silence is the larger lie. An arm card showing a
  weight and no outcome does not read as "part of this is unwired", it reads as
  "the mutation you spent capacity on did something you are not clever enough to
  work out", and §11 exists precisely so a player is never in that position.

  What was built instead is the honest version, and the shape is the point if
  any of this is ever wired:

  - Every arm card carries a **Delivers** line: the modifiers routing actually
    put there, summed the way `computeDerivedStats` sums them (flats add,
    multipliers compound), plus the same figure per route. It comes off
    `armDelivery` → `deliveredBy`, and `chromosomeMods` builds the character's
    stats out of the *same* function — the readout cannot drift from the sheet
    because there is only one of it. `tests/mutagens.test.ts` compares them
    modifier for modifier.
  - The inert third is **named as inert** rather than omitted or asserted. An
    arriving damage type and a `splits_target` print under *"also arriving …
    carried faithfully, read by nothing yet"*, and `INERT_GRANTS` in
    `systems/mutagens.ts` is the single fact both the panel and
    `format.ts:describeGrant` read. Wiring one up is a deletion from that set.
  - §12.3 is stated where it bites: the ability card says the tool is priced off
    a stat, that anything raising the stat sharpens it, and that what you route
    into **Active** lands as stats and never reaches the ability. That is the
    trap the arm's name sets, and the player should hit it before spending the
    capacity rather than after.

  When one of the three is wired, the corresponding "read by nothing yet" line
  is what changes — so the panel is already shaped for the answer.

- **Skill and tier names.** *Geneshaping* is the working name and §9 has a
  provisional ladder; neither is committed.
- **The catalogue.** §13's novelty-domain question is now leaning yes — a tier
  named *Mutation Documenter* implies secondary-mutagen combinations pay
  discovery. What is open is whether the key is the combination, the gene, or
  the resolved path, and the `arcana` precedent's `sourceKey` gap applies either
  way.
- **Tier ratio ↔ maximum chain multiplier.** One decision in two places: if a
  fully-sculpted graph cannot span the gap between a genus's bottom and top
  tier, the low-tier build has no live branch. Do not tune them independently.
- **Whether topology's span is competitive** — now *partly* answered. Tier,
  quality and topology are three axes, and if the best possible chain spanned
  only ×1.4 against tier's and quality's six grades, the centrepiece system
  would be the least impactful thing in the build and players would optimise
  gene acquisition and ignore the chromosome. Under §2's summed-distance rule a
  full upper traversal at baseline is ×6, which lands in the same league rather
  than dwarfing or being dwarfed. What remains open is the **length
  distribution per layout** — long edges push that ceiling up multiplicatively
  against nothing, and a layout full of 9μm edges would break the parity the
  baseline achieves.
- **Whether `RuneTechniqueMod` can be applied from a non-rune source**, or needs
  its application path generalising first.
- **Alternate layouts** — planned, unspecified. The arm → domain mapping travels
  with the layout (§3).
- **Splash behaviour on the ring.** Ties are the norm there, so the even split
  fires constantly. Decide whether that is the ring's character or wants a
  tiebreaker.
- **Species-specific differences.** At least one per tier step should be a
  genuine downside — the troll's fire vulnerability — or a tier-up is something
  you queue rather than something you weigh.
- **Whether the capacity curve can afford its own top tiers.** Cost is
  `flatBase` ratio to the power of `TIER_COST_EXPONENT`, and a genus whose top
  species is 16× its bottom therefore costs ~40× the bottom's capacity. At
  `CAPACITY_BASE` 20 + 1.5/level that is a Geneshaping level in the hundreds.
  Either the curve is meant to be that aspirational, or the exponent wants
  revisiting — but it is a whole-system decision, not a per-genus one, and it
  already applies to the slime king as much as to Surtr.
- **Item tags written ahead of their items.** `stone` and `bone` weapons and the
  `tower shield` are named by gigantoid modifiers and carried by nothing yet, so
  those modifiers are silently inert until the wave adds them. There is no
  `hammer` tag either — the jötunn's one-handed hammers currently read `blunt`,
  which is broader than intended.

## 13. Framework changes this will need

Not yet surveyed in detail; listed so the shape is visible.

- A chromosome layout as **data** — sockets, edges, and the arm → domain map.
- Graph resolution: shortest-path-to-centre with tie splitting, and the per-hop
  transform pipeline.
- A capacity pool with compounding cut reservations.
- `UnlockCondition` variant for a slotted gene (§10).
- An **extensible equipment slot model**, so an asuroid arm adds a slot rather
  than being special-cased. Pay this cost once and every subsequent
  extra-arm-class effect drops to data, the way bouncy and cold already are.
  Rule-alteration is this pillar's identity, so it should not be rationed.
- A novelty domain, if secondary-mutagen combinations should pay discovery —
  the `arcana` precedent applies, including its `sourceKey` widening gap.
