// Explicit exit-intent detection — Activated Closure Phase 2 (structural).
//
// Deterministic, English + Russian, high-precision. Pure module: no I/O, no
// model call, no clinical reasoning.
//
// ---------------------------------------------------------------------------
// SCOPE — read before adding a phrase
// ---------------------------------------------------------------------------
// This detects GENUINE USER-INITIATED SESSION EXIT only. Three deliberate
// exclusions, each an owner decision:
//
//   1. Stopping the current ACTIVITY is not stopping the SESSION. "I need to
//      stop", "can we stop", "I want to finish" are context-dependent — they
//      usually mean the exercise, the topic, or the emotional exploration.
//      They are classified `activity_stop` and never enter closure.
//   2. AI-initiated disengagement is out of scope.
//   3. Future-contact statements ("I'll message you after") are NOT exit
//      intent. A user can say they will write later and keep talking.
//
// ---------------------------------------------------------------------------
// COMPOSITIONAL, NOT A SENTENCE LIST (rebuilt 2026-08-08)
// ---------------------------------------------------------------------------
// The original implementation shipped as four flat lists of whole sentences,
// which contradicted this module's own documented design ("expressed
// STRUCTURALLY rather than by listing every verb") and left real utterances
// undetected — verified: «Я, наверное, больше не хочу разговаривать» returned
// `none`, because that exact sentence was not in the list.
//
// Detection is now composed from small categorised components:
//
//   PREDICATE   what is being ended — continue / stop / depart / done / signoff
//   SCOPE       what it applies to  — SESSION (today, больше, tomorrow) or
//                                     TOPIC (about this, об этом)
//   NEGATION    two distinct roles, and this is the crux:
//                 CONSTITUTIVE — negation forms the intent
//                                («не хочу разговаривать»)
//                 SUPPRESSIVE  — negation cancels a candidate
//                                («не хочу останавливаться», "I don't want
//                                 to stop")
//               The rule that separates them is WHAT IS NEGATED: negating a
//               CONTINUATION predicate is exit intent; negating a STOP or
//               DEPART predicate is suppression.
//   VOLITION vs CAPABILITY
//               «не хочу» (volition) is exit intent; «не могу» / "can't"
//               (capability) is exhaustion and stays `ambiguous`. This axis
//               was already implicit in the approved lists — every AMBIGUOUS
//               entry is capability-negation or hopelessness — and it is what
//               keeps «больше не хочу разговаривать» apart from «я больше не
//               могу» without touching the crisis boundary.
//
// Precision remains the bias: a false `session_exit` would drag a user into a
// clinical protocol they did not ask for. Where an intent is formed but no
// scope marker is present, the conservative class (`activity_stop`) wins.
//
// Nothing calls this module. It is dormant until wired.

/**
 * `session_exit`  — explicit, user-initiated intent to end the SESSION.
 *                   The only class that would ever enter closure.
 * `activity_stop` — stop this exercise/topic/exploration, not the session.
 *                   Recorded, never enters.
 * `ambiguous`     — recorded, never enters. Deliberately adjacent to crisis
 *                   phrasing; the crisis scan runs first and returns early,
 *                   so anything it catches never reaches here.
 * `none`          — no exit signal.
 */
export type ExitIntentClass = 'session_exit' | 'activity_stop' | 'ambiguous' | 'none';

export type ExitIntentResult = {
  intent: ExitIntentClass;
  /** The component that decided the class, for audit. null when `none`. */
  matched: string | null;
};

const NO_INTENT: ExitIntentResult = Object.freeze({ intent: 'none', matched: null });

/**
 * MATCHING IS SPACE-PADDED, NOT \b-BASED.
 *
 * Verified 2026-08-06: JavaScript's \b is ASCII-only — /\bмне\b/ does not
 * match "мне пора" at all. Every component below is therefore matched as a
 * whitespace-delimited substring of a normalised, space-padded message, which
 * is script-agnostic and needs no lookarounds.
 */

// --- Deliberation about the self: the user is asking US to decide, so they
// have not decided. Checked first; never a session exit. ---------------------
const DELIBERATIVE: string[] = [
  'should i',
  'do you think i should',
  'maybe i should',
  'is it time',
  'would it be better if i',
  'мне стоит',
  'может мне',
  'пора ли мне',
  'как думаешь мне',
];

// --- Exhaustion / hopelessness. CAPABILITY negation, not volition. ----------
const CAPABILITY_NEG: string[] = [
  "i can't",
  'i cant',
  'i cannot',
  'не могу',
];

const HOPELESSNESS: string[] = [
  "what's the point",
  'whats the point',
  "this isn't working",
  'this isnt working',
  'i give up',
  'какой смысл',
  'я сдаюсь',
  'это не работает',
];

// --- Predicates: WHAT is being ended ----------------------------------------
/** Continuing the conversation. Negating one of these FORMS exit intent. */
const P_CONTINUE: string[] = [
  'talk',
  'talking',
  'continue',
  'carry on',
  'keep going',
  'pick this up',
  'разговаривать',
  'говорить',
  'общаться',
  'продолжать',
  'продолжить',
  'продолжим',
];

/** Stopping. Negating one of these SUPPRESSES — "I don't want to stop". */
const P_STOP: string[] = [
  'stop',
  'finish',
  'enough',
  'остановиться',
  'останавливаться',
  'остановимся',
  'прекратить',
  'закончить',
  'закончим',
  'заканчивать',
  'хватит',
  'стоп',
];

/** Leaving. Inherently session-scoped; negating one SUPPRESSES. */
const P_DEPART: string[] = [
  'go',
  'go now',
  'leave',
  'logging off',
  'log off',
  'идти',
  'пора',
  'пойду',
  'уйти',
  'ухожу',
];

/** Bare "done" is ambiguous; "done for today" is a session exit. */
const P_DONE: string[] = ['done'];

/** Self-contained sign-offs — no scope marker needed. */
const SIGNOFF: string[] = [
  'goodbye',
  'bye for now',
  'see you tomorrow',
  'speak tomorrow',
  'до свидания',
  'до завтра',
  'увидимся завтра',
];

// --- Scope: what the predicate applies to -----------------------------------
/** Ends the SESSION: totality, the day, or deferral to a future session. */
const SCOPE_SESSION: string[] = [
  'for today',
  'for now',
  'больше',
  'на сегодня',
];

/** Deferral to a later session — also session scope, listed for audit clarity. */
const DEFERRAL: string[] = [
  'tomorrow',
  'later',
  'another time',
  'next time',
  'завтра',
  'в другой раз',
  'в следующий раз',
  'потом',
];

/** Restricts to the current material — keeps the intent at ACTIVITY level. */
const SCOPE_TOPIC: string[] = [
  'about something else',
  'something else',
  'about this',
  'about that',
  'this topic',
  'об этом',
  'про это',
  'о другом',
  'на эту тему',
];

/** Proposes a joint change of course; distinguishes «давай в следующий раз»
 *  (ending now) from "I will write to you later" (future contact, not exit). */
const COOPERATIVE: string[] = [
  "let's",
  'lets',
  'can we',
  'could we',
  'shall we',
  'давай',
  'давайте',
];

/**
 * Someone other than the user is doing it — "He is going to leave tomorrow" —
 * or the user is REPORTING someone's words rather than speaking them: "I never
 * said goodbye", «он сказал увидимся завтра».
 */
const THIRD_PERSON: string[] = [
  ' he ',
  ' she ',
  ' they ',
  ' him ',
  ' her ',
  ' он ',
  ' она ',
  ' они ',
  ' said ',
  ' told ',
  ' сказал ',
  ' сказала ',
  ' говорит ',
];

/**
 * A departure verb is only an exit when it is TERMINAL. With a complement it is
 * a metaphor, a direction or a relationship — "go deeper", "go back to that",
 * «уйти от него», «ухожу в себя». Those are ordinary clinical material and must
 * never end a session.
 */
const COMPLEMENT: string[] = [
  'deeper',
  'back',
  'through',
  'further',
  'away',
  'into',
  'on',
  'дальше',
  'вперёд',
  'глубже',
  'в',
  'от',
  'к',
  'из',
  'туда',
  'сюда',
];

/** Obligation or imminence — what made the original whole phrases precise. */
const OBLIGATION: string[] = [
  'need to',
  'needed to',
  'have to',
  'has to',
  'got to',
  'must',
  'нужно',
  'надо',
];

/** Ignorable tail after a terminal predicate — "I should go now". */
const TAIL_FILLER: string[] = [
  'now',
  'yet',
  'please',
  'сейчас',
  'уже',
  'пожалуйста',
];

/** Ignorable residue around a standalone sign-off — "ok, goodbye". */
const SIGNOFF_FILLER: string[] = [
  'ok',
  'okay',
  'well',
  'thanks',
  'thank',
  'you',
  'so',
  'and',
  'please',
  'ну',
  'и',
  'ок',
  'спасибо',
  'пожалуйста',
  'ладно',
  'хорошо',
];

/** Volition negation — forms intent when it governs a CONTINUE predicate. */
const VOLITION_NEG: string[] = [
  "don't want",
  'dont want',
  'do not want',
  "don't feel like",
  'не хочу',
  'не хочется',
];

/** Any negation — suppresses when it governs a STOP or DEPART predicate. */
const PLAIN_NEG: string[] = [
  "don't",
  'dont',
  'do not',
  ' not ',
  ' never ',
  ' не ',
  ' нет ',
];

/** Idiom: "go there" is topical, not departure. */
const TOPICAL_IDIOM: string[] = ['rather not go there'];

/** How many characters before a predicate are inspected for a governing word. */
const GOVERN_WINDOW = 28;

/**
 * Punctuation denylist rather than a letter allowlist: `\p{...}` needs the `u`
 * flag, which this project's tsconfig target does not allow. Listing the
 * punctuation keeps every script's letters intact.
 */
const PUNCTUATION = /[.,!?;:()[\]{}"«»…—–\-_*+=<>|@#$%^&~`/\\]/g;

/**
 * Normalise for matching: lower-case, punctuation to whitespace, collapse
 * runs, then pad with single spaces so every component can be matched with its
 * own surrounding spaces. Apostrophes survive — they are load-bearing
 * ("i'm", "let's") and variants are listed for both spellings.
 */
function normalise(message: string): string {
  const body = message
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ` ${body} `;
}

type Hit = { phrase: string; index: number };

/** First component of `phrases` present in `text`, with its index. */
function find(text: string, phrases: string[]): Hit | null {
  for (const phrase of phrases) {
    const needle = phrase.startsWith(' ') || phrase.endsWith(' ') ? phrase : ` ${phrase} `;
    const i = text.indexOf(needle);
    if (i >= 0) return { phrase, index: i };
  }
  return null;
}

function has(text: string, phrases: string[]): boolean {
  return find(text, phrases) !== null;
}

/** True when one of `phrases` sits shortly before `index`. */
function governedBy(text: string, index: number, phrases: string[]): boolean {
  const before = text.slice(Math.max(0, index - GOVERN_WINDOW), index + 1);
  return phrases.some((p) => before.includes(p));
}

/** The whitespace-separated tokens after a matched phrase. */
function tokensAfter(text: string, hit: Hit): string[] {
  return text
    .slice(hit.index + hit.phrase.length + 1)
    .trim()
    .split(' ')
    .filter(Boolean);
}

/**
 * Terminal = nothing meaningful follows the predicate. "I should go now" is
 * terminal; "I want to go deeper" is not.
 */
function isTerminal(text: string, hit: Hit): boolean {
  return tokensAfter(text, hit).every((t) => TAIL_FILLER.includes(t));
}

/** The predicate is carrying a complement, so it is not a departure. */
function hasComplement(text: string, hit: Hit): boolean {
  const next = tokensAfter(text, hit)[0];
  return next !== undefined && COMPLEMENT.includes(next);
}

/**
 * A sign-off only counts when it IS the utterance. Removing it must leave
 * nothing substantive behind — otherwise the phrase is being talked ABOUT
 * ("до завтра ещё далеко", "I never said goodbye to my father") rather than
 * used to leave.
 */
function isStandalone(text: string, hit: Hit): boolean {
  const residue = (
    text.slice(0, hit.index) +
    ' ' +
    text.slice(hit.index + hit.phrase.length + 1)
  )
    .trim()
    .split(' ')
    .filter(Boolean);
  return residue.every((t) => SIGNOFF_FILLER.includes(t));
}

/**
 * Classify a user message.
 *
 * Rule order is load-bearing and mirrors the precision bias: deliberation and
 * exhaustion are removed first, then suppression, then scope decides between
 * session and activity. Where an intent is formed with no scope marker, the
 * conservative class wins.
 */
export function detectExitIntent(message: string): ExitIntentResult {
  if (typeof message !== 'string' || message.trim().length === 0) return NO_INTENT;
  const text = normalise(message);

  // 1. Deliberation about the self is never a decision.
  const deliberative = find(text, DELIBERATIVE);
  if (deliberative) return { intent: 'ambiguous', matched: deliberative.phrase };

  // 2. Exhaustion and hopelessness. CAPABILITY negation, never volition —
  //    this is what keeps «я больше не могу» apart from «больше не хочу
  //    разговаривать» without reaching into the crisis boundary.
  const capability = find(text, CAPABILITY_NEG);
  if (capability) return { intent: 'ambiguous', matched: capability.phrase };
  const hopeless = find(text, HOPELESSNESS);
  if (hopeless) return { intent: 'ambiguous', matched: hopeless.phrase };

  // 3. Idiom guard: "I'd rather not go there" is about the material.
  const idiom = find(text, TOPICAL_IDIOM);
  if (idiom) return { intent: 'activity_stop', matched: idiom.phrase };

  // 4. Sign-offs need no scope marker — but they must BE the utterance, not
  //    appear inside one. Substring presence alone was a live false-positive
  //    surface: «до завтра ещё далеко», "I never said goodbye to my father".
  const signoff = find(text, SIGNOFF);
  if (signoff && isStandalone(text, signoff)) {
    return { intent: 'session_exit', matched: signoff.phrase };
  }

  const topic = has(text, SCOPE_TOPIC);
  const sessionScope = has(text, SCOPE_SESSION);
  const deferral = has(text, DEFERRAL);
  const cooperative = has(text, COOPERATIVE);

  // 5. Locate the predicate.
  const cont = find(text, P_CONTINUE);
  const stop = find(text, P_STOP);
  const depart = find(text, P_DEPART);
  const done = find(text, P_DONE);
  const predicate = cont ?? stop ?? depart ?? done;

  // 6. No predicate: only a cooperative deferral proposal counts. This is what
  //    separates «давай в следующий раз» (ending now) from "I will write to you
  //    later" (future contact, deliberately excluded).
  if (!predicate) {
    if (topic && cooperative) return { intent: 'activity_stop', matched: 'topic_scope' };
    if (deferral && cooperative) return { intent: 'session_exit', matched: 'deferral' };
    return NO_INTENT;
  }

  // 7. Someone else is doing it — "He is going to leave tomorrow".
  if (governedBy(text, predicate.index, THIRD_PERSON)) return NO_INTENT;

  // 8. Negation role. Negating a STOP or DEPART predicate cancels the
  //    candidate; negating a CONTINUE predicate forms the intent.
  const isContinue = predicate === cont;
  const governingVolitionNeg = governedBy(text, predicate.index, VOLITION_NEG);
  const governingPlainNeg = governedBy(text, predicate.index, PLAIN_NEG);

  if (!isContinue && governingPlainNeg) return NO_INTENT;
  if (isContinue && governingPlainNeg && !governingVolitionNeg) return NO_INTENT;

  // 9. Topic restriction keeps it at activity level, whatever else is present.
  if (topic) return { intent: 'activity_stop', matched: predicate.phrase };

  // 10. Session scope or deferral lifts it to a session exit.
  if (sessionScope || deferral) {
    return { intent: 'session_exit', matched: predicate.phrase };
  }

  // 11. No scope marker. A departure verb is session-scoped ONLY when it is
  //     terminal or under an obligation, and never when it carries a
  //     complement. This is what the original whole-phrase list encoded
  //     ("I need to go", «мне пора») and what bare-predicate matching lost:
  //     "I want to go deeper", "let's go back to that", «я хочу уйти от него»,
  //     «я ухожу в себя», «пора что-то менять» are all ordinary material.
  if (predicate === depart) {
    if (hasComplement(text, predicate)) return NO_INTENT;
    const obliged = governedBy(text, predicate.index, OBLIGATION);
    if (!obliged && !isTerminal(text, predicate)) return NO_INTENT;
    return { intent: 'session_exit', matched: predicate.phrase };
  }
  if (predicate === done) return { intent: 'ambiguous', matched: predicate.phrase };
  return { intent: 'activity_stop', matched: predicate.phrase };
}
