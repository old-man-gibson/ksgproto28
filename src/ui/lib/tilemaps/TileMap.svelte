<script lang="ts">
  import type { TileMapDef } from './types';
  import { untrack } from 'svelte';
  import { drawTileMap } from './draw';
  import { artPack } from '../artPack/artPack.svelte';

  /**
   * A drawn map, painted once per map def onto a canvas that fills its
   * parent (MapCard lays the spot diagram over it). If no sheet loads — the
   * art packs are not on this machine and none is imported — `onfallback`
   * fires and the canvas is left blank, so the caller can keep its plain
   * background. The map is drawn again when the art pack is imported or
   * removed, and `onready` fires when that draw finds sheets.
   */
  let {
    map,
    onfallback,
    onready,
  }: { map: TileMapDef; onfallback?: () => void; onready?: () => void } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    const el = canvas;
    const def = map;
    void artPack.epoch;
    if (!el) return;
    let live = true;
    // The draw reads sheets asynchronously; only the epoch above re-runs it.
    untrack(() => drawTileMap(el, def)).then((ok) => {
      if (!live) return;
      if (ok) {
        onready?.();
      } else {
        el.getContext('2d')?.clearRect(0, 0, el.width, el.height);
        onfallback?.();
      }
    });
    return () => {
      live = false;
    };
  });
</script>

<canvas bind:this={canvas} class="tiles" aria-hidden="true"></canvas>

<style>
  .tiles {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    pointer-events: none;
  }
</style>
