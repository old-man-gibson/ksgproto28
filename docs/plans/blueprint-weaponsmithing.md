---
id: blueprint-weaponsmithing
title: Modular smithing — the proportions name the product, counts tune it
kind: epic
status: execution
system: crafting
parent:
save:
updated: 2026-10-23
invariants:
  - completability
  - modFingerprint
  - drops-stay-unique
  - two-validation-layers
  - no-arbitrage
  - monster-parity
done:
  - The resolution function is TOTAL — every placement resolves to a class, degenerate ones included, and a lint enumerates it
  - Discovery replaces unlocks; the form chart fills in from forged:<class> counters
  - Recipe lines carry placements and derive their cost; John never opens the anvil
  - The anvil always forges an instance that keeps its quality roll; only recipe lines mint the static items
  - A forged item's value reads its parts only; sockets, finishes and souls add nothing
  - Finishing is counted, order-insensitive, antagonistic and paid from temper
  - Monsters carry finish counts (slice 2) and weapons (slice 3) through the same pure functions
  - Souls come only from items that cannot be forged
  - npm run verify green after every slice
---

# Modular smithing

**Freeze lifted for smithing by the user, 2026-10-23.** The alpha-band-one
freeze still holds for everything else.

Review artifact (verdict, objections, seven interactive mockups):
https://claude.ai/artifact/RpS8B6cciAH4jdmRvpuVve

Two crafting identities, neither read by any other system:

| Layer | Identity | What the player decides |
|---|---|---|
| Assembly | **proportion** — the parts' sizes name the item | which part kinds, which sizes, which materials |
| Finishing | **count** — how many times each verb was applied, in any order | where on four opposed axes to spend a temper budget |

Runecarving adds elements (sum), cooking reads time (when), alchemy reads
order (sequence), mutagens read a graph (topology), music reads a composition
(analysis). None reads a shape or a tally.

## The user's rulings (2026-10-23)

1. **Notation is width × length, as written.** Dagger blade 2×3, sword blade
   2×6 ("4x3 makes no sense for a sword"); a 4×3 head is an axe head or a
   halberd.
2. **Souls:** only effects the parts cannot express, and only from items that
   cannot be forged. (This answers the card's old open question.)
3. **Freeze lifted for smithing.**
4. **Chain mail as the band-1 sustain answer gets measured** (see §Roles).
5. **The Rack keeps selling the breastplate.** Gold answering sustain is
   accepted.
6. **The Cold Counter leaves the Forges.** `the_forges` stops listing
   `benches: ['assembling']`.
7. **Magical finishes may have effects of their own** — not only ledger
   edits — but must stay distinct from runecarving. Runecarving itself needs
   a major overhaul (user); do not build on its current shape. Design for
   this is open: §Layer 2, Magic.

## Layer 1 — Assembly

### The anvil

A bench with five slots. Each slot takes a **part kind** and a **material**.

| Slot | Opens at | Takes |
|---|---|---|
| head | always | blade, spearhead, axe head, maul head, plate, bent metal, metal ring |
| second head | smithing 15 | same as head |
| guard | smithing 5 | crossguard, swept guard, boss |
| haft | always | handle, grip, long handle, pole, thick bar |
| binding | smithing 3 | strap, cord |

The bench id is **not** `assembling` (taken by cooking's Cold Counter). Use
`forging`.

### Parts — `PART_KINDS` (new registry)

```ts
type PartRole = 'head' | 'guard' | 'haft' | 'bind';
type PartShape = 'edge' | 'point' | 'mass' | 'plate' | 'bent' | 'ring' | 'bar' | 'guard' | 'cord';
interface PartKindDef {
  id: string; name: string; icon: string;
  role: PartRole; shape: PartShape;
  w: number; l: number;          // width across × length along the item axis; cells = w·l
  cross?: boolean;               // mounted across the haft (axe, maul)
  curved?: boolean;
  qtyMax?: number;               // rings up to 8, bent plates up to 2
  accepts: string[];             // material tags: 'metal' | 'wood' | 'leather'
}
```

Launch catalogue (user ruling 1 applied):

| id | name | shape | w×l | notes |
|---|---|---|---|---|
| thin | Thin blade | edge | 1×6 | rapier / estoc |
| short | Short blade | edge | 2×3 | dagger |
| medium | Medium blade | edge | 2×4 | shortsword |
| long | Long blade | edge | 2×6 | sword |
| great | Great blade | edge | 2×10 | greatsword |
| curved | Curved blade | edge | 2×6 | curved; katana |
| spearhead | Spearhead | point | 1×3 | |
| axehead | Axe head | edge | 4×3 | cross; axe / halberd |
| maulhead | Maul head | mass | 3×3 | cross |
| plate_s / plate_m / plate_w / plate_t | Small plate / Plate / Wide plate / Tall plate | plate | 2×2 / 3×3 / 4×4 / 3×5 | metal or wood |
| bent_s / bent_m / bent_l | Bent metal (small) / Bent metal / Long bent | bent | 2×2 / 2×3 / 2×5 | qtyMax 2; long bent also wood (bow) |
| ring | Metal ring | ring | 1×1 | qtyMax 8 |
| h3 / h4 / h6 / pole | Short handle / Grip / Long handle / Pole | bar | 1×3 / 1×4 / 1×6 / 1×9 | wood or metal |
| club | Thick bar | bar | 2×4 | |
| cross / swept / boss | Crossguard / Swept guard / Boss | guard | 3×1 / 3×2 / 2×2 | |
| strap / cord | Strap / Cord | cord | 1×3 / 1×4 | leather |

### Materials

Optional `MaterialDef.smith = { rho, hard, tough, springy?, mods? }` — no new
registry. `mods` exists because bronze already carries psionic mods
(bronze_dagger's comment says they belong to the metal).

| material | rho | hard | tough | per unit | notes |
|---|---|---|---|---|---|
| iron_ingot | 1.0 | 1.0 | 1.0 | 6 cells | |
| bronze_ingot | 1.1 | 0.9 | 0.9 | 6 cells | mods: psiAcuity ×+15%, psiCoherence ×+10% |
| hardwood | 0.4 | 1.0 | 0.45 | 4 cells | springy |
| leather | 0.3 | 0 | 0.5 | 3 cells | |
| steel (later) | 1.0 | 1.2 | 1.25 | 6 cells | no source yet; not in slice 1 |

### Resolution — `ITEM_CLASSES` (new registry)

The placement reduces to features: first head (shape, w, l, area, l÷w, cross,
curved, material), head count (sum of qty over both head slots), second head
shape, haft (present, l, w), guard present, binding present. Fill order is
never read.

Classes are matched **in priority order, first match wins**. Clauses are
**data, not functions** (the forge edits registries AST-surgically):

```ts
interface ClassMatch {
  head?: { shape?: PartShape[]; l?: [number, number]; w?: [number, number];
           area?: [number, number]; cross?: boolean; curved?: boolean;
           mat?: string[]; count?: [number, number] } | 'none';
  anyHead?: PartShape[];            // some head (either slot) has this shape
  haft?: { l?: [number, number]; w?: [number, number] } | 'none' | 'any';
  guard?: boolean; bind?: boolean;
}
interface ItemClassDef {
  id: string; name: string; icon: string;
  slot: SlotId; wield?: WieldClass;
  tags: string[];                   // family tag FIRST: familySkillFor, martial family
  damageType?: DamageType;          // overrides the family's default (axe, halberd)
  priority: number;                 // higher is tried first
  match: ClassMatch;
  degenerate?: boolean;             // kernel × 0.6, dry name
  cover?: number;                   // armour: share of the body
  exemplar: Placement;              // must resolve to this class (lint)
  desc?: string;
}
```

Rule table (highest priority first; this is the mockup's table, which a
headless run over 4,968 placements resolved with 0 failures):

| class | slot / wield | match |
|---|---|---|
| chain_mail | chest | ring head, count ≥ 8, no haft |
| chain_coif | head | ring, count 4–7, no haft |
| amulet | accessory | ring + binding, no haft |
| ring | accessory | ring, no haft |
| hoop_pole ◇ | weapon / 2h | ring on a haft |
| bow | weapon / 2h | wood bent, l ≥ 5, binding, no haft |
| sickle | weapon / 1h | bent on a haft |
| helm | head | bent ×1, area ≤ 6 |
| gauntlets | hands | bent ×2, l ≤ 2 |
| boots | feet | bent ×2, l ≤ 4 |
| greaves | legs | bent ×2 |
| shin_guard | legs | bent |
| bladed_shield | offhand | plate + an edge head + haft |
| signpost ◇ | weapon / 2h | plate, haft l ≥ 5 |
| tower_shield | offhand | plate area ≥ 15 + haft |
| shield | offhand | plate area ≥ 9 + haft |
| buckler | offhand | plate + haft |
| breastplate | chest | plate area ≥ 9 + binding |
| armour_scrap ◇ | accessory | plate + binding |
| unstrapped_plate ◇ | chest | plate |
| maul | weapon / 2h | mass, haft l ≥ 5 |
| hammer | weapon / 1h | mass + haft |
| halberd | weapon / 2h, slashing | cross edge, haft l ≥ 5 |
| axe | weapon / 1h, slashing | cross edge + haft |
| lance | weapon / 2h | point, haft l ≥ 9 |
| spear | weapon / 2h | point, haft l ≥ 5 |
| short_spear | weapon / 1h | point, haft l ≥ 3 |
| nail ◇ | weapon / light | point |
| twin_blade ◇ | weapon / 2h | edge, count ≥ 2, haft l ≥ 5 |
| glaive | weapon / 2h | edge l ≥ 4, haft l ≥ 5 |
| bladed_spear | weapon / 2h | edge, haft l ≥ 5 |
| rapier | weapon / 1h | edge w 1, l ≥ 5, guard, haft |
| estoc | weapon / 1h | edge w 1, l ≥ 5, haft |
| odachi | weapon / 2h | curved, l ≥ 9, haft (unreachable until a long curved part exists — the reachability lint must report it) |
| katana | weapon / 1h | curved, l ≥ 5, haft |
| greatsword | weapon / 2h | edge, l ≥ 9 or area ≥ 18, haft |
| sword | weapon / 1h | edge, l ≥ 6, haft |
| shortsword | weapon / 1h | edge, l ≥ 4, haft |
| dagger | weapon / light | edge + haft |
| bare_blade ◇ | weapon / light | edge |
| club | weapon / 1h | no head, haft w ≥ 2 |
| quarterstaff | weapon / 2h | no head, haft l ≥ 4 |
| stick ◇ | weapon / light | no head, haft |
| paperweight ◇ | accessory | empty match — the last rule |

◇ = degenerate. Families today: sword, katana, dagger, greatsword, spear,
blunt, staff, bow, shield. **Axe and sickle have no combat skill**; they
equip and fight with no family skill until one claims them (that is code, not
data).

### Numbers — one kernel, no per-class numbers

```
cells(p)  = p.w · p.l
Cw        = Σ over edge/point/mass heads: cells·qty·hard
          + Σ springy bent heads: 0.7·cells·qty·hard
          + Σ other heads: 0.3·cells·qty·hard
          + (no edge/point/mass head and a haft: 0.8·cells(haft)·hard)
lever     = head is cross|point|mass ? 0.9·max(0, haftL − 2) : 0.5·max(0, haftL − 4)
Wt        = Σ all parts cells·qty·rho
ΔWt       = (Wt − 13.2) / 13.2
g         = max(0.7, 1 + 0.2·(qualityMult(q) − 1))
scale     = degenerate ? 0.6 : 1
damage    = max(1, round((0.58·Cw + lever)·g·scale))
speed     = ΔWt < 0 ? +0.18·|ΔWt| : −0.2358·ΔWt          (attackSpeed, mult)
crit      = 0.02·sqrt((l/w) / 3)                          (edge/point first head only)
critDmg   = 0.259·max(0, ΔWt − 0.25)
armour    = round(0.875·Σ head cells·qty·tough·cover·g·scale);  speed −0.01·max(0, Wt − 12)
cover     = chest 1.0, legs 0.6, head 0.5, hands 0.5, feet 0.4, back 0.5, offhand 0.5
STR req   = round(Wt − 10) if ≥ 4, else none
cost      = per material: ceil(cells / per-unit cells)
value     = round(1.8 · input cost · g)       — parts only (antagonist objection 2)
ticks     = 100 + 15·total cells
```

Calibration (measured headless on the mockup's kernel):

| build | result | today |
|---|---|---|
| long blade 2×6 iron + h3 hardwood | sword: damage 7, crit 2%, speed 0, 2 ingots + 1 hardwood | iron_sword 7 / 2% / 2 + 1 |
| great blade 2×10 steel + h4 | greatsword: 14, −15%, crit dmg +10%, STR 12 | steel_greatsword 14 / −15% / +10% / 12 |
| short blade 2×3 iron + h3 | dagger: 3, +8% speed | iron_dagger 2 (+2 dex), +8% |
| curved 2×6 iron + h3 | katana: 7 | katana 6 |
| axe head 4×3 + h3 / + h6 | axe 8 / halberd 11, STR 4 | — |
| wide plate 4×4 iron + strap | breastplate: armour 14, −4.9%, STR 7, 3 ingots + 1 leather | iron_breastplate 14 / −5% / STR 8 / 4 ingots |
| ring ×8 iron | chain mail: armour 7, no STR | — |

### The item seam

- `ItemInstance.forged?: { parts: { slot: 'head'|'head2'|'guard'|'haft'|'bind'; kind: string; mat: string; qty?: number }[]; q: QualityTier }`.
  Optional: no save version change. Store the combination; derive on read;
  memoise by `forgeKey(spec)` (a canonical string, like `carvedKey`).
- `defId` of a forged instance is `forged:<classId>`. `ITEMS['forged:<classId>']`
  stubs are **generated** from ITEM_CLASSES (slot, wield, tags, icon, rune
  class, empty mods), the way materials.data.ts generates preps and genes.
- `itemDefOf(item)` returns `ITEMS[item.defId]` when there is no spec, else the
  full derived ItemDef (mods from the kernel, requirements from STR, tags from
  the class, name "<Material> <Class>"). Every read of an item's mods, value,
  name, requirements or bonus damage goes through it. Known sites
  (2026-10-23): attributes.ts:202 (collectBaseMods), equipment.ts:49/68/74
  (value, name, canEquip), combat.ts ~3988 (bonusDamage) and ~1169–1187
  (`playerDamageType`: read the class's `damageType` first), format.ts ~905,
  about seven in EquipmentPanel.svelte. A **source-scan test** fails on any
  raw `ITEMS[<expr>.defId]` outside a whitelist (tests/icons.test.ts scans
  source the same way).
- `stackKey` (inventory.ts ~112) includes `forgeKey`; two different forged
  swords never stack.
- `modFingerprint` (derived.ts ~621) appends `forgeKey` (and later the finish
  signature) to `e${slot}:${uid}`.
- Rune class from cells: small ≤ 9, medium 10–17, large ≥ 18. Forged items
  start with 0 rune slots (a socket finish later; it must not raise value).
- Size: all forged items are medium in slice 1.

### Recipe lines (John's path)

- `RecipeDef.forge?: Placement`. A recipe with a placement derives its cost
  from the cells and **mints its declared static result** (twins). A lint
  asserts derived cost = the recipe's listed cost wherever both exist.
- Slice 1 placements: iron_dagger (short + h3), iron_sword (long + h3),
  katana (curved + h3), rapier (thin + swept guard + h3), parrying_dagger
  (short + cross + h3), iron_breastplate (plate_w + strap: becomes 3 ingots +
  1 leather, from 4 ingots). Others keep authored costs for now.
- The rapier, parrying dagger, katana, uchigatana and iron breastplate
  recipes are placed at **no spot** today; slice 1 lists them at the Forges.
- Patterns (later): cards that `stamps` `flag:pattern_<id>` add a recipe line,
  the same mechanism as the Smith's Pattern for bronze.

### The anvil (bench job)

- A forging job is a benchwork job (systems/benchwork.ts): one placement,
  inputs spent at completion, cancelled by travel or combat at no cost.
- Quality: `rollQuality` from smithing level, as cooking does. No tool cap in
  slice 1 (no smithing tool exists).
- Result: a forged instance with `q`; counter `forged:<classId>` +1; novelty
  key per class for discovery XP; smithing XP.
- Discovery: the form chart shows a class's name once `forged:<classId>` ≥ 1
  (recipe crafts count too), "?" otherwise. It is the durable reference
  (Invariant B).

## Layer 2 — Finishing (slice 2)

The item stores `fin = { n: Partial<Record<VerbId, number>>, t: number,
rites?: string[] }` (optional field).

- **Eight verbs, four opposed axes:** sharpen / hammer (Edge), fill / hollow
  (Heft), straighten / bend (Line), fuse / segment (Body). Net = n[+] − n[−].
- **Reading:** each net point adds a small linear mod; |net| ≥ 3 adds the
  pole's attribute, ≥ 6 twice, ≥ 9 three times (only reachable with cap ≥ 9).
- **Temper:** one per application. Cap = floor(6 × qualityMult): F 0, E 1,
  D 3, C 6, B 9, A 15, S 24. `t` never decreases except by a refund rite.
  **Anneal** zeroes one axis for 2 temper. A plan is a target counter map;
  the preview refuses plans over cap − t, so application order never matters.
- Applied one verb at a time on the benchwork clock; an interrupted job keeps
  every verb already applied. A piece on the anvil cannot be equipped or sold;
  an equipped piece cannot be worked.
- Weapon readings (per point | attribute at 3):

| verb | pole | per point | attribute |
|---|---|---|---|
| sharpen | Keen | crit +0.5 pp | crit damage +10% |
| hammer | Serrated | graze +3 pp | miss refund +0.10; tier II re-types to bludgeoning via `playerDamageType` |
| fill | Weighted | damage +2%, attack speed −1.5% | damage vs larger +5% |
| hollow | Light | attack speed +1.5%, damage −1.5% | dodge +2 pp |
| straighten | True | parry +0.5 pp | riposte +0.10 |
| bend | Curved | riposte +0.03 | crit damage +10% |
| fuse | Solid | armour +0.5 | ward +1 |
| segment | Jointed | damage vs smaller +1% | extra swings +0.03 |

- Armour readings per point (× slot share: chest 1, legs 0.7, head 0.5,
  hands/feet/back 0.35, offhand 0.7): burnish slash/pierce resist +1.5 pp;
  peen armour +0.7; pad max HP +3, speed −1%; flute dodge +0.5 pp, speed +1%;
  flatten crit damage taken −2%; slope ranged resist +1.5 pp; plate armour
  +0.5; lames ward +0.4. Shields read Line as a weapon does.
- Accessories: Edge and Line locked. Signet (fill) max HP +4, filigree
  (hollow) dodge +0.5 pp, cast (fuse) armour +0.5, linked (segment) stamina
  regen +2%.
- Material locks: wood cannot be hammered; bronze holds no edge past +3; bone
  has no Line; crystal shatters if hammered.
- Every stat above exists today (graze, missRefund, vsLarger, ward,
  resRanged, critTaken, extraSwings: types.ts). The parked sketch's "harder
  to parry", "disarm resist", "opening-blow bonus", "scaled by missing
  armour" and item-level bleed have no hook and are dropped.
- Monster side ships in the same slice: `MonsterDef.finish` counts through
  the same `resolveFinish`; a lint caps the sum at cap(declared quality);
  Line is locked for monsters (no parry or riposte stats).

### Magic (user ruling 7; designed 2026-10-23)

Two brainstorms (world as source, materials as source) and one antagonist
pass. Rulings below; the deferred parts stay designed here.

**The distinctness rule** (it must survive the runecarving overhaul, so it
rests on what a rune *is*, not on today's rune code):

- **A rune is an object.** It sits in a pool, sockets and unsockets, sells,
  has its own value, and can be handed to somebody else (CarvedRune).
- **A finish is a property of the piece.** Sealed in at the anvil, worth 0,
  cannot be removed or moved, cleared only by melting.
- **A medium (deferred) converts the piece.** Every medium effect subtracts
  something from the host.
- Guards, linted: no rite or medium field may hold bonusDamage,
  bonusDamagePct, typed damage, re-typing, inflicts, techniqueMods, hand
  bonuses or tags (registry scan); a finish magnitude must read the host (a
  bare constant is a rune); finishes add 0 to value.

**Sky rites.** `RiteDef { id, name, when: SkyCond[], fits, cost, minQuality?,
effect }`; `SkyCond { kind?, band?, hours?, tags? }` — never a duration or
exposure field (that is cooking's identity). The sky is read once, on the
tick the rite strikes, as the weather bucket at the bench's region
(`weatherAt` is a pure function of seed, region and tick). Never read at use
time; derived.ts and combat.ts never import weather for rites.

Per piece: **one ledger rite and one lens rite**, each id once, stored as
`fin.rites: { id, at }[]` (`at` = the strike tick, for the birth line).

| id | sky | fits | cost | effect |
|---|---|---|---|---|
| night_anneal | clear, 22:00–04:00, not indoors | any | — | ledger: temper budget +2 (renamed from moon-anneal: the world has no moon) |
| cold_set | freezing band, or spot tag `cold` | any | — | ledger: binds the axis with the largest net; its tier cannot fall, anneal skips it, and its attribute marks drop to 2 / 5 / 8 |
| rain_hard | rain | weapon | 2 temper | lens: penetration +1 pp per Edge+ point, max 4 |
| frost_knit | freezing | armour, shield | 2 temper | lens: elemental resist +1 pp per Body+ point, max 5, × slot share |
| snow_pack | snow or blizzard | armour, shield | 2 temper | lens: damage from smaller attackers −1% per Heft+ point and size step, max 5 |

- A lens pays `per × max(0, min(max, read))`: never a penalty on the
  opposite pole.
- Lens stats are ones no rune, item or mundane reading uses (penetration,
  resElemental, fromSmaller). Typed damage and riders stay runes.
- Lens rites need quality C or better (cap 6).
- Weapon lenses are locked for monsters: monsters deliberately have no
  penetration (combat.ts, "nothing erodes the player's"). Armour lenses and
  ledger rites go through `MonsterDef.finish` like the verbs.

**Idle shape: the job waits.** A rite is a flag in the plan. The job applies
the verbs, then strikes the rite on the first tick the sky holds at the bench.
Nothing is spent until it strikes. Travel or combat cancels the unstruck part
for free. The piece stays in inventory flagged "on the anvil"; the job
holds only its uid, so a cancel can never lose it.

- Fix with it: `bonustime.isIdle` is false while `state.benchWork` exists, so
  a job waiting on the sky banks nothing and, with spending on, burns the
  bank 2:1. A job waiting on the sky counts as idle.
- Measured waits at the Forges (Threshold, 300 seeds, real minutes): freezing
  median 8, p90 512; rain median 81; snow median 87; clear night median 127.
  Seasons matter (seed 0: freezing 42% / 6% / 14% / 63% by quarter). The
  Rites tab prints the next window from a one-year scan for every rite, and
  refuses a rite whose sky holds under 1% of hours at that bench.

**Deferred, designed:**

- **thunder_set** (storm, not indoors; budget +3). Storm holds under 1% of the
  year on 12 of 300 seeds, and the seed survives prestige, so those saves
  would never see it. Ships with **commission mode**: the piece stays on the
  anvil and the rite strikes whenever the sky holds, player present or not
  (+1 state key, save bump).
- **Media (imprint).** `fin.medium` — one creature material, sealed. On
  armour only: `depth = clamp(net Body / 6, 0, 1)`, `spent = depth × 0.5 ×
  armour`, and for each elemental type `res += spent × RATE × hide`, where
  `hide` is derived from the dropper's TAG_RESISTANCES row with its weakness
  (warm gel: heat +, cold −). RATE first guess 0.04: a C breastplate gives
  +10.7 pp heat, −10.7 pp cold, armour 16 → 10.7. Waits because **no live
  spawn drops an elemental gel**: every dropper is in the shelved
  countryside. Also open: warm gel is already a rune inlay; one material in
  two lanes needs the user's call. Monster side when it ships:
  `MonsterDef.finish.medium` reading its own armour.

**Cut** (do not re-pitch): use-time weather, soak (hours under the sky — that
is cooking), per-sky tallies summed (runes), elemental riders by sky (the
Stormbrand, Winter's Edge, Thunder and Frost runes own them), bottled sky,
blooding on kills (farmable), tag edits (mutagen bodies key on tags),
socket-granting rites, echo (one verb counting as another), bane vs a monster
tag (achievements ship it; the player has no tags, so no parity), home sky per
verb (no effect of its own; strongest "when" overlap).

## Layer 3 — World

- **Melt** (slice 4): metal cells × 0.5 back as scrap; handles under 3 cells
  vanish; finish and affix lost; runes returned. Statics melt as their
  family's canonical placement. Lint: melt yield < buy floor for every shop
  line.
- **Souls** (slice 4, ruling 2): only effects the parts cannot express
  (`bonusDamage`, hand bonuses, non-family tags), only from items that cannot
  be forged. Melting the named item is the only source; the soul is a
  generated material. Bonus-damage souls fit weapon forms; hand-bonus souls
  fit offhand forms. Today that leaves the Ember Knife and the Warden
  Buckler, and **neither drops anywhere** — slice 4 waits until both have a
  source.
- **Monster weapons** (slice 3): `MonsterDef.kit?: { weapon?: Placement;
  armor?: Placement[] }` through the same kernel; damage type, inflicts and
  range default from the kit (explicit def > kit > genome); a drop line mints
  the exact item; a bestiary "arms" fact with "Add to chart". Adoption
  re-baselines monster STR so level-1 damage holds; rerun `npm run pacing`.

## Roles (COMPLETABILITY §6a)

Measured 2026-10-23 with 20-seed duels against the floor-3 boss
(`puppet_bureaucrat`, `f3_hearing_room`):

| role | basic smithing fills it? | evidence |
|---|---|---|
| damage | weakly | attributes 16: iron sword 0/20; with three strings cut 12/20 |
| sustain | see below | attributes 16: rusty sword + iron breastplate 19/20. John's pacing end state (level 5, STR 5): breastplate needs STR 7–8, cannot be worn, 0/20 |
| condition defence | physical only | bleeding, punctured, concussed via slash/pierce/bludgeon resist |
| access | yes, no new engine | a forged tool carries a tag; `equippedTag` requires already exist; no hurdle uses it yet |

**Chain mail measured (user ruling 4, 2026-10-23).** 20 seeds per row, same
duel as `tests/john.test.ts`, John's pacing end state (level 5):

| attributes trained | weapon | chest | strings cut | wins |
|---|---|---|---|---|
| 1 (STR 5) | rusty sword or oak club | none, chain mail (armour 7), heavy mail (armour 10) | 0 or 3 | 0 |
| 1 (STR 5) | oak club | breastplate with its STR requirement removed | 3 | 1 |
| 4 (STR 8) | oak club | chain mail | 3 | 0 |
| 4 (STR 8) | rusty sword | iron breastplate | 3 | 3 |
| 4 (STR 8) | oak club | iron breastplate | 3 | 16 |

Chain mail does not fill sustain. At STR 5 nothing does; the character is the
bottleneck, not the armour. With STR trained to 4 at the Forges' sledge (a base
verb, not a system), the breastplate is the difference between 0 and 16 wins.
So the band-1 sustain cell is **the breastplate plus a little STR**, not a
STR-free armour form. The kernel gives the forged breastplate STR 7, inside
that reach. A cell test should pin this row.

## Slices

| # | slice | ships | save |
|---|---|---|---|
| 1 | Assembly | PART_KINDS, ITEM_CLASSES, smith profiles, systems/assembly.ts, `itemDefOf` seam, the `forging` bench at the Forges (Cold Counter removed), recipe placements, unplaced recipes placed, anvil panel, form chart, lints and tests | none |
| 2 | Finishing | ledger, verbs, temper, anneal, night-anneal, cold-set, three lens rites, the sky wait and the idle fix, tooltip with sources and birth line, `MonsterDef.finish` | none |
| 3 | Monster arms | `MonsterDef.kit`, bestiary arms fact, exact-item drops, pacing rerun | none |
| 4 | Melt and souls | melting, soul materials, soul slot | none |
| 5 | Tools and access | tool forms with tags, one access hurdle, role cell tests | none |

## Objections (antagonist-design, 2026-10-23) and rulings

All accepted; the spec above includes each.

1. Sustain measured on the wrong character → not claimed for band 1 until
   measured at John's end state.
2. A socket finish would print gold through `RUNE_SLOT_VALUE_MULT` (72 gold
   of inputs → 156 sale) → forged value reads parts only.
3. Minting the static twin at the anvil made an S-grade Iron Sword pattern
   worse (damage 7) than one cell off it (11) → only recipe lines mint
   statics.
4. Parrying Dagger's soul was farmable from scrap; Ember Knife and Warden
   Buckler have no source → souls only from unforgeable items; slice 4 waits.
5. Scope vs freeze → user lifted the freeze for smithing; bench id `forging`.
6. Monster finish sequenced last → ships with slice 2.

Engineering notes from the same pass: the tool that caps the quality roll
does not exist; a forged item's STR requirement must reach `canEquip`
through `itemDefOf`.

## Side findings (2026-10-23)

- `the_forges` listed `benches: ['assembling']` — cooking's Cold Counter —
  since the prototype import (e2599ac). Removed by ruling 6.
- 13 of 20 recipes are placed at no spot.
- The Ember Knife is in no loot table (one of 19 unsourced items).

## Appendix — the parked sketch (from NEXT.md, parked 2026-08)

Kept for the reasoning. Where it disagrees with the spec above, the spec
wins.

Weapon crafting as a **shape grammar**: nobody selects "dagger" from a menu.
A blueprint fixes the general shape (sword, polearm), the *dimensions* of the
parts you fit determine what the thing IS — tiny blade on a sword frame → a
dagger, short → shortsword, medium → longsword, large → two-hander; long stick
+ short blade → spear, + medium blade → glaive, short stick + long blade →
lance. Materials keep doing what they do everywhere else (stats/quality);
dimensions do the new work (taxonomy). Distinct crafting identity from the
existing set — sum (cooking), when (stove), sequence (alchemy), topology
(mutagens), breadth (runecarving) — this one is *the proportions name the
product*.

Rules agreed when parking it:

- **The resolution function must be total.** Every dimension combo yields
  *something*, degenerate combos included (long stick + no blade = quarterstaff;
  the game dryly names the cursed ones). If bad combos just fail, it collapses
  into hidden recipes, i.e. runecarving-with-metal, and isn't worth building.
- **Discovery replaces unlocks.** No pattern-knowledge gate; the archetype
  chart fills in as combos are tried — a free collection layer.
- **Reuse the disciplines chassis** (slots/placements/tool/quality — same
  framework as runecarving): blueprint where the slab goes, parts where
  patterns go. The chassis is shared; the identity is not.
- **Economy (partly settled).** Weapons today come from drops and from basic
  forge recipes. The basic recipes get absorbed: a basic recipe is just a
  blueprint with fixed proportions, i.e. the tutorial tier of this system.
- **Materials carry tactical tags, not just stats.** Iron haft instead of wood
  → quarterstaff good against armored/inorganic targets. Not a new system —
  an affinity field on the material definition, same lane as stats.
- **Process layer (idea on the idea): repeated verbs as a new identity —
  *count*.** "Keep hammering" → serrated edge (bonus vs living scaled by how
  little armor), "keep sharpening" → razor edge (heavy bleed). A finishing
  stage after assembly that accumulates a verb counter map
  (`hammer: n, sharpen: m`) resolved at completion. Two rules keep it a
  distinct identity: **order-insensitive** (or it poaches alchemy's sequence)
  and **verbs antagonistic** (hammering coarsens what sharpening polished, so
  the ratio is the decision and "more of everything" is never optimal).
  Count fills an empty slot in the identity table: sum / when / sequence /
  topology / breadth / proportion / count. UI prior art: cooking's stove
  timeline (count-driven here, not timing-driven, so no overlap with "when").
  **Lane refinement so the drops rule survives:** process verbs grant a small
  closed set of *generic conditional finishes*; drops remain the only source
  of *named, unique* effects. Finishes are spice; souls are loot.
- **Prototype sketch (no blueprints — rework established weapons).** The eight
  verbs pair into four signed axes, and the counters ARE the state:
  hammer↔sharpen = **Edge** (serrated↔razor), fill↔hollow = **Heft**
  (weighted↔light), bend↔straighten = **Line** (curved↔true),
  segment↔fuse = **Body** (jointed↔solid). Net ±3 → finish tier 1, ±6 →
  tier 2. **Temper** = total verb applications a piece tolerates (~6 at C,
  scales with quality) — this is what makes antagonism cost: canceling burns
  temper, and quality buys breadth of finishing. Axis effects, all on
  existing hooks: serrated = bonus vs living scaled by *missing* armor;
  razor = inflicts `bleeding`; weighted = +damage/−speed/ignores armor;
  light = +speed +Deflection/riposte; curved = counter/riposte bonus;
  true = opening-blow bonus; jointed = harder to parry; solid = disarm
  resist (`ground` verb) + small armor. Materials are reachable regions:
  bronze loves hammer/bend/fuse, razor capped, refunds wasted temper
  (recast); iron does everything moderately (hollowing iron = cutting a
  fuller); wood can't be hammered, and *filling wood consumes a second
  material and inherits its tag* (the iron-cored quarterstaff); bone can't
  be hammered or bent (Line locked — it grew that shape), hollows at half
  cost, best bleed; crystal shatters if hammered (one blow destroys it —
  keep that), best razor, segments perfectly. Families don't gate axes —
  the same axis *expresses* differently (segmented blunt = flail, segmented
  staff = three-section, segmented sword = urumi; katana starts Curved +2;
  bow locks Line). Mechanically: a forge-bench job on an owned instance,
  verbs queued over idle ticks, net vector resolves to **affixes stamped on
  the instance uid** (coatings already target `weaponUid`; display/stat
  plumbing exists). Engineering: new mod source ⇒ add to derived-stats
  `modFingerprint`; verb/material matrix is a data table with the rule
  mirrored in both validation layers.
- **Open question, settle before building: bespoke weapons with special
  effects.** Leading candidate: *effects are transplantable parts* — breaking
  down a named weapon yields its effect as a component that can be slotted
  into a blueprint (re-house the effect, re-choose the form). Drops stay the
  only source of permanent effects (alchemy oils already own temporary ones),
  so the generator never obsoletes loot. Rejected: effects-from-exotic-
  materials (generator could reproduce named drops, killing their uniqueness)
  and sealed-bespoke (generator becomes a mid-game dead end). Not decided.
