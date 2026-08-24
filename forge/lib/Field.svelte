<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    hint?: string;
    /** Shown under the field in warning colour — a live validation note. */
    problem?: string | null;
    children: Snippet;
  }
  let { label, hint, problem = null, children }: Props = $props();
</script>

<div class="field" class:bad={!!problem}>
  <!-- A div, not a <label>: the control it describes is whatever the caller
       renders into the slot, so there is nothing to point `for` at. -->
  <div class="lbl">{label}</div>
  {@render children()}
  {#if problem}
    <div class="note bad">⚠ {problem}</div>
  {:else if hint}
    <div class="note">{hint}</div>
  {/if}
</div>

<style>
  .field {
    margin-bottom: 9px;
  }

  .lbl {
    font-size: 11px;
    color: var(--dim);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 3px;
  }

  .note {
    font-size: 11px;
    color: var(--dimmer);
    line-height: 1.35;
    margin-top: 2px;
  }

  .note.bad {
    color: var(--bad);
  }

  .field.bad :global(input),
  .field.bad :global(select),
  .field.bad :global(textarea) {
    border-color: var(--bad);
  }
</style>
