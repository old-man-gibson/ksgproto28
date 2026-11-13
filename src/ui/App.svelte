<script lang="ts">
  import { gs, game, ui, stepTicks, stepEvent, toggleKeep, markNavSeen, setLogChoice } from './state.svelte';
  import { isKept } from '../core/systems/ledger';
  import { defeatDialogDue } from '../core/systems/knockoutReturn';
  import { TPS } from '../core/engine/loop';
  import { BONUS_CAP_TICKS } from '../core/systems/bonustime';
  import Sidebar from './panels/Sidebar.svelte';
  import LocationPanel from './panels/LocationPanel.svelte';
  import CombatPanel from './panels/CombatPanel.svelte';
  import SkillsPanel from './panels/SkillsPanel.svelte';
  import AbilityPanel from './panels/AbilityPanel.svelte';
  import EquipmentPanel from './panels/EquipmentPanel.svelte';
  import QuestsPanel from './panels/QuestsPanel.svelte';
  import AchievementsPanel from './panels/AchievementsPanel.svelte';
  import BestiaryPanel from './panels/BestiaryPanel.svelte';
  import ChromosomePanel from './panels/ChromosomePanel.svelte';
  import MusicPanel from './panels/MusicPanel.svelte';
  import WuxinPanel from './panels/WuxinPanel.svelte';
  import NavIndex from './NavIndex.svelte';
  import JobStrip from './JobStrip.svelte';
  import Dock from './Dock.svelte';
  import BottomBar from './BottomBar.svelte';
  import { viewport } from './lib/viewport.svelte';
  import SystemMenu from './SystemMenu.svelte';
  import LogFeed from './LogFeed.svelte';
  import LogTicker from './LogTicker.svelte';
  import LogDrawer from './LogDrawer.svelte';
  import OfflineModal from './OfflineModal.svelte';
  import PrestigeModal from './PrestigeModal.svelte';
  import DareModal from './DareModal.svelte';
  import { pendingDare } from '../core/systems/training';
  import EvolveModal from './EvolveModal.svelte';
  import { pendingEvolution } from '../core/facet/host';
  import PrestigePanel from './panels/PrestigePanel.svelte';
  import DefeatModal from './DefeatModal.svelte';
  import TutorialCard from './TutorialCard.svelte';
  import { tutorialActive } from '../core/systems/tutorial';
  import { targetTab, tutorialScreen } from './lib/tutorialFocus';
  import { tick, untrack, type Component } from 'svelte';
  import { fmt } from './lib/format';
  import { navListShown, reconcileTab, visibleNav, type MainTab } from './lib/nav';
  import { headerSky, logIsOpen, shortClock } from './lib/shell';
  import DebugPanel from './panels/DebugPanel.svelte';
  import { clockOf, MOON_ICONS } from '../core/systems/clock';
  import { CHRONOSENSE_ID, describeMoons, describeTimeSense } from '../core/systems/chronosense';
  import { WEATHER_ICONS, worldSeedOf } from '../core/systems/weather';
  import { forecastFor, PROGNOSIS_TOOLTIP_AT, WEATHERSENSE_ID } from '../core/systems/weathersense';
  import Tip from './lib/Tip.svelte';
  import { darknessFactor } from '../core/systems/exposure';
  import { darkText } from './lib/sky';
  import { SKILLS } from '../core/registry';
  import {
    barCapacity,
    barTickStarts,
    expandRepeats,
    meterOf,
    pedalOf,
    tempoOf,
  } from '../core/systems/music';
  import { playBar, stopMusic } from './lib/musicAudio';
  import { msToTime } from './lib/format';
  import { OFFLINE_CAP_MS } from '../core/save/offline';

  /**
   * Developer tools exist only in `npm run dev`. Vite replaces this with a
   * literal false in a production build, so the panel and everything it imports
   * are dropped from the bundle rather than merely hidden.
   */
  const DEV = import.meta.env.DEV;
  let showDebug = $state(false);

  // What the clock chip may say is the SKILL's business: absent until
  // Chronosense manifests, then as precise as its level allows (see
  // systems/chronosense.ts for the ladder).
  const senseLevel = $derived(gs.skills[CHRONOSENSE_ID]?.level ?? 0);
  const clock = $derived(clockOf(gs.totalTicks));
  const timeSense = $derived(describeTimeSense(clock, senseLevel));
  // The moons join the chip at season-sense, as glyphs; the names are on hover.
  const moonLines = $derived(describeMoons(clock, senseLevel));

  // The sky needs no skill — skin reads weather for free. Null while the
  // player's region has no atlas pin (no geography, no weather).
  /**
   * How much of the night still has hold of you (0 = you can see fine). Zero
   * indoors, in a settlement, under a sheltered region's roof, in daylight, or
   * once Darkvision has bought the whole thing back — so the readout appearing
   * at all is itself information.
   */
  const dark = $derived(darknessFactor(gs));
  const darkTitle = $derived(darkText(gs, dark));

  // A roofed spot (an `indoor` spot in an open area) shows what floors 1 to 3 show.
  const sky = $derived(headerSky(gs));
  const wxRegion = $derived(sky?.region ?? null);
  const weather = $derived(sky?.weather ?? null);
  // The PROGNOSIS is Weathersense's: rows appear and sharpen by level.
  const wxLevel = $derived(gs.skills[WEATHERSENSE_ID]?.level ?? 0);
  const forecast = $derived(
    wxRegion && wxLevel >= 1
      ? forecastFor(wxLevel, wxRegion, worldSeedOf(gs.createdAt), gs.totalTicks)
      : [],
  );

  /**
   * The main screens, one panel each. Typed on `MainTab`, which derives from the
   * NAV table (lib/nav.ts): a row without a panel here fails the type check.
   */
  const SCREENS: Record<MainTab, Component> = {
    location: LocationPanel,
    combat: CombatPanel,
    skills: SkillsPanel,
    ability: AbilityPanel,
    equipment: EquipmentPanel,
    chromosome: ChromosomePanel,
    music: MusicPanel,
    wuxin: WuxinPanel,
    bestiary: BestiaryPanel,
    quests: QuestsPanel,
    achievements: AchievementsPanel,
    prestige: PrestigePanel,
  };
  const Screen = $derived(SCREENS[ui.tab]);

  /**
   * Floor 0 trims the screen to what the current step uses (lib/tutorialFocus.ts):
   * screens arrive as the steps name them, the sidebar with the first fight, and
   * the clock, weather and Menu after the tutorial. Null outside it.
   */
  const screen = $derived(tutorialScreen(gs));
  const target = $derived(screen?.target ?? null);

  // The log is a right-hand column while open and a one-line row plus an overlay
  // panel while folded (lib/shell.ts). The player's stored pick beats the width
  // default; floor 0 keeps the column, as it always had.
  let viewportWidth = $state(typeof window === 'undefined' ? 1440 : window.innerWidth);
  let headerEl = $state<HTMLElement>();
  // Below 700px, or in a window under 500px tall (a phone held sideways), the
  // layout is one column (docs/PHONE.md): the dock replaces the header, the screen
  // list is the bottom row, and the log is always the folded row above it.
  const phone = $derived(viewport.phone);
  const logOpen = $derived(!phone && (screen ? true : logIsOpen(ui.logChoice, viewportWidth)));
  $effect(() => {
    if (logOpen && ui.logDrawer) ui.logDrawer = false;
  });

  // The screens the player may open now. The list draws with the second one.
  const entries = $derived(visibleNav(gs, screen));
  const showNav = $derived(navListShown(entries));

  // The open screen must be one the list holds: a reset, an import or a
  // prestige can leave a closed gate behind it. Then a screen counts as opened
  // once it is the open one, however it got there: a click, the tutorial's
  // pointer, a map card's link.
  $effect(() => {
    const open = reconcileTab(ui.tab, entries);
    if (open !== ui.tab) ui.tab = open;
    untrack(() => markNavSeen(open));
  });

  /**
   * When the step points somewhere new, open the tab it is drawn on and
   * scroll it into view (at 800 × 600 the activity buttons sit below the
   * map). Fires on a change of target only, so a player who clicks to
   * another tab is not dragged back until the next step.
   */
  let pointed: string | null = null;
  $effect(() => {
    const now = target;
    if (now === pointed) return;
    pointed = now;
    if (!now) return;
    const tab = targetTab(now);
    if (tab) ui.tab = tab;
    tick().then(() =>
      document.querySelector('.tutorial-target')?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );
  });

  /**
   * Open the summary when a fight ends badly and nothing follows it. Keyed on
   * `endedAt` rather than on identity so it fires once per knockout — and a win
   * never raises it, though the ledger is written all the same and can be opened
   * from the Fight Feed. A knockout that is followed by a return or a fallback
   * (systems/knockoutReturn.ts) is marked shown without opening, so the window
   * does not appear later when that return ends.
   */
  $effect(() => {
    const led = gs.lastFight;
    if (!led || led.outcome === 'won' || led.endedAt === ui.defeatShown) return;
    ui.defeatShown = led.endedAt;
    if (defeatDialogDue(gs)) ui.defeat = led;
  });

  /**
   * The bard is audible from any tab: while a performance runs, each bar is
   * scheduled as its tick arrives (within-bar timing rides the audio clock, so
   * the rhythm is exact). Deliberately a plain variable, not $state — it is
   * bookkeeping for the effect, not something the UI renders. Audio only
   * sounds if a click has unlocked the context (see musicAudio.ts).
   */
  let lastPerfBar = -1;
  $effect(() => {
    const perf = gs.performance;
    if (!perf) {
      if (lastPerfBar !== -1) {
        lastPerfBar = -1;
        stopMusic();
      }
      return;
    }
    const comp = gs.compositions.find((c) => c.id === perf.compositionId);
    if (!comp) return;
    // Bar boundaries come from the meter (a waltz bar is genuinely shorter),
    // so find the PERFORMED bar whose start tick has just been crossed —
    // performed, because repeats are unrolled and each pass sounds again.
    const starts = barTickStarts(comp);
    const elapsed = perf.ticksTotal - perf.ticksLeft;
    let bar = starts.length - 1;
    while (bar > 0 && elapsed < starts[bar]) bar -= 1;
    if (bar !== lastPerfBar) {
      lastPerfBar = bar;
      const performed = expandRepeats(comp).bars;
      // Hand it the rest of the sheet so a tie over the barline sounds
      // whole instead of being struck again next bar.
      if (performed[bar]) {
        playBar(performed.slice(bar), barCapacity(meterOf(comp)), tempoOf(comp), pedalOf(comp));
      }
    }
  });

  /**
   * Keyboard for the step controls: Space (or P) freezes and unfreezes, →
   * walks a tick (Shift+→ a second), N runs to the fight's next line. Typing
   * anywhere — or driving a focused control with the keys the browser already
   * owns — always wins, so these can never fire under someone's fingers. P is
   * the spare for exactly that case: Space belongs to a focused button.
   */
  function onKeydown(ev: KeyboardEvent) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const el = ev.target as HTMLElement | null;
    const tag = el?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
    // Space and Enter belong to whatever button or link has focus.
    if ((tag === 'BUTTON' || tag === 'A') && (ev.code === 'Space' || ev.key === 'Enter')) return;

    if (ev.code === 'Space' || ev.key === 'p' || ev.key === 'P') {
      ev.preventDefault();
      game.togglePause();
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      stepTicks(ev.shiftKey ? TPS : 1);
    } else if (ev.key === 'n' || ev.key === 'N') {
      ev.preventDefault();
      stepEvent();
    }
  }

  function toggleBonus(ev: MouseEvent) {
    game.setBonusSpending(!gs.bonusTime.spending);
    (ev.currentTarget as HTMLButtonElement).blur();
  }

  /** Give the focus back after a click so Space keeps toggling the pause. */
  function togglePause(ev: MouseEvent) {
    game.togglePause();
    (ev.currentTarget as HTMLButtonElement).blur();
  }
</script>

<svelte:window onkeydown={onKeydown} bind:innerWidth={viewportWidth} />

<div
  class="layout"
  class:paused={gs.paused}
  class:no-sidebar={screen && !screen.sidebar}
  class:log-folded={!logOpen}
  class:phone
  class:short={phone && viewport.short}
>
  {#if phone}
    <Dock {screen} ondebug={DEV ? () => (showDebug = !showDebug) : undefined} />
  {/if}
  {#if !phone}
  <header bind:this={headerEl}>
    <h1 class:title-yields={!screen}>Frontier Idle</h1>

    <!-- Transport controls. The pause is global — the whole world stops, not
         just the fight — so stepping through an exchange can't bank free time
         anywhere else. Stepping implies pausing. The keys still work on
         floor 0; the buttons wait for the end of the tutorial. -->
    {#if !screen}
    <div class="clock">
      <button
        class="pause"
        class:on={gs.paused}
        onclick={togglePause}
        title="Freeze the whole world — activities, benches, travel and all (Space or P)"
      >
        {gs.paused ? '▶️ Resume' : '⏸️ Pause'}
      </button>
      <button class="step" onclick={() => stepTicks(1)} title="Advance one tick — 100 ms (→)">
        +1
      </button>
      <button class="step" onclick={() => stepTicks(TPS)} title="Advance one second (Shift + →)">
        +1s
      </button>
      <button
        class="step"
        onclick={() => stepEvent()}
        title="Advance until the fight's next line — one thing happening, not one tick (N)"
      >
        ⏭ Next
      </button>
      <!-- Banked idle time: filled by doing nothing, spent as double speed
           only while switched on (systems/bonustime.ts). -->
      <button
        class="bonus"
        class:on={gs.bonusTime.spending}
        onclick={toggleBonus}
        title="Bonus time: banked 1:1 while nothing runs (no activity, travel, bench, performance, fight), cap {msToTime((BONUS_CAP_TICKS / TPS) * 1000)}. While on, every working tick runs twice and spends one banked tick."
      >
        ⏩ {gs.bonusTime.spending ? '2× ' : ''}{msToTime((gs.bonusTime.banked / TPS) * 1000)}
      </button>
      {#if gs.paused}
        <span class="tickno" title="Ticks elapsed since this save began">t{gs.totalTicks}</span>
      {/if}
    </div>
    {/if}

    <!-- What the character is doing, and gold and kills per minute. -->
    <JobStrip showRate={!screen} />
    {#if timeSense}
      <div class="timesense" title="{timeSense} ({SKILLS[CHRONOSENSE_ID].name} {senseLevel})">
        🕰️ <span class="clock-full">{timeSense}</span><span class="clock-short">{shortClock(timeSense)}</span>
      </div>
    {/if}
    {#if moonLines.length && !screen}
      <!-- Glyphs drawn at each moon's relative size; hover names them. -->
      <Tip block>
        <div class="moonchip">
          {#each clock.moons as m (m.id)}
            <span class="moonglyph {m.size}">{MOON_ICONS[m.phaseId]}</span>
          {/each}
        </div>
        {#snippet tip()}
          {#each moonLines as line (line)}
            <div class="tip-line">{line}</div>
          {/each}
        {/snippet}
      </Tip>
    {/if}
    {#if weather && !screen}
      <!-- Same tooltip system as stats and resources. It grows with
           Weathersense: today only at first, the coming hours from level 1,
           the area's daily prognosis from 5. -->
      <Tip block>
        <div class="weather">{WEATHER_ICONS[weather.kind]} {Math.round(weather.temp)}°</div>
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
    <!-- The dark is a real combat penalty (exposure.ts) and was invisible:
         without this, Darkvision buys back something you never saw taken. -->
    <!-- The slot is laid out at every hour, empty by day: the chip shows inside
         it, so the night coming on moves nothing. The hidden sizer is the
         widest label; it has no hit target and no place in the accessibility
         tree. -->
    <div class="dark-slot">
      <span class="dark sizer" aria-hidden="true">🌑 Blind dark</span>
      {#if dark > 0}
        <!-- Bands, not thresholds on the nose: Darkvision's ceiling is 50, so a
             single level would otherwise demote "blind dark" the moment the
             skill manifests, which reads as the label being broken. -->
        <div class="dark" title={darkTitle}>
          🌑 {dark >= 0.85 ? 'Blind dark' : dark >= 0.4 ? 'Dark' : 'Gloom'}
        </div>
      {/if}
    </div>
    {#if !screen || screen.gold}
      <div class="gold">🪙 {fmt(gs.gold)}</div>
    {/if}
    <div class="actions small">
      <!-- Save, Export, Import, Reset, theme and the key list are in the Menu.
           Autosave runs regardless. A new save offers Import on the floor 0
           card instead (TutorialCard's "Played before?"). -->
      {#if !screen}
        <SystemMenu />
      {/if}
      {#if DEV}
        <button onclick={() => (showDebug = !showDebug)} title="Developer tools">🐞</button>
      {/if}
    </div>
  </header>
  {/if}

  {#if !screen || screen.sidebar}
    <aside class="sidebar">
      <Sidebar combatStats={!screen} {phone}>
        {#snippet nav()}
          <!-- One screen is no choice: the list appears with the second. The
               phone's list is the bottom row (BottomBar.svelte). -->
          {#if showNav && !phone}<NavIndex {entries} />{/if}
        {/snippet}
      </Sidebar>
    </aside>
  {/if}

  <main>
    <!-- Floor 0's card, above the screen so it stays in view from whichever
         screen the step opens (sticky on a narrow screen, where the page
         scrolls). Gone for good once flag:tutorial_done is stamped. -->
    {#if tutorialActive(gs)}
      <TutorialCard target={target} />
    {/if}
    <div class="tab-body">
      {#if Screen}<Screen />{/if}
    </div>
    {#if !logOpen && !phone}
      <LogTicker open={ui.logDrawer} ontoggle={() => (ui.logDrawer = !ui.logDrawer)} />
    {/if}
  </main>

  {#if logOpen}
    <aside class="logside">
      <LogFeed
        actions={screen
          ? []
          : [{ label: 'Fold', title: 'Fold the log into one line under the screen', run: () => setLogChoice(false) }]}
      />
    </aside>
  {:else if ui.logDrawer}
    <LogDrawer anchor={headerEl} onclose={() => (ui.logDrawer = false)} ondock={() => setLogChoice(true)} />
  {/if}

  {#if phone}
    <BottomBar {entries} {showNav} logOpen={ui.logDrawer} ontogglelog={() => (ui.logDrawer = !ui.logDrawer)} />
  {/if}
</div>

{#if DEV && showDebug}
  <DebugPanel onClose={() => (showDebug = false)} />
{/if}

{#if ui.catchingUp !== null}
  <!-- Painted before the boot catch-up runs (see main.ts); the thread is
       blocked while it simulates, so this is static by design. -->
  <div class="catchup-overlay" role="status" aria-live="polite">
    <div class="catchup panel">
      <h2>⏳ Catching up…</h2>
      <p class="dim">
        You were away for {msToTime(ui.catchingUp)}. Simulating
        {ui.catchingUp > OFFLINE_CAP_MS ? `the first ${msToTime(OFFLINE_CAP_MS)}` : 'that time'}
        — this can take a while on a long-running save.
      </p>
    </div>
  </div>
{/if}

{#if ui.offline}
  <OfflineModal summary={ui.offline} onclose={() => (ui.offline = null)} />
{/if}

{#if gs.prestige.review}
  <!-- Save state, not UI state: owed until a point is spent or leaving is
       confirmed, reload or no reload (systems/prestige.ts). -->
  <PrestigeModal />
{/if}

{#if pendingDare(gs)}
  <!-- Save state, not UI state: the keeper's dare holds play until answered,
       reload or no reload (systems/training.ts). -->
  <DareModal spot={pendingDare(gs)!} />
{/if}

{#if pendingEvolution(gs)}
  {@const offer = pendingEvolution(gs)!}
  <!-- Save state, not UI state: the offer is on the ability's saved document,
       and play holds until a branch is picked (facet/host.ts). -->
  <EvolveModal from={offer.from} choices={offer.choices} />
{/if}

{#if ui.defeat}
  <DefeatModal
    ledger={ui.defeat}
    kept={isKept(gs, ui.defeat)}
    onkeep={() => toggleKeep(ui.defeat!)}
    onclose={() => (ui.defeat = null)}
  />
{/if}

<style>
  .catchup-overlay {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 11;
    padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
  }

  .catchup {
    max-width: 420px;
    width: 90%;
  }

  .layout {
    display: grid;
    grid-template-columns: 270px 1fr 320px;
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'header header header'
      'sidebar main log';
    gap: 12px;
    /* 12px, or the system bar's or the notch's inset where that is more
       (app.css --safe-*; zero in a desktop browser). */
    padding: max(12px, var(--safe-top)) max(12px, var(--safe-right)) max(12px, var(--safe-bottom)) max(12px, var(--safe-left));
    height: 100vh;
  }

  header {
    grid-area: header;
    display: flex;
    /* One row from 1180px up, never two: the job strip takes the room left
       (JobStrip.svelte), so a fight starting or ending cannot change the
       header's height. Under 1180px it wraps by design (rule below). */
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px 12px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 16px;
  }

  header h1 {
    font-size: 18px;
    margin: 0;
    color: var(--accent);
    white-space: nowrap;
  }

  .clock {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .clock button {
    padding: 4px 8px;
    font-size: 12px;
  }

  .clock .step {
    min-width: 34px;
    color: var(--text-dim);
  }

  /* The bank counts up every second while idle: a fixed slot as wide as its
     longest text, so the chips after it stay put. The widest is "⏩ 2× 1h 10m"
     (95.6px in Default, measured 2026-11-05 over every text from 0s to 8h 59m);
     7.9em (94.8px) let it push the header 0.8px. */
  .clock .bonus {
    min-width: 8em;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .clock .bonus.on,
  .clock .pause.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  .tickno {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: var(--text-dim);
    padding-left: 2px;
  }

  /* A frozen world should be unmistakable at a glance, from any tab. */
  .layout.paused header {
    border-color: var(--accent);
  }

  .gold {
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
  }

  /* The clock text yields first. Its basis is 0, so a long text never pushes
     the row onto a second line or shortens the job name; it takes the room
     left over, up to 230px, and ends in an ellipsis. The title holds the whole
     text. The dark slot is laid out by day too, so a full row leaves this chip
     at its minimum: that holds its widest hour ("🕰️ about 23:00", 89px in
     Default's face), as the narrow layout's 7.1em does below. */
  .timesense {
    flex: 1 1 0;
    min-width: 7.1em;
    max-width: 230px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-dim);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    /* Its width comes from the row, not its text, so it can be a container:
       under 200px it shows the hour only. */
    container-type: inline-size;
  }

  .clock-short {
    display: none;
  }

  @container (max-width: 199px) {
    .clock-full {
      display: none;
    }

    .clock-short {
      display: inline;
    }
  }

  /* Under 1370px the title goes when the transport buttons show (the browser
     tab keeps it): its 175px are what the job strip needs for its full 330px
     (JobStrip.svelte). Measured with the dev-only 🐞 button showing. */
  @media (max-width: 1369px) {
    header h1.title-yields {
      display: none;
    }
  }

  /* Under 1180px: two rows. The job strip and the rate chip start the second
     (JobStrip.svelte), so the row count depends on the window, not the job.
     This was 1024px. At 1024px, with the clock, the moons, the weather, the
     dark slot, the gold and the Menu all showing, the first row left the strip
     16px and the job's name was gone (measured 2026-11-12, Gothic). */
  @media (max-width: 1179px) {
    header {
      flex-wrap: wrap;
    }
  }

  /* Under 1180px the clock chip shows the hour only (the title holds the whole
     text) and takes its own width, so the first row holds. A job name longer
     than the strip's room ends in an ellipsis. */
  @media (max-width: 1179px) {
    .clock-full {
      display: none;
    }

    .clock-short {
      display: inline;
    }

    /* Sized by its text here, so not a container (a container's text width
       would count as 0). The slot is as wide as its widest hour ("🕰️ about
       23:00", 91px; this face has no tabular figures), so the hour turning
       moves nothing. */
    .timesense {
      flex: 0 0 auto;
      min-width: 7.1em;
      max-width: none;
      container-type: normal;
    }
  }

  .moonchip {
    display: flex;
    align-items: center;
    gap: 2px;
    white-space: nowrap;
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

  /* A fixed slot as wide as its widest text, "🕳️ -99°": the icons are one
     width, and a minus sign and two digits are the most the header shows. The
     text changing moves nothing after it. Widest text per em, measured in the
     eleven themes' own faces: Default 3.50, Gothic 3.10, Cockpit (B612) 3.77,
     Linocut 3.74, Survey 3.68, Registry 3.68, Quayside 3.61. 3.9em covers the
     widest and leaves 1.6px at 13px. */
  .weather {
    width: 3.9em;
    white-space: nowrap;
    color: var(--text-dim);
    font-size: 13px;
  }

  :global(.tip-line.wx-row) {
    color: var(--text);
  }

  :global(.tip-line.wx-row .wx-when) {
    display: inline-block;
    min-width: 78px;
    color: var(--text-dim);
  }

  :global(.tip-line.wx-row.wx-rough) {
    font-style: italic;
    color: var(--text-dim);
  }

  /* The dark chip's slot is as wide as the widest label, with or without the
     chip: the chip and the hidden sizer share one grid cell, and the chip
     fills it, so the three labels are one width too. Only the chip takes
     the pointer (its tooltip); the empty slot and the sizer let it through. */
  .dark-slot {
    display: grid;
    align-items: center;
    pointer-events: none;
  }

  .dark-slot > .dark {
    grid-area: 1 / 1;
    text-align: center;
  }

  .dark-slot > .dark:not(.sizer) {
    pointer-events: auto;
  }

  .dark.sizer {
    visibility: hidden;
  }

  /* Reads as a warning rather than a readout — it is costing you something. */
  .dark {
    white-space: nowrap;
    font-size: 13px;
    padding: 1px 7px;
    border-radius: 999px;
    color: var(--night);
    border: 1px solid var(--night-edge);
    background: color-mix(in srgb, var(--night-edge) 30%, transparent);
  }

  .actions {
    margin-left: auto;
    display: flex;
    gap: 6px;
  }

  /* The left column: bars, the screen list, attributes, Combat Stats. It
     scrolls when they do not fit (the Combat Stats groups open on a click). */
  .sidebar {
    grid-area: sidebar;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sidebar > :global(*) {
    flex: none;
  }

  main {
    grid-area: main;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    overflow: hidden;
  }

  /* The screen. It is a size container named "tab": a panel asks for the width
     it was given (`@container tab (max-width: ...)`) and not the window's, which
     the left column and the log column make a poor guide to it. Its width is the
     column's, whatever the panel holds (docs/PHONE.md). */
  .tab-body {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    container: tab / inline-size;
  }

  .logside {
    grid-area: log;
    min-height: 0;
  }

  /* The log folded: no right column. Main takes its width, with the one-line
     row at its foot; the full log is an overlay (LogDrawer.svelte). The
     folded state never co-occurs with .no-sidebar: floor 0 keeps the column. */
  .layout.log-folded {
    grid-template-columns: 270px 1fr;
    grid-template-areas:
      'header header'
      'sidebar main';
  }

  /* Floor 0 before the first fight: no sidebar, so main takes its column. */
  .layout.no-sidebar {
    grid-template-columns: 1fr 320px;
    grid-template-areas:
      'header header'
      'main log';
  }

  @media (max-width: 1100px) {
    .layout {
      grid-template-columns: 240px 1fr;
      grid-template-areas:
        'header header'
        'sidebar main'
        'log log';
      grid-template-rows: auto 1fr 220px;
      height: auto;
      min-height: 100vh;
    }

    .layout.no-sidebar {
      grid-template-columns: 1fr;
      grid-template-areas:
        'header'
        'main'
        'log';
    }

    /* Folded: the log row below the page goes away with the column. */
    .layout.log-folded {
      grid-template-columns: 240px 1fr;
      grid-template-areas:
        'header header'
        'sidebar main';
      grid-template-rows: auto 1fr;
    }

    /* The page scrolls here, not the tab body. `clip` keeps the sideways
       clipping without making main a scroll container, which is what lets
       the tutorial card stick to the top of the window. */
    main {
      overflow: clip visible;
    }
  }

  /* The phone layout, below 700px (docs/PHONE.md). One column that the page
     scrolls: the dock on top and the bottom bar at the foot, both sticky
     (Dock.svelte, BottomBar.svelte), the screen between them, and under the
     screen what the left column holds on a wider one (the conditions and
     level, attributes, Combat Stats). Flex, not grid: a sticky child of a grid
     cell cannot leave its cell. Placed by `order`, so the markup keeps the
     desktop's order. */
  .layout.phone {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    height: auto;
    min-height: 100vh;
    min-height: 100dvh;
  }

  .layout.phone > main {
    order: 1;
    flex: 1 0 auto;
    gap: 8px;
    padding: 8px calc(8px + var(--safe-right)) 8px calc(8px + var(--safe-left));
    overflow: visible;
  }

  /* A panel wider than the screen scrolls inside its own box. The page never scrolls sideways. */
  .layout.phone .tab-body {
    flex: none;
    overflow-x: auto;
  }

  .layout.phone > .sidebar {
    order: 2;
    gap: 8px;
    overflow: visible;
    padding: 0 calc(8px + var(--safe-right)) 8px calc(8px + var(--safe-left));
  }
</style>
