'use client';

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { PALETTE, sansStyle, serifStyle } from '@/lib/brand/colors';
import Footer from '@/components/Footer';
import Link from 'next/link';

// ============================================================================
// MindReset — Pre-Screening Flow (Section 0)
// Brand: deep petrol teal + cream parchment.
// Day/night theming with system-preference detection.
// ============================================================================

const FONT_LINK_ID = 'mindreset-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=Geist:wght@400;500&display=swap';

// ============================================================================
// THEME — same family across day/night, like sunrise to sundown
// ============================================================================
const ThemeContext = createContext({ theme: 'day', c: PALETTE.day, toggle: () => {} });
const useTheme = () => useContext(ThemeContext);

// ============================================================================
// LANGUAGES — switch on `available` once content for that locale is translated
// ============================================================================
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
// BRAND MARK — tree-with-roots in mandala composition
// Two sizes: TreeMark (compact, for header) and TreeLogo (detailed, for hero).
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
// COPY (EN / RU)
// ============================================================================
const COPY = {
  en: {
    brand: 'MindReset',
    tagline: 'A trauma-informed self-help companion — not therapy, not a crisis service.',
    introTitle: 'Before we begin',
    introBody:
      'This short questionnaire helps us understand whether MindReset is the right fit for you right now. It takes about five minutes. Some questions are direct — answer honestly. If anything feels too much, you can close this tab at any moment.',
    ageGate: 'I confirm I am 18 or older.',
    notMedical: 'I understand this is not medical or psychiatric treatment.',
    begin: 'Begin',
    next: 'Continue',
    back: 'Back',
    finish: 'See result',
    startOver: 'Start over',
    submitLoadingKicker: 'One moment',
    submitLoading: 'Saving your answers…',
    submitErrorTitle: "Couldn't save",
    submitErrorBody: 'Your answers came through but we had trouble saving them — please refresh and try again.',
    retryButton: 'Try again',
    selectAll: 'Tick anything that applies to you right now.',
    rateScaleHigh: '0 = not at all, 5 = extremely',
    rateScaleLow: '0 = not present, 5 = very present',
    pickOne: 'Choose the one that best describes you.',
    yes: 'Yes',
    no: 'No',
    progress: 'Step',
    of: 'of',
    secExclusion: 'Important first',
    secFunctionality: 'How you function day to day',
    secEmotional: 'Emotional state right now',
    secTrauma: 'Past wounds',
    secCognitive: 'Practicalities',
    secConsent: 'Agreement',
    exclusionTitle: 'Is any of this true for you in this period of your life?',
    functionalityTitle: 'How much does each of these match your current life?',
    emotionalTitle: 'How present is each of these for you right now?',
    traumaTitle: 'Which of these is closest to how things feel about your past?',
    cognitiveTitle: 'A few quick checks.',
    consentTitle: 'Before you proceed, please confirm you understand:',
    exclusion: [
      'Current thoughts of suicide, with intent or a plan',
      'A suicide attempt in the past 12 months',
      'Self-harm in the past 3 months',
      'A diagnosis of schizophrenia, schizoaffective disorder, or psychosis',
      'A diagnosis of bipolar disorder with manic episodes',
      'Severe depression that stops you doing daily tasks',
      'Untreated severe PTSD or complex PTSD',
      'Active drug or alcohol dependence',
      'Current hallucinations or delusions',
      'Living in a home that is currently unsafe (domestic violence)',
      'A current eating disorder with medical instability',
    ],
    functionality: [
      'I can do daily things — wash, eat, work, basic tasks',
      'I can focus on a conversation for at least 10 minutes',
      'I feel safe in my home environment',
      'I can regulate myself, at least partially, when upset',
      'I can feel basic emotions, rather than complete numbness',
      'I can describe my feelings in simple words',
    ],
    emotional: [
      'I feel overwhelmed constantly',
      'I have frequent panic attacks',
      'I shut down emotionally (freeze) often',
      'I dissociate — feel unreal, disconnected',
      'I get triggered suddenly and lose control',
    ],
    trauma: [
      'I have mild emotional wounds but function normally',
      'I have unresolved past issues but can stay stable',
      'My past trauma overwhelms me regularly',
      'I cannot stay emotionally safe when remembering the past',
    ],
    cognitive: [
      'I can follow instructions step by step',
      'I can imagine simple things, or sense them through the body',
      'I understand that MindReset requires active participation from me',
    ],
    consent: [
      'MindReset is not medical or psychiatric treatment',
      'MindReset cannot support a crisis, suicidal state, or psychosis',
      'I will be honest about my symptoms in each session',
      'I will stop the process if I feel unsafe',
      'The AI may stop the process for safety reasons, and I accept that',
      'I take responsibility for my decisions and life changes',
      'I understand MindReset only works if I actively participate',
      'I consent to proceed voluntarily',
    ],
    redKicker: 'Please pause here',
    redTitle: 'MindReset is not the right fit for you right now',
    redBody:
      'What you described needs more than an AI companion can safely offer. That is not a failure on your part — it just means a real human, with proper training, is the right next step. Please reach out today, not tomorrow.',
    redResourcesTitle: 'Where to turn now',
    redResources: [
      { name: 'Samaritans', detail: 'Call 116 123 — free, 24/7, any reason' },
      { name: 'NHS 111', detail: 'Press option 2 for the mental health line' },
      { name: 'Your GP', detail: 'Ask for an urgent same-day appointment' },
      { name: 'A&E or 999', detail: 'If you feel unsafe right now' },
    ],
    redFooter:
      'We are not the right service for this moment, but the people above are. You deserve to be heard by someone who can really help.',
    yellowKicker: 'Caution path',
    yellowTitle: 'MindReset can help, but gently',
    yellowBody:
      'Your answers tell us your nervous system is carrying a lot right now. The deeper modules of MindReset will not serve you well yet — they could make things harder, not easier. The right starting point is stabilisation work, focused only on bringing your system back into balance before going further.',
    yellowNextTitle: 'What we suggest',
    yellowNext: [
      'Begin with MiniMind — the AI companion with daily check-ins and short grounding practices',
      'No deep modules, no parts work, no past-focused exercises until your daily functioning is steadier',
      'If you would like human support alongside, we can share a directory of trauma-informed practitioners',
    ],
    yellowCta: "When you're ready",
    greenKicker: 'Welcome',
    greenTitle: 'You are ready to begin',
    greenBody:
      'Your answers suggest MindReset is a good fit for you right now. Below is what to expect, and the next step.',
    greenNextTitle: 'What happens next',
    greenNext: [
      'You will create an account with your email',
      'Before any module, you will see a short introduction explaining what to expect',
      'Each session, the AI starts by checking in with how you are — there is never pressure to go further than feels right',
      'You can pause, slow down, or stop at any moment',
    ],
    greenCta: 'Continue → Create your account',
    sessionRef: 'Reference',
  },
  ru: {
    brand: 'MindReset',
    tagline: 'Травма-информированный спутник самопомощи — не терапия, не служба кризисной помощи.',
    introTitle: 'Прежде чем начать',
    introBody:
      'Эта короткая анкета поможет понять, подходит ли MindReset вам сейчас. Занимает около пяти минут. Некоторые вопросы прямые — отвечайте честно. Если станет трудно, можно закрыть вкладку в любой момент.',
    ageGate: 'Подтверждаю, что мне 18 лет или больше.',
    notMedical: 'Понимаю, что это не медицинская и не психиатрическая помощь.',
    begin: 'Начать',
    next: 'Дальше',
    back: 'Назад',
    finish: 'Увидеть результат',
    startOver: 'Начать заново',
    submitLoadingKicker: 'Минуту',
    submitLoading: 'Сохраняем ваши ответы…',
    submitErrorTitle: 'Не удалось сохранить',
    submitErrorBody: 'Ваши ответы получены, но нам не удалось их сохранить — пожалуйста, обновите страницу и попробуйте снова.',
    retryButton: 'Попробовать снова',
    selectAll: 'Отметьте всё, что относится к вам сейчас.',
    rateScaleHigh: '0 — совсем нет, 5 — очень сильно',
    rateScaleLow: '0 — нет, 5 — очень присутствует',
    pickOne: 'Выберите вариант, который ближе всего.',
    yes: 'Да',
    no: 'Нет',
    progress: 'Шаг',
    of: 'из',
    secExclusion: 'Сначала важное',
    secFunctionality: 'Как вы живёте день за днём',
    secEmotional: 'Состояние сейчас',
    secTrauma: 'Прошлые раны',
    secCognitive: 'Практические вопросы',
    secConsent: 'Согласие',
    exclusionTitle: 'Есть ли у вас сейчас что-либо из этого?',
    functionalityTitle: 'Насколько это соответствует вашей жизни сейчас?',
    emotionalTitle: 'Насколько это присутствует у вас сейчас?',
    traumaTitle: 'Что из этого ближе всего к тому, как ощущается ваше прошлое?',
    cognitiveTitle: 'Несколько коротких проверок.',
    consentTitle: 'Прежде чем продолжить, пожалуйста, подтвердите, что вы понимаете:',
    exclusion: [
      'Сейчас есть суицидальные мысли с намерением или планом',
      'Попытка суицида за последние 12 месяцев',
      'Самоповреждение за последние 3 месяца',
      'Диагноз — шизофрения, шизоаффективное расстройство, психоз',
      'Диагноз — биполярное расстройство с маниакальными эпизодами',
      'Тяжёлая депрессия, мешающая обычным делам',
      'Нелеченая тяжёлая ПТСР или комплексная ПТСР',
      'Активная зависимость (наркотики, алкоголь)',
      'Сейчас есть галлюцинации или бред',
      'Дом сейчас небезопасен (домашнее насилие)',
      'Сейчас расстройство пищевого поведения с медицинской нестабильностью',
    ],
    functionality: [
      'Справляюсь с повседневными делами — мыться, есть, работать, базовые задачи',
      'Могу сосредоточиться на разговоре хотя бы 10 минут',
      'Дома я чувствую себя в безопасности',
      'Могу хотя бы частично себя успокоить',
      'Могу чувствовать базовые эмоции, а не полное онемение',
      'Могу описать свои чувства простыми словами',
    ],
    emotional: [
      'Чувствую себя перегруженной постоянно',
      'Часто бывают панические атаки',
      'Часто эмоционально замыкаюсь, замираю',
      'Бывает диссоциация — ощущение нереальности, оторванности',
      'Внезапно срабатывают триггеры, теряю контроль',
    ],
    trauma: [
      'Есть лёгкие эмоциональные раны, но в целом я функционирую',
      'Есть нерешённые проблемы прошлого, но я остаюсь устойчивой',
      'Прошлая травма регулярно меня захватывает',
      'Не могу оставаться в безопасности, когда вспоминаю прошлое',
    ],
    cognitive: [
      'Могу выполнять инструкции шаг за шагом',
      'Могу представить простые вещи или почувствовать их через тело',
      'Понимаю, что MindReset требует моего активного участия',
    ],
    consent: [
      'MindReset не является медицинской или психиатрической помощью',
      'MindReset не может поддержать в кризисе, при суицидальных мыслях или психозе',
      'Буду честна о своих симптомах на каждой сессии',
      'Остановлю процесс, если почувствую себя небезопасно',
      'AI может остановить процесс ради моей безопасности, я это принимаю',
      'Беру ответственность за свои решения и изменения в жизни',
      'Понимаю, что MindReset работает только при моём активном участии',
      'Соглашаюсь продолжить добровольно',
    ],
    redKicker: 'Сейчас сделаем паузу',
    redTitle: 'MindReset вам сейчас не подходит',
    redBody:
      'То, что вы описали, требует большего, чем AI-спутник может безопасно предложить. Это не ваша неудача — это просто значит, что подходящий следующий шаг — живой человек с настоящей подготовкой. Пожалуйста, обратитесь сегодня, а не завтра.',
    redResourcesTitle: 'Куда обратиться сейчас',
    redResources: [
      { name: 'Samaritans (UK)', detail: '116 123 — бесплатно, круглосуточно, по любому поводу' },
      { name: 'NHS 111', detail: 'Нажмите вариант 2 — линия психического здоровья' },
      { name: 'Ваш GP', detail: 'Попросите срочный приём в тот же день' },
      { name: 'A&E или 999', detail: 'Если небезопасно прямо сейчас' },
    ],
    redFooter:
      'Мы — не та служба для этого момента, но люди выше — те. Вы заслуживаете быть услышанной тем, кто действительно может помочь.',
    yellowKicker: 'Путь с осторожностью',
    yellowTitle: 'MindReset может помочь — но мягко',
    yellowBody:
      'Ваши ответы говорят, что нервная система сейчас несёт многое. Глубокие модули MindReset вам пока не подойдут — они могут сделать сложнее, а не легче. Правильная отправная точка — стабилизирующая работа, направленная только на возвращение системы в баланс, прежде чем идти глубже.',
    yellowNextTitle: 'Что мы предлагаем',
    yellowNext: [
      'Начать с MiniMind — AI-спутник с ежедневной проверкой состояния и короткими заземляющими практиками',
      'Никаких глубоких модулей, работы с частями или практик прошлого, пока повседневная устойчивость не вернётся',
      'Если хотите дополнительной живой поддержки, мы поделимся каталогом trauma-informed специалистов',
    ],
    yellowCta: 'Когда будешь готова',
    greenKicker: 'Добро пожаловать',
    greenTitle: 'Вы готовы начать',
    greenBody: 'Ваши ответы говорят, что MindReset вам сейчас подходит. Ниже — чего ожидать и каков следующий шаг.',
    greenNextTitle: 'Что будет дальше',
    greenNext: [
      'Создадите аккаунт по электронной почте',
      'Перед любым модулем будет короткое введение — что ожидать',
      'В начале каждой сессии AI спрашивает, как вы — без давления идти дальше, чем хочется',
      'Можно остановиться, замедлиться или прекратить в любой момент',
    ],
    greenCta: 'Продолжить — создать аккаунт',
    sessionRef: 'Идентификатор',
  },
};

// ============================================================================
// UI atoms — theme-aware via context
// ============================================================================
function Check({ checked, onChange, children }) {
  const { c } = useTheme();
  return (
    <label className="flex items-start gap-3 cursor-pointer group py-2.5">
      <span
        className="mt-[3px] shrink-0 w-[18px] h-[18px] rounded border-[1.5px] flex items-center justify-center transition-colors"
        style={{
          background: checked ? c.text : c.bgCard,
          borderColor: checked ? c.text : c.borderStrong,
        }}
      >
        {checked && (
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke={c.bg} strokeWidth="2.5">
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
  const { c } = useTheme();
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
    const click = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const key = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
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
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current.code}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-10 rounded-lg overflow-hidden min-w-[180px] z-20"
          style={{
            background: c.bgCard,
            border: `1px solid ${c.border}`,
            boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.18)',
          }}
        >
          {LANGUAGES.map((l) => {
            const isActive = lang === l.code;
            return (
              <button
                key={l.code}
                type="button"
                disabled={!l.available}
                onClick={() => {
                  if (l.available) {
                    setLang(l.code);
                    setOpen(false);
                  }
                }}
                role="option"
                aria-selected={isActive}
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
                  <span className="text-[9px] uppercase tracking-wider" style={{ color: c.textHint }}>
                    soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Header({ lang, setLang, step, total, brand, showProgress }) {
  const { c } = useTheme();
  return (
    <header className="mb-10 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span style={{ color: c.text }}>
          <TreeMark size={26} />
        </span>
        <span
          className="text-[20px] tracking-tight"
          style={{
            ...serifStyle,
            fontWeight: 500,
            fontVariationSettings: '"opsz" 144, "SOFT" 50',
          }}
        >
          <span style={{ color: c.accent }}>Mind</span>
          <span style={{ color: c.accentSage }}>Reset</span>
          <span style={{ color: c.textHint }} className="ml-0.5">.ai</span>
        </span>
        {showProgress && (
          <span
            className="ml-4 text-[11px] uppercase tracking-[0.16em]"
            style={{ ...sansStyle, color: c.textHint }}
          >
            {COPY[lang].progress} {step + 1} {COPY[lang].of} {total}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <LangSwitch lang={lang} setLang={setLang} />
        <ThemeToggle />
      </div>
    </header>
  );
}

function ProgressBar({ step, total }) {
  const { c } = useTheme();
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
  const { c } = useTheme();
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
  const { c } = useTheme();
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

function NavRow({ onBack, onNext, nextLabel, nextDisabled, lang }) {
  const { c } = useTheme();
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
          ← {COPY[lang].back}
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
function IntroScreen({ lang, setLang, onBegin }) {
  const { c } = useTheme();
  const t = COPY[lang];
  const [age, setAge] = useState(false);
  const [notMed, setNotMed] = useState(false);
  return (
    <>
      <Header lang={lang} setLang={setLang} brand={t.brand} showProgress={false} />
      <div className="mt-8 text-[11px] uppercase tracking-[0.18em] mb-8" style={{ ...sansStyle, color: c.accent, fontWeight: 500 }}>
        {t.tagline}
      </div>
      <h1
        className="text-[48px] leading-[1.02] mb-8 -tracking-[0.015em]"
        style={{ ...serifStyle, color: c.text, fontWeight: 400 }}
      >
        {t.introTitle}
      </h1>
      <p className="text-[17px] leading-[1.6] mb-10 max-w-[34rem]" style={{ ...sansStyle, color: c.textMuted }}>
        {t.introBody}
      </p>
      <div className="pt-4" style={{ borderTop: `1px solid ${c.border}` }}>
        <Check checked={age} onChange={setAge}>{t.ageGate}</Check>
        <Check checked={notMed} onChange={setNotMed}>{t.notMedical}</Check>
      </div>
      <NavRow onBack={null} onNext={onBegin} nextLabel={t.begin} nextDisabled={!age || !notMed} lang={lang} />
    </>
  );
}

function ExclusionScreen({ lang, setLang, step, total, onBack, onNext, value, setValue }) {
  const t = COPY[lang];
  return (
    <>
      <Header lang={lang} setLang={setLang} step={step} total={total} brand={t.brand} showProgress />
      <ProgressBar step={step} total={total} />
      <SectionTitle kicker={t.secExclusion} title={t.exclusionTitle} helper={t.selectAll} />
      <div>
        {t.exclusion.map((label, i) => (
          <Check key={i} checked={value[i] || false} onChange={(v) => setValue({ ...value, [i]: v })}>
            {label}
          </Check>
        ))}
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextLabel={t.next} nextDisabled={false} lang={lang} />
    </>
  );
}

function ScaleScreen({ lang, setLang, step, total, onBack, onNext, value, setValue, items, kicker, title, helper }) {
  const { c } = useTheme();
  const t = COPY[lang];
  const answered = items.every((_, i) => typeof value[i] === 'number');
  return (
    <>
      <Header lang={lang} setLang={setLang} step={step} total={total} brand={t.brand} showProgress />
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
      <NavRow onBack={onBack} onNext={onNext} nextLabel={t.next} nextDisabled={!answered} lang={lang} />
    </>
  );
}

function TraumaScreen({ lang, setLang, step, total, onBack, onNext, value, setValue }) {
  const { c } = useTheme();
  const t = COPY[lang];
  return (
    <>
      <Header lang={lang} setLang={setLang} step={step} total={total} brand={t.brand} showProgress />
      <ProgressBar step={step} total={total} />
      <SectionTitle kicker={t.secTrauma} title={t.traumaTitle} helper={t.pickOne} />
      <div className="space-y-2">
        {t.trauma.map((label, i) => {
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
      <NavRow onBack={onBack} onNext={onNext} nextLabel={t.next} nextDisabled={value === null} lang={lang} />
    </>
  );
}

function CognitiveScreen({ lang, setLang, step, total, onBack, onNext, value, setValue }) {
  const { c } = useTheme();
  const t = COPY[lang];
  const answered = t.cognitive.every((_, i) => value[i] === 'yes' || value[i] === 'no');
  return (
    <>
      <Header lang={lang} setLang={setLang} step={step} total={total} brand={t.brand} showProgress />
      <ProgressBar step={step} total={total} />
      <SectionTitle kicker={t.secCognitive} title={t.cognitiveTitle} />
      <div>
        {t.cognitive.map((label, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-6 py-4"
            style={{ borderBottom: i === t.cognitive.length - 1 ? 'none' : `1px solid ${c.border}` }}
          >
            <p className="text-[15px] leading-[1.5] flex-1" style={{ ...sansStyle, color: c.text }}>
              {label}
            </p>
            <div className="flex gap-2 shrink-0">
              <Pill active={value[i] === 'yes'} onClick={() => setValue({ ...value, [i]: 'yes' })}>{t.yes}</Pill>
              <Pill active={value[i] === 'no'} onClick={() => setValue({ ...value, [i]: 'no' })}>{t.no}</Pill>
            </div>
          </div>
        ))}
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextLabel={t.next} nextDisabled={!answered} lang={lang} />
    </>
  );
}

function ConsentScreen({ lang, setLang, step, total, onBack, onNext, value, setValue }) {
  const t = COPY[lang];
  return (
    <>
      <Header lang={lang} setLang={setLang} step={step} total={total} brand={t.brand} showProgress />
      <ProgressBar step={step} total={total} />
      <SectionTitle kicker={t.secConsent} title={t.consentTitle} />
      <div>
        {t.consent.map((label, i) => (
          <Check key={i} checked={value[i] || false} onChange={(v) => setValue({ ...value, [i]: v })}>
            {label}
          </Check>
        ))}
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextLabel={t.finish} nextDisabled={false} lang={lang} />
    </>
  );
}

function ResultScreen({ lang, setLang, result, onStartOver, sessionId }) {
  const { c } = useTheme();
  const t = COPY[lang];

  if (result === 'red') {
    return (
      <>
        <Header lang={lang} setLang={setLang} brand={t.brand} showProgress={false} />
        <div className="pl-6 mb-10" style={{ borderLeft: `2px solid ${c.danger}` }}>
          <div className="text-[11px] uppercase tracking-[0.18em] mb-4" style={{ ...sansStyle, color: c.danger, fontWeight: 500 }}>
            {t.redKicker}
          </div>
          <h2 className="text-[32px] leading-[1.15] mb-5" style={{ ...serifStyle, color: c.text, fontWeight: 400 }}>
            {t.redTitle}
          </h2>
          <p className="text-[16px] leading-[1.65]" style={{ ...sansStyle, color: c.textMuted }}>
            {t.redBody}
          </p>
        </div>

        <div className="text-[11px] uppercase tracking-[0.18em] mb-5" style={{ ...sansStyle, color: c.textHint, fontWeight: 500 }}>
          {t.redResourcesTitle}
        </div>
        <div className="space-y-3 mb-12">
          {t.redResources.map((r, i) => (
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
          {t.redFooter}
        </p>

        <div className="mt-12 pt-6 flex items-center justify-between" style={{ borderTop: `1px solid ${c.border}` }}>
          <span className="text-[11px] tabular-nums" style={{ ...sansStyle, color: c.textHint }}>
            {t.sessionRef}: {sessionId}
          </span>
          <button
            onClick={onStartOver}
            className="text-[13px] transition-colors"
            style={{ ...sansStyle, color: c.textMuted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = c.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = c.textMuted)}
          >
            {t.startOver}
          </button>
        </div>
      </>
    );
  }

  const isYellow = result === 'yellow';
  const accentBorderColor = isYellow ? c.warning : c.success;
  const accentTextColor = isYellow ? c.warning : c.success;
  const kicker = isYellow ? t.yellowKicker : t.greenKicker;
  const titleText = isYellow ? t.yellowTitle : t.greenTitle;
  const bodyText = isYellow ? t.yellowBody : t.greenBody;
  const nextTitle = isYellow ? t.yellowNextTitle : t.greenNextTitle;
  const nextItems = isYellow ? t.yellowNext : t.greenNext;
  const ctaLabel = isYellow ? t.yellowCta : t.greenCta;

  return (
    <>
      <Header lang={lang} setLang={setLang} brand={t.brand} showProgress={false} />
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
          {t.sessionRef}: {sessionId}
        </span>
        <button
          onClick={onStartOver}
          className="text-[13px] transition-colors"
          style={{ ...sansStyle, color: c.textMuted }}
          onMouseEnter={(e) => (e.currentTarget.style.color = c.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = c.textMuted)}
        >
          {t.startOver}
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

export default function ScreeningFlow() {
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('day');
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
    // Respect system preference on first load
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) setTheme('night');
    } catch (e) {
      // matchMedia not available, default to day
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

  const toggle = () => setTheme((t) => (t === 'day' ? 'night' : 'day'));
  const c = PALETTE[theme];

  const reset = () => {
    setAnswers(initialAnswers());
    setStep(-1);
    setSubmitting(false);
    setSubmitError(false);
    setServerResult(null);
  };

  const t = COPY[lang];
  let screen;
  if (step === -1) {
    screen = <IntroScreen lang={lang} setLang={setLang} onBegin={() => setStep(0)} />;
  } else if (step === 0) {
    screen = (
      <ExclusionScreen
        lang={lang} setLang={setLang} step={0} total={TOTAL_STEPS}
        onBack={() => setStep(-1)} onNext={() => setStep(1)}
        value={answers.exclusion} setValue={(v) => setAnswers({ ...answers, exclusion: v })}
      />
    );
  } else if (step === 1) {
    screen = (
      <ScaleScreen
        lang={lang} setLang={setLang} step={1} total={TOTAL_STEPS}
        onBack={() => setStep(0)} onNext={() => setStep(2)}
        value={answers.functionality} setValue={(v) => setAnswers({ ...answers, functionality: v })}
        items={t.functionality} kicker={t.secFunctionality} title={t.functionalityTitle} helper={t.rateScaleHigh}
      />
    );
  } else if (step === 2) {
    screen = (
      <ScaleScreen
        lang={lang} setLang={setLang} step={2} total={TOTAL_STEPS}
        onBack={() => setStep(1)} onNext={() => setStep(3)}
        value={answers.emotional} setValue={(v) => setAnswers({ ...answers, emotional: v })}
        items={t.emotional} kicker={t.secEmotional} title={t.emotionalTitle} helper={t.rateScaleLow}
      />
    );
  } else if (step === 3) {
    screen = (
      <TraumaScreen
        lang={lang} setLang={setLang} step={3} total={TOTAL_STEPS}
        onBack={() => setStep(2)} onNext={() => setStep(4)}
        value={answers.trauma} setValue={(v) => setAnswers({ ...answers, trauma: v })}
      />
    );
  } else if (step === 4) {
    screen = (
      <CognitiveScreen
        lang={lang} setLang={setLang} step={4} total={TOTAL_STEPS}
        onBack={() => setStep(3)} onNext={() => setStep(5)}
        value={answers.cognitive} setValue={(v) => setAnswers({ ...answers, cognitive: v })}
      />
    );
  } else if (step === 5) {
    screen = (
      <ConsentScreen
        lang={lang} setLang={setLang} step={5} total={TOTAL_STEPS}
        onBack={() => setStep(4)} onNext={() => setStep(6)}
        value={answers.consent} setValue={(v) => setAnswers({ ...answers, consent: v })}
      />
    );
  } else {
    if (submitError) {
      screen = (
        <>
          <Header lang={lang} setLang={setLang} brand={t.brand} showProgress={false} />
          <div className="pl-6 mb-10" style={{ borderLeft: `2px solid ${c.danger}` }}>
            <h2 className="text-[24px] leading-[1.25] mb-3" style={{ ...serifStyle, color: c.text, fontWeight: 400 }}>
              {t.submitErrorTitle}
            </h2>
            <p className="text-[16px] leading-[1.65] mb-6" style={{ ...sansStyle, color: c.textMuted }}>
              {t.submitErrorBody}
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
              {t.retryButton}
            </button>
          </div>
        </>
      );
    } else if (submitting || serverResult === null) {
      screen = (
        <>
          <Header lang={lang} setLang={setLang} brand={t.brand} showProgress={false} />
          <div className="pl-6 mb-10" style={{ borderLeft: `2px solid ${c.accent}` }}>
            <div
              className="text-[11px] uppercase tracking-[0.22em] mb-3"
              style={{ ...sansStyle, color: c.accent, fontWeight: 500 }}
            >
              {t.submitLoadingKicker}
            </div>
            <p className="text-[18px] leading-[1.5]" style={{ ...serifStyle, color: c.text, fontWeight: 400 }}>
              {t.submitLoading}
            </p>
          </div>
        </>
      );
    } else {
      screen = <ResultScreen lang={lang} setLang={setLang} result={serverResult} onStartOver={reset} sessionId={sessionId} />;
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, c, toggle }}>
      <div
        className="min-h-screen transition-colors duration-500"
        style={{ background: c.bg, ...sansStyle }}
      >
        <div className="max-w-2xl mx-auto px-6 py-12 sm:py-20">
          {screen}
          <Footer theme={theme} />
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
