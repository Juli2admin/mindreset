import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the allowlist to include a known tester email — leaves the real
// allowlist in testers.ts as the production source of truth without
// leaking test data into it.
vi.mock('./testers', () => {
  const emails = new Set<string>(['tester@example.com']);
  return {
    PILOT_TESTER_EMAILS: emails,
    isPilotTester: (email: string | null | undefined) => {
      if (!email) return false;
      return emails.has(email.trim().toLowerCase());
    },
  };
});

const purchaseFindFirst = vi.fn();
const purchaseCreate = vi.fn();
const userFindUnique = vi.fn();
const userUpdate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    purchase: {
      findFirst: (args: unknown) => purchaseFindFirst(args),
      create: (args: unknown) => purchaseCreate(args),
    },
    user: {
      findUnique: (args: unknown) => userFindUnique(args),
      update: (args: unknown) => userUpdate(args),
    },
  },
}));

describe('ensurePilotGrants', () => {
  beforeEach(() => {
    purchaseFindFirst.mockReset();
    purchaseCreate.mockReset();
    userFindUnique.mockReset();
    userUpdate.mockReset();
  });

  it('does nothing for a non-tester email', async () => {
    const { ensurePilotGrants } = await import('./grants');
    await ensurePilotGrants('user_1', 'random@example.com');
    expect(purchaseFindFirst).not.toHaveBeenCalled();
    expect(purchaseCreate).not.toHaveBeenCalled();
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('does nothing for a null email even if the userId is present', async () => {
    const { ensurePilotGrants } = await import('./grants');
    await ensurePilotGrants('user_1', null);
    expect(purchaseFindFirst).not.toHaveBeenCalled();
    expect(purchaseCreate).not.toHaveBeenCalled();
  });

  it('creates a Journey Purchase + flips User to Extended on first invocation', async () => {
    purchaseFindFirst.mockResolvedValue(null);
    userFindUnique.mockResolvedValue({ currentTier: 'free' });
    userUpdate.mockResolvedValue({});
    purchaseCreate.mockResolvedValue({ id: 'new_purchase' });

    const { ensurePilotGrants } = await import('./grants');
    await ensurePilotGrants('user_tester', 'tester@example.com');

    expect(purchaseFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user_tester', productType: 'recode', status: 'completed' },
      select: { id: true },
    });
    expect(purchaseCreate).toHaveBeenCalledTimes(1);
    const createArgs = purchaseCreate.mock.calls[0][0];
    expect(createArgs.data.userId).toBe('user_tester');
    expect(createArgs.data.productType).toBe('recode');
    expect(createArgs.data.amount).toBe(0);
    expect(createArgs.data.currency).toBe('GBP');
    expect(createArgs.data.status).toBe('completed');
    expect(createArgs.data.completedAt).toBeInstanceOf(Date);

    expect(userUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = userUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'user_tester' });
    expect(updateArgs.data.currentTier).toBe('extended');
    expect(updateArgs.data.cycleResetAt).toBeInstanceOf(Date);
    expect(updateArgs.data.messagesUsedThisCycle).toBe(0);
    // cycleResetAt should be roughly 30 days in the future
    const daysAhead =
      (updateArgs.data.cycleResetAt.getTime() - Date.now()) /
      (24 * 60 * 60 * 1000);
    expect(daysAhead).toBeGreaterThan(29.5);
    expect(daysAhead).toBeLessThan(30.5);
  });

  it('does NOT re-insert the Purchase row if one already exists', async () => {
    purchaseFindFirst.mockResolvedValue({ id: 'existing_purchase' });
    userFindUnique.mockResolvedValue({ currentTier: 'extended' });

    const { ensurePilotGrants } = await import('./grants');
    await ensurePilotGrants('user_tester', 'tester@example.com');

    expect(purchaseCreate).not.toHaveBeenCalled();
    // User is already on Extended → no update
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('does NOT re-flip the tier if user is already Extended', async () => {
    purchaseFindFirst.mockResolvedValue(null);
    userFindUnique.mockResolvedValue({ currentTier: 'extended' });

    const { ensurePilotGrants } = await import('./grants');
    await ensurePilotGrants('user_tester', 'tester@example.com');

    // Purchase still gets created (it was missing)
    expect(purchaseCreate).toHaveBeenCalledTimes(1);
    // Tier update skipped
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('handles case where User row does not exist yet (missing findUnique result)', async () => {
    purchaseFindFirst.mockResolvedValue(null);
    userFindUnique.mockResolvedValue(null);
    purchaseCreate.mockResolvedValue({ id: 'new' });

    const { ensurePilotGrants } = await import('./grants');
    await ensurePilotGrants('user_ghost', 'tester@example.com');

    // Purchase attempts (but would fail in real Postgres — mock doesn't
    // care, we're testing the code path not the FK). Tier update skipped
    // because user lookup returned null.
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('is case-insensitive on the tester email', async () => {
    purchaseFindFirst.mockResolvedValue({ id: 'existing' });
    userFindUnique.mockResolvedValue({ currentTier: 'extended' });

    const { ensurePilotGrants } = await import('./grants');
    await ensurePilotGrants('user_tester', 'TESTER@Example.com');

    expect(purchaseFindFirst).toHaveBeenCalled();
    expect(userFindUnique).toHaveBeenCalled();
  });
});
