import { beforeAll, describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { createInitialState } from '../src/core/state';
import { TPS } from '../src/core/engine/loop';
import { SPOTS } from '../src/core/registry';
import { startForcedFight } from '../src/core/systems/combat';
import { getDerivedStats } from '../src/core/systems/derived';
import { createItem } from '../src/core/systems/runes';
import { runJohn, secs, type ClimbReport } from './john';
import type { TutorialWeapon } from '../src/core/types';

/**
 * COMPLETABILITY (docs/COMPLETABILITY.md §8) — John proves the road exists,
 * and these are the promises band 1 makes to him.
 *
 * The driver lives in tests/john.ts. The first block is John's own claim:
 * the floor build — Skip tutorial, rusty sword, Neutral, no spell, no
 * optional system — clears band 1. The rest hold the curve every build the
 * tutorial hands out meets on the same road; each bound is a judgement,
 * written down so a later tuning pass cannot quietly undo it. `npm run
 * pacing` prints the full table these numbers come from.
 *
 * What the curve looked like before these bounds existed (2026-10-10, the
 * same driver): the first slime after the tutorial knocked out a rusty sword
 * one run in three; the toll collector died in ten seconds having landed one
 * blow; floor 3 cost 14–110 knockouts and up to two hours, and the climb
 * ended holding 6k–90k gold because spiders paid by level × tier.
 *
 * Deterministic: seeds in, same climbs out. If a bound fails after a content
 * change, read the table before moving the bound.
 */

const RACK: TutorialWeapon[] = ['sword', 'spear', 'dagger', 'hammer', 'unarmed'];
const SEEDS = [42, 7];
const MINUTE = 60 * TPS;

const label = (r: ClimbReport) =>
  `${r.opts.weapon === 'skip' ? 'john' : r.opts.weapon} / seed ${r.opts.seed}${r.opts.attentive ? ' / attentive' : ''}`;

const john: ClimbReport[] = [];
const rack: ClimbReport[] = [];
beforeAll(() => {
  for (const seed of SEEDS) {
    john.push(runJohn({ seed, weapon: 'skip' }));
    for (const weapon of RACK) rack.push(runJohn({ seed, weapon, spell: 'fire' }));
  }
}, 120_000);

describe('John — the floor build clears band 1', () => {
  it('skips the tutorial, swings a rusty sword, and still reaches the top of band 1', () => {
    for (const r of john) {
      expect(r.done.floor3, `${label(r)}: never cleared floor 3`).not.toBeNull();
      // §6: the floor build completes slowly, but it completes.
      expect(r.done.floor3!, `${label(r)}: band 1 took ${secs(r.done.floor3)} s`).toBeLessThanOrEqual(40 * MINUTE);
    }
  });
});

describe('pacing — band 1 by the obvious road, every rack weapon', () => {
  it('every climb finishes band 1, inside half an hour of play', () => {
    for (const r of rack) {
      expect(r.done.floor3, `${label(r)}: never cleared floor 3`).not.toBeNull();
      expect(r.done.floor3!, `${label(r)}: band 1 took ${secs(r.done.floor3)} s`).toBeLessThanOrEqual(30 * MINUTE);
    }
  });

  it('the tutorial is a minute and a half at most, and never lost', () => {
    for (const r of rack) {
      expect(r.done.tutorial!, label(r)).toBeLessThanOrEqual(1.5 * MINUTE);
      expect(r.knockouts.tutorial, label(r)).toBe(0);
    }
  });

  it('the first real fights after the tutorial are survivable with whatever the rack gave', () => {
    // A slime shrugs off half a blade, so a lost fight here can happen — but
    // once at most, and rarely: the rats come first.
    const all = [...john, ...rack];
    for (const r of all) expect(r.knockouts.vermin, label(r)).toBeLessThanOrEqual(1);
    expect(all.filter((r) => r.knockouts.vermin > 0).length).toBeLessThanOrEqual(2);
  });

  it('the toll collector is a fight: it lasts, it can win, and it can be beaten', () => {
    for (const r of rack) {
      expect(r.firstBoss, label(r)).not.toBeNull();
      expect(r.firstBoss!.ticks, `${label(r)}: over in ${secs(r.firstBoss!.ticks)} s`).toBeGreaterThanOrEqual(10 * TPS);
      expect(r.bossAttempts, label(r)).toBeLessThanOrEqual(3);
    }
    // At ten seconds and one landed blow it was a formality; the typical
    // first attempt should be a real exchange.
    const lengths = rack.map((r) => r.firstBoss!.ticks).sort((a, b) => a - b);
    expect(lengths[Math.floor(lengths.length / 2)], 'median first boss fight').toBeGreaterThanOrEqual(20 * TPS);
    // Neither a formality nor a wall: some first attempts lose, most win.
    const lost = rack.filter((r) => !r.firstBoss!.won).length;
    expect(lost, 'the collector never won a first attempt').toBeGreaterThanOrEqual(1);
    expect(lost, 'the collector won most first attempts').toBeLessThanOrEqual(rack.length / 2);
  });

  it('the forced cistern and the third floor knock a player down, not out of the game', () => {
    for (const r of [...john, ...rack]) {
      expect(r.knockouts.floor2, `${label(r)}: cistern`).toBeLessThanOrEqual(6);
      expect(r.knockouts.gallery + r.knockouts.floor3, `${label(r)}: floor 3`).toBeLessThanOrEqual(20);
    }
  });

  it('no floor pays a fortune: the climb ends holding hundreds, not tens of thousands', () => {
    for (const r of [...john, ...rack]) {
      // The third floor's own gate asks for this much, so the climb earned it.
      expect(r.goldEarned, label(r)).toBeGreaterThanOrEqual(600);
      expect(r.goldEarned, label(r)).toBeLessThanOrEqual(3000);
    }
  });
});

describe('pacing — the floors hand over their own answers', () => {
  /**
   * The same fight from the same footing, once with the rusty sword and once
   * with what the floor's explore track hands over. Attributes are pinned and
   * no weapon skill is trained, so the only difference is the weapon — which
   * is the claim: the find is the right tool for the floor's den. Whether a
   * swordsman with floor 1's Swordsmanship should switch is the player's call
   * (the trained edge roughly evens it for John in the cistern); the tool
   * itself must win. Counted in wins, not seconds — a lost fight is short.
   */
  /** The den's queen only comes out once three egg sacs have burned. */
  const SACS = { 'flag:f3_sacs_burned': 3 };
  /** `stats` is the spot state the fight needs before it can be rolled. */
  function duel(spotId: string, monsterId: string, weapon: string, level: number, stats: Record<string, number> = {}): number {
    let wins = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = new Game(createInitialState(seed, spotId));
      const s = g.state;
      Object.assign(s.stats, stats);
      for (const a of ['str', 'dex', 'con'] as const) s.attrs[a].level = level;
      const item = createItem(s, weapon);
      s.inventory.push(item);
      g.equip(item.uid, 'weapon');
      s.resources.hp = getDerivedStats(s).maxHp;
      const spot = SPOTS[spotId];
      startForcedFight(s, g.bus, { ...spot, encounters: spot.encounters!.filter((e) => e.monsterId === monsterId) });
      expect(s.combat, `${spotId}: no fight with ${monsterId}`).not.toBeNull();
      // A win is walking away: run on past the last blow, long enough for
      // anything still working on you to finish the job — but only this one
      // fight (a den keeps sending more, and those are not the duel).
      let down = false;
      for (let t = 0; t < 6 * MINUTE && s.combat && !down; t++) {
        g.tick();
        down = s.recovering;
      }
      for (let t = 0; t < MINUTE && !s.combat && !down; t++) {
        g.tick();
        down = s.recovering;
      }
      if (!down) wins++;
    }
    return wins;
  }

  it("the sluice's club out-fights the rusty sword in the cistern", () => {
    expect(SPOTS.f2_sluice.finds?.some((f) => f.item === 'oak_club')).toBe(true);
    for (const slime of ['slime_water', 'slime_base_advanced']) {
      const sword = duel('f2_cistern', slime, 'rusty_sword', 6);
      const club = duel('f2_cistern', slime, 'oak_club', 6);
      expect(club, `${slime}: club ${club}/20 against sword ${sword}/20`).toBeGreaterThanOrEqual(sword + 5);
    }
  });

  it("the gallery's spear out-fights the rusty sword against the queen", () => {
    expect(SPOTS.f3_web_gallery.finds?.some((f) => f.item === 'old_spear')).toBe(true);
    // At the attributes a climber arrives with, the point wins and the edge
    // does not; the edge catches up with a few more levels (pacing, §6).
    const sword = duel('f3_brood_den', 'giant_spider_queen', 'rusty_sword', 12, SACS);
    const spear = duel('f3_brood_den', 'giant_spider_queen', 'old_spear', 12, SACS);
    expect(spear, `spear ${spear}/20 against sword ${sword}/20`).toBeGreaterThanOrEqual(15);
    expect(sword).toBeLessThanOrEqual(spear - 10);
    expect(duel('f3_brood_den', 'giant_spider_queen', 'rusty_sword', 16, SACS), 'a rusty sword four levels on').toBeGreaterThanOrEqual(12);
  });
});
