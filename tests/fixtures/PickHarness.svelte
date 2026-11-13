<script lang="ts">
  // A real bench in a real Modal (the way LocationPanel opens one) and a real
  // screen-body panel with a picker (the chromosome's socket picker), each behind
  // its own flag, plus a second Modal (holding a tag picker, the divine shelf's
  // widget) and the welcome-back report, so a test can open them in any order.
  import Modal from '../../src/ui/lib/Modal.svelte';
  import TagPicker from '../../src/ui/lib/TagPicker.svelte';
  import OfflineModal from '../../src/ui/OfflineModal.svelte';
  import BenchPanel from '../../src/ui/panels/BenchPanel.svelte';
  import ChromosomePanel from '../../src/ui/panels/ChromosomePanel.svelte';
  import { shown } from './overlayState.svelte';
</script>

{#if shown.page}
  <ChromosomePanel />
{/if}

{#if shown.bench}
  <Modal wide onclose={() => (shown.bench = false)}>
    {#snippet title()}<h3>Bench</h3>{/snippet}
    <BenchPanel disciplineId="runecarving" large />
  </Modal>
{/if}

{#if shown.menu}
  <Modal onclose={() => (shown.menu = false)}>
    {#snippet title()}<h3>Menu</h3>{/snippet}
    <p>window body</p>
    <TagPicker label="Tag" options={[{ id: 'a', name: 'A', icon: 'x' }]} selected={[]} onchange={() => {}} />
  </Modal>
{/if}

{#if shown.offline}
  <OfflineModal summary={shown.offline as never} onclose={() => (shown.offline = null)} />
{/if}
