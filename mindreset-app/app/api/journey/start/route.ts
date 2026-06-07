// Initialise The Journey for an authenticated, paid user.
// Idempotent — if RecodeProgress already exists, returns the current stage
// without modifying anything.

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Access check: user must have a completed Journey purchase.
  const purchase = await prisma.purchase.findFirst({
    where: {
      userId,
      productType: 'recode',
      status: 'completed',
    },
    select: { id: true },
  });
  if (!purchase) {
    return NextResponse.json({ error: 'No Journey access' }, { status: 403 });
  }

  // Idempotent: reuse existing RecodeProgress if any.
  const existing = await prisma.recodeProgress.findUnique({
    where: { userId },
    select: { currentStage: true, anchorTextEncrypted: true, frozenForReview: true },
  });
  if (existing) {
    return NextResponse.json({
      started: false,
      currentStage: existing.currentStage,
      anchorSet: Boolean(existing.anchorTextEncrypted),
      frozenForReview: existing.frozenForReview,
    });
  }

  await prisma.recodeProgress.create({
    data: {
      userId,
      currentStage: 1,
      currentDepth: 'surface',
      mii: {},
    },
  });

  return NextResponse.json({
    started: true,
    currentStage: 1,
    anchorSet: false,
    frozenForReview: false,
  });
}
