// The stability question — code-authored, locale-aware. Phase 2 (2026-08-08).
//
// WHY THIS IS CODE AND NOT THE CLINICIAN'S JOB.
// The master prompt has required this question since the stabilising-before-
// closing protocol was written, and enforcement has never existed: on
// 2026-08-08 the clinician closed a session in which intensity reached 6 on
// eleven turns without ever asking, and recorded its own reasoning as
// "closing gently without forcing a stability number she hasn't offered".
// Because the CODE now asks, `scale: 'stability'` and `source: 'user_reported'`
// become facts about the answer rather than claims about it.
//
// This is ENFORCEMENT OF EXISTING METHODOLOGY, NOT A METHODOLOGY CHANGE.
// The English wording is lifted verbatim from journey-master.md:342 under
// owner approval (2026-08-08); the master prompt is unchanged. The Russian
// rendering is the owner's, approved in the same decision.
//
// The crisis grounding scale in messages/ru.json is a DIFFERENT scale with
// different semantics ("насколько Вы ощущаете, что существуете сейчас") and is
// deliberately not reused here.

/** Verbatim from journey-master.md:342. Do not reword without owner approval. */
export const STABILITY_QUESTION_EN =
  'On a scale of 1 to 10, how stable do you feel right now? Where 10 is fully grounded and present, and 1 is overwhelmed.';

/** Owner-approved Russian rendering (2026-08-08). */
export const STABILITY_QUESTION_RU =
  'По шкале от 1 до 10, насколько стабильно вы чувствуете себя прямо сейчас? Где 10 — вы полностью устойчивы и чувствуете себя здесь и сейчас, а 1 — вы полностью перегружены.';

/**
 * Locale selection, matching the established pattern in
 * lib/journey/safety/keywords.ts (crisis + cooldown-lift messages): Russian
 * for `ru`, English for everything else.
 */
export function getStabilityQuestionForLocale(
  locale: string | null | undefined,
): string {
  if (locale === 'ru') return STABILITY_QUESTION_RU;
  return STABILITY_QUESTION_EN;
}
