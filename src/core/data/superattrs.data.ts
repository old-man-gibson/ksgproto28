import type { SuperAttributeDef } from '../types';

/**
 * Super-attribute fusion definitions. Unlock conditions here are PROVISIONAL —
 * hard but reachable, so the system is playable today. The intended endgame
 * paths are far more convoluted (quest chains, hidden triggers) and will
 * replace these entries without touching system code.
 */
export const SUPERATTRS: Record<string, SuperAttributeDef> = {
  dominion: {
    id: 'dominion',
    name: 'Dominion',
    icon: '👑',
    desc: 'Might and presence fuse into something that commands the world outright.',
    components: ['str', 'cha'],
    unlock: [
      { type: 'attr', attr: 'str', level: 60 },
      { type: 'attr', attr: 'cha', level: 60 },
      { type: 'stat', key: 'kills', value: 500 },
      { type: 'stat', key: 'gold:earned', value: 25000 },
    ],
  },
  force: {
    id: 'force',
    name: 'Force',
    icon: '🌀',
    desc: 'A mind sharp enough to grasp the world and a body dense enough to withstand it become one lever.',
    components: ['int', 'con'],
    unlock: [
      { type: 'attr', attr: 'int', level: 60 },
      { type: 'attr', attr: 'con', level: 60 },
      { type: 'skill', id: 'magic', level: 20 },
    ],
  },
  martial_prowess: {
    id: 'martial_prowess',
    name: 'Martial Prowess',
    icon: '🥋',
    desc: 'When insight and reflex stop being separate things, technique stops being technique.',
    components: ['dex', 'wis'],
    unlock: [
      { type: 'attr', attr: 'dex', level: 60 },
      { type: 'attr', attr: 'wis', level: 60 },
      { type: 'skill', id: 'school_ittou_ryu', level: 10 },
    ],
  },
};
