<script lang="ts">
  /**
   * One content registry, three panes: what exists, what the selected entry is,
   * and what it is wired to.
   *
   * The browser owns navigation rather than the rail, because a cross-reference
   * can lead into a different registry entirely. `cursor` records which rail tab
   * it was made under, so moving the rail invalidates the detour on its own and
   * no effect has to chase the prop.
   */
  import { store } from '../lib/store.svelte';
  import { validate } from '../lib/validate';
  import { persistedNumber } from '../lib/persist.svelte';
  import Splitter from '../lib/Splitter.svelte';
  import EntryEditor from './EntryEditor.svelte';
  import RefGraph from './RefGraph.svelte';
  import Lookup from './Lookup.svelte';

  interface Props {
    kind: string;
  }
  let { kind }: Props = $props();

  /** Registries run to hundreds of entries; past this the list is capped, not paged. */
  const CAP = 300;
  const ID_RE = /^[a-z][a-z0-9_]*$/;
  const MARKERS = ['__fn', '__num', '__map', '__set', '__circular'];

  // Shared across every registry: one browser layout, not eighteen.
  const listWidth = persistedNumber('browser-list', 258);
  const refsWidth = persistedNumber('browser-refs', 296);

  let cursor = $state<{ home: string; kind: string; id: string | null } | null>(null);
  let search = $state({ home: '', text: '' });
  let sort = $state<'name' | 'id'>('name');
  /** Show only entries carrying a `// TODO:` or `// SPEC:` note. */
  let notedOnly = $state(false);

  /**
   * Which face the right column wears: this entry's cross-references, or a
   * search over everything. One column, because they answer neighbouring
   * questions — and a title with no references otherwise pays for the width
   * with dead space.
   */
  let sidePane = $state<'refs' | 'lookup'>('refs');

  /** The new-entry panel: an id, and which existing entry to copy (blank = scaffold). */
  let creating = $state(false);
  let newId = $state('');
  let template = $state('');

  const view = $derived(
    cursor && cursor.home === kind ? cursor : { home: kind, kind, id: null as string | null },
  );
  const query = $derived(search.home === kind ? search.text : '');
  const cat = $derived(store.entry(view.kind));
  const entry = $derived(view.id ? store.get(view.kind, view.id) : undefined);

  const rows = $derived.by(() => {
    const list = Object.entries(store.all<Record<string, unknown>>(view.kind)).map(([id, def]) => ({
      id,
      name: typeof def?.name === 'string' ? def.name : id,
      icon: typeof def?.icon === 'string' ? def.icon : '',
    }));
    list.sort((a, b) =>
      sort === 'id' ? a.id.localeCompare(b.id) : a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
    return list;
  });

  /**
   * Every string inside an entry, flattened, so the filter also matches flavour
   * text and buried ids. Only built once a query exists — a derived that nobody
   * reads costs nothing.
   */
  const haystack = $derived.by(() => {
    const map = new Map<string, string>();
    for (const [id, def] of Object.entries(store.all(view.kind))) map.set(id, harvest(def));
    return map;
  });

  const hasNote = (id: string): boolean => {
    const n = store.notes(view.kind, id);
    return !!(n.TODO || n.SPEC);
  };

  const notedCount = $derived(rows.filter((r) => hasNote(r.id)).length);

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    let list = notedOnly ? rows.filter((r) => hasNote(r.id)) : rows;
    if (!q) return list;
    const hay = haystack;
    return list.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (hay.get(r.id) ?? '').includes(q),
    );
  });

  const shown = $derived(filtered.slice(0, CAP));

  /**
   * Deities browse grouped by pantheon: the tag on the deity whose DEITY_TAGS
   * definition carries `category: 'membership'`. The unaffiliated stand
   * together at the bottom — the same statement the divine bench makes.
   */
  const grouped = $derived.by(() => {
    if (view.kind !== 'deity') return null;
    const tagDefs = (store.meta.deityTags ?? {}) as Record<
      string,
      { name?: string; icon?: string; category?: string }
    >;
    const byTag = new Map<string, { label: string; icon: string; rows: typeof shown }>();
    const alone: typeof shown = [];
    for (const r of shown) {
      const def = store.get<{ tags?: string[] }>(view.kind, r.id);
      const tag = (def?.tags ?? []).find((t) => tagDefs[t]?.category === 'membership');
      if (!tag) {
        alone.push(r);
        continue;
      }
      const group = byTag.get(tag) ?? {
        label: tagDefs[tag]?.name ?? tag,
        icon: tagDefs[tag]?.icon ?? '🏛️',
        rows: [],
      };
      group.rows.push(r);
      byTag.set(tag, group);
    }
    const groups = [...byTag.values()].sort((a, b) => a.label.localeCompare(b.label));
    if (alone.length) groups.push({ label: 'Standing alone', icon: '🕯️', rows: alone });
    return groups;
  });

  const problems = $derived.by(() => {
    const map = new Map<string, 'error' | 'warn'>();
    for (const i of validate(store)) {
      if (i.subject.kind !== view.kind) continue;
      if (i.severity === 'error') map.set(i.subject.id, 'error');
      else if (!map.has(i.subject.id)) map.set(i.subject.id, 'warn');
    }
    return map;
  });

  function harvest(value: unknown): string {
    const parts: string[] = [];
    let budget = 400;
    const walk = (v: unknown): void => {
      if (budget-- <= 0 || v === null || v === undefined) return;
      if (typeof v === 'string') {
        parts.push(v);
        return;
      }
      if (typeof v !== 'object') return;
      for (const child of Array.isArray(v) ? v : Object.values(v)) walk(child);
    };
    walk(value);
    return parts.join(' ').toLowerCase();
  }

  function select(id: string): void {
    cursor = { home: kind, kind: view.kind, id };
  }

  function navigate(nextKind: string, nextId: string): void {
    cursor = { home: kind, kind: nextKind, id: nextId };
    if (nextKind !== view.kind) search = { home: kind, text: '' };
  }

  // ---------- Creating an entry ----------

  function titleCase(id: string): string {
    return id
      .split('_')
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ');
  }

  function isMarker(v: unknown): boolean {
    return !!v && typeof v === 'object' && MARKERS.some((m) => m in (v as object));
  }

  /** A same-shaped empty value, so a seeded entry still satisfies its Def. */
  function blankLike(sample: unknown): unknown {
    if (typeof sample === 'string') return '';
    if (typeof sample === 'number') return 0;
    if (typeof sample === 'boolean') return false;
    if (Array.isArray(sample)) return [];
    if (sample && typeof sample === 'object' && !isMarker(sample)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(sample)) {
        const blank = blankLike(v);
        if (blank !== undefined) out[k] = blank;
      }
      return out;
    }
    return undefined;
  }

  /**
   * The forge has no schema, so the scaffold is inferred: a field HALF the
   * existing entries carry is one a new entry probably wants too. The old rule
   * — the intersection across every entry — produced skeletons so bare that
   * authoring meant re-adding the same six fields by hand every single time,
   * which is exactly the piece-by-piece grind this panel exists to remove.
   */
  function seedFor(k: string): Record<string, unknown> {
    const defs = Object.values(store.all<Record<string, unknown>>(k));
    if (defs.length === 0) return { icon: '📦' };
    const counts = new Map<string, number>();
    for (const d of defs) for (const key of Object.keys(d ?? {})) counts.set(key, (counts.get(key) ?? 0) + 1);
    const wanted = new Set([...counts].filter(([, n]) => n * 2 >= defs.length).map(([key]) => key));
    const seed: Record<string, unknown> = {};
    // Walk keys in the order entries declare them, so the scaffold reads like
    // its neighbours rather than alphabetically shuffled.
    for (const key of [...new Set(defs.flatMap((d) => Object.keys(d ?? {})))]) {
      if (!wanted.has(key) || key === 'id' || key === 'name') continue;
      const sample = defs.find((d) => d && key in d)![key];
      const blank = key === 'icon' ? '📦' : (closedValue(defs, key) ?? blankLike(sample));
      if (blank !== undefined) seed[key] = blank;
    }
    /*
     * A monster whose growth is all zeros never scales, and a scaffold of
     * zeros is the easiest thing in the world to leave that way — the whole
     * bestiary was missing its mental growth until someone looked. So a new
     * monster starts at the BASIC tier's authoring default and is meant to be
     * raised with its tier: the convention across monsters.data.ts is 0.8 at
     * basic rising evenly to 5.0 at divine, with int/wis/cha at half that
     * (a beast should not gain spellPower as fast as it gains claws).
     */
    if (k === 'monster' && seed.growth && typeof seed.growth === 'object') {
      const growth = seed.growth as Record<string, number>;
      for (const a of Object.keys(growth)) {
        growth[a] = a === 'int' || a === 'wis' || a === 'cha' ? 0.4 : 0.8;
      }
    }
    return seed;
  }

  /**
   * A blank that still TYPECHECKS. `blankLike` empties everything, but `tier`
   * and `damageType` are string UNIONS — `''` is not a member — and `gold` is a
   * fixed `[min, max]` tuple that `[]` does not satisfy. A scaffold that fails
   * the build is worse than no scaffold, so any field whose corpus shows a
   * small closed vocabulary, or a consistent tuple, is seeded with a real
   * value from that vocabulary instead of an empty one.
   */
  function closedValue(defs: Record<string, unknown>[], key: string): unknown {
    const values = defs.map((d) => d?.[key]).filter((v) => v !== undefined);
    if (values.length < 3) return undefined;

    if (values.every((v) => typeof v === 'string')) {
      const counts = new Map<string, number>();
      for (const v of values as string[]) counts.set(v, (counts.get(v) ?? 0) + 1);
      // Few distinct values across many entries is what an enum looks like;
      // free text (desc, art) never is.
      if (counts.size > 12 || counts.size > values.length / 2) return undefined;
      return [...counts].sort((a, b) => b[1] - a[1])[0][0];
    }

    // A tuple: same non-zero length everywhere, numbers throughout.
    if (values.every((v) => Array.isArray(v) && v.every((e) => typeof e === 'number'))) {
      const lengths = new Set((values as number[][]).map((v) => v.length));
      if (lengths.size === 1 && !lengths.has(0)) return (values as number[][])[0].map(() => 0);
    }
    return undefined;
  }

  /**
   * Deep copy minus the opaque markers. A clone must NEVER carry `__fn` into
   * the data file — the printer would happily write it as an object literal
   * and the game would load a function-shaped lie.
   */
  function stripMarkers(v: unknown, dropped: { n: number }): unknown {
    if (isMarker(v)) {
      dropped.n++;
      return undefined;
    }
    if (Array.isArray(v)) {
      return v.map((e) => stripMarkers(e, dropped)).filter((e) => e !== undefined);
    }
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, c] of Object.entries(v)) {
        const s = stripMarkers(c, dropped);
        if (s !== undefined) out[k] = s;
      }
      return out;
    }
    return v;
  }

  function cloneOf(sourceId: string): Record<string, unknown> | null {
    const src = store.get<Record<string, unknown>>(view.kind, sourceId);
    if (!src) return null;
    const dropped = { n: 0 };
    const clone = stripMarkers($state.snapshot(src), dropped) as Record<string, unknown>;
    if (dropped.n > 0) {
      store.say(`${dropped.n} function-valued field(s) left out of the copy — add those in the file`, 'warn');
    }
    return clone;
  }

  function openCreate(): void {
    creating = true;
    newId = '';
    // Whatever is selected is the likeliest starting point — copying the
    // nearest neighbour and tweaking IS the content-authoring workflow.
    template = view.id ?? '';
  }

  function create(): void {
    const id = newId.trim();
    if (!ID_RE.test(id)) {
      store.say(`'${id}' is not a usable id — lowercase, digits and _ only`, 'bad');
      return;
    }
    if (store.get(view.kind, id)) {
      store.say(`${view.kind} '${id}' already exists`, 'bad');
      return;
    }
    let value: Record<string, unknown>;
    if (template) {
      const clone = cloneOf(template);
      if (!clone) {
        store.say(`template '${template}' is not in this registry any more`, 'bad');
        return;
      }
      value = { ...clone, id, name: titleCase(id) };
    } else {
      value = { id, name: titleCase(id), ...seedFor(view.kind) };
    }
    store.add(view.kind, id, value);
    creating = false;
    select(id);
    store.say(
      template ? `Added ${id} as a copy of ${template} — staged` : `Added ${id} — staged, fill it in before applying`,
      'ok',
    );
  }

  function freeCopyId(base: string): string {
    const all = store.all(view.kind);
    if (!all[`${base}_copy`]) return `${base}_copy`;
    let n = 2;
    while (all[`${base}_copy_${n}`]) n++;
    return `${base}_copy_${n}`;
  }

  /**
   * Species with no gene naming them. The link between a monster and its gene
   * lives on the GENE, as `from` — one direction, no two-way sync — so "which
   * monsters lack one" is a question you answer by reading the genes, not by
   * putting a field on every monster.
   */
  const geneless = $derived.by(() => {
    if (view.kind !== 'maingene') return [];
    const claimed = new Set(
      store
        .list<{ from?: string }>('maingene')
        .map((g) => g.from)
        .filter((from): from is string => !!from),
    );
    return store
      .list<{ id: string; name?: string; icon?: string }>('monster')
      .filter((m) => !claimed.has(m.id) && !store.get('maingene', `${m.id}_gene`));
  });

  /**
   * Draft a gene for every species missing one. Everything that can be read off
   * the monster is; `genus` and `tier` — the two decisions a gene actually IS —
   * are left unset on purpose, so the linter lists them and the write refuses
   * them until you have made up your mind.
   */
  function stubGenes(): void {
    // Snapshot first: `geneless` is derived from the same store these adds
    // mutate, so iterating it directly would shrink the list mid-loop.
    const targets = [...geneless];
    for (const m of targets) {
      const id = `${m.id}_gene`;
      store.add('maingene', id, {
        id,
        name: `${m.name ?? titleCase(m.id)} Gene`,
        icon: m.icon ?? '🧬',
        genus: '',
        tier: -1,
        from: m.id,
        flatBase: 0,
        ceiling: 1,
      });
    }
    if (targets.length === 0) return;
    select(`${targets[0].id}_gene`);
    store.say(
      `Drafted ${targets.length} gene${targets.length === 1 ? '' : 's'} — staged, each needs a genus and a tier`,
      'ok',
    );
  }

  /** One click: the selected entry again, under a fresh id, ready to tweak. */
  function duplicateSelected(): void {
    if (!view.id) return;
    const clone = cloneOf(view.id);
    if (!clone) return;
    const id = freeCopyId(view.id);
    const name = typeof clone.name === 'string' && clone.name ? `${clone.name} Copy` : titleCase(id);
    store.add(view.kind, id, { ...clone, id, name });
    select(id);
    store.say(`Duplicated as ${id} — staged`, 'ok');
  }
</script>

{#snippet entryRow(r: { id: string; name: string; icon: string })}
  {@const flag = problems.get(r.id)}
  {@const note = store.notes(view.kind, r.id)}
  <button class="entry" class:on={r.id === view.id} onclick={() => select(r.id)}>
    <span class="ico">{r.icon || cat?.icon || '•'}</span>
    <span class="grow txt">
      <span class="nm">{r.name}</span>
      <code class="dim">{r.id}</code>
    </span>
    {#if note.TODO || note.SPEC}
      <span
        class="note-flag"
        title={[note.TODO && `TODO: ${note.TODO}`, note.SPEC && `SPEC: ${note.SPEC}`]
          .filter(Boolean)
          .join('\n')}
      >
        📌
      </span>
    {/if}
    {#if flag}
      <span class="flag" class:bad={flag === 'error'}>⚠</span>
    {/if}
  </button>
{/snippet}

<div class="wrap">
  {#if view.kind !== kind}
    <div class="detour">
      <span class="dim">followed a reference into</span>
      <b>{cat?.icon} {cat?.label ?? view.kind}</b>
      <span class="grow"></span>
      <button class="tiny ghost" onclick={() => (cursor = null)}>
        ← back to {store.entry(kind)?.label ?? kind}
      </button>
    </div>
  {/if}

  <div class="browser">
    <aside class="list" style="width: {listWidth.value}px">
      <div class="list-head">
        <input
          placeholder="Filter — id, name, any text…"
          spellcheck="false"
          value={query}
          oninput={(e) => (search = { home: kind, text: e.currentTarget.value })}
        />
        <div class="row">
          <span class="dim tiny-label">sort</span>
          <button class="tiny" class:on={sort === 'name'} onclick={() => (sort = 'name')}>name</button>
          <button class="tiny" class:on={sort === 'id'} onclick={() => (sort = 'id')}>id</button>
          {#if notedCount > 0 || notedOnly}
            <button
              class="tiny"
              class:on={notedOnly}
              title="only entries carrying a TODO or SPEC note"
              onclick={() => (notedOnly = !notedOnly)}
            >
              📌 {notedCount}
            </button>
          {/if}
          <span class="grow"></span>
          {#if geneless.length > 0}
            <button
              class="tiny"
              title="Draft a gene for each of the {geneless.length} species without one — genus and tier left for you"
              onclick={stubGenes}
            >
              🦴 Draft {geneless.length}
            </button>
          {/if}
          <button
            class="tiny"
            disabled={!view.id}
            title={view.id ? `Duplicate ${view.id} under a fresh id` : 'Select an entry to duplicate'}
            onclick={duplicateSelected}
          >
            ⧉
          </button>
          <button class="tiny" class:on={creating} onclick={() => (creating ? (creating = false) : openCreate())}>
            ＋ New
          </button>
        </div>

        {#if creating}
          <div class="col createf">
            <!-- svelte-ignore a11y_autofocus — the panel only exists because the
                 user just asked to type an id; making them click again is noise. -->
            <input
              class="mono"
              placeholder="new_id_in_snake_case"
              spellcheck="false"
              autofocus
              bind:value={newId}
              onkeydown={(e) => {
                if (e.key === 'Enter') create();
                else if (e.key === 'Escape') creating = false;
              }}
            />
            <select bind:value={template}>
              <option value="">blank — the fields {cat?.label?.toLowerCase() ?? 'entries'} usually carry</option>
              {#each rows as r (r.id)}
                <option value={r.id}>copy of {r.icon} {r.name} ({r.id})</option>
              {/each}
            </select>
            <div class="row">
              <button class="tiny primary" onclick={create}>Create</button>
              <button class="tiny ghost" onclick={() => (creating = false)}>✕</button>
              <span class="dim stage-note">staged only — nothing lands until Review &amp; Apply</span>
            </div>
          </div>
        {/if}
      </div>

      <div class="rows scroll">
        {#if grouped}
          {#each grouped as g (g.label)}
            <div class="group-head">
              {g.icon} {g.label} <span class="dim">{g.rows.length}</span>
            </div>
            {#each g.rows as r (r.id)}
              {@render entryRow(r)}
            {/each}
          {:else}
            <div class="empty">{rows.length === 0 ? 'This registry is empty.' : 'Nothing matches.'}</div>
          {/each}
        {:else}
          {#each shown as r (r.id)}
            {@render entryRow(r)}
          {:else}
            <div class="empty">{rows.length === 0 ? 'This registry is empty.' : 'Nothing matches.'}</div>
          {/each}
        {/if}
      </div>

      <div class="list-foot">
        showing {shown.length} of {rows.length}
        {#if filtered.length > CAP}
          <span class="dim">· capped, narrow the filter</span>
        {/if}
      </div>
    </aside>

    <Splitter
      size={listWidth.value}
      onsize={(n) => (listWidth.value = n)}
      onreset={() => listWidth.reset()}
      min={170}
      max={560}
      label="Resize the entry list"
    />

    <section class="editor scroll">
      {#if !view.id}
        <div class="empty">{cat?.hint ?? `Pick a ${(cat?.label ?? view.kind).toLowerCase()} entry on the left.`}</div>
      {:else if !entry}
        <div class="empty">'{view.id}' is not in this registry any more.</div>
      {:else}
        {#key view.kind + ':' + view.id}
          <EntryEditor kind={view.kind} id={view.id} onrename={(next) => select(next)} />
        {/key}
      {/if}
    </section>

    <Splitter
      size={refsWidth.value}
      onsize={(n) => (refsWidth.value = n)}
      onreset={() => refsWidth.reset()}
      min={200}
      max={860}
      invert
      label="Resize the reference panel"
    />

    <aside class="refs scroll" style="width: {refsWidth.value}px">
      <div class="row side-tabs">
        <button class="tiny" class:on={sidePane === 'refs'} onclick={() => (sidePane = 'refs')}>
          🔗 references
        </button>
        <button class="tiny" class:on={sidePane === 'lookup'} onclick={() => (sidePane = 'lookup')}>
          🔍 lookup
        </button>
      </div>
      {#if sidePane === 'lookup'}
        <Lookup onnavigate={navigate} />
      {:else if view.id && entry}
        {#key view.kind + ':' + view.id}
          <RefGraph kind={view.kind} id={view.id} onnavigate={navigate} />
        {/key}
      {:else}
        <div class="empty">Cross-references land here.</div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .detour {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 12px;
    border-bottom: 1px solid var(--border);
    background: rgba(108, 158, 255, 0.09);
    font-size: 11.5px;
    flex-shrink: 0;
  }

  /* Flex rather than grid: the two asides carry explicit widths the splitters
     drag, and the editor takes whatever is left. */
  .browser {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  /* ---------- List ---------- */

  .list {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    min-height: 0;
    border-right: 1px solid var(--border);
    background: var(--bg2);
  }

  .list-head {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .createf {
    gap: 6px;
    padding-top: 7px;
    border-top: 1px dashed var(--border);
  }

  .stage-note {
    font-size: 10.5px;
  }

  .tiny-label {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  button.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  .side-tabs {
    padding-bottom: 7px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
  }

  .rows {
    flex: 1;
    min-height: 0;
    padding: 4px;
  }

  .entry {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    border: none;
    background: transparent;
    border-radius: 6px;
    padding: 4px 7px;
    text-align: left;
  }

  .entry:hover {
    background: var(--bg3);
  }

  .entry.on {
    background: rgba(108, 158, 255, 0.16);
    color: var(--accent);
  }

  .entry .ico {
    width: 17px;
    text-align: center;
    flex-shrink: 0;
  }

  .entry .txt {
    display: flex;
    flex-direction: column;
    line-height: 1.25;
    overflow: hidden;
  }

  .entry .nm,
  .entry code {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry .nm {
    font-size: 12.5px;
  }

  .entry code {
    font-size: 10.5px;
  }

  .flag {
    color: var(--warn);
    flex-shrink: 0;
  }

  .flag.bad {
    color: var(--bad);
  }

  .note-flag {
    flex-shrink: 0;
    font-size: 11px;
  }

  .group-head {
    padding: 8px 7px 3px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--dimmer);
  }

  .list-foot {
    border-top: 1px solid var(--border);
    padding: 5px 9px;
    font-size: 11px;
    color: var(--dimmer);
    flex-shrink: 0;
  }

  /* ---------- Panes ---------- */

  .editor {
    flex: 1;
    min-width: 0;
    min-height: 0;
    padding: 12px 14px;
  }

  .refs {
    flex-shrink: 0;
    min-height: 0;
    border-left: 1px solid var(--border);
    background: var(--bg2);
    padding: 10px 11px;
  }
</style>
