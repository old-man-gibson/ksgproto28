import type { ProseTable } from './prose';

// Player-facing text for src/core/data/martial.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- POSITIONS ----------
export const POSITIONS_TEXT: ProseTable = {
  'neutral.desc': 'Weight centred, options open. Every plain swing returns here.',

  'coiled.desc': 'Wound up, weight loaded — the next heavy motion is already paid for.',

  'extended.desc': 'Arm and blade committed forward, reach at its longest.',

  'off_balance.desc': 'The follow-through carried you past your footing — blows land harder here.',

  'guarded.desc': 'Weight back, weapon between you and the world — blows land softer here.',

  'spell_ready.desc': 'A working held at the edge of release — your attention is in it, not on them.',

  'wide_open.desc': 'You are wide open to ready yourself for an opponent\'s attack.',
};

// ---------- FORK_ARCHETYPES ----------
export const FORK_ARCHETYPES_TEXT: ProseTable = {
  'split.desc': 'The one motion becomes two — each blow lighter, together heavier.',

  'overwhelm.desc': 'Everything into it, and past it — the exit is wherever the swing leaves you.',

  'exposing.desc': 'A violent swing that leaves you wide open on an attack.',

  'economy.desc': 'No motion wasted: barely softer, far more often — and practice compounds.',

  'sweep.desc': 'The arc widens: part of every blow carries into whoever stands beside them.',

  'flowing.desc': 'The recovery becomes a reach: the motion ends extended, feeding what enters from there.',

  'lasting.desc': 'The form holds longer than it has any right to.',

  'sudden.desc': 'The answer comes again before they expect it once.',
};

// ---------- TECHNIQUES ----------
export const TECHNIQUES_TEXT: ProseTable = {
  'gather.desc': 'Plant the feet and load the hips — a softer blow now to wind a harder one.',

  'heavy_blow.desc': 'Everything the coil stored, spent in one brutal arc. Leaves you off balance.',

  'sidestep.desc': 'Answer a landed blow by not being where the next one goes: +40% dodge for 3 seconds.',

  'riposte.desc': 'The answer to an attack that found nothing — a fast cut that leaves you extended.',

  'thrust.desc': 'From full extension, drive the point home and recover to centre.',

  'crosscut.desc': 'Follow an opening with a wide diagonal that carries into the flanks.',

  'iai_draw.desc': 'The draw is the cut: the fight opens with the blade already through them.',

  'deflecting_moon.desc': 'Turn a blow along the curve and wind into it — the answer will find an opening.',

  'finishing_cut.desc': 'One cut, one kill: when the opening is real, everything goes through it.',

  'slip_jab.desc': 'The head moves, the hand answers — a short counter off the slip.',

  'whirl_kick.desc': 'Spend the coil in a full turn — the heel carries through everything beside them.',

  'clinch_knee.desc': 'Answer a landed blow by taking hold of it — a knee where the guard used to be.',

  'ginga.desc': 'You were never standing still to begin with — the fall is the wind-up.',

  'meia_lua.desc': 'A half-moon heel out of the stumble — the sweep only exists mid-fall.',

  'weapon_drop.desc': 'Throw yourself into the disarm — the blade goes down, and so does your guard.',

  'ground_draw.desc': 'The earth was the sheath all along — take the blade back up as one cut.',

  'hidden_draw.desc': 'The knife they did not know about, at the moment they are busiest swinging.',

  'ready_spell.desc': 'Hold a prepared working at the edge of release — taken up as the blow comes in.',

  'spell_parry.desc': 'Turn the blow aside and let the held working answer in its place.',

  'flowing_shield.desc': 'Catch the blow on the boss of the shield and let it carry you round — the harder they swing, the harder it comes back.',

  'electric_cross.desc': 'The Onisattva\'s very own electric counter. Take a blow to the shoulder to absorb the damage, then strike back like a lightning bolt.',

  'german_suplex.desc': 'A brutal throw that sends the opponent back',

  'taunt.desc': 'taunt your opponent by keeping yourself wide open. inflicts taunted (reduces their dodge and armor for x seconds but makes their next attack deal 20% extra damage)',

  'impaling_swing.desc': 'Run them through and leave it there — you are unarmed now, and they are carrying your blade.',

  'flesh_draw.desc': 'The flesh serves as a sheath of its own.',
};
