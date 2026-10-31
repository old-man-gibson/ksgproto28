<script lang="ts">
  import type { RoyaleMap } from '../../core/systems/royaleMap';
  import { ROYALE_SECTIONS } from '../../core/data/festival.data';
  import {
    fieldBounds,
    fieldPoint,
    ISO_K,
    isoPoint,
    sectionCentres,
    type FieldFeature,
    type ViewBox,
  } from './royaleView';

  /**
   * The whole royale field in miniature, drawn on the same isometric ground
   * as the main map so a point sits in the same direction on both
   * (RoyaleField.svelte). The terrain is the main map's image; features,
   * the player, the radar's target and the main view's outline sit over it.
   * Given `onpick`, a click on it names a point on the field; without it the
   * map is read-only (the hub's preview). Marks are sized in screen pixels.
   */
  interface Props {
    map: RoyaleMap;
    /** The terrain image (royaleMapImage.svelte.ts). */
    image: string;
    features?: FieldFeature[];
    player?: { x: number; y: number };
    radar?: { x: number; y: number } | null;
    /** The main view's outline, in the ground's screen space. */
    view?: ViewBox;
    /** Features as their icons rather than dots. */
    icons?: boolean;
    /** Each section's name at its centre. */
    labels?: boolean;
    onpick?: (x: number, y: number) => void;
    label: string;
  }
  let { map, image, features = [], player, radar = null, view, icons = false, labels = false, onpick, label }: Props = $props();

  const K = ISO_K;
  const box = $derived(fieldBounds(map.size, K, 8));
  const viewBox = $derived(`${box.x} ${box.y} ${box.w} ${box.h}`);
  const ground = $derived(
    [isoPoint(0, 0), isoPoint(map.size, 0), isoPoint(map.size, map.size), isoPoint(0, map.size)]
      .map((p) => `${p.sx},${p.sy}`)
      .join(' '),
  );
  const names = $derived(labels ? sectionCentres(map) : []);

  let svg: SVGSVGElement | undefined = $state();
  let width = $state(0);
  /** SVG units in one screen pixel, so a mark keeps its pixel size at any width. */
  const u = $derived(width > 0 ? box.w / width : 8);

  function pick(e: MouseEvent) {
    if (!svg || !onpick) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    const f = fieldPoint(p.x, p.y, K);
    if (f.x < 0 || f.y < 0 || f.x > map.size || f.y > map.size) return;
    onpick(f.x, f.y);
  }
</script>

<svg bind:this={svg} bind:clientWidth={width} {viewBox} class="royale-mini" class:royale-mini-live={!!onpick} aria-label={label} role="img">
  <!-- A pointer shortcut: the main map's ground is the keyboard control. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <polygon class="royale-mini-ground" points={ground} onclick={pick} />
  {#if image}
    <image
      class="royale-mini-terrain"
      href={image}
      x="0"
      y="0"
      width={map.size}
      height={map.size}
      transform="matrix({K} {K / 2} {-K} {K / 2} 0 0)"
    />
  {/if}
  <polygon class="royale-mini-edge" points={ground} stroke-width={u} />

  {#each names as n (n.id)}
    {@const p = isoPoint(n.x, n.y)}
    <text class="royale-mini-name" transform="translate({p.sx} {p.sy}) scale({u})" text-anchor="middle">{ROYALE_SECTIONS[n.id]?.name ?? n.id}</text>
  {/each}

  {#each features as f (f.kind + f.id)}
    {@const p = isoPoint(f.x, f.y)}
    <g transform="translate({p.sx} {p.sy}) scale({u})" opacity={f.spent ? 0.4 : 1}>
      {#if icons}
        <text class="royale-mini-icon" y="5" text-anchor="middle">{f.icon}</text>
      {:else}
        <circle class="royale-mini-dot" class:royale-mini-den={f.kind === 'den'} r="3.5" />
      {/if}
    </g>
  {/each}

  {#if view}
    <rect class="royale-mini-view" x={view.x} y={view.y} width={view.w} height={view.h} stroke-width={1.5 * u} />
  {/if}

  {#if radar}
    {@const p = isoPoint(radar.x, radar.y)}
    <circle class="royale-mini-radar" cx={p.sx} cy={p.sy} r={3.5 * u} stroke-width={2 * u} />
  {/if}
  {#if player}
    {@const p = isoPoint(player.x, player.y)}
    <circle class="royale-mini-you" cx={p.sx} cy={p.sy} r={4.5 * u} stroke-width={1.5 * u} />
  {/if}
</svg>

<style>
  .royale-mini {
    display: block;
    width: 100%;
    background: var(--bg-sunken);
    border: 1px solid var(--border);
    border-radius: 6px;
    user-select: none;
  }

  /* Only the ground takes clicks; what stands on it lets them through. */
  .royale-mini :global(*:not(.royale-mini-ground)) {
    pointer-events: none;
  }

  .royale-mini-live .royale-mini-ground {
    cursor: crosshair;
  }

  .royale-mini-ground {
    fill: transparent;
  }

  .royale-mini-terrain {
    image-rendering: pixelated;
  }

  .royale-mini-edge {
    fill: none;
    stroke: var(--border);
  }

  .royale-mini-name {
    font-size: 9px;
    fill: var(--text);
    opacity: 0.8;
    paint-order: stroke;
    stroke: var(--bg-sunken);
    stroke-width: 2.5px;
  }

  .royale-mini-icon {
    font-size: 13px;
  }

  .royale-mini-dot {
    fill: var(--accent);
    stroke: var(--bg-sunken);
    stroke-width: 1px;
  }

  .royale-mini-den {
    fill: var(--danger);
  }

  .royale-mini-view {
    fill: none;
    stroke: var(--text);
    opacity: 0.8;
  }

  .royale-mini-radar {
    fill: none;
    stroke: var(--danger);
  }

  .royale-mini-you {
    fill: var(--accent);
    stroke: var(--bg-sunken);
  }
</style>
