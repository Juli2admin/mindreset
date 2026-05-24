import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { AnswerSchema, classify } from '@/lib/screening/classify';
import { checkScreeningRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const rateLimitResult = await checkScreeningRateLimit(ip);
  if (rateLimitResult.limited) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimitResult.retryAfter) },
      },
    );
  }

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
    // Auth-aware linkage: if the request is from a signed-in user (re-screening
    // post-signup), write userId directly AND denormalise the result into User.
    // This closes the orphan-row gap where authed re-screening would create a
    // userId=null row that the account-page cookie linkage never picks up.
    // Wrapped in try so a Clerk auth() failure doesn't crash the whole handler.
    let userId: string | null = null;
    try {
      const authResult = await auth();
      userId = authResult.userId;
    } catch (authErr) {
      console.error('[screening] auth() failed — continuing with userId=null:', authErr);
    }

    const screening = await prisma.screeningResponse.create({
      data: {
        userId: userId ?? null,
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

    if (userId) {
      // Denormalise the latest result onto the User row so the chat API
      // and /minimind page gates see it immediately. Awaited (not fire-
      // and-forget) so a failure here can't leave the user with a saved
      // ScreeningResponse but a null User.screeningResult that loops them
      // back to /screening on the next visit.
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            screeningResult: result,
            screeningResultAt: screening.createdAt,
          },
        });
      } catch (err) {
        console.error('[screening] user denorm update failed:', err);
        // ScreeningResponse is already written; account-page cookie linkage
        // will pick it up on next /account visit if the denorm stays missing.
      }
    }

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
