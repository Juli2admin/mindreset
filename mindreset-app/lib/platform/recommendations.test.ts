// Tests for the platform recommendation rules (2026-07-20).
//
// TWO families, tested apart:
//   - ORIENTATION (stateless onboarding scoring) — the owner's exact
//     stated-request logic. Pins every safeguard as an executable check:
//     MiniMind always present, no relationships→Family, no confidence→Shame
//     or career→Self-Realisation without a qualifying second answer, the
//     Journey only from >=2 DISTINCT categories, Body/Inner-emptiness never
//     produced, no arbitrary fallback, Step 3 style-invariant, owned shown
//     not suppressed.
//   - RECOGNITION (3-in-7 state threshold) — persisted; guards unchanged.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

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
  scoreOnboarding,
  journeyScore,
  rankOnboardingRecommendations,
  recommendationOwned,
  stateThresholdRecommendation,
  canRecommend,
  evaluateStateThresholdRecommendation,
  STATE_THRESHOLD_PRODUCT,
  ONBOARDING_REASON_KEYS,
  type JourneySignal,
  type OnboardingAnswerInput,
} from './recommendations';
import {
  ONBOARDING_WHY,
  ONBOARDING_AREA,
  ONBOARDING_STYLE,
  ONBOARDING_GOAL,
  type ActiveProducts,
} from './types';

const USER_ID = 'user_rec_test';
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

// Product ids of the ranked set, in ranked order.
function products(a: OnboardingAnswerInput): string[] {
  return rankOnboardingRecommendations(a).map((r) => r.product);
}

// Exhaustive answer space (including "unanswered" for each step). Style is
// omitted from these sweeps on purpose — it has no scoring role.
const WHYS = [...ONBOARDING_WHY, undefined] as const;
const AREAS = [...ONBOARDING_AREA, undefined] as const;
const GOALS = [...ONBOARDING_GOAL, undefined] as const;

// ---------------------------------------------------------------------------
// ORIENTATION — MiniMind, shape, fallback
// ---------------------------------------------------------------------------

describe('orientation — MiniMind & result shape', () => {
  it('MiniMind is in every result set, 1–3 cards (exhaustive)', () => {
    for (const why of WHYS)
      for (const area of AREAS)
        for (const goal of GOALS) {
          const set = rankOnboardingRecommendations({ why, area, goal });
          const label = `${why}/${area}/${goal}`;
          expect(set.some((r) => r.product === 'minimind'), label).toBe(true);
          expect(set.length, label).toBeGreaterThanOrEqual(1);
          expect(set.length, label).toBeLessThanOrEqual(3);
        }
  });

  it('returns MiniMind alone when nothing else qualifies — no arbitrary fallback', () => {
    const set = rankOnboardingRecommendations({
      why: 'curious',
      area: 'several_areas',
      goal: 'not_sure',
    });
    expect(set).toHaveLength(1);
    expect(set[0].product).toBe('minimind');
  });

  it('MiniMind reason variant reflects the request (decision / unsure / explore)', () => {
    const mm = (a: OnboardingAnswerInput) =>
      rankOnboardingRecommendations(a).find((r) => r.product === 'minimind')!;
    expect(mm({ why: 'difficult_decision' }).reasonKey).toBe('minimind_decision');
    expect(mm({ goal: 'decision_clarity' }).reasonKey).toBe('minimind_decision');
    expect(mm({ why: 'dont_know_what_i_want' }).reasonKey).toBe('minimind_unsure');
    expect(mm({ goal: 'not_sure' }).reasonKey).toBe('minimind_unsure');
    expect(mm({ why: 'curious' }).reasonKey).toBe('minimind_explore');
    expect(mm({}).reasonKey).toBe('minimind_explore');
  });

  it('MiniMind is a LEVEL, not an accumulation (max, base 1)', () => {
    // curious(3) + money(area, MiniMind 1) -> MiniMind stays 3, not 4.
    const { minimind } = scoreOnboarding({ why: 'curious', area: 'money' });
    expect(minimind).toBe(3);
    expect(scoreOnboarding({}).minimind).toBe(1);
  });

  it('every reasonKey produced is registered in ONBOARDING_REASON_KEYS', () => {
    const known = new Set<string>(ONBOARDING_REASON_KEYS);
    for (const why of WHYS)
      for (const area of AREAS)
        for (const goal of GOALS)
          for (const r of rankOnboardingRecommendations({ why, area, goal }))
            expect(known.has(r.reasonKey), r.reasonKey).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ORIENTATION — stated-request safeguards (no inferred diagnosis)
// ---------------------------------------------------------------------------

describe('orientation — no inferred mappings', () => {
  it('relationships NEVER maps to Family', () => {
    for (const goal of GOALS) {
      expect(products({ why: 'relationships_not_working', goal })).not.toContain('theme:family');
      expect(products({ area: 'relationships', goal })).not.toContain('theme:family');
      expect(
        products({ why: 'relationships_not_working', area: 'relationships', goal }),
      ).not.toContain('theme:family');
    }
  });

  it('confidence maps to Shame ONLY with a qualifying goal', () => {
    expect(products({ area: 'confidence_worth' })).not.toContain('theme:shame');
    expect(products({ area: 'confidence_worth', goal: 'decision_clarity' })).not.toContain(
      'theme:shame',
    );
    for (const goal of ['whats_holding_me_back', 'understand_reactions', 'mine_vs_expected'] as const) {
      expect(products({ area: 'confidence_worth', goal })).toContain('theme:shame');
    }
  });

  it('career maps to Self-Realisation ONLY with a qualifying goal', () => {
    expect(products({ area: 'career_purpose' })).not.toContain('theme:self_realisation');
    expect(products({ area: 'career_purpose', goal: 'decision_clarity' })).not.toContain(
      'theme:self_realisation',
    );
    for (const goal of [
      'whats_holding_me_back',
      'mine_vs_expected',
      'feel_like_myself',
      'what_no_longer_fits',
    ] as const) {
      expect(products({ area: 'career_purpose', goal })).toContain('theme:self_realisation');
    }
  });

  it('Body and Inner-emptiness are NEVER produced by onboarding (exhaustive)', () => {
    for (const why of WHYS)
      for (const area of AREAS)
        for (const goal of GOALS) {
          const ps = products({ why, area, goal });
          expect(ps, `${why}/${area}/${goal}`).not.toContain('theme:body');
          expect(ps, `${why}/${area}/${goal}`).not.toContain('state:inner_emptiness');
        }
  });

  it('Step 3 (style) never changes the ranked products', () => {
    const base = { why: 'stuck', area: 'confidence_worth', goal: 'whats_holding_me_back' } as const;
    const none = products(base);
    for (const style of ONBOARDING_STYLE) {
      expect(products({ ...base, style })).toEqual(none);
    }
  });
});

// ---------------------------------------------------------------------------
// ORIENTATION — the Journey gate (>=2 distinct categories)
// ---------------------------------------------------------------------------

describe('orientation — the Journey requires two distinct categories', () => {
  it('journeyScore: <2 categories → null; N categories → N×2', () => {
    expect(journeyScore(new Set<JourneySignal>())).toBeNull();
    expect(journeyScore(new Set<JourneySignal>(['loss_of_self']))).toBeNull();
    expect(journeyScore(new Set<JourneySignal>(['loss_of_self', 'multi_domain']))).toBe(4);
    expect(
      journeyScore(new Set<JourneySignal>(['loss_of_self', 'multi_domain', 'authenticity'])),
    ).toBe(6);
  });

  it('never from a single category', () => {
    expect(products({ why: 'lost_myself' })).not.toContain('journey');
    expect(products({ area: 'several_areas' })).not.toContain('journey');
    expect(products({ why: 'repeating_patterns' })).not.toContain('journey');
  });

  it('never from duplicate answers in ONE category', () => {
    // lost_myself + feel_like_myself → both loss_of_self
    expect(products({ why: 'lost_myself', goal: 'feel_like_myself' })).not.toContain('journey');
    // repeating_patterns + why_repeating_patterns → both repeating_patterns
    expect(products({ why: 'repeating_patterns', goal: 'why_repeating_patterns' })).not.toContain(
      'journey',
    );
  });

  it('qualifies from two DISTINCT categories and routes to informed-choice', () => {
    for (const a of [
      { why: 'lost_myself', area: 'several_areas' },
      { why: 'repeating_patterns', goal: 'mine_vs_expected' },
      { why: 'dont_know_what_i_want', goal: 'what_no_longer_fits' },
      { goal: 'feel_like_myself', area: 'several_areas' },
    ] as const) {
      const j = rankOnboardingRecommendations(a).find((r) => r.product === 'journey');
      expect(j, JSON.stringify(a)).toBeTruthy();
      expect(j!.route).toBe('informed_choice');
    }
  });

  it('MiniMind-only answers never trigger the Journey', () => {
    expect(products({ why: 'difficult_decision', goal: 'decision_clarity' })).not.toContain(
      'journey',
    );
    expect(products({ why: 'relationships_not_working', area: 'relationships' })).not.toContain(
      'journey',
    );
  });
});

// ---------------------------------------------------------------------------
// ORIENTATION — ownership is shown, not suppressed
// ---------------------------------------------------------------------------

describe('orientation — owned products shown, not suppressed', () => {
  const owned: ActiveProducts = {
    minimindTier: 'extended',
    journey: { purchased: true, started: false, discharged: false },
    states: [{ moduleId: 'loss_of_self', accessExpiresAt: null, active: true }],
    themes: [{ moduleId: 'money', accessExpiresAt: null, active: true }],
  };

  it('a matched product stays in the ranked set regardless of ownership', () => {
    expect(products({ area: 'money' })).toContain('theme:money');
  });

  it('recommendationOwned reflects active access', () => {
    expect(recommendationOwned('theme:money', owned)).toBe(true);
    expect(recommendationOwned('journey', owned)).toBe(true);
    expect(recommendationOwned('state:loss_of_self', owned)).toBe(true);
    expect(recommendationOwned('minimind', owned)).toBe(true); // paid tier
    expect(recommendationOwned('theme:family', owned)).toBe(false);
  });

  it('MiniMind free tier and expired modules are NOT "owned"', () => {
    expect(recommendationOwned('minimind', { ...owned, minimindTier: 'free' })).toBe(false);
    expect(recommendationOwned('minimind', { ...owned, minimindTier: null })).toBe(false);
    const expired: ActiveProducts = {
      ...owned,
      states: [{ moduleId: 'loss_of_self', accessExpiresAt: new Date(NOW.getTime() - 1000), active: false }],
    };
    expect(recommendationOwned('state:loss_of_self', expired)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RECOGNITION — 3-in-7 state threshold (pure)
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
      stateThresholdRecommendation([occ('anxiety_overwhelm', 1), occ('anxiety_overwhelm', 3)], NOW),
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

  it('maps shame to the theme, the module states to their states', () => {
    expect(STATE_THRESHOLD_PRODUCT.shame).toBe('theme:shame');
    expect(STATE_THRESHOLD_PRODUCT.identity_confusion).toBe('state:loss_of_self');
    expect(STATE_THRESHOLD_PRODUCT.stuckness_inertia).toBe('state:apathy');
    expect(STATE_THRESHOLD_PRODUCT.disconnection_numbness).toBe('state:inner_emptiness');
  });
});

// ---------------------------------------------------------------------------
// RECOGNITION — guards + effectful evaluation
// ---------------------------------------------------------------------------

describe('canRecommend — the never-pushed guards', () => {
  it('false while any recognition recommendation is still open', async () => {
    recFindFirstImpl.mockResolvedValueOnce({ id: 'rec_open' });
    expect(await canRecommend(USER_ID, 'theme:money', NOW)).toBe(false);
  });

  it('false while the same product is inside a decline cool-off', async () => {
    recFindFirstImpl.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'rec_cooling' });
    expect(await canRecommend(USER_ID, 'theme:money', NOW)).toBe(false);
  });

  it('false when the product is already owned and active', async () => {
    purchaseFindManyImpl.mockResolvedValue([
      { productType: 'theme_module', productId: 'money', accessExpiresAt: new Date(NOW.getTime() + 1000) },
    ]);
    expect(await canRecommend(USER_ID, 'theme:money', NOW)).toBe(false);
  });

  it('false for minimind when the user already has a tier', async () => {
    userFindUniqueImpl.mockResolvedValue({ currentTier: 'free' });
    expect(await canRecommend(USER_ID, 'minimind', NOW)).toBe(false);
  });

  it('ALWAYS false for the journey — recognition never recommends it', async () => {
    expect(await canRecommend(USER_ID, 'journey', NOW)).toBe(false);
  });

  it('true on the clean path', async () => {
    expect(await canRecommend(USER_ID, 'theme:money', NOW)).toBe(true);
  });
});

describe('evaluateStateThresholdRecommendation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('records a ruleKey-only recommendation when 3-in-7 fires', async () => {
    snapshotFindUniqueImpl.mockResolvedValue({
      recentStateOccurrences: [
        occ('anxiety_overwhelm', 1),
        occ('anxiety_overwhelm', 3),
        occ('anxiety_overwhelm', 6),
      ],
    });
    await evaluateStateThresholdRecommendation(USER_ID);
    expect(recCreates).toHaveLength(1);
    expect(recCreates[0].data).toMatchObject({
      userId: USER_ID,
      product: 'state:anxiety',
      source: 'platform_rule',
      ruleKey: 'state_repeat_3in7',
      reasonEncrypted: null,
    });
  });

  it('records nothing when the guard blocks (already owned)', async () => {
    snapshotFindUniqueImpl.mockResolvedValue({
      recentStateOccurrences: [
        occ('anxiety_overwhelm', 1),
        occ('anxiety_overwhelm', 2),
        occ('anxiety_overwhelm', 3),
      ],
    });
    purchaseFindManyImpl.mockResolvedValue([
      { productType: 'state_module', productId: 'anxiety', accessExpiresAt: null },
    ]);
    await evaluateStateThresholdRecommendation(USER_ID);
    expect(recCreates).toHaveLength(0);
  });

  it('records nothing when the threshold is not met', async () => {
    snapshotFindUniqueImpl.mockResolvedValue({
      recentStateOccurrences: [occ('anxiety_overwhelm', 1)],
    });
    await evaluateStateThresholdRecommendation(USER_ID);
    expect(recCreates).toHaveLength(0);
  });
});
