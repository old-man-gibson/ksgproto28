# General feature candidates

Ideas the user marked on the review applets (2026-10-31) as better as features open to every player than as one character's unique ability. Several are "vow" type: a restriction a player takes on for a run in exchange for power. Nothing here is designed or built.

## Feature ideas from notes

- Idle schedule function: let the player set a schedule while idling, for every activity, not only one ability (user note on Congregation, ENM-16).
- Run vows: a general way for players to take vows in a run (user note on Hot Brews, R2-ALC-01; the same reading on Material Components, Attunement, Sacrament, Answered Prayer).

## Marked abilities

### Hot Brews

`R2-ALC-01` · Alchemy · user verdict: consider

User note: could be a general way of how players can take "vows" in a run. put this in "general feature candidates"

Every brew gets +0.9 volatility and +20% potency. Only Draughts, Oils and Flasks remain.

Does: Every sequence gets +0.9 volatility after its last step. The Alembic then makes only Draughts, Oils and Flasks. Oils no longer need a Quicksilver step. Brimstone ignites on any base.
Grows: Every brew gets +20% potency. It gains +5% more per step past the third.
Costs: You lose Salve, Fume and sustained Elixir. Salve is the only form that treats wounds. Fixing Salt banks nothing.

### Concentrate

`R2-ALC-02` · Alchemy · user verdict: consider

User note: put this in "general feature candidates"

Identical belt flasks stack up to 5 and are thrown as one flask worth 1 + 1.2 per extra copy.

Does: Identical flasks on the belt stack into one slot, up to 5. Using the slot throws the whole stack as one flask.
Grows: The flask is worth 1 + 1.2 per extra copy. The 1.2 rises to 1.5 by Alchemy 35.
Costs: The whole stack goes at once. Against a trash enemy that dies to the first copy, the rest are wasted. A Draught stack is drunk in one go.

### Aqua Regia

`R2-ALC-03` · Alchemy · user verdict: consider

User note: put this in "general feature candidates"

Flasks and oil blows deal a percentage of the enemy's max HP instead of flat damage.

Does: Flasks and oil blows stop dealing flat damage. At Alchemy 5 a flask deals 1.2% of the target's max HP per potency point. An oil blow deals 0.15% per point.
Grows: The percentage rises to 2% at Alchemy 35.
Limit: One throw takes at most 10% of max HP. One fight takes at most 45% of an enemy's max HP from this. Damage is never less than 40% of the old flat number.

### Material Components

`R2-ARC-07` · Arcane magic · user verdict: consider

User note: this could be a general "vow" for players. put this in "general feature candidates"

Spells use one reagent per 10 mana instead of mana. A matching component casts one tier deeper.

Does: Casting a spell uses one reagent from your pack per 10 mana of its cost, rounded up, instead of mana.
Grows: Each noun has a component item: fire charcoal, ice snow, stone gravel, venom a gland. If it is among the reagents spent, the noun casts one tier deeper with no extra sentence slot. A Superb-grade reagent adds +60% damage.
Costs: Reagents come from your stash. The Alembic uses the same herbs and ore.
Fails: With no reagent in your pack, the spell costs double its normal mana. Casting still works.

### Attunement

`R2-ARC-13` · Arcane magic · user verdict: approve

User note: no cooldown is a bit too powerful. reduce cooldown instead. might be a "vow" type situation too, so put this in "general feature candidates"

Your most-cast element is cheaper and stronger. Your most-cast spell has no cooldown.

Does: Your attunement is the element used in most of your last 10 casts. Attuned spells cost 30% less mana and hit +25%. The prepared spell you have cast most this run has no cooldown.
Costs: Spells of other elements cost 50% more mana. The no-cooldown spell costs +50% mana. Every other prepared spell has +30% cooldown.
Limit: The no-cooldown spell changes when another spell's count passes it by 10%.
Grows: Casting rate grows with mana pool size and regen.

### Contingency

`R2-ARC-15` · Arcane magic · user verdict: consider

User note: put this in "general feature candidates"

One prepared ward or mend fires free when a blow would take you to 0 HP.

Does: Mark one prepared self-working spell, a ward or a mend, as your contingency. When a blow would take you to 0 HP, it fires before the blow resolves. It ignores cooldown and mana.
Costs: The spell leaves the rotation.
Limit: It fires once per fight.
Fails: If the working cannot absorb the blow, you go down.

### Sacrament

`R2-DIV-01` · Divine magic · user verdict: consider

User note: might be a "vow" type feature, so put this in "general feature candidates"

Miracles have no cooldown and cast once per fight at 2.5x power.

Does: Every prepared miracle has no cooldown and casts once per fight. It casts at 2.5x power and normal mana cost. The once-per-fight flag resets when the fight ends. Nothing banks across fights.
Grows: Each god you have learned a miracle from adds 10% to all sacraments, up to +50%.
Fails: It is weaker in long fights, because each miracle casts only once. On trash fights, mana limits casts instead of the clock.

### Answered Prayer

`R2-DIV-10` · Divine magic · user verdict: consider

User note: might be a "vow" type feature, so put this in "general feature candidates"

A Pray action takes 4 s, then your god casts a random learned miracle at 1.5x.

Does: Adds a Pray action to the bar. The god you hold most favor with then casts a random learned miracle of its own, prepared or not. It is free of mana, cooldown and the hostility veto and runs at 1.5x.
Costs: Praying takes 4 s with no other action. You take +25% damage while you pray.
Grows: Each 5 favor with that god adds 0.1x, up to 3x.
Fails: The miracle is random, so it can be a heal at full HP.

### Descent

`R2-DIV-19` · Divine magic · user verdict: approve

User note: definitely a dangerous ability. might even be good enough to make this a general feature available to players. put this in a list with Hurl for "general feature candidates"

Each miracle adds Presence. At 5 Presence, Descend gives a god the bar for 8 s.

Does: Descend fires on the triggers you set. For 8 s the god takes the bar. Every action is one of its miracles, free, with no cooldown, at 1.5x. Its blessing is on you at 2x.
Grows: Each miracle you cast adds 1 Presence to its god. At 5 Presence Descend unlocks on the bar.
Costs: After a Descent the god is Spent. Its miracles are locked for 10 fights and it gains no Presence.
Limit: Each 10 favor with the god lowers the threshold by 1, to a floor of 3. Presence counts in the current fight only. Unspent Presence is lost at fight end with no lockout.

### Stop-Hit

`R2-MAR-10` · Martial arts · user verdict: approve

User note: I like this one, but it needs to be tight enough to be difficult-ish to use but it is powerful enough to be worth it. put this in "general feature candidates"

A landed hit inside an enemy's windup cancels its attack. A dodged or fumbled swing there makes you Overrun.

Does: A swing of yours that lands inside an enemy's attack window cancels that attack. The enemy's bar resets to 0%, or 50% for bosses. The cancelling hit gets +25%.
Limit: The window is the last half of your swing interval before the enemy fires. It is never more than the enemy's last 35%. A faster swing gets a narrower window. A stopped enemy cannot be stopped again until it completes an attack.
Fails: A swing that is dodged or fumbled inside an open window leaves you Overrun. The next blow you take lands at x1.5 and cannot be dodged.
Grows: Each 100 stop-hits add 1 point to the hit bonus, up to +50%. The window never widens.

### Hurl

`R2-MAR-16` · Martial arts · user verdict: consider

User note: basically a huge german suplex. almost too limited to be an ability Listed here because the note on Descent says: "put this in a list with Hurl for general feature candidates".

Hurl throws the enemy with the most max HP into the rest and damages them all.

Does: A Hurl action on your bar grabs the enemy with the most max HP and throws it into the formation. It takes 1.8x your weapon damage. Every other enemy takes 0.8x. All are Unfooted for 3 s.
Costs: Hurl costs 10% stamina and leaves you in off_balance. The action waits 10 s.
Fails: Boss-tier enemies and enemies 5 or more levels above you cannot be thrown. The action becomes a shove for 1.0x damage and Rattled for 2 s.
Grows: Each enemy thrown adds 1% to Hurl damage, up to +200%.


### Hardtack

`R3-COO-11` · Cooking · user verdict: consider

User note: could be a general feature

Good dish effects have no timer and give 50% doses. They end on replacement or knockout.

Does: Good dish effects have no timer. They end when a fourth dish replaces the oldest, or on a knockout.
Costs: Doses are 50% of normal.
Grows: Each 10 Cooking levels add 2% to the doses, up to 70%.
Fails: A knockout clears all 3 dishes. You must eat them again.
Limit: Harmful conditions from a dish still time out normally.

### Mailed Fist

`R3-SMI-01` · Smithing and runes · user verdict: consider

User note: could be a general feature, really.

Each hit deals 35% of your total armour as damage. Weapon damage does not count.

Does: Each hit deals damage equal to 35% of your total armour.
Costs: Your weapon's own damage does not count. Its speed and damage type still apply.
Grows: Plate, quality and finishes raise armour, so they raise damage too.
Fails: With no armour you deal 1 damage per hit.

### Socket Punch

`R3-SMI-04` · Smithing and runes · user verdict: consider

User note: can be a general feature

At the anvil, spend 3 temper to punch one rune socket into a forged piece. Each socket cuts the piece by 5%.

Does: At the anvil you can spend 3 temper to punch one rune socket into a forged piece.
Costs: Each socket cuts that piece's damage or armour by 5%. The temper stays spent.
Grows: Temper cap is 6 at C grade and 15 at A, so better pieces take more sockets.
Fails: A piece with under 3 free temper cannot be punched. E and F grade pieces never can.
Limit: 4 sockets per piece. Sockets add 0 to sale value.

### Rebuild

`R3-SMI-15` · Smithing and runes · user verdict: reject

User note: could be a general feature

Reforge a piece with new parts and keep its runes and finishes. Each rebuild lowers the grade by one.

Does: At the anvil you can reforge a piece with new parts. Runes, sockets, finishes and temper carry over.
Costs: Each rebuild lowers the quality grade by one. New parts cost materials as usual.
Grows: Runes and finishes survive upgrades, so one piece can serve the whole run.
Fails: A piece at E grade cannot be rebuilt. Pieces you did not forge cannot be rebuilt.

### Invoke

`R3-SMI-19` · Smithing and runes · user verdict: consider

User note: could be a general feature

The Invoke action deals every rune rider on your weapon at once to all enemies.

Does: The Invoke action deals every rider on your weapon at once to all enemies. The burst equals 20 hits of riders.
Costs: Your riders are silent for 10 s afterward. Cooldown is 30 s.
Grows: Each rune with a rider adds its element to the burst. The total is a plain sum.
Fails: A weapon with no riders has nothing to invoke.

## System content candidates

Abilities the user marked as better built as content inside an existing system than as one run's ability.

### Dragon Pepper

`R3-COO-20` · Cooking · user verdict: reject · build as: a dish effect

User note: Could be a dish effect instead

While a dish with a spicy part is active, your basic attack is a Fire breath that hits every enemy.

Does: While a dish with a spicy part is active, your basic attack is a Fire breath. It hits every enemy and cannot be dodged.
Costs: The breath deals 60% of your basic attack to each target. Weapon on-hit effects do not apply.
Grows: Each dish grade above Fair adds 5% to the breath damage, up to 75%.
Fails: Fire-immune enemies take nothing from it.

Written before the damage-type fix: "Fire" here means Heat.

### Cascade

`R3-MUT-15` · Mutagens · user verdict: consider · build as: a mutagen (genus not chosen)

User note: Could be a mutagen instead. Don't know which genus but reserve it

Each swing also strikes once per mutagen on your attacks route, at 25% weapon damage and 1 stamina each.

Does: Each swing also strikes once per mutagen on your attacks route, for 25% weapon damage.
Costs: Each extra strike costs 1 stamina. At 0 stamina the extra strikes stop.
Grows: Strike damage rises 1% per 50 fights, up to 40%.
Limit: A strike takes the damage type of its mutagen if it has one. Other strikes stay plain.

### Hydra

`R3-MUT-13` · Mutagens · user verdict: consider · build as: a mutagen

User note: does this apply on-hit effects? also, why can't it be a mutagen itself?

A heavy blow grows 2 extra arms for the fight. Each arm punches once per swing.

Does: Each blow over 20% of your max HP grows 2 extra arms. Each arm punches once per swing for 20% weapon damage.
Costs: Each arm costs 2 biomatter. An arm grows only if paying leaves biomatter at or above your floor. Default floor is 10.
Grows: Arm damage rises 1% per 25 fights, up to 60%.
Limit: At most 6 extra arms. They are shed when the fight ends.
Fails: A fight with no heavy blow grows no arms.

### Conduction

`R3-SKY-11` · Weather and the three moons · user verdict: consider · build as: an arcane spell effect ("if others water then arc")

User note: this could be a simple arcane spell effect (but don't quote me on this) like "if others water then arc"

Water hits and rain make enemies Wet. Lightning on a Wet enemy also hits every other Wet enemy.

Does: Water hits and rain make an enemy Wet for 10 s. Lightning on a Wet enemy also hits every other Wet enemy for 50%.
Costs: You are Wet in rain. Your own Lightning arcs back to you for 25%.
Grows: Each arc in a fight adds 5% to later arcs, up to +50%.
Fails: Fire damage dries a Wet enemy at once. Without Water hits or rain nothing is Wet.

Written before the damage-type fix: "Fire" means Heat and "Frost" means Cold.
