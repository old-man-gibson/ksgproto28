<script lang="ts">
  import { gs, view } from '../state.svelte';
  import { STAT_NAMES, type AttributeId, type ResourceId, type StatKey } from '../../core/types';
  import { ATTRIBUTE_LIST } from '../../core/data/attributes.data';
  import { attrValue } from '../../core/systems/attributes';
  import { equippedTitle } from '../../core/systems/titles';
  import { combatRegenMult, currentActivity } from '../../core/systems/actions';
  import { attackFillRate, actionTicks, STAMINA_EFF_FLOOR } from '../../core/systems/derived';
  import {
    EXHAUSTED_REGEN_MULT,
    EXHAUSTED_SLOW_UNTIL,
    EXHAUSTED_SPEED_PENALTY,
    STAMINA_RESERVE,
  } from '../../core/systems/stamina';
  import { availableMax, resourceLock, resourceValue, trueMax } from '../../core/systems/resources';
  import { escalationPrimed, visibleStatuses } from '../../core/systems/statuses';
  import { facetReadouts } from '../../core/facet/host';
  import { STATUSES } from '../../core/registry';
  import { RECOVERY_MULT, RESOURCES } from '../../core/data/resources.data';
  import { abilityValue, fmt, pct, poolText, statTipLines, statusTipLines } from '../lib/format';
  import { levelAttrBonus, xpToNext } from '../../core/systems/levels';
  import { startingLevel } from '../../core/systems/legacy';
  import { LEVEL_ATTR_BONUS } from '../../core/data/levels.data';
  import Tip from '../lib/Tip.svelte';
  import DishSlots from '../lib/DishSlots.svelte';
  import Icon from '../lib/icons/Icon.svelte';

  /**
   * The character's pools, drawn one of three ways. The window width picks
   * which: App.svelte and Dock.svelte render at most one of `panel` and `dock`,
   * so the bars are never on the page twice.
   *
   * - `panel`: the left column's panel (desktop and tablet): the five pools,
   *   the attack timer, the run's ability readouts, the conditions, the dishes
   *   and the level bar.
   * - `dock`: the phone dock's two rows: HP, then stamina, mana, spirit and
   *   focus as thin bars. Their numbers and breakdowns are in the tap cards.
   *   A condition shows as a mark on the HP bar: the bar never changes size.
   * - `extras`: the phone's panel for everything the dock leaves out, below the
   *   tab body (the panel without the five pools).
   *
   * Every figure is read the same way in all three, from `gs` and `view.stats`.
   */
  let { mode = 'panel' }: { mode?: 'panel' | 'dock' | 'extras' } = $props();

  /** Pool icons sit outside their bars (user, 2026-10-22); 16 and 32 are the art's clean sizes. */
  const RES_ICON: 16 | 32 = 32;

  const stats = $derived(view.stats);

  const barPct = (cur: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0);
  // Every bar reads its pool through the registry: the current value, and the
  // ceiling actually in force (which a wound may have lowered below the stat).
  const cur = (id: ResourceId) => resourceValue(gs, id);
  const cap = (id: ResourceId) => availableMax(gs, stats, id);
  const pool = (id: ResourceId) => poolText(cur(id), cap(id));

  const hpPct = $derived(barPct(cur('hp'), cap('hp')));
  // Character level (systems/levels.ts).
  const nextLevelXp = $derived(xpToNext(gs.level));
  const levelPct = $derived(barPct(gs.levelXp, nextLevelXp));
  // Health's trickle is graded by what you are doing — and halved mid-fight
  // while stamina is off its ceiling — so the tooltip quotes the rate actually
  // running rather than the bare stat, and names whichever of the two is the
  // interesting part right now.
  const restingNow = $derived(gs.recovering || currentActivity(gs)?.kind === 'rest');
  const strained = $derived(combatRegenMult(gs, stats) < 1);
  const recoveryMult = $derived(
    RECOVERY_MULT[restingNow ? 'rest' : (currentActivity(gs)?.kind ?? 'none')] *
      combatRegenMult(gs, stats),
  );
  const hpNotes = $derived([
    `Recovering ${fmt(stats.hpRegen * recoveryMult)}/s — ×${recoveryMult} right now`,
    ...(strained
      ? ['Halved: a fight is on and your stamina is off full']
      : restingNow
        ? []
        : [`Resting recovers ×${RECOVERY_MULT.rest} as fast`]),
  ]);
  const staminaPct = $derived(barPct(cur('stamina'), cap('stamina')));
  // Stamina reads its lockout: dulled while winded, sickly green while
  // exhausted (and dragging every action bar with it). Both the colours and
  // the names come from the pool's own definition.
  const staminaReserve = RESOURCES.stamina.reserve!;
  const staminaLock = $derived(resourceLock(gs, 'stamina'));
  const staminaColor = $derived(
    staminaLock === 'empty'
      ? `var(${staminaReserve.emptyCssVar})`
      : staminaLock === 'low'
        ? `var(${staminaReserve.lowCssVar})`
        : `var(${RESOURCES.stamina.cssVar})`,
  );
  const staminaMark = $derived(
    staminaLock === 'empty'
      ? `${staminaReserve.emptyIcon} `
      : staminaLock === 'low'
        ? `${staminaReserve.lowIcon} `
        : '',
  );
  const staminaNotes = $derived(
    staminaLock === 'empty'
      ? [
          '🥵 Exhausted — you ran the bar to nothing.',
          `Every action bar fills ${pct(EXHAUSTED_SPEED_PENALTY)} slower`,
          `Regen at ×${EXHAUSTED_REGEN_MULT} until the pool passes ${pct(EXHAUSTED_SLOW_UNTIL, 0)}`,
          'Nothing may be spent until the bar is full again',
        ]
      : staminaLock === 'low'
        ? [
            `😮‍💨 Winded — spending stopped at the ${pct(STAMINA_RESERVE, 0)} reserve.`,
            'Your stance keeps its base stats, but buys no exertion bonuses',
            'Spending resumes once the bar is full again',
          ]
        : [
            'Swinging costs a trickle — less than you recover, so plain fighting keeps pace',
            gs.exerting
              ? '🔥 Exerting: your stance is spending real reserves for its bonuses'
              : '🍃 Holding back: switch on Exert in the Combat tab to spend for bonuses',
            `Spending stops at a ${pct(STAMINA_RESERVE, 0)} reserve until the bar refills`,
          ],
  );
  // Mana can be burned PAST zero (see manaburn). In debt the bar reads as the
  // size of the overdraft rather than what is left, and turns magenta — there
  // is no blue to show, because there is nothing there.
  const manaDebt = $derived(Math.max(0, -cur('mana')));
  const manaPct = $derived(
    manaDebt > 0
      ? Math.min(100, (manaDebt / Math.max(1, trueMax(stats, 'mana'))) * 100)
      : barPct(cur('mana'), cap('mana')),
  );
  const manaColor = $derived(manaDebt > 0 ? 'var(--manaburn)' : `var(${RESOURCES.mana.cssVar})`);
  const spiritPct = $derived(barPct(cur('spirit'), cap('spirit')));
  const focusPct = $derived(barPct(cur('focus'), cap('focus')));
  // Player action bar — fills toward the next attack during combat, empty otherwise.
  const actionPct = $derived(
    gs.combat ? Math.min(100, (gs.combat.playerBar / stats.actionBar) * 100) : 0,
  );
  const attackSeconds = $derived(
    (actionTicks(stats.actionBar, attackFillRate(stats)) / 10).toFixed(1),
  );

  function attrInfo(id: (typeof ATTRIBUTE_LIST)[number]['id']) {
    return ATTRIBUTE_LIST.find((a) => a.id === id)!;
  }

  // Efficiency stats compound multiplicatively per attribute point (each point
  // multiplies the cost by 1 − per). These configs mirror the formulas in
  // derived.ts and drive the tooltip breakdown so players see the sources.
  type EffFactor = { id: AttributeId; per: number };
  // Stamina's saving is bounded: the decay applies to the half of the cost
  // above the floor, so training makes exertion cheaper but never free.
  const STAMINA_EFF_FACTORS: EffFactor[] = [
    { id: 'str', per: 0.001 },
    { id: 'dex', per: 0.0015 },
  ];
  const MANA_EFF_FACTORS: EffFactor[] = [
    { id: 'int', per: 0.00033 },
    { id: 'wis', per: 0.0001 },
  ];

  /**
   * Per-attribute contribution lines for an efficiency (cost-multiplier) stat.
   * `floor` is the share of the cost the decay can never touch.
   */
  function effBreakdown(factors: EffFactor[], effValue: number, floor = 0): string[] {
    const lines = factors.map((f) => {
      const v = attrValue(gs, f.id);
      const saved = (1 - floor) * (1 - Math.pow(1 - f.per, v)); // this attribute's share
      const rate = +(f.per * 100).toFixed(3); // trim trailing zeros (0.15, 0.1, 0.033…)
      return `${attrInfo(f.id).icon} ${attrInfo(f.id).name} ${Math.round(v)}: ${rate}%/pt → saves up to ${pct(saved, 2)}`;
    });
    if (floor > 0) lines.push(`Floor: cost never falls below ${pct(floor, 0)}`);
    lines.push(`Combined: ${pct(1 - effValue, 2)} cheaper to spend`);
    return lines;
  }

  const wornTitle = $derived(equippedTitle(gs));
  /**
   * The run's unique ability (docs/FACET.md). The sidebar shows only the cells
   * acting on you now: a cell whose carrier modifies your numbers, while it is
   * not zero. Counters, banks and inputs are in the Ability tab and in these
   * lines' tooltips.
   */
  const abilities = $derived(facetReadouts(gs));
  const acting = $derived(
    abilities.map((ab) => ({ ab, cells: ab.cells.filter((c) => c.acts && c.value !== 0) })).filter((a) => a.cells.length),
  );
  /** Those cells ride on statuses; the ability readouts show them, so the status chips leave them all out. */
  const abilityStatusIds = $derived(new Set(abilities.flatMap((a) => a.cells.map((c) => c.statusId))));
  const afflictions = $derived(visibleStatuses(gs).filter((s) => !abilityStatusIds.has(s.id)));
  /** The dock's marks on the HP bar: the conditions, at most `PIPS` of them and a count of the rest. */
  const PIPS = 4;
  const pipIcons = $derived(afflictions.map((s) => STATUSES[s.id].icon));
</script>

{#snippet statTip(key: StatKey)}
  {@const lines = statTipLines(gs, key)}
  {#each lines as line, i}
    <div class="tip-line" class:tip-total={i === lines.length - 1} class:tip-base={i === 0}>{line}</div>
  {/each}
{/snippet}

<!--
  Simple resource tooltip (HP, Spirit): header, notes, the max-pool breakdown,
  and — for a pool with no efficiency stat to speak of — its regen on the end.
-->
{#snippet resTip(header: string, maxKey: StatKey, extra: string[], regenKey?: StatKey)}
  <div class="tip-line tip-base">{header}</div>
  {#each extra as line}
    <div class="tip-line">{line}</div>
  {/each}
  <div class="tip-line tip-sub">{STAT_NAMES[maxKey]}:</div>
  {@render statTip(maxKey)}
  {#if regenKey}
    <div class="tip-line tip-sub">Regen (per second):</div>
    {@render statTip(regenKey)}
  {/if}
{/snippet}

<!-- Full pool tooltip (Stamina, Mana): max, regen, and efficiency all broken down by source. -->
{#snippet poolTip(
  header: string,
  maxKey: StatKey,
  regenKey: StatKey,
  effKey: StatKey,
  factors: EffFactor[],
  notes: string[] = [],
  floor = 0,
)}
  <div class="tip-line tip-base">{header}</div>
  {#each notes as note}
    <div class="tip-line">{note}</div>
  {/each}
  <div class="tip-line tip-sub">Max pool:</div>
  {@render statTip(maxKey)}
  <div class="tip-line tip-sub">Regen (per second):</div>
  {@render statTip(regenKey)}
  <div class="tip-line tip-sub">Efficiency (cost ×{stats[effKey].toFixed(3)}):</div>
  {#each effBreakdown(factors, stats[effKey], floor) as line}
    <div class="tip-line">{line}</div>
  {/each}
  {#if effKey === 'staminaEff'}
    <div class="tip-line tip-sub">Power (payoff ×{stats.staminaPower.toFixed(3)}):</div>
    <div class="tip-line">Every point of cost you no longer pay comes back as payoff</div>
    {@render statTip('staminaPower')}
  {/if}
{/snippet}

{#snippet actionBarTip()}
  <div class="tip-line tip-base">Action Bar — fills toward your next attack</div>
  <div class="tip-line">Fills at Speed × Attack Speed each tick</div>
  <div class="tip-line tip-total">{fmt(stats.actionBar)} units ≈ {attackSeconds}s per attack</div>
  {#if !gs.combat}<div class="tip-line tip-sub">Only advances during combat.</div>{/if}
{/snippet}

{#snippet hpTip()}
  {@render resTip(`HP ${pool('hp')}`, 'maxHp', hpNotes, 'hpRegen')}
{/snippet}

{#snippet staminaTip()}
  {@render poolTip(
    `Stamina ${pool('stamina')}`,
    'maxStamina',
    'staminaRegen',
    'staminaEff',
    STAMINA_EFF_FACTORS,
    staminaNotes,
    STAMINA_EFF_FLOOR,
  )}
{/snippet}

{#snippet manaTip()}
  {@render poolTip(
    `Mana ${pool('mana')}`,
    'maxMana',
    'manaRegen',
    'manaEff',
    MANA_EFF_FACTORS,
    [`Resting recovers it ×${RESOURCES.mana.restRegenMult} as fast`],
  )}
{/snippet}

{#snippet spiritTip()}
  {@render resTip(`Spirit ${pool('spirit')}`, 'maxSpirit', [
    'Reserved for continuous spells & rituals (coming soon)',
  ])}
{/snippet}

{#snippet focusTip()}
  {@render resTip(`Focus ${pool('focus')}`, 'maxFocus', [
    'The psionic pool. Overload will lower its maximum while a sustained psionic spell is active (coming soon)',
  ])}
{/snippet}

{#if mode === 'dock'}
  <div class="dock-bars">
    <!-- HP. The marks sit inside the bar, so a condition or nightfall moves nothing. -->
    <Tip block>
      <div class="bar dock-hp">
        <div class="fill" style="width: {hpPct}%; background: var(--hp)"></div>
        <div class="label">HP {pool('hp')}</div>
        {#if pipIcons.length > 0}
          <div class="dock-marks" aria-hidden="true">
            {#each pipIcons.slice(0, PIPS) as icon, i (i)}<span>{icon}</span>{/each}
            {#if pipIcons.length > PIPS}<span class="dock-more">+{pipIcons.length - PIPS}</span>{/if}
          </div>
        {/if}
      </div>
      {#snippet tip()}
        {@render hpTip()}
        {#each afflictions as held (held.id)}
          {#each statusTipLines(gs, held) as line, i}
            <div class="tip-line" class:tip-sub={i === 0}>{i === 0 ? `${STATUSES[held.id].icon} ${line}` : line}</div>
          {/each}
        {/each}
      {/snippet}
    </Tip>

    <div class="dock-pools">
      <Tip block>
        <div class="dock-pool">
          <Icon of={RESOURCES.stamina} size={16} />
          <div class="bar dock-pool-bar" class:exhausted={staminaLock === 'empty'}>
            <div class="fill" style="width: {staminaPct}%; background: {staminaColor}"></div>
            <div class="reserve" style="left: {STAMINA_RESERVE * 100}%"></div>
          </div>
        </div>
        {#snippet tip()}{@render staminaTip()}{/snippet}
      </Tip>
      <Tip block>
        <div class="dock-pool">
          <Icon of={RESOURCES.mana} size={16} />
          <div class="bar dock-pool-bar" class:burning={manaDebt > 0}>
            <div class="fill" style="width: {manaPct}%; background: {manaColor}"></div>
          </div>
        </div>
        {#snippet tip()}{@render manaTip()}{/snippet}
      </Tip>
      <Tip block>
        <div class="dock-pool">
          <Icon of={RESOURCES.spirit} size={16} />
          <div class="bar dock-pool-bar">
            <div class="fill" style="width: {spiritPct}%; background: var(--spirit)"></div>
          </div>
        </div>
        {#snippet tip()}{@render spiritTip()}{/snippet}
      </Tip>
      <Tip block>
        <div class="dock-pool">
          <Icon of={RESOURCES.focus} size={16} />
          <div class="bar dock-pool-bar">
            <div class="fill" style="width: {focusPct}%; background: var(--focus)"></div>
          </div>
        </div>
        {#snippet tip()}{@render focusTip()}{/snippet}
      </Tip>
    </div>
  </div>
{:else}
  <div class="panel">
    {#if wornTitle}
      <Tip block>
        <div class="worn-title">{wornTitle.icon} {wornTitle.name}</div>
        {#snippet tip()}<div class="tip-line">{wornTitle.desc}</div>{/snippet}
      </Tip>
    {/if}

    <div class="resources">
      {#if mode === 'panel'}
        <!-- One pool per row, its icon left of the bar on the panel (user,
             2026-10-22): drawn on the bar's fill colour it was hard to read. -->
        <Tip block>
          <div class="res">
            <Icon of={RESOURCES.hp} size={RES_ICON} />
            <div class="bar res-bar">
              <div class="fill" style="width: {hpPct}%; background: var(--hp)"></div>
              <div class="label">HP {pool('hp')}</div>
            </div>
          </div>
          {#snippet tip()}{@render hpTip()}{/snippet}
        </Tip>

        <Tip block>
          <div class="res">
            <Icon of={RESOURCES.stamina} size={RES_ICON} />
            <div class="bar res-bar" class:exhausted={staminaLock === 'empty'}>
              <div class="fill" style="width: {staminaPct}%; background: {staminaColor}"></div>
              <div class="reserve" style="left: {STAMINA_RESERVE * 100}%"></div>
              <!-- Named, like every other pool. An unlabelled bar is read by its
                   colour alone, which is how a full mana bar gets mistaken for a
                   resource that was only just added. -->
              <div class="label">{staminaMark}Stamina {pool('stamina')}</div>
            </div>
          </div>
          {#snippet tip()}{@render staminaTip()}{/snippet}
        </Tip>
        <Tip block>
          <div class="res">
            <Icon of={RESOURCES.mana} size={RES_ICON} />
            <div class="bar res-bar" class:burning={manaDebt > 0}>
              <div class="fill" style="width: {manaPct}%; background: {manaColor}"></div>
              <div class="label">
                {manaDebt > 0 ? `−${fmt(manaDebt)} burned` : `Mana ${pool('mana')}`}
              </div>
            </div>
          </div>
          {#snippet tip()}{@render manaTip()}{/snippet}
        </Tip>

        <!-- Spirit and Focus: the two standing pools, one divine, one psionic -->
        <Tip block>
          <div class="res">
            <Icon of={RESOURCES.spirit} size={RES_ICON} />
            <div class="bar res-bar">
              <div class="fill" style="width: {spiritPct}%; background: var(--spirit)"></div>
              <div class="label">Spirit {pool('spirit')}</div>
            </div>
          </div>
          {#snippet tip()}{@render spiritTip()}{/snippet}
        </Tip>
        <Tip block>
          <div class="res">
            <Icon of={RESOURCES.focus} size={RES_ICON} />
            <div class="bar res-bar">
              <div class="fill" style="width: {focusPct}%; background: var(--focus)"></div>
              <div class="label">Focus {pool('focus')}</div>
            </div>
          </div>
          {#snippet tip()}{@render focusTip()}{/snippet}
        </Tip>
      {/if}

      <!-- Action bar: time until your next attack. No icon; the spacer lines it up with the bars. -->
      <Tip block>
        <div class="res">
          <span class="res-spacer" style="width: {RES_ICON}px"></span>
          <div class="bar res-bar action-bar">
            <div class="fill" style="width: {actionPct}%; background: var(--action)"></div>
          </div>
        </div>
        {#snippet tip()}{@render actionBarTip()}{/snippet}
      </Tip>

      <!-- The run's ability, while it acts on you. A 'bar' cell draws like a pool; the rest are one line. -->
      {#each acting as { ab, cells } (ab.name)}
        {#each cells as cell (cell.key)}
          <Tip block>
            <div class="res">
              <span class="res-spacer ability-icon" style="width: {RES_ICON}px">{cell.icon}</span>
              {#if cell.show === 'bar'}
                <div class="bar res-bar">
                  <div class="fill" style="width: {cell.cap > 0 ? (100 * cell.value) / cell.cap : 0}%; background: var(--accent-fill)"></div>
                  <div class="label">{cell.label} {Math.floor(cell.value)} / {Math.floor(cell.cap)}</div>
                </div>
              {:else if cell.line}
                <!-- A line says what the number does ("parries every blow up to 14"). -->
                <span class="ability-line">{cell.label}: {cell.line}</span>
              {:else}
                <span class="ability-line" class:ability-low={(cell.show === 'signedPct' && cell.value < 0) || (cell.show === 'minusPct' && cell.value > 0)}>{cell.label} {abilityValue(cell)}</span>
              {/if}
            </div>
            {#snippet tip()}
              <div class="tip-line tip-base">{ab.icon} {cell.label === ab.name ? ab.name : `${ab.name}: ${cell.label}`}</div>
              <div class="tip-line">{cell.desc}</div>
              {#if cell.line}
                <!-- Only the number the line was made from: the rest is not about this cell. -->
                {#if cell.base}<div class="tip-line">{cell.base}: {Math.round(cell.value)}</div>{/if}
              {:else}
                {#each ab.cells.filter((c) => c.key !== cell.key) as other (other.key)}
                  <div class="tip-line">{other.icon} {other.label}: {abilityValue(other)}</div>
                {/each}
                {#each ab.inputs as input (input.label)}
                  <div class="tip-line">{input.label}: {input.show === 'pct' ? pct(input.value, 0) : input.value}</div>
                {/each}
              {/if}
              <div class="tip-line dim">More: ✦ Ability tab.</div>
            {/snippet}
          </Tip>
        {/each}
      {/each}

      <!-- Whatever is currently wrong with you. Absent when nothing is. -->
      {#if afflictions.length}
        <div class="afflictions">
          {#each afflictions as held (held.id)}
            {@const def = STATUSES[held.id]}
            <Tip>
              <!-- Primed: sitting at its ceiling, one dose from turning into
                   something worse. It looks unchanged, so it pulses. -->
              <span class="affliction" class:primed={escalationPrimed(gs, held)}>
                <span class="affliction-icon">{def.icon}</span>
                {def.name}{#if held.stacks > 1}<span class="stacks">×{held.stacks}</span>{/if}
              </span>
              {#snippet tip()}
                {@const lines = statusTipLines(gs, held)}
                {#each lines as line, i}
                  <div
                    class="tip-line"
                    class:tip-base={i === 0}
                    class:tip-sub={line.startsWith('—')}
                  >{line}</div>
                {/each}
              {/snippet}
            </Tip>
          {/each}
        </div>
      {/if}

      <!-- The dishes holding a slot, and the one waiting for the fight to end. -->
      <DishSlots />
    </div>

    <Tip block>
      <div class="bar res-bar level-bar">
        <div class="fill" style="width: {levelPct}%; background: var(--xp)"></div>
        <div class="label">Level {gs.level} · {Math.floor(gs.levelXp)}/{nextLevelXp} XP</div>
      </div>
      {#snippet tip()}
        <div class="tip-line tip-base">Level {gs.level}: +{levelAttrBonus(gs)} to every attribute</div>
        <div class="tip-line">Next level: {Math.ceil(nextLevelXp - gs.levelXp)} XP, then +{LEVEL_ATTR_BONUS} more to every attribute</div>
        <div class="tip-line">XP from: kills (the monster's XP), quest turn-ins, a floor's first clear in the run</div>
        {#if startingLevel(gs) > 1}
          <div class="tip-line">Resets with the run. This run started at level {startingLevel(gs)} (Head Start).</div>
        {:else}
          <div class="tip-line">Resets with the run. The Head Start prestige boon raises the level a run starts at.</div>
        {/if}
      {/snippet}
    </Tip>
  </div>
{/if}

<style>
  .worn-title {
    color: var(--accent);
    font-weight: 600;
    margin-bottom: 8px;
  }

  .level-bar {
    margin-top: 8px;
  }
  .resources {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .res-bar.burning,
  .dock-pool-bar.burning {
    border-color: var(--manaburn);
  }

  .afflictions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .affliction {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 7px 2px;
    border: 1px solid var(--danger);
    border-radius: 999px;
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    font-size: 0.78rem;
    line-height: 1.5;
    white-space: nowrap;
  }
  /* At its ceiling: the numbers have stopped moving, so the pill does the
     talking. One more dose and it becomes something worse. */
  .affliction.primed {
    animation: primed-pulse 1.15s ease-in-out infinite;
  }
  @keyframes primed-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 transparent;
      border-color: var(--danger);
    }
    50% {
      box-shadow: 0 0 6px 1px color-mix(in srgb, var(--danger) 55%, transparent);
      border-color: color-mix(in srgb, var(--text) 45%, var(--danger));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .affliction.primed {
      animation: none;
      border-color: color-mix(in srgb, var(--text) 45%, var(--danger));
      box-shadow: 0 0 5px 1px color-mix(in srgb, var(--danger) 45%, transparent);
    }
  }
  .affliction-icon {
    font-size: 0.85rem;
  }
  .affliction .stacks {
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }
  .afflictions :global(.tip-target) {
    border-bottom: none;
  }

  .res-bar {
    height: 16px;
  }

  /* Each pool's icon sits left of its bar, on the panel, not on the fill
     colour where it was hard to read; the bar takes the rest of the width. */
  .res {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .res > .res-bar {
    flex: 1 1 0;
    min-width: 0;
  }

  .res-spacer {
    flex: none;
  }

  .ability-icon {
    text-align: center;
    font-size: 1.1rem;
    line-height: 1;
  }
  .ability-line {
    font-size: 0.8rem;
    color: var(--xp-ink);
  }
  .ability-line.ability-low {
    color: var(--danger);
  }

  .res-bar.action-bar {
    height: 8px;
  }

  /* The reserve floor: stances stop spending once the fill reaches this mark. */
  .res-bar .reserve,
  .dock-pool-bar .reserve {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: color-mix(in srgb, var(--bar-ink) 25%, transparent);
    pointer-events: none;
  }

  /* Bottomed out — the sickly bar breathes to show your limbs are dragging. */
  .res-bar.exhausted,
  .dock-pool-bar.exhausted {
    animation: sickly 1.8s ease-in-out infinite;
  }

  @keyframes sickly {
    50% {
      opacity: 0.55;
    }
  }

  .res-bar.action-bar .fill {
    transition: none; /* fills every tick; easing would lag behind the reset */
  }

  /* The dock: HP over a row of four. Fixed heights, so no figure moves a pixel. */
  .dock-bars {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .dock-hp {
    height: 18px;
  }

  /* Marks at the right end of the HP bar, over the fill: the label is centred and short. */
  .dock-marks {
    position: absolute;
    inset: 0 4px 0 auto;
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    line-height: 1;
    pointer-events: none;
  }

  .dock-more {
    font-size: 11px;
    color: var(--bar-ink);
    text-shadow:
      -1px 0 var(--bar-halo),
      1px 0 var(--bar-halo),
      0 -1px var(--bar-halo),
      0 1px var(--bar-halo);
  }

  .dock-pools {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .dock-pool {
    display: flex;
    align-items: center;
    gap: 3px;
    min-width: 0;
  }

  .dock-pool-bar {
    flex: 1 1 0;
    min-width: 0;
    height: 8px;
  }
</style>
