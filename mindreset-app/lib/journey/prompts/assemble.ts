// Assemble the AI's system prompt for one turn of The Journey.
// Composes: Shared Core + active-stage spec + state injection + output-format
// instruction (the hidden state report shape).
//
// The user never sees any of this. Only the AI does.

import {
  sharedCore,
  loadStageSpec,
  loadEngineeredStagePrompt,
  loadMasterJourneyPrompt,
} from './load-spec';
import { renderSettlingSignalInstruction } from '../delayedCheck/signal';
import type { JourneyState } from '../state/types';

// Token in the engineered prompt files where the runtime state block is
// substituted in. Matches the placeholder in docs/journey/runtime/*.md.
const STATE_INJECTION_TOKEN = '{{STATE_INJECTION}}';

const STATE_REPORT_FORMAT_INSTRUCTION = `
---

## Output format — required every turn

Your reply has two parts.

1. **Warm human reply.** Plain text. This is what the user sees. Follow the voice, prohibitions, and active stage's behaviour described above. British English. No JSON, no field labels, no clinical jargon — just your reply to the user.

2. **Hidden state report.** Immediately after the human reply, on a new line, emit a JSON object wrapped in \`<state-report>\` and \`</state-report>\` tags. The user will never see this — the system strips it before display. The report is how you tell the code what you observed in this turn.

State report schema (all fields except the three required are optional; omit fields that don't apply this turn):

\`\`\`
<state-report>
{
  "intensity": 0-10,                           // REQUIRED. Your read of the user's distress right now.
  "safetyFlag": "none" | "watch" | "red_flag", // REQUIRED. "watch" if anything concerns you, "red_flag" only if Shared Core §7 triggers apply.
  "recommendedAction": "stay" | "advance" | "regress_to_grounding" | "regress_to_parts" | "red_flag" | "discharge", // REQUIRED. Code decides; this is advisory.

  "channel": "visual" | "kinesthetic" | "emotional" | "cognitive" | "verbal" | "mixed",
  "adultSelfPresent": true | false,
  "readinessTouched": ["..."],
  "redFlagType": "suicidal" | "self-harm" | "panic" | "dissociation" | "psychosis" | "flashback" | "violence",

  "practiceRun": {
    "kind": "canonical" | "generated" | "none",
    "name": "Personal Anchor Identification" | "Inner Child Visit at age 10" | "...",
    "family": "regulation" | "somatic" | "landscape" | "narrative" | "compassion" | "none",
    "triggeredBy": "brief abstract note (no user-words content)",
    "userImages": "the user's own words/images, captured verbatim if a Practice was run",
    "depth": "surface" | "middle" | "deep",
    "status": "started" | "mid" | "completed" | "aborted_user_request" | "aborted_overwhelm",
    "modalitySwitched": { "from": "...", "to": "..." }
  },

  // Landscape additions — only set when you've genuinely captured something new.
  "userImagesCaptured": ["the field of bluebells"],
  "partsTouched": [{ "description": "the 10-year-old with two braids", "channel": "visual", "safeDistance": "across the room" }],
  "foreignFilesTouched": [{ "description": "I have to be useful" }],

  // Stage-specific captures (use only the ones relevant to the active stage):
  "anchorIdentified": "the bench in the garden under the apple tree",  // Stage 1 — set ONCE.
  "identityAnchor": "hand on the centre of my chest",                  // Stage 6.
  "observerSeatTouched": true,                                         // Stage 3.
  "adultSelfQualities": "the calm older me",                           // Stage 3.
  "compassionBridgeQuality": "compassion",                             // Stage 4 — MII-4.
  "cohesionAwareness": "I feel them inside me",                        // Stage 4 — MII-7.
  "cleanIdentityStatement": "this is mine; that is not mine",          // Stage 5.
  "whatStaysAsMine": "I love to make things for people",               // Stage 5/6.
  "symbolicIdentityMap": "rooted but not stiff, warm light in chest",  // Stage 7.
  "emergingQualities": ["calmer", "curious", "kinder to myself"],      // Stage 7.
  "innerDirection": "to feel real, not perform",                       // Stage 7.
  "urgencyMarkers": "present" | "absent",                              // Stage 7.
  "calRunOn": "the shouting moment with husband",                      // Stage 8.
  "calLayer": 1 | 2 | 3,                                               // Stage 8 TLSM.
  "userReportedRedirection": true | false | "partial",                 // Stage 8.
  "adultSelfThisWeek": "steady, closer than last week",                // Stage 8.
  "feltAligned": ["saying no without explaining"],                     // Stage 8.
  "feltOld": ["pull to apologise to mother"],                          // Stage 8.

  "continuityNote": "Your running case formulation across sessions — internal, never shown to the user. Structured prose covering presenting issues, working hypotheses (tentative), resources identified, worked so far, queued material, stuck points, and notes for next session. Read existing → revise additively → emit; omit if today added nothing strategic."
}
</state-report>
\`\`\`

Strict rules:
- The state report appears AFTER the human reply, never before.
- The tags \`<state-report>\` and \`</state-report>\` are literal — do not vary.
- The JSON must parse. Omit fields you can't honestly fill; do not invent.
- All user-words fields capture the user's exact phrasing where possible — not your paraphrase.
- No trauma detail in any field. Labels and the user's own words only.
- If unsure about safety, set \`safetyFlag\` to "watch" and \`recommendedAction\` to "stay".
`;

function renderStateBlock(state: JourneyState): string {
  const lines: string[] = [];
  lines.push('## Current user state (injected by code; for your reference)');
  lines.push('');
  lines.push(`- Active internal stage: ${state.currentStage}/8`);
  lines.push(`- Current depth: ${state.currentDepth}`);
  if (state.processingChannel) {
    lines.push(`- Processing channel detected: ${state.processingChannel}`);
  }
  if (typeof state.lastIntensity === 'number') {
    lines.push(`- Last intensity reading: ${state.lastIntensity}/10`);
  }

  if (state.anchorText) {
    lines.push('');
    lines.push(`**Personal Anchor (in user's exact words — never overwrite):**`);
    lines.push(`> ${state.anchorText}`);
  }
  if (state.identityAnchor) {
    lines.push('');
    lines.push(`**Identity Anchor (Stage 6 — small, portable, accessible alone, in user's words):**`);
    lines.push(`> ${state.identityAnchor}`);
  }
  if (state.adultSelfQualities) {
    lines.push('');
    lines.push(`**Adult Self (user's words for the steadier inner presence):**`);
    lines.push(`> ${state.adultSelfQualities}`);
  }

  if (state.parts.length > 0) {
    lines.push('');
    lines.push('**Inner parts the user has met (each in their own words):**');
    for (const p of state.parts) {
      const bits: string[] = [`- "${p.userDescription}"`];
      if (p.channel) bits.push(`channel: ${p.channel}`);
      if (p.safeDistance) bits.push(`safe distance: "${p.safeDistance}"`);
      if (p.compassionBridgeQuality) bits.push(`bridge: ${p.compassionBridgeQuality}`);
      if (p.currentRestingPlace) bits.push(`resting: "${p.currentRestingPlace}"`);
      lines.push(bits.join(' — '));
    }
  }

  if (state.foreignFiles.length > 0) {
    lines.push('');
    lines.push("**Foreign material identified or released (in user's words):**");
    for (const f of state.foreignFiles) {
      const phase = f.releasedAt ? 'released' : 'identified';
      const origin = f.originDescription ? ` (origin: "${f.originDescription}")` : '';
      lines.push(`- "${f.userDescription}"${origin} — ${phase}`);
    }
  }

  if (state.signatureImages.length > 0) {
    lines.push('');
    lines.push('**Signature images the user has discovered (in their words):**');
    for (const img of state.signatureImages) {
      lines.push(`- "${img.userDescription}"`);
    }
  }

  if (state.continuityNote) {
    lines.push('');
    lines.push('**Case formulation across sessions (your running model — internal, never recited to user):**');
    lines.push(`> ${state.continuityNote}`);
  }

  if (state.frozenForReview) {
    lines.push('');
    lines.push('**This user is currently frozen-for-review. Deliver the verbatim crisis response from Shared Core §7 and do not engage method work.**');
  }

  const settling = renderSettlingSignalInstruction(state);
  if (settling) {
    lines.push('');
    lines.push(settling);
  }

  return lines.join('\n');
}

const DIVIDER = '\n\n---\n\n';

const CANON_HEADER = `

---

# CLINICAL METHOD SOURCE (canon)

Two documents follow.

**1. Shared Core** — your clinical constitution. Applies every turn, every stage.
**2. Active stage spec** — the full clinical playbook for the user's current stage. Use the practices, prohibitions, and session-close ritual described there. Earlier-stage moves remain available when the user needs them (stages are progress markers, not constraints on the moves you can use).

The clinical method source below is the authoritative reference for the method you are delivering. Where this content overlaps with the general behavior prompt above, the canon takes precedence on clinical content (practices, stage-specific behaviour, capture fields); the general behavior prompt takes precedence on voice, character, and operational format.

---

## SHARED CORE

`;

const CANON_STAGE_HEADER = `

---

## ACTIVE STAGE SPEC

`;

export function assembleSystemPrompt(state: JourneyState): string {
  // Architecture (2026-06-23 refactor):
  //   Layer 1: Master prompt — general AI behavior, character, voice,
  //            12 traps, 8-moves toolkit, worked examples, output format,
  //            STATE_INJECTION_TOKEN replaced with the rendered state block.
  //   Layer 2: Shared Core — the clinical constitution (00-shared-core.md).
  //            Loaded every turn.
  //   Layer 3: Active stage spec — the full canonical playbook for the
  //            user's current stage (01-...md through 08-...md).
  //            Loaded based on state.currentStage.
  //
  // The master prompt was previously the only system prompt; the canon
  // docs were reviewable reference material for humans only. The audit on
  // 2026-06-19 showed this produced a ~70:1 conversation-to-practice ratio
  // because the master prompt's "moves" section is a compressed summary
  // of the per-stage method content. This architecture loads the canonical
  // source so the AI receives the full method content for the active stage.
  //
  // Fallback: if the master prompt is missing for any reason, fall through
  // to the older path (engineered per-stage prompt → Shared Core + spec).
  const master = loadMasterJourneyPrompt();
  if (master) {
    const masterWithState = master.replace(
      STATE_INJECTION_TOKEN,
      renderStateBlock(state),
    );
    return [
      masterWithState,
      CANON_HEADER,
      sharedCore(),
      CANON_STAGE_HEADER,
      loadStageSpec(state.currentStage),
    ].join('');
  }

  // Fallback (rollout phase): per-stage engineered prompts if a master isn't
  // present.
  const engineered = loadEngineeredStagePrompt(state.currentStage);
  if (engineered) {
    return engineered.replace(STATE_INJECTION_TOKEN, renderStateBlock(state));
  }

  // Last resort: Shared Core + clinical spec concatenation.
  return [
    sharedCore(),
    loadStageSpec(state.currentStage),
    renderStateBlock(state),
    STATE_REPORT_FORMAT_INSTRUCTION,
  ].join(DIVIDER);
}
