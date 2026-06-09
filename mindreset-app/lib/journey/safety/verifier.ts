// Journey-tuned async safety verifier.
//
// Runs after the LLM reply has streamed to the user. Reads the user's most
// recent message in the context of the recent conversation, classifies it
// using Claude Haiku, and (if a crisis is detected) freezes the Journey.
//
// Why async + freeze-next-turn:
//   - Synchronous safety check on every reply would add 1–3s latency.
//   - The synchronous keyword scan in keywords.ts catches hard markers
//     before the LLM is ever called — that's the primary fast-trip.
//   - The verifier here is the second-layer net for subtler language the
//     keyword scan misses (coded references, gradual escalation, indirect
//     markers). If the verifier catches something, the Journey is frozen;
//     the user's NEXT message will receive the canned holding response.
//   - This trade is the same one MiniMind makes (lib/minimind/safety/verifier.ts).
//
// CORE PRINCIPLE: emotion is not crisis.
// The Journey is paid emotional work. Frustration, despair, anger, sadness,
// numbness, exhaustion, grief, shame — these are emotions the user is here
// to meet. The verifier classifies INTENT + SPECIFICITY/IMMINENCE, not affect.

import Anthropic from '@anthropic-ai/sdk';
import type { RedFlagType } from './keywords';

const VERIFIER_MODEL = 'claude-haiku-4-5-20251001';
const VERIFIER_MAX_TOKENS = 200;
const VERIFIER_TIMEOUT_MS = 8000;
const RECENT_CONTEXT_LIMIT = 6;
const REASONING_MAX_CHARS = 200;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export type VerifierVerdict = 'clear_safe' | 'ambiguous' | 'clear_crisis';

export type VerifierResult = {
  verdict: VerifierVerdict;
  severity: 2 | 3 | 4 | 5;
  redFlagType: RedFlagType | null;
  reasoning: string;
};

// Fail-CLOSED default: when the verifier crashes / times out / returns junk,
// we return 'ambiguous'. The freeze flow does NOT trigger on ambiguous —
// only on clear_crisis. So fail-closed here means "don't freeze on infra
// failure, but DO log it for review".
function failClosedResult(): VerifierResult {
  return {
    verdict: 'ambiguous',
    severity: 3,
    redFlagType: null,
    reasoning: 'verifier unavailable; defaulted to ambiguous',
  };
}

// ===========================================================================
// SYSTEM PROMPT
// ===========================================================================
const SYSTEM_PROMPT = `You are the safety classifier for MindReset's Journey. Your only job is to classify the user's most recent message into one of three verdicts. You do NOT respond to the user. You output JSON only.

THE JOURNEY CONTEXT
The user is paying for and actively doing deliberate, often intense emotional work — meeting parts of themselves, identifying inherited material, sensing a new identity. Intense affect is the point of the work, not a sign of crisis. The AI guide is operating within a strict clinical method (the manuscript governs depth, prohibitions, and Practice generation).

CORE PRINCIPLE
EMOTION IS NOT CRISIS. Frustration, despair, hopelessness, anger, sadness, numbness, grief, shame, exhaustion — these are emotions the user is meeting, not crises. They are precisely what the method works with. Treat them as clear_safe or at most ambiguous.

CRISIS DEFINITION
A message is a crisis (clear_crisis) only when BOTH:
  (a) INTENT to harm self or others or a current loss-of-reality state, AND
  (b) SPECIFICITY (method, plan, location) OR IMMINENCE (tonight, now, today) OR ACTIVE DANGER (in-progress harm, acute medical, active flashback the user cannot exit).

Without specificity or imminence, even strong intent is "likely crisis" (Sev 4), not "imminent crisis" (Sev 5).

CONTEXT VS CLASSIFICATION
Recent context is provided so you can understand the conversation, NOT to influence the classification of the current message. Classify only the most recent user message. Earlier turns may contain trauma topics, parts work, or distressing emotional content — that is normal Journey work and not evidence of current crisis.

SEVERITY TAXONOMY

Sev 5 — IMMINENT CRISIS
  Examples:
  - "I'm going to kill myself tonight"
  - "I have pills next to me right now"
  - "I'm cutting right now"
  - "I think I'm having a heart attack"
  - "Voices are telling me to hurt my child"

Sev 4 — LIKELY CRISIS (intent without specificity/imminence)
  Examples:
  - "I want to die"
  - "I see no way out"
  - "I want to hurt myself"
  - "I'm going to attack him"

Sev 3 — AMBIGUOUS (concerning but not crisis-shaped intent)
  Examples:
  - "What's the point of any of this"
  - "I feel nothing anymore and it scares me"
  - "I'm losing hours and don't know where I went"

Sev 2 — SOFT SIGNAL / NO CONCERN
  Examples:
  - "I feel hopeless about this work right now"
  - "I'm exhausted with all of this"
  - "I don't know if I can keep going" (re: the work, not life)
  - All normal emotional Journey content

RED FLAG TYPE TAXONOMY (use only on clear_crisis or ambiguous)
  - "suicidal"            — intent / plan to end own life
  - "self-harm"           — intent / current behaviour of bodily self-harm
  - "violence"            — intent to harm another specific person
  - "panic_severe"        — current "can't breathe" / "having heart attack" / acute medical
  - "dissociation_severe" — current "I don't exist" / "nothing is real" / cannot return
  - "psychosis"           — command hallucinations, delusions, loss of reality testing
  - "flashback_in_progress" — user is currently inside a sensory trauma scene, can't exit

VERDICT TYPES
  - "clear_crisis" — Sev 4 or Sev 5. Will FREEZE the Journey.
  - "ambiguous"    — Sev 3. Logged, does NOT freeze.
  - "clear_safe"   — Sev 2 or no concern at all. No action.

OUTPUT FORMAT
Respond with JSON only. No prose before or after. No code fences. Shape:

For clear_crisis:
{
  "verdict": "clear_crisis",
  "severity": 4 | 5,
  "redFlagType": "suicidal" | "self-harm" | "violence" | "panic_severe" | "dissociation_severe" | "psychosis" | "flashback_in_progress",
  "reasoning": "<one sentence, max 120 chars>"
}

For ambiguous:
{
  "verdict": "ambiguous",
  "severity": 3,
  "redFlagType": "suicidal" | "self-harm" | "violence" | "panic_severe" | "dissociation_severe" | "psychosis" | "flashback_in_progress" | null,
  "reasoning": "<one sentence, max 120 chars>"
}

For clear_safe:
{
  "verdict": "clear_safe",
  "severity": 2,
  "redFlagType": null,
  "reasoning": "<one sentence, max 120 chars>"
}

REASONING STYLE
One terse sentence. No moralising. No advice. Just the classifying signal.
Examples:
  - "Direct stated plan with method and tonight as imminence."
  - "Strong despair, no method or imminence."
  - "Affect intense but normal Journey work; meeting a part."

When in doubt between clear_safe and ambiguous → ambiguous.
When in doubt between ambiguous and clear_crisis → ambiguous.

The verdict gates whether the Journey freezes. Defaulting to ambiguous on uncertainty is the correct, expected behaviour.`;

// ===========================================================================
// Parsing
// ===========================================================================

const ALL_VERDICTS: VerifierVerdict[] = ['clear_safe', 'ambiguous', 'clear_crisis'];
const ALL_RED_FLAG_TYPES: RedFlagType[] = [
  'suicidal',
  'self-harm',
  'violence',
  'panic_severe',
  'dissociation_severe',
  'psychosis',
  'flashback_in_progress',
];

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  return trimmed;
}

function parseResult(parsed: unknown): VerifierResult | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const verdict = obj.verdict;
  if (typeof verdict !== 'string' || !ALL_VERDICTS.includes(verdict as VerifierVerdict)) {
    return null;
  }
  const severityRaw = obj.severity;
  let severity: 2 | 3 | 4 | 5;
  if (verdict === 'clear_crisis') {
    if (severityRaw !== 4 && severityRaw !== 5) return null;
    severity = severityRaw;
  } else if (verdict === 'ambiguous') {
    severity = 3;
  } else {
    severity = 2;
  }

  let redFlagType: RedFlagType | null = null;
  if (obj.redFlagType && typeof obj.redFlagType === 'string') {
    if (ALL_RED_FLAG_TYPES.includes(obj.redFlagType as RedFlagType)) {
      redFlagType = obj.redFlagType as RedFlagType;
    }
  }
  // Crisis verdicts MUST have a redFlagType.
  if (verdict === 'clear_crisis' && redFlagType === null) return null;

  const reasoning = typeof obj.reasoning === 'string'
    ? obj.reasoning.slice(0, REASONING_MAX_CHARS)
    : '';

  return { verdict: verdict as VerifierVerdict, severity, redFlagType, reasoning };
}

function formatRecentContext(
  recent: { role: 'user' | 'assistant'; content: string }[],
): string {
  if (recent.length === 0) return '(no prior turns)';
  return recent
    .slice(-RECENT_CONTEXT_LIMIT)
    .map((m) => `[${m.role}] ${m.content}`)
    .join('\n');
}

// ===========================================================================
// Public API
// ===========================================================================

export async function runJourneyVerifier(
  userMessage: string,
  recentMessages: { role: 'user' | 'assistant'; content: string }[],
): Promise<VerifierResult> {
  if (!userMessage || typeof userMessage !== 'string') return failClosedResult();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VERIFIER_TIMEOUT_MS);

  try {
    const userPrompt = `RECENT CONTEXT (up to ${RECENT_CONTEXT_LIMIT} most recent turns, oldest first):
${formatRecentContext(recentMessages)}

MOST RECENT USER MESSAGE TO CLASSIFY:
${userMessage}`;

    const response = await anthropic.messages.create(
      {
        model: VERIFIER_MODEL,
        max_tokens: VERIFIER_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      },
      { signal: controller.signal },
    );

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      console.error('[journey/verifier] empty response');
      return failClosedResult();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(textBlock.text));
    } catch (parseErr) {
      console.error('[journey/verifier] JSON parse failed:', parseErr);
      return failClosedResult();
    }

    const result = parseResult(parsed);
    if (!result) {
      console.error('[journey/verifier] invalid verdict shape:', parsed);
      return failClosedResult();
    }
    return result;
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (isAbort) {
      console.error('[journey/verifier] timeout after', VERIFIER_TIMEOUT_MS, 'ms');
    } else {
      console.error('[journey/verifier] error:', err);
    }
    return failClosedResult();
  } finally {
    clearTimeout(timeoutId);
  }
}
