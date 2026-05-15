// Synchronous keyword pre-screener for the Phase 3c safety scanner.
//
// Returns the highest-severity match found in `text`. Tiers are scanned in
// descending order (Sev 5 first, then 4, 3, 2); within a tier, the first
// listed phrase wins. The scanner is pure, fast (< 5 ms), and has no IO.
//
// IMPORTANT: this file contains policy text. The phrase lists are internal
// product knowledge. They MUST NOT be:
//   - rendered to any user-visible surface
//   - returned via any public API
//   - included in documentation files
// They live here only.
//
// Severity meanings (mirrored by the verifier; see Phase 3c instructions):
//   5 — imminent crisis. Intent + (method OR plan OR imminence OR active
//       danger). Triggers cooldown.
//   4 — likely crisis. Intent without specificity. Triggers canned response,
//       no cooldown.
//   3 — ambiguous. Silent log. MiniMind responds normally.
//   2 — soft signal. Silent log only.
//   1 — minimal signal. Produced only by the verifier downgrading a low-
//       confidence keyword hit; the scanner itself never returns Sev 1.

export type SafetyEventType =
  | 'suicidal_ideation'
  | 'self_harm'
  | 'imminent_harm_to_others'
  | 'psychosis_signal'
  | 'acute_medical'
  | 'substance_crisis'
  | 'other';

// Discriminated union: a non-match carries no severity/type fields.
// A match carries a non-Sev-1 severity (Sev 1 is verifier-only territory).
export type KeywordMatch =
  | { matched: false }
  | {
      matched: true;
      severity: 2 | 3 | 4 | 5;
      type: SafetyEventType;
      triggerExcerpt: string;
    };

type Entry = { phrase: string; type: SafetyEventType };

// ============================================================================
// SEVERITY 5 — imminent crisis (cooldown triggered)
// Intent + (method OR plan OR imminence OR active danger).
// Bias: high-confidence multi-word phrases. False negatives preferred over
// false positives at this tier — consequence is a full cooldown.
// ============================================================================
const SEVERITY_5: Entry[] = [
  // Suicidal ideation — intent with imminence or method
  { phrase: "i'm going to kill myself",         type: 'suicidal_ideation' },
  { phrase: 'im going to kill myself',          type: 'suicidal_ideation' },
  { phrase: 'i am going to kill myself',        type: 'suicidal_ideation' },
  { phrase: 'going to kill myself tonight',     type: 'suicidal_ideation' },
  { phrase: 'going to end my life',             type: 'suicidal_ideation' },
  { phrase: 'going to end my life tonight',     type: 'suicidal_ideation' },
  { phrase: "i'm going to end it tonight",      type: 'suicidal_ideation' },
  { phrase: 'want to die tonight',              type: 'suicidal_ideation' },
  { phrase: 'going to die tonight',             type: 'suicidal_ideation' },
  { phrase: "i'm going to overdose",            type: 'suicidal_ideation' },
  { phrase: "i'm going to hang myself",         type: 'suicidal_ideation' },
  { phrase: 'i have pills ready',               type: 'suicidal_ideation' },
  { phrase: 'i have the pills ready',           type: 'suicidal_ideation' },
  { phrase: 'loaded the gun',                   type: 'suicidal_ideation' },
  { phrase: 'i loaded the gun',                 type: 'suicidal_ideation' },
  { phrase: "i'm ready to die",                 type: 'suicidal_ideation' },

  // Self-harm — active in progress or just-completed
  { phrase: "i'm cutting right now",            type: 'self_harm' },
  { phrase: 'im cutting right now',             type: 'self_harm' },
  { phrase: "i'm cutting myself right now",     type: 'self_harm' },
  { phrase: 'i just cut myself',                type: 'self_harm' },
  { phrase: 'i overdosed',                      type: 'self_harm' },
  { phrase: 'i just overdosed',                 type: 'self_harm' },
  { phrase: 'took an overdose',                 type: 'self_harm' },
  { phrase: 'i just took a bunch of pills',     type: 'self_harm' },
  { phrase: 'i just swallowed the pills',       type: 'self_harm' },
  { phrase: "i'm bleeding right now",           type: 'self_harm' },

  // Psychosis signal — command hallucination
  { phrase: 'voices telling me to kill',        type: 'psychosis_signal' },
  { phrase: 'voices telling me to hurt',        type: 'psychosis_signal' },
  { phrase: 'voices are telling me to kill',    type: 'psychosis_signal' },
  { phrase: 'voices are telling me to hurt',    type: 'psychosis_signal' },

  // Acute medical — high specificity, low metaphor risk
  { phrase: 'crushing chest pain',              type: 'acute_medical' },
  { phrase: 'chest pain crushing',              type: 'acute_medical' },
  { phrase: 'having a heart attack',            type: 'acute_medical' },
  { phrase: "i think i'm having a heart attack", type: 'acute_medical' },

  // Imminent harm to others — "hurt" only ("kill X" removed per policy review
  // due to video-game/sports false-positive risk at Sev 5 consequence level)
  { phrase: "i'm going to hurt her",            type: 'imminent_harm_to_others' },
  { phrase: "i'm going to hurt him",            type: 'imminent_harm_to_others' },
  { phrase: "i'm going to hurt them",           type: 'imminent_harm_to_others' },
];

// ============================================================================
// SEVERITY 4 — likely crisis (canned response delivered, NO cooldown)
// Intent without specificity / imminence.
// ============================================================================
const SEVERITY_4: Entry[] = [
  // Suicidal ideation — intent, no method/imminence
  { phrase: 'i want to die',                    type: 'suicidal_ideation' },
  { phrase: 'i wanna die',                      type: 'suicidal_ideation' },
  { phrase: 'wanna die',                        type: 'suicidal_ideation' },
  { phrase: 'i wish i was dead',                type: 'suicidal_ideation' },
  { phrase: 'i wish i were dead',               type: 'suicidal_ideation' },
  { phrase: 'i want to kill myself',            type: 'suicidal_ideation' },
  { phrase: 'want to kill myself',              type: 'suicidal_ideation' },
  { phrase: 'i wanna kill myself',              type: 'suicidal_ideation' },
  { phrase: 'wanna kill myself',                type: 'suicidal_ideation' },
  { phrase: 'want to end it all',               type: 'suicidal_ideation' },
  { phrase: 'i want to end it all',             type: 'suicidal_ideation' },
  { phrase: 'want to end my life',              type: 'suicidal_ideation' },
  { phrase: 'i want to be dead',                type: 'suicidal_ideation' },
  { phrase: 'want to be dead',                  type: 'suicidal_ideation' },
  { phrase: "i don't want to live",             type: 'suicidal_ideation' },
  { phrase: "i don't want to be alive",         type: 'suicidal_ideation' },
  { phrase: "i don't want to wake up",          type: 'suicidal_ideation' },
  { phrase: 'no reason to live',                type: 'suicidal_ideation' },
  { phrase: 'no reason to be alive',            type: 'suicidal_ideation' },
  { phrase: 'everyone would be better off without me', type: 'suicidal_ideation' },
  { phrase: 'world would be better off without me',    type: 'suicidal_ideation' },
  { phrase: "they'd be better off without me",  type: 'suicidal_ideation' },
  { phrase: 'tired of being alive',             type: 'suicidal_ideation' },

  // Self-harm — intent or active ideation
  { phrase: 'i want to cut',                    type: 'self_harm' },
  { phrase: 'i want to cut myself',             type: 'self_harm' },
  { phrase: 'i want to hurt myself',            type: 'self_harm' },
  { phrase: 'i want to harm myself',            type: 'self_harm' },
  { phrase: 'thinking about hurting myself',    type: 'self_harm' },
  { phrase: 'thinking about cutting myself',    type: 'self_harm' },

  // Other — hopelessness with escape language; "done with" variants
  { phrase: 'i see no way out',                 type: 'other' },
  { phrase: 'see no way out of this',           type: 'other' },
  { phrase: 'ready to give up on life',         type: 'other' },
  { phrase: "i'm done with everything",         type: 'other' },
  { phrase: 'im done with everything',          type: 'other' },
  { phrase: 'done with everything',             type: 'other' },
  { phrase: "i'm done with life",               type: 'other' },
  { phrase: 'im done with life',                type: 'other' },
  { phrase: 'done with life',                   type: 'other' },
];

// ============================================================================
// SEVERITY 3 — ambiguous (silent log, MiniMind responds normally)
// Concerning intensity but not crisis intent. Logged for trend tracking.
// ============================================================================
const SEVERITY_3: Entry[] = [
  { phrase: "what's the point",                 type: 'other' },
  { phrase: 'whats the point',                  type: 'other' },
  { phrase: "what's the point of any of this",  type: 'other' },
  { phrase: "what's the point of living",       type: 'other' },
  { phrase: "what's the point of life",         type: 'other' },
  { phrase: "i can't keep going",               type: 'other' },
  { phrase: "i can't go on",                    type: 'other' },
  { phrase: "can't go on like this",            type: 'other' },
  { phrase: 'nothing matters anymore',          type: 'other' },
  { phrase: 'nothing matters',                  type: 'other' },
  { phrase: 'i feel nothing',                   type: 'other' },
  { phrase: 'feel nothing anymore',             type: 'other' },
  { phrase: "i'm not really here",              type: 'other' },
  { phrase: 'not really here anymore',          type: 'other' },
  { phrase: 'i lose hours',                     type: 'other' },
  { phrase: 'i lose time',                      type: 'other' },
];

// ============================================================================
// SEVERITY 2 — soft signal (silent log only)
// Trend-spotting. Deliberately narrow.
// ============================================================================
const SEVERITY_2: Entry[] = [
  { phrase: 'i feel hopeless',                  type: 'other' },
  { phrase: "i'm hopeless",                     type: 'other' },
  { phrase: 'completely hopeless',              type: 'other' },
  { phrase: 'i hate being alive',               type: 'other' },
  { phrase: "i'm so tired of life",             type: 'other' },
  { phrase: 'tired of being here',              type: 'other' },
];

const TIERS: ReadonlyArray<{ severity: 2 | 3 | 4 | 5; entries: Entry[] }> = [
  { severity: 5, entries: SEVERITY_5 },
  { severity: 4, entries: SEVERITY_4 },
  { severity: 3, entries: SEVERITY_3 },
  { severity: 2, entries: SEVERITY_2 },
];

const REGEX_META = /[.*+?^${}()|[\]\\]/g;
function escapeForRegex(s: string): string {
  return s.replace(REGEX_META, '\\$&');
}

export function scanForKeywords(text: string): KeywordMatch {
  if (!text || typeof text !== 'string') {
    return { matched: false };
  }
  for (const tier of TIERS) {
    for (const entry of tier.entries) {
      const re = new RegExp(`\\b${escapeForRegex(entry.phrase)}\\b`, 'i');
      const m = text.match(re);
      if (m && typeof m.index === 'number') {
        return {
          matched: true,
          severity: tier.severity,
          type: entry.type,
          triggerExcerpt: m[0],
        };
      }
    }
  }
  return { matched: false };
}
