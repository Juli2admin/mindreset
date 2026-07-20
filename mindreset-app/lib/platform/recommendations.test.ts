// Tests for the platform recommendation rules — Step 4 (2026-07-20).
//
// Pins the owner-locked routing principles as executable checks:
//   - onboarding rules NEVER recommend the Journey (exhaustive sweep);
//   - conservative mappings only — unmapped signals recommend nothing;
//   - the 3-in-7 recognition rule fires only on 3+ occurrences of the
//     same state inside a rolling 7-day window, and only for states with
//     a real module behind them;
//   - guards: one open platform recommendation at a time, decline
//     cool-off honoured, owned products never recommended;
//   - rule recommendations store a ruleKey and NO display text (the
//     dashboard localises from the key).

import { describe, expect, it, vi, beforeEach } from 'vitest';

const recFindFirstImpl = vi.fn();
const recCreates: Array<{ data: Record<string, unknown> }> = [];
const snapshotFindUniqueImpl = vi.fn();
const userFindUniqueImpl = vi.fn();
const purchaseFindManyImpl = vi.fn();
const recodeFindUniqueImpl = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    platformRecommendation: {
      findFirst: (...args: unknown[]) => recFindFirstImpl(...args),
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        recCreates.push(args);
        return Promise.resolve({ id: 'rec_new' });
      }),
    },
    wellbeingSnapshot: {
      findUnique: (...args: unknown[]) => snapshotFindUniqueImpl(...args),
    },
    user: { findUnique: (...args: unknown[]) => userFindUniqueImpl(...args) },
    purchase: { findMany: (...args: unknown[]) => purchaseFindManyImpl(...args) },
    recodeProgress: { findUnique: (...args: unknown[]) => recodeFindUniqueImpl(...args) },
  },
}));

vi.mock('@/lib/encrypt', () => ({
  encrypt: (s: string) => `enc(${s})`,
  decrypt: (s: string) => s.replace(/^enc\((.*)\)$/, '$1'),
}));

import {
  onboardingRecommendation,
  stateThresholdRecommendation,
  canRecommend,
  evaluateOnboardingRecommendation,
  STATE_THRESHOLD_PRODUCT,
} from './recommendations';
import { ONBOARDING_WHY, ONBOARDING_AREA } from './types';

const USER_ID = 'user_step4_test';
const NOW = new Date('2026-07-20T12:00:00Z');

beforeEach(() => {
  recCreates.length = 0;
  recFindFirstImpl.mockReset();
  recFindFirstImpl.mockResolvedValue(null);
  snapshotFindUniqueImpl.mockReset();
  snapshotFindUniqueImpl.mockResolvedValue(null);
  userFindUniqueImpl.mockReset();
  userFindUniqueImpl.mockResolvedValue({ currentTier: null });
  purchaseFindManyImpl.mockReset();
  purchaseFindManyImpl.mockResolvedValue([]);
  recodeFindUniqueImpl.mockReset();
  recodeFindUniqueImpl.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// 1. Onboarding rule (pure)
// ---------------------------------------------------------------------------

describe('onboardingRecommendation — conservative mappings', () => {
  it('maps the high-confidence signals', () => {
    expect(onboardingRecommendation({ why: 'lost_myself' })).toEqual({
      product: 'state:loss_of_self',
      ruleKey: 'onboarding_why_lost_myself',
    });
    expect(onboardingRecommendation({ area: 'money' })?.product).toBe('theme:money');
    expect(onboardingRecommendation({ area: 'family' })?.product).toBe('theme:family');
    expect(onboardingRecommendation({ area: 'career_purpose' })?.product).toBe(
      'theme:self_realisation',
    );
    expect(onboardingRecommendation({ why: 'stuck' })?.product).toBe('state:apathy');
    expect(onboardingRecommendation({ why: 'curious' })?.product).toBe('minimind');
  });

  it('the most specific signal wins (why lost_myself over area money)', () => {
    expect(
      onboardingRecommendation({ why: 'lost_myself', area: 'money' })?.product,
    ).toBe('state:loss_of_self');
  });

  it('recommends nothing when no mapping is confident', () => {
    expect(onboardingRecommendation(null)).toBeNull();
    expect(
      onboardingRecommendation({ why: 'difficult_decision', area: 'emotional_reactions' }),
    ).toBeNull();
  });

  it('NEVER recommends the Journey — exhaustive sweep of all combinations', () => {
    for (const why of ONBOARDING_WHY) {
      for (const area of ONBOARDING_AREA) {
        const rec = onboardingRecommendation({ why, area });
        expect(rec?.product, `${why} + ${area}`).not.toBe('journey');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. State-threshold rule (pure)
// ---------------------------------------------------------------------------

function occ(state: string, daysAgo: number): { state: string; detectedAt: string } {
  return {
    state,
    detectedAt: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  };
}

describe('stateThresholdRecommendation — 3-in-7 recognition', () => {
  it('fires on 3 occurrences of the same mapped state within 7 days', () => {
    const rec = stateThresholdRecommendation(
      [occ('anxiety_overwhelm', 1), occ('anxiety_overwhelm', 3), occ('anxiety_overwhelm', 6)],
      NOW,
    );
    expect(rec).toEqual({ product: 'state:anxiety', ruleKey: 'state_repeat_3in7' });
  });

  it('does not fire on 2 occurrences', () => {
    expect(
      stateThresholdRecommendation(
        [occ('anxiety_overwhelm', 1), occ('anxiety_overwhelm', 3)],
        NOW,
      ),
    ).toBeNull();
  });

  it('does not fire when the third occurrence is outside the 7-day window', () => {
    expect(
      stateThresholdRecommendation(
        [occ('anxiety_overwhelm', 1), occ('anxiety_overwhelm', 3), occ('anxiety_overwhelm', 9)],
        NOW,
      ),
    ).toBeNull();
  });

  it('does not fire for states without a module behind them', () => {
    expect(
      stateThresholdRecommendation(
        [occ('grief_loss', 1), occ('grief_loss', 2), occ('grief_loss', 3)],
        NOW,
      ),
    ).toBeNull();
    expect(STATE_THRESHOLD_PRODUCT.grief_loss).toBeUndefined();
  });

  it('skips malformed and future timestamps instead of counting them', () => {
    expect(
      stateThresholdRecommendation(
        [
          { state: 'shame', detectedAt: 'not-a-date' },
          occ('shame', -1), // "future"
          occ('shame', 2),
          occ('shame', 3),
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it('maps shame to the theme, the four module states to their states', () => {
    expect(STATE_THRESHOLD_PRODUCT.shame).toBe('theme:shame');
    expect(STATE_THRESHOLD_PRODUCT.identity_confusion).toBe('state:loss_of_self');
    expect(STATE_THRESHOLD_PRODUCT.stuckness_inertia).toBe('state:apathy');
    expect(STATE_THRESHOLD_PRODUCT.disconnection_numbness).toBe('state:inner_emptiness');
  });
});

// ---------------------------------------------------------------------------
// 3. Guards + evaluation (effectful)
// ---------------------------------------------------------------------------

describe('canRecommend — the never-pushed guards', () => {
  it('false while any platform-rule recommendation is still open', async () => {
    recFindFirstImpl.mockResolvedValueOnce({ id: 'rec_open' }); // open-rec query
    expect(await canRecommend(USER_ID, 'theme:money', NOW)).toBe(false);
  });

  it('false while the same product is inside a decline cool-off', async () => {
    recFindFirstImpl
      .mockResolvedValueOnce(null) // open-rec query
      .mockResolvedValueOnce({ id: 'rec_cooling' }); // cool-off query
    expect(await canRecommend(USER_ID, 'theme:money', NOW)).toBe(false);
  });

  it('false when the product is already owned and active', async () => {
    purchaseFindManyImpl.mockResolvedValue([
      {
        productType: 'theme_module',
        productId: 'money',
        accessExpiresAt: new Date(NOW.getTime() + 1000),
      },
    ]);
    expect(await canRecommend(USER_ID, 'theme:money', NOW)).toBe(false);
  });

  it('false for minimind when the user already has a tier', async () => {
    userFindUniqueImpl.mockResolvedValue({ currentTier: 'free' });
    expect(await canRecommend(USER_ID, 'minimind', NOW)).toBe(false);
  });

  it('ALWAYS false for the journey — platform rules cannot recommend it', async () => {
    expect(await canRecommend(USER_ID, 'journey', NOW)).toBe(false);
  });

  it('true on the clean path', async () => {
    expect(await canRecommend(USER_ID, 'theme:money', NOW)).toBe(true);
  });
});

describe('evaluateOnboardingRecommendation', () => {
  it('records a ruleKey-only recommendation (no display text — dashboard localises)', async () => {
    snapshotFindUniqueImpl.mockResolvedValue({
      onboardingWhy: null,
      onboardingArea: 'money',
      onboardingStyle: 'guide_me',
      onboardingGoal: 'not_sure',
    });
    await evaluateOnboardingRecommendation(USER_ID);
    expect(recCreates).toHaveLength(1);
    expect(recCreates[0].data).toMatchObject({
      userId: USER_ID,
      product: 'theme:money',
      source: 'platform_rule',
      ruleKey: 'onboarding_area_money',
      reasonEncrypted: null,
    });
  });

  it('records nothing when the guards block', async () => {
    snapshotFindUniqueImpl.mockResolvedValue({ onboardingArea: 'money' });
    recFindFirstImpl.mockResolvedValue({ id: 'rec_open' });
    await evaluateOnboardingRecommendation(USER_ID);
    expect(recCreates).toHaveLength(0);
  });

  it('records nothing when no rule matches', async () => {
    snapshotFindUniqueImpl.mockResolvedValue({ onboardingWhy: 'difficult_decision' });
    await evaluateOnboardingRecommendation(USER_ID);
    expect(recCreates).toHaveLength(0);
  });
});
