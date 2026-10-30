<script lang="ts">
  import { gs, game } from '../state.svelte';
  import { ITEMS, TECHNIQUES } from '../../core/registry';
  import { FESTIVAL_TOKEN, TOKEN_BONUS, TOKEN_REGALIA } from '../../core/data/festival.data';
  import { festivalBonusStacks } from '../../core/systems/legacy';
  import { festivalHolds } from '../../core/systems/festivalRules';
  import { tokenChoiceOpen, tokenTechniques } from '../../core/systems/stash';
  import { itemDefOf } from '../../core/systems/assembly';
  import { describeMod } from '../lib/format';

  /**
   * The stronghold stash (systems/stash.ts): festival tokens and keep-marked
   * items, the one store a prestige keeps. Shown once it holds anything, or
   * once a token has bought something: before the hundredth festival win of
   * a run there is nothing to show and nothing hints at it.
   */
  const stash = $derived(gs.prestige.stash);
  const stacks = $derived(festivalBonusStacks(gs));
  const techniques = $derived(gs.prestige.festivalTechniques ?? []);
  const shown = $derived(!!stash?.tokens.length || !!stash?.items.length || stacks > 0 || techniques.length > 0);
  const regalia = ITEMS[TOKEN_REGALIA];
  const bonusText = TOKEN_BONUS.mods.map((m) => describeMod(m)).join(', ');
  const inFestival = $derived(festivalHolds(gs));
</script>

{#if shown}
  <div class="panel stash">
    <h2>🏰 Stronghold stash</h2>
    <p class="dim small">
      Kept through every prestige. It holds festival tokens and keep-marked items only; a kept item taken out comes back
      here at the next prestige, wherever it is.
    </p>
    {#if stacks > 0 || techniques.length > 0}
      <p class="small">
        {#if stacks > 0}Festival bonus: {stacks} of {TOKEN_BONUS.cap} stacks ({bonusText} each).{/if}
        {#if techniques.length > 0}
          Festival techniques: {techniques.map((id) => `${TECHNIQUES[id]?.icon ?? ''} ${TECHNIQUES[id]?.name ?? id}`).join(', ')}.
        {/if}
      </p>
    {/if}

    {#each stash?.tokens ?? [] as token, i (i)}
      {@const offers = tokenTechniques(gs, token)}
      <div class="token">
        <b>{FESTIVAL_TOKEN.icon} {FESTIVAL_TOKEN.name}</b>
        <span class="dim small">Spend it on one of three.</span>
        <div class="choice">
          <button
            class="small"
            disabled={!tokenChoiceOpen(gs, token, { kind: 'bonus' })}
            onclick={() => game.spendFestivalToken(i, { kind: 'bonus' })}
          >
            Permanent bonus
          </button>
          <span class="small">{bonusText}, stacking to {TOKEN_BONUS.cap} ({stacks} held). Kept through prestige.</span>
        </div>
        <div class="choice">
          {#each offers as id (id)}
            <button class="small" onclick={() => game.spendFestivalToken(i, { kind: 'technique', id })}>
              {TECHNIQUES[id]?.icon} {TECHNIQUES[id]?.name}
            </button>
          {/each}
          <span class="small">
            {offers.length ? 'One technique, learned in full and known from the start of every later run.' : 'Every festival technique is already yours.'}
          </span>
        </div>
        {#if regalia}
          <div class="choice">
            <button class="small" onclick={() => game.spendFestivalToken(i, { kind: 'regalia' })}>
              {regalia.icon} {regalia.name}
            </button>
            <span class="small">{regalia.mods.map((m) => describeMod(m)).join(', ')}. Kept in this stash.</span>
          </div>
        {/if}
      </div>
    {/each}

    {#each stash?.items ?? [] as item, i (i)}
      {@const def = itemDefOf(item)}
      <div class="kept">
        <span><b>{def?.icon} {def?.name ?? item.defId}</b> <span class="dim small">{def?.desc ?? ''}</span></span>
        <button
          class="small"
          disabled={inFestival}
          title={inFestival ? 'Not inside a festival attempt: the door holds everything.' : undefined}
          onclick={() => game.takeFromStash(i)}
        >
          Take out
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .stash .token {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    margin: 8px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .choice {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .kept {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 6px 0;
  }
</style>
