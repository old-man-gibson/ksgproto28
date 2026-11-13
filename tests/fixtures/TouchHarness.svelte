<script lang="ts">
  // A bench window's description line and a control with a touch-only tap card,
  // as LocationPanel and GoButton use them (tests/touchPaths.dom.test.ts).
  import FoldedDesc from '../../src/ui/lib/FoldedDesc.svelte';
  import Tip from '../../src/ui/lib/Tip.svelte';
</script>

<div class="win-head">
  <FoldedDesc text="A long description of the bench, several lines at a phone's width." />
</div>

<Tip touchOnly>
  <button id="go" title="the route">Go</button>
  {#snippet tip()}<div class="tip-line">the route</div>{/snippet}
</Tip>
