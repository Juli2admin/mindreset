// Email-locked pilot invitations (owner request, 2026-09-22).
//
// THE GAP THIS CLOSES. A pilot invitation code is bound to the LINK: whoever
// opens /redeem/[code] first claims the 30-day trial. For Anastasia's grant
// the owner asked that only her email be eligible. INVITATION_EMAIL_LOCKS
// binds a specific code to a specific account email, checked at redemption.
//
// WHAT THIS IS NOT. Not the PILOT_TESTER_EMAILS allowlist (testers.ts) —
// that grants indefinite access at signup with no trial window, which the
// owner explicitly did not want. A locked invitation keeps every property
// of the normal pilot flow (30 days from redemption, self-closing expiry,
// revocation) and adds only the eligibility check. Unlocked codes are
// byte-for-byte unaffected.

import { readFileSync } from 'node:fs';
import path from 'node:path';
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
import { redeemInvitation, INVITATION_EMAIL_LOCKS } from './invitations';

const inv = prisma.pilotInvitation as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
const userMock = prisma.user as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
const purchaseMock = prisma.purchase as unknown as {
  create: ReturnType<typeof vi.fn>;
};
const tx = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

const LOCKED_CODE = 'PILOT-6P2HAQPYCJ';
const LOCKED_EMAIL = 'anastasia@akiseleva.com';

const lockedRow = () => ({
  id: 'i_ana',
  code: LOCKED_CODE,
  revokedAt: null,
  expiresAt: null,
  redeemedByUserId: null,
  trialDays: 30,
});

beforeEach(() => {
  inv.findUnique.mockReset();
  inv.update.mockReset();
  userMock.findUnique.mockReset();
  userMock.update.mockReset();
  purchaseMock.create.mockReset();
  tx.mockClear();
});

describe('the lock registry', () => {
  it("carries Anastasia's grant, lowercase, and nothing gratuitous", () => {
    expect(INVITATION_EMAIL_LOCKS[LOCKED_CODE]).toBe(LOCKED_EMAIL);
    for (const [code, email] of Object.entries(INVITATION_EMAIL_LOCKS)) {
      expect(code.startsWith('PILOT-')).toBe(true);
      expect(email).toBe(email.trim().toLowerCase());
    }
  });
});

describe('a locked code admits only its email', () => {
  it('redeems for the matching email, case- and whitespace-insensitively', async () => {
    for (const spelling of [
      LOCKED_EMAIL,
      'Anastasia@akiseleva.com',
      '  ANASTASIA@AKISELEVA.COM  ',
    ]) {
      inv.findUnique.mockResolvedValueOnce(lockedRow());
      userMock.findUnique.mockResolvedValueOnce({ pilotInvitationId: null });
      const r = await redeemInvitation(LOCKED_CODE, 'user_ana', spelling);
      expect(r.ok).toBe(true);
    }
  });

  it('refuses any other email, writing nothing', async () => {
    inv.findUnique.mockResolvedValueOnce(lockedRow());
    const r = await redeemInvitation(LOCKED_CODE, 'user_x', 'someone.else@gmail.com');
    expect(r).toEqual({ ok: false, reason: 'email_locked' });
    expect(tx).not.toHaveBeenCalled();
    expect(inv.update).not.toHaveBeenCalled();
    expect(userMock.update).not.toHaveBeenCalled();
    expect(purchaseMock.create).not.toHaveBeenCalled();
  });

  it('FAILS CLOSED when no email could be supplied', async () => {
    for (const missing of [undefined, null, ''] as const) {
      inv.findUnique.mockResolvedValueOnce(lockedRow());
      const r = await redeemInvitation(LOCKED_CODE, 'user_x', missing);
      expect(r).toEqual({ ok: false, reason: 'email_locked' });
    }
    expect(tx).not.toHaveBeenCalled();
  });

  it('revocation and expiry still outrank the lock', async () => {
    inv.findUnique.mockResolvedValueOnce({ ...lockedRow(), revokedAt: new Date() });
    expect((await redeemInvitation(LOCKED_CODE, 'user_ana', LOCKED_EMAIL))).toEqual({
      ok: false,
      reason: 'invitation_revoked',
    });
    inv.findUnique.mockResolvedValueOnce({
      ...lockedRow(),
      expiresAt: new Date(Date.now() - 60_000),
    });
    expect((await redeemInvitation(LOCKED_CODE, 'user_ana', LOCKED_EMAIL))).toEqual({
      ok: false,
      reason: 'invitation_expired',
    });
  });
});

describe('unlocked codes are byte-for-byte unaffected', () => {
  const plainRow = () => ({ ...lockedRow(), id: 'i_plain', code: 'PILOT-PLAIN234X' });

  it('redeems with no email at all — the pre-lock call shape', async () => {
    inv.findUnique.mockResolvedValueOnce(plainRow());
    userMock.findUnique.mockResolvedValueOnce({ pilotInvitationId: null });
    const r = await redeemInvitation('PILOT-PLAIN234X', 'user_1');
    expect(r.ok).toBe(true);
  });

  it('redeems with any email supplied', async () => {
    inv.findUnique.mockResolvedValueOnce(plainRow());
    userMock.findUnique.mockResolvedValueOnce({ pilotInvitationId: null });
    const r = await redeemInvitation('PILOT-PLAIN234X', 'user_1', 'whoever@example.com');
    expect(r.ok).toBe(true);
  });
});

describe('both redemption call sites supply the email', () => {
  it('the /redeem page passes the Clerk primary email', () => {
    const page = readFileSync(
      path.join(process.cwd(), 'app/[locale]/redeem/[code]/page.tsx'),
      'utf8',
    );
    expect(page).toContain('redeemInvitation(params.code, userId, primaryEmail)');
    // ...and renders the refusal in both hand-curated locales.
    expect(page).toContain('email_locked');
    expect(page).toContain('reserved for a specific email address');
    expect(page).toContain('закреплено за определённым email-адресом');
  });

  it('the /home cookie consumer passes the Clerk primary email', () => {
    const home = readFileSync(
      path.join(process.cwd(), 'app/[locale]/home/page.tsx'),
      'utf8',
    );
    expect(home).toContain('redeemInvitation(pilotCookie.value, user.id, primaryEmail)');
  });

  it('the indefinite-access allowlist was NOT touched', () => {
    const testers = readFileSync(
      path.join(process.cwd(), 'lib/pilot/testers.ts'),
      'utf8',
    );
    expect(testers).not.toContain('akiseleva');
  });
});
