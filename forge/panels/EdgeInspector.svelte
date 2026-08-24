<script lang="ts">
  /**
   * One DECLARED connection — the line of source written on `from`, not the
   * mirror the registry builds from it. Editing the mirror is not a thing you
   * can do, which is why the flags get explained here rather than assumed.
   *
   * The suggested tick count is the same formula the map uses when you drag a
   * new edge into being; showing the drift is how a road that reads as a
   * five-minute stroll but costs 200 ticks gets noticed.
   */
  import { store } from '../lib/store.svelte';
  import Field from '../lib/Field.svelte';
  import type { Selection } from '../lib/selection';
  import type { Connection, SpotDef } from '../../src/core/types';

  interface Props {
    from: string;
    to: string;
    onselect: (s: Selection) => void;
  }
  let { from, to, onselect }: Props = $props();

  const fromSpot = $derived(store.get<SpotDef>('spot', from));
  const toSpot = $derived(store.get<SpotDef>('spot', to));
  const conn = $derived((fromSpot?.connections ?? []).find((c) => c.to === to));
  /** What `to` declares back at `from`, if anything — a second, separate edge. */
  const reverse = $derived((toSpot?.connections ?? []).find((c) => c.to === from));

  const suggested = $derived.by(() => {
    const a = fromSpot?.map;
    const b = toSpot?.map;
    if (!a || !b) return null;
    return Math.max(5, Math.round((Math.hypot(a.x - b.x, a.y - b.y) * 3) / 5) * 5);
  });

  const drift = $derived(suggested && conn?.ticks ? conn.ticks / suggested : null);
  const strayed = $derived(drift !== null && (drift > 1.8 || drift < 0.55));

  const canExplore = $derived((fromSpot?.activities ?? []).some((a) => a.kind === 'explore'));
  const opener = $derived((fromSpot?.finds ?? []).find((f) => f.path === to));

  function path(...rest: (string | number)[]): (string | number)[] {
    return [from, 'connections', `#to=${to}`, ...rest];
  }

  function setTicks(raw: string): void {
    const v = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(v)) return;
    store.set('spot', path('ticks'), v);
  }

  function applySuggested(): void {
    if (suggested !== null) store.set('spot', path('ticks'), suggested);
  }

  function setLabel(raw: string): void {
    const text = raw.trim();
    if (text) store.set('spot', path('label'), text);
    else if (conn?.label !== undefined) store.del('spot', path('label'));
  }

  /**
   * The label the MIRRORED edge wears. Absent means "same as the outbound
   * one", which is right for a road; a chute you slide down and scramble up
   * needs its own words for the way back.
   */
  function setReturnLabel(raw: string): void {
    const text = raw.trim();
    if (text) store.set('spot', path('returnLabel'), text);
    else if (conn?.returnLabel !== undefined) store.del('spot', path('returnLabel'));
  }

  /** A false flag is noise in the source — absent means the same thing. */
  function setFlag(flag: 'oneWay' | 'hidden' | 'forced', on: boolean): void {
    if (on) store.set('spot', path(flag), true);
    else store.del('spot', path(flag));
  }

  function addPathFind(): void {
    if (!fromSpot) return;
    const taken = new Set((fromSpot.finds ?? []).map((f) => f.id));
    let fid = `path_${to}`;
    let n = 2;
    while (taken.has(fid)) fid = `path_${to}_${n++}`;
    store.set('spot', [from, 'finds', `#id=${fid}`], {
      id: fid,
      at: 0.5,
      desc: `A way through to ${toSpot?.name ?? to} opens up.`,
      path: to,
    });
    store.say(`Added ${fid} at 50% — drag it on ${fromSpot.name}'s threshold track`, 'ok');
  }

  function flip(): void {
    if (!conn || !toSpot) return;
    if (reverse) {
      store.say(`${toSpot.name} already declares a way back — edit that edge instead`, 'warn');
      onselect({ type: 'edge', from: to, to: from });
      return;
    }
    const mirrored: Connection = { to: from, ticks: conn.ticks };
    if (conn.oneWay) mirrored.oneWay = true;
    if (conn.hidden) mirrored.hidden = true;
    // `forced` is directional — it said "arriving at the far end is an
    // ambush", and flipping swaps which end is far. Carrying it over would
    // silently move the ambush home, so it is dropped with a word instead.
    if (conn.forced) store.say('forced was dropped — it described arriving the other way', 'warn');
    // Flipping swaps which way is "out", so the two labels swap with it.
    if (conn.returnLabel) mirrored.label = conn.returnLabel;
    else if (conn.label) mirrored.label = conn.label;
    if (conn.label && conn.returnLabel) mirrored.returnLabel = conn.label;
    store.del('spot', path());
    store.set('spot', [to, 'connections', `#to=${from}`], mirrored);
    onselect({ type: 'edge', from: to, to: from });
  }

  function remove(): void {
    store.del('spot', path());
    onselect(null);
    store.say('Connection removed', 'warn');
  }
</script>

{#if !conn}
  <div class="empty">
    <code>{from}</code> no longer declares a way to <code>{to}</code>.
  </div>
{:else}
  <div class="head">
    <button class="end" onclick={() => onselect({ type: 'spot', id: from })}>
      <span class="ico">{fromSpot?.icon || '📍'}</span>
      <span class="nm">{fromSpot?.name ?? from}</span>
    </button>
    <span class="arrow" class:oneway={conn.oneWay}>→</span>
    <button class="end" onclick={() => onselect({ type: 'spot', id: to })}>
      <span class="ico">{toSpot?.icon || '❔'}</span>
      <span class="nm" class:bad={!toSpot}>{toSpot?.name ?? to}</span>
    </button>
  </div>

  <p class="lede">
    Declared on <code>{from}</code>. {conn.oneWay
      ? 'One-way: nothing comes back unless the far side declares its own edge.'
      : 'Two-way: the registry mirrors this automatically — do not declare the reverse.'}
  </p>

  <div class="section">Travel</div>

  <Field label="ticks" problem={conn.ticks > 0 ? null : 'a connection with no travel time is an error'}>
    <input type="number" min="1" value={conn.ticks ?? ''} onchange={(ev) => setTicks(ev.currentTarget.value)} />
  </Field>

  {#if suggested !== null}
    <div class="suggest" class:strayed>
      <span class="grow">
        Map distance suggests <b>{suggested}t</b>{drift ? ` — declared is ×${drift.toFixed(2)}` : ''}
      </span>
      {#if conn.ticks !== suggested}
        <button class="tiny" onclick={applySuggested}>Use {suggested}</button>
      {/if}
    </div>
  {/if}

  <Field
    label={conn.oneWay ? 'label' : 'label (outbound)'}
    hint="Optional flavour, shown when travelling — 'the old bridge'."
  >
    <input value={conn.label ?? ''} onchange={(ev) => setLabel(ev.currentTarget.value)} />
  </Field>

  {#if !conn.oneWay}
    <Field
      label="label (return)"
      hint={conn.label
        ? `Blank means the way back also reads “${conn.label}”.`
        : 'Set an outbound label first — the return label overrides it.'}
    >
      <input
        value={conn.returnLabel ?? ''}
        placeholder={conn.label ?? ''}
        disabled={!conn.label}
        onchange={(ev) => setReturnLabel(ev.currentTarget.value)}
      />
    </Field>
  {/if}

  <div class="section">Flags</div>

  <label class="check">
    <input type="checkbox" checked={!!conn.oneWay} onchange={(ev) => setFlag('oneWay', ev.currentTarget.checked)} />
    <span>
      <b>oneWay</b>
      <span class="dim">— no automatic reverse. A drop, a slide, a door that locks behind you.</span>
    </span>
  </label>

  <label class="check">
    <input type="checkbox" checked={!!conn.hidden} onchange={(ev) => setFlag('hidden', ev.currentTarget.checked)} />
    <span>
      <b>hidden</b>
      <span class="dim">— appears only at 100% explored, unless a find opens it early.</span>
    </span>
  </label>

  <label class="check">
    <input type="checkbox" checked={!!conn.forced} onchange={(ev) => setFlag('forced', ev.currentTarget.checked)} />
    <span>
      <b>forced</b>
      <span class="dim">
        — arriving at {toSpot?.name ?? to} this way starts a fight with no way out. This direction
        only; the mirror stays an ordinary road. The game warns at the door.
      </span>
    </span>
  </label>

  {#if conn.forced && !(toSpot?.encounters ?? []).length}
    <div class="note bad">
      Forced, but {toSpot?.name ?? to} has an empty encounter table — there is no one there to
      start the fight. Give it encounters or drop the flag.
    </div>
  {/if}

  {#if conn.approach}
    <!-- Status lists and conditions are richer than a checkbox row: the
         approach is DISPLAYED here and edited in the data file, where its
         comments live. The validator still checks every id it names. -->
    <div class="note ok">
      🎭 Carries an approach: {[
        ...(conn.approach.enemies ?? []).map((a) => `enemies +${a.id}`),
        ...(conn.approach.self ?? []).map((a) => `self +${a.id}`),
      ].join(', ') || 'nothing (does nothing — add statuses)'}
      {conn.approach.requires?.length ? ` — gated on ${conn.approach.requires.length} condition(s)` : ''}.
      Applies to the first fight at {toSpot?.name ?? to} when arriving this way. Edited in the data
      file.
    </div>
  {/if}

  {#if !conn.oneWay && reverse}
    <div class="note warn">
      {toSpot?.name ?? to} declares its own edge back here as well. Two mirrored roads plus a declared
      one is one road too many — make one of them one-way, or delete the other.
    </div>
  {/if}

  {#if conn.hidden}
    <div class="section">Who can reveal it</div>
    {#if canExplore || opener}
      <div class="note ok">
        {#if opener}
          <div>The find <code>{opener.id}</code> at {Math.round(opener.at * 100)}% opens it early.</div>
        {/if}
        {#if canExplore}
          <div>Combing {fromSpot?.name} to 100% reveals it.</div>
        {/if}
      </div>
    {:else}
      <div class="note bad">
        Nothing can ever reveal this. {fromSpot?.name} has no Explore activity, and no find here names
        <code>{to}</code> as its <code>path</code>.
      </div>
      <button class="wide" onclick={addPathFind}>+ add a find that opens it at 50%</button>
    {/if}
  {/if}

  <div class="section">Actions</div>

  <div class="row wrap">
    <button class="tiny" onclick={flip} title="Declare this edge on the far side instead">
      ⇄ Flip direction
    </button>
    {#if conn.oneWay}
      <button class="tiny" onclick={() => setFlag('oneWay', false)}>Make two-way</button>
    {/if}
    <span class="grow"></span>
    <button class="tiny danger" onclick={remove}>Delete</button>
  </div>

  <code class="pathline dim">spot › {from} › connections › #to={to}</code>
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .end {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    background: var(--bg3);
    text-align: left;
  }

  .end .ico {
    font-size: 17px;
  }

  .end .nm {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    font-size: 12.5px;
  }

  .end .nm.bad {
    color: var(--bad);
  }

  .arrow {
    color: var(--dim);
    flex: none;
  }

  .arrow.oneway {
    color: var(--oneway);
  }

  .lede {
    font-size: 11.5px;
    color: var(--dim);
    line-height: 1.45;
    margin-bottom: 4px;
  }

  .suggest {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    color: var(--dim);
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 8px;
    margin: -4px 0 9px;
  }

  .suggest.strayed {
    border-color: var(--warn);
    color: var(--warn);
  }

  .check {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 12px;
    line-height: 1.4;
    cursor: pointer;
    margin-bottom: 8px;
  }

  .check input {
    margin-top: 2px;
  }

  .note {
    font-size: 11.5px;
    line-height: 1.45;
    border-radius: 6px;
    padding: 7px 9px;
    margin-bottom: 8px;
    border: 1px solid var(--border);
  }

  .note.ok {
    color: var(--ok);
    border-color: rgba(52, 211, 153, 0.35);
  }

  .note.warn {
    color: var(--warn);
    border-color: rgba(251, 191, 36, 0.35);
  }

  .note.bad {
    color: var(--bad);
    border-color: rgba(248, 113, 113, 0.35);
  }

  .wrap {
    flex-wrap: wrap;
  }

  .wide {
    width: 100%;
  }

  .pathline {
    display: block;
    margin-top: 12px;
    font-size: 10.5px;
    opacity: 0.65;
    overflow-wrap: anywhere;
  }
</style>
