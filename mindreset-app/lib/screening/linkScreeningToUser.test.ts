import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock Prisma BEFORE importing the module under test. The mock records
// every call and order, which is exactly what we need to assert the
// "user upsert before screeningResponse update" contract that prevents
// the FK race regression.
const calls: Array<{ op: string; args: unknown }> = [];

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      upsert: vi.fn((args: unknown) => {
        calls.push({ op: 'user.upsert', args });
        return Promise.resolve({});
      }),
    },
    screeningResponse: {
      updateMany: vi.fn((args: unknown) => {
        calls.push({ op: 'screeningResponse.updateMany', args });
        return Promise.resolve({ count: 1 });
      }),
    },
    // If anyone re-introduces $transaction, the test below explicitly
    // checks this remains uncalled.
    $transaction: vi.fn(() => {
      calls.push({ op: '$transaction', args: null });
      return Promise.resolve([]);
    }),
  },
}));

import prisma from '@/lib/prisma';
import { linkScreeningToUser } from './linkScreeningToUser';

const SAMPLE_INPUT = {
  userId: 'user_clerk_abc',
  primaryEmail: 'user@example.com',
  locale: 'en',
  screening: {
    id: 'screen_xyz',
    result: 'green',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
};

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});

describe('linkScreeningToUser — FK race regression guard', () => {
  // The actual bug: post-signup loop. Reproduces if anyone reverts to
  // a $transaction wrapper, or swaps the order to write
  // ScreeningResponse.userId before the User row exists. These tests
  // pin the contract.

  it('upserts the User BEFORE updating the ScreeningResponse', async () => {
    await linkScreeningToUser(SAMPLE_INPUT);

    const opOrder = calls.map((c) => c.op);
    expect(opOrder).toEqual(['user.upsert', 'screeningResponse.updateMany']);
  });

  it('does NOT wrap the writes in prisma.$transaction', async () => {
    await linkScreeningToUser(SAMPLE_INPUT);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('upserts with the correct create payload when User row is missing', async () => {
    await linkScreeningToUser(SAMPLE_INPUT);

    const upsertCall = calls.find((c) => c.op === 'user.upsert');
    expect(upsertCall).toBeDefined();
    const args = upsertCall!.args as {
      where: { id: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };

    expect(args.where).toEqual({ id: 'user_clerk_abc' });
    expect(args.create.id).toBe('user_clerk_abc');
    expect(args.create.email).toBe('user@example.com');
    expect(args.create.locale).toBe('en');
    expect(args.create.screeningResult).toBe('green');
    // tcAcceptedAt + privacyAcceptedAt must be set on create so the
    // legal-consent gate downstream doesn't reject the row. The Clerk
    // sign-up form already collected consent — this just mirrors what
    // the webhook does.
    expect(args.create.tcAcceptedAt).toBeInstanceOf(Date);
    expect(args.create.privacyAcceptedAt).toBeInstanceOf(Date);
  });

  it('updateMany uses the userId=null guard so it is idempotent on retry', async () => {
    await linkScreeningToUser(SAMPLE_INPUT);

    const updateCall = calls.find((c) => c.op === 'screeningResponse.updateMany');
    expect(updateCall).toBeDefined();
    const args = updateCall!.args as {
      where: { id: string; userId: null };
      data: { userId: string };
    };

    expect(args.where).toEqual({ id: 'screen_xyz', userId: null });
    expect(args.data).toEqual({ userId: 'user_clerk_abc' });
  });

  it('falls back to placeholder email when Clerk has no primary email', async () => {
    await linkScreeningToUser({ ...SAMPLE_INPUT, primaryEmail: null });

    const upsertCall = calls.find((c) => c.op === 'user.upsert');
    const args = upsertCall!.args as { create: { email: string } };
    // Placeholder must include the Clerk userId so it's globally unique
    // and the Clerk webhook can later overwrite with the real email.
    expect(args.create.email).toBe('user_clerk_abc@placeholder.invalid');
  });
});
