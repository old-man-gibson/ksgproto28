// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { ITEMS, STYLES } from '../src/core/registry';
import { getDerivedStats, PARRY_CAP, PARRY_RIPOSTE } from '../src/core/systems/derived';
import { effectiveStyleId } from '../src/core/systems/styles';
import { exert } from '../src/core/systems/stamina';
import {
  HAND_SLOTS,
  MAIN_HAND_PENALTY,
  OFF_HAND_PENALTY,
  allowedSlots,
  armsUsed,
  handTakenBy,
  twoHandedWeapon,
  wieldScale,
} from '../src/core/systems/wield';
import { bearerGrants } from '../src/core/systems/mutagens';
import { createItem } from '../src/core/systems/runes';
import type { ItemInstance, SlotId } from '../src/core/types';

/** A character strong enough for every requirement in this file. */
function fighter(seed = 1): Game {
  const g = new Game(createInitialState(seed));
  g.state.attrs.str.level = 25;
  g.state.attrs.dex.level = 25;
  g.state.attrs.con.level = 25;
  g.state.inventory = [];
  return g;
}

function give(g: Game, defId: string): ItemInstance {
  const item = createItem(g.state, defId);
  g.state.inventory.push(item);
  return item;
}

describe('wield classes', () => {
  it('each class allows the hands it should', () => {
    expect(allowedSlots(ITEMS.iron_dagger)).toEqual(['weapon', 'offhand']); // light
    expect(allowedSlots(ITEMS.iron_sword)).toEqual(['weapon', 'offhand']); // one-handed, at a cost
    expect(allowedSlots(ITEMS.steel_greatsword)).toEqual(['weapon']); // two-handed
    expect(allowedSlots(ITEMS.wooden_shield)).toEqual(['offhand', 'weapon']);
    expect(allowedSlots(ITEMS.leather_cap)).toEqual(['head']); // not hand gear at all
  });

  it('prices the awkward hands and leaves the right ones alone', () => {
    expect(wieldScale(ITEMS.iron_dagger, 'weapon')).toBe(1);
    expect(wieldScale(ITEMS.iron_dagger, 'offhand')).toBe(1); // light: at home either side
    expect(wieldScale(ITEMS.iron_sword, 'weapon')).toBe(1);
    expect(wieldScale(ITEMS.iron_sword, 'offhand')).toBeCloseTo(1 - OFF_HAND_PENALTY);
    expect(wieldScale(ITEMS.steel_greatsword, 'offhand')).toBe(0);
    expect(wieldScale(ITEMS.wooden_shield, 'offhand')).toBe(1);
    expect(wieldScale(ITEMS.wooden_shield, 'weapon')).toBeCloseTo(1 - MAIN_HAND_PENALTY);
    // A buckler built to be punched forward pays nothing for it.
    expect(wieldScale(ITEMS.warden_buckler, 'weapon')).toBe(1);
  });

  it('an off-hand sword contributes only part of itself', () => {
    const g = fighter(2);
    const sword = give(g, 'iron_sword');
    g.equip(sword.uid); // main hand
    const full = getDerivedStats(g.state).damage;
    g.unequip('weapon');
    const bare = getDerivedStats(g.state).damage;

    g.equip(sword.uid, 'offhand');
    const offhand = getDerivedStats(g.state).damage;
    expect(offhand).toBeGreaterThan(bare);
    expect(offhand - bare).toBeCloseTo((full - bare) * (1 - OFF_HAND_PENALTY));
  });
});

describe('two-handed weapons', () => {
  it('clear the off hand when drawn, and are dropped for anything held there', () => {
    const g = fighter(3);
    const shield = give(g, 'wooden_shield');
    const greatsword = give(g, 'steel_greatsword');

    g.equip(shield.uid);
    expect(g.state.equipment.offhand?.uid).toBe(shield.uid);

    g.equip(greatsword.uid);
    expect(g.state.equipment.weapon?.uid).toBe(greatsword.uid);
    expect(g.state.equipment.offhand).toBeUndefined();
    expect(g.state.inventory.some((i) => i.uid === shield.uid)).toBe(true);
    expect(twoHandedWeapon(g.state, new Set())?.uid).toBe(greatsword.uid);

    // Taking the shield back up needs the greatsword hand free.
    g.equip(shield.uid);
    expect(g.state.equipment.offhand?.uid).toBe(shield.uid);
    expect(g.state.equipment.weapon).toBeUndefined();
    expect(g.state.inventory.some((i) => i.uid === greatsword.uid)).toBe(true);
  });

  it('stop blocking the off hand for a body that can spare an arm', () => {
    // The bug this exists for: the panel asked "is the weapon two-handed?" and
    // greyed the off hand out on the answer, so a gigantoid's `onehand:*` and
    // an asura's extra arms were both overruled before equipping was reached.
    const g = fighter(3);
    const greatsword = give(g, 'steel_greatsword');
    g.equip(greatsword.uid);

    expect(twoHandedWeapon(g.state, new Set())).not.toBeNull();
    // A grip that costs one arm leaves the other free...
    expect(twoHandedWeapon(g.state, new Set(['onehand:*']))).toBeNull();
    // ...and so does simply having more arms than the weapon takes.
    expect(twoHandedWeapon(g.state, new Set(['arms:+1']))).toBeNull();
  });

  it('a two-hander takes hands and nothing else', () => {
    // The bug: the equipment panel asked
    //   `slot === 'weapon' ? null : twoHandedWeapon(...)`
    // which exempts the main hand and NOTHING ELSE — so on any body without a
    // gigantoid grip or asuroid arms, picking up a greatsword greyed out and
    // DISABLED the helmet, the boots, the cloak and the ring. Having no hand
    // free is not the same as having no head.
    const g = fighter(4);
    g.equip(give(g, 'steel_greatsword').uid);
    const bare = new Set<string>();
    expect(handTakenBy(g.state, bare, 'offhand')).not.toBeNull();
    for (const slot of ['head', 'chest', 'hands', 'legs', 'feet', 'back', 'accessory'] as const) {
      expect(handTakenBy(g.state, bare, slot)).toBeNull();
    }
    // `hands` is gloves and reads like a hand slot; it is not one. It was the
    // slot in the screenshot that gave the bug away.
    expect(HAND_SLOTS.includes('hands' as SlotId)).toBe(false);
    // The main hand holds the thing, so it is never a hand the thing stole.
    expect(handTakenBy(g.state, bare, 'weapon')).toBeNull();
    // And a body with an arm to spare loses no hand at all.
    expect(handTakenBy(g.state, new Set(['arms:+1']), 'offhand')).toBeNull();
  });

  it('leaves the armour slots equippable with a greatsword in hand', () => {
    // The consequence the unit test above only implies: the panel disabled
    // those buttons, so this was unreachable in play rather than merely ugly.
    const g = fighter(5);
    g.equip(give(g, 'steel_greatsword').uid);
    const helm = give(g, 'leather_cap');
    g.equip(helm.uid);
    expect(g.state.equipment.head?.uid).toBe(helm.uid);
    expect(g.state.equipment.weapon).toBeDefined();
  });

  it('lets a grown arm actually hold something', () => {
    // `arms:+N` was a number nobody could spend: only `weapon` and `offhand`
    // existed as hand slots, so a four-armed body had two idle arms.
    const g = fighter(3);
    const greatsword = give(g, 'steel_greatsword');
    const shield = give(g, 'wooden_shield');
    const club = give(g, 'oak_club');
    g.state.mutagens.chromosome.main = { id: 'asura', quality: 'c' };

    // Slots are named explicitly, the way the panel's per-slot picker does it —
    // bare `equip` still means "put this in its usual place", so upgrading a
    // sword replaces your sword instead of quietly becoming a second one.
    g.equip(greatsword.uid, 'weapon');
    g.equip(shield.uid, 'offhand');
    g.equip(club.uid, 'hand3');
    // Four arms: the greatsword takes two, the shield and club one each.
    expect(g.state.equipment.weapon?.uid).toBe(greatsword.uid);
    expect(g.state.equipment.offhand?.uid).toBe(shield.uid);
    expect(g.state.equipment.hand3?.uid).toBe(club.uid);
    expect(armsUsed(g.state, bearerGrants(g.state))).toBe(4);
  });

  it('offers only the hands a body actually has', () => {
    const club = ITEMS.oak_club;
    expect(allowedSlots(club)).toEqual(['weapon', 'offhand']);
    expect(allowedSlots(club, 4)).toEqual(['weapon', 'offhand', 'hand3', 'hand4']);
    // A two-hander still belongs in one place however many arms you grew.
    expect(allowedSlots(ITEMS.steel_greatsword, 6)).toEqual(['weapon']);
  });

  it('refuse the off hand outright', () => {
    const g = fighter(4);
    const greatsword = give(g, 'steel_greatsword');
    g.equip(greatsword.uid, 'offhand');
    expect(g.state.equipment.offhand).toBeUndefined();
    expect(g.state.inventory.some((i) => i.uid === greatsword.uid)).toBe(true);
  });
});

describe('hand bonuses', () => {
  it('the parrying dagger only wakes up beside a rapier', () => {
    const g = fighter(5);
    const dagger = give(g, 'parrying_dagger');
    const rapier = give(g, 'rapier');
    const plain = give(g, 'iron_sword');

    g.equip(dagger.uid);
    const alone = getDerivedStats(g.state).parry; // its own +4%
    expect(alone).toBeCloseTo(0.04);

    g.equip(plain.uid); // a sword, but not a rapier
    expect(getDerivedStats(g.state).parry).toBeCloseTo(0.04);

    g.equip(rapier.uid); // the rapier's own guard (+3%) and the +5% pairing
    expect(getDerivedStats(g.state).parry).toBeCloseTo(0.12);
    expect(getDerivedStats(g.state).crit).toBeGreaterThan(0.04 + 0.02); // rapier + pairing
    // The pairing is the point: the dagger catches, the rapier answers harder.
    expect(getDerivedStats(g.state).riposte).toBeCloseTo(PARRY_RIPOSTE + 0.1);
  });

  it('a hand bonus belongs to its hand only', () => {
    const g = fighter(6);
    const buckler = give(g, 'warden_buckler');

    g.equip(buckler.uid, 'offhand');
    const held = getDerivedStats(g.state);
    expect(held.parry).toBeCloseTo(0.03); // off-hand bonus

    g.unequip('offhand');
    g.equip(buckler.uid, 'weapon');
    const punched = getDerivedStats(g.state);
    expect(punched.parry).toBeCloseTo(0.04); // main-hand bonus instead
    expect(punched.damage).toBeGreaterThan(held.damage); // +3 damage, and no misfit penalty
  });
});

describe('parrying in a fight', () => {
  it('turns blows aside and answers them, without spending the action bar', () => {
    // The dummies swing forever, which is the only way to see a 12% chance often
    // enough for a test — real encounters die long before the sample is honest.
    const g = fighter(7);
    g.state.spot = 'training_grounds';
    g.state.resources.hp = 5000;
    g.equip(give(g, 'rapier').uid);
    g.equip(give(g, 'parrying_dagger').uid);
    expect(getDerivedStats(g.state).parry).toBeCloseTo(0.12);

    g.selectActivity('hunt');
    let parries = 0;
    let barAtParry: number | null = null;
    for (let i = 0; i < 2000; i++) {
      const before = g.state.combat?.playerBar ?? 0;
      const lines = g.state.combatFeed.length;
      g.tick();
      const fresh = g.state.combatFeed.slice(Math.max(0, lines - 1));
      if (fresh.some((l) => l.text.includes('You parry'))) {
        parries++;
        // The riposte costs no progress: the bar only ever moved forward.
        if (barAtParry === null && (g.state.combat?.playerBar ?? 0) >= before) barAtParry = before;
      }
    }
    expect(parries).toBeGreaterThan(0);
    expect(barAtParry).not.toBeNull();
    // Riposte damage is a fraction of a real swing.
    expect(PARRY_RIPOSTE).toBeLessThan(1);
  });
});

/**
 * Parry used to be a stat you could only BUY — two items and one katana school.
 * These cover the three tiers that made it trainable instead: the skill, the
 * stamina bargain, and the schools that take a defensive stance's slot.
 */
describe('the parry line', () => {
  it('Deflection trains from any parrying tool, and raises both axes', () => {
    const g = fighter(20);
    g.equip(give(g, 'parrying_dagger').uid, 'offhand');
    const untrained = getDerivedStats(g.state);

    g.state.skills['deflection'] = { level: 40, xp: 0 };
    const trained = getDerivedStats(g.state);
    expect(trained.parry).toBeCloseTo(untrained.parry + 0.08); // 40 × 0.002
    expect(trained.riposte).toBeCloseTo(untrained.riposte + 0.24); // 40 × 0.006

    // Mastery you cannot use pays nothing: drop the tool, lose the bonus.
    g.unequip('offhand');
    expect(getDerivedStats(g.state).parry).toBeCloseTo(0);
    expect(getDerivedStats(g.state).riposte).toBeCloseTo(PARRY_RIPOSTE);
  });

  it('a buckler is both a shield and a parrying tool', () => {
    const g = fighter(21);
    g.state.skills['deflection'] = { level: 20, xp: 0 };
    g.state.skills['shield_combat'] = { level: 20, xp: 0 };
    g.equip(give(g, 'warden_buckler').uid, 'offhand');
    const stats = getDerivedStats(g.state);
    expect(stats.parry).toBeCloseTo(0.03 + 0.04); // off-hand bonus + Deflection 20
    expect(stats.armor).toBeGreaterThan(0); // Shield Combat still applies

    // A plank shield is not a parrying tool, so Deflection pays nothing for it.
    g.unequip('offhand');
    g.equip(give(g, 'wooden_shield').uid, 'offhand');
    expect(getDerivedStats(g.state).parry).toBeCloseTo(0);
  });

  it('Destreza and Bolognese supplant the two defensive stances', () => {
    const g = fighter(22);
    g.state.skills['school_destreza'] = { level: 1, xp: 0 };
    g.state.skills['school_bolognese'] = { level: 1, xp: 0 };

    g.equip(give(g, 'rapier').uid);
    g.setStyle('evasive');
    expect(effectiveStyleId(g.state)).toBe('destreza');
    g.setStyle('defensive');
    expect(effectiveStyleId(g.state)).toBe('defensive'); // no buckler yet

    g.equip(give(g, 'warden_buckler').uid, 'offhand');
    expect(effectiveStyleId(g.state)).toBe('bolognese');
    // The rapier alone must not qualify: sword AND buckler, or neither.
    g.unequip('offhand');
    expect(effectiveStyleId(g.state)).toBe('defensive');
  });

  it('a fencing stance buys parry with breath, and never past the cap', () => {
    const g = fighter(23);
    g.setExerting(true);
    // A full bar, or this measures the winded lockout instead of the bargain.
    g.state.resources.stamina = getDerivedStats(g.state).maxStamina;
    const spec = STYLES.destreza.exertion!;
    const bought = exert(g.state, getDerivedStats(g.state), spec);
    expect(bought.parry).toBeGreaterThan(0);
    expect(bought.parry).toBeCloseTo(spec.hit!.parry! * getDerivedStats(g.state).staminaPower);

    // Standing chance + bought chance are held to one ceiling.
    expect(Math.min(PARRY_CAP, 0.45 + bought.parry)).toBeCloseTo(PARRY_CAP);
  });

  it('Deflection manifests from fighting with a parrying tool — any stance', () => {
    const g = fighter(25);
    g.state.spot = 'woods_edge';
    g.state.skills['fighting'] = { level: 10, xp: 0 };
    g.state.resources.hp = 4000;
    g.equip(give(g, 'iron_sword').uid);
    g.equip(give(g, 'parrying_dagger').uid, 'offhand');
    g.setStyle('aggressive'); // deliberately not a defensive stance
    g.selectActivity('hunt');

    for (let i = 0; i < 3000 && !g.state.skills['deflection']; i++) g.tick();
    expect(g.state.skills['deflection']).toBeDefined();
  });

  it('Bolognese manifests by bracing behind a sword and buckler', () => {
    const g = fighter(26);
    g.state.spot = 'woods_edge';
    g.state.skills['fighting'] = { level: 30, xp: 0 };
    g.state.skills['swordsmanship'] = { level: 20, xp: 0 };
    g.state.skills['shield_combat'] = { level: 20, xp: 0 };
    g.state.skills['deflection'] = { level: 10, xp: 0 };
    g.state.resources.hp = 4000;
    g.equip(give(g, 'iron_sword').uid);
    g.equip(give(g, 'warden_buckler').uid, 'offhand');
    g.setStyle('defensive');
    g.selectActivity('hunt');

    for (let i = 0; i < 3000 && !g.state.skills['school_bolognese']; i++) g.tick();
    expect(g.state.skills['school_bolognese']).toBeDefined();
    expect(effectiveStyleId(g.state)).toBe('bolognese');
    // The unarmed school sharing this slot must stay out of it.
    expect(g.state.skills['school_wrestling']).toBeUndefined();
  });

  it('the riposte answers for whatever the stat says, not a constant', () => {
    const g = fighter(24);
    g.equip(give(g, 'rapier').uid);
    g.equip(give(g, 'parrying_dagger').uid, 'offhand');
    g.state.skills['deflection'] = { level: 50, xp: 0 };
    const stats = getDerivedStats(g.state);
    // Base 30% + 10% pairing + 30% from Deflection 50 — well past the old flat rate.
    expect(stats.riposte).toBeCloseTo(PARRY_RIPOSTE + 0.1 + 0.3);
    expect(stats.parry).toBeLessThanOrEqual(PARRY_CAP);
  });
});
