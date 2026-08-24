<script lang="ts">
  /**
   * Routes whatever the map has selected to the editor that owns it.
   *
   * A `find` selection opens its spot: finds are edited on the threshold track
   * inside SpotInspector, where their depths can be compared, rather than as a
   * thing standing on its own.
   */
  import type { Selection } from '../lib/selection';
  import SpotInspector from './SpotInspector.svelte';
  import EdgeInspector from './EdgeInspector.svelte';
  import NpcInspector from './NpcInspector.svelte';

  interface Props {
    selection: Selection;
    onselect: (s: Selection) => void;
  }
  let { selection, onselect }: Props = $props();

  const GESTURES: [string, string][] = [
    ['click', 'select a spot, an edge, or an NPC'],
    ['drag', 'place a spot — writes map.x / map.y'],
    ['shift-drag', 'pull a connection out of a spot onto another'],
    ['double-click', 'new spot on empty canvas'],
    ['wheel', 'zoom about the cursor'],
    ['drag canvas', 'pan (middle button works anywhere)'],
    ['Del', 'remove the selected connection'],
    ['Esc', 'clear the selection'],
    ['Ctrl+S', 'review the diff and write to disk'],
  ];
</script>

<div class="pad">
  {#if !selection}
    <div class="intro">
      <div class="empty">Nothing selected.</div>
      <div class="section">Map gestures</div>
      <dl>
        {#each GESTURES as [key, what] (key)}
          <dt>{key}</dt>
          <dd>{what}</dd>
        {/each}
      </dl>
    </div>
  {:else if selection.type === 'spot'}
    <SpotInspector id={selection.id} {onselect} />
  {:else if selection.type === 'find'}
    <SpotInspector id={selection.spot} {onselect} />
  {:else if selection.type === 'edge'}
    <EdgeInspector from={selection.from} to={selection.to} {onselect} />
  {:else}
    <NpcInspector id={selection.id} {onselect} />
  {/if}
</div>

<style>
  .pad {
    padding: 12px 14px 40px;
  }

  .intro {
    color: var(--dim);
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 5px 10px;
    font-size: 11.5px;
    line-height: 1.35;
    margin-top: 4px;
  }

  dt {
    font-family: var(--mono);
    color: var(--text);
    white-space: nowrap;
  }

  dd {
    color: var(--dimmer);
  }
</style>
