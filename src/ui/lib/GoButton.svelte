<script lang="ts">
  import { gs, game, view } from '../state.svelte';
  import { getSpot } from '../../core/registry';
  import { ticksToTime } from './format';
  import { routeInfo } from './navigation';

  /**
   * A go link outside the map (the Wayfinding boon): walk to `spot`, and with
   * `activity`, start it on arrival. The same commands the map card issues.
   */
  let { spot, activity }: { spot: string; activity?: string } = $props();

  const here = $derived(spot === gs.spot && !gs.travel);
  const route = $derived(here ? null : routeInfo(gs, spot, view.stats.travelSpeed));
  const stuck = $derived(!!gs.travel || gs.recovering || !!gs.combat?.forced);
  const known = $derived(gs.discovered.includes(spot));
  const running = $derived(here && !!activity && gs.activity === activity);

  const title = $derived.by(() => {
    const name = known ? `${getSpot(spot).icon} ${getSpot(spot).name}` : 'an unknown place';
    if (here) return activity ? `Start here` : `You are at ${name}`;
    if (!route?.path) return `No open route to ${name}${route?.shut ? ` (shut: ${route.shut})` : ''}`;
    const warn = [route.oneWay ? 'one-way road' : '', route.noExit ? 'no retreat on arrival' : '']
      .filter(Boolean)
      .join(', ');
    return `${name} · ${ticksToTime(route.ticks)}${warn ? ` · ${warn}` : ''}`;
  });

  function go() {
    if (activity) game.goAndDo(spot, activity);
    else game.travelPlanTo(spot);
  }
</script>

<button
  class="small go"
  class:selected={running}
  {title}
  disabled={running || (here && !activity) || (!here && (stuck || !route?.path))}
  onclick={go}
>
  {here ? (activity ? '▶ Start' : '📍 Here') : activity ? '🥾 Go & start' : '🥾 Go'}{route?.noExit ? ' ⚔️' : ''}
</button>

<style>
  .go {
    flex: none;
    white-space: nowrap;
  }
</style>
