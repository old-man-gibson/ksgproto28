<script lang="ts">
  import type { Placement } from '../../core/types';
  import { drawingOf } from './forgeDrawing';

  /**
   * The piece as a smith's pattern: ink outlines at true size on a drafting
   * grid, one square per cell, each part's w×l bracketed beside it (geometry in
   * forgeDrawing.ts). The grid fills the sheet; the drawing sits in its middle,
   * as large as the sheet's width allows.
   */
  let { placement, label }: { placement: Placement; label: string } = $props();

  /** Pixels per cell: the most and the least the drawing is scaled to. */
  const MAX_ZOOM = 22;
  const MIN_ZOOM = 9;
  /** Empty grid around the drawing, in cells. */
  const MARGIN = 1;
  /** The sheet is at least this tall, in pixels, so a dagger does not sit in a sliver. */
  const MIN_HEIGHT = 260;

  let sheetWidth = $state(0);
  const drawing = $derived(drawingOf(placement));
  const dw = $derived(drawing.maxX - drawing.minX + 2 * MARGIN);
  const dh = $derived(drawing.maxY - drawing.minY + 2 * MARGIN);
  const zoom = $derived(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, sheetWidth > 0 ? sheetWidth / dw : MAX_ZOOM)));
  // The view spans the whole sheet so the grid reaches its edges; the drawing is centred in it.
  const vw = $derived(Math.max(dw, sheetWidth / zoom));
  const vh = $derived(Math.max(dh, MIN_HEIGHT / zoom));
  const vx = $derived((drawing.minX + drawing.maxX) / 2 - vw / 2);
  const vy = $derived((drawing.minY + drawing.maxY) / 2 - vh / 2);
  const span = (from: number, to: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(from); v <= Math.floor(to); v++) out.push(v);
    return out;
  };
  const gridX = $derived(span(vx, vx + vw));
  const gridY = $derived(span(vy, vy + vh));
  /** Labels stay readable when the drawing is scaled down: at least 10px. */
  const font = $derived(Math.max(0.5, 10 / zoom));
</script>

<div class="sheet" bind:clientWidth={sheetWidth}>
  <svg width={vw * zoom} height={vh * zoom} viewBox="{vx} {vy} {vw} {vh}" role="img" aria-label={label}>
    <g class="grid" aria-hidden="true">
      {#each gridX as x (x)}<line x1={x} y1={vy} x2={x} y2={vy + vh} vector-effect="non-scaling-stroke" />{/each}
      {#each gridY as y (y)}<line x1={vx} y1={y} x2={vx + vw} y2={y} vector-effect="non-scaling-stroke" />{/each}
    </g>
    {#each drawing.strokes as st, i (i)}
      <path d={st.d} class="ink {st.ink}" style:fill={st.tint ?? 'none'} vector-effect="non-scaling-stroke" />
    {/each}
    {#each drawing.measures as m, i (i)}
      {#if m.side === 'right' || m.side === 'left'}
        {@const dir = m.side === 'right' ? 1 : -1}
        {@const x = m.at + dir * 0.2}
        <path
          class="measure"
          d="M{m.at},{m.from + 0.06} H{x + dir * 0.15} M{x},{m.from + 0.06} V{m.to - 0.06} M{m.at},{m.to - 0.06} H{x + dir * 0.15}"
          vector-effect="non-scaling-stroke"
        />
        <text
          x={x + dir * 0.35}
          y={(m.from + m.to) / 2 + font * 0.35}
          font-size={font}
          text-anchor={m.side === 'right' ? 'start' : 'end'}>{m.label}</text
        >
      {:else}
        {@const y = m.at + 0.2}
        <path
          class="measure"
          d="M{m.from + 0.06},{m.at} V{y + 0.15} M{m.from + 0.06},{y} H{m.to - 0.06} M{m.to - 0.06},{m.at} V{y + 0.15}"
          vector-effect="non-scaling-stroke"
        />
        <text x={(m.from + m.to) / 2} y={y + font + 0.15} font-size={font} text-anchor="middle">{m.label}</text>
      {/if}
    {/each}
    {#each drawing.captions as c, i (i)}
      <text class="caption" x={c.x} y={c.y} font-size={font * 1.1}>{c.text}</text>
    {/each}
  </svg>
</div>

<style>
  .sheet {
    width: 100%;
    display: grid;
    place-items: center;
    background: var(--bg-sunken);
    overflow: hidden;
  }

  svg {
    display: block;
    max-width: 100%;
    height: auto;
  }

  .grid line {
    stroke: color-mix(in srgb, var(--border) 55%, transparent);
    stroke-width: 1;
  }

  /* Ink: outlines in the text colour, details and hidden lines fainter. */
  .ink {
    stroke: var(--text);
    stroke-width: 1.4;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .ink.detail {
    stroke: var(--text-dim);
    stroke-width: 1;
  }

  .ink.hidden {
    stroke: var(--text-dim);
    stroke-width: 1.1;
    stroke-dasharray: 4 3;
  }

  .measure {
    fill: none;
    stroke: var(--text-dim);
    stroke-width: 1;
  }

  text {
    fill: var(--text-dim);
    font-family: inherit;
  }

  text.caption {
    fill: var(--text);
    letter-spacing: 0.04em;
  }
</style>
