import type { SlotId } from '../../../core/types';

/**
 * The ghost an empty equipment slot shows: a name in manifest.json (the Clockwork
 * Raven equipment_slot_placeholders). Every slot has one. The extra hands share
 * the off hand's, and the cloak slot takes the shoulders'.
 */
export const SLOT_ART: Record<SlotId, string> = {
  weapon: 'slot_weapon',
  offhand: 'slot_offhand',
  hand3: 'slot_offhand',
  hand4: 'slot_offhand',
  hand5: 'slot_offhand',
  hand6: 'slot_offhand',
  head: 'slot_head',
  chest: 'slot_chest',
  hands: 'slot_hands',
  legs: 'slot_legs',
  feet: 'slot_feet',
  back: 'slot_back',
  accessory: 'slot_accessory',
};

/**
 * The mark on an empty weapon slot that floats (telekinesis). Its own name, not a
 * glyph-table entry: 🌀 stands for other things in text.
 */
export const FLOATING_SLOT_ART = 'slot_floating';
