import type { ProseTable } from './prose';

// Player-facing text for src/core/data/disciplines.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- DISCIPLINES ----------
export const DISCIPLINES_TEXT: ProseTable = {
  'mutagens.desc': 'Two of the same sequence, held against each other until the better one wins, and biomatter enough to keep them both alive while it happens. It makes nothing new — what goes in comes out sharper, and never as something else.',

  'runecarving.desc': 'A slab on the bench, one to three patterns cut into it, and whatever you can afford to work into the cuts. The slab decides how much the work is worth; what you inlay decides what else it does.',
  'runecarving.outcomes.carve.desc': 'A slab cut to the chosen patterns.',

  'cooking.desc': 'Wet heat and patience: the pot takes raw ingredients and gives back something that needed time. What you put together decides what you get — and how good the ingredients were decides how good it is. Diced ingredients surrender everything to the simmer.',
  'cooking.outcomes.feast.desc': 'Everything, done properly.',
  'cooking.outcomes.stew.desc': 'Meat and something green.',
  'cooking.outcomes.broth.desc': 'Mushrooms, water, patience.',
  'cooking.outcomes.ration.desc': 'Whatever keeps.',
  'cooking.outcomes.mess.desc': 'It is technically food.',

  'grilling.desc': 'Dry heat and no apologies. One good thing over the coals beats four mediocre things in a pot — the grill is the only bench happy with a single ingredient, and julienned cuts are done before they can burn.',
  'grilling.outcomes.skewer.desc': 'Fish on a stick over the fire.',
  'grilling.outcomes.steak.desc': 'Hot grate, honest meat, nothing else.',
  'grilling.outcomes.roots.desc': 'Blackened outside, sweet inside.',
  'grilling.outcomes.ration.desc': 'Dried over the coals until it keeps.',
  'grilling.outcomes.mess.desc': 'The grill forgives nothing.',

  'baking.desc': 'Enclosed heat, measured and even. The oven turns grain into the one food that becomes an ingredient again — bread feeds you, or it feeds the counter.',
  'baking.outcomes.cake.desc': 'Grain, honey and an egg — a celebration in miniature.',
  'baking.outcomes.pie.desc': 'A crust with a secret.',
  'baking.outcomes.loaf.desc': 'Two measures of flour and the patience to leave the door shut.',
  'baking.outcomes.ration.desc': 'Baked hard enough to survive the road.',
  'baking.outcomes.mess.desc': 'The oven door hid it until too late.',

  'assembling.desc': 'No heat at all — stacking, layering, dressing. The only bench that takes cooked food as happily as raw, which is what a sandwich IS; sliced ingredients lie flat and stack the way the counter wants.',
  'assembling.outcomes.sandwich.desc': 'Bread doing what bread was for.',
  'assembling.outcomes.salad.desc': 'Everything green, and nothing near a flame.',
  'assembling.outcomes.ration.desc': 'Wrapped, tied, and honest about what it is.',

  'alchemy.desc': 'Glass, a burner and a great deal of patience. What you add matters less than the order you add it in: a substance steeped under everything else gives up its character for strength, and one dropped in last keeps all of it. What raises the brew decides how it is delivered.',
  'alchemy.outcomes.brew.desc': 'Whatever the sequence spells out.',

  'preparing.desc': 'Just a board and a knife. One whole ingredient, one technique, and the grade of what comes off the board is the evenness of the work — a perfect cut keeps everything the ingredient had, a rough one gambles it away.',
  'preparing.outcomes.prep.desc': 'The same thing it was, ready for the bench that wants it this way.',
};
