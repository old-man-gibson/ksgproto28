<script lang="ts">
  import { gs, game } from '../state.svelte';
  import { festivalHolds, festivalRun, prepLeft } from '../../core/systems/festivalRules';
  import {
    ARENA,
    DARK_ROOM_WAVES,
    PREP_TICKS,
    ROYALE_CACHES,
    ROYALE_DENS,
    ROYALE_FLOOR,
    ROYALE_SECTIONS,
    SURVIVORS,
  } from '../../core/data/festival.data';
  import { HOURS_PER_DAY, MINUTES_PER_HOUR, TICKS_PER_GAME_MINUTE } from '../../core/data/climate.data';
  import { msToTime } from '../lib/format';
  import { MS_PER_TICK } from '../../core/engine/loop';
  import { royaleMap } from '../../core/systems/royaleMap';
  import { sectionKnown } from '../../core/systems/royaleTerrain';
  import { visibleFeatures } from '../lib/royaleView';
  import { mapDataUrl, readPalette, themeStamp } from '../lib/royaleMapImage.svelte';
  import RoyaleField from '../lib/RoyaleField.svelte';
  import RoyaleMinimap from '../lib/RoyaleMinimap.svelte';

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

  // ---------- This attempt's field, as far as the hub has scouted it ----------

  /** The field the royale will open on, drawn from the attempt's seed; none on an attempt saved before the seed existed. */
  const fieldMap = $derived(run?.fieldSeed !== undefined ? royaleMap(run.fieldSeed) : undefined);
  const fieldImage = $derived.by(() => {
    themeStamp();
    return fieldMap ? mapDataUrl(fieldMap, readPalette()) : '';
  });
  /** Caches and dens of scouted sections only (the survey's flags); no viewer, so nothing shows by sight. */
  const scoutedFeatures = $derived(fieldMap ? visibleFeatures(fieldMap, undefined, (id) => sectionKnown(gs, undefined, id)) : []);
  const sectionRows = $derived(
    Object.values(ROYALE_SECTIONS).map((s) => ({
      section: s,
      scouted: sectionKnown(gs, undefined, s.id),
      caches: ROYALE_CACHES.filter((c) => c.section === s.id).length,
      dens: ROYALE_DENS.filter((d) => d.section === s.id).length,
    })),
  );
  const scoutedCount = $derived(sectionRows.filter((r) => r.scouted).length);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
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
      {#if fieldMap}
        <div class="royale-preview">
          <h4>This attempt's field</h4>
          <p class="dim small">
            The royale opens on this field. A section you scout shows its caches and dens here, and on the royale's map
            before you walk in. {scoutedCount} of {sectionRows.length} scouted.
          </p>
          <div class="royale-preview-body">
            <div class="royale-preview-map">
              <RoyaleMinimap
                map={fieldMap}
                image={fieldImage}
                features={scoutedFeatures}
                icons
                labels
                label="This attempt's field, with the caches and dens of scouted sections"
              />
            </div>
            <ul class="royale-preview-list small">
              {#each sectionRows as r (r.section.id)}
                <li class:dim={!r.scouted}>
                  {r.section.icon} <b>{r.section.name}</b>:
                  {#if !r.scouted}not scouted
                  {:else if r.caches + r.dens === 0}scouted, nothing on it
                  {:else}scouted, {[r.caches ? plural(r.caches, 'cache') : '', r.dens ? plural(r.dens, 'den') : ''].filter(Boolean).join(' and ')}
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        </div>
      {/if}
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
      🚪 The door holds {heldPieces} piece{heldPieces === 1 ? '' : 's'} of your gear{run.held.flasks ? ', your flasks and your provisions' : ''} until the attempt ends, won or lost.
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

  .royale-preview {
    margin: 10px 0;
  }

  .royale-preview h4 {
    margin-bottom: 4px;
  }

  .royale-preview-body {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
  }

  .royale-preview-map {
    flex: 1 1 320px;
    max-width: 480px;
  }

  .royale-preview-list {
    flex: 1 1 200px;
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
</style>
