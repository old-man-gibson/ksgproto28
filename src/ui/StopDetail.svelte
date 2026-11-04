<script lang="ts">
  import { gs, view } from './state.svelte';
  import type { TowerDef } from '../core/types';
  import { DETAIL_GAP, DETAIL_H, rideLabel, stopViewOf } from './lib/ladderView';
  import { armedKey, disarmRide, pressRide, rideBlocked } from './lib/rideArm.svelte';
  import { viewport } from './lib/viewport.svelte';
  import { festivalLadder } from '../core/systems/festivalRules';

  /**
   * What the tower section has picked, under the map: the stop's name and
   * status, its terms (the Ascent panel's lines) and, at the wide layout, its
   * ride button. The slot has one height whatever it holds, so picking another
   * stop or a ride starting moves nothing below it.
   */
  let { tower, stopKey }: { tower: TowerDef; stopKey: string | null } = $props();

  const stop = $derived(stopViewOf(gs, tower, stopKey));

  // The first press of a forfeit means nothing once the attempt is over.
  const inFestival = $derived(festivalLadder(gs, null) === 'forfeit');
  $effect(() => {
    if (!inFestival) disarmRide();
  });

  const title = $derived(
    !stop
      ? ''
      : stop.kind === 'floor'
        ? `Floor ${stop.number}${stop.name ? ` · ${stop.name}` : ''}`
        : `${stop.icon} ${stop.name}`,
  );
</script>

<div class="stop-detail" style:height="{DETAIL_H}px" style:margin-top="{DETAIL_GAP}px">
  {#if stop}
    <div class="sd-head">
      <b class="sd-title">{title}</b>
      <span class="dim small">{stop.word}</span>
      {#if stop.current}<span class="sd-here small">you are here</span>{/if}
      {#if stop.action && viewport.wide}
        <button
          class="small sd-ride"
          class:forfeit={stop.action.kind === 'forfeit'}
          disabled={rideBlocked(gs)}
          onclick={() => pressRide(stop.action!)}
        >
          {rideLabel(stop.action, armedKey() === stop.action.key, view.stats.travelSpeed)}
        </button>
      {/if}
    </div>
    <div class="sd-terms">
      <!-- The terms are the teaching: a shut door always says what opens it. -->
      {#each stop.terms as t}
        <div class="small" class:dim={t.dim}>{t.icon ? `${t.icon} ` : ''}{t.text}</div>
      {/each}
      {#if stop.action && !viewport.wide}
        <div class="small dim">Rides start from the Ascent panel below.</div>
      {/if}
      {#if stop.note}<div class="small dim">{stop.note}</div>{/if}
    </div>
  {:else}
    <div class="small dim">Pick a floor in the list to see its terms.</div>
  {/if}
</div>

<style>
  /* Height and gap come from DETAIL_H and DETAIL_GAP: tall enough for the head and three lines of terms; longer text scrolls inside. */
  .stop-detail {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    overflow: hidden;
    background: var(--bg-sunken);
    border: 1px solid var(--border);
  }

  .sd-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
    min-height: 30px;
  }

  .sd-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sd-here {
    flex: none;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .sd-ride {
    flex: none;
    margin-left: auto;
  }

  .sd-terms {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  /* A climb that forfeits the festival: the warm danger hue, never the blue arc. */
  button.forfeit {
    border-color: var(--danger);
    color: var(--danger);
  }
</style>
