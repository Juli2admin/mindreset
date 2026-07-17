// Tests for the theme-module access gate.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    purchase: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { checkThemeModuleAccess } from './access';

const findFirst = prisma.purchase.findFirst as unknown as ReturnType<
  typeof vi.fn
>;
const findUser = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Default mock: user is not a pilot tester — the pilot short-circuit
// returns { active: false, reason: 'no_pilot' } and the gate falls
// through to the Purchase check the original tests were written against.
const NOT_A_PILOT = { pilotTrialEndsAt: null, pilotInvitation: null };

beforeEach(() => {
  findFirst.mockReset();
  findUser.mockReset();
  findUser.mockResolvedValue(NOT_A_PILOT);
});

describe('checkThemeModuleAccess', () => {
  it('rejects an unknown moduleId as invalid_module', async () => {
    const r = await checkThemeModuleAccess('u1', 'not_a_theme');
    expect(r).toEqual({ allowed: false, reason: 'invalid_module' });
    expect(findFirst).not.toHaveBeenCalled();
    expect(findUser).not.toHaveBeenCalled();
  });

  it('returns not_purchased when no completed purchase exists', async () => {
    findFirst.mockResolvedValueOnce(null);
    const r = await checkThemeModuleAccess('u1', 'shame');
    expect(r).toEqual({ allowed: false, reason: 'not_purchased' });
  });

  it('returns not_purchased when a row exists but accessExpiresAt is null', async () => {
    findFirst.mockResolvedValueOnce({ accessExpiresAt: null });
    const r = await checkThemeModuleAccess('u1', 'shame');
    expect(r).toEqual({ allowed: false, reason: 'not_purchased' });
  });

  it('returns expired when accessExpiresAt is in the past', async () => {
    findFirst.mockResolvedValueOnce({
      accessExpiresAt: new Date(NOW - HOUR),
    });
    const r = await checkThemeModuleAccess('u1', 'money');
    expect(r).toEqual({ allowed: false, reason: 'expired' });
  });

  it('allows access when accessExpiresAt is in the future', async () => {
    const future = new Date(NOW + 20 * DAY);
    findFirst.mockResolvedValueOnce({ accessExpiresAt: future });
    const r = await checkThemeModuleAccess('u1', 'family');
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.expiresAt).toEqual(future);
  });

  it('queries with productType=theme_module (isolates from state_module)', async () => {
    findFirst.mockResolvedValueOnce({ accessExpiresAt: new Date(NOW + DAY) });
    await checkThemeModuleAccess('u1', 'self_realisation');
    const call = findFirst.mock.calls[0][0];
    expect(call.where).toEqual({
      userId: 'u1',
      productType: 'theme_module',
      productId: 'self_realisation',
      status: 'completed',
    });
    expect(call.orderBy).toEqual({ accessExpiresAt: 'desc' });
  });

  describe('active pilot short-circuit', () => {
    it('grants access to any valid theme when pilot is active', async () => {
      const trialEnd = new Date(NOW + 15 * DAY);
      findUser.mockResolvedValueOnce({
        pilotTrialEndsAt: trialEnd,
        pilotInvitation: { revokedAt: null },
      });
      const r = await checkThemeModuleAccess('u1', 'shame');
      expect(r.allowed).toBe(true);
      if (r.allowed) expect(r.expiresAt).toEqual(trialEnd);
      // Purchase check must NOT run when pilot short-circuit hits.
      expect(findFirst).not.toHaveBeenCalled();
    });

    it('falls through to Purchase check when pilot has expired', async () => {
      findUser.mockResolvedValueOnce({
        pilotTrialEndsAt: new Date(NOW - HOUR),
        pilotInvitation: { revokedAt: null },
      });
      const paidExpiry = new Date(NOW + 10 * DAY);
      findFirst.mockResolvedValueOnce({ accessExpiresAt: paidExpiry });
      const r = await checkThemeModuleAccess('u1', 'family');
      expect(r.allowed).toBe(true);
      if (r.allowed) expect(r.expiresAt).toEqual(paidExpiry);
      expect(findFirst).toHaveBeenCalledTimes(1);
    });

    it('falls through to Purchase check when pilot is revoked', async () => {
      findUser.mockResolvedValueOnce({
        pilotTrialEndsAt: new Date(NOW + 10 * DAY),
        pilotInvitation: { revokedAt: new Date(NOW - HOUR) },
      });
      findFirst.mockResolvedValueOnce(null);
      const r = await checkThemeModuleAccess('u1', 'body');
      expect(r).toEqual({ allowed: false, reason: 'not_purchased' });
    });
  });
});
