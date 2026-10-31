<script lang="ts">
  import { gs, game } from '../state.svelte';
  import { POSITIONS, SKILLS, TECHNIQUES } from '../../core/registry';
  import { ANY_POSITION_COLOR, MAX_DRILLED } from '../../core/data/martial.data';
  import {
    entryPositions,
    isDrilled,
    masteryTier,
    masteryTierName,
    repsToNextTier,
    techniqueDisplayName,
    techniqueExecutions,
    techniqueExit,
    techniqueForm,
  } from '../../core/systems/martial';
  import { findSpell, resolveSpell } from '../../core/systems/spellcraft';
  import { GENE_ACTIVE, geneAbility } from '../../core/systems/mutagens';
  import {
    TRIGGER_EVENTS,
    TRIGGER_SUBJECTS,
    describeCondition,
    opsFor,
    visibleTriggerSubjects,
  } from '../../core/systems/triggers';
  import type { TriggerCondition } from '../../core/types';
  import { geneAbilityLines, pct, specLines, targetLabel, techniqueMoveText, ticksToTime } from './format';
  import Modal from './Modal.svelte';

  /**
   * Where one rotation entry is configured — the detail that used to live
   * inline on every Active Skills card, lifted into a window so the cards can
   * stay one line tall.
   *
   * Deliberately id-agnostic: a rotation entry is a skill id, a prepared spell
   * (`grimoire:<uid>`) or a technique (`technique:<id>`), and all three are
   * triggered through the same `skillTriggers` overlay. The planner only ever
   * opens it for techniques; the Active Skills list opens it for anything.
   */
  let { id, onclose }: { id: string; onclose: () => void } = $props();

  const tech = $derived(
    id.startsWith('technique:') ? (TECHNIQUES[id.slice('technique:'.length)] ?? null) : null,
  );
  const spell = $derived(
    id.startsWith('grimoire:') ? (findSpell(gs, Number(id.slice('grimoire:'.length))) ?? null) : null,
  );
  const skill = $derived(SKILLS[id] ?? null);

  // A gene ability has no SKILLS entry to name itself from — the body is its
  // own source — so it heads the window with what the chromosome expresses.
  const gene = $derived(id === GENE_ACTIVE ? (geneAbility(gs) ?? null) : null);

  const heading = $derived.by(() => {
    if (tech) return { icon: tech.icon, name: techniqueDisplayName(gs, tech) };
    if (spell) {
      const spec = resolveSpell(spell);
      return { icon: spec.icon, name: spec.name };
    }
    if (gene) return { icon: gene.icon, name: gene.name };
    return { icon: skill?.icon ?? '•', name: skill?.name ?? id };
  });

  const trigger = $derived(gs.skillTriggers[id]);
  // Techniques you have not learned are not offered as conditions — asking
  // after them would spoil them (a stored condition still evaluates fine).
  const subjects = $derived(visibleTriggerSubjects(gs));

  /** A fresh condition for the given subject, with sensible op/value defaults. */
  function freshCondition(subjectId: string): TriggerCondition {
    const subject = TRIGGER_SUBJECTS[subjectId];
    const op = opsFor(subject.kind)[0];
    const value = subject.kind === 'enum' ? (subject.options?.(gs)[0]?.value ?? '') : 50;
    return { subject: subjectId, op, value };
  }

  /** Changing the subject may switch kinds, so reset op/value to match. */
  function onSubjectChange(index: number, subjectId: string) {
    game.updateSkillCondition(id, index, freshCondition(subjectId));
  }

  const eventName = (ev: string) => TRIGGER_EVENTS.find((e) => e.id === ev)?.name ?? ev;
</script>

<Modal {onclose}>
  {#snippet title()}
    <b>{heading.icon} {heading.name}</b>
    {#if tech}<span class="dim small">— technique</span>
    {:else if spell}<span class="dim small">— prepared spell</span>{/if}
  {/snippet}

  <!-- What the entry IS, before what you want from it. A technique's baked
       reflex is shown read-only on purpose: your overlay can narrow a reflex
       or switch it off, never widen it (MARTIAL.md §3). -->
  {#if tech}
    <p class="dim small ctx">{tech.desc}</p>
    <p class="small ctx">{techniqueMoveText(gs, tech)}</p>
    {@const from = entryPositions(gs, tech)}
    {@const exit = POSITIONS[techniqueExit(gs, tech)]}
    <p class="small ctx flow">
      <span class="dim">🥋</span>
      {#if from === 'any'}
        <span class="pos-pill" style="--pc: {ANY_POSITION_COLOR}">any</span>
      {:else}
        {#each from as p (p)}
          <span class="pos-pill" style="--pc: {POSITIONS[p]?.color ?? ANY_POSITION_COLOR}">
            {POSITIONS[p]?.icon} {POSITIONS[p]?.name ?? p}
          </span>
        {/each}
      {/if}
      <span class="dim">→</span>
      <span class="pos-pill" style="--pc: {exit?.color ?? ANY_POSITION_COLOR}">
        {exit?.icon} {exit?.name}
      </span>
    </p>
    {#if tech.trigger?.event || tech.trigger?.conditions.length}
      <p class="small ctx baked">
        ⚡ Built-in reflex: {[
          ...(tech.trigger.event ? [eventName(tech.trigger.event)] : []),
          ...tech.trigger.conditions.map((c) => describeCondition(c, gs)),
        ].join(' · ')} — yours can only narrow it.
      </p>
    {/if}

    {@const tier = masteryTier(gs, tech)}
    {@const tierName = masteryTierName(tech, tier)}
    {@const toNext = repsToNextTier(gs, tech)}
    {@const drilled = isDrilled(gs, tech.id)}
    <div class="drill-row">
      <span class="dim small">
        {techniqueExecutions(gs, tech.id)} reps{tierName ? ` · ${tierName}` : ''}{techniqueForm(
          gs,
          tech.id,
        ) === 'rough'
          ? ' · rough'
          : ''}{toNext !== undefined && drilled ? ` · next in ${toNext}` : ''}
      </span>
      <button class="tiny drill" class:on={drilled} onclick={() => game.toggleDrill(tech.id)}>
        {drilled ? '🏋️ Drilling' : 'Drill'}
      </button>
    </div>
    {#if !drilled}
      <p class="dim small ctx">Only drilled techniques bank reps — {MAX_DRILLED} slots.</p>
    {/if}
  {:else if spell}
    {@const spec = resolveSpell(spell)}
    {#if spec.desc}<p class="dim small ctx">{spec.desc}</p>{/if}
    <!-- The same lines the grimoire prints, so a spell can never describe
         itself one way on its page and another way in the fight. -->
    {#each specLines(spec) as line}
      <p class="small ctx">{line}</p>
    {/each}
    <p class="dim small ctx">
      {targetLabel(spec)}{spec.manaCost > 0 ? ` · 💧${spec.manaCost}` : ''}{spec.focusCost
        ? ` · 🧠${spec.focusCost.toFixed(1)}`
        : ''}{spec.staminaCost ? ` · 🫁${pct(spec.staminaCost, 0)}` : ''} · ⟳ {ticksToTime(spec.cooldown)}
    </p>
  {:else if gene}
    <!-- Same words the rotation card uses, for the same reason a spell reuses
         the grimoire's: one description, wherever it is read. -->
    {#each geneAbilityLines(gs) as line}
      <p class="small ctx">{line}</p>
    {/each}
    <p class="dim small ctx">From your chromosome · ⟳ {ticksToTime(gene.spec.cooldown)}</p>
  {:else if skill}
    <p class="dim small ctx">{skill.desc}</p>
  {/if}

  <div class="editor">
    <label class="row">
      <input
        type="checkbox"
        checked={trigger?.enabled !== false}
        onchange={(e) => game.setSkillEnabled(id, e.currentTarget.checked)}
      />
      <span class="small">Enabled</span>
    </label>

    <label class="row">
      <span class="small dim">Event</span>
      <select
        value={trigger?.event ?? ''}
        onchange={(e) => game.setSkillEvent(id, e.currentTarget.value || undefined)}
      >
        <option value="">— any time —</option>
        {#each TRIGGER_EVENTS as ev}<option value={ev.id}>{ev.name}</option>{/each}
      </select>
    </label>

    {#each trigger?.conditions ?? [] as cond, ci}
      {@const subject = TRIGGER_SUBJECTS[cond.subject]}
      <div class="row cond">
        <select value={cond.subject} onchange={(e) => onSubjectChange(ci, e.currentTarget.value)}>
          {#each subjects as s}<option value={s.id}>{s.name}</option>{/each}
        </select>
        <select
          value={cond.op}
          onchange={(e) => game.updateSkillCondition(id, ci, { op: e.currentTarget.value as never })}
        >
          {#each opsFor(subject?.kind ?? 'number') as op}<option value={op}>{op}</option>{/each}
        </select>
        {#if subject?.kind === 'enum'}
          <select
            value={String(cond.value)}
            onchange={(e) => game.updateSkillCondition(id, ci, { value: e.currentTarget.value })}
          >
            {#each subject.options?.(gs) ?? [] as o}<option value={o.value}>{o.label}</option>{/each}
          </select>
        {:else}
          <span class="num">
            <input
              type="number"
              value={cond.value}
              onchange={(e) =>
                game.updateSkillCondition(id, ci, { value: Number(e.currentTarget.value) })}
            />
            {#if subject?.unit === '%'}<span class="dim small">%</span>{/if}
          </span>
        {/if}
        <button class="tiny" onclick={() => game.removeSkillCondition(id, ci)} aria-label="Remove"
          >✕</button
        >
      </div>
    {/each}

    <button
      class="small add"
      onclick={() => game.addSkillCondition(id, freshCondition(subjects[0].id))}
    >
      + Add condition
    </button>
    <p class="dim small foot">Saved plans remember these conditions — see Loadouts.</p>
  </div>
</Modal>

<style>
  .ctx {
    margin: 0 0 5px;
  }

  .baked {
    color: var(--xp);
  }

  .flow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 3px;
  }

  .pos-pill {
    display: inline-block;
    padding: 0 6px 1px;
    border: 1px solid var(--pc);
    border-radius: 999px;
    background: color-mix(in srgb, var(--pc) 16%, transparent);
    font-size: 10.5px;
    line-height: 1.5;
    white-space: nowrap;
  }

  .drill-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    margin: 6px 0 4px;
  }

  button.drill.on {
    border-color: var(--stamina);
    background: color-mix(in srgb, var(--stamina) 14%, var(--bg-raised));
  }

  .editor {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .cond select,
  .cond input {
    min-width: 0;
  }

  .cond select:first-child {
    flex: 1;
  }

  .num {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .num input {
    width: 72px;
  }

  select,
  input[type='number'] {
    font: inherit;
    font-size: 12.5px;
    color: var(--text);
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 6px;
  }

  .add {
    align-self: flex-start;
  }

  .tiny {
    padding: 1px 6px;
    font-size: 11px;
    line-height: 1.4;
  }

  .foot {
    margin: 2px 0 0;
  }
</style>
