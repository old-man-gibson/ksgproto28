<script lang="ts">
  // Stands in for the dare, evolve and prestige windows, which join the overlay
  // stack the same way (tests/overlayLayers.test.ts checks that they do).
  import { onMount } from 'svelte';
  import { LAYER, pushOverlay } from '../../src/ui/lib/overlays';

  onMount(() => pushOverlay(LAYER.hold, null));
</script>

<div role="dialog" aria-modal="true"><h2>Hold</h2></div>
