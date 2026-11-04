<script lang="ts">
  import { gs, game } from '../state.svelte';
  import {
    CLIMB_TICKS_PER_FLOOR,
    bandBaseIndex,
    bandLevelStep,
    climbVerb,
    currentFloor,
    hubStatus,
    ladderFloors,
    rungIndex,
    rungStatus,
    standingIndex,
    towerAt,
  } from '../../core/systems/towers';
  import { floorsInBand, getSpot } from '../../core/registry';
  import type { BandDef, FloorDef } from '../../core/types';
  import { festivalLadder, festivalLocked } from '../../core/systems/festivalRules';
  import { ticksToTime } from '../lib/format';
  import {
    bandFoldable,
    bandProgress,
    floorRange,
    hubTerms,
    ladderBands,
    rungTerms,
    standingBandId,
    type LadderBand,
  } from '../lib/ladderView';
  import { bandIsOpen, setBandOpen } from '../lib/ladderFold.svelte';

  const tower = $derived(towerAt(gs));
  const here = $derived(currentFloor(gs));
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

  const atHub = $derived(!!tower && gs.spot === tower.hubSpot);
  const fromIndex = $derived(standingIndex(gs));
  const hub = $derived(tower ? getSpot(tower.hubSpot) : null);

  /** Base ticks the climb button will cost (speed applies on top, like roads). */
  function climbTicks(toIndex: number): number {
    return Math.max(1, Math.abs(toIndex - fromIndex)) * CLIMB_TICKS_PER_FLOOR;
  }

  /** The button's verb: up or down the stack, or across between rungs at one height. */
  function moveLabel(toIndex: number): string {
    if (!tower) return '';
    const verb = climbVerb(tower, fromIndex, toIndex);
    return verb === 'Crossing' ? 'Go' : verb === 'Climbing' ? 'Climb' : 'Descend';
  }

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
   * forfeit (systems/festivalRules.ts), so those buttons ask twice. `armed`
   * is the destination the first click picked: a floor id, `hub` or
   * `band:<id>`.
   */
  let armed = $state<string | null>(null);
  const inFestival = $derived(festivalLadder(gs, null) === 'forfeit');

  /** Run a climb, or arm it first when it would forfeit the festival. */
  function climbOrArm(key: string, forfeits: boolean, go: () => void) {
    if (forfeits && armed !== key) {
      armed = key;
      return;
    }
    armed = null;
    go();
  }
</script>

{#snippet floorCard(floor: FloorDef, named: boolean)}
  {@const status = rungStatus(gs, floor)}
  {@const current = here?.id === floor.id}
  {@const locked = festivalLocked(gs, floor)}
  {@const verdict = festivalLadder(gs, floor.id)}
  <div class="rung" class:current class:sealed={status === 'sealed'}>
    <div class="rung-name">
      <span class="rung-icon">
        {#if locked}🔒{:else if status === 'cleared'}✅{:else if status === 'open' && (verdict === 'closed' || verdict === 'shut')}🚪{:else if status === 'open'}🟢{:else if status === 'gated'}🔒{:else}⛔{/if}
      </span>
      <b>{named ? floor.name : `Floor ${floor.index}`}</b>
    </div>
    {#if named}
      <div class="rung-sub dim small">
        Floor {floor.index}
        {#if current}<span class="here">you are here</span>{/if}
      </div>
    {/if}
    <!-- The terms are the teaching: a shut door always says what opens it. -->
    {#each rungTerms(gs, floor).terms as t}
      <div class="term small" class:dim={t.dim}>{t.icon ? `${t.icon} ` : ''}{t.text}</div>
    {/each}
    {#if (status === 'open' || status === 'cleared') && !current && !locked && verdict !== 'shut' && verdict !== 'closed'}
      <button
        class="small"
        class:forfeit={verdict === 'forfeit'}
        disabled={gs.recovering || !!gs.combat?.forced}
        onclick={() => climbOrArm(floor.id, verdict === 'forfeit', () => game.climbTo(floor.id))}
      >
        {#if verdict === 'forfeit'}
          {armed === floor.id ? 'Confirm: forfeit the festival' : `Forfeit · ${moveLabel(rungIndex(floor))}`}
        {:else if verdict === 'royale'}
          Enter the royale · {ticksToTime(climbTicks(rungIndex(floor)))}
        {:else}
          {moveLabel(rungIndex(floor))} · {ticksToTime(climbTicks(rungIndex(floor)))}
        {/if}
      </button>
    {/if}
  </div>
{/snippet}

{#snippet hubCard(band: BandDef)}
  {@const spot = getSpot(band.hub!)}
  {@const status = hubStatus(gs, band)}
  {@const current = gs.spot === band.hub}
  <div class="rung band-hub" class:current class:sealed={status === 'sealed'}>
    <div class="rung-name">
      <span class="rung-icon">{#if status === 'open'}🟢{:else if status === 'gated'}🔒{:else}⛔{/if}</span>
      <b>{spot.icon} {spot.name}</b>
    </div>
    <div class="rung-sub dim small">
      Hub
      {#if current}<span class="here">you are here</span>{/if}
    </div>
    {#each hubTerms(gs, band).terms as t}
      <div class="term small" class:dim={t.dim}>{t.icon ? `${t.icon} ` : ''}{t.text}</div>
    {/each}
    {#if status === 'open' && !current}
      <button
        class="small"
        class:forfeit={inFestival}
        disabled={gs.recovering || !!gs.combat?.forced}
        onclick={() => climbOrArm(`band:${band.id}`, inFestival, () => game.climbToHub(band.id))}
      >
        {#if inFestival}
          {armed === `band:${band.id}` ? 'Confirm: forfeit the festival' : `Forfeit · ${moveLabel(bandBaseIndex(band))}`}
        {:else}
          {moveLabel(bandBaseIndex(band))} · {ticksToTime(climbTicks(bandBaseIndex(band)))}
        {/if}
      </button>
    {/if}
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
              {@render floorCard(card.floor, card.named)}
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
      {#if hub}
        <div class="band-floors">
          <div class="rung hub" class:current={atHub}>
            <div class="rung-name">
              <b>{hub.icon} {hub.name}</b>
            </div>
            {#if atHub}<div class="rung-sub small"><span class="here">you are here</span></div>{/if}
            {#if !atHub}
              <button
                class="small"
                class:forfeit={inFestival}
                disabled={gs.recovering || !!gs.combat?.forced}
                onclick={() => climbOrArm('hub', inFestival, () => game.climbTo(null))}
              >
                {#if inFestival}
                  {armed === 'hub' ? 'Confirm: forfeit the festival' : 'Forfeit · Leave the tower'}
                {:else}
                  {tower.direction === 'down' ? 'Climb out' : 'Descend'} · {ticksToTime(climbTicks(0))}
                {/if}
              </button>
            {/if}
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
    border-color: var(--action, #7de0c3);
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

  .here {
    font-size: 11px;
    color: var(--action, #7de0c3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
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
