// The ability bank as FACET documents. Each entry is a template: a game grants an ability by
// hydrating a copy (Facet.hydrate(JSON.parse(JSON.stringify(Facet.bank[id])))), and the copy, with
// its cell state, is what the game saves.
//
// docs/ABILITY_IDEAS.md holds the user's prose for each ability; an entry here is that prose made
// runnable. Both games load this file with the core, so one document runs in both. A document reads
// only quantity ids from the shared vocabulary (fighter.*, stat.eff.*, res.*, pool.*, world.*);
// the comment above each entry lists what a game must register for it to run.
//
// Every number is a placeholder until the user sets it.

(() => {
const F = (globalThis.Facet || (globalThis.Facet = { _mods: {} }));
F._mods.bank = true;
const B = F.bank = F.bank || {};

// ---------- Solar Charge ----------
//
// User, 2026-10-29: "The player character gets empowered and charges up in the sun, but loses
// power as the charge falls below a certain %, down to a -30% debuff at 0% sunlight charge."
// The 2026-09-26 version adds: higher main attributes mean a higher cap, a faster fill and a
// faster drain, with the drain growing slower than the cap and the fill.
//
//   charge   banked sunlight. Cap 60 + 5 x (CON + WIS). Each game minute it gains
//            sunlight x (0.2 + 0.02 x (CON + WIS)) and loses 0.02 x (CON + WIS)^0.75, sun or not.
//   power    a damage and spell power multiplier set from the charge every minute:
//            +20% at half charge and above, falling in a straight line to -30% at empty.
//            Two numbers steer it: the +20% peak and the 50% knee.
//
// Reads: world.sunlight (0..1), stat.eff.con, stat.eff.wis. Modifies: fighter.damage,
// fighter.magicDamage. Needs a host that calls Facet.minute once per game minute.
// Starts empty, so a fresh grant opens at -30%.
const MAIN = { expr: 'add', a: { q: 'stat.eff.con' }, b: { q: 'stat.eff.wis' } };

// `show` on a cell and `reading.inputs` are display hints for a game's ability readout; the engine
// never reads them.
B.solar_charge = {
  v: 1,
  reading: { name: 'Solar Charge', icon: '☀️', inputs: [{ q: 'world.sunlight', label: 'Sunlight here', show: 'pct' }] },
  cells: [
    {
      key: 'charge', label: 'Solar Charge', icon: '☀️', hold: 'none', level: 'real', tier: 'run', show: 'bar',
      cap: { expr: 'add', a: 60, b: { expr: 'mul', a: 5, b: MAIN } },
      status: { desc: 'Banked sunlight. Fills under open sky by day and drains a little every minute.' },
    },
    {
      key: 'power', label: 'Sunpower', icon: '🔆', hold: 'none', level: 'real', tier: 'run', show: 'signedPct',
      floor: -0.3, cap: 0.2,
      status: {
        desc: 'Damage and spell power follow the banked sunlight: +20% from half charge up, -30% when empty.',
        mods: [
          { q: 'fighter.damage', op: 'mult', value: 1 },
          { q: 'fighter.magicDamage', op: 'mult', value: 1 },
        ],
      },
    },
  ],
  clauses: [
    { id: 'absorb', on: 'minute', do: [{ emit: 'cell', cell: 'charge', verb: 'add',
      value: { expr: 'mul', a: { q: 'world.sunlight' }, b: { expr: 'add', a: 0.2, b: { expr: 'mul', a: 0.02, b: MAIN } } } }] },
    { id: 'drain', on: 'minute', do: [{ emit: 'cell', cell: 'charge', verb: 'add',
      value: { expr: 'mul', a: -0.02, b: { expr: 'pow', a: MAIN, b: 0.75 } } }] },
    // power = min(peak, floor + (peak - floor) / knee x share); peak 0.2, floor -0.3, knee 0.5.
    { id: 'power', on: 'minute', do: [{ emit: 'cell', cell: 'power', verb: 'set',
      value: { expr: 'min', a: 0.2, b: { expr: 'add', a: -0.3, b: { expr: 'mul', a: 1, b: { cell: 'charge', of: 'frac' } } } } }] },
  ],
};
})();
