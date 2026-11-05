<script lang="ts">
  import { gs, view } from '../state.svelte';
  import { bandLevelStep, ladderFloors, towerAt } from '../../core/systems/towers';
  import { floorsInBand } from '../../core/registry';
  import type { BandDef, FloorDef } from '../../core/types';
  import { festivalLadder } from '../../core/systems/festivalRules';
  import {
    MARK_ICON,
    bandFoldable,
    bandHubView,
    bandProgress,
    floorRange,
    ladderBands,
    regionOfTower,
    rideLabel,
    rungView,
    standingBandId,
    towerHubView,
    type LadderBand,
    type StopView,
  } from '../lib/ladderView';
  import { bandIsOpen, setBandOpen } from '../lib/ladderFold.svelte';
  import { armedKey, disarmRide, pressRide, rideBlocked } from '../lib/rideArm.svelte';
  import { viewport } from '../lib/viewport.svelte';
  import { mapRequest } from '../lib/mapRequest.svelte';

  const tower = $derived(towerAt(gs));
  const rungs = $derived(tower ? ladderFloors(tower.id) : []);

  /**
   * The bands shown, highest first: a band by its floors once reached, the
   * next one by its name only, nothing above (lib/ladderView.ts).
   */
  const bands = $derived(tower ? ladderBands(gs, tower) : []);

  /**
   * Each band is a <details>. One folds only when every floor in it is
   * cleared and the player is not standing in it (`bandFoldable`); a band with
   * an uncleared floor stays open so its terms stay in view. The player's
   * choice on a foldable band lives in lib/ladderFold.svelte.ts.
   */
  const standingBand = $derived(standingBandId(gs));

  const foot = $derived(tower ? towerHubView(gs, tower) : null);

  /** The band header's second line: its floors, unless the name already says it, and its order. */
  function bandSub(band: BandDef): string {
    const range = floorRange(floorsInBand(band.id));
    const parts = range && range !== band.name ? [range] : [];
    if (band.order === 'any') parts.push('any order');
    return parts.join(' · ');
  }

  /** "monsters +5 levels": what the next direction will face. */
  function stepLine(band: BandDef): string | null {
    if (!band.levelSteps?.length) return null;
    const floors = floorsInBand(band.id);
    const step = bandLevelStep(gs, { areaId: floors[0]?.areaId ?? '' });
    return `monsters +${step} levels`;
  }

  /**
   * Inside a festival attempt every climb but the one into the royale is a
   * forfeit (systems/festivalRules.ts), so those buttons ask twice (the first
   * press is kept in lib/rideArm.svelte.ts, shared with the map's tower
   * section).
   */
  const inFestival = $derived(festivalLadder(gs, null) === 'forfeit');
  $effect(() => {
    if (!inFestival) disarmRide();
  });

  /**
   * At 600 px and wider the map's tower section carries the ride buttons and
   * this panel prints terms only, so the page has one set of buttons
   * (docs/NAVIGATION.md §3.5). Under 600 px the section has no button and
   * this panel keeps its own. "Show in map" is for the player standing at the
   * hub, where the map shows the city: it opens the tower's tab.
   */
  function showInMap() {
    const region = tower ? regionOfTower(tower) : null;
    if (!region) return;
    mapRequest.region = region;
    // The map is above this panel: bring its top into view.
    queueMicrotask(() => document.querySelector('.map-toggle')?.scrollIntoView({ block: 'start' }));
  }
</script>

{#snippet rideButton(stop: StopView)}
  {#if stop.action && !viewport.wide}
    <button
      class="small"
      class:forfeit={stop.action.kind === 'forfeit'}
      disabled={rideBlocked(gs)}
      onclick={() => pressRide(stop.action!)}
    >
      {rideLabel(stop.action, armedKey() === stop.action.key, view.stats.travelSpeed)}
    </button>
  {/if}
{/snippet}

{#snippet floorCard(floor: FloorDef)}
  {@const stop = rungView(gs, floor)}
  <div class="rung" class:current={stop.current} class:sealed={stop.status === 'sealed'}>
    <div class="rung-name">
      <span class="rung-icon">{MARK_ICON[stop.mark]}</span>
      <b>{stop.name ?? `Floor ${floor.index}`}</b>
    </div>
    {#if stop.name}
      <div class="rung-sub dim small">
        Floor {floor.index}
        {#if stop.current}<span class="here-label">you are here</span>{/if}
      </div>
    {/if}
    <!-- The terms are the teaching: a shut door always says what opens it. -->
    {#each stop.terms as t}
      <div class="term small" class:dim={t.dim}>{t.icon ? `${t.icon} ` : ''}{t.text}</div>
    {/each}
    {@render rideButton(stop)}
  </div>
{/snippet}

{#snippet hubCard(band: BandDef)}
  {@const stop = bandHubView(gs, band)}
  <div class="rung band-hub" class:current={stop.current} class:sealed={stop.status === 'sealed'}>
    <div class="rung-name">
      <span class="rung-icon">{MARK_ICON[stop.mark]}</span>
      <b>{stop.icon} {stop.name}</b>
    </div>
    <div class="rung-sub dim small">
      Hub
      {#if stop.current}<span class="here-label">you are here</span>{/if}
    </div>
    {#each stop.terms as t}
      <div class="term small" class:dim={t.dim}>{t.icon ? `${t.icon} ` : ''}{t.text}</div>
    {/each}
    {@render rideButton(stop)}
  </div>
{/snippet}

{#snippet bandBlock(lb: LadderBand)}
  {@const band = lb.band}
  {#if lb.titleOnly}
    <!-- The next band, not reached: a name and nothing to fold. -->
    <section class="ladder-band title-only">
      <div class="band-head"><b>{band.name}</b></div>
    </section>
  {:else}
    {@const foldable = bandFoldable(gs, lb, standingBand)}
    {@const open = bandIsOpen(band.id, foldable)}
    {@const progress = bandProgress(gs, lb)}
    {@const step = stepLine(band)}
    <details
      class="ladder-band"
      class:fixed={!foldable}
      bind:open={() => open, (v) => setBandOpen(band.id, foldable, v)}
    >
      <!-- A band that may not fold keeps its header as a label: the click does nothing. -->
      <summary
        class="band-head"
        onclick={(e) => {
          if (!foldable) e.preventDefault();
        }}
      >
        <b>{band.name}</b>
        {#if bandSub(band)}<span class="dim small">{bandSub(band)}</span>{/if}
        <span class="dim small">{progress.cleared} of {progress.total} cleared</span>
        {#if step && open}<span class="small">⚖️ {step}</span>{/if}
      </summary>
      {#if lb.cards.length}
        <div class="band-floors">
          {#each lb.cards as card (card.kind === 'floor' ? card.floor.id : `hub:${card.band.id}`)}
            {#if card.kind === 'floor'}
              {@render floorCard(card.floor)}
            {:else}
              {@render hubCard(card.band)}
            {/if}
          {/each}
        </div>
      {/if}
    </details>
  {/if}
{/snippet}

{#if tower && rungs.length > 0}
  <div class="panel" style="margin-top: 12px">
    <h3>{tower.icon} {tower.name}</h3>
    {#if tower.desc}<p class="dim small">{tower.desc}</p>{/if}
    {#if viewport.wide}
      <p class="ride-hint dim small">
        Rides start from the tower section of the map.
        <button class="small" onclick={showInMap}>Show in map</button>
      </p>
    {/if}
    {#if inFestival}
      <p class="forfeit-note small">
        🎪 Inside the festival, every climb but the one into the royale is a forfeit: you land outside the tower and
        floors 15–16 shut for three days or until the next prestige.
      </p>
    {/if}
    <div class="ladder">
      {#each bands as lb (lb.band.id)}
        {@render bandBlock(lb)}
      {/each}

      <!-- The hub is rung 0: the way back to the city, always open. -->
      {#if foot}
        <div class="band-floors">
          <div class="rung hub" class:current={foot.current}>
            <div class="rung-name">
              <b>{foot.icon} {foot.name}</b>
            </div>
            {#if foot.current}<div class="rung-sub small"><span class="here-label">you are here</span></div>{/if}
            {@render rideButton(foot)}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .ladder {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  section.ladder-band {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .band-head {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 10px;
    padding-bottom: 2px;
    border-bottom: 1px solid var(--border);
  }

  /* A band's header is its fold control: a marker, then name, floors, progress. */
  summary.band-head {
    list-style: none;
    cursor: pointer;
  }

  summary.band-head::-webkit-details-marker {
    display: none;
  }

  summary.band-head::before {
    content: '▸';
    flex: none;
    width: 1em;
    color: var(--text-dim);
  }

  details.ladder-band[open] > summary.band-head::before {
    content: '▾';
  }

  /* A band that may not fold: no marker, no pointer. */
  details.ladder-band.fixed > summary.band-head {
    cursor: default;
  }

  details.ladder-band.fixed > summary.band-head::before {
    content: '';
  }

  details.ladder-band > .band-floors {
    margin-top: 4px;
  }

  /* The next band, not reached: a name and nothing else. */
  .ladder-band.title-only .band-head {
    opacity: 0.65;
    padding-left: calc(1em + 10px); /* lines up with the fold markers above */
  }

  /* Tight columns: a card per floor, as many to a row as fit. */
  .band-floors {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
    gap: 6px;
  }

  .rung {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 8px;
  }

  .rung.current {
    border-color: var(--action);
  }

  .rung.sealed {
    opacity: 0.65;
  }

  .rung.hub {
    border-style: dashed;
  }

  .rung.band-hub {
    border-style: double;
    border-width: 3px;
  }

  .rung-name {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .rung-sub {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .rung button {
    margin-top: 4px;
    align-self: flex-start;
  }

  .here-label {
    font-size: 11px;
    color: var(--action);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .ride-hint {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin: 4px 0 8px;
  }

  /* A climb that forfeits the festival: the warm danger hue, never the blue arc. */
  .forfeit-note {
    color: var(--danger);
    margin: 4px 0 8px;
  }

  button.forfeit {
    border-color: var(--danger);
    color: var(--danger);
  }
</style>
