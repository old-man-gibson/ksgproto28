<script lang="ts">
  // The Menu inside a dock-like header (a stacking context, as the phone's dock is)
  // and the welcome-back report, the way App.svelte draws them.
  import SystemMenu from '../../src/ui/SystemMenu.svelte';
  import OfflineModal from '../../src/ui/OfflineModal.svelte';
  import { shown } from './overlayState.svelte';
</script>

<header class="dock" style="position: sticky; top: 0; z-index: 6">
  <SystemMenu />
</header>

{#if shown.offline}
  <OfflineModal summary={shown.offline as never} onclose={() => (shown.offline = null)} />
{/if}
