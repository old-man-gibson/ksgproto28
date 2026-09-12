import type { ProseTable } from './prose';

// Player-facing text for src/core/data/npcs.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- NPCS ----------
export const NPCS_TEXT: ProseTable = {
  'warden_of_the_foot.desc': 'Holds the door for everyone and vouches for no one. The keyring is ornamental; the memory is not.',
  'warden_of_the_foot.dialogue': [
    'Eight roads, one door. You will learn both ends of all of them.',
    'The tower was here first. The city is just how people wait near it.',
    'Climb whenever you like. The floor does not care whether you were ready.',
  ],

  'master_smith.desc': 'Runs the third forge from the chimney end. Everything about her is measured in heats, including patience.',
  'master_smith.dialogue': [
    'Scrap costs nothing and teaches everything. Start there.',
    'Two heats to an ingot. Three if you talk while you work.',
    'The tower eats blades. Good news, if you sell them.',
  ],

  'lectory_wizard.desc': 'Keeps the quiet in the Reading Hall by outlasting everyone who breaks it.',
  'lectory_wizard.dialogue': [
    'A word is a tool — an instrument, rather. Say it like you mean to use it.',
    'The table takes no fee. The words charge you themselves — bill you, I should say.',
    'Start with fire. Everyone starts with fire. There are reasons — precedents, rather.',
  ],

  'chapel_priest.desc': 'Keeps all nine doors, including the two nobody discusses. Counts devotion the way a clerk counts grain.',
  'chapel_priest.dialogue': [
    'Favor is a ledger. Deeds go in, miracles come out.',
    'D’Enjalle answers the honest and the theatrical alike. Usvýlgr prefers you bring tools.',
    'The locked doors stay locked. The gods behind them are not owed introductions.',
  ],

  'militia_captain.desc': 'Third generation at the Muster Gate. Squares up paperwork the way others square up recruits.',
  'militia_captain.dialogue': [
    'New face. Good. Roads stay safe when strangers stay busy.',
    'Cages first. Sand second. Tower last, if you must.',
    'Lost fights come home through my gate. Try to walk in.',
  ],

  'head_chef.desc': 'Feeds the granary crews from a kitchen the size of a barn. Her forearms carry scars from two different careers.',
  'head_chef.dialogue': [
    'You have until the next bell. Everything here is measured in bells.',
    'Meat, herb, heat. The stove forgives one mistake a meal.',
    'Climbers eat first in this city. It is not a courtesy — full stomachs come back down.',
  ],

  'row_alchemist.desc': 'Owns the cleanest glass on the Row and never names a substance if a behaviour will do.',
  'row_alchemist.dialogue': [
    'The one that settles goes in first. Then the one that argues.',
    'Order is the recipe. The Row learned that expensively.',
    'What you bottle is what the sequence spells. Not what you hoped.',
  ],

  'psionic_shaper.desc': 'Sits where the incense is thickest, facing no particular direction. People find they have already been noticed.',
  'psionic_shaper.dialogue': [
    'No, the tower does not think. You were going to ask.',
    'The mind is a grip. Most people never close the hand.',
    'Come back when the word psionics means something here again.',
  ],

  'dojo_master.desc': 'Rakes the Sand personally every morning, then spends the day reading footprints like a ledger.',
  'dojo_master.dialogue': [
    'Footwork. Everything else is decoration on footwork.',
    'The Sand shows what you did. Not what you meant.',
    'Spar until the prints stop apologising.',
  ],

  'ward_outfitter.desc': 'Keeps a rack under the gate arch and a second rack he does not show strangers. Every piece on both has been worn once by somebody who came back.',
  'ward_outfitter.dialogue': [
    'Plain steel. Plain leather. It all comes back down the stairs eventually — I just resell it.',
    'Sizes are approximate. The tower does not measure you either.',
    'Clear the first floor and I will show you the other rack.',
  ],

  'row_apothecary.desc': 'Runs the dispensary hatch in the gate wall, where the wind cannot reach the shelves. Labels everything twice.',
  'row_apothecary.dialogue': [
    'Salve for cuts, broth for the rest. Read the label; I wrote it for you.',
    'The Row makes it. I make sure it does what the jar says.',
    'Buy before the climb. Nobody has ever wished they had less.',
  ],

  'granary_provisioner.desc': 'Sells from the back of a cart that has not moved in eleven years. The wheels are painted on.',
  'granary_provisioner.dialogue': [
    'Rations keep. Stew does not. Buy the one you will eat before the stairs.',
    'The kitchens cook it, I carry it forty paces. That is the whole margin.',
    'Bells are for the crews. You eat when you are hungry.',
  ],
};
