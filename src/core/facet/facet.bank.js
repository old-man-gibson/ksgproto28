// The ability bank as FACET documents. Each entry is a template: a game grants an ability by
// hydrating a copy (Facet.hydrate(JSON.parse(JSON.stringify(Facet.bank[id])))), and the copy, with
// its cell state, is what the game saves.
//
// docs/ABILITY_IDEAS.md holds the user's prose for each ability; an entry here is that prose made
// runnable. Both games load this file with the core, so one document runs in both. A document reads
// only quantity ids from the shared vocabulary (fighter.*, stat.eff.*, res.*, pool.*, world.*);
// the comment above each entry lists what a game must register for it to run.
//
// A number is a placeholder unless the entry says the user set it.

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

// ---------- Zenkai ----------
//
// Approved by the user 2026-10-31 as written (team ability GEN-10, artifact "Abilities 1–100"):
// "After a win where your HP fell to 20% or below, you gain a permanent bonus to all stats. The
// gain is 1.5% times the depth of the fall, times the level ratio. Depth is 1 minus your lowest
// HP fraction. The ratio is enemy level over your level, capped at 1.5. Using a flask or prayer
// during that fight cancels the gain. Enemies under 70% of your level give nothing. A knockout
// gives nothing and costs nothing extra. Each Zenkai you already have multiplies the next gain by
// 0.97. The total stalls between +50% and +75%."
//
//   bonus    the total, a multiplier on all six attributes. Lasts as long as the document (the
//            run, in ksgproto28).
//   gains    how many Zenkai so far; the 0.97 decay reads it. Team 2 proposed 0.99 so gains last
//            the run; that is the DECAY number below.
//   low      lowest HP share this fight: set at fightStart, lowered on each hitTaken.
//   tainted  1 once a flask, a consumable or a miracle is used this fight. "Prayer" is read as a
//            miracle cast; a consumable counts as a flask.
//   foe      the strongest enemy's level this fight, from fightStart.
//
// Reads: fighter.hp, fighter.maxHpAbs (through `of: 'frac'`), fighter.level, stat.eff.* (to
// modify). Events: fightStart (detail maxLevel), hitTaken, flaskUsed, itemUsed, miracleCast,
// fightWon. A knockout raises no fightWon, so it pays and costs nothing.
const DECAY = 0.97;
const HP_SHARE = { q: 'fighter.hp', of: 'frac' };
const LEVEL = { q: 'fighter.level' };
const ATTRS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const taint = (event) => ({ id: 'taint_' + event, on: 'event:' + event, do: [{ emit: 'cell', cell: 'tainted', verb: 'set', value: 1 }] });
const hidden = { hidden: true };

B.zenkai = {
  v: 1,
  reading: { name: 'Zenkai', icon: '💥' },
  cells: [
    {
      key: 'bonus', label: 'Zenkai', icon: '💥', hold: 'none', level: 'real', tier: 'run', show: 'signedPct', cap: 10,
      status: {
        desc: 'All attributes, raised by every win where your HP fell to 20% or below without a flask or a prayer.',
        mods: ATTRS.map((a) => ({ q: 'stat.eff.' + a, op: 'mult', value: 1 })),
      },
    },
    { key: 'gains', label: 'Zenkai gains', icon: '📈', hold: 'none', level: 'int', tier: 'run', show: 'count', cap: 1e9, status: hidden },
    { key: 'low', hold: 'none', level: 'real', tier: 'fight', cap: 1, status: hidden },
    { key: 'tainted', hold: 'none', level: 'int', tier: 'fight', cap: 1, status: hidden },
    { key: 'foe', hold: 'none', level: 'real', tier: 'fight', cap: 1e9, status: hidden },
  ],
  clauses: [
    { id: 'start', on: 'event:fightStart', do: [
      { emit: 'cell', cell: 'low', verb: 'set', value: HP_SHARE },
      { emit: 'cell', cell: 'tainted', verb: 'set', value: 0 },
      { emit: 'cell', cell: 'foe', verb: 'set', value: { frame: 'maxLevel' } },
    ] },
    { id: 'hurt', on: 'event:hitTaken', do: [
      { emit: 'cell', cell: 'low', verb: 'set', value: { expr: 'min', a: { cell: 'low' }, b: HP_SHARE } },
    ] },
    taint('flaskUsed'),
    taint('itemUsed'),
    taint('miracleCast'),
    { id: 'won', on: 'event:fightWon',
      when: { all: [
        { cell: 'low', op: 'lte', v: 0.2 },
        { cell: 'tainted', op: 'eq', v: 0 },
        { cell: 'foe', op: 'gte', v: { expr: 'mul', a: 0.7, b: LEVEL } },
      ] },
      do: [
        // gain = 1.5% x (1 - low) x min(1.5, foe / level) x DECAY^gains; gains counts after.
        { emit: 'cell', cell: 'bonus', verb: 'add', value: { expr: 'mul', a: 0.015, b: { expr: 'mul',
          a: { expr: 'sub', a: 1, b: { cell: 'low' } },
          b: { expr: 'mul',
            a: { expr: 'min', a: 1.5, b: { expr: 'div', a: { cell: 'foe' }, b: LEVEL } },
            b: { expr: 'pow', a: DECAY, b: { cell: 'gains' } } } } } },
        { emit: 'cell', cell: 'gains', verb: 'add', value: 1 },
      ] },
  ],
};
})();
