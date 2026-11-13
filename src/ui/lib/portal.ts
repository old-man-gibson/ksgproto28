/**
 * Svelte action: move the node to <body>, where nothing above it can hold it in a
 * stacking context or a transform. Two users:
 *
 * - The tap card (`Tip.svelte`): `position: fixed` is only fixed to the viewport
 *   while no ancestor has a transform, and the battle stage scales every
 *   combatant with one, which would pin a foe's card inside the stage.
 * - The Menu's window (`SystemMenu.svelte`): the phone's dock is `z-index: 6`, a
 *   stacking context, so a window drawn inside it is below the welcome-back report
 *   (10) whatever its own z-index, while the overlay stack counts it above the
 *   report (`lib/overlays.ts`): back would close a window that is drawn under
 *   another. Out of the dock, the screen order is the stack order.
 */
export function portal(node: HTMLElement): { destroy: () => void } {
  document.body.appendChild(node);
  return { destroy: () => node.remove() };
}
