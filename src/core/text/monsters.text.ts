import type { ProseTable } from './prose';

// Player-facing text for src/core/data/monsters.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- MONSTERS ----------
export const MONSTERS_TEXT: ProseTable = {
  'toll_collector_golem.desc': 'Water covers the collector’s legs. One hand turns a sodden form; the other brings the toll stamp down. Heat fills its sight with steam, cold locks its joints, and lightning drives its stamping arm beyond its limits.',
  'forest_rat.desc': 'Small basic beast. Bites for piercing damage. Appears in The Cages and The Undercrofts. Rare drop: Cloth Tunic.',

  'young_wolf.desc': 'Basic beast. Bites for piercing damage with a 20% chance to inflict Punctured. Drops fur and raw meat.',

  'wolf.desc': 'Veteran beast. Bites for piercing damage with a 20% chance to inflict Bleeding. Drops fur and raw meat; rare drops include the Wolf Fang Blade and a Rune of Swiftness.',

  'boar.desc': 'Large veteran beast. Bludgeoning charge with a 15% chance to inflict Concussed. Drops raw meat.',

  'cliff_hawk.desc': 'Veteran flying beast, wind element. Attacks from range for slashing damage with a 25% chance to inflict Bleeding. Rare drop: Hawk Feather Band.',

  'cave_spider.desc': 'Veteran vermin. Poison bite with a 35% chance to inflict Poison. Takes 50% less poison damage. Appears in The Undercrofts.',

  'stone_golem.desc': 'Large elite construct, earth element. Always met alone. Bludgeoning blows with a 25% chance to inflict Concussed. Takes 60% less slashing and piercing damage, 50% more bludgeoning and arcane damage. Two loot rolls; drops iron scrap and gold.',

  'slime_cell.desc': 'Training slime on floor 0. Every hit it lands deals exactly 1 damage. No armour and no resistances, so every starting weapon deals its listed damage. Appears in the Cellblock (once) and the Field (three fights). Drops Slime Gel.',

  'slime_base_basic.desc': 'Small basic slime. Bludgeoning attacks. Takes 50% less slashing and piercing damage and 25% more bludgeoning damage. Appears in The Cages and The Undercrofts. Drops Slime Gel.',

  'suspiciously_large_slime.desc': 'Large basic slime. Bludgeoning attacks. Takes 50% less slashing and piercing damage and 25% more bludgeoning damage. Appears only when the Cages keeper dares you: every 8 wins while you train there, until you beat it. The fight cannot be fled. Drops 2–4 Slime Gel.',
  'slime_base_advanced.desc': 'Veteran slime. Bludgeoning attacks. Takes 50% less slashing and piercing damage and 25% more bludgeoning damage. Appears in The Undercrofts. Drops Slime Gel.',

  'slime_base_elite.desc': 'Large elite slime. Bludgeoning attacks. Takes 50% less slashing and piercing damage, 30% less poison, 20% less cold, and 25% more bludgeoning damage. Two loot rolls of Slime Gel.',

  'slime_ice_basic.desc': 'Basic slime, ice element. Cold attacks with a 40% chance to inflict Chilled. Takes 50% less cold and 25% more heat damage; 50% less slashing and piercing, 25% more bludgeoning.',

  'slime_fire.desc': 'Basic slime, fire element. Attacks from range for heat damage with a 30% chance to inflict On Fire. Takes 50% less heat and 50% more cold damage; 50% less slashing and piercing, 25% more bludgeoning. Drops Warm Slime Gel.',

  'slime_fire_advanced.desc': 'Veteran slime, fire element. Attacks from range for heat damage with a 35% chance to inflict On Fire. Takes 60% less heat and 60% more cold damage; 50% less slashing and piercing, 25% more bludgeoning. Drops Warm Slime Gel.',

  'slime_fire_elite.desc': 'Large elite slime, fire element. Attacks from range for heat damage with a 40% chance to inflict On Fire. Takes 70% less heat and 70% more cold damage; 50% less slashing and piercing, 25% more bludgeoning. Two loot rolls; drops Warm Slime Gel and gold.',

  'goblin.desc': 'Small basic goblin. Piercing attacks with a 15% chance to inflict Bleeding. Takes 10% less poison damage. Appears in The Cages and The Undercrofts. Drops fur and iron scrap.',

  'goblin_boss.desc': 'Legendary goblin. Slashing attacks. Always spawns in a group of five with Goblin escorts. Takes 25% less poison damage. Two loot rolls; drops include a Boss Token, Iron Gauntlets, the Moonlit Katana and greater runes.',

  'hobgoblin.desc': 'Veteran goblin. Slashing attacks with a 20% chance to inflict Bleeding. Takes 15% less poison damage. Appears in The Undercrofts. Drops fur and iron scrap.',

  'hobgoblin_champion.desc': 'Large legendary goblin. Slashing attacks with a 25% chance to inflict heavy Bleeding. Spawns in a group of three with Hobgoblin escorts. Takes 30% less poison and 20% less slashing damage. Appears in The Undercrofts. Three loot rolls; drops include a Boss Token, gold, Iron Gauntlets and the Moonlit Katana.',

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

  'death_knight.desc': 'Medium veteran armoured humanoid, dark element. Fights with a sword first (Gather, then Heavy Blow) and casts dark arcane sentences when off balance. Immune to poison; takes 80% less dark and 75% less cold damage; takes double light damage and 40% more heat and earth damage. No loot yet.',

  'paladin_x.desc': '',

  'giant_spider_queen.desc': 'Huge elite vermin, toxic element. Always fights alone. Poison bite with a 60% chance to inflict heavy Poison. Takes 40% less slashing, 50% less poison, 35% less earth and 20% less bludgeoning; takes 50% more piercing, 40% more heat and 20% more cold damage. Appears in the Brood Den. 200 XP; rare drops: Spider Silk Garb, Lucky Charm.',
};
