import type { RoyaleMove, RoyaleStrategyDef, SpotDef } from '../types';
import {
  ARENA,
  DARK_ROOM,
  DARK_ROOM_WAVES,
  DEFAULT_ROYALE_PLAN,
  SURVIVOR_CHAMPION,
  SURVIVOR_SPECIES,
} from '../data/festival.data';

interface FestivalRefs {
  strategies: Record<string, RoyaleStrategyDef>;
  monsters: Record<string, unknown>;
  spots: Record<string, SpotDef>;
}

/** One problem, on the registry entry it is about (the forge lights that node). */
export interface FestivalIssue {
  kind: 'royaleStrategy' | 'monster' | 'spot';
  id: string;
  message: string;
}

const MOVES: ReadonlySet<RoyaleMove> = new Set(['nearest', 'weakest', 'centre', 'away', 'edge', 'hold']);

/**
 * The Vermin Festival's content contracts (systems/festival.ts,
 * systems/royaleField.ts). Shared by tests/content.test.ts and the forge's
 * validator, so the two layers cannot drift: every strategy names a move the
 * field knows and conditions in range; every plan names real strategies;
 * every staged fighter is a real monster; and the two fighters always fought
 * alone at the end are their spots' boss lines, which the floors' clears read.
 */
export function festivalContentIssues(refs: FestivalRefs): FestivalIssue[] {
  const issues: FestivalIssue[] = [];
  const on = (kind: FestivalIssue['kind'], id: string, message: string) => issues.push({ kind, id, message });
  for (const s of Object.values(refs.strategies)) {
    if (!MOVES.has(s.move)) on('royaleStrategy', s.id, `unknown move '${s.move}'`);
    const w = s.when;
    if (w?.hpBelow !== undefined && !(w.hpBelow > 0 && w.hpBelow <= 1)) {
      on('royaleStrategy', s.id, 'when.hpBelow is a health share, above 0 and at most 1');
    }
    for (const k of ['fieldAbove', 'fieldBelow'] as const) {
      const v = w?.[k];
      if (v !== undefined && !(Number.isInteger(v) && v >= 0)) on('royaleStrategy', s.id, `when.${k} is a whole number of survivors`);
    }
  }
  for (const id of DEFAULT_ROYALE_PLAN) {
    if (!refs.strategies[id]) on('royaleStrategy', id, `the default royale plan names unknown strategy '${id}'`);
  }
  for (const sp of SURVIVOR_SPECIES) {
    if (!refs.monsters[sp.monsterId]) on('monster', sp.monsterId, 'a survivor species is not a monster');
    if (!(sp.weight > 0)) on('monster', sp.monsterId, 'survivor species weight must be positive');
    if (!sp.plan.length) on('monster', sp.monsterId, 'survivor species has no strategies');
    for (const id of sp.plan) {
      if (!refs.strategies[id]) on('royaleStrategy', id, `survivor species '${sp.monsterId}' names unknown strategy '${id}'`);
    }
  }
  for (const wave of DARK_ROOM_WAVES) {
    for (const foe of wave) {
      if (!refs.monsters[foe.monsterId]) on('monster', foe.monsterId, 'a dark room wave fighter is not a monster');
    }
  }
  const last = DARK_ROOM_WAVES[DARK_ROOM_WAVES.length - 1] ?? [];
  if (last.length !== 1) on('spot', DARK_ROOM, 'the dark room’s last wave is one fighter, fought alone');
  const bossLine = (spotId: string, monsterId: string | undefined) =>
    !!monsterId && !!refs.spots[spotId]?.encounters?.some((e) => e.boss && e.monsterId === monsterId);
  if (!bossLine(DARK_ROOM, last[0]?.monsterId)) on('spot', DARK_ROOM, 'the dark room’s last fighter is not a boss line here');
  if (!refs.monsters[SURVIVOR_CHAMPION]) on('monster', SURVIVOR_CHAMPION, 'the royale champion is not a monster');
  if (!bossLine(ARENA, SURVIVOR_CHAMPION)) on('spot', ARENA, 'the royale champion is not a boss line here');
  return issues;
}
