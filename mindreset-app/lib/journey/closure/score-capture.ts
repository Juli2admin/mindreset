// Server-owned stability-score capture — Activated Closure Phase 2.
//
// Deterministic, English-only, pure. Reads the score from the USER'S OWN
// MESSAGE. The model's `stabilityCheck` is audit only and is never the
// authority for a score captured here — owner decision 2026-08-06.
//
// Why this matters beyond ownership: because the CODE asked the question, the
// code already knows which scale was asked and who answered. `scale:
// 'stability'` and `source: 'user_reported'` become FACTS rather than model
// claims, which removes at source the ambiguity Repair 1 has to reject scores
// over (`ambiguous_scale`, `unverified_scale_source`).
//
// ---------------------------------------------------------------------------
// ACCEPTANCE IS STRUCTURAL, NEVER LENGTH-BASED
// ---------------------------------------------------------------------------
// A message yields a score only if it decomposes ENTIRELY into exactly one
// score token plus recognised filler. One unrecognised token rejects. Message
// length is never consulted — "i feel like a 4 right now" is accepted and
// "4 hours of sleep" is not, on structure alone.
//
// The bias is deliberate: high precision, low recall. A missed capture means
// "no score found", which produces no transition. A FALSE capture writes a
// fabricated clinical number. Those costs are not symmetric.
//
// English only, matching Journey's existing deterministic-detection pattern
// (verified 2026-08-06: lib/journey/safety/keywords.ts has no multilingual
// detection). Bare digits and `N/10` are language-neutral, so a non-English
// user answering "4" still works; only hedged English phrasing is recognised.
//
// Nothing calls this module. It is dormant until the clinical half exists.

/** The scale runs 1 (overwhelmed) to 10 (fully grounded). High is good. */
const MIN_SCORE = 1;
const MAX_SCORE = 10;

export type ScoreCaptureFailure =
  | 'no_score_token'
  | 'multiple_score_tokens'
  | 'out_of_range'
  | 'unrecognised_content';

export type ScoreCaptureResult =
  | { found: true; score: number }
  | { found: false; reason: ScoreCaptureFailure };

/**
 * Closed filler set, deliberately small. Anything outside it rejects the whole
 * message, so under-inclusion is the safe direction: widening this is an
 * evidence-driven change after harness evaluation, never a guess.
 */
const FILLER = new Set([
  'a', 'an', 'the', 'i', 'im', "i'm", 'id', "i'd", 'is', 'it', 'its', "it's", 'am',
  'about', 'around', 'roughly', 'maybe', 'probably',
  'say', 'think', 'guess', 'feel', 'like', 'sort', 'kind', 'of',
  'out', 'ten',
  'now', 'today', 'right', 'currently',
  'ok', 'okay', 'well', 'um', 'uh', 'hmm', 'yes', 'yeah',
]);

const WORD_NUMERALS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** `4/10` — one score token, not two numbers. */
const OUT_OF_TEN_SLASH = /^(\d{1,2})\/10$/;

/**
 * Tokenise. Known punctuation becomes whitespace; `/` and the apostrophe are
 * kept (needed for `4/10` and "i'm"). Nothing here depends on length.
 *
 * Deliberately a PUNCTUATION denylist, not a Latin-only allowlist: stripping
 * non-Latin characters would reduce "4 часа сна" to a bare "4" and accept it
 * as a score. Foreign-script words must survive tokenisation so they land in
 * `leftovers`, fail the filler check, and reject the message.
 */
const PUNCTUATION = /[.,!?;:()[\]{}"«»…—–\-_*+=<>|@#$%^&~`]/g;

/**
 * "4 out of 10" / "4 of ten" / "four out of ten" -> drop the denominator, so
 * the message carries ONE score token rather than two numeric candidates.
 * Structural, applied before tokenisation.
 */
const OUT_OF_TEN_PHRASE =
  /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:out\s+)?of\s+(?:10|ten)\b/g;

function tokenise(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(OUT_OF_TEN_PHRASE, '$1')
    .replace(PUNCTUATION, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

type Candidate = { value: number | null; token: string };

/** Recognise a token as a score candidate, or return null if it is not one. */
function asCandidate(token: string): Candidate | null {
  const slash = OUT_OF_TEN_SLASH.exec(token);
  if (slash) {
    const n = Number(slash[1]);
    return { value: Number.isInteger(n) ? n : null, token };
  }
  if (/^\d+$/.test(token)) {
    return { value: Number(token), token };
  }
  if (token in WORD_NUMERALS) {
    return { value: WORD_NUMERALS[token], token };
  }
  return null;
}

/**
 * Capture a stability score from the user's message.
 *
 * "out of ten" phrasing is collapsed during tokenisation, so "4 out of 10"
 * carries a single score token rather than two numeric candidates.
 */
export function captureStabilityScore(message: string): ScoreCaptureResult {
  if (typeof message !== 'string' || message.trim().length === 0) {
    return { found: false, reason: 'no_score_token' };
  }

  const tokens = tokenise(message);
  const candidates: Candidate[] = [];
  const leftovers: string[] = [];

  for (const t of tokens) {
    const c = asCandidate(t);
    if (c) candidates.push(c);
    else leftovers.push(t);
  }

  const scored = candidates;

  if (scored.length === 0) return { found: false, reason: 'no_score_token' };
  if (scored.length > 1) return { found: false, reason: 'multiple_score_tokens' };

  const value = scored[0].value;
  // Out of range is REJECTED, never clamped — clamping would invent a
  // clinical value the user did not give.
  if (value === null || !Number.isInteger(value) || value < MIN_SCORE || value > MAX_SCORE) {
    return { found: false, reason: 'out_of_range' };
  }

  // Every remaining token must be recognised filler. One unknown word rejects
  // the message — this is what keeps "4 hours of sleep" out.
  for (const t of leftovers) {
    if (!FILLER.has(t)) return { found: false, reason: 'unrecognised_content' };
  }

  return { found: true, score: value };
}
