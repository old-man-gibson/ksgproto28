<script lang="ts">
  import { gs, game } from '../state.svelte';
  import { festivalHolds, festivalRun, prepLeft } from '../../core/systems/festivalRules';
  import { ARENA, DARK_ROOM_WAVES, PREP_TICKS, ROYALE_FLOOR, SURVIVORS } from '../../core/data/festival.data';
  import { HOURS_PER_DAY, MINUTES_PER_HOUR, TICKS_PER_GAME_MINUTE } from '../../core/data/climate.data';
  import { msToTime } from '../lib/format';
  import { MS_PER_TICK } from '../../core/engine/loop';
  import RoyaleField from '../lib/RoyaleField.svelte';

  /**
   * The festival attempt in progress, on floors 15–16 (systems/festival.ts):
   * where the attempt stands, the festival's own clock, the gear the door
   * holds, and what leaving costs. Shown only while an attempt holds the
   * player. The climb into the royale is the ladder's, offered here too.
   */
  const run = $derived(festivalHolds(gs) ? festivalRun(gs) : undefined);

  const TICKS_PER_DAY = TICKS_PER_GAME_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;
  const PREP_DAYS = PREP_TICKS / TICKS_PER_DAY;

  const day = $derived(run ? Math.min(PREP_DAYS, Math.floor(run.clock / TICKS_PER_DAY) + 1) : 0);
  const hour = $derived(run ? Math.floor((run.clock % TICKS_PER_DAY) / (TICKS_PER_GAME_MINUTE * MINUTES_PER_HOUR)) : 0);
  const heldPieces = $derived(
    run
      ? run.held.inventory.length +
          Object.values(run.held.equipment).filter(Boolean).length +
          (run.held.sheathed ? 1 : 0)
      : 0,
  );
  const wavesLeft = $derived(run ? Math.max(0, DARK_ROOM_WAVES.length - run.wave) : 0);
  const standing = $derived(run ? DARK_ROOM_WAVES.slice(run.wave).flat().length : 0);
</script>

{#if run}
  <div class="panel festival" style="margin-top: 12px">
    <h3>🎪 The Vermin Festival</h3>
    {#if run.phase === 'dark'}
      <p>
        <b>The dark room.</b> {standing} still standing, in {wavesLeft} wave{wavesLeft === 1 ? '' : 's'}; the last one
        fights alone. The door opens when you are the only one left.
      </p>
    {:else if run.phase === 'prep'}
      <p>
        <b>Festival day {day} of {PREP_DAYS}</b>, {String(hour).padStart(2, '0')}:00. The royale on floor 16 opens on its
        own in {msToTime(prepLeft(run) * MS_PER_TICK)} of play; the other {SURVIVORS} prepare until then.
      </p>
      <div class="enter">
        <button onclick={() => game.climbTo(ROYALE_FLOOR)} disabled={gs.recovering || !!gs.travel || !!gs.combat}>
          🏟️ Enter the royale now
        </button>
        <span class="dim small">Jumps the festival clock to day {PREP_DAYS}. The survivors finish preparing either way.</span>
      </div>
    {:else}
      <p>
        <b>The royale.</b> The survivors fight each other and come at you one to three at a time; the last one
        standing is fought alone, and beating it wins the festival.
      </p>
      {#if gs.spot === ARENA}
        <RoyaleField />
      {:else}
        <p class="dim small">On the way up to the field: {SURVIVORS} survivors wait there.</p>
      {/if}
    {/if}
    <p class="dim small">
      🚪 The door holds {heldPieces} piece{heldPieces === 1 ? '' : 's'} of your gear, your flasks and your provisions until the attempt ends, won or lost.
      🪜 Leaving by the ladder before the royale ends forfeits it: you land outside the tower and floors 15–16 shut for
      three days or until the next prestige. A knockout does the same. ⏸️ The festival's clock runs only while the game
      does; time away goes to banked bonus time.
    </p>
  </div>
{/if}

<style>
  .festival p {
    margin: 6px 0;
  }

  .enter {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin: 8px 0;
  }
</style>
