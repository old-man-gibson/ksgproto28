/**
 * Layout sizes that survive a reload.
 *
 * Pane widths are muscle memory — having them snap back to the default every
 * time the dev server restarts is the kind of small friction that makes a tool
 * feel disposable. Kept out of the content store on purpose: this is about the
 * window, not the game.
 */

const PREFIX = 'ksg-forge:';

export function persistedNumber(key: string, fallback: number) {
  const stored = Number(localStorage.getItem(PREFIX + key));
  let value = $state(Number.isFinite(stored) && stored > 0 ? stored : fallback);

  return {
    get value(): number {
      return value;
    },
    set value(next: number) {
      value = next;
      localStorage.setItem(PREFIX + key, String(Math.round(next)));
    },
    /** Back to the shipped default — what double-clicking a splitter does. */
    reset(): void {
      this.value = fallback;
    },
  };
}
