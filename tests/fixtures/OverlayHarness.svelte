<script lang="ts">
  // The real report, fight summary, Modal, tag picker, log drawer and tip,
  // each in its own {#if} as App.svelte and SystemMenu.svelte wire them, so a
  // test can open them in any order. Only the hold-play window is a stand-in.
  import OfflineModal from '../../src/ui/OfflineModal.svelte';
  import DefeatModal from '../../src/ui/DefeatModal.svelte';
  import LogDrawer from '../../src/ui/LogDrawer.svelte';
  import Modal from '../../src/ui/lib/Modal.svelte';
  import TagPicker from '../../src/ui/lib/TagPicker.svelte';
  import Tip from '../../src/ui/lib/Tip.svelte';
  import HoldWindow from './HoldWindow.svelte';
  import { shown } from './overlayState.svelte';
</script>

{#snippet card()}<b>card text</b>{/snippet}
<Tip tip={card}><span id="tip-target">target</span></Tip>

{#if shown.picker}
  <TagPicker label="Tag" options={[{ id: 'a', name: 'A', icon: 'x' }]} selected={[]} onchange={() => {}} />
{/if}

{#if shown.drawer}
  <LogDrawer onclose={() => (shown.drawer = false)} />
{/if}

{#if shown.menu}
  <Modal onclose={() => (shown.menu = false)}>
    {#snippet title()}<h3>Menu</h3>{/snippet}
    <p>window body</p>
  </Modal>
{/if}

{#if shown.cook}
  <Modal onclose={() => (shown.cook = false)}>
    {#snippet title()}<h3>Cook's Book</h3>{/snippet}
    <p>window body</p>
  </Modal>
{/if}

{#if shown.offline}
  <OfflineModal summary={shown.offline as never} onclose={() => (shown.offline = null)} />
{/if}

{#if shown.hold}
  <HoldWindow />
{/if}

{#if shown.defeat}
  <DefeatModal ledger={shown.defeat as never} kept={false} onkeep={() => {}} onclose={() => (shown.defeat = null)} />
{/if}
