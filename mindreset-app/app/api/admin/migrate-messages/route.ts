// One-time backfill: encrypts all plaintext Message.content rows.
//
// DELETE THIS FILE after the migration has run successfully.
//
// Usage:
//   curl -X POST https://<your-production-url>/api/admin/migrate-messages \
//     -H "Authorization: Bearer $CRON_SECRET"
//
// The endpoint processes rows in batches of BATCH_SIZE to avoid timeouts.
// Call repeatedly until response contains { done: true }.
// Safe to call multiple times — rows that already start with "enc:v1:" are skipped.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encrypt, isEncrypted, safeEqual } from '@/lib/encrypt';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_SIZE = 200;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  if (!safeEqual(authHeader, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch a batch of unencrypted messages (those that do NOT start with enc:v1:).
  // Prisma doesn't support NOT startsWith natively, so we use raw SQL for the filter
  // and Prisma for the update.
  const rows = await prisma.$queryRaw<Array<{ id: string; content: string }>>`
    SELECT id, content
    FROM "Message"
    WHERE content NOT LIKE 'enc:v1:%'
    LIMIT ${BATCH_SIZE}
  `;

  if (rows.length === 0) {
    console.log('[migrate-messages] all messages encrypted — migration complete');
    return NextResponse.json({ done: true, encrypted: 0 });
  }

  let encrypted = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (isEncrypted(row.content)) continue; // double-check in JS
    try {
      await prisma.message.update({
        where: { id: row.id },
        data: { content: encrypt(row.content) },
      });
      encrypted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${row.id}: ${msg}`);
      console.error('[migrate-messages] failed to encrypt row', row.id, msg);
    }
  }

  console.log(`[migrate-messages] batch complete — encrypted: ${encrypted}, errors: ${errors.length}`);
  return NextResponse.json({
    done: false,
    encrypted,
    errors: errors.length > 0 ? errors : undefined,
    message: `Encrypted ${encrypted} rows. Call again to continue.`,
  });
}
