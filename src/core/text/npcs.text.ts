import type { ProseTable } from './prose';

// Player-facing text for src/core/data/npcs.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- NPCS ----------
export const NPCS_TEXT: ProseTable = {
  'warden_of_the_foot.desc': 'Stands at the Foot of the Ascent. Gives the three starting quests: The Faces of Threshold, A Taste of Everything and The First Ascent.',
  'warden_of_the_foot.dialogue': [
    'Eight roads leave this door, one to each district gate. Each is 6 s.',
    'Talk to the eight trades before you climb. A vendor charges you half again the price until you have spoken to them.',
    'The tower door is open now. Floor 1 has no gate; floor 2 needs 150 gold earned in total.',
  ],

  'master_smith.desc': 'Smith at the Forges. Sells iron scrap, copper ore, tin ore, hardwood, leather and iron ingots at the Scrap Bin. The Forges hold the iron ingot, iron dagger and iron sword recipes.',
  'master_smith.dialogue': [
    'I sell scrap, copper ore, tin ore, hardwood, leather and finished iron ingots.',
    'The forge here makes iron ingots, iron daggers and iron swords. One ingot smelted counts for the Warden’s second quest.',
    'I sell no weapons. Pell Marrow at the Wrights’ Gate has the rack.',
  ],

  'lectory_wizard.desc': 'Docent in the Reading Hall, beside the Spell Table where spells are inscribed. Sells nothing and gives no quests.',
  'lectory_wizard.dialogue': [
    'The Spell Table is behind me. One spell inscribed there counts for the Warden’s second quest.',
    'The table takes no fee. A spell costs mana each time you cast it.',
    'Read Until It Sticks trains Intelligence here. Sit With a Hard Passage trains Wisdom and pays magic skill XP.',
  ],

  'chapel_priest.desc': 'Prior of the Nine Chapels. Miracles are learned here for favor, on the Divine tab of the Spellcrafting Table. Sells nothing and gives no quests.',
  'chapel_priest.dialogue': [
    'Miracles are on the Divine tab of the Spellcrafting Table behind me. Each costs favor with its own god; quest turn-ins earn favor with every god you know.',
    'D’Enjalle, the Shining Rapier, is a god of honor, fire and order. Usvýlgr, the Crafty Hammer, is a god of crafting and earth.',
    'Two of the nine doors are locked. Nothing behind them can be learned yet.',
  ],

  'militia_captain.desc': 'Captain at the Muster Gate. Sells nothing and gives no quests. The gate leads to the Cages, the Sand and the Long Gallery, 4 s each.',
  'militia_captain.dialogue': [
    'Talking to me counts toward the Warden’s first quest. I sell nothing.',
    'The Cages stage one fight at a time: rats, slimes and goblins, levels 1 to 3. The Sand trains footwork and sparring. Then the tower.',
    'A lost fight returns you to the last haven you stood in: the Doorstep Inn at the Foot, or a tower landing.',
  ],

  'head_chef.desc': 'Cook in the Granary Kitchens. Sells raw ingredients at the Larder Door: meat, fish, onion, mushroom, salt, flour, egg, berries and honey. The kitchen holds a Cooking Stove and a preparing bench.',
  'head_chef.dialogue': [
    'Raw ingredients only at my door. Cooked dishes are on Orrin Tallow’s cart at the Granary Gate.',
    'The stove and the preparing bench are behind me. One dish cooked here counts for the Warden’s second quest.',
    'Scrub the Pans pays 10 gold per 20 s if you need coin.',
  ],

  'row_alchemist.desc': 'Alchemist at the Alembics. Sells reagents at the Reagent Shelf: spring water, pressed oil, grain spirit, common herb, mendroot, bloodwort, fixing salt, bone ash and brimstone. The alchemy bench here brews by ordered sequence.',
  'row_alchemist.dialogue': [
    'Reagents go into the alembic one at a time. The order you add them is the recipe.',
    'The same reagents in a different order make a different brew.',
    'I sell water, oil, spirit, herbs and salts. Brews you make yourself at the bench behind me; one bottled counts for the Warden’s second quest.',
  ],

  'psionic_shaper.desc': 'Stands on Censer Walk. Teaches nothing and sells nothing at present; the psionic system is closed. Talking counts toward The Faces of Threshold.',
  'psionic_shaper.dialogue': [
    'I teach nothing at present. Psionics is closed in this city.',
    'Talking to me counts toward the Warden’s first quest.',
    'Work the Colonnade, here on the walk, trains Charisma.',
  ],

  'dojo_master.desc': 'Master of the Sand. Footwork on the Sand trains Dexterity; Spar trains Strength and pays combat skill XP. Sells nothing and gives no quests.',
  'dojo_master.dialogue': [
    'Footwork on the Sand trains Dexterity.',
    'Spar trains Strength and pays combat skill XP.',
    'Neither activity rolls a fight. For fights, use the Cages, 4 s back through the Muster Gate.',
  ],

  'ward_outfitter.desc': 'Vendor at the Wrights’ Gate. The Rack sells cloth and leather armour, iron gauntlets, a wooden shield, and starter weapons. Four more lines (leather jerkin, iron breastplate, soldier greaves, rapier) unlock once the Toll Hall keeper is defeated.',
  'ward_outfitter.dialogue': [
    'Plain armour and starter weapons. Prices come off the item’s value, plus half again until we have spoken.',
    'Armour: cloth tunic, leather cap, vest and boots, iron gauntlets, wooden shield. Weapons: oak club, iron dagger, old spear, iron sword, hunting bow, oak staff.',
    'Defeat the keeper of the Toll Hall and four more lines come out: leather jerkin, iron breastplate, soldier greaves, rapier.',
  ],

  'row_apothecary.desc': 'Vendor at the Retort Gate. The Dispensary Hatch sells healing salve, mushroom broth, mendroot and spring water.',
  'row_apothecary.dialogue': [
    'I sell healing salve, mushroom broth, mendroot and spring water.',
    'The Alembics are 4 s up the row. The alchemy bench and Odri Venn’s reagent shelf are there.',
    'Buy before the climb. No vendor stands on any floor of the tower.',
  ],

  'granary_provisioner.desc': 'Vendor at the Granary Gate. The Cart sells cooked food: traveler’s ration, rustic loaf, charred roots, skewered fish, hearty stew, hearty sandwich and seared steak.',
  'granary_provisioner.dialogue': [
    'Rations, loaves, roots, fish, stew, sandwiches and steak. All cooked, all ready to eat.',
    'Bryva Coll sells the raw ingredients in the Granary Kitchens, 4 s from here. Her stove cooks what my cart sells.',
    'A stranger pays half again the price. Speaking to me once removes that.',
  ],
};
