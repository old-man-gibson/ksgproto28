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

// ---------- Little Moons ----------
//
// Approved by the user 2026-11-01 (team ability R3-SKY-19, review page 3), with the note "might
// need to tweak numbers":
//   Does: Three small moons orbit you. They strike your target every 2.8 s, 3.7 s and 7.9 s.
//   Grows: Each strike is 30% of your hit. Each boss kill adds 5% for the run.
//   Costs: The moons use 2 mana per second. At 0 mana they go dark for 10 s.
//   Limit: Strikes within 0.3 s combine. Two combined strikes deal x2. Three deal x5.
//
// Readings taken (the entry does not say):
//   - "Your target" is the front enemy, and "your hit" is weapon damage (fighter.damage) before
//     crit and variance. A strike always lands and never crits.
//   - A combined strike deals the sum of its strikes times 2 or 5, so two moons together deal 4
//     strikes' worth and three deal 15. Read as x2 or x5 of one strike, two moons together would
//     deal exactly what they deal apart. Over a 30 s fight the combining adds about 19% to the
//     moons' damage, over an hour about 35%.
//   - The damage type is Light.
//   - The moons run on the combat tick, so only in fights, and start each fight from zero. The
//     first two-moon line-up comes about 11 s in.
//   - "At 0 mana" is when the pool cannot pay this tick's share of the 2 per second. While dark
//     the moons neither turn nor drain, and a line-up being held is lost.
//
//   bosses      boss kills this run; each adds 5 points to the 30% share.
//   m1 m2 m3    ticks since each moon last came due. At its cap the moon comes due.
//   due         moons waiting in the open window (1 to 3).
//   win         ticks left before the window strikes; 0 when no window is open.
//   dark        ticks left dark.
//
// None of the counting cells carries a status (`carrier: false`): no modifier reads them, and they
// change every tick.
//
// Reads: fighter.damage, pool.mana.cur. Events: fightStart, kill (detail boss: 1 for a boss).
// Needs a host that calls Facet.tick once per combat tick, resolves { side: 'enemy', rank: 'front' },
// and has applyDamage and spendPool.
const MOONS = [['m1', 2.8], ['m2', 3.7], ['m3', 7.9]];
const STRIKE_SHARE = { expr: 'add', a: 0.3, b: { expr: 'mul', a: 0.05, b: { cell: 'bosses' } } };
// due x (1, 2 or 5): 1, 4 or 15 strikes' worth.
const DUE = { cell: 'due' };
const COMBINED = { expr: 'mul', a: DUE, b: { expr: 'add', a: DUE, b: { expr: 'mul', a: 2, b: { expr: 'max', a: 0, b: { expr: 'sub', a: DUE, b: 2 } } } } };
const MANA_PER_TICK = { expr: 'div', a: 2, b: { seconds: 1 } };
// One more than the window in ticks: the countdown strikes at 1, so a moon due 0.3 s after the
// first still joins.
const WINDOW = { expr: 'add', a: { seconds: 0.3 }, b: 1 };
const counter = (key, cap) => ({ key, hold: 'none', level: 'int', tier: 'fight', cap, carrier: false });
const setCell = (cell, value) => ({ emit: 'cell', cell, verb: 'set', value });
const addCell = (cell, value) => ({ emit: 'cell', cell, verb: 'add', value });
const isZero = (cell) => ({ cell, op: 'eq', v: 0 });

B.little_moons = {
  v: 1,
  reading: { name: 'Little Moons', icon: '🌙' },
  cells: [
    {
      key: 'bosses', label: 'Boss kills', icon: '👑', hold: 'none', level: 'int', tier: 'run', show: 'count', cap: 1e9, carrier: false,
      status: { desc: 'Each moon strike deals 30% of your weapon damage, plus 5% per boss killed this run.' },
    },
    ...MOONS.map(([key, s]) => counter(key, { seconds: s })),
    counter('due', 3),
    counter('win', WINDOW),
    counter('dark', { seconds: 10 }),
  ],
  clauses: [
    { id: 'start', on: 'event:fightStart', do: ['m1', 'm2', 'm3', 'due', 'win', 'dark'].map((c) => setCell(c, 0)) },
    // Adds the flag rather than guarding on it: a frame guard passes when the field is missing, so
    // a host that does not report `boss` would count every kill. A missing field adds 0.
    { id: 'boss', on: 'event:kill', do: [addCell('bosses', { frame: 'boss' })] },
    // The tick, in order: dark counts down, the pool pays or the moons go dark, the moons turn,
    // and an open window counts down or strikes.
    { id: 'cool', on: 'tick', when: { cell: 'dark', op: 'gt', v: 0 }, do: [addCell('dark', -1)] },
    { id: 'go_dark', on: 'tick', when: { all: [isZero('dark'), { q: 'pool.mana.cur', op: 'lt', v: MANA_PER_TICK }] },
      do: [setCell('dark', { seconds: 10 }), setCell('due', 0), setCell('win', 0)] },
    { id: 'drain', on: 'tick', when: isZero('dark'), do: [{ emit: 'world', verb: 'spend', pool: 'mana', value: MANA_PER_TICK }] },
    { id: 'turn', on: 'tick', when: isZero('dark'), do: MOONS.map(([key]) => addCell(key, 1)) },
    // A moon at its cap comes due: back to zero, one more waiting, and a window opens if none is.
    ...MOONS.flatMap(([key]) => [
      { id: 'due_' + key, on: 'cell:' + key + ':cap', do: [setCell(key, 0), addCell('due', 1)] },
      { id: 'open_' + key, on: 'cell:' + key + ':cap', when: isZero('win'), do: [setCell('win', WINDOW)] },
    ]),
    { id: 'strike', on: 'tick', when: { cell: 'win', op: 'eq', v: 1 }, do: [
      { emit: 'world', verb: 'damage', damageType: 'light', scope: { side: 'enemy', rank: 'front', n: 1 },
        value: { expr: 'mul', a: { q: 'fighter.damage' }, b: { expr: 'mul', a: STRIKE_SHARE, b: COMBINED } } },
      setCell('due', 0), setCell('win', 0),
    ] },
    { id: 'wait', on: 'tick', when: { cell: 'win', op: 'gt', v: 1 }, do: [addCell('win', -1)] },
  ],
};

// ---------- Bramble ----------
//
// Approved by the user (team ability FLD-04, review page 1), no note:
//   Does: Each hit you take raises your thorn level by 1 until the fight ends. Each level returns
//         2% of every blow's damage to its attacker.
//   Costs: Each level slows your actions by 0.5%.
//   Grows: The level cap starts at 10. It rises by 1 per 200 fights fought.
//   Fails: Fire damage you take burns away 5 levels per hit.
//   Limit: The level cap tops out at 50. Thorns clear when the fight ends.
// The entry predates the damage-type list: Fire is Heat.
//
// Readings taken (the entry does not say):
//   - A hit is a blow from an enemy. A condition ticking, a trap or your own backlash is not, so it
//     neither grows nor burns thorns and has no attacker to answer.
//   - The blow grows the thorn first, then the thorns answer it: the first hit of a fight returns
//     2%, the tenth 20%.
//   - A Heat blow burns 5 levels and grows none. What is left still answers it.
//   - The returned damage is Piercing, and the blow's damage is what reached your HP. Thorns that
//     returned the blow's own type would barely scratch a fire elemental's heat blows.
//   - "Fights fought" counts fights this run, won or lost.
//
//   thorns   the level, cleared at each fight's start and end. Its carrier slows `fighter.speed`
//            (the action bar's fill) by 0.5% per level.
//   fights   fights ended this run; the cap is 10 + floor(fights / 200), at most 50.
//
// Events: hitTaken (detail amount, type, attacker), fightStart, fightEnd. Needs a host that names
// the attacker's ref in hitTaken, resolves it, and has applyDamage. The guards read `type` and
// `attacker` through `not`, so they fail closed: a host that does not report the fields never grows
// or burns thorns, rather than growing them on every hit (a bare frame guard passes when the field
// is missing).
const THORNS = { cell: 'thorns' };
const FROM_ENEMY = { not: { frame: 'attacker', op: 'eq', v: '' } };
const IS_HEAT = { not: { frame: 'type', op: 'ne', v: 'heat' } };

B.bramble = {
  v: 1,
  reading: { name: 'Bramble', icon: '🌿', hit: 'thorns' },
  cells: [
    {
      key: 'thorns', label: 'Thorns', icon: '🌿', hold: 'none', level: 'int', tier: 'fight', show: 'count',
      cap: { expr: 'min', a: 50, b: { expr: 'add', a: 10, b: { expr: 'floor', a: { expr: 'div', a: { cell: 'fights' }, b: 200 } } } },
      status: {
        desc: 'Each level returns 2% of every blow to its attacker and slows your actions by 0.5%. Heat burns 5 levels a hit. Clears when the fight ends.',
        mods: [{ q: 'fighter.speed', op: 'mult', value: -0.005 }],
      },
    },
    {
      key: 'fights', label: 'Fights fought', icon: '⚔️', hold: 'none', level: 'int', tier: 'run', show: 'count', cap: 1e9, carrier: false,
      status: { desc: 'The thorn cap starts at 10 and rises by 1 per 200 fights this run, up to 50.' },
    },
  ],
  clauses: [
    { id: 'start', on: 'event:fightStart', do: [setCell('thorns', 0)] },
    { id: 'end', on: 'event:fightEnd', do: [setCell('thorns', 0), addCell('fights', 1)] },
    { id: 'grow', on: 'event:hitTaken', when: { all: [FROM_ENEMY, { not: IS_HEAT }] }, do: [addCell('thorns', 1)] },
    { id: 'burn', on: 'event:hitTaken', when: { all: [FROM_ENEMY, IS_HEAT] }, do: [addCell('thorns', -5)] },
    { id: 'answer', on: 'event:hitTaken', when: { all: [FROM_ENEMY, { cell: 'thorns', op: 'gt', v: 0 }] }, do: [
      { emit: 'world', verb: 'damage', damageType: 'piercing', scope: { frame: 'attacker' },
        value: { expr: 'mul', a: { frame: 'amount' }, b: { expr: 'mul', a: 0.02, b: THORNS } } },
    ] },
  ],
};
})();
