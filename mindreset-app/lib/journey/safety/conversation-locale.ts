// Which language is the user ACTUALLY writing in? (2026-08-08)
//
// THE DEFECT THIS FIXES, observed live.
// On 2026-08-08 a Russian-language Journey session received the code-authored
// stability question twice, in English, while the user was at 2/10 stability.
// Nothing was broken in the plumbing: JourneyClient sends `useLocale()`, the
// route passes it through, and the RU wording exists. The user was simply on an
// English-locale URL while writing Russian.
//
// That is the real mismatch, and it is not confined to Closing:
//
//   the Clinician         follows the language the user actually writes in
//   code-authored strings followed the URL / stored-preference locale
//
// When those diverge, EVERY platform-authored conversational message is in the
// wrong language — including the crisis response, which is the highest-stakes
// instance of all.
//
// WHAT THIS IS NOT. It is not a language subsystem, a detector for the eight
// supported UI locales, or anything that touches UI localisation. The
// deterministic conversational messages in this codebase have exactly two
// variants each — RU and EN, with EN as the catch-all fallback (see
// getCrisisResponseForLocale, getCooldownLiftMessageForLocale,
// getStateCrisisResponseForLocale, getStabilityQuestionForLocale). So the only
// question this needs to answer is the only one those helpers ask: is this
// person writing Russian?
//
// It uses the same Cyrillic-block test the safety keyword scanners already rely
// on to tell RU phrases from EN ones (lib/minimind/safety/keywords.ts:360).
//
// FALLBACK IS THE OLD BEHAVIOUR, EXACTLY. When the text carries no script
// signal — a bare number, an emoji, punctuation, "ok" — this returns the passed
// locale unchanged, so nothing regresses relative to what shipped. The limit is
// therefore stated plainly rather than hidden: a Russian-speaking user whose
// message is Latin-only and inconclusive still gets the fallback locale.

/** Cyrillic Unicode block. Same range the keyword scanners use. */
const CYRILLIC = /[Ѐ-ӿԀ-ԯ]/;

/** Any Latin letter. */
const LATIN = /[A-Za-z]/;

/**
 * Resolve the language a code-authored conversational message should use.
 *
 * @param text     the user's own message this turn — the only direct evidence
 *                 of what language they are actually writing in
 * @param fallback the URL / stored-preference locale, used when `text` carries
 *                 no script signal at all
 *
 * Pure. No I/O, no model call, no persistence.
 */
export function resolveConversationLocale(
  text: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  if (!text) return fallback ?? null;

  const hasCyrillic = CYRILLIC.test(text);
  const hasLatin = LATIN.test(text);

  // Unambiguous Russian.
  if (hasCyrillic && !hasLatin) return 'ru';

  // Mixed script — a Russian sentence with a borrowed word, a brand name, or a
  // URL. Cyrillic is the marked script here: nobody writes Cyrillic by accident
  // in an English sentence, whereas Latin fragments in Russian are routine.
  if (hasCyrillic) return 'ru';

  // Latin-only WITH letters is a positive signal for English, but it is also
  // what a Russian speaker's "ok" looks like. Deliberately NOT treated as
  // evidence of English: fall back instead, so this function can only ever
  // correct a wrong locale, never introduce one.
  if (hasLatin) return fallback ?? null;

  // No letters at all — a bare score, punctuation, an emoji. No signal.
  return fallback ?? null;
}
