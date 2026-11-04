<script lang="ts">
  import { untrack } from 'svelte';
  import OfficeDirectory from './OfficeDirectory.svelte';
  import MapPlan from './MapPlan.svelte';
  import { OFFICE_ROOMS } from '../core/systems/floodedFloor';
  import { gs, game, ui, view } from './state.svelte';
  import { AREAS, FLOOR_BY_AREA, RECIPES, REGIONS, SPOTS, getSpot } from '../core/registry';
  import { recipeHidden } from '../core/systems/crafting';
  import { visibleEdges, journeyEnd } from '../core/systems/locations';
  import { spotActivities } from '../core/systems/actions';
  import { ticksToTime } from './lib/format';
  import {
    NO_ROUTE_LINE,
    journeySpots,
    legTime,
    nextTrail,
    noRouteSummary,
    routeInfo,
    routeLegs,
    routeSummary,
    spotFeatures,
    type RouteLine,
  } from './lib/navigation';
  import { DEFAULT_W } from './lib/map';
  import { CARD_W, cardTab, placeCard, selectionStep, type Box, type CardFocus, type SelectEvent } from './lib/mapSelect';
  import { buildPlan, buildRouteDraw, planThreats, stableThreats } from './lib/mapPlan';
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

  /**
   * What the map is about: where the journey ends while the player walks, else
   * the spot underfoot. An end the player has not discovered is not shown (its
   * region and floor stay hidden), so the map keeps to the spot underfoot.
   */
  const endId = $derived(journeyEnd(gs));
  const focusId = $derived(endId && gs.discovered.includes(endId) ? endId : gs.spot);

  let regionOverride = $state<string | null>(null);
  const currentRegion = $derived(AREAS[getSpot(focusId).areaId].regionId);
  const shownRegion = $derived(regionOverride ?? currentRegion);
  // A tab for each region with a discovered spot, and for the regions on show
  // and underfoot, so there is always a way back to where the player stands.
  const foundRegions = $derived(
    new Set(gs.discovered.filter((id) => SPOTS[id]).map((id) => AREAS[SPOTS[id].areaId]?.regionId)),
  );
  const regionList = $derived(
    Object.values(REGIONS).filter(
      (r) => r.id === shownRegion || r.id === currentRegion || foundRegions.has(r.id),
    ),
  );

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
    const here = getSpot(focusId).areaId;
    if (floorAreas.some((a) => a.id === here)) return here;
    return floorAreas[floorAreas.length - 1].id;
  });
  // Walking onto another floor shows that floor again.
  $effect(() => {
    void gs.spot;
    areaOverride = null;
  });
  // Setting out, retargeting or arriving puts the map back on the focus:
  // a tab the player opened before the journey does not hold the map off the
  // destination.
  $effect(() => {
    void endId;
    regionOverride = null;
    areaOverride = null;
  });

  /**
   * A region with a composed scene (lib/tilemaps) is painted from tiles under
   * the diagram. Regions without one — and any machine without the art packs
   * (`tilesFailed`) — draw as a diagram on the plain dark ground.
   */
  const tilemap = $derived(TILEMAPS[shownRegion] ?? null);
  let tilesFailed = $state(false);
  const tiled = $derived(!!tilemap && !tilesFailed);

  /**
   * The column's width, measured. A diagram is drawn at that width and 340 px
   * high; a tiled region keeps its picture's proportions. Until the first
   * measurement (and where nothing can be measured) the plan uses the width of
   * the 1094 px layout's column.
   */
  let wrapW = $state(0);
  const width = $derived(wrapW || DEFAULT_W);

  // Level ranges read the clock (`daypart` lines), so they are worked out on
  // every tick, and `planThreats` returns a new Map each time. The plan gets
  // the Map it already had while the ranges are the same (`stableThreats`),
  // so a tick that changes no range rebuilds nothing.
  let threatCache: ReadonlyMap<string, string> = new Map();
  const threats = $derived.by(() => {
    threatCache = stableThreats(threatCache, planThreats(gs, shownRegion, shownArea));
    return threatCache;
  });

  const plan = $derived(
    buildPlan(gs, { region: shownRegion, area: shownArea, width, tiled, focus: focusId, target, threats }),
  );

  const stuck = $derived(!!gs.travel || gs.recovering || !!gs.combat?.forced);

  function walkTo(id: string) {
    if (id === gs.spot || stuck) return;
    game.travelPlanTo(id);
  }

  // ---------- The click card ----------

  /**
   * The pin whose card is open. A click on a pin selects it, a second click on
   * it walks there, and nothing opens on hover (lib/mapSelect.ts holds the
   * rules; `apply` runs every event through them).
   */
  let selected = $state<string | null>(null);
  let cardX = $state(0);
  let cardY = $state(0);
  let cardEl = $state<HTMLElement | null>(null);
  /** The selected pin's own element: the card stands beside it and follows it. */
  let anchor: Element | null = null;

  function apply(ev: SelectEvent) {
    const next = selectionStep(selected, ev);
    selected = next.selected;
    if (!next.selected) anchor = null;
    if (next.walk) walkTo(next.walk);
  }

  /** The card's corner beside a pin, for a card `cardH` px tall. */
  function stand(pin: Element, cardH: number, exits: Box[] = exitBoxes()) {
    const view = { w: window.innerWidth, h: window.innerHeight };
    const at = placeCard(pin.getBoundingClientRect(), view, { w: CARD_W, h: cardH }, exits);
    cardX = at.x;
    cardY = at.y;
  }

  /** The card's buttons that can take focus, in order. */
  function cardControls(): HTMLElement[] {
    return cardEl ? [...cardEl.querySelectorAll<HTMLElement>('button:not([disabled])')] : [];
  }

  /**
   * The region exit labels on screen. They sit beside a pin but are not part
   * of it, and the last tutorial step is a click on one, so a card keeps clear
   * of them (`placeCard`).
   */
  function exitBoxes(): Box[] {
    return [...document.querySelectorAll('svg.plan text.exit')].map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left - 4, top: r.top - 4, right: r.right + 4, bottom: r.bottom + 4 };
    });
  }

  function pick(id: string, pin: Element) {
    anchor = pin;
    apply({ type: 'pin', id, here: id === gs.spot });
    // The card's height is not known until it is drawn; `follow` below corrects it.
    if (selected) stand(pin, 360);
  }

  // Escape, or a click outside the card and the pins, closes the card.
  $effect(() => {
    if (!selected) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        // Focus in the card would be lost with it: hand it back to the pin.
        const pin = anchor as HTMLElement | SVGElement | null;
        const inCard = !!cardEl && cardEl.contains(document.activeElement);
        apply({ type: 'escape' });
        if (inCard) pin?.focus();
        return;
      }
      if (ev.key !== 'Tab') return;
      // The card is the last thing on the page: carry Tab from the selected
      // pin into it and back (`cardTab`).
      const controls = cardControls();
      const active = document.activeElement;
      const at: CardFocus = active === anchor ? 'pin' : controls.indexOf(active as HTMLElement);
      if (at === -1) return;
      const to = cardTab(at, controls.length, ev.shiftKey);
      if (to === null) return;
      ev.preventDefault();
      (to === 'pin' ? (anchor as HTMLElement | SVGElement | null) : controls[to])?.focus();
    };
    const onClick = (ev: MouseEvent) => {
      const inside = ev.composedPath().some((n) => n instanceof Element && n.matches('.map-card, g.node'));
      if (!inside) apply({ type: 'outside' });
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  });

  // The card stays beside its pin whatever moves the pin (scrolling, a resize,
  // the travel strip above the map appearing), one frame at a time while it is
  // open. A pin that is gone, covered or scrolled out of reach of a click
  // closes it: a card with no pin beside it is not shown.
  $effect(() => {
    if (!selected) return;
    let frame = 0;
    let last = '';
    const follow = () => {
      frame = requestAnimationFrame(follow);
      const pin = anchor;
      if (!pin || !pin.isConnected) return apply({ type: 'view' });
      const r = pin.getBoundingClientRect();
      const h = cardEl?.offsetHeight ?? 360;
      const exits = exitBoxes();
      const key = [r.left, r.top, r.right, r.bottom, window.innerWidth, window.innerHeight, h, ...exits.map((b) => [b.left, b.top])].join();
      if (key === last) return;
      last = key;
      const dot = pin.querySelector('.dot')?.getBoundingClientRect() ?? r;
      const hit = document.elementFromPoint(dot.left + dot.width / 2, dot.top + dot.height / 2);
      if (hit?.closest('g.node') !== pin) return apply({ type: 'view' });
      stand(pin, h, exits);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  });

  // Switching region or floor, or folding the map, closes the card; so does
  // the selected pin leaving the map.
  $effect(() => {
    void shownRegion;
    void shownArea;
    void mapOpen;
    untrack(() => apply({ type: 'view' }));
  });
  $effect(() => {
    const ids = new Set(plan.nodes.map((n) => n.id));
    untrack(() => apply({ type: 'present', ids }));
  });

  /** A card button that walks: the card has done its job. */
  function cardWalk(id: string) {
    walkTo(id);
    apply({ type: 'done' });
  }

  const card = $derived.by(() => {
    if (!selected) return null;
    const spot = getSpot(selected);
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

  // ---------- The route line ----------

  /**
   * The spots of the journey walked so far. The save keeps the leg under way
   * and the legs still planned, never the ones behind, so the map remembers
   * them here: a reload mid-walk draws from the leg under way.
   */
  let trail = $state<string[]>([]);
  $effect(() => {
    const travel = gs.travel ? { from: gs.travel.from, to: gs.travel.to } : null;
    const before = untrack(() => trail);
    const next = nextTrail(before, travel);
    if (next !== before) trail = next;
  });

  /** The journey in progress as legs, with the one under way. */
  const journey = $derived.by(() => {
    if (!gs.travel) return null;
    const travel = { from: gs.travel.from, to: gs.travel.to };
    const spots = journeySpots(trail, travel, gs.travelPlan);
    return {
      legs: routeLegs(spots[0], spots.slice(1), view.stats.travelSpeed),
      current: nextTrail(trail, travel).length - 2,
    };
  });

  /** Selecting a place draws the way there from where the player stands. */
  const preview = $derived.by(() => {
    if (journey || !card || card.here) return null;
    const path = card.route.path;
    return path?.length ? routeLegs(gs.spot, path, view.stats.travelSpeed) : null;
  });

  const routeLine = $derived.by((): RouteLine => {
    if (journey) return routeSummary(gs, 'Journey', journey.legs);
    if (!card || card.here) return NO_ROUTE_LINE;
    return preview ? routeSummary(gs, 'Route', preview) : noRouteSummary(gs, card.spot.id, card.route);
  });

  const routeDraw = $derived.by(() => {
    if (journey) {
      const t = gs.travel!;
      return buildRouteDraw(plan, journey.legs, legTime, {
        current: journey.current,
        fraction: t.total > 0 ? 1 - t.ticksLeft / t.total : 0,
      });
    }
    return preview ? buildRouteDraw(plan, preview, legTime, null) : null;
  });

  function goOpenBench(spotId: string, bench: string) {
    if (spotId !== gs.spot || gs.travel) {
      if (!game.travelPlanTo(spotId)) return;
    }
    ui.benchOnArrival = { spot: spotId, bench };
    ui.tab = 'location';
    // The bench window opens over the page; a card left standing would sit
    // on top of it (the card is fixed, above modals).
    apply({ type: 'done' });
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
    apply({ type: 'done' });
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
      <!-- One line, always there, so a route appearing never moves the map. -->
      <div
        class="route-line small"
        role="status"
        title={routeLine.head ? `${routeLine.head} ${routeLine.rest}` : undefined}
      >
        {#if routeLine.head}
          <span class="route-head">{routeLine.head}</span> {routeLine.rest}
        {:else}
          &nbsp;
        {/if}
      </div>
      <div class="map-wrap" class:tiled bind:clientWidth={wrapW} style:height="{plan.frame.h + 2}px">
        {#if tilemap}
          {#key shownRegion}
            <TileMap map={tilemap} onfallback={() => (tilesFailed = true)} />
          {/key}
        {/if}
        <MapPlan {plan} route={routeDraw} {stuck} {selected} onpick={pick} onexit={walkTo} />
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

  <!-- The slot is always there, empty while standing, so a walk starting or
       ending does not move what is below the map. -->
  <div class="journey small">
    {#if gs.travel}
      🥾 En route to {gs.discovered.includes(gs.travel.to) ? getSpot(gs.travel.to).name : 'an unknown place'} — {ticksToTime(gs.travel.ticksLeft)}
      {#if gs.travelPlan.length > 0}
        <span class="dim">
          , then {gs.travelPlan.length} more leg{gs.travelPlan.length > 1 ? 's' : ''} to
          {gs.discovered.includes(gs.travelPlan[gs.travelPlan.length - 1])
            ? getSpot(gs.travelPlan[gs.travelPlan.length - 1]).name
            : 'an unknown place'}
        </span>
        <button class="small" onclick={() => game.cancelTravelPlan()}>Cancel journey</button>
      {/if}
    {:else}
      &nbsp;
    {/if}
  </div>
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
    bind:this={cardEl}
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
        <button class="small walk" disabled={stuck || !r.path} onclick={() => cardWalk(c.spot.id)}>
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
            <button class="small" disabled={stuck || !r.path} onclick={() => cardWalk(c.spot.id)}>Go</button>
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
   * The route line has one fixed height, whether it holds a route or nothing,
   * so selecting a pin never moves the map or the page. A route longer than the
   * column is cut with an ellipsis; the whole of it is in the tooltip.
   */
  .route-line {
    height: 22px;
    line-height: 22px;
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .route-head {
    color: var(--accent);
  }

  /*
   * The map is drawn in pixels at the column's width (MapCard measures it and
   * MapPlan sets the viewBox to match), and its height is the plan's, so the
   * frame is the same size whatever is selected or walked. A tiled region is
   * capped at its picture's useful width and keeps its proportions.
   */
  .map-wrap {
    position: relative;
    width: 100%;
    background: var(--bg-sunken);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-top: 2px;
    overflow: hidden;
  }

  /*
   * The tiles sit UNDER the same SVG: the picture is 100 × 75 map units with
   * six units of headroom for labels above and three below (tiledFrame in
   * lib/map.ts), so a spot's map coordinates land on the same tile whether or
   * not the sheets loaded. The SVG goes transparent over tiles.
   */
  .map-wrap.tiled {
    max-width: 560px;
    background: var(--bg-sunken);
  }

  .map-wrap.tiled :global(.tiles) {
    top: calc(100% * 6 / 84);
    height: calc(100% * 75 / 84);
  }

  .roads {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  /*
   * The line keeps the height it has with the Cancel button, so the last leg
   * of a journey (which has no plan left to cancel) does not move what is
   * below it.
   */
  .journey {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-height: 2.5em;
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
