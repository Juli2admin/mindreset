// Explicit exit-intent detection — Activated Closure Phase 2 (structural).
//
// Deterministic, English-only, high-precision. Pure module: no I/O, no model
// call, no clinical reasoning.
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
// English only. Verified 2026-08-06: lib/journey/safety/keywords.ts has zero
// Cyrillic inside its detection region — Journey has no multilingual
// deterministic keyword infrastructure, so this matches the existing pattern
// rather than inventing one. (MiniMind's scanner is multilingual; it is a
// separate subsystem with a different structure.)
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
 * Deliberation about the self — the user is asking US to decide, so they have
 * not decided. Never `session_exit`, whatever else matches. Checked first.
 *
 * This replaces a blanket "reject anything ending in ?" rule, which would
 * also have rejected genuine requests like "can we stop here for today?".
 * The distinction is who is being asked to decide, not punctuation.
 */
const DELIBERATIVE: RegExp[] = [
  /\bshould i\b/,
  /\bdo you think i should\b/,
  /\bmaybe i should\b/,
  /\bis it time\b/,
  /\bwould it be better if i\b/,
];

/**
 * Session-scope markers. A stop/finish verb only becomes a SESSION exit when
 * one of these is attached — that is the whole activity-vs-session
 * distinction, expressed structurally rather than by listing every verb.
 */
const SESSION_EXIT: RegExp[] = [
  // Departure
  /\bi need to go\b/,
  /\bi have to go\b/,
  /\bi've got to go\b/,
  /\bi need to go now\b/,
  /\bi should go now\b/,
  // End-of-day scope
  /\blet'?s stop here for today\b/,
  /\blet'?s stop for today\b/,
  /\bcan we stop here for today\b/,
  /\bcould we stop here for today\b/,
  /\bthat'?s enough for today\b/,
  /\benough for today\b/,
  /\bi'?m done for today\b/,
  // Sign-off
  /\bi'?m logging off\b/,
  /\bi'?m going to log off\b/,
  /\bgoodbye\b/,
  /\bbye for now\b/,
  /\bsee you tomorrow\b/,
  /\bspeak tomorrow\b/,
  // Deferral to a future session
  /\bcan we continue tomorrow\b/,
  /\blet'?s continue tomorrow\b/,
  /\bcan we pick this up later\b/,
  /\blet'?s carry on another time\b/,
  /\bcan we do this another time\b/,
];

/**
 * Stopping the current activity, topic or exploration. Recorded so the signal
 * is not lost, but NEVER enters closure — owner decision 2026-08-06.
 */
const ACTIVITY_STOP: RegExp[] = [
  /\bi need to stop\b/,
  /\bi want to stop\b/,
  /\bcan we stop\b/,
  /\bcould we stop\b/,
  /\blet'?s stop\b/,
  /\bcan we not do this\b/,
  /\bi don'?t want to do this\b/,
  /\bcan we talk about something else\b/,
  /\bi'?d rather not go there\b/,
  /\blet'?s leave that\b/,
];

/**
 * Recorded, never entering. These sit close to crisis phrasing on purpose:
 * exhaustion and crisis are indistinguishable at the phrase level, so this
 * module must not act on them.
 */
const AMBIGUOUS: RegExp[] = [
  /\bi can'?t do this any ?more\b/,
  /\bi can'?t any ?more\b/,
  /\bwhat'?s the point\b/,
  /\bthis isn'?t working\b/,
  /\bi give up\b/,
];

/** Bare "I'm done" only — "I'm done for today" is a session exit, matched first. */
const AMBIGUOUS_BARE_DONE = /\bi'?m done\b/;

const NEGATORS = /\b(don'?t|do not|not|never|no)\b/;

/** How many characters before a match are inspected for a negator. */
const NEGATION_WINDOW = 24;

/**
 * Normalise for matching: lower-case, collapse whitespace. Punctuation is
 * kept — apostrophes are load-bearing ("i'm", "let's") and the patterns use
 * word boundaries, so stray punctuation cannot create a false match.
 */
function normalise(message: string): string {
  return message.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * True when a negator sits shortly before the match — "I don't want to stop"
 * contains "i want to stop" and must not fire.
 */
function isNegated(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - NEGATION_WINDOW), matchIndex);
  return NEGATORS.test(before);
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = p.exec(text);
    if (m && !isNegated(text, m.index)) return m[0];
  }
  return null;
}

/**
 * Classify a user message. Pure and deterministic.
 *
 * Precedence: deliberation → session exit → activity stop → ambiguous.
 * Deliberation is checked first so "should I go now?" can never be read as a
 * decision to leave.
 */
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
  const bareDone = AMBIGUOUS_BARE_DONE.exec(text);
  if (bareDone && !isNegated(text, bareDone.index)) {
    return { intent: 'ambiguous', matched: bareDone[0] };
  }

  return NO_INTENT;
}
