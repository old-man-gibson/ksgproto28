import type { ProseTable } from './prose';

// Player-facing text for src/core/data/sea.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- SEA_SIDES ----------
export const SEA_SIDES_TEXT: ProseTable = {
  'merchants.desc': 'Own the convoy. Each leg, raiders and sea monsters together are the threat; crates lost = threat − kills − battery. The crates left after the fourth leg are sold at port for gold, at a price your Speechcraft sets. Mission on floor 14: land the charter cargo past the closed port.',
  'pirates.desc': 'Raid the convoy. Each leg, crates seized = battery − (guard − kills). Seized crates pay cargo. Mission on floor 14: board the treasure galleon.',
  'privateers.desc': 'Hunt the pirates who took the convoy. Each leg, crates recovered = battery − (pirate crew − kills), out of what the pirate ships still carry. Recovered crates pay cargo. Mission on floor 14: take the pirate king’s flagship.',
  'navy.desc': 'Escort the convoy against sea monsters. Each leg, crates lost = monsters − kills − battery. The crates kept after the fourth leg pay cargo. Mission on floor 14: kill the sea beast that closes the lanes.',
};
