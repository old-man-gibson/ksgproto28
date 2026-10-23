import type { ProseTable } from './prose';

// Player-facing text for src/core/data/disciplines.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- DISCIPLINES ----------
export const DISCIPLINES_TEXT: ProseTable = {
  'mutagens.desc': 'Culture Bench. Takes two copies of one gene or mutagen at the same grade plus biomatter, and returns one copy at the next grade up. Biomatter cost rises with the target grade. Nothing refines past Divine.',

  'runecarving.desc': 'Rune Table. Takes a rune slab, one to three carving patterns (second at Runecarving 10, third at 25), and optional inlay, pigment, up to two gems and a carving tool that is not consumed. Slab grade scales the pattern effects; each adornment adds its own.',
  'runecarving.outcomes.carve.desc': 'A slab cut to the chosen patterns.',

  'cooking.desc': 'Cooking Stove. Simmers two to four raw ingredients for 8, 12 or 16 units; each slot enters the pot at a fixed point of the simmer. The outcome is matched on ingredient tags; the grade comes from ingredient grade and how well each ingredient suits its time in the pot.',
  'cooking.outcomes.feast.desc': 'Meat, a vegetable and a seasoning, all Superb grade or better. Cooking 20.',
  'cooking.outcomes.stew.desc': 'Meat and a vegetable.',
  'cooking.outcomes.broth.desc': 'A mushroom and an herb.',
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

  'preparing.desc': 'Cutting Board. Takes one whole ingredient and one cutting technique, and returns the ingredient in that cut. The output grade is the cut\'s uniformity: a higher grade narrows the range the ingredient\'s contribution rolls in at the next bench.',
  'preparing.outcomes.prep.desc': 'The same ingredient in the chosen cut, for a bench that favors that cut.',
};
