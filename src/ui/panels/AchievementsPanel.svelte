<script lang="ts">
  import { gs, game } from '../state.svelte';
  import { ACHIEVEMENTS, TITLES } from '../../core/registry';
  import { tierNumeral } from '../../core/systems/achievements';
  import { hasTitle } from '../../core/systems/titles';
  import { describeMod, fmt } from '../lib/format';

  const defs = Object.values(ACHIEVEMENTS);
  // Secret titles stay invisible until earned; earned ones sort first.
  const titles = $derived(
    Object.values(TITLES)
      .filter((t) => hasTitle(gs, t.id) || !t.secret)
      .sort((a, b) => Number(hasTitle(gs, b.id)) - Number(hasTitle(gs, a.id))),
  );
</script>

<div class="panel">
  <h2>👑 Titles</h2>
  {#if titles.length === 0}
    <p class="dim">No titles earned yet.</p>
  {/if}
  <div class="grid">
    {#each titles as title (title.id)}
      {@const earned = hasTitle(gs, title.id)}
      {@const worn = gs.title === title.id}
      <div class="ach title-card" class:done={earned} class:worn>
        <div class="head">
          <span class="name">{earned ? title.icon : '❓'} {earned ? title.name : '???'}</span>
          {#if earned}
            <button class="small" onclick={() => game.setTitle(worn ? null : title.id)}>
              {worn ? 'Remove' : 'Wear'}
            </button>
          {/if}
        </div>
        <div class="dim small">{title.desc}</div>
        <div class="small bonuses">
          {#if title.passive?.length}
            <div class="bonus" class:earned>
              Earned: {title.passive.map((m) => describeMod(m)).join(', ')}
            </div>
          {/if}
          {#if title.equipped?.length}
            <div class="bonus" class:earned={worn}>
              Worn: {title.equipped.map((m) => describeMod(m)).join(', ')}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<div class="panel" style="margin-top: 12px">
  <h2>🏆 Achievements</h2>
  <div class="grid">
    {#each defs as def}
      {@const claimed = gs.achievements[def.id] ?? 0}
      {@const value = gs.stats[def.statKey] ?? 0}
      {@const next = def.tiers[claimed]}
      <div class="ach" class:done={claimed === def.tiers.length}>
        <div class="head">
          <span class="name">{def.icon} {def.name}</span>
          <span class="stars">
            {#each def.tiers as _, i}
              <span class:earned={i < claimed}>★</span>
            {/each}
          </span>
        </div>
        {#if next}
          <div class="dim small">{def.descTemplate.replace('{n}', fmt(next.threshold))}</div>
          <div class="bar" style="height: 8px; margin: 6px 0">
            <div
              class="fill"
              style="width: {Math.min(100, (value / next.threshold) * 100)}%; background: var(--accent)"
            ></div>
          </div>
          <div class="dim small">{fmt(value)} / {fmt(next.threshold)}</div>
        {:else}
          <div class="small" style="color: var(--accent)">Mastered!</div>
        {/if}
        <div class="small bonuses">
          {#each def.tiers as tier, i}
            <div class:earned={i < claimed} class="bonus">
              {tierNumeral(i + 1)}: {tier.bonus.map((b) => describeMod(b)).join(', ')}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 10px;
  }

  .ach {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
  }

  .ach.done {
    border-color: var(--accent);
  }

  .title-card.worn {
    background: color-mix(in srgb, var(--accent) 10%, var(--bg-raised));
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .name {
    font-weight: 600;
  }

  .stars span {
    color: var(--border);
  }

  .stars span.earned {
    color: var(--accent);
  }

  .bonuses {
    margin-top: 8px;
  }

  .bonus {
    color: var(--text-dim);
  }

  .bonus.earned {
    color: var(--xp);
  }
</style>
