<script lang="ts">
  /**
   * The pinboard: six columns, one card per file in `docs/plans/`.
   *
   * Everything here is a VIEW. The only thing this app can write is a card's
   * `status:` line (and the `updated:` stamp beside it) — bodies are edited in
   * a text editor or by Claude, because the prose is the actual design work and
   * a textarea in a kanban is where design work goes to die.
   *
   * The column a card sits in answers one question: whose turn is it? That is
   * why there are six and not three. `review` exists as its own column because
   * it is the step that cannot be delegated, and a board that hides it would be
   * lying about where the work actually queues.
   */
  import { onMount } from 'svelte';

  const STATUSES = ['todo', 'planning', 'draft', 'execution', 'review', 'complete'] as const;
  type Status = (typeof STATUSES)[number];

  interface Card {
    id: string;
    title: string;
    kind: 'epic' | 'story';
    status: Status;
    system: string;
    parent: string;
    save: string;
    updated: string;
    invariants: string[];
    done: string[];
    file: string;
    body: string;
    warnings: string[];
  }

  /** Whose turn it is, per column. Mirrors `docs/plans/_TEMPLATE.md`. */
  const OWNER: Record<Status, string> = {
    todo: 'capture — yours',
    planning: 'design — shared',
    draft: 'spec — Claude writes, you tear up',
    execution: 'build — Claude',
    review: 'read + tune — yours, non-delegable',
    complete: 'shipped, docs updated',
  };

  const API = '/__board/api';

  let cards = $state<Card[]>([]);
  let systems = $state<string[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let toast = $state<{ text: string; tone: 'ok' | 'bad' } | null>(null);

  let query = $state('');
  let systemFilter = $state('');
  let selected = $state<string | null>(null);

  let dragging = $state<string | null>(null);
  let hovering = $state<Status | null>(null);

  let creating = $state(false);
  let draft = $state({ id: '', title: '', kind: 'story' as 'epic' | 'story', system: '', parent: '' });

  interface Edit {
    title: string;
    system: string;
    parent: string;
    /** Both lists edit as one-per-line text — a list widget would be worse. */
    invariants: string;
    done: string;
    body: string;
    /** The prose as loaded, sent back so the server can refuse a stale write. */
    baseBody: string;
  }

  /**
   * Unsaved edits, per card id. They deliberately OUTLIVE selecting another
   * card: clicking away from half a thought must never cost you the thought,
   * and a dot on the card says where the unsaved work is.
   */
  let edits = $state<Record<string, Edit>>({});
  let conflict = $state<string | null>(null);
  let saving = $state(false);

  /** Prose as it should look in a textarea: no leading blank, no trailing space. */
  function norm(body: string): string {
    return body.replace(/^\n+/, '').replace(/\s+$/, '');
  }

  function editFrom(c: Card): Edit {
    return {
      title: c.title,
      system: c.system,
      parent: c.parent,
      invariants: c.invariants.join('\n'),
      done: c.done.join('\n'),
      body: norm(c.body),
      baseBody: c.body,
    };
  }

  function dirty(c: Card): boolean {
    const e = edits[c.id];
    if (!e) return false;
    return (
      e.title !== c.title ||
      e.system !== c.system ||
      e.parent !== c.parent ||
      e.invariants !== c.invariants.join('\n') ||
      e.done !== c.done.join('\n') ||
      e.body !== norm(c.body)
    );
  }

  const card = $derived(cards.find((c) => c.id === selected) ?? null);
  const warned = $derived(cards.filter((c) => c.warnings.length > 0));

  /** Opening a card with no edit in flight seeds one from what is on disk. */
  $effect(() => {
    if (card && !edits[card.id]) edits[card.id] = editFrom(card);
  });

  const shown = $derived(
    cards.filter((c) => {
      if (systemFilter && c.system !== systemFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.id.includes(q) ||
        c.system.includes(q) ||
        c.body.toLowerCase().includes(q)
      );
    }),
  );

  function column(status: Status): Card[] {
    // Epics first, then by id, so a parent never sorts below its own children.
    return shown
      .filter((c) => c.status === status)
      .sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === 'epic' ? -1 : 1));
  }

  function say(text: string, tone: 'ok' | 'bad'): void {
    toast = { text, tone };
    setTimeout(() => (toast = null), 3200);
  }

  async function load(): Promise<void> {
    loading = true;
    error = null;
    try {
      const res = await fetch(`${API}/cards`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      cards = data.cards;
      systems = data.systems;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  async function move(id: string, status: Status): Promise<void> {
    const current = cards.find((c) => c.id === id);
    if (!current || current.status === status) return;

    // Optimistic, then reconciled by the reload — the disk is the authority and
    // a failed write must not leave the board showing a move that did not happen.
    const previous = current.status;
    current.status = status;
    try {
      const res = await fetch(`${API}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      say(`${id} → ${status}`, 'ok');
      await load();
    } catch (err) {
      current.status = previous;
      say(err instanceof Error ? err.message : String(err), 'bad');
    }
  }

  async function create(): Promise<void> {
    const id = draft.id.trim();
    if (!id) return;
    try {
      const res = await fetch(`${API}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      creating = false;
      draft = { id: '', title: '', kind: 'story', system: '', parent: '' };
      await load();
      selected = id;
      say(`Created ${data.file}`, 'ok');
    } catch (err) {
      say(err instanceof Error ? err.message : String(err), 'bad');
    }
  }

  async function save(): Promise<void> {
    if (!card) return;
    const e = edits[card.id];
    if (!e || !dirty(card)) return;

    saving = true;
    conflict = null;
    try {
      const res = await fetch(`${API}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: card.id,
          baseBody: e.baseBody,
          title: e.title,
          system: e.system,
          parent: e.parent,
          invariants: e.invariants.split('\n'),
          done: e.done.split('\n'),
          body: e.body,
        }),
      });
      const data = await res.json();

      if (res.status === 409) {
        // The edit is KEPT. Losing what they typed to a conflict would be a
        // worse bug than the conflict itself.
        conflict = data.error;
        return;
      }
      if (!res.ok) throw new Error(data.error ?? res.statusText);

      const id = card.id;
      await load();
      delete edits[id];
      say(data.unchanged ? 'Nothing to save' : 'Saved', 'ok');
    } catch (err) {
      say(err instanceof Error ? err.message : String(err), 'bad');
    } finally {
      saving = false;
    }
  }

  function discard(): void {
    if (!card) return;
    delete edits[card.id];
    conflict = null;
  }

  /** `some title here` → `some-title-here`, so capture never stops to think. */
  function slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  onMount(load);
</script>

<svelte:window
  onkeydown={(e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  }}
/>

<div class="shell">
  <header>
    <h1>KSG Board</h1>
    <span class="sub">docs/plans/</span>

    <input class="search" type="search" placeholder="Search titles and bodies…" bind:value={query} />

    <select bind:value={systemFilter} title="Filter by system">
      <option value="">all systems</option>
      {#each systems as system (system)}
        <option value={system}>{system}</option>
      {/each}
    </select>

    <span class="spacer"></span>

    {#if warned.length}
      <span class="warnchip" title={warned.map((c) => `${c.id}: ${c.warnings.join(' ')}`).join('\n')}>
        ⚠ {warned.length} card{warned.length === 1 ? '' : 's'} with format problems
      </span>
    {/if}

    <button onclick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
    <button class="primary" onclick={() => (creating = true)}>New card</button>
  </header>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="columns">
    {#each STATUSES as status (status)}
      {@const list = column(status)}
      <section
        class="column"
        class:over={hovering === status}
        style="--hue: var(--col-{status})"
        ondragover={(e) => {
          e.preventDefault();
          hovering = status;
        }}
        ondragleave={() => {
          if (hovering === status) hovering = null;
        }}
        ondrop={(e) => {
          e.preventDefault();
          hovering = null;
          if (dragging) move(dragging, status);
          dragging = null;
        }}
      >
        <div class="colhead">
          <span class="dot"></span>
          <strong>{status}</strong>
          <span class="count">{list.length}</span>
          <p class="owner">{OWNER[status]}</p>
        </div>

        <div class="stack">
          {#each list as c (c.id)}
            <button
              class="card"
              class:epic={c.kind === 'epic'}
              class:on={selected === c.id}
              class:ghost={dragging === c.id}
              draggable="true"
              ondragstart={() => (dragging = c.id)}
              ondragend={() => {
                dragging = null;
                hovering = null;
              }}
              onclick={() => (selected = selected === c.id ? null : c.id)}
            >
              <span class="title">
                {#if c.kind === 'epic'}<span class="badge">epic</span>{/if}
                {c.title}
                {#if dirty(c)}<span class="dirty" title="Unsaved edits">●</span>{/if}
                {#if c.warnings.length}<span class="flag" title={c.warnings.join('\n')}>⚠</span>{/if}
              </span>
              <span class="meta">
                <span class="chip">{c.system}</span>
                {#if c.parent}<span class="chip parent">↳ {c.parent}</span>{/if}
                {#if c.done.length}<span class="chip crit">{c.done.length} criteria</span>{/if}
                {#if c.save}<span class="chip save">v{c.save}</span>{/if}
              </span>
              {#if c.invariants.length}
                <span class="inv">
                  {#each c.invariants as i (i)}<span class="tag">{i}</span>{/each}
                </span>
              {/if}
            </button>
          {/each}

          {#if !list.length && !loading}
            <p class="empty">—</p>
          {/if}
        </div>
      </section>
    {/each}
  </div>

  {#if card && edits[card.id]}
    <aside class="detail">
      <div class="dhead">
        <input class="dtitle" bind:value={edits[card.id].title} placeholder="Untitled" />
        <button class="x" onclick={() => (selected = null)} title="Close">✕</button>
      </div>
      <code class="dpath">{card.file}</code>

      <div class="drow">
        <label>
          status
          <select
            value={card.status}
            onchange={(e) => move(card.id, (e.currentTarget as HTMLSelectElement).value as Status)}
          >
            {#each STATUSES as s (s)}<option value={s}>{s}</option>{/each}
          </select>
        </label>
        <label>
          system
          <input class="short" bind:value={edits[card.id].system} list="systems" />
        </label>
        <label>
          parent
          <input class="short" bind:value={edits[card.id].parent} list="epics" placeholder="—" />
        </label>
        <span class="chip">{card.kind}</span>
        {#if card.updated}<span class="chip dimchip">updated {card.updated}</span>{/if}
      </div>

      {#if conflict}
        <p class="conflict">
          {conflict}
          <button class="tiny" onclick={load}>Reload the board</button>
        </p>
      {/if}

      {#if card.warnings.length}
        <ul class="warnlist">
          {#each card.warnings as w (w)}<li>{w}</li>{/each}
        </ul>
      {/if}

      <h3>Done when <span class="hint2">one criterion per line — what is TRUE when it is finished</span></h3>
      <textarea class="lines" rows="3" bind:value={edits[card.id].done}></textarea>

      <h3>Must not break <span class="hint2">one invariant per line</span></h3>
      <textarea class="lines" rows="2" bind:value={edits[card.id].invariants}></textarea>

      <h3>Design <span class="hint2">markdown — this is the part that survives</span></h3>
      <textarea
        class="bodyedit"
        bind:value={edits[card.id].body}
        placeholder="Think out loud here. Half-formed is fine."
      ></textarea>

      <div class="dfoot">
        {#if dirty(card)}
          <span class="unsaved">● unsaved</span>
        {:else}
          <span class="saved">saved</span>
        {/if}
        <span class="spacer"></span>
        <button onclick={discard} disabled={!dirty(card)}>Discard</button>
        <button class="primary" onclick={save} disabled={!dirty(card) || saving}>
          {saving ? 'Saving…' : 'Save'} <kbd>Ctrl+S</kbd>
        </button>
      </div>
    </aside>
  {/if}

  <datalist id="epics">
    {#each cards.filter((c) => c.kind === 'epic') as e (e.id)}<option value={e.id}></option>{/each}
  </datalist>
  <datalist id="systems">
    {#each systems as s (s)}<option value={s}></option>{/each}
  </datalist>

  {#if creating}
    <div class="modal">
      <div class="sheet">
        <h2>New card</h2>
        <p class="hint">
          Capture it badly and move on — <code>todo</code> exists so an idea can be one sentence.
        </p>

        <label>
          title
          <input
            bind:value={draft.title}
            oninput={() => {
              if (!draft.id || draft.id === slugify(draft.title).slice(0, draft.id.length)) {
                draft.id = slugify(draft.title);
              }
            }}
            placeholder="Headless batch fight simulator"
          />
        </label>

        <label>
          id <span class="dim">(filename)</span>
          <input bind:value={draft.id} placeholder="balance-harness" />
        </label>

        <div class="pair">
          <label>
            kind
            <select bind:value={draft.kind}>
              <option value="story">story</option>
              <option value="epic">epic</option>
            </select>
          </label>
          <label>
            system
            <input bind:value={draft.system} placeholder="combat" list="systems" />
          </label>
        </div>

        <label>
          parent epic <span class="dim">(optional)</span>
          <input bind:value={draft.parent} placeholder="" list="epics" />
        </label>

        <div class="actions">
          <button onclick={() => (creating = false)}>Cancel</button>
          <button class="primary" onclick={create} disabled={!draft.id.trim()}>Create</button>
        </div>
      </div>
    </div>
  {/if}

  {#if toast}
    <p class="toast" class:bad={toast.tone === 'bad'}>{toast.text}</p>
  {/if}
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--bg2);
    flex: 0 0 auto;
  }

  h1 {
    font-size: 15px;
    letter-spacing: 0.3px;
  }

  .sub {
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--dimmer);
  }

  .search {
    width: 260px;
  }

  .spacer {
    flex: 1;
  }

  .warnchip {
    font-size: 11.5px;
    color: var(--warn);
    border: 1px solid #4a3c14;
    background: #241d09;
    border-radius: 999px;
    padding: 4px 10px;
    cursor: help;
  }

  .error {
    margin: 10px 14px;
    padding: 9px 12px;
    border-radius: 6px;
    border: 1px solid #5c2626;
    background: #2a1414;
    color: var(--bad);
  }

  .columns {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(6, minmax(210px, 1fr));
    gap: 1px;
    background: var(--border);
    overflow: auto;
    min-height: 0;
  }

  .column {
    background: var(--bg);
    display: flex;
    flex-direction: column;
    min-height: 0;
    transition: background 0.12s;
  }

  .column.over {
    background: var(--bg2);
  }

  .colhead {
    padding: 10px 12px 8px;
    border-bottom: 1px solid var(--border);
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 7px;
    position: sticky;
    top: 0;
    background: var(--bg2);
    z-index: 1;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--hue);
  }

  .colhead strong {
    font-size: 12.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--hue);
  }

  .count {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--dimmer);
    background: var(--bg3);
    border-radius: 999px;
    padding: 1px 7px;
  }

  .owner {
    grid-column: 1 / -1;
    font-size: 10.5px;
    color: var(--dimmer);
  }

  .stack {
    flex: 1;
    overflow-y: auto;
    padding: 9px;
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-height: 0;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
    padding: 9px 10px;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--hue);
    border-radius: 7px;
    cursor: grab;
  }

  .card:active {
    cursor: grabbing;
  }

  .card.epic {
    background: var(--bg3);
    border-left-width: 6px;
  }

  .card.on {
    border-color: var(--accent);
    border-left-color: var(--hue);
  }

  .card.ghost {
    opacity: 0.35;
  }

  .title {
    font-size: 12.5px;
    line-height: 1.35;
    font-weight: 500;
  }

  .badge {
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--accent2);
    border: 1px solid #3a3157;
    border-radius: 3px;
    padding: 0 4px;
    margin-right: 4px;
    vertical-align: 1px;
  }

  .flag {
    color: var(--warn);
    cursor: help;
  }

  .meta,
  .inv {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    font-size: 10.5px;
    font-family: var(--mono);
    color: var(--dim);
    background: var(--bg3);
    border-radius: 4px;
    padding: 1px 6px;
  }

  .chip.parent {
    color: var(--accent2);
  }

  .chip.crit {
    color: var(--ok);
  }

  .chip.save {
    color: var(--warn);
  }

  .chip.dimchip {
    color: var(--dimmer);
  }

  .tag {
    font-size: 10px;
    font-family: var(--mono);
    color: var(--dimmer);
    border: 1px dashed var(--border-bright);
    border-radius: 3px;
    padding: 0 5px;
  }

  .empty {
    color: var(--dimmer);
    text-align: center;
    padding: 14px 0;
  }

  .detail {
    position: fixed;
    top: 0;
    right: 0;
    width: min(620px, 50vw);
    height: 100vh;
    background: var(--bg2);
    border-left: 1px solid var(--border-bright);
    box-shadow: -18px 0 40px #0007;
    padding: 14px 18px 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .dhead {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .dtitle {
    flex: 1;
    font-size: 16px;
    font-weight: 600;
    background: transparent;
    border-color: transparent;
    padding: 4px 6px;
    margin-left: -6px;
  }

  .dtitle:hover:not(:focus) {
    border-color: var(--border);
  }

  .dpath {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--dimmer);
    margin-bottom: 12px;
  }

  .x {
    padding: 3px 9px;
    flex: 0 0 auto;
  }

  .short {
    width: 118px;
  }

  .conflict {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--bad);
    border: 1px solid #5c2626;
    background: #2a1414;
    border-radius: 6px;
    padding: 9px 11px;
    margin-bottom: 10px;
  }

  .tiny {
    padding: 3px 8px;
    font-size: 11px;
    flex: 0 0 auto;
  }

  .hint2 {
    text-transform: none;
    letter-spacing: 0;
    font-size: 10.5px;
    color: var(--dimmer);
    font-weight: 400;
    margin-left: 6px;
  }

  textarea {
    font: inherit;
    color: inherit;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 9px 11px;
    resize: none;
    width: 100%;
  }

  textarea:focus {
    outline: none;
    border-color: var(--accent);
  }

  .lines {
    font-family: var(--mono);
    font-size: 11.5px;
    line-height: 1.6;
  }

  .bodyedit {
    font-family: var(--mono);
    font-size: 11.5px;
    line-height: 1.65;
    flex: 1;
    min-height: 160px;
  }

  .dfoot {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 11px 0;
    margin-top: 2px;
    border-top: 1px solid var(--border);
    flex: 0 0 auto;
  }

  .unsaved {
    font-size: 11.5px;
    color: var(--warn);
  }

  .saved {
    font-size: 11.5px;
    color: var(--dimmer);
  }

  .dirty {
    color: var(--warn);
    font-size: 9px;
    vertical-align: 2px;
  }

  kbd {
    font-family: var(--mono);
    font-size: 10px;
    opacity: 0.6;
    margin-left: 3px;
  }

  .drow {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: var(--dim);
  }

  .drow label {
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }

  h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    color: var(--dimmer);
    margin: 16px 0 7px;
  }

  .warnlist {
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: var(--warn);
    font-size: 12px;
    border: 1px solid #4a3c14;
    background: #241d09;
    border-radius: 6px;
    padding: 9px 9px 9px 26px;
    margin-bottom: 10px;
  }

  .modal {
    position: fixed;
    inset: 0;
    background: #000a;
    display: grid;
    place-items: center;
    z-index: 10;
  }

  .sheet {
    width: 420px;
    background: var(--bg2);
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 11px;
  }

  .sheet h2 {
    font-size: 15px;
  }

  .hint {
    font-size: 11.5px;
    color: var(--dimmer);
    line-height: 1.5;
  }

  .hint code,
  .dim {
    font-family: var(--mono);
    color: var(--dim);
  }

  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .toast {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg3);
    border: 1px solid var(--ok);
    color: var(--ok);
    border-radius: 999px;
    padding: 7px 16px;
    font-size: 12px;
    z-index: 20;
  }

  .toast.bad {
    border-color: var(--bad);
    color: var(--bad);
  }
</style>
