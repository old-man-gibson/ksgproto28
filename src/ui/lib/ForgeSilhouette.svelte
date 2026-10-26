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

  /** Average character width of a label, in ems (body faces, digits and ×). */
  const CHAR = 0.56;
  /** Labels stay readable when the drawing is scaled down: at least 10px. */
  const fontAt = (z: number) => Math.max(0.5, 10 / z);

  let sheetWidth = $state(0);
  const drawing = $derived(drawingOf(placement));

  /**
   * The drawing's extent at a zoom, its labels measured in the font that zoom
   * gives them. The geometry's own bounds are a floor: they already hold an
   * estimate for every label, and only a larger real label widens them.
   */
  function extentAt(z: number) {
    const font = fontAt(z);
    let { minX, minY, maxX, maxY } = drawing;
    for (const m of drawing.measures) {
      const w = m.label.length * font * CHAR;
      if (m.side === 'right') maxX = Math.max(maxX, m.at + 0.55 + w);
      else if (m.side === 'left') minX = Math.min(minX, m.at - 0.55 - w);
      else {
        const mid = (m.from + m.to) / 2;
        minX = Math.min(minX, mid - w / 2);
        maxX = Math.max(maxX, mid + w / 2);
        maxY = Math.max(maxY, m.at + 0.35 + font);
      }
    }
    for (const c of drawing.captions) {
      maxX = Math.max(maxX, c.x + c.text.length * font * 1.1 * CHAR);
      minY = Math.min(minY, c.y - font * 1.1);
    }
    return { minX, minY, maxX, maxY };
  }

  // The zoom sets the font, the font sets the labels' width, the width sets the zoom: settle it.
  const fit = $derived.by(() => {
    const zoomFor = (e: ReturnType<typeof extentAt>) =>
      sheetWidth > 0 ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, sheetWidth / (e.maxX - e.minX + 2 * MARGIN))) : MAX_ZOOM;
    let zoom = MAX_ZOOM;
    let e = extentAt(zoom);
    for (let i = 0; i < 6; i++) {
      const next = zoomFor(e);
      if (Math.abs(next - zoom) < 0.01) break;
      zoom = next;
      e = extentAt(zoom);
    }
    return { zoom, e };
  });
  const zoom = $derived(fit.zoom);
  const dw = $derived(fit.e.maxX - fit.e.minX + 2 * MARGIN);
  const dh = $derived(fit.e.maxY - fit.e.minY + 2 * MARGIN);
  // The view spans the whole sheet so the grid reaches its edges; the drawing is centred in it.
  const vw = $derived(Math.max(dw, sheetWidth / zoom));
  const vh = $derived(Math.max(dh, MIN_HEIGHT / zoom));
  const vx = $derived((fit.e.minX + fit.e.maxX) / 2 - vw / 2);
  const vy = $derived((fit.e.minY + fit.e.maxY) / 2 - vh / 2);
  const span = (from: number, to: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(from); v <= Math.floor(to); v++) out.push(v);
    return out;
  };
  const gridX = $derived(span(vx, vx + vw));
  const gridY = $derived(span(vy, vy + vh));
  const font = $derived(fontAt(zoom));
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
