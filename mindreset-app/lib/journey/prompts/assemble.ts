// Assemble the AI's system prompt for one turn of The Journey.
// Composes 4 blocks: canon (Shared Core + Practice Generation Algorithm + ALL 8
// stage specs) + master-before-state + dynamic state block + master-after-state
// (which carries the state-report output-format the model emits).
//
// The user never sees any of this. Only the AI does.

import {
  sharedCore,
  practiceGenerationAlgorithm,
  loadMasterJourneyPrompt,
  stage01,
  stage02,
  stage03,
  stage04,
  stage05,
  stage06,
  stage07,
  stage08,
} from './load-spec';
import { renderSettlingSignalInstruction } from '../delayedCheck/signal';
import { formatTimeSinceLastTurnBucket } from '../state/load';
import { buildOnboardingContextBlock } from '@/lib/platform/onboarding-context';
import type { JourneyState } from '../state/types';

// Token in the engineered prompt files where the runtime state block is
// substituted in. Matches the placeholder in docs/journey/runtime/*.md.
const STATE_INJECTION_TOKEN = '{{STATE_INJECTION}}';


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
// Journey polish PR 6 (2026-07-04) — pattern staleness thresholds. The
// AI sees these signals in the state block; users never see them.
//
// PATTERN_DAYS_AGO_THRESHOLD (7 days): from here, each pattern's bullet
// gets a "— last seen N days ago" tail. Under 7 days is treated as
// still-alive and left unmarked to avoid clutter.
//
// PATTERN_RECONFIRM_THRESHOLD (14 days): from here, when this is a
// resumed session (isSessionResume === true), a soft directive is
// injected above the pattern list inviting the AI to gently reconfirm
// whether the pattern is still active. Gated to session-resume so it
// doesn't fire mid-conversation.
const PATTERN_DAYS_AGO_THRESHOLD = 7;
const PATTERN_RECONFIRM_THRESHOLD = 14;

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
  // PR M1 (2026-07-18) — clinical attention priority. The state block
  // that follows contains both LIVE session signals (top) and HISTORICAL
  // context (bottom, capped). This one line tells the AI where its
  // attention primarily belongs. Not a procedural rule — a reminder about
  // the memory that follows.
  lines.push(
    "**Your primary signal is the user's current message and the live session state below. The historical notes further down are context to hold lightly — verify against today's evidence before reusing.**",
  );
  lines.push('');
  // Journey P3 (2026-07-19, RC2) — session task contract, rendered FIRST
  // so it is available before intervention selection and checked before
  // any close. Emerging material may shift currentFocus; it must never
  // silently replace presentingRequest.
  if (state.taskContract) {
    const tc = state.taskContract;
    lines.push("**Session task contract (the user's ask — in their words):**");
    if (tc.presentingRequest) lines.push(`- Presenting request: "${tc.presentingRequest}"`);
    if (tc.expectedHelp) lines.push(`- Expected help: "${tc.expectedHelp}"`);
    if (tc.currentFocus) lines.push(`- Current working focus: "${tc.currentFocus}"`);
    if (tc.completionCriterion) lines.push(`- What "addressed" looks like: "${tc.completionCriterion}"`);
    lines.push(
      '_Check the route against this contract before selecting an intervention, and check it again before any close. Emerging material may become the current focus — it does not replace the presenting request unless the user changes direction. Update via `taskContract` in the state report when the user\'s words revise it._',
    );
    lines.push('');
  } else {
    lines.push(
      "**No session task contract captured yet.** As you listen, infer what this person is asking for, what they expect, and what \"addressed\" would look like — in their own words — and emit it in the state report's `taskContract` field. Clarify with the user only if genuinely unclear; never run a questionnaire.",
    );
    lines.push('');
    // Platform Step 3 part B (2026-07-20, owner-approved unfreeze) —
    // sign-up onboarding answers, shown ONLY while no task contract
    // exists. Once the clinician holds a live contract in the user's
    // words, the sign-up buttons have served their purpose and drop out
    // of context — the live conversation always supersedes the form.
    const onboardingBlock = buildOnboardingContextBlock(state.onboardingAnswers);
    if (onboardingBlock) {
      lines.push(onboardingBlock);
      lines.push('');
    }
  }
  // PR λ (2026-07-11) — the router's current bookkeeping label, not a
  // capability gate. All 8 stage specs are in the AI's canon block above;
  // the AI reaches for whichever stage's methodology fits the turn.
  lines.push(
    `- Router's stage label: ${state.currentStage}/8 (bookkeeping — reach for whichever stage's methodology fits the actual work this turn; all 8 playbooks are in your context above)`,
  );
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
  } else if (
    state.hoursSinceLastTurn !== null &&
    state.hoursSinceLastTurn < 1
  ) {
    // PR β (2026-07-09). Live test showed the AI freelancing "session_open"
    // rituals when the user sent a short input mid-session (e.g. "hey" 40s
    // after the prior turn). The absence of a resume signal wasn't enough on
    // its own — the model needed an explicit "this is a continuation" line
    // to override its default reading of a bare greeting as a fresh open.
    lines.push(
      `- This is a CONTINUATION of the current session (last turn was under an hour ago). Do NOT run a session-open ritual, do NOT re-greet, do NOT assume the user is returning after a break. Pick up from where the conversation left off, even if the user's message is short.`,
    );
  }
  if (state.stageJustAdvanced) {
    lines.push('');
    lines.push(
      `**Stage just advanced to ${state.currentStage}.** This is the FIRST turn at the new stage. Per the canonical method, the new stage may have a session-open ritual (e.g. Stage 8 opens every session with Identity Reinforcement Check-In; Stage 6 typically opens with the Internal Consensus Check). Refer to the active stage spec above for the canonical opener and run it now.`,
    );
  }

  // Therapeutic Sensitivity Layer — PR α (2026-07-09). Surface signals
  // from the AI's own prior turns so this turn honours session-level
  // continuity: open cycles must not be closed, refused modalities
  // must not be re-offered, channel shifts must be tracked. These lines
  // sit high in the state block because the AI's <assessment> block on
  // this turn should read them before writing the reply.
  if (state.hasOpenCycle) {
    lines.push('');
    lines.push(
      `**A THERAPEUTIC CYCLE IS OPEN.** Do NOT close this session while the cycle is open. The cycle can only close when the body has softened, emotional charge has reduced, the image (if any) has shifted positively or neutralised, and the user confirms relief or completion. If you attempt a close, first emit \`cycleCanClose: true\` in the state report — and only if the six not-close conditions in the Sensitivity Layer have cleared.`,
    );
    if (state.openCycleDescription) {
      lines.push(`  Context from the last open-cycle turn: "${state.openCycleDescription.slice(0, 240)}"`);
    }
  }
  if (state.sessionRejectedModalities.length > 0) {
    lines.push('');
    lines.push(
      `**Modalities the user has explicitly refused this session:** ${state.sessionRejectedModalities.join(', ')}. Do NOT re-offer these without an explicit user invitation. Reach for other families (see Practice Generation Algorithm).`,
    );
  }
  if (state.recentChannelShift) {
    lines.push('');
    lines.push(
      `**Recent channel shift detected.** The user has moved between processing channels in the last few turns (e.g. imagery → somatic, cognitive → emotional). Assess in your <assessment> block whether the shift has stabilised or is still moving.`,
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

  // PR M1 (2026-07-18) — historical context section header. Placed once
  // above the accumulated captures (parts / foreign / patterns / images
  // / continuity note) so the AI reads a clear boundary between live
  // session state (above) and stored formulation (below). Not a
  // procedural rule; a framing marker.
  const hasHistoricalContent =
    state.parts.length > 0 ||
    state.foreignFiles.length > 0 ||
    state.patterns.length > 0 ||
    state.signatureImages.length > 0 ||
    Boolean(state.continuityNote);
  if (hasHistoricalContent) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(
      '**Historical context — not fact.** Notes below are captures from prior sessions. Use only if they clearly fit what the user is showing today. Do not reopen, repeat or deepen an old capture merely because it appears here — first verify against the user\'s live signal.',
    );
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
      // Journey P1 (2026-07-19, audit A8): provisional vs confirmed release.
      // A claimed release stays PROVISIONAL until the user confirms it held
      // across time; treat provisional releases as open hypotheses.
      const phase = f.releasedAt
        ? 'released (confirmed by user across time)'
        : f.releaseClaimedAt
          ? 'release claimed (PROVISIONAL — not yet confirmed; the next user response can invalidate it)'
          : 'identified';
      const origin = f.originDescription ? ` (origin: "${f.originDescription}")` : '';
      lines.push(`- "${f.userDescription}"${origin} — ${phase}`);
    }
  }

  // Journey polish PR 5 — unresolved patterns the AI has noticed across
  // sessions. Free-string snake_case category + user's own words. Cap the
  // render at 10 entries so a long-term user's state block stays lean;
  // load already tops out at 20, ordered by most-recently-confirmed.
  //
  // Journey polish PR 6 (2026-07-04) — staleness signals:
  //   • Any pattern ≥ PATTERN_DAYS_AGO_THRESHOLD (7) days gets a
  //     "— last seen N days ago" suffix on its bullet.
  //   • When this is a resumed session AND at least one rendered
  //     pattern is ≥ PATTERN_RECONFIRM_THRESHOLD (14) days stale, add
  //     a soft directive above the list inviting the AI to gently
  //     reconfirm without leading. The user-facing wording is entirely
  //     the AI's choice — this is a state-block instruction, never
  //     recited verbatim to the user.
  if (state.patterns.length > 0) {
    // PR M1 (2026-07-18) — load.ts now caps patterns at 5. The slice
    // that was here (0..10) is a no-op post-cap but kept for defensive
    // safety in case a caller ever hands a pre-capped state through
    // this render path.
    const renderedPatterns = state.patterns.slice(0, 5);
    const hasReconfirmSignal =
      state.isSessionResume &&
      renderedPatterns.some(
        (p) => p.daysSinceLastConfirmed >= PATTERN_RECONFIRM_THRESHOLD,
      );
    lines.push('');
    lines.push(
      "**Unresolved patterns the user has surfaced (working notes — not diagnosis; use to recognise, not to name unless they name it):**",
    );
    if (hasReconfirmSignal) {
      lines.push(
        `_Some patterns below haven't shown up recently. They may have softened, or they may still be alive under a new shape. If the moment fits, gently check with the user in their own words — never name the category label; never lead. Otherwise carry on._`,
      );
    }
    for (const p of renderedPatterns) {
      const bits: string[] = [`- \`${p.category}\` — "${p.userDescription}"`];
      if (p.context && Object.keys(p.context).length > 0) {
        // Compact key: value pairs — helps the AI recognise, e.g., an
        // ageTag for an inner-child pattern.
        const ctx = Object.entries(p.context)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join(', ');
        bits.push(`context: ${ctx}`);
      }
      if (p.daysSinceLastConfirmed >= PATTERN_DAYS_AGO_THRESHOLD) {
        bits.push(`last seen ${p.daysSinceLastConfirmed} days ago`);
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
    // PR M1 (2026-07-18) — reframed from "your running model" to
    // "prior session notes (context, not truth)". Same field; less
    // authorial weight. The AI's Trap 11 (riding the case formulation)
    // is easier to honour when the note itself isn't labelled as a
    // running model of the user.
    lines.push(
      '**Prior session notes (may be incomplete, outdated, or mistaken — use as context, not truth):**',
    );
    // Head-and-tail truncation per M0 finding: the head of the note
    // consistently holds the current-session summary; the tail holds
    // "Next session:" directives. The middle is where accumulated
    // material (and past errors) sediments. Preserving both ends drops
    // the risky middle while keeping operational continuity intact.
    // Threshold and slice sizes tuned to keep total rendered content
    // near 750 chars including the ellipsis marker.
    const note = state.continuityNote;
    if (note.length <= 800) {
      lines.push(`> ${note}`);
    } else {
      const head = note.slice(0, 400).trim();
      const tail = note.slice(-300).trim();
      lines.push(`> ${head}`);
      lines.push('>');
      lines.push('> [...older material in the middle omitted — see Journey Inspector for the full note]');
      lines.push('>');
      lines.push(`> ${tail}`);
    }
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


// Header introducing the canon section. Placed at the top of the cached
// canon blocks so the AI sees its layer-ordering hint before reading
// Shared Core.
//
// PR λ (2026-07-11) — three architectural pieces in this header rewrite:
//   1. Renamed section 3 from "Active stage spec" to "All 8 stage specs"
//      because that's what we now load — the AI has the detailed playbook
//      for every stage in its context, not just the current stage.
//   2. Reframed stage number as a bookkeeping label the router uses, not
//      a constraint on what the AI can reach for. Julia's clinical
//      philosophy: AI leads like a clinician, everything else is support
//      information. The AI reaches for whichever stage's methodology fits
//      what the user is actually doing this turn.
//   3. Explicit permission to freely mix stage methodologies as needed —
//      e.g. Stage 5 foreign-material work alongside Stage 6 integration
//      language when both are alive in one turn.
const CANON_PROMPT_HEADER = `# CLINICAL METHOD SOURCE (canon)

Three sources of clinical method follow, then your operational behavior layer.

**1. Shared Core** — your clinical constitution. Applies every turn, every stage.
**2. Practice Generation Algorithm** — how you compose practices at runtime from the five practice families (regulation, somatic awareness, guided inner landscape, narrative rewriting, self-compassion). The system does NOT ship a fixed library of scripts; you generate practices dynamically from this algorithm against the user's live state, exact words, body signals, and safety layer. Reach into all five families, not only stabilisation.
**3. All 8 stage specs** — the full clinical playbooks for every stage of the Journey, Stage 1 through Stage 8, all loaded in your context. Reach for whichever stage's methodology fits what the user is actually doing this turn — not what the router's stage label says. If the user is doing foreign-material release work (Stage 5), use the Stage 5 playbook even if the router still labels them Stage 1. If integration language is alive (Stage 6) inside a stabilisation session (Stage 1), reach for both. Stage numbers are a bookkeeping label for progression tracking; they are NOT capability gates.

This canon is the authoritative reference for the method you are delivering. Where it overlaps with the general behavior layer (master prompt) that follows, the canon takes precedence on clinical content (practices, stage-specific behaviour, capture fields); the master prompt takes precedence on voice, character, and operational format.

You lead. The stage number, the state block, the master prompt, the audit fields — these are all support. Your clinical judgment on which stage's methodology to reach for this turn is the final call.

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

## ALL 8 STAGE SPECS

Every stage of the Journey follows, in order. Each is a full clinical playbook — its practices, its prohibitions, its gates, its session-close ritual. Reach for whichever stage's methodology fits what the user is actually doing this turn.

`;

// PR λ (2026-07-11) — dividers that separate the 8 stage specs inside the
// canon block. Each divider names the stage so the AI can scan-locate the
// right playbook when it decides which stage's methodology fits the turn.
const STAGE_SEPARATORS: string[] = [
  '\n\n---\n\n## STAGE 1 SPEC — STABILISATION\n\n',
  '\n\n---\n\n## STAGE 2 SPEC — PAIN\n\n',
  '\n\n---\n\n## STAGE 3 SPEC — ADULT SELF\n\n',
  '\n\n---\n\n## STAGE 4 SPEC — PARTS\n\n',
  '\n\n---\n\n## STAGE 5 SPEC — FOREIGN MATERIAL\n\n',
  '\n\n---\n\n## STAGE 6 SPEC — INTEGRATION\n\n',
  '\n\n---\n\n## STAGE 7 SPEC — NEW IDENTITY\n\n',
  '\n\n---\n\n## STAGE 8 SPEC — EMBODIMENT\n\n',
];

function allStageSpecs(): string {
  const specs = [
    stage01(),
    stage02(),
    stage03(),
    stage04(),
    stage05(),
    stage06(),
    stage07(),
    stage08(),
  ];
  return specs.map((s, i) => STAGE_SEPARATORS[i] + s).join('');
}

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
    // The master runtime prompt is always bundled in production
    // (next.config.mjs outputFileTracingIncludes). If it is ever missing, fail
    // loud rather than serve a degraded prompt (the former fallback here
    // mutually recursed into a stack overflow).
    throw new Error(
      'Journey master prompt (docs/journey/runtime/journey-master.md) not found or unreadable',
    );
  }

  // Split master at the STATE_INJECTION_TOKEN so the dynamic state block
  // can be its own (uncached) middle block.
  const idx = master.indexOf(STATE_INJECTION_TOKEN);
  const masterBeforeState =
    idx >= 0 ? master.slice(0, idx) : master;
  const masterAfterState =
    idx >= 0 ? master.slice(idx + STATE_INJECTION_TOKEN.length) : '';

  const blocks: SystemPromptBlock[] = [
    // Canon header + Shared Core + Practice Generation Algorithm + ALL 8
    // stage specs (all cached in one block). PR λ (2026-07-11) — per
    // Julia's clinical philosophy, the AI is the clinician and reaches
    // for whichever stage's methodology fits the turn. Loading all 8
    // detailed playbooks removes the artificial restriction of only the
    // current stage's spec being in context. Cost delta: ~+24K cached
    // tokens on top of the ~30K already cached; cache-read cost per
    // warm turn rises by ~$0.007, cache-write on cold-start rises by
    // ~$0.09. Small absolute cost for full method fidelity.
    //
    // All of this stays in the SAME cached block as Shared Core because
    // it's all stage-agnostic canon that never changes per turn — no
    // new cache breakpoint needed (cache-breakpoint budget is limited).
    {
      type: 'text',
      text:
        CANON_PROMPT_HEADER +
        sharedCore() +
        CANON_PRACTICE_HEADER +
        practiceGenerationAlgorithm() +
        CANON_STAGE_HEADER +
        allStageSpecs(),
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
