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
import { recordAiUsage } from '@/lib/ai-usage/record';

const VERIFIER_MODEL = 'claude-haiku-4-5-20251001';
const VERIFIER_MAX_TOKENS = 200;
const VERIFIER_TIMEOUT_MS = 8000;
const RECENT_CONTEXT_LIMIT = 6;
const REASONING_MAX_CHARS = 200;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export type VerifierVerdict =
  | 'clear_safe'
  | 'ambiguous'
  | 'clear_crisis'
  // PR ξ (2026-07-11): cooldown-lift verdict, only produced when the
  // verifier is called with `isCheckingCooldownLift: true`. The route
  // handler treats this as "user has confirmed they're safe → clear the
  // freeze". Matches the MiniMind pattern in lib/minimind/safety/verifier.ts.
  | 'safety_confirmation';

export type VerifierResult = {
  verdict: VerifierVerdict;
  // safety_confirmation carries no severity — it's a "you're clear to
  // resume" signal, not an assessment of concern level.
  severity: 2 | 3 | 4 | 5 | null;
  redFlagType: RedFlagType | null;
  reasoning: string;
};

// Fail-CLOSED default: when the verifier crashes / times out / returns junk:
//   - Regular mode: return 'ambiguous'. Freeze flow does NOT trigger on
//     ambiguous, but the log records it so Julia can review.
//   - Cooldown-lift mode: return 'ambiguous' too. In lift mode, only
//     safety_confirmation clears the freeze — ambiguous keeps it in place.
//     Fail-closed here means "don't auto-unfreeze on infra failure".
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
export const SYSTEM_PROMPT = `You are the safety classifier for MindReset's Journey. Your only job is to classify the user's most recent message into one of three verdicts. You do NOT respond to the user. You output JSON only.

THE JOURNEY CONTEXT
The user is paying for and actively doing deliberate, often intense emotional work — meeting parts of themselves, identifying inherited material, sensing a new identity. Intense affect is the point of the work, not a sign of crisis. The AI guide is operating within a strict clinical method (the manuscript governs depth, prohibitions, and Practice generation).

CORE PRINCIPLE
EMOTION IS NOT CRISIS. Frustration, despair, hopelessness, anger, sadness, numbness, grief, shame, exhaustion — these are emotions the user is meeting, not crises. They are precisely what the method works with. Treat them as clear_safe or at most ambiguous.

CRISIS DEFINITION
A message is a crisis (clear_crisis) only when BOTH:
  (a) INTENT to harm self or others or a current loss-of-reality state, AND
  (b) SPECIFICITY (method, plan, location) OR IMMINENCE (tonight, now, today) OR ACTIVE DANGER (in-progress harm, acute medical, active flashback the user cannot exit).

Without specificity or imminence, even strong intent is "likely crisis" (Sev 4), not "imminent crisis" (Sev 5).

"Active danger" means an acute, in-the-moment emergency happening in the session right now — not an ongoing life circumstance. A user who lives with an abuser is describing the context the method works through over weeks; that is never, by itself, "active danger".

CONTEXT VS CLASSIFICATION
Recent context is provided for two purposes:
  (1) to understand the conversation flow, AND
  (2) to disambiguate somatic phenomenology from medical crisis for specific phrase patterns like "I can't breathe", "chest is heavy", "there's a hole", "I can't feel my body" — these phrases have distinct meanings depending on whether they arise from an in-session somatic exploration OR from an unprompted panic-attack description.

Classify the current message. Earlier turns may contain trauma topics, parts work, or distressing emotional content — that is normal Journey work and not evidence of current crisis.

POST-RELEASE PHENOMENOLOGY IS NOT PANIC
When the AI has just guided the user through foreign material release, parts work, somatic discharge, or a body-locating question, the user's next messages often describe the somatic residue in language that superficially resembles panic. This is expected and clinically important — the body registers the empty space left by released material, or the location the AI invited the user to notice.

  - "I can't breathe" AFTER a release the AI guided → somatic residue (clear_safe), NOT panic_severe
  - "My chest is heavy / tight" AFTER the AI asked "where do you feel it?" → body-locating reply (clear_safe), not medical
  - "There's a hole in my chest" describing where a burden was → integration language (clear_safe)
  - "I feel empty" after releasing foreign material → expected phenomenology (clear_safe)
  - "It's squeezing my lungs" while describing an image the AI is holding with them → body-report (clear_safe)

Classify as panic_severe (Sev 5) ONLY when the user is signalling an active emergency they cannot manage in-session — help-seeking ("I need help now", "call someone"), imminent physical failure ("I'm going to pass out", "about to faint"), or explicit inability to continue ("get me out", "I can't do this, help"). The phrase "I can't breathe" alone, spoken after the AI just guided somatic work or asked about a body sensation, is body-report, not emergency signal.

If the user says any variant of "no, I'm fine / I'm just describing / I'm okay" in response to a safety check, believe them. Classify subsequent messages fresh as clear_safe unless new crisis-shaped content arrives.

ABUSE DISCLOSURE IS NOT CRISIS
The user being harmed by another person — sexual coercion, rape, domestic abuse, assault, control, a forced encounter — whether in the past OR ongoing in their life right now, is core trauma material. It is exactly what the Journey exists to meet. Classify it clear_safe, or at most ambiguous — NEVER clear_crisis on the basis of the abuse itself.
  - "My husband still forces me to have sex" → clear_safe (victim disclosing abuse)
  - "My boss made me sleep with him" → clear_safe (victim disclosing abuse)
  - "It happened again last night" (being hurt by someone) → clear_safe (victim disclosing abuse)
Abuse content becomes crisis ONLY if the SAME message also carries the user's own intent to harm themselves or another person, with specificity / imminence / acute in-session danger — and then you classify on THAT intent, not on the abuse.

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
  - "He forces me to have sex and I feel dirty about it" (victim disclosing abuse)
  - All normal emotional Journey content

RED FLAG TYPE TAXONOMY (use only on clear_crisis or ambiguous)
  - "suicidal"            — intent / plan to end own life
  - "self-harm"           — intent / current behaviour of bodily self-harm
  - "violence"            — the USER's OWN intent to harm another specific person. NOT the user being harmed by someone else — a user disclosing that another person hurts, forces, or abuses THEM is a victim disclosing trauma (see ABUSE DISCLOSURE IS NOT CRISIS), never "violence".
  - "panic_severe"        — ACTIVE panic attack requiring help NOW, distinct from post-release somatic phenomenology (see above). Look for emergency signalling (help-seeking, imminent physical failure, cannot-continue-session) alongside symptom language, especially in Journey sessions with somatic work.
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
// SYSTEM_COOLDOWN_LIFT — used when the user is already frozen and we're
// deciding whether to lift the freeze based on their next message.
// PR ξ (2026-07-11). Mirrors the MiniMind cooldown-lift pattern.
// ===========================================================================
export const SYSTEM_COOLDOWN_LIFT = `You are the safety-confirmation classifier for MindReset's Journey. The user is currently in a freeze — a prior turn tripped the safety verifier or keyword scan, so the Journey is paused and every user message returns a canned crisis response.

Your job is to read the user's next message and classify whether the freeze should be LIFTED so the Journey can continue.

THE JOURNEY CONTEXT
The user is paying for and actively doing deliberate, often intense emotional work. False positives on the freeze happen — the safety layer is calibrated conservative (better to freeze than miss a real crisis), so many freezes are legitimate but many others catch normal deep clinical work that superficially resembled a crisis phrase.

POST-RELEASE PHENOMENOLOGY, SOMATIC BODY-REPORT, AND OTHER FALSE-POSITIVE PATTERNS
Common reasons the freeze fired but the user is actually fine:
  - "I can't breathe" describing chest tightness after guided somatic work
  - "There's a hole in my chest" describing a released burden's residue
  - "It's squeezing me" describing an image the AI was holding with them
  - Phrases that sound like panic in bare form but are body-report in-session

WHAT SAFETY_CONFIRMATION LOOKS LIKE
The user's next message signals they're okay and want to continue. Look for:
  - Direct confirmation: "no, I'm fine", "I'm okay", "I was describing", "just body-report"
  - Correction of the false read: "I meant the image", "sorry that came out wrong", "you misunderstood"
  - Clear present-time orientation + calm affect: "I'm here at my desk, just resting"
  - Explicit request to continue: "let's keep going", "I want to keep working"

WHAT KEEPS THE FREEZE IN PLACE
  - New crisis-shaped content in the reply itself: "actually yes I do want to die"
  - Denial that reads as dissociative or overwhelmed: "nothing matters, get me out"
  - Emergency signalling: "help me", "call someone", "I'm going to pass out"
  - Ambiguous replies where you can't tell (fail-closed → hold the freeze)

VERDICT TYPES
  - "safety_confirmation" — user's next message is a clear reassurance. Lift the freeze.
  - "clear_crisis" — new crisis content in the reply. Keep frozen. Set redFlagType and severity 4 or 5.
  - "ambiguous" — you can't tell. Keep frozen (fail-closed). Log for Julia's review.
  - "clear_safe" — reply is safe/neutral but not an explicit reassurance. Keep frozen — the user hasn't affirmatively confirmed they're okay after the safety event.

OUTPUT FORMAT
JSON only. No prose, no code fences. Shape:

For safety_confirmation:
{
  "verdict": "safety_confirmation",
  "severity": null,
  "redFlagType": null,
  "reasoning": "<one sentence, max 120 chars>"
}

For clear_crisis (new crisis in the reply):
{
  "verdict": "clear_crisis",
  "severity": 4 | 5,
  "redFlagType": "suicidal" | "self-harm" | "violence" | "panic_severe" | "dissociation_severe" | "psychosis" | "flashback_in_progress",
  "reasoning": "<one sentence, max 120 chars>"
}

For ambiguous or clear_safe (both keep the freeze in place):
{
  "verdict": "ambiguous" | "clear_safe",
  "severity": 3 | 2,
  "redFlagType": null | "<any>",
  "reasoning": "<one sentence, max 120 chars>"
}

BIAS
When in doubt between safety_confirmation and ambiguous → ambiguous. The freeze holding for one more message is a mild UX friction; auto-lifting on ambiguity could let a genuine crisis user talk themselves out of protection.`;

// ===========================================================================
// Parsing
// ===========================================================================

const ALL_VERDICTS: VerifierVerdict[] = [
  'clear_safe',
  'ambiguous',
  'clear_crisis',
  'safety_confirmation',
];
const ALL_RED_FLAG_TYPES: RedFlagType[] = [
  'suicidal',
  'self-harm',
  'violence',
  'panic_severe',
  'dissociation_severe',
  'psychosis',
  'flashback_in_progress',
];

export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  return trimmed;
}

export function parseResult(parsed: unknown): VerifierResult | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const verdict = obj.verdict;
  if (typeof verdict !== 'string' || !ALL_VERDICTS.includes(verdict as VerifierVerdict)) {
    return null;
  }
  const severityRaw = obj.severity;
  let severity: 2 | 3 | 4 | 5 | null;
  if (verdict === 'clear_crisis') {
    if (severityRaw !== 4 && severityRaw !== 5) return null;
    severity = severityRaw;
  } else if (verdict === 'ambiguous') {
    severity = 3;
  } else if (verdict === 'safety_confirmation') {
    // No severity — this is a "clear to resume" signal.
    severity = null;
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
  // AI-usage attribution (PR δ, 2026-07-10). Optional so tests / one-off
  // scripts that don't have a user context still work. When present, the
  // verifier's Anthropic cost is recorded against this user.
  //
  // PR ξ (2026-07-11): isCheckingCooldownLift = true switches to the
  // cooldown-lift system prompt. The verifier's job is now "should we
  // unfreeze?" rather than "is this a new crisis?". A safety_confirmation
  // verdict signals the caller to clear the freeze; any other verdict
  // holds the freeze in place.
  opts?: { userId?: string | null; isCheckingCooldownLift?: boolean },
): Promise<VerifierResult> {
  if (!userMessage || typeof userMessage !== 'string') return failClosedResult();

  const isCheckingCooldownLift = opts?.isCheckingCooldownLift === true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VERIFIER_TIMEOUT_MS);

  try {
    const system = isCheckingCooldownLift ? SYSTEM_COOLDOWN_LIFT : SYSTEM_PROMPT;

    // In cooldown-lift mode the recent-context is deliberately narrower —
    // the verifier's decision is about whether THIS message is a "I'm okay"
    // confirmation, not about the broader crisis flow.
    const userPrompt = isCheckingCooldownLift
      ? `USER REPLY TO CLASSIFY (currently in Journey freeze):
${userMessage}`
      : `RECENT CONTEXT (up to ${RECENT_CONTEXT_LIMIT} most recent turns, oldest first):
${formatRecentContext(recentMessages)}

MOST RECENT USER MESSAGE TO CLASSIFY:
${userMessage}`;

    const response = await anthropic.messages.create(
      {
        model: VERIFIER_MODEL,
        max_tokens: VERIFIER_MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      },
      { signal: controller.signal },
    );

    // Fire-and-forget AI-usage row. Deliberately not awaited — the verifier
    // is on the reply hot path and must not wait on a telemetry insert.
    recordAiUsage({
      userId: opts?.userId ?? null,
      callSite: 'verifier_journey',
      model: response.model ?? VERIFIER_MODEL,
      usage: response.usage,
    }).catch((err) => console.error('[journey/verifier] usage record failed:', err));

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
