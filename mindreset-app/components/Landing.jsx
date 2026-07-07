'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { sansStyle, serifStyle } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
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
import NewsletterSignup from '@/components/Landing/NewsletterSignup';

// ============================================================================
// MindReset.ai — Landing Page
// Hero is typographic + TreeMark glyph in header only.
// Content takes good ideas from Julia's reference landing example.
// ============================================================================

const FONT_LINK_ID = 'mindreset-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=Geist:wght@400;500&display=swap';

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

function ArrowRight({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8H13M9 4L13 8L9 12" />
    </svg>
  );
}

// Phase 1d.2 — shared TopBar with Account/Sign-in link in the right
// slot. TopBar handles ThemeToggle + LanguagePicker internally now;
// callers only need to supply page-specific right-slot content.
function Header() {
  const { palette: c } = useTheme();
  const t = useTranslations('Landing');
  const { isLoaded, isSignedIn } = useUser();
  const signedIn = isLoaded && isSignedIn;
  return (
    <TopBar
      showTreeMark
      right={
        <Link
          href={signedIn ? '/home' : '/sign-in'}
          className="text-[13px] transition-colors hover:underline underline-offset-2"
          style={{ ...sansStyle, color: c.textMuted }}
        >
          {signedIn ? t('account') : t('signIn')}
        </Link>
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
  const { palette: c } = useTheme();
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
  const { palette: c } = useTheme();
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
        className="text-[36px] sm:text-[44px] md:text-[52px] leading-[0.98] mb-5 -tracking-[0.025em] whitespace-pre-line"
        style={{ ...serifStyle, color: c.text, fontWeight: 400 }}
      >
        {t('heroTitle')}
      </h1>

      {/* Demoted poetic anchor — preserved from the original H1, now a
          smaller italic line sitting between the new H1 and the body. Keeps
          the brand soul as a punctuation under the audience-naming H1. */}
      <div
        className="text-[18px] sm:text-[22px] italic mb-12 -tracking-[0.005em]"
        style={{ ...serifStyle, color: c.textMuted, fontWeight: 300 }}
      >
        {t('heroSubtitle')}
      </div>

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

      {/* heroChip removed — the new heroCta text now carries the
          "50 messages, no card" promise inside the button itself,
          which made the chip duplicative. */}
      <div className="text-[11px] mt-4" style={{ ...sansStyle, color: c.textHint }}>
        {t('heroNote')}
      </div>
    </section>
  );
}

function WhatIs() {
  const { palette: c } = useTheme();
  const t = useTranslations('Landing');
  const whatNot = t.raw('whatNot');
  const whatBody = t.raw('whatBody');
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t('whatKicker')} color={c.accent} />
      <SectionTitle text={t('whatTitle')} />

      {/* Body paragraphs (rebrand — replaces the prior legal-lockup-only
          treatment). Reads as introductory prose above the safety
          lockup and closing line. */}
      <div className="mt-8 mb-8 space-y-5 max-w-[36rem]">
        {whatBody.map((para, i) => (
          <p
            key={i}
            className="text-[16px] leading-[1.65]"
            style={{ ...sansStyle, color: c.text }}
          >
            {para}
          </p>
        ))}
      </div>

      <p
        className="text-[15px] italic mb-6"
        style={{ ...serifStyle, color: c.accent, fontWeight: 400 }}
      >
        {t('whatShortLine')}
      </p>

      {/* "Not therapy. Not diagnosis. Not a crisis service." — locked lockup. */}
      <div className="space-y-3 mt-8 mb-10">
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

      <p
        className="text-[18px] leading-[1.55] italic max-w-[34rem]"
        style={{ ...serifStyle, color: c.textMuted, fontWeight: 400 }}
      >
        {t('whatClose')}
      </p>
    </section>
  );
}

function WhoFor() {
  const { palette: c } = useTheme();
  const t = useTranslations('Landing');
  const whoScenarios = t.raw('whoScenarios');
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t('whoKicker')} color={c.accentSage} />
      <SectionTitle text={t('whoTitle')} />

      {/* Sentence-completion treatment: the H2 ends "…" and each scenario
          begins with "…" so the whole block reads as one continuous
          thought. Numbered list dropped (was 01/02/…); previous whoLead
          caption dropped (now redundant once H2 leads directly into the
          scenarios). */}
      <div className="mt-10 mb-12 space-y-5 max-w-[34rem]">
        {whoScenarios.map((item, i) => (
          <p
            key={i}
            className="text-[16px] leading-[1.6]"
            style={{ ...sansStyle, color: c.text }}
          >
            {item}
          </p>
        ))}
      </div>

      <p
        className="text-[22px] leading-[1.4] italic max-w-[34rem] whitespace-pre-line"
        style={{ ...serifStyle, color: c.accent, fontWeight: 400 }}
      >
        {t('whoClose')}
      </p>
    </section>
  );
}

function Safety() {
  const { palette: c } = useTheme();
  const t = useTranslations('Landing');
  const safetyItems = t.raw('safetyItems');
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t('safetyKicker')} color={c.accent} />
      <SectionTitle text={t('safetyTitle')} />

      <p className="text-[17px] leading-[1.65] mt-8 mb-10 max-w-[36rem]" style={{ ...sansStyle, color: c.textMuted }}>
        {t('safetyLead')}
      </p>

      {/* Tightened from per-item border-divided paragraphs to a clean
          single-statement list. Lighter visual weight for "you stay in
          control" — the message is reassurance, not exposition. */}
      <ul className="space-y-3">
        {safetyItems.map((item, i) => (
          <li key={i} className="flex gap-3 items-baseline">
            <span className="text-[10px]" style={{ color: c.accentSage }}>●</span>
            <span className="text-[15px] leading-[1.55] flex-1" style={{ ...sansStyle, color: c.text }}>
              {item}
            </span>
          </li>
        ))}
      </ul>

      {/* Locked safety line — uses "wellbeing tool" wording per spec. */}
      <p
        className="mt-10 text-[14px] italic max-w-[34rem]"
        style={{ ...sansStyle, color: c.textMuted }}
      >
        {t('safetyLine')}
      </p>
    </section>
  );
}

function PathsSection() {
  const { palette: c } = useTheme();
  const t = useTranslations('Landing');
  const paths = t.raw('paths');
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <div className="mb-16">
        <SectionKicker text={t('pathsKicker')} color={c.accentSage} />
        <SectionTitle text={t('pathsTitle')} />
        <p
          className="mt-6 text-[16px] leading-[1.65] max-w-[34rem]"
          style={{ ...sansStyle, color: c.textMuted }}
        >
          {t('pathsIntro')}
        </p>
      </div>

      {/* Per-path block reverts to the border-divider prose pattern (no
          card background). Only the price line is clickable, not the
          whole block — keeps the block calm and signals "click the price
          to see plans". */}
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
              <Link
                href="/pricing"
                className="mt-4 inline-flex items-center gap-2 text-[14px] hover:underline underline-offset-4"
                style={{ ...sansStyle, color: c.accent, fontWeight: 500 }}
              >
                {p.price}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Phase A · Section 3 — "Method described, not named". Substantiates The
// Journey claim from PathsSection above without revealing the 8-stage IP.
// Three paragraphs in the brand voice: what it is / the arc in user-
// experience language / what it isn't. Sits after PathsSection introduces
// the three paths, before Different positions vs competitors.
function MethodSection() {
  const { palette: c } = useTheme();
  const t = useTranslations('Landing');
  const body = t.raw('methodBody');
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t('methodKicker')} color={c.accent} />
      <SectionTitle text={t('methodTitle')} />

      <div className="mt-10 mb-8 space-y-6 max-w-[36rem]">
        {body.map((para, i) => (
          <p
            key={i}
            className="text-[16px] leading-[1.65]"
            style={{ ...sansStyle, color: c.text }}
          >
            {para}
          </p>
        ))}
      </div>

      {/* Closing punchline in the italic-serif register — mirrors the
          treatment used on Different's punchline. */}
      <p
        className="text-[20px] sm:text-[22px] italic leading-[1.5] max-w-[34rem]"
        style={{ ...serifStyle, color: c.accent, fontWeight: 300 }}
      >
        {t('methodClose')}
      </p>
    </section>
  );
}

// Phase A · Section 5 — competitor positioning rewrite. Old prose-array
// replaced with: title + three rows (headline + body, separated by
// dividers, naming category descriptions only — not competitor brand
// names) + italic-serif punchline. Brand-name competitor comparison
// lives on dedicated /vs/* pages in Phase D, not here. Therapy-cost
// SEO/AI-search vocabulary lands naturally in Row 3 body prose.
function Different() {
  const { palette: c } = useTheme();
  const t = useTranslations('Landing');
  const rows = t.raw('differentRows');
  return (
    <section
      className="py-20 sm:py-24"
      style={{ borderTop: `1px solid ${c.border}` }}
    >
      <SectionKicker text={t('differentKicker')} color={c.accent} />
      <SectionTitle text={t('differentTitle')} />

      {/* Rebrand — the branding statement (body) is the emphasis, not the
          setup line. Setup reads as a short muted intro; body is the
          italic-serif accent punchline, same treatment as methodClose /
          the other punchlines. No dividers — matches the rest of the
          page which uses whitespace, not lines. */}
      <div className="mt-12 space-y-12 max-w-[36rem]">
        {rows.map((row, i) => (
          <div key={i}>
            <p
              className="text-[16px] leading-[1.55] mb-3"
              style={{ ...sansStyle, color: c.text, fontWeight: 400 }}
            >
              {row.headline}
            </p>
            <p
              className="text-[22px] sm:text-[24px] leading-[1.4] italic -tracking-[0.005em]"
              style={{ ...serifStyle, color: c.accent, fontWeight: 300 }}
            >
              {row.body}
            </p>
          </div>
        ))}
      </div>

      {t('differentClose') && (
        <p
          className="mt-10 text-[20px] sm:text-[22px] italic leading-[1.5] whitespace-pre-line max-w-[34rem]"
          style={{ ...serifStyle, color: c.accent, fontWeight: 300 }}
        >
          {t('differentClose')}
        </p>
      )}
    </section>
  );
}

function ClosingCTA({ onBegin, sectionRef }) {
  const { palette: c } = useTheme();
  const t = useTranslations('Landing');
  return (
    <section ref={sectionRef} className="py-24 text-center" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t('closingKicker')} color={c.accent} />
      <h2
        className="text-[40px] sm:text-[56px] md:text-[72px] leading-[1] mb-8 -tracking-[0.02em]"
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
  const { palette: c } = useTheme();
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

// Sticky free-taster CTA — visible on mobile (bottom-centre with iOS
// safe-area padding) and desktop (bottom-right). Fades out when the
// page's existing ClosingCTA section enters the viewport so we don't
// show two primary CTAs stacked at the bottom of the page. Native
// IntersectionObserver — no new dependency.
function StickyTryFreeCTA({ closingCtaRef }) {
  const { palette: c } = useTheme();
  const t = useTranslations('Landing');
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = closingCtaRef?.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [closingCtaRef]);

  return (
    <Link
      href="/minimind"
      aria-label={t('stickyTryFree')}
      className={[
        'fixed z-50 inline-flex items-center justify-center gap-2',
        'h-12 px-6 rounded-full text-[14px] tracking-wide transition-all duration-300',
        // Mobile: bottom-centre with safe-area padding; capped width to keep readable
        'left-1/2 -translate-x-1/2 max-w-[20rem] w-[calc(100vw-2rem)]',
        // Desktop overrides: bottom-right, auto width
        'md:left-auto md:translate-x-0 md:right-8 md:w-auto md:max-w-none',
        hidden ? 'opacity-0 pointer-events-none' : 'opacity-100',
      ].join(' ')}
      style={{
        ...sansStyle,
        fontWeight: 500,
        background: c.accent,
        color: c.accentText,
        bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}
    >
      {t('stickyTryFree')}
    </Link>
  );
}

// ============================================================================
// Main
// ============================================================================
export default function LandingPage({ footerSlot, testimonialsSlot }) {
  // Phase 2a — `lang` state + prop drilling removed. Every subcomponent
  // calls useTranslations('Landing') directly from NextIntlClientProvider
  // context. The Phase 1d.2 'en'|'ru' narrowing is no longer needed
  // because every locale has a complete message bundle (placeholder
  // locales ship EN content as fallback; Phase 2b fills with real
  // translations).
  const [toast, setToast] = useState(null);
  const router = useRouter();
  // Global theme + matchMedia auto-detection are owned by ThemeProvider
  // in [locale]/layout.tsx now. Landing just reads the current palette.
  const { palette: c } = useTheme();
  // Ref on the ClosingCTA section so the StickyTryFreeCTA can hide itself
  // when that section is in view (avoids two primary CTAs stacked at the
  // bottom).
  const closingCtaRef = useRef(null);

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
  }, []);

  // Locale-aware navigation: from /ru/ this pushes to /ru/screening.
  const onBegin = () => { router.push('/screening'); };

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ background: c.bg, ...sansStyle }}>
      <div className="max-w-2xl mx-auto px-6">
        <Header />
        <Hero onBegin={onBegin} />
        <WhatIs />
        <WhoFor />
        <Safety />
        <PathsSection />
        <MethodSection />
        <Different />
        {testimonialsSlot}
        <NewsletterSignup />
        <ClosingCTA onBegin={onBegin} sectionRef={closingCtaRef} />
        {/* Phase 1d.2 — Landing-only crisis-resource block + safety
            disclaimer, rendered above the shared Footer. Footer arrives
            as a server-rendered slot from [locale]/page.tsx. */}
        <CrisisResources />
        {footerSlot}
      </div>
      <StickyTryFreeCTA closingCtaRef={closingCtaRef} />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
