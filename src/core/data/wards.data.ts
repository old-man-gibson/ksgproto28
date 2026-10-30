import type { WardWindowDef } from '../types';

/**
 * Band 3's ward windows (docs/plans/bands-2-3.md, "The four wards", M12):
 * timed threats that open on a ward's position. systems/wards.ts runs them.
 */
export const WARD_WINDOWS: WardWindowDef[] = [
  // ==== WARD7: window (base 2026-10-30; the ward 7 builder's section) ====
  // The burnt camp's demon: only when floor 7 is the last ward left, for 24
  // in-game hours (600 ticks an hour) from the third ward's clear.
  {
    id: 'f7_demon',
    floorId: 'ascent_f7',
    position: 3,
    ticks: 14_400,
    spotId: 'f7_burnt_camp',
    monsterId: 'ph_camp_demon',
    doneKey: 'ward:f7:done',
    atKey: 'ward:f7:demon:at',
    goneKey: 'ward:f7:demon:gone',
    foughtKey: 'ward:f7:demon:fought',
    flags: { fought: 'flag:f7:demon_marked', unmet: 'flag:f7:demon_unmet' },
  },
];
