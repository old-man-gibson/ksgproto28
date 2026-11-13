<script lang="ts">
  import { gs, view } from '../state.svelte';
  import {
    DAMAGE_TYPE_NAMES,
    RES_STAT_BY_TYPE,
    type DamageType,
    type StatKey,
    type SuperAttributeDef,
  } from '../../core/types';
  import { ATTRIBUTE_LIST } from '../../core/data/attributes.data';
  import { SUPERATTRS } from '../../core/registry';
  import { attrValue, effectiveAttrs } from '../../core/systems/attributes';
  import { attackFillRate, actionTicks, BASE_ACTION_BAR } from '../../core/systems/derived';
  import { attrCeiling } from '../../core/systems/statuses';
  import { fmt, pct, statTipLines, attrTipLines } from '../lib/format';
  import type { Snippet } from 'svelte';
  import Tip from '../lib/Tip.svelte';
  import Icon from '../lib/icons/Icon.svelte';
  import ResourceBars from './ResourceBars.svelte';
  import { REFERENCE_BLOW, expectedHitTaken, roughDps } from '../lib/statSummary';

  /**
   * `combatStats` is off on floor 0: the tutorial shows the bars, not the stat
   * sheet (App.svelte). `nav` is the screen list, drawn between the resource
   * panel and the attributes. `phone` is the one-column layout (docs/PHONE.md):
   * the pools are in the dock (Dock.svelte), so this column draws the rest of
   * the resource panel (conditions, dishes, the level bar) with no pools, and
   * App.svelte passes no `nav` (the screen list is the bottom row).
   */
  let { combatStats = true, nav, phone = false }: { combatStats?: boolean; nav?: Snippet; phone?: boolean } = $props();

  const stats = $derived(view.stats);

  const fusedDefs = $derived(Object.values(SUPERATTRS).filter((d) => gs.fused.includes(d.id)));
  const fusedComponents = $derived(new Set(fusedDefs.flatMap((d) => d.components)));
  const soloAttrs = $derived(ATTRIBUTE_LIST.filter((a) => !fusedComponents.has(a.id)));

  function attrInfo(id: (typeof ATTRIBUTE_LIST)[number]['id']) {
    return ATTRIBUTE_LIST.find((a) => a.id === id)!;
  }

  const eff = $derived(effectiveAttrs(gs));
  /** Weakest Weapon Master's ceiling: formulas read an attribute above it at the ceiling. */
  const ceiling = $derived(attrCeiling(gs));

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

{#snippet superTip(sup: SuperAttributeDef)}
  <div class="tip-line tip-base">{sup.desc}</div>
  {#each sup.components as compId}
    {@const a = attrInfo(compId)}
    <div class="tip-line"><Icon of={a} /> {a.name}: {fmt(eff[compId])}</div>
  {/each}
  <div class="tip-line tip-total">{sup.name}: {fmt(attrValue(gs, sup.components[0]))}</div>
{/snippet}

<!-- The resource panel: the pools, conditions, dishes and level (ResourceBars.svelte). -->
<ResourceBars mode={phone ? 'extras' : 'panel'} />

{@render nav?.()}

<!--
  Attributes as chips: the icon and the effective value, one per solo attribute
  and one per fused pair. The names and breakdowns are in the tooltips.
-->
<div class="panel">
  <h3>Attributes</h3>
  <div class="attr-chips">
    {#each fusedDefs as sup (sup.id)}
      {@const capped = ceiling !== null && attrValue(gs, sup.components[0]) > ceiling}
      <Tip block>
        <div class="attr-chip attr-chip-fused">
          <Icon of={sup} />
          <span class="attr-chip-name">{sup.name}</span>
          <!-- Above Weakest Weapon Master's ceiling the chip shows what formulas
               read; the real value is in the hover (attrTipLines). -->
          <span class="attr-chip-value"
            >{#if capped}<span class="capped">{ceiling}</span>{:else}{Math.round(attrValue(gs, sup.components[0]))}{/if}</span
          >
        </div>
        {#snippet tip()}
          {@render superTip(sup)}
          {#each sup.components as compId (compId)}
            <div class="tip-line tip-sub">{attrInfo(compId).name}:</div>
            {#each attrTipLines(gs, compId) as line}
              <div class="tip-line">{line}</div>
            {/each}
          {/each}
        {/snippet}
      </Tip>
    {/each}

    {#each soloAttrs as attr (attr.id)}
      {@const delta = Math.round(eff[attr.id]) - gs.attrs[attr.id].level}
      {@const capped = ceiling !== null && eff[attr.id] > ceiling}
      <Tip block>
        <div class="attr-chip">
          <Icon of={attr} />
          <span class="attr-chip-name">{attr.name}</span>
          <!-- Above Weakest Weapon Master's ceiling the chip shows what formulas
               read; the real value and the bonus are in the hover (attrTipLines). -->
          <span class="attr-chip-value" class:buff={!capped && delta > 0} class:debuff={!capped && delta < 0}
            >{#if capped}<span class="capped">{ceiling}</span>{:else}{Math.round(eff[attr.id])}{/if}</span
          >
        </div>
        {#snippet tip()}
          {#each attrTipLines(gs, attr.id) as line, i}
            <div class="tip-line" class:tip-base={i === 0}>{line}</div>
          {/each}
        {/snippet}
      </Tip>
    {/each}
  </div>
  <div class="dim small hint">Training progress lives in the Skills tab.</div>
</div>

<!--
  Combat stats in four groups (user, 2026-10-17). Each header carries one rough
  number (statSummary.ts says what it leaves out); a click opens the full rows,
  and every row keeps its own breakdown tooltip.
-->
{#if combatStats}
<div class="panel">
  <h3>Combat Stats</h3>
  <table class="small">
    <tbody>
      {@render groupHead('offense', '⚔️ Offense', `~${fmt(roughDps(stats))} dmg/s · ${pct(stats.crit)} crit`, [
        'Weapon damage per second, before the target\'s armor and resistances.',
        'Formula: damage × hits per swing × average crit bonus ÷ attack time.',
        'Not counted: spells, techniques, splash.',
      ])}
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

      {@render groupHead('defense', '🛡️ Defense', `takes ~${fmt(expectedHitTaken(stats))} of a ${REFERENCE_BLOW} hit`, [
        `Health you lose to one ${REFERENCE_BLOW}-damage physical blow, on average.`,
        'Order: Dodge, Parry, Armor, resistance, Damage Taken, Ward.',
        'Averaged over slashing, piercing and bludgeoning.',
        'Not counted: enemy crits, your stance and position, darkness, conditions that make enemies miss.',
      ])}
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
          <td style="color: {r.value > 0 ? 'var(--xp-ink)' : 'var(--danger)'}">{pct(r.value)}</td>
        </tr>
      {/each}
      {/if}

      {@render groupHead('growth', '📈 Growth', `skill ×${stats.skillXp.toFixed(2)} · attribute ×${stats.trainXp.toFixed(2)}`, [
        'Skill XP: multiplier on all skill XP.',
        'Attribute XP: multiplier on attribute XP from activities.',
        'Attribute XP from fighting is not multiplied.',
      ])}
      {#if openGroups.growth}
      {@render statRow('Skill XP', 'skillXp', `×${stats.skillXp.toFixed(2)}`)}
      {@render statRow('Attribute XP', 'trainXp', `×${stats.trainXp.toFixed(2)}`)}
      {/if}

      {@render groupHead('fortune', '💰 Fortune & pace', `loot ×${stats.loot.toFixed(2)} · gold ×${stats.goldGain.toFixed(2)}`, [
        'Loot Luck: multiplier on monster drops, gathering and exploring finds.',
        'Gold Gain: multiplier on gold from kills, paid work and selling.',
        'Also listed: Travel Speed. Craft Speed and food stats appear once they change from base.',
      ])}
      {#if openGroups.fortune}
      {@render statRow('Loot Luck', 'loot', `×${stats.loot.toFixed(2)}`)}
      {@render statRow('Gold Gain', 'goldGain', `×${stats.goldGain.toFixed(2)}`)}
      {@render statRow('Travel Speed', 'travelSpeed', `×${stats.travelSpeed.toFixed(2)}`)}
      {#if stats.craftSpeed !== 1}
        {@render statRow('Craft Speed', 'craftSpeed', `×${stats.craftSpeed.toFixed(2)}`)}
      {/if}
      <!-- Cooking's milestones (docs/CONTENT_GUIDE.md, food): how long and how hard eaten food works. -->
      {#if stats.foodDuration !== 1}
        {@render statRow('Food Duration', 'foodDuration', pct(stats.foodDuration))}
      {/if}
      {#if stats.foodPotency !== 1}
        {@render statRow('Food Potency', 'foodPotency', pct(stats.foodPotency))}
      {/if}
      {/if}
    </tbody>
  </table>
</div>
{/if}

{#snippet groupHead(id: StatGroup, name: string, summary: string, explain: string[])}
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
          {#snippet tip()}
            {#each explain as line, i}
              <div class="tip-line" class:tip-base={i === 0}>{line}</div>
            {/each}
          {/snippet}
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
  .hint {
    margin-top: 6px;
  }

  /* Three to a row; six attributes make 3 x 2, a fused pair takes one cell. */
  .attr-chips {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
  }
  /* Weakest Weapon Master: the value formulas use, held at the ceiling. */
  .capped {
    color: var(--accent);
  }

  .attr-chip {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    padding: 3px 6px;
    border: 1px solid var(--frame, var(--border));
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }

  /* A fused pair reads as one stronger attribute. */
  .attr-chip-fused {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }

  /* The icon carries the name for sighted players; this keeps it for screen readers. */
  .attr-chip-name {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .attr-chip-value.buff {
    color: var(--xp-ink);
  }

  .attr-chip-value.debuff {
    color: var(--danger);
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
</style>
