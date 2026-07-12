// Pilot invitation redemption landing.
//
// URL shape: /:locale/redeem/:code
//
// Two paths depending on signed-in state:
//
//   Signed OUT:
//     Show a welcome page in the tester's locale.
//     "Create your account to start" button → sets the code cookie and
//     redirects to /sign-up. Post-signup, /home reads the cookie and
//     redeems automatically.
//
//   Signed IN:
//     Immediately redeem (via server action). Show:
//       - success page with the trial end date
//       - link to /journey to start
//       - link to the Before Form (env: PILOT_BEFORE_FORM_URL)
//     Idempotent — if the user already redeemed THIS code, show a
//     "you're already in" state rather than erroring.
//
// Errors (invitation not found, revoked, expired, already claimed by
// someone else) render a friendly locale-aware "sorry" page with a link
// back to /pricing.

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { auth } from '@clerk/nextjs/server';
import { redeemInvitation } from '@/lib/pilot/invitations';
import {
  PILOT_REDEEM_COOKIE,
  PILOT_REDEEM_COOKIE_MAX_AGE,
} from '@/lib/pilot/cookie';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MindReset — pilot invitation',
  robots: { index: false, follow: false },
};

const BEFORE_FORM_URL = process.env.PILOT_BEFORE_FORM_URL ?? '';

export default async function RedeemPage({
  params,
}: {
  params: { locale: string; code: string };
}) {
  const { userId } = await auth();
  const t = await getTranslations({ locale: params.locale, namespace: 'Pilot.redeem' });

  // Signed-out path: stash code, redirect to sign-up. We don't check
  // whether the code exists here — a bad code is caught after signup on
  // the /home consume path, which is more forgiving UX than blocking
  // sign-up on a typo.
  if (!userId) {
    cookies().set({
      name: PILOT_REDEEM_COOKIE,
      value: params.code,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: PILOT_REDEEM_COOKIE_MAX_AGE,
      path: '/',
    });
    // Redirect signed-out users to sign-up. Middleware will keep the
    // locale prefix.
    redirect({ href: '/sign-up', locale: params.locale });
  }

  // Signed-in path: redeem synchronously. Server action lives inline so
  // there's no separate API route to secure.
  const result = await redeemInvitation(params.code, userId!);

  if (result.ok === false) {
    return <RedeemError reason={result.reason} t={t} />;
  }

  const dateStr = new Intl.DateTimeFormat(params.locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(result.trialEndsAt);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-neutral-50">
      <div className="max-w-md w-full">
        <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-3">
          {t('kicker')}
        </div>
        <h1 className="text-[30px] leading-tight mb-4 font-medium">
          {result.alreadyRedeemedByThisUser ? t('alreadyTitle') : t('welcomeTitle')}
        </h1>
        <p className="text-[15px] leading-[1.6] text-neutral-700 mb-6">
          {t('body', { date: dateStr })}
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/journey"
            className="inline-block text-center bg-neutral-900 text-white rounded-full py-3 text-[14px] font-medium"
          >
            {t('startJourneyCta')}
          </Link>
          {BEFORE_FORM_URL && (
            <a
              href={BEFORE_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-center border border-neutral-300 rounded-full py-3 text-[14px] text-neutral-800"
            >
              {t('beforeFormCta')}
            </a>
          )}
        </div>
        <p className="mt-8 text-[12px] text-neutral-500 leading-[1.6]">
          {t('safetyNote')}
        </p>
      </div>
    </main>
  );
}

function RedeemError({
  reason,
  t,
}: {
  reason:
    | 'not_found'
    | 'invitation_expired'
    | 'invitation_revoked'
    | 'already_redeemed_by_other'
    | 'user_already_pilot';
  t: (key: string) => string;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-neutral-50">
      <div className="max-w-md w-full">
        <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-3">
          {t('kicker')}
        </div>
        <h1 className="text-[28px] leading-tight mb-4 font-medium">{t(`error.${reason}.title`)}</h1>
        <p className="text-[15px] leading-[1.6] text-neutral-700 mb-6">
          {t(`error.${reason}.body`)}
        </p>
        <Link
          href="/pricing"
          className="inline-block text-center bg-neutral-900 text-white rounded-full py-3 px-6 text-[14px] font-medium"
        >
          {t('error.backCta')}
        </Link>
      </div>
    </main>
  );
}
