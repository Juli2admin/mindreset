// Tests for the state-module access gate.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    purchase: { findFirst: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { checkStateModuleAccess } from './access';

const findFirst = prisma.purchase.findFirst as unknown as ReturnType<
  typeof vi.fn
>;

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

beforeEach(() => {
  findFirst.mockReset();
});

describe('checkStateModuleAccess', () => {
  it('rejects an unknown moduleId as invalid_module', async () => {
    const r = await checkStateModuleAccess('u1', 'not_a_module');
    expect(r).toEqual({ allowed: false, reason: 'invalid_module' });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns not_purchased when no completed purchase exists', async () => {
    findFirst.mockResolvedValueOnce(null);
    const r = await checkStateModuleAccess('u1', 'anxiety');
    expect(r).toEqual({ allowed: false, reason: 'not_purchased' });
  });

  it('returns not_purchased when a row exists but accessExpiresAt is null', async () => {
    findFirst.mockResolvedValueOnce({ accessExpiresAt: null });
    const r = await checkStateModuleAccess('u1', 'anxiety');
    expect(r).toEqual({ allowed: false, reason: 'not_purchased' });
  });

  it('returns expired when accessExpiresAt is in the past', async () => {
    findFirst.mockResolvedValueOnce({
      accessExpiresAt: new Date(NOW - HOUR),
    });
    const r = await checkStateModuleAccess('u1', 'apathy');
    expect(r).toEqual({ allowed: false, reason: 'expired' });
  });

  it('allows access when accessExpiresAt is in the future', async () => {
    const future = new Date(NOW + 20 * DAY);
    findFirst.mockResolvedValueOnce({ accessExpiresAt: future });
    const r = await checkStateModuleAccess('u1', 'loss_of_self');
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.expiresAt).toEqual(future);
  });

  it('reads the latest purchase (orderBy accessExpiresAt desc)', async () => {
    findFirst.mockResolvedValueOnce({ accessExpiresAt: new Date(NOW + DAY) });
    await checkStateModuleAccess('u1', 'inner_emptiness');
    const call = findFirst.mock.calls[0][0];
    expect(call.orderBy).toEqual({ accessExpiresAt: 'desc' });
    expect(call.where).toEqual({
      userId: 'u1',
      productType: 'state_module',
      productId: 'inner_emptiness',
      status: 'completed',
    });
  });
});
