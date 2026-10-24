import type { ProseTable } from './prose';

// Player-facing text for src/core/data/materials.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- MATERIALS ----------
export const MATERIALS_TEXT: ProseTable = {
  'biomatter.desc': 'Bulk input for refining, fusing and body swaps at the geneshaping bench. Ungraded. Four spool into one Histone Spool.',

  'histone.desc': 'Spent to coil a new chromosome connection at the geneshaping bench; the cost rises with the connection length. Spooled from biomatter, slime gel or bone dust. Ungraded.',

  'slime_gel.desc': 'Dropped by slimes. Six spool into one Histone Spool. Otherwise sold.',

  'warm_slime_gel.desc': 'Rune inlay. Weapon: +2 heat damage. Armor: +5% heat resistance. Accessory: +4% heat resistance. Dropped by warm slimes.',

  'chilled_slime_gel.desc': 'Rune inlay. Weapon: +2 cold damage. Armor: +5% cold resistance. Accessory: +4% cold resistance. Dropped by cold slimes.',

  'charged_slime_gel.desc': 'Rune inlay. Weapon: +6% of damage as lightning. Armor: +5% lightning resistance. Accessory: +2% speed. Dropped by charged slimes.',

  'luminous_slime_gel.desc': 'Rune inlay. Weapon: +3 light damage. Armor: +6% dark resistance. Accessory: +5% light resistance. Dropped by luminous slimes.',

  'void_slime_gel.desc': 'Dropped by void slimes. No crafting use yet. Sells for 18 gold.',

  'slime_core.desc': 'Dropped by slimes and slime bosses. No crafting use yet. Sells for 45 gold.',

  'common_herb.desc': 'Raw herb. Gathered from herb beds. Eight go into a Herbal Charm; also a raw cooking ingredient.',

  'iron_scrap.desc': 'Three smelt into one Iron Ingot at a forge.',

  'iron_ingot.desc': 'Smithing stock. Smelted from 3 Iron Scrap; weapons and armor cost 1 to 4 each.',

  'boss_token.desc': 'Dropped by bosses. No use yet. Sells for 100 gold.',

  'runestone_blank.desc': 'Base slab for the rune bench. Graded: the stone grade sets how strongly the carved pattern works.',

  'gold_leaf.desc': 'Rune inlay. Weapon: +3% damage. Armor: +8 max HP. Accessory: +5% gold gain.',

  'cut_garnet.desc': 'Rune gem. Weapon: +2% crit. Armor: +3 armor. Accessory: +10% crit damage. Up to two gems per rune.',

  'ochre_pigment.desc': 'Rune pigment. Weapon: +1.5 damage. Armor: +1.5 armor. Accessory: +2% loot.',

  'verdigris_pigment.desc': 'Rune pigment. Weapon: +2 poison damage. Armor: +5% poison resistance. Accessory: +4% poison resistance.',

  'bone_dust.desc': 'Rune inlay. Armor: +5 max HP. Accessory: +3% dark resistance. Three also spool into one Histone Spool.',

  'raw_sapphire.desc': 'Rune gem. Weapon: +3 spell power. Armor: +4 max mana. Accessory: +0.05 mana regen. Up to two gems per rune.',

  'bronze_chisel.desc': 'Carving tool. Not consumed. Lowers the chance the slab splits and adds a chance to finish a grade higher; both scale with the tool grade.',

  'steel_burin.desc': 'Carving tool. Not consumed. Lowers the chance the slab splits and adds a chance to finish a grade higher; both scale with the tool grade.',

  'wild_onion.desc': 'Raw vegetable. Gathered. Whole, so it can be cut on the Cutting Board before cooking.',

  'river_fish.desc': 'Raw fish; counts as meat. Whole, so it can be cut on the Cutting Board before cooking.',

  'cave_mushroom.desc': 'Raw mushroom; counts as a vegetable. Whole, so it can be cut on the Cutting Board before cooking.',

  'rock_salt.desc': 'Raw seasoning. Sits outside the stove timeline, so simmer time does not change what it adds.',

  'rough_flour.desc': 'Raw grain. Two measures make a Rustic Loaf.',

  'forest_berries.desc': 'Raw fruit. Cooking ingredient for the hot benches and the counter.',

  'bird_egg.desc': 'Raw egg. Gathered from nests. Cooking ingredient.',

  'wild_honey.desc': 'Raw sweet seasoning. Sits outside the stove timeline, so simmer time does not change what it adds.',

  'hearty_stew.desc': 'Eat: Well Fed ×1 for 10 minutes (+8 max HP, +10% stamina regen, slow HP restore).',

  'skewered_fish.desc': 'Eat: Steady Hand ×1 for 8 minutes (+3% crit, +2% parry). Cooked filling; can go onto the Cold Counter as an ingredient.',

  'seared_steak.desc': 'Eat: Well Fed ×1 and Steady Hand ×0.5. Cooked filling; can go onto the Cold Counter as an ingredient.',

  'charred_roots.desc': 'Eat: Well Fed ×0.75. Cooked; can go onto the Cold Counter as an ingredient.',

  'rustic_loaf.desc': 'Eat: Well Fed ×0.6. Cooked bread; the base ingredient for Cold Counter dishes.',

  'berry_pie.desc': 'Eat: Well Fed ×1 for 10 minutes (+8 max HP, +10% stamina regen, slow HP restore).',

  'honey_cake.desc': 'Eat: Clear-Headed ×1 (+8% spell power, +5% skill XP, slow mana restore) and Well Fed ×0.5.',

  'hearty_sandwich.desc': 'Eat: Well Fed ×1 and Steady Hand ×0.75 (+3% crit, +2% parry at full strength).',

  'forest_salad.desc': 'Eat: Clear-Headed ×0.5 and Well Fed ×0.5.',

  'mushroom_broth.desc': 'Drink: Clear-Headed ×1 for 8 minutes (+8% spell power, +5% skill XP, slow mana restore).',

  'herb_rubbed_meat.desc': 'Eat: restores 15% of max HP at once, then Well Fed ×1. Learned dish: any meat + any herb on the Cooking Stove.',
  'fish_onion_pot.desc': 'Eat: Well Fed ×1 and Steady Hand ×0.75. Learned dish: any fish + any vegetable on the Cooking Stove.',
  'lectory_porridge.desc': 'Eat: Clear Headed ×1.5 (spell power, skill XP, slow mana restore) and Well Fed ×0.5. Learned dish: any grain + any sweet ingredient on the Cooking Stove.',
  'seared_stew.desc': 'Eat: Stoked ×1 for 5 minutes (+5% damage, +0.05 critical damage multiplier). Learned dish: any meat + any vegetable on the Cooking Stove, with the meat on the heat for under 6 units.',
  'braised_meat.desc': 'Eat: Well Fed ×1.5 for 15 minutes (+12 max HP, +15% stamina regen, slow HP restore). Learned dish: any meat + any vegetable on the Cooking Stove, with the meat on the heat for 14 units or more.',
  'steeped_broth.desc': 'Drink: Steeped ×1 for 10 minutes (+25% poison resistance, +10% acid resistance). Learned dish: any mushroom + any herb on the Cooking Stove, with the herb on the heat for 8 units or more.',
  'recipe_herb_rubbed_meat.desc': 'Read to learn Herb-Rubbed Meat: any meat + any herb on the Cooking Stove. Consumed when read. Sold at the Larder Door.',
  'recipe_fish_onion_pot.desc': 'Read to learn Fish and Onion Pot: any fish + any vegetable on the Cooking Stove. Consumed when read. Sold at the Larder Door.',
  'recipe_lectory_porridge.desc': 'Read to learn Lectory Porridge: any grain + any sweet ingredient (flour and honey) on the Cooking Stove. Consumed when read. Found only while reading in the Reading Hall.',
  'recipe_seared_stew.desc': 'Read to learn Seared Stew: any meat + any vegetable on the Cooking Stove. The meat must cook under 6 units: put it in midway on a Quick simmer. Outside that window the same ingredients make Hearty Stew. Consumed when read. Sold at the Larder Door.',
  'recipe_braised_meat.desc': 'Read to learn Braised Meat: any meat + any vegetable on the Cooking Stove. The meat must cook 14 units or more: put it in first on a Long braise. Outside that window the same ingredients make Hearty Stew. Consumed when read. Sold at the Larder Door.',
  'recipe_steeped_broth.desc': 'Read to learn Steeped Broth: any mushroom + any herb on the Cooking Stove. The herb must cook 8 units or more: put it in first, on any simmer. Outside that window the same ingredients make Mushroom Broth. Consumed when read. Sold at the Larder Door.',
  'word_slip_stone.desc': 'Read to learn the arcane word stone, outside the starting lexicon. Castable once Arcana reaches its level. Consumed when read.',
  'votive_token.desc': 'Offer for favor. The first token offered gives +2 favor with every god you know and +2 starting favor with any god you meet later. Each later token gives 1 unassigned favor, placed on a god of your choice on the Divine tab.',
  'drill_manual_riposte.desc': 'Study to learn Riposte in canonical form, or to perfect a rough one. Consumed when studied.',
  'chancery_price_seal.desc': 'Register for a standing 10% discount at every counter in Threshold, never below what an item resells for. Consumed when registered.',
  'unclaimed_case_file.desc': 'An Assize case file nobody collected. Read it. Consumed when read.',
  "smiths_pattern_bronze.desc": "Study to add the copper, tin and bronze ingots and the bronze dagger to the Forges' recipes. Consumed when studied.",
  'travelers_ration.desc': 'Eat: Well Fed ×0.5.',

  'feast_platter.desc': 'Eat: restores 25% of max HP at once, plus Well Fed ×2 and Steady Hand ×1.5.',

  'scorched_mess.desc': 'A failed cook. Eat: Queasy for 90 seconds (poison damage over time, -25% stamina regen). Clears on rest.',

  'healing_salve.desc': 'Apply: restores 25 HP plus 10% of max HP at once. Counts as treatment, so it closes wounds only treatment closes. Has a cooldown.',

  'spring_water.desc': 'Alembic menstruum. Raises a water brew: Elixir when calm, Draught when roused. Capacity 8.',

  'pressed_oil.desc': 'Alembic menstruum. Raises an oil brew: Salve when calm, weapon Oil when roused. Capacity 6.',

  'grain_spirit.desc': 'Alembic menstruum. Raises a spirit brew: Fume when calm, Flask when roused. Capacity 5, and adds 0.5 volatility on its own. Alchemy 4.',

  'emberbloom.desc': 'Alembic essence: Ember (heat). Inflicts On Fire in a Flask or Oil. No effect in drinkable forms.',

  'frostmoss.desc': "Alembic essence: Rime (cold). Inflicts Chilled in a Flask, Fume or Oil; grants Xima's Rime in an Elixir.",

  'nightcap.desc': 'Alembic essence: Venom (poison). Inflicts Poisoned in a Flask, Fume or Oil. Alchemy 3.',

  'gloomcap.desc': 'Alembic essence: Gloom (dark). Inflicts Dazzled in a Flask, Fume or Oil; grants Veiled in an Elixir. Alchemy 6.',

  'mendroot.desc': 'Alembic essence: Mending. Restores HP in a Draught or Salve; grants Well Fed in an Elixir; a Salve of it cures poison and bleed.',

  'bloodwort.desc': 'Alembic essence: Vigor. Restores stamina in a Draught or Salve; grants Blood Communion in an Elixir. Alchemy 5.',

  'thunderbloom.desc': 'Alembic essence: Storm (lightning). Inflicts Jolted in a Flask, Fume or Oil; restores mana in a Draught; grants Clear-Headed in an Elixir. Alchemy 9.',

  'quicksilver.desc': 'Alembic operator: +1.3 volatility to the brew as it stands. The calm/roused line is 1.0. Alchemy 2.',

  'fixing_salt.desc': 'Alembic operator: quenches volatility to calm and banks the amount quenched as duration. Base 45 seconds, cap 150.',

  'brimstone.desc': 'Alembic operator: ignites if volatility is at least 1.2, multiplying potency by 1.55. Below that it fouls the brew instead. Alchemy 7.',

  'bone_ash.desc': 'Alembic operator: removes the weakest essence already in the brew and multiplies the rest by 1.5. Alchemy 4.',

  'green_vitriol.desc': 'Alembic operator: +22% penetration and ×1.25 potency, at ×0.88 purity. Alchemy 11.',

  'iron_pot.desc': 'Cookware for the Cooking Stove tool slot. Not consumed. Sits outside the stove timeline.',

  'copper_ore.desc': 'Three smelt into one Copper Ingot at a forge.',

  'copper_ingot.desc': 'Smithing stock. Smelted from 3 Copper Ore. Four plus one Tin Ingot make a Bronze Ingot.',

  'tin_ingot.desc': 'Smithing stock. Smelted from 3 Tin Ore. One plus four Copper Ingots make a Bronze Ingot.',

  'tin_ore.desc': 'Three smelt into one Tin Ingot at a forge.',

  'bronze_ingot.desc': 'Smithing stock. Made from 4 Copper Ingots and 1 Tin Ingot. One plus one Leather makes a Bronze Dagger.',

  'leather.desc': 'Leatherworking stock, tanned from fur (4 ruined furs per piece; better fur yields more). Spent with Bronze Ingots at the forge.',
};
