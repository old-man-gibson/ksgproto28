/**
 * The forge's working copy of the game's content.
 *
 * Edits are **staged, not written**. Every change updates a local copy of the
 * data (so the map redraws instantly) and appends a patch op. Nothing touches
 * disk until you apply, and applying always shows the diff first. Dragging a
 * node across the map fires a set per mouse-move; ops to the same path
 * coalesce, so that whole drag lands as one edit to two numbers.
 */

import { api, type CatalogEntry, type NoteMarker, type PatchOp, type PathStep, type TileMapDef } from './api';

type NoteBook = Record<string, Record<string, Partial<Record<NoteMarker, string>>>>;
import { findReferences, type RefSite } from './refs';
import { isGeneStub } from './validate';
import { compact } from './tilemap';

type Dict = Record<string, Record<string, unknown>>;

class Store {
  catalog = $state<CatalogEntry[]>([]);
  data = $state<Dict>({});
  meta = $state<Record<string, unknown>>({});
  /**
   * Drawn maps by region (src/ui/lib/tilemaps/<region>.map.json). Edited in
   * place by the Tiles mode and staged WHOLE — one `tilemap` op per region,
   * the newest grid replacing the last (see forge/server/tilemaps.ts).
   */
  maps = $state<Record<string, TileMapDef>>({});
  ops = $state<PatchOp[]>([]);
  loading = $state(true);
  error = $state<string | null>(null);
  /** Set while a write is in flight, to keep the UI from firing twice. */
  busy = $state(false);
  toast = $state<{ text: string; tone: 'ok' | 'warn' | 'bad' } | null>(null);

  dirty = $derived(this.ops.length > 0);

  async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const [{ catalog }, { data, meta }, { maps }] = await Promise.all([
        api.catalog(),
        api.registry(),
        api.tiles.maps(),
      ]);
      this.catalog = catalog;
      this.data = data as Dict;
      this.meta = meta;
      this.maps = maps;
      this.ops = [];
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  entry(kind: string): CatalogEntry | undefined {
    return this.catalog.find((c) => c.kind === kind);
  }

  all<T = Record<string, unknown>>(kind: string): Record<string, T> {
    return (this.data[kind] ?? {}) as Record<string, T>;
  }

  list<T = Record<string, unknown>>(kind: string): T[] {
    return Object.values(this.all<T>(kind));
  }

  get<T = unknown>(kind: string, id: string): T | undefined {
    return this.all(kind)[id] as T | undefined;
  }

  /** The `// TODO:` / `// SPEC:` lines above an entry, staging included. */
  notes(kind: string, id: string): Partial<Record<NoteMarker, string>> {
    return (this.meta.notes as NoteBook | undefined)?.[kind]?.[id] ?? {};
  }

  /** Stage one marker's note on an entry; empty text removes the line. */
  setNote(kind: string, id: string, marker: NoteMarker, text: string): void {
    const clean = text.replace(/\s*\n\s*/g, ' ').trim();
    if (clean === (this.notes(kind, id)[marker] ?? '')) return;

    // Local copy first, so badges and the editor agree instantly. Assign
    // before reading back — the value of `x ??= {}` is the raw object, not
    // the reactive proxy (see PITFALLS.md on proxy assignment).
    if (!this.meta.notes) this.meta.notes = {};
    const book = this.meta.notes as NoteBook;
    if (!book[kind]) book[kind] = {};
    if (!book[kind][id]) book[kind][id] = {};
    if (clean) book[kind][id][marker] = clean;
    else delete book[kind][id][marker];

    // One op per (entry, marker): the newest wording replaces the old.
    this.ops = [
      ...this.ops.filter(
        (o) => !(o.op === 'note' && o.kind === kind && o.key === id && o.marker === marker),
      ),
      { op: 'note', kind, key: id, marker, text: clean || null },
    ];
  }

  // ---------- Staging edits ----------

  /**
   * Set a value at a path inside an entry, e.g.
   * `set('spot', ['woods_edge', 'exploreTicks'], 140)`.
   */
  set(kind: string, path: PathStep[], value: unknown): void {
    applyLocal(this.data[kind], path, value);
    this.pushOp({ op: 'set', kind, path, value });
  }

  del(kind: string, path: PathStep[]): void {
    deleteLocal(this.data[kind], path);
    // A delete invalidates any staged set that pointed at or into what we
    // removed — matched on kind too, since two registries can share a path.
    this.ops = this.ops.filter(
      (o) => !(o.op === 'set' && o.kind === kind && underPath(o.path, path)),
    );

    // Removing a whole entry that was itself staged: drop the add instead of
    // writing one and then unwriting it. Nothing about it ever reached disk,
    // so the tidiest patch is no patch at all.
    if (path.length === 1) {
      // The entry's notes go with it — the file delete takes the leading
      // comment lines, so the staging and the local copy must agree.
      const book = this.meta.notes as NoteBook | undefined;
      if (book?.[kind]) delete book[kind][String(path[0])];
      this.ops = this.ops.filter((o) => !(o.op === 'note' && o.kind === kind && o.key === path[0]));
      // A reorder naming the entry in EITHER slot now addresses nothing, and
      // one staged op pointing at a missing id fails the whole batch.
      this.ops = this.ops.filter(
        (o) =>
          !(
            o.op === 'reorder' &&
            o.kind === kind &&
            (o.key === path[0] || o.anchor === path[0])
          ),
      );

      const staged = this.ops.some((o) => o.op === 'add' && o.kind === kind && o.key === path[0]);
      if (staged) {
        this.ops = this.ops.filter((o) => !(o.op === 'add' && o.kind === kind && o.key === path[0]));
        return;
      }
    }
    this.pushOp({ op: 'delete', kind, path });
  }

  add(kind: string, key: string, value: Record<string, unknown>): void {
    this.data[kind] = { ...(this.data[kind] ?? {}), [key]: value };
    this.pushOp({ op: 'add', kind, key, value });
  }

  /**
   * Move an entry so it sits beside a sibling.
   *
   * Registry order is key order in the data file, and key order is the order
   * the world map's region tabs come out in — there is no rank field to set,
   * so the working copy has to be rebuilt in the new order to redraw.
   */
  reorder(kind: string, key: string, anchor: string, before: boolean): void {
    if (key === anchor) return;
    const current = this.data[kind];
    if (!current?.[key] || !current[anchor]) return;

    const keys = Object.keys(current).filter((k) => k !== key);
    keys.splice(keys.indexOf(anchor) + (before ? 0 : 1), 0, key);
    this.data[kind] = Object.fromEntries(keys.map((k) => [k, current[k]]));

    // Dragging a tab past four others is four drops; only the last says where
    // it landed, and where it landed is all the file needs to be told.
    const last = this.ops[this.ops.length - 1];
    if (last?.op === 'reorder' && last.kind === kind && last.key === key) {
      this.ops = this.ops.slice(0, -1);
    }
    this.ops = [...this.ops, { op: 'reorder', kind, key, anchor, before }];
  }

  // ---------- Drawn maps ----------

  /** Give a region a drawn map (or replace the one it has), staged whole. */
  setTileMap(region: string, map: TileMapDef): void {
    this.maps[region] = map;
    this.stageMap(region);
  }

  /**
   * The Tiles mode paints straight into `maps[region]`; call this when a
   * stroke ends so the staged op carries the grid as it now stands. Unused
   * sheets are dropped on the way, so the file lists only what it draws.
   */
  touchTileMap(region: string): void {
    const map = this.maps[region];
    if (!map) return;
    compact(map);
    this.stageMap(region);
  }

  /** Remove a region's drawn map; it goes back to the node diagram. */
  dropTileMap(region: string): void {
    delete this.maps[region];
    this.ops = [...this.ops.filter((o) => !(o.op === 'tilemap' && o.region === region)), { op: 'tilemap', region, map: null }];
  }

  private stageMap(region: string): void {
    const map = this.maps[region];
    const snapshot = map ? (structuredClone($state.snapshot(map)) as TileMapDef) : null;
    this.ops = [...this.ops.filter((o) => !(o.op === 'tilemap' && o.region === region)), { op: 'tilemap', region, map: snapshot }];
  }

  /** Everywhere `id` is pointed at, so a rename can be shown before it happens. */
  references(kind: string, id: string): RefSite[] {
    return findReferences(this.data, kind, id);
  }

  /**
   * Rename an entry AND move every reference to it in the same batch.
   *
   * This is the whole reason renaming was refused for so long: an id is not a
   * label, it is the thing other content points at, and half a rename is worse
   * than none. Matching is by inferred field kind, not by string, so renaming
   * the spot `leather_vest` cannot disturb the item of the same name.
   */
  rename(kind: string, from: string, to: string): RefSite[] {
    const sites = this.references(kind, from);

    // References first: their `#id=`/`#to=` lookups still name the old value,
    // and rewriting the entry first would leave them addressing nothing.
    for (const site of sites) {
      // A composite counter key (`fights:woods_edge`) keeps its shape — only
      // the renamed segment moves, never the whole string.
      const value = site.rewrite ? site.rewrite(to) : to;
      this.ops = [...this.ops, { op: 'set', kind: site.kind, path: [site.id, ...site.path], value }];
      applyLocal(this.data[site.kind], [site.id, ...site.path], value);
    }

    const entry = this.data[kind]?.[from];
    if (entry) {
      const moved = { ...(entry as Record<string, unknown>), id: to };
      const { [from]: _gone, ...rest } = this.data[kind];
      this.data[kind] = { ...rest, [to]: moved };
    }

    // A staged `add` is rewritten rather than renamed: the entry has never
    // reached disk, so there is nothing on disk to rename.
    const staged = this.ops.find(
      (o): o is Extract<PatchOp, { op: 'add' }> =>
        o.op === 'add' && o.kind === kind && o.key === from,
    );
    if (staged) {
      this.ops = this.ops.map((o) =>
        o === staged ? { ...staged, key: to, value: { ...(staged.value as object), id: to } } : o,
      );
    } else {
      this.ops = [...this.ops, { op: 'rename', kind, from, to }];
    }

    // Any staged edit still addressed to the old id has to follow it — note
    // ops included: the comment line stays attached to the entry through a
    // rename, so the op just needs the new address.
    this.ops = this.ops.map((o) =>
      o.op !== 'add' && 'path' in o && o.kind === kind && o.path[0] === from
        ? { ...o, path: [to, ...o.path.slice(1)] }
        : o.op === 'note' && o.kind === kind && o.key === from
          ? { ...o, key: to }
          : o.op === 'reorder' && o.kind === kind && (o.key === from || o.anchor === from)
            ? { ...o, key: o.key === from ? to : o.key, anchor: o.anchor === from ? to : o.anchor }
            : o,
    );
    const book = this.meta.notes as NoteBook | undefined;
    if (book?.[kind]?.[from]) {
      book[kind][to] = book[kind][from];
      delete book[kind][from];
    }
    // A region's drawn map is keyed by its id on disk, so it moves too.
    if (kind === 'region' && this.maps[from]) {
      this.maps[to] = this.maps[from];
      delete this.maps[from];
      this.ops = this.ops.filter((o) => !(o.op === 'tilemap' && (o.region === from || o.region === to)));
      this.ops = [...this.ops, { op: 'tilemap', region: from, map: null }];
      this.stageMap(to);
    }
    return sites;
  }

  private pushOp(op: PatchOp): void {
    // Coalesce a repeated set to the same address — a drag is one edit, not
    // two hundred. Only safe for the newest op: anything earlier may be a
    // delete or add whose ordering matters.
    const last = this.ops[this.ops.length - 1];
    if (
      op.op === 'set' &&
      last?.op === 'set' &&
      last.kind === op.kind &&
      samePath(last.path, op.path)
    ) {
      this.ops = [...this.ops.slice(0, -1), op];
      return;
    }
    this.ops = [...this.ops, op];
  }

  // ---------- Writing ----------

  preview() {
    return api.patch(this.ops, true);
  }

  /**
   * Ids of staged genes still missing the two decisions that make them a gene.
   * Only STAGED ones: an unfinished entry someone else left in the file is the
   * linter's business, not this write's.
   */
  get stagedGeneStubs(): string[] {
    const touched = new Set<string>();
    for (const op of this.ops) {
      if (op.op === 'tilemap' || op.kind !== 'maingene') continue;
      if (op.op === 'add' || op.op === 'note' || op.op === 'reorder') touched.add(op.key);
      else if (op.op === 'rename') touched.add(op.to);
      else touched.add(String(op.path[0]));
    }
    return [...touched].filter((id) => isGeneStub(this.get('maingene', id)));
  }

  async apply(): Promise<void> {
    if (this.ops.length === 0 || this.busy) return;
    // Stubs are meant to stage — that is the whole point of them — so the write
    // is the door they get stopped at rather than the staging.
    const stubs = this.stagedGeneStubs;
    if (stubs.length > 0) {
      const shown = stubs.slice(0, 3).join(', ');
      this.say(
        `${stubs.length} gene stub${stubs.length === 1 ? '' : 's'} still need a genus and a tier — ` +
          `${shown}${stubs.length > 3 ? `, +${stubs.length - 3} more` : ''}`,
        'bad',
      );
      return;
    }
    this.busy = true;
    try {
      const result = await api.patch(this.ops, false);
      const files = result.changes.filter((c) => !c.unchanged).length;
      this.ops = [];
      this.say(`Wrote ${files} file${files === 1 ? '' : 's'} — ${result.backups?.length ?? 0} backed up`, 'ok');
      // Re-read from disk so the working copy is exactly what was written,
      // including anything the data file computes on load.
      await this.load();
    } catch (err) {
      this.say(err instanceof Error ? err.message : String(err), 'bad');
    } finally {
      this.busy = false;
    }
  }

  async discard(): Promise<void> {
    this.ops = [];
    await this.load();
    this.say('Pending edits discarded', 'warn');
  }

  say(text: string, tone: 'ok' | 'warn' | 'bad' = 'ok'): void {
    this.toast = { text, tone };
    setTimeout(() => {
      if (this.toast?.text === text) this.toast = null;
    }, 3200);
  }
}

// ---------- Local mutation helpers ----------

function samePath(a: PathStep[], b: PathStep[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/** True when `inner` addresses something at or below `outer`. */
function underPath(inner: PathStep[], outer: PathStep[]): boolean {
  return inner.length >= outer.length && outer.every((s, i) => s === inner[i]);
}

/** Resolve one `#key=value` array lookup against a live array. */
function indexFor(container: unknown, step: PathStep): number | string {
  if (typeof step === 'string' && step.startsWith('#') && Array.isArray(container)) {
    const eq = step.indexOf('=');
    const key = step.slice(1, eq);
    const value = step.slice(eq + 1);
    const i = container.findIndex((el) => (el as Record<string, unknown>)?.[key] === value);
    return i < 0 ? container.length : i;
  }
  return step as number | string;
}

function applyLocal(root: unknown, path: PathStep[], value: unknown): void {
  let node = root as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    const key = indexFor(node, path[i]);
    if (node[key] === undefined || node[key] === null) {
      // Create the missing rung: an array if the next step indexes one.
      const next = path[i + 1];
      node[key] = typeof next === 'number' || String(next).startsWith('#') ? [] : {};
    }
    node = node[key] as Record<string | number, unknown>;
  }
  node[indexFor(node, path[path.length - 1])] = value;
}

function deleteLocal(root: unknown, path: PathStep[]): void {
  let node = root as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    const key = indexFor(node, path[i]);
    if (node[key] === undefined) return;
    node = node[key] as Record<string | number, unknown>;
  }
  const last = indexFor(node, path[path.length - 1]);
  if (Array.isArray(node)) node.splice(last as number, 1);
  else delete node[last];
}

export const store = new Store();
