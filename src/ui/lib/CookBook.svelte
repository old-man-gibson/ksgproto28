<script lang="ts">
  import { gs } from '../state.svelte';
  import { QUALITY_ORDER, QUALITY_TIERS } from '../../core/registry';
  import { bookSections, bookSummary, squaresLabel, tierColour } from './cookBook';
  import Modal from './Modal.svelte';

  /**
   * Every dish a cooking bench makes, one list: the grades you have made it at,
   * how many you have cooked, its cook time once learned, its Signature once
   * earned. The rows and their words are `lib/cookBook.ts`, from the core's
   * `cookbook()`. A dish never made whose recipe card is unread is a blank row,
   * so the Book teaches no recipe the card has not.
   */
  let { onclose }: { onclose: () => void } = $props();

  const sections = $derived(bookSections(gs));
  const summary = $derived(bookSummary(gs));
</script>

<Modal wide {onclose}>
  {#snippet title()}
    <div class="cb-title">📒 Cook's Book</div>
    <div class="small dim">{summary.text}</div>
  {/snippet}

  <p class="small dim cb-legend">
    Filled square: made at that grade. Dashed square: the next grade above your best. Counts reset
    when you prestige; the Cook's Notes boon keeps part of the Book.
  </p>

  <div class="cb-scroll">
    <table class="cb-table">
      <thead>
        <tr>
          <th scope="col">Dish</th>
          <th scope="col">
            <span class="cb-grades">
              {#each QUALITY_ORDER as tier (tier)}
                <span class="cb-letter" style="--c: {tierColour(tier)}" title={QUALITY_TIERS[tier].name}>{tier.toUpperCase()}</span>
              {/each}
            </span>
          </th>
          <th scope="col" class="cb-num">Made</th>
          <th scope="col">Cook time</th>
          <th scope="col">Signature</th>
        </tr>
      </thead>
      <tbody>
        {#each sections as section (section.benchId)}
          <tr class="cb-bench">
            <th scope="colgroup" colspan="5">{section.label}</th>
          </tr>
          {#each section.rows as row (row.key)}
            <tr class:cb-blank={row.blank}>
              <td class="cb-name">
                {#if row.blank}
                  <i class="cb-sil" role="img" aria-label="Not yet made"></i>
                {:else}
                  {row.icon} {row.name}
                {/if}
              </td>
              <td title={squaresLabel(row.squares)}>
                <span class="cb-grades" role="img" aria-label={squaresLabel(row.squares)}>
                  {#each row.squares as sq (sq.tier)}
                    <i class="cb-square cb-{sq.state}" style="--c: {tierColour(sq.tier)}"></i>
                  {/each}
                </span>
              </td>
              <td class="cb-num" class:dim={row.made === 0}>{row.made}</td>
              <td class:dim={row.cookTimeDim}>{row.cookTime}</td>
              <td class:dim={row.signatureDim}>{row.signature}</td>
            </tr>
          {/each}
        {/each}
      </tbody>
    </table>
  </div>
</Modal>

<style>
  .cb-title {
    font-weight: 600;
  }

  .cb-legend {
    margin: 0 0 8px;
  }

  .cb-scroll {
    overflow-x: auto;
  }

  .cb-table {
    width: 100%;
    min-width: 560px;
    border-collapse: collapse;
    font-size: 14px;
  }

  .cb-table th,
  .cb-table td {
    padding: 4px 12px 4px 0;
    text-align: left;
    vertical-align: middle;
    white-space: nowrap;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  }

  .cb-table thead th {
    font-weight: 400;
    font-size: 12px;
    color: var(--text-dim);
  }

  .cb-table .cb-num {
    text-align: right;
    padding-right: 16px;
    font-variant-numeric: tabular-nums;
  }

  /* A bench's name above its dishes: a label for the group, not a title. */
  .cb-bench th {
    padding-top: 14px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-dim);
    border-bottom-color: var(--border);
  }

  /* Seven grades, F to S: the header's letters and each row's squares share the grid. */
  .cb-grades {
    display: inline-grid;
    grid-template-columns: repeat(7, 14px);
    gap: 3px;
    vertical-align: middle;
  }

  .cb-letter {
    font-size: 11px;
    font-weight: 700;
    line-height: 14px;
    text-align: center;
    color: var(--c);
  }

  .cb-square {
    display: block;
    width: 14px;
    height: 14px;
    box-sizing: border-box;
    border: 1px solid var(--c);
  }

  .cb-made {
    background: var(--c);
  }

  .cb-next {
    border-style: dashed;
  }

  .cb-none {
    border-color: var(--border);
  }

  /* A dish the player has not learned of: where its name would be, a hatched bar. */
  .cb-sil {
    display: inline-block;
    width: 120px;
    height: 10px;
    vertical-align: middle;
    border: 1px dashed var(--border);
    background: repeating-linear-gradient(135deg, transparent 0 3px, var(--bg-raised) 3px 6px);
  }
</style>
