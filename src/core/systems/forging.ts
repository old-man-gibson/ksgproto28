import type {
  CraftDisciplineDef,
  ForgedPart,
  ForgeSlot,
  GameState,
  ItemClassDef,
  ItemDef,
  ItemInstance,
  Placement,
  QualityTier,
} from '../types';
import type { EventBus } from '../engine/events';
import { DISCIPLINES } from '../data/disciplines.data';
import { QUALITY_TIERS } from '../data/quality.data';
import { FORGE_SLOTS } from '../data/parts.data';
import { forgedIdOf } from '../data/itemclasses.data';
import { MATERIALS } from '../registry';
import {
  classifyPlacement,
  forgeStats,
  forgeTicks,
  forgedDef,
  partsOf,
  placementCost,
  placementProblem,
  type ForgeStats,
} from './assembly';
import { rollQuality, skillLevel } from './disciplines';
import { checkDiscovery, grantSkillXp } from './skills';
import { bumpStat } from './achievements';
import { logRepeat } from './log';
import { nextUid } from './equipment';
import { text } from '../text/log';

/**
 * Modular smithing, the stateful half: what the anvil does to a save. The
 * resolver it stands on (classes, the kernel, the derived definition) is
 * systems/assembly.ts and reads no state; this file adds the skill gates, the
 * stock and the job.
 *
 * A forging job is a benchwork job (systems/benchwork.ts): one placement,
 * repeated `count` times, nothing spent until a piece lands, and walking away
 * or being drawn into a fight cancels it at no cost. `Game.forge` starts one.
 */

/** The bench. `assembles: true` is what makes benchwork route a job here. */
export const FORGING: CraftDisciplineDef = DISCIPLINES.forging;

/** The grade a preview is drawn at: the real grade is rolled when the piece lands. */
export const PREVIEW_QUALITY: QualityTier = 'c';

/** One line of the bill: a material, how many whole units, how many are held. */
export interface ForgeCostLine {
  id: string;
  qty: number;
  held: number;
}

export interface ForgePreview {
  /** Can this be forged right now: valid, unlocked and paid for. */
  ok: boolean;
  /** Why not, when it cannot. The first failure only. */
  reason?: string;
  /** What the placement is. */
  class: ItemClassDef;
  /** The item it makes, at Fair quality (`forgedDef({ parts, q })` for any other grade). */
  def: ItemDef;
  /** The numbers behind `def`, at Fair quality. */
  stats: ForgeStats;
  /** The parts as an item would store them. */
  parts: ForgedPart[];
  /** The bill: each material, whole units, and how many of each are in the pack. */
  cost: ForgeCostLine[];
  /** Bench ticks before the smith's speed. `benchJobTicks(state, FORGING, {}, undefined, placement)` is the real clock. */
  ticks: number;
  /** Every material of the bill is held in full. */
  affordable: boolean;
  /** Slots still shut at this Smithing level, with the level each opens at. Open slots are absent. */
  slotLocks: Partial<Record<ForgeSlot, number>>;
}

/**
 * Whether this class has been made on this save, by the anvil or by a recipe
 * line whose parts resolve to it. The form chart shows a class's name once it
 * has ("?" otherwise) — discovery in place of an unlock. Read from the
 * `forged:<classId>` counter, which `forgeOnce` and the recipe craft bump.
 */
export function formKnown(state: GameState, classId: string): boolean {
  return (state.stats[`forged:${classId}`] ?? 0) >= 1;
}

/** The anvil's slots that are still shut to this smith, and the level that opens each. */
export function forgeSlotLocks(state: GameState): Partial<Record<ForgeSlot, number>> {
  const level = skillLevel(state, FORGING);
  const locks: Partial<Record<ForgeSlot, number>> = {};
  for (const slot of FORGING.slots) {
    if ((slot.unlockLevel ?? 0) > level) locks[slot.id as ForgeSlot] = slot.unlockLevel;
  }
  return locks;
}

/**
 * What the anvil would do with this placement, without spending anything.
 * The class, definition and cost are always filled in (the resolver is total,
 * so even a nonsense layout names a product); `ok` says whether it can be
 * forged right now.
 */
export function previewForge(state: GameState, placement: Placement): ForgePreview {
  const cls = classifyPlacement(placement);
  const stats = forgeStats(placement, PREVIEW_QUALITY, cls);
  const parts = partsOf(placement);
  const def = forgedDef({ parts, q: PREVIEW_QUALITY });
  const cost = placementCost(placement).map((c) => ({ ...c, held: state.materials[c.id] ?? 0 }));
  const affordable = cost.every((c) => c.held >= c.qty);
  const slotLocks = forgeSlotLocks(state);

  let reason = placementProblem(placement) ?? undefined;
  if (!reason) {
    for (const slot of FORGE_SLOTS) {
      const need = slotLocks[slot];
      if (placement[slot] && need !== undefined) {
        reason = text('forging.reason.slot_locked', { slot: FORGING.slots.find((s) => s.id === slot)?.name ?? slot, level: need });
        break;
      }
    }
  }
  if (!reason && !affordable) {
    const short = cost.find((c) => c.held < c.qty)!;
    reason = text('forging.reason.short', {
      material: MATERIALS[short.id]?.name ?? short.id,
      held: short.held,
      need: short.qty,
    });
  }
  return {
    ok: reason === undefined,
    ...(reason ? { reason } : {}),
    class: cls,
    def,
    stats,
    parts,
    cost,
    ticks: forgeTicks(placement),
    affordable,
    slotLocks,
  };
}

/**
 * Finish one piece: spend the bill, roll the grade from Smithing, and put the
 * forged item in the pack. Null when the placement cannot be forged (the
 * reason is logged), which stops a run.
 *
 * The grade rolls the way a cook's does (`rollQuality`, luck from skill level).
 * There is no smithing tool yet, so nothing caps it.
 */
export function forgeOnce(state: GameState, bus: EventBus, placement: Placement): ItemInstance | null {
  const check = previewForge(state, placement);
  if (!check.ok) {
    if (check.reason) bus.emit({ type: 'log', msg: text('common.locked', { reason: check.reason }), kind: 'danger' });
    return null;
  }

  for (const c of check.cost) {
    const left = (state.materials[c.id] ?? 0) - c.qty;
    if (left > 0) state.materials[c.id] = left;
    else delete state.materials[c.id];
  }

  const q = rollQuality(state, 1 + skillLevel(state, FORGING) / 20);
  const item: ItemInstance = {
    uid: nextUid(state),
    defId: forgedIdOf(check.class.id),
    slots: 0,
    runes: [],
    size: 'medium',
    forged: { parts: check.parts, q },
  };
  state.inventory.push(item);

  // The form chart fills in from this counter: a class shows its name once it
  // has been forged (a recipe craft counts too, actions.ts).
  bumpStat(state, bus, `forged:${check.class.id}`);
  bumpStat(state, bus, 'crafts');
  checkDiscovery(state, bus, [FORGING.tag]);
  grantSkillXp(state, bus, ['craft', FORGING.tag], FORGING.xp + 0.2 * check.ticks, [`forging:${check.class.id}`]);
  bus.emit({ type: 'craft', discipline: FORGING.id });

  const made = forgedDef(item.forged!);
  logRepeat(bus, {
    group: `bench:${FORGING.id}`,
    prefix: text('forging.forged'),
    tally: [{ label: `${made.icon} ${QUALITY_TIERS[q].name} ${made.name}`, qty: 1 }],
    kind: 'item',
  });
  return item;
}
