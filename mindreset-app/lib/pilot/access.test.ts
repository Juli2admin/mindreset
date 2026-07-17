// Tests for the shared active-pilot check.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { checkActivePilot } from './access';

const findUser = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

beforeEach(() => {
  findUser.mockReset();
});

describe('checkActivePilot', () => {
  it('returns no_pilot when the user has no pilotTrialEndsAt', async () => {
    findUser.mockResolvedValueOnce({
      pilotTrialEndsAt: null,
      pilotInvitation: null,
    });
    const r = await checkActivePilot('u1');
    expect(r).toEqual({ active: false, reason: 'no_pilot' });
  });

  it('returns no_pilot when the user row does not exist', async () => {
    findUser.mockResolvedValueOnce(null);
    const r = await checkActivePilot('u1');
    expect(r).toEqual({ active: false, reason: 'no_pilot' });
  });

  it('returns revoked when the invitation is revoked (even inside the trial window)', async () => {
    findUser.mockResolvedValueOnce({
      pilotTrialEndsAt: new Date(NOW + 15 * DAY),
      pilotInvitation: { revokedAt: new Date(NOW - HOUR) },
    });
    const r = await checkActivePilot('u1');
    expect(r).toEqual({ active: false, reason: 'revoked' });
  });

  it('returns expired when the trial window has passed', async () => {
    findUser.mockResolvedValueOnce({
      pilotTrialEndsAt: new Date(NOW - HOUR),
      pilotInvitation: { revokedAt: null },
    });
    const r = await checkActivePilot('u1');
    expect(r).toEqual({ active: false, reason: 'expired' });
  });

  it('returns active with the trialEndsAt when trial is live and invitation is not revoked', async () => {
    const trialEnd = new Date(NOW + 10 * DAY);
    findUser.mockResolvedValueOnce({
      pilotTrialEndsAt: trialEnd,
      pilotInvitation: { revokedAt: null },
    });
    const r = await checkActivePilot('u1');
    expect(r).toEqual({ active: true, trialEndsAt: trialEnd });
  });

  it('treats a missing invitation record as not-revoked when trial is live', async () => {
    // Older test data: pilotTrialEndsAt set but the invitation relation
    // is null. The check should still grant active based on trial window.
    const trialEnd = new Date(NOW + 5 * DAY);
    findUser.mockResolvedValueOnce({
      pilotTrialEndsAt: trialEnd,
      pilotInvitation: null,
    });
    const r = await checkActivePilot('u1');
    expect(r).toEqual({ active: true, trialEndsAt: trialEnd });
  });
});
