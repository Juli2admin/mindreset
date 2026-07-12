// Locale sync endpoint.
//
// LanguagePicker fires a POST here whenever the user picks a new
// language. Persists to User.locale so downstream surfaces that read
// the DB value (MiniMind memory context, transactional emails, the
// drip cron, and anything else that runs OFF-request) speak to the
// user in the right language.
//
// Before this endpoint, LanguagePicker only wrote a cookie + navigated;
// the DB locale stayed 'en' (webhook default) forever unless the user
// happened to visit /home. So a Russian speaker on /minimind got English
// AI replies until they said "speak Russian".
//
// Fire-and-forget from the client — a network hiccup here shouldn't
// block navigation. Any failure just leaves the DB out-of-sync for one
// pass; the next /home visit will re-sync from URL.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { routing } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

const VALID_LOCALES = new Set<string>(routing.locales);

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const locale = typeof body.locale === 'string' ? body.locale.trim() : '';
  if (!VALID_LOCALES.has(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { locale },
    });
  } catch (err) {
    // P2025 = record not found. Common in the race between Clerk signup
    // and the webhook; we don't want to block the picker for a not-yet-
    // provisioned User row, so we swallow silently — /home will sync
    // shortly.
    const code = (err as { code?: string })?.code;
    if (code !== 'P2025') {
      console.error('[account/locale] update failed:', err);
      return NextResponse.json({ error: 'Failed to save locale' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
