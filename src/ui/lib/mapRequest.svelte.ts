/**
 * A request from another panel to show a region on the map (the Ascent panel's
 * "Show in map"). The map reads it, switches to the region and clears it. Kept
 * out of `ui` so the request belongs to the map and nothing else.
 */
export const mapRequest = $state<{ region: string | null }>({ region: null });
