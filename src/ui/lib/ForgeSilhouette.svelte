<script lang="ts">
  import type { Placement } from '../../core/types';
  import { silhouetteOf } from './anvilView';

  /**
   * The piece drawn as cells, one rect per cell of every part, in the colour of
   * its material. Weapons stack head, guard and haft; armour lays its pieces
   * side by side (see silhouetteOf). The scale follows the size of the piece, so a
   * dagger and a pole arm both fill the plate.
   */
  let { placement, label }: { placement: Placement; label: string } = $props();

  /** SVG units per cell. */
  const C = 10;
  /** Empty margin around the piece, in cells. */
  const MARGIN = 0.8;
  /** The larger side is scaled toward this many pixels, within the limits below. */
  const TARGET = 280;

  const sil = $derived(silhouetteOf(placement));
  const w = $derived((sil.maxX - sil.minX + 2 * MARGIN) * C);
  const h = $derived((sil.maxY - sil.minY + 2 * MARGIN) * C);
  const zoom = $derived(Math.max(1.5, Math.min(4, TARGET / Math.max(w, h))));
</script>

<svg
  width={w * zoom}
  height={h * zoom}
  viewBox="{(sil.minX - MARGIN) * C} {(sil.minY - MARGIN) * C} {w} {h}"
  shape-rendering="crispEdges"
  role="img"
  aria-label={label}
>
  {#each sil.shapes as s, i (i)}
    {#if s.t === 'rect'}
      <rect x={s.x * C} y={s.y * C} width={s.w * C} height={s.h * C} style="fill: {s.fill}" class="piece-cell" />
    {:else if s.t === 'ring'}
      <circle cx={s.cx * C} cy={s.cy * C} r={s.r * C} style="stroke: {s.stroke}" class="loop" />
    {:else if s.t === 'poly'}
      <polygon points={s.points.map(([x, y]) => `${x * C},${y * C}`).join(' ')} style="fill: {s.fill}" class="piece-cell" />
    {:else if s.t === 'line'}
      <line x1={s.x1 * C} y1={s.y1 * C} x2={s.x2 * C} y2={s.y2 * C} style="stroke: {s.stroke}" class="cord" />
    {:else}
      <path d="M {s.x1 * C} {s.y1 * C} Q {s.cx * C} {s.cy * C} {s.x2 * C} {s.y2 * C}" style="stroke: {s.stroke}" class="cord" />
    {/if}
  {/each}
</svg>

<style>
  svg {
    max-width: 100%;
    height: auto;
  }

  /* The outline is the well colour, so cells read as separate in any theme.
     Not `.cell`: a rect takes its width from CSS when any rule sets one, and
     several panels style a `.cell` of their own. */
  .piece-cell {
    stroke: var(--bg-sunken);
    stroke-width: 1;
  }

  .loop {
    fill: none;
    stroke-width: 2.4;
  }

  .cord {
    fill: none;
    stroke-width: 2;
  }
</style>
