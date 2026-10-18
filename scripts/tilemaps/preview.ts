// Dev-only viewer for the drawn maps, outside the game: `npm run dev`, then
// open /scripts/tilemaps/preview.html?map=holding_level&scale=0.75&grid=4.
// Reads the same src/ui/lib/tilemaps/*.map.json the game does, through the
// same sheet glob, so it shows exactly what MapCard will paint — without
// loading a save. Not a build input. Authoring happens in the forge.
import { drawTileMap } from '../../src/ui/lib/tilemaps/draw';
import type { TileMapDef } from '../../src/ui/lib/tilemaps/types';

const q = new URLSearchParams(location.search);
const which = q.get('map') ?? 'holding_level';
const scale = Number(q.get('scale') ?? '1');
const grid = Number(q.get('grid') ?? '0');
// Optional window onto the map, in tiles: ?x=8&y=18&w=36&h=14
const win = q.has('w') ? { x: +q.get('x')!, y: +q.get('y')!, w: +q.get('w')!, h: +q.get('h')! } : null;

const MAPS = import.meta.glob('../../src/ui/lib/tilemaps/*.map.json') as Record<
  string,
  () => Promise<{ default: TileMapDef }>
>;
const loader = Object.entries(MAPS).find(([p]) => p.endsWith(`/${which}.map.json`))?.[1];
if (!loader) throw new Error(`no map named ${which} — one of ${Object.keys(MAPS).map((p) => p.split('/').pop()).join(', ')}`);
const MAP = (await loader()).default;
const c = document.getElementById('c') as HTMLCanvasElement;
const ok = await drawTileMap(c, MAP);
document.getElementById('pos')!.textContent = ok ? `${MAP.width}×${MAP.height} tiles` : 'NO SHEETS FOUND';
c.style.width = `${c.width * scale}px`;
c.style.height = `${c.height * scale}px`;
if (win) {
  const wrap = document.getElementById('wrap')!;
  wrap.style.width = `${win.w * MAP.tile * scale}px`;
  wrap.style.height = `${win.h * MAP.tile * scale}px`;
  wrap.style.overflow = 'hidden';
  c.style.marginLeft = `${-win.x * MAP.tile * scale}px`;
  c.style.marginTop = `${-win.y * MAP.tile * scale}px`;
}

const g = document.getElementById('grid') as HTMLCanvasElement;
g.width = (win ? win.w * MAP.tile : c.width) * scale;
g.height = (win ? win.h * MAP.tile : c.height) * scale;
const ox = win ? win.x : 0;
const oy = win ? win.y : 0;
const ctx = g.getContext('2d')!;
if (grid > 0) {
  ctx.strokeStyle = 'rgba(255,255,0,0.6)';
  ctx.fillStyle = 'yellow';
  ctx.font = '11px monospace';
  for (let x = 0; x <= MAP.width; x += grid) {
    const px = (x - ox) * MAP.tile * scale;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, g.height);
    ctx.stroke();
    ctx.fillText(String(x), px + 2, 11);
  }
  for (let y = 0; y <= MAP.height; y += grid) {
    const py = (y - oy) * MAP.tile * scale;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(g.width, py);
    ctx.stroke();
    ctx.fillText(String(y), 2, py + 11);
  }
}
c.addEventListener('mousemove', (e) => {
  const r = c.getBoundingClientRect();
  const tx = Math.floor((e.clientX - r.left) / (MAP.tile * scale));
  const ty = Math.floor((e.clientY - r.top) / (MAP.tile * scale));
  document.getElementById('pos')!.textContent = `tile ${tx},${ty}`;
});
