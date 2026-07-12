// Pilot invitation redemption landing.
//
// Middleware handles the signed-out branch (stashes code in mr_pilot_code
// cookie, redirects to /sign-up). This page component only runs for
// signed-in users — it redeems synchronously and renders the outcome.
//
// Kept very defensive: any throw becomes a friendly fallback rather than
// a 500, and every branch logs so we can trace via Vercel Function Logs
// if something misbehaves.

import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redeemInvitation, type RedeemResult } from '@/lib/pilot/invitations';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MindReset — pilot invitation',
  robots: { index: false, follow: false },
};

const BEFORE_FORM_URL = process.env.PILOT_BEFORE_FORM_URL ?? '';

type Copy = {
  kicker: string;
  welcomeTitle: string;
  alreadyTitle: string;
  bodyPrefix: string;
  bodySuffix: string;
  startJourneyCta: string;
  beforeFormCta: string;
  safetyNote: string;
  backCta: string;
  errorTitle: string;
  errorGeneric: string;
  errors: Record<string, { title: string; body: string }>;
};

// Small inline dictionary. Keeps this page free of getTranslations() so
// missing keys / setRequestLocale ordering can't crash the render. Only
// EN + RU are hand-curated; the 6 placeholder locales fall through to EN.
const COPY: Record<string, Copy> = {
  en: {
    kicker: 'MindReset · Pilot',
    welcomeTitle: 'Welcome. Your pilot access is active.',
    alreadyTitle: "You're already in — welcome back.",
    bodyPrefix: 'You have 30 days of full free access to The Journey. Your pilot ends on ',
    bodySuffix:
      ". If you'd like to continue after that, we'll email you a 50% discount for the next 10 months.",
    startJourneyCta: 'Open The Journey →',
    beforeFormCta: 'Fill the short Before form (5 min) →',
    safetyNote:
      "This is a self-help wellbeing tool — not therapy, not a crisis service. If you're in immediate distress, please contact your local emergency service or a national helpline in your country.",
    backCta: 'See plans',
    errorTitle: 'We could not activate this invitation.',
    errorGeneric:
      "Something went wrong on our side. Please email support@mindreset.ai and we'll sort it out.",
    errors: {
      not_found: {
        title: "This invitation code doesn't exist.",
        body: 'Please double-check the link Julia sent you. If it looks right, reply to her email — we will sort it out.',
      },
      invitation_expired: {
        title: 'This invitation has expired.',
        body: 'The pilot window on this code has closed. Reply to Julia and she will issue a fresh one.',
      },
      invitation_revoked: {
        title: 'This invitation was revoked.',
        body: 'This pilot access has been closed. Please reach out to support@mindreset.ai if you think this is a mistake.',
      },
      already_redeemed_by_other: {
        title: 'This invitation has already been claimed.',
        body: 'This code was redeemed by someone else. If you believe this is a mistake, please email support@mindreset.ai.',
      },
      user_already_pilot: {
        title: "You're already in a pilot.",
        body: 'This account already has an active pilot code linked to it. You can go straight to The Journey.',
      },
    },
  },
  ru: {
    kicker: 'MindReset · Пилот',
    welcomeTitle: 'Здравствуйте. Ваш пилотный доступ активирован.',
    alreadyTitle: 'Вы уже с нами — рады вернуть Вас.',
    bodyPrefix: 'У Вас 30 дней полностью бесплатного доступа к Пути. Пилот завершается ',
    bodySuffix:
      '. Если захотите продолжить, мы напишем Вам и дадим скидку 50% на следующие 10 месяцев.',
    startJourneyCta: 'Открыть Путь →',
    beforeFormCta: 'Заполнить короткую форму «До» (5 минут) →',
    safetyNote:
      'Это инструмент самопомощи — не терапия и не кризисная служба. Если Вы сейчас в остром состоянии, пожалуйста, обратитесь в экстренную службу или на национальную линию доверия в Вашей стране.',
    backCta: 'К тарифам',
    errorTitle: 'Не удалось активировать это приглашение.',
    errorGeneric:
      'Что-то пошло не так с нашей стороны. Пожалуйста, напишите на support@mindreset.ai — мы разберёмся.',
    errors: {
      not_found: {
        title: 'Такой код приглашения не найден.',
        body: 'Пожалуйста, проверьте ссылку, которую прислала Юлия. Если всё верно — ответьте на её письмо, разберёмся.',
      },
      invitation_expired: {
        title: 'Срок действия приглашения истёк.',
        body: 'Окно этого пилота закрыто. Напишите Юлии — она выдаст новый код.',
      },
      invitation_revoked: {
        title: 'Приглашение было отозвано.',
        body: 'Этот пилотный доступ закрыт. Напишите на support@mindreset.ai, если считаете, что это ошибка.',
      },
      already_redeemed_by_other: {
        title: 'Приглашение уже использовано.',
        body: 'Этот код активировал кто-то другой. Если считаете, что это ошибка, напишите на support@mindreset.ai.',
      },
      user_already_pilot: {
        title: 'У Вас уже есть активный пилот.',
        body: 'К этому аккаунту уже привязан пилотный код. Можно сразу перейти к Пути.',
      },
    },
  },
};

function copyFor(locale: string): Copy {
  return COPY[locale === 'ru' ? 'ru' : 'en'];
}

function formatDate(locale: string, date: Date): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export default async function RedeemPage({
  params,
}: {
  params: { locale: string; code: string };
}) {
  const copy = copyFor(params.locale);
  const journeyHref = params.locale === 'en' ? '/journey' : `/${params.locale}/journey`;
  const pricingHref = params.locale === 'en' ? '/pricing' : `/${params.locale}/pricing`;

  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId ?? null;
  } catch (err) {
    console.error('[redeem] auth() threw:', err);
  }

  if (!userId) {
    // Middleware should have redirected; if we got here signed-out, show the not_found.
    return <ErrorView copy={copy} reasonKey="not_found" pricingHref={pricingHref} />;
  }

  let result: RedeemResult | null = null;
  try {
    result = await redeemInvitation(params.code, userId);
  } catch (err) {
    console.error('[redeem] redeemInvitation threw:', {
      code: params.code,
      userId,
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return <GenericErrorView copy={copy} pricingHref={pricingHref} />;
  }

  if (!result) {
    return <GenericErrorView copy={copy} pricingHref={pricingHref} />;
  }

  if (result.ok === false) {
    return <ErrorView copy={copy} reasonKey={result.reason} pricingHref={pricingHref} />;
  }

  const dateStr = formatDate(params.locale, result.trialEndsAt);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-neutral-50">
      <div className="max-w-md w-full">
        <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-3">
          {copy.kicker}
        </div>
        <h1 className="text-[30px] leading-tight mb-4 font-medium">
          {result.alreadyRedeemedByThisUser ? copy.alreadyTitle : copy.welcomeTitle}
        </h1>
        <p className="text-[15px] leading-[1.6] text-neutral-700 mb-6">
          {copy.bodyPrefix}
          <strong>{dateStr}</strong>
          {copy.bodySuffix}
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href={journeyHref}
            className="inline-block text-center bg-neutral-900 text-white rounded-full py-3 text-[14px] font-medium"
          >
            {copy.startJourneyCta}
          </Link>
          {BEFORE_FORM_URL && (
            <a
              href={BEFORE_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-center border border-neutral-300 rounded-full py-3 text-[14px] text-neutral-800"
            >
              {copy.beforeFormCta}
            </a>
          )}
        </div>
        <p className="mt-8 text-[12px] text-neutral-500 leading-[1.6]">{copy.safetyNote}</p>
      </div>
    </main>
  );
}

function ErrorView({
  copy,
  reasonKey,
  pricingHref,
}: {
  copy: Copy;
  reasonKey: string;
  pricingHref: string;
}) {
  const err = copy.errors[reasonKey] ?? { title: copy.errorTitle, body: copy.errorGeneric };
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-neutral-50">
      <div className="max-w-md w-full">
        <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-3">
          {copy.kicker}
        </div>
        <h1 className="text-[28px] leading-tight mb-4 font-medium">{err.title}</h1>
        <p className="text-[15px] leading-[1.6] text-neutral-700 mb-6">{err.body}</p>
        <Link
          href={pricingHref}
          className="inline-block text-center bg-neutral-900 text-white rounded-full py-3 px-6 text-[14px] font-medium"
        >
          {copy.backCta}
        </Link>
      </div>
    </main>
  );
}

function GenericErrorView({ copy, pricingHref }: { copy: Copy; pricingHref: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-neutral-50">
      <div className="max-w-md w-full">
        <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-3">
          {copy.kicker}
        </div>
        <h1 className="text-[28px] leading-tight mb-4 font-medium">{copy.errorTitle}</h1>
        <p className="text-[15px] leading-[1.6] text-neutral-700 mb-6">{copy.errorGeneric}</p>
        <Link
          href={pricingHref}
          className="inline-block text-center bg-neutral-900 text-white rounded-full py-3 px-6 text-[14px] font-medium"
        >
          {copy.backCta}
        </Link>
      </div>
    </main>
  );
}
