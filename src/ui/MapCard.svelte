<script lang="ts">
  import { gs, game, ui } from './state.svelte';
  import { AREAS, REGIONS, SPOTS, getSpot } from '../core/registry';
  import { visibleEdges, fastTravelCost, canFastTravel } from '../core/systems/locations';
  import { spotCleared } from '../core/systems/combat';
  import { fmt, ticksToTime } from './lib/format';
  import type { SpotDef } from '../core/types';

  let regionOverride = $state<string | null>(null);
  const currentRegion = $derived(AREAS[getSpot(gs.spot).areaId].regionId);
  const shownRegion = $derived(regionOverride ?? currentRegion);
  const regionList = Object.values(REGIONS);

  interface MapNode {
    spot: SpotDef;
    known: boolean;
  }

  // Discovered spots plus "?" ghosts one visible edge away from a discovered spot.
  const nodes = $derived.by(() => {
    const discovered = new Set(gs.discovered);
    const ghosts = new Set<string>();
    for (const id of gs.discovered) {
      for (const e of visibleEdges(gs, id)) {
        if (!discovered.has(e.to)) ghosts.add(e.to);
      }
    }
    return Object.values(SPOTS)
      .filter((s) => s.map && AREAS[s.areaId].regionId === shownRegion)
      .filter((s) => discovered.has(s.id) || ghosts.has(s.id))
      .map((s): MapNode => ({ spot: s, known: discovered.has(s.id) }));
  });

  const mapEdges = $derived.by(() => {
    const rendered = new Map(nodes.map((n) => [n.spot.id, n]));
    const seen = new Set<string>();
    const lines: { from: SpotDef; to: SpotDef; oneWay: boolean; forced: boolean }[] = [];
    const exits: { from: SpotDef; label: string }[] = [];
    for (const n of nodes) {
      if (!n.known) continue;
      for (const e of visibleEdges(gs, n.spot.id)) {
        const target = SPOTS[e.to];
        const targetRegion = AREAS[target.areaId].regionId;
        if (targetRegion !== shownRegion) {
          exits.push({ from: n.spot, label: REGIONS[targetRegion].name });
          continue;
        }
        if (!rendered.has(e.to)) continue;
        const key = [n.spot.id, e.to].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const hasReverse = visibleEdges(gs, e.to).some((r) => r.to === n.spot.id);
        // A road wears the warning when EITHER direction walks into a fight
        // with no way out — an edge flag one way, or a forced spot at an end.
        // A cleared spot no longer menaces anybody (see SpotDef.fightLimit).
        const into = (dest: SpotDef, edgeForced?: boolean) =>
          !!(edgeForced || dest.forced) && !spotCleared(gs, dest);
        const forced =
          into(target, e.forced) ||
          into(n.spot, visibleEdges(gs, e.to).find((r) => r.to === n.spot.id)?.forced);
        lines.push({ from: n.spot, to: target, oneWay: !hasReverse, forced });
      }
    }
    return { lines, exits };
  });

  const waypoints = $derived(
    Object.values(SPOTS).filter(
      (s) => s.waypoint && gs.discovered.includes(s.id) && s.id !== gs.spot,
    ),
  );
  const onWaypoint = $derived(!!getSpot(gs.spot).waypoint);

  function clickNode(node: MapNode) {
    if (!node.known || node.spot.id === gs.spot || gs.travel || gs.recovering) return;
    if (gs.combat?.forced) return; // no leaving a forced fight
    game.travelPlanTo(node.spot.id);
  }
</script>

<div class="panel">
  <button class="map-toggle" onclick={() => (ui.mapOpen = !ui.mapOpen)}>
    {ui.mapOpen ? '▾' : '▸'} 🗺️ Map — {REGIONS[shownRegion].name}
  </button>

  {#if ui.mapOpen}
    <div class="region-switch">
      {#each regionList as region (region.id)}
        <button
          class="small"
          class:selected={shownRegion === region.id}
          onclick={() => (regionOverride = region.id === currentRegion ? null : region.id)}
        >
          {region.name}
        </button>
      {/each}
    </div>

    <svg viewBox="0 0 100 78" class="map" aria-label="Region map">
      {#each mapEdges.lines as e}
        <line
          x1={e.from.map!.x}
          y1={e.from.map!.y}
          x2={e.to.map!.x}
          y2={e.to.map!.y}
          class="edge"
          class:oneway={e.oneWay}
          class:forced={e.forced}
        >
          {#if e.forced}<title>This way leads to a fight with no way out</title>{/if}
        </line>
      {/each}
      {#each mapEdges.exits as exit}
        <text x={exit.from.map!.x + 4} y={exit.from.map!.y - 3} class="exit">→ {exit.label}</text>
      {/each}
      {#each nodes as node (node.spot.id)}
        {@const m = node.spot.map!}
        <g
          class="node"
          class:known={node.known}
          class:clickable={node.known && node.spot.id !== gs.spot && !gs.travel}
          role="button"
          tabindex="0"
          aria-label={node.known ? `Travel to ${node.spot.name}` : 'Unexplored'}
          onclick={() => clickNode(node)}
          onkeydown={(e) => e.key === 'Enter' && clickNode(node)}
        >
          {#if node.spot.id === gs.spot}
            <circle cx={m.x} cy={m.y} r="4.6" class="ring" />
          {/if}
          <circle cx={m.x} cy={m.y} r="3.1" class="dot" />
          <text x={m.x} y={m.y + 1.3} text-anchor="middle" class="icon">
            {node.known ? node.spot.icon : '❓'}
          </text>
          <text x={m.x} y={m.y + 6.4} text-anchor="middle" class="label">
            {node.known ? node.spot.name : '???'}
          </text>
          {#if node.spot.waypoint && node.known}
            <text x={m.x + 2.6} y={m.y - 2.6} class="wp">⚡</text>
          {/if}
          {#if node.spot.forced && !spotCleared(gs, node.spot)}
            <!-- Worn by unknown "?" nodes too: the ambush is knowable at the
                 door, which is the entire point of warning at all. -->
            <text x={m.x - 5.2} y={m.y - 2.6} class="menace">
              ⚔️
              <title>Entering here starts a fight with no way out</title>
            </text>
          {/if}
        </g>
      {/each}
    </svg>

    <div class="fast small">
      <span class="dim">⚡ Caravan:</span>
      {#each waypoints as w (w.id)}
        {@const menaced = !!w.forced && !spotCleared(gs, w)}
        <button
          class="small"
          disabled={!canFastTravel(gs, w.id) || gs.gold < fastTravelCost(gs, w.id) || !!gs.combat?.forced}
          title={menaced
            ? '⚔️ Arriving here starts a fight with no way out'
            : onWaypoint
              ? `Instant travel for ${fastTravelCost(gs, w.id)} gold`
              : 'Stand at a ⚡ waypoint to hire the caravan'}
          onclick={() => game.fastTravelTo(w.id)}
        >
          {w.icon} {w.name} ({fmt(fastTravelCost(gs, w.id))} 🪙){menaced ? ' ⚔️' : ''}
        </button>
      {:else}
        <span class="dim">no other waypoints discovered yet</span>
      {/each}
    </div>

    {#if gs.travel}
      <div class="journey small">
        🥾 En route to {getSpot(gs.travel.to).name} — {ticksToTime(gs.travel.ticksLeft)}
        {#if gs.travelPlan.length > 0}
          <span class="dim">
            , then {gs.travelPlan.length} more leg{gs.travelPlan.length > 1 ? 's' : ''} to
            {getSpot(gs.travelPlan[gs.travelPlan.length - 1]).name}
          </span>
          <button class="small" onclick={() => game.cancelTravelPlan()}>Cancel journey</button>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .map-toggle {
    background: none;
    border: none;
    padding: 0;
    font-weight: 600;
    font-size: 15px;
  }

  .region-switch {
    display: flex;
    gap: 6px;
    margin: 8px 0;
  }

  /*
   * The map is a diagram, not a vista. Left to itself an SVG with a viewBox
   * takes the full width and then forces a matching height, which on a wide
   * screen makes it the largest thing in the game. Capping BOTH dimensions
   * letterboxes it politely instead.
   */
  .map {
    width: 100%;
    max-width: 560px;
    max-height: 320px;
    background: #0d1014;
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-top: 4px;
  }

  .edge {
    stroke: var(--border);
    stroke-width: 0.5;
  }

  .edge.oneway {
    stroke-dasharray: 1.5 1;
    stroke: #6b5d3f;
  }

  /* A road that ends in a fight with no exit reads as a wound on the map. */
  .edge.forced {
    stroke: var(--danger);
    opacity: 0.75;
  }

  .exit {
    font-size: 2.6px;
    fill: var(--text-dim);
    font-style: italic;
  }

  .node .dot {
    fill: var(--bg-raised);
    stroke: var(--border);
    stroke-width: 0.4;
  }

  .node:not(.known) {
    opacity: 0.45;
  }

  .node.clickable {
    cursor: pointer;
  }

  .node.clickable:hover .dot {
    stroke: var(--accent);
  }

  .node:focus {
    outline: none;
  }

  .icon {
    font-size: 3.6px;
    pointer-events: none;
  }

  .label {
    font-size: 2.4px;
    fill: var(--text-dim);
    pointer-events: none;
  }

  .wp {
    font-size: 2.8px;
  }

  .menace {
    font-size: 2.8px;
  }

  .ring {
    fill: none;
    stroke: var(--accent);
    stroke-width: 0.6;
    animation: pulse 1.6s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .fast {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .journey {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
