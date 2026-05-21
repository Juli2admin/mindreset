import prisma from '@/lib/prisma';

// Atomically consumes one message from the user's allowance.
// Top-up pool is drawn down first; only then the cycle counter.
// Caller (chat route) must check hasCapacity() before calling this
// and return 402 if there is no capacity — this function trusts the caller.
export async function consumeMessage(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { topUpMessagesRemaining: true },
    });

    if (user.topUpMessagesRemaining > 0) {
      await tx.user.update({
        where: { id: userId },
        data: {
          topUpMessagesRemaining: { decrement: 1 },
          lifetimeMessagesUsed:   { increment: 1 },
        },
      });
    } else {
      await tx.user.update({
        where: { id: userId },
        data: {
          messagesUsedThisCycle: { increment: 1 },
          lifetimeMessagesUsed:  { increment: 1 },
        },
      });
    }
  });
}
