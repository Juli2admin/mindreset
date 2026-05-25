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

  // Auth check — wrapped so a Clerk failure never crashes the save.
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (authErr) {
    console.error('[screening] auth() failed — continuing as anonymous:', authErr);
  }

  try {
    // Always create as anonymous (userId: null). This avoids a FK violation
    // when the Clerk webhook hasn't yet created the User row (common for new
    // sign-ups who reach /screening within seconds of account creation).
    // The /minimind page and /account page both run cookie-based linkage that
    // promotes the row to a named userId once the User row exists.
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

    // For signed-in users: also write screeningResult directly onto the User
    // row so the /minimind gate sees it immediately (avoids the cookie-linkage
    // round-trip). Uses updateMany so it's a no-op if the User row doesn't
    // exist yet — the cookie-based linkage on /minimind / /account will cover
    // that case once the webhook fires.
    if (userId) {
      try {
        await prisma.user.updateMany({
          where: { id: userId },
          data: {
            screeningResult: result,
            screeningResultAt: screening.createdAt,
          },
        });
      } catch (err) {
        console.error('[screening] user denorm updateMany failed:', err);
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
