<script lang="ts">
  /**
   * What this entry points at, and what points back at it.
   *
   * Nothing in the data declares a reference — a monster id is just a string in
   * a field — so both directions are found by matching strings against the set
   * of ids that actually exist. Cross-kind collisions are therefore real and
   * both readings get listed: if a material and an item share an id, a string
   * naming it genuinely could mean either.
   *
   * The walk is over every registry, so it is paid ONCE into an index that all
   * selections read, instead of per entry. Both indexes rebuild when the
   * working copy changes, which is what keeps a staged edit visible here.
   */
  import { store } from '../lib/store.svelte';

  interface Props {
    kind: string;
    id: string;
    onnavigate: (kind: string, id: string) => void;
  }
  let { kind, id, onnavigate }: Props = $props();

  interface Hit {
    kind: string;
    id: string;
    /** Field path the reference was found at, for orientation. */
    where: string;
  }

  const MARKERS = ['__fn', '__num', '__map', '__set', '__circular'];
  const MAX_DEPTH = 8;

  /** Every id in the game, and the registries that define it. */
  const idIndex = $derived.by(() => {
    const map = new Map<string, string[]>();
    for (const c of store.catalog) {
      for (const key of Object.keys(store.all(c.kind))) {
        const kinds = map.get(key);
        if (kinds) kinds.push(c.kind);
        else map.set(key, [c.kind]);
      }
    }
    return map;
  });

  /** Referenced id → the entries that mention it, one row per entry. */
  const incomingIndex = $derived.by(() => {
    const ids = idIndex;
    const map = new Map<string, Hit[]>();
    for (const c of store.catalog) {
      for (const [entryId, def] of Object.entries(store.all<Record<string, unknown>>(c.kind))) {
        walkRefs(def, ids, (target, where) => {
          const rows = map.get(target) ?? [];
          if (!rows.some((h) => h.kind === c.kind && h.id === entryId)) {
            rows.push({ kind: c.kind, id: entryId, where });
          }
          map.set(target, rows);
        });
      }
    }
    return map;
  });

  const outgoing = $derived.by(() => {
    const def = store.get<Record<string, unknown>>(kind, id);
    if (!def) return [] as Hit[];
    const ids = idIndex;
    const found = new Map<string, Hit>();
    walkRefs(def, ids, (target, where) => {
      for (const k of ids.get(target) ?? []) {
        if (k === kind && target === id) continue;
        const key = `${k}:${target}`;
        if (!found.has(key)) found.set(key, { kind: k, id: target, where });
      }
    });
    return [...found.values()];
  });

  const incoming = $derived(
    (incomingIndex.get(id) ?? []).filter((h) => !(h.kind === kind && h.id === id)),
  );

  function isMarker(v: object): boolean {
    return MARKERS.some((m) => m in v);
  }

  /**
   * Every string inside an entry that names something. The entry's own
   * top-level `id` is skipped: naming itself is not a reference, and skipping
   * it here rather than filtering afterwards stops a same-named entry in
   * another registry from looking like a referrer.
   */
  function walkRefs(
    def: Record<string, unknown>,
    ids: Map<string, string[]>,
    emit: (target: string, where: string) => void,
  ): void {
    const trail: string[] = [];
    const visit = (v: unknown): void => {
      if (typeof v === 'string') {
        if (ids.has(v)) emit(v, trail.join('.'));
        return;
      }
      if (!v || typeof v !== 'object' || trail.length > MAX_DEPTH || isMarker(v)) return;
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          trail.push(String(i));
          visit(v[i]);
          trail.pop();
        }
        return;
      }
      for (const [k, child] of Object.entries(v)) {
        trail.push(k);
        visit(child);
        trail.pop();
      }
    };
    for (const [k, child] of Object.entries(def)) {
      if (k === 'id') continue;
      trail.push(k);
      visit(child);
      trail.pop();
    }
  }

  function group(hits: Hit[]): [string, Hit[]][] {
    const by = new Map<string, Hit[]>();
    for (const h of hits) by.set(h.kind, [...(by.get(h.kind) ?? []), h]);
    const order = store.catalog.map((c) => c.kind);
    for (const rows of by.values()) rows.sort((a, b) => a.id.localeCompare(b.id));
    return [...by.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }

  function nameOf(k: string, hid: string): string {
    const def = store.get<{ name?: string }>(k, hid);
    return typeof def?.name === 'string' ? def.name : hid;
  }

  function iconOf(k: string, hid: string): string {
    const def = store.get<{ icon?: string }>(k, hid);
    if (typeof def?.icon === 'string' && def.icon) return def.icon;
    return store.entry(k)?.icon ?? '•';
  }
</script>

{#snippet rows(hits: Hit[], empty: string)}
  {#if hits.length === 0}
    <div class="none">{empty}</div>
  {:else}
    {#each group(hits) as [k, list] (k)}
      <div class="grp">
        <div class="grp-head">
          <span>{store.entry(k)?.icon ?? '•'}</span>
          {store.entry(k)?.label ?? k}
          <span class="grow"></span>
          <span class="dim">{list.length}</span>
        </div>
        {#each list as h (h.kind + ':' + h.id)}
          <button class="ref" onclick={() => onnavigate(h.kind, h.id)}>
            <span class="ico">{iconOf(h.kind, h.id)}</span>
            <span class="grow txt">
              <span class="nm">{nameOf(h.kind, h.id)}</span>
              <code class="dim">{h.id}</code>
            </span>
            {#if h.where}<code class="where" title={h.where}>{h.where}</code>{/if}
          </button>
        {/each}
      </div>
    {/each}
  {/if}
{/snippet}

<div class="rg">
  <div class="section">
    Points at
    <span class="pill">{outgoing.length}</span>
  </div>
  {@render rows(outgoing, 'Names nothing else in the game.')}

  <div class="section">
    Pointed at by
    <span class="pill" class:warn={incoming.length === 0}>{incoming.length}</span>
  </div>
  {@render rows(incoming, 'Nothing references it — this content is unreachable unless the code names it directly.')}

  <div class="foot dim">
    Matched by id across every registry, so an id used in two of them lists both.
  </div>
</div>

<style>
  .rg {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .none {
    color: var(--dimmer);
    font-size: 11.5px;
    line-height: 1.45;
    padding: 4px 2px 8px;
    font-style: italic;
  }

  .grp {
    margin-bottom: 7px;
  }

  .grp-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--dim);
    padding: 3px 4px;
  }

  .ref {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    border: none;
    background: transparent;
    border-radius: 6px;
    padding: 3px 6px;
    text-align: left;
  }

  .ref:hover {
    background: var(--bg3);
  }

  .ref .ico {
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }

  .txt {
    display: flex;
    flex-direction: column;
    line-height: 1.25;
    overflow: hidden;
  }

  .nm,
  .txt code {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nm {
    font-size: 12.5px;
  }

  .txt code {
    font-size: 10.5px;
  }

  .where {
    font-size: 10px;
    color: var(--dimmer);
    max-width: 84px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .foot {
    font-size: 10.5px;
    line-height: 1.45;
    border-top: 1px solid var(--border);
    padding-top: 7px;
    margin-top: 8px;
  }
</style>
