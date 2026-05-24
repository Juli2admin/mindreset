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

  // Auth-aware linkage: if the request is from a signed-in user (re-screening
  // post-signup), write userId directly AND denormalise the result into User.
  // This closes the orphan-row gap where authed re-screening would create a
  // userId=null row that the account-page cookie linkage never picks up.
  const { userId } = await auth();

  try {
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
      // and /minimind page gates see it immediately. Fire-and-forget — the
      // screening row is the source of truth; the User denorm is best-
      // effort. Account-page linkage covers the cold path.
      prisma.user
        .update({
          where: { id: userId },
          data: {
            screeningResult: result,
            screeningResultAt: screening.createdAt,
          },
        })
        .catch((err) =>
          console.error('[screening] user denorm update failed:', err),
        );
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
