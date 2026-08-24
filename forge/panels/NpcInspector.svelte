<script lang="ts">
  /**
   * One NPC. Mostly this exists to move somebody from one spot to another
   * without hunting through npcs.data.ts for the right `spotId`.
   *
   * Dialogue reordering rewrites the whole `dialogue` array rather than editing
   * a line in place: swapping two entries has no surgical form, and pretending
   * otherwise would produce a diff that reads worse than the honest one.
   */
  import { store } from '../lib/store.svelte';
  import { validate } from '../lib/validate';
  import Field from '../lib/Field.svelte';
  import RefPicker from '../lib/RefPicker.svelte';
  import type { Selection } from '../lib/selection';
  import type { NpcDef, SpotDef } from '../../src/core/types';

  interface Props {
    id: string;
    onselect: (s: Selection) => void;
  }
  let { id, onselect }: Props = $props();

  const npc = $derived(store.get<NpcDef>('npc', id));
  const spot = $derived(npc ? store.get<SpotDef>('spot', npc.spotId) : undefined);
  const dialogue = $derived(npc?.dialogue ?? []);
  const quests = $derived(npc?.quests ?? []);
  const issues = $derived(validate(store).filter((i) => i.subject.kind === 'npc' && i.subject.id === id));

  let confirming = $state(false);
  $effect(() => {
    // A pending delete confirmation must not survive a jump to another NPC.
    if (id) confirming = false;
  });

  function set(path: (string | number)[], value: unknown): void {
    store.set('npc', [id, ...path], value);
  }

  function del(path: (string | number)[]): void {
    store.del('npc', [id, ...path]);
  }

  function move(i: number, delta: number): void {
    const lines = [...dialogue];
    const j = i + delta;
    if (j < 0 || j >= lines.length) return;
    [lines[i], lines[j]] = [lines[j], lines[i]];
    set(['dialogue'], lines);
  }

  function removeNpc(): void {
    store.del('npc', [id]);
    onselect(null);
    store.say(`Deleted ${id} — any quest naming them as giver now dangles`, 'warn');
  }
</script>

{#if !npc}
  <div class="empty">No NPC called <code>{id}</code> — they may have just been deleted.</div>
{:else}
  <div class="head">
    <span class="big">{npc.icon || '🧑'}</span>
    <div class="grow">
      <div class="title">{npc.name || id}</div>
      <code class="dim">{id}</code>
    </div>
  </div>

  {#if issues.length}
    <div class="issues">
      {#each issues as issue, i (i)}
        <div class="issue {issue.severity}">
          <span>{issue.severity === 'error' ? '⛔' : '⚠'}</span>
          <span class="grow">{issue.message}</span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="section">Identity</div>

  <div class="row">
    <div class="grow">
      <Field label="name">
        <input value={npc.name ?? ''} onchange={(ev) => set(['name'], ev.currentTarget.value)} />
      </Field>
    </div>
    <Field label="icon">
      <input
        class="icon-input"
        value={npc.icon ?? ''}
        maxlength="4"
        onchange={(ev) => set(['icon'], ev.currentTarget.value)}
      />
    </Field>
  </div>

  <Field label="desc">
    <textarea value={npc.desc ?? ''} onchange={(ev) => set(['desc'], ev.currentTarget.value)}></textarea>
  </Field>

  <div class="section">Stands at</div>

  <Field label="spotId" problem={spot ? null : `no spot '${npc.spotId}'`}>
    <RefPicker kind="spot" value={npc.spotId} clearable={false} onchange={(v) => set(['spotId'], v ?? '')} />
  </Field>

  {#if spot}
    <button class="link" onclick={() => onselect({ type: 'spot', id: npc.spotId })}>
      <span class="ico">{spot.icon || '📍'}</span>
      <span class="grow">{spot.name}</span>
      <span class="dim">show on map →</span>
    </button>
  {/if}

  <div class="section">Dialogue</div>

  {#if dialogue.length === 0}
    <div class="empty">Nothing to say.</div>
  {/if}
  {#each dialogue as line, i (i)}
    <div class="line">
      <span class="n">{i + 1}</span>
      <textarea
        class="grow say"
        value={line}
        onchange={(ev) => set(['dialogue', i], ev.currentTarget.value)}
      ></textarea>
      <div class="col nudge">
        <button class="tiny ghost" disabled={i === 0} title="Move up" onclick={() => move(i, -1)}>▲</button>
        <button
          class="tiny ghost"
          disabled={i === dialogue.length - 1}
          title="Move down"
          onclick={() => move(i, 1)}
        >
          ▼
        </button>
      </div>
      <button class="tiny danger" title="Remove line" onclick={() => del(['dialogue', i])}>✕</button>
    </div>
  {/each}
  <div class="line add">
    <button class="tiny" onclick={() => set(['dialogue', dialogue.length], '')}>+ line</button>
  </div>

  <div class="section">Quests</div>

  {#if quests.length === 0}
    <div class="empty">Offers nothing.</div>
  {/if}
  {#each quests as qid, i (i)}
    <div class="line">
      <div class="grow">
        <RefPicker
          kind="quest"
          value={qid}
          clearable={false}
          onchange={(v) => set(['quests', i], v ?? '')}
        />
      </div>
      <button class="tiny danger" title="Remove quest" onclick={() => del(['quests', i])}>✕</button>
    </div>
  {/each}
  <div class="line add">
    <button class="tiny" onclick={() => set(['quests', quests.length], '')}>+ quest</button>
    <span class="grow"></span>
    <span class="hint">A quest's own <code>giver</code> has to name this NPC back.</span>
  </div>

  <div class="section">Danger</div>

  {#if confirming}
    <div class="confirm">
      <div>Delete <b>{npc.name}</b>?</div>
      <div class="row">
        <button class="tiny" onclick={() => (confirming = false)}>Cancel</button>
        <button class="tiny danger" onclick={removeNpc}>Delete for real</button>
      </div>
    </div>
  {:else}
    <button class="danger wide" onclick={() => (confirming = true)}>Delete NPC</button>
  {/if}
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .big {
    font-size: 26px;
    line-height: 1;
  }

  .title {
    font-size: 15px;
    font-weight: 600;
  }

  .issues {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 10px;
  }

  .issue {
    display: flex;
    gap: 7px;
    padding: 5px 9px;
    font-size: 11.5px;
    line-height: 1.35;
    background: var(--bg3);
  }

  .issue + .issue {
    border-top: 1px solid var(--border);
  }

  .issue.error {
    color: #ffc4c4;
  }

  .issue.warn {
    color: #f4dda4;
  }

  .icon-input {
    width: 62px;
    text-align: center;
    font-size: 20px;
    padding: 2px;
  }

  .link {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    background: var(--bg3);
    font-size: 12.5px;
    padding: 6px 9px;
  }

  .line {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 5px;
  }

  .line.add {
    align-items: center;
    margin-top: 4px;
  }

  .n {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--dimmer);
    padding-top: 8px;
    width: 14px;
    flex: none;
  }

  .say {
    min-height: 42px;
    font-size: 12.5px;
  }

  .nudge {
    gap: 2px;
    flex: none;
  }

  .nudge button {
    padding: 0 5px;
    font-size: 9px;
    line-height: 1.6;
  }

  .hint {
    font-size: 11px;
    color: var(--dimmer);
    text-align: right;
  }

  .confirm {
    border: 1px solid var(--bad);
    border-radius: 8px;
    padding: 10px;
    font-size: 12px;
    line-height: 1.4;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .wide {
    width: 100%;
  }
</style>
