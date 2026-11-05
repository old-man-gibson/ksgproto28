<script lang="ts">
  import { save, exportSave, importSave, hardReset } from './state.svelte';
  import { chooseTheme, loadTheme, THEMES, THEME_NAMES, type Theme } from './lib/theme';
  import Modal from './lib/Modal.svelte';
  import { artPack } from './lib/artPack/artPack.svelte';
  import { describePack } from './lib/artPack/format';

  /**
   * The Menu button and its window: the file actions, the display theme and the
   * keyboard keys, one fact line each. App.svelte hides the button on floor 0
   * (a new save offers Import on the tutorial card instead).
   */
  let open = $state(false);
  let savedAt = $state<string | null>(null);
  let theme = $state(loadTheme());
  // Outside the window on purpose: the browser reports the chosen file after
  // the picker closes, and the input must still exist then.
  let fileInput: HTMLInputElement;
  let artInput: HTMLInputElement;

  // The art pack block (docs/ART_PACK.md). One status line, always present, so
  // the block's size does not depend on what the line says. `artNote` holds the
  // outcome of the last import or removal until the window is opened again.
  let artNote = $state<string | null>(null);
  let artBusy = $state(false);
  const artStatus = $derived(artNote ?? (artPack.loaded ? describePack(artPack.manifest) : ''));

  function onOpen() {
    if (!artBusy) artNote = null;
    open = true;
  }

  async function onArtChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    artBusy = true;
    artNote = 'Art pack: importing.';
    const result = await artPack.importFile(file);
    artNote = result.ok
      ? null
      : result.reason === 'not-a-pack'
        ? 'Art pack: not an art pack zip.'
        : 'Art pack: storage failed, old pack kept.';
    artBusy = false;
  }

  async function onArtRemove() {
    artBusy = true;
    artNote = (await artPack.remove()) ? null : 'Art pack: storage failed, pack kept.';
    artBusy = false;
  }

  function onSave() {
    save();
    savedAt = new Date().toLocaleTimeString();
  }

  function onImportChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      importSave(file);
      open = false;
    }
    input.value = '';
  }

  function onReset() {
    if (hardReset()) open = false;
  }

  function onTheme(ev: Event) {
    theme = (ev.currentTarget as HTMLSelectElement).value as Theme;
    chooseTheme(theme);
  }

  const KEYS = [
    'Space or P: pauses or resumes.',
    'Right: advances 1 tick (100 ms). Pauses the game.',
    'Shift+Right: advances 1 second. Pauses the game.',
    'N: advances to the next fight event. Pauses the game.',
  ];
</script>

<button onclick={onOpen} title="Save, export, import, reset, art pack, theme and keys">Menu</button>

<input
  type="file"
  accept="application/json"
  bind:this={fileInput}
  onchange={onImportChange}
  style="display: none"
/>
<input
  type="file"
  accept=".zip,application/zip"
  bind:this={artInput}
  onchange={onArtChange}
  style="display: none"
/>

{#if open}
  <Modal onclose={() => (open = false)}>
    {#snippet title()}<h3 class="sysmenu-title">Menu</h3>{/snippet}

    <div class="sysmenu-row">
      <span>
        Save: writes the game to this browser. Autosave runs every 30 s.
        {#if savedAt}<span class="dim">Saved at {savedAt}.</span>{/if}
      </span>
      <button onclick={onSave}>Save</button>
    </div>
    <div class="sysmenu-row">
      <span>Export: downloads the save as a JSON file.</span>
      <button onclick={exportSave}>Export</button>
    </div>
    <div class="sysmenu-row">
      <span>Import: replaces the current game with a save file.</span>
      <button onclick={() => fileInput.click()}>Import</button>
    </div>
    <div class="sysmenu-row">
      <span>Reset: deletes the save and starts a new game. Asks first.</span>
      <button class="sysmenu-danger" onclick={onReset}>Reset</button>
    </div>
    <div class="sysmenu-row">
      <span>
        Import art pack: reads a zip made by <code>npm run art-pack</code> and keeps it in this browser,
        apart from the save. The game uses it for art this build lacks.
      </span>
      <button onclick={() => artInput.click()} disabled={artBusy}>Import art pack</button>
    </div>
    <div class="sysmenu-row">
      <span>Remove art pack: deletes the stored pack.</span>
      <button onclick={onArtRemove} disabled={artBusy || !artPack.manifest}>Remove art pack</button>
    </div>
    <div class="sysmenu-status" role="status">{#if artStatus}{artStatus}{:else}&nbsp;{/if}</div>
    <div class="sysmenu-row">
      <span>Theme: the colours and fonts of the game. Kept in this browser, not in the save.</span>
      <select aria-label="Theme" value={theme} onchange={onTheme}>
        {#each THEMES as id (id)}
          <option value={id}>{THEME_NAMES[id]}</option>
        {/each}
      </select>
    </div>

    <h4 class="sysmenu-keys">Keys</h4>
    {#each KEYS as line (line)}
      <div class="sysmenu-key">{line}</div>
    {/each}
  </Modal>
{/if}

<style>
  .sysmenu-title {
    margin: 0;
  }

  .sysmenu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }

  .sysmenu-row button,
  .sysmenu-row select {
    flex: none;
    min-width: 78px;
  }

  .sysmenu-row button.sysmenu-danger {
    border-color: color-mix(in srgb, var(--danger) 50%, var(--border));
    color: var(--danger);
  }

  /* One line, reserved whether it holds a status, a result or nothing. */
  .sysmenu-status {
    padding: 6px 0;
    min-height: 1.4em;
    border-bottom: 1px solid var(--border);
    overflow-wrap: anywhere;
  }

  .sysmenu-keys {
    margin: 14px 0 4px;
  }

  .sysmenu-key {
    padding: 2px 0;
  }
</style>
