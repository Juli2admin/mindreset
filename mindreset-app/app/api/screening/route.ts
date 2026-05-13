import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AnswerSchema, classify } from '@/lib/screening/classify';

export const dynamic = 'force-dynamic';

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

    return NextResponse.json({
      success: true,
      result,
      reasonSummary,
      classifierVer,
      screeningId: screening.id,
    });
  } catch (error) {
    console.error('[screening] DB write failed:', error);
    return NextResponse.json(
      { error: 'Could not save screening, please try again' },
      { status: 500 },
    );
  }
}
