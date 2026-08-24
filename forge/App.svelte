<script lang="ts">
  /**
   * The forge shell: a left rail of content kinds, a workspace, and the
   * pending-changes bar that stands between you and the data files.
   *
   * Nothing is written until you press Apply, and Apply always shows the diff
   * first. There is no git in this repo — "preview, then write, then keep a
   * backup" is the entire safety net, so it is deliberately not skippable.
   */
  import { onMount } from 'svelte';
  import { store } from './lib/store.svelte';
  import { validate } from './lib/validate';
  import type { Selection } from './lib/selection';
  import { persistedNumber } from './lib/persist.svelte';
  import Splitter from './lib/Splitter.svelte';
  import WorldMap from './panels/WorldMap.svelte';
  import WorldAtlas from './panels/WorldAtlas.svelte';
  import Inspector from './panels/Inspector.svelte';
  import Browser from './panels/Browser.svelte';
  import DiffModal from './panels/DiffModal.svelte';
  import IssueList from './panels/IssueList.svelte';
  import PsionicBench from './panels/PsionicBench.svelte';

  type Tab =
    | { kind: 'map' }
    | { kind: 'atlas' }
    | { kind: 'browse'; type: string }
    | { kind: 'issues' }
    | { kind: 'psionics' };

  const railWidth = persistedNumber('rail', 216);
  const inspectorWidth = persistedNumber('inspector', 372);

  let tab = $state<Tab>({ kind: 'map' });
  let selection = $state<Selection>(null);
  let showDiff = $state(false);
  let verifying = $state(false);
  let verifyResult = $state<{ ok: boolean; failures: { name: string; message: string }[] } | null>(null);

  const issues = $derived(store.loading ? [] : validate(store));
  const errorCount = $derived(issues.filter((i) => i.severity === 'error').length);
  const warnCount = $derived(issues.filter((i) => i.severity === 'warn').length);

  onMount(() => store.load());

  async function verify(): Promise<void> {
    verifying = true;
    verifyResult = null;
    try {
      const result = await (await import('./lib/api')).api.verify();
      verifyResult = result;
      store.say(
        result.ok ? 'Content linter passed' : `${result.failures.length} linter failure(s)`,
        result.ok ? 'ok' : 'bad',
      );
    } catch (err) {
      store.say(err instanceof Error ? err.message : String(err), 'bad');
    } finally {
      verifying = false;
    }
  }

  function onKey(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') {
      ev.preventDefault();
      if (store.dirty) showDiff = true;
    }
  }

  /** Jump to whatever an issue is about. */
  function goToIssue(kind: string, id: string): void {
    if (kind === 'spot') {
      tab = { kind: 'map' };
      selection = { type: 'spot', id };
    } else if (kind === 'npc') {
      tab = { kind: 'map' };
      selection = { type: 'npc', id };
    } else {
      tab = { kind: 'browse', type: kind };
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="shell" style="grid-template-columns: {railWidth.value}px auto 1fr">
  <aside class="rail">
    <div class="brand">⚒️ <b>KSG Forge</b></div>

    <button class="nav" class:on={tab.kind === 'map'} onclick={() => (tab = { kind: 'map' })}>
      🗺️ World Map
    </button>
    <button class="nav" class:on={tab.kind === 'atlas'} onclick={() => (tab = { kind: 'atlas' })}>
      🌍 World Atlas
    </button>
    <button class="nav" class:on={tab.kind === 'psionics'} onclick={() => (tab = { kind: 'psionics' })}>
      🧠 Psionics
    </button>
    <button
      class="nav"
      class:on={tab.kind === 'issues'}
      onclick={() => (tab = { kind: 'issues' })}
    >
      {errorCount > 0 ? '⛔' : warnCount > 0 ? '⚠️' : '✅'} Issues
      {#if errorCount + warnCount > 0}
        <span class="count" class:bad={errorCount > 0}>{errorCount + warnCount}</span>
      {/if}
    </button>

    <div class="section" style="padding: 0 10px">Content</div>
    <div class="nav-scroll scroll">
      {#each store.catalog as entry (entry.kind)}
        <button
          class="nav"
          class:on={tab.kind === 'browse' && tab.type === entry.kind}
          onclick={() => (tab = { kind: 'browse', type: entry.kind })}
        >
          <span class="ico">{entry.icon}</span>
          {entry.label}
          <span class="grow"></span>
          <span class="n">{Object.keys(store.all(entry.kind)).length}</span>
        </button>
      {/each}
    </div>

    <div class="rail-foot">
      <button onclick={verify} disabled={verifying}>
        {verifying ? '⏳ Running…' : '🧪 Run content linter'}
      </button>
      {#if verifyResult}
        <div class="verify" class:bad={!verifyResult.ok}>
          {#if verifyResult.ok}
            ✅ All content rules pass
          {:else}
            {#each verifyResult.failures.slice(0, 4) as f (f.name)}
              <div class="fail" title={f.message}>⛔ {f.name}</div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </aside>

  <Splitter
    size={railWidth.value}
    onsize={(n) => (railWidth.value = n)}
    onreset={() => railWidth.reset()}
    min={168}
    max={420}
    label="Resize the sidebar"
  />

  <main class="main">
    <header class="topbar">
      <h1>
        {#if tab.kind === 'map'}
          World Map
        {:else if tab.kind === 'atlas'}
          World Atlas
        {:else if tab.kind === 'psionics'}
          Psionic bench
        {:else if tab.kind === 'issues'}
          Issues
        {:else}
          {store.entry(tab.type)?.label ?? tab.type}
        {/if}
      </h1>
      {#if tab.kind === 'browse'}
        <code class="dim">{store.entry(tab.type)?.file}</code>
      {:else if tab.kind === 'map' || tab.kind === 'atlas'}
        <code class="dim">src/core/data/locations.data.ts</code>
      {/if}

      <div class="grow"></div>

      {#if errorCount > 0}
        <span class="pill bad">⛔ {errorCount} error{errorCount === 1 ? '' : 's'}</span>
      {/if}
      {#if warnCount > 0}
        <span class="pill warn">⚠ {warnCount}</span>
      {/if}

      {#if store.dirty}
        <span class="pill warn">{store.ops.length} pending</span>
        <button onclick={() => store.discard()} class="danger">Discard</button>
        <button class="primary" onclick={() => (showDiff = true)}>
          Review &amp; Apply <span class="kbd">Ctrl+S</span>
        </button>
      {:else}
        <span class="pill ok">saved</span>
      {/if}
    </header>

    <div class="workspace">
      {#if store.loading}
        <div class="empty">Loading the world…</div>
      {:else if store.error}
        <div class="empty" style="color: var(--bad)">
          {store.error}
          <div style="margin-top: 10px"><button onclick={() => store.load()}>Retry</button></div>
        </div>
      {:else if tab.kind === 'map'}
        <div class="pane">
          <WorldMap {selection} onselect={(s) => (selection = s)} />
        </div>
        <Splitter
          size={inspectorWidth.value}
          onsize={(n) => (inspectorWidth.value = n)}
          onreset={() => inspectorWidth.reset()}
          min={280}
          max={760}
          invert
          label="Resize the inspector"
        />
        <div class="side scroll" style="width: {inspectorWidth.value}px">
          <Inspector {selection} onselect={(s) => (selection = s)} />
        </div>
      {:else if tab.kind === 'atlas'}
        <div class="pane">
          <WorldAtlas onbrowse={() => (tab = { kind: 'browse', type: 'region' })} />
        </div>
      {:else if tab.kind === 'psionics'}
        <div class="pane" style="min-height: 0">
          <PsionicBench />
        </div>
      {:else if tab.kind === 'issues'}
        <div class="pane scroll" style="padding: 14px">
          <IssueList {issues} onopen={goToIssue} />
        </div>
      {:else}
        <div class="pane" style="min-height: 0">
          <Browser kind={tab.type} />
        </div>
      {/if}
    </div>
  </main>
</div>

{#if showDiff}
  <DiffModal onclose={() => (showDiff = false)} />
{/if}

{#if store.toast}
  <div class="toast {store.toast.tone}">{store.toast.text}</div>
{/if}

<style>
  /* Columns come from the inline style so the splitter can move them; the
     middle `auto` track is the splitter itself. */
  .shell {
    display: grid;
    height: 100vh;
    min-width: 0;
  }

  .rail {
    background: var(--bg2);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .brand {
    padding: 14px 14px;
    border-bottom: 1px solid var(--border);
    letter-spacing: 0.4px;
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 8px;
    width: calc(100% - 12px);
    margin: 2px 6px;
    border: none;
    background: transparent;
    text-align: left;
    border-radius: 7px;
    padding: 7px 10px;
    font-size: 13px;
  }

  .nav:hover {
    background: var(--bg3);
  }

  .nav.on {
    background: linear-gradient(90deg, rgba(108, 158, 255, 0.16), transparent);
    color: var(--accent);
    font-weight: 600;
  }

  .nav .ico {
    width: 16px;
    text-align: center;
  }

  .nav .n {
    font-size: 11px;
    color: var(--dimmer);
  }

  .nav .count {
    font-size: 11px;
    background: var(--warn);
    color: #221a00;
    border-radius: 99px;
    padding: 0 6px;
    font-weight: 700;
  }

  .nav .count.bad {
    background: var(--bad);
    color: #2a0a0a;
  }

  .nav-scroll {
    flex: 1;
    min-height: 0;
    padding-bottom: 8px;
  }

  .rail-foot {
    border-top: 1px solid var(--border);
    padding: 10px;
  }

  .rail-foot button {
    width: 100%;
  }

  .verify {
    margin-top: 8px;
    font-size: 11.5px;
    color: var(--ok);
    max-height: 130px;
    overflow-y: auto;
  }

  .verify.bad {
    color: var(--bad);
  }

  .fail {
    margin-bottom: 4px;
    line-height: 1.35;
  }

  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .topbar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 50px;
    padding: 0 14px;
    border-bottom: 1px solid var(--border);
    background: var(--bg2);
    flex-shrink: 0;
  }

  .topbar h1 {
    font-size: 15px;
    font-weight: 600;
  }

  .kbd {
    font-size: 10px;
    opacity: 0.75;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    padding: 0 3px;
    margin-left: 4px;
  }

  /* Flex, not grid: the map takes what's left and the inspector is the one with
     an explicit width, which is what the splitter drags. */
  .workspace {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .pane {
    min-width: 0;
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .side {
    border-left: 1px solid var(--border);
    background: var(--bg2);
    min-height: 0;
    flex-shrink: 0;
  }

  .toast {
    position: fixed;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg3);
    border: 1px solid var(--ok);
    color: var(--ok);
    padding: 9px 16px;
    border-radius: 8px;
    font-size: 12.5px;
    box-shadow: 0 10px 34px rgba(0, 0, 0, 0.5);
    z-index: 200;
  }

  .toast.warn {
    border-color: var(--warn);
    color: var(--warn);
  }

  .toast.bad {
    border-color: var(--bad);
    color: var(--bad);
  }
</style>
