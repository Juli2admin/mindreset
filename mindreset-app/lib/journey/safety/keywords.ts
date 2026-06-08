// Synchronous keyword scan — runs BEFORE the LLM is called.
// Conservative pattern set: false positives acceptable, false negatives are not.
// For borderline language the async verifier (verifier.ts) is the safety net.
//
// On a keyword hit, the LLM is NOT called at all:
//   1. The user's message is persisted.
//   2. The verbatim crisis response (Shared Core §7) goes out.
//   3. The Journey is frozen-for-review until manually cleared.
//
// The Journey users are doing deliberate, often intense, emotional work. The
// rule from MiniMind applies even more strongly here:
//   EMOTION IS NOT CRISIS.
// Frustration, despair, anger, sadness, exhaustion, grief, shame, numbness —
// these are emotions, not crises. They are precisely what the method works
// with. Patterns below target INTENT + SPECIFICITY/IMMINENCE, not affect.

export type RedFlagType =
  | 'suicidal'
  | 'self-harm'
  | 'violence'
  | 'panic_severe'
  | 'dissociation_severe'
  | 'psychosis'
  | 'flashback_in_progress';

export type RedFlagHit = {
  matched: boolean;
  flagType?: RedFlagType;
  matchedPattern?: string;
};

// ---------------------------------------------------------------------------
// Suicidal — intent + (specificity OR imminence OR active danger)
// ---------------------------------------------------------------------------
const SUICIDAL_PATTERNS: RegExp[] = [
  // Direct first-person intent
  /\b(i\s+(am\s+going\s+to|will|wanna|want\s+to|plan\s+to|am\s+about\s+to))\s+(kill|end|off)\s+myself\b/i,
  /\b(i\s+(am\s+going\s+to|will|wanna|want\s+to|plan\s+to))\s+(commit\s+suicide|take\s+my\s+own\s+life|do\s+it\s+tonight|end\s+(it|my\s+life))\b/i,
  // Method + ownership
  /\b(i\s+have)\s+(the\s+)?(pills|rope|gun|knife|blade)\s+(ready|here|next\s+to\s+me)\b/i,
  /\b(i\s+am)\s+(holding|with)\s+(the\s+)?(pills|rope|gun|knife|blade)\b/i,
  // Single-clause classic markers (caught by the verifier too — covered here for speed)
  /\bi\s+want\s+to\s+die\b/i,
  /\bi\s+(do\s*not|don'?t)\s+want\s+to\s+live\b/i,
  /\bi\s+(do\s*not|don'?t)\s+want\s+to\s+be\s+(here|alive)\b/i,
  /\bend\s+(my\s+)?life\b/i,
  /\bsuicid(e|al)\s+(plan|note|thoughts?\s+(with|and)\s+(plan|method))\b/i,
  /\bkill\s+myself\b/i,
  /\btake\s+my\s+own\s+life\b/i,
  /\beveryone\s+(would|will)\s+be\s+better\s+off\s+without\s+me\b/i,
];

// ---------------------------------------------------------------------------
// Self-harm — intent or active behaviour, not historical reference
// ---------------------------------------------------------------------------
const SELF_HARM_PATTERNS: RegExp[] = [
  /\bi\s+(am\s+going\s+to|will|wanna|want\s+to)\s+(cut|burn|hurt)\s+myself\b/i,
  /\bi\s+am\s+cutting\s+(right\s+now|myself)\b/i,
  /\bi\s+(just\s+)?cut\s+myself\s+(again|just\s+now|today|right\s+now)\b/i,
  /\bi\s+am\s+bleeding\s+(right\s+now|from\s+(the\s+)?cut)\b/i,
  /\bi\s+(want|need)\s+to\s+(make\s+)?(bleed|hurt)\s+myself\b/i,
  /\bself[\s-]?harm(ing)?\s+(right\s+now|tonight|today)\b/i,
];

// ---------------------------------------------------------------------------
// Violence — intent to harm a specific other or others
// ---------------------------------------------------------------------------
const VIOLENCE_PATTERNS: RegExp[] = [
  /\bi\s+(am\s+going\s+to|will|wanna|want\s+to|plan\s+to)\s+(kill|hurt|murder|attack|stab|shoot)\s+(him|her|them|someone|my)\b/i,
  /\bi\s+have\s+(the\s+)?(gun|knife)\s+(for|to\s+kill|to\s+hurt)\b/i,
];

// ---------------------------------------------------------------------------
// Severe panic / acute medical — current physical-symptom emergency markers
// ---------------------------------------------------------------------------
const PANIC_SEVERE_PATTERNS: RegExp[] = [
  /\bi\s+(am\s+)?(can'?t|cannot)\s+breathe\b/i,
  /\b(having|i\s+think\s+i\s+am\s+having)\s+a\s+heart\s+attack\b/i,
  /\bi\s+(am\s+)?dying\s+right\s+now\b/i,
];

// ---------------------------------------------------------------------------
// Severe dissociation — markers the user cannot exit (current-tense)
// ---------------------------------------------------------------------------
const DISSOCIATION_SEVERE_PATTERNS: RegExp[] = [
  /\bi\s+(do\s*not|don'?t)\s+exist\b/i,
  /\bi\s+am\s+(not\s+real|nothing|no\s+one)\b/i,
  /\bnone\s+of\s+this\s+is\s+real\b/i,
];

// ---------------------------------------------------------------------------
// Psychosis-shaped content (loss of reality testing, command hallucinations)
// ---------------------------------------------------------------------------
const PSYCHOSIS_PATTERNS: RegExp[] = [
  /\bvoices?\s+(are\s+)?telling\s+me\s+to\s+(hurt|kill|harm)\b/i,
  /\b(they|the\s+voices?)\s+(are|is)\s+(commanding|ordering|making)\s+me\b/i,
];

// ---------------------------------------------------------------------------
// Trauma flashback in sensory detail the user cannot exit (current-tense)
// ---------------------------------------------------------------------------
const FLASHBACK_IN_PROGRESS_PATTERNS: RegExp[] = [
  /\bi\s+(can'?t|cannot)\s+(get\s+out|come\s+back|stop\s+seeing|stop\s+feeling)\b.*\b(it|him|her|them|the\s+(memory|scene))\b/i,
  /\bi\s+am\s+back\s+(there|in\s+(it|the\s+(room|car|house)))\b/i,
];

const BANDS: Array<{ patterns: RegExp[]; flagType: RedFlagType }> = [
  { patterns: SUICIDAL_PATTERNS, flagType: 'suicidal' },
  { patterns: SELF_HARM_PATTERNS, flagType: 'self-harm' },
  { patterns: VIOLENCE_PATTERNS, flagType: 'violence' },
  { patterns: PANIC_SEVERE_PATTERNS, flagType: 'panic_severe' },
  { patterns: DISSOCIATION_SEVERE_PATTERNS, flagType: 'dissociation_severe' },
  { patterns: PSYCHOSIS_PATTERNS, flagType: 'psychosis' },
  { patterns: FLASHBACK_IN_PROGRESS_PATTERNS, flagType: 'flashback_in_progress' },
];

export function scanForJourneyRedFlag(message: string): RedFlagHit {
  for (const band of BANDS) {
    for (const re of band.patterns) {
      if (re.test(message)) {
        return { matched: true, flagType: band.flagType, matchedPattern: re.source };
      }
    }
  }
  return { matched: false };
}

// Verbatim from Shared Core §7. Delivered as-is when the keyword scan trips,
// or when the async verifier returns clear_crisis, or while the Journey is
// in frozen-for-review state.
export const CRISIS_RESPONSE_EN = `I hear how serious this is. What you're carrying right now is more than this conversation is built for, and I want you safe. Please reach out to a person who can be with you in this:

Samaritans — 116 123 (free, 24/7)
NHS 111, option 2 — for mental health crisis
Your GP if you have one
If you're in immediate physical danger, call 999 or go to A&E

I'll be here when you're ready to come back.`;
