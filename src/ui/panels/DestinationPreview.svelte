<script lang="ts">
  import { gs, game, ui } from '../state.svelte';
  import { getSpot } from '../../core/registry';
  import { journeyEnd, locationBreadcrumb } from '../../core/systems/locations';
  import { exploreProgress, spotActivities } from '../../core/systems/actions';
  import { npcsAt } from '../../core/systems/quests';
  import { activityName, spotFeatures } from '../lib/navigation';

  /**
   * The place the journey in progress ends, read ahead of arrival. Walking is
   * dead time only if there is nothing to decide during it: here the player
   * sees what stands at the end and queues what to do there.
   */
  const endId = $derived(journeyEnd(gs));
  const spot = $derived(endId ? getSpot(endId) : null);
  const known = $derived(!!endId && gs.discovered.includes(endId));
  const features = $derived(spot && known ? spotFeatures(gs, spot) : []);
  const activities = $derived(spot && known ? spotActivities(spot) : []);
  const people = $derived(endId && known ? npcsAt(endId) : []);

  /** What arrival will start: the queued intent, else the spot's resume entry. */
  const onArrival = $derived.by(() => {
    if (!endId) return null;
    if (gs.travelIntent?.spot === endId) return { kind: 'queued', id: gs.travelIntent.activity };
    const resume = gs.resumeActivity[endId];
    return resume ? { kind: 'resume', id: resume } : null;
  });

  function toggle(activityId: string) {
    game.setJourneyIntent(gs.travelIntent?.activity === activityId ? null : activityId);
  }

  function toggleBench(bench: string) {
    if (!endId) return;
    const queued = ui.benchOnArrival?.spot === endId && ui.benchOnArrival.bench === bench;
    ui.benchOnArrival = queued ? null : { spot: endId, bench };
  }
</script>

{#if spot && endId}
  <div class="panel" style="margin-top: 12px">
    {#if known}
      <div class="dim small">{locationBreadcrumb(endId)}</div>
      <h3>Journey ends at {spot.icon} {spot.name}</h3>
      <p class="dim small">{spot.desc}</p>
    {:else}
      <h3>Journey ends at ❓ an unknown place</h3>
      <p class="dim small">Not visited. Its contents show on arrival.</p>
    {/if}

    {#if known}
      <div class="arrival small">
        <span class="dim">On arrival:</span>
        {#if onArrival}
          {onArrival.kind === 'queued' ? 'start' : 'resume'} {activityName(endId, onArrival.id)}
        {:else}
          nothing queued (idle, banks bonus time)
        {/if}
      </div>

      {#if activities.length}
        <div class="section">Queue an activity for arrival</div>
        <div class="grid">
          {#each activities as act (act.id)}
            <button
              class="small"
              class:selected={gs.travelIntent?.spot === endId && gs.travelIntent.activity === act.id}
              onclick={() => toggle(act.id)}
            >
              {act.icon} {act.name}
            </button>
          {/each}
        </div>
      {/if}

      {#if features.length}
        <div class="section">Here</div>
        {#each features as f (f.key)}
          <div class="row small">
            <span>{f.icon} {f.label}</span>
            {#if f.bench}
              <button
                class="small"
                class:selected={ui.benchOnArrival?.spot === endId && ui.benchOnArrival.bench === f.bench}
                title="Open this bench when the journey ends"
                onclick={() => toggleBench(f.bench!)}
              >
                Open on arrival
              </button>
            {/if}
          </div>
        {/each}
      {/if}

      {#if people.length}
        <div class="section">People</div>
        <div class="small">{people.map((n) => `${n.icon} ${n.name}`).join(' · ')}</div>
      {/if}

      {#if spot.exploreTicks}
        <div class="small dim" style="margin-top: 6px">
          Exploration: {Math.floor(exploreProgress(gs, spot) * 100)}%
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .arrival {
    margin-bottom: 4px;
  }

  .section {
    margin-top: 8px;
    margin-bottom: 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-dim);
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }
</style>
