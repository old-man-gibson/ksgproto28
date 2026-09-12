import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { serialize, deserialize } from '../src/core/save/save';
import { visibleEdges } from '../src/core/systems/locations';
import { spotActivities } from '../src/core/systems/actions';
import { getSpot } from '../src/core/registry';
import { mulberry32, runGoldfish } from './goldfish';

/**
 * COMPLETABILITY (docs/COMPLETABILITY.md, Invariant A) — the idiot's half,
 * played rather than proved. The driver lives in `tests/goldfish.ts`; see its
 * header for what the thing is and why the weights are shaped as they are.
 *
 * Every run is seeded and deterministic, so a failure here is replayable:
 * `runGoldfish(<seed>, <ticks>)` reproduces it exactly.
 */
describe('the goldfish — a player who never makes a correct decision', () => {
  it(
    'gets somewhere without ever choosing to',
    () => {
      const r = runGoldfish(1234, 40_000);

      expect(r.blanked, 'decision points with nothing legal on offer').toBe(0);
      expect(r.end, 'made no progress at all').toBeGreaterThan(r.start);
      // Skills manifest from acting, so a player who only ever acts must end
      // up with some. This is the property Invariant A leans on, measured.
      expect(r.skillsLearned, 'learned no skills despite acting constantly').toBeGreaterThan(3);
      expect(r.visited.size, 'never left the spot it started at').toBeGreaterThan(1);
    },
    120_000,
  );

  it(
    'finishes a quest without ever intending to',
    () => {
      // The strongest completability claim this file can make: a player who
      // reads nothing and plans nothing still closes a quest chain.
      //
      // It is ONE seed on purpose — plenty of seeds finish no quest at all in
      // the same span, because they never complete the objectives rather than
      // because they cannot deliver them (`hadDelivery` stays 0 for them).
      // That is a real property of the game, not a flaw in the driver: quests
      // reward directed play, and this thing has no direction.
      //
      // ⚠️ The seed changed when the start moved to Threshold, and the ground
      // changed again 2026-09-06: the Hamlet Road is SHUT for the alpha
      // (`flag:world_open`), so the old-world quest-givers are out of reach —
      // what this seed closes now is the Warden of the Foot's chain, the
      // starting city's own content, exactly the "faster and more honest"
      // this comment used to ask for. If it ever fails again, the first
      // suspect is Threshold's quest content, not the goldfish.
      // Seed changed again 2026-09-12: shops put three vendors at the district
      // gates, so the goldfish has more strangers to greet and seed 42 now
      // spends its span saying hello. Scan of 1–13 the same day: 7 of 14 seeds
      // close a quest; 7 is one of them.
      const r = runGoldfish(7, 150_000);
      expect(r.questsDone, 'never finished a single quest').toBeGreaterThan(0);
      expect(r.blanked).toBe(0);
    },
    300_000,
  );

  it(
    'cannot strand, starve or crash itself across many runs',
    () => {
      // Different seeds wander differently — this is the part that actually
      // hunts, and every failure it reports is replayable from its seed.
      for (const seed of [7, 42, 99, 256, 1001, 31337]) {
        const r = runGoldfish(seed, 12_000);
        expect(r.blanked, `seed ${seed}: nothing legal on offer`).toBe(0);
        expect(r.end, `seed ${seed}: no progress`).toBeGreaterThan(r.start);
      }
    },
    120_000,
  );

  it(
    'leaves a save that still loads',
    () => {
      // Whatever mess it made of its character, the save has to survive it.
      const rng = mulberry32(5);
      const game = new Game(createInitialState(5));
      for (let t = 0; t < 8_000; t++) {
        game.tick();
        if (t % 50 === 0) {
          const acts = spotActivities(getSpot(game.state.spot));
          const edges = visibleEdges(game.state, game.state.spot);
          if (rng() < 0.5 && acts.length)
            game.selectActivity(acts[Math.floor(rng() * acts.length)].id);
          else if (edges.length) game.travelTo(edges[Math.floor(rng() * edges.length)].to);
        }
      }
      const loaded = deserialize(serialize(game.state));
      expect(loaded.spot).toBeTruthy();
      expect(Number.isFinite(loaded.gold)).toBe(true);
      expect(loaded.resources.hp).toBeGreaterThan(0);
    },
    60_000,
  );
});
