import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { routing } from '@/i18n/routing';
import { MAX_STORY_LENGTH } from '@/lib/testimonials/queries';

export const dynamic = 'force-dynamic';

const ALLOWED_AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;
const MAX_PUBLIC_NAME = 40;

// Public submission endpoint — auth optional. Signed-out submissions are
// allowed (userId stored as null) so prospects who haven't signed up can
// still share. Status starts as 'pending'; Julia approves via Supabase.
export async function POST(request: NextRequest) {
  const { userId } = await auth();

  let body: {
    publicName?: string;
    ageRange?: string;
    story?: string;
    locale?: string;
    consent?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const publicName = (body.publicName ?? '').trim();
  const story = (body.story ?? '').trim();
  const locale = body.locale ?? 'en';
  const ageRange = body.ageRange?.trim() || null;
  const consent = body.consent === true;

  if (!publicName || publicName.length > MAX_PUBLIC_NAME) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  if (!story || story.length > MAX_STORY_LENGTH) {
    return NextResponse.json({ error: 'invalid_story' }, { status: 400 });
  }
  if (!(routing.locales as readonly string[]).includes(locale)) {
    return NextResponse.json({ error: 'invalid_locale' }, { status: 400 });
  }
  if (ageRange && !ALLOWED_AGE_RANGES.includes(ageRange as (typeof ALLOWED_AGE_RANGES)[number])) {
    return NextResponse.json({ error: 'invalid_age' }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  }

  try {
    await prisma.testimonial.create({
      data: {
        userId: userId ?? null,
        publicName,
        ageRange,
        story,
        locale,
        consent,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[testimonials/submit] failed', err);
    return NextResponse.json({ error: 'submit_failed' }, { status: 500 });
  }
}
