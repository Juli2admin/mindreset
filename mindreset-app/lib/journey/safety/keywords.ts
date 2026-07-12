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
  // "I don't want to live" only when the phrase is terminated (end of message,
  // punctuation) or followed by an intensifier (anymore / any longer). Bare
  // "\b" after "live" matched abuse disclosures like "I don't want to live
  // with him" as suicidal and instantly froze the user; borderline / ambiguous
  // forms now fall through to the async verifier (verifier.ts §"ABUSE
  // DISCLOSURE IS NOT CRISIS"), which is the design's safety net for exactly
  // this shape.
  /\bi\s+(do\s*not|don'?t)\s+want\s+to\s+live(\s*$|\s*[.!?,;]|\s+any\s?more\b|\s+any\s+longer\b)/i,
  // Same shape of fix for "I don't want to be here". "alive" is unambiguous
  // — nothing after it flips the meaning — so it keeps its bare word boundary.
  // "here", though, previously matched "I don't want to be here with him" as
  // suicidal (identical class to the "live" bug above). Narrow "here" to the
  // same terminated / intensified alternation; leave "alive" as-is.
  /\bi\s+(do\s*not|don'?t)\s+want\s+to\s+be\s+here(\s*$|\s*[.!?,;]|\s+any\s?more\b|\s+any\s+longer\b)/i,
  /\bi\s+(do\s*not|don'?t)\s+want\s+to\s+be\s+alive\b/i,
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
  // "I can't breathe" — 2026-07-11 false-positive fix. Previously the bare
  // `\bi\s+(am\s+)?(can'?t|cannot)\s+breathe\b` pattern matched somatic
  // phenomenology (post-release residue in Journey work: "chest gone down
  // and squeezed my lungs, I can't breathe, describing the picture") and
  // froze a user mid-integration. In Journey clinical context, "I can't
  // breathe" is almost always a body-report about a somatic experience the
  // AI just guided the user into. True medical panic is characterised by
  // co-occurring emergency signalling — help-seeking, call-for-help,
  // imminent physical failure, or explicit inability-to-continue markers
  // — in the same message. Bare "I can't breathe" now falls through to
  // the async verifier, whose SYSTEM_PROMPT ("POST-RELEASE PHENOMENOLOGY
  // IS NOT PANIC") classifies it with full context.
  /\bi\s+(am\s+)?(can'?t|cannot)\s+breathe\b.{0,80}\b(help\s+me|call\s+(someone|911|999|ambulance|emergency)|passing\s+out|about\s+to\s+pass\s+out|dying|emergency)\b/i,
  /\b(help\s+me|call\s+(someone|911|999|ambulance|emergency)|emergency)\b.{0,80}\bi\s+(am\s+)?(can'?t|cannot)\s+breathe\b/i,
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

// PR σ (2026-07-11). NFKC normalisation before regex matching so
// homoglyph-style bypasses (mathematical bold "𝗄𝗂𝗅𝗅", full-width
// "Ｉ ｗａｎｔ ｔｏ ｄｉｅ") fold to their plain ASCII equivalents. Without
// this, the async verifier is the only safety net for such messages —
// which means the AI reply already streamed before the freeze triggers.
// NFKC is safe for Cyrillic (Russian native locale) — it doesn't
// alter Cyrillic letters, only decomposes compatibility characters.
export function scanForJourneyRedFlag(message: string): RedFlagHit {
  const normalised = message.normalize('NFKC');
  for (const band of BANDS) {
    for (const re of band.patterns) {
      if (re.test(normalised)) {
        return { matched: true, flagType: band.flagType, matchedPattern: re.source };
      }
    }
  }
  return { matched: false };
}

// Verbatim from Shared Core §7. Delivered as-is when the keyword scan trips,
// or when the async verifier returns clear_crisis, or while the Journey is
// in frozen-for-review state.
//
// PR ρ3 (2026-07-12) — added non-UK signpost so Russian speakers (and
// anyone else) outside the UK have actionable resources at the moment
// they most need them. UK lines stay as the primary block because
// Julia's operating jurisdiction is UK and the RU-native audience skews
// UK-resident. But we can't assume every Russian speaker is in Britain —
// a Muscovite in acute crisis needs a Moscow line, not Samaritans.
export const CRISIS_RESPONSE_EN = `I hear how serious this is. What you're carrying right now is more than this conversation is built for, and I want you safe. Please reach out to a person who can be with you in this:

In the UK:
Samaritans — 116 123 (free, 24/7)
NHS 111, option 2 — for mental health crisis
Your GP if you have one
If you're in immediate physical danger, call 999 or go to A&E

Outside the UK:
Call your local emergency service (112 in the EU, 911 in the US and Canada).
For a national suicide-prevention line, search "suicide prevention hotline [your country]" — most countries have one and they're free and 24/7.

I'll be here when you're ready to come back.`;

export const CRISIS_RESPONSE_RU = `Я слышу, насколько это серьёзно. То, что вы сейчас несёте, — больше, чем может вместить этот разговор, и я хочу, чтобы вы были в безопасности. Пожалуйста, обратитесь к человеку, который сможет побыть рядом:

В Великобритании:
Samaritans — 116 123 (бесплатно, круглосуточно)
NHS 111, вариант 2 — кризисная психиатрическая помощь
Ваш врач общей практики, если есть
Если жизнь в непосредственной опасности — звоните 999 или обратитесь в отделение скорой помощи (A&E)

Вне Великобритании:
Позвоните в местную экстренную службу (112 в ЕС, 911 в США и Канаде).
Национальную линию доверия можно найти по запросу «телефон доверия [ваша страна]» — почти в каждой стране такая линия есть, она бесплатная и работает круглосуточно.

Я буду здесь, когда вы будете готовы вернуться.`;

/**
 * Pick the canned crisis response for the user's locale.
 * Default to EN for any locale we don't yet have a translation for —
 * never silently fail to deliver some response in a Red Flag situation.
 */
export function getCrisisResponseForLocale(locale: string | null | undefined): string {
  if (locale === 'ru') return CRISIS_RESPONSE_RU;
  return CRISIS_RESPONSE_EN;
}

// ---------------------------------------------------------------------------
// Cooldown-lift confirmation messages
// PR ξ (2026-07-11). Delivered when the AI safety verifier decides the
// user's next-after-freeze reply is a safety_confirmation and the freeze
// can be lifted. Their next message goes through the normal Journey turn
// flow; this is the "we're back" acknowledgement in between.
// ---------------------------------------------------------------------------
export const COOLDOWN_LIFT_MESSAGE_EN = `Thank you for letting me know. I'm glad you're okay. Take a moment, and let me know when you're ready to keep going.`;

export const COOLDOWN_LIFT_MESSAGE_RU = `Спасибо, что дали знать. Я рада, что с вами всё в порядке. Не спешите — дайте знать, когда будете готовы продолжить.`;

export function getCooldownLiftMessageForLocale(
  locale: string | null | undefined,
): string {
  if (locale === 'ru') return COOLDOWN_LIFT_MESSAGE_RU;
  return COOLDOWN_LIFT_MESSAGE_EN;
}
