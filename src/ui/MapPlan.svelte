<script lang="ts">
  import { CHIP, type MapPlan, type RouteDraw } from './lib/mapPlan';
  import { ROAD_WIDTH, districtFont } from './lib/map';

  /**
   * The surveyed plan drawn (docs/NAVIGATION.md §3). MapCard owns the state;
   * this draws a MapPlan and a route over it and reports clicks. One viewBox
   * unit is one CSS pixel, so every size below is a real size.
   */
  let {
    plan,
    route = null,
    stuck,
    selected = null,
    onpick,
    onexit,
  }: {
    plan: MapPlan;
    route?: RouteDraw | null;
    /** Travelling, recovering or in a forced fight: an exit label cannot be walked to. */
    stuck: boolean;
    /** The pin whose card is open. */
    selected?: string | null;
    /** A click, Enter or Space on a pin; `pin` is the pin's own element, which the card stands beside. */
    onpick: (id: string, pin: Element) => void;
    /** A click, Enter or Space on a region exit label: it walks, and has no card. */
    onexit: (id: string) => void;
  } = $props();

  const f = $derived(plan.frame);
  /** Enter and Space press a button; Space must not also scroll the page. */
  const pressed = (ev: KeyboardEvent) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return false;
    ev.preventDefault();
    return true;
  };
  const poly = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
</script>

<svg
  viewBox="0 0 {f.w} {f.h}"
  width="100%"
  height={f.h}
  class="plan"
  class:tiled={f.tiled}
  aria-label="Region map"
>
  {#if plan.ground}
    <defs>
      {#if plan.ground === 'grass'}
        <pattern id="plan-ground" width="22" height="18" patternUnits="userSpaceOnUse">
          <path class="gline grass" d="M4 14 l2 -5 M7 14 l1 -6 M10 14 l-1 -5 M15 6 l2 -4 M18 6 l1 -5" />
        </pattern>
      {:else if plan.ground === 'cobbles'}
        <pattern id="plan-ground" width="26" height="22" patternUnits="userSpaceOnUse">
          <rect class="gline cobbles" x="1" y="1" width="11" height="9" rx="3" />
          <rect class="gline cobbles" x="14" y="2" width="10" height="9" rx="3" />
          <rect class="gline cobbles" x="6" y="12" width="12" height="9" rx="3" />
        </pattern>
      {:else if plan.ground === 'flags'}
        <pattern id="plan-ground" width="36" height="36" patternUnits="userSpaceOnUse">
          <path class="gline flags" d="M0 0H36 M0 18H36 M0 0V18 M18 18V36" />
        </pattern>
      {:else if plan.ground === 'water'}
        <pattern id="plan-ground" width="24" height="12" patternUnits="userSpaceOnUse">
          <path class="gline water" d="M0 6 q6 -5 12 0 t12 0" />
        </pattern>
      {:else if plan.ground === 'crypt'}
        <pattern id="plan-ground" width="40" height="40" patternUnits="userSpaceOnUse">
          <path class="gline crypt" d="M5 8 l7 4 l-2 8 M28 26 l-6 -5 l2 -9 M33 6 l-4 5" />
        </pattern>
      {:else}
        <pattern id="plan-ground" width="28" height="28" patternUnits="userSpaceOnUse">
          <path class="gline webs" d="M0 0 L28 28 M28 0 L0 28 M0 14 H28 M14 0 V28" />
          <circle class="gline webs" cx="14" cy="14" r="7" />
        </pattern>
      {/if}
    </defs>
    <rect class="ground" width={f.w} height={f.h} fill="url(#plan-ground)" />
  {/if}

  {#each plan.districts as d (d.area)}
    <g style="--tint: {d.tint}">
      {#each d.cells as cell}
        <polygon class="cell" points={poly(cell)} />
      {/each}
    </g>
  {/each}

  {#each plan.roads as road (road.key)}
    {#if !f.tiled}
      <!-- A drawn map shows its roads as the doors and paths in the picture;
           a line between pins would cut through its walls. The ring on a pin
           where a forced fight waits stays. -->
      {#if road.shut}
        {#each road.shut.pieces as piece}
          <line class="casing" x1={piece[0].x} y1={piece[0].y} x2={piece[1].x} y2={piece[1].y} stroke-width={ROAD_WIDTH[road.cls] + 2} />
          <line class="road {road.cls}" class:ghost={road.ghost} class:forced={road.forced} x1={piece[0].x} y1={piece[0].y} x2={piece[1].x} y2={piece[1].y} stroke-width={ROAD_WIDTH[road.cls]} />
        {/each}
        <line class="barrier" x1={road.shut.bar[0].x} y1={road.shut.bar[0].y} x2={road.shut.bar[1].x} y2={road.shut.bar[1].y}>
          <title>Shut: {road.shut.terms}</title>
        </line>
      {:else}
        <line class="casing" x1={road.a.x} y1={road.a.y} x2={road.b.x} y2={road.b.y} stroke-width={ROAD_WIDTH[road.cls] + 2} />
        <line class="road {road.cls}" class:ghost={road.ghost} class:forced={road.forced} x1={road.a.x} y1={road.a.y} x2={road.b.x} y2={road.b.y} stroke-width={ROAD_WIDTH[road.cls]}>
          {#if road.forced}<title>This way leads to a fight with no way out</title>{/if}
        </line>
      {/if}
      {#if road.head}
        <polygon class="head" class:forced={road.forced} points={poly(road.head)}>
          <title>No road back</title>
        </polygon>
      {/if}
    {:else if road.shut}
      <!-- On a picture the bar stands at the road's middle, where the door is. -->
      <line class="barrier" x1={road.shut.bar[0].x} y1={road.shut.bar[0].y} x2={road.shut.bar[1].x} y2={road.shut.bar[1].y}>
        <title>Shut: {road.shut.terms}</title>
      </line>
    {/if}
  {/each}

  {#each plan.districts as d (d.area)}
    {#if d.name}
      <text
        class="dname"
        style="--tint: {d.tint}"
        x={d.name.x}
        y={d.name.y}
        text-anchor="middle"
        font-size={districtFont(f.font)}
        aria-label={d.name.text}
      >
        {#each d.name.lines as line, i}
          <tspan x={d.name.x} dy={i === 0 ? 0 : d.name.leading}>{line}</tspan>
        {/each}
      </text>
    {/if}
  {/each}

  <!-- The route's legs lie over the roads and under the pins and names, which
       keep their outlines where a leg runs beneath them. -->
  {#if route}
    <g class="route">
      {#each route.legs as leg (leg.key)}
        <line class="leg-casing" x1={leg.a.x} y1={leg.a.y} x2={leg.b.x} y2={leg.b.y} />
        <line class="leg {leg.state}" x1={leg.a.x} y1={leg.a.y} x2={leg.b.x} y2={leg.b.y} />
      {/each}
    </g>
  {/if}

  {#each plan.exits as exit}
    <text
      x={exit.x}
      y={exit.y}
      text-anchor={exit.anchor}
      font-size={f.font}
      class="exit"
      class:clickable={!stuck}
      class:tutorial-target={exit.pointed}
      class:beacon-text={exit.pointed}
      role="button"
      tabindex="0"
      aria-label="Travel toward {exit.label}"
      onclick={() => onexit(exit.to)}
      onkeydown={(ev) => pressed(ev) && onexit(exit.to)}
    >
      → {exit.label}
    </text>
    {#if exit.arrow}
      <text x={exit.arrow.x} y={exit.arrow.y} text-anchor="middle" font-size={f.font + 4} class="beacon-arrow">▼</text>
    {/if}
  {/each}

  {#each plan.nodes as node (node.id)}
    <g
      class="node"
      class:known={node.known}
      class:selected={node.id === selected}
      class:pointed={node.pointed}
      class:tutorial-target={node.pointed}
      role="button"
      tabindex="0"
      aria-label={node.aria}
      aria-haspopup="dialog"
      aria-expanded={node.id === selected}
      onclick={(ev) => onpick(node.id, ev.currentTarget)}
      onkeydown={(ev) => pressed(ev) && onpick(node.id, ev.currentTarget)}
    >
      {#if node.here}
        <circle cx={node.x} cy={node.y} r={f.pinR + 6} class="ring" />
      {/if}
      {#if node.pointed}
        <circle cx={node.x} cy={node.y} r={f.pinR + 4} class="beacon" />
      {/if}
      {#if node.ringed}
        <circle cx={node.x} cy={node.y} r={f.pinR + 3} class="forced-ring">
          <title>Arriving here starts a fight with no way out</title>
        </circle>
      {/if}
      <circle cx={node.x} cy={node.y} r={f.pinR} class="dot" />
      <text x={node.x} y={node.y + f.pinR * 0.38} text-anchor="middle" font-size={f.pinR * 1.1} class="icon">
        {node.icon}
      </text>
      {#if node.arrow}
        <text x={node.arrow.x} y={node.arrow.y} text-anchor="middle" font-size={f.font + 4} class="beacon-arrow">▼</text>
      {/if}
      {#each node.chips as chip (chip.key)}
        <g class="chip">
          <rect x={chip.x - CHIP / 2} y={chip.y - CHIP / 2} width={CHIP} height={CHIP} />
          <text x={chip.x} y={chip.y + 4} text-anchor="middle" font-size="11">{chip.icon}</text>
          <title>{chip.label}</title>
        </g>
      {/each}
      {#if node.more}
        <g class="chip">
          <rect x={node.more.x - CHIP / 2} y={node.more.y - CHIP / 2} width={CHIP} height={CHIP} />
          <text x={node.more.x} y={node.more.y + 4} text-anchor="middle" font-size="10" class="more">+{node.more.n}</text>
        </g>
      {/if}
      {#if node.menace}
        <!-- Worn by unknown "?" pins too: the ambush is knowable at the door,
             which is the entire point of warning at all. -->
        <text x={node.menaceAt.x} y={node.menaceAt.y + 5} text-anchor="middle" font-size="14" class="menace">
          ⚔️
          <title>Entering here starts a fight with no way out</title>
        </text>
      {/if}
      {#if node.label}
        <text x={node.label.x} y={node.label.y} text-anchor={node.label.anchor} font-size={f.font} class="label">
          {node.label.name}{#if node.label.threat}<tspan class="threat">{' · ' + node.label.threat}</tspan>{/if}
        </text>
      {/if}
    </g>
  {/each}

  {#if route}
    <!-- The times, ladder marks and marker lie over the pins and names. -->
    <g class="route">
      {#each route.ladders as p, i (i)}
        <g transform="translate({p.x} {p.y})">
          <path class="ladder-casing" d="M0 0V14 M7 0V14 M0 3H7 M0 7H7 M0 11H7" />
          <path class="ladder-mark" d="M0 0V14 M7 0V14 M0 3H7 M0 7H7 M0 11H7">
            <title>A ladder ride leaves from here</title>
          </path>
        </g>
      {/each}
      {#each route.legs as leg (leg.key)}
        <text x={leg.at.x} y={leg.at.y} text-anchor="middle" font-size="11" class="leg-time">{leg.time}</text>
      {/each}
      {#if route.marker}
        <rect
          class="marker"
          x="-6"
          y="-6"
          width="12"
          height="12"
          transform="translate({route.marker.x} {route.marker.y}) rotate(45)"
        />
      {/if}
    </g>
  {/if}
</svg>

<style>
  .plan {
    display: block;
    max-width: 100%;
  }

  /* Over tiles the SVG is transparent; the picture is the ground. */
  .plan.tiled {
    position: absolute;
    inset: 0;
    height: 100%;
  }

  .gline {
    fill: none;
    stroke-width: 1.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .gline.grass {
    stroke: color-mix(in srgb, var(--xp) 24%, var(--bg-sunken));
  }
  .gline.cobbles {
    stroke: color-mix(in srgb, var(--border) 38%, var(--bg-sunken));
  }
  .gline.flags {
    stroke: color-mix(in srgb, var(--border) 34%, var(--bg-sunken));
  }
  .gline.water {
    stroke: color-mix(in srgb, var(--mana) 30%, var(--bg-sunken));
  }
  .gline.crypt {
    stroke: color-mix(in srgb, var(--text-dim) 24%, var(--bg-sunken));
  }
  .gline.webs {
    stroke: color-mix(in srgb, var(--text-dim) 18%, var(--bg-sunken));
    stroke-width: 0.8;
  }

  /* The tint is a theme colour mixed half with the border colour, so a
     district is a faint wash over the ground and the roads stay the strongest
     lines. */
  .cell {
    fill: color-mix(in srgb, var(--tint) 50%, var(--border));
    fill-opacity: 0.22;
    stroke: color-mix(in srgb, var(--tint) 50%, var(--border));
    stroke-opacity: 0.28;
    stroke-width: 1;
  }

  .dname {
    fill: color-mix(in srgb, var(--tint) 55%, var(--text));
    font-family: var(--font-caps, inherit);
    font-weight: 600;
    letter-spacing: 0.12em;
    paint-order: stroke;
    stroke: var(--bg-sunken);
    stroke-width: 4px;
    stroke-linejoin: round;
    pointer-events: none;
  }

  .casing {
    stroke: var(--bg-sunken);
    stroke-linecap: round;
  }

  .road {
    stroke: color-mix(in srgb, var(--accent) 34%, var(--border));
    stroke-linecap: round;
  }

  .road.ghost {
    stroke-dasharray: 6 5;
    opacity: 0.7;
  }

  /* A road that walks into a fight with no way out is red. */
  .road.forced {
    stroke: var(--danger);
  }

  .head {
    fill: color-mix(in srgb, var(--accent) 34%, var(--border));
    stroke: var(--bg-sunken);
    stroke-width: 1;
  }
  .head.forced {
    fill: var(--danger);
  }

  .barrier {
    stroke: var(--text-dim);
    stroke-width: 3;
    stroke-linecap: butt;
  }

  .exit {
    fill: var(--text-dim);
    font-style: italic;
    paint-order: stroke;
    stroke: var(--bg-sunken);
    stroke-width: 3px;
    stroke-linejoin: round;
  }

  .exit.clickable {
    cursor: pointer;
  }

  .exit.clickable:hover {
    fill: var(--accent);
  }

  .exit:focus {
    outline: none;
  }

  /* An exit is the only way off a drawn region (floor 0's gate is the
     tutorial's last step), and dim italic grey vanishes into grass tiles.
     Same halo as the names; the hover accent above still wins. */
  .plan.tiled .exit {
    fill: #fff;
    font-weight: 600;
    stroke-width: 4px;
  }

  .node .dot {
    fill: var(--bg-raised);
    stroke: var(--border);
    stroke-width: 1.5;
  }

  .node:not(.known) {
    opacity: 0.45;
  }

  /* Every pin is clickable: the first click opens its card. Hover only
     highlights; it opens nothing. */
  .node {
    cursor: pointer;
  }

  .node:hover .dot {
    stroke: var(--accent);
  }

  .node:focus {
    outline: none;
  }

  .node:focus-visible .dot {
    stroke: var(--accent);
    stroke-width: 2.5;
  }

  /* The pin whose card is open. */
  .node.selected {
    opacity: 1;
  }

  .node.selected .dot {
    fill: var(--bg-hover);
    stroke: var(--accent);
    stroke-width: 3;
  }

  .plan .node.selected .label {
    fill: var(--accent);
  }

  .icon {
    pointer-events: none;
  }

  .label {
    fill: var(--text);
    paint-order: stroke;
    stroke: var(--bg-sunken);
    stroke-width: 3px;
    stroke-linejoin: round;
    pointer-events: none;
  }

  .node:not(.known) .label {
    fill: var(--text-dim);
  }

  .plan.tiled .label {
    fill: #fff;
    stroke-width: 4px;
  }

  .threat {
    fill: var(--text-dim);
  }

  .plan.tiled .threat {
    fill: #fff;
  }

  .chip rect {
    fill: var(--bg-raised);
    stroke: var(--border);
    stroke-width: 1;
  }

  .chip .more {
    fill: var(--accent);
    font-weight: 700;
  }

  .ring {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    animation: pulse 1.6s ease-in-out infinite;
    pointer-events: none;
  }

  .forced-ring {
    fill: none;
    stroke: var(--danger);
    stroke-width: 2;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* Floor 0's pointer (lib/tutorialFocus.ts). A ❓ pin is drawn faint until
     visited; the one the step names is drawn full, with a widening ring. */
  .node.pointed {
    opacity: 1;
  }

  .node.pointed .dot {
    stroke: var(--accent);
    stroke-width: 2.5;
  }

  .beacon {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2.5;
    pointer-events: none;
    transform-box: fill-box;
    transform-origin: center;
    animation: beacon 1.4s ease-out infinite;
  }

  @keyframes beacon {
    0% { transform: scale(0.7); opacity: 1; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  /* The ring alone matches the "you are here" ring; the arrow says which. */
  .beacon-arrow {
    fill: var(--accent);
    paint-order: stroke;
    stroke: var(--bg-sunken);
    stroke-width: 2px;
    pointer-events: none;
    animation: beacon-bob 0.9s ease-in-out infinite alternate;
  }

  @keyframes beacon-bob {
    from { transform: translateY(-3px); }
    to { transform: translateY(2px); }
  }

  .plan .exit.beacon-text {
    fill: var(--accent);
    font-weight: 700;
    font-style: normal;
    animation: pulse 1.4s ease-in-out infinite;
  }

  /* The route: accent over a dark casing. Walked legs and the leg under way
     are solid, legs still to walk are dashed. */
  .route {
    pointer-events: none;
  }

  .leg-casing {
    stroke: var(--bg-sunken);
    stroke-width: 9;
    stroke-linecap: round;
  }

  .leg {
    stroke: var(--accent);
    stroke-width: 5;
    stroke-linecap: round;
  }

  .leg.todo {
    stroke-dasharray: 10 7;
    stroke-linecap: butt;
  }

  .leg.done {
    opacity: 0.55;
  }

  .leg-time {
    fill: var(--accent);
    font-weight: 600;
    paint-order: stroke;
    stroke: var(--bg-sunken);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .ladder-casing {
    fill: none;
    stroke: var(--bg-sunken);
    stroke-width: 5;
    stroke-linecap: round;
  }

  .ladder-mark {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linecap: round;
  }

  .marker {
    fill: var(--accent);
    stroke: var(--bg-sunken);
    stroke-width: 2;
  }

  .menace {
    pointer-events: none;
  }
</style>
