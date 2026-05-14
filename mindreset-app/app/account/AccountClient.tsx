'use client';

import { useEffect, useState } from 'react';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';
import Footer from '@/components/Footer';

const PALETTE = FULL_PALETTE.day;
const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

type Lang = 'en' | 'ru';

type Tier = {
  title: string;
  subtitle: string;
  description: string;
  price: string;
};

type CopyShape = {
  welcomeKicker: string;
  welcomeTitleWithName: string;
  welcomeTitleNoName: string;
  welcomeBody: string;
  ssBannerKicker: string;
  ssBannerTitle: string;
  ssBannerBody: string;
  ssBannerCta: string;
  comingSoon: string;
  tiers: Tier[];
};

const COPY: Record<Lang, CopyShape> = {
  en: {
    welcomeKicker: 'Your account',
    welcomeTitleWithName: 'Welcome, {name}',
    welcomeTitleNoName: 'Welcome',
    welcomeBody: "A quiet place to see where you are, and to choose what's next.",
    ssBannerKicker: 'Before you continue',
    ssBannerTitle: 'Complete your readiness check',
    ssBannerBody:
      'Five short questions help us see whether MindReset is a fit for you right now.',
    ssBannerCta: 'Begin the readiness check',
    comingSoon: 'Coming soon',
    tiers: [
      {
        title: 'MiniMind',
        subtitle: 'Daily companion',
        description: 'Your daily AI companion for reflection, regulation, and quiet support.',
        price: '£9.99 / month',
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
    ssBannerKicker: 'Прежде чем продолжить',
    ssBannerTitle: 'Короткая проверка перед началом',
    ssBannerBody:
      'Пять коротких вопросов — чтобы понять, подходит ли MindReset вам именно сейчас.',
    ssBannerCta: 'Начать',
    comingSoon: 'Скоро',
    tiers: [
      {
        title: 'MiniMind',
        subtitle: 'Ежедневный спутник',
        description: 'Ваш ежедневный AI-спутник — для рефлексии, регуляции и тихой поддержки.',
        price: '£9.99 / месяц',
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
  hasScreening: boolean;
  cookieToClear: boolean;
};

export default function AccountClient({ firstName, hasScreening, cookieToClear }: Props) {
  const [lang, setLang] = useState<Lang>('en');
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
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
              className="text-[11px] uppercase tracking-[0.18em] h-8 px-3 rounded-full transition-colors"
              style={{
                color: PALETTE.textMuted,
                border: `1px solid ${PALETTE.border}`,
                background: 'transparent',
                fontFamily: SANS,
                fontWeight: 500,
              }}
            >
              {lang === 'en' ? 'RU' : 'EN'}
            </button>
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

        {!hasScreening && (
          <div className="pl-6 mb-12" style={{ borderLeft: `2px solid ${PALETTE.accentSage}` }}>
            <div
              className="text-[11px] uppercase tracking-[0.22em] mb-3"
              style={{ color: PALETTE.accentSage, fontWeight: 500, fontFamily: SANS }}
            >
              {t.ssBannerKicker}
            </div>
            <h3
              className="text-[24px] mb-3"
              style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
            >
              {t.ssBannerTitle}
            </h3>
            <p
              className="text-[16px] leading-[1.65] mb-6"
              style={{ color: PALETTE.textMuted, fontFamily: SANS }}
            >
              {t.ssBannerBody}
            </p>
            <Link
              href="/screening"
              className="inline-flex items-center h-12 px-7 rounded-full text-[14px] tracking-wide transition-all"
              style={{
                background: PALETTE.accent,
                color: PALETTE.accentText,
                fontWeight: 500,
                fontFamily: SANS,
              }}
            >
              {t.ssBannerCta}
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {t.tiers.map((tier, i) => (
            <div
              key={i}
              className="rounded-lg p-6 transition-all"
              style={{
                background: PALETTE.bgCard,
                border: `1px solid ${PALETTE.border}`,
              }}
            >
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
            </div>
          ))}
        </div>
        <Footer />
      </div>
    </main>
  );
}
