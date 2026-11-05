<script lang="ts">
  import { save, exportSave, importSave, hardReset } from './state.svelte';
  import { chooseTheme, loadTheme, THEMES, THEME_NAMES, type Theme } from './lib/theme';
  import Modal from './lib/Modal.svelte';
  import ArtPackControl from './ArtPackControl.svelte';

  /**
   * The Menu button and its window: the file actions, the art pack, the display
   * theme and the keyboard keys, one fact line each. App.svelte hides the button
   * on floor 0 (a new save offers Import and Import art pack on the tutorial
   * card instead).
   */
  let open = $state(false);
  let savedAt = $state<string | null>(null);
  let theme = $state(loadTheme());
  // Outside the window on purpose: the browser reports the chosen file after
  // the picker closes, and the input must still exist then. The art pack's
  // input lives in ArtPackControl, inside the window: the window stays open
  // through an art pack import.
  let fileInput: HTMLInputElement;

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

<button onclick={() => (open = true)} title="Save, export, import, reset, art pack, theme and keys">Menu</button>

<input
  type="file"
  accept="application/json"
  bind:this={fileInput}
  onchange={onImportChange}
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
    <ArtPackControl />
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

  .sysmenu-keys {
    margin: 14px 0 4px;
  }

  .sysmenu-key {
    padding: 2px 0;
  }
</style>
