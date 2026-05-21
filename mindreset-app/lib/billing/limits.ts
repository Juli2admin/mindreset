// Message allowance caps for each tier (Block B, locked 2026-05-21).
// Free taster: 20 lifetime messages, one shot per email, no card.
// Essential:   200 per billing cycle.
// Extended:    soft cap at 800 (gentle notice), hard cap at 1,200.
// Top-up:      +200 per purchase, consumed before the cycle pool.
// Counter reset is driven by invoice.payment_succeeded webhook (Stripe anniversary).

export const TIER_CAPS = {
  free:     { lifetime: 20 },
  essential: { perCycle: 200 },
  extended: { softCap: 800, hardCap: 1_200 },
  topUp:    { messages: 200 },
} as const;

export type BillingUser = {
  currentTier:            string | null;
  messagesUsedThisCycle:  number;
  topUpMessagesRemaining: number;
  lifetimeMessagesUsed:   number;
};

export function hasCapacity(user: BillingUser): boolean {
  const tier = user.currentTier ?? 'free';

  // Top-up pool is consumed before the cycle allowance.
  if (user.topUpMessagesRemaining > 0) return true;

  if (tier === 'free')      return user.lifetimeMessagesUsed < TIER_CAPS.free.lifetime;
  if (tier === 'essential') return user.messagesUsedThisCycle < TIER_CAPS.essential.perCycle;
  if (tier === 'extended')  return user.messagesUsedThisCycle < TIER_CAPS.extended.hardCap;

  return false;
}

// Total messages the user can still send this cycle (including top-up pool).
export function availableMessages(user: BillingUser): number {
  const tier = user.currentTier ?? 'free';
  const topUp = user.topUpMessagesRemaining;

  if (tier === 'free') {
    return Math.max(0, TIER_CAPS.free.lifetime - user.lifetimeMessagesUsed) + topUp;
  }
  if (tier === 'essential') {
    return Math.max(0, TIER_CAPS.essential.perCycle - user.messagesUsedThisCycle) + topUp;
  }
  if (tier === 'extended') {
    return Math.max(0, TIER_CAPS.extended.hardCap - user.messagesUsedThisCycle) + topUp;
  }

  return 0;
}

// True when an Extended user has crossed the soft cap but not the hard cap.
// Used by the UI to show a gentle "approaching limit" notice.
export function isAtSoftCap(user: BillingUser): boolean {
  return (
    user.currentTier === 'extended' &&
    user.topUpMessagesRemaining === 0 &&
    user.messagesUsedThisCycle >= TIER_CAPS.extended.softCap &&
    user.messagesUsedThisCycle < TIER_CAPS.extended.hardCap
  );
}
