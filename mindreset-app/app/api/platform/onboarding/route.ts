// Platform onboarding write endpoint — Step 2 (2026-07-20).
//
// POST { answers: { why?, area?, style?, goal? } }  — partial save; the
//   profile module merges without clobbering earlier answers and stamps
//   onboardingCompletedAt once all four are present.
// POST { skip: true }                               — set-once skip stamp.
//
// Codes are validated in lib/platform/profile.ts against the canonical
// vocabularies; unknown codes → 400. The user is the author of these
// fields — this endpoint is the only writer, and it writes nothing else.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  saveOnboarding,
  markOnboardingSkipped,
} from '@/lib/platform/profile';
import type { OnboardingAnswers } from '@/lib/platform/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { answers?: OnboardingAnswers; skip?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    if (body.skip === true) {
      await markOnboardingSkipped(userId);
      return NextResponse.json({ ok: true });
    }
    if (body.answers && typeof body.answers === 'object') {
      await saveOnboarding(userId, {
        why: body.answers.why,
        area: body.answers.area,
        style: body.answers.style,
        goal: body.answers.goal,
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
  } catch (err) {
    // saveOnboarding throws on unknown codes — a client bug or tampering,
    // never a user mistake (the UI only offers canonical buttons).
    const message = err instanceof Error ? err.message : 'Bad request';
    if (message.includes('unknown')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[platform/onboarding] save failed', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
