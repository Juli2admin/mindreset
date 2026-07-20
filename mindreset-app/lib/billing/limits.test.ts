// Billing caps + the Journey-includes-MiniMind entitlement (Decision 1,
// 2026-07-20). The Journey grants MiniMind Extended, DERIVED at read time
// (never written to currentTier), so it reverts when Journey access lapses.

import { describe, expect, it } from 'vitest';
import {
  effectiveTier,
  hasCapacity,
  availableMessages,
  isAtSoftCap,
  TIER_CAPS,
  JOURNEY_MINIMIND_TIER,
  type BillingUser,
} from './limits';

function user(partial: Partial<BillingUser>): BillingUser {
  return {
    currentTier: null,
    messagesUsedThisCycle: 0,
    topUpMessagesRemaining: 0,
    lifetimeMessagesUsed: 0,
    ...partial,
  };
}

describe('effectiveTier — Journey grants Extended', () => {
  it('returns the user tier when the Journey does not grant MiniMind', () => {
    expect(effectiveTier(null)).toBe('free');
    expect(effectiveTier('free', false)).toBe('free');
    expect(effectiveTier('essential', false)).toBe('essential');
    expect(effectiveTier('extended', false)).toBe('extended');
  });

  it('returns Extended whenever the Journey grants MiniMind, over any base tier', () => {
    expect(JOURNEY_MINIMIND_TIER).toBe('extended');
    expect(effectiveTier(null, true)).toBe('extended');
    expect(effectiveTier('free', true)).toBe('extended');
    expect(effectiveTier('essential', true)).toBe('extended');
    expect(effectiveTier('extended', true)).toBe('extended');
  });
});

describe('hasCapacity — with and without the Journey grant', () => {
  it('a free user at the lifetime cap is blocked WITHOUT the Journey', () => {
    const u = user({ currentTier: 'free', lifetimeMessagesUsed: TIER_CAPS.free.lifetime });
    expect(hasCapacity(u)).toBe(false);
  });

  it('the SAME free user is unblocked WITH the Journey grant (Extended pool)', () => {
    const u = user({ currentTier: 'free', lifetimeMessagesUsed: 9999, messagesUsedThisCycle: 0 });
    expect(hasCapacity(u, true)).toBe(true);
  });

  it('a Journey user is blocked once they cross the Extended hard cap', () => {
    const at = user({ currentTier: 'free', messagesUsedThisCycle: TIER_CAPS.extended.hardCap });
    const under = user({ currentTier: 'free', messagesUsedThisCycle: TIER_CAPS.extended.hardCap - 1 });
    expect(hasCapacity(at, true)).toBe(false);
    expect(hasCapacity(under, true)).toBe(true);
  });

  it('an Essential user at their cycle cap is unblocked by the Journey grant', () => {
    const u = user({ currentTier: 'essential', messagesUsedThisCycle: TIER_CAPS.essential.perCycle });
    expect(hasCapacity(u)).toBe(false);
    expect(hasCapacity(u, true)).toBe(true);
  });

  it('top-up pool grants capacity regardless of tier or Journey', () => {
    const u = user({ currentTier: 'free', lifetimeMessagesUsed: 9999, topUpMessagesRemaining: 5 });
    expect(hasCapacity(u)).toBe(true);
  });
});

describe('availableMessages — reflects the effective tier', () => {
  it('a maxed free user shows 0 without the Journey, the Extended pool with it', () => {
    const u = user({ currentTier: 'free', lifetimeMessagesUsed: TIER_CAPS.free.lifetime });
    expect(availableMessages(u)).toBe(0);
    expect(availableMessages(u, true)).toBe(TIER_CAPS.extended.hardCap);
  });

  it('counts down the Extended pool for a Journey user', () => {
    const u = user({ currentTier: 'free', messagesUsedThisCycle: 1000 });
    expect(availableMessages(u, true)).toBe(TIER_CAPS.extended.hardCap - 1000);
  });
});

describe('isAtSoftCap — Journey users get the Extended soft-cap band', () => {
  it('true for a Journey user in the 800–1,200 band', () => {
    const u = user({ currentTier: 'free', messagesUsedThisCycle: 900 });
    expect(isAtSoftCap(u, true)).toBe(true);
    expect(isAtSoftCap(u)).toBe(false); // free tier: no soft cap
  });

  it('false below the soft cap', () => {
    const u = user({ currentTier: 'free', messagesUsedThisCycle: 700 });
    expect(isAtSoftCap(u, true)).toBe(false);
  });
});
