// Pilot questionnaire submission endpoint.
//
// PR ω3a (2026-07-14). POST { formType, ...scales, answers } — validates
// via Zod, persists to TesterResponse, stamps the matching
// PilotInvitation.*FormFilled + *FormFilledAt fields.
//
// Auth: requires an active pilot invitation for the caller. Guarantees
// one row per (invitationId, formType) via TesterResponse's unique
// constraint — re-submits are UPSERTs (the tester's latest answers win,
// which matches how a paper form is edited before it's handed in).

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { questionnaireSubmitSchema } from '@/lib/pilot/questionnaire-schema';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const parsed = questionnaireSubmitSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // The caller must have redeemed a pilot invitation. We resolve the
  // invitation via User.pilotInvitationId (the redemption sets that
  // 1:1 link). Non-pilot users are rejected — this endpoint is not a
  // general survey collector.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pilotInvitationId: true },
  });
  if (!user?.pilotInvitationId) {
    return NextResponse.json(
      { error: 'No active pilot invitation' },
      { status: 403 },
    );
  }
  const invitationId = user.pilotInvitationId;

  const now = new Date();

  try {
    await prisma.$transaction([
      prisma.testerResponse.upsert({
        where: {
          invitationId_formType: { invitationId, formType: data.formType },
        },
        update: {
          scaleUnderstand: data.scaleUnderstand,
          scaleNotice: data.scaleNotice,
          scaleChoose: data.scaleChoose,
          scaleHardOnSelf: data.scaleHardOnSelf,
          scaleAffectsLife: data.scaleAffectsLife,
          scaleStuck: data.scaleStuck,
          answers: data.answers,
          submittedAt: now,
        },
        create: {
          invitationId,
          formType: data.formType,
          scaleUnderstand: data.scaleUnderstand,
          scaleNotice: data.scaleNotice,
          scaleChoose: data.scaleChoose,
          scaleHardOnSelf: data.scaleHardOnSelf,
          scaleAffectsLife: data.scaleAffectsLife,
          scaleStuck: data.scaleStuck,
          answers: data.answers,
        },
      }),
      prisma.pilotInvitation.update({
        where: { id: invitationId },
        data:
          data.formType === 'before'
            ? { beforeFormFilled: true, beforeFormFilledAt: now }
            : { afterFormFilled: true, afterFormFilledAt: now },
      }),
    ]);
  } catch (err) {
    console.error('[pilot/questionnaire] persist failed', err);
    return NextResponse.json(
      { error: 'Failed to save response' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
