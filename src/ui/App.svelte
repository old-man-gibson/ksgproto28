<script lang="ts">
  import { gs, game, ui, save, exportSave, importSave, hardReset, stepTicks, stepEvent, toggleKeep } from './state.svelte';
  import { isKept } from '../core/systems/ledger';
  import { currentActivity } from '../core/systems/actions';
  import { TPS } from '../core/engine/loop';
  import { BONUS_CAP_TICKS } from '../core/systems/bonustime';
  import Sidebar from './panels/Sidebar.svelte';
  import LocationPanel from './panels/LocationPanel.svelte';
  import CombatPanel from './panels/CombatPanel.svelte';
  import SkillsPanel from './panels/SkillsPanel.svelte';
  import EquipmentPanel from './panels/EquipmentPanel.svelte';
  import QuestsPanel from './panels/QuestsPanel.svelte';
  import AchievementsPanel from './panels/AchievementsPanel.svelte';
  import BestiaryPanel from './panels/BestiaryPanel.svelte';
  import ChromosomePanel from './panels/ChromosomePanel.svelte';
  import MusicPanel from './panels/MusicPanel.svelte';
  import WuxinPanel from './panels/WuxinPanel.svelte';
  import { activeQuests, questComplete } from '../core/systems/quests';
  import LogFeed from './LogFeed.svelte';
  import OfflineModal from './OfflineModal.svelte';
  import PrestigeModal from './PrestigeModal.svelte';
  import DareModal from './DareModal.svelte';
  import { pendingDare } from '../core/systems/training';
  import { restingForFight } from '../core/systems/huntrest';
  import PrestigePanel from './panels/PrestigePanel.svelte';
  import { prestigeVisible } from '../core/systems/prestige';
  import DefeatModal from './DefeatModal.svelte';
  import TutorialCard from './TutorialCard.svelte';
  import { tutorialActive } from '../core/systems/tutorial';
  import { targetTab, tutorialScreen } from './lib/tutorialFocus';
  import { tick } from 'svelte';
  import { fmt } from './lib/format';
  import { applyTheme, loadTheme, nextTheme, THEME_NAMES } from './lib/theme';
  import DebugPanel from './panels/DebugPanel.svelte';
  import { clockOf } from '../core/systems/clock';
  import { CHRONOSENSE_ID, describeTimeSense } from '../core/systems/chronosense';
  import { WEATHER_ICONS, weatherAt, worldSeedOf } from '../core/systems/weather';
  import { forecastFor, PROGNOSIS_TOOLTIP_AT, WEATHERSENSE_ID } from '../core/systems/weathersense';
  import Tip from './lib/Tip.svelte';
  import { DARK_DODGE_PENALTY, DARK_MISS_CHANCE, darknessFactor } from '../core/systems/exposure';
  import { subsystemUnlocked } from '../core/systems/unlocks';
  import { AREAS, REGIONS, SKILLS, SPOTS } from '../core/registry';
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

  let theme = $state(loadTheme());
  function cycleTheme() {
    theme = nextTheme(theme);
    applyTheme(theme);
  }

  const activity = $derived(currentActivity(gs));

  // What the clock chip may say is the SKILL's business: absent until
  // Chronosense manifests, then as precise as its level allows (see
  // systems/chronosense.ts for the ladder).
  const senseLevel = $derived(gs.skills[CHRONOSENSE_ID]?.level ?? 0);
  const timeSense = $derived(describeTimeSense(clockOf(gs.totalTicks), senseLevel));

  // The sky needs no skill — skin reads weather for free. Null while the
  // player's region has no atlas pin (no geography, no weather).
  /**
   * How much of the night still has hold of you (0 = you can see fine). Zero
   * indoors, in a settlement, under a sheltered region's roof, in daylight, or
   * once Darkvision has bought the whole thing back — so the readout appearing
   * at all is itself information.
   */
  const dark = $derived(darknessFactor(gs));
  const darkTitle = $derived.by(() => {
    const dodge = Math.round(DARK_DODGE_PENALTY * dark * 100);
    const miss = Math.round(DARK_MISS_CHANCE * dark * 100);
    const level = gs.skills.darkvision?.level ?? 0;
    const seen = level > 0 ? ` · ${SKILLS.darkvision.name} ${level} is buying it back` : '';
    return `You are fighting in the dark: −${dodge}% dodge, +${miss}% chance of your attacks missing${seen}`;
  });

  const wxRegion = $derived(REGIONS[AREAS[SPOTS[gs.spot]?.areaId]?.regionId]);
  const weather = $derived(
    wxRegion ? weatherAt(worldSeedOf(gs.createdAt), wxRegion, gs.totalTicks) : null,
  );
  // The PROGNOSIS is Weathersense's: rows appear and sharpen by level.
  const wxLevel = $derived(gs.skills[WEATHERSENSE_ID]?.level ?? 0);
  const forecast = $derived(
    wxRegion && wxLevel >= 1
      ? forecastFor(wxLevel, wxRegion, worldSeedOf(gs.createdAt), gs.totalTicks)
      : [],
  );

  // Shuttered subsystems (systems/unlocks.ts) keep their tabs off the bar
  // until content lifts the flag — furniture for a system you have never
  // heard of is a spoiler, the same rule the benches follow.
  const tabs = $derived(
    (
      [
        { id: 'location', name: '🗺️ Location' },
        { id: 'combat', name: '⚔️ Combat' },
        { id: 'skills', name: '📜 Skills' },
        { id: 'equipment', name: '🎒 Equipment' },
        { id: 'chromosome', name: '🧬 Chromosome' },
        { id: 'music', name: '🎼 Music' },
        { id: 'wuxin', name: '☯️ Wuxin' },
        { id: 'bestiary', name: '📖 Bestiary' },
        { id: 'quests', name: '⭐ Quests' },
        { id: 'achievements', name: '🏆 Achievements' },
        // Appears once the run could prestige (band 1 cleared), and stays
        // once any run has — the pre-prestige view lives here.
        { id: 'prestige', name: '♻️ Prestige' },
      ] as const
    ).filter((t) =>
      t.id === 'chromosome'
        ? subsystemUnlocked(gs, 'genes')
        : t.id === 'music'
          ? subsystemUnlocked(gs, 'music')
          : t.id === 'wuxin'
            ? subsystemUnlocked(gs, 'wuxin')
            : t.id === 'prestige'
              ? prestigeVisible(gs)
              : true,
    ),
  );

  const readyQuests = $derived(activeQuests(gs).filter((q) => questComplete(gs, q)).length);

  /**
   * Floor 0 trims the screen to what the current step uses (lib/tutorialFocus.ts):
   * tabs arrive as the steps name them, the sidebar with the first fight, and
   * the clock, weather and save buttons after the tutorial. Null outside it.
   */
  const screen = $derived(tutorialScreen(gs));
  const shownTabs = $derived(screen ? tabs.filter((t) => screen.tabs.has(t.id)) : tabs);
  const target = $derived(screen?.target ?? null);

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
   * Open the summary when a fight ends badly. Keyed on `endedAt` rather than on
   * identity so it fires once per knockout — and a win never raises it, though
   * the ledger is written all the same and can be opened from the Fight Feed.
   */
  $effect(() => {
    const led = gs.lastFight;
    if (!led || led.outcome === 'won' || led.endedAt === ui.defeatShown) return;
    ui.defeatShown = led.endedAt;
    ui.defeat = led;
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

  let fileInput: HTMLInputElement;

  function onImportChange(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) importSave(file);
    (ev.target as HTMLInputElement).value = '';
  }

  function statusText(): string {
    if (gs.travel) return '🥾 Traveling...';
    if (gs.recovering) return '💫 Recovering...';
    if (gs.performance) return '🎵 Performing...';
    if (activity?.kind === 'hunt' && !gs.combat && restingForFight(gs)) return '🛌 Resting before the next fight';
    if (activity) return `${activity.icon} ${activity.name}`;
    return '💤 Idle';
  }

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

<svelte:window onkeydown={onKeydown} />

<div class="layout" class:paused={gs.paused} class:no-sidebar={screen && !screen.sidebar}>
  <header>
    <h1>Frontier Idle</h1>

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

    <div class="status">{gs.paused ? '⏸️ Paused' : statusText()}</div>
    {#if timeSense}
      <div class="timesense" title="{SKILLS[CHRONOSENSE_ID].name} {senseLevel}">
        🕰️ {timeSense}
      </div>
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
    {#if dark > 0}
      <!-- Bands, not thresholds on the nose: Darkvision's ceiling is 50, so a
           single level would otherwise demote "blind dark" the moment the
           skill manifests, which reads as the label being broken. -->
      <div class="dark" title={darkTitle}>
        🌑 {dark >= 0.85 ? 'Blind dark' : dark >= 0.4 ? 'Dark' : 'Gloom'}
      </div>
    {/if}
    {#if !screen || screen.gold}
      <div class="gold">🪙 {fmt(gs.gold)}</div>
    {/if}
    <div class="actions small">
      <!-- Autosave runs regardless. A new save offers Import on the floor 0
           card instead (TutorialCard's "Played before?"). -->
      {#if !screen}
        <button onclick={save} title="Autosaves every 30s">Save</button>
        <button onclick={exportSave}>Export</button>
        <button onclick={() => fileInput.click()}>Import</button>
        <button onclick={hardReset} class="danger">Reset</button>
        <button onclick={cycleTheme} title="Display theme. Kept in this browser, not in the save.">
          {THEME_NAMES[theme]}
        </button>
      {/if}
      {#if DEV}
        <button onclick={() => (showDebug = !showDebug)} title="Developer tools">🐞</button>
      {/if}
      <input
        type="file"
        accept="application/json"
        bind:this={fileInput}
        onchange={onImportChange}
        style="display: none"
      />
    </div>
  </header>

  {#if !screen || screen.sidebar}
    <aside class="sidebar">
      <Sidebar combatStats={!screen} />
    </aside>
  {/if}

  <main>
    <!-- Floor 0's card, above the tabs so it stays in view from whichever
         tab the step opens (sticky on a narrow screen, where the page
         scrolls). Gone for good once flag:tutorial_done is stamped. -->
    {#if tutorialActive(gs)}
      <TutorialCard target={target} />
    {/if}
    <!-- One tab is no choice: the bar appears with the second. -->
    {#if shownTabs.length > 1}
      <nav class="tabs">
        {#each shownTabs as tab}
          <button class:selected={ui.tab === tab.id} onclick={() => (ui.tab = tab.id)}>
            {tab.name}{tab.id === 'quests' && readyQuests > 0 ? ` (${readyQuests})` : ''}
          </button>
        {/each}
      </nav>
    {/if}
    <div class="tab-body">
      {#if ui.tab === 'location'}
        <LocationPanel />
      {:else if ui.tab === 'combat'}
        <CombatPanel />
      {:else if ui.tab === 'skills'}
        <SkillsPanel />
      {:else if ui.tab === 'equipment'}
        <EquipmentPanel />
      {:else if ui.tab === 'chromosome'}
        <ChromosomePanel />
      {:else if ui.tab === 'music'}
        <MusicPanel />
      {:else if ui.tab === 'wuxin'}
        <WuxinPanel />
      {:else if ui.tab === 'bestiary'}
        <BestiaryPanel />
      {:else if ui.tab === 'quests'}
        <QuestsPanel />
      {:else if ui.tab === 'achievements'}
        <AchievementsPanel />
      {:else if ui.tab === 'prestige'}
        <PrestigePanel />
      {/if}
    </div>
  </main>

  <aside class="logside">
    <LogFeed />
  </aside>
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
    background: rgb(0 0 0 / 60%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 11;
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
    padding: 12px;
    height: 100vh;
  }

  header {
    grid-area: header;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
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

  .clock .bonus {
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

  .layout.paused .status {
    color: var(--accent);
    font-weight: 600;
  }

  .status {
    /* The stretchy one: it takes the room the HP bar used to hold, so the
       clock, weather and gold keep right of centre. */
    flex: 1;
    white-space: nowrap;
    color: var(--text-dim);
  }

  .gold {
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
  }

  .timesense {
    white-space: nowrap;
    color: var(--text-dim);
    font-size: 13px;
  }

  .weather {
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

  /* Reads as a warning rather than a readout — it is costing you something. */
  .dark {
    white-space: nowrap;
    font-size: 13px;
    padding: 1px 7px;
    border-radius: 999px;
    color: #b9a7d6;
    border: 1px solid #4a3f66;
    background: color-mix(in srgb, #4a3f66 30%, transparent);
  }

  .actions {
    margin-left: auto;
    display: flex;
    gap: 6px;
  }

  .actions button.danger {
    border-color: #5d3030;
    color: var(--danger);
  }

  .sidebar {
    grid-area: sidebar;
    overflow-y: auto;
  }

  main {
    grid-area: main;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    overflow: hidden;
  }

  .tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .tab-body {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .logside {
    grid-area: log;
    min-height: 0;
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

    /* The page scrolls here, not the tab body. `clip` keeps the sideways
       clipping without making main a scroll container, which is what lets
       the tutorial card stick to the top of the window. */
    main {
      overflow: clip visible;
    }
  }
</style>
