import type { ProseTable } from './prose';

// Player-facing text for src/core/data/monsters.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- MONSTERS ----------
export const MONSTERS_TEXT: ProseTable = {
  'ledger_tome.desc': 'Small basic construct. A bound ledger that opens and shuts on whatever comes near; the pages cut. Takes 25% less piercing and 50% more heat damage. Appears in the Long Hall.',
  'filing_automaton.desc': 'Basic construct, armour 2. Strikes with a filing arm for bludgeoning damage. Takes 20% less slashing and piercing, 20% more bludgeoning and 50% more lightning damage. Appears in the Long Hall. Drops iron scrap.',
  'sorting_automaton.desc': 'Basic construct, quick. Slashes with sorting blades. Takes 20% less slashing and piercing, 20% more bludgeoning and 50% more lightning damage. Appears in the Long Hall. Drops iron scrap.',
  'living_doll.desc': 'Small basic construct, dark element. Stabs for piercing damage. Takes 30% less dark damage. Appears in the Long Hall.',
  'puppet_bureaucrat.desc': 'Large elite construct, dark element, on three strings. Always fights alone. Strikes for bludgeoning damage. Takes 30% less slashing, piercing and dark damage, 35% more bludgeoning and 20% more heat. Level 12 with all three strings; each string anchor cut on the floor above takes a level off. Appears in the Hearing Room. 200 XP; rare drop: Lucky Charm.',
  'toll_collector_golem.desc': 'Water covers the collector’s legs. One hand turns a sodden form; the other brings the toll stamp down. Heat fills its sight with steam, cold locks its joints, and lightning drives its stamping arm beyond its limits.',
  'forest_rat.desc': 'Small basic beast. Bites for piercing damage. Appears in The Cages and The Undercrofts. Rare drop: Cloth Tunic.',

  'young_wolf.desc': 'Basic beast. Bites for piercing damage with a 20% chance to inflict Punctured. Drops fur and raw meat.',

  'wolf.desc': 'Veteran beast. Bites for piercing damage with a 20% chance to inflict Bleeding. Drops fur and raw meat; rare drops include the Wolf Fang Blade and a Rune of Swiftness.',

  'boar.desc': 'Large veteran beast. Bludgeoning charge with a 15% chance to inflict Concussed. Drops raw meat.',

  'cliff_hawk.desc': 'Veteran flying beast, wind element. Attacks from range for slashing damage with a 25% chance to inflict Bleeding. Rare drop: Hawk Feather Band.',

  'cave_spider.desc': 'Veteran vermin. Poison bite with a 35% chance to inflict Poison. Takes 50% less poison damage. Appears in The Undercrofts.',

  'stone_golem.desc': 'Large elite construct, earth element. Always met alone. Bludgeoning blows with a 25% chance to inflict Concussed. Takes 60% less slashing and piercing damage, 50% more bludgeoning and arcane damage. Two loot rolls; drops iron scrap and gold.',

  'slime_cell.desc': 'Training slime on floor 0. Every hit it lands deals exactly 1 damage. No armour and no resistances, so every starting weapon deals its listed damage. Appears in the Cellblock (once) and the Field (three fights). Drops Slime Gel.',

  'slime_base_basic.desc': 'Small basic slime. Bludgeoning attacks. Takes 50% less slashing and piercing damage and 25% more bludgeoning damage. Appears in the floor 1 storerooms. Drops Slime Gel.',
  'cage_slime.desc': 'Small basic slime bred in The Cages to take the same damage from every type: no armour, no resistances. Bludgeoning attacks. Appears only in The Cages. Drops Slime Gel.',

  'suspiciously_large_slime.desc': 'Large basic slime, bred in The Cages like the Cage-Bred Slime: no armour, no resistances. Bludgeoning attacks. Appears only when the Cages keeper dares you: every 8 wins while you train there, until you beat it. The fight cannot be fled. Drops 2–4 Slime Gel.',
  'slime_base_advanced.desc': 'Veteran slime. Bludgeoning attacks. Takes 50% less slashing and piercing damage and 25% more bludgeoning damage. Appears in The Undercrofts. Drops Slime Gel.',

  'slime_base_elite.desc': 'Large elite slime. Bludgeoning attacks. Takes 50% less slashing and piercing damage, 30% less poison, 20% less cold, and 25% more bludgeoning damage. Two loot rolls of Slime Gel.',

  'slime_ice_basic.desc': 'Basic slime, ice element. Cold attacks with a 40% chance to inflict Chilled. Takes 50% less cold and 25% more heat damage; 50% less slashing and piercing, 25% more bludgeoning.',

  'slime_fire.desc': 'Basic slime, fire element. Attacks from range for heat damage with a 30% chance to inflict On Fire. Takes 50% less heat and 50% more cold damage; 50% less slashing and piercing, 25% more bludgeoning. Drops Warm Slime Gel.',

  'slime_fire_advanced.desc': 'Veteran slime, fire element. Attacks from range for heat damage with a 35% chance to inflict On Fire. Takes 60% less heat and 60% more cold damage; 50% less slashing and piercing, 25% more bludgeoning. Drops Warm Slime Gel.',

  'slime_fire_elite.desc': 'Large elite slime, fire element. Attacks from range for heat damage with a 40% chance to inflict On Fire. Takes 70% less heat and 70% more cold damage; 50% less slashing and piercing, 25% more bludgeoning. Two loot rolls; drops Warm Slime Gel and gold.',

  'goblin.desc': 'Small basic goblin. Piercing attacks with a 15% chance to inflict Bleeding. Takes 10% less poison damage. Appears in The Cages and The Undercrofts. Drops fur and iron scrap.',

  'goblin_boss.desc': 'Legendary goblin. Slashing attacks. Always spawns in a group of five with Goblin escorts. Takes 25% less poison damage. Two loot rolls; drops include a Boss Token, Iron Gauntlets, the Moonlit Katana and greater runes.',

  'goblin_raid_leader.desc': 'Veteran goblin. Slashing attacks with a 20% chance to inflict Bleeding. Fights with Pocket Sand, Dirty Stab and Gather. Always leads two Goblins. Takes 15% less poison damage. Floor 4\'s boss, at the Raid Camp. Two loot rolls.',

  'goblin_warchief.desc': 'Large elite goblin. Slashing attacks with a 25% chance to inflict heavy Bleeding. Fights with Heavy Blow, Hamstring, Dirty Stab and Gather. Always leads two escorts drawn from Witch Doctors, Firetongues and Hobgoblins. Takes 30% less poison and 20% less heat damage. Floor 6\'s boss, in the Great Hall; killing it opens prestige. Three loot rolls.',

  'goblin_firetongue.desc': 'Small basic goblin. Fights from range with arcane fire: "quickly fire pierce" and "fire pierce", which can set you On Fire. Takes 25% less heat and 10% less poison damage. Drops fur and iron scrap.',

  'goblin_witch_doctor.desc': 'Small veteran goblin. Fights from range with goblin miracles: heals its allies with Mud Poultice (twice a fight, only when it has allies), then casts Vermin Swarm and Cinder Curse. Takes 20% less poison damage. Drops fur.',

  'hobgoblin.desc': 'Veteran goblin. Slashing attacks with a 20% chance to inflict Bleeding. Fights with Gather, Hamstring, Lunge, Dirty Stab and Pocket Sand; with martial open, seeing a technique used on you 50 times teaches it. Takes 15% less poison damage. Drops fur and iron scrap.',

  'hobgoblin_champion.desc': 'Large elite goblin. Slashing attacks with a 25% chance to inflict heavy Bleeding. Fights with Gather, Heavy Blow, Hamstring and Dirty Stab. Spawns with one Hobgoblin escort. Floor 5’s boss, at the Back Door. Takes 30% less poison and 20% less slashing damage. Three loot rolls; drops include a Boss Token, gold, Iron Gauntlets and the Moonlit Katana.',

  'slime_golem.desc': 'Gargantuan ancient slime construct, earth element. Bludgeoning attacks. Takes 75% less slashing and piercing damage, 70% less heat and cold, 75% more bludgeoning and double arcane damage. Three loot rolls; drops Warm Slime Gel, gold and a Boss Token.',

  'slime_water.desc': 'Basic slime, water element. Bludgeoning attacks with a 40% chance to inflict Wet. Takes 60% less slashing and piercing, 40% less heat, 25% more bludgeoning and 60% more lightning damage. Appears in The Undercrofts. Drops Slime Gel and Chilled Slime Gel.',

  'slime_nature.desc': 'Basic slime, nature element. Poison attacks with a 30% chance to inflict Poison. Takes 60% less poison, 40% more heat; 50% less slashing and piercing, 25% more bludgeoning. Drops Slime Gel and Common Herb.',

  'slime_honey.desc': 'Small basic slime, nature element. Bludgeoning attacks. Takes 50% less slashing and piercing, 35% less bludgeoning, and 50% more cold damage. Drops Slime Gel and Common Herb; rare drop: Herbal Charm.',

  'slime_earth.desc': 'Basic slime, earth element. Bludgeoning attacks with a 30% chance to inflict Shardbound. Takes 60% less slashing and piercing, 50% less lightning, 20% less cold, and 30% more bludgeoning damage. Drops Slime Gel and iron scrap.',

  'slime_wind.desc': 'Small basic slime, wind element. Attacks from range for wind damage with a 25% chance to inflict Dazzled. Takes 70% less piercing, 30% less slashing, 20% less bludgeoning, and 40% more lightning damage. Rare drop: Rune of Swiftness.',

  'slime_thunder.desc': 'Small basic slime, lightning element. Attacks from range for lightning damage with a 35% chance to inflict Jolted. Takes 70% less lightning; 50% less slashing and piercing, 25% more bludgeoning. Drops Charged Slime Gel.',

  'slime_water_advanced.desc': 'Veteran slime, water element. Bludgeoning attacks. Takes 60% less slashing and piercing, 50% less heat, 25% more bludgeoning and 70% more lightning damage. Drops Chilled Slime Gel and Slime Gel.',

  'slime_ice_advanced.desc': 'Veteran slime, ice element. Cold attacks with a 45% chance to inflict Chilled. Takes 60% less cold and 40% more heat damage; 50% less slashing and piercing, 25% more bludgeoning. Drops Chilled Slime Gel; rare drop: Minor Rune of Frost.',

  'slime_earth_advanced.desc': 'Large veteran slime, earth element. Bludgeoning attacks. Takes 70% less slashing and piercing, 60% less lightning, 25% less cold, and 40% more bludgeoning damage. Drops iron scrap and Slime Gel.',

  'slime_wind_advanced.desc': 'Veteran slime, wind element. Attacks from range for wind damage. High DEX. Takes 75% less piercing, 30% less slashing, 30% less bludgeoning, and 50% more lightning damage. Rare drops: Hawk Feather Band, Rune of Swiftness.',

  'slime_thunder_advanced.desc': 'Veteran slime, lightning element. Attacks from range for lightning damage. Takes 80% less lightning; 50% less slashing and piercing, 25% more bludgeoning. Drops Charged Slime Gel; rare drop: Minor Rune of Thunder.',

  'slime_zombie.desc': 'Veteran undead slime, toxic element. Poison attacks. Takes 80% less poison, 60% less piercing, 50% less slashing, and 25% more bludgeoning damage. Drops Slime Gel, ruined fur and iron scrap.',

  'slime_spider.desc': 'Small veteran slime vermin, toxic element. Poison attacks. Spawns in packs of 2 to 5. Takes 60% less poison, 50% less piercing, 40% less slashing, and 25% more bludgeoning damage. Appears in The Undercrofts. Rare drop: Spider Silk Garb.',

  'slime_coin.desc': 'Medium veteran slime. Bludgeoning attacks. Always met alone. Higher DEX than other slimes. Takes 60% less slashing and piercing, 30% less arcane, 25% more bludgeoning and 40% more heat damage. Appears in The Undercrofts. Carries 20 to 60 gold and drops more; rare drop: Lucky Charm.',

  'slime_soldier_spear.desc': 'Veteran humanoid slime. Piercing attacks. Escort of the Slime King. Takes 50% less slashing and piercing, 25% more bludgeoning and 20% more arcane damage. Drops Slime Gel, iron scrap and Old Spear; rare drop: Wooden Shield.',

  'slime_soldier_bow.desc': 'Veteran humanoid slime. Attacks from range for piercing damage. Escort of the Slime King. Takes 50% less slashing and piercing and 25% more bludgeoning damage. Drops Slime Gel; rare drop: Hunting Bow.',

  'slime_ice_elite.desc': 'Large elite slime, ice element. Cold attacks. Takes 80% less cold, 55% less slashing and piercing, 60% more heat and 25% more bludgeoning damage. Two loot rolls; drops Chilled Slime Gel; rare drops: Slime Core, Minor Rune of Frost.',

  'slime_earth_elite.desc': 'Large elite slime, earth element. Slashing attacks. Takes 75% less piercing, 70% less lightning, 40% less slashing, 40% less heat, and 40% more bludgeoning damage. Two loot rolls; drops iron scrap; rare drops: Slime Core, Steel Greatsword.',

  'slime_thunder_elite.desc': 'Elite slime, lightning element. Attacks from range for lightning damage. Takes 90% less lightning, 20% less arcane; 50% less slashing and piercing, 25% more bludgeoning. Two loot rolls; drops Charged Slime Gel; rare drops: Slime Core, Greater Rune of Thunder.',

  'slime_arcane.desc': 'Elite slime, arcane element. Attacks from range for arcane damage. Takes 70% less arcane, 20% less lightning; 50% less slashing and piercing, 25% more bludgeoning. Two loot rolls; drops Luminous Slime Gel; rare drops: Slime Core, Apprentice Ring, Oak Staff.',

  'slime_holy.desc': 'Elite slime, light element. Arcane damage attacks. Takes 50% less arcane, 40% less heat; 50% less slashing and piercing, 25% more bludgeoning. Two loot rolls; drops Luminous Slime Gel; rare drops: Slime Core, Pilgrim Amulet, Greater Rune of Vitality.',

  'slime_dark.desc': 'Elite incorporeal slime, dark element. Arcane damage attacks. Takes 85% less slashing and piercing, 50% less bludgeoning, and 50% more arcane damage. Two loot rolls; drops Void Slime Gel; rare drops: Slime Core, Spellwoven Cloak.',

  'slime_metal.desc': 'Small elite slime construct. Bludgeoning attacks. Always met alone. Highest DEX in the slime family. Takes 90% less slashing and piercing, 60% less bludgeoning, 50% less heat and cold, and 60% more lightning damage. Appears in The Undercrofts. 120 XP, 40 to 90 gold; drops iron ingots, gold and Slime Cores.',

  'boss_slime_guardian.desc': 'Colossal ancient slime construct. Bludgeoning attacks. Always met alone. Takes 80% less slashing and piercing, 50% less heat and cold, 50% more bludgeoning and 60% more arcane damage. Three loot rolls; drops Slime Cores, iron ingots, a Boss Token, Iron Breastplate and Greater Rune of Vitality.',

  'slime_king.desc': 'Large legendary slime, unique. Bludgeoning attacks. Spawns in a group of 3 to 5 with Slime Legionary and Slime Skirmisher escorts. Takes 65% less slashing and piercing, 40% less heat and cold, 30% more bludgeoning and 30% more arcane damage. Appears in The Undercrofts. Three loot rolls; drops Slime Cores, Luminous Slime Gel, a Boss Token, the Moonlit Katana, Iron Gauntlets and Greater Rune of Might.',

  'training_dummy.desc': 'Passive target at the Training Area; it never attacks. Spawns in groups of one, three or five so splash and flank behaviour can be tested. About 2,500 HP and 15% evasion. Takes 30% less slashing, piercing and bludgeoning damage; no elemental resistance. Dies and respawns; no loot.',

  'benchmark_dummy.desc': 'Passive post with about one million HP: it does not die within a session, so sustained damage can be read off it. No armour, 15% evasion, takes 30% less slashing, piercing and bludgeoning damage. Never attacks; no loot.',

  'reinforced_post.desc': 'Passive post with flat armour of exactly 100 and no resistances: every blow is reduced by 100, and a blow with less than 100 in it lands for the floor of 1. Penetration does nothing here; it answers resistances, not armour. About one million HP.',

  'swaying_post.desc': 'Passive post with evasion fixed at 35%, the hard cap on the stat: about one swing in three misses. No armour, no resistances. About one million HP.',

  'flopping_post.desc': 'The only post that attacks: about 23.5 damage a swing before your defences, at high speed, so the incoming side can be read: armour, resistances, dodge, parry, wards, crit reduction and size penalties. It also evades 35%, since the same DEX that sets its speed sets its dodge. No armour, about one million HP; you are not expected to kill it.',

  'warded_post.desc': 'Passive post that resists every elemental damage type at exactly 75% and no physical type at all. Compare a weapon hit with a spell hit to read the gap, and measure penetration against the 75% wall. No armour, about one million HP.',

  'mending_post.desc': 'Passive post that regenerates 0.1% of its health every tick, about 1,000 a tick or 10,000 a second; your damage must exceed that before its total moves. Heat or acid damage stops the regeneration. No armour, about one million HP.',

  'psionic_slime.desc': 'Large elite slime, fire element. Casts psionic workings from range for heat damage: a piercing single-target shape that cannot miss, then a wide multi-target sweep. Takes 80% less heat damage; no physical resistances. Carries 120 to 250 gold; no other loot yet.',

  'death_knight.desc': 'Medium veteran armoured humanoid, dark element. Fights with a sword first (Gather, then Heavy Blow) and casts dark arcane sentences when off balance. Holds a counterspell tuned against light and heat, which fires when you cast. Immune to poison; takes 80% less dark and 75% less cold damage; takes double light damage and 40% more heat and earth damage. No loot yet.',

  'paladin_x.desc': '',

  'ph_siege_raider.desc': 'Placeholder veteran humanoid on floor 11. Slashing attacks with a 15% chance to inflict Bleeding. Fights with Hamstring, Lunge and Gather. Drops iron scrap and leather.',

  'ph_siege_brute.desc': 'Placeholder large veteran humanoid on floor 11. Bludgeoning attacks. Fights with Heavy Blow and Gather. Drops iron scrap and hardwood.',

  'ph_siege_captain.desc': 'Placeholder elite humanoid, the last fight of the stronghold’s wave. Spawns with a raider and a brute. Slashing attacks with a 20% chance to inflict heavy Bleeding. Fights with Heavy Blow, Hamstring, Dirty Stab and Gather. Drops a Boss Token, iron ingots and gold.',

  'ph_corsair.desc': 'Placeholder elite humanoid, a skeleton floor’s keeper. Spawns with a raider. Piercing attacks. Fights with Lunge, Dirty Stab and Gather. Drops a Boss Token, gold and leather.',

  // ==== WARD7: monster text (base 2026-10-30; the ward 7 builder's section) ====
  'ph_bandit_thug.desc': 'Basic humanoid bandit on floor 7, on the merchant road and in the salt-flats camp. Bludgeoning attacks. Fights with Heavy Blow and Gather. Drops gold, iron scrap and leather. Placeholder text.',
  'ph_bandit_archer.desc': 'Basic humanoid bandit on floor 7, on the merchant road and in the salt-flats camp, most of all on its watchtowers. Piercing attacks from range. Fights with Lunge and Gather. Drops gold, leather and iron scrap. Placeholder text.',
  'ph_bandit_cutthroat.desc': 'Veteran humanoid bandit on floor 7, on the merchant road and in the salt-flats camp. Slashing attacks. Fights with Pocket Sand, Dirty Stab and Gather. Drops gold, leather and iron scrap. Placeholder text.',
  'ph_bandit_chief.desc': 'Large elite humanoid, the bandits’ chief, in the camp’s tent on floor 7. Spawns with two escorts: thugs, archers or cutthroats. Slashing attacks. Fights with Heavy Blow, Hamstring, Dirty Stab and Gather. Killing it clears floor 7. Drops a Boss Token, iron ingots and gold. Placeholder text.',
  'ph_camp_demon.desc': 'Huge ancient eldritch, dark element, in the burnt camp on floor 7: summoned into the bandits’ camp, it absorbed them. Present only while floor 7 is the last ward of the city left, for 24 in-game hours from the third ward’s clear. Always fights alone. Dark attacks. Fights with Heavy Blow, Hamstring, Dirty Stab and Gather. Keeps half of the HP it loses in a fight it survives. Takes 50% less dark and 20% less heat damage; takes 40% more light damage. Killing it clears floor 7. Drops a Boss Token, gold and iron ingots. Placeholder text.',

  // ==== WARDS8-10: monster text (base 2026-10-30; the wards 8-10 builder's section) ====
  'ph_rogue_beast_young.desc': 'Placeholder large elite beast, floor 8’s keeper while one or none of the other wards is cleared: the beast before its change. Always met alone. Slashing attacks with a 20% chance to inflict heavy Bleeding. Fights with Hamstring, Lunge and Gather. Drops a Boss Token, pristine fur and meat. Placeholder text.',
  'ph_rogue_beast_final.desc': 'Placeholder huge elite beast, floor 8’s keeper once two or more of the other wards are cleared: the beast after its change. Always met alone. About a third more health and a quarter more strength than the young form at the same level. Slashing attacks with a 30% chance to inflict heavy Bleeding. Fights with Heavy Blow, Hamstring, Lunge and Gather. Drops a Boss Token, pristine fur and meat. Placeholder text.',
  'ph_death_squire.desc': 'Placeholder medium veteran armoured humanoid, dark element: floor 9’s keeper while one or none of the other wards is cleared, and a hunt in the Barrow Fields. Fights with a sword first (Gather, then Heavy Blow) and casts gloom cut when off balance; no counterspell. Takes 75% less poison, 50% less dark and cold, 30% more heat and 75% more light damage. Drops a Boss Token, bone dust and iron scrap. Placeholder text.',
  'ph_ore_eater_1.desc': 'Placeholder medium elite vermin, earth element: floor 10’s keeper when none of the other wards is cleared. Always met alone. Bludgeoning attacks. Armoured shell; takes 30% less slashing and piercing and 35% more bludgeoning damage. Fights with Heavy Blow and Gather. Drops a Boss Token, copper ore and iron scrap. Placeholder text.',
  'ph_ore_eater_2.desc': 'Placeholder large elite vermin, earth element: floor 10’s keeper when one of the other wards is cleared. Always met alone. Bludgeoning attacks with a 15% chance to inflict Concussed. Thicker shell than stage 1; takes 35% less slashing and piercing and 40% more bludgeoning damage. Fights with Heavy Blow and Gather. Drops a Boss Token, copper ore, tin ore and iron scrap. Placeholder text.',
  'ph_ore_eater_3.desc': 'Placeholder huge elite vermin, earth element: floor 10’s keeper when two of the other wards are cleared. Always met alone. Bludgeoning attacks with a 20% chance to inflict Concussed. Thicker shell than stage 2; takes 40% less slashing and piercing and 45% more bludgeoning damage. Fights with Heavy Blow, Hamstring and Gather. Drops a Boss Token, copper ore, tin ore and iron scrap. Placeholder text.',
  'ph_ore_eater_4.desc': 'Placeholder gargantuan elite vermin, earth element: floor 10’s keeper when all three other wards are cleared. Always met alone. Bludgeoning attacks with a 25% chance to inflict Concussed. The thickest shell; takes 50% less slashing and piercing and 50% more bludgeoning damage. Fights with Heavy Blow, Hamstring and Gather. Drops a Boss Token, copper ore, tin ore and iron scrap. Placeholder text.',

  // ==== HARBOR: monster text (skeleton 2026-10-30; the harbor builder's section) ====
  'ph_reef_eel.desc': 'Placeholder basic sea monster on the harbor band’s waters. Piercing bite with a 15% chance to inflict Bleeding. Fights with Lunge and Gather. The navy’s and the merchants’ prey. Drops bone dust and biomatter.',
  'ph_deep_serpent.desc': 'Placeholder veteran sea monster on the harbor band’s waters. Bludgeoning attacks. Fights with Heavy Blow and Gather. The navy’s and the merchants’ prey. Drops bone dust and biomatter.',
  'ph_brood_matron.desc': 'Placeholder named ship of the sea beast’s brood: a once-only fight on floors 12 and 13 for the navy and the merchants, and the Sea Beast’s escort on floor 14. Bludgeoning attacks, 20% chance to inflict Bleeding. Fights with Heavy Blow, Hamstring and Gather.',
  'ph_sea_beast.desc': 'Placeholder elite sea monster, the navy’s mission boss on floor 14. Spawns with four Brood Matrons. Bludgeoning attacks, 20% chance to inflict heavy Bleeding. Fights with Heavy Blow, Hamstring and Gather. Drops a Boss Token, biomatter and bone dust.',
  'ph_pirate_cutthroat.desc': 'Placeholder basic pirate on the harbor band’s waters. Slashing attacks. Fights with Pocket Sand, Dirty Stab and Gather. The privateers’ and the merchants’ prey. Drops gold, leather and iron scrap.',
  'ph_pirate_gunner.desc': 'Placeholder veteran pirate on the harbor band’s waters. Piercing attacks. Fights with Lunge, Finishing Cut and Gather. The privateers’ and the merchants’ prey. Drops gold and iron scrap.',
  'ph_pirate_captain.desc': 'Placeholder named pirate ship: a once-only fight on floors 12 and 13 for the privateers and the merchants, and an escort of the Pirate King and of the Warden of the Closed Port on floor 14. Slashing attacks, 20% chance to inflict Bleeding. Fights with Crosscut, Dirty Stab, Finishing Cut and Gather.',
  'ph_pirate_king.desc': 'Placeholder elite pirate, the privateers’ mission boss on floor 14. Spawns with four Pirate Captains. Slashing attacks, 25% chance to inflict heavy Bleeding. Fights with Heavy Blow, Crosscut, Finishing Cut and Gather. Drops a Boss Token, gold and bronze ingots.',
  'ph_convoy_guard.desc': 'Placeholder basic guard on the harbor band’s convoys. Slashing attacks. Fights with Crosscut and Gather. The pirates’ prey. Drops gold, leather and iron scrap.',
  'ph_navy_marine.desc': 'Placeholder veteran navy marine escorting the harbor band’s convoys. Piercing attacks. Fights with Lunge, Hamstring and Gather. The pirates’ prey. Drops gold, iron scrap and leather.',
  'ph_navy_frigate.desc': 'Placeholder named navy ship: a once-only fight on floors 12 and 13 for the pirates, and an escort of the treasure galleon on floor 14. Slashing attacks. Fights with Crosscut, Lunge, Finishing Cut and Gather.',
  'ph_galleon_master.desc': 'Placeholder elite, the pirates’ mission boss on floor 14: the treasure galleon’s master. Spawns with four Frigate Captains. Slashing attacks. Fights with Heavy Blow, Crosscut, Finishing Cut and Gather. Drops a Boss Token, gold and bronze ingots.',
  'ph_port_warden.desc': 'Placeholder elite, the merchants’ mission boss on floor 14: the raider who holds the closed port. Spawns with four Pirate Captains. Bludgeoning attacks. Fights with Heavy Blow, Hamstring and Gather. Drops a Boss Token, gold and iron ingots.',

  // ==== FESTIVAL: monster text (skeleton 2026-10-30; the festival builder's section) ====
  'ph_room_brawler.desc': 'Placeholder humanoid in the Vermin Festival’s dark room. Slashing attacks with a chance to bleed. Fights with Hamstring, Lunge and Gather. Drops nothing.',
  'ph_room_bruiser.desc': 'Placeholder large humanoid in the Vermin Festival’s dark room. Bludgeoning attacks. Fights with Heavy Blow and Gather. Drops nothing.',
  'ph_room_last.desc': 'Placeholder elite humanoid: the last of the dark room’s nine, always fought alone. Beating it clears floor 15. Slashing attacks with a chance to bleed. Fights with Heavy Blow, Hamstring, Dirty Stab and Gather. Drops nothing.',
  'ph_survivor_blade.desc': 'Placeholder humanoid on the Vermin Festival’s royale field, a survivor of another room. Piercing attacks with a chance to bleed. Fights with Lunge, Dirty Stab, Pocket Sand and Gather. Drops nothing.',
  'ph_survivor_brute.desc': 'Placeholder large humanoid on the Vermin Festival’s royale field, a survivor of another room. Bludgeoning attacks. Fights with Heavy Blow, Crosscut and Gather. Drops nothing.',
  'ph_survivor_champion.desc': 'Placeholder elite humanoid: the last survivor on the royale field, always fought alone. Beating it wins the festival. Slashing attacks with a chance to bleed. Fights with Crosscut, Finishing Cut, Heavy Blow, Hamstring and Gather. Drops nothing.',

  // ==== ABERRANT: monster text (skeleton 2026-10-30; the aberrant builder's section) ====

  // ==== DESERT: monster text (skeleton 2026-10-30; the desert builder's section) ====
  'ph_scarab.desc': 'Placeholder vermin of the desert band, floors 18 to 20. Piercing attacks. Fights with Gather and Lunge. Killed by heat it can drop brimstone; killed by bludgeoning, copper ore. Sometimes drops gold leaf.',

  'ph_cobra.desc': 'Placeholder beast of the desert band. Piercing bite with a 30% chance to inflict Poison. Takes 30% less poison damage. Fights with Lunge, Dirty Stab and Gather. Killed by a blade (slashing or piercing) it can drop leather; killed by heat, green vitriol. Sometimes drops raw meat.',

  'ph_scorpion.desc': 'Placeholder vermin of the desert band. Piercing sting with a 25% chance to inflict Poison. Takes 40% less poison damage. Fights with Hamstring, Crosscut and Gather. Killed by bludgeoning it can drop tin ore; killed by heat, fixing salt.',

  'ph_mummy.desc': 'Placeholder undead of the desert band. Bludgeoning attacks. Takes 50% more heat damage and 50% less poison damage. Fights with Heavy Blow and Gather. Two drop rolls: killed by heat it can drop bone ash, killed by bludgeoning bone dust; any other kill drops neither.',

  'ph_sand_colossus.desc': 'Placeholder construct, floor 18’s forecourt guardian. Always fights alone. Bludgeoning attacks. Takes 90% less heat damage. Fights with Heavy Blow and Gather. Drops a Boss Token, gold, copper ore and tin ore; killed by bludgeoning it can also drop quicksilver.',

  'ph_sabaket.desc': 'Sabaket, the Weigher at the Door: the judge of floor 19’s pyramid. Placeholder stats. Always fights alone. Slashing attacks with a 25% chance to inflict Bleeding. Takes 50% less dark and 30% less poison damage. Fights with Heavy Blow, Hamstring, Finishing Cut and Gather. With nothing taken from the treasury it is weaker than the floor’s dens; each grave good taken raises its level, up to the band’s strongest. Drops a Boss Token, gold, bronze ingots and quicksilver.',

  'ph_roadstead_crew.desc': 'Placeholder crew of the ferry at floor 20’s roadstead. Always three at once. Piercing attacks. Fights with Lunge, Dirty Stab, Pocket Sand and Gather. Drops gold, leather and sometimes a Boss Token.',

  'giant_spider_queen.desc': 'Huge elite vermin, toxic element. Always fights alone. Poison bite with a 60% chance to inflict heavy Poison. Takes 40% less slashing, 50% less poison, 35% less earth and 20% less bludgeoning; takes 50% more piercing, 40% more heat and 20% more cold damage. Appears in the Brood Den. 200 XP; rare drops: Spider Silk Garb, Lucky Charm.',
};
