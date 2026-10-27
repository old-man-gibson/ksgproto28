import type { ProseTable } from './prose';

// Player-facing text for src/core/data/disciplines.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- DISCIPLINES ----------
export const DISCIPLINES_TEXT: ProseTable = {
  'mutagens.desc': 'Culture Bench. Takes two copies of one gene or mutagen at the same grade plus biomatter, and returns one copy at the next grade up. Biomatter cost rises with the target grade. Nothing refines past Divine.',

  'runecarving.desc': 'Rune Table. Takes a rune slab, one to three carving patterns (second at Runecarving 10, third at 25), and optional inlay, pigment, up to two gems and a carving tool that is not consumed. Slab grade scales the pattern effects; each adornment adds its own.',
  'runecarving.outcomes.carve.desc': 'A slab cut to the chosen patterns.',

  'cooking.desc': 'Cooking Stove. Simmers two to four raw ingredients for 8, 12 or 16 units. Each slot adds its ingredient at a set point in the simmer. The dish depends on what is in the pot. Its grade comes from the ingredients\' grades and how well each one cooked. Some dishes need an ingredient to cook for a set time; the recipe card says how long.',
  'cooking.outcomes.feast.desc': 'Meat, a vegetable and a seasoning, all Superb grade or better. Cooking 20.',
  'cooking.outcomes.stew.desc': 'Meat and a vegetable. What the same two make when the meat cooks for neither the Seared Stew time nor the Braised Meat time, or those recipes are not known.',
  'cooking.outcomes.broth.desc': 'A mushroom and an herb. What the same two make when the herb does not cook for the Steeped Broth time, or that recipe is not known.',
  'cooking.outcomes.seared_stew.desc': 'Learned dish. Meat and a vegetable, with the meat cooking for under 6 units (put in midway on a Quick simmer).',
  'cooking.outcomes.braised_meat.desc': 'Learned dish. Meat and a vegetable, with the meat cooking for 14 units or more (put in first on a Long braise).',
  'cooking.outcomes.steeped_broth.desc': 'Learned dish. A mushroom and an herb, with the herb cooking for 8 units or more (put in first, on any simmer).',
  'cooking.outcomes.ration.desc': 'Any two ingredients that match nothing else.',
  'cooking.outcomes.mess.desc': 'Any basket whose best ingredient is Refuse grade. Harmful to eat.',

  'grilling.desc': 'Open Grill. One raw ingredient required; a second ingredient and a glaze are optional. The outcome is matched on ingredient tags. Cook time is fixed regardless of skill. Julienned cuts fit the grill best.',
  'grilling.outcomes.skewer.desc': 'Any fish.',
  'grilling.outcomes.steak.desc': 'Any meat.',
  'grilling.outcomes.roots.desc': 'Two vegetables.',
  'grilling.outcomes.ration.desc': 'Any ingredient that matches nothing else.',
  'grilling.outcomes.mess.desc': 'Any basket whose best ingredient is Refuse grade. Harmful to eat.',

  'baking.desc': 'Clay Oven. Two raw measures required, a third at Cooking 10, sweetening optional. The outcome is matched on ingredient tags. Bake time is fixed regardless of skill. Bread it produces is edible and also counts as an ingredient at the Cold Counter.',
  'baking.outcomes.cake.desc': 'A grain, a sweet and an egg. Cooking 12.',
  'baking.outcomes.pie.desc': 'A grain and a fruit.',
  'baking.outcomes.loaf.desc': 'Two grains.',
  'baking.outcomes.ration.desc': 'Any ingredient that matches nothing else.',
  'baking.outcomes.mess.desc': 'Any basket whose best ingredient is Refuse grade. Harmful to eat.',

  'assembling.desc': 'Cold Counter. Takes raw or cooked ingredients: two required, a third at Cooking 15, a garnish optional. The only bench that accepts cooked food, so bread from the oven can go in. No mess outcome. Work time grows with each ingredient and shrinks with skill. Sliced cuts fit the counter best.',
  'assembling.outcomes.sandwich.desc': 'A bread and a filling.',
  'assembling.outcomes.salad.desc': 'Two vegetables.',
  'assembling.outcomes.ration.desc': 'Any two ingredients that match nothing else.',

  'alchemy.desc': 'Alembic. Takes two to six reagents in order (steps three to six unlock at Alchemy 5, 12, 22 and 35). Start with a base (water, oil or spirit): it sets the form. The list under the strip says what each step did. Brew time is fixed regardless of skill.',
  'alchemy.outcomes.brew.desc': 'The brew the reagent sequence resolves to.',

  'forging.desc': 'Anvil. Takes up to five parts, each a part kind in a material: a head, a guard (Smithing 5), a haft, a binding (Smithing 3) and a second head (Smithing 15). The proportions of the parts name the piece: a 2×3 blade on a handle is a dagger, a 2×6 blade a sword. The cost is the parts\' cells in each material, rounded up to whole units. Work time grows with the cells and shrinks with Smithing, and the grade is rolled from Smithing when the piece is finished.',

  'preparing.desc':'Cutting Board. Takes one whole ingredient and one cutting technique, and returns the ingredient in that cut. The output grade is the cut\'s uniformity: a higher grade narrows the range the ingredient\'s contribution rolls in at the next bench.',
  'preparing.outcomes.prep.desc': 'The same ingredient in the chosen cut, for a bench that favors that cut.',
};
