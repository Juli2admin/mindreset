// Synchronous keyword scan run BEFORE the LLM is called.
// Slice 1: a small, deliberately conservative pattern set. The full keyword
// set, classifier-trained variants, and second-LLM verifier all come in
// Slice 2 (per the build plan §4).
//
// Order of operations on each user message:
//   1. scanForJourneyRedFlag(user.message) -> if hit, the LLM is NOT called.
//   2. Crisis response (verbatim from Shared Core §7) goes out instead.
//   3. The journey is frozen-for-review.
//   4. The user's next message will continue to receive the holding response
//      until a human reviewer clears the freeze.

export type RedFlagHit = {
  matched: boolean;
  flagType?: 'suicidal' | 'self-harm' | 'violence';
  matchedPattern?: string;
};

// Conservative, lowercase-folded patterns. False positives are acceptable;
// false negatives are not — for borderline language the async verifier
// (Slice 2) is the safety net.
const SUICIDAL_PATTERNS: RegExp[] = [
  /\bkill\s+myself\b/i,
  /\bend\s+(my\s+)?life\b/i,
  /\bsuicid(e|al)\b/i,
  /\btake\s+my\s+own\s+life\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+here)\b/i,
  /\bthought(s)?\s+(of|about)\s+suicide\b/i,
];

const SELF_HARM_PATTERNS: RegExp[] = [
  /\bself[\s-]?harm\b/i,
  /\bcut(ting)?\s+myself\b/i,
  /\bhurt\s+myself\b/i,
];

const VIOLENCE_PATTERNS: RegExp[] = [
  /\bkill\s+(him|her|them)\b/i,
  /\bwant\s+to\s+hurt\s+(him|her|them|someone)\b/i,
];

export function scanForJourneyRedFlag(message: string): RedFlagHit {
  for (const re of SUICIDAL_PATTERNS) {
    if (re.test(message)) return { matched: true, flagType: 'suicidal', matchedPattern: re.source };
  }
  for (const re of SELF_HARM_PATTERNS) {
    if (re.test(message)) return { matched: true, flagType: 'self-harm', matchedPattern: re.source };
  }
  for (const re of VIOLENCE_PATTERNS) {
    if (re.test(message)) return { matched: true, flagType: 'violence', matchedPattern: re.source };
  }
  return { matched: false };
}

// Verbatim from Shared Core §7. Delivered as-is when the keyword scan trips
// OR when the AI's state report marks safetyFlag === "red_flag".
export const CRISIS_RESPONSE_EN = `I hear how serious this is. What you're carrying right now is more than this conversation is built for, and I want you safe. Please reach out to a person who can be with you in this:

Samaritans — 116 123 (free, 24/7)
NHS 111, option 2 — for mental health crisis
Your GP if you have one
If you're in immediate physical danger, call 999 or go to A&E

I'll be here when you're ready to come back.`;
