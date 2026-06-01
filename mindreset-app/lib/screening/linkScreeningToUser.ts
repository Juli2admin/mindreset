import prisma from '@/lib/prisma';

// Screening-cookie linkage. Used by /home (primary path after sign-up)
// and /minimind (retry path if /home missed the window).
//
// ────────────────────────────────────────────────────────────────────
// WHY THIS LIVES IN ONE PLACE — read before editing.
// ────────────────────────────────────────────────────────────────────
// This logic shipped in two files with a transaction-ordering bug that
// caused new-user signup loops in PR #107 (post-mortem: PRs #109 + the
// PR that introduced this helper). To prevent the bug from ever being
// half-reintroduced, both call sites delegate here.
//
// The trap: ScreeningResponse.userId has a foreign key to User.id
// (schema.prisma:156). If you wrap the User upsert and the
// ScreeningResponse update in `prisma.$transaction([…])`, Postgres
// enforces FKs immediately — any statement that sets ScreeningResponse.userId
// before the User row exists throws P2003 (FK violation), rolls back the
// whole transaction, and the User row never gets created.
//
// The Clerk webhook upserts the User row asynchronously after sign-up
// (1–5s lag). Within that window, the /home server component runs
// before the User row exists. So the linkage MUST work without the
// transaction wrapper.
//
// The correct shape is two SEPARATE idempotent writes in order:
//   1. prisma.user.upsert — creates the User row if missing
//   2. prisma.screeningResponse.updateMany — succeeds whether the row
//      is found or not (zero matches = no-op, not exception)
//
// DO NOT wrap them in prisma.$transaction(). DO NOT swap the order.
// Regression test in lib/screening/linkScreeningToUser.test.ts will
// fail CI if you do.

export type ScreeningLinkInput = {
  userId: string;
  primaryEmail: string | null;
  locale: string;
  screening: {
    id: string;
    result: string;
    createdAt: Date;
  };
};

export async function linkScreeningToUser(input: ScreeningLinkInput): Promise<void> {
  // Step 1: ensure the User row exists. The Clerk webhook will later upsert
  // the same row with the canonical email — both upserts converge.
  await prisma.user.upsert({
    where: { id: input.userId },
    create: {
      id: input.userId,
      email: input.primaryEmail ?? `${input.userId}@placeholder.invalid`,
      locale: input.locale,
      themePref: 'system',
      tcAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      screeningResult: input.screening.result,
      screeningResultAt: input.screening.createdAt,
    },
    update: {
      screeningResult: input.screening.result,
      screeningResultAt: input.screening.createdAt,
    },
  });

  // Step 2: link the anonymous ScreeningResponse to the user. updateMany
  // with the userId=null guard makes this idempotent — re-running on an
  // already-linked row is a zero-match no-op, not an error.
  await prisma.screeningResponse.updateMany({
    where: { id: input.screening.id, userId: null },
    data: { userId: input.userId },
  });
}
