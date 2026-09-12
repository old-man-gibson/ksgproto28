<script lang="ts">
  import { gs, game } from '../state.svelte';
  import {
    CLIMB_TICKS_PER_FLOOR,
    currentFloor,
    floorCleared,
    ladderFloors,
    rungStatus,
    towerAt,
  } from '../../core/systems/towers';
  import { BANDS, getSpot } from '../../core/registry';
  import type { FloorDef, UnlockCondition } from '../../core/types';
  import { termText, ticksToTime } from '../lib/format';

  const tower = $derived(towerAt(gs));
  const here = $derived(currentFloor(gs));
  const rungs = $derived(tower ? ladderFloors(tower.id) : []);
  /**
   * The ladder reads the way the stack runs: an 'up' tower lists its highest
   * rung first, so climbing is reading upward. A dungeon would come out
   * inverted for free. `foreknown` is the tower/dungeon split for what lies
   * ahead: a goalpost shows its sealed rungs and their terms; a discovery
   * shows nothing past the first sealed door.
   */
  const shown = $derived.by(() => {
    const list = tower?.foreknown ? rungs : rungs.filter((f) => rungStatus(gs, f) !== 'sealed');
    return tower?.direction === 'down' ? list : [...list].reverse();
  });

  const atHub = $derived(!!tower && gs.spot === tower.hubSpot);
  const fromIndex = $derived(here?.index ?? 0);
  const hub = $derived(tower ? getSpot(tower.hubSpot) : null);

  /** A clear or gate term in words a player can act on (lib/format.ts `termText`). */
  function termList(conds: UnlockCondition[] | undefined): string[] {
    return (conds ?? []).map((c) => termText(c, gs));
  }

  /** Base ticks the climb button will cost (speed applies on top, like roads). */
  function climbTicks(toIndex: number): number {
    return Math.max(1, Math.abs(toIndex - fromIndex)) * CLIMB_TICKS_PER_FLOOR;
  }

  function bandName(floor: FloorDef): string {
    return floor.bandId ? (BANDS[floor.bandId]?.name ?? '') : '';
  }
</script>

{#if tower && rungs.length > 0}
  <div class="panel" style="margin-top: 12px">
    <h3>{tower.icon} {tower.name}</h3>
    {#if tower.desc}<p class="dim small">{tower.desc}</p>{/if}
    <div class="ladder">
      {#each shown as floor (floor.id)}
        {@const status = rungStatus(gs, floor)}
        {@const current = here?.id === floor.id}
        <div class="rung" class:current class:sealed={status === 'sealed'}>
          <div class="rung-main">
            <span class="rung-name">
              {#if status === 'cleared'}✅{:else if status === 'open'}🟢{:else if status === 'gated'}🔒{:else}⛔{/if}
              <b>{floor.name}</b>
              <span class="dim small">Floor {floor.index} · {bandName(floor)}</span>
              {#if current}<span class="here">you are here</span>{/if}
            </span>
            {#if (status === 'open' || status === 'cleared') && !current}
              <button
                class="small"
                disabled={gs.recovering || !!gs.combat?.forced}
                onclick={() => game.climbTo(floor.id)}
              >
                {(tower.direction === 'down') === (floor.index > fromIndex) ? 'Descend' : 'Climb'}
                · {ticksToTime(climbTicks(floor.index))}
              </button>
            {/if}
          </div>
          <!-- The terms are the teaching: a shut door always says what opens it. -->
          {#if status === 'gated'}
            {#each termList(floor.gate) as term}
              <div class="term small">🔒 {term}</div>
            {/each}
          {:else if status === 'sealed'}
            <div class="term small dim">The way up is not cleared.</div>
          {:else if status === 'open' && !floorCleared(gs, floor)}
            {#each termList(floor.clear) as term}
              <div class="term small">🎯 {term}</div>
            {/each}
          {/if}
        </div>
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
                disabled={gs.recovering || !!gs.combat?.forced}
                onclick={() => game.climbTo(null)}
              >
                {tower.direction === 'down' ? 'Climb out' : 'Descend'} · {ticksToTime(climbTicks(0))}
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
</style>
