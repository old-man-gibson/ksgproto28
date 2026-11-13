<script lang="ts">
  import { hasUndrawn, splitGlyphs } from './glyphs';
  import { artUrl } from './iconArt';

  /**
   * A string drawn with pixel art in place of the emoji the glyph table names
   * (glyphs.ts): log lines, tooltip lines, button labels, anything built as
   * text. The other emoji, and every emoji when the art is not on disk or in
   * the art pack, stay text, so a checkout without the packs reads as before.
   * `alt` is the emoji, so a reader or a failed load still gets it.
   *
   * Each glyph is one fixed box, `size` + 2 px wide and `size` px high, whether
   * it holds the image or the emoji: the art pack resolves its URLs after the
   * first paint, and a state can swap the picture for an emoji (job icons, a
   * lock), so a glyph never changes the width or height of its line. The box
   * has negative vertical margins, so it adds no height to the line either
   * (docs/plans/pixel-icons.md §4.5); a one-line box that clips its overflow
   * keeps the glyph by giving the clip a few pixels of padding (`.clip-glyph`,
   * below).
   *
   * `plain` draws the string as text, every emoji included. A caller sets it
   * for a line that lists many kinds of thing (a loot tally) when only some of
   * them have a drawing, so the line is never half art and half emoji.
   * `whole` does the same only when the string holds an emoji with no drawing
   * (a log line whose achievement icon has none): a line of drawn emoji only
   * stays art.
   */
  let {
    text,
    size = 16,
    plain = false,
    whole = false,
  }: { text: string; size?: 16 | 32; plain?: boolean; whole?: boolean } = $props();

  const parts = $derived.by(() => {
    if (plain) return [{ text }];
    const split = splitGlyphs(text);
    if (whole && hasUndrawn(split)) return [{ text }];
    return split.map((part) => ('glyph' in part ? { glyph: part.glyph, url: artUrl(part.name) } : part));
  });
</script>

{#each parts as part}{#if 'glyph' in part}<span class="glyph" style:--gs="{size}px">{#if part.url}<img src={part.url} alt={part.glyph} width={size} height={size} />{:else}{part.glyph}{/if}</span>{:else}{part.text}{/if}{/each}

<style>
  .glyph {
    display: inline-block;
    box-sizing: border-box;
    flex: none;
    width: calc(var(--gs) + 2px);
    height: var(--gs);
    /* A margin box of 8px, centred on the line: the glyph overflows the line
       box instead of stretching it. The box rides 1px above the x-height
       middle, which is the middle of the digits and capitals beside it. */
    margin: calc((var(--gs) - 8px) / -2) 0;
    position: relative;
    top: -1px;
    vertical-align: middle;
    text-align: center;
    white-space: nowrap;
    /* The emoji fallback: 13px at 16, so its advance (about 1.37em) fits the box. */
    font-size: calc(var(--gs) * 0.8125);
    line-height: var(--gs);
  }

  /* For a one-line box with `overflow: hidden` (an ellipsis) that holds a
     glyph: the clip edge moves out by 3px and the margin takes the 3px back,
     so the box keeps its size and the 16px glyph is not cut by a 13px line. */
  :global(.clip-glyph) {
    padding-block: 3px;
    margin-block: -3px;
  }

  .glyph img {
    display: block;
    margin: 0 auto;
    width: var(--gs);
    height: var(--gs);
    image-rendering: pixelated;
  }
</style>
