import type { SuperAttributeDef } from '../types';
import { prose } from '../text/prose';
import { SUPERATTRS_TEXT } from '../text/superattrs.text';

/**
 * Super-attribute fusion definitions. Unlock conditions here are PROVISIONAL —
 * hard but reachable, so the system is playable today. The intended endgame
 * paths are far more convoluted (quest chains, hidden triggers) and will
 * replace these entries without touching system code.
 */
export const SUPERATTRS = prose<SuperAttributeDef>('SUPERATTRS', SUPERATTRS_TEXT, {
  dominion: {
    id: 'dominion',
    art: 'dominion',
    name: 'Dominion',
    icon: '👑',
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
    art: 'force',
    name: 'Force',
    icon: '🌀',
    components: ['int', 'con'],
    unlock: [
      { type: 'attr', attr: 'int', level: 60 },
      { type: 'attr', attr: 'con', level: 60 },
      { type: 'skill', id: 'magic', level: 20 },
    ],
  },
  martial_prowess: {
    id: 'martial_prowess',
    art: 'martial_prowess',
    name: 'Martial Prowess',
    icon: '🥋',
    components: ['dex', 'wis'],
    unlock: [
      { type: 'attr', attr: 'dex', level: 60 },
      { type: 'attr', attr: 'wis', level: 60 },
      { type: 'skill', id: 'school_ittou_ryu', level: 10 },
    ],
  },
});
