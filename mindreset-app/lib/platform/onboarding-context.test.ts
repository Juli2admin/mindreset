// Tests for the onboarding context block — Step 3 (2026-07-20).
//
// The bridge that makes the 4-step answers WORK. Pins:
//   1. The owner's two worked-example combinations render blocks that
//      carry exactly what the user tapped (the step-3 fixtures).
//   2. The forbidden-opening rule is in the block verbatim — never
//      "How was your day?", never "How are you feeling today?".
//   3. Skipped/empty onboarding renders NOTHING (products see no block).
//   4. Partial answers render partial blocks.
//   5. The model-facing labels stay in lockstep with the user-facing
//      i18n copy in messages/en.json — the model must read exactly what
//      the user tapped.

import { describe, expect, it } from 'vitest';
import {
  buildOnboardingContextBlock,
  WHY_LABELS,
  AREA_LABELS,
  GOAL_LABELS,
} from './onboarding-context';
import { ONBOARDING_WHY, ONBOARDING_AREA, ONBOARDING_GOAL } from './types';
import en from '../../messages/en.json';

const enO = (en as { Onboarding: Record<string, string> }).Onboarding;

describe('buildOnboardingContextBlock — owner fixtures', () => {
  it('fixture 1: lost_myself + career_purpose + direct_practical + decision_clarity', () => {
    const block = buildOnboardingContextBlock({
      why: 'lost_myself',
      area: 'career_purpose',
      style: 'direct_practical',
      goal: 'decision_clarity',
    });
    expect(block).toContain(`"I feel like I've lost myself."`);
    expect(block).toContain('Career and purpose');
    expect(block).toContain('direct & practical');
    expect(block).toContain('"I want clarity about an important decision."');
  });

  it('fixture 2: repeating_patterns + relationships + reflective_exploratory + why_repeating_patterns', () => {
    const block = buildOnboardingContextBlock({
      why: 'repeating_patterns',
      area: 'relationships',
      style: 'reflective_exploratory',
      goal: 'why_repeating_patterns',
    });
    expect(block).toContain('"I keep repeating the same patterns in my life."');
    expect(block).toContain('Where it shows up most: Relationships');
    expect(block).toContain('reflective & exploratory');
    expect(block).toContain(
      '"I want to understand why I keep repeating the same patterns."',
    );
  });
});

describe('buildOnboardingContextBlock — the forbidden-opening rule', () => {
  it('names both forbidden openings and demands a specific personalised one', () => {
    const block = buildOnboardingContextBlock({ why: 'stuck' });
    expect(block).toContain('never "How was your day?"');
    expect(block).toContain('never "How are you feeling today?"');
    expect(block).toContain('one specific, inviting question');
  });

  it('goal is the INITIAL focus, refreshed conversationally — never a questionnaire', () => {
    const block = buildOnboardingContextBlock({ goal: 'not_sure' });
    expect(block).toContain('INITIAL focus');
    expect(block).toContain('never re-ask these questions as a questionnaire');
    expect(block).toContain('today wins');
  });
});

describe('buildOnboardingContextBlock — empty and partial', () => {
  it('renders nothing when onboarding was skipped', () => {
    expect(buildOnboardingContextBlock(null)).toBe('');
    expect(buildOnboardingContextBlock({})).toBe('');
  });

  it('renders only the provided answers', () => {
    const block = buildOnboardingContextBlock({ area: 'money' });
    expect(block).toContain('Money');
    expect(block).not.toContain('What brought them here');
    expect(block).not.toContain('worthwhile');
  });

  it('ignores unknown codes defensively instead of rendering them', () => {
    const block = buildOnboardingContextBlock({ why: 'hacked_code' as never });
    expect(block).toBe('');
  });
});

describe('model-facing labels stay in lockstep with user-facing i18n (en)', () => {
  it('why labels match Onboarding.why_* exactly', () => {
    for (const code of ONBOARDING_WHY) {
      expect(WHY_LABELS[code], `why_${code}`).toBe(enO[`why_${code}`]);
    }
  });

  it('area labels match Onboarding.area_* exactly', () => {
    for (const code of ONBOARDING_AREA) {
      expect(AREA_LABELS[code], `area_${code}`).toBe(enO[`area_${code}`]);
    }
  });

  it('goal labels match Onboarding.goal_* exactly', () => {
    for (const code of ONBOARDING_GOAL) {
      expect(GOAL_LABELS[code], `goal_${code}`).toBe(enO[`goal_${code}`]);
    }
  });
});
