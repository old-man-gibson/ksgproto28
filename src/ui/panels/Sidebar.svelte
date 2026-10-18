<script lang="ts">
  import { gs, view } from '../state.svelte';
  import {
    DAMAGE_TYPE_NAMES,
    RES_STAT_BY_TYPE,
    STAT_NAMES,
    type AttributeId,
    type DamageType,
    type ResourceId,
    type StatKey,
    type SuperAttributeDef,
  } from '../../core/types';
  import { ATTRIBUTE_LIST } from '../../core/data/attributes.data';
  import { SUPERATTRS } from '../../core/registry';
  import { attrValue, effectiveAttrs } from '../../core/systems/attributes';
  import { equippedTitle } from '../../core/systems/titles';
  import { combatRegenMult, currentActivity } from '../../core/systems/actions';
  import {
    attackFillRate,
    actionTicks,
    BASE_ACTION_BAR,
    STAMINA_EFF_FLOOR,
  } from '../../core/systems/derived';
  import {
    EXHAUSTED_REGEN_MULT,
    EXHAUSTED_SLOW_UNTIL,
    EXHAUSTED_SPEED_PENALTY,
    STAMINA_RESERVE,
  } from '../../core/systems/stamina';
  import { availableMax, resourceLock, resourceValue, trueMax } from '../../core/systems/resources';
  import { escalationPrimed, visibleStatuses } from '../../core/systems/statuses';
  import { STATUSES } from '../../core/registry';
  import { statusTipLines } from '../lib/format';
  import { RECOVERY_MULT, RESOURCES } from '../../core/data/resources.data';
  import { fmt, pct, poolText, statTipLines, attrTipLines } from '../lib/format';
  import Tip from '../lib/Tip.svelte';
  import { REFERENCE_BLOW, expectedHitTaken, roughDps } from '../lib/statSummary';

  const stats = $derived(view.stats);

  const barPct = (cur: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0);
  // Every bar reads its pool through the registry: the current value, and the
  // ceiling actually in force (which a wound may have lowered below the stat).
  const cur = (id: ResourceId) => resourceValue(gs, id);
  const cap = (id: ResourceId) => availableMax(gs, stats, id);
  const pool = (id: ResourceId) => poolText(cur(id), cap(id));

  const hpPct = $derived(barPct(cur('hp'), cap('hp')));
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

  const fusedDefs = $derived(Object.values(SUPERATTRS).filter((d) => gs.fused.includes(d.id)));
  const fusedComponents = $derived(new Set(fusedDefs.flatMap((d) => d.components)));
  const soloAttrs = $derived(ATTRIBUTE_LIST.filter((a) => !fusedComponents.has(a.id)));

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

  const eff = $derived(effectiveAttrs(gs));

  const wornTitle = $derived(equippedTitle(gs));
  const afflictions = $derived(visibleStatuses(gs));

  /** Which stat groups are open (per viewer, this session). Closed by default. */
  type StatGroup = 'offense' | 'defense' | 'growth' | 'fortune';
  let openGroups = $state<Record<StatGroup, boolean>>({ offense: false, defense: false, growth: false, fortune: false });

  const resistances = $derived(
    (Object.entries(RES_STAT_BY_TYPE) as [DamageType, StatKey][])
      .map(([type, key]) => ({ type, key, value: stats[key] }))
      .filter((r) => r.value !== 0),
  );
</script>

{#snippet statTip(key: StatKey)}
  {@const lines = statTipLines(gs, key)}
  {#each lines as line, i}
    <div class="tip-line" class:tip-total={i === lines.length - 1} class:tip-base={i === 0}>{line}</div>
  {/each}
{/snippet}

{#snippet statRow(label: string, key: StatKey, display: string)}
  <tr>
    <td class="dim"><Tip>{label}{#snippet tip()}{@render statTip(key)}{/snippet}</Tip></td>
    <td>{display}</td>
  </tr>
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

{#snippet superTip(sup: SuperAttributeDef)}
  <div class="tip-line tip-base">{sup.desc}</div>
  {#each sup.components as compId}
    {@const a = attrInfo(compId)}
    <div class="tip-line">{a.icon} {a.name}: {fmt(eff[compId])}</div>
  {/each}
  <div class="tip-line tip-total">{sup.name}: {fmt(attrValue(gs, sup.components[0]))}</div>
{/snippet}

<div class="panel">
  {#if wornTitle}
    <div class="worn-title" title={wornTitle.desc}>{wornTitle.icon} {wornTitle.name}</div>
  {/if}

  <div class="resources">
    <!-- Row 1: Health, full width -->
    <Tip block>
      <div class="bar res-bar">
        <div class="fill" style="width: {hpPct}%; background: var(--hp)"></div>
        <div class="label">HP {pool('hp')}</div>
      </div>
      {#snippet tip()}
        {@render resTip(`HP ${pool('hp')}`, 'maxHp', hpNotes, 'hpRegen')}
      {/snippet}
    </Tip>

    <!-- Row 2: Stamina | Mana -->
    <div class="res-row">
      <Tip block>
        <div class="bar res-bar" class:exhausted={staminaLock === 'empty'}>
          <div class="fill" style="width: {staminaPct}%; background: {staminaColor}"></div>
          <div class="reserve" style="left: {STAMINA_RESERVE * 100}%"></div>
          <!-- Named, like every other pool. An unlabelled bar is read by its
               colour alone, which is how a full mana bar gets mistaken for a
               resource that was only just added. -->
          <div class="label">{staminaMark}Stamina {pool('stamina')}</div>
        </div>
        {#snippet tip()}
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
      </Tip>
      <Tip block>
        <div class="bar res-bar" class:burning={manaDebt > 0}>
          <div class="fill" style="width: {manaPct}%; background: {manaColor}"></div>
          <div class="label">
            {manaDebt > 0 ? `−${fmt(manaDebt)} burned` : `Mana ${pool('mana')}`}
          </div>
        </div>
        {#snippet tip()}
          {@render poolTip(
            `Mana ${pool('mana')}`,
            'maxMana',
            'manaRegen',
            'manaEff',
            MANA_EFF_FACTORS,
            [`Resting recovers it ×${RESOURCES.mana.restRegenMult} as fast`],
          )}
        {/snippet}
      </Tip>
    </div>

    <!-- Row 3: Spirit | Focus — the two standing pools, one divine, one psionic -->
    <div class="res-row">
      <Tip block>
        <div class="bar res-bar">
          <div class="fill" style="width: {spiritPct}%; background: var(--spirit)"></div>
          <div class="label">Spirit {pool('spirit')}</div>
        </div>
        {#snippet tip()}
          {@render resTip(`Spirit ${pool('spirit')}`, 'maxSpirit', [
            'Reserved for continuous spells & rituals (coming soon)',
          ])}
        {/snippet}
      </Tip>
      <Tip block>
        <div class="bar res-bar">
          <div class="fill" style="width: {focusPct}%; background: var(--focus)"></div>
          <div class="label">Focus {pool('focus')}</div>
        </div>
        {#snippet tip()}
          {@render resTip(`Focus ${pool('focus')}`, 'maxFocus', [
            'The psionic pool. Overload will eat its MAXIMUM while a working is held (coming soon)',
          ])}
        {/snippet}
      </Tip>
    </div>

    <!-- Row 4: Action bar — time until your next attack -->
    <Tip block>
      <div class="bar res-bar action-bar">
        <div class="fill" style="width: {actionPct}%; background: var(--action)"></div>
      </div>
      {#snippet tip()}{@render actionBarTip()}{/snippet}
    </Tip>

    <!-- Row 5: whatever is currently wrong with you. Absent when nothing is. -->
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
  </div>

  <h3>Attributes</h3>

  {#each fusedDefs as sup}
    <div class="super">
      <div class="super-head">
        <span>
          <Tip>
            {sup.icon} {sup.name}
            {#snippet tip()}{@render superTip(sup)}{/snippet}
          </Tip>
        </span>
        <span class="super-value">{Math.round(attrValue(gs, sup.components[0]))}</span>
      </div>
      {#each sup.components as compId}
        {@const attr = attrInfo(compId)}
        {@const delta = Math.round(eff[compId]) - gs.attrs[compId].level}
        <div class="attr component">
          <div class="attr-head">
            <span>
              <Tip>
                {attr.icon} {attr.name}
                {#snippet tip()}
                  {#each attrTipLines(gs, compId) as line, i}
                    <div class="tip-line" class:tip-base={i === 0}>{line}</div>
                  {/each}
                {/snippet}
              </Tip>
            </span>
            <span class="dim">
              {Math.round(eff[compId])}{#if delta !== 0}<span
                  class="delta"
                  class:buff={delta > 0}
                  class:debuff={delta < 0}>({delta > 0 ? '+' : ''}{delta})</span
                >{/if}
            </span>
          </div>
        </div>
      {/each}
    </div>
  {/each}

  {#each soloAttrs as attr}
    {@const delta = Math.round(eff[attr.id]) - gs.attrs[attr.id].level}
    <div class="attr">
      <div class="attr-head">
        <span>
          <Tip>
            {attr.icon} {attr.name}
            {#snippet tip()}
              {#each attrTipLines(gs, attr.id) as line, i}
                <div class="tip-line" class:tip-base={i === 0}>{line}</div>
              {/each}
            {/snippet}
          </Tip>
        </span>
        <span class="dim">
          {Math.round(eff[attr.id])}{#if delta !== 0}<span
              class="delta"
              class:buff={delta > 0}
              class:debuff={delta < 0}>({delta > 0 ? '+' : ''}{delta})</span
            >{/if}
        </span>
      </div>
    </div>
  {/each}
  <div class="dim small hint">Training progress lives in the Skills tab.</div>
</div>

<!--
  Combat stats in four groups (user, 2026-10-17). Each header carries one rough
  number (statSummary.ts says what it leaves out); a click opens the full rows,
  and every row keeps its own breakdown tooltip.
-->
<div class="panel" style="margin-top: 12px">
  <h3>Combat Stats</h3>
  <table class="small">
    <tbody>
      {@render groupHead('offense', '⚔️ Offense', `~${fmt(roughDps(stats))} dmg/s · ${pct(stats.crit)} crit`, 'Weapon damage per second before the target\'s armour and resistances: damage × hits per swing × average crit bonus ÷ attack time. Spells and techniques are not included.')}
      {#if openGroups.offense}
      {@render statRow('Damage', 'damage', fmt(stats.damage))}
      {@render statRow('Speed', 'speed', fmt(stats.speed))}
      {#if Math.round(stats.actionBar) !== BASE_ACTION_BAR}
        {@render statRow('Action Bar', 'actionBar', `${fmt(stats.actionBar)} units`)}
      {/if}
      <tr>
        <td class="dim">
          <Tip>
            Attack Time
            {#snippet tip()}
              <div class="tip-line tip-base">Action Bar ÷ (Speed × Attack Speed)</div>
              <div class="tip-line">
                {fmt(stats.actionBar)} ÷ ({fmt(stats.speed)} × {stats.attackSpeed.toFixed(2)})
              </div>
              <div class="tip-line tip-total">
                = {(actionTicks(stats.actionBar, attackFillRate(stats)) / 10).toFixed(1)}s per attack
              </div>
              {#if stats.attackSpeed !== 1}
                <div class="tip-line tip-sub">Attack Speed ×{stats.attackSpeed.toFixed(2)}:</div>
                {@render statTip('attackSpeed')}
              {/if}
              {#if stats.extraSwings > 0}
                <div class="tip-line tip-sub">
                  At the 0.5s floor — overflow lands as +{stats.extraSwings.toFixed(2)} hits per swing
                </div>
              {/if}
            {/snippet}
          </Tip>
        </td>
        <td>
          {(actionTicks(stats.actionBar, attackFillRate(stats)) / 10).toFixed(1)}s{#if stats.extraSwings > 0}&nbsp;<span class="dim">(+{stats.extraSwings.toFixed(1)})</span>{/if}
        </td>
      </tr>
      {@render statRow('Crit', 'crit', pct(stats.crit))}
      {@render statRow('Crit Damage', 'critDamage', `×${stats.critDamage.toFixed(2)}`)}
      {#if stats.penetration > 0}
        {@render statRow('Penetration', 'penetration', pct(stats.penetration))}
      {/if}
      {#if stats.splash > 0}
        {@render statRow('Splash Damage', 'splash', pct(stats.splash))}
      {/if}
      {@render statRow('Spell Power', 'spellPower', fmt(stats.spellPower))}
      {/if}

      {@render groupHead('defense', '🛡️ Defense', `takes ~${fmt(expectedHitTaken(stats))} of a ${REFERENCE_BLOW} hit`, `What one typical ${REFERENCE_BLOW}-damage physical blow costs you on average: it must get past your dodge, then your parry, then armour, resistance and ward. Averaged over slashing, piercing and bludgeoning; enemy crits are not included.`)}
      {#if openGroups.defense}
      {@render statRow('Armor', 'armor', fmt(stats.armor))}
      {@render statRow('Dodge', 'dodge', pct(stats.dodge))}
      {#if stats.parry > 0}
        <tr>
          <td class="dim">
            <Tip>
              Parry
              {#snippet tip()}
                <div class="tip-line tip-base">
                  Turn a blow aside and cut back for {pct(stats.riposte, 0)} of your damage — free,
                  it never touches your action bar.
                </div>
                {@render statTip('parry')}
              {/snippet}
            </Tip>
          </td>
          <td>{pct(stats.parry)}</td>
        </tr>
        <!-- Parry's second axis. Chance is capped; the answer's force is not,
             so a fencing build reads its progress here long after 50%. -->
        {@render statRow('Riposte', 'riposte', pct(stats.riposte))}
      {/if}
      {#each resistances as r}
        <tr>
          <td class="dim">
            <Tip>
              {DAMAGE_TYPE_NAMES[r.type]} Res.
              {#snippet tip()}{@render statTip(r.key)}{/snippet}
            </Tip>
          </td>
          <td style="color: {r.value > 0 ? 'var(--xp)' : 'var(--danger)'}">{pct(r.value)}</td>
        </tr>
      {/each}
      {/if}

      {@render groupHead('growth', '📈 Growth', `skill ×${stats.skillXp.toFixed(2)} · attribute ×${stats.trainXp.toFixed(2)}`, 'How fast skills and attributes level: multipliers on the XP every action pays.')}
      {#if openGroups.growth}
      {@render statRow('Skill XP', 'skillXp', `×${stats.skillXp.toFixed(2)}`)}
      {@render statRow('Attribute XP', 'trainXp', `×${stats.trainXp.toFixed(2)}`)}
      {/if}

      {@render groupHead('fortune', '💰 Fortune & pace', `loot ×${stats.loot.toFixed(2)} · gold ×${stats.goldGain.toFixed(2)}`, 'What drops and pays, and how fast you travel and craft.')}
      {#if openGroups.fortune}
      {@render statRow('Loot Luck', 'loot', `×${stats.loot.toFixed(2)}`)}
      {@render statRow('Gold Gain', 'goldGain', `×${stats.goldGain.toFixed(2)}`)}
      {@render statRow('Travel Speed', 'travelSpeed', `×${stats.travelSpeed.toFixed(2)}`)}
      {#if stats.craftSpeed !== 1}
        {@render statRow('Craft Speed', 'craftSpeed', `×${stats.craftSpeed.toFixed(2)}`)}
      {/if}
      {/if}
    </tbody>
  </table>
</div>

{#snippet groupHead(id: StatGroup, name: string, summary: string, explain: string)}
  <tr class="stat-group-row">
    <td colspan="2">
      <button
        class="stat-group-btn"
        class:open={openGroups[id]}
        aria-expanded={openGroups[id]}
        onclick={() => (openGroups[id] = !openGroups[id])}
      >
        <span class="stat-group-name">{openGroups[id] ? '▾' : '▸'} {name}</span>
        <Tip>
          <span class="stat-group-sum">{summary}</span>
          {#snippet tip()}<div class="tip-line tip-base">{explain}</div>{/snippet}
        </Tip>
      </button>
    </td>
  </tr>
{/snippet}

<style>
  .stat-group-btn {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    padding: 4px 6px;
    margin-top: 4px;
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    text-align: left;
  }
  .stat-group-btn.open {
    border-color: var(--accent);
  }
  .stat-group-name {
    font-weight: 600;
    white-space: nowrap;
  }
  .stat-group-sum {
    color: var(--text-dim);
    padding-left: 14px;
  }
  .worn-title {
    color: var(--accent);
    font-weight: 600;
    margin-bottom: 8px;
  }

  .resources {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .res-bar.burning {
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
    border: 1px solid var(--danger, #e05555);
    border-radius: 999px;
    background: color-mix(in srgb, var(--danger, #e05555) 14%, transparent);
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
      border-color: var(--danger, #e05555);
    }
    50% {
      box-shadow: 0 0 6px 1px color-mix(in srgb, var(--danger, #e05555) 55%, transparent);
      border-color: color-mix(in srgb, #fff 45%, var(--danger, #e05555));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .affliction.primed {
      animation: none;
      border-color: color-mix(in srgb, #fff 45%, var(--danger, #e05555));
      box-shadow: 0 0 5px 1px color-mix(in srgb, var(--danger, #e05555) 45%, transparent);
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

  .res-row {
    display: flex;
    gap: 4px;
  }

  /* The flex children are now Tip wrappers (block targets), so size those. */
  .res-row > :global(.tip-target) {
    flex: 1 1 0;
    min-width: 0;
  }

  .res-bar {
    height: 16px;
  }

  .res-bar.action-bar {
    height: 8px;
  }

  /* The reserve floor: stances stop spending once the fill reaches this mark. */
  .res-bar .reserve {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgb(255 255 255 / 25%);
    pointer-events: none;
  }

  /* Bottomed out — the sickly bar breathes to show your limbs are dragging. */
  .res-bar.exhausted {
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

  .attr {
    margin-bottom: 8px;
  }

  .attr-head {
    display: flex;
    justify-content: space-between;
    font-size: 13.5px;
    margin-bottom: 3px;
  }

  .hint {
    margin-top: 6px;
  }

  .delta {
    margin-left: 3px;
    font-size: 11.5px;
  }

  .delta.buff {
    color: var(--xp);
  }

  .delta.debuff {
    color: var(--danger);
  }

  .super {
    margin-bottom: 10px;
    padding: 8px;
    border: 1px solid var(--accent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--accent) 7%, var(--bg-panel));
  }

  .super-head {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
    color: var(--accent);
    margin-bottom: 6px;
  }

  .super-value {
    font-size: 16px;
  }

  .component {
    margin-left: 10px;
    opacity: 0.8;
  }

  .component .attr-head {
    font-size: 12.5px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  td {
    padding: 2.5px 0;
  }

  td:last-child {
    text-align: right;
  }

  :global(.tip-line) {
    color: var(--xp);
  }

  :global(.tip-line.tip-base) {
    color: var(--text-dim);
    margin-bottom: 2px;
  }

  :global(.tip-line.tip-total) {
    color: var(--accent);
    font-weight: 600;
    border-top: 1px solid var(--border);
    margin-top: 3px;
    padding-top: 3px;
  }

  :global(.tip-line.tip-sub) {
    color: var(--text-dim);
    margin-top: 4px;
  }
</style>
