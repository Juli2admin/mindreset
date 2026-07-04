// Assemble the AI's system prompt for one turn of The Journey.
// Composes: Shared Core + active-stage spec + state injection + output-format
// instruction (the hidden state report shape).
//
// The user never sees any of this. Only the AI does.

import {
  sharedCore,
  practiceGenerationAlgorithm,
  loadStageSpec,
  loadEngineeredStagePrompt,
  loadMasterJourneyPrompt,
} from './load-spec';
import { renderSettlingSignalInstruction } from '../delayedCheck/signal';
import { formatTimeSinceLastTurnBucket } from '../state/load';
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

// Journey polish PR 3 (2026-07-04). Map the detected processing channel
// to the practice family the master prompt canonically prefers for that
// channel (docs/journey/runtime/journey-master.md L260-265). The mapping
// already lives in the master prompt's operational layer, but that layer
// sits AFTER the state block in the layer ordering — so the model reads
// the channel value first, then reads the mapping much later. Rendering
// this line proximate to the "Processing channel detected: X" line means
// the LLM doesn't have to hold the channel in working memory while it
// hunts for the mapping. Directly mirrors the master prompt's phrasing
// so nothing drifts.
//
// Safety qualifier is baked in: when the user is destabilised, the master
// prompt says regulation practices override channel preference. The
// state block already surfaces intensity and safety; the AI reads both
// and applies the override on its own.
const CHANNEL_FAMILY_GUIDANCE: Record<string, string> = {
  visual:
    'Prefer landscape-family practices (inner room, path, garden, safe place — user describes what appears; never tell them what is there). Reach for regulation only if safety needs grounding.',
  kinesthetic:
    'Prefer somatic-family practices (body scan, hand-on-body, locating sensation, micro-movement). Reach for regulation only if safety needs grounding.',
  emotional:
    'Prefer compassion-family practices (self-hug, warm phrase, "I am with you") or affect labelling. Reach for regulation only if safety needs grounding.',
  cognitive:
    'Prefer narrative-family practices (Soft Why, voice mapping, clean identity statement) — and invite body location so the work does not stay in the head.',
  verbal:
    'Prefer narrative-family practices (Soft Why, voice mapping, clean identity statement) — user is working through words.',
  mixed:
    'Weave two families that match what the user is actually showing you this turn — do not default to regulation.',
};

function renderStateBlock(state: JourneyState): string {
  const lines: string[] = [];
  lines.push('## Current user state (injected by code; for your reference)');
  lines.push('');
  lines.push(`- Active internal stage: ${state.currentStage}/8`);
  lines.push(`- Current depth: ${state.currentDepth}`);
  if (state.processingChannel) {
    lines.push(`- Processing channel detected: ${state.processingChannel}`);
    const guidance = CHANNEL_FAMILY_GUIDANCE[state.processingChannel];
    if (guidance) {
      lines.push(`  ${guidance}`);
    }
  }
  if (typeof state.lastIntensity === 'number') {
    lines.push(`- Last intensity reading: ${state.lastIntensity}/10`);
  }
  // PR 5 / Bundle C — continuity signals so the AI honours "across two
  // different days" reproducibility requirements without inferring from
  // conversational density. session count + days engaged + this-session
  // message count + stage-just-advanced are derived from JourneyTurn audit
  // log in load.ts.
  lines.push('');
  lines.push(
    `- Sessions so far: ${state.sessionCount} · distinct days engaged: ${state.daysEngaged} · this session: message ${state.thisSessionMessageCount + 1} (the user message you're about to read)`,
  );
  // Journey polish PR 1 — time awareness. Previously the AI could only
  // see the sessionCount tick (which needed a >4h gap) and had no way to
  // distinguish "2 hours since last turn" from "2 months since last turn".
  // Result: the AI would fabricate "yesterday" / "last week" phrasing.
  // formatTimeSinceLastTurnBucket returns a coarse AI-facing string; the
  // model paraphrases it naturally in its human reply. First-ever turns
  // render nothing (bucket is null) to avoid awkward "no prior turn"
  // scaffolding — the model already knows it's the opening.
  const timeBucket = formatTimeSinceLastTurnBucket(state.hoursSinceLastTurn);
  if (timeBucket) {
    lines.push(`- Last user turn: ${timeBucket}.`);
  }
  if (state.isSessionResume) {
    lines.push(
      `- This is a resumed session. Gently re-anchor before continuing into deeper work — check in with the user about what has moved since last time, and let them lead the depth of this session.`,
    );
  }
  if (state.stageJustAdvanced) {
    lines.push('');
    lines.push(
      `**Stage just advanced to ${state.currentStage}.** This is the FIRST turn at the new stage. Per the canonical method, the new stage may have a session-open ritual (e.g. Stage 8 opens every session with Identity Reinforcement Check-In; Stage 6 typically opens with the Internal Consensus Check). Refer to the active stage spec above for the canonical opener and run it now.`,
    );
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

  // Journey polish PR 5 — unresolved patterns the AI has noticed across
  // sessions. Free-string snake_case category + user's own words. Cap the
  // render at 10 entries so a long-term user's state block stays lean;
  // load already tops out at 20, ordered by most-recently-confirmed.
  if (state.patterns.length > 0) {
    lines.push('');
    lines.push(
      "**Unresolved patterns the user has surfaced (working notes — not diagnosis; use to recognise, not to name unless they name it):**",
    );
    for (const p of state.patterns.slice(0, 10)) {
      const bits: string[] = [`- \`${p.category}\` — "${p.userDescription}"`];
      if (p.context && Object.keys(p.context).length > 0) {
        // Compact key: value pairs — helps the AI recognise, e.g., an
        // ageTag for an inner-child pattern.
        const ctx = Object.entries(p.context)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join(', ');
        bits.push(`context: ${ctx}`);
      }
      lines.push(bits.join(' — '));
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

// Header introducing the canon section. Placed at the top of the cached
// canon blocks so the AI sees its layer-ordering hint before reading
// Shared Core.
const CANON_PROMPT_HEADER = `# CLINICAL METHOD SOURCE (canon)

Three documents follow, then your operational behavior layer.

**1. Shared Core** — your clinical constitution. Applies every turn, every stage.
**2. Practice Generation Algorithm** — how you compose practices at runtime from the five practice families (regulation, somatic awareness, guided inner landscape, narrative rewriting, self-compassion). The system does NOT ship a fixed library of scripts; you generate practices dynamically from this algorithm against the user's live state, exact words, body signals, and safety layer. Reach into all five families, not only stabilisation.
**3. Active stage spec** — the full clinical playbook for the user's current stage. Use the practices, prohibitions, and session-close ritual described there. Earlier-stage moves remain available when the user needs them (stages are progress markers, not constraints on the moves you can use).

This canon is the authoritative reference for the method you are delivering. Where it overlaps with the general behavior layer (master prompt) that follows, the canon takes precedence on clinical content (practices, stage-specific behaviour, capture fields); the master prompt takes precedence on voice, character, and operational format.

---

## SHARED CORE

`;

// Journey polish PR 2 (2026-07-04): the Practice Generation Algorithm
// lives at docs/journey/PRACTICE_GENERATION_ALGORITHM.md and is now
// injected into Block 1 (always-hot cache prefix) verbatim so the AI
// reads it every turn. Prior to this PR, the algorithm was only
// referenced by scattered examples in stage specs — the model
// systematically under-generated practices outside the regulation
// family (feet on floor, hand on chest, breathing) because the deeper
// families' composition rules were not surfaced. This header divides
// Shared Core from the algorithm doc.
const CANON_PRACTICE_HEADER = `

---

## PRACTICE GENERATION ALGORITHM

`;

const CANON_STAGE_HEADER = `

---

## ACTIVE STAGE SPEC

`;

// Header introducing the operational behavior layer (master prompt) after
// the canon. Brief — orients the AI to the layer transition.
const MASTER_PROMPT_HEADER = `

---

# OPERATIONAL BEHAVIOR LAYER (master prompt)

What follows is your operational guidance — the 12 traps, the 8-moves toolkit summary, worked examples, and the output format you must follow every turn. Voice and character behavior also live here. Apply this alongside the canon above.

---

`;

export type SystemPromptBlock = {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
};

/**
 * Assemble the system prompt as a block array for Anthropic prompt
 * caching. Returns 5 blocks in order:
 *   1. Shared Core (CACHED — stable across all turns)
 *   2. Active stage spec (CACHED — stable per stage)
 *   3. Master prompt BEFORE the state-injection token (CACHED — stable
 *      across all turns)
 *   4. State block (NOT cached — changes per turn)
 *   5. Master prompt AFTER the state-injection token (NOT cached because
 *      it sits after dynamic content; small remainder of master)
 *
 * Anthropic's prompt cache requires the cache prefix to start from the
 * beginning of the system message — so cacheable content goes first,
 * dynamic content after. The Shared Core + stage spec + master-before-
 * state account for ~95% of system-prompt tokens; caching them cuts
 * effective input cost to ~10% of the full price for repeat turns
 * within the 5-minute cache TTL.
 *
 * Order rationale: canon docs first so the AI has the method content
 * fresh in working memory before reading the operational layer. Master
 * comes last so the most recently-read content for the AI is its 12
 * traps + output format reminder.
 */
export function assembleSystemPromptBlocks(state: JourneyState): SystemPromptBlock[] {
  const master = loadMasterJourneyPrompt();
  if (!master) {
    // Fallback: legacy single-block assembly (no caching).
    return [{ type: 'text', text: assembleSystemPrompt(state) }];
  }

  // Split master at the STATE_INJECTION_TOKEN so the dynamic state block
  // can be its own (uncached) middle block.
  const idx = master.indexOf(STATE_INJECTION_TOKEN);
  const masterBeforeState =
    idx >= 0 ? master.slice(0, idx) : master;
  const masterAfterState =
    idx >= 0 ? master.slice(idx + STATE_INJECTION_TOKEN.length) : '';

  const blocks: SystemPromptBlock[] = [
    // Canon header + Shared Core + Practice Generation Algorithm (cached).
    // Journey polish PR 2 (2026-07-04): the practice algorithm joined
    // this block — same cache prefix as Shared Core because both are
    // stage-agnostic canon, and this way no new cache breakpoint is
    // added (cache breakpoint budget is limited on the Anthropic API,
    // so we compose rather than fragment).
    {
      type: 'text',
      text:
        CANON_PROMPT_HEADER +
        sharedCore() +
        CANON_PRACTICE_HEADER +
        practiceGenerationAlgorithm() +
        CANON_STAGE_HEADER,
    },
    // Active stage spec (cached). Cache breakpoint here — turns that
    // stay in the same stage hit the cache; advancing to a new stage
    // rebuilds from this block onward.
    {
      type: 'text',
      text: loadStageSpec(state.currentStage),
      cache_control: { type: 'ephemeral' },
    },
    // Master prompt body before the state injection slot (cached).
    // Header announces the operational layer.
    {
      type: 'text',
      text: MASTER_PROMPT_HEADER + masterBeforeState,
      cache_control: { type: 'ephemeral' },
    },
    // State block — dynamic per turn (NOT cached).
    {
      type: 'text',
      text: renderStateBlock(state),
    },
    // Master prompt body after the state injection (not cached because
    // it follows dynamic content; this is the rest of master —
    // <examples>, <output_format>, etc.).
    {
      type: 'text',
      text: masterAfterState,
    },
  ];

  return blocks;
}

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
  // String-form fallback: collapse the block array into a single string.
  // Used by callers / tests that don't need the per-block cache_control
  // markers; production code paths should call assembleSystemPromptBlocks.
  const blocks = assembleSystemPromptBlocks(state);
  if (blocks.length > 0) {
    return blocks.map((b) => b.text).join('');
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
