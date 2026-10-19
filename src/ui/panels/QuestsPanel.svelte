<script lang="ts">
  import KeyItems from '../KeyItems.svelte';
  import { gs } from '../state.svelte';
  import { NPCS, QUESTS, SPOTS } from '../../core/registry';
  import { activeQuests, objectiveProgress, questComplete } from '../../core/systems/quests';
  import { hasWayfinding } from '../../core/systems/legacy';
  import type { QuestObjective } from '../../core/types';
  import GoButton from '../lib/GoButton.svelte';
  import { TUTORIAL_STEP_LIST } from '../../core/data/tutorial.data';

  /**
   * The tutorial's panels, re-openable for good (COMPLETABILITY.md §3: every
   * system is explained somewhere the player can open again — a one-time
   * tutorial does not count). Folded by default; the floor-0 card points here.
   */
  let guideOpen = $state(false);

  const active = $derived(activeQuests(gs));
  const completed = $derived(
    Object.entries(gs.quests)
      .filter(([, qs]) => qs.status === 'done')
      .map(([id]) => QUESTS[id])
      .filter(Boolean),
  );

  const wayfinding = $derived(hasWayfinding(gs));

  /** Where an objective is done, when it names a place (a person to meet, a spot to reach). */
  function objectiveSpot(objective: QuestObjective): string | null {
    if (objective.type === 'talk') return NPCS[objective.npcId]?.spotId ?? null;
    if (objective.type === 'reach') return objective.spotId;
    return null;
  }

  function giverHint(questId: string): string {
    const giver = NPCS[QUESTS[questId]?.giver];
    const spot = SPOTS[giver?.spotId ?? ''];
    return giver ? `${giver.icon} ${giver.name} — ${spot?.icon ?? ''} ${spot?.name ?? ''}` : '';
  }
</script>

<KeyItems />

<div class="panel">
  <h2>⭐ Quests</h2>
  {#if active.length === 0 && completed.length === 0}
    <p class="dim">
      No quests yet. People with work to offer stand around the settlements — look for the
      People section when you visit a spot.
    </p>
  {/if}

  {#each active as quest (quest.id)}
    <div class="quest" class:ready={questComplete(gs, quest)}>
      <div class="head">
        <span class="name">📜 {quest.name}</span>
        <span class="giver dim small">
          {giverHint(quest.id)}
          {#if wayfinding && NPCS[quest.giver]}<GoButton spot={NPCS[quest.giver].spotId} />{/if}
        </span>
      </div>
      <div class="dim small">{quest.desc}</div>
      {#each quest.objectives as objective, i}
        {@const p = objectiveProgress(gs, quest, i)}
        <div class="objective">
          <span class="small">{objective.desc}</span>
          <div class="bar" style="flex: 1; height: 8px">
            <div
              class="fill"
              style="width: {(p.current / p.target) * 100}%; background: {p.current >= p.target
                ? 'var(--xp)'
                : 'var(--accent)'}"
            ></div>
          </div>
          <span class="small dim">{p.current}/{p.target}</span>
          {#if wayfinding && p.current < p.target && objectiveSpot(objective)}
            <GoButton spot={objectiveSpot(objective)!} />
          {/if}
        </div>
      {/each}
      {#if questComplete(gs, quest)}
        <div class="small ready-note">✅ Ready — return to the quest giver to turn in.</div>
      {/if}
    </div>
  {/each}

  {#if completed.length > 0}
    <h3 style="margin-top: 14px">Completed</h3>
    {#each completed as quest (quest.id)}
      <div class="done small">🎉 {quest.name}</div>
    {/each}
  {/if}

  <button class="guide-toggle" onclick={() => (guideOpen = !guideOpen)}>
    {guideOpen ? '▾' : '▸'} 📘 Guide — the floor 0 tutorial, step by step
  </button>
  {#if guideOpen}
    <ol class="guide">
      {#each TUTORIAL_STEP_LIST as step (step.id)}
        <li>
          <b>{step.title}</b>
          <div class="dim small">{step.desc}</div>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .quest {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 10px;
  }

  .quest.ready {
    border-color: var(--accent);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }

  .giver {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .name {
    font-weight: 600;
  }

  .objective {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }

  .ready-note {
    margin-top: 6px;
    color: var(--accent);
  }

  .done {
    color: var(--text-dim);
    padding: 3px 0;
  }

  .guide-toggle {
    background: none;
    border: none;
    padding: 0;
    margin-top: 14px;
    font-weight: 600;
    font-size: 15px;
  }

  .guide {
    margin: 8px 0 0;
    padding-left: 22px;
  }

  .guide li {
    margin-bottom: 8px;
  }
</style>
