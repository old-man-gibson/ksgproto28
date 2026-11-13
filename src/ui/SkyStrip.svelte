<script lang="ts">
  import { gs } from './state.svelte';
  import { clockOf, MOON_ICONS } from '../core/systems/clock';
  import { CHRONOSENSE_ID, describeMoons, describeTimeSense } from '../core/systems/chronosense';
  import { WEATHER_ICONS, worldSeedOf } from '../core/systems/weather';
  import { forecastFor, PROGNOSIS_TOOLTIP_AT, WEATHERSENSE_ID } from '../core/systems/weathersense';
  import { darknessFactor } from '../core/systems/exposure';
  import { SKILLS } from '../core/registry';
  import { headerSky, shortClock } from './lib/shell';
  import { darkText } from './lib/sky';
  import Tip from './lib/Tip.svelte';

  /**
   * The phone dock's sky line: the clock chip, the moons, the weather and the
   * dark, which the desktop header shows beside the job strip. Each reads the
   * same data as the header's chip and keeps its text on a tap (Tip.svelte)
   * where the header keeps it on a hover. Absent while none of the four has
   * anything to say. The dark's slot is laid out whenever the line is, so
   * nightfall moves nothing; it exists only where the sky is open, and so does
   * the weather chip.
   */
  const senseLevel = $derived(gs.skills[CHRONOSENSE_ID]?.level ?? 0);
  const clock = $derived(clockOf(gs.totalTicks));
  const timeSense = $derived(describeTimeSense(clock, senseLevel));
  const moonLines = $derived(describeMoons(clock, senseLevel));
  const dark = $derived(darknessFactor(gs));
  const sky = $derived(headerSky(gs));
  const wxRegion = $derived(sky?.region ?? null);
  const weather = $derived(sky?.weather ?? null);
  const wxLevel = $derived(gs.skills[WEATHERSENSE_ID]?.level ?? 0);
  const forecast = $derived(
    wxRegion && wxLevel >= 1
      ? forecastFor(wxLevel, wxRegion, worldSeedOf(gs.createdAt), gs.totalTicks)
      : [],
  );
  const any = $derived(!!timeSense || moonLines.length > 0 || !!weather || dark > 0);
</script>

{#if any}
  <div class="sky">
    {#if timeSense}
      <Tip block>
        <span class="sky-clock">🕰️ {shortClock(timeSense)}</span>
        {#snippet tip()}
          <div class="tip-line tip-base">{timeSense}</div>
          <div class="tip-line">{SKILLS[CHRONOSENSE_ID].name} {senseLevel}</div>
        {/snippet}
      </Tip>
    {/if}
    {#if moonLines.length}
      <Tip block>
        <span class="sky-moons">
          {#each clock.moons as m (m.id)}
            <span class="moonglyph {m.size}">{MOON_ICONS[m.phaseId]}</span>
          {/each}
        </span>
        {#snippet tip()}
          {#each moonLines as line (line)}
            <div class="tip-line">{line}</div>
          {/each}
        {/snippet}
      </Tip>
    {/if}
    {#if weather}
      <Tip block>
        <span class="sky-weather">{WEATHER_ICONS[weather.kind]} {Math.round(weather.temp)}°</span>
        {#snippet tip()}
          <div class="tip-line tip-base">
            {WEATHER_ICONS[weather.kind]} {weather.kind} · feels {weather.band}
          </div>
          {#if wxLevel >= PROGNOSIS_TOOLTIP_AT && wxRegion}
            <div class="tip-line tip-sub">🌦 Prognosis — {wxRegion.name}</div>
          {/if}
          {#each forecast as e (e.label)}
            <div class="tip-line wx-row" class:wx-rough={e.quality === 'rough'}>
              <span class="wx-when">{e.label}</span>
              {e.text}{e.quality === 'rough' ? ' (?)' : ''}
            </div>
          {/each}
        {/snippet}
      </Tip>
    {/if}
    <!-- The slot is as wide as the widest label, with or without the chip: the
         hidden sizer and the chip share one grid cell. -->
    <div class="sky-dark-slot">
      <span class="sky-dark sizer" aria-hidden="true">🌑 Blind dark</span>
      {#if dark > 0}
        <Tip block>
          <span class="sky-dark">🌑 {dark >= 0.85 ? 'Blind dark' : dark >= 0.4 ? 'Dark' : 'Gloom'}</span>
          {#snippet tip()}
            {#each darkText(gs, dark).split('\n') as line, i (i)}
              <div class="tip-line" class:tip-base={i === 0}>{line}</div>
            {/each}
          {/snippet}
        </Tip>
      {/if}
    </div>
  </div>
{/if}

<style>
  .sky {
    display: flex;
    align-items: center;
    gap: 4px 12px;
    min-height: 20px;
    color: var(--text-dim);
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
  }

  .sky-moons {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .moonglyph.large {
    font-size: 17px;
  }
  .moonglyph.medium {
    font-size: 13px;
  }
  .moonglyph.small {
    font-size: 10px;
  }

  /* The weather chip is a slot as wide as its widest text ("🕳️ -99°"), as in the header. */
  .sky-weather {
    display: inline-block;
    min-width: 3.9em;
  }

  .sky-dark-slot {
    display: grid;
    align-items: center;
    margin-left: auto;
  }

  .sky-dark-slot > :global(*) {
    grid-area: 1 / 1;
  }

  .sky-dark.sizer {
    visibility: hidden;
  }

  /* Reads as a warning rather than a readout: it is costing you something. */
  .sky-dark {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 999px;
    color: var(--night);
    border: 1px solid var(--night-edge);
    background: color-mix(in srgb, var(--night-edge) 30%, transparent);
    text-align: center;
  }
</style>
