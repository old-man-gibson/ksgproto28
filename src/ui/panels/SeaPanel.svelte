<script lang="ts">
  import { gs } from '../state.svelte';
  import { MATERIALS, NPCS, SEA_SIDES, SPOTS, getSpot } from '../../core/registry';
  import { SEA, SEA_CRATES_OFFLINE, SEA_CRATES_WON } from '../../core/data/sea.data';
  import { batteryOf, convoyView, dealPrice, heldCount, isWater, seaSide } from '../../core/systems/sea';
  import { ticksToTime } from '../lib/format';

  /**
   * The harbor band's readout (systems/sea.ts): the run's side, crates won,
   * and at a water the convoy in progress and the battery the next leg fires.
   * Before a side is picked it shows at the waters, the recruiters' berths and
   * any port with a road onto a water; after, anywhere on the harbor floors.
   */

  // The floors whose areas hold a water or a side's mission.
  const harborAreas = new Set(
    Object.values(SPOTS)
      .filter((s) => isWater(s.id) || Object.values(SEA_SIDES).some((side) => side.mission.spot === s.id))
      .map((s) => s.areaId),
  );
  // Where the pick is made, and the ports that sail.
  const harborSpots = new Set([
    ...Object.values(SEA_SIDES).map((side) => NPCS[side.giver]?.spotId),
    ...Object.values(SPOTS)
      .filter((s) => s.connections.some((c) => isWater(c.to)))
      .map((s) => s.id),
  ]);

  const side = $derived(seaSide(gs));
  const shown = $derived(
    isWater(gs.spot) || harborSpots.has(gs.spot) || (!!side && harborAreas.has(getSpot(gs.spot).areaId)),
  );
  const view = $derived(convoyView(gs));
  const battery = $derived(batteryOf(gs));
  const deal = $derived(side?.flow === 'convoy' ? dealPrice(gs) : null);
  const won = $derived(gs.stats[SEA_CRATES_WON] ?? 0);
  const offline = $derived(gs.stats[SEA_CRATES_OFFLINE] ?? 0);
  const hold = $derived([
    { id: SEA.cannon, n: heldCount(gs, SEA.cannon), note: `kept, ${SEA.maxCannons} count` },
    { id: SEA.shot, n: heldCount(gs, SEA.shot), note: 'one a leg, loads the cannons' },
    { id: SEA.powder, n: heldCount(gs, SEA.powder), note: 'one a leg, +1 hit' },
    { id: SEA.ration, n: heldCount(gs, SEA.ration), note: 'one a leg, +1 morale' },
  ]);
  const DEAL_NAMES: Record<string, string> = { duty: 'duty waived', buyer: 'a broker', price: 'haggled price' };
</script>

{#if shown}
  <div class="panel sea-readout" style="margin-top: 12px">
    <h3>⚓ The harbor</h3>
    {#if side}
      <div class="sea-side">
        <span class="sea-side-name">{side.icon} {side.name}</span>
        <span class="dim small">your side for this run</span>
      </div>
      <p class="dim small">{side.desc}</p>
    {:else}
      <div class="sea-side">
        <span class="sea-side-name">No side yet</span>
      </div>
      <p class="dim small">
        Accept a join quest at one of the four berths on floor 11 to pick a side. One side a run: the other berths
        withdraw their offers.
      </p>
    {/if}

    <div class="sea-line">
      <span>📦 Crates won this run: <b>{won}</b></span>
      {#if offline > 0}<span class="dim small">(offline: {offline}, paid as cargo at 1 in {SEA.offlineShare})</span>{/if}
    </div>

    {#if view}
      <h4>Convoy {view.clock.convoy + 1}</h4>
      {#if view.roll}
        <div class="sea-line">
          Leg {view.clock.leg! + 1} of {SEA.legs}, ends in {ticksToTime(view.ticksToNext)}
        </div>
        <div class="sea-line small">
          {#if view.side.flow === 'convoy'}
            Threat {view.roll.raiders + view.roll.monsters} (raiders {view.roll.raiders}, monsters {view.roll.monsters})
          {:else if view.side.flow === 'escort'}
            Monsters {view.roll.monsters}
          {:else if view.side.flow === 'raid'}
            Guard {view.roll.guard}
          {:else}
            Pirate crew {view.roll.raiders}
          {/if}
          · your kills this leg {view.kills}
        </div>
      {:else}
        <div class="sea-line">In port. The next convoy sails in {ticksToTime(view.ticksToNext)}.</div>
      {/if}
      <div class="sea-line small">
        {#if view.side.flow === 'recover'}
          {view.cargo.carried} crates aboard the pirate ships
        {:else}
          {view.cargo.crates} of {SEA.crates} crates aboard the convoy
        {/if}
      </div>
      {#if !view.present}
        <div class="sea-warn small">Not sailing: start the hunt here. Idle or away, a leg passes without you.</div>
      {/if}
    {/if}

    <h4>Battery, fired once a leg</h4>
    <div class="sea-line">
      volleys {battery.volleys} × hit {battery.hit} + morale {battery.morale} = <b>{battery.rating}</b>
    </div>
    <ul class="sea-hold small">
      {#each hold as h (h.id)}
        <li>
          {MATERIALS[h.id]?.icon}
          {MATERIALS[h.id]?.name}: {h.n}
          <span class="dim">({h.note})</span>
        </li>
      {/each}
    </ul>

    {#if deal}
      <h4>Port price</h4>
      <div class="sea-line">
        <b>{deal.price}</b> gold a crate · Speechcraft {deal.level}
      </div>
      <ul class="sea-hold small">
        {#each deal.terms as t (t.id)}
          <li class:dim={!t.met}>{t.met ? '✔' : '✖'} {DEAL_NAMES[t.id] ?? t.id} at {t.level}: +{t.gold}</li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .sea-side {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .sea-side-name {
    font-weight: 600;
    color: var(--accent);
  }
  .sea-line {
    margin: 2px 0;
  }
  .sea-warn {
    margin-top: 4px;
    color: var(--danger);
  }
  .sea-hold {
    list-style: none;
    margin: 2px 0;
    padding: 0;
  }
  h4 {
    margin: 10px 0 2px;
  }
</style>
