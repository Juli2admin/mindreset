// Unit tests for pilot invitation lifecycle. Prisma is mocked; we care
// about the branching + status derivation, not the DB layer.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    pilotInvitation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    purchase: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (arr: unknown[]) => arr),
  },
}));

import prisma from '@/lib/prisma';
import {
  generateInviteCode,
  redeemInvitation,
  deriveStatus,
  CODE_PREFIX,
  CODE_LENGTH,
} from './invitations';

const inv = prisma.pilotInvitation as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
const userMock = prisma.user as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  inv.findUnique.mockReset();
  inv.create.mockReset();
  inv.update.mockReset();
  userMock.findUnique.mockReset();
  userMock.update.mockReset();
});

describe('generateInviteCode', () => {
  it('produces a prefixed, correct-length code', () => {
    const code = generateInviteCode();
    expect(code.startsWith(CODE_PREFIX)).toBe(true);
    expect(code.length).toBe(CODE_PREFIX.length + CODE_LENGTH);
  });
  it('uses the unambiguous alphabet (no 0/O/I/1)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      const tail = code.slice(CODE_PREFIX.length);
      expect(tail).not.toMatch(/[0O1I]/);
    }
  });
});

describe('redeemInvitation', () => {
  it('returns not_found for a bad code', async () => {
    inv.findUnique.mockResolvedValueOnce(null);
    const r = await redeemInvitation('PILOT-BAD', 'user_1');
    expect(r).toEqual({ ok: false, reason: 'not_found' });
  });

  it('returns invitation_revoked when revokedAt is set', async () => {
    inv.findUnique.mockResolvedValueOnce({
      id: 'i1',
      code: 'PILOT-X',
      revokedAt: new Date(),
      expiresAt: null,
      redeemedByUserId: null,
      trialDays: 30,
    });
    const r = await redeemInvitation('PILOT-X', 'user_1');
    expect(r).toEqual({ ok: false, reason: 'invitation_revoked' });
  });

  it('returns invitation_expired when expiresAt is past', async () => {
    inv.findUnique.mockResolvedValueOnce({
      id: 'i1',
      code: 'PILOT-X',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      redeemedByUserId: null,
      trialDays: 30,
    });
    const r = await redeemInvitation('PILOT-X', 'user_1');
    expect(r).toEqual({ ok: false, reason: 'invitation_expired' });
  });

  it('returns already_redeemed_by_other when a different user claimed it', async () => {
    inv.findUnique.mockResolvedValueOnce({
      id: 'i1',
      code: 'PILOT-X',
      revokedAt: null,
      expiresAt: null,
      redeemedByUserId: 'user_other',
      trialDays: 30,
    });
    const r = await redeemInvitation('PILOT-X', 'user_1');
    expect(r).toEqual({ ok: false, reason: 'already_redeemed_by_other' });
  });

  it('idempotently returns ok when the same user re-redeems', async () => {
    const trialEnd = new Date(Date.now() + 30 * 86400_000);
    inv.findUnique.mockResolvedValueOnce({
      id: 'i1',
      code: 'PILOT-X',
      revokedAt: null,
      expiresAt: null,
      redeemedByUserId: 'user_1',
      trialDays: 30,
    });
    userMock.findUnique.mockResolvedValueOnce({ pilotTrialEndsAt: trialEnd });
    const r = await redeemInvitation('PILOT-X', 'user_1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.alreadyRedeemedByThisUser).toBe(true);
      expect(r.trialEndsAt).toEqual(trialEnd);
    }
  });

  it('refuses a user who already has a pilot on their account', async () => {
    inv.findUnique.mockResolvedValueOnce({
      id: 'i1',
      code: 'PILOT-X',
      revokedAt: null,
      expiresAt: null,
      redeemedByUserId: null,
      trialDays: 30,
    });
    userMock.findUnique.mockResolvedValueOnce({ pilotInvitationId: 'i_prev' });
    const r = await redeemInvitation('PILOT-X', 'user_1');
    expect(r).toEqual({ ok: false, reason: 'user_already_pilot' });
  });

  it('succeeds on a clean redeem and computes a 30-day trial end', async () => {
    inv.findUnique.mockResolvedValueOnce({
      id: 'i1',
      code: 'PILOT-X',
      revokedAt: null,
      expiresAt: null,
      redeemedByUserId: null,
      trialDays: 30,
    });
    userMock.findUnique.mockResolvedValueOnce({ pilotInvitationId: null });

    const before = Date.now();
    const r = await redeemInvitation('PILOT-X', 'user_1');
    const after = Date.now();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.alreadyRedeemedByThisUser).toBe(false);
      const trialMs = r.trialEndsAt.getTime();
      expect(trialMs).toBeGreaterThanOrEqual(before + 30 * 86400_000 - 100);
      expect(trialMs).toBeLessThanOrEqual(after + 30 * 86400_000 + 100);
    }
  });
});

describe('deriveStatus', () => {
  const base = {
    redeemedAt: null,
    expiresAt: null,
    revokedAt: null,
    afterFormFilled: false,
    redeemedByUser: null,
  } as const;

  it('pending when never redeemed and not revoked/expired', () => {
    expect(deriveStatus({ ...base })).toBe('pending');
  });

  it('revoked takes precedence over everything', () => {
    expect(
      deriveStatus({
        ...base,
        redeemedAt: new Date(),
        revokedAt: new Date(),
      }),
    ).toBe('revoked');
  });

  it('expired_invitation when never redeemed and past expiresAt', () => {
    expect(
      deriveStatus({ ...base, expiresAt: new Date(Date.now() - 60_000) }),
    ).toBe('expired_invitation');
  });

  it('active when redeemed and trial still running', () => {
    expect(
      deriveStatus({
        ...base,
        redeemedAt: new Date(Date.now() - 86400_000),
        redeemedByUser: {
          pilotTrialEndsAt: new Date(Date.now() + 86400_000),
        },
      }),
    ).toBe('active');
  });

  it('expired_trial when trial end is in the past', () => {
    expect(
      deriveStatus({
        ...base,
        redeemedAt: new Date(Date.now() - 86400_000 * 40),
        redeemedByUser: { pilotTrialEndsAt: new Date(Date.now() - 60_000) },
      }),
    ).toBe('expired_trial');
  });

  it('completed when afterFormFilled is true', () => {
    expect(
      deriveStatus({
        ...base,
        redeemedAt: new Date(),
        afterFormFilled: true,
        redeemedByUser: {
          pilotTrialEndsAt: new Date(Date.now() + 86400_000),
        },
      }),
    ).toBe('completed');
  });
});
