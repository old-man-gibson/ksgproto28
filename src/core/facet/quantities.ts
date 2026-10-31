import type { GameState, ResourceId, StatKey } from '../types';
import { STAT_NAMES } from '../types';
import { ATTRIBUTE_LIST } from '../data/attributes.data';
import { effectiveAttr } from '../systems/attributes';
import { getDerivedStats } from '../systems/derived';
import { sunlight } from '../systems/exposure';
import type { FacetQuantity } from './facet';

/**
 * Every number in this game a FACET document may read, as the core's quantity
 * registry (Facet repo docs/FACET-SPEC.md §4.1).
 *
 * **Ids are shared with InfiniteGacha wherever both games have the number.**
 * The two games run the same ability bank, so a document that reads
 * `fighter.dodge` or `stat.eff.con` has to find the same thing in either game.
 * The shared ids are the ones IG's `facet.quantities.ig.js` already uses:
 *
 *  - `stat.eff.<attr>`: the six attributes with every modifier counted.
 *    Writable, never severable.
 *  - `fighter.<key>`: the combat numbers both games have. `fighter.hp` and
 *    `fighter.maxHpAbs` are the mortality proof's vitality and can be neither
 *    severed nor (hp) written. IG's `fighter.maxHp` is a max-HP MULTIPLIER
 *    slot, not the maximum, and this game has no such slot, so it is not
 *    registered here.
 *  - `res.<type>`: the fourteen resistances, the same fourteen types in both.
 *  - `pool.<id>.cur` / `.max`: resource pools. Spirit exists only here.
 *  - `world.<name>`: the world around the bearer. `world.sunlight` (0..1,
 *    exposure.ts `sunlight`) is what Solar Charge banks; IG has none yet.
 *
 * A number only this game has is `ksg.<StatKey>`. A bank entry that reads one
 * runs only here until IG supplies the same number under a shared id.
 *
 * No `from`/`feeds`/`gates` edges yet. They matter once an ability can sever or
 * override a quantity (K3, K4 in docs/plans/universal-abilities.md); until
 * then the registry is names and readers, and an override is refused by the
 * host (see host.ts `overrideQ`).
 */

type Kind = 'prob' | 'mult' | 'flat' | 'rate' | 'pool' | 'cap' | 'scalar';
type Role = 'vitality' | 'evade' | 'coverage';

interface StatRow {
  /** The shared id when IG has the same number; `ksg.<key>` otherwise. */
  id?: string;
  kind: Kind;
  role?: Role;
}

/**
 * One row per derived stat. `Record<StatKey, …>` keeps it total: a new stat
 * fails `svelte-check` until it is classified here.
 *
 * Kinds follow BASE_FORMULA_TEXT (derived.ts): `prob` for a 0–1 share, `mult`
 * for a ×1-based multiplier, `flat`/`rate` for absolute numbers. The forge's
 * pricing and rendering read the kind; nothing else does yet.
 */
const STATS: Record<StatKey, StatRow> = {
  maxHp: { id: 'fighter.maxHpAbs', kind: 'pool', role: 'vitality' },
  hpRegen: { kind: 'rate' },
  damage: { id: 'fighter.damage', kind: 'flat' },
  attackSpeed: { kind: 'mult' },
  extraSwings: { kind: 'flat' },
  dodge: { id: 'fighter.dodge', kind: 'prob', role: 'evade' },
  crit: { id: 'fighter.crit', kind: 'prob' },
  armor: { id: 'fighter.armor', kind: 'flat', role: 'coverage' },
  spellPower: { id: 'fighter.magicDamage', kind: 'flat' },
  skillXp: { kind: 'mult' },
  trainXp: { kind: 'mult' },
  loot: { kind: 'mult' },
  goldGain: { kind: 'mult' },
  travelSpeed: { kind: 'mult' },
  craftSpeed: { kind: 'mult' },
  foodDuration: { kind: 'mult' },
  foodPotency: { kind: 'mult' },
  critDamage: { id: 'fighter.critDamage', kind: 'mult' },
  penetration: { id: 'fighter.penetration', kind: 'prob' },
  splash: { id: 'fighter.splash', kind: 'prob' },
  parry: { id: 'fighter.parry', kind: 'prob', role: 'evade' },
  riposte: { kind: 'flat' },
  speed: { id: 'fighter.speed', kind: 'rate' },
  actionBar: { kind: 'flat' },
  maxStamina: { id: 'pool.stamina.max', kind: 'pool' },
  staminaRegen: { kind: 'rate' },
  staminaEff: { kind: 'mult' },
  staminaPower: { kind: 'mult' },
  maxMana: { id: 'pool.mana.max', kind: 'pool' },
  manaRegen: { kind: 'rate' },
  manaEff: { kind: 'mult' },
  maxSpirit: { id: 'pool.spirit.max', kind: 'pool' },
  maxFocus: { id: 'pool.focus.max', kind: 'pool' },
  focusRegen: { kind: 'rate' },
  psiPressure: { kind: 'mult' },
  psiMomentum: { kind: 'mult' },
  psiInertia: { kind: 'mult' },
  psiAcuity: { kind: 'mult' },
  psiAwareness: { kind: 'mult' },
  psiCoherence: { kind: 'mult' },
  psiPurchase: { kind: 'mult' },
  resSlashing: { id: 'res.slashing', kind: 'prob', role: 'coverage' },
  resPiercing: { id: 'res.piercing', kind: 'prob', role: 'coverage' },
  resBludgeoning: { id: 'res.bludgeoning', kind: 'prob', role: 'coverage' },
  resHeat: { id: 'res.heat', kind: 'prob', role: 'coverage' },
  resCold: { id: 'res.cold', kind: 'prob', role: 'coverage' },
  resPoison: { id: 'res.poison', kind: 'prob', role: 'coverage' },
  resAcid: { id: 'res.acid', kind: 'prob', role: 'coverage' },
  resArcane: { id: 'res.arcane', kind: 'prob', role: 'coverage' },
  resLightning: { id: 'res.lightning', kind: 'prob', role: 'coverage' },
  resEarth: { id: 'res.earth', kind: 'prob', role: 'coverage' },
  resWind: { id: 'res.wind', kind: 'prob', role: 'coverage' },
  resWater: { id: 'res.water', kind: 'prob', role: 'coverage' },
  resLight: { id: 'res.light', kind: 'prob', role: 'coverage' },
  resDark: { id: 'res.dark', kind: 'prob', role: 'coverage' },
  damageTaken: { kind: 'mult', role: 'coverage' },
  ward: { id: 'fighter.ward', kind: 'flat', role: 'coverage' },
  resElemental: { kind: 'prob', role: 'coverage' },
  resRanged: { kind: 'prob', role: 'coverage' },
  critTaken: { kind: 'mult' },
  stumbleTaken: { kind: 'mult' },
  resistCap: { id: 'fighter.resistCap', kind: 'cap' },
  vsSmaller: { kind: 'flat' },
  fromSmaller: { kind: 'flat' },
  vsLarger: { kind: 'flat' },
  missRefund: { kind: 'prob' },
  graze: { kind: 'prob' },
};

/** The pools whose current value is a quantity. HP is `fighter.hp`, the rest `pool.<id>.cur`. */
const POOLS: ResourceId[] = ['stamina', 'mana', 'spirit', 'focus'];

/** Reads one quantity off the player: the native value, with no override applied. */
type Reader = (state: GameState) => number;

interface Entry {
  def: FacetQuantity;
  read: Reader;
}

function build(): Map<string, Entry> {
  const out = new Map<string, Entry>();
  const add = (def: FacetQuantity, read: Reader) => out.set(def.id, { def, read });

  for (const a of ATTRIBUTE_LIST) {
    add(
      { id: 'stat.eff.' + a.id, label: a.name, kind: 'attribute', namespace: 'stat', nullifiable: false, writable: true, modStat: a.id, modOps: ['add', 'mult'] },
      (s) => effectiveAttr(s, a.id),
    );
  }

  for (const key of Object.keys(STATS) as StatKey[]) {
    const row = STATS[key];
    const id = row.id ?? 'ksg.' + key;
    const vital = row.role === 'vitality';
    add(
      {
        id,
        label: STAT_NAMES[key],
        kind: row.kind,
        namespace: id.slice(0, id.indexOf('.')),
        nul: row.kind === 'mult' ? 1 : 0,
        nullifiable: !vital && row.kind !== 'cap',
        writable: row.kind !== 'cap',
        sealed: row.kind === 'cap',
        mortalRole: row.role ?? null,
        modStat: key,
        modOps: ['add', 'mult'],
      },
      (s) => getDerivedStats(s)[key],
    );
  }

  // Never written and never severed: the mortality proof protects this number.
  add(
    { id: 'fighter.hp', label: 'HP', kind: 'pool', namespace: 'fighter', nullifiable: false, writable: false, mortalRole: 'vitality', modStat: null },
    (s) => s.resources.hp,
  );
  for (const p of POOLS) {
    add(
      { id: 'pool.' + p + '.cur', label: p + ' (current)', kind: 'pool', namespace: 'pool', modStat: null },
      (s) => s.resources[p],
    );
  }
  // The world around the bearer. Read-only: an ability may react to the sun, not move it.
  add(
    { id: 'world.sunlight', label: 'Sunlight', kind: 'prob', namespace: 'world', nullifiable: false, writable: false, modStat: null },
    sunlight,
  );
  return out;
}

const ENTRIES = build();

/** The registry rows handed to `Facet.install` through `host.quantities()`. */
export function facetQuantities(): FacetQuantity[] {
  return [...ENTRIES.values()].map((e) => e.def);
}

/** The player's native value of a quantity, or undefined for an id this game does not register. */
export function readQuantity(state: GameState, id: string): number | undefined {
  return ENTRIES.get(id)?.read(state);
}
