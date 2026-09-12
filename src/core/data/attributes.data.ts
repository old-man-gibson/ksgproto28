import type { AttributeId, Milestone, Modifier } from '../types';
import { prose } from '../text/prose';
import { ATTRIBUTE_TRAINING_TEXT } from '../text/attributes.text';

// Attribute content: display metadata and the training-rank tables.
// The AttributeId union itself stays in types.ts (it's structural, not content).

export const ATTRIBUTE_LIST: { id: AttributeId; name: string; icon: string }[] = [
  { id: 'str', name: 'Strength', icon: '💪' },
  { id: 'dex', name: 'Dexterity', icon: '🤸' },
  { id: 'con', name: 'Constitution', icon: '🛡️' },
  { id: 'int', name: 'Intelligence', icon: '📖' },
  { id: 'wis', name: 'Wisdom', icon: '🦉' },
  { id: 'cha', name: 'Charisma', icon: '🎭' },
];

/** One mastery rank of an attribute's training skill. */
export interface TrainingRank {
  level: number;
  name: string;
  /** Permanent bonuses granted while the TRAINED level is at or above `level` (cumulative across ranks). */
  bonus?: Modifier[];
}

/**
 * A quiet bonus earned at a trained level, between/outside the named ranks.
 * Same shape as a skill milestone — see `Milestone` in types.ts.
 */
export type TrainingMilestone = Milestone;

/**
 * Standard milestone cadence: +1 <attr> at every trained level ending in 5,
 * +1% <attr> at every level ending in 0, up to `cap`. Tune an attribute by
 * replacing its `milestones` array with a hand-written list (same shape).
 */
export function standardMilestones(attr: AttributeId, cap = 100): TrainingMilestone[] {
  const out: TrainingMilestone[] = [];
  for (let level = 5; level <= cap; level += 5) {
    out.push({
      level,
      bonus: [
        level % 10 === 0
          ? { stat: attr, op: 'mult', value: 0.01 }
          : { stat: attr, op: 'add', value: 1 },
      ],
    });
  }
  return out;
}

/**
 * Attribute TRAINING presented as skills (proto26's attributeSkills): the
 * trained level/XP live in state.attrs, but the Skills tab renders them as
 * training skills with mastery-tier names. Reaching a rank grants its `bonus`
 * modifiers permanently, and `milestones` sprinkle smaller bonuses between the
 * named ranks — both ride the shared Modifier pipeline and are cumulative.
 * Ranks and milestones read the TRAINED base level, never the effective value,
 * which is why they may safely target the attribute itself (the bonus raises
 * the EFFECTIVE value and can never re-trigger its own threshold). Both lists
 * must stay sorted by level.
 */
export const ATTRIBUTE_TRAINING = prose<{ name: string; desc: string; tierNames: TrainingRank[]; milestones?: TrainingMilestone[] }, AttributeId>('ATTRIBUTE_TRAINING', ATTRIBUTE_TRAINING_TEXT, {
  str: {
    name: 'Strength Training',
    tierNames: [
      { level: 1, name: 'Strength Training — Beginner' },
      {
        level: 21,
        name: 'Strength Training — Intermediate',
        bonus: [{ stat: 'damage', op: 'add', value: 2 }],
      },
      {
        level: 41,
        name: 'Strength Training — Advanced',
        bonus: [
          { stat: 'damage', op: 'add', value: 4 },
          { stat: 'damage', op: 'mult', value: 0.05 },
        ],
      },
      {
        level: 61,
        name: "Giant's Strength Training",
        bonus: [
          { stat: 'damage', op: 'add', value: 8 },
          { stat: 'damage', op: 'mult', value: 0.1 },
        ],
      },
      {
        level: 81,
        name: "Titan's Strength Training",
        bonus: [
          { stat: 'damage', op: 'add', value: 15 },
          { stat: 'damage', op: 'mult', value: 0.2 },
        ],
      },
    ],
    milestones: standardMilestones('str'),
  },
  dex: {
    name: 'Dexterity Training',
    tierNames: [
      { level: 1, name: 'Dexterity Training — Beginner' },
      {
        level: 21,
        name: 'Dexterity Training — Intermediate',
        bonus: [{ stat: 'speed', op: 'add', value: 3 }],
      },
      {
        level: 41,
        name: 'Dexterity Training — Advanced',
        bonus: [
          { stat: 'speed', op: 'add', value: 6 },
          { stat: 'speed', op: 'mult', value: 0.04 },
        ],
      },
      {
        level: 61,
        name: 'Ghostly Dexterity Training',
        bonus: [
          { stat: 'speed', op: 'add', value: 12 },
          { stat: 'speed', op: 'mult', value: 0.08 },
        ],
      },
      {
        level: 81,
        name: "Wraith's Dexterity Training",
        // Superhuman: the action bar itself shrinks — every action resolves sooner.
        bonus: [
          { stat: 'speed', op: 'add', value: 20 },
          { stat: 'actionBar', op: 'mult', value: -0.08 },
        ],
      },
    ],
    milestones: standardMilestones('dex'),
  },
  con: {
    name: 'Constitution Training',
    tierNames: [
      { level: 1, name: 'Constitution Training — Beginner' },
      {
        level: 21,
        name: 'Constitution Training — Intermediate',
        bonus: [{ stat: 'maxHp', op: 'add', value: 20 }],
      },
      {
        level: 41,
        name: 'Constitution Training — Advanced',
        bonus: [
          { stat: 'maxHp', op: 'add', value: 40 },
          { stat: 'maxHp', op: 'mult', value: 0.05 },
        ],
      },
      {
        level: 61,
        name: "Troll's Constitution Training",
        bonus: [
          { stat: 'armor', op: 'add', value: 2 },
          { stat: 'maxHp', op: 'mult', value: 0.1 },
        ],
      },
      {
        level: 81,
        name: "Mountain's Constitution Training",
        bonus: [
          { stat: 'maxHp', op: 'add', value: 150 },
          { stat: 'maxHp', op: 'mult', value: 0.2 },
        ],
      },
    ],
    milestones: standardMilestones('con'),
  },
  int: {
    name: 'Intelligence Study',
    tierNames: [
      { level: 1, name: 'Intelligence Study — Beginner' },
      {
        level: 21,
        name: 'Intelligence Study — Intermediate',
        bonus: [{ stat: 'spellPower', op: 'add', value: 3 }],
      },
      {
        level: 41,
        name: 'Intelligence Study — Advanced',
        bonus: [{ stat: 'skillXp', op: 'mult', value: 0.05 }],
      },
      {
        level: 61,
        name: "Sage's Intellect",
        bonus: [
          { stat: 'spellPower', op: 'add', value: 8 },
          { stat: 'spellPower', op: 'mult', value: 0.1 },
        ],
      },
      {
        level: 81,
        name: 'Cosmic Mind',
        bonus: [
          { stat: 'skillXp', op: 'mult', value: 0.1 },
          { stat: 'spellPower', op: 'mult', value: 0.2 },
        ],
      },
    ],
    milestones: [
		{
			level: 5, 
			bonus: [ 
				{stat: 'skillXp', op: 'add', value:1},
			],
		},
		{
			level: 7,
			bonus: [
			{stat: 'int', op: 'add', value: 2},
			]
		},
		{
			level:10,
			bonus: [
			{stat: 'int', op: 'mult', value: 0.1},
			{stat: 'maxMana', op: 'mult', value: 0.1},
			]
		}
	],
  },
  wis: {
    name: 'Wisdom Contemplation',
    tierNames: [
      { level: 1, name: 'Wisdom Contemplation — Beginner' },
      {
        level: 21,
        name: 'Wisdom Contemplation — Intermediate',
        bonus: [{ stat: 'trainXp', op: 'mult', value: 0.05 }],
      },
      {
        level: 41,
        name: 'Wisdom Contemplation — Advanced',
        bonus: [{ stat: 'loot', op: 'add', value: 0.15 }],
      },
      {
        level: 61,
        name: "Elder's Wisdom",
        bonus: [{ stat: 'trainXp', op: 'mult', value: 0.1 }],
      },
      {
        level: 81,
        name: 'Enlightened',
        bonus: [
          { stat: 'loot', op: 'add', value: 0.25 },
          { stat: 'trainXp', op: 'mult', value: 0.15 },
        ],
      },
    ],
    milestones: standardMilestones('wis'),
  },
  cha: {
    name: 'Charisma Practice',
    tierNames: [
      { level: 1, name: 'Charisma Practice — Beginner' },
      {
        level: 21,
        name: 'Charisma Practice — Intermediate',
        bonus: [{ stat: 'goldGain', op: 'mult', value: 0.05 }],
      },
      {
        level: 41,
        name: 'Charisma Practice — Advanced',
        bonus: [{ stat: 'goldGain', op: 'add', value: 0.15 }],
      },
      {
        level: 61,
        name: 'Silver Tongue',
        bonus: [{ stat: 'goldGain', op: 'mult', value: 0.1 }],
      },
      {
        level: 81,
        name: 'Sovereign Presence',
        bonus: [
          { stat: 'goldGain', op: 'add', value: 0.3 },
          { stat: 'goldGain', op: 'mult', value: 0.15 },
        ],
      },
    ],
    milestones: standardMilestones('cha'),
  },
});
