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

// `show` on a cell, `reading.inputs` and `reading.desc` are display hints for a game's ability
// readout; the engine never reads them. A `reading.desc` is lines of "Label: fact" joined by '\n':
// one fact per sentence, under 20 words, at most three numbers a line, no parentheses or semicolons.
// A cell's `status.desc` is one such line without the label. A cell's `line` ({ text, scale, base })
// is what a short readout shows after the label instead of the bare number: `text` with {v} as the value x scale,
// rounded; `base` names the bare number for a longer readout (Weakest Weapon Master's stances).
B.solar_charge = {
  v: 1,
  reading: {
    name: 'Solar Charge', icon: '☀️', inputs: [{ q: 'world.sunlight', label: 'Sunlight here', show: 'pct' }],
    desc: [
      'Does: Damage and spell power change with your charge.',
      'Full: +20% from half charge up.',
      'Empty: -30% at 0 charge. The change is linear in between.',
      'Fills: Each game minute under open sky by day. More sunlight fills faster.',
      'Drains: Each game minute, day or night.',
      'Grows: CON + WIS raise the cap, the fill and the drain.',
    ].join('\n'),
  },
  cells: [
    {
      key: 'charge', label: 'Solar Charge', icon: '☀️', hold: 'none', level: 'real', tier: 'run', show: 'bar',
      cap: { expr: 'add', a: 60, b: { expr: 'mul', a: 5, b: MAIN } },
      status: { desc: 'Stored sunlight. Cap 60 + 5 per point of CON + WIS.' },
    },
    {
      key: 'power', label: 'Sunpower', icon: '🔆', hold: 'none', level: 'real', tier: 'run', show: 'signedPct',
      floor: -0.3, cap: 0.2,
      status: {
        desc: 'Damage and spell power. +20% from half charge up, -30% at 0 charge.',
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
  reading: {
    name: 'Zenkai', icon: '💥',
    desc: [
      'Does: Win a fight after your HP fell to 20% or less. All attributes rise for the run.',
      'Gain: 1.5% x share of HP lost x enemy level / your level.',
      'Limit: The level ratio counts up to 1.5. Each gain is 3% smaller than the last.',
      'Fails: Using a flask, consumable or prayer in that fight.',
      'Fails: An enemy under 70% of your level.',
    ].join('\n'),
  },
  cells: [
    {
      key: 'bonus', label: 'Zenkai', icon: '💥', hold: 'none', level: 'real', tier: 'run', show: 'signedPct', cap: 10,
      status: {
        desc: 'All attributes. Rises with each Zenkai win.',
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
// User 2026-11-03 removed the cost: "little moons shouldn't drain mana, I don't know if it's part
// of the spec but it feels unfun to use. let mana drain be a feature for an evolution, maybe." The
// moons are free and never go dark. A mana drain is an idea for a branch, not built.
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
//   bosses      boss kills this run; each adds 5 points to the 30% share.
//   m1 m2 m3    ticks since each moon last came due. At its cap the moon comes due.
//   due         moons waiting in the open window (1 to 3).
//   win         ticks left before the window strikes; 0 when no window is open.
//
// None of the counting cells carries a status (`carrier: false`): no modifier reads them, and they
// change every tick.
//
// Reads: fighter.damage. Events: fightStart, kill (detail boss: 1 for a boss). Needs a host that
// calls Facet.tick once per combat tick, resolves { side: 'enemy', rank: 'front' }, and has
// applyDamage.
const MOONS = [['m1', 2.8], ['m2', 3.7], ['m3', 7.9]];
const STRIKE_SHARE = { expr: 'add', a: 0.3, b: { expr: 'mul', a: 0.05, b: { cell: 'bosses' } } };
// due x (1, 2 or 5): 1, 4 or 15 strikes' worth.
const DUE = { cell: 'due' };
const COMBINED = { expr: 'mul', a: DUE, b: { expr: 'add', a: DUE, b: { expr: 'mul', a: 2, b: { expr: 'max', a: 0, b: { expr: 'sub', a: DUE, b: 2 } } } } };
// One more than the window in ticks: the countdown strikes at 1, so a moon due 0.3 s after the
// first still joins.
const WINDOW = { expr: 'add', a: { seconds: 0.3 }, b: 1 };
const counter = (key, cap) => ({ key, hold: 'none', level: 'int', tier: 'fight', cap, carrier: false });
const setCell = (cell, value) => ({ emit: 'cell', cell, verb: 'set', value });
const addCell = (cell, value) => ({ emit: 'cell', cell, verb: 'add', value });
const isZero = (cell) => ({ cell, op: 'eq', v: 0 });

B.little_moons = {
  v: 1,
  reading: {
    name: 'Little Moons', icon: '🌙',
    desc: [
      'Does: 3 moons hit the front enemy in fights. Light damage.',
      'Timing: Every 2.8 s, 3.7 s and 7.9 s.',
      'Damage: 30% of weapon damage per strike.',
      'Grows: +5% per boss killed this run.',
      'Combine: Strikes within 0.3 s merge. 2 merged deal 4 strikes of damage. 3 deal 15.',
    ].join('\n'),
  },
  cells: [
    {
      key: 'bosses', label: 'Boss kills', icon: '👑', hold: 'none', level: 'int', tier: 'run', show: 'count', cap: 1e9, carrier: false,
      status: { desc: '+5% moon strike damage per boss killed this run.' },
    },
    ...MOONS.map(([key, s]) => counter(key, { seconds: s })),
    counter('due', 3),
    counter('win', WINDOW),
  ],
  clauses: [
    { id: 'start', on: 'event:fightStart', do: ['m1', 'm2', 'm3', 'due', 'win'].map((c) => setCell(c, 0)) },
    // Adds the flag rather than guarding on it: a frame guard passes when the field is missing, so
    // a host that does not report `boss` would count every kill. A missing field adds 0.
    { id: 'boss', on: 'event:kill', do: [addCell('bosses', { frame: 'boss' })] },
    // The tick, in order: the moons turn, and an open window counts down or strikes.
    { id: 'turn', on: 'tick', do: MOONS.map(([key]) => addCell(key, 1)) },
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
// User additions (2026-11-01), after seeing it only grow on being hit:
//   "an additional increase by floor(1 + 5% level cap) every second, and whenever the player hits
//    themselves with nature damage, which makes the bramble increase by floor(2 levels + 10%
//    bramble level cap) instead."
//
// Readings taken (neither text says):
//   - A hit is a blow from an enemy. A condition ticking, a trap or your own backlash is not, so it
//     neither grows nor burns thorns and has no attacker to answer.
//   - The blow grows the thorn first, then the thorns answer it.
//   - A Heat blow burns 5 levels and grows none. What is left still answers it.
//   - The returned damage is Piercing, and "a blow's damage" is the blow as the enemy threw it,
//     before your armour, resistance and ward. The entry's own note wants "a tank that wins by
//     being hit"; a share of what got past a tank's armour returned 1 damage a blow at KSG floor 17.
//   - "Every second" counts fight time: the per-second growth rides the host's combat tick.
//   - Nature is Poison. KSG's spell word Seed is Poison and InfiniteGacha's Nature Slime hits with
//     Poison; neither game has a Nature type.
//   - "Hits themselves" is a blow the host marks `self: 1` (KSG: a spell you cast on yourself). A
//     Poison one grows floor(2 + 10% of the cap) instead of 1, and answers no one. Heat you cast
//     on yourself burns nothing.
//   - "Fights fought" counts fights this run, won or lost.
//
//   thorns   the level, cleared at each fight's start and end. Its carrier slows `fighter.speed`
//            (the action bar's fill) by 0.5% per level.
//   sec      ticks toward the next second of fight time.
//   fights   fights ended this run; the cap is 10 + floor(fights / 200), at most 50.
//
// At cap 10 the clock adds 1 a second and a self-Poison hit adds 3; at cap 50, 3 and 7.
//
// Events: hitTaken (detail amount, blow, type, attacker, self), fightStart, fightEnd, tick. Needs a
// host that names the attacker's ref in hitTaken, resolves it, and has applyDamage. The guards
// read `type`, `attacker` and `self` through `not`, so they fail closed: a host that does not
// report a field never takes that branch, rather than taking it on every hit (a bare frame guard
// passes when the field is missing). A host that does not report `blow` is answered on `amount`.
const THORNS = { cell: 'thorns' };
const THORN_CAP = { expr: 'min', a: 50, b: { expr: 'add', a: 10, b: { expr: 'floor', a: { expr: 'div', a: { cell: 'fights' }, b: 200 } } } };
const capped = (base, share) => ({ expr: 'floor', a: { expr: 'add', a: base, b: { expr: 'mul', a: share, b: THORN_CAP } } });
const FROM_ENEMY = { not: { frame: 'attacker', op: 'eq', v: '' } };
const FROM_SELF = { not: { frame: 'self', op: 'ne', v: 1 } };
const IS_HEAT = { not: { frame: 'type', op: 'ne', v: 'heat' } };
const IS_POISON = { not: { frame: 'type', op: 'ne', v: 'poison' } };
const BLOW = { expr: 'max', a: { frame: 'amount' }, b: { frame: 'blow' } };

B.bramble = {
  v: 1,
  reading: {
    name: 'Bramble', icon: '🌿', hit: 'thorns',
    desc: [
      'Does: Each thorn level returns 2% of every enemy blow to the attacker. Piercing damage.',
      'Costs: Each level slows your actions 0.5%.',
      'Grows: +1 per enemy blow. Each second: 1 + 5% of the cap.',
      'Grows: Each Poison spell you cast on yourself: 2 + 10% of the cap.',
      'Fails: Each Heat hit removes 5 levels. Thorns reset when the fight ends.',
      'Limit: Cap 10. +1 per 200 fights this run. Max 50.',
    ].join('\n'),
  },
  cells: [
    {
      key: 'thorns', label: 'Thorns', icon: '🌿', hold: 'none', level: 'int', tier: 'fight', show: 'count',
      cap: THORN_CAP,
      status: {
        desc: 'Per level: 2% of each enemy blow returned, -0.5% action speed.',
        mods: [{ q: 'fighter.speed', op: 'mult', value: -0.005 }],
      },
    },
    counter('sec', { seconds: 1 }),
    {
      key: 'fights', label: 'Fights fought', icon: '⚔️', hold: 'none', level: 'int', tier: 'run', show: 'count', cap: 1e9, carrier: false,
      status: { desc: 'Thorn cap +1 per 200 fights this run. Cap 10 to 50.' },
    },
  ],
  clauses: [
    { id: 'start', on: 'event:fightStart', do: [setCell('thorns', 0), setCell('sec', 0)] },
    { id: 'end', on: 'event:fightEnd', do: [setCell('thorns', 0), addCell('fights', 1)] },
    { id: 'clock', on: 'tick', do: [addCell('sec', 1)] },
    { id: 'second', on: 'cell:sec:cap', do: [setCell('sec', 0), addCell('thorns', capped(1, 0.05))] },
    { id: 'grow', on: 'event:hitTaken', when: { all: [FROM_ENEMY, { not: IS_HEAT }] }, do: [addCell('thorns', 1)] },
    { id: 'burn', on: 'event:hitTaken', when: { all: [FROM_ENEMY, IS_HEAT] }, do: [addCell('thorns', -5)] },
    { id: 'self', on: 'event:hitTaken', when: { all: [FROM_SELF, IS_POISON] }, do: [addCell('thorns', capped(2, 0.1))] },
    { id: 'answer', on: 'event:hitTaken', when: { all: [FROM_ENEMY, { cell: 'thorns', op: 'gt', v: 0 }] }, do: [
      { emit: 'world', verb: 'damage', damageType: 'piercing', scope: { frame: 'attacker' },
        value: { expr: 'mul', a: BLOW, b: { expr: 'mul', a: 0.02, b: THORNS } } },
    ] },
  ],
};

// ---------- Basilisk Hide ----------
//
// Approved by the user (team ability ENM-18, review page 1):
//   Does: Each time an enemy lands a hit on you, it gains Stone: 6% + CON / 10 per hit. Bosses
//         gain 1.5% per hit.
//   Grows: Stone slows its attack speed by the same percent.
//   Fails: At 100% it becomes a statue and leaves the fight. Its loot is replaced by Stone Chunks
//          worth 50% of the normal gold. It gives 50% XP.
//   Costs: You have to be hit for it to work.
// User note: "enemies will be able to resist it based on their own attributes and resistances
//   (earth? arcane? dark? poison?). the statue doesn't leave the fight immediately but disappears
//   after a few seconds. the player can break it to pelt remaining enemies behind the statue with
//   rocks for piercing and slashing damage."
//
// Readings taken (offered to the user 2026-11-01 as defaults, not overruled):
//   - A hit is an enemy's blow (hitTaken with an attacker), as for Bramble.
//   - CON / 10 is percentage points: CON 25 gives 8.5 Stone a hit. A boss (hitTaken `boss`) takes
//     a flat 1.5.
//   - Stone is Earth, so the host resists it by the enemy's Earth resistance, and it names a CON
//     contest (`contest: 'con'`): an enemy with more CON than you takes it × yours ÷ its.
//   - The statue is the host's: Stone escalates at 100 into the host's `petrified` condition.
//     ksgproto28 keeps it 3 seconds; broken before then it throws its max HP as rocks at the
//     enemies behind it, half Piercing and half Slashing; either way it pays Stone Chunks worth
//     half its gold and half its XP (statuses.data.ts, combat.ts onKill).
//   - Stone slows 0.5% a point, half the approved "same percent" (user 2026-11-02: "Half the
//     Stone %"). At 1% a point the last hits took most of the time: at KSG floor 17, standing
//     still with attributes 30, 3 statues in 10 minutes; at 0.5%, 10.
//
// The evolution (user 2026-11-02, docs/ABILITY_IDEAS.md "Evolution"). A statue counts when the
// enemy stood at 85% of your level or 85% of your attribute total or more (statue detail
// `levelShare`, `attrShare`, read through `not`, so a host that sends neither counts nothing). The
// count is plain, with no decay. At EVOLVE_AT the document offers its three branches (emit
// 'evolve'); the host holds play until one is picked and swaps it in with Facet.evolve, which
// carries every cell the two share. No branch evolves again, so the pick is final for the run.
// EVOLVE_AT is a placeholder.
//
// A branch changes which statue the host makes, through Stone's `escalatesTo`:
//   petrified           the base: lasts 3 seconds; broken, it throws rocks; pays Stone Chunks.
//   petrified_rubble    Rubble: as the base, and left alone it bursts at half strength; no Chunks.
//   petrified_standing  Stoneskin: stays until the fight ends, out of the way of your blows;
//                       throws no rocks; pays its Chunks as it crumbles.
// ksgproto28 defines all three (statuses.data.ts). A host without them makes no statues.
//
// Events: hitTaken (detail attacker, boss), statue (target, levelShare, attrShare), rocks
// (target), fightStart, fightEnd, tick. The boss guard reads `boss` through `not`, so a host that
// does not report it treats every attacker as an ordinary enemy.
const EVOLVE_AT = 100;
const STONE = {
  id: 'basilisk_stone', name: 'Stone', icon: '🪨',
  desc: 'Slows actions 0.5% per point. At 100 the bearer becomes a statue.',
  element: 'earth', contest: 'con', escalatesTo: 'petrified', duration: null,
  stacking: { mode: 'sum', cap: 100, onCap: 'escalate', escalateMult: 0.01 },
  mods: [{ q: 'fighter.speed', op: 'mult', value: -0.005 }],
};
const stoneEnding = (escalatesTo) => Object.assign({}, STONE, { escalatesTo });
const IS_BOSS = { not: { frame: 'boss', op: 'ne', v: 1 } };
const ATTACKER = { frame: 'attacker' };
const FRONT = { side: 'enemy', rank: 'front', n: 1 };
const stoneOn = (def, scope, intensity) => ({ emit: 'status', scope, def, intensity });
const HIT_STONE = { expr: 'add', a: 6, b: { expr: 'div', a: { q: 'stat.eff.con' }, b: 10 } };
const RIVAL = { any: [
  { not: { frame: 'levelShare', op: 'lt', v: 0.85 } },
  { not: { frame: 'attrShare', op: 'lt', v: 0.85 } },
] };
const STATUES = {
  key: 'statues', label: 'Statues', icon: '🗿', hold: 'none', level: 'int', tier: 'run', show: 'count', cap: EVOLVE_AT,
  carrier: false,
  status: {
    desc: 'Statues of enemies at 85% of your level or attribute total or more. At ' + EVOLVE_AT + ' the ability evolves.',
  },
};

// Stone from enemy blows, and the statue count; every branch keeps both. `share` scales a blow's
// dose (Gorgon's Gaze halves it).
const fromBlows = (def, share) => {
  const dose = (x) => share === 1 ? x : { expr: 'mul', a: share, b: x };
  return [
    { id: 'stone', on: 'event:hitTaken', when: { all: [FROM_ENEMY, { not: IS_BOSS }] }, do: [stoneOn(def, ATTACKER, dose(HIT_STONE))] },
    { id: 'stone_boss', on: 'event:hitTaken', when: { all: [FROM_ENEMY, IS_BOSS] }, do: [stoneOn(def, ATTACKER, dose(1.5))] },
    { id: 'count', on: 'event:statue', when: RIVAL, do: [addCell('statues', 1)] },
  ];
};

B.basilisk_hide = {
  v: 1,
  reading: {
    name: 'Basilisk Hide', icon: '🗿',
    desc: [
      'Does: Each enemy blow gives the attacker 6 + CON/10 Stone. Bosses get 1.5.',
      'Stone: Slows the enemy 0.5% per point. At 100 it becomes a statue.',
      'Resist: Earth resistance reduces Stone. So does enemy CON above yours.',
      'Evolves: At 100 statues of enemies near your strength.',
    ].join('\n'),
  },
  cells: [STATUES],
  clauses: [
    ...fromBlows(STONE, 1),
    { id: 'evolve', on: 'cell:statues:cap', do: [{ emit: 'evolve', into: ['basilisk_gorgon', 'basilisk_rubble', 'basilisk_stoneskin'] }] },
  ],
};

// Gorgon's Gaze (builds that are not hit). Each second of fight time the front enemy gains
// 2 + CON / 50 Stone, a quarter of that on the place's boss: the dose is read per target, and
// `fighter.boss` is 1 on the boss. Blows add half the base dose. When an enemy turns to stone the
// gaze moves on: the new front enemy takes 25 Stone (a quarter on a boss), resisted like any dose.
const BOSS_QUARTER = { expr: 'sub', a: 1, b: { expr: 'mul', a: 0.75, b: { q: 'fighter.boss', on: 'target' } } };
const GAZE = { expr: 'mul', a: BOSS_QUARTER, b: { expr: 'add', a: 2, b: { expr: 'div', a: { q: 'stat.eff.con' }, b: 50 } } };

B.basilisk_gorgon = {
  v: 1,
  reading: {
    name: "Gorgon's Gaze", icon: '👁️',
    desc: [
      'Does: Each second in a fight, the front enemy gets 2 + CON/50 Stone.',
      'Chain: A new statue gives the next front enemy 25 Stone.',
      'Bosses: Get 1/4 of both.',
      'Blows: Enemy blows give half the base Stone.',
    ].join('\n'),
  },
  cells: [STATUES, counter('sec', { seconds: 1 })],
  clauses: [
    ...fromBlows(STONE, 0.5),
    { id: 'start', on: 'event:fightStart', do: [setCell('sec', 0)] },
    { id: 'clock', on: 'tick', do: [addCell('sec', 1)] },
    { id: 'gaze', on: 'cell:sec:cap', do: [setCell('sec', 0), stoneOn(STONE, FRONT, GAZE)] },
    { id: 'moves', on: 'event:statue', do: [stoneOn(STONE, FRONT, { expr: 'mul', a: BOSS_QUARTER, b: 25 })] },
  ],
};

// Rubble (tanks in group fights). Rocks add 15 Stone to each enemy they hit (rocks detail
// `target`), so one statue can turn the next. Its statue bursts at half strength when left alone,
// and pays no Stone Chunks (petrified_rubble).
const RUBBLE_STONE = stoneEnding('petrified_rubble');

B.basilisk_rubble = {
  v: 1,
  reading: {
    name: 'Rubble', icon: '🪨',
    desc: [
      'Rocks: Each enemy hit by statue rocks gets 15 Stone.',
      'Burst: An unbroken statue bursts after 3 s. Its rocks deal half damage.',
      'Costs: Statues give no Stone Chunks.',
    ].join('\n'),
  },
  cells: [STATUES],
  clauses: [
    ...fromBlows(RUBBLE_STONE, 1),
    { id: 'rocks', on: 'event:rocks', do: [stoneOn(RUBBLE_STONE, { frame: 'target' }, 15)] },
  ],
};

// Stoneskin (tanks). Its statue stays until the fight ends and your blows pass it by; it throws no
// rocks (petrified_standing). Each statue standing in the fight (`world.statues`) raises your
// armour by 10%, a placeholder.
const STANDING_STONE = stoneEnding('petrified_standing');

B.basilisk_stoneskin = {
  v: 1,
  reading: {
    name: 'Stoneskin', icon: '🛡️',
    desc: [
      'Statues: Stay until the fight ends. Your attacks skip them.',
      'Armour: +10% per standing statue.',
      'Costs: Statues throw no rocks.',
    ].join('\n'),
  },
  cells: [
    STATUES,
    {
      key: 'standing', label: 'Standing statues', icon: '🗿', hold: 'none', level: 'int', tier: 'fight', show: 'count', cap: 1e9,
      status: {
        desc: '+10% armour per statue standing in this fight.',
        mods: [{ q: 'fighter.armor', op: 'mult', value: 0.1 }],
      },
    },
  ],
  clauses: [
    ...fromBlows(STANDING_STONE, 1),
    { id: 'stand', on: 'tick', do: [setCell('standing', { q: 'world.statues' })] },
    { id: 'end', on: 'event:fightEnd', do: [setCell('standing', 0)] },
  ],
};

// ---------- Weakest Weapon Master ----------
//
// The user's ability (2026-09-26, ksgproto28 docs/plans/ability-weakest-weapon-master.md):
//   "Attributes capped relatively low; technique usage grows exponentially faster; martial skills
//    lose their caps and gain WWM-only bonuses. Four melee stances (unarmed included): Power
//    (damage proportional to total skill level and technique usages), Flowing (parry proportional
//    to Power against the blow, up to 100%, striking back), Heavy (damage reduced by Power against
//    the blow, down to 0, where the blow never counts as a hit; rattles the attacker, never below
//    1/3 speed), Empty (less damage than Power, proportional to it, ignores dodge, deflection and
//    parry)." Additions the same day: the ceiling stays fixed and attribute XP past it routes into
//    Power; reps are real and multiplied, every technique drilled; new technique-use rungs past
//    10,000 at every power of ten, for every build.
// Settled 2026-11-03: all four stances in the first build; the ceiling is 20; XP past it buys
// hidden levels priced like real ones; each rung past 10,000 doubles power and takes the cooldown
// x0.9 (the rungs are the host's ladder, ksgproto28 martial.ts, not this document).
//
// Readings taken (the text does not say):
//   - "Empty" is pure damage (user 2026-09-26): unmissable, past armour, resistance and weakness.
//     It deals 60% of Power on top of the blow.
//   - Flowing parries with chance Power / (2 x the blow), up to 100%. Its answer is 60% of Power.
//   - Heavy cuts each blow by Power before armour. The attacker is slowed until its next action by
//     the share cut x 2/3, so never below a third of its speed.
//   - A stance picked in a fight applies at the player's next bar fill, so it cannot be swapped
//     between the enemy's swing and your own. Out of a fight it applies at once.
//   - The stances hold only while no ranged weapon is held; the ceiling holds whatever is held.
//   - The rep multiplier runs from x2 at 0 combat skill levels to x64 at 600, exponentially.
//
//   ceiling     the attribute ceiling. Its carrier tells the host to hold formulas there
//               (attrCeiling) and to route XP past it to this document (routeExcess).
//   reps        reps each technique execution records (repMult), for every slotted technique
//               (drillsAll).
//   past_<attr> attribute XP routed past the ceiling. The host writes these.
//   hidden      the levels that XP buys from the ceiling up, priced on the host's attribute curve.
//               The host writes it.
//   want        the stance picked (1 Power, 2 Flowing, 3 Heavy, 4 Empty).
//   stance      the stance in effect. Copied from want at each player bar fill.
//   power flowing heavy empty
//               Power while that stance is in effect and a melee weapon is held, else 0. Each
//               carrier does the stance: a damage modifier, or a field the host reads.
//
// Power = 0.4 x combat skill levels + 0.0005 x technique reps + 2 x hidden levels. All
// placeholders.
//
// Reads: ksg.martialTotal, ksg.techniqueTotal, ksg.melee. Events: barFill. Needs a host that
// knows the status fields attrCeiling, routeExcess, repMult, drillsAll, parryContest, blowCut and
// pureBlows, and writes past_<attr> and hidden. ksgproto28 does (facet/host.ts, combat.ts,
// martial.ts). A host without them gets the Power and Empty damage and nothing else.
const WWM_CEILING = 20;
const MARTIAL = { q: 'ksg.martialTotal' };
const WWM_POWER = { expr: 'add',
  a: { expr: 'mul', a: 0.4, b: MARTIAL },
  b: { expr: 'add',
    a: { expr: 'mul', a: 0.0005, b: { q: 'ksg.techniqueTotal' } },
    b: { expr: 'mul', a: 2, b: { cell: 'hidden' } } } };
// x2 at 0 combat skill levels to x64 at 600: 2 x 32^min(1, levels / 600).
const WWM_REPS = { expr: 'mul', a: 2, b: { expr: 'pow', a: 32, b: { expr: 'min', a: 1, b: { expr: 'div', a: MARTIAL, b: 600 } } } };
// 1 when the stance in effect is k, else 0: 1 - min(1, (stance - k)^2).
const stanceIs = (k) => ({ expr: 'sub', a: 1, b: { expr: 'min', a: 1, b: { expr: 'pow', a: { expr: 'sub', a: { cell: 'stance' }, b: k }, b: 2 } } });
// Each stance: its number, cell key, label, icon, rule, carrier fields, and the line a short readout
// shows (user 2026-11-03: "Flowing Stance 29" says nothing; the line says what Power does in it).
const WWM_STANCES = [
  [1, 'power', 'Power stance', '💪', 'Your blows deal +Power damage.',
    { mods: [{ q: 'fighter.damage', op: 'add', value: 1 }] },
    { text: '+{v} damage', scale: 1, base: 'Power' }],
  [2, 'flowing', 'Flowing stance', '🌊', 'Every blow up to half your Power is parried. A blow as big as your Power is parried half the time. A parry hits back for 60% of Power.',
    { parryContest: { per: 2, answer: 0.6 } },
    { text: 'parries every blow up to {v}', scale: 0.5, base: 'Power' }],
  [3, 'heavy', 'Heavy stance', '🪨', 'Every enemy blow loses your Power in damage before armour. A blow no bigger than your Power does nothing. The attacker is slowed until its next swing.',
    { blowCut: { rattle: 2 / 3 } },
    { text: 'every blow loses {v} damage', scale: 1, base: 'Power' }],
  [4, 'empty', 'Empty stance', '⭕', 'Your blows deal +60% of Power damage. They cannot be dodged and ignore armour, resistance and weakness.',
    { mods: [{ q: 'fighter.damage', op: 'add', value: 0.6 }], pureBlows: true },
    { text: '+{v} damage, unblockable', scale: 0.6, base: 'Power' }],
];
const wwmSync = (hook) => ({ id: 'sync_' + hook, on: hook, do: [
  setCell('reps', WWM_REPS),
  ...WWM_STANCES.map(([k, key]) => setCell(key,
    { expr: 'mul', a: WWM_POWER, b: { expr: 'mul', a: stanceIs(k), b: { q: 'ksg.melee' } } })),
] });

B.weakest_weapon_master = {
  v: 1,
  reading: {
    name: 'Weakest Weapon Master', icon: '🥋',
    desc: [
      'Ceiling: Formulas read every attribute at 20 or less. Gates read the real value.',
      'Excess: Attribute XP past 20 buys hidden levels. Each gives 2 Power.',
      'Reps: Each technique use counts 2 to 64 times. Every slotted technique drills.',
      'Power: 0.4 per combat skill level. 0.0005 per technique rep.',
      'Stances: Melee only. A change applies at your next swing.',
    ].join('\n'),
    choice: {
      label: 'Stance', want: 'want', active: 'stance',
      options: [
        { v: 1, name: 'Power', icon: '💪', desc: 'Your blows deal +Power damage.' },
        { v: 2, name: 'Flowing', icon: '🌊', desc: 'Every blow up to half your Power is parried. A blow as big as your Power is parried half the time. A parry hits back for 60% of Power.' },
        { v: 3, name: 'Heavy', icon: '🪨', desc: 'Every enemy blow loses your Power in damage before armour. A blow no bigger than your Power does nothing. The attacker is slowed until its next swing.' },
        { v: 4, name: 'Empty', icon: '⭕', desc: 'Your blows deal +60% of Power damage. They cannot be dodged and ignore armour, resistance and weakness.' },
      ],
    },
  },
  cells: [
    {
      key: 'ceiling', label: 'Attribute ceiling', icon: '📏', hold: 'none', level: 'int', tier: 'run', show: 'count',
      floor: WWM_CEILING, cap: 1e9,
      status: { desc: 'Formulas read every attribute at this or less.', attrCeiling: true, routeExcess: true },
    },
    {
      key: 'reps', label: 'Reps per technique use', icon: '🔁', hold: 'none', level: 'real', tier: 'run', show: 'count',
      floor: 1, cap: 1e9,
      status: { desc: 'Each technique use records this many reps. Every slotted technique drills.', repMult: true, drillsAll: true },
    },
    {
      key: 'hidden', label: 'Hidden attribute levels', icon: '📈', hold: 'none', level: 'int', tier: 'run', show: 'count',
      cap: 1e9, carrier: false,
      status: { desc: 'Attribute levels past the ceiling. +2 Power each.' },
    },
    ...['str', 'dex', 'con', 'int', 'wis', 'cha'].map((a) =>
      ({ key: 'past_' + a, hold: 'none', level: 'real', tier: 'run', cap: 1e15, carrier: false })),
    { key: 'want', hold: 'none', level: 'int', tier: 'run', floor: 1, cap: 4, carrier: false },
    { key: 'stance', hold: 'none', level: 'int', tier: 'run', floor: 1, cap: 4, carrier: false },
    ...WWM_STANCES.map(([, key, label, icon, desc, fields, line]) => ({
      key, label, icon, hold: 'none', level: 'real', tier: 'run', show: 'count', cap: 1e9, line,
      status: Object.assign({ desc }, fields),
    })),
  ],
  clauses: [
    wwmSync('tick'),
    wwmSync('minute'),
    { id: 'apply', on: 'event:barFill', do: [setCell('stance', { cell: 'want' })] },
  ],
};

// ---------- Calorie Burn ----------
//
// The user's ability (2026-09-26, ksgproto28 docs/plans/ability-calorie-burn.md): "Eat a lot to
// bank excess calories; higher stats store more. Full, the player takes a small penalty to all
// stats that slowly shrinks and turns into bonuses as calories burn. The longer a fight lasts, the
// higher the burn rate — but burn more than you can and you 'run out of control': unconscious, or
// even dead. The power increase grows exponentially toward 100% burned. If the fight has not ended
// after X seconds, max HP burns; below 10% of its normal total, no save, instant death. It
// recovers over time if the player eats back to 0% burned."
// Rulings 2026-09-26: the collapse is a death that is a setback (the host's 'dead' outcome with
// knockout consequences); the stop-burning cutoff defaults to 10%. 2026-11-03: the peak bonus is
// +100% ("further numbers need tweaking. Probably increase this cap as the player levels up and
// the calorie capacity increases"), the full-store penalty -10%, calories come from the dish's
// Well Fed (the host's eat event), and running dry at a 0% cutoff is a knockout. Later the same
// day: "the calories don't really start burning until they lose at least 33% of their HP, or 20
// seconds have passed in a fight, essentially turning it into a danger mode that begins kicking in".
// And: "calorie burn shouldn't knock out the player immediately at 0% but rather accelerate the max
// hp reduction and only knock you out when you hit 10% of your total max hp". The 10% line is the
// collapse. Asked whether it stays a death, the user answered "Make it a knockout": the collapse is
// a knockout, which replaces the 2026-09-26 ruling that it is a death that is a setback.
//
// Readings taken:
//   - The store's cap is 400 + 30 x trained CON + STR (the card's settled body).
//   - The burn runs only in fights, and only once the fight turns dangerous: HP at 67% of max or
//     less, or 20 s of fight time. Once on it stays on for that fight, even if HP comes back.
//   - Per combat tick it burns 0.25, rising by 0.015 per second since it started, at most 4 (2.5
//     to 40 calories a second at 10 ticks a second). It stops at the cutoff.
//   - The bonus prices calories burned THIS fight against the store's cap, so a wearer who never
//     eats gets nothing: 0 below 30%, then exponential (k 5) to the peak at 100%. At the default
//     10% cutoff it tops out near half the peak. It holds until the fight ends.
//   - The peak grows with the cap: x1.25 each time the cap doubles past 400 (the user's "increase
//     this cap as ... the calorie capacity increases").
//   - The full-store penalty is 0 at 70% full and the whole -10% at 100%.
//   - After 90 s of fight time, max HP burns at 0.4 a tick, absolute. The fight ends in a knockout
//     when the burned HP reaches 90% of the max it was taken from (burned >= 9 x what is left).
//   - At a 0% cutoff, once this fight's burn has emptied the store, max HP burns 2 a tick more
//     (5 times the long-fight rate), from then on and whatever the fight time. An empty store at a
//     fight's start burns nothing, so it never runs dry.
//   - Out of a fight, each game minute: the store digests 0.5 while no max HP is owed; owed max
//     HP returns 0.05 a minute, and 25 a minute while the store is full.
//
//   kcal      the store. Fed by the eat event's calories, burned in fights.
//   fburn     calories burned this fight; the bonus reads it against the cap.
//   ticks     fight time in combat ticks.
//   danger    1 once this fight has turned dangerous; the burn runs only then.
//   bticks    combat ticks since the burn started; its rate rises with them.
//   fighting  1 between fightStart and fightEnd, so the minute clauses can tell.
//   burning   the bonus in percent points; carrier: every attribute x(1 + 1% per point).
//   sated     the full-store penalty in percent points; carrier: every attribute x(1 - 1% per point).
//   debt      max HP burned; carrier: max HP -1 per point.
//   cutoff    the stop-burning share picked (1 = 10%, 2 = 0%, 3 = 25%); reading.choice.
//
// Reads: ksg.trainedBody, fighter.hp, fighter.maxHpAbs. Events: eat (calories), fightStart, fightEnd. Needs a
// host that calls Facet.tick per combat tick and Facet.minute per game minute, and has defeat.
const CB_CAP = { expr: 'add', a: 400, b: { expr: 'mul', a: 30, b: { q: 'ksg.trainedBody' } } };
const CB_SHARE = { cell: 'kcal', of: 'frac' };
const cbClamp01 = (x) => ({ expr: 'min', a: 1, b: { expr: 'max', a: 0, b: x } });
// The share of the store the player stops burning at: 10% (1), 0% (2) or 25% (3).
const cbCutIs = (k) => ({ expr: 'sub', a: 1, b: { expr: 'min', a: 1, b: { expr: 'pow', a: { expr: 'sub', a: { cell: 'cutoff' }, b: k }, b: 2 } } });
const CB_CUTOFF = { expr: 'add', a: { expr: 'mul', a: 0.1, b: cbCutIs(1) }, b: { expr: 'mul', a: 0.25, b: cbCutIs(3) } };
const CB_SECONDS = { expr: 'div', a: { cell: 'bticks' }, b: { seconds: 1 } };
// Danger: a third of max HP gone, or 20 s of fight time.
const CB_DANGER = { any: [
  { q: 'fighter.hp', op: 'lte', v: { expr: 'mul', a: 0.67, b: { q: 'fighter.maxHpAbs' } } },
  { cell: 'ticks', op: 'gte', v: { seconds: 20 } },
] };
const CB_IN_DANGER = { cell: 'danger', op: 'eq', v: 1 };
const CB_RATE = { expr: 'min', a: 4, b: { expr: 'add', a: 0.25, b: { expr: 'mul', a: 0.015, b: CB_SECONDS } } };
// The peak: +100% at a cap of 400, x1.25 each time the cap doubles (exponent log2 1.25).
const CB_PEAK = { expr: 'pow', a: { expr: 'div', a: CB_CAP, b: 400 }, b: 0.3219 };
// Exponential from 0 at 30% burned this fight to 1 at 100%: (e^5x - 1) / (e^5 - 1).
const CB_X = cbClamp01({ expr: 'div', a: { expr: 'sub', a: { cell: 'fburn', of: 'frac' }, b: 0.3 }, b: 0.7 });
const CB_RAMP = { expr: 'div', a: { expr: 'sub', a: { expr: 'pow', a: 148.4132, b: CB_X }, b: 1 }, b: 147.4132 };
const CB_BURNING = { expr: 'mul', a: 100, b: { expr: 'mul', a: CB_PEAK, b: CB_RAMP } };
// 0 at 70% full, 10 points (-10%) at 100%.
const CB_SATED = { expr: 'mul', a: 10, b: cbClamp01({ expr: 'add', a: -2.3333, b: { expr: 'mul', a: 3.3333, b: CB_SHARE } }) };
const CB_ALL = (value) => ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((a) => ({ q: 'stat.eff.' + a, op: 'mult', value }));
const CB_OUT = { cell: 'fighting', op: 'eq', v: 0 };
const CB_OWED = { cell: 'debt', op: 'gt', v: 0 };
// The collapse line: burned max HP at 90% of where it started, so burned >= 9 x what is left.
const CB_GONE = { expr: 'mul', a: 9, b: { q: 'fighter.maxHpAbs' } };
const cbFightReset = (fighting) => ['ticks', 'bticks', 'danger', 'fburn', 'burning'].map((c) => setCell(c, 0)).concat([setCell('fighting', fighting)]);

B.calorie_burn = {
  v: 1,
  reading: {
    name: 'Calorie Burn', icon: '🔥',
    desc: [
      'Store: Eating fills a calorie store. Cap 400 + 30 per trained CON + STR.',
      'Full: All attributes -10% at a full store. 0 at 70% and below.',
      'Danger: In a fight the burn starts once you lose 33% of your HP or 20 s pass.',
      'Burn: It speeds up the longer it runs. It stops at your cutoff.',
      'Bonus: All attributes up to +100% as one fight burns 30% to 100% of the store.',
      'Grows: The peak bonus x1.25 each time the cap doubles past 400.',
      'Costs: After 90 s in a fight, max HP burns. At 90% burned you are knocked out.',
      'Fails: At a 0% cutoff, running dry makes max HP burn 5 times faster.',
      'Recovers: Out of a fight max HP returns, fast while the store is full.',
    ].join('\n'),
    choice: {
      label: 'Stop burning at', want: 'cutoff', active: 'cutoff',
      options: [
        { v: 2, name: '0%', icon: '⚠️', desc: 'Burn the whole store. Running dry in a fight makes max HP burn 5 times faster.' },
        { v: 1, name: '10%', icon: '🔥', desc: 'Stop at 10% of the store. The default.' },
        { v: 3, name: '25%', icon: '🛑', desc: 'Stop at 25% of the store.' },
      ],
    },
  },
  cells: [
    {
      key: 'kcal', label: 'Calories', icon: '🍖', hold: 'none', level: 'real', tier: 'run', show: 'bar', cap: CB_CAP,
      carrier: false,
      status: { desc: 'Stored calories. Cap 400 + 30 per trained CON + STR.' },
    },
    {
      key: 'fburn', label: 'Burned this fight', icon: '🔥', hold: 'none', level: 'real', tier: 'fight', show: 'count',
      cap: CB_CAP, carrier: false,
      status: { desc: 'The bonus starts at 30% of the cap and peaks at 100%.' },
    },
    { key: 'ticks', hold: 'none', level: 'int', tier: 'fight', cap: 1e9, carrier: false },
    { key: 'danger', hold: 'none', level: 'int', tier: 'fight', cap: 1, carrier: false },
    { key: 'bticks', hold: 'none', level: 'int', tier: 'fight', cap: 1e9, carrier: false },
    { key: 'fighting', hold: 'none', level: 'int', tier: 'run', cap: 1, carrier: false },
    {
      key: 'burning', label: 'Burning', icon: '🔥', hold: 'none', level: 'real', tier: 'fight', show: 'plusPct', cap: 1e6,
      status: { desc: 'All attributes. Grows with calories burned this fight.', mods: CB_ALL(0.01) },
    },
    {
      key: 'sated', label: 'Too full', icon: '🍽️', hold: 'none', level: 'real', tier: 'run', show: 'minusPct', cap: 10,
      status: { desc: 'All attributes. -10% at a full store, 0 at 70% and below.', mods: CB_ALL(-0.01) },
    },
    {
      key: 'debt', label: 'Max HP burned', icon: '💔', hold: 'none', level: 'real', tier: 'run', show: 'count', cap: 1e9,
      status: { desc: 'Max HP lost to a long burn. Returns out of fights, fast while the store is full.',
        mods: [{ q: 'fighter.maxHpAbs', op: 'add', value: -1 }] },
    },
    { key: 'cutoff', hold: 'none', level: 'int', tier: 'run', floor: 1, cap: 3, carrier: false },
  ],
  clauses: [
    { id: 'eat', on: 'event:eat', do: [addCell('kcal', { frame: 'calories' }), setCell('sated', CB_SATED)] },
    { id: 'start', on: 'event:fightStart', do: cbFightReset(1) },
    { id: 'end', on: 'event:fightEnd', do: cbFightReset(0) },
    // The fight, per combat tick, in order: time, danger, the burn, the bonus and the penalty,
    // the max-HP burn (faster with a dry store), and the collapse.
    { id: 'clock', on: 'tick', do: [addCell('ticks', 1)] },
    { id: 'danger', on: 'tick', when: CB_DANGER, do: [setCell('danger', 1)] },
    { id: 'burn_clock', on: 'tick', when: CB_IN_DANGER, do: [addCell('bticks', 1)] },
    { id: 'burn', on: 'tick', when: { all: [CB_IN_DANGER, { cell: 'kcal', of: 'frac', op: 'gt', v: CB_CUTOFF }] },
      do: [addCell('kcal', { expr: 'mul', a: -1, b: CB_RATE }), addCell('fburn', CB_RATE)] },
    { id: 'levels', on: 'tick', do: [setCell('burning', CB_BURNING), setCell('sated', CB_SATED)] },
    { id: 'wasting', on: 'tick',
      when: { all: [{ cell: 'ticks', op: 'gte', v: { seconds: 90 } }, { cell: 'debt', op: 'lt', v: CB_GONE }] },
      do: [addCell('debt', 0.4)] },
    { id: 'collapse', on: 'tick', when: { all: [CB_OWED, { cell: 'debt', op: 'gte', v: CB_GONE }] },
      do: [{ emit: 'world', verb: 'defeat', outcome: 'knocked_out', cause: 'Calorie Burn: your max HP burned away.' }] },
    { id: 'dry', on: 'tick',
      when: { all: [{ cell: 'cutoff', op: 'eq', v: 2 }, { cell: 'kcal', op: 'lte', v: 0 }, { cell: 'fburn', op: 'gt', v: 0 },
        { cell: 'debt', op: 'lt', v: CB_GONE }] },
      do: [addCell('debt', 2)] },
    // Out of a fight, per game minute.
    { id: 'digest', on: 'minute', when: { all: [CB_OUT, { cell: 'debt', op: 'lte', v: 0 }] }, do: [addCell('kcal', -0.5)] },
    { id: 'mend_fed', on: 'minute', when: { all: [CB_OUT, CB_OWED, { cell: 'kcal', of: 'frac', op: 'gte', v: 1 }] },
      do: [addCell('debt', -25)] },
    { id: 'mend', on: 'minute', when: { all: [CB_OUT, CB_OWED] }, do: [addCell('debt', -0.05)] },
    { id: 'settle', on: 'minute', do: [setCell('sated', CB_SATED)] },
  ],
};

// ---------- Shadow Clone ----------
//
// Approved by the user (team ability GEN-18, review page 2), with the note "absolutely. no question
// asked. killer ability.":
//   Does: When you start a gathering, crafting or job activity, up to N clones start the same
//         activity. Each adds 40% of the normal yield and skill XP.
//   Grows: N is 1 + 1 per 10 character levels, max 5.
//   Costs: Each clone reserves 5% of max mana while it exists.
//   Fails: Clones are dispelled when you take a hit, switch activity, or after 1 hour.
//
// Rebuilt 2026-11-03 on the user's redesign: "I want the shadow clones to be deployable. they work
// one task until A) the player assigns one shadow clone and all available ones are used, then the
// oldest clone disappears, B) the player recalls shadow clones, C) the player moves to a floor more
// than max(0,floor((player level-10)/5)) floors away (ascent to floor 1 is distance 1), D) the
// player is knocked out by any means". And: "tasks are at normal pace but yield 40%, if a task
// involves creating an item, the time required instead becomes divided by shadow clone efficiency
// (i.e. the duration is longer), it also yields 25% skill xp instead." Bench runs count as tasks;
// hits no longer dispel clones.
//
// The clones are the host's (ksgproto28 systems/clones.ts): it sends them, works them and ends them.
// This document carries the numbers on one cell:
//   clones  how many are out, which the host writes. Its cap is the most at once, 1 + 1 per 10
//           character levels, max 5. Its carrier's cloneYield (0.4) is a clone's share of a
//           gathering or job yield and the speed of its bench crafts; cloneXp (0.25) its share of
//           the skill XP; its modifier takes 5% off max mana per clone out.
//
// Reads: fighter.level. Needs a host that deploys clones and knows the status fields cloneYield
// and cloneXp. A host without them shows the count and nothing works.
const SC_COUNT = { expr: 'min', a: 5, b: { expr: 'add', a: 1, b: { expr: 'floor', a: { expr: 'div', a: { q: 'fighter.level' }, b: 10 } } } };

B.shadow_clone = {
  v: 1,
  reading: {
    name: 'Shadow Clone', icon: '👥',
    desc: [
      'Does: Send a clone to a job, gathering or a bench. It works there on its own.',
      'Yield: 40% of the materials or pay, and 25% of the skill XP.',
      'Crafting: Whole crafts from your stock, at 40% of your speed.',
      'Count: 1 clone, +1 per 10 character levels. Max 5. A new one replaces the oldest.',
      'Costs: Each clone out takes 5% off max mana.',
      'Ends: Recall, a knockout, or straying more floors away than (level - 10) / 5.',
    ].join('\n'),
  },
  cells: [
    {
      key: 'clones', label: 'Shadow clones', icon: '👥', hold: 'none', level: 'int', tier: 'run', show: 'count', cap: SC_COUNT,
      status: {
        desc: 'Clones at work. Each takes 5% off max mana.',
        cloneYield: 0.4,
        cloneXp: 0.25,
        mods: [{ q: 'pool.mana.max', op: 'mult', value: -0.05 }],
      },
    },
  ],
  clauses: [],
};
})();
