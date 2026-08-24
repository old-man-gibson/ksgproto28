<script lang="ts">
  import type { FightLedger } from '../core/types';
  import { TPS } from '../core/engine/loop';
  import { fmt } from './lib/format';

  let {
    ledger,
    onclose,
    onkeep,
    kept = false,
  }: {
    ledger: FightLedger;
    onclose: () => void;
    onkeep?: () => void;
    kept?: boolean;
  } = $props();

  /** The play-by-play is opt-in: the numbers are the point, this is the detail. */
  let showTranscript = $state(false);

  /**
   * Everything on this screen is a rounded rollup. Nothing here iterates a
   * per-event list, because nothing in the ledger IS one — see FightLedger.
   */
  const took = $derived(ledger.incoming.reduce((sum, s) => sum + s.amount, 0));
  const worst = $derived(ledger.incoming[0]);
  const stopped = $derived(ledger.stopped);
  const prevented = $derived(stopped.absorbed + stopped.parried + stopped.dodged);
  const healedTotal = $derived(Object.values(ledger.healed).reduce((a, b) => a + b, 0));

  const HEAL_NAMES: Record<string, string> = {
    rest: 'Resting',
    idle: 'Natural mending',
    salve: 'Salves',
    spell: 'Restorative magic',
    lifesteal: 'Drawn from the wound',
    other: 'Other',
  };

  const title = $derived(
    ledger.outcome === 'dead'
      ? '💀 You died'
      : ledger.outcome === 'knocked_out'
        ? '💫 You were knocked out'
        : '⚔️ Fight over',
  );

  /** Share of the damage taken, for the bar behind each source row. */
  function share(amount: number): number {
    return took > 0 ? (amount / took) * 100 : 0;
  }

  function duration(ticks: number): string {
    const s = ticks / TPS;
    return s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${s.toFixed(1)}s`;
  }
</script>

<div class="overlay" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="modal panel" role="dialog" aria-label="Fight summary">
    <header>
      <h2>{title}</h2>
      <p class="dim">
        {#each ledger.foes as f, i}{i > 0 ? ', ' : ''}{f.icon}
          {f.name}{f.count > 1 ? ` ×${f.count}` : ''} (Lv {f.level}){/each}{#if ledger.foes.length === 0}No
          encounter — this happened to you on your own time.{/if}
        · {duration(ledger.ticks)}
      </p>
    </header>

    <div class="cols">
      <!-- Left: what you did about it. -->
      <section>
        <h3>What you did</h3>
        <ul class="stats">
          <li><span>Damage dealt</span><b>{fmt(Math.round(ledger.outgoing.damage))}</b></li>
          <li><span>Blows landed</span><b>{fmt(ledger.outgoing.hits)}</b></li>
          <li><span>Enemies felled</span><b>{fmt(ledger.outgoing.kills)}</b></li>
        </ul>

        <h4>Damage you turned away — {fmt(Math.round(prevented))}</h4>
        <ul class="stats">
          <li>
            <span>🛡️ Absorbed <em>armour, bracing, resistance</em></span>
            <b>{fmt(Math.round(stopped.absorbed))}</b>
          </li>
          <li>
            <span>🤺 Parried <em>{stopped.parries} blows turned aside</em></span>
            <b>{fmt(Math.round(stopped.parried))}</b>
          </li>
          <li>
            <span>💨 Dodged <em>{stopped.dodges} never arrived</em></span>
            <b>{fmt(Math.round(stopped.dodged))}</b>
          </li>
          {#if stopped.riposted > 0}
            <li><span>↩️ Cut back for</span><b>{fmt(Math.round(stopped.riposted))}</b></li>
          {/if}
        </ul>

        <h4>Health you got back — {fmt(Math.round(healedTotal))}</h4>
        <ul class="stats">
          {#each Object.entries(ledger.healed) as [kind, amount]}
            <li><span>{HEAL_NAMES[kind] ?? kind}</span><b>{fmt(Math.round(amount))}</b></li>
          {/each}
          {#if healedTotal === 0}
            <li class="dim"><span>Nothing mended you.</span><b></b></li>
          {/if}
          {#if ledger.healRefused > 0}
            <!-- The reason a salve did nothing is worth as much as the salve. -->
            <li class="bad">
              <span>🚫 Refused by a condition</span>
              <b>{fmt(Math.round(ledger.healRefused))}</b>
            </li>
          {/if}
        </ul>
      </section>

      <!-- Right: what did it to you, worst first. -->
      <section>
        <h3>What did you in</h3>
        {#if worst}
          <p class="lead">
            Most of it was <b>{worst.icon} {worst.label}</b> — {fmt(Math.round(worst.amount))} of
            {fmt(Math.round(took))} ({Math.round(share(worst.amount))}%).
          </p>
        {/if}
        <ul class="sources">
          {#each ledger.incoming as s}
            <li>
              <div class="bar" style="width: {share(s.amount)}%"></div>
              <span class="who">{s.icon} {s.label}</span>
              <span class="amt">{fmt(Math.round(s.amount))}</span>
              <span class="hits dim">×{fmt(s.hits)}</span>
            </li>
          {/each}
          {#if ledger.incoming.length === 0}
            <li class="dim"><span class="who">Nothing laid a finger on you.</span></li>
          {/if}
        </ul>

        <h4>Still on you</h4>
        <div class="afflictions">
          {#each ledger.afflictions as a}
            <span class="pill" title="Intensity {a.intensity.toFixed(2)}">
              {a.icon} {a.name}
            </span>
          {/each}
          {#if ledger.afflictions.length === 0}
            <span class="dim">Nothing lingering.</span>
          {/if}
        </div>

        {#if ledger.transcript.length > 0}
          <h4>
            <button class="linky" onclick={() => (showTranscript = !showTranscript)}>
              {showTranscript ? '▾' : '▸'} How it went — last {ledger.transcript.length} lines
            </button>
          </h4>
          {#if showTranscript}
            <ol class="transcript small">
              {#each ledger.transcript as line}
                <li>{line.text}</li>
              {/each}
            </ol>
          {/if}
        {/if}
      </section>
    </div>

    <footer>
      {#if onkeep}
        <button class:on={kept} onclick={onkeep}>
          {kept ? '⭐ Kept in the notebook' : '☆ Keep this fight'}
        </button>
      {/if}
      <button onclick={onclose}>Continue</button>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 72%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
  }

  /*
   * Fixed size, deliberately. The window must not grow a row taller because a
   * second condition happened to be on you — reading it should feel the same
   * every time, so the columns scroll inside a frame that never moves.
   */
  .modal {
    width: min(1040px, 92vw);
    height: min(720px, 88vh);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  header h2 {
    margin: 0 0 4px;
  }

  header p {
    margin: 0;
    font-size: 13px;
  }

  .cols {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    min-height: 0;
  }

  .cols section {
    overflow-y: auto;
    min-height: 0;
    padding-right: 6px;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 14px;
    color: var(--accent);
  }

  h4 {
    margin: 14px 0 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
  }

  .lead {
    margin: 0 0 10px;
    font-size: 13px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .stats li {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 3px 0;
    font-size: 13px;
    border-bottom: 1px solid var(--border);
  }

  .stats li em {
    font-style: normal;
    color: var(--text-dim);
    font-size: 11px;
  }

  .stats li.bad b {
    color: var(--danger);
  }

  .sources li {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    font-size: 13px;
    border-bottom: 1px solid var(--border);
    isolation: isolate;
  }

  /* The bar sits behind the row rather than beside it, so the numbers stay
     aligned however lopsided the split turns out to be. */
  .sources .bar {
    position: absolute;
    inset: 0 auto 0 0;
    background: color-mix(in srgb, var(--danger) 26%, transparent);
    z-index: -1;
    border-radius: 3px;
  }

  .sources .who {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sources .amt {
    font-weight: 600;
  }

  .sources .hits {
    min-width: 38px;
    text-align: right;
    font-size: 11px;
  }

  .afflictions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pill {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 2px 9px;
    font-size: 12px;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  footer button.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  .linky {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }

  .transcript {
    margin: 0;
    padding-left: 22px;
    line-height: 1.6;
    color: var(--text-dim);
  }
</style>
