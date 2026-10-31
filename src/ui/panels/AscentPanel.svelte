<script lang="ts">
  import { gs, game } from '../state.svelte';
  import {
    CLIMB_TICKS_PER_FLOOR,
    bandBaseIndex,
    bandHubAt,
    bandLevelStep,
    climbVerb,
    currentFloor,
    floorCleared,
    hubStatus,
    ladderFloors,
    rungIndex,
    rungStatus,
    standingIndex,
    towerAt,
  } from '../../core/systems/towers';
  import { BANDS, floorsInBand, getSpot } from '../../core/registry';
  import type { BandDef, FloorDef, UnlockCondition } from '../../core/types';
  import { festivalLadder, festivalLocked, lockoutLeft } from '../../core/systems/festivalRules';
  import { msToTime, termText, ticksToTime } from '../lib/format';
  import { floorRange, homeGroupId, ladderBands, ladderGroups, type LadderBand } from '../lib/ladderView';
  import { MS_PER_TICK } from '../../core/engine/loop';

  const tower = $derived(towerAt(gs));
  const here = $derived(currentFloor(gs));
  const rungs = $derived(tower ? ladderFloors(tower.id) : []);

  /**
   * The bands shown, highest first: a band by its floors once reached, the
   * next one by its name only, nothing above (lib/ladderView.ts).
   */
  const bands = $derived(tower ? ladderBands(gs, tower) : []);

  /**
   * Below NARROW_PX the band rows wrap to one or two cards each and the
   * ladder runs long, so the bands are gathered three to a collapsible group.
   * The group holding the player (or the highest band reached) opens by
   * default; a group the player opens or shuts stays that way.
   */
  const NARROW_PX = 600;
  let width = $state(0);
  const narrow = $derived(width > 0 && width < NARROW_PX);
  const groups = $derived(narrow ? ladderGroups(bands) : []);
  const homeGroup = $derived(homeGroupId(groups, here?.bandId ?? bandHubAt(gs.spot)?.id));
  let groupOpen = $state<Record<number, boolean>>({});

  const atHub = $derived(!!tower && gs.spot === tower.hubSpot);
  const fromIndex = $derived(standingIndex(gs));
  const hub = $derived(tower ? getSpot(tower.hubSpot) : null);

  /** A clear or gate term in words a player can act on (lib/format.ts `termText`). */
  function termList(conds: UnlockCondition[] | undefined): string[] {
    return (conds ?? []).map((c) => termText(c, gs));
  }

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

  /** "2 of 4 cleared · monsters +5 levels": what the next direction will face. */
  function stepLine(band: BandDef): string | null {
    if (!band.levelSteps?.length) return null;
    const floors = floorsInBand(band.id);
    const cleared = floors.filter((f) => floorCleared(gs, f)).length;
    const step = bandLevelStep(gs, { areaId: floors[0]?.areaId ?? '' });
    return `${cleared} of ${floors.length} cleared · monsters +${step} levels`;
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
  {@const band = floor.bandId ? BANDS[floor.bandId] : undefined}
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
    {#if locked}
      <div class="term small">🔒 Shut after a lost festival attempt: {msToTime(lockoutLeft(gs) * MS_PER_TICK)} of play, or the next prestige.</div>
    {:else if (status === 'open' || status === 'cleared') && verdict === 'closed'}
      <!-- The royale has no door of its own: an attempt reaches it from floor 15's hall. -->
      <div class="term small dim">🏟️ Entered from floor 15’s hall, during a festival attempt.</div>
    {:else if (status === 'open' || status === 'cleared') && verdict === 'shut'}
      <div class="term small dim">🚪 Opens from the hall once the dark room is empty.</div>
    {:else if status === 'gated'}
      {#each termList(floor.gate) as term}
        <div class="term small">🔒 {term}</div>
      {/each}
      {#if band?.hub && !floor.gate?.length}
        <div class="term small dim">Opens with {getSpot(band.hub).name}.</div>
      {/if}
    {:else if status === 'sealed'}
      <div class="term small dim">The way up is not cleared.</div>
    {:else if status === 'open' && !floorCleared(gs, floor)}
      {#each termList(floor.clear) as term}
        <div class="term small">🎯 {term}</div>
      {/each}
    {/if}
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
    {#if status === 'gated'}
      {#each termList(band.gate) as term}
        <div class="term small">🔒 {term}</div>
      {/each}
    {:else if status === 'sealed'}
      <div class="term small dim">The way up is not cleared.</div>
    {/if}
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
  {@const step = lb.titleOnly ? null : stepLine(band)}
  <section class="ladder-band" class:title-only={lb.titleOnly}>
    <div class="band-head">
      <b>{band.name}</b>
      {#if !lb.titleOnly}
        {#if bandSub(band)}<span class="dim small">{bandSub(band)}</span>{/if}
        {#if step}<span class="small">⚖️ {step}</span>{/if}
      {/if}
    </div>
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
  </section>
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
    <div class="ladder" bind:clientWidth={width}>
      {#if narrow}
        {#each groups as group (group.id)}
          <!-- A group holding only the next band's name has nothing to fold. -->
          {#if group.bands.every((b) => b.titleOnly)}
            {#each group.bands as lb (lb.band.id)}
              {@render bandBlock(lb)}
            {/each}
          {:else}
            <details
              class="ladder-group"
              bind:open={() => groupOpen[group.id] ?? group.id === homeGroup, (v) => (groupOpen[group.id] = v)}
            >
              <summary>{group.label}</summary>
              <div class="ladder-group-body">
                {#each group.bands as lb (lb.band.id)}
                  {@render bandBlock(lb)}
                {/each}
              </div>
            </details>
          {/if}
        {/each}
      {:else}
        {#each bands as lb (lb.band.id)}
          {@render bandBlock(lb)}
        {/each}
      {/if}

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

  .ladder-band {
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

  /* The next band, not reached: a name and nothing else. */
  .ladder-band.title-only .band-head {
    opacity: 0.65;
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

  .ladder-group > summary {
    cursor: pointer;
    padding: 4px 0;
    font-weight: bold;
  }

  .ladder-group-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px 0 6px;
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
