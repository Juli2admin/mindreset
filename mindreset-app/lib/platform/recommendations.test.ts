// Tests for the platform recommendation rules — onboarding v2 typed
// routing (2026-07-20, owner-approved with two routing corrections).
//
// TWO families, tested apart:
//   - ORIENTATION — the typing model. Step 3 decides the user's TYPE;
//     Steps 1–2 decide which product of that type. Pins every owner rule:
//     Journey primary ONLY from the explicit transformation answer (any
//     topic, informed-choice route); State/Theme users; Companion shape
//     with the soft-Journey never displacing a directly matching module;
//     love/relationships never → Family; strong reactions never → Anxiety;
//     Shame only via the explicit self-worth area; max 3 cards; primary
//     first; style-invariant; legacy v1 codes normalise honestly.
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
  rankOnboardingRecommendations,
  hasSoftJourneySignal,
  recommendationOwned,
  stateThresholdRecommendation,
  canRecommend,
  evaluateStateThresholdRecommendation,
  STATE_THRESHOLD_PRODUCT,
  ONBOARDING_REASON_KEYS,
  type OnboardingAnswerInput,
} from './recommendations';
import {
  ONBOARDING_WHY,
  ONBOARDING_AREA,
  ONBOARDING_STYLE,
  ONBOARDING_GOAL,
  normalizeOnboardingAnswers,
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

function products(a: OnboardingAnswerInput): string[] {
  return rankOnboardingRecommendations(a).map((r) => r.product);
}
function primary(a: OnboardingAnswerInput): string {
  return rankOnboardingRecommendations(a)[0].product;
}

const STATES_BY_WHY = {
  anxiety_overwhelm: 'state:anxiety',
  no_energy_drive: 'state:apathy',
  far_from_myself: 'state:loss_of_self',
  emptiness_numbness: 'state:inner_emptiness',
} as const;
const THEMES_BY_AREA = {
  money: 'theme:money',
  family_parents: 'theme:family',
  body_intimacy: 'theme:body',
  self_worth_shame: 'theme:shame',
  work_purpose: 'theme:self_realisation',
} as const;

// Exhaustive answer space (including "unanswered" per step).
const WHYS = [...ONBOARDING_WHY, undefined] as const;
const AREAS = [...ONBOARDING_AREA, undefined] as const;
const GOALS = [...ONBOARDING_GOAL, undefined] as const;

// ---------------------------------------------------------------------------
// ORIENTATION — result shape
// ---------------------------------------------------------------------------

describe('orientation — result shape (exhaustive)', () => {
  it('1–3 cards, MiniMind always present, every reasonKey registered', () => {
    const known = new Set<string>(ONBOARDING_REASON_KEYS);
    for (const why of WHYS)
      for (const area of AREAS)
        for (const goal of GOALS) {
          const set = rankOnboardingRecommendations({ why, area, goal });
          const label = `${why}/${area}/${goal}`;
          expect(set.length, label).toBeGreaterThanOrEqual(1);
          expect(set.length, label).toBeLessThanOrEqual(3);
          expect(set.some((r) => r.product === 'minimind'), label).toBe(true);
          for (const r of set) expect(known.has(r.reasonKey), r.reasonKey).toBe(true);
          // No duplicate products in one set.
          expect(new Set(set.map((r) => r.product)).size, label).toBe(set.length);
        }
  });

  it('Step 4 (style) never changes the result', () => {
    for (const why of WHYS)
      for (const goal of GOALS) {
        const base = products({ why, area: 'self_worth_shame', goal });
        for (const style of ONBOARDING_STYLE) {
          expect(products({ why, area: 'self_worth_shame', goal, style })).toEqual(base);
        }
      }
  });
});

// ---------------------------------------------------------------------------
// ORIENTATION — Transformation user
// ---------------------------------------------------------------------------

describe('orientation — transformation user', () => {
  it('«Путь к себе» is primary from ANY topic, via the informed-choice route', () => {
    for (const why of WHYS)
      for (const area of AREAS) {
        const set = rankOnboardingRecommendations({ why, area, goal: 'transformation' });
        expect(set[0].product, `${why}/${area}`).toBe('journey');
        expect(set[0].reasonKey).toBe('journey_primary');
        expect(set[0].route).toBe('informed_choice');
      }
  });

  it('module slot: State when Step 1 names one; else Theme; never both', () => {
    // State named → State fills the slot even when a Theme also matches.
    const both = products({ why: 'anxiety_overwhelm', area: 'money', goal: 'transformation' });
    expect(both).toEqual(['journey', 'state:anxiety', 'minimind']);
    // No state → the Theme fills the slot.
    const themeOnly = products({ why: 'repeating_story', area: 'money', goal: 'transformation' });
    expect(themeOnly).toEqual(['journey', 'theme:money', 'minimind']);
    // Neither → Journey + MiniMind only.
    const neither = products({ why: 'understand_myself', area: 'several_areas', goal: 'transformation' });
    expect(neither).toEqual(['journey', 'minimind']);
  });

  it('MiniMind rides along as the lighter companion', () => {
    const set = rankOnboardingRecommendations({ why: 'far_from_myself', goal: 'transformation' });
    const mm = set.find((r) => r.product === 'minimind');
    expect(mm?.reasonKey).toBe('minimind_companion');
  });
});

// ---------------------------------------------------------------------------
// ORIENTATION — State user
// ---------------------------------------------------------------------------

describe('orientation — state user (relief + named state)', () => {
  it('every one of the four states is reachable as primary — including Inner Emptiness', () => {
    for (const [why, product] of Object.entries(STATES_BY_WHY)) {
      const set = rankOnboardingRecommendations({ why, goal: 'relief_now' });
      expect(set[0].product, why).toBe(product);
      expect(set.map((r) => r.product)).toContain('minimind');
    }
  });

  it('soft «Путь к себе» appears only with a soft signal', () => {
    const noSignal = products({ why: 'anxiety_overwhelm', area: 'money', goal: 'relief_now' });
    expect(noSignal).not.toContain('journey');
    const withSignal = rankOnboardingRecommendations({
      why: 'anxiety_overwhelm',
      area: 'whole_life_identity',
      goal: 'relief_now',
    });
    const j = withSignal.find((r) => r.product === 'journey');
    expect(j?.reasonKey).toBe('journey_soft');
    expect(j?.route).toBe('informed_choice');
    expect(withSignal[0].product).toBe('state:anxiety'); // never displaces the primary
  });

  it('relief WITHOUT a named state falls back to the companion shape', () => {
    const set = rankOnboardingRecommendations({ why: 'strong_reactions', area: 'money', goal: 'relief_now' });
    expect(set[0].product).toBe('minimind');
    expect(set.map((r) => r.product)).toContain('theme:money');
  });
});

// ---------------------------------------------------------------------------
// ORIENTATION — Theme user
// ---------------------------------------------------------------------------

describe('orientation — theme user (focused + named theme)', () => {
  it('every one of the five themes is reachable as primary — including Body', () => {
    for (const [area, product] of Object.entries(THEMES_BY_AREA)) {
      const set = rankOnboardingRecommendations({ area, goal: 'focused_work' });
      expect(set[0].product, area).toBe(product);
      expect(set.map((r) => r.product)).toContain('minimind');
    }
  });

  it('soft «Путь к себе» appears only with a soft signal', () => {
    expect(products({ area: 'money', goal: 'focused_work' })).not.toContain('journey');
    const withSignal = products({ why: 'repeating_story', area: 'money', goal: 'focused_work' });
    expect(withSignal).toContain('journey');
    expect(withSignal[0]).toBe('theme:money');
  });

  it('focused WITHOUT a matching theme falls back to the companion shape', () => {
    const set = rankOnboardingRecommendations({
      why: 'anxiety_overwhelm',
      area: 'love_relationships',
      goal: 'focused_work',
    });
    expect(set[0].product).toBe('minimind');
    expect(set.map((r) => r.product)).toContain('state:anxiety');
  });
});

// ---------------------------------------------------------------------------
// ORIENTATION — Companion user + the soft-Journey displacement rule
// ---------------------------------------------------------------------------

describe('orientation — companion user', () => {
  it('MiniMind primary; matching State AND Theme both shown', () => {
    const set = products({ why: 'no_energy_drive', area: 'work_purpose', goal: 'talk_through' });
    expect(set).toEqual(['minimind', 'state:apathy', 'theme:self_realisation']);
  });

  it('soft «Путь к себе» NEVER displaces two directly matching modules', () => {
    // Both slots taken → soft signal ignored even though present.
    const full = products({ why: 'anxiety_overwhelm', area: 'money', goal: 'talk_through' });
    expect(full).toEqual(['minimind', 'state:anxiety', 'theme:money']);
    // ...same answers plus a soft signal would need a 4th slot — verify via
    // a set where BOTH modules match and the signal comes from Step 1.
    const alsoFull = products({ why: 'repeating_story', area: 'money', goal: 'talk_through' });
    // repeating_story names no state, so only one module matched — soft fits.
    expect(alsoFull).toEqual(['minimind', 'theme:money', 'journey']);
  });

  it('soft «Путь к себе» shows when a signal exists and fewer than two modules matched', () => {
    const oneModule = products({ why: 'emptiness_numbness', area: 'several_areas', goal: 'not_sure' });
    expect(oneModule).toEqual(['minimind', 'state:inner_emptiness', 'journey']);
    const noModule = products({ why: 'understand_myself', area: 'whole_life_identity', goal: 'not_sure' });
    expect(noModule).toEqual(['minimind', 'journey']);
  });

  it('no signal, no modules → MiniMind alone (no invented cards)', () => {
    expect(products({ why: 'understand_myself', area: 'love_relationships', goal: 'talk_through' })).toEqual([
      'minimind',
    ]);
  });

  it('MiniMind primary reason follows the user’s own words', () => {
    expect(rankOnboardingRecommendations({ goal: 'not_sure' })[0].reasonKey).toBe('minimind_unsure');
    expect(
      rankOnboardingRecommendations({ why: 'weighing_decision', goal: 'talk_through' })[0].reasonKey,
    ).toBe('minimind_decision');
    expect(rankOnboardingRecommendations({ goal: 'talk_through' })[0].reasonKey).toBe('minimind_talk');
  });
});

// ---------------------------------------------------------------------------
// ORIENTATION — owner prohibitions (exhaustive)
// ---------------------------------------------------------------------------

describe('orientation — prohibitions', () => {
  it('«Путь к себе» is PRIMARY only for the explicit transformation answer', () => {
    for (const why of WHYS)
      for (const area of AREAS)
        for (const goal of GOALS) {
          if (goal === 'transformation') continue;
          expect(primary({ why, area, goal }), `${why}/${area}/${goal}`).not.toBe('journey');
        }
  });

  it('love/relationships never yields the Family theme', () => {
    for (const why of WHYS)
      for (const goal of GOALS) {
        expect(products({ why, area: 'love_relationships', goal })).not.toContain('theme:family');
      }
  });

  it('strong reactions never yields the Anxiety state', () => {
    for (const area of AREAS)
      for (const goal of GOALS) {
        expect(products({ why: 'strong_reactions', area, goal })).not.toContain('state:anxiety');
      }
  });

  it('Shame & Guilt only via the explicit self-worth/shame area', () => {
    for (const why of WHYS)
      for (const area of AREAS)
        for (const goal of GOALS) {
          const has = products({ why, area, goal }).includes('theme:shame');
          if (area !== 'self_worth_shame') expect(has, `${why}/${area}/${goal}`).toBe(false);
        }
  });

  it('hasSoftJourneySignal matches exactly the three signals', () => {
    expect(hasSoftJourneySignal({ why: 'repeating_story' })).toBe(true);
    expect(hasSoftJourneySignal({ area: 'several_areas' })).toBe(true);
    expect(hasSoftJourneySignal({ area: 'whole_life_identity' })).toBe(true);
    expect(hasSoftJourneySignal({ why: 'far_from_myself', area: 'money' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ORIENTATION — legacy v1 codes
// ---------------------------------------------------------------------------

describe('orientation — legacy v1 answers normalise honestly', () => {
  it('maps same-meaning codes and drops the unmappable', () => {
    const n = normalizeOnboardingAnswers({
      why: 'lost_myself',
      area: 'career_purpose',
      style: 'guide_me',
      goal: 'feel_like_myself',
    });
    expect(n).toEqual({
      why: 'far_from_myself',
      area: 'work_purpose',
      style: 'guide_me',
      goal: 'talk_through',
    });
    // No honest v2 equivalent → dropped, never guessed.
    expect(normalizeOnboardingAnswers({ why: 'relationships_not_working' }).why).toBeNull();
    expect(normalizeOnboardingAnswers({ area: 'emotional_reactions' }).area).toBeNull();
    expect(normalizeOnboardingAnswers({ area: 'boundaries_pleasing' }).area).toBeNull();
  });

  it('legacy users become Companion users — the Journey is never inferred for someone never asked', () => {
    for (const goal of [
      'whats_holding_me_back',
      'decision_clarity',
      'why_repeating_patterns',
      'mine_vs_expected',
      'feel_like_myself',
      'understand_reactions',
      'what_no_longer_fits',
    ]) {
      const n = normalizeOnboardingAnswers({ why: 'lost_myself', area: 'money', goal });
      const set = rankOnboardingRecommendations(n);
      expect(set[0].product, goal).toBe('minimind');
      expect(set[0].product).not.toBe('journey');
    }
  });

  it('the old emotional_reactions → Anxiety misfire is gone for legacy users', () => {
    const n = normalizeOnboardingAnswers({
      why: 'understand_reactions',
      area: 'emotional_reactions',
      goal: 'understand_reactions',
    });
    expect(products(n)).not.toContain('state:anxiety');
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

  it('a matched product stays in the set regardless of ownership', () => {
    expect(products({ area: 'money', goal: 'focused_work' })).toContain('theme:money');
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
