<script lang="ts">
  /**
   * The gate in front of every write: the exact diff, per file, before it lands.
   *
   * Worth insisting on because the edits are surgical — seeing that moving a
   * spot changed two numbers and nothing else is the proof that the forge is
   * behaving, and the moment it changes more than that you'll see it here.
   */
  import { store } from '../lib/store.svelte';
  import type { FileChange } from '../lib/api';

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  let changes = $state<FileChange[] | null>(null);
  let notes = $state<string[]>([]);
  let error = $state<string | null>(null);

  $effect(() => {
    store
      .preview()
      .then((r) => {
        changes = r.changes;
        notes = r.notes;
      })
      .catch((e) => (error = e instanceof Error ? e.message : String(e)));
  });

  const total = $derived(
    (changes ?? []).reduce(
      (acc, c) => ({ added: acc.added + c.stat.added, removed: acc.removed + c.stat.removed }),
      { added: 0, removed: 0 },
    ),
  );

  async function apply(): Promise<void> {
    await store.apply();
    onclose();
  }
</script>

<div
  class="backdrop"
  role="button"
  tabindex="-1"
  onclick={onclose}
  onkeydown={(e) => e.key === 'Escape' && onclose()}
></div>

<div class="modal" role="dialog" aria-label="Review changes">
  <header>
    <b>Review changes</b>
    {#if changes}
      <span class="pill ok">+{total.added}</span>
      <span class="pill bad">−{total.removed}</span>
      <span class="dim">{changes.filter((c) => !c.unchanged).length} file(s)</span>
    {/if}
    <div class="grow"></div>
    <button class="ghost" onclick={onclose}>✕</button>
  </header>

  <div class="body scroll">
    {#if error}
      <div class="empty" style="color: var(--bad)">{error}</div>
    {:else if !changes}
      <div class="empty">Building the diff…</div>
    {:else if changes.every((c) => c.unchanged)}
      <div class="empty">
        Nothing would change on disk — the staged edits already match the files.
      </div>
    {:else}
      {#if notes.length}
        <div class="notes">
          {#each notes as note, i (i)}<code>{note}</code>{/each}
        </div>
      {/if}
      {#each changes.filter((c) => !c.unchanged) as change (change.file)}
        <div class="file">
          <div class="file-head">
            <code>{change.file}</code>
            {#if change.removed}
              <span class="pill bad">deleted</span>
            {:else if change.created}
              <span class="pill ok">new file</span>
            {/if}
            <span class="pill ok">+{change.stat.added}</span>
            <span class="pill bad">−{change.stat.removed}</span>
          </div>
          {#each change.hunks as hunk, hi (hi)}
            <div class="hunk">
              <div class="hunk-head">@@ line {hunk.oldStart} @@</div>
              {#each hunk.lines as line, li (li)}
                <div class="line {line.kind}">
                  <span class="n">{line.n}</span>
                  <span class="sign">{line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' '}</span>
                  <span class="text">{line.text || ' '}</span>
                </div>
              {/each}
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>

  <footer>
    <span class="dim small">
      A timestamped copy of every touched file goes to <code>.forge-backups/</code> first.
    </span>
    <div class="grow"></div>
    <button onclick={onclose}>Cancel</button>
    <button
      class="primary"
      disabled={!changes || store.busy || changes.every((c) => c.unchanged)}
      onclick={apply}
    >
      {store.busy ? 'Writing…' : 'Write to disk'}
    </button>
  </footer>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(3, 6, 12, 0.68);
    z-index: 300;
    border: none;
  }

  .modal {
    position: fixed;
    inset: 4vh 6vw;
    background: var(--bg2);
    border: 1px solid var(--border-bright);
    border-radius: 12px;
    z-index: 301;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
  }

  header,
  footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 14px;
    flex-shrink: 0;
  }

  header {
    border-bottom: 1px solid var(--border);
  }

  footer {
    border-top: 1px solid var(--border);
  }

  .body {
    flex: 1;
    min-height: 0;
    padding: 12px 14px;
  }

  .notes {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 12px;
  }

  .notes code {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 6px;
    color: var(--dim);
  }

  .file {
    margin-bottom: 16px;
  }

  .file-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .hunk {
    border: 1px solid var(--border);
    border-radius: 7px;
    overflow: hidden;
    margin-bottom: 8px;
    background: #0b0e15;
  }

  .hunk-head {
    background: var(--bg3);
    color: var(--dimmer);
    font-family: var(--mono);
    font-size: 11px;
    padding: 3px 8px;
  }

  .line {
    display: flex;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.5;
    white-space: pre;
  }

  .line .n {
    width: 46px;
    text-align: right;
    padding-right: 10px;
    color: #3d4859;
    flex-shrink: 0;
    user-select: none;
  }

  .line .sign {
    width: 14px;
    flex-shrink: 0;
    user-select: none;
  }

  .line .text {
    flex: 1;
    overflow-x: auto;
  }

  .line.add {
    background: rgba(52, 211, 153, 0.1);
    color: #9df5cf;
  }

  .line.del {
    background: rgba(248, 113, 113, 0.1);
    color: #ffb3b3;
  }

  .line.ctx {
    color: #7c8798;
  }

  .small {
    font-size: 11.5px;
  }
</style>
