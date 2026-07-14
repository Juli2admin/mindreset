// Pilot After form.
//
// PR ω3b (2026-07-14). Server component. Verifies the caller is a pilot
// tester, checks eligibility (Before form filled first — otherwise the
// After doesn't compare against anything), and whether the After has
// already been submitted.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { setRequestLocale } from 'next-intl/server';
import prisma from '@/lib/prisma';
import AfterFormClient from './AfterFormClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MindReset — pilot: after form',
  robots: { index: false, follow: false },
};

type PageProps = { params: { locale: string } };

export default async function AfterFormPage({ params }: PageProps) {
  setRequestLocale(params.locale);

  const { userId } = await auth();
  if (!userId) redirect(`/${params.locale}/sign-in`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pilotInvitationId: true },
  });
  if (!user?.pilotInvitationId) redirect(`/${params.locale}/pricing`);

  const invitation = await prisma.pilotInvitation.findUnique({
    where: { id: user.pilotInvitationId },
    select: {
      beforeFormFilled: true,
      afterFormFilled: true,
    },
  });

  const beforeMissing = !invitation?.beforeFormFilled;
  const alreadySubmitted = !!invitation?.afterFormFilled;

  return (
    <AfterFormClient
      locale={params.locale}
      beforeMissing={beforeMissing}
      alreadySubmitted={alreadySubmitted}
    />
  );
}
