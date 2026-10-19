<script lang="ts">
  import { gs, game, view } from './state.svelte';
  import { MONSTERS } from '../core/registry';
  import { SIZE_LADDER, type SpotDef } from '../core/types';
  import { monsterSizeRank } from '../core/systems/bestiary';
  import { playerSizeRank } from '../core/systems/mutagens';
  import { TPS } from '../core/engine/loop';
  import { msToTime } from './lib/format';

  /**
   * The keeper's dare (systems/training.ts). Save state, not UI state: the
   * question is a stat, so a reload brings it back. No backdrop click and no
   * Escape — play is held until one of the two buttons is pressed, and the
   * held time is banked as bonus time meanwhile.
   */
  let { spot }: { spot: SpotDef } = $props();

  const dare = $derived(spot.dare!);
  const def = $derived(MONSTERS[dare.monsterId]);
  const steps = $derived(monsterSizeRank(dare.monsterId) - playerSizeRank(gs));
  const size = $derived(SIZE_LADDER[monsterSizeRank(dare.monsterId)] ?? 'medium');
  const sizeLine = $derived(
    steps > 0
      ? `${size}, ${steps} size step${steps === 1 ? '' : 's'} above you`
      : steps < 0
        ? `${size}, ${-steps} size step${steps === -1 ? '' : 's'} below you`
        : `${size}, your size`,
  );
  /** Resistances as the bestiary would read them: what it shrugs, what it takes extra. */
  const resists = $derived.by(() => {
    const entries = Object.entries(def?.resistances ?? {}).filter(([, v]) => v);
    const less = entries.filter(([, v]) => v! > 0).map(([t, v]) => `${t} ${Math.round(v! * 100)}%`);
    const more = entries.filter(([, v]) => v! < 0).map(([t, v]) => `${t} +${Math.round(-v! * 100)}%`);
    return { less, more };
  });
  const banked = $derived(msToTime((gs.bonusTime.banked / TPS) * 1000));
</script>

<div class="overlay" role="presentation">
  <div class="modal panel" role="dialog" aria-modal="true" aria-labelledby="dare-title">
    <h2 id="dare-title">⏸️ {spot.icon} {spot.name}: the keeper stops the cages</h2>
    <p class="line">“{dare.desc}”</p>

    <div class="foe">
      <div><b>{def?.icon} {def?.name}</b> · Lv {dare.level} · {sizeLine}</div>
      {#if resists.less.length}<div class="small">Takes less: {resists.less.join(', ')}</div>{/if}
      {#if resists.more.length}<div class="small">Takes more: {resists.more.join(', ')}</div>{/if}
      <div class="small">One fight, alone. It cannot be fled, and the keeper does not patch you up until it ends.</div>
    </div>

    <p class="small dim">
      Your HP: {Math.floor(gs.resources.hp)} / {Math.floor(view.stats.maxHp)}. Play is held until you
      answer; the time is banked as bonus time (⏩ {banked}). Flee and the cages carry on; the keeper
      asks again after {dare.every} more wins.
    </p>

    <div class="row">
      <button class="fight" onclick={() => game.answerDare(true)}>⚔️ Fight the {def?.name}</button>
      <button onclick={() => game.answerDare(false)}>🏃 Flee: back to normal cages</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 70%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 30;
    padding: 16px;
  }
  .modal {
    width: 560px;
    max-width: 100%;
    max-height: 88vh;
    overflow: auto;
  }
  .line {
    font-style: italic;
    margin: 6px 0 12px;
  }
  .foe {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 8px;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .fight {
    border-color: var(--danger);
  }
</style>
