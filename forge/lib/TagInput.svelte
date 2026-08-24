<script lang="ts">
  /** A chip list of free-form strings, with suggestions from what's in use. */
  interface Props {
    values: string[];
    onchange: (next: string[]) => void;
    /** Suggested values, usually gathered from the live registries. */
    suggestions?: string[];
    placeholder?: string;
    /** Flag chips that resolve to nothing. */
    isValid?: (value: string) => boolean;
  }
  let { values, onchange, suggestions = [], placeholder = 'add…', isValid }: Props = $props();

  let draft = $state('');
  const listId = `tags-${Math.random().toString(36).slice(2, 8)}`;
  const available = $derived(suggestions.filter((s) => !values.includes(s)).sort());

  function add(raw: string): void {
    const tag = raw.trim();
    if (!tag || values.includes(tag)) {
      draft = '';
      return;
    }
    onchange([...values, tag]);
    draft = '';
  }

  function remove(tag: string): void {
    onchange(values.filter((v) => v !== tag));
  }
</script>

<div class="tags">
  {#each values as tag (tag)}
    <!-- A blank entry is never meaningful content, so it says so rather than
         rendering as a chip made of nothing that you have to guess at. -->
    <span class="chip" class:bad={tag === '' || (isValid && !isValid(tag))}>
      {tag === '' ? '⌀ blank' : tag}
      <button class="x" onclick={() => remove(tag)} aria-label="Remove {tag || 'blank entry'}">×</button>
    </span>
  {/each}
  <input
    list={listId}
    bind:value={draft}
    {placeholder}
    spellcheck="false"
    onkeydown={(e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        add(draft);
      } else if (e.key === 'Backspace' && !draft && values.length) {
        remove(values[values.length - 1]);
      }
    }}
    onchange={() => add(draft)}
  />
  <datalist id={listId}>
    {#each available as s (s)}<option value={s}></option>{/each}
  </datalist>
</div>

<style>
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg);
    padding: 4px 5px;
  }

  .tags input {
    flex: 1;
    min-width: 84px;
    border: none;
    background: transparent;
    padding: 2px 3px;
    font-size: 12px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 99px;
    padding: 1px 4px 1px 9px;
    font-size: 11.5px;
    font-family: var(--mono);
  }

  .chip.bad {
    border-color: var(--bad);
    color: var(--bad);
  }

  .x {
    border: none;
    background: none;
    padding: 0 3px;
    color: var(--dimmer);
    font-size: 13px;
    line-height: 1;
    border-radius: 99px;
  }

  .x:hover {
    color: var(--bad);
    background: none;
  }
</style>
