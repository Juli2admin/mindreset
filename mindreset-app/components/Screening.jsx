'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { sansStyle, serifStyle } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
// Footer comes in as a server-rendered slot via the `footerSlot` prop —
// see app/screening/page.tsx. Phase i18n.0 server-component-with-client-
// slot pattern.
// Phase i18n.1a — locale-aware Link auto-prefixes the active locale
// (e.g. href="/sign-up" from /ru/screening becomes /ru/sign-up).
import { Link } from '@/i18n/navigation';
// Phase i18n.1d.2 — shared TopBar (client component) imported directly.
import TopBar from '@/components/TopBar';

// ============================================================================
// MindReset — Pre-Screening Flow (Section 0)
// Brand: deep petrol teal + cream parchment.
// Day/night theming with system-preference detection.
// ============================================================================

const FONT_LINK_ID = 'mindreset-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=Geist:wght@400;500&display=swap';

// THEME — Screening reads from the global ThemeProvider mounted in
// [locale]/layout.tsx (via useTheme from @/lib/theme/useTheme above).
// The ThemeToggle button is rendered automatically by TopBar.

// Both use currentColor so they pick up theme automatically.
// ============================================================================
function TreeMark({ size = 26 }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Trunk */}
      <path d="M16 11 V21" strokeWidth="1.4" />
      {/* Top branches */}
      <path d="M16 11 Q15 6 13 2" strokeWidth="1" />
      <path d="M16 11 Q17 6 19 2" strokeWidth="1" />
      <path d="M16 12 Q11 9 7 5" strokeWidth="1" />
      <path d="M16 12 Q21 9 25 5" strokeWidth="1" />
      <path d="M16 13 Q9 13 4 11" strokeWidth="1" />
      <path d="M16 13 Q23 13 28 11" strokeWidth="1" />
      {/* Bottom roots — mirror of branches */}
      <path d="M16 21 Q15 26 13 30" strokeWidth="1" />
      <path d="M16 21 Q17 26 19 30" strokeWidth="1" />
      <path d="M16 20 Q11 23 7 27" strokeWidth="1" />
      <path d="M16 20 Q21 23 25 27" strokeWidth="1" />
      <path d="M16 19 Q9 19 4 21" strokeWidth="1" />
      <path d="M16 19 Q23 19 28 21" strokeWidth="1" />
    </svg>
  );
}

function TreeLogo() { return null; } // (intentionally empty — small TreeMark in header is the only logo on screen now)


function SunIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ChevronDown({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6L8 10L12 6" />
    </svg>
  );
}

// ============================================================================
// UI atoms — theme-aware via context
// ============================================================================
function Check({ checked, onChange, children }) {
  const { palette: c } = useTheme();
  // The unchecked box previously used `c.borderStrong` at 1.5px — visible in
  // light mode against the cream background but essentially invisible in dark
  // mode (dark-grey box on near-black background with a barely-lighter grey
  // border). New users testing the screening reported the whole screen looked
  // "disabled": they couldn't see the boxes were interactive, so they never
  // ticked them, so the Begin button (correctly gated on both ticks) stayed
  // greyed out. The fix uses `c.text` for the unchecked border — dark against
  // light card in day mode, cream against dark card in night mode — so the
  // box is unambiguously a clickable form element in both themes. Border
  // bumped to 2px so the outline reads solid at glance.
  return (
    <label className="flex items-start gap-3 cursor-pointer group py-2.5">
      <span
        className="mt-[3px] shrink-0 w-[20px] h-[20px] rounded border-2 flex items-center justify-center transition-colors group-hover:opacity-90"
        style={{
          background: checked ? c.text : c.bgCard,
          borderColor: c.text,
        }}
      >
        {checked && (
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke={c.bg} strokeWidth="2.5">
            <path d="M3 8.5L6.5 12L13 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className="leading-[1.55] text-[15px]" style={{ ...sansStyle, color: c.text }}>
        {children}
      </span>
    </label>
  );
}

function Pill({ active, children, onClick }) {
  const { palette: c } = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 min-w-[2.5rem] px-3 rounded-full text-[14px] transition-all tabular-nums"
      style={{
        ...sansStyle,
        background: active ? c.text : 'transparent',
        color: active ? c.bg : c.textMuted,
        border: `1px solid ${active ? c.text : c.border}`,
      }}
    >
      {children}
    </button>
  );
}

function Scale({ value, onChange, max = 5 }) {
  return (
    <div className="flex gap-1.5 mt-3 flex-wrap">
      {Array.from({ length: max + 1 }, (_, i) => (
        <Pill key={i} active={value === i} onClick={() => onChange(i)}>
          {i}
        </Pill>
      ))}
    </div>
  );
}

function Header({ step, total, showProgress }) {
  // TopBar handles ThemeToggle + LanguagePicker internally. Header only
  // supplies the screening-specific progress indicator.
  const t = useTranslations('Screening');
  const { palette: c } = useTheme();
  return (
    <div className="mb-10">
      <TopBar
        showTreeMark
        right={
          showProgress ? (
            <span
              className="text-[11px] uppercase tracking-[0.16em]"
              style={{ ...sansStyle, color: c.textHint }}
            >
              {t('progress')} {step + 1} {t('of')} {total}
            </span>
          ) : undefined
        }
      />
    </div>
  );
}

function ProgressBar({ step, total }) {
  const { palette: c } = useTheme();
  const pct = total > 0 ? ((step + 1) / total) * 100 : 0;
  return (
    <div className="h-px mb-12 relative overflow-hidden" style={{ background: c.border }}>
      <div
        className="absolute inset-y-0 left-0 transition-all duration-500 ease-out"
        style={{ width: `${pct}%`, background: c.text }}
      />
    </div>
  );
}

function SectionTitle({ kicker, title, helper, kickerColor }) {
  const { palette: c } = useTheme();
  return (
    <div className="mb-8">
      {kicker && (
        <div
          className="text-[11px] uppercase tracking-[0.18em] mb-4"
          style={{ ...sansStyle, color: kickerColor || c.accent, fontWeight: 500 }}
        >
          {kicker}
        </div>
      )}
      <h2
        className="text-[28px] leading-[1.2] mb-3 -tracking-[0.005em]"
        style={{ ...serifStyle, color: c.text, fontWeight: 400 }}
      >
        {title}
      </h2>
      {helper && (
        <p className="text-[14px]" style={{ ...sansStyle, color: c.textHint }}>
          {helper}
        </p>
      )}
    </div>
  );
}

function PrimaryButton({ onClick, disabled, children }) {
  const { palette: c } = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-12 px-7 rounded-full text-[14px] tracking-wide transition-all"
      style={{
        ...sansStyle,
        fontWeight: 500,
        background: disabled ? c.bgSubtle : c.accent,
        color: disabled ? c.textHint : c.accentText,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function NavRow({ onBack, onNext, nextLabel, nextDisabled }) {
  const t = useTranslations('Screening');
  const { palette: c } = useTheme();
  return (
    <div className="mt-14 pt-8 flex items-center justify-between gap-4" style={{ borderTop: `1px solid ${c.border}` }}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="text-[14px] transition-colors"
          style={{ ...sansStyle, color: c.textMuted }}
          onMouseEnter={(e) => (e.currentTarget.style.color = c.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = c.textMuted)}
        >
          ← {t('back')}
        </button>
      ) : (
        <span />
      )}
      <PrimaryButton onClick={onNext} disabled={nextDisabled}>{nextLabel}</PrimaryButton>
    </div>
  );
}

// ============================================================================
// Screens
// ============================================================================
function IntroScreen({ onBegin }) {
  const { palette: c } = useTheme();
  const t = useTranslations('Screening');
  const [age, setAge] = useState(false);
  const [notMed, setNotMed] = useState(false);
  return (
    <>
      <Header brand={t('brand')} showProgress={false} />
      <div className="mt-8 text-[11px] uppercase tracking-[0.18em] mb-8" style={{ ...sansStyle, color: c.accent, fontWeight: 500 }}>
        {t('tagline')}
      </div>
      <h1
        className="text-[48px] leading-[1.02] mb-8 -tracking-[0.015em]"
        style={{ ...serifStyle, color: c.text, fontWeight: 400 }}
      >
        {t('introTitle')}
      </h1>
      <p className="text-[17px] leading-[1.6] mb-10 max-w-[34rem]" style={{ ...sansStyle, color: c.textMuted }}>
        {t('introBody')}
      </p>
      <div className="pt-4" style={{ borderTop: `1px solid ${c.border}` }}>
        <Check checked={age} onChange={setAge}>{t('ageGate')}</Check>
        <Check checked={notMed} onChange={setNotMed}>{t('notMedical')}</Check>
      </div>
      <NavRow onBack={null} onNext={onBegin} nextLabel={t('begin')} nextDisabled={!age || !notMed} />
    </>
  );
}

function ExclusionScreen({ step, total, onBack, onNext, value, setValue }) {
  const t = useTranslations('Screening');
  return (
    <>
      <Header step={step} total={total} brand={t('brand')} showProgress />
      <ProgressBar step={step} total={total} />
      <SectionTitle kicker={t('secExclusion')} title={t('exclusionTitle')} helper={t('selectAll')} />
      <div>
        {t.raw('exclusion').map((label, i) => (
          <Check key={i} checked={value[i] || false} onChange={(v) => setValue({ ...value, [i]: v })}>
            {label}
          </Check>
        ))}
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextLabel={t('next')} nextDisabled={false} />
    </>
  );
}

function ScaleScreen({ step, total, onBack, onNext, value, setValue, items, kicker, title, helper }) {
  const { palette: c } = useTheme();
  const t = useTranslations('Screening');
  const answered = items.every((_, i) => typeof value[i] === 'number');
  return (
    <>
      <Header step={step} total={total} brand={t('brand')} showProgress />
      <ProgressBar step={step} total={total} />
      <SectionTitle kicker={kicker} title={title} helper={helper} />
      <div className="space-y-7">
        {items.map((label, i) => (
          <div
            key={i}
            className="pb-6 last:pb-0"
            style={{ borderBottom: i === items.length - 1 ? 'none' : `1px solid ${c.border}` }}
          >
            <p className="text-[15px] leading-[1.55]" style={{ ...sansStyle, color: c.text }}>
              {label}
            </p>
            <Scale value={value[i]} onChange={(v) => setValue({ ...value, [i]: v })} />
          </div>
        ))}
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextLabel={t('next')} nextDisabled={!answered} />
    </>
  );
}

function TraumaScreen({ step, total, onBack, onNext, value, setValue }) {
  const { palette: c } = useTheme();
  const t = useTranslations('Screening');
  return (
    <>
      <Header step={step} total={total} brand={t('brand')} showProgress />
      <ProgressBar step={step} total={total} />
      <SectionTitle kicker={t('secTrauma')} title={t('traumaTitle')} helper={t('pickOne')} />
      <div className="space-y-2">
        {t.raw('trauma').map((label, i) => {
          const isActive = value === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setValue(i)}
              className="w-full text-left px-5 py-4 rounded-lg transition-all"
              style={{
                ...sansStyle,
                background: isActive ? c.text : c.bgCard,
                color: isActive ? c.bg : c.text,
                border: `1px solid ${isActive ? c.text : c.border}`,
              }}
            >
              <span className="text-[15px] leading-[1.5]">{label}</span>
            </button>
          );
        })}
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextLabel={t('next')} nextDisabled={value === null} />
    </>
  );
}

function CognitiveScreen({ step, total, onBack, onNext, value, setValue }) {
  const { palette: c } = useTheme();
  const t = useTranslations('Screening');
  const answered = t.raw('cognitive').every((_, i) => value[i] === 'yes' || value[i] === 'no');
  return (
    <>
      <Header step={step} total={total} brand={t('brand')} showProgress />
      <ProgressBar step={step} total={total} />
      <SectionTitle kicker={t('secCognitive')} title={t('cognitiveTitle')} />
      <div>
        {t.raw('cognitive').map((label, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-6 py-4"
            style={{ borderBottom: i === t.raw('cognitive').length - 1 ? 'none' : `1px solid ${c.border}` }}
          >
            <p className="text-[15px] leading-[1.5] flex-1" style={{ ...sansStyle, color: c.text }}>
              {label}
            </p>
            <div className="flex gap-2 shrink-0">
              <Pill active={value[i] === 'yes'} onClick={() => setValue({ ...value, [i]: 'yes' })}>{t('yes')}</Pill>
              <Pill active={value[i] === 'no'} onClick={() => setValue({ ...value, [i]: 'no' })}>{t('no')}</Pill>
            </div>
          </div>
        ))}
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextLabel={t('next')} nextDisabled={!answered} />
    </>
  );
}

function ConsentScreen({ step, total, onBack, onNext, value, setValue }) {
  const t = useTranslations('Screening');
  const consentItems = t.raw('consent');
  const allChecked = consentItems.every((_, i) => value[i] === true);
  return (
    <>
      <Header step={step} total={total} brand={t('brand')} showProgress />
      <ProgressBar step={step} total={total} />
      <SectionTitle kicker={t('secConsent')} title={t('consentTitle')} />
      <div>
        {consentItems.map((label, i) => (
          <Check key={i} checked={value[i] || false} onChange={(v) => setValue({ ...value, [i]: v })}>
            {label}
          </Check>
        ))}
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextLabel={t('finish')} nextDisabled={!allChecked} />
    </>
  );
}

function ResultScreen({ result, onStartOver, sessionId }) {
  const { palette: c } = useTheme();
  const t = useTranslations('Screening');

  if (result === 'red') {
    return (
      <>
        <Header brand={t('brand')} showProgress={false} />
        <div className="pl-6 mb-10" style={{ borderLeft: `2px solid ${c.danger}` }}>
          <div className="text-[11px] uppercase tracking-[0.18em] mb-4" style={{ ...sansStyle, color: c.danger, fontWeight: 500 }}>
            {t('redKicker')}
          </div>
          <h2 className="text-[32px] leading-[1.15] mb-5" style={{ ...serifStyle, color: c.text, fontWeight: 400 }}>
            {t('redTitle')}
          </h2>
          <p className="text-[16px] leading-[1.65]" style={{ ...sansStyle, color: c.textMuted }}>
            {t('redBody')}
          </p>
        </div>

        <div className="text-[11px] uppercase tracking-[0.18em] mb-5" style={{ ...sansStyle, color: c.textHint, fontWeight: 500 }}>
          {t('redResourcesTitle')}
        </div>
        <div className="space-y-3 mb-12">
          {t.raw('redResources').map((r, i) => (
            <div key={i} className="rounded-lg p-5" style={{ background: c.bgCard, border: `1px solid ${c.border}` }}>
              <div className="text-[16px] mb-1" style={{ ...serifStyle, color: c.text, fontWeight: 500 }}>
                {r.name}
              </div>
              <div className="text-[14px]" style={{ ...sansStyle, color: c.textMuted }}>
                {r.detail}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[15px] leading-[1.6] italic max-w-[34rem]" style={{ ...serifStyle, color: c.textMuted, fontWeight: 300 }}>
          {t('redFooter')}
        </p>

        <div className="mt-12 pt-6 flex items-center justify-between" style={{ borderTop: `1px solid ${c.border}` }}>
          <span className="text-[11px] tabular-nums" style={{ ...sansStyle, color: c.textHint }}>
            {t('sessionRef')}: {sessionId}
          </span>
          <button
            onClick={onStartOver}
            className="text-[13px] transition-colors"
            style={{ ...sansStyle, color: c.textMuted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = c.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = c.textMuted)}
          >
            {t('startOver')}
          </button>
        </div>
      </>
    );
  }

  const isYellow = result === 'yellow';
  const accentBorderColor = isYellow ? c.warning : c.success;
  const accentTextColor = isYellow ? c.warning : c.success;
  const kicker = isYellow ? t('yellowKicker') : t('greenKicker');
  const titleText = isYellow ? t('yellowTitle') : t('greenTitle');
  const bodyText = isYellow ? t('yellowBody') : t('greenBody');
  const nextTitle = isYellow ? t('yellowNextTitle') : t('greenNextTitle');
  const nextItems = isYellow ? t.raw('yellowNext') : t.raw('greenNext');
  const ctaLabel = isYellow ? t('yellowCta') : t('greenCta');

  return (
    <>
      <Header brand={t('brand')} showProgress={false} />
      <div className="pl-6 mb-10" style={{ borderLeft: `2px solid ${accentBorderColor}` }}>
        <div className="text-[11px] uppercase tracking-[0.18em] mb-4" style={{ ...sansStyle, color: accentTextColor, fontWeight: 500 }}>
          {kicker}
        </div>
        <h2 className="text-[32px] leading-[1.15] mb-5" style={{ ...serifStyle, color: c.text, fontWeight: 400 }}>
          {titleText}
        </h2>
        <p className="text-[16px] leading-[1.65]" style={{ ...sansStyle, color: c.textMuted }}>
          {bodyText}
        </p>
      </div>

      <div className="text-[11px] uppercase tracking-[0.18em] mb-5" style={{ ...sansStyle, color: c.textHint, fontWeight: 500 }}>
        {nextTitle}
      </div>
      <div className="space-y-4 mb-10">
        {nextItems.map((item, i) => (
          <div key={i} className="flex gap-4">
            <span className="text-[14px] tabular-nums mt-0.5" style={{ ...serifStyle, color: c.textHint }}>
              0{i + 1}
            </span>
            <p className="text-[15px] leading-[1.6] flex-1" style={{ ...sansStyle, color: c.textMuted }}>
              {item}
            </p>
          </div>
        ))}
      </div>

      <Link
        href="/sign-up"
        className="inline-flex items-center justify-center w-full sm:w-auto h-14 px-10 rounded-full text-[15px] tracking-wide transition-all"
        style={{
          ...sansStyle,
          fontWeight: 500,
          background: c.accent,
          color: c.accentText,
        }}
      >
        {ctaLabel}
      </Link>

      <div className="mt-12 pt-6 flex items-center justify-between" style={{ borderTop: `1px solid ${c.border}` }}>
        <span className="text-[11px] tabular-nums" style={{ ...sansStyle, color: c.textHint }}>
          {t('sessionRef')}: {sessionId}
        </span>
        <button
          onClick={onStartOver}
          className="text-[13px] transition-colors"
          style={{ ...sansStyle, color: c.textMuted }}
          onMouseEnter={(e) => (e.currentTarget.style.color = c.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = c.textMuted)}
        >
          {t('startOver')}
        </button>
      </div>
    </>
  );
}

// ============================================================================
// Main
// ============================================================================
const TOTAL_STEPS = 6;
const initialAnswers = () => ({
  exclusion: {},
  functionality: {},
  emotional: {},
  trauma: null,
  cognitive: {},
  consent: {},
});

export default function ScreeningFlow({ footerSlot }) {
  // Phase 2a — lang state removed; useTranslations reads from NextIntlClientProvider context.
  // Global theme: ThemeProvider in [locale]/layout.tsx owns state +
  // matchMedia auto-detect. Screening just reads the current palette.
  const { palette: c } = useTheme();
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState(initialAnswers());
  const [sessionId] = useState(() => 'MR-' + Math.random().toString(36).slice(2, 8).toUpperCase());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [serverResult, setServerResult] = useState(null);
  const [refireKey, setRefireKey] = useState(0);

  useEffect(() => {
    // Load fonts
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

  useEffect(() => {
    if (step !== 6) return;
    if (serverResult !== null) return;

    let cancelled = false;
    setSubmitting(true);
    setSubmitError(false);

    fetch('/api/screening', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exclusion: answers.exclusion,
        functionality: answers.functionality,
        emotional: answers.emotional,
        trauma: answers.trauma,
        cognitive: answers.cognitive,
        consent: answers.consent,
      }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setSubmitError(true);
          setSubmitting(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setServerResult(data.result);
        setSubmitting(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSubmitError(true);
        setSubmitting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, refireKey]);

  const reset = () => {
    setAnswers(initialAnswers());
    setStep(-1);
    setSubmitting(false);
    setSubmitError(false);
    setServerResult(null);
  };

  const t = useTranslations('Screening');
  let screen;
  if (step === -1) {
    screen = <IntroScreen onBegin={() => setStep(0)} />;
  } else if (step === 0) {
    screen = (
      <ExclusionScreen
        step={0} total={TOTAL_STEPS}
        onBack={() => setStep(-1)} onNext={() => setStep(1)}
        value={answers.exclusion} setValue={(v) => setAnswers({ ...answers, exclusion: v })}
      />
    );
  } else if (step === 1) {
    screen = (
      <ScaleScreen
        step={1} total={TOTAL_STEPS}
        onBack={() => setStep(0)} onNext={() => setStep(2)}
        value={answers.functionality} setValue={(v) => setAnswers({ ...answers, functionality: v })}
        items={t.raw('functionality')} kicker={t('secFunctionality')} title={t('functionalityTitle')} helper={t('rateScaleHigh')}
      />
    );
  } else if (step === 2) {
    screen = (
      <ScaleScreen
        step={2} total={TOTAL_STEPS}
        onBack={() => setStep(1)} onNext={() => setStep(3)}
        value={answers.emotional} setValue={(v) => setAnswers({ ...answers, emotional: v })}
        items={t.raw('emotional')} kicker={t('secEmotional')} title={t('emotionalTitle')} helper={t('rateScaleLow')}
      />
    );
  } else if (step === 3) {
    screen = (
      <TraumaScreen
        step={3} total={TOTAL_STEPS}
        onBack={() => setStep(2)} onNext={() => setStep(4)}
        value={answers.trauma} setValue={(v) => setAnswers({ ...answers, trauma: v })}
      />
    );
  } else if (step === 4) {
    screen = (
      <CognitiveScreen
        step={4} total={TOTAL_STEPS}
        onBack={() => setStep(3)} onNext={() => setStep(5)}
        value={answers.cognitive} setValue={(v) => setAnswers({ ...answers, cognitive: v })}
      />
    );
  } else if (step === 5) {
    screen = (
      <ConsentScreen
        step={5} total={TOTAL_STEPS}
        onBack={() => setStep(4)} onNext={() => setStep(6)}
        value={answers.consent} setValue={(v) => setAnswers({ ...answers, consent: v })}
      />
    );
  } else {
    if (submitError) {
      screen = (
        <>
          <Header brand={t('brand')} showProgress={false} />
          <div className="pl-6 mb-10" style={{ borderLeft: `2px solid ${c.danger}` }}>
            <h2 className="text-[24px] leading-[1.25] mb-3" style={{ ...serifStyle, color: c.text, fontWeight: 400 }}>
              {t('submitErrorTitle')}
            </h2>
            <p className="text-[16px] leading-[1.65] mb-6" style={{ ...sansStyle, color: c.textMuted }}>
              {t('submitErrorBody')}
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitError(false);
                setRefireKey((k) => k + 1);
              }}
              className="h-12 px-7 rounded-full text-[14px] tracking-wide transition-all"
              style={{
                ...sansStyle,
                fontWeight: 500,
                background: c.accent,
                color: c.accentText,
                cursor: 'pointer',
              }}
            >
              {t('retryButton')}
            </button>
          </div>
        </>
      );
    } else if (submitting || serverResult === null) {
      screen = (
        <>
          <Header brand={t('brand')} showProgress={false} />
          <div className="pl-6 mb-10" style={{ borderLeft: `2px solid ${c.accent}` }}>
            <div
              className="text-[11px] uppercase tracking-[0.22em] mb-3"
              style={{ ...sansStyle, color: c.accent, fontWeight: 500 }}
            >
              {t('submitLoadingKicker')}
            </div>
            <p className="text-[18px] leading-[1.5]" style={{ ...serifStyle, color: c.text, fontWeight: 400 }}>
              {t('submitLoading')}
            </p>
          </div>
        </>
      );
    } else {
      screen = <ResultScreen result={serverResult} onStartOver={reset} sessionId={sessionId} />;
    }
  }

  return (
    <div
      className="min-h-screen transition-colors duration-500"
      style={{ background: c.bg, ...sansStyle }}
    >
      <div className="max-w-2xl mx-auto px-6 py-12 sm:py-20">
        {screen}
        {footerSlot}
      </div>
    </div>
  );
}
