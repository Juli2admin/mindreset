'use client';

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { PALETTE, sansStyle, serifStyle } from '@/lib/brand/colors';

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

const LANGUAGES = [
  { code: 'en', native: 'English', available: true },
  { code: 'ru', native: 'Русский', available: true },
  { code: 'uk', native: 'Українська', available: false },
  { code: 'pl', native: 'Polski', available: false },
  { code: 'de', native: 'Deutsch', available: false },
  { code: 'es', native: 'Español', available: false },
  { code: 'fr', native: 'Français', available: false },
];


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

function ChevronDown({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6L8 10L12 6" />
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

function LangSwitch({ lang, setLang }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const click = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', click);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] uppercase tracking-wider transition-colors"
        style={{
          ...sansStyle,
          fontWeight: 500,
          color: c.textMuted,
          border: `1px solid ${c.border}`,
          background: open ? c.bgSubtle : 'transparent',
        }}
      >
        {current.code}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-10 rounded-lg overflow-hidden min-w-[180px] z-20"
          style={{ background: c.bgCard, border: `1px solid ${c.border}`, boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.18)' }}
        >
          {LANGUAGES.map((l) => {
            const isActive = lang === l.code;
            return (
              <button
                key={l.code}
                type="button"
                disabled={!l.available}
                onClick={() => { if (l.available) { setLang(l.code); setOpen(false); } }}
                className="w-full text-left px-4 py-2.5 text-[13px] flex items-center justify-between transition-colors"
                style={{
                  ...sansStyle,
                  color: isActive ? c.text : l.available ? c.textMuted : c.textHint,
                  background: isActive ? c.bgSubtle : 'transparent',
                  cursor: l.available ? 'pointer' : 'not-allowed',
                  opacity: l.available ? 1 : 0.55,
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider tabular-nums" style={{ color: c.textHint, minWidth: '1.4rem' }}>
                    {l.code}
                  </span>
                  <span>{l.native}</span>
                </span>
                {!l.available && (
                  <span className="text-[9px] uppercase tracking-wider" style={{ color: c.textHint }}>soon</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Header({ lang, setLang }) {
  const { c } = useTheme();
  return (
    <header className="flex items-center justify-between py-6">
      <div className="flex items-center gap-3">
        <span style={{ color: c.text }}>
          <TreeMark size={26} />
        </span>
        <span
          className="text-[20px] tracking-tight"
          style={{ ...serifStyle, fontWeight: 500, fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
        >
          <span style={{ color: c.accent }}>Mind</span>
          <span style={{ color: c.accentSage }}>Reset</span>
          <span style={{ color: c.textHint }} className="ml-0.5">.ai</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <LangSwitch lang={lang} setLang={setLang} />
        <ThemeToggle />
      </div>
    </header>
  );
}

// ============================================================================
// COPY
// ============================================================================
const COPY = {
  en: {
    // HERO
    heroKicker: 'A turning point. A method.',
    heroTitle: 'A way back\nto yourself.',
    heroBody: [
      "You feel it, don't you? That quiet sense that something inside is misaligned.",
      'You are functioning. You are capable. But underneath — there is confusion, exhaustion, or emptiness you cannot quite explain.',
      'This is where you stop. And begin again.',
    ],
    heroCta: 'Begin',
    heroNote: 'Begins with a five-minute check-in.',

    // WHAT IS
    whatKicker: 'What this is',
    whatTitle: 'Structure, not advice.',
    whatLead: 'MindReset is a structured digital reflection platform designed to help you regain emotional clarity, inner stability, and a sense of self-direction.',
    whatNot: ['therapy', 'coaching', 'a crisis service'],
    whatHelpsLead: 'It helps you:',
    whatHelpsItems: [
      'Slow down internal noise',
      'Recognise emotional patterns',
      'Rebuild inner coherence',
      'Reconnect with who you are beneath roles and expectations',
    ],

    // WHO IT IS FOR
    whoKicker: 'Who it is for',
    whoTitle: 'Internally disoriented,\nexternally functioning.',
    whoLead: 'MindReset is designed for adults navigating internal transitions:',
    whoScenarios: [
      'Feeling lost or disconnected despite doing everything right',
      'Emotional burnout after years of responsibility or caregiving',
      'Identity confusion after divorce, relocation, ageing, or major life shifts',
      'Chronic self-neglect, people-pleasing, putting others first',
      'Saying: I have tried therapy, books, and self-work — but something still feels missing',
    ],
    whoClose: 'It is for those who are emotionally stable, but internally disoriented.',

    // SAFETY
    safetyKicker: 'Safety',
    safetyTitle: 'You stay in control.',
    safetyLead: 'MindReset is built with emotional safety at its core.',
    safetyItems: [
      'No diagnoses. No labels. No pressure.',
      'No deep trauma work unless you choose it.',
      'You can pause, slow down, or stop at any moment.',
      'If your responses suggest distress or instability, the system pauses gently and points you to professional support.',
    ],

    // PATHS
    pathsKicker: 'What is inside',
    pathsTitle: 'Three paths,\nthree depths.',
    paths: [
      {
        name: 'MiniMind',
        kind: 'Daily companion',
        body: 'A warm chat companion you can return to anytime. Daily check-ins, short grounding practices, a place to land when something is heavy. It learns your patterns gently, and suggests deeper work when it would help.',
      },
      {
        name: 'States & Themes',
        kind: 'Focused modules',
        body: 'Short structured journeys for specific moments. States for the present: anxiety, disconnection, inner emptiness, numbness. Themes for the patterns underneath: money and self-worth, family, the body, shame, self-realisation.',
      },
      {
        name: 'The Journey',
        kind: 'Eight-stage reset',
        body: 'A slow, sequential journey from stabilisation to a new sense of who you are. Months of work, paced by what your system can hold. Built to release beliefs that were never yours, restore your boundaries, and remember yourself.',
      },
    ],

    // DIFFERENT
    differentKicker: 'What sets it apart',
    differentTitle: 'Most platforms give advice.\nMindReset gives structure.',
    differentItems: [
      'No diagnoses',
      'No digging unless you choose',
      'No dependency on the system',
      'No pressure to change',
      'Just a clear, contained path — at your pace',
    ],

    // CLOSING
    closingKicker: 'Whenever you are ready',
    closingTitle: 'Begin.',
    closingBody:
      'You do not need to be in pieces to start. You do not need to know what you want. The check-in tells us — gently — whether this is right for you in this moment.',
    closingCta: 'Start the check-in',

    // FOOTER
    crisisLabel: 'Need help right now?',
    crisisItems: [
      { name: 'Samaritans', detail: 'Call 116 123 — free, 24/7' },
      { name: 'NHS 111', detail: 'option 2 for the mental health line' },
      { name: 'Emergency', detail: '999 or A&E if you feel unsafe' },
    ],
    footerDisclaimer:
      'MindReset is a self-guided reflection platform, not a medical or therapeutic service. If you are in crisis, please reach out using the resources above.',
    footerLinks: [
      { label: 'Terms', href: '#' },
      { label: 'Privacy', href: '#' },
      { label: 'Contact', href: '#' },
    ],
    footerCopy: '© 2025 MindReset.ai — London, UK',

    toastText: '→ In the live app, this routes to /screening — the five-minute check-in.',
    notWord: 'Not',
  },

  ru: {
    heroKicker: 'Точка опоры. Метод.',
    heroTitle: 'Путь обратно\nк себе.',
    heroBody: [
      'Вы это чувствуете, правда? Тихое ощущение, что что-то внутри сместилось.',
      'Вы функционируете. Вы способны. Но под этим — растерянность, истощение или пустота, которую трудно объяснить.',
      'Здесь вы останавливаетесь. И начинаете заново.',
    ],
    heroCta: 'Начать',
    heroNote: 'Начинается с пятиминутной анкеты.',

    whatKicker: 'Что это',
    whatTitle: 'Структура, а не советы.',
    whatLead:
      'MindReset — структурированная платформа для рефлексии, помогающая вернуть эмоциональную ясность, внутреннюю устойчивость и ощущение собственного направления.',
    whatNot: ['терапия', 'коучинг', 'служба экстренной помощи'],
    whatHelpsLead: 'Она помогает:',
    whatHelpsItems: [
      'Замедлить внутренний шум',
      'Распознать эмоциональные паттерны',
      'Восстановить внутреннюю целостность',
      'Вернуться к тому, кем вы являетесь под ролями и ожиданиями',
    ],

    whoKicker: 'Для кого',
    whoTitle: 'Внутри потеряны,\nснаружи функционируете.',
    whoLead: 'MindReset создан для взрослых, проходящих внутренние переходы:',
    whoScenarios: [
      'Чувство потерянности, хотя внешне «всё правильно»',
      'Эмоциональное выгорание после лет ответственности и заботы о других',
      'Потеря идентичности после развода, переезда, взросления или жизненного перелома',
      'Хроническое самопренебрежение, угодничество, постоянное «другие важнее»',
      'Слова: «Я пробовала терапию, книги, работу над собой — но чего-то всё ещё не хватает»',
    ],
    whoClose: 'Это для тех, кто эмоционально устойчив, но внутренне дезориентирован.',

    safetyKicker: 'Безопасность',
    safetyTitle: 'Вы остаётесь в контроле.',
    safetyLead: 'MindReset построен с эмоциональной безопасностью в основе.',
    safetyItems: [
      'Никаких диагнозов. Никаких ярлыков. Никакого давления.',
      'Никакой глубокой работы с травмой без вашего выбора.',
      'Можно остановиться, замедлиться или прекратить в любой момент.',
      'Если ответы указывают на дистресс, система мягко делает паузу и направляет к живой профессиональной поддержке.',
    ],

    pathsKicker: 'Что внутри',
    pathsTitle: 'Три пути,\nтри глубины.',
    paths: [
      {
        name: 'MiniMind',
        kind: 'Ежедневный спутник',
        body: 'Тёплый чат-спутник, к которому можно вернуться в любой момент. Ежедневная проверка состояния, короткие практики заземления, место, где можно опереться. Мягко учится вашим паттернам и предлагает более глубокую работу, когда это уместно.',
      },
      {
        name: 'Состояния и Темы',
        kind: 'Фокусные модули',
        body: 'Короткие структурированные путешествия для конкретных моментов. Состояния для настоящего: тревога, отключённость, внутренняя пустота, онемение. Темы для паттернов под этим: деньги и самоценность, семья, тело, стыд, самореализация.',
      },
      {
        name: 'Путь',
        kind: 'Восьмиступенчатый перезапуск',
        body: 'Медленный, последовательный путь от стабилизации к новому ощущению себя. Месяцы работы в темпе, который выдерживает ваша система. Создан, чтобы помочь отпустить убеждения, которые никогда не были вашими, восстановить границы и вспомнить себя.',
      },
    ],

    differentKicker: 'Чем отличается',
    differentTitle: 'Большинство платформ дают советы.\nMindReset даёт структуру.',
    differentItems: [
      'Никаких диагнозов',
      'Никаких раскопок, кроме тех, что вы выбираете',
      'Никакой зависимости от системы',
      'Никакого давления изменяться',
      'Только ясный, ограниченный путь — в вашем темпе',
    ],

    closingKicker: 'Когда будете готовы',
    closingTitle: 'Начните.',
    closingBody:
      'Не нужно быть в полном порядке, чтобы начать. Не нужно знать, чего вы хотите. Анкета мягко скажет, подходит ли это вам в данный момент.',
    closingCta: 'Пройти анкету',

    crisisLabel: 'Сейчас нужна помощь?',
    crisisItems: [
      { name: 'Samaritans (UK)', detail: '116 123 — бесплатно, круглосуточно' },
      { name: 'NHS 111', detail: 'вариант 2 — линия психического здоровья' },
      { name: 'Экстренно', detail: '999 или A&E, если небезопасно' },
    ],
    footerDisclaimer:
      'MindReset — платформа для рефлексии и самопомощи, не медицинская или терапевтическая услуга. Если вы в кризисе, обратитесь к ресурсам выше.',
    footerLinks: [
      { label: 'Условия', href: '#' },
      { label: 'Конфиденциальность', href: '#' },
      { label: 'Контакт', href: '#' },
    ],
    footerCopy: '© 2025 MindReset.ai — Лондон, Великобритания',

    toastText: '→ В реальном приложении это перейдёт на /screening — пятиминутную анкету.',
    notWord: 'Не',
  },
};

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
function Hero({ lang, onBegin }) {
  const { c } = useTheme();
  const t = COPY[lang];
  return (
    <section className="pt-12 pb-24 text-center">
      <div
        className="text-[11px] uppercase tracking-[0.22em] mb-8"
        style={{ ...sansStyle, color: c.accent, fontWeight: 500 }}
      >
        {t.heroKicker}
      </div>

      <h1
        className="text-[60px] sm:text-[76px] leading-[0.98] mb-12 -tracking-[0.025em] whitespace-pre-line"
        style={{ ...serifStyle, color: c.text, fontWeight: 400 }}
      >
        {t.heroTitle}
      </h1>

      <div className="max-w-[36rem] mx-auto space-y-5 mb-12">
        {t.heroBody.map((para, i) => (
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
        {t.heroCta}
        <ArrowRight size={14} />
      </button>

      <div className="text-[12px] mt-5" style={{ ...sansStyle, color: c.textHint }}>
        {t.heroNote}
      </div>
    </section>
  );
}

function WhatIs({ lang }) {
  const { c } = useTheme();
  const t = COPY[lang];
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t.whatKicker} color={c.accent} />
      <SectionTitle text={t.whatTitle} />

      <p className="text-[17px] leading-[1.65] mt-8 mb-12 max-w-[36rem]" style={{ ...sansStyle, color: c.textMuted }}>
        {t.whatLead}
      </p>

      {/* "Not therapy. Not coaching. Not a crisis service." */}
      <div className="space-y-3 mb-14">
        {t.whatNot.map((word, i) => (
          <div
            key={i}
            className="text-[32px] sm:text-[40px] leading-[1.1] -tracking-[0.01em]"
            style={serifStyle}
          >
            <span style={{ color: c.textHint, fontWeight: 300 }}>{t.notWord} </span>
            <span style={{ color: c.text, fontWeight: 400 }}>{word}.</span>
          </div>
        ))}
      </div>

      <div
        className="text-[11px] uppercase tracking-[0.18em] mb-5"
        style={{ ...sansStyle, color: c.textHint, fontWeight: 500 }}
      >
        {t.whatHelpsLead}
      </div>
      <ul className="space-y-3">
        {t.whatHelpsItems.map((item, i) => (
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

function WhoFor({ lang }) {
  const { c } = useTheme();
  const t = COPY[lang];
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t.whoKicker} color={c.accentSage} />
      <SectionTitle text={t.whoTitle} />

      <p
        className="text-[15px] uppercase tracking-[0.04em] mt-10 mb-6"
        style={{ ...sansStyle, color: c.textMuted }}
      >
        {t.whoLead}
      </p>

      <ul className="space-y-5 mb-12">
        {t.whoScenarios.map((item, i) => (
          <li
            key={i}
            className="flex gap-4 pb-5"
            style={{ borderBottom: i === t.whoScenarios.length - 1 ? 'none' : `1px solid ${c.border}` }}
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
        {t.whoClose}
      </p>
    </section>
  );
}

function Safety({ lang }) {
  const { c } = useTheme();
  const t = COPY[lang];
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t.safetyKicker} color={c.accent} />
      <SectionTitle text={t.safetyTitle} />

      <p className="text-[17px] leading-[1.65] mt-8 mb-10 max-w-[36rem]" style={{ ...sansStyle, color: c.textMuted }}>
        {t.safetyLead}
      </p>

      <div className="space-y-5">
        {t.safetyItems.map((item, i) => (
          <p
            key={i}
            className="text-[16px] leading-[1.6] pb-5"
            style={{
              ...sansStyle,
              color: c.text,
              borderBottom: i === t.safetyItems.length - 1 ? 'none' : `1px solid ${c.border}`,
            }}
          >
            {item}
          </p>
        ))}
      </div>
    </section>
  );
}

function PathsSection({ lang }) {
  const { c } = useTheme();
  const t = COPY[lang];
  return (
    <section className="py-20" style={{ borderTop: `1px solid ${c.border}` }}>
      <div className="mb-16">
        <SectionKicker text={t.pathsKicker} color={c.accentSage} />
        <SectionTitle text={t.pathsTitle} />
      </div>

      <div className="space-y-12">
        {t.paths.map((p, i) => (
          <div
            key={p.name}
            className="grid grid-cols-1 sm:grid-cols-12 gap-6 pb-12 last:pb-0"
            style={{ borderBottom: i === t.paths.length - 1 ? 'none' : `1px solid ${c.border}` }}
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

function Different({ lang }) {
  const { c } = useTheme();
  const t = COPY[lang];
  return (
    <section className="py-20 text-center" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t.differentKicker} color={c.accent} />
      <h2
        className="text-[36px] sm:text-[44px] leading-[1.1] -tracking-[0.015em] whitespace-pre-line max-w-[36rem] mx-auto mb-12"
        style={{ ...serifStyle, color: c.text, fontWeight: 400 }}
      >
        {t.differentTitle}
      </h2>

      <ul className="space-y-3 max-w-[26rem] mx-auto text-left">
        {t.differentItems.map((item, i) => (
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

function ClosingCTA({ lang, onBegin }) {
  const { c } = useTheme();
  const t = COPY[lang];
  return (
    <section className="py-24 text-center" style={{ borderTop: `1px solid ${c.border}` }}>
      <SectionKicker text={t.closingKicker} color={c.accent} />
      <h2
        className="text-[56px] sm:text-[72px] leading-[1] mb-8 -tracking-[0.02em]"
        style={{ ...serifStyle, color: c.text, fontWeight: 400 }}
      >
        {t.closingTitle}
      </h2>
      <p className="text-[17px] leading-[1.65] mb-10 max-w-[34rem] mx-auto" style={{ ...sansStyle, color: c.textMuted }}>
        {t.closingBody}
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
        {t.closingCta}
        <ArrowRight size={14} />
      </button>
    </section>
  );
}

function Footer({ lang }) {
  const { c } = useTheme();
  const t = COPY[lang];
  return (
    <footer className="pt-16 pb-12" style={{ borderTop: `1px solid ${c.border}` }}>
      <div
        className="mb-12 rounded-xl p-6"
        style={{ background: c.bgSubtle, border: `1px solid ${c.border}` }}
      >
        <div
          className="text-[11px] uppercase tracking-[0.18em] mb-4"
          style={{ ...sansStyle, color: c.danger, fontWeight: 500 }}
        >
          {t.crisisLabel}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {t.crisisItems.map((item) => (
            <div key={item.name}>
              <div className="text-[15px] mb-0.5" style={{ ...serifStyle, color: c.text, fontWeight: 500 }}>
                {item.name}
              </div>
              <div className="text-[13px]" style={{ ...sansStyle, color: c.textMuted }}>
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[13px] leading-[1.7] mb-10 max-w-[42rem]" style={{ ...sansStyle, color: c.textHint }}>
        {t.footerDisclaimer}
      </p>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span style={{ color: c.text }}>
            <TreeMark size={22} />
          </span>
          <span className="text-[14px]" style={{ ...sansStyle, color: c.textHint }}>
            {t.footerCopy}
          </span>
        </div>
        <div className="flex items-center gap-5">
          {t.footerLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-[13px] transition-colors hover:underline"
              style={{ ...sansStyle, color: c.textMuted }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

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
export default function LandingPage() {
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('day');
  const [toast, setToast] = useState(null);

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

  const onBegin = () => { window.location.href = '/screening'; };

  return (
    <ThemeContext.Provider value={{ theme, c, toggle }}>
      <div className="min-h-screen transition-colors duration-500" style={{ background: c.bg, ...sansStyle }}>
        <div className="max-w-2xl mx-auto px-6">
          <Header lang={lang} setLang={setLang} />
          <Hero lang={lang} onBegin={onBegin} />
          <WhatIs lang={lang} />
          <WhoFor lang={lang} />
          <Safety lang={lang} />
          <PathsSection lang={lang} />
          <Different lang={lang} />
          <ClosingCTA lang={lang} onBegin={onBegin} />
          <Footer lang={lang} />
        </div>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    </ThemeContext.Provider>
  );
}
