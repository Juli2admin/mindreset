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
//
// ---------------------------------------------------------------------------
// SESSION INHERITANCE (2026-08-19) — the limit above, hit live.
// ---------------------------------------------------------------------------
//
// The stability boundary asks "по шкале от 1 до 10..." and the user answers
// «5». That reply is language-neutral by construction: the question we ask
// invites a bare number. So the very next code-authored string — the re-asked
// question, and then the close-correction — fell back to the URL locale and
// came out in ENGLISH, mid-close, in a Russian session where the user was at
// 5/10 and depleted. Observed 2026-08-19.
//
// The fix is the third parameter: when THIS message carries no signal, the
// recent conversation is consulted before the URL locale. A session in which
// the user has been writing Russian stays Russian across «5», «ок» and «👍».
//
// THE ASYMMETRY IS DELIBERATE AND UNCHANGED. `messageLocaleSignal` detects
// only Russian — Latin script is never read as evidence of English, for the
// reason stated above. So history can only ever move the answer TOWARD 'ru',
// never away from a Russian fallback, and the safety property this module was
// built on survives intact: it can correct a wrong locale, never introduce one.
//
// The cost of that asymmetry, stated rather than hidden: an English-writing
// user who quoted a Cyrillic phrase within the lookback window gets one
// platform string in Russian. That is the same bet the mixed-script rule
// already makes ("nobody writes Cyrillic by accident"), and it is the cheap
// direction of a mistake compared with the failure above.

/** Cyrillic Unicode block. Same range the keyword scanners use. */
const CYRILLIC = /[Ѐ-ӿԀ-ԯ]/;

/**
 * The language signal ONE message carries, or null when it carries none.
 *
 * Russian is the only verdict this can reach, and that is the whole design:
 *
 *   - Cyrillic, alone or mixed with Latin, is Russian. Cyrillic is the marked
 *     script — nobody writes it by accident in an English sentence, whereas
 *     Latin fragments in Russian (a brand, a borrowed word, a URL) are routine.
 *   - Latin-only WITH letters looks like English but is also exactly what a
 *     Russian speaker's "ok" looks like. Deliberately NOT evidence of English.
 *   - No letters at all — a bare score, punctuation, an emoji — is no signal.
 *
 * Exported so callers can ask the cheap question "is this turn's message
 * inconclusive?" before paying to load any history. Pure.
 */
export function messageLocaleSignal(text: string | null | undefined): 'ru' | null {
  if (!text) return null;
  if (CYRILLIC.test(text)) return 'ru';
  // Latin-only and letterless both fall through: neither is evidence.
  return null;
}

/**
 * Resolve the language a code-authored conversational message should use.
 *
 * @param text     the user's own message this turn — the most direct evidence
 *                 of what language they are actually writing in
 * @param fallback the URL / stored-preference locale, used only when neither
 *                 `text` nor `recentUserMessages` carries a signal
 * @param recentUserMessages
 *                 the user's own recent messages, newest first. Consulted ONLY
 *                 when this turn's message is inconclusive — a bare score, an
 *                 emoji, "ok" — so a Russian session stays Russian across the
 *                 language-neutral replies our own questions invite. Omit it
 *                 and the behaviour is byte-for-byte what shipped before.
 *
 * Pure. No I/O, no model call, no persistence.
 */
export function resolveConversationLocale(
  text: string | null | undefined,
  fallback: string | null | undefined,
  recentUserMessages?: readonly (string | null | undefined)[],
): string | null {
  // 1. This turn's own message always wins when it says anything.
  const direct = messageLocaleSignal(text);
  if (direct) return direct;

  // 2. Otherwise inherit the language the session has been running in. Only
  //    'ru' is reachable here (see messageLocaleSignal), so this can never
  //    override a Russian fallback with English.
  if (recentUserMessages) {
    for (const message of recentUserMessages) {
      const signal = messageLocaleSignal(message);
      if (signal) return signal;
    }
  }

  // 3. Nothing in the conversation says anything. The URL / stored preference
  //    is all that is left — the original behaviour, unchanged.
  return fallback ?? null;
}
