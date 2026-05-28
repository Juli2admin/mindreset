// GDPR Article 20 data-portability export.
//
// Returns a JSON bundle of everything the user has contributed:
//   - account: profile fields + consent timestamps + tier state
//   - screening: every screening submission (raw answers + result)
//   - wellbeing: the diagnostic snapshot (one row)
//   - conversations: every conversation + messages (decrypted)
//   - purchases: payment metadata (amounts, currency, dates — NOT card data)
//   - moduleProgress, recodeProgress, practices: progress tracking
//
// EXCLUDED — by design, not user-contributed data:
//   - SafetyEvent: operational audit log used for safeguarding review
//     (Article 20 is about data the user provided; safety events are
//     classifications applied by us). Article 15 (right of access) would
//     allow request, but GDPR doesn't require we include them in a
//     self-service portable export.

import prisma from '@/lib/prisma';
import { decrypt, isEncrypted } from '@/lib/encrypt';

type ExportBundle = {
  exportedAt: string;
  schemaVersion: '1';
  account: Record<string, unknown>;
  screening: unknown[];
  wellbeing: unknown;
  conversations: unknown[];
  purchases: unknown[];
  moduleProgress: unknown[];
  recodeProgress: unknown;
  practices: unknown[];
};

function decryptIfNeeded(content: string): string {
  if (!isEncrypted(content)) return content;
  try {
    return decrypt(content);
  } catch {
    // Corrupt ciphertext — preserve the marker so the user knows something
    // exists at that row even if it can't be read.
    return '[decryption failed]';
  }
}

export async function buildExportBundle(userId: string): Promise<ExportBundle> {
  const [
    account,
    screening,
    wellbeing,
    conversations,
    purchases,
    moduleProgress,
    recodeProgress,
    practices,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        locale: true,
        themePref: true,
        tcAcceptedAt: true,
        privacyAcceptedAt: true,
        disclaimerAcknowledgedAt: true,
        screeningResult: true,
        screeningResultAt: true,
        currentTier: true,
        cycleResetAt: true,
        messagesUsedThisCycle: true,
        topUpMessagesRemaining: true,
        lifetimeMessagesUsed: true,
        deletedAt: true,
        deletionScheduledAt: true,
      },
    }),
    prisma.screeningResponse.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.wellbeingSnapshot.findUnique({ where: { userId } }),
    prisma.conversation.findMany({
      where: { userId },
      orderBy: { startedAt: 'asc' },
      include: { messages: { orderBy: { timestamp: 'asc' } } },
    }),
    prisma.purchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        productType: true,
        productId: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    prisma.moduleProgress.findMany({ where: { userId }, orderBy: { startedAt: 'asc' } }),
    prisma.recodeProgress.findUnique({ where: { userId } }),
    prisma.practice.findMany({ where: { userId }, orderBy: { completedAt: 'asc' } }),
  ]);

  // Decrypt message contents in place. The encrypted form is an internal
  // detail; the user gets plaintext in the export.
  const conversationsDecrypted = conversations.map((c) => ({
    ...c,
    messages: c.messages.map((m) => ({ ...m, content: decryptIfNeeded(m.content) })),
  }));

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: '1',
    account: account ?? {},
    screening,
    wellbeing,
    conversations: conversationsDecrypted,
    purchases,
    moduleProgress,
    recodeProgress,
    practices,
  };
}
