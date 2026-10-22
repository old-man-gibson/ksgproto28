<script lang="ts">
  import { iconUrl } from './iconArt';

  /**
   * One icon: the def's pixel art when its file is on disk (iconArt.ts), its
   * emoji otherwise. A fixed square box either way, so a row never shifts when
   * the art is missing. The art is 32px drawn on a pixel grid: 16 and 32 are
   * the only clean sizes (docs/plans/pixel-icons.md §4.5). `alt` is empty
   * because the name is always printed beside the icon.
   */
  let { of, size = 16 }: { of: { icon: string; art?: string }; size?: 16 | 32 } = $props();

  const url = $derived(iconUrl(of));
</script>

{#if url}
  <img class="icon-art" src={url} alt="" width={size} height={size} />
{:else}
  <span class="icon-glyph" style="width: {size}px; font-size: {Math.round(size * 0.85)}px">{of.icon}</span>
{/if}

<style>
  .icon-art {
    display: inline-block;
    image-rendering: pixelated;
    vertical-align: middle;
    flex: none;
  }

  .icon-glyph {
    display: inline-block;
    text-align: center;
    line-height: 1;
    vertical-align: middle;
    flex: none;
  }
</style>
