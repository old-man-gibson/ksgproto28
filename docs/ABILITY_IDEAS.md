# Unique ability ideas — the bank

*Started 2026-10-27. The user writes how each ability works, in plain
English. A system that generates abilities comes later and has to be able to
produce what is written here, not the other way round.*

A bank, not a plan. Nothing here is a card. The generator attempt is in
[plans/rolled-abilities.md](plans/rolled-abilities.md); the user was not
convinced by it (2026-10-27: "I see the logic you go for and I'm just not
feeling it"), so it stays a draft until these entries give it a target.

Settled for any ability in this file (user, 2026-10-27):

- One ability per run, discovered early. The player keeps it for the whole
  run.
- Monsters never get these abilities (unique-abilities.md, user 2026-09-26).
- Lies are player-only. The target makes a save: on a failure the lie becomes
  real, on a success nothing happens.
- Overforge's upgrades live in the item itself. The ability only makes them
  possible.
- Enemies can hit summons.

To add one: copy an entry, give it a name, write how it works. The other
fields are optional.

---

## 1. The user's ideas

Written by the user on 2026-10-27, quoted as given.

### Calorie Burn
"Increase power the more calories you burn but take damage and lose power if
the player stays beyond 100% for too long without eating."

Already designed in detail: [plans/ability-calorie-burn.md](plans/ability-calorie-burn.md).

### Salt Zone
"Create a zone where enemies slowly turn into salt, accelerated every time
the player character strikes them with unarmed attacks."

### The Deck
"The player character uses the various combat systems (arcane, miracles,
martial, psionics, alchemical items in the toolbelt, etc.) in the form of
drawing cards, using M:TG-style rules to play mana lands and cards from the
hand or graveyard, at the cost of being very restricted in the early game but
gaining flexibility and comboes as the fight goes on."

### Ghosts
"The player character can summon ghosts that perform a random action and then
disappear again."

### Solar Charge
"The player character gets empowered and charges up in the sun, but loses
power as the charge falls below a certain %, down to a -30% debuff at 0%
sunlight charge."

Already designed in detail: [plans/ability-solar-reactor.md](plans/ability-solar-reactor.md).

### Stat Breaker
"The player character can see and edit stats of the enemy, using an ability
'Stat Breaker' to permanently negatively affect that instance of the enemy,
but doing so comes with a high resource cost and cooldown."

Note: an enemy instance only lasts one fight, so "permanently" means "for the
rest of that fight" unless a per-species record is built.

### Amalgam
"The player character can summon creatures that build up a charge every time
they die and transfer their attributes to that charge, and when it's full, the
player can summon an amalgam that inherits all the sacrificed summons' stats,
but it takes a long time to charge and does not transfer its stats into the
next pool."

### Overforge
"The player character can upgrade equipment continuously by using an
increasing number of resources, but the more they exceed the normal bounds of
the equipment, the higher the chance it breaks and wasting all resources
spent."

### Coin Flips
"The player can flip one or more coins (based on level and experience in
relevant skills) to grant themselves penalties or buffs, and the player gains
a secret 'personal luck' stat that skews their random rolls more and more in
their favor, further increasing the more dire the character situation becomes
in combat."

### Lies
"The player character can 'lie', creating an effect that alters a rule or
state of the game for a short time, such as 'I heal from being hit', 'your
blood catches fire', 'you have taken a mortal wound' etc. that functions
similar to miracles but is extremely expensive and costs a very limited
resource that only recharges once per in-game day."

### Weakest Weapon Master
Authored 2026-09-26: [plans/ability-weakest-weapon-master.md](plans/ability-weakest-weapon-master.md).

---

## 2. Claude's ideas

Offered on 2026-10-27. The user found them "alright" but was not convinced.
They are kept as raw material only: rewrite, merge or delete freely.

### Grudge
The species that last knocked you out becomes your grudge. You deal more
damage to it with every one you kill, uncapped for the run. While the grudge
is active you cannot retreat from that species, and every other enemy hits
you a little harder. A knockout by something else moves the grudge and resets
the count.

### Mimic
After a kill, copy one of the enemy's traits (a gene, a resistance, its
signature attack) for the next 10 fights. While you carry it, one of your own
mutagen slots goes dormant. Copying from a higher-level enemy also copies its
weakness.

### Glutton's Archive
Every dish eaten for the first time this run gives a small bonus for the rest
of the run, scaled by quality. Eating a dish you've already had makes you
sick, and the sickness gets worse with each repeat.

### Grammar of Wounds
Each hit carves an arcane word into the enemy: techniques carve verbs,
unarmed strikes carve nouns, crits carve adverbs. When the words form a valid
sentence, the enemy casts it on itself, at your arcana. A badly ordered
sequence does nothing.

### Name-Eater
Complete a species' bestiary entry, then eat its name: that species is weaker
against you for the run and shows as `???`, but you lose everything the
bestiary taught you about it.

### Promissory Flesh
Take damage on credit. It is written into a ledger that comes due at the next
in-game dawn. Resting at a shrine halves the debt. If the debt is larger than
max HP at dawn, you are knocked out wherever you are.

### The Previous Tenant
Your last run's character haunts this one. Their best skills fight beside you
as a ghost at a fraction of their old level. You cannot train what they
mastered most.

### Understudy
Once per fight, swap stat sheets with the enemy for a few seconds. It is
strong early (borrow a boss's body) and a liability late (you hand your build
to a rat).

### Sympathetic Token
Some kills drop a token of that species. Spending one mid-fight damages every
member of that species in the fight, including the ones in the back of the
formation that can't normally be hit. Tokens rot after a game day.

### Metronome
Your rotation is scored as music. Each action is a note: the action type sets
the pitch, the bar timing sets the rhythm. When the last eight actions form a
recognised musical form, that form's effect fires.

### Contract with the Floor
Sign a contract with one tower floor: its floor rules bend in your favour
everywhere. Its boss is released and turns up on other floors until you kill
it.

### Sealed (a twist, not an ability)
Any ability can start with its rules hidden behind `???` lines. Each line
fills in the first time it triggers.

---

## 3. Entry template

```
### <Name>
<How it works, in plain English: what it does, what it costs, what makes it
grow or fail.>

Notes: <optional — open questions, what it is like early vs late in a run>
```
