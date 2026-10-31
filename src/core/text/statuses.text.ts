import type { ProseTable } from './prose';

// Player-facing text for src/core/data/statuses.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- STATUSES ----------
export const STATUSES_TEXT: ProseTable = {
  'toll_steam.desc': 'Applied to the Toll Collector by a heat spell. Its attacks have a 50% chance to miss for 8 seconds. Another heat spell resets the timer without adding to the effect.',
  'toll_ice.desc': 'Applied to the Toll Collector by a cold spell. Its dodge is 0 and its armor is reduced by 75% for 8 seconds. Another cold spell resets the timer without adding to the effect.',
  'toll_overdrive.desc': 'Applied to the Toll Collector by a lightning spell. Its attack speed is +65% for 8 seconds, and it takes 12 lightning damage each time its action bar fills. Another lightning spell resets the timer without adding to the effect.',
  'eyeless.desc': 'Cannot be Dazzled or Blinded. No other effect.',

  'refutation.desc': 'Ward absorbs a flat 40 damage from each hit after resistances, plus 1.5 per point of spell power, for 15 seconds. Anything that strikes you in melee takes 6 piercing damage and is Punctured.',

  'knitting.desc': 'Health regenerates. Heat or acid damage removes it and applies Doused for 4 seconds.',

  'doused.desc': 'Health regeneration is zero for 4 seconds. Knitting cannot return until it ends.',

  'corroded.desc': 'Armour is reduced by 12% per point of corrosion for 25 seconds. Doses add; at 6 it escalates to Melting.',

  'melting.desc': 'Armour gives nothing for 15 seconds. Bludgeoning, heat and cold resistance each drop by 12%.',

  'poison.desc': 'Deals 0.05 poison damage per tick per intensity for 30 seconds and cuts stamina regeneration by 20%. Only a stronger dose replaces it; at intensity 4 it escalates to Rotting. A poison cure (a Mendroot Salve) removes it.',

  'rotting.desc': 'Deals 0.12 poison damage per tick per intensity for 45 seconds and cuts stamina regeneration by 35%. Half of every stamina spend is also removed from maximum stamina, up to 60%. When it ends the lost maximum returns slowly (Wasted). A poison cure (a Mendroot Salve) reduces it to Poisoned.',

  'rot_recovery.desc': 'Maximum stamina removed by Rotting returns over time, about 20 seconds for a full 60% loss.',

  'on_fire.desc': 'Deals 0.4 heat damage per tick per intensity for 8 seconds. A new flame adds half its intensity to the existing one without resetting the timer. At intensity 5 it escalates to Blazing.',

  'blazing.desc': 'Deals 0.9 heat damage per tick per intensity for 4 seconds. Healing can restore at most half of what it burns. When it ends it becomes Seared.',

  'blaze_burn.desc': 'Healing can restore at most half of what the blaze burned. No timer. Removed by rest, a salve, or a healing spell.',

  'chilled.desc': 'Speed is reduced by 40% and weapon bonuses by 50% per intensity (up to 60%) for 20 seconds. Doses add; past intensity 1 it escalates to Frozen.',

  'frozen.desc': 'Speed is reduced by 95% and bludgeoning resistance by 50% for 3 seconds. Any damage taken removes it.',

  'bleeding.desc': 'Deals 0.08 slashing damage per tick plus 0.15% of current health, at 30% rate out of combat. No timer. Each cut is its own stack; at 5 it escalates to Lacerated. Removed only by rest, a salve, a healing spell, or a bleed cure (a Mendroot Salve).',

  'lacerated.desc': 'Deals 0.2% of maximum health per tick as slashing damage (30% rate out of combat) and reduces maximum health by 4% per stack, up to 30%. No timer. Rest, a salve (a Mendroot Salve included), or a healing spell reduces it to Bleeding; a second treatment closes that.',

  'concussed.desc': 'Spells cannot be cast and attacks have a 12% miss chance per intensity, for 25 seconds. Rest, a salve, or a healing spell reduces its intensity by 40%. At intensity 3 it escalates to Dazed.',

  'dazed.desc': 'Spells and attacks cannot be taken. Each stack skips one completed action and is spent by it. Ends with the fight.',

  'punctured.desc': 'Stamina costs rise by 25% per point (up to double). Each tick it is held, maximum stamina is reduced by another 0.04% (0.4% per second), up to 5%. Lasts 40 seconds. Doses add; at 3 it escalates to Perforated.',

  'perforated.desc': 'Stamina does not regenerate, maximum stamina is reduced by 5% per stack (up to 40%), and the stance is forced to Balanced. Lasts 60 seconds.',

  'jolted.desc': 'Deals 1.2 lightning damage per intensity each time your action bar fills, for 20 seconds. Below 50% health you drop your weapon. Taking damage halves its intensity. Past intensity 2 each new dose may escalate it to Shocked; at 6 it does.',

  'shocked.desc': 'The action bar drains instead of filling. When it empties, the bearer takes 2.5 lightning damage per intensity and the condition ends. Ends with the fight.',

  'shardbound.desc': 'Deals 0.8 piercing damage per intensity to the bearer each time they attack or are struck in melee, for 30 seconds. Doses add; at 4 it escalates to Shardbloom.',

  'shardbloom.desc': 'Deals 0.4 piercing damage per intensity to the bearer each time they attack or are struck in melee, and applies a Shard Cut each time. Lasts 25 seconds.',

  'shard_bleed.desc': 'Deals 0.3 slashing damage per tick plus 0.1% of current health, for 4 seconds. Stacks up to 8 and never escalates.',

  'wet.desc': 'Heat resistance +8%; lightning and cold resistance -6%; poison resistance -4%. Lasts 30 seconds. Doses add; at 5 it escalates to Soaked. Heat damage removes one stack.',

  'soaked.desc': 'Heat resistance is set to 80% (or raised by 10% if it is already 80% or more). Lightning, cold and poison resistance are set to -50%. Chill lands at triple intensity, and Jolted escalates at intensity 3. When Soaked first lands, any Poison already on the bearer becomes Rotting at 2/3 of its intensity. Lasts 60 seconds or until the bearer takes 3 hits of heat, poison, lightning or cold damage.',

  'buffeted.desc': 'Each point gives a 12% chance that a technique ends off balance instead of at its exit position, fading as the 12-second timer runs down. Doses add; at 5 it escalates to Unfooted. A plain swing still resets to neutral.',

  'unfooted.desc': 'Every technique ends off balance instead of at its exit position, for 20 seconds. A plain swing still resets to neutral.',

  'seeded.desc': 'No effect on landing. Its intensity rises 0.15 per second during a fight, and at 6 it becomes Rootbound. Each hit the bearer takes lowers its intensity by 0.5 (by 1 if the hit is piercing); each water hit raises it by 1. It records the intensity of every other condition applied to the bearer (up to 6 per condition). Heat damage removes it and deals 4 heat damage per recorded intensity.',

  'rootbound.desc': 'Speed -20%, dodge -8%. Every 3 seconds, 25% of the recorded conditions are applied to every other enemy in the fight. Its intensity rises 0.08 per second during a fight; each hit the bearer takes lowers it by 0.25 (by 0.5 if piercing) and each water hit raises it by 0.5. Lasts 45 seconds. Heat damage removes it and deals 7 heat damage per recorded intensity.',

  'overgrowth.desc': 'Applied when you heal an enemy with a spell: the full amount healed is added to its surplus, whether or not it was wounded. Speed -15%, dodge -5%. The surplus shrinks by about 2% of itself every second. At surplus equal to 50% of its maximum health it escalates to Proliferating.',

  'proliferating.desc': 'Speed -30%, dodge -10%. The surplus shrinks by about 1% of itself every second. At surplus equal to 100% of its maximum health it bursts: the bearer takes the whole surplus as damage, and every other enemy takes half of it as poison damage.',

  'magnetized.desc': 'Each point gives attacks a 10% chance to ignore the bearer’s dodge, and lowers its dodge by 3%. Lightning attacks always ignore its dodge. Piercing attacks gain 5% crit chance per point. Lasts 10 seconds. Doses add; at 6 it escalates to Magnet-Locked.',

  'magnet_lock.desc': 'Dodge does not apply at all. Lightning attacks cannot miss them. Piercing attacks gain 5% crit chance per stack, and the next critical hit deals +35% damage per stack. Lasts 15 seconds.',

  'dazzled.desc': 'Attacks have an 8% miss chance per intensity and dodge is reduced by 5%. Lasts 6 seconds; a second flash extends the timer. At 4 it escalates to Blinded.',

  'blinded.desc': 'Every attack rolls to hit twice and keeps the worse result. Dodge is reduced by 25%. Lasts 25 seconds.',

  'tainted.desc': 'All resistances are reduced by 5% per stack, light and dark by 10%. Its penalty cannot push a resistance below -25% (a further -5% for each stack past the first); a resistance already lower is left as it is. Weakens as the 45-second timer runs down. Doses add; at 5 it escalates to Corrupted.',

  'corrupted.desc': 'Each stack reduces maximum spirit by 10% and maximum health, stamina and mana by 5% (up to 60%). Up to 10 stacks. No timer; only a cleansing removes it. If spirit reaches zero you are defeated and wake with half of it.',

  'manaburn.desc': 'Drains 1% of maximum mana per tick until mana equal to its intensity has been drained, then it ends. Mana can go below zero, down to -100% of maximum mana plus a further -25% for each stack past the first. When mana reaches that limit, it deals arcane damage equal to the mana debt, ignoring 80% of arcane resistance, and ends. No timer.',

  'well_fed.desc': 'Restores 0.06% of maximum health per tick, +8 maximum health and +10% stamina regeneration for 10 minutes.',

  'steady_hand.desc': '+3% crit and +2% parry for 8 minutes.',

  'clear_headed.desc': 'Restores 0.1% of maximum mana per tick, +8% spell power and +5% skill experience for 8 minutes.',

  'stoked.desc': '+5% damage and +0.05 critical damage multiplier per intensity, for 5 minutes. Granted by Seared Stew.',

  'steeped.desc': '+25% poison resistance and +10% acid resistance per intensity, for 10 minutes. Granted by Steeped Broth. Poison or acid resistance of 100% or more stops those conditions from landing; damage resistance still stops at its cap.',

  'queasy.desc': 'Deals 0.03 poison damage per tick and cuts stamina regeneration by 25% for 90 seconds. Rest removes it.',

  'unfolded.desc': 'Slashing, piercing and bludgeoning resistance -12%; arcane resistance -15%. Lasts 15 seconds.',

  'folded_space.desc': '+12% dodge for 40 seconds.',

  'ximas_rime.desc': '+12% heat, cold and lightning resistance for 60 seconds. Granted by Xima.',

  'blood_communion.desc': 'Bleeding and Lacerated ticks heal you instead of damaging you. +8% damage. Lasts 60 seconds.',

  'honor_bound.desc': 'Enemies other than your target do not attack. +10% damage. Lasts 20 seconds.',

  'veiled.desc': 'Attacks against you have a 12% chance to miss, for 30 seconds.',

  'frosted.desc': '+20% cold resistance and +10% heat resistance per intensity. Lasts as long as the Elixir. Granted by Frostmoss.',

  'concealed.desc': 'Attacks against you have a 10% chance to miss and you gain +3% dodge, per intensity. Lasts as long as the Elixir. Granted by Gloomcap.',

  'invigorated.desc': '+25% stamina regeneration per intensity. Lasts as long as the Elixir. Granted by Bloodwort.',

  'night_shroud.desc': 'Attacks against you have a 12% chance to miss, for 30 seconds.',

  'unravelling.desc': 'Arcane resistance -8%, spell power -5% and mana regeneration -15% per stack, for 20 seconds. At 3 stacks it becomes Manaburn at 8 times the intensity.',

  'kinetic_bulwark.desc': 'Blocks all ranged attacks except light, for 25 seconds.',

  'psionic_haste.desc': '+3% speed and +3% travel speed per intensity, for 20 seconds. Speed covers attacks, crafting and every activity.',

  'psionic_bracing.desc': '+1 armour per intensity, for 20 seconds.',

  'psionic_root.desc': '+2% bludgeoning resistance per intensity, for 20 seconds. Dazed and Concussed land at half intensity.',

  'psionic_foresight.desc': 'Attacks against you have a 3% chance to miss per intensity, for 20 seconds.',

  'psionic_compression.desc': 'Speed -2% per intensity, for 20 seconds.',

  'psionic_read.desc': 'Dodge -2% and parry -2% per intensity, for 20 seconds.',

  'psionic_wide_sight.desc': '+1.2% slashing, piercing and bludgeoning resistance per intensity, for 20 seconds.',

  'artisans_cunning.desc': '+15% craft speed and +8% loot for 120 seconds.',

  'flat_footed.desc': 'Dodge and parry from gear, affixes, runes, hand bonuses, buffs and conditions do not apply; skill and title bonuses still do. Ends after your next two completed actions.',

  'surprised.desc': 'The next hit to land deals 30% more damage per intensity, then the surprise is spent. A fight opening on surprised enemies starts your action bar nearly full. Fades after two of their actions.',

  'skewered.desc': 'Speed -5% and dodge -15% for 10 seconds. If the timer runs out, the bearer takes 12 piercing damage per intensity; if it is removed early, no damage is dealt.',

  'fasting.desc': 'Plain weapon swings cannot be used. Spells, techniques and abilities still can. Ends with the fight.',

  'hunger_anupama.desc': 'Deals 0.05 dark damage per tick per intensity; half of it ignores resistance. No cap on stacks. Each application refreshes the 15-second timer. Ends with the fight.',

  'weight_of_hunger.desc': 'Speed is reduced by intensity, to at most 3 times slower. Ends when your action bar fills, or after 3 seconds.',
};
