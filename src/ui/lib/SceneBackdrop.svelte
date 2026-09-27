<script lang="ts">
  import type { SceneId } from '../../core/types';
  import { scatter } from './scenes';

  /**
   * A painted place: layered SVG silhouettes, light, and a little ambient
   * motion (fireflies, torch flicker, drifting fog). Pure presentation — no
   * game state is read here beyond the scene id and whether the Elevator is
   * awake. Drawn at 800×240 and sliced to fill, so the ground line stays put
   * at any width.
   */
  let { scene, awake = false }: { scene: SceneId; awake?: boolean } = $props();

  // Gradient ids must be unique per instance: two backdrops on one page
  // (the stage and a location header) would otherwise share defs.
  const uid = `sc${Math.random().toString(36).slice(2, 8)}`;
  const u = (id: string) => `url(#${uid}-${id})`;

  interface Dot {
    x: number;
    y: number;
    r: number;
    d: number;
    t: number;
  }
  function dots(seed: number, n: number, box: [number, number, number, number], r: [number, number]): Dot[] {
    const rnd = scatter(seed);
    return Array.from({ length: n }, () => ({
      x: box[0] + rnd() * (box[2] - box[0]),
      y: box[1] + rnd() * (box[3] - box[1]),
      r: r[0] + rnd() * (r[1] - r[0]),
      d: rnd() * 6,
      t: 3 + rnd() * 5,
    }));
  }

  interface Trunk {
    x: number;
    w: number;
    lean: number;
  }
  function trunks(seed: number, n: number, w: [number, number], x0 = 0, x1 = 800): Trunk[] {
    const rnd = scatter(seed);
    const step = (x1 - x0) / n;
    return Array.from({ length: n }, (_, i) => ({
      x: x0 + step * i + rnd() * step * 0.7,
      w: w[0] + rnd() * (w[1] - w[0]),
      lean: (rnd() - 0.5) * 10,
    }));
  }
  const trunkPath = (t: Trunk, top: number, bottom: number) =>
    `M${t.x - t.w / 2},${bottom} L${t.x - t.w * 0.38 + t.lean},${top} L${t.x + t.w * 0.38 + t.lean},${top} L${t.x + t.w / 2},${bottom} Z`;

  function pines(seed: number, n: number, base: number, h: [number, number]) {
    const rnd = scatter(seed);
    return Array.from({ length: n }, (_, i) => {
      const x = (800 / n) * i + rnd() * 30;
      const height = h[0] + rnd() * (h[1] - h[0]);
      const w = height * 0.42;
      const tiers = [0, 0.3, 0.55]
        .map((f) => {
          const top = base - height + f * height;
          const bw = w * (0.55 + f * 0.8);
          return `M${x},${top} L${x - bw / 2},${top + height * 0.42} L${x + bw / 2},${top + height * 0.42} Z`;
        })
        .join(' ');
      return `${tiers} M${x - 3},${base} L${x - 3},${base - height * 0.2} L${x + 3},${base - height * 0.2} L${x + 3},${base} Z`;
    });
  }

  const hex = (cx: number, cy: number, r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');

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
  const fireflies = dots(11, 16, [40, 60, 760, 200], [1.2, 2.2]);
  const stars = dots(23, 46, [0, 0, 800, 120], [0.5, 1.4]);
  const motes = dots(37, 22, [320, 40, 480, 220], [1, 2.4]);
  const eyes = dots(41, 5, [80, 150, 720, 175], [1.6, 1.6]);
  const embers = dots(53, 10, [140, 60, 660, 140], [0.8, 1.6]);
  const drips = dots(61, 7, [60, 0, 740, 10], [2, 3]);
  const spores = dots(71, 14, [30, 120, 770, 200], [1, 2]);
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

  const farTrees = trunks(3, 16, [8, 14]);
  const midTrees = trunks(5, 8, [16, 26]);
  const deepFar = trunks(7, 12, [14, 22]);
  const deepMid = trunks(9, 6, [30, 44], 40, 760);
  const farPines = pines(13, 22, 150, [60, 95]);
  const nearPines = pines(17, 11, 178, [90, 140]);
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
    <linearGradient id="{uid}-ray" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6ffd8" stop-opacity="0.55" />
      <stop offset="1" stop-color="#f6ffd8" stop-opacity="0" />
    </linearGradient>
    <radialGradient id="{uid}-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffb347" stop-opacity="0.75" />
      <stop offset="1" stop-color="#ffb347" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="{uid}-coldglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#8ff5d2" stop-opacity="0.5" />
      <stop offset="1" stop-color="#8ff5d2" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="{uid}-moon" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#dfe8ff" stop-opacity="0.55" />
      <stop offset="1" stop-color="#dfe8ff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="{uid}-fog" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfe9ff" stop-opacity="0" />
      <stop offset="0.5" stop-color="#cfe9ff" stop-opacity="0.16" />
      <stop offset="1" stop-color="#cfe9ff" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="{uid}-beam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#9ffff0" stop-opacity="0" />
      <stop offset="0.5" stop-color="#e8fffb" stop-opacity="0.85" />
      <stop offset="1" stop-color="#9ffff0" stop-opacity="0" />
    </linearGradient>
    <pattern id="{uid}-comb" width="34" height="29.4" patternUnits="userSpaceOnUse">
      <polygon points={hex(17, 14.7, 16)} fill="#5c3a0e" stroke="#8a5c17" stroke-width="2" />
    </pattern>
    <pattern id="{uid}-brick" width="60" height="24" patternUnits="userSpaceOnUse">
      <rect width="60" height="24" fill="#2b2622" />
      <path d="M0,0.5 H60 M0,12.5 H60 M30,0 V12 M0,12 V24 M60,12 V24" stroke="#1a1714" stroke-width="1.5" />
    </pattern>

    {#if scene === 'forest'}
      <linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#16362f" />
        <stop offset="0.55" stop-color="#3a6b4d" />
        <stop offset="1" stop-color="#5b8a55" />
      </linearGradient>
      <linearGradient id="{uid}-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2a4a26" />
        <stop offset="1" stop-color="#0f2112" />
      </linearGradient>
    {:else if scene === 'deepwood'}
      <linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#07161a" />
        <stop offset="0.6" stop-color="#15343a" />
        <stop offset="1" stop-color="#1f4a45" />
      </linearGradient>
      <linearGradient id="{uid}-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#16302a" />
        <stop offset="1" stop-color="#081411" />
      </linearGradient>
    {:else if scene === 'warren'}
      <linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1e120a" />
        <stop offset="1" stop-color="#4a2c16" />
      </linearGradient>
      <linearGradient id="{uid}-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4b2f18" />
        <stop offset="1" stop-color="#1c110a" />
      </linearGradient>
    {:else if scene === 'crypt'}
      <linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0b1119" />
        <stop offset="1" stop-color="#223040" />
      </linearGradient>
      <linearGradient id="{uid}-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2a3644" />
        <stop offset="1" stop-color="#0d131b" />
      </linearGradient>
    {:else if scene === 'wolfden'}
      <linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#050818" />
        <stop offset="0.6" stop-color="#16244a" />
        <stop offset="1" stop-color="#34466e" />
      </linearGradient>
      <linearGradient id="{uid}-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#26334f" />
        <stop offset="1" stop-color="#0a0f1d" />
      </linearGradient>
    {:else if scene === 'hive'}
      <linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2a1604" />
        <stop offset="1" stop-color="#6e4610" />
      </linearGradient>
      <linearGradient id="{uid}-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5a3a0e" />
        <stop offset="1" stop-color="#1e1206" />
      </linearGradient>
    {:else if scene === 'glade'}
      <linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0b1726" />
        <stop offset="0.6" stop-color="#1d3d4a" />
        <stop offset="1" stop-color="#3d6a5c" />
      </linearGradient>
      <linearGradient id="{uid}-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2c4e3a" />
        <stop offset="1" stop-color="#0e1d16" />
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

  {#if scene === 'forest'}
    {#each farTrees as t (t.x)}<path d={trunkPath(t, 0, 190)} fill="#244a3a" opacity="0.7" />{/each}
    <g class="rays">
      <polygon points="230,0 290,0 380,210 250,210" fill={u('ray')} />
      <polygon points="470,0 505,0 575,200 480,200" fill={u('ray')} style="animation-delay:-3s" />
      <polygon points="610,0 632,0 690,190 630,190" fill={u('ray')} style="animation-delay:-5s" />
    </g>
    {#each midTrees as t (t.x)}<path d={trunkPath(t, 0, 200)} fill="#173226" />{/each}
    <rect class="fog" x="-200" y="140" width="1200" height="70" fill={u('fog')} />
    <path d="M0,190 Q120,176 240,188 T480,186 T800,184 V240 H0 Z" fill={u('ground')} />
    <g fill="#0c1a10">
      <path d="M0,240 V206 Q14,188 30,204 Q38,180 52,202 Q66,186 74,210 L90,240 Z" />
      <path d="M800,240 V200 Q784,184 770,202 Q760,178 744,204 Q730,190 722,212 L706,240 Z" />
    </g>
    <path d="M-10,0 H70 Q40,40 58,240 H-10 Z" fill="#081410" />
    <path d="M810,0 H740 Q770,60 748,240 H810 Z" fill="#081410" />
    <path d="M0,0 H800 V26 Q700,48 600,22 Q500,50 400,20 Q300,46 200,18 Q100,44 0,24 Z" fill="#0b1f16" />
    {#each fireflies as f, i (i)}
      <circle class="firefly" cx={f.x} cy={f.y} r={f.r} style="animation-delay:-{f.d}s;animation-duration:{f.t}s" />
    {/each}
  {:else if scene === 'deepwood'}
    {#each deepFar as t (t.x)}<path d={trunkPath(t, 0, 185)} fill="#15313a" opacity="0.85" />{/each}
    <rect class="fog" x="-200" y="110" width="1200" height="80" fill={u('fog')} />
    {#each deepMid as t (t.x)}
      <path d={trunkPath(t, 0, 205)} fill="#0b1f1f" />
      <path d="M{t.x - 4},0 Q{t.x + 10},40 {t.x - 2},80" stroke="#1f4a3a" stroke-width="2" fill="none" class="vine" />
    {/each}
    <rect class="fog slow" x="-300" y="160" width="1400" height="60" fill={u('fog')} />
    <path d="M0,196 Q160,184 320,196 T640,192 T800,196 V240 H0 Z" fill={u('ground')} />
    {#each spores as sp, i (i)}
      <circle class="spore" cx={sp.x} cy={sp.y + 20} r={sp.r} style="animation-delay:-{sp.d}s" />
    {/each}
    <path d="M-10,0 H90 Q50,80 80,240 H-10 Z" fill="#050d0d" />
    <path d="M810,0 H720 Q760,100 730,240 H810 Z" fill="#050d0d" />
    <path d="M0,0 H800 V34 Q690,60 580,30 Q470,62 360,28 Q250,58 140,26 Q60,50 0,30 Z" fill="#061312" />
  {:else if scene === 'warren'}
    <path d="M0,40 Q200,10 400,30 T800,36 V200 H0 Z" fill="#2d1b0e" />
    <g fill="#0f0804">
      <ellipse cx="170" cy="150" rx="58" ry="52" />
      <ellipse cx="430" cy="138" rx="72" ry="66" />
      <ellipse cx="660" cy="152" rx="50" ry="46" />
    </g>
    <g stroke="#4a301a" stroke-width="9" stroke-linecap="round">
      <path d="M100,210 V70 M250,210 V60 M350,205 V56 M520,205 V58 M600,210 V64 M730,210 V70" />
      <path d="M90,74 L260,62 M340,58 L530,60 M590,66 L740,72" stroke-width="7" />
    </g>
    <g class="banner" fill="#8a2a1e">
      <path d="M150,68 h34 l-6,40 l-11,-12 l-11,12 Z" />
      <path d="M455,62 h38 l-6,46 l-13,-14 l-13,14 Z" style="animation-delay:-1.2s" />
      <path d="M655,70 h30 l-5,36 l-10,-11 l-10,11 Z" style="animation-delay:-2.1s" />
    </g>
    {#each [215, 575] as tx (tx)}
      <circle class="torchglow" cx={tx} cy="112" r="90" fill={u('glow')} />
      <rect x={tx - 3} y="112" width="6" height="40" fill="#3a2414" />
      <path class="flame" d="M{tx},92 Q{tx + 10},106 {tx + 4},114 Q{tx},118 {tx - 4},114 Q{tx - 10},106 {tx},92 Z" fill="#ffb347" />
    {/each}
    {#each embers as e, i (i)}
      <circle class="ember" cx={e.x} cy={e.y + 40} r={e.r} style="animation-delay:-{e.d}s" />
    {/each}
    <g fill="#241509">
      {#each Array.from({ length: 22 }, (_, i) => i) as i (i)}
        <polygon points="{i * 38 - 6},200 {i * 38 + 4},160 {i * 38 + 14},200" />
      {/each}
    </g>
    <path d="M0,198 Q200,190 400,198 T800,196 V240 H0 Z" fill={u('ground')} />
    <g stroke="#cdbb98" stroke-width="3" stroke-linecap="round" opacity="0.6">
      <path d="M120,222 l22,-6 M600,228 l18,4 M320,232 l14,-8" />
    </g>
    <rect x="690" y="186" width="46" height="34" fill="#3a2414" stroke="#24150a" stroke-width="3" />
  {:else if scene === 'crypt'}
    {#each [60, 220, 380, 540, 700] as ax (ax)}
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
  {:else if scene === 'wolfden'}
    {#each stars as s, i (i)}
      <circle class="star" cx={s.x} cy={s.y} r={s.r} style="animation-delay:-{s.d}s" />
    {/each}
    <circle cx="628" cy="54" r="70" fill={u('moon')} />
    <circle cx="628" cy="54" r="26" fill="#eef3ff" />
    <circle cx="619" cy="48" r="5" fill="#d6ddf0" /><circle cx="636" cy="62" r="3.5" fill="#d6ddf0" />
    <path d="M0,160 Q120,120 240,146 T480,132 T800,150 V200 H0 Z" fill="#121c38" />
    <g fill="#0c1430">{#each farPines as p, i (i)}<path d={p} />{/each}</g>
    {#each eyes as e, i (i)}
      <g class="eyes" style="animation-delay:-{e.d * 1.7}s">
        <circle cx={e.x} cy={e.y} r="1.8" /><circle cx={e.x + 7} cy={e.y} r="1.8" />
      </g>
    {/each}
    <path d="M0,184 Q180,172 400,182 T800,178 V240 H0 Z" fill={u('ground')} />
    <g fill="#070c1c">{#each nearPines as p, i (i)}<path d={p} opacity={i % 3 === 0 ? 1 : 0} />{/each}</g>
    <path d="M-10,240 L-10,150 L40,120 L96,138 L130,200 L150,240 Z" fill="#161f36" stroke="#6d7fb0" stroke-width="1.5" stroke-opacity="0.35" />
    <g stroke="#9fb2de" stroke-opacity="0.25" stroke-width="1.5">
      <path d="M200,214 l4,-12 M260,222 l3,-10 M520,218 l-4,-12 M600,226 l3,-9 M680,214 l-3,-12 M360,230 l2,-10" />
    </g>
  {:else if scene === 'hive'}
    <rect width="800" height="210" fill={u('comb')} opacity="0.85" />
    <rect width="800" height="210" fill={u('sky')} opacity="0.55" />
    <circle cx="400" cy="120" r="220" fill={u('glow')} opacity="0.6" />
    <g fill="#140a02">
      <ellipse cx="140" cy="140" rx="52" ry="40" />
      <ellipse cx="660" cy="130" rx="60" ry="46" />
    </g>
    {#each drips as d, i (i)}
      <path d="M{d.x - 6},0 Q{d.x},{26 + d.r * 6} {d.x + 6},0 Z" fill="#d9951f" opacity="0.85" />
      <circle class="drip" cx={d.x} cy={24 + d.r * 6} r={d.r} fill="#f0b43a" style="animation-delay:-{d.d}s" />
    {/each}
    <path d="M0,196 Q200,184 400,196 T800,192 V240 H0 Z" fill={u('ground')} />
    <g fill="#3a2508">
      <ellipse cx="90" cy="222" rx="18" ry="6" /><ellipse cx="480" cy="230" rx="12" ry="4" /><ellipse cx="700" cy="218" rx="16" ry="5" />
    </g>
  {:else if scene === 'glade'}
    {#each stars.slice(0, 20) as s, i (i)}
      <circle class="star" cx={s.x} cy={s.y * 0.8} r={s.r} style="animation-delay:-{s.d}s" />
    {/each}
    <g fill="#10202a">{#each farPines as p, i (i)}<path d={p} />{/each}</g>
    {#each [[150, 70], [250, 88], [550, 88], [650, 70]] as [sx, sh] (sx)}
      <path d="M{sx - 14},196 L{sx - 10},{196 - sh} Q{sx},{190 - sh} {sx + 10},{196 - sh} L{sx + 14},196 Z" fill="#3a4854" stroke="#56707a" stroke-width="1.5" />
      <path d="M{sx - 6},{206 - sh} v10 M{sx + 2},{220 - sh} v8" stroke={awake ? '#8ff5d2' : '#4b6b6a'} stroke-width="2" />
    {/each}
    <g class="beam" class:awake>
      <rect x="360" y="-10" width="80" height="210" fill={u('beam')} />
    </g>
    <ellipse cx="400" cy="200" rx="92" ry="14" fill="#2a3a40" stroke={awake ? '#8ff5d2' : '#4b6b6a'} stroke-width="2" />
    <path d="M372,200 L378,58 Q400,40 422,58 L428,200 Z" fill="#46545c" stroke="#6d8791" stroke-width="2" />
    <g class="runes" class:awake stroke-width="2.5" fill="none">
      <path d="M392,80 h16 M400,74 v14 M388,108 l12,10 l12,-10 M392,140 h16 v14 h-16 Z M400,166 v18 M390,176 h20" />
    </g>
    {#each motes as m, i (i)}
      <circle class="mote" class:awake cx={m.x} cy={m.y} r={m.r} style="animation-delay:-{m.d}s;animation-duration:{m.t}s" />
    {/each}
    <path d="M0,198 Q200,188 400,200 T800,196 V240 H0 Z" fill={u('ground')} />
    <path d="M-10,0 H60 Q30,70 50,240 H-10 Z" fill="#07120e" />
    <path d="M810,0 H750 Q776,80 752,240 H810 Z" fill="#07120e" />
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
  .rays polygon {
    animation: rays 9s ease-in-out infinite;
    opacity: 0.2;
  }
  @keyframes rays {
    0%, 100% { opacity: 0.12; }
    50% { opacity: 0.34; }
  }

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

  .firefly {
    fill: #ffe98a;
    filter: drop-shadow(0 0 3px #ffe066);
    animation: firefly 5s ease-in-out infinite;
  }
  @keyframes firefly {
    0%, 100% { transform: translate(0, 0); opacity: 0.1; }
    30% { opacity: 0.95; }
    50% { transform: translate(14px, -10px); opacity: 0.7; }
    80% { transform: translate(-6px, -18px); opacity: 0.2; }
  }

  .spore {
    fill: #8ff5d2;
    opacity: 0.5;
    animation: spore 7s ease-in-out infinite;
  }
  @keyframes spore {
    0%, 100% { transform: translateY(0); opacity: 0.15; }
    50% { transform: translateY(-14px); opacity: 0.7; }
  }

  .vine {
    transform-origin: top;
    animation: sway 6s ease-in-out infinite;
  }
  .banner path, .banner {
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

  .ember {
    fill: #ffb347;
    animation: ember 4s linear infinite;
  }
  @keyframes ember {
    from { transform: translateY(0); opacity: 0.9; }
    to { transform: translateY(-60px); opacity: 0; }
  }

  .ghostlight {
    animation: glow 5s ease-in-out infinite alternate;
  }

  .star {
    fill: #dfe8ff;
    animation: twinkle 4s ease-in-out infinite;
  }
  @keyframes twinkle {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 1; }
  }

  .eyes {
    fill: #ffd45a;
    filter: drop-shadow(0 0 3px #ffcf40);
    animation: blink 7s steps(1) infinite;
  }
  @keyframes blink {
    0%, 55% { opacity: 0; }
    58%, 78% { opacity: 1; }
    80%, 100% { opacity: 0; }
  }

  .drip {
    animation: drip 3.5s ease-in infinite;
  }
  @keyframes drip {
    0%, 60% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(180px); opacity: 0; }
  }

  .beam {
    opacity: 0.08;
    transition: opacity 1.2s;
  }
  .beam.awake {
    opacity: 1;
    animation: beam 3s ease-in-out infinite;
  }
  @keyframes beam {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
  .runes {
    stroke: #4b6b6a;
  }
  .runes.awake {
    stroke: #9ffff0;
    filter: drop-shadow(0 0 4px #7ff0d0);
  }
  .mote {
    fill: #bfeee4;
    opacity: 0.25;
    animation: rise 6s linear infinite;
  }
  .mote.awake {
    fill: #e8fffb;
    opacity: 0.9;
  }
  @keyframes rise {
    from { transform: translateY(20px); opacity: 0; }
    30% { opacity: 0.8; }
    to { transform: translateY(-140px); opacity: 0; }
  }

  .window {
    fill: #f5d27a;
    animation: twinkle 9s ease-in-out infinite;
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
