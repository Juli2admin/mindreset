// Tests for the platform profile module — Step 1 (2026-07-20).
//
// Pins the contracts from docs/platform/plan-2026-07-20-step1-platform-profile.md:
//   1. Onboarding writes validate codes, merge without clobbering, upsert
//      for users with no snapshot row, and never touch the MiniMind-owned
//      diagnostic columns.
//   2. Product access is DERIVED (tier / purchases / recode progress),
//      never stored.
//   3. Recommendations are append-only; declines set the cool-off.
//   4. The user-facing projection's field list is pinned — hidden
//      diagnostics can never leak into a dashboard without failing here.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const snapshotUpserts: Array<{ where: unknown; update: Record<string, unknown>; create: Record<string, unknown> }> = [];
const recCreates: Array<{ data: Record<string, unknown> }> = [];
const recUpdates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
const snapshotFindUniqueImpl = vi.fn();
const recFindManyImpl = vi.fn();
const recFindFirstStep5 = vi.fn();
const userFindUniqueImpl = vi.fn();
const purchaseFindManyImpl = vi.fn();
const recodeFindUniqueImpl = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    wellbeingSnapshot: {
      findUnique: (...args: unknown[]) => snapshotFindUniqueImpl(...args),
      upsert: vi.fn((args: { where: unknown; update: Record<string, unknown>; create: Record<string, unknown> }) => {
        snapshotUpserts.push(args);
        return Promise.resolve({});
      }),
    },
    platformRecommendation: {
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        recCreates.push(args);
        return Promise.resolve({ id: 'rec_test_1' });
      }),
      update: vi.fn((args: { where: unknown; data: Record<string, unknown> }) => {
        recUpdates.push(args);
        return Promise.resolve({});
      }),
      findMany: (...args: unknown[]) => recFindManyImpl(...args),
      findFirst: (...args: unknown[]) => recFindFirstStep5(...args),
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
  saveOnboarding,
  markOnboardingSkipped,
  getActiveProducts,
  recordRecommendation,
  respondToRecommendation,
  respondToRecommendationOwned,
  getUserFacingProfile,
  RECOMMENDATION_COOL_OFF_DAYS,
} from './profile';

const USER_ID = 'user_platform_step1';
const NOW = new Date('2026-07-20T12:00:00Z');

beforeEach(() => {
  snapshotUpserts.length = 0;
  recCreates.length = 0;
  recUpdates.length = 0;
  snapshotFindUniqueImpl.mockReset();
  snapshotFindUniqueImpl.mockResolvedValue(null);
  recFindManyImpl.mockReset();
  recFindManyImpl.mockResolvedValue([]);
  userFindUniqueImpl.mockReset();
  userFindUniqueImpl.mockResolvedValue({ currentTier: null });
  purchaseFindManyImpl.mockReset();
  purchaseFindManyImpl.mockResolvedValue([]);
  recodeFindUniqueImpl.mockReset();
  recodeFindUniqueImpl.mockResolvedValue(null);
  recFindFirstStep5.mockReset();
  recFindFirstStep5.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// 1. Onboarding writes
// ---------------------------------------------------------------------------

describe('saveOnboarding', () => {
  it('rejects unknown codes loudly', async () => {
    await expect(
      saveOnboarding(USER_ID, { why: 'feeling_fancy' as never }),
    ).rejects.toThrow('unknown why code');
    expect(snapshotUpserts).toHaveLength(0);
  });

  it('upserts a row for a user who never used MiniMind', async () => {
    await saveOnboarding(USER_ID, { why: 'lost_myself' }, NOW);
    expect(snapshotUpserts).toHaveLength(1);
    expect(snapshotUpserts[0].create).toMatchObject({
      userId: USER_ID,
      onboardingWhy: 'lost_myself',
    });
  });

  it('merges partial saves — a later step never erases an earlier answer', async () => {
    snapshotFindUniqueImpl.mockResolvedValue({
      onboardingWhy: 'repeating_patterns',
      onboardingArea: null,
      onboardingStyle: null,
      onboardingGoal: null,
      onboardingCompletedAt: null,
    });
    await saveOnboarding(USER_ID, { area: 'relationships' }, NOW);
    expect(snapshotUpserts[0].update).toMatchObject({
      onboardingWhy: 'repeating_patterns',
      onboardingArea: 'relationships',
    });
  });

  it('stamps onboardingCompletedAt only when all four answers are present', async () => {
    snapshotFindUniqueImpl.mockResolvedValue({
      onboardingWhy: 'repeating_patterns',
      onboardingArea: 'relationships',
      onboardingStyle: 'reflective_exploratory',
      onboardingGoal: null,
      onboardingCompletedAt: null,
    });
    await saveOnboarding(USER_ID, { goal: 'why_repeating_patterns' }, NOW);
    expect(snapshotUpserts[0].update.onboardingCompletedAt).toEqual(NOW);
  });

  it('does not stamp completion while answers are missing', async () => {
    await saveOnboarding(USER_ID, { why: 'stuck' }, NOW);
    expect(snapshotUpserts[0].update.onboardingCompletedAt).toBeNull();
  });

  it('preserves an existing completion stamp (set-once)', async () => {
    const earlier = new Date('2026-07-19T09:00:00Z');
    snapshotFindUniqueImpl.mockResolvedValue({
      onboardingWhy: 'stuck',
      onboardingArea: 'money',
      onboardingStyle: 'guide_me',
      onboardingGoal: 'not_sure',
      onboardingCompletedAt: earlier,
    });
    await saveOnboarding(USER_ID, { goal: 'decision_clarity' }, NOW);
    expect(snapshotUpserts[0].update.onboardingCompletedAt).toEqual(earlier);
  });

  it('NEVER touches MiniMind-owned diagnostic columns', async () => {
    await saveOnboarding(
      USER_ID,
      { why: 'curious', area: 'family', style: 'guide_me', goal: 'not_sure' },
      NOW,
    );
    const allowed = new Set([
      'onboardingWhy',
      'onboardingArea',
      'onboardingStyle',
      'onboardingGoal',
      'onboardingCompletedAt',
    ]);
    for (const key of Object.keys(snapshotUpserts[0].update)) {
      expect(allowed.has(key), `unexpected column in update: ${key}`).toBe(true);
    }
  });
});

describe('markOnboardingSkipped', () => {
  it('sets the skip stamp via upsert', async () => {
    await markOnboardingSkipped(USER_ID, NOW);
    expect(snapshotUpserts[0].update).toEqual({ onboardingSkippedAt: NOW });
    expect(snapshotUpserts[0].create).toMatchObject({ userId: USER_ID, onboardingSkippedAt: NOW });
  });

  it('is set-once — a second skip does not overwrite the first', async () => {
    snapshotFindUniqueImpl.mockResolvedValue({
      onboardingSkippedAt: new Date('2026-07-19T09:00:00Z'),
    });
    await markOnboardingSkipped(USER_ID, NOW);
    expect(snapshotUpserts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Derived product access
// ---------------------------------------------------------------------------

describe('getActiveProducts', () => {
  it('derives from tier, purchases and recode progress — nothing stored', async () => {
    userFindUniqueImpl.mockResolvedValue({ currentTier: 'essential' });
    purchaseFindManyImpl.mockResolvedValue([
      { productType: 'recode', productId: null, accessExpiresAt: null },
      {
        productType: 'theme_module',
        productId: 'shame',
        accessExpiresAt: new Date('2026-08-01T00:00:00Z'), // future of NOW
      },
      {
        productType: 'state_module',
        productId: 'anxiety',
        accessExpiresAt: new Date('2026-07-01T00:00:00Z'), // expired
      },
    ]);
    recodeFindUniqueImpl.mockResolvedValue({ dischargedAt: null });

    const products = await getActiveProducts(USER_ID, NOW);
    expect(products.minimindTier).toBe('essential');
    expect(products.journey).toEqual({ purchased: true, started: true, discharged: false });
    expect(products.themes).toEqual([
      { moduleId: 'shame', accessExpiresAt: new Date('2026-08-01T00:00:00Z'), active: true },
    ]);
    expect(products.states).toEqual([
      { moduleId: 'anxiety', accessExpiresAt: new Date('2026-07-01T00:00:00Z'), active: false },
    ]);
  });

  it('handles the brand-new user (nothing anywhere)', async () => {
    const products = await getActiveProducts(USER_ID, NOW);
    expect(products).toEqual({
      minimindTier: null,
      journey: { purchased: false, started: false, discharged: false },
      states: [],
      themes: [],
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Recommendation log
// ---------------------------------------------------------------------------

describe('recommendations', () => {
  it('records with encrypted reason', async () => {
    await recordRecommendation({
      userId: USER_ID,
      product: 'theme:money',
      source: 'platform_rule',
      ruleKey: 'onboarding_area_money',
      reason: 'You said money feels most affected right now.',
    });
    expect(recCreates[0].data).toMatchObject({
      userId: USER_ID,
      product: 'theme:money',
      source: 'platform_rule',
      ruleKey: 'onboarding_area_money',
      reasonEncrypted: 'enc(You said money feels most affected right now.)',
    });
  });

  it('rejects unknown sources', async () => {
    await expect(
      recordRecommendation({ userId: USER_ID, product: 'minimind', source: 'marketing' as never }),
    ).rejects.toThrow('unknown recommendation source');
  });

  it('a decline sets the cool-off; an accept does not', async () => {
    await respondToRecommendation('rec_1', 'declined', NOW);
    const coolOff = recUpdates[0].data.coolOffUntil as Date;
    const expected = NOW.getTime() + RECOMMENDATION_COOL_OFF_DAYS * 24 * 60 * 60 * 1000;
    expect(coolOff.getTime()).toBe(expected);

    await respondToRecommendation('rec_2', 'accepted', NOW);
    expect(recUpdates[1].data.coolOffUntil).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. User-facing projection — the privacy boundary
// ---------------------------------------------------------------------------

describe('getUserFacingProfile', () => {
  it('pins the field list — hidden diagnostics are structurally absent', async () => {
    const profile = await getUserFacingProfile(USER_ID, NOW);
    expect(Object.keys(profile).sort()).toEqual(
      ['activeRecommendations', 'onboarding', 'products'].sort(),
    );
    expect(Object.keys(profile.onboarding).sort()).toEqual(
      ['area', 'completedAt', 'goal', 'skippedAt', 'style', 'why'].sort(),
    );
    // Belt-and-braces: none of the hidden-diagnostic names appear anywhere
    // in the serialised projection.
    const serialised = JSON.stringify(profile);
    for (const forbidden of [
      'riskMarkers',
      'attachmentStyle',
      'regulationCapacity',
      'engineNotes',
      'predominantState',
      'activeThemes',
      'channelPreference',
      'recentStateOccurrences',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('returns onboarding answers and decrypted reasons for open recommendations', async () => {
    snapshotFindUniqueImpl.mockResolvedValue({
      onboardingWhy: 'lost_myself',
      onboardingArea: 'career_purpose',
      onboardingStyle: 'direct_practical',
      onboardingGoal: 'decision_clarity',
      onboardingCompletedAt: NOW,
      onboardingSkippedAt: null,
    });
    recFindManyImpl.mockResolvedValue([
      {
        id: 'rec_1',
        product: 'theme:self_realisation',
        reasonEncrypted: 'enc(You said career and purpose feels most affected.)',
        createdAt: NOW,
        coolOffUntil: null,
      },
    ]);
    const profile = await getUserFacingProfile(USER_ID, NOW);
    expect(profile.onboarding.why).toBe('lost_myself');
    expect(profile.activeRecommendations).toEqual([
      {
        id: 'rec_1',
        product: 'theme:self_realisation',
        reason: 'You said career and purpose feels most affected.',
        createdAt: NOW,
      },
    ]);
  });

  it('excludes cooled-off recommendations from the active list', async () => {
    recFindManyImpl.mockResolvedValue([
      {
        id: 'rec_cooled',
        product: 'journey',
        reasonEncrypted: null,
        createdAt: NOW,
        coolOffUntil: new Date(NOW.getTime() + 1000), // still cooling
      },
    ]);
    const profile = await getUserFacingProfile(USER_ID, NOW);
    expect(profile.activeRecommendations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Step 5 additions — ownership-checked responses + shown stamping
// ---------------------------------------------------------------------------

describe('respondToRecommendationOwned', () => {
  it('refuses a recommendation belonging to someone else (no write)', async () => {
    recFindFirstStep5.mockResolvedValue(null);
    const ok = await respondToRecommendationOwned(USER_ID, 'rec_foreign', 'declined', NOW);
    expect(ok).toBe(false);
    expect(recUpdates).toHaveLength(0);
  });

  it('responds when the recommendation is owned and open', async () => {
    recFindFirstStep5.mockResolvedValue({ id: 'rec_mine' });
    const ok = await respondToRecommendationOwned(USER_ID, 'rec_mine', 'declined', NOW);
    expect(ok).toBe(true);
    expect(recUpdates).toHaveLength(1);
    expect(recUpdates[0].data.response).toBe('declined');
  });
});

describe('getUserFacingProfile — ruleKey exposure (Step 5)', () => {
  it('recommendations carry ruleKey for dashboard localisation', async () => {
    recFindManyImpl.mockResolvedValue([
      {
        id: 'rec_1',
        product: 'theme:money',
        ruleKey: 'onboarding_area_money',
        reasonEncrypted: null,
        createdAt: NOW,
        coolOffUntil: null,
      },
    ]);
    const profile = await getUserFacingProfile(USER_ID, NOW);
    expect(profile.activeRecommendations[0]).toMatchObject({
      ruleKey: 'onboarding_area_money',
      reason: null,
    });
  });
});
