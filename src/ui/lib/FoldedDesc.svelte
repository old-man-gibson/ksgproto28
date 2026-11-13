<script lang="ts">
  import { viewport } from './viewport.svelte';

  // The explanation line under a window's title (a bench's description). Wide, it
  // is the whole text, as before. On the phone it is one line, cut with an
  // ellipsis, and a tap shows the rest: a bench's description is four to seven
  // lines at 375 px, a fifth of the screen before the bench starts (docs/PHONE.md).
  // The folded line is a fixed 44px tall (one line, a finger's height) whatever
  // the text, so the header does not change while the window is open; only a tap
  // changes it. Held sideways it shares the title's row, so the window keeps the
  // height the bench needs. Put it as the last child of a flex row with
  // `flex-wrap: wrap` (`.win-head` in LocationPanel).
  let { text }: { text: string } = $props();

  let open = $state(false);
</script>

{#if viewport.phone}
  <button class="fold small dim" class:short={viewport.short} class:open aria-expanded={open} onclick={() => (open = !open)}>
    <span class="line">{text}</span>
    <span class="chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
  </button>
{:else}
  <div class="plain small dim">{text}</div>
{/if}

<style>
  .plain {
    flex: 1 0 100%;
  }

  .fold {
    flex: 1 0 100%;
    min-width: 0;
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 0;
    text-align: left;
    color: var(--text-dim);
  }

  /* Held sideways: beside the title, in what is left of the row. */
  .fold.short {
    flex: 1 1 0;
  }

  .fold.short.open {
    flex: 1 0 100%;
  }

  .line {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .fold.open .line {
    white-space: normal;
    overflow: visible;
    padding: 6px 0;
  }

  .chevron {
    flex: 0 0 16px;
    text-align: center;
  }
</style>
