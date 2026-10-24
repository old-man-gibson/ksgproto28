<script lang="ts">
  import { QUALITY_TIERS } from '../../core/registry';
  import type { QualityTier } from '../../core/types';

  /**
   * A grade as a letter on its tier colour (F Refuse … S Divine), so two
   * grades of one ingredient can be told apart without a tooltip or relying on
   * the border colour alone. `corner` pins it to the top-left of a cell. It is
   * decoration for the eye: the grade's name is always in the text or label
   * beside it.
   */
  let { tier, corner = false }: { tier: QualityTier; corner?: boolean } = $props();
</script>

<span
  class="grade-badge"
  class:corner
  data-tier={tier}
  style="--tier: {QUALITY_TIERS[tier].color}"
  aria-hidden="true">{tier.toUpperCase()}</span
>

<style>
  .grade-badge {
    display: inline-block;
    min-width: 12px;
    padding: 0 2px;
    font-size: 10px;
    font-weight: 700;
    line-height: 12px;
    text-align: center;
    color: var(--bg);
    background: var(--tier);
    border: 1px solid color-mix(in srgb, var(--tier) 60%, var(--bg));
    pointer-events: none;
  }

  /* Refuse's colour is near-black; dark text on it would vanish. */
  .grade-badge[data-tier='f'] {
    color: var(--text);
    border-color: var(--text-dim);
  }

  .grade-badge.corner {
    position: absolute;
    top: -1px;
    left: -1px;
    font-size: 9px;
    line-height: 11px;
    min-width: 11px;
  }
</style>
