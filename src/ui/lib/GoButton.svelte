<script lang="ts">
  import type { Snippet } from 'svelte';
  import { gs, game, view } from '../state.svelte';
  import { getSpot } from '../../core/registry';
  import { ticksToTime } from './format';
  import { routeInfo, type RouteInfo } from './navigation';
  import Tip from './Tip.svelte';

  /**
   * A go link outside the map (the Wayfinding boon, the Stations row): walk to
   * `spot`, and with `activity`, start it on arrival. The same commands the map
   * card issues. `children` replaces the default label (the Stations row prints
   * the activity, the place and the time in it); the tooltip, the warnings and
   * the disabled rules stay GoButton's. `class` adds to the button's own.
   */
  let {
    spot,
    activity,
    children,
    class: extra = '',
  }: {
    spot: string;
    activity?: string;
    children?: Snippet<[{ route: RouteInfo | null; here: boolean }]>;
    class?: string;
  } = $props();

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

<!--
  The title is for a mouse. A touch screen has no hover, so the same text is a tap
  card (lib/Tip.svelte, `touchOnly`): a long press on the button opens it without
  walking, and a tap on a disabled button opens it too, which says why it is shut.
-->
<Tip touchOnly>
  <button
    class="small go {extra}"
    class:selected={running}
    {title}
    disabled={running || (here && !activity) || (!here && (stuck || !route?.path))}
    onclick={go}
  >
    {#if children}
      {@render children({ route, here })}
    {:else}
      {here ? (activity ? '▶ Start' : '📍 Here') : activity ? '🥾 Go & start' : '🥾 Go'}{route?.noExit ? ' ⚔️' : ''}
    {/if}
  </button>
  {#snippet tip()}<div class="tip-line">{title}</div>{/snippet}
</Tip>

<style>
  .go {
    flex: none;
    white-space: nowrap;
  }

  /* On a touch screen a disabled button gets no events of its own, so the card's
     target never hears the press. Let the press fall through to it. A mouse keeps
     the button, and its title tooltip. */
  @media (hover: none) {
    .go:disabled {
      pointer-events: none;
    }
  }
</style>
