'use client';

import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';

// Phase i18n.1d.2 — extracted from Landing's inline Footer (crisis-
// resource block at lines 752-774 + safety-disclaimer prose at lines
// 776-778). Lives as a Landing-only section component rendered ABOVE
// the shared Footer.
//
// Lang prop pattern preserved per Phase 1d scoping decision — Phase 2
// migrates these strings to message bundles. Today the strings live in
// two places (Landing.jsx COPY for Hero/WhatIs/etc., here for crisis +
// disclaimer) — temporarily duplicated until Phase 2 unifies both into
// next-intl message bundles in one pass.
//
// Locale normalization: Landing.jsx narrows useLocale() to 'en' | 'ru'
// before passing here, so the COPY lookup is safe.

type Lang = 'en' | 'ru';

type CrisisItem = { name: string; detail: string };

const COPY: Record<Lang, {
  crisisLabel: string;
  crisisItems: CrisisItem[];
  disclaimer: string;
}> = {
  en: {
    crisisLabel: 'Need help right now?',
    crisisItems: [
      { name: 'Samaritans', detail: 'Call 116 123 — 24/7, free' },
      { name: 'Shout', detail: 'Text SHOUT to 85258 — 24/7' },
      { name: 'NHS 111', detail: 'Mental health crisis line — option 2' },
    ],
    disclaimer:
      'MindReset is a wellbeing tool — not therapy, not a medical device, and not a substitute for professional care. If you are in immediate danger, please use one of the lines above or call 999.',
  },
  ru: {
    crisisLabel: 'Сейчас нужна помощь?',
    crisisItems: [
      { name: 'Samaritans', detail: 'Позвоните 116 123 — 24/7, бесплатно' },
      { name: 'Shout', detail: 'Отправьте SHOUT на 85258 — 24/7' },
      { name: 'NHS 111', detail: 'Линия психологической помощи — вариант 2' },
    ],
    disclaimer:
      'MindReset — это инструмент поддержки благополучия, а не терапия, не медицинское устройство и не замена профессиональной помощи. Если вам угрожает непосредственная опасность, воспользуйтесь одной из линий выше или позвоните 999.',
  },
};

type Props = {
  lang: Lang;
  theme?: 'day' | 'night';
};

export default function CrisisResources({ lang, theme = 'day' }: Props) {
  const t = COPY[lang];
  const PALETTE = FULL_PALETTE[theme];
  return (
    <section
      className="mt-24 pt-10"
      style={{ borderTop: `1px solid ${PALETTE.border}` }}
      aria-label={t.crisisLabel}
    >
      <div
        className="mb-8 rounded-xl p-6"
        style={{
          background: PALETTE.bgSubtle,
          border: `1px solid ${PALETTE.border}`,
        }}
      >
        <div
          className="text-[11px] uppercase tracking-[0.18em] mb-4"
          style={{
            color: PALETTE.danger,
            fontWeight: 500,
            fontFamily: TOKENS.sans,
          }}
        >
          {t.crisisLabel}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {t.crisisItems.map((item) => (
            <div key={item.name}>
              <div
                className="text-[15px] mb-0.5"
                style={{
                  color: PALETTE.text,
                  fontWeight: 500,
                  fontFamily: TOKENS.serif,
                }}
              >
                {item.name}
              </div>
              <div
                className="text-[13px]"
                style={{ color: PALETTE.textMuted, fontFamily: TOKENS.sans }}
              >
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p
        className="text-[13px] leading-[1.7] max-w-[42rem]"
        style={{ color: PALETTE.textHint, fontFamily: TOKENS.sans }}
      >
        {t.disclaimer}
      </p>
    </section>
  );
}
