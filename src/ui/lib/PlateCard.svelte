<script lang="ts">
  import { QUALITY_TIERS } from '../../core/registry';
  import { tierColour, type Plate } from './cookBook';
  import GradeBadge from './GradeBadge.svelte';

  /**
   * What came off the bench, shown under the dish preview when a cook finishes:
   * the grade it rolled, how many of the dish the Book now counts and the best
   * grade made, and what this cook changed (a new best, the cook time shown, a
   * Signature dish) with the range it could have rolled. Everything arrives in
   * `plate` (lib/cookBook.ts `plateFor`); this only draws it.
   */
  let { plate }: { plate: Plate } = $props();

  /** "made 26 · best Fine": the Book's count of the dish and the best grade made. */
  const made = $derived(`made ${plate.made}${plate.best ? ` · best ${QUALITY_TIERS[plate.best].name}` : ''}`);
  /** What this cook changed, said in the accent colour. */
  const news = $derived(
    [
      plate.news.newBest && 'new best',
      plate.news.timeShown && "cook time shown in the Cook's Book",
      plate.signature && 'Signature dish',
    ].filter((n): n is string => !!n),
  );
  /** The plain facts, dim. */
  const facts = $derived(
    [plate.range && `could have been ${plate.range}`, plate.cooks > 1 && `${plate.cooks} cooked with this layout`].filter(
      (n): n is string => !!n,
    ),
  );
</script>

<div class="plate-card" style="--tint: {tierColour(plate.quality)}" role="status">
  <span class="pc-dish" aria-hidden="true">{plate.icon}</span>
  <div class="pc-main">
    <div class="pc-title">
      <GradeBadge tier={plate.quality} />
      <span class="pc-stamp">{QUALITY_TIERS[plate.quality].name}</span>
      <span class="pc-name">{plate.name}</span>
    </div>
    {#if news.length || facts.length}
      <div class="pc-notes">
        {#each news as note (note)}<span class="pc-news">{note}</span>{/each}
        {#each facts as note (note)}<span>{note}</span>{/each}
      </div>
    {/if}
  </div>
  <div class="pc-made">{made}</div>
</div>

<style>
  .plate-card {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    padding: 6px 10px;
    border: 1px solid var(--tint);
    border-radius: 6px;
    background: color-mix(in srgb, var(--tint) 12%, var(--bg-raised));
  }

  .pc-dish {
    flex: none;
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    font-size: 20px;
    line-height: 1;
    border: 1px solid var(--tint);
    background: var(--bg);
  }

  /* A phone-width bench has no room for this beside the count, which then drops to its own line. */
  .pc-main {
    flex: 1 1 200px;
    min-width: 0;
  }

  .pc-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 8px;
  }

  .pc-stamp {
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--tint);
  }

  .pc-name {
    font-weight: 600;
  }

  /* Short notes, each its own run, so a narrow bench wraps between them. */
  .pc-notes {
    display: flex;
    flex-wrap: wrap;
    gap: 0 14px;
    font-size: 12.5px;
    color: var(--text-dim);
  }

  .pc-news {
    color: var(--accent);
  }

  .pc-made {
    flex: none;
    margin-left: auto;
    text-align: right;
    font-size: 13px;
  }
</style>
