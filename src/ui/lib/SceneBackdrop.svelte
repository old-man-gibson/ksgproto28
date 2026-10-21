<script lang="ts">
  import type { SceneId } from '../../core/types';
  import { scatter } from './scenes';

  /**
   * A painted place: layered SVG silhouettes, light, and a little ambient
   * motion (torch flicker, drifting fog, dripping water). Pure presentation —
   * no game state is read here beyond the scene id. Drawn at 800×240 and
   * sliced to fill, so the ground line stays put at any width.
   */
  let { scene }: { scene: SceneId } = $props();

  // Gradient ids must be unique per instance: two backdrops on one page
  // (the stage and a location header) would otherwise share defs.
  const uid = `sc${Math.random().toString(36).slice(2, 8)}`;
  const u = (id: string) => `url(#${uid}-${id})`;

  interface Dot {
    x: number;
    y: number;
    r: number;
    d: number;
  }
  function dots(seed: number, n: number, box: [number, number, number, number], r: [number, number]): Dot[] {
    const rnd = scatter(seed);
    return Array.from({ length: n }, () => ({
      x: box[0] + rnd() * (box[2] - box[0]),
      y: box[1] + rnd() * (box[3] - box[1]),
      r: r[0] + rnd() * (r[1] - r[0]),
      d: rnd() * 6,
    }));
  }

  function web(cx: number, cy: number, r: number, spokes: number, rings: number, a0 = 0, a1 = Math.PI * 2) {
    const lines: string[] = [];
    const pts = (rr: number) =>
      Array.from({ length: spokes + 1 }, (_, i) => {
        const a = a0 + ((a1 - a0) / spokes) * i;
        return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
      });
    for (let i = 0; i <= spokes; i++) {
      const a = a0 + ((a1 - a0) / spokes) * i;
      lines.push(`M${cx},${cy} L${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
    }
    for (let k = 1; k <= rings; k++) lines.push(`M${pts((r / rings) * k).join(' L')}`);
    return lines.join(' ');
  }

  // Scatter computed once per instance; content is static.
  const drips = dots(61, 7, [60, 0, 740, 10], [2, 3]);
  // The town: each house gets its own lit windows, so none hang in the sky.
  const houses = [
    [20, 120, 60], [90, 96, 56], [160, 132, 64], [250, 104, 60],
    [470, 110, 60], [550, 92, 58], [630, 124, 62], [710, 100, 64],
  ].map(([x, y, w], i) => {
    const rnd = scatter(83 + i);
    const lit = Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => ({
      x: x + 8 + rnd() * (w - 20),
      y: y + 10 + rnd() * (200 - y - 30),
      d: rnd() * 9,
    }));
    return { x, y, w, lit };
  });
  const ARCHES = [60, 220, 380, 540, 700];
</script>

<svg class="scene scene-{scene}" viewBox="0 0 800 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="{uid}-shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0" />
      <stop offset="0.72" stop-color="#000" stop-opacity="0" />
      <stop offset="1" stop-color="#000" stop-opacity="0.55" />
    </linearGradient>
    <radialGradient id="{uid}-vignette" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0" />
      <stop offset="1" stop-color="#000" stop-opacity="0.7" />
    </radialGradient>
    <radialGradient id="{uid}-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffb347" stop-opacity="0.75" />
      <stop offset="1" stop-color="#ffb347" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="{uid}-coldglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#8ff5d2" stop-opacity="0.5" />
      <stop offset="1" stop-color="#8ff5d2" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="{uid}-fog" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfe9ff" stop-opacity="0" />
      <stop offset="0.5" stop-color="#cfe9ff" stop-opacity="0.16" />
      <stop offset="1" stop-color="#cfe9ff" stop-opacity="0" />
    </linearGradient>
    <pattern id="{uid}-brick" width="60" height="24" patternUnits="userSpaceOnUse">
      <rect width="60" height="24" fill="#2b2622" />
      <path d="M0,0.5 H60 M0,12.5 H60 M30,0 V12 M0,12 V24 M60,12 V24" stroke="#1a1714" stroke-width="1.5" />
    </pattern>

    {#if scene === 'crypt'}
      <linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0b1119" />
        <stop offset="1" stop-color="#223040" />
      </linearGradient>
      <linearGradient id="{uid}-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2a3644" />
        <stop offset="1" stop-color="#0d131b" />
      </linearGradient>
    {:else if scene === 'cistern'}
      <linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#061015" />
        <stop offset="1" stop-color="#16303a" />
      </linearGradient>
      <!-- The "ground" here is standing water. -->
      <linearGradient id="{uid}-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1f4c58" />
        <stop offset="1" stop-color="#071820" />
      </linearGradient>
    {:else if scene === 'hall'}
      <linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#15120f" />
        <stop offset="1" stop-color="#2d2620" />
      </linearGradient>
      <linearGradient id="{uid}-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3a3029" />
        <stop offset="1" stop-color="#15110e" />
      </linearGradient>
    {:else if scene === 'webs'}
      <linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0d0714" />
        <stop offset="1" stop-color="#2a1834" />
      </linearGradient>
      <linearGradient id="{uid}-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2c1e33" />
        <stop offset="1" stop-color="#0c0710" />
      </linearGradient>
    {:else}
      <linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#171a36" />
        <stop offset="0.55" stop-color="#4a3658" />
        <stop offset="1" stop-color="#b0685a" />
      </linearGradient>
      <linearGradient id="{uid}-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3b3340" />
        <stop offset="1" stop-color="#141117" />
      </linearGradient>
    {/if}
  </defs>

  <rect width="800" height="240" fill={u('sky')} />

  {#if scene === 'crypt'}
    {#each ARCHES as ax (ax)}
      <path d="M{ax - 70},200 V90 Q{ax},10 {ax + 70},90 V200" fill="#131b26" stroke="#2c3a4a" stroke-width="6" />
      <rect x={ax + 64} y="60" width="22" height="150" fill="#27323f" />
    {/each}
    <circle class="ghostlight" cx="560" cy="130" r="110" fill={u('coldglow')} />
    <g fill="#2f3b4a" stroke="#1b2430" stroke-width="3">
      <rect x="130" y="176" width="120" height="30" rx="3" />
      <rect x="520" y="182" width="110" height="26" rx="3" />
    </g>
    {#each [150, 300, 470, 640] as cx (cx)}
      <rect x={cx - 3} y="150" width="6" height="16" fill="#d9d3c0" />
      <path class="flame small" d="M{cx},138 Q{cx + 5},146 {cx + 2},150 Q{cx},152 {cx - 2},150 Q{cx - 5},146 {cx},138 Z" fill="#b8fff0" />
      <circle cx={cx} cy="146" r="18" fill={u('coldglow')} />
    {/each}
    <path d="M0,204 H800 V240 H0 Z" fill={u('ground')} />
    <g stroke="#1a2330" stroke-width="2" opacity="0.8">
      <path d="M0,216 H800 M0,230 H800 M120,204 L90,240 M300,204 L290,240 M500,204 L510,240 M680,204 L710,240" />
    </g>
    <rect class="fog" x="-200" y="170" width="1200" height="60" fill={u('fog')} />
    <rect class="fog slow" x="-300" y="186" width="1400" height="50" fill={u('fog')} />
  {:else if scene === 'cistern'}
    <!-- Vaulted stone standing in its own water: arches, a cold light, the
         ceiling dripping into a surface that never settles. -->
    {#each ARCHES as ax (ax)}
      <path d="M{ax - 70},214 V96 Q{ax},20 {ax + 70},96 V214" fill="#0e1c23" stroke="#24404a" stroke-width="6" />
      <rect x={ax + 64} y="64" width="22" height="150" fill="#1d3540" />
    {/each}
    <circle class="ghostlight" cx="400" cy="128" r="150" fill={u('coldglow')} opacity="0.55" />
    {#each drips as d, i (i)}
      <circle class="drip" cx={d.x} cy={10 + d.r * 2} r={d.r * 0.6} fill="#9fd8e0" style="animation-delay:-{d.d}s" />
    {/each}
    <path d="M0,196 H800 V240 H0 Z" fill={u('ground')} />
    <!-- The pillars again, broken up in the water. -->
    <g fill="#2a4f5a" opacity="0.35">
      {#each ARCHES as ax (ax)}<rect x={ax + 64} y="198" width="22" height="26" />{/each}
    </g>
    <g class="ripples" stroke="#8fd8e2" stroke-opacity="0.4" stroke-width="1.5" fill="none" stroke-linecap="round">
      <path d="M60,206 h60 M260,214 h80 M480,208 h50 M640,218 h90 M150,226 h70 M400,232 h60 M560,236 h40" />
    </g>
    <rect class="fog" x="-200" y="176" width="1200" height="50" fill={u('fog')} />
  {:else if scene === 'hall'}
    <rect width="800" height="200" fill={u('brick')} />
    <rect width="800" height="200" fill={u('sky')} opacity="0.6" />
    {#each [90, 300, 500, 710] as cx (cx)}
      <rect x={cx - 22} y="20" width="44" height="182" fill="#3b332c" />
      <rect x={cx - 30} y="12" width="60" height="14" fill="#4a4038" />
      <rect x={cx - 30} y="194" width="60" height="10" fill="#4a4038" />
    {/each}
    <path d="M378,30 h44 v70 l-22,-12 l-22,12 Z" fill="#6a1f1f" class="banner" />
    <circle cx="400" cy="58" r="10" fill="#e8b84b" />
    {#each [195, 605] as bx (bx)}
      <circle class="torchglow" cx={bx} cy="150" r="80" fill={u('glow')} />
      <path d="M{bx - 16},160 h32 l-8,14 h-16 Z M{bx - 3},174 v26 h6 v-26 Z" fill="#2a221c" />
      <path class="flame" d="M{bx},128 Q{bx + 14},146 {bx + 8},158 Q{bx},164 {bx - 8},158 Q{bx - 14},146 {bx},128 Z" fill="#ffb347" />
    {/each}
    <path d="M0,202 H800 V240 H0 Z" fill={u('ground')} />
    <g stroke="#1c1814" stroke-width="2"><path d="M0,220 H800 M100,202 L80,240 M260,202 L250,240 M420,202 L425,240 M580,202 L595,240 M740,202 L765,240" /></g>
  {:else if scene === 'webs'}
    <path d="M0,50 Q200,20 400,44 T800,40 V200 H0 Z" fill="#1c1026" />
    <circle cx="420" cy="130" r="160" fill={u('coldglow')} opacity="0.35" />
    <g stroke="#d9cfee" stroke-opacity="0.22" stroke-width="1.2" fill="none">
      <path d={web(0, 0, 180, 6, 6, 0, Math.PI / 2)} />
      <path d={web(800, 0, 200, 6, 7, Math.PI / 2, Math.PI)} />
      <path d={web(520, 60, 70, 10, 4)} />
    </g>
    {#each [[180, 70], [300, 50], [640, 80]] as [ex, ey] (ex)}
      <path d="M{ex},0 V{ey - 14}" stroke="#d9cfee" stroke-opacity="0.3" />
      <ellipse cx={ex} cy={ey} rx="10" ry="15" fill="#d8d0c0" opacity="0.7" />
    {/each}
    <path d="M0,196 Q200,186 400,198 T800,192 V240 H0 Z" fill={u('ground')} />
    <g stroke="#cdbb98" stroke-width="3" stroke-linecap="round" opacity="0.45">
      <path d="M150,224 l20,-6 M560,230 l18,4 M360,234 l12,-6" />
    </g>
  {:else}
    <!-- The town under the tower: the Ascent itself on the skyline. -->
    <path d="M384,0 L386,200 L414,200 L416,0 Z" fill="#231c33" />
    <path d="M378,0 h44 v8 h-44 Z M380,44 h40 v6 h-40 Z M381,88 h38 v6 h-38 Z M382,132 h36 v6 h-36 Z" fill="#2e2542" />
    <rect class="window" x="397" y="60" width="6" height="9" />
    <rect class="window" x="397" y="104" width="6" height="9" style="animation-delay:-4s" />
    {#each houses as hs (hs.x)}
      <path d="M{hs.x},200 V{hs.y} l{hs.w / 2},-18 l{hs.w / 2},18 V200 Z" fill="#161426" />
      {#each hs.lit as w, i (i)}
        <rect class="window" x={w.x} y={w.y} width="5" height="7" style="animation-delay:-{w.d}s" />
      {/each}
    {/each}
    <path d="M0,200 H800 V240 H0 Z" fill={u('ground')} />
    <path d="M40,150 Q240,176 400,150 T760,150" stroke="#2a2233" stroke-width="1.5" fill="none" />
    {#each [120, 260, 540, 680] as lx (lx)}
      <circle cx={lx} cy={lx === 120 || lx === 680 ? 160 : 166} r="4" fill="#f5c46a" class="lantern" />
    {/each}
  {/if}

  <rect width="800" height="240" fill={u('shade')} />
  <rect width="800" height="240" fill={u('vignette')} />
</svg>

<style>
  .scene {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  /* ---- ambient motion: slow, low-contrast, never competing with the fight ---- */
  .fog {
    animation: drift 38s linear infinite alternate;
  }
  .fog.slow {
    animation-duration: 60s;
    animation-direction: alternate-reverse;
  }
  @keyframes drift {
    from { transform: translateX(-80px); }
    to { transform: translateX(80px); }
  }

  .banner {
    transform-box: fill-box;
    transform-origin: top center;
    animation: sway 4.5s ease-in-out infinite;
  }
  @keyframes sway {
    0%, 100% { transform: rotate(-2deg); }
    50% { transform: rotate(2deg); }
  }

  .flame {
    transform-box: fill-box;
    transform-origin: bottom center;
    animation: flicker 0.9s ease-in-out infinite alternate;
    filter: drop-shadow(0 0 6px #ff9d2e);
  }
  .flame.small {
    filter: drop-shadow(0 0 4px #9fffe8);
  }
  @keyframes flicker {
    0% { transform: scale(1, 1) skewX(0deg); opacity: 0.95; }
    40% { transform: scale(0.92, 1.08) skewX(3deg); }
    100% { transform: scale(1.06, 0.94) skewX(-3deg); opacity: 0.85; }
  }
  .torchglow {
    animation: glow 1.6s ease-in-out infinite alternate;
  }
  @keyframes glow {
    from { opacity: 0.55; }
    to { opacity: 0.8; }
  }

  .ghostlight {
    animation: glow 5s ease-in-out infinite alternate;
  }

  .drip {
    animation: drip 3.5s ease-in infinite;
  }
  @keyframes drip {
    0%, 60% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(180px); opacity: 0; }
  }

  .ripples {
    animation: shimmer 5s ease-in-out infinite alternate;
  }
  @keyframes shimmer {
    from { transform: translateX(-8px); opacity: 0.6; }
    to { transform: translateX(8px); opacity: 1; }
  }

  .window {
    fill: #f5d27a;
    animation: twinkle 9s ease-in-out infinite;
  }
  @keyframes twinkle {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 1; }
  }
  .lantern {
    filter: drop-shadow(0 0 5px #ffcf70);
  }

  @media (prefers-reduced-motion: reduce) {
    .scene * {
      animation: none !important;
    }
  }
</style>
