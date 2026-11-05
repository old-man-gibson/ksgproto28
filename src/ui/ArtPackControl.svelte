<script lang="ts">
  import { artPack } from './lib/artPack/artPack.svelte';
  import { describePack } from './lib/artPack/format';

  /**
   * The art pack's import and removal (docs/ART_PACK.md), for the two places
   * that offer them: the Menu window (rows with a fact line each, and Remove)
   * and the floor 0 card (`compact`: the Import button beside the card's other
   * file control, no Remove). Both end in one status line.
   *
   * The status line is always there and one line high, so what it says (the
   * stored pack, `Art pack: importing.`, a result) never changes the size of
   * what holds it. `note` holds the outcome of the last import or removal; it
   * is local, so it is gone when the Menu window is closed or the card's offer
   * is. The compact form emits its button and its status line side by side in
   * whatever flex row holds it; the status line takes the full row.
   */
  let { compact = false }: { compact?: boolean } = $props();

  const ABOUT =
    'Import art pack: reads a zip made by npm run art-pack and keeps it in this browser, apart from the save. The game uses it for art this build lacks.';

  let input: HTMLInputElement;
  let note = $state<string | null>(null);
  let busy = $state(false);
  const status = $derived(note ?? (artPack.loaded ? describePack(artPack.manifest) : ''));

  async function onChange(ev: Event) {
    const target = ev.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file) return;
    busy = true;
    note = 'Art pack: importing.';
    const result = await artPack.importFile(file);
    note = result.ok
      ? null
      : result.reason === 'not-a-pack'
        ? 'Art pack: not an art pack zip.'
        : 'Art pack: storage failed, old pack kept.';
    busy = false;
  }

  async function onRemove() {
    busy = true;
    note = (await artPack.remove()) ? null : 'Art pack: storage failed, pack kept.';
    busy = false;
  }
</script>

<input type="file" accept=".zip,application/zip" bind:this={input} onchange={onChange} style="display: none" />

{#if compact}
  <button class="small" onclick={() => input.click()} disabled={busy} title={ABOUT}>Import art pack</button>
{:else}
  <div class="art-row">
    <span>
      Import art pack: reads a zip made by <code>npm run art-pack</code> and keeps it in this browser,
      apart from the save. The game uses it for art this build lacks.
    </span>
    <button onclick={() => input.click()} disabled={busy}>Import art pack</button>
  </div>
  <div class="art-row">
    <span>Remove art pack: deletes the stored pack.</span>
    <button onclick={onRemove} disabled={busy || !artPack.manifest}>Remove art pack</button>
  </div>
{/if}
<div class="art-status" class:compact role="status">{#if status}{status}{:else}&nbsp;{/if}</div>

<style>
  .art-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }

  .art-row button {
    flex: none;
    min-width: 78px;
  }

  /* One line, reserved whether it holds a status, a result or nothing. */
  .art-status {
    padding: 6px 0;
    min-height: 1.4em;
    border-bottom: 1px solid var(--border);
    overflow-wrap: anywhere;
  }

  /* On the card: a full row under the buttons, no rule of its own. */
  .art-status.compact {
    flex: 1 0 100%;
    padding: 0;
    border-bottom: 0;
  }
</style>
