// Platform onboarding — Step 2 (2026-07-20).
//
// The owner's 4-step account-page questionnaire: why / area / style /
// goal, button codes only, under a minute, skippable on every step.
// Answers personalise each product's opening conversation (consumed in
// build step 3); nothing here is assessment. /home routes users here
// once (neither completed nor skipped); revisiting later shows current
// answers preselected and lets the user change them — the edit surface
// promised by the footer note.

import type { Metadata } from 'next';
import { currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { redirect } from '@/i18n/navigation';
import OnboardingClient from './OnboardingClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Getting started',
  robots: { index: false, follow: false },
};

export default async function OnboardingPage({
  params,
}: {
  params: { locale: string };
}) {
  const user = await currentUser();
  if (!user) {
    redirect({ href: '/sign-in', locale: params.locale });
  }

  const snapshot = await prisma.wellbeingSnapshot.findUnique({
    where: { userId: user.id },
    select: {
      onboardingWhy: true,
      onboardingArea: true,
      onboardingStyle: true,
      onboardingGoal: true,
    },
  });

  return (
    <OnboardingClient
      initialAnswers={{
        why: snapshot?.onboardingWhy ?? null,
        area: snapshot?.onboardingArea ?? null,
        style: snapshot?.onboardingStyle ?? null,
        goal: snapshot?.onboardingGoal ?? null,
      }}
    />
  );
}
