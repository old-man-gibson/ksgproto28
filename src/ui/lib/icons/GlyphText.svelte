<script lang="ts">
  import { splitGlyphs } from './glyphs';
  import { artUrl } from './iconArt';

  /**
   * A string drawn with pixel art in place of the emoji the glyph table names
   * (glyphs.ts): log lines, tooltip lines, button labels, anything built as
   * text. The other emoji, and every emoji when the art is not on disk or in
   * the art pack, stay text, so a checkout without the packs reads as before.
   * `alt` is the emoji, so a reader or a failed load still gets it.
   *
   * The image is a fixed `size` box with negative vertical margins: it sits
   * inside the line's own height, so a line with art is as tall as the same
   * line with the emoji (docs/plans/pixel-icons.md §4.5).
   */
  let { text, size = 16 }: { text: string; size?: 16 | 32 } = $props();

  const parts = $derived(
    splitGlyphs(text).map((part) => ('glyph' in part ? { glyph: part.glyph, url: artUrl(part.name) } : part)),
  );
</script>

{#each parts as part}{#if 'glyph' in part}{#if part.url}<img class="glyph-art" src={part.url} alt={part.glyph} width={size} height={size} />{:else}{part.glyph}{/if}{:else}{part.text}{/if}{/each}

<style>
  .glyph-art {
    display: inline-block;
    box-sizing: content-box;
    image-rendering: pixelated;
    vertical-align: middle;
    margin: -4px 1px;
    flex: none;
  }
</style>
