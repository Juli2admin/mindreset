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
//      They are classified `activity_stop` and never enter closure. The master
//      prompt already covers them clinically ("The user's explicit request
//      governs… drop the interpretation you were pursuing").
//   2. AI-initiated disengagement is out of scope. Where the AI winds a user
//      down unprompted, no user phrase exists to detect and this module is
//      not the mechanism.
//   3. Future-contact statements ("I'll message you after") are NOT exit
//      intent. A user can say they will write later and keep talking.
//
// EN + RU (owner decision 2026-08-06: the Journey is used in Russian as well
// as English, so deterministic closing behaviour must work there too).
// Journey's own crisis scanner is English-only and gains nothing here; this
// module follows MiniMind's precedent of a flat multilingual phrase list.
//
// Nothing calls this module. It is dormant until the clinical half of the
// closure protocol exists.

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
  /** The phrase that matched, for audit. null when `none`. */
  matched: string | null;
};

const NO_INTENT: ExitIntentResult = Object.freeze({ intent: 'none', matched: null });

/**
 * MATCHING IS SPACE-PADDED, NOT \b-BASED.
 *
 * Verified 2026-08-06: JavaScript's \b is ASCII-only — /\bмне\b/ does not
 * match "мне пора" at all. A Russian phrase list written in the \b style
 * would silently never fire. Every phrase below is therefore matched as a
 * whitespace-delimited substring of a normalised, space-padded message, which
 * is script-agnostic and needs no lookarounds.
 *
 * Phrases are plain strings so the list stays auditable for owner review.
 * Apostrophe variants are listed explicitly rather than encoded as regex.
 */

/**
 * Deliberation about the self — the user is asking US to decide, so they have
 * not decided. Never `session_exit`, whatever else matches. Checked first.
 *
 * This replaces a blanket "reject anything ending in ?" rule, which would
 * also have rejected genuine requests like "can we stop here for today?".
 * The distinction is who is being asked to decide, not punctuation.
 */
const DELIBERATIVE: string[] = [
  // EN
  'should i',
  'do you think i should',
  'maybe i should',
  'is it time',
  'would it be better if i',
  // RU
  'мне стоит',
  'может мне',
  'пора ли мне',
  'как думаешь мне',
];

/**
 * Session-scope markers. A stop/finish verb only becomes a SESSION exit when
 * one of these is attached — that is the whole activity-vs-session
 * distinction, expressed structurally rather than by listing every verb.
 */
const SESSION_EXIT: string[] = [
  // EN — departure
  'i need to go',
  'i have to go',
  "i've got to go",
  'ive got to go',
  'i need to go now',
  'i should go now',
  // EN — end-of-day scope
  "let's stop here for today",
  'lets stop here for today',
  "let's stop for today",
  'lets stop for today',
  'can we stop here for today',
  'could we stop here for today',
  "that's enough for today",
  'thats enough for today',
  'enough for today',
  "i'm done for today",
  'im done for today',
  // EN — sign-off
  "i'm logging off",
  'im logging off',
  "i'm going to log off",
  'goodbye',
  'bye for now',
  'see you tomorrow',
  'speak tomorrow',
  // EN — deferral to a future session
  'can we continue tomorrow',
  "let's continue tomorrow",
  'lets continue tomorrow',
  'can we pick this up later',
  "let's carry on another time",
  'lets carry on another time',
  'can we do this another time',
  // RU — departure
  'мне нужно идти',
  'мне надо идти',
  'мне пора',
  'мне пора идти',
  'я пойду',
  // RU — end-of-day scope
  'давай закончим на сегодня',
  'давай на сегодня закончим',
  'на сегодня хватит',
  'на сегодня достаточно',
  // RU — deferral to a future session
  'продолжим завтра',
  'продолжим в другой раз',
  'давай продолжим потом',
  'давай в следующий раз',
  // RU — sign-off
  'до свидания',
  'до завтра',
  'увидимся завтра',
];

/**
 * Stopping the current activity, topic or exploration. Recorded so the signal
 * is not lost, but NEVER enters closure — owner decision 2026-08-06.
 */
const ACTIVITY_STOP: string[] = [
  // EN
  'i need to stop',
  'i want to stop',
  'can we stop',
  'could we stop',
  "let's stop",
  'lets stop',
  'can we not do this',
  "i don't want to do this",
  'can we talk about something else',
  "i'd rather not go there",
  "let's leave that",
  'lets leave that',
  // RU
  'мне нужно остановиться',
  'я хочу остановиться',
  'давай остановимся',
  'давай прекратим',
  'я хочу закончить',
  'я не хочу об этом',
  'давай о другом',
  'хватит',
  'стоп',
];

/**
 * Recorded, never entering. These sit close to crisis phrasing on purpose:
 * exhaustion and crisis are indistinguishable at the phrase level, so this
 * module must not act on them.
 */
const AMBIGUOUS: string[] = [
  // EN
  "i can't do this anymore",
  "i can't do this any more",
  'i cant do this anymore',
  "i can't anymore",
  "i can't any more",
  "what's the point",
  'whats the point',
  "this isn't working",
  'this isnt working',
  'i give up',
  // RU
  'я больше не могу',
  'я не могу так больше',
  'какой смысл',
  'это не работает',
  'я сдаюсь',
];

/** Bare "I'm done" only — "I'm done for today" is a session exit, matched first. */
const AMBIGUOUS_BARE_DONE = ["i'm done", 'im done'];

/** Script-agnostic: matched against the space-padded text, so no \b needed. */
const NEGATORS = ["don't", 'dont', 'do not', ' not ', ' never ', ' no ', ' не '];

/** How many characters before a match are inspected for a negator. */
const NEGATION_WINDOW = 24;

/**
 * Punctuation denylist rather than a letter allowlist: `\p{...}` needs the `u`
 * flag, which this project's tsconfig target does not allow. Listing the
 * punctuation keeps every script's letters intact.
 */
const PUNCTUATION = /[.,!?;:()[\]{}"«»…—–\-_*+=<>|@#$%^&~`/\\]/g;

/**
 * Normalise for matching: lower-case, punctuation to whitespace, collapse
 * runs, then pad with single spaces so every phrase can be matched with its
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

/**
 * True when a negator sits shortly before the match — "I don't want to stop"
 * contains "i want to stop" and must not fire. Phrases that themselves begin
 * with a negator (e.g. "я не хочу об этом") are unaffected, because only the
 * text BEFORE the match index is inspected.
 */
function isNegated(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - NEGATION_WINDOW), matchIndex);
  return NEGATORS.some((n) => before.includes(n));
}

function firstMatch(text: string, phrases: string[]): string | null {
  for (const phrase of phrases) {
    const needle = ` ${phrase} `;
    const i = text.indexOf(needle);
    if (i >= 0 && !isNegated(text, i + 1)) return phrase;
  }
  return null;
}

export function detectExitIntent(message: string): ExitIntentResult {
  if (typeof message !== 'string' || message.trim().length === 0) return NO_INTENT;
  const text = normalise(message);

  const deliberative = firstMatch(text, DELIBERATIVE);
  if (deliberative) return { intent: 'ambiguous', matched: deliberative };

  const exit = firstMatch(text, SESSION_EXIT);
  if (exit) return { intent: 'session_exit', matched: exit };

  const stop = firstMatch(text, ACTIVITY_STOP);
  if (stop) return { intent: 'activity_stop', matched: stop };

  const ambiguous = firstMatch(text, AMBIGUOUS);
  if (ambiguous) return { intent: 'ambiguous', matched: ambiguous };

  // Checked last: "i'm done for today" is a session exit and has already
  // matched above; bare "i'm done" is ambiguous.
  const bareDone = firstMatch(text, AMBIGUOUS_BARE_DONE);
  if (bareDone) return { intent: 'ambiguous', matched: bareDone };

  return NO_INTENT;
}
