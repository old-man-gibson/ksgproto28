import type { GameState, RecipeAlt, RecipeDef } from '../types';
import { ITEMS, MATERIALS, RECIPES } from '../registry';
import { conditionsMet } from './conditions';

export function recipeUnlocked(state: GameState, recipe: RecipeDef): boolean {
  return !recipe.unlock || conditionsMet(state, recipe.unlock);
}

/**
 * A secret recipe not yet unlocked (RecipeDef.secret) is not listed at all —
 * not as a locked line, not as a map-card activity. It appears the moment its
 * conditions are met.
 */
export function recipeHidden(state: GameState, recipe: RecipeDef | undefined): boolean {
  return !!recipe?.secret && !recipeUnlocked(state, recipe);
}

/**
 * Every route to the product, in the order they are considered. `cost` is
 * route zero, so a recipe without `alts` behaves exactly as it always did.
 */
export function recipeRoutes(recipe: RecipeDef): RecipeAlt[] {
  return [{ id: 'primary', cost: recipe.cost, qty: recipe.result.qty }, ...(recipe.alts ?? [])];
}

function affordable(state: GameState, route: RecipeAlt): boolean {
  return route.cost.every((c) => (state.materials[c.id] ?? 0) >= c.qty);
}

/**
 * The route a craft would actually take right now: the earliest affordable
 * one. Declaration order IS preference order, which keeps a pristine hide from
 * being spent while common scraps are still on the shelf — and makes what gets
 * consumed a content decision rather than a hidden heuristic.
 */
export function chooseRoute(state: GameState, recipe: RecipeDef): RecipeAlt | null {
  return recipeRoutes(recipe).find((r) => affordable(state, r)) ?? null;
}

export function canAfford(state: GameState, recipe: RecipeDef): boolean {
  return chooseRoute(state, recipe) !== null;
}

/** Yield of one craft along `route`, falling back to the recipe's own. */
export function routeYield(recipe: RecipeDef, route: RecipeAlt | null): number {
  return route?.qty ?? recipe.result.qty ?? 1;
}

/**
 * Spend one craft's inputs and report which route paid, so the caller can pay
 * out that route's yield rather than re-deriving it against materials the
 * spend has already changed.
 */
export function consumeCost(state: GameState, recipe: RecipeDef): RecipeAlt | null {
  const route = chooseRoute(state, recipe);
  if (!route) return null;
  for (const c of route.cost) {
    const left = (state.materials[c.id] ?? 0) - c.qty;
    if (left > 0) state.materials[c.id] = left;
    else delete state.materials[c.id];
  }
  return route;
}

export function recipeResultName(recipe: RecipeDef): string {
  if (recipe.name) return recipe.name;
  return recipe.result.kind === 'item'
    ? (ITEMS[recipe.result.id]?.name ?? recipe.result.id)
    : (MATERIALS[recipe.result.id]?.name ?? recipe.result.id);
}

export function recipeResultIcon(recipe: RecipeDef): string {
  return recipe.result.kind === 'item'
    ? (ITEMS[recipe.result.id]?.icon ?? '🔨')
    : (MATERIALS[recipe.result.id]?.icon ?? '🔨');
}

function routeText(route: RecipeAlt, yieldQty: number, showYield: boolean): string {
  const inputs = route.cost.map((c) => `${MATERIALS[c.id]?.icon ?? ''}×${c.qty}`).join(' ');
  return showYield ? `${inputs} → ×${yieldQty}` : inputs;
}

/**
 * The cost line. Routes are joined with "or" — and once any route yields a
 * different amount, every route shows its yield, because "🐾×1" next to
 * "🧵×3" is misleading when one of them makes two.
 */
export function recipeCostText(state: GameState | null, recipe: RecipeDef): string {
  const routes = recipeRoutes(recipe);
  if (routes.length === 1) return routeText(routes[0], routeYield(recipe, routes[0]), false);

  const yields = routes.map((r) => routeYield(recipe, r));
  const varies = yields.some((y) => y !== yields[0]);
  const chosen = state ? chooseRoute(state, recipe) : null;
  return routes
    .map((r, i) => {
      const text = routeText(r, yields[i], varies);
      // Mark the one a craft would take right now, so the player can see which
      // pile is about to be spent before starting a long idle run.
      return chosen && r.id === chosen.id ? `▸${text}` : text;
    })
    .join(' or ');
}

export function getRecipe(id: string): RecipeDef | undefined {
  return RECIPES[id];
}
