'use client';

// Pilot After form — client UI.
//
// PR ω3b (2026-07-14). Full form from Julia's authored pilot-forms md.
// Sections: intro → USE → same 6 Likert scales → CHANGE → PRODUCT →
// VALUE. The 6 scales are the KEY measurement: identical to Before,
// so cross-form comparison works.
//
// Copy inline (EN + RU) — same rationale as BeforeFormClient. No
// public translation surface; this is a pilot-only form.

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
  beforeMissingTitle: string;
  beforeMissingBody: string;
  toBeforeForm: string;
  toJourney: string;
  errorNetwork: string;
  errorValidation: string;
  hUse: string;
  hScales: string;
  scalesLead: string;
  hChange: string;
  hProduct: string;
  hValue: string;
  safetyNote: string;
  // Use section
  use: {
    frequency: string;
    frequencyOptions: readonly [string, string, string, string];
    stopReasons: string;
    stopReasonsOptions: readonly [
      string, string, string, string, string, string, string, string,
    ];
    sessions: string;
    sessionsOptions: readonly [string, string, string, string, string];
  };
  scales: readonly [string, string, string, string, string, string];
  change: {
    behaviour: string;
    behaviourOptions: readonly [string, string, string, string];
    shift: string;
    shiftHelp: string;
    worseUnsafe: string;
    worseUnsafeOptions: readonly [string, string, string];
    worseDetail: string;
  };
  product: {
    clarity: string;
    clarityOptions: readonly [string, string, string, string];
    pace: string;
    paceOptions: readonly [string, string, string];
    confusingBoringMissing: string;
    confusingBoringMissingHelp: string;
  };
  value: {
    wouldPay: string;
    wouldPayOptions: readonly [string, string, string];
    price: string;
    priceOptions: readonly [string, string, string, string, string];
    recommend: string;
    recommendOptions: readonly [string, string, string];
    anythingElse: string;
    anythingElseHelp: string;
  };
};

const COPY: Record<Locale, Copy> = {
  en: {
    kicker: 'MindReset · Pilot · After',
    h1: 'Four weeks in.',
    intro:
      'Thank you. This takes about 8 minutes. Please be critical. Polite feedback is useless to me. If it didn\'t work, or was boring, or confusing — that is the most valuable thing you can tell me.',
    submit: 'Save',
    submitting: 'Saving…',
    alreadyTitle: 'You already filled the After form. Thank you.',
    alreadyBody: 'Your response is saved.',
    beforeMissingTitle: 'Please fill the Before form first.',
    beforeMissingBody:
      "The After form's six 0–10 scales only mean something in comparison with the Before scales. Please open the Before form first — it takes about five minutes.",
    toBeforeForm: 'Open the Before form →',
    toJourney: 'Open The Journey →',
    errorNetwork:
      "We couldn't reach the server. Please try again — your answers are still on this page.",
    errorValidation:
      'Please answer every required question. Any 0–10 scale needs a number; every required free-text field needs a sentence.',
    hUse: 'Use',
    hScales: 'The same six scales (0–10)',
    scalesLead:
      "These are identical to the ones at the start. Please give the number that fits today — even if it hasn't moved.",
    hChange: 'Change',
    hProduct: 'The product',
    hValue: 'Value',
    safetyNote:
      'This is a self-help wellbeing tool — not therapy, not a crisis service. If you are in immediate distress, please contact your local emergency service.',
    use: {
      frequency: 'Did you use it?',
      frequencyOptions: [
        'Regularly',
        'A few times',
        'Once or twice',
        'I signed up but never really started',
      ] as const,
      stopReasons: 'If you stopped — why? (tick all that apply)',
      stopReasonsOptions: [
        'No time',
        'Forgot',
        'Too difficult emotionally',
        'Boring',
        'Confusing',
        "Didn't see the point",
        'Technical problems',
        "I didn't stop",
      ] as const,
      sessions: 'Roughly how many sessions?',
      sessionsOptions: ['0', '1–3', '4–8', '9–15', '15+'] as const,
    },
    scales: [
      'I understand why I react the way I do.',
      'I notice the reaction before it takes over.',
      'I feel able to choose a different response.',
      'I am hard on myself about this.',
      'This affects my daily life.',
      'I feel stuck.',
    ] as const,
    change: {
      behaviour: 'Did anything change in how you behave?',
      behaviourOptions: [
        'Yes, clearly',
        'Something small',
        'Not yet, but I understand more',
        'Nothing',
      ] as const,
      shift:
        'Did anything shift without you forcing it? If yes, what? If no, say so.',
      shiftHelp:
        'This is the key question of the pilot. Please answer honestly.',
      worseUnsafe: 'Did anything feel worse, unsafe, or push too hard?',
      worseUnsafeOptions: [
        'No',
        'A little uncomfortable, but okay',
        'Yes — too much',
      ] as const,
      worseDetail: 'If yes, please say what:',
    },
    product: {
      clarity: 'Was it clear what to do?',
      clarityOptions: [
        'Very clear',
        'Mostly',
        'Often confusing',
        "I didn't understand it",
      ] as const,
      pace: 'The pace was…',
      paceOptions: ['Too slow', 'Right', 'Too fast'] as const,
      confusingBoringMissing:
        'What was confusing, boring, or missing? Be blunt.',
      confusingBoringMissingHelp: 'A few sentences is enough.',
    },
    value: {
      wouldPay: 'Would you have paid for this?',
      wouldPayOptions: ['Yes', 'Maybe, if cheaper', 'No'] as const,
      price: 'If yes — roughly how much per year?',
      priceOptions: [
        'Under £100',
        '£100–300',
        '£300–600',
        '£600+',
        "Wouldn't pay",
      ] as const,
      recommend: 'Would you recommend it?',
      recommendOptions: [
        'Yes',
        'Only to certain people',
        'No',
      ] as const,
      anythingElse: 'Anything else — especially anything negative.',
      anythingElseHelp: 'Optional. As long or short as you want.',
    },
  },
  ru: {
    kicker: 'MindReset · Пилот · Форма «После»',
    h1: 'Четыре недели прошло.',
    intro:
      'Спасибо. Это займёт около 8 минут. Пожалуйста, будьте критичны. Вежливые отзывы мне бесполезны. Если не сработало, было скучно или непонятно — это самое ценное, что Вы можете сказать.',
    submit: 'Сохранить',
    submitting: 'Сохраняю…',
    alreadyTitle: 'Вы уже заполнили форму «После». Спасибо.',
    alreadyBody: 'Ваш ответ сохранён.',
    beforeMissingTitle: 'Пожалуйста, сначала заполните форму «До».',
    beforeMissingBody:
      'Шесть шкал 0–10 в форме «После» имеют смысл только в сравнении со шкалами формы «До». Пожалуйста, откройте сначала форму «До» — это займёт около пяти минут.',
    toBeforeForm: 'Открыть форму «До» →',
    toJourney: 'Открыть Путь →',
    errorNetwork:
      'Не удалось связаться с сервером. Пожалуйста, попробуйте ещё раз — Ваши ответы остаются на странице.',
    errorValidation:
      'Пожалуйста, ответьте на все обязательные вопросы. Каждой шкале 0–10 нужен номер, каждому обязательному текстовому полю — предложение.',
    hUse: 'Использование',
    hScales: 'Те же шесть шкал (0–10)',
    scalesLead:
      'Идентичны тем, что были в начале. Поставьте число, которое подходит сегодня — даже если оно не сдвинулось.',
    hChange: 'Изменения',
    hProduct: 'Продукт',
    hValue: 'Ценность',
    safetyNote:
      'Это инструмент самопомощи — не терапия и не кризисная служба. Если Вы сейчас в остром состоянии, пожалуйста, обратитесь в экстренную службу.',
    use: {
      frequency: 'Вы пользовались?',
      frequencyOptions: [
        'Регулярно',
        'Несколько раз',
        'Раз или два',
        'Зарегистрировалась(-ся), но так и не начала(-л)',
      ] as const,
      stopReasons: 'Если перестали — почему? (отметьте всё)',
      stopReasonsOptions: [
        'Нет времени',
        'Забыла(-л)',
        'Слишком тяжело эмоционально',
        'Скучно',
        'Непонятно',
        'Не поняла(-л) смысла',
        'Технические проблемы',
        'Я не переставала(-л)',
      ] as const,
      sessions: 'Примерно сколько сессий?',
      sessionsOptions: ['0', '1–3', '4–8', '9–15', '15+'] as const,
    },
    scales: [
      'Я понимаю, почему реагирую именно так.',
      'Я замечаю реакцию до того, как она захватывает.',
      'Я чувствую, что могу выбрать другую реакцию.',
      'Я строга(-г) к себе из-за этого.',
      'Это влияет на мою повседневную жизнь.',
      'Я чувствую, что застряла(-л).',
    ] as const,
    change: {
      behaviour: 'Изменилось ли что-то в Вашем поведении?',
      behaviourOptions: [
        'Да, явно',
        'Что-то небольшое',
        'Пока нет, но я больше понимаю',
        'Ничего',
      ] as const,
      shift:
        'Изменилось ли что-то без усилия с Вашей стороны? Если да — что? Если нет — так и напишите.',
      shiftHelp: 'Это ключевой вопрос пилота. Пожалуйста, ответьте честно.',
      worseUnsafe: 'Было ли что-то хуже, небезопасно или слишком давило?',
      worseUnsafeOptions: [
        'Нет',
        'Немного некомфортно, но нормально',
        'Да — слишком',
      ] as const,
      worseDetail: 'Если да — напишите, что именно:',
    },
    product: {
      clarity: 'Было ли понятно, что делать?',
      clarityOptions: [
        'Очень понятно',
        'В основном',
        'Часто непонятно',
        'Я не поняла(-л)',
      ] as const,
      pace: 'Темп был…',
      paceOptions: ['Слишком медленный', 'Подходящий', 'Слишком быстрый'] as const,
      confusingBoringMissing:
        'Что было непонятным, скучным или чего не хватало? Пишите прямо.',
      confusingBoringMissingHelp: 'Достаточно нескольких предложений.',
    },
    value: {
      wouldPay: 'Вы бы заплатили за это?',
      wouldPayOptions: ['Да', 'Возможно, если дешевле', 'Нет'] as const,
      price: 'Если да — примерно сколько в год?',
      priceOptions: [
        'До £100',
        '£100–300',
        '£300–600',
        '£600+',
        'Не заплатила(-л) бы',
      ] as const,
      recommend: 'Порекомендовали бы?',
      recommendOptions: [
        'Да',
        'Только определённым людям',
        'Нет',
      ] as const,
      anythingElse: 'Что-то ещё — особенно негативное.',
      anythingElseHelp: 'Необязательно. Как длинно или коротко хотите.',
    },
  },
};

// Machine-friendly value tags — never translated. See
// lib/pilot/questionnaire-schema.ts.
const USE_FREQUENCY_VALUES = [
  'regularly',
  'few_times',
  'once_or_twice',
  'signed_up_never_started',
] as const;
const STOP_REASON_VALUES = [
  'no_time',
  'forgot',
  'too_difficult_emotionally',
  'boring',
  'confusing',
  'didnt_see_point',
  'technical_problems',
  'didnt_stop',
] as const;
const SESSIONS_VALUES = ['0', '1_3', '4_8', '9_15', '15_plus'] as const;
const BEHAVIOUR_VALUES = [
  'yes_clearly',
  'something_small',
  'not_yet_but_understand',
  'nothing',
] as const;
const WORSE_UNSAFE_VALUES = ['no', 'a_little_uncomfortable', 'yes_too_much'] as const;
const CLARITY_VALUES = [
  'very_clear',
  'mostly',
  'often_confusing',
  'didnt_understand',
] as const;
const PACE_VALUES = ['too_slow', 'right', 'too_fast'] as const;
const WOULD_PAY_VALUES = ['yes', 'maybe_if_cheaper', 'no'] as const;
const PRICE_VALUES = [
  'under_100',
  '100_300',
  '300_600',
  '600_plus',
  'wouldnt_pay',
] as const;
const RECOMMEND_VALUES = ['yes', 'only_certain_people', 'no'] as const;

type Props = {
  locale: string;
  beforeMissing: boolean;
  alreadySubmitted: boolean;
};

export default function AfterFormClient({
  locale,
  beforeMissing,
  alreadySubmitted,
}: Props) {
  const c = COPY[locale === 'ru' ? 'ru' : 'en'];
  const { palette: PALETTE } = useTheme();

  // Use
  const [frequency, setFrequency] = useState<string>('');
  const [stopReasons, setStopReasons] = useState<Set<string>>(new Set());
  const [sessions, setSessions] = useState<string>('');

  // Scales
  const [scaleUnderstand, setScaleUnderstand] = useState<number | null>(null);
  const [scaleNotice, setScaleNotice] = useState<number | null>(null);
  const [scaleChoose, setScaleChoose] = useState<number | null>(null);
  const [scaleHardOnSelf, setScaleHardOnSelf] = useState<number | null>(null);
  const [scaleAffectsLife, setScaleAffectsLife] = useState<number | null>(null);
  const [scaleStuck, setScaleStuck] = useState<number | null>(null);

  // Change
  const [behaviour, setBehaviour] = useState<string>('');
  const [shift, setShift] = useState('');
  const [worseUnsafe, setWorseUnsafe] = useState<string>('');
  const [worseDetail, setWorseDetail] = useState('');

  // Product
  const [clarity, setClarity] = useState<string>('');
  const [pace, setPace] = useState<string>('');
  const [confusingBoringMissing, setConfusingBoringMissing] = useState('');

  // Value
  const [wouldPay, setWouldPay] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [recommend, setRecommend] = useState<string>('');
  const [anythingElse, setAnythingElse] = useState('');

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

    if (
      !frequency ||
      !sessions ||
      !behaviour ||
      !shift.trim() ||
      !worseUnsafe ||
      !clarity ||
      !pace ||
      !confusingBoringMissing.trim() ||
      !wouldPay ||
      !price ||
      !recommend ||
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
          formType: 'after',
          scaleUnderstand,
          scaleNotice,
          scaleChoose,
          scaleHardOnSelf,
          scaleAffectsLife,
          scaleStuck,
          answers: {
            use: {
              frequency,
              stopReasons: Array.from(stopReasons),
              sessionsRoughCount: sessions,
            },
            change: {
              behaviour,
              shiftedWithoutForcing: shift.trim(),
              worseUnsafe,
              worseUnsafeDetail: worseDetail.trim(),
            },
            product: {
              clarity,
              pace,
              confusingBoringMissing: confusingBoringMissing.trim(),
            },
            value: {
              wouldPay,
              priceBracket: price,
              wouldRecommend: recommend,
              anythingElse: anythingElse.trim(),
            },
          },
        }),
      });
      if (!res.ok) {
        console.error('[pilot/after] submit failed', res.status);
        setError(c.errorValidation);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      console.error('[pilot/after] network error', err);
      setError(c.errorNetwork);
    } finally {
      setSubmitting(false);
    }
  }

  // Gate: no Before form → send them there first (comparison is meaningless
  // without a baseline).
  if (beforeMissing) {
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
              {c.beforeMissingTitle}
            </h1>
            <p
              className="text-[15px] leading-[1.7] mb-8"
              style={{ color: PALETTE.textMuted, fontFamily: SANS }}
            >
              {c.beforeMissingBody}
            </p>
            <Link
              href="/pilot/before"
              className="inline-block rounded-full px-6 py-3 text-[14px] font-medium"
              style={{
                background: PALETTE.accent,
                color: PALETTE.accentText,
                fontFamily: SANS,
              }}
            >
              {c.toBeforeForm}
            </Link>
          </div>
        </main>
      </>
    );
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
            className="text-[15px] leading-[1.7] mb-10"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {c.intro}
          </p>

          {/* --- USE ------------------------------------------------------- */}
          <Section title={c.hUse} palette={PALETTE}>
            <RadioGroup
              legend={c.use.frequency}
              value={frequency}
              onChange={setFrequency}
              options={c.use.frequencyOptions.map((label, i) => ({
                label,
                value: USE_FREQUENCY_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <CheckGroup
              legend={c.use.stopReasons}
              values={stopReasons}
              onToggle={(v) => setStopReasons((s) => toggleSet(s, v))}
              options={c.use.stopReasonsOptions.map((label, i) => ({
                label,
                value: STOP_REASON_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <RadioGroup
              legend={c.use.sessions}
              value={sessions}
              onChange={setSessions}
              options={c.use.sessionsOptions.map((label, i) => ({
                label,
                value: SESSIONS_VALUES[i],
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
            <LikertRow label={c.scales[0]} value={scaleUnderstand} onChange={setScaleUnderstand} palette={PALETTE} />
            <LikertRow label={c.scales[1]} value={scaleNotice} onChange={setScaleNotice} palette={PALETTE} />
            <LikertRow label={c.scales[2]} value={scaleChoose} onChange={setScaleChoose} palette={PALETTE} />
            <LikertRow label={c.scales[3]} value={scaleHardOnSelf} onChange={setScaleHardOnSelf} palette={PALETTE} />
            <LikertRow label={c.scales[4]} value={scaleAffectsLife} onChange={setScaleAffectsLife} palette={PALETTE} />
            <LikertRow label={c.scales[5]} value={scaleStuck} onChange={setScaleStuck} palette={PALETTE} />
          </Section>

          {/* --- CHANGE --------------------------------------------------- */}
          <Section title={c.hChange} palette={PALETTE}>
            <RadioGroup
              legend={c.change.behaviour}
              value={behaviour}
              onChange={setBehaviour}
              options={c.change.behaviourOptions.map((label, i) => ({
                label,
                value: BEHAVIOUR_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <label className="block mb-6">
              <span
                className="block text-[14px] mb-2"
                style={{ fontFamily: SANS, color: PALETTE.text }}
              >
                {c.change.shift}
              </span>
              <span
                className="block text-[12px] mb-2"
                style={{ fontFamily: SANS, color: PALETTE.textMuted }}
              >
                {c.change.shiftHelp}
              </span>
              <textarea
                value={shift}
                onChange={(e) => setShift(e.target.value)}
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
            <RadioGroup
              legend={c.change.worseUnsafe}
              value={worseUnsafe}
              onChange={setWorseUnsafe}
              options={c.change.worseUnsafeOptions.map((label, i) => ({
                label,
                value: WORSE_UNSAFE_VALUES[i],
              }))}
              palette={PALETTE}
            />
            {worseUnsafe !== '' && worseUnsafe !== 'no' && (
              <label className="block mb-6">
                <span
                  className="block text-[13px] mb-2"
                  style={{ fontFamily: SANS, color: PALETTE.text }}
                >
                  {c.change.worseDetail}
                </span>
                <textarea
                  value={worseDetail}
                  onChange={(e) => setWorseDetail(e.target.value)}
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
            )}
          </Section>

          {/* --- PRODUCT ------------------------------------------------- */}
          <Section title={c.hProduct} palette={PALETTE}>
            <RadioGroup
              legend={c.product.clarity}
              value={clarity}
              onChange={setClarity}
              options={c.product.clarityOptions.map((label, i) => ({
                label,
                value: CLARITY_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <RadioGroup
              legend={c.product.pace}
              value={pace}
              onChange={setPace}
              options={c.product.paceOptions.map((label, i) => ({
                label,
                value: PACE_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <label className="block">
              <span
                className="block text-[14px] mb-2"
                style={{ fontFamily: SANS, color: PALETTE.text }}
              >
                {c.product.confusingBoringMissing}
              </span>
              <span
                className="block text-[12px] mb-2"
                style={{ fontFamily: SANS, color: PALETTE.textMuted }}
              >
                {c.product.confusingBoringMissingHelp}
              </span>
              <textarea
                value={confusingBoringMissing}
                onChange={(e) => setConfusingBoringMissing(e.target.value)}
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
          </Section>

          {/* --- VALUE --------------------------------------------------- */}
          <Section title={c.hValue} palette={PALETTE}>
            <RadioGroup
              legend={c.value.wouldPay}
              value={wouldPay}
              onChange={setWouldPay}
              options={c.value.wouldPayOptions.map((label, i) => ({
                label,
                value: WOULD_PAY_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <RadioGroup
              legend={c.value.price}
              value={price}
              onChange={setPrice}
              options={c.value.priceOptions.map((label, i) => ({
                label,
                value: PRICE_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <RadioGroup
              legend={c.value.recommend}
              value={recommend}
              onChange={setRecommend}
              options={c.value.recommendOptions.map((label, i) => ({
                label,
                value: RECOMMEND_VALUES[i],
              }))}
              palette={PALETTE}
            />
            <label className="block">
              <span
                className="block text-[14px] mb-2"
                style={{ fontFamily: SANS, color: PALETTE.text }}
              >
                {c.value.anythingElse}
              </span>
              <span
                className="block text-[12px] mb-2"
                style={{ fontFamily: SANS, color: PALETTE.textMuted }}
              >
                {c.value.anythingElseHelp}
              </span>
              <textarea
                value={anythingElse}
                onChange={(e) => setAnythingElse(e.target.value)}
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
            <p className="mb-4 text-[14px]" style={{ color: '#b91c1c', fontFamily: SANS }}>
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

// Presentational primitives — same shape as BeforeFormClient's locals.

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
