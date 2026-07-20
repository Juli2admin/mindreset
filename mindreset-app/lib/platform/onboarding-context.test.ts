// Tests for the onboarding context block — v2 vocabulary (2026-07-20).
//
// The bridge that makes the 4-step answers WORK. Pins:
//   1. Worked-example combinations render blocks that carry exactly what
//      the user tapped.
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

describe('buildOnboardingContextBlock — worked examples', () => {
  it('transformation user: far_from_myself + work_purpose + direct_practical + transformation', () => {
    const block = buildOnboardingContextBlock({
      why: 'far_from_myself',
      area: 'work_purpose',
      style: 'direct_practical',
      goal: 'transformation',
    });
    expect(block).toContain(`"I feel far away from myself — like I'm losing who I am."`);
    expect(block).toContain('Work, purpose, direction');
    expect(block).toContain('direct & practical');
    expect(block).toContain('reach the roots and change the pattern of my life');
  });

  it('state user: anxiety_overwhelm + several_areas + reflective_exploratory + relief_now', () => {
    const block = buildOnboardingContextBlock({
      why: 'anxiety_overwhelm',
      area: 'several_areas',
      style: 'reflective_exploratory',
      goal: 'relief_now',
    });
    expect(block).toContain(`"Anxiety or overwhelm — my mind won't settle."`);
    expect(block).toContain('Where it shows up most: Several areas at once');
    expect(block).toContain('reflective & exploratory');
    expect(block).toContain(`"Support and relief right now — help me steady what I'm feeling."`);
  });
});

describe('buildOnboardingContextBlock — the forbidden-opening rule', () => {
  it('names both forbidden openings and demands a specific personalised one', () => {
    const block = buildOnboardingContextBlock({ why: 'no_energy_drive' });
    expect(block).toContain('never "How was your day?"');
    expect(block).toContain('never "How are you feeling today?"');
    expect(block).toContain('one specific, inviting question');
  });

  it('answers are the INITIAL focus, refreshed conversationally — never a questionnaire', () => {
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
    expect(block).not.toContain("What's most present for them");
    expect(block).not.toContain('kind of work');
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
