<script lang="ts">
  import type { TileMapDef } from './types';
  import { drawTileMap } from './draw';

  /**
   * A drawn map, painted once per map def onto a canvas that fills its
   * parent (MapCard lays the spot diagram over it). If no sheet loads — the
   * art packs are not on this machine — `onfallback` fires and the canvas
   * stays blank, so the caller can keep its plain background.
   */
  let { map, onfallback }: { map: TileMapDef; onfallback?: () => void } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    const el = canvas;
    const def = map;
    if (!el) return;
    let live = true;
    drawTileMap(el, def).then((ok) => {
      if (live && !ok) onfallback?.();
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
