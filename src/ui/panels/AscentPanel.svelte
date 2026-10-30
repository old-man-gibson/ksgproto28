<script lang="ts">
  import { gs, game } from '../state.svelte';
  import {
    CLIMB_TICKS_PER_FLOOR,
    bandBaseIndex,
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
  import { BANDS, bandsOf, floorsInBand, getSpot } from '../../core/registry';
  import type { BandDef, FloorDef, UnlockCondition } from '../../core/types';
  import { festivalLadder, festivalLocked, lockoutLeft } from '../../core/systems/festivalRules';
  import { msToTime, termText, ticksToTime } from '../lib/format';
  import { MS_PER_TICK } from '../../core/engine/loop';

  const tower = $derived(towerAt(gs));
  const here = $derived(currentFloor(gs));
  const rungs = $derived(tower ? ladderFloors(tower.id) : []);

  /**
   * One line of the ladder: a floor, or a band's hub (band 3's castle), which
   * sits at the foot of its band.
   */
  type Row = { kind: 'floor'; floor: FloorDef; sibling: boolean } | { kind: 'hub'; band: BandDef };

  /**
   * The ladder reads the way the stack runs: an 'up' tower lists its highest
   * rung first, so climbing is reading upward. A dungeon would come out
   * inverted for free. `foreknown` is the tower/dungeon split for what lies
   * ahead: a goalpost shows its sealed rungs and their terms; a discovery
   * shows nothing past the first sealed door. An `any` band's floors are
   * siblings, none above another, so they keep their own order (south, west,
   * north, east) with the hub beneath them.
   */
  const rows = $derived.by((): Row[] => {
    if (!tower) return [];
    const up = tower.direction !== 'down';
    const shows = (status: string) => tower.foreknown || status !== 'sealed';
    const blocks = bandsOf(tower.id).map((band): Row[] => {
      const any = band.order === 'any';
      const floors: Row[] = rungs
        .filter((f) => f.bandId === band.id && shows(rungStatus(gs, f)))
        .map((floor) => ({ kind: 'floor', floor, sibling: any }));
      const hub: Row[] = band.hub && shows(hubStatus(gs, band)) ? [{ kind: 'hub', band }] : [];
      const ordered = any || !up ? floors : [...floors].reverse();
      return up ? [...ordered, ...hub] : [...hub, ...ordered];
    });
    return (up ? blocks.reverse() : blocks).flat();
  });

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

  function bandName(floor: FloorDef): string {
    return floor.bandId ? (BANDS[floor.bandId]?.name ?? '') : '';
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
      {#each rows as row (row.kind === 'floor' ? row.floor.id : `hub:${row.band.id}`)}
        {#if row.kind === 'floor'}
          {@const floor = row.floor}
          {@const status = rungStatus(gs, floor)}
          {@const current = here?.id === floor.id}
          {@const locked = festivalLocked(gs, floor)}
          {@const verdict = festivalLadder(gs, floor.id)}
          <div class="rung" class:current class:sealed={status === 'sealed'} class:sibling={row.sibling}>
            <div class="rung-main">
              <span class="rung-name">
                {#if locked}🔒{:else if status === 'cleared'}✅{:else if status === 'open' && (verdict === 'closed' || verdict === 'shut')}🚪{:else if status === 'open'}🟢{:else if status === 'gated'}🔒{:else}⛔{/if}
                <b>{floor.name}</b>
                <span class="dim small">Floor {floor.index} · {bandName(floor)}{row.sibling ? ' · any order' : ''}</span>
                {#if current}<span class="here">you are here</span>{/if}
              </span>
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
              {#if row.sibling && !floor.gate?.length}
                <div class="term small dim">Opens with the band: see its hub below.</div>
              {/if}
            {:else if status === 'sealed'}
              <div class="term small dim">The way up is not cleared.</div>
            {:else if status === 'open' && !floorCleared(gs, floor)}
              {#each termList(floor.clear) as term}
                <div class="term small">🎯 {term}</div>
              {/each}
            {/if}
          </div>
        {:else}
          {@const band = row.band}
          {@const spot = getSpot(band.hub!)}
          {@const status = hubStatus(gs, band)}
          {@const current = gs.spot === band.hub}
          {@const step = stepLine(band)}
          <div class="rung band-hub" class:current class:sealed={status === 'sealed'}>
            <div class="rung-main">
              <span class="rung-name">
                {#if status === 'open'}🟢{:else if status === 'gated'}🔒{:else}⛔{/if}
                {spot.icon} <b>{spot.name}</b>
                <span class="dim small">Hub · {band.name}</span>
                {#if current}<span class="here">you are here</span>{/if}
              </span>
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
            {#if status === 'gated'}
              {#each termList(band.gate) as term}
                <div class="term small">🔒 {term}</div>
              {/each}
            {:else if status === 'sealed'}
              <div class="term small dim">The way up is not cleared.</div>
            {:else if step}
              <div class="term small">⚖️ {step}</div>
            {/if}
          </div>
        {/if}
      {/each}

      <!-- The hub is rung 0: the way back to the city, always open. -->
      {#if hub}
        <div class="rung hub" class:current={atHub}>
          <div class="rung-main">
            <span class="rung-name">
              {hub.icon} <b>{hub.name}</b>
              {#if atHub}<span class="here">you are here</span>{/if}
            </span>
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
    gap: 6px;
  }

  .rung {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
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

  /* An any-order band: its floors are siblings, indented over their hub. */
  .rung.sibling {
    margin-left: 14px;
  }

  .rung.band-hub {
    border-style: double;
    border-width: 3px;
  }

  .rung-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .rung-name {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .here {
    font-size: 11px;
    color: var(--action, #7de0c3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .term {
    margin-top: 4px;
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
