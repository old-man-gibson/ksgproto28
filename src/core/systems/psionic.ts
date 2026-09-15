import type {
  DerivedStats,
  GameState,
  PsiAxisId,
  PsiBias,
  PsiDerived,
  PsiMemory,
  PsiQuantityId,
  PsionicRecognitionDef,
  PsionicShape,
  SpellSpec,
  SpellStrike,
  StatusApplication,
} from '../types';
import {
  PSIONIC,
  PSI_AXES,
  PSI_QUANTITIES,
  PSI_RECOGNITION_LIST,
  PSI_STARTING_AXES,
} from '../data/spellcraft.data';
import { text } from '../text/log';

/**
 * Psionic magic: will, imposed.
 *
 * Arcane speaks a rule into the world; divine borrows a god's leave to bend
 * one. Psionics just PUSHES — points injected along eight axes, each with its
 * own cap. But the axes are not the spell. They are terms in an arithmetic:
 * the resolver computes a handful of QUANTITIES from them (see deriveShape)
 * and every part of the working is a function of those.
 *
 * That is the whole design. Mass held still is a wall and mass in motion is a
 * hammer because `inertia` and `momentum` are different products of the same
 * two numbers — not because anything anywhere enumerates walls and hammers.
 * Sight divided by how far it must spread is a needle at one end of the ratio
 * and a sweep at the other. Nothing consults a table to find out what a shape
 * means; the table that remains (PSI_RECOGNITIONS) only supplies NAMES for
 * regions a player has found, the way NAMED_RUNES names a carving.
 *
 * Progression is taught, not composed: a mind starts with force and reach,
 * and further axes — and the 4/8/12 tier recognitions — wait on teachers
 * (state.psi, raised via learnPsiAxis / raisePsiTier when content exists).
 */

export function psionicsLevel(state: GameState): number {
  return state.skills.psionics?.level ?? 0;
}

/** Per-axis point cap: 3 + skill milestones, 10 at most from skill alone. */
export function psiAxisCap(state: GameState): number {
  return PSIONIC.axisCap(psionicsLevel(state));
}

export function psiAxes(state: GameState): PsiAxisId[] {
  return state.psi?.axes ?? PSI_STARTING_AXES;
}

export function psiTier(state: GameState): number {
  return state.psi?.tier ?? 0;
}

export function axisPoints(shape: PsionicShape, axis: PsiAxisId): number {
  return shape[axis] ?? 0;
}

export function shapeTotal(shape: PsionicShape): number {
  return Object.values(shape).reduce((s, n) => s + (n ?? 0), 0);
}

/** Future teacher hooks: an axis opened, a threshold tier unlocked. */
export function learnPsiAxis(state: GameState, axis: PsiAxisId): void {
  const psi = (state.psi ??= { axes: [...PSI_STARTING_AXES], tier: 0 });
  if (!psi.axes.includes(axis)) psi.axes.push(axis);
}

export function raisePsiTier(state: GameState, tier: number): void {
  const psi = (state.psi ??= { axes: [...PSI_STARTING_AXES], tier: 0 });
  psi.tier = Math.max(psi.tier, tier);
}

// ---------- Shapes held in mind ----------

/**
 * Memorised shapes. A psionic does not carry a book — the whole identity of
 * the school is moving an allocation around on demand, and re-clicking eight
 * dials to get back to a shape you already know is the opposite of that.
 *
 * These are deliberately NOT grimoire entries: nothing here is inscribed, no
 * teacher tier is checked, and recalling one only fills the wheel. What you do
 * with it afterwards is the grimoire's business.
 */
export const MAX_PSI_MEMORIZED = 8;

export function psiMemorized(state: GameState): PsiMemory[] {
  return state.psi?.memorized ?? [];
}

/** Hold a shape in mind. Returns false if it is illegal, known, or the mind is full. */
export function memorizePsiShape(state: GameState, shape: PsionicShape, name?: string): boolean {
  if (!checkShape(state, shape).ok) return false;
  state.psi ??= { axes: [...PSI_STARTING_AXES], tier: 0 };
  const psi = state.psi;
  /*
   * Assign, then read back — never `const held = (psi.memorized ??= [])`.
   * The UI holds this state in a Svelte deep proxy, where an assignment
   * EXPRESSION evaluates to the raw value while the proxy stores a proxied
   * one. Taking the expression's value hands you an array detached from the
   * object, so every push lands somewhere nothing will ever read. It only
   * misfires when the property was absent — which is exactly every save from
   * before shapes could be memorised.
   */
  psi.memorized ??= [];
  const held = psi.memorized;
  if (held.length >= MAX_PSI_MEMORIZED) return false;
  // The same allocation twice is the same thought twice.
  const key = (s: PsionicShape) => shapeKey(s);
  if (held.some((m) => key(m.shape) === key(shape))) return false;
  held.push({ name: name?.trim() || shapeName(shape), shape: { ...shape } });
  return true;
}

export function forgetPsiShape(state: GameState, index: number): boolean {
  const held = state.psi?.memorized;
  if (!held?.[index]) return false;
  held.splice(index, 1);
  return true;
}

/**
 * An allocation's identity, zeros dropped and axes sorted — the same rule
 * `spellKey` uses, so "already memorised" and "already inscribed" agree about
 * what counts as the same shape.
 */
export function shapeKey(shape: PsionicShape): string {
  return (Object.entries(shape) as [PsiAxisId, number][])
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([a, n]) => `${a}${n}`)
    .join(',');
}

export interface ShapeCheck {
  ok: boolean;
  reason?: string;
}

export function checkShape(state: GameState, shape: PsionicShape): ShapeCheck {
  const cap = psiAxisCap(state);
  const open = psiAxes(state);
  for (const [axis, points] of Object.entries(shape) as [PsiAxisId, number][]) {
    if (!points) continue;
    if (!Number.isInteger(points) || points < 0) {
      return { ok: false, reason: text('psionic.reason.not_whole_points') };
    }
    if (!PSI_AXES[axis]) return { ok: false, reason: text('psionic.reason.no_such_axis', { axis }) };
    if (!open.includes(axis)) {
      return { ok: false, reason: text('psionic.reason.axis_locked', { axis: PSI_AXES[axis].name }) };
    }
    if (points > cap) {
      return { ok: false, reason: text('psionic.reason.axis_cap', { axis: PSI_AXES[axis].name, cap }) };
    }
  }
  if (shapeTotal(shape) === 0) {
    return { ok: false, reason: text('psionic.reason.empty_shape') };
  }
  return { ok: true };
}

// ---------- The derived space ----------

/**
 * Read a shape as the quantities it computes to. This function IS psionic
 * magic — everything below only spends what it returns.
 *
 * Note what each denominator is doing. `acuity` divides sight by the ground it
 * has to cover, so pouring points into reach is what makes a working missable;
 * `coherence` divides structure by everything that wants to burst out of it,
 * so the same four points of space hold a light shape together and are torn
 * apart by a heavy one; `inward` is a share rather than a count, so a will
 * split between mending and imposing does neither fully, and one turned
 * entirely inward needs no rule saying "and no force" to be a healing.
 *
 * Products keep zero honest for free: no speed means no momentum however much
 * mass is held, and no clairvoyance means no awareness however far the reach.
 */
/**
 * What the shaper is wearing, as multipliers on the reading. Pure lookup —
 * every source that feeds the Modifier pipeline (gear, runes, affixes, titles,
 * conditions, and a nullsteel-bearing monster through `requiresMonsterTag`)
 * arrives here already summed.
 */
export function psiBiasFrom(stats: DerivedStats): PsiBias {
  return {
    pressure: stats.psiPressure,
    momentum: stats.psiMomentum,
    inertia: stats.psiInertia,
    acuity: stats.psiAcuity,
    awareness: stats.psiAwareness,
    coherence: stats.psiCoherence,
    purchase: stats.psiPurchase,
    // No `inward`: matter changes how well a will does things, never which
    // way it points. See StatKey — there is deliberately no psiInward.
  };
}

/**
 * Read a shape as the quantities it computes to, optionally as MATTER would
 * have it. `bias` is applied last, so a piece of nullsteel does not merely
 * shave the output — it changes the numbers the rest of the resolver reads,
 * including the ones recognitions are matched against.
 */
export function deriveShape(shape: PsionicShape, bias?: PsiBias): PsiDerived {
  const p = (axis: PsiAxisId) => axisPoints(shape, axis);
  const pressure = p('force') + p('grip');
  const momentum = p('mass') * p('speed');
  const bare: PsiDerived = {
    /** How much is being imposed at all. */
    pressure,
    /** Mass in motion: the hammer. */
    momentum,
    /** Mass that is going nowhere: the wall. Speed is what takes it away. */
    inertia: Math.max(0, p('mass') - p('speed')),
    /**
     * Sight per unit of what it has to cover. Reach spreads it across the
     * field; momentum spreads it across the moment — sight cannot hold a
     * pinpoint on something it is also swinging. So a shape is a needle or a
     * hammer and cannot be both, without a word of that written anywhere.
     */
    acuity: p('clairvoyance') / Math.max(1, p('reach') + onPointScale(momentum)),
    /** Sight spread across the field: seeing everyone at once. */
    awareness: p('clairvoyance') * p('reach'),
    /** Structure against what wants to burst out of it. */
    coherence: p('space') / Math.max(1, p('force') + p('mass')),
    /**
     * How well the working holds on to what it caught. Grip divided by how
     * fast the whole thing is happening: a grab made at speed does not hold.
     *
     * This is what stops grip being the one axis you could pour points into
     * for free. Every other axis costs something somewhere — force and mass
     * fight coherence, reach dilutes acuity, speed destroys inertia — and now
     * speed pays twice, which it should, having been nearly pure upside.
     *
     * Zero grip is a real statement rather than an absence: the working is
     * SLIPPERY. Everything it does still lands; none of it stays.
     */
    purchase: p('grip') / (1 + p('speed')),
    /** The share of the will turned inward rather than out. */
    inward: p('vitality') / Math.max(1, p('vitality') + pressure),
  };
  if (!bias) return bare;
  // Matter has its say last, on the reading rather than on the result — so a
  // biased quantity carries through every threshold that keys off it.
  for (const id of Object.keys(bare) as PsiQuantityId[]) {
    const mult = bias[id];
    if (mult !== undefined && mult !== 1) bare[id] = Math.max(0, bare[id] * mult);
  }
  return bare;
}

/**
 * A product of two axes, brought back onto the scale points are spent on.
 * `mass 10 × speed 10` is a hundred, which is not a number of points and must
 * not be fed to the curve as though it were; its square root is ten, which is
 * exactly the ten-and-ten that bought it. Geometric means also stay honest at
 * the edges — either factor at zero takes the whole term with it.
 */
function onPointScale(product: number): number {
  return Math.sqrt(product);
}

/** How wide the working reaches: its reach, plus sight that spans the field. */
function spreadOf(shape: PsionicShape, d: PsiDerived): number {
  return axisPoints(shape, 'reach') + onPointScale(d.awareness) * PSIONIC.awarenessSpread;
}

/**
 * The share of itself a shape keeps rather than spends. Saturating, so no
 * amount of structure ever withholds the blow entirely — coherence is a
 * trade, not an off switch.
 */
function holdOf(d: PsiDerived): number {
  return d.coherence / (d.coherence + 1);
}

// ---------- Recognitions ----------

/** A band's subject: a derived quantity, or the rare raw axis. */
function regionValue(key: string, shape: PsionicShape, d: PsiDerived): number {
  return key in d ? d[key as PsiQuantityId] : axisPoints(shape, key as PsiAxisId);
}

function inRegion(r: PsionicRecognitionDef, shape: PsionicShape, d: PsiDerived): boolean {
  return Object.entries(r.region).every(([key, band]) => {
    const value = regionValue(key, shape, d);
    if (band.min !== undefined && value < band.min) return false;
    if (band.max !== undefined && value > band.max) return false;
    return true;
  });
}

/**
 * Does `a` demand everything `b` does, and at least as much of it? A region
 * nested inside another is the more particular claim about the space, and
 * wins when both fit — so a deeper commitment always realises the deeper
 * name, never whichever happened to be declared first.
 */
function subsumes(a: PsionicRecognitionDef, b: PsionicRecognitionDef): boolean {
  const bands = Object.entries(b.region) as [string, { min?: number; max?: number }][];
  return bands.every(([key, band]) => {
    const own = (a.region as Record<string, { min?: number; max?: number }>)[key];
    if (!own) return false;
    if (band.min !== undefined && (own.min ?? -Infinity) < band.min) return false;
    if (band.max !== undefined && (own.max ?? Infinity) > band.max) return false;
    return true;
  });
}

/** Explicit priority, then nesting, then the more constrained region. */
function beats(a: PsionicRecognitionDef, b: PsionicRecognitionDef): boolean {
  const pa = a.priority ?? 0;
  const pb = b.priority ?? 0;
  if (pa !== pb) return pa > pb;
  const nested = subsumes(a, b);
  if (nested !== subsumes(b, a)) return nested;
  return Object.keys(a.region).length > Object.keys(b.region).length;
}

/**
 * The name this shape has earned, if the mind is taught enough to hold it.
 * Below the teacher tier the recognition simply does not come — the working
 * is no less real, it is just nameless, and slightly weaker for being so.
 */
export function recogniseShape(
  shape: PsionicShape,
  tier: number,
  bias?: PsiBias,
): PsionicRecognitionDef | undefined {
  const d = deriveShape(shape, bias);
  let best: PsionicRecognitionDef | undefined;
  for (const r of PSI_RECOGNITION_LIST) {
    if ((r.tier ?? 0) > tier || !inRegion(r, shape, d)) continue;
    if (!best || beats(r, best)) best = r;
  }
  return best;
}

// ---------- Naming an unrecognised shape ----------

/**
 * What a shape is MOSTLY, when it is nothing in particular. Each character is
 * a derived quantity brought onto a shared scale so they can be compared —
 * the loudest one names the working. Declaration order breaks ties, so the
 * distinctive characters sit above the plain ones.
 *
 * Most quantities appear TWICE, once per face, because a name that ignored
 * the aim would lie: ten mass and ten speed is a Hammer thrown outward and a
 * Rush worn inward, and those are not the same working. `face` weights the
 * character by the share actually pointed that way; a character with no face
 * is aim-neutral (space folds something either way — the question is only
 * whose geometry).
 */
const CHARACTERS: {
  noun: string;
  icon: string;
  face?: 'in' | 'out';
  of: (d: PsiDerived, shape: PsionicShape) => number;
}[] = [
  { noun: 'Mending', icon: '💚', face: 'in', of: (_d, s) => axisPoints(s, 'vitality') * 0.8 },
  { noun: 'Rush', icon: '💨', face: 'in', of: (d) => onPointScale(d.momentum) },
  { noun: 'Hammer', icon: '🔨', face: 'out', of: (d) => onPointScale(d.momentum) },
  { noun: 'Needle', icon: '📍', face: 'out', of: (d) => d.acuity },
  { noun: 'Foresight', icon: '🔮', face: 'in', of: (d) => d.acuity },
  { noun: 'Anchor', icon: '🪨', face: 'out', of: (d) => d.inertia },
  { noun: 'Root', icon: '🌱', face: 'in', of: (d) => d.inertia },
  { noun: 'Wave', icon: '🌊', face: 'out', of: (d) => onPointScale(d.awareness) },
  { noun: 'Vigil', icon: '👁️', face: 'in', of: (d) => onPointScale(d.awareness) },
  { noun: 'Fold', icon: '🌀', of: (d) => d.coherence * 2 },
  // Reads `purchase`, not raw grip: a grab made at speed is not a vise.
  { noun: 'Vise', icon: '🫳', face: 'out', of: (d) => d.purchase * 0.6 },
  { noun: 'Ward', icon: '💢', face: 'in', of: (d) => d.pressure * 0.5 },
  { noun: 'Spike', icon: '👊', face: 'out', of: (_d, s) => axisPoints(s, 'force') * 0.5 },
];

function characterOf(shape: PsionicShape, d: PsiDerived) {
  let best: (typeof CHARACTERS)[number] | undefined;
  let bestWeight = 0;
  for (const c of CHARACTERS) {
    const share = c.face === 'in' ? d.inward : c.face === 'out' ? 1 - d.inward : 1;
    const weight = c.of(d, shape) * share;
    if (weight > bestWeight) {
      best = c;
      bestWeight = weight;
    }
  }
  return best;
}

/** The generated name when no recognition takes: the loudest quantity speaks. */
export function shapeName(shape: PsionicShape): string {
  if (shapeTotal(shape) === 0) return 'Empty Mind';
  const character = characterOf(shape, deriveShape(shape));
  // No character at all means nothing but delivery axes — a gesture with no
  // working behind it (see describeDerived).
  return character ? `Mind ${character.noun}` : 'Empty Gesture';
}

/**
 * The readout a nameless shape wears as its description: the quantities it
 * came out as, which is the only honest account of what it will do. This is
 * also what makes the space legible — a player reads the same numbers the
 * resolver does.
 */
export function describeDerived(d: PsiDerived): string {
  const parts = (Object.entries(d) as [PsiQuantityId, number][])
    .filter(([, value]) => value > 0)
    .map(([id, value]) => `${PSI_QUANTITIES[id].name} ${value.toFixed(PSI_QUANTITIES[id].decimals)}`);
  /*
   * Every quantity at zero means the shape is nothing but reach and speed —
   * the delivery axes, which say how a working arrives rather than what it
   * is. Say so, instead of leaving a blank line above "Does nothing at all".
   */
  if (!parts.length) {
    return 'Reach and Speed only shape how a working arrives. This one has nothing to deliver.';
  }
  return parts.join(' · ');
}

// ---------- Resolution ----------

/**
 * Resolve a shape to its spec. Every line below reads a derived quantity, not
 * a point count — that is the invariant worth keeping. `tier` travels with the
 * call rather than the spell, because a shape once held stays held, but the
 * NAME only comes if the shaper has been taught to see it.
 */
export function shapeSpec(shape: PsionicShape, tier = 12, bias?: PsiBias): SpellSpec {
  const p = (axis: PsiAxisId) => axisPoints(shape, axis);
  const curve = PSIONIC.pointCurve;
  const d = deriveShape(shape, bias);

  const drive = onPointScale(d.momentum);
  const spread = spreadOf(shape, d);
  const hold = holdOf(d);
  // Will spent mending is will not spent imposing, and the reverse.
  const outward = 1 - d.inward;
  /*
   * The two persistences, and they come from different places on purpose:
   * structure keeps YOUR working standing, purchase keeps it on THEM.
   */
  const worn = Math.round(PSIONIC.inwardDuration(d.coherence));
  const held = Math.round(PSIONIC.adhesion(d.purchase));

  const strikes: SpellStrike[] = [];
  const raw =
    curve(p('force')) * PSIONIC.forcePower +
    curve(drive) * PSIONIC.momentumPower +
    curve(p('grip')) * PSIONIC.gripPower;
  const power = raw * outward * (1 - hold * PSIONIC.holdCost);

  if (power > 0) {
    const strike: SpellStrike = {
      // Sight narrowed to a point does not push, it PUNCTURES: the same will,
      // arriving somewhere small enough to matter. Everything broader lands
      // as blunt trauma, which is what an unfocused shove has always been.
      type: d.acuity >= PSIONIC.needleAcuity ? 'piercing' : 'bludgeoning',
      power,
    };
    // Armour is a guess about where the blow will be. Acuity carried through
    // coherent space beats the guess.
    const penetration = Math.min(0.95, d.acuity * (1 + d.coherence) * PSIONIC.penPerAcuity);
    if (penetration > 0) strike.penetration = penetration;

    const inflicts: StatusApplication[] = [];
    if (p('grip') > 0) {
      /*
       * No `duration` here on purpose. A daze is not held for a length of
       * time, it is SPENT — it has no clock of its own (duration: null) and
       * comes off as the bearer loses actions to it. Handing it a number
       * would quietly turn it into an ordinary timed condition.
       */
      inflicts.push({
        id: 'dazed',
        intensity: 1,
        chance: Math.min(0.95, p('grip') * PSIONIC.gripChance),
      });
    }
    // A hammer rattles what it hits, however calmly it was aimed.
    if (drive > 0) {
      inflicts.push({
        id: 'concussed',
        intensity: 1,
        chance: Math.min(0.9, drive * PSIONIC.concussChance),
        duration: held,
      });
    }
    if (inflicts.length) strike.inflicts = inflicts;
    strikes.push(strike);
  }

  // Biased, so matter can rob a shape of its name: nullsteel dragging acuity
  // under the needle threshold leaves an Unerring Needle as a plain shove.
  const recognition = recogniseShape(shape, tier, bias);
  const character = characterOf(shape, d);
  const spec: SpellSpec = {
    name: recognition?.name ?? shapeName(shape),
    icon: recognition?.icon ?? character?.icon ?? '🧠',
    desc: recognition?.desc ?? describeDerived(d),
    school: 'psionic',
    target: spread >= PSIONIC.reachAll ? 'others' : 'one',
    strikes,
    // Psionics spends focus, never mana — one pool per school, and the arcane
    // one is not psionics' to draw on.
    manaCost: 0,
    focusCost: PSIONIC.focusBase + shapeTotal(shape) * PSIONIC.focusPerPoint,
    cooldown: Math.max(40, Math.round(PSIONIC.cooldown * Math.pow(PSIONIC.speedCooldown, p('speed')))),
  };
  // Sight far enough ahead of the target that there is nowhere left to be.
  if (d.acuity >= PSIONIC.sureAcuity) spec.sure = true;
  if (spread > 0 && spread < PSIONIC.reachAll) {
    spec.splash = Math.min(0.75, spread * PSIONIC.reachSplash);
  }
  // A will turned wholly inward mends half again as well as a divided one.
  if (p('vitality') > 0) {
    spec.heal = curve(p('vitality')) * PSIONIC.vitalityHeal * (0.5 + d.inward);
  }

  /*
   * ---- What the shape leaves standing, and which way it faces ----
   *
   * `inward` is an AIM, not a healing switch. Every quantity above has been
   * spent outward at its `outward` share; here each one spends its `inward`
   * share on the shaper instead. The same momentum that was a hammer is
   * speed; the same pressure that was a blow is armour. Nothing is discarded
   * either way, which is the whole point — a shape that pours ten mass and
   * ten speed into a wholly inward working is not wasting twenty points, it
   * is going very fast.
   *
   * Magnitudes are the aimed quantity itself: the status carries what one
   * unit is worth and `statusMods` scales from there. Only the GATE lives in
   * PSIONIC. Lifetime comes from coherence alone — structure is what makes a
   * working persist.
   */
  const grants: StatusApplication[] = [];
  const inwardFace = (id: string, aimed: number, gate: number) => {
    if (aimed >= gate) grants.push({ id, intensity: aimed, duration: worn });
  };

  inwardFace('psionic_haste', drive * d.inward, PSIONIC.hasteMomentum);
  inwardFace('psionic_bracing', d.pressure * d.inward, PSIONIC.braceGate);
  inwardFace('psionic_root', d.inertia * d.inward, PSIONIC.rootInertia);
  inwardFace('psionic_foresight', d.acuity * d.inward, PSIONIC.foresightGate);
  inwardFace('psionic_wide_sight', onPointScale(d.awareness) * d.inward, PSIONIC.wideSightGate);

  /*
   * Coherence's INWARD face is `duration` itself, computed above: structure
   * turned on your own working is what makes it persist. It grants no
   * condition of its own deliberately — the obvious one (fold the space you
   * stand in, gain dodge) is Ik'Thel'the's Fold Space, and a school does not
   * borrow a deity's signature. Persistence is the better role anyway: it is
   * worth more the more faces you are already wearing.
   */
  // Held mass, aimed outward, stands in the world as a wall. Structure is not
  // required to raise one — mass that is going nowhere IS the wall — it only
  // decides how long the wall keeps standing.
  if (d.inertia * outward >= PSIONIC.bulwarkInertia) {
    grants.push({ id: 'kinetic_bulwark', intensity: 1, duration: worn });
  }
  if (grants.length) spec.grants = grants;

  /*
   * ---- The outward faces that are not force ----
   *
   * Sight and structure aimed at someone are not blows and never were, so they
   * cannot ride one: `SpellStrike.inflicts` only lands when its strike dealt
   * damage, which a forceless working never does. They arrive as the working
   * itself instead (see SpellSpec.afflicts).
   *
   * This is what stops a shape from costing points and doing nothing. Every
   * quantity now stands on its own in BOTH aims — spend forty points on sight
   * and structure and you have exposed them and argued with the space they
   * are in, which is a working, even though nobody was hit.
   */
  const afflicts: StatusApplication[] = [];
  // These hold for as long as the working has PURCHASE on them — not for as
  // long as your own structure stands, which is what keeps your buffs up.
  const outwardFace = (id: string, aimed: number, gate: number) => {
    if (aimed >= gate) afflicts.push({ id, intensity: aimed, duration: held });
  };
  outwardFace('psionic_read', d.acuity * outward, PSIONIC.readGate);
  outwardFace('psionic_compression', d.coherence * outward, PSIONIC.compressionGate);
  if (afflicts.length) spec.afflicts = afflicts;

  // A name is worth something, uniformly. See PSIONIC.recognitionBonus.
  if (recognition) {
    for (const s of spec.strikes) s.power *= PSIONIC.recognitionBonus;
    if (spec.heal) spec.heal *= PSIONIC.recognitionBonus;
  }
  return spec;
}
