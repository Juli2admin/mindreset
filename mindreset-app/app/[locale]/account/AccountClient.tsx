'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';
// Footer arrives as a server-rendered slot via `footerSlot` — see
// app/account/page.tsx. Phase i18n.0 server-component-with-client-slot
// pattern.

const PALETTE = FULL_PALETTE.day;
const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

type Lang = 'en' | 'ru';

type Tier = {
  title: string;
  subtitle: string;
  description: string;
  price: string;
  href?: string; // when set, the card is an active <Link>; otherwise inert
};

type CopyShape = {
  welcomeKicker: string;
  welcomeTitleWithName: string;
  welcomeTitleNoName: string;
  welcomeBody: string;
  comingSoon: string;
  tierOpen: string;
  tiers: Tier[];
};

const COPY: Record<Lang, CopyShape> = {
  en: {
    welcomeKicker: 'Your account',
    welcomeTitleWithName: 'Welcome, {name}',
    welcomeTitleNoName: 'Welcome',
    welcomeBody: "A quiet place to see where you are, and to choose what's next.",
    comingSoon: 'Coming soon',
    tierOpen: 'Open',
    tiers: [
      {
        title: 'MiniMind',
        subtitle: 'Daily companion',
        description: 'Your daily AI companion for reflection, regulation, and quiet support.',
        price: '£9.99 / month',
        href: '/minimind',
      },
      {
        title: 'States & Themes',
        subtitle: 'Focused modules',
        description: 'Targeted work on four states and five themes.',
        price: '£199 each, or £39 / month',
      },
      {
        title: 'The Journey',
        subtitle: 'Eight-stage reset',
        description: 'The deep eight-block work, paced for safety and depth.',
        price: '£1,200, or 6 × £225',
      },
    ],
  },
  ru: {
    welcomeKicker: 'Ваш аккаунт',
    welcomeTitleWithName: 'Здравствуйте, {name}',
    welcomeTitleNoName: 'Здравствуйте',
    welcomeBody: 'Тихое место, чтобы увидеть, где вы сейчас, и выбрать, что дальше.',
    comingSoon: 'Скоро',
    tierOpen: 'Открыть',
    tiers: [
      {
        title: 'MiniMind',
        subtitle: 'Ежедневный спутник',
        description: 'Ваш ежедневный AI-спутник — для рефлексии, регуляции и тихой поддержки.',
        price: '£9.99 / месяц',
        href: '/minimind',
      },
      {
        title: 'States & Themes',
        subtitle: 'Фокусированные модули',
        description: 'Целевая работа над четырьмя состояниями и пятью темами.',
        price: '£199 за каждый или £39 / месяц',
      },
      {
        title: 'Путь',
        subtitle: 'Восьмиступенчатый перезапуск',
        description: 'Глубокая работа из восьми блоков, в ритме, который бережёт вас.',
        price: '£1,200 или 6 × £225',
      },
    ],
  },
};

type Props = {
  firstName: string | null;
  cookieToClear: boolean;
  footerSlot: ReactNode;
};

export default function AccountClient({ firstName, cookieToClear, footerSlot }: Props) {
  // Lang fixed to 'en' pending i18n-lift; see header for context.
  const [lang] = useState<Lang>('en');
  const t = COPY[lang];

  useEffect(() => {
    if (cookieToClear) {
      document.cookie = 'mr_screening=; Path=/; Max-Age=0; SameSite=Lax';
    }
  }, [cookieToClear]);

  const welcomeTitle = firstName
    ? t.welcomeTitleWithName.replace('{name}', firstName)
    : t.welcomeTitleNoName;

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-2xl mx-auto px-6 py-12 sm:py-16">
        <header className="flex items-center justify-between mb-12">
          <Link href="/" className="block">
            <h1
              className="text-[22px] tracking-tight"
              style={{ fontFamily: SERIF, fontWeight: 400 }}
            >
              <span style={{ color: PALETTE.accent }}>Mind</span>
              <span style={{ color: PALETTE.accentSage }}>Reset</span>
            </h1>
          </Link>
          <div className="flex items-center gap-3">
            {/* Lang toggle hidden pending i18n-lift — RU copy is incomplete on
                this page; re-attach when global LanguageProvider lands. */}
            <UserButton />
          </div>
        </header>

        <div className="mb-12">
          <div
            className="text-[11px] uppercase tracking-[0.22em] mb-3"
            style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
          >
            {t.welcomeKicker}
          </div>
          <h2
            className="text-[32px] leading-[1.15] mb-4"
            style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
          >
            {welcomeTitle}
          </h2>
          <p
            className="text-[16px] leading-[1.65]"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {t.welcomeBody}
          </p>
        </div>

        <div className="space-y-4">
          {t.tiers.map((tier, i) => {
            const inner = (
              <>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <h3
                      className="text-[20px] mb-1"
                      style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
                    >
                      {tier.title}
                    </h3>
                    <p
                      className="text-[13px]"
                      style={{ color: PALETTE.textMuted, fontFamily: SANS }}
                    >
                      {tier.subtitle}
                    </p>
                  </div>
                  {tier.href ? (
                    <span
                      className="text-[10px] uppercase tracking-[0.15em] h-6 px-3 rounded-full inline-flex items-center whitespace-nowrap shrink-0"
                      style={{
                        background: PALETTE.accent,
                        color: PALETTE.accentText,
                        fontFamily: SANS,
                        fontWeight: 500,
                      }}
                    >
                      {t.tierOpen}
                    </span>
                  ) : (
                    <span
                      className="text-[10px] uppercase tracking-[0.15em] h-6 px-3 rounded-full inline-flex items-center whitespace-nowrap shrink-0"
                      style={{
                        background: PALETTE.bgSubtle,
                        color: PALETTE.textHint,
                        border: `1px solid ${PALETTE.border}`,
                        fontFamily: SANS,
                        fontWeight: 500,
                      }}
                    >
                      {t.comingSoon}
                    </span>
                  )}
                </div>
                <p
                  className="text-[15px] mb-4"
                  style={{ color: PALETTE.text, lineHeight: 1.6, fontFamily: SANS }}
                >
                  {tier.description}
                </p>
                <p
                  className="text-[14px]"
                  style={{ color: PALETTE.textMuted, fontWeight: 500, fontFamily: SANS }}
                >
                  {tier.price}
                </p>
              </>
            );

            if (tier.href) {
              return (
                <Link
                  key={i}
                  href={tier.href}
                  className="block rounded-lg p-6 transition-all"
                  style={{
                    background: PALETTE.bgCard,
                    border: `1px solid ${PALETTE.border}`,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = PALETTE.borderStrong)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = PALETTE.border)
                  }
                >
                  {inner}
                </Link>
              );
            }

            return (
              <div
                key={i}
                className="rounded-lg p-6 transition-all"
                style={{
                  background: PALETTE.bgCard,
                  border: `1px solid ${PALETTE.border}`,
                }}
              >
                {inner}
              </div>
            );
          })}
        </div>
        {footerSlot}
      </div>
    </main>
  );
}
