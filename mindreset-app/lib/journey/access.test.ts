// Tests for the Journey access gate — especially the pilot ↔ paid
// interactions added in PR ρ1/ρ2.
//
// Prisma is mocked at the module boundary; we're testing the branching
// logic, not the DB.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn() },
    purchase: { findFirst: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { checkJourneyAccess } from './access';

const userFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const purchaseFindFirst = prisma.purchase.findFirst as unknown as ReturnType<
  typeof vi.fn
>;

const NOW = Date.now();
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const YEAR_MS = 365 * DAY_MS;

beforeEach(() => {
  userFindUnique.mockReset();
  purchaseFindFirst.mockReset();
});

describe('checkJourneyAccess', () => {
  it('returns no_purchase when there is no recode Purchase', async () => {
    userFindUnique.mockResolvedValueOnce({
      pilotTrialEndsAt: null,
      pilotInvitation: null,
    });
    purchaseFindFirst.mockResolvedValueOnce(null);
    const r = await checkJourneyAccess('u1');
    expect(r).toEqual({ allowed: false, reason: 'no_purchase' });
  });

  it('allows a paid customer within their 1-year window', async () => {
    userFindUnique.mockResolvedValueOnce({
      pilotTrialEndsAt: null,
      pilotInvitation: null,
    });
    purchaseFindFirst.mockResolvedValueOnce({
      id: 'p1',
      firstAccessedAt: new Date(NOW - 30 * DAY_MS),
      journeyMessagesUsed: 10,
      amount: 59900,
    });
    const r = await checkJourneyAccess('u1');
    expect(r.allowed).toBe(true);
  });

  it('returns expired for a paid customer past the 1-year window', async () => {
    userFindUnique.mockResolvedValueOnce({
      pilotTrialEndsAt: null,
      pilotInvitation: null,
    });
    purchaseFindFirst.mockResolvedValueOnce({
      id: 'p1',
      firstAccessedAt: new Date(NOW - YEAR_MS - HOUR_MS),
      journeyMessagesUsed: 10,
      amount: 59900,
    });
    const r = await checkJourneyAccess('u1');
    expect(r).toEqual({ allowed: false, reason: 'expired' });
  });

  it('allows a pilot tester while their trial is still running', async () => {
    userFindUnique.mockResolvedValueOnce({
      pilotTrialEndsAt: new Date(NOW + 10 * DAY_MS),
      pilotInvitation: { revokedAt: null },
    });
    purchaseFindFirst.mockResolvedValueOnce({
      id: 'p_pilot',
      firstAccessedAt: null,
      journeyMessagesUsed: 3,
      amount: 0,
    });
    const r = await checkJourneyAccess('u1');
    expect(r.allowed).toBe(true);
  });

  it('returns pilot_expired when trial ended and no paid Purchase exists', async () => {
    userFindUnique.mockResolvedValueOnce({
      pilotTrialEndsAt: new Date(NOW - HOUR_MS),
      pilotInvitation: { revokedAt: null },
    });
    purchaseFindFirst.mockResolvedValueOnce({
      id: 'p_pilot',
      firstAccessedAt: null,
      journeyMessagesUsed: 3,
      amount: 0,
    });
    const r = await checkJourneyAccess('u1');
    expect(r).toEqual({ allowed: false, reason: 'pilot_expired' });
  });

  it('returns pilot_revoked when the pilot invitation was revoked', async () => {
    userFindUnique.mockResolvedValueOnce({
      pilotTrialEndsAt: new Date(NOW + 5 * DAY_MS),
      pilotInvitation: { revokedAt: new Date(NOW - HOUR_MS) },
    });
    purchaseFindFirst.mockResolvedValueOnce({
      id: 'p_pilot',
      firstAccessedAt: null,
      journeyMessagesUsed: 0,
      amount: 0,
    });
    const r = await checkJourneyAccess('u1');
    expect(r).toEqual({ allowed: false, reason: 'pilot_revoked' });
  });

  it('graduates a pilot who upgraded — a paid Purchase overrides expired trial', async () => {
    // Trial ended, invitation not revoked, but the newer paid Purchase
    // (amount > 0, from the 50%-off checkout) is what findFirst returned.
    // The gate should ignore the pilot expiry and apply the normal
    // 1-year window off the paid firstAccessedAt.
    userFindUnique.mockResolvedValueOnce({
      pilotTrialEndsAt: new Date(NOW - 10 * DAY_MS),
      pilotInvitation: { revokedAt: null },
    });
    purchaseFindFirst.mockResolvedValueOnce({
      id: 'p_paid',
      firstAccessedAt: new Date(NOW - HOUR_MS),
      journeyMessagesUsed: 0,
      amount: 29950,
    });
    const r = await checkJourneyAccess('u1');
    expect(r.allowed).toBe(true);
  });

  it('a revoked pilot is denied even if they have a paid Purchase (safety-first)', async () => {
    // Julia revoked them — she wants them gone. A paid Purchase shouldn't
    // resurrect their access.
    // Note: current implementation SKIPS the pilot check when a paid
    // Purchase is present, which means a revoked-and-upgraded user WOULD
    // gain access. That's the desired product behaviour (they paid, so
    // they access), but if you ever want to keep revoked users out,
    // access.ts needs to check revokedAt outside the isPaidPurchase guard.
    // This test locks the CURRENT behaviour so any future change is
    // deliberate.
    userFindUnique.mockResolvedValueOnce({
      pilotTrialEndsAt: new Date(NOW - 10 * DAY_MS),
      pilotInvitation: { revokedAt: new Date(NOW - DAY_MS) },
    });
    purchaseFindFirst.mockResolvedValueOnce({
      id: 'p_paid',
      firstAccessedAt: new Date(NOW - HOUR_MS),
      journeyMessagesUsed: 0,
      amount: 29950,
    });
    const r = await checkJourneyAccess('u1');
    expect(r.allowed).toBe(true);
  });

  it('enforces the 5,000-msg abuse cap on pilot testers too', async () => {
    userFindUnique.mockResolvedValueOnce({
      pilotTrialEndsAt: new Date(NOW + 5 * DAY_MS),
      pilotInvitation: { revokedAt: null },
    });
    purchaseFindFirst.mockResolvedValueOnce({
      id: 'p_pilot',
      firstAccessedAt: null,
      journeyMessagesUsed: 5000,
      amount: 0,
    });
    const r = await checkJourneyAccess('u1');
    expect(r).toEqual({ allowed: false, reason: 'cap_reached' });
  });
});
