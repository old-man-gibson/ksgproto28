<script lang="ts">
  import { gs } from '../state.svelte';
  import { NPCS, QUESTS, SPOTS } from '../../core/registry';
  import { activeQuests, objectiveProgress, questComplete } from '../../core/systems/quests';

  const active = $derived(activeQuests(gs));
  const completed = $derived(
    Object.entries(gs.quests)
      .filter(([, qs]) => qs.status === 'done')
      .map(([id]) => QUESTS[id])
      .filter(Boolean),
  );

  function giverHint(questId: string): string {
    const giver = NPCS[QUESTS[questId]?.giver];
    const spot = SPOTS[giver?.spotId ?? ''];
    return giver ? `${giver.icon} ${giver.name} — ${spot?.icon ?? ''} ${spot?.name ?? ''}` : '';
  }
</script>

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
        <span class="dim small">{giverHint(quest.id)}</span>
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
</style>
