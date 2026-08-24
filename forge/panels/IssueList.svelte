<script lang="ts">
  /** Everything the live validator is unhappy about, grouped by subject. */
  import type { Issue } from '../lib/validate';
  import { store } from '../lib/store.svelte';

  interface Props {
    issues: Issue[];
    onopen: (kind: string, id: string) => void;
  }
  let { issues, onopen }: Props = $props();

  let filter = $state<'all' | 'error' | 'warn'>('all');
  let query = $state('');

  const shown = $derived(
    issues.filter((i) => {
      if (filter !== 'all' && i.severity !== filter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return i.subject.id.toLowerCase().includes(q) || i.message.toLowerCase().includes(q);
    }),
  );

  const grouped = $derived.by(() => {
    const map = new Map<string, Issue[]>();
    for (const i of shown) {
      const key = `${i.subject.kind}:${i.subject.id}`;
      map.set(key, [...(map.get(key) ?? []), i]);
    }
    return [...map.entries()].sort((a, b) => {
      const aBad = a[1].some((i) => i.severity === 'error');
      const bBad = b[1].some((i) => i.severity === 'error');
      if (aBad !== bBad) return aBad ? -1 : 1;
      return a[0].localeCompare(b[0]);
    });
  });
</script>

<div class="head">
  <input placeholder="Filter issues…" bind:value={query} style="max-width: 280px" />
  <button class="tiny" class:on={filter === 'all'} onclick={() => (filter = 'all')}>All</button>
  <button class="tiny" class:on={filter === 'error'} onclick={() => (filter = 'error')}>Errors</button>
  <button class="tiny" class:on={filter === 'warn'} onclick={() => (filter = 'warn')}>Warnings</button>
  <div class="grow"></div>
  <span class="dim">
    Mirrors <code>tests/content.test.ts</code> — the ✅ button in the rail runs the real thing.
  </span>
</div>

{#if grouped.length === 0}
  <div class="empty">
    {issues.length === 0 ? 'Everything checks out.' : 'Nothing matches that filter.'}
  </div>
{:else}
  {#each grouped as [key, list] (key)}
    {@const [kind, id] = key.split(/:(.*)/)}
    <div class="group">
      <button class="subject" onclick={() => onopen(kind, id)}>
        <span class="ico">{store.entry(kind)?.icon ?? '•'}</span>
        <b>{id}</b>
        <span class="dim">{store.entry(kind)?.label ?? kind}</span>
        <span class="grow"></span>
        <span class="dim open">open →</span>
      </button>
      {#each list as issue, i (i)}
        <div class="issue {issue.severity}">
          <span class="mark">{issue.severity === 'error' ? '⛔' : '⚠'}</span>
          <span>{issue.message}</span>
          {#if issue.path}
            <code class="dim">{issue.path.join(' › ')}</code>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 14px;
    font-size: 11.5px;
  }

  .head button.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  .group {
    border: 1px solid var(--border);
    border-radius: 9px;
    margin-bottom: 9px;
    overflow: hidden;
    background: var(--bg2);
  }

  .subject {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    border: none;
    border-radius: 0;
    background: var(--bg3);
    padding: 7px 11px;
    text-align: left;
  }

  .subject .open {
    font-size: 11px;
    opacity: 0;
  }

  .subject:hover .open {
    opacity: 1;
  }

  .issue {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 12px;
    border-top: 1px solid var(--border);
    line-height: 1.4;
  }

  .issue.error {
    color: #ffc4c4;
  }

  .issue.warn {
    color: #f4dda4;
  }

  .mark {
    flex-shrink: 0;
  }
</style>
