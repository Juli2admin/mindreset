import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { AnswerSchema, classify } from '@/lib/screening/classify';

export const dynamic = 'force-dynamic';

const PREFERRED_NAME_MAX = 50;

const PatchSchema = z.object({
  screeningId: z.string().min(1),
  preferredName: z.string().max(PREFERRED_NAME_MAX),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = AnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid screening answers', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const answers = parsed.data;

  if (answers.trauma === null) {
    return NextResponse.json(
      { error: 'Trauma question must be answered before submission' },
      { status: 400 },
    );
  }

  const { result, reasonSummary, classifierVer } = classify(answers);

  try {
    const screening = await prisma.screeningResponse.create({
      data: {
        userId: null,
        exclusionFlags: answers.exclusion,
        functionalityScores: answers.functionality,
        emotionalScores: answers.emotional,
        traumaLevel: answers.trauma,
        cognitiveAnswers: answers.cognitive,
        consentItems: answers.consent,
        result,
        reasonSummary,
        classifierVer,
      },
    });

    const response = NextResponse.json({
      success: true,
      result,
      reasonSummary,
      classifierVer,
      screeningId: screening.id,
    });
    response.cookies.set('mr_screening', screening.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  } catch (error) {
    console.error('[screening] DB write failed:', error);
    return NextResponse.json(
      { error: 'Could not save screening, please try again' },
      { status: 500 },
    );
  }
}

// PATCH — update the preferredName on a still-unclaimed ScreeningResponse.
// Called from the screening result screen (step 6) after the user has seen
// their GREEN/YELLOW result and (optionally) typed a preferred name into
// the input above the sign-up CTA.
//
// SECURITY:
//   1. The body's screeningId must equal the caller's mr_screening cookie
//      value. Prevents trivial spoofing where an attacker who guesses or
//      scrapes a screeningId could write a preferredName onto it.
//   2. The screening row must still be unclaimed (userId IS NULL). Once
//      Clerk sign-up has linked the row to a User, this endpoint becomes
//      a no-op — any preferredName edits from that point belong to the
//      future account-settings page, not this anonymous PATCH route.
//
// This endpoint is therefore effectively decommissioned for the user the
// moment they complete sign-up. It exists only for the brief window
// between screening submission and Clerk sign-up completion.
export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { screeningId, preferredName } = parsed.data;
  const trimmed = preferredName.trim();
  const valueToWrite = trimmed.length > 0 ? trimmed : null;

  // Cookie-bound: caller must hold the cookie that was set when this
  // screening was created.
  const cookieValue = request.cookies.get('mr_screening')?.value;
  if (!cookieValue || cookieValue !== screeningId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    // Additionally require the screening to be unclaimed (userId == null).
    const updated = await prisma.screeningResponse.updateMany({
      where: { id: screeningId, userId: null },
      data: { preferredName: valueToWrite },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[screening] PATCH preferredName failed:', err);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }
}
