// Pilot Before form.
//
// PR ω3a (2026-07-14). Server component. Verifies the caller is a pilot
// tester, checks whether they've already submitted (so we can send them
// on to the Journey instead), and hands the client a
// { alreadySubmitted } flag.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { setRequestLocale } from 'next-intl/server';
import prisma from '@/lib/prisma';
import BeforeFormClient from './BeforeFormClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MindReset — pilot: before form',
  robots: { index: false, follow: false },
};

type PageProps = { params: { locale: string } };

export default async function BeforeFormPage({ params }: PageProps) {
  setRequestLocale(params.locale);

  const { userId } = await auth();
  if (!userId) {
    redirect(`/${params.locale}/sign-in`);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pilotInvitationId: true },
  });
  if (!user?.pilotInvitationId) {
    // Not a pilot tester — send them to the pricing page (self-service
    // sign-up rather than showing a confusing empty form).
    redirect(`/${params.locale}/pricing`);
  }

  const invitation = await prisma.pilotInvitation.findUnique({
    where: { id: user.pilotInvitationId },
    select: { beforeFormFilled: true },
  });
  const alreadySubmitted = !!invitation?.beforeFormFilled;

  return (
    <BeforeFormClient
      locale={params.locale}
      alreadySubmitted={alreadySubmitted}
    />
  );
}
