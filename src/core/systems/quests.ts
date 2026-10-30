import type { GameState, NpcDef, QuestDef, QuestObjective } from '../types';
import type { EventBus } from '../engine/events';
import { ITEMS, MATERIALS, NPCS, QUESTS, SPOTS } from '../registry';
import { conditionsMet } from './conditions';
import { checkDiscovery, grantDiscoveryXp, grantSkillXp, grantSkillXpDirect } from './skills';
import { createItem } from './runes';
import { bumpStat, setStat } from './achievements';
import { grantFavorAll } from './divine';
import { grantMaterial } from './disciplines';
import { grantLevelXp, questLevelXp } from './levels';
import { text } from '../text/log';

/** Tags an exchange with an NPC trains (see the `speechcraft` skill). */
const SOCIAL_TAGS = ['social'];

/** Base payout for one exchange, before the giver's novelty is applied. */
const QUEST_ACCEPT_XP = 8;

/**
 * A completed job against one new dialogue option — deliberately lopsided.
 * Finishing something is the lesson; hearing a new line is a footnote.
 */
const QUEST_COMPLETE_WEIGHT = 4;

export function npcsAt(spotId: string): NpcDef[] {
  return Object.values(NPCS).filter((n) => n.spotId === spotId);
}

// ---------- Meeting people ----------

/** Where the game remembers a first greeting. Engine-written, like `slain:*`. */
export const metKey = (npcId: string): string => `met:${npcId}`;

export function hasMet(state: GameState, npcId: string): boolean {
  return (state.stats[metKey(npcId)] ?? 0) >= 1;
}

/**
 * Where the game remembers that a quest was taken on, stamped at accept and
 * never cleared within the run. Engine-written. The harbor's side pick is a
 * join quest's stamp (systems/sea.ts `seaSide`), so taking that work is a
 * choice that holds for the run.
 */
export const acceptedKey = (questId: string): string => `flag:quest:${questId}:accepted`;

/**
 * A first greeting: stamps `met:<npcId>` for talk objectives (and anything
 * else that ever wants "have you met X" — the deities-must-be-met design is
 * waiting on exactly this shape). Idempotent; a person already met returns
 * false and costs nothing. Pays the same social lesson taking work does,
 * against the same per-person novelty — a stranger teaches, a fifth hello
 * does not.
 */
export function talkTo(state: GameState, bus: EventBus, npcId: string): boolean {
  const npc = NPCS[npcId];
  if (!npc || state.spot !== npc.spotId) return false;
  if (hasMet(state, npcId)) return false;
  bumpStat(state, bus, metKey(npcId));
  checkDiscovery(state, bus, SOCIAL_TAGS);
  grantSkillXp(state, bus, SOCIAL_TAGS, QUEST_ACCEPT_XP, npcId);
  bus.emit({ type: 'talk', npcId });
  bus.emit({ type: 'log', msg: text('quests.npc_met', { name: npc.name }), kind: 'quest' });
  return true;
}

/** Quests this NPC can offer right now: never accepted + requirements met. */
export function availableQuests(state: GameState, npc: NpcDef): QuestDef[] {
  return npc.quests
    .map((id) => QUESTS[id])
    .filter(
      (q) => q && !state.quests[q.id] && (!q.requirements || conditionsMet(state, q.requirements)),
    );
}

export function activeQuests(state: GameState): QuestDef[] {
  return Object.entries(state.quests)
    .filter(([, qs]) => qs.status === 'active')
    .map(([id]) => QUESTS[id])
    .filter(Boolean);
}

export function acceptQuest(state: GameState, bus: EventBus, questId: string): boolean {
  const quest = QUESTS[questId];
  if (!quest || state.quests[questId]) return false;
  if (state.spot !== NPCS[quest.giver]?.spotId) return false;
  if (quest.requirements && !conditionsMet(state, quest.requirements)) return false;

  state.quests[questId] = { status: 'active', progress: quest.objectives.map(() => 0) };
  setStat(state, bus, acceptedKey(questId), 1);

  // Taking work from someone is a conversation, and the person is what wears
  // out — not the job. Novelty is keyed to the giver, so a fifth errand for
  // Thora teaches far less about people than a first word with a stranger.
  checkDiscovery(state, bus, SOCIAL_TAGS);
  grantSkillXp(state, bus, SOCIAL_TAGS, QUEST_ACCEPT_XP, quest.giver);

  bus.emit({ type: 'quest:accept', id: questId });
  bus.emit({ type: 'log', msg: text('quests.accepted', { name: quest.name }), kind: 'quest' });
  return true;
}

/** Current/target for an objective. Collect objectives read live materials. */
export function objectiveProgress(
  state: GameState,
  quest: QuestDef,
  index: number,
): { current: number; target: number } {
  const objective = quest.objectives[index];
  const stored = state.quests[quest.id]?.progress[index] ?? 0;
  switch (objective.type) {
    case 'kill':
    case 'craft':
      return { current: Math.min(stored, objective.count), target: objective.count };
    case 'reach':
      return { current: Math.min(stored, 1), target: 1 };
    case 'collect':
      return {
        current: Math.min(state.materials[objective.materialId] ?? 0, objective.qty),
        target: objective.qty,
      };
    // Live like collect: greetings and counters are facts about the save, so
    // one made before the quest was accepted still counts.
    case 'talk':
      return { current: hasMet(state, objective.npcId) ? 1 : 0, target: 1 };
    case 'stat':
      return {
        current: Math.min(state.stats[objective.key] ?? 0, objective.value),
        target: objective.value,
      };
  }
}

export function questComplete(state: GameState, quest: QuestDef): boolean {
  if (state.quests[quest.id]?.status !== 'active') return false;
  return quest.objectives.every((_, i) => {
    const p = objectiveProgress(state, quest, i);
    return p.current >= p.target;
  });
}

/** Turning in means standing before the giver with everything done. */
export function canTurnIn(state: GameState, quest: QuestDef): boolean {
  return questComplete(state, quest) && state.spot === NPCS[quest.giver]?.spotId;
}

export function turnInQuest(state: GameState, bus: EventBus, questId: string): boolean {
  const quest = QUESTS[questId];
  if (!quest || !canTurnIn(state, quest)) return false;

  // Collect objectives hand the goods over.
  for (const o of quest.objectives) {
    if (o.type !== 'collect') continue;
    const left = (state.materials[o.materialId] ?? 0) - o.qty;
    if (left > 0) state.materials[o.materialId] = left;
    else delete state.materials[o.materialId];
  }

  const r = quest.rewards;
  const parts: string[] = [];
  if (r.gold) {
    state.gold += r.gold;
    bumpStat(state, bus, 'gold:earned', r.gold);
    parts.push(`${r.gold} gold`);
  }
  for (const m of r.materials ?? []) {
    // Through grantMaterial like every other source, so a GRADED reward lands
    // in stock where the benches read it (paying `state.materials` directly
    // put herbs where no alembic could find them).
    grantMaterial(state, m.id, m.qty);
    parts.push(`${MATERIALS[m.id]?.name ?? m.id} ×${m.qty}`);
  }
  for (const itemId of r.items ?? []) {
    state.inventory.push(createItem(state, itemId));
    parts.push(ITEMS[itemId]?.name ?? itemId);
  }
  for (const sx of r.skillXp ?? []) {
    grantSkillXpDirect(state, bus, sx.id, sx.xp);
  }
  const levelXp = questLevelXp(quest);
  if (levelXp > 0) parts.push(`${levelXp} level XP`);

  state.quests[questId].status = 'done';
  bumpStat(state, bus, 'quests:completed');
  // Seeing a job through is where a talker actually learns something, so it
  // pays as a discovery rather than as one more exchange — and unlike the
  // conversation that started it, this never wears out.
  grantDiscoveryXp(state, bus, 'dialogue', QUEST_COMPLETE_WEIGHT);
  // A deed done for somebody is a deed done, as far as the pantheon is
  // concerned. Today this is favor's only source; deity-aligned deeds and
  // altars will join it. A quest may pay extra favor on top (r.favor) — the
  // introduction lever that makes a first miracle reachable.
  grantFavorAll(state, bus, 1 + (r.favor ?? 0));
  bus.emit({ type: 'quest:complete', id: questId });
  bus.emit({
    type: 'log',
    msg: text('quests.completed', {
      name: quest.name,
      rewards: parts.length ? text('quests.rewards', { list: parts.join(', ') }) : '',
    }),
    kind: 'quest',
  });
  // After the turn-in line, so a level-up reads as its consequence.
  grantLevelXp(state, bus, levelXp);
  return true;
}

function advanceObjectives(
  state: GameState,
  bus: EventBus,
  matches: (o: QuestObjective) => boolean,
  set?: number,
): void {
  for (const quest of activeQuests(state)) {
    let changed = false;
    quest.objectives.forEach((o, i) => {
      if (!matches(o)) return;
      // Live objectives store nothing (collect reads materials, talk reads
      // met:*, stat reads its counter) — no listener ever matches them.
      if (o.type === 'collect' || o.type === 'talk' || o.type === 'stat') return;
      const qs = state.quests[quest.id];
      const target = o.type === 'reach' ? 1 : o.count;
      const next = set !== undefined ? set : qs.progress[i] + 1;
      if (qs.progress[i] < target && next !== qs.progress[i]) {
        qs.progress[i] = Math.min(target, next);
        changed = true;
      }
    });
    if (changed && questComplete(state, quest)) {
      const giver = NPCS[quest.giver];
      bus.emit({
        type: 'log',
        msg: text('quests.ready', { name: quest.name, giver: giver?.name, spot: SPOTS[giver?.spotId ?? '']?.name ?? '?' }),
        kind: 'quest',
      });
    }
  }
}

/** Quest progress rides the event bus — no system needs to know about quests. */
export function registerQuestListeners(state: GameState, bus: EventBus): void {
  bus.on('kill', (ev) =>
    advanceObjectives(state, bus, (o) => o.type === 'kill' && (!o.monsterId || o.monsterId === ev.monster.defId)),
  );
  bus.on('craft', (ev) =>
    advanceObjectives(
      state,
      bus,
      (o) =>
        o.type === 'craft' &&
        (!o.recipeId || o.recipeId === ev.recipe) &&
        (!o.discipline || o.discipline === ev.discipline),
    ),
  );
  bus.on('arrive', (ev) =>
    advanceObjectives(state, bus, (o) => o.type === 'reach' && o.spotId === ev.spot, 1),
  );
}
