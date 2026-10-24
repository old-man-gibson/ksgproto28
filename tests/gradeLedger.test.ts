import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { DISCIPLINES } from '../src/core/data/disciplines.data';
import { QUALITY_ORDER } from '../src/core/data/quality.data';
import { grantGraded, type Placement } from '../src/core/systems/disciplines';
import { JUDGEMENT_CAP, cookJudgement, cookLedger } from '../src/core/systems/cooking';
import {
  JUDGEMENT_WORDS,
  RULER_FROM,
  RULER_TO,
  gapSentence,
  gapText,
  gradeText,
  judgementStep,
  ledgerSummary,
  rulerBlocks,
  rulerPct,
  scoreText,
} from '../src/ui/lib/gradeLedger';
import type { GradedStack, QualityTier } from '../src/core/types';

const STOVE = DISCIPLINES.cooking;
const at = (id: string, quality: QualityTier = 'c'): GradedStack => ({ id, quality });

function ledgerFor(level: number, placement: Placement, duration = 12) {
  const g = new Game(createInitialState(1));
  g.state.skills.cooking = { level, xp: 0 };
  for (const id of ['raw_meat', 'wild_onion', 'wild_onion_diced']) {
    for (const q of ['c', 'b', 'a', 's'] as const) grantGraded(g.state, id, q, 5);
  }
  return cookLedger(g.state, placement, STOVE, duration);
}

describe('the ledger’s collapsed line', () => {
  it('reads grade, score and the gap to the next tier', () => {
    const l = ledgerFor(1, { main: at('wild_onion'), second: at('raw_meat') });
    // Two Fair parts, both cooked right: mean 1.00, plus 1/15 for the cook.
    expect(l.score[0]).toBeCloseTo(1 + 1 / 15, 6);
    expect(ledgerSummary(l)).toBe('Fair · 1.07 · Fine 0.53 short');
    expect(gradeText(l)).toBe('Fair');
    expect(scoreText(l)).toBe('1.07');
    expect(gapText(l)).toBe('Fine 0.53 short');
  });

  it('says the top grade has no next tier', () => {
    const l = ledgerFor(60, { main: at('wild_onion', 's'), second: at('raw_meat', 's') });
    expect(l.next).toBeUndefined();
    expect(ledgerSummary(l)).toBe('Divine · 6.00 · top grade');
  });

  it('shows a spread where cuts roll, and says when the best roll reaches the next tier', () => {
    // A Fair diced onion contributes 60–100% of its worth, so the score is a range.
    const l = ledgerFor(1, { main: at('wild_onion_diced'), second: at('raw_meat') });
    expect(l.score[0]).toBeLessThan(l.score[1]);
    expect(scoreText(l)).toMatch(/^\d\.\d\d–\d\.\d\d$/);
    expect(gapText(l)).toMatch(/^Fine \d\.\d\d(–\d\.\d\d)? short$/);
  });

  it('a best roll that reaches the next tier is reachable, not short', () => {
    // Superb diced onion and meat at Cooking 20: the floor is 3.92, the ceiling 4.06, and Divine starts at 4.
    const l = ledgerFor(20, { main: at('wild_onion_diced', 'a'), second: at('raw_meat', 'a') });
    expect(l.next).toMatchObject({ tier: 's', shortBest: 0 });
    expect(l.next!.shortWorst).toBeGreaterThan(0);
    expect(gradeText(l)).toBe('Superb–Divine');
    expect(gapText(l)).toBe('Divine reachable');
    expect(gapSentence(l, 20, 'Cooking', true)).toMatch(/^Divine needs 4\.00\. The best roll reaches it; the worst is 0\.\d\d short\./);
  });
});

describe('the tier ruler', () => {
  it('runs from Refuse to past Divine and clamps what falls off the ends', () => {
    expect(RULER_FROM).toBe(-0.5);
    expect(rulerPct(RULER_FROM)).toBe(0);
    expect(rulerPct(RULER_TO)).toBe(100);
    expect(rulerPct(-3)).toBe(0);
    expect(rulerPct(9)).toBe(100);
  });

  it('lays the tiers end to end at true scale', () => {
    const blocks = rulerBlocks();
    expect(blocks.map((b) => b.tier)).toEqual(QUALITY_ORDER);
    expect(blocks[0].left).toBe(0);
    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i].left).toBeCloseTo(blocks[i - 1].left + blocks[i - 1].width, 6);
    }
    const last = blocks[blocks.length - 1];
    expect(last.left + last.width).toBeCloseTo(100, 6);
    // Superb to Divine is a longer step than Fair to Fine.
    const width = (t: QualityTier) => blocks.find((b) => b.tier === t)!.width;
    expect(width('a')).toBeGreaterThan(width('c'));
  });
});

describe('the sentence under the ruler', () => {
  it('says what the next tier needs and what a Cooking level adds', () => {
    const l = ledgerFor(1, { main: at('wild_onion'), second: at('raw_meat') });
    expect(gapSentence(l, 1, 'Cooking', true)).toBe('Fine needs 1.60: 0.53 short. Each Cooking level adds 0.07.');
  });

  it('says the skill bonus is capped once it is, and that only the basket is left', () => {
    const l = ledgerFor(60, { main: at('wild_onion'), second: at('raw_meat') });
    expect(gapSentence(l, 60, 'Cooking', true)).toMatch(/The skill bonus is at its cap\. Better ingredients or cook times raise the grade\.$/);
    expect(gapSentence(l, 60, 'Baking', false)).toMatch(/Better ingredients raise the grade\.$/);
  });

  it('has none at the top grade', () => {
    const l = ledgerFor(60, { main: at('wild_onion', 's'), second: at('raw_meat', 's') });
    expect(gapSentence(l, 60, 'Cooking', true)).toBeNull();
  });
});

describe('the skill bonus as the ledger words it', () => {
  it('matches cookJudgement: ÷ 15 up to 15, ÷ 45 after, capped', () => {
    expect(JUDGEMENT_WORDS).toBe('÷ 15 up to level 15, ÷ 45 after');
    expect(cookJudgement(15)).toBe(1);
    expect(judgementStep(0)).toBeCloseTo(1 / 15, 9);
    expect(judgementStep(14)).toBeCloseTo(1 / 15, 9);
    expect(judgementStep(15)).toBeCloseTo(1 / 45, 9);
    expect(judgementStep(59)).toBeCloseTo(1 / 45, 9);
    expect(cookJudgement(60)).toBe(JUDGEMENT_CAP);
    expect(judgementStep(60)).toBe(0);
  });
});
