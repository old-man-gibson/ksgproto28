<script lang="ts">
  import OfficeDirectory from './OfficeDirectory.svelte';
  import { OFFICE_ROOMS } from '../core/systems/floodedFloor';
  import { gs, game, ui, view } from './state.svelte';
  import { AREAS, FLOOR_BY_AREA, RECIPES, REGIONS, SPOTS, getSpot } from '../core/registry';
  import { recipeHidden } from '../core/systems/crafting';
  import { visibleEdges, fastTravelCost, canFastTravel, journeyEnd } from '../core/systems/locations';
  import { spotActivities } from '../core/systems/actions';
  import { spotCleared } from '../core/systems/combat';
  import { conditionsMet } from '../core/systems/conditions';
  import { condsText, fmt, ticksToTime } from './lib/format';
  import { routeInfo, spotFeatures, type SpotFeature } from './lib/navigation';
  import { labelBox, mapNodes, placeLabels, type LabelPlace } from './lib/map';
  import type { SpotDef } from '../core/types';
  import TileMap from './lib/tilemaps/TileMap.svelte';
  import { TILEMAPS } from './lib/tilemaps';
  import { tutorialScreen } from './lib/tutorialFocus';

  /**
   * Floor 0 (lib/tutorialFocus.ts): the map stays open, shows only the
   * Holding Level, and wears a beacon on the pin or exit the step names.
   */
  const tutorial = $derived(!!tutorialScreen(gs));
  const target = $derived(tutorialScreen(gs)?.target ?? null);
  const mapOpen = $derived(ui.mapOpen || tutorial);

  let regionOverride = $state<string | null>(null);
  const currentRegion = $derived(AREAS[getSpot(gs.spot).areaId].regionId);
  const shownRegion = $derived(regionOverride ?? currentRegion);
  const regionList = Object.values(REGIONS);

  // A tower's region is a STACK, not a map: its floors are drawn one at a
  // time, with a tab per floor you have set foot on. Every other region
  // draws whole, as before.
  let areaOverride = $state<string | null>(null);
  const floorAreas = $derived(
    Object.values(AREAS)
      .filter((a) => a.regionId === shownRegion && FLOOR_BY_AREA.has(a.id))
      .filter((a) => gs.discovered.some((id) => SPOTS[id]?.areaId === a.id))
      .sort((a, b) => FLOOR_BY_AREA.get(a.id)!.index - FLOOR_BY_AREA.get(b.id)!.index),
  );
  const shownArea = $derived.by((): string | null => {
    if (!floorAreas.length) return null;
    if (areaOverride && floorAreas.some((a) => a.id === areaOverride)) return areaOverride;
    const here = getSpot(gs.spot).areaId;
    if (floorAreas.some((a) => a.id === here)) return here;
    return floorAreas[floorAreas.length - 1].id;
  });
  // Walking onto another floor shows that floor again.
  $effect(() => {
    void gs.spot;
    areaOverride = null;
  });

  // Discovered spots plus "?" ghosts one visible edge away from a discovered spot.
  const nodes = $derived(mapNodes(gs, shownRegion, shownArea));

  const mapEdges = $derived.by(() => {
    const rendered = new Map(nodes.map((n) => [n.spot.id, n]));
    const seen = new Set<string>();
    const lines: { from: SpotDef; to: SpotDef; oneWay: boolean; forced: boolean; shut: string | null }[] = [];
    const exits: { from: SpotDef; to: string; label: string; offset: number }[] = [];
    for (const n of nodes) {
      if (!n.known) continue;
      let exitCount = 0;
      for (const e of visibleEdges(gs, n.spot.id)) {
        if (OFFICE_ROOMS.includes(n.spot.id) && OFFICE_ROOMS.includes(e.to)) continue;
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

  /**
   * A region with a composed scene (lib/tilemaps) is painted from tiles under
   * the diagram. Regions without one — and any machine without the art packs
   * (`tilesFailed`) — keep the plain dark ground.
   */
  const tilemap = $derived(TILEMAPS[shownRegion] ?? null);
  let tilesFailed = $state(false);
  const tiled = $derived(!!tilemap && !tilesFailed);

  /**
   * A floor fitted to its own spots, at the canvas's aspect, and never zoomed
   * past 1.5× — a three-spot floor should look small, not swollen. A tiled
   * region keeps the fixed canvas, because its tiles are pinned to it.
   */
  const viewBox = $derived.by(() => {
    if (!shownArea || tiled || nodes.length === 0) return '0 -6 100 84';
    const xs = nodes.map((n) => n.spot.map!.x);
    const ys = nodes.map((n) => n.spot.map!.y);
    let x = Math.min(...xs) - 14;
    let y = Math.min(...ys) - 11;
    let w = Math.max(...xs) + 14 - x;
    let h = Math.max(...ys) + 12 - y;
    const aspect = 100 / 84;
    if (w / h < aspect) {
      const nw = h * aspect;
      x -= (nw - w) / 2;
      w = nw;
    } else {
      const nh = w / aspect;
      y -= (nh - h) / 2;
      h = nh;
    }
    if (w < 66) {
      const k = 66 / w;
      x -= (w * k - w) / 2;
      y -= (h * k - h) / 2;
      w *= k;
      h *= k;
    }
    return `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
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

  /** A region exit's text sits right of its spot, past the ⚡ when there is one. */
  function exitPlace(exit: { from: SpotDef; offset: number }): LabelPlace {
    const m = exit.from.map!;
    return { x: m.x + (exit.from.waypoint ? 6.6 : 4), y: m.y - 3 + exit.offset * 3.2, anchor: 'start' };
  }

  /** Every name placed clear of the other pins, their badges, the exits and each other. */
  const labelAt = $derived(
    placeLabels(
      nodes.map((n) => ({
        id: n.spot.id,
        x: n.spot.map!.x,
        y: n.spot.map!.y,
        text: n.known ? n.spot.name : '???',
        // The tutorial's ▼ over a pin takes the badge's place.
        badge: (features.get(n.spot.id)?.length ?? 0) > 0 || target === `spot:${n.spot.id}`,
        waypoint: n.known && !!n.spot.waypoint,
        menace: !!n.spot.forced && !spotCleared(gs, n.spot),
      })),
      mapEdges.exits.map((e) => labelBox(`→ ${e.label}`, exitPlace(e), 2.6)),
    ),
  );

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
    // Right of the pin, or left of it when that would run off the window.
    // Clamping it inward instead slid the card over the pin it describes,
    // so a click aimed at the pin landed on the card (narrow windows).
    const width = 290;
    cardX =
      rect.right + 8 + width <= window.innerWidth - 8
        ? rect.right + 8
        : Math.max(8, rect.left - 8 - width);
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
    if (!mapOpen) cardFor = null;
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
      activities: known
        ? spotActivities(spot).filter(
            (a) => !listed.has(a.id) && !(a.kind === 'craft' && recipeHidden(gs, RECIPES[a.recipe])),
          )
        : [],
    };
  });

  function goOpenBench(spotId: string, bench: string) {
    if (spotId !== gs.spot || gs.travel) {
      if (!game.travelPlanTo(spotId)) return;
    }
    ui.benchOnArrival = { spot: spotId, bench };
    ui.tab = 'location';
    // The bench window opens under the cursor; a card left standing would
    // sit on top of it (the card is fixed, above modals).
    cardFor = null;
  }

  /**
   * The journey already ends here (clicking the pin starts the walk at once):
   * queue the bench for arrival, the way activities queue with On arrival.
   */
  function toggleBenchOnArrival(spotId: string, bench: string) {
    const queued = ui.benchOnArrival?.spot === spotId && ui.benchOnArrival.bench === bench;
    ui.benchOnArrival = queued ? null : { spot: spotId, bench };
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
  {#if tutorial}
    <div class="map-toggle">🗺️ Map — {REGIONS[shownRegion].name}</div>
  {:else}
    <button class="map-toggle" onclick={() => (ui.mapOpen = !ui.mapOpen)}>
      {ui.mapOpen ? '▾' : '▸'} 🗺️ Map — {REGIONS[shownRegion].name}{shownArea &&
      AREAS[shownArea].name !== REGIONS[shownRegion].name
        ? `: ${AREAS[shownArea].name}`
        : ''}
    </button>
  {/if}

  {#if mapOpen}
    {#if !tutorial}
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
    {/if}

    {#if floorAreas.length > 1}
      <div class="region-switch floors">
        {#each floorAreas as area (area.id)}
          <button
            class="small"
            class:selected={shownArea === area.id}
            onclick={() => (areaOverride = area.id)}
          >
            Floor {FLOOR_BY_AREA.get(area.id)!.index} · {area.name}
          </button>
        {/each}
      </div>
    {/if}

    {#if shownRegion === currentRegion && OFFICE_ROOMS.includes(gs.spot) && (!shownArea || shownArea === getSpot(gs.spot).areaId)}
      <OfficeDirectory />
    {:else}
    <div class="map-wrap" class:tiled>
    {#if tilemap}
      {#key shownRegion}
        <TileMap map={tilemap} onfallback={() => (tilesFailed = true)} />
      {/key}
    {/if}
    <svg {viewBox} class="map" class:tiled aria-label="Region map">
      {#each mapEdges.lines as e}
        <!-- A drawn map shows its roads as the doors and paths in the
             picture; a straight line between pins would cut through its
             walls. The lock stays, and a forced fight keeps its ⚔️ on the pin. -->
        {#if !tiled}
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
        {/if}
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
          x={exitPlace(exit).x}
          y={exitPlace(exit).y}
          class="exit"
          class:clickable={!stuck}
          class:tutorial-target={target === `exit:${exit.to}`}
          class:beacon-text={target === `exit:${exit.to}`}
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
        {#if target === `exit:${exit.to}`}
          <text
            x={exitPlace(exit).x + 1.2}
            y={exitPlace(exit).y - 3.6}
            text-anchor="middle"
            class="beacon-arrow">▼</text
          >
        {/if}
      {/each}
      {#each nodes as node (node.spot.id)}
        {@const m = node.spot.map!}
        {@const feats = features.get(node.spot.id) ?? []}
        {@const at = labelAt.get(node.spot.id) ?? { x: m.x, y: m.y + 6.4, anchor: 'middle' }}
        {@const pointed = target === `spot:${node.spot.id}`}
        <g
          class="node"
          class:known={node.known}
          class:clickable={node.spot.id !== gs.spot && !stuck}
          class:pointed
          class:tutorial-target={pointed}
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
          {#if pointed}
            <circle cx={m.x} cy={m.y} r="5.4" class="beacon" />
            <text x={m.x} y={m.y - 6.5} text-anchor="middle" class="beacon-arrow">▼</text>
          {/if}
          <circle cx={m.x} cy={m.y} r="3.1" class="dot" />
          <text x={m.x} y={m.y + 1.3} text-anchor="middle" class="icon">
            {node.known ? node.spot.icon : '❓'}
          </text>
          <text x={at.x} y={at.y} text-anchor={at.anchor} class="label">
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
    </div>
    {/if}

    {#if !tutorial}
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
    {/if}
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
          {#if f.bench && c.journeyEnds}
            <button
              class="small"
              class:selected={ui.benchOnArrival?.spot === c.spot.id && ui.benchOnArrival.bench === f.bench}
              title="Open this bench when the journey ends"
              onclick={() => toggleBenchOnArrival(c.spot.id, f.bench!)}
            >
              On arrival
            </button>
          {:else if f.bench}
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

  .region-switch.floors {
    flex-wrap: wrap;
    margin-top: -2px;
  }
  .region-switch.floors button {
    font-size: 11.5px;
    padding: 3px 9px;
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

  /*
   * The tiles sit UNDER the same SVG, which is why the diagram keeps its
   * viewBox (0 −6 100 84: six rows of headroom for labels above, three
   * below): the canvas is pinned to the picture's own 100 × 75, so a spot's
   * map coordinates land on the same tile whether or not the sheets loaded.
   * The SVG's own ground goes transparent over tiles.
   */
  .map-wrap {
    position: relative;
    width: 100%;
    max-width: 560px;
    margin-top: 4px;
  }

  .map-wrap.tiled {
    aspect-ratio: 100 / 84;
  }

  .map-wrap.tiled :global(.tiles) {
    top: calc(100% * 6 / 84);
    height: calc(100% * 75 / 84);
  }

  .map-wrap.tiled .map {
    position: absolute;
    inset: 0;
    max-height: none;
    height: 100%;
    background: transparent;
    margin-top: 0;
  }

  .map.tiled .label {
    fill: #fff;
    paint-order: stroke;
    stroke: #0d1014;
    stroke-width: 0.8;
  }

  /* An exit is the only way off a drawn region (floor 0's gate is the
     tutorial's last step), and dim italic grey vanishes into grass tiles.
     Same halo as the labels; the hover accent below still wins. */
  .map.tiled .exit {
    fill: #fff;
    font-weight: 600;
    paint-order: stroke;
    stroke: #0d1014;
    stroke-width: 0.8;
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

  /* Floor 0's pointer (lib/tutorialFocus.ts). A ❓ pin is drawn faint until
     visited; the one the step names is drawn full, with a widening ring. */
  .node.pointed {
    opacity: 1;
  }

  .node.pointed .dot {
    stroke: var(--accent);
    stroke-width: 0.8;
  }

  .beacon {
    fill: none;
    stroke: var(--accent);
    stroke-width: 0.9;
    pointer-events: none;
    transform-box: fill-box;
    transform-origin: center;
    animation: beacon 1.4s ease-out infinite;
  }

  @keyframes beacon {
    0% { transform: scale(0.7); opacity: 1; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  /* The ring alone matches the "you are here" ring; the arrow says which. */
  .beacon-arrow {
    font-size: 3.4px;
    fill: var(--accent);
    paint-order: stroke;
    stroke: #0d1014;
    stroke-width: 0.5;
    pointer-events: none;
    animation: beacon-bob 0.9s ease-in-out infinite alternate;
  }

  @keyframes beacon-bob {
    from { transform: translateY(-1px); }
    to { transform: translateY(0.6px); }
  }

  .map .exit.beacon-text {
    fill: var(--accent);
    font-weight: 700;
    font-style: normal;
    animation: pulse 1.4s ease-in-out infinite;
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
    /* Under every overlay (offline 10, catch-up 11, windows 20+): a bench or
       defeat window that opens while the cursor rests on the card covers it. */
    z-index: 9;
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
