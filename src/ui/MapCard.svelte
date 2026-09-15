<script lang="ts">
  import { gs, game, ui, view } from './state.svelte';
  import { AREAS, REGIONS, SPOTS, getSpot } from '../core/registry';
  import { visibleEdges, fastTravelCost, canFastTravel, journeyEnd } from '../core/systems/locations';
  import { spotActivities } from '../core/systems/actions';
  import { spotCleared } from '../core/systems/combat';
  import { conditionsMet } from '../core/systems/conditions';
  import { condsText, fmt, ticksToTime } from './lib/format';
  import { routeInfo, spotFeatures, type SpotFeature } from './lib/navigation';
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
    const lines: { from: SpotDef; to: SpotDef; oneWay: boolean; forced: boolean; shut: string | null }[] = [];
    const exits: { from: SpotDef; to: string; label: string; offset: number }[] = [];
    for (const n of nodes) {
      if (!n.known) continue;
      let exitCount = 0;
      for (const e of visibleEdges(gs, n.spot.id)) {
        const target = SPOTS[e.to];
        const targetRegion = AREAS[target.areaId].regionId;
        if (targetRegion !== shownRegion) {
          exits.push({ from: n.spot, to: e.to, label: REGIONS[targetRegion].name, offset: exitCount++ });
          continue;
        }
        if (!rendered.has(e.to)) continue;
        const key = [n.spot.id, e.to].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const reverse = visibleEdges(gs, e.to).find((r) => r.to === n.spot.id);
        // A road wears the warning when EITHER direction walks into a fight
        // with no way out — an edge flag one way, or a forced spot at an end.
        // A cleared spot no longer menaces anybody (see SpotDef.fightLimit).
        const into = (dest: SpotDef, edgeForced?: boolean) =>
          !!(edgeForced || dest.forced) && !spotCleared(gs, dest);
        const forced = into(target, e.forced) || into(n.spot, reverse?.forced);
        // Locks are directional (Connection.requires); the line shows either.
        const shutEdge = [e, reverse].find((x) => x?.requires && !conditionsMet(gs, x.requires));
        lines.push({
          from: n.spot,
          to: target,
          oneWay: !reverse,
          forced,
          shut: shutEdge ? condsText(shutEdge.requires) : null,
        });
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

  /** Feature icons per known node, cycled on the badge and listed in the card. */
  const features = $derived.by(() => {
    const out = new Map<string, SpotFeature[]>();
    for (const n of nodes) if (n.known) out.set(n.spot.id, spotFeatures(gs, n.spot));
    return out;
  });

  // The badge shows one icon at a time and steps through the rest.
  let beat = $state(0);
  $effect(() => {
    const id = setInterval(() => beat++, 1500);
    return () => clearInterval(id);
  });

  const stuck = $derived(!!gs.travel || gs.recovering || !!gs.combat?.forced);

  function walkTo(id: string) {
    if (id === gs.spot || stuck) return;
    game.travelPlanTo(id);
  }

  // ---------- The hover card ----------

  let cardFor = $state<string | null>(null);
  let cardX = $state(0);
  let cardY = $state(0);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function openCard(id: string, ev: Event) {
    clearTimeout(closeTimer);
    const rect = (ev.currentTarget as Element).getBoundingClientRect();
    cardX = Math.max(8, Math.min(rect.right + 8, window.innerWidth - 310));
    cardY = Math.max(8, Math.min(rect.top - 4, window.innerHeight - 360));
    cardFor = id;
  }

  function closeSoon() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => (cardFor = null), 180);
  }

  function keepCard() {
    clearTimeout(closeTimer);
  }

  // A node that vanishes under the cursor never fires mouseleave: folding the
  // map or switching region must close its card by hand.
  $effect(() => {
    void shownRegion;
    if (!ui.mapOpen) cardFor = null;
    return () => (cardFor = null);
  });

  const card = $derived.by(() => {
    if (!cardFor) return null;
    const spot = getSpot(cardFor);
    const known = gs.discovered.includes(spot.id);
    const here = spot.id === gs.spot && !gs.travel;
    const feats = known ? spotFeatures(gs, spot) : [];
    // A rest already has its row under "Here"; list it once.
    const listed = new Set(feats.map((f) => f.activity).filter(Boolean));
    return {
      spot,
      known,
      here,
      /** The journey in progress ends here: activities become "on arrival". */
      journeyEnds: journeyEnd(gs) === spot.id,
      route: routeInfo(gs, spot.id, view.stats.travelSpeed),
      features: feats,
      activities: known ? spotActivities(spot).filter((a) => !listed.has(a.id)) : [],
    };
  });

  function goOpenBench(spotId: string, bench: string) {
    if (spotId !== gs.spot || gs.travel) {
      if (!game.travelPlanTo(spotId)) return;
    }
    ui.benchOnArrival = { spot: spotId, bench };
    ui.tab = 'location';
  }

  function goDo(spotId: string, activity: string) {
    if (journeyEnd(gs) === spotId) {
      game.setJourneyIntent(gs.travelIntent?.activity === activity ? null : activity);
      return;
    }
    game.goAndDo(spotId, activity);
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

    <svg viewBox="0 -6 100 84" class="map" aria-label="Region map">
      {#each mapEdges.lines as e}
        <line
          x1={e.from.map!.x}
          y1={e.from.map!.y}
          x2={e.to.map!.x}
          y2={e.to.map!.y}
          class="edge"
          class:oneway={e.oneWay}
          class:forced={e.forced}
          class:shut={!!e.shut}
        >
          {#if e.forced}<title>This way leads to a fight with no way out</title>{/if}
        </line>
        {#if e.shut}
          <text
            x={(e.from.map!.x + e.to.map!.x) / 2}
            y={(e.from.map!.y + e.to.map!.y) / 2 + 1}
            text-anchor="middle"
            class="lock"
          >
            🔒<title>Shut: {e.shut}</title>
          </text>
        {/if}
      {/each}
      {#each mapEdges.exits as exit}
        <text
          x={exit.from.map!.x + 4}
          y={exit.from.map!.y - 3 + exit.offset * 3.2}
          class="exit"
          class:clickable={!stuck}
          role="button"
          tabindex="0"
          aria-label="Travel toward {exit.label}"
          onclick={() => walkTo(exit.to)}
          onkeydown={(ev) => ev.key === 'Enter' && walkTo(exit.to)}
          onmouseenter={(ev) => openCard(exit.to, ev)}
          onmouseleave={closeSoon}
          onfocus={(ev) => openCard(exit.to, ev)}
          onblur={closeSoon}
        >
          → {exit.label}
        </text>
      {/each}
      {#each nodes as node (node.spot.id)}
        {@const m = node.spot.map!}
        {@const feats = features.get(node.spot.id) ?? []}
        <g
          class="node"
          class:known={node.known}
          class:clickable={node.spot.id !== gs.spot && !stuck}
          role="button"
          tabindex="0"
          aria-label={node.known ? `Travel to ${node.spot.name}` : 'Travel to unexplored place'}
          onclick={() => walkTo(node.spot.id)}
          onkeydown={(ev) => ev.key === 'Enter' && walkTo(node.spot.id)}
          onmouseenter={(ev) => openCard(node.spot.id, ev)}
          onmouseleave={closeSoon}
          onfocus={(ev) => openCard(node.spot.id, ev)}
          onblur={closeSoon}
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
          {#if feats.length}
            <!-- What stands here, one icon at a time; the card lists them all. -->
            <text x={m.x} y={m.y - 5} text-anchor="middle" class="feat">
              {feats[beat % feats.length].icon}
            </text>
            {#if feats.length > 1}
              <text x={m.x + 2} y={m.y - 6.6} class="feat-more">+</text>
            {/if}
          {/if}
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
  {:else}
    <!-- Folded map: the roads out of here stay one click away. -->
    <div class="roads small">
      {#each visibleEdges(gs, gs.spot) as edge (edge.to)}
        {@const r = routeInfo(gs, edge.to, view.stats.travelSpeed)}
        {@const dest = getSpot(edge.to)}
        {@const known = gs.discovered.includes(edge.to)}
        <button
          class="small"
          disabled={stuck || !r.path}
          title={r.shut ? `Shut: ${r.shut}` : r.noExit ? 'Arriving starts a fight with no way out' : ''}
          onclick={() => walkTo(edge.to)}
        >
          {known ? `${dest.icon} ${dest.name}` : '❓ Unknown place'} · {ticksToTime(r.ticks)}{r.oneWay
            ? ' ⤵'
            : ''}{r.noExit ? ' ⚔️' : ''}{r.shut ? ' 🔒' : ''}
        </button>
      {/each}
    </div>
  {/if}

  {#if gs.travel}
    <div class="journey small">
      🥾 En route to {gs.discovered.includes(gs.travel.to) ? getSpot(gs.travel.to).name : 'an unknown place'} — {ticksToTime(gs.travel.ticksLeft)}
      {#if gs.travelPlan.length > 0}
        <span class="dim">
          , then {gs.travelPlan.length} more leg{gs.travelPlan.length > 1 ? 's' : ''} to
          {getSpot(gs.travelPlan[gs.travelPlan.length - 1]).name}
        </span>
        <button class="small" onclick={() => game.cancelTravelPlan()}>Cancel journey</button>
      {/if}
    </div>
  {/if}
</div>

{#if card}
  {@const c = card}
  {@const r = c.route}
  <div
    class="map-card"
    style="left: {cardX}px; top: {cardY}px"
    role="dialog"
    aria-label="{c.known ? c.spot.name : 'Unknown place'} details"
    tabindex="-1"
    onmouseenter={keepCard}
    onmouseleave={closeSoon}
  >
    <div class="card-head">
      <b>{c.known ? `${c.spot.icon} ${c.spot.name}` : '❓ Unknown place'}</b>
      {#if !c.known}
        <span class="dim small">{REGIONS[AREAS[c.spot.areaId].regionId].name}</span>
      {/if}
    </div>

    {#if c.here}
      <div class="dim small">You are here.</div>
    {:else}
      <div class="small">
        {#if r.path}
          {r.path.length === 1 ? (r.label ?? 'Next door') : `${r.path.length} legs`} · {ticksToTime(r.ticks)}
        {:else}
          <span class="dim">No open route from here{r.ticks ? ` · ${ticksToTime(r.ticks)}` : ''}</span>
        {/if}
      </div>
      {#if r.oneWay}<div class="warn small">⤵ One-way: no coming back this way</div>{/if}
      {#if r.noExit}
        <div class="warn small">⚔️ No retreat: arriving starts a fight you win or are carried off from</div>
      {/if}
      {#if r.shut}<div class="shut small">🔒 Shut: {r.shut}</div>{/if}
      {#if !c.journeyEnds}
        <button class="small walk" disabled={stuck || !r.path} onclick={() => walkTo(c.spot.id)}>
          🥾 Walk here
        </button>
      {:else}
        <div class="dim small">Your journey ends here.</div>
      {/if}
    {/if}

    {#if c.features.length}
      <div class="section">Here</div>
      {#each c.features as f (f.key)}
        <div class="row">
          <span>{f.icon} {f.label}</span>
          {#if f.bench}
            <button
              class="small"
              disabled={!c.here && (stuck || !r.path)}
              onclick={() => goOpenBench(c.spot.id, f.bench!)}
            >
              {c.here ? 'Open' : 'Go & open'}
            </button>
          {:else if f.activity}
            {@render actButton(c.spot.id, f.activity, c.here, c.journeyEnds, !!r.path)}
          {:else if !c.here}
            <button class="small" disabled={stuck || !r.path} onclick={() => walkTo(c.spot.id)}>Go</button>
          {/if}
        </div>
      {/each}
    {/if}

    {#if c.activities.length}
      <div class="section">Activities</div>
      {#each c.activities as act (act.id)}
        <div class="row">
          <span>{act.icon} {act.name}</span>
          {@render actButton(c.spot.id, act.id, c.here, c.journeyEnds, !!r.path)}
        </div>
      {/each}
    {/if}
  </div>
{/if}

{#snippet actButton(spotId: string, activity: string, here: boolean, ends: boolean, routed: boolean)}
  {#if here}
    <button
      class="small"
      class:selected={gs.activity === activity}
      disabled={gs.recovering || !!gs.combat?.forced}
      onclick={() => game.selectActivity(gs.activity === activity ? null : activity)}
    >
      {gs.activity === activity ? 'Stop' : 'Start'}
    </button>
  {:else if ends}
    <button
      class="small"
      class:selected={gs.travelIntent?.activity === activity}
      title="Start this when the journey ends"
      onclick={() => goDo(spotId, activity)}
    >
      On arrival
    </button>
  {:else}
    <button class="small" disabled={stuck || !routed} onclick={() => goDo(spotId, activity)}>
      Go & start
    </button>
  {/if}
{/snippet}

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
    max-height: 340px;
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

  .edge.shut {
    stroke-dasharray: 0.6 0.9;
    opacity: 0.6;
  }

  .lock {
    font-size: 2.4px;
  }

  .exit {
    font-size: 2.6px;
    fill: var(--text-dim);
    font-style: italic;
  }

  .exit.clickable {
    cursor: pointer;
  }

  .exit.clickable:hover {
    fill: var(--accent);
  }

  .exit:focus {
    outline: none;
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

  .feat {
    font-size: 2.9px;
  }

  .feat-more {
    font-size: 2.6px;
    font-weight: 700;
    fill: var(--accent);
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

  .fast,
  .roads {
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

  .map-card {
    position: fixed;
    z-index: 100;
    width: 290px;
    max-height: 70vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--bg-panel);
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 8px 11px;
    font-size: 13px;
    box-shadow: 0 6px 20px rgb(0 0 0 / 45%);
  }

  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .map-card .walk {
    align-self: flex-start;
    margin-top: 2px;
  }

  .map-card .warn {
    color: var(--danger);
  }

  .map-card .shut {
    color: var(--text-dim);
  }

  .map-card .section {
    margin-top: 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-dim);
  }

  .map-card .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .map-card .row button {
    flex: none;
  }
</style>
