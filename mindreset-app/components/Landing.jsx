'use client';

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useTranslations } from 'next-intl';
import { PALETTE, sansStyle, serifStyle } from '@/lib/brand/colors';
import { useUser } from '@clerk/nextjs';
// Phase i18n.1a/1b — locale-aware router for the "Begin" CTA.
import { Link, useRouter } from '@/i18n/navigation';
// Phase i18n.1d.2 — shared TopBar (client) + CrisisResources (client).
// The shared Footer is a server-async component and can't render
// inline inside this client component (Footer uses getTranslations).
// LandingPage receives Footer as a slot prop from [locale]/page.tsx
// — same pattern Account and Sign-up use for their server-rendered
// Footer.
import TopBar from '@/components/TopBar';
import CrisisResources from '@/components/CrisisResources';

// ============================================================================
// MindReset.ai — Landing Page
// Hero is typographic + TreeMark glyph in header only.
// Content takes good ideas from Julia's reference landing example.
// ============================================================================

const FONT_LINK_ID = 'mindreset-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=Geist:wght@400;500&display=swap';

const ThemeContext = createContext({ theme: 'day', c: PALETTE.day, toggle: () => {} });
const useTheme = () => useContext(ThemeContext);

// ============================================================================
// Icons
// ============================================================================
function TreeMark({ size = 26 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 11 V21" strokeWidth="1.4" />
      <path d="M16 11 Q15 6 13 2" strokeWidth="1" />
      <path d="M16 11 Q17 6 19 2" strokeWidth="1" />
      <path d="M16 12 Q11 9 7 5" strokeWidth="1" />
      <path d="M16 12 Q21 9 25 5" strokeWidth="1" />
      <path d="M16 13 Q9 13 4 11" strokeWidth="1" />
      <path d="M16 13 Q23 13 28 11" strokeWidth="1" />
      <path d="M16 21 Q15 26 13 30" strokeWidth="1" />
      <path d="M16 21 Q17 26 19 30" strokeWidth="1" />
      <path d="M16 20 Q11 23 7 27" strokeWidth="1" />
      <path d="M16 20 Q21 23 25 27" strokeWidth="1" />
      <path d="M16 19 Q9 19 4 21" strokeWidth="1" />
      <path d="M16 19 Q23 19 28 21" strokeWidth="1" />
    </svg>
  );
}

function SunIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ArrowRight({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8H13M9 4L13 8L9 12" />
    </svg>
  );
}

// ============================================================================
// Controls
// ============================================================================
function ThemeToggle() {
  const { theme, toggle, c } = useTheme();
  const Icon = theme === 'day' ? MoonIcon : SunIcon;
  return (
    <button
      onClick={toggle}
      className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
      style={{ color: c.textMuted, border: `1px solid ${c.border}` }}
      aria-label={theme === 'day' ? 'Switch to night mode' : 'Switch to day mode'}
    >
      <Icon size={14} />
    </button>
  );
}

// Phase 1d.2 — replaced inline Header (with legacy LangSwitch + inline
// wordmark) with shared TopBar. The right slot composes the Account/
// Sign-in Link (depends on Clerk's useUser hook — client-state-derived)
// plus the ThemeToggle (depends on Landing's ThemeContext). TopBar is
// a client component so this composition works inline.
function Header() {
  const { c, theme } = useTheme();
  const t = useTranslations('Landing');
  const { isLoaded, isSignedIn } = useUser();
  const signedIn = isLoaded && isSignedIn;
  return (
    <TopBar
      showTreeMark
      theme={theme}
      right={
        <>
          <Link
            href={signedIn ? '/account' : '/sign-in'}
            className="text-[13px] transition-colors hover:underline underline-offset-2"
            style={{ ...sansStyle, color: c.textMuted }}
          >
            {signedIn ? t('account') : t('signIn')}
          </Link>
          <ThemeToggle />
        </>
      }
    />
  );
}


// ============================================================================
// Shared section helpers
// ============================================================================
function SectionKicker({ text, color }) {
  return (
    <div
      className="text-[11px] uppercase tracking-[0.22em] mb-5"
      style={{ ...sansStyle, color, fontWeight: 500 }}
    >
      {text}
    </div>
  );
}

function SectionTitle({ text, large = false }) {
  const { c } = useTheme();
  return (
    <h2
      className={`${large ? 'text-[44px] sm:text-[56px]' : 'text-[36px] sm:text-[44px]'} leading-[1.05] -tracking-[0.018em] whitespace-pre-line max-w-[28rem]`}
      style={{ ...serifStyle, color: c.text, fontWeight: 400 }}
    >
      {text}
    </h2>
  );
}

// ============================================================================
// Sections
// ============================================================================
function Hero({ onBegin }) {
  const { c } = useTheme();
  const t = useTranslations('Landing');
  const heroBody = t.raw('heroBody');
  return (
    <section className="pt-12 pb-24 text-center">
      <div
        className="text-[11px] uppercase tracking-[0.22em] mb-8"
        style={{ ...sansStyle, color: c.accent, fontWeight: 500 }}
      >
        {t('heroKicker')}
      </div>

      <h1
        className="text-[60px] sm:text-[76px] leading-[0.98] mb-12 -tracking-[0.025em] whitespace-pre-line"
        style={{ ...serifStyle, color: c.text, fontWeight: 400 }}
      >
        {t('heroTitle')}
      </h1>

      <div className="max-w-[36rem] mx-auto space-y-5 mb-12">
        {heroBody.map((para, i) => (
          <p key={i} className="text-[17px] leading-[1.65]" style={{ ...sansStyle, color: c.textMuted }}>
            {para}
          </p>
        ))}
      </div>

      <button
        onClick={onBegin}
        className="inline-flex items-center gap-2.5 h-14 px-10 rounded-full text-[15px] tracking-wide transition-all"
        style={{
          ...sansStyle,
          fontWeight: 500,
          background: c.accent,
          color: c.accentText,
        }}
      >
        {t('heroCta')}
        <ArrowRight size={14} />
      </button>

      <div className="text-[12px] mt-5" style={{ ...sansStyle, color: c.textHint }}>
        {t('heroNote')}
      </div>
    </section>
  );
}

function WhatIs() {
  const { c } = useTheme();
  const t = useTranslations('Landing');
  const whatNot = t.raw('whatNot');
  const whatHelpsItems = t.raw('whatHelpsItems');
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t('whatKicker')} color={c.accent} />
      <SectionTitle text={t('whatTitle')} />

      <p className="text-[17px] leading-[1.65] mt-8 mb-12 max-w-[36rem]" style={{ ...sansStyle, color: c.textMuted }}>
        {t('whatLead')}
      </p>

      {/* "Not therapy. Not coaching. Not a crisis service." */}
      <div className="space-y-3 mb-14">
        {whatNot.map((word, i) => (
          <div
            key={i}
            className="text-[32px] sm:text-[40px] leading-[1.1] -tracking-[0.01em]"
            style={serifStyle}
          >
            <span style={{ color: c.textHint, fontWeight: 300 }}>{t('notWord')} </span>
            <span style={{ color: c.text, fontWeight: 400 }}>{word}.</span>
          </div>
        ))}
      </div>

      <div
        className="text-[11px] uppercase tracking-[0.18em] mb-5"
        style={{ ...sansStyle, color: c.textHint, fontWeight: 500 }}
      >
        {t('whatHelpsLead')}
      </div>
      <ul className="space-y-3">
        {whatHelpsItems.map((item, i) => (
          <li key={i} className="flex gap-4">
            <span className="text-[14px] tabular-nums mt-1" style={{ ...serifStyle, color: c.textHint }}>
              0{i + 1}
            </span>
            <span className="text-[16px] leading-[1.6] flex-1" style={{ ...sansStyle, color: c.text }}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WhoFor() {
  const { c } = useTheme();
  const t = useTranslations('Landing');
  const whoScenarios = t.raw('whoScenarios');
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t('whoKicker')} color={c.accentSage} />
      <SectionTitle text={t('whoTitle')} />

      <p
        className="text-[15px] uppercase tracking-[0.04em] mt-10 mb-6"
        style={{ ...sansStyle, color: c.textMuted }}
      >
        {t('whoLead')}
      </p>

      <ul className="space-y-5 mb-12">
        {whoScenarios.map((item, i) => (
          <li
            key={i}
            className="flex gap-4 pb-5"
            style={{ borderBottom: i === whoScenarios.length - 1 ? 'none' : `1px solid ${c.border}` }}
          >
            <span className="text-[14px] tabular-nums mt-1" style={{ ...serifStyle, color: c.textHint }}>
              0{i + 1}
            </span>
            <span className="text-[16px] leading-[1.6] flex-1" style={{ ...sansStyle, color: c.text }}>
              {item}
            </span>
          </li>
        ))}
      </ul>

      <p
        className="text-[22px] leading-[1.4] italic max-w-[34rem]"
        style={{ ...serifStyle, color: c.accent, fontWeight: 400 }}
      >
        {t('whoClose')}
      </p>
    </section>
  );
}

function Safety() {
  const { c } = useTheme();
  const t = useTranslations('Landing');
  const safetyItems = t.raw('safetyItems');
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t('safetyKicker')} color={c.accent} />
      <SectionTitle text={t('safetyTitle')} />

      <p className="text-[17px] leading-[1.65] mt-8 mb-10 max-w-[36rem]" style={{ ...sansStyle, color: c.textMuted }}>
        {t('safetyLead')}
      </p>

      <div className="space-y-5">
        {safetyItems.map((item, i) => (
          <p
            key={i}
            className="text-[16px] leading-[1.6] pb-5"
            style={{
              ...sansStyle,
              color: c.text,
              borderBottom: i === safetyItems.length - 1 ? 'none' : `1px solid ${c.border}`,
            }}
          >
            {item}
          </p>
        ))}
      </div>
    </section>
  );
}

function PathsSection() {
  const { c } = useTheme();
  const t = useTranslations('Landing');
  const paths = t.raw('paths');
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <div className="mb-16">
        <SectionKicker text={t('pathsKicker')} color={c.accentSage} />
        <SectionTitle text={t('pathsTitle')} />
      </div>

      <div className="space-y-12">
        {paths.map((p, i) => (
          <div
            key={p.name}
            className="grid grid-cols-1 sm:grid-cols-12 gap-6 pb-12 last:pb-0"
            style={{ borderBottom: i === paths.length - 1 ? 'none' : `1px solid ${c.border}` }}
          >
            <div className="sm:col-span-4">
              <div
                className="text-[11px] uppercase tracking-[0.18em] mb-2"
                style={{ ...sansStyle, color: c.textHint, fontWeight: 500 }}
              >
                0{i + 1} — {p.kind}
              </div>
              <h3
                className="text-[28px] leading-[1.1] -tracking-[0.01em]"
                style={{ ...serifStyle, color: c.text, fontWeight: 500 }}
              >
                {p.name}
              </h3>
            </div>
            <div className="sm:col-span-8">
              <p className="text-[16px] leading-[1.65]" style={{ ...sansStyle, color: c.textMuted }}>
                {p.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Different() {
  const { c } = useTheme();
  const t = useTranslations('Landing');
  const differentItems = t.raw('differentItems');
  return (
    <section className="py-20 text-center" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t('differentKicker')} color={c.accent} />
      <h2
        className="text-[36px] sm:text-[44px] leading-[1.1] -tracking-[0.015em] whitespace-pre-line max-w-[36rem] mx-auto mb-12"
        style={{ ...serifStyle, color: c.text, fontWeight: 400 }}
      >
        {t('differentTitle')}
      </h2>

      <ul className="space-y-3 max-w-[26rem] mx-auto text-left">
        {differentItems.map((item, i) => (
          <li
            key={i}
            className="flex items-baseline gap-4 py-2"
          >
            <span className="text-[10px] mt-1" style={{ color: c.accentSage }}>●</span>
            <span className="text-[16px] leading-[1.5]" style={{ ...sansStyle, color: c.text }}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClosingCTA({ onBegin }) {
  const { c } = useTheme();
  const t = useTranslations('Landing');
  return (
    <section className="py-24 text-center" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t('closingKicker')} color={c.accent} />
      <h2
        className="text-[56px] sm:text-[72px] leading-[1] mb-8 -tracking-[0.02em]"
        style={{ ...serifStyle, color: c.text, fontWeight: 400 }}
      >
        {t('closingTitle')}
      </h2>
      <p className="text-[17px] leading-[1.65] mb-10 max-w-[34rem] mx-auto" style={{ ...sansStyle, color: c.textMuted }}>
        {t('closingBody')}
      </p>
      <button
        onClick={onBegin}
        className="inline-flex items-center gap-2.5 h-14 px-10 rounded-full text-[15px] tracking-wide transition-all"
        style={{
          ...sansStyle,
          fontWeight: 500,
          background: c.accent,
          color: c.accentText,
        }}
      >
        {t('closingCta')}
        <ArrowRight size={14} />
      </button>
    </section>
  );
}

// Phase 1d.2 — inline Footer removed. Crisis-resource block + safety
// disclaimer extracted into <CrisisResources />; T&C/Privacy/Contact
// links + language picker move to the shared <Footer /> (rendered
// below CrisisResources by LandingPage).

function Toast({ message, onClose }) {
  const { c } = useTheme();
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-5 py-3 text-[13px] max-w-[90vw] z-50"
      style={{
        ...sansStyle,
        background: c.text,
        color: c.bg,
        boxShadow: '0 8px 24px -8px rgba(0,0,0,0.3)',
      }}
    >
      {message}
    </div>
  );
}

// ============================================================================
// Main
// ============================================================================
export default function LandingPage({ footerSlot }) {
  // Phase 2a — `lang` state + prop drilling removed. Every subcomponent
  // calls useTranslations('Landing') directly from NextIntlClientProvider
  // context. The Phase 1d.2 'en'|'ru' narrowing is no longer needed
  // because every locale has a complete message bundle (placeholder
  // locales ship EN content as fallback; Phase 2b fills with real
  // translations).
  const [theme, setTheme] = useState('day');
  const [toast, setToast] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!document.getElementById(FONT_LINK_ID)) {
      const pre = document.createElement('link');
      pre.rel = 'preconnect';
      pre.href = 'https://fonts.gstatic.com';
      pre.crossOrigin = 'anonymous';
      document.head.appendChild(pre);
      const link = document.createElement('link');
      link.id = FONT_LINK_ID;
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) setTheme('night');
    } catch (e) {}
  }, []);

  const toggle = () => setTheme((t) => (t === 'day' ? 'night' : 'day'));
  const c = PALETTE[theme];

  // Locale-aware navigation: from /ru/ this pushes to /ru/screening.
  const onBegin = () => { router.push('/screening'); };

  return (
    <ThemeContext.Provider value={{ theme, c, toggle }}>
      <div className="min-h-screen transition-colors duration-500" style={{ background: c.bg, ...sansStyle }}>
        <div className="max-w-2xl mx-auto px-6">
          <Header />
          <Hero onBegin={onBegin} />
          <WhatIs />
          <WhoFor />
          <Safety />
          <PathsSection />
          <Different />
          <ClosingCTA onBegin={onBegin} />
          {/* Phase 1d.2 — Landing-only crisis-resource block + safety
              disclaimer, rendered above the shared Footer. Footer arrives
              as a server-rendered slot from [locale]/page.tsx. */}
          <CrisisResources theme={theme} />
          {footerSlot}
        </div>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    </ThemeContext.Provider>
  );
}
