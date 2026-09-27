<script lang="ts">
  import { untrack } from 'svelte';
  import { gs, ui } from './state.svelte';
  import { AREAS, FLOORS, getSpot } from '../core/registry';
  import { floorCleared } from '../core/systems/towers';
  import { canPrestige } from '../core/systems/prestige';
  import type { FloorDef } from '../core/types';
  import SceneBackdrop from './lib/SceneBackdrop.svelte';
  import { sceneFor } from './lib/scenes';

  /**
   * The moment a rung is cleared, said once and large. UI state only: it
   * watches the floors' clears (derived from counters, so there is no event
   * to listen for) and speaks when one flips during play. A state swapped in
   * wholesale — a reset, an import — re-seeds silently, so loading a save
   * that is already past floor 2 does not throw a party for it.
   */
  const banded = Object.values(FLOORS).filter((f) => f.bandId !== undefined);

  let known = new Set<string>();
  let seededFor = { createdAt: -1, ticks: Infinity };
  let shown = $state<{ floor: FloorDef; prestige: boolean } | null>(null);

  $effect(() => {
    void gs.totalTicks;
    untrack(() => {
      const cleared = banded.filter((f) => floorCleared(gs, f)).map((f) => f.id);
      const swapped = gs.createdAt !== seededFor.createdAt || gs.totalTicks < seededFor.ticks;
      seededFor = { createdAt: gs.createdAt, ticks: gs.totalTicks };
      if (swapped || ui.catchingUp !== null) {
        known = new Set(cleared);
        return;
      }
      for (const id of cleared) {
        if (known.has(id)) continue;
        known.add(id);
        shown = { floor: FLOORS[id], prestige: canPrestige(gs) };
      }
    });
  });

  // The floor's own place: where you stand if you are on it (the glade, when
  // the Elevator wakes), else the floor's backdrop.
  const scene = $derived.by(() => {
    if (!shown) return sceneFor(getSpot(gs.spot));
    const here = getSpot(gs.spot);
    if (here.areaId === shown.floor.areaId) return sceneFor(here);
    return AREAS[shown.floor.areaId]?.scene ?? sceneFor(here);
  });
  const next = $derived(
    shown ? banded.find((f) => f.towerId === shown!.floor.towerId && f.index === shown!.floor.index + 1) : undefined,
  );

  function close() {
    shown = null;
  }
</script>

{#if shown}
  <div class="overlay" role="presentation" onclick={(e) => e.target === e.currentTarget && close()}>
    <div class="card" role="dialog" aria-modal="true" aria-label="Floor cleared">
      <div class="art">
        <SceneBackdrop {scene} awake />
        <div class="title">
          <div class="kicker">Floor {shown.floor.index} cleared</div>
          <h2>{shown.floor.name}</h2>
        </div>
      </div>
      <div class="body">
        {#if shown.floor.id === 'ascent_f2'}
          <p>The Grand Elevator is awake. It carries you to every floor above this one.</p>
        {:else if next}
          <p>The way up to floor {next.index}, {next.name}, is open once its gate is met.</p>
        {:else}
          <p>This is the last floor on the ladder so far.</p>
        {/if}
        {#if shown.prestige}
          <p class="prestige">
            ♻️ <b>Prestige is available.</b> Ending this run now pays points for everything it reached; points
            buy boons that carry into every run after. You can also keep climbing and prestige later.
          </p>
        {/if}
        <div class="actions">
          {#if shown.prestige}
            <button
              onclick={() => {
                ui.tab = 'prestige';
                close();
              }}>♻️ See the Prestige tab</button
            >
          {/if}
          <button class="selected" onclick={close}>Onward</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<svelte:window onkeydown={(e) => shown && e.key === 'Escape' && close()} />

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 62%);
    animation: fade 0.4s ease-out;
  }
  @keyframes fade {
    from { opacity: 0; }
  }
  .card {
    width: min(560px, 92vw);
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg-panel);
    border: 1px solid #ffd36b;
    box-shadow: 0 0 40px color-mix(in srgb, #ffd36b 30%, transparent);
    animation: rise 0.5s cubic-bezier(0.2, 1.4, 0.4, 1);
  }
  @keyframes rise {
    from { transform: translateY(24px) scale(0.96); opacity: 0; }
  }
  .art {
    position: relative;
    height: 190px;
  }
  .title {
    position: absolute;
    left: 18px;
    bottom: 12px;
    text-shadow: 0 2px 6px #000, 0 0 14px #000;
  }
  .kicker {
    color: #ffd36b;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 12px;
  }
  .title h2 {
    margin: 0;
    font-size: 1.8rem;
  }
  .body {
    padding: 14px 18px 16px;
  }
  .prestige {
    padding: 8px 10px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
