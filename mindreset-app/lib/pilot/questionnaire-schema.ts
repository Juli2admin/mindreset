// Zod schemas for the in-app pilot questionnaires.
//
// PR ω3a (2026-07-14). Two forms today (Before, After); the shared 6
// Likert scales are validated identically across both — they are the
// pilot's core measurement. Everything else is form-specific.
//
// Question text and options come verbatim from Julia's authored
// pilot-forms markdown; only the machine-friendly IDs live here.

import { z } from 'zod';

// The 6 identical Likert 0–10 scales. Same in Before + After.
const likert = z.number().int().min(0).max(10);

export const scalesSchema = z.object({
  scaleUnderstand: likert,
  scaleNotice: likert,
  scaleChoose: likert,
  scaleHardOnSelf: likert,
  scaleAffectsLife: likert,
  scaleStuck: likert,
});

// ---------------------------------------------------------------------------
// BEFORE form
// ---------------------------------------------------------------------------

const beforeConsentSchema = z.object({
  selfHelpNotTherapy: z.literal(true),
  notCrisisService: z.literal(true),
  ageAndNotInCrisis: z.literal(true),
  ukGdprAcknowledged: z.literal(true),
  anonymisedFeedback: z.literal(true),
  // Optional consents — not required to submit.
  quotableAnonymously: z.boolean().optional(),
  willingToTalkToJulia: z.boolean().optional(),
  followUpAt3Months: z.boolean().optional(),
});

const ageBracket = z.enum(['18-24', '25-34', '35-44', '45-54', '55+']);
const gender = z.enum(['female', 'male', 'other', 'prefer_not_to_say']);
const language = z.enum(['ru', 'en']);
const patternDuration = z.enum(['under_1y', '1_5y', '5_10y', 'as_long_as_i_remember']);
const yesNo = z.enum(['yes', 'no']);

const triedBefore = z
  .array(
    z.enum([
      'therapy',
      'self_help_books',
      'meditation_apps',
      'coaching',
      'journalling',
      'nothing',
    ]),
  )
  .default([]);

const patternsThatFit = z
  .array(
    z.enum([
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
    ]),
  )
  .default([]);

export const beforeFormAnswersSchema = z.object({
  consent: beforeConsentSchema,
  aboutYou: z.object({
    age: ageBracket,
    gender,
    language,
    triedBefore,
    workingWithTherapistOrCoach: yesNo,
  }),
  yourPattern: z.object({
    // The pattern the tester keeps repeating (2–3 sentences).
    patternText: z.string().min(1).max(2000),
    patternsThatFit,
    duration: patternDuration,
  }),
  hopeInAMonth: z.string().min(1).max(1000),
});

/**
 * Full Before-form POST body. The 6 scales are top-level (they map
 * directly to typed TesterResponse columns); everything else lives in
 * the `answers` blob.
 */
export const beforeFormSubmitSchema = scalesSchema.extend({
  formType: z.literal('before'),
  answers: beforeFormAnswersSchema,
});

// ---------------------------------------------------------------------------
// AFTER form (schema ready — form UI ships in PR ω3b)
// ---------------------------------------------------------------------------

const useFrequency = z.enum([
  'regularly',
  'few_times',
  'once_or_twice',
  'signed_up_never_started',
]);
const stopReason = z.array(
  z.enum([
    'no_time',
    'forgot',
    'too_difficult_emotionally',
    'boring',
    'confusing',
    'didnt_see_point',
    'technical_problems',
    'didnt_stop',
  ]),
);
const sessionsRoughCount = z.enum(['0', '1_3', '4_8', '9_15', '15_plus']);
const behaviourChange = z.enum([
  'yes_clearly',
  'something_small',
  'not_yet_but_understand',
  'nothing',
]);
const worseUnsafe = z.enum(['no', 'a_little_uncomfortable', 'yes_too_much']);
const clarity = z.enum([
  'very_clear',
  'mostly',
  'often_confusing',
  'didnt_understand',
]);
const pace = z.enum(['too_slow', 'right', 'too_fast']);
const wouldPay = z.enum(['yes', 'maybe_if_cheaper', 'no']);
const priceBracket = z.enum([
  'under_100',
  '100_300',
  '300_600',
  '600_plus',
  'wouldnt_pay',
]);
const wouldRecommend = z.enum(['yes', 'only_certain_people', 'no']);

export const afterFormAnswersSchema = z.object({
  use: z.object({
    frequency: useFrequency,
    stopReasons: stopReason,
    sessionsRoughCount,
  }),
  change: z.object({
    behaviour: behaviourChange,
    shiftedWithoutForcing: z.string().min(1).max(2000),
    worseUnsafe,
    worseUnsafeDetail: z.string().max(2000).optional().default(''),
  }),
  product: z.object({
    clarity,
    pace,
    confusingBoringMissing: z.string().min(1).max(2000),
  }),
  value: z.object({
    wouldPay,
    priceBracket,
    wouldRecommend,
    anythingElse: z.string().max(2000).optional().default(''),
  }),
});

export const afterFormSubmitSchema = scalesSchema.extend({
  formType: z.literal('after'),
  answers: afterFormAnswersSchema,
});

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

export const questionnaireSubmitSchema = z.discriminatedUnion('formType', [
  beforeFormSubmitSchema,
  afterFormSubmitSchema,
]);

export type QuestionnaireSubmit = z.infer<typeof questionnaireSubmitSchema>;
export type BeforeFormAnswers = z.infer<typeof beforeFormAnswersSchema>;
export type AfterFormAnswers = z.infer<typeof afterFormAnswersSchema>;
