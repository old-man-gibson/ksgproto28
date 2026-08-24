import type {
  DeityDef,
  DeityRelation,
  DeityRelationRule,
  GameState,
  PantheonDef,
} from '../types';
import { DEITIES, DEITY_LIST, DEITY_TAGS, PANTHEONS } from '../data/deities.data';

/**
 * How the pantheon regards itself.
 *
 * Rules are declared per deity, from that deity's point of view; a pair's
 * relation is resolved from BOTH sides, and one side's grudge outweighs the
 * other side's fondness — hostility wins, always. A deity is friendly with
 * itself: successive castings of one power's miracles resonate.
 */

/** Does `rule` apply to a deity carrying `tags`? */
function ruleMatches(rule: DeityRelationRule, tags: string[]): boolean {
  if (!rule.anyOf.some((t) => tags.includes(t))) return false;
  if (rule.unless?.some((t) => tags.includes(t))) {
    // The exception itself can be waived ("...unless also honorable").
    return rule.waiver?.some((t) => tags.includes(t)) ?? false;
  }
  return true;
}

function declares(rules: DeityRelationRule[] | undefined, other: DeityDef): boolean {
  return (rules ?? []).some((r) => ruleMatches(r, other.tags));
}

/** The standing between two deities. Order does not matter. */
export function deityRelation(aId: string, bId: string): DeityRelation {
  if (aId === bId) return 'synergy';
  const a = DEITIES[aId];
  const b = DEITIES[bId];
  if (!a || !b) return 'neutral';
  if (declares(a.hostilities, b) || declares(b.hostilities, a)) return 'hostile';
  if (declares(a.synergies, b) || declares(b.synergies, a)) return 'synergy';
  return 'neutral';
}

/** Every deity standing in the given relation to this one. For the UI. */
export function deitiesInRelation(id: string, relation: DeityRelation): DeityDef[] {
  return DEITY_LIST.filter((d) => d.id !== id && deityRelation(id, d.id) === relation);
}

// ---------- Browsing the pantheon ----------

/**
 * Which powers match a filter. Tags OR within an axis and AND across them —
 * "a tribal god who is bestial OR humanoid" — exactly as the bestiary reads
 * its own filters, so the two shelves behave the same way under the hand.
 * A search matches a name, an epithet, or the text of what the god is like.
 */
export function queryDeities(query: { search?: string; tags?: string[] } = {}): DeityDef[] {
  const needle = query.search?.trim().toLowerCase() ?? '';
  const wanted = query.tags ?? [];

  // Group the chosen tags by their axis; every axis present must be satisfied.
  const byAxis = new Map<string, string[]>();
  for (const id of wanted) {
    const axis = DEITY_TAGS[id]?.category ?? 'other';
    byAxis.set(axis, [...(byAxis.get(axis) ?? []), id]);
  }

  return DEITY_LIST.filter((d) => {
    for (const ids of byAxis.values()) {
      if (!ids.some((t) => d.tags.includes(t))) return false;
    }
    if (!needle) return true;
    return `${d.name} ${d.epithet} ${d.desc}`.toLowerCase().includes(needle);
  });
}

/**
 * The body a power is counted among, if any.
 *
 * Membership is normally a TAG (`category: 'membership'`), because the tag
 * already carries the pantheon's name and glyph — so a god states its
 * allegiance once, in the same breath as the rest of its aspects, and the
 * filter shelf gets a Pantheon axis for free. An explicit `pantheon` field
 * wins when set, and a registered `PANTHEONS` entry enriches either (a
 * description the tag has no room for).
 */
export function pantheonOf(d: DeityDef): PantheonDef | null {
  const claimed = d.pantheon ?? d.tags.find((t) => DEITY_TAGS[t]?.category === 'membership');
  if (!claimed) return null;
  const registered = PANTHEONS[claimed];
  if (registered) return registered;
  const tag = DEITY_TAGS[claimed];
  // A tag is enough to shelve by; an unknown claim leaves the god standing
  // alone rather than vanishing from the shelf entirely.
  return tag ? { id: tag.id, name: tag.name, icon: tag.icon } : null;
}

/** A pantheon and the powers that claim it; `pantheon` is null for the rest. */
export interface DeityGroup {
  pantheon: PantheonDef | null;
  deities: DeityDef[];
}

/**
 * Powers arranged for the shelf: each pantheon with its own, then everyone
 * who stands alone. Membership is the deity's claim (`DeityDef.pantheon`), so
 * a pantheon needs no roster and an unknown pantheon id simply leaves its
 * claimant unaffiliated rather than vanishing.
 */
export function deityGroups(deities: DeityDef[] = DEITY_LIST): DeityGroup[] {
  const groups: DeityGroup[] = [];
  const alone: DeityDef[] = [];

  for (const d of deities) {
    const pantheon = pantheonOf(d);
    if (!pantheon) {
      alone.push(d);
      continue;
    }
    const found = groups.find((g) => g.pantheon?.id === pantheon.id);
    if (found) found.deities.push(d);
    else groups.push({ pantheon, deities: [d] });
  }

  if (alone.length) groups.push({ pantheon: null, deities: alone });
  return groups;
}

// ---------- Favor ----------

export function favorWith(state: GameState, deityId: string): number {
  return state.favor?.[deityId] ?? 0;
}

export function grantFavor(state: GameState, deityId: string, amount: number): void {
  if (amount <= 0 || !DEITIES[deityId]) return;
  state.favor ??= {};
  state.favor[deityId] = favorWith(state, deityId) + amount;
}

/** Spend favor with one deity. False (and nothing spent) if it won't cover. */
export function spendFavor(state: GameState, deityId: string, amount: number): boolean {
  if (favorWith(state, deityId) < amount) return false;
  state.favor[deityId] -= amount;
  return true;
}
