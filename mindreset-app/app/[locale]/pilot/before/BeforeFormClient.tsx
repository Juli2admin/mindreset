'use client';

// Pilot Before form — client UI.
//
// PR ω3a (2026-07-14). Full form from Julia's authored pilot-forms md.
// Sections: intro → consent → about you → your pattern → 6 Likert
// scales → hope in a month. Submit hits POST /api/pilot/questionnaire;
// on ok the client shows the "Thank you — start The Journey" screen
// with a link to /journey.
//
// Intentionally i18n-agnostic at the copy layer: EN + RU strings live
// inline in this file (they come straight from Julia's md and are
// pilot-only content). No public translation surface.

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
import TopBar from '@/components/TopBar';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

type Locale = 'en' | 'ru';

type Copy = {
  kicker: string;
  h1: string;
  intro: string;
  submit: string;
  submitting: string;
  alreadyTitle: string;
  alreadyBody: string;
  toJourney: string;
  errorNetwork: string;
  errorValidation: string;
  // Section headings
  hConsent: string;
  hAboutYou: string;
  hYourPattern: string;
  hScales: string;
  scalesLead: string;
  hHope: string;
  // Consent
  consent: {
    selfHelpNotTherapy: string;
    notCrisisService: string;
    ageAndNotInCrisis: string;
    ukGdprAcknowledged: string;
    anonymisedFeedback: string;
    optionalHeader: string;
    quotableAnonymously: string;
    willingToTalkToJulia: string;
    followUpAt3Months: string;
  };
  // About you
  aboutYou: {
    age: string;
    ageOptions: readonly [string, string, string, string, string];
    gender: string;
    genderOptions: readonly [string, string, string, string];
    language: string;
    languageOptions: readonly [string, string];
    triedBefore: string;
    triedBeforeOptions: readonly [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    workingWith: string;
    workingWithOptions: readonly [string, string];
  };
  // Your pattern
  yourPattern: {
    patternText: string;
    patternTextHelp: string;
    patternsThatFit: string;
    patternsThatFitOptions: readonly [
      string, string, string, string, string,
      string, string, string, string, string,
    ];
    duration: string;
    durationOptions: readonly [string, string, string, string];
  };
  scales: readonly [string, string, string, string, string, string];
  hope: string;
  hopeHelp: string;
  // Bottom safety note
  safetyNote: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    kicker: 'MindReset · Pilot · Before',
    h1: 'Before you begin.',
    intro:
      "Thank you for joining the MindReset pilot. This takes about 5 minutes. Please answer honestly — not kindly. Honest answers are the only useful ones.\n\nThis is a self-help wellbeing tool. It is not therapy, not diagnosis, not a crisis service. If you are in crisis, call Samaritans 116 123 (UK) or your local emergency number.",
    submit: 'Save and open The Journey →',
    submitting: 'Saving…',
    alreadyTitle: 'You already filled this form. Thank you.',
    alreadyBody:
      "The Before questionnaire is submitted. Your access is active — The Journey is waiting.",
    toJourney: 'Open The Journey →',
    errorNetwork:
      "We couldn't reach the server. Please try again — your answers are still on this page.",
    errorValidation:
      "Please answer every required question. Any 0–10 scale needs a number; every free-text field needs a sentence.",
    hConsent: 'Consent',
    hAboutYou: 'About you',
    hYourPattern: 'Your pattern',
    hScales: 'Baseline scores (0–10)',
    scalesLead:
      "These same six questions will repeat at the end — this is the pilot's measurement. Please give the number that fits today.",
    hHope: 'One month from now',
    consent: {
      selfHelpNotTherapy:
        'I understand this is a self-help tool, not therapy, diagnosis or treatment.',
      notCrisisService:
        'I understand it is not a crisis service and I know what to do if I need urgent help.',
      ageAndNotInCrisis: 'I am 18 or over, and I am not currently in crisis.',
      ukGdprAcknowledged:
        'I understand I can stop at any time, and my data will be handled under UK GDPR.',
      anonymisedFeedback:
        'I agree my anonymised feedback may be used for product development, marketing, investor discussions and future professional submissions.',
      optionalHeader: 'Optional',
      quotableAnonymously:
        "I'm willing to be quoted anonymously (e.g. \"Anna, 42\").",
      willingToTalkToJulia:
        "I'm willing to have a short conversation with Julia.",
      followUpAt3Months: 'Contact me for a 3-month follow-up.',
    },
    aboutYou: {
      age: 'Age',
      ageOptions: ['18–24', '25–34', '35–44', '45–54', '55+'] as const,
      gender: 'Gender',
      genderOptions: ['Female', 'Male', 'Other', 'Prefer not to say'] as const,
      language: "Language you'll use",
      languageOptions: ['Russian', 'English'] as const,
      triedBefore: 'Have you tried before? (tick all that apply)',
      triedBeforeOptions: [
        'Therapy',
        'Self-help books',
        'Meditation apps',
        'Coaching',
        'Journalling',
        'Nothing',
      ] as const,
      workingWith: 'Are you currently working with a therapist or coach?',
      workingWithOptions: ['Yes', 'No'] as const,
    },
    yourPattern: {
      patternText:
        "Which pattern do you keep repeating that you'd like to understand?",
      patternTextHelp: '2–3 sentences is enough.',
      patternsThatFit: 'Which of these fit you? (tick all that apply)',
      patternsThatFitOptions: [
        'People-pleasing',
        "Can't say no",
        'Staying in relationships that hurt',
        'Overthinking',
        'Anxiety',
        'Feeling empty or disconnected',
        'Tired no matter how much I sleep',
        'Hard on myself',
        'Money / self-worth',
        'Avoiding things',
      ] as const,
      duration: 'How long?',
      durationOptions: [
        'Under a year',
        '1–5 years',
        '5–10 years',
        'As long as I remember',
      ] as const,
    },
    scales: [
      'I understand why I react the way I do.',
      'I notice the reaction before it takes over.',
      'I feel able to choose a different response.',
      'I am hard on myself about this.',
      'This affects my daily life.',
      'I feel stuck.',
    ] as const,
    hope: 'What do you hope is different in a month?',
    hopeHelp: 'One or two lines.',
    safetyNote:
      'This is a self-help wellbeing tool — not therapy, not a crisis service. If you are in immediate distress, please contact your local emergency service.',
  },
  ru: {
    kicker: 'MindReset · Пилот · Форма «До»',
    h1: 'До того, как Вы начнёте.',
    intro:
      'Спасибо, что согласились участвовать в пилоте MindReset. Это займёт около 5 минут. Отвечайте честно, а не вежливо. Полезны только честные ответы.\n\nЭто инструмент самопомощи. Это не терапия, не диагностика и не кризисная служба. Если Вы в кризисе — обратитесь за профессиональной помощью или в экстренную службу.',
    submit: 'Сохранить и открыть Путь →',
    submitting: 'Сохраняю…',
    alreadyTitle: 'Вы уже заполнили эту форму. Спасибо.',
    alreadyBody:
      'Форма «До» отправлена. Ваш доступ активен — Путь Вас ждёт.',
    toJourney: 'Открыть Путь →',
    errorNetwork:
      'Не удалось связаться с сервером. Пожалуйста, попробуйте ещё раз — Ваши ответы остаются на странице.',
    errorValidation:
      'Пожалуйста, ответьте на все обязательные вопросы. Каждой шкале 0–10 нужен номер, каждому текстовому полю — предложение.',
    hConsent: 'Согласие',
    hAboutYou: 'О Вас',
    hYourPattern: 'Ваш паттерн',
    hScales: 'Исходные оценки (0–10)',
    scalesLead:
      'Эти же шесть вопросов повторятся в конце — это и есть измерение пилота. Поставьте число, которое подходит Вам сегодня.',
    hHope: 'Через месяц',
    consent: {
      selfHelpNotTherapy:
        'Я понимаю, что это инструмент самопомощи, а не терапия, диагностика или лечение.',
      notCrisisService:
        'Я понимаю, что это не кризисная служба, и знаю, куда обратиться в экстренной ситуации.',
      ageAndNotInCrisis:
        'Мне 18 лет или больше, и я не нахожусь в состоянии кризиса.',
      ukGdprAcknowledged:
        'Я понимаю, что могу прекратить в любой момент, и мои данные обрабатываются согласно UK GDPR.',
      anonymisedFeedback:
        'Я согласна(-ен), что мой анонимный отзыв может использоваться для развития продукта, маркетинга, общения с инвесторами и будущих профессиональных заявок.',
      optionalHeader: 'Необязательно',
      quotableAnonymously:
        'Согласна(-ен) на анонимную цитату (например «Анна, 42»).',
      willingToTalkToJulia: 'Согласна(-ен) на короткий разговор с Юлией.',
      followUpAt3Months: 'Свяжитесь со мной через 3 месяца.',
    },
    aboutYou: {
      age: 'Возраст',
      ageOptions: ['18–24', '25–34', '35–44', '45–54', '55+'] as const,
      gender: 'Пол',
      genderOptions: [
        'Женский',
        'Мужской',
        'Другое',
        'Не хочу отвечать',
      ] as const,
      language: 'Язык',
      languageOptions: ['Русский', 'Английский'] as const,
      triedBefore: 'Что Вы уже пробовали? (отметьте всё)',
      triedBeforeOptions: [
        'Терапия',
        'Книги по саморазвитию',
        'Приложения для медитации',
        'Коучинг',
        'Дневник',
        'Ничего',
      ] as const,
      workingWith: 'Работаете сейчас с терапевтом или коучем?',
      workingWithOptions: ['Да', 'Нет'] as const,
    },
    yourPattern: {
      patternText: 'Какой паттерн Вы повторяете и хотели бы понять?',
      patternTextHelp: 'Достаточно 2–3 предложений.',
      patternsThatFit: 'Что Вам подходит? (отметьте всё)',
      patternsThatFitOptions: [
        'Угождение другим',
        'Не могу сказать «нет»',
        'Остаюсь в отношениях, которые ранят',
        'Постоянные размышления',
        'Тревога',
        'Пустота, отключённость',
        'Усталость, несмотря на сон',
        'Строга(-г) к себе',
        'Деньги и самооценка',
        'Избегание',
      ] as const,
      duration: 'Как долго?',
      durationOptions: [
        'Меньше года',
        '1–5 лет',
        '5–10 лет',
        'Сколько себя помню',
      ] as const,
    },
    scales: [
      'Я понимаю, почему реагирую именно так.',
      'Я замечаю реакцию до того, как она захватывает.',
      'Я чувствую, что могу выбрать другую реакцию.',
      'Я строга(-г) к себе из-за этого.',
      'Это влияет на мою повседневную жизнь.',
      'Я чувствую, что застряла(-л).',
    ] as const,
    hope: 'Что Вы надеетесь изменить за месяц?',
    hopeHelp: 'Одна-две строки.',
    safetyNote:
      'Это инструмент самопомощи — не терапия и не кризисная служба. Если Вы сейчас в остром состоянии, пожалуйста, обратитесь в экстренную службу.',
  },
};

// Machine-friendly value tags — never translated. See
// lib/pilot/questionnaire-schema.ts.
const AGE_VALUES = ['18-24', '25-34', '35-44', '45-54', '55+'] as const;
const GENDER_VALUES = ['female', 'male', 'other', 'prefer_not_to_say'] as const;
const LANGUAGE_VALUES = ['ru', 'en'] as const;
const TRIED_BEFORE_VALUES = [
  'therapy',
  'self_help_books',
  'meditation_apps',
  'coaching',
  'journalling',
  'nothing',
] as const;
const YES_NO_VALUES = ['yes', 'no'] as const;
const PATTERNS_THAT_FIT_VALUES = [
  'people_pleasing',
  'cant_say_no',
  'staying_in_hurtful_relationships',
  'overthinking',
  'anxiety',
  'feeling_empty_disconnected',
  'tired_no_matter_sleep',
  'hard_on_self',
  'money_self_worth',
  'avoiding_things',
] as const;
const DURATION_VALUES = [
  'under_1y',
  '1_5y',
  '5_10y',
  'as_long_as_i_remember',
] as const;

type Props = { locale: string; alreadySubmitted: boolean };

export default function BeforeFormClient({ locale, alreadySubmitted }: Props) {
  const c = COPY[locale === 'ru' ? 'ru' : 'en'];
  const { palette: PALETTE } = useTheme();

  // Consent
  const [selfHelpNotTherapy, setSelfHelpNotTherapy] = useState(false);
  const [notCrisisService, setNotCrisisService] = useState(false);
  const [ageAndNotInCrisis, setAgeAndNotInCrisis] = useState(false);
  const [ukGdprAcknowledged, setUkGdprAcknowledged] = useState(false);
  const [anonymisedFeedback, setAnonymisedFeedback] = useState(false);
  const [quotableAnonymously, setQuotableAnonymously] = useState(false);
  const [willingToTalkToJulia, setWillingToTalkToJulia] = useState(false);
  const [followUpAt3Months, setFollowUpAt3Months] = useState(false);

  // About you
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [language, setLanguage] = useState<string>('');
  const [triedBefore, setTriedBefore] = useState<Set<string>>(new Set());
  const [workingWith, setWorkingWith] = useState<string>('');

  // Your pattern
  const [patternText, setPatternText] = useState('');
  const [patternsThatFit, setPatternsThatFit] = useState<Set<string>>(new Set());
  const [duration, setDuration] = useState<string>('');

  // Scales (Likert 0..10)
  const [scaleUnderstand, setScaleUnderstand] = useState<number | null>(null);
  const [scaleNotice, setScaleNotice] = useState<number | null>(null);
  const [scaleChoose, setScaleChoose] = useState<number | null>(null);
  const [scaleHardOnSelf, setScaleHardOnSelf] = useState<number | null>(null);
  const [scaleAffectsLife, setScaleAffectsLife] = useState<number | null>(null);
  const [scaleStuck, setScaleStuck] = useState<number | null>(null);

  // Hope
  const [hope, setHope] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSet(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side sanity check — the API also validates via Zod.
    if (
      !selfHelpNotTherapy ||
      !notCrisisService ||
      !ageAndNotInCrisis ||
      !ukGdprAcknowledged ||
      !anonymisedFeedback ||
      !age ||
      !gender ||
      !language ||
      !workingWith ||
      !patternText.trim() ||
      !duration ||
      !hope.trim() ||
      scaleUnderstand === null ||
      scaleNotice === null ||
      scaleChoose === null ||
      scaleHardOnSelf === null ||
      scaleAffectsLife === null ||
      scaleStuck === null
    ) {
      setError(c.errorValidation);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/pilot/questionnaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: 'before',
          scaleUnderstand,
          scaleNotice,
          scaleChoose,
          scaleHardOnSelf,
          scaleAffectsLife,
          scaleStuck,
          answers: {
            consent: {
              selfHelpNotTherapy: true,
              notCrisisService: true,
              ageAndNotInCrisis: true,
              ukGdprAcknowledged: true,
              anonymisedFeedback: true,
              quotableAnonymously,
              willingToTalkToJulia,
              followUpAt3Months,
            },
            aboutYou: {
              age,
              gender,
              language,
              triedBefore: Array.from(triedBefore),
              workingWithTherapistOrCoach: workingWith,
            },
            yourPattern: {
              patternText: patternText.trim(),
              patternsThatFit: Array.from(patternsThatFit),
              duration,
            },
            hopeInAMonth: hope.trim(),
          },
        }),
      });
      if (!res.ok) {
        console.error('[pilot/before] submit failed', res.status);
        setError(c.errorValidation);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      console.error('[pilot/before] network error', err);
      setError(c.errorNetwork);
    } finally {
      setSubmitting(false);
    }
  }

  if (alreadySubmitted || submitted) {
    return (
      <>
        <TopBar sticky />
        <main
          className="min-h-screen"
          style={{ background: PALETTE.bg, color: PALETTE.text }}
        >
          <div className="max-w-2xl mx-auto px-6 pt-16 pb-16">
            <p
              className="text-[11px] uppercase tracking-[0.22em] mb-3"
              style={{ color: PALETTE.textMuted, fontFamily: SANS }}
            >
              {c.kicker}
            </p>
            <h1
              className="text-[28px] leading-[1.2] mb-4"
              style={{ fontFamily: SERIF, fontWeight: 400 }}
            >
              {c.alreadyTitle}
            </h1>
            <p
              className="text-[15px] leading-[1.7] mb-8"
              style={{ color: PALETTE.textMuted, fontFamily: SANS }}
            >
              {c.alreadyBody}
            </p>
            <Link
              href="/journey"
              className="inline-block rounded-full px-6 py-3 text-[14px] font-medium"
              style={{
                background: PALETTE.accent,
                color: PALETTE.accentText,
                fontFamily: SANS,
              }}
            >
              {c.toJourney}
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar sticky />
      <main
        className="min-h-screen"
        style={{ background: PALETTE.bg, color: PALETTE.text }}
      >
        <form onSubmit={onSubmit} className="max-w-2xl mx-auto px-6 pt-10 pb-16">
          <p
            className="text-[11px] uppercase tracking-[0.22em] mb-3"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {c.kicker}
          </p>
          <h1
            className="text-[32px] leading-[1.15] mb-4"
            style={{ fontFamily: SERIF, fontWeight: 400 }}
          >
            {c.h1}
          </h1>
          <p
            className="text-[15px] leading-[1.7] mb-10 whitespace-pre-wrap"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {c.intro}
          </p>

          {/* --- Consent --------------------------------------------------- */}
          <Section title={c.hConsent} palette={PALETTE}>
            <CheckboxItem
              checked={selfHelpNotTherapy}
              onChange={setSelfHelpNotTherapy}
              palette={PALETTE}
              label={c.consent.selfHelpNotTherapy}
              required
            />
            <CheckboxItem
              checked={notCrisisService}
              onChange={setNotCrisisService}
              palette={PALETTE}
              label={c.consent.notCrisisService}
              required
            />
            <CheckboxItem
              checked={ageAndNotInCrisis}
              onChange={setAgeAndNotInCrisis}
              palette={PALETTE}
              label={c.consent.ageAndNotInCrisis}
              required
            />
            <CheckboxItem
              checked={ukGdprAcknowledged}
              onChange={setUkGdprAcknowledged}
              palette={PALETTE}
              label={c.consent.ukGdprAcknowledged}
              required
            />
            <CheckboxItem
              checked={anonymisedFeedback}
              onChange={setAnonymisedFeedback}
              palette={PALETTE}
              label={c.consent.anonymisedFeedback}
              required
            />
            <p
              className="text-[11px] uppercase tracking-[0.22em] mt-6 mb-3"
              style={{ color: PALETTE.textHint, fontFamily: SANS }}
            >
              {c.consent.optionalHeader}
            </p>
            <CheckboxItem
              checked={quotableAnonymously}
              onChange={setQuotableAnonymously}
              palette={PALETTE}
              label={c.consent.quotableAnonymously}
            />
            <CheckboxItem
              checked={willingToTalkToJulia}
              onChange={setWillingToTalkToJulia}
              palette={PALETTE}
              label={c.consent.willingToTalkToJulia}
            />
            <CheckboxItem
              checked={followUpAt3Months}
              onChange={setFollowUpAt3Months}
              palette={PALETTE}
              label={c.consent.followUpAt3Months}
            />
          </Section>

          {/* --- About you ------------------------------------------------- */}
          <Section title={c.hAboutYou} palette={PALETTE}>
            <RadioGroup
              legend={c.aboutYou.age}
              value={age}
              onChange={setAge}
              options={c.aboutYou.ageOptions.map((label, i) => ({
                label,
                value: AGE_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <RadioGroup
              legend={c.aboutYou.gender}
              value={gender}
              onChange={setGender}
              options={c.aboutYou.genderOptions.map((label, i) => ({
                label,
                value: GENDER_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <RadioGroup
              legend={c.aboutYou.language}
              value={language}
              onChange={setLanguage}
              options={c.aboutYou.languageOptions.map((label, i) => ({
                label,
                value: LANGUAGE_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <CheckGroup
              legend={c.aboutYou.triedBefore}
              values={triedBefore}
              onToggle={(v) => setTriedBefore((s) => toggleSet(s, v))}
              options={c.aboutYou.triedBeforeOptions.map((label, i) => ({
                label,
                value: TRIED_BEFORE_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <RadioGroup
              legend={c.aboutYou.workingWith}
              value={workingWith}
              onChange={setWorkingWith}
              options={c.aboutYou.workingWithOptions.map((label, i) => ({
                label,
                value: YES_NO_VALUES[i],
              }))}
              palette={PALETTE}
            />
          </Section>

          {/* --- Your pattern --------------------------------------------- */}
          <Section title={c.hYourPattern} palette={PALETTE}>
            <label className="block mb-6">
              <span
                className="block text-[14px] mb-2"
                style={{ fontFamily: SANS, color: PALETTE.text }}
              >
                {c.yourPattern.patternText}
              </span>
              <span
                className="block text-[12px] mb-2"
                style={{ fontFamily: SANS, color: PALETTE.textMuted }}
              >
                {c.yourPattern.patternTextHelp}
              </span>
              <textarea
                value={patternText}
                onChange={(e) => setPatternText(e.target.value)}
                rows={4}
                className="w-full rounded-xl px-3 py-2 text-[15px] resize-y"
                style={{
                  background: PALETTE.bgCard,
                  color: PALETTE.text,
                  border: `1px solid ${PALETTE.border}`,
                  fontFamily: SANS,
                }}
              />
            </label>
            <CheckGroup
              legend={c.yourPattern.patternsThatFit}
              values={patternsThatFit}
              onToggle={(v) => setPatternsThatFit((s) => toggleSet(s, v))}
              options={c.yourPattern.patternsThatFitOptions.map((label, i) => ({
                label,
                value: PATTERNS_THAT_FIT_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <RadioGroup
              legend={c.yourPattern.duration}
              value={duration}
              onChange={setDuration}
              options={c.yourPattern.durationOptions.map((label, i) => ({
                label,
                value: DURATION_VALUES[i],
              }))}
              palette={PALETTE}
            />
          </Section>

          {/* --- Scales --------------------------------------------------- */}
          <Section title={c.hScales} palette={PALETTE}>
            <p
              className="text-[13px] leading-[1.6] mb-6"
              style={{ color: PALETTE.textMuted, fontFamily: SANS }}
            >
              {c.scalesLead}
            </p>
            <LikertRow
              label={c.scales[0]}
              value={scaleUnderstand}
              onChange={setScaleUnderstand}
              palette={PALETTE}
            />
            <LikertRow
              label={c.scales[1]}
              value={scaleNotice}
              onChange={setScaleNotice}
              palette={PALETTE}
            />
            <LikertRow
              label={c.scales[2]}
              value={scaleChoose}
              onChange={setScaleChoose}
              palette={PALETTE}
            />
            <LikertRow
              label={c.scales[3]}
              value={scaleHardOnSelf}
              onChange={setScaleHardOnSelf}
              palette={PALETTE}
            />
            <LikertRow
              label={c.scales[4]}
              value={scaleAffectsLife}
              onChange={setScaleAffectsLife}
              palette={PALETTE}
            />
            <LikertRow
              label={c.scales[5]}
              value={scaleStuck}
              onChange={setScaleStuck}
              palette={PALETTE}
            />
          </Section>

          {/* --- Hope ---------------------------------------------------- */}
          <Section title={c.hHope} palette={PALETTE}>
            <label className="block">
              <span
                className="block text-[14px] mb-2"
                style={{ fontFamily: SANS, color: PALETTE.text }}
              >
                {c.hope}
              </span>
              <span
                className="block text-[12px] mb-2"
                style={{ fontFamily: SANS, color: PALETTE.textMuted }}
              >
                {c.hopeHelp}
              </span>
              <textarea
                value={hope}
                onChange={(e) => setHope(e.target.value)}
                rows={3}
                className="w-full rounded-xl px-3 py-2 text-[15px] resize-y"
                style={{
                  background: PALETTE.bgCard,
                  color: PALETTE.text,
                  border: `1px solid ${PALETTE.border}`,
                  fontFamily: SANS,
                }}
              />
            </label>
          </Section>

          {error && (
            <p
              className="mb-4 text-[14px]"
              style={{ color: '#b91c1c', fontFamily: SANS }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full px-6 py-3 text-[15px] font-medium disabled:opacity-50"
            style={{
              background: PALETTE.accent,
              color: PALETTE.accentText,
              fontFamily: SANS,
            }}
          >
            {submitting ? c.submitting : c.submit}
          </button>

          <p
            className="mt-10 text-[12px] leading-[1.6] text-center"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {c.safetyNote}
          </p>
        </form>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Presentational bits (kept local — pilot form is the only surface using them)
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
  palette,
}: {
  title: string;
  children: React.ReactNode;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <div
      className="mb-8 rounded-2xl p-6"
      style={{
        background: palette.bgCard,
        border: `1px solid ${palette.border}`,
      }}
    >
      <h2
        className="text-[18px] mb-5"
        style={{ fontFamily: SERIF, fontWeight: 400, color: palette.text }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function CheckboxItem({
  checked,
  onChange,
  palette,
  label,
  required,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  palette: ReturnType<typeof useTheme>['palette'];
  label: string;
  required?: boolean;
}) {
  return (
    <label
      className="flex items-start gap-3 py-2 cursor-pointer text-[14px] leading-[1.55]"
      style={{ fontFamily: SANS, color: palette.text }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required={required}
        className="mt-1 shrink-0"
      />
      <span>{label}</span>
    </label>
  );
}

function RadioGroup({
  legend,
  value,
  onChange,
  options,
  palette,
}: {
  legend: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ label: string; value: string }>;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <fieldset className="mb-6">
      <legend
        className="text-[14px] mb-2"
        style={{ fontFamily: SANS, color: palette.text }}
      >
        {legend}
      </legend>
      <div className="flex flex-wrap gap-3">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <label
              key={o.value}
              className="text-[14px] px-3 py-1.5 rounded-full cursor-pointer"
              style={{
                background: active ? palette.accent : 'transparent',
                color: active ? palette.accentText : palette.text,
                border: `1px solid ${active ? palette.accent : palette.border}`,
                fontFamily: SANS,
              }}
            >
              <input
                type="radio"
                name={legend}
                value={o.value}
                checked={active}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function CheckGroup({
  legend,
  values,
  onToggle,
  options,
  palette,
}: {
  legend: string;
  values: Set<string>;
  onToggle: (v: string) => void;
  options: Array<{ label: string; value: string }>;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <fieldset className="mb-6">
      <legend
        className="text-[14px] mb-2"
        style={{ fontFamily: SANS, color: palette.text }}
      >
        {legend}
      </legend>
      <div className="flex flex-wrap gap-3">
        {options.map((o) => {
          const active = values.has(o.value);
          return (
            <label
              key={o.value}
              className="text-[14px] px-3 py-1.5 rounded-full cursor-pointer"
              style={{
                background: active ? palette.accent : 'transparent',
                color: active ? palette.accentText : palette.text,
                border: `1px solid ${active ? palette.accent : palette.border}`,
                fontFamily: SANS,
              }}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => onToggle(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function LikertRow({
  label,
  value,
  onChange,
  palette,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <div className="mb-5">
      <p
        className="text-[14px] mb-2"
        style={{ fontFamily: SANS, color: palette.text }}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="w-9 h-9 rounded-full text-[13px]"
              style={{
                background: active ? palette.accent : 'transparent',
                color: active ? palette.accentText : palette.text,
                border: `1px solid ${active ? palette.accent : palette.border}`,
                fontFamily: SANS,
              }}
              aria-checked={active}
              role="radio"
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
