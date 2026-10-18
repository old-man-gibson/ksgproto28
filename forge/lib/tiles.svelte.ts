/**
 * The Tiles mode's own state: which tool is in hand, what the brush carries,
 * which layer is active, and the undo stack per region. Kept out of the
 * content store because none of it is content — it is the window, like pane
 * widths — but shared between the World Map (which paints) and the side
 * panel (which picks), so it lives in a module rather than a component.
 */
import { api, type PackInfo, type SheetInfo } from './api';
import { store } from './store.svelte';
import type { Stamp } from './tilemap';
import type { TileMapDef } from '../../src/ui/lib/tilemaps/types';

export type Tool = 'hand' | 'brush' | 'rect' | 'erase' | 'eraseRect' | 'pick';

export const TOOLS: { id: Tool; icon: string; label: string; key: string }[] = [
  { id: 'hand', icon: '✋', label: 'Hand — pan, select and drag spots', key: 'H' },
  { id: 'brush', icon: '🖌️', label: 'Brush — paint the stamp cell by cell', key: 'B' },
  { id: 'rect', icon: '▭', label: 'Fill — drag a rectangle and fill it with the stamp', key: 'R' },
  { id: 'erase', icon: '⌫', label: 'Eraser — clear cells on the active layer', key: 'E' },
  { id: 'eraseRect', icon: '⬚', label: 'Erase area — clear a rectangle on the active layer', key: 'X' },
  { id: 'pick', icon: '💉', label: 'Picker — take the stamp from the map', key: 'I' },
];

const HISTORY_CAP = 60;

interface History {
  undo: TileMapDef[];
  redo: TileMapDef[];
}

class TilesUi {
  /** Tiles mode is on: the side panel shows the palette and the map paints. */
  on = $state(false);
  tool = $state<Tool>('hand');
  stamp = $state<Stamp | null>(null);
  /** Active layer index into the region's map. */
  layer = $state(0);
  /** Layer names hidden while editing — an aid, never written. */
  hidden = $state<string[]>([]);
  /** Rectangle fills scatter the stamp's tiles instead of tiling it. */
  random = $state(false);
  grid = $state(true);
  /** The region the map editor is showing; the side panel follows it. */
  region = $state<string | null>(null);
  /** Bumped after every change to the grid so the canvas redraws. */
  version = $state(0);
  packs = $state<PackInfo[] | null>(null);
  packsError = $state<string | null>(null);
  canUndo = $state(false);
  canRedo = $state(false);
  /** Bumped when a sheet finishes loading, so ghosts drawn from `imageNow` catch up. */
  loaded = $state(0);

  private history = new Map<string, History>();
  private images = new Map<string, Promise<HTMLImageElement | null>>();
  private ready = new Map<string, HTMLImageElement>();

  private packsLoad: Promise<void> | null = null;

  /** One scan per session, shared by every caller that wants the result. */
  loadPacks(): Promise<void> {
    if (!this.packsLoad) {
      this.packsLoad = api.tiles
        .packs()
        .then(({ packs }) => {
          this.packs = packs;
          this.packsError = null;
        })
        .catch((err) => {
          this.packsError = err instanceof Error ? err.message : String(err);
          this.packs = [];
        });
    }
    return this.packsLoad;
  }

  sheetFor(key: string): SheetInfo | undefined {
    const slash = key.indexOf('/');
    const pack = this.packs?.find((p) => p.key === key.slice(0, slash));
    return pack?.sheets.find((s) => s.path === key.slice(slash + 1));
  }

  /** Sheet pixels straight off the dev server — the forge needs no glob. */
  resolveImage = (key: string): Promise<HTMLImageElement | null> => {
    let p = this.images.get(key);
    if (!p) {
      p = this.loadPacks().then(
        () =>
          new Promise<HTMLImageElement | null>((resolve) => {
            const sheet = this.sheetFor(key);
            if (!sheet) return resolve(null);
            const img = new Image();
            img.onload = () => {
              this.ready.set(key, img);
              this.loaded++;
              resolve(img);
            };
            img.onerror = () => resolve(null);
            img.src = sheet.url;
          }),
      );
      this.images.set(key, p);
    }
    return p;
  };

  /** A sheet already decoded, or null while it loads (the load is started). */
  imageNow(key: string): HTMLImageElement | null {
    const img = this.ready.get(key);
    if (img) return img;
    void this.resolveImage(key);
    return null;
  }

  changed(): void {
    this.version++;
  }

  // ---------- History ----------

  private hist(region: string): History {
    let h = this.history.get(region);
    if (!h) {
      h = { undo: [], redo: [] };
      this.history.set(region, h);
    }
    return h;
  }

  private refresh(region: string): void {
    const h = this.hist(region);
    this.canUndo = h.undo.length > 0;
    this.canRedo = h.redo.length > 0;
  }

  /** Call before a stroke or a structural edit; the current grid becomes undoable. */
  snapshot(region: string): void {
    const map = store.maps[region];
    if (!map) return;
    const h = this.hist(region);
    h.undo.push(structuredClone($state.snapshot(map)) as TileMapDef);
    if (h.undo.length > HISTORY_CAP) h.undo.shift();
    h.redo = [];
    this.refresh(region);
  }

  /** A stroke that changed nothing leaves no history entry behind. */
  dropSnapshot(region: string): void {
    this.hist(region).undo.pop();
    this.refresh(region);
  }

  undo(region: string): void {
    const h = this.hist(region);
    const prev = h.undo.pop();
    if (!prev) return;
    const map = store.maps[region];
    if (map) h.redo.push(structuredClone($state.snapshot(map)) as TileMapDef);
    store.setTileMap(region, prev);
    this.clampLayer(prev);
    this.refresh(region);
    this.changed();
  }

  redo(region: string): void {
    const h = this.hist(region);
    const next = h.redo.pop();
    if (!next) return;
    const map = store.maps[region];
    if (map) h.undo.push(structuredClone($state.snapshot(map)) as TileMapDef);
    store.setTileMap(region, next);
    this.clampLayer(next);
    this.refresh(region);
    this.changed();
  }

  /** Forget a region's history — after a discard or reload the grid is new. */
  forget(region?: string): void {
    if (region) this.history.delete(region);
    else this.history.clear();
    if (region) this.refresh(region);
    else {
      this.canUndo = false;
      this.canRedo = false;
    }
  }

  clampLayer(map: TileMapDef | undefined): void {
    if (!map) return;
    this.layer = Math.min(Math.max(0, this.layer), Math.max(0, map.layers.length - 1));
  }

  show(region: string | null): void {
    if (this.region === region) return;
    this.region = region;
    this.layer = 0;
    if (region) this.refresh(region);
  }
}

export const tilesUi = new TilesUi();
