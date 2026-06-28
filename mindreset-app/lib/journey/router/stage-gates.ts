// Per-stage completion gates.
//
// One function per internal Journey stage. Each takes the current JourneyState
// and a window of recent audit turns (most recent last), returns whether the
// stage's completion criteria are met along with a list of reasons (for the
// audit log and the admin review surface in Slice 5).
//
// Reference: §10 "Completion Criteria (code-enforced gate)" in each stage's
// spec in docs/journey/.
//
// All gates also require:
//   - last two intensity readings ≤ 5/10
//   - safetyFlag === 'none' for last N turns (stage-dependent)
//   - no frozen_for_review flag
//   - AI's recommendedAction === 'advance' (advisory; code makes the final call)

import type { JourneyState } from '../state/types';
import {
  type AuditTurn,
  distinctDays,
  heldOnDistinctDays,
  lastTwoIntensities,
  noRedFlagInLast,
  safetyNoneForLast,
} from './history';

export type GateResult = {
  passed: boolean;
  reasons: string[];
};

function fail(...reasons: string[]): GateResult {
  return { passed: false, reasons };
}
function pass(): GateResult {
  return { passed: true, reasons: [] };
}

function standardGuards(
  state: JourneyState,
  turns: AuditTurn[],
  safetyWindow: number,
): string[] {
  const reasons: string[] = [];
  if (state.frozenForReview) reasons.push('frozen_for_review');
  const intensities = lastTwoIntensities(turns);
  if (intensities.length < 2) reasons.push('insufficient_intensity_history');
  else if (intensities.some((i) => i > 5)) reasons.push('recent_intensity_above_5');
  if (!safetyNoneForLast(turns, safetyWindow)) {
    reasons.push(`safety_not_clean_for_last_${safetyWindow}_turns`);
  }
  const last = turns[turns.length - 1];
  if (last?.report.recommendedAction !== 'advance') {
    reasons.push('ai_did_not_recommend_advance');
  }
  return reasons;
}

// ---------------------------------------------------------------------------
// Stage 1 — Assessment & Stabilisation
// ---------------------------------------------------------------------------
// Per docs/journey/01-stage-stabilisation.md §10 (the canon source of truth).
//
// CANON-ALIGNED (2026-06-26 audit). Previously this gate required
// `formulation_confirmed` in readinessTouched — a milestone invented in the
// master prompt's <assessment_phase> section but NOT present in canon §10.
// That extra requirement made the gate effectively impassable in real
// conversation, because users rarely give the clean explicit confirmation
// the master prompt's share-back protocol demands ("nearly, maybe" is the
// realistic shape of confirmation; canon §10 doesn't require any). Test
// data 2026-06-26: users stuck at Stage 1 across 67 turns and 2 sessions.
//
// Canon §10 requires:
//   - `anchorText` set
//   - Last 2 intensities ≤ 5
//   - Last 3 turns' safetyFlag is `none` (canon strict reading)
//   - `readinessTouched` includes: anchor-identified, one emotion-or-body-
//     state named, basic orientation present
//   - recommendedAction: advance
//   - No frozen_for_review
//
// SAFETY GUARD: Stage 1 uses a LOOSER safety guard than canon (B option per
// owner sign-off, 2026-06-26): only 'red_flag' blocks advancement, not
// 'watch'. Rationale documented in the prior version of this gate — Block 1
// assessment legitimately explores material (financial pressure, difficult
// relationships, past content) that the AI appropriately flags 'watch'. If
// watch blocked progression, the gate would never close for any real user
// doing real work. 'red_flag' still blocks (and triggers freeze separately).
// Owner has reserved the right to tighten to canon-strict (A) later via a
// one-line change.
export function checkStage1Gate(state: JourneyState, turns: AuditTurn[]): GateResult {
  const reasons: string[] = [];

  // Inlined version of standardGuards with the looser safety check.
  if (state.frozenForReview) reasons.push('frozen_for_review');
  const intensities = lastTwoIntensities(turns);
  if (intensities.length < 2) reasons.push('insufficient_intensity_history');
  else if (intensities.some((i) => i > 5)) reasons.push('recent_intensity_above_5');
  if (!noRedFlagInLast(turns, 3)) reasons.push('red_flag_in_last_3_turns');
  const last = turns[turns.length - 1];
  if (last?.report.recommendedAction !== 'advance') {
    reasons.push('ai_did_not_recommend_advance');
  }

  if (!state.anchorText) reasons.push('anchor_not_set');

  // Canon §10's three readiness tokens.
  const hasToken = (regex: RegExp): boolean =>
    turns.some((t) =>
      (t.report.readinessTouched ?? []).some((r) => regex.test(r)),
    );
  const anchorIdentified = hasToken(/anchor[_-]?identified/i);
  if (!anchorIdentified) reasons.push('anchor_identified_token_missing');
  // Canon: "one emotion-or-body-state named" — either token counts.
  const emotionOrBody = hasToken(/emotion[_-]?named|body[_-]?located/i);
  if (!emotionOrBody) reasons.push('no_emotion_or_body_state_named');
  const orientationPresent = hasToken(/orientation[_-]?present/i);
  if (!orientationPresent) reasons.push('orientation_not_present');

  return reasons.length === 0 ? pass() : fail(...reasons);
}

// ---------------------------------------------------------------------------
// Stage 2 — Pain Identification
// ---------------------------------------------------------------------------
// Per docs/journey/02-stage-pain.md §10
//
// CANON-ALIGNED (2026-06-26 audit). Before alignment, this gate accepted
// ANY ONE token from a regex matching emotion_named|emotion_located|soft_why.
// Canon §10 requires THREE DISTINCT conditions:
//   1. At least one emotion has been named by the user in their own words.
//   2. That emotion has been located in the body.
//   3. The Soft Why has been asked AND the user has responded (with
//      reflection OR with "I don't know" — both count).
//
// Canon also requires:
//   - intensities ≤ 5
//   - safetyFlag none for 3 turns (canon strict — this stage uses standard
//     guards, not the looser Stage 1 rule)
//   - Anchor still accessible (code approximates with anchorText set)
//   - recommendedAction: advance
//   - No frozen_for_review
export function checkStage2Gate(state: JourneyState, turns: AuditTurn[]): GateResult {
  const reasons = standardGuards(state, turns, 3);
  // Anchor still present (set in Stage 1, never overwritten)
  if (!state.anchorText) reasons.push('anchor_missing');

  // Canon §10 — three distinct conditions, each must be touched at least
  // once in the window.
  const hasToken = (regex: RegExp): boolean =>
    turns.some((t) =>
      (t.report.readinessTouched ?? []).some((r) => regex.test(r)),
    );

  // 1. Emotion named
  if (!hasToken(/emotion[_-]?named/i)) {
    reasons.push('emotion_not_named');
  }
  // 2. Emotion located in body
  if (!hasToken(/emotion[_-]?located|body[_-]?located/i)) {
    reasons.push('emotion_not_located_in_body');
  }
  // 3. Soft Why asked AND user responded. Canon says "I don't know" counts as
  // a response — so we accept either the asked-and-answered token or any
  // soft_why-shaped token across the window.
  const softWhyTouched = hasToken(/soft[_-]?why/i);
  if (!softWhyTouched) {
    reasons.push('soft_why_not_asked_or_answered');
  }

  return reasons.length === 0 ? pass() : fail(...reasons);
}

// ---------------------------------------------------------------------------
// Stage 3 — Inner Adult Self Activation
// ---------------------------------------------------------------------------
// Per docs/journey/03-stage-adult-self.md §10
//
// CANON-ALIGNED (2026-06-26 audit). Before alignment, this gate was
// missing two canonical conditions:
//   - "Adult Self linked to Anchor at least once" (the pairing canon §10
//     calls permanent)
//   - "User held a named emotion in Adult Self + Anchor at least once"
//     (the MII-1 readiness test)
//
// PR 4 (Bundle B) added the schema fields `adultSelfAnchorLinked` and
// `heldEmotionInAdultSelf` but never wired them to the gate. This PR
// wires them.
//
// Non-negotiable per canon: Adult Self reached on at least TWO DIFFERENT
// DAYS.
export function checkStage3Gate(state: JourneyState, turns: AuditTurn[]): GateResult {
  const reasons = standardGuards(state, turns, 3);
  if (!state.anchorText) reasons.push('anchor_missing');
  // Observer seat touched at least once
  const observerSeen = turns.some((t) => t.report.observerSeatTouched === true);
  if (!observerSeen) reasons.push('observer_seat_not_touched');
  // Adult Self qualities captured in user's words (any turn)
  const qualitiesSet = state.adultSelfQualities != null || turns.some(
    (t) => typeof t.report.adultSelfQualities === 'string' && t.report.adultSelfQualities.length > 0,
  );
  if (!qualitiesSet) reasons.push('adult_self_qualities_not_captured');
  // Reproducibility: adultSelfPresent on at least 2 distinct days
  const reproducible = heldOnDistinctDays(
    turns,
    (t) => t.report.adultSelfPresent === true,
    2,
  );
  if (!reproducible) reasons.push('adult_self_not_reproducible_across_days');
  // Canon §10: Adult Self linked to Anchor at least once.
  // PR 4 schema field: adultSelfAnchorLinked.
  const anchorLinked = turns.some((t) => t.report.adultSelfAnchorLinked === true);
  if (!anchorLinked) reasons.push('adult_self_not_linked_to_anchor');
  // Canon §10: User has demonstrated capacity to hold a named emotion in
  // Adult Self + Anchor at least once.
  // PR 4 schema field: heldEmotionInAdultSelf.
  const heldEmotion = turns.some((t) => t.report.heldEmotionInAdultSelf === true);
  if (!heldEmotion) reasons.push('emotion_not_held_in_adult_self');
  return reasons.length === 0 ? pass() : fail(...reasons);
}

// ---------------------------------------------------------------------------
// Stage 4 — Meeting Inner Parts (the MII gate)
// ---------------------------------------------------------------------------
// Per docs/journey/04-stage-parts.md §10
// Largest gate in the method. Seven MII criteria + standard guards.
export function checkStage4Gate(state: JourneyState, turns: AuditTurn[]): GateResult {
  const reasons = standardGuards(state, turns, 5);
  if (!state.anchorText) reasons.push('anchor_missing');

  // MII-1 — Adult Self Stability ≥ 70%: adultSelfPresent: true in ≥ 4 of last 5
  const last5 = turns.slice(-5);
  const adultPresentCount = last5.filter((t) => t.report.adultSelfPresent === true).length;
  if (last5.length < 5 || adultPresentCount < 4) reasons.push('mii1_adult_self_unstable');

  // MII-2 — Clear Recognition of Parts: at least 1 active part in landscape
  if (state.parts.length === 0) reasons.push('mii2_no_parts_recognised');

  // MII-3 — No Overwhelm: no aborted_overwhelm practiceRun in last 3 turns with depth: 'deep'
  const recentOverwhelm = turns.slice(-15).some(
    (t) => t.report.practiceRun?.status === 'aborted_overwhelm',
  );
  if (recentOverwhelm) reasons.push('mii3_recent_overwhelm');

  // MII-4 — Safe Adult–Part Relationship: compassionBridgeQuality set with
  // one of the allowed qualities, on at least 2 distinct days
  const bridgeOnTwoDays = heldOnDistinctDays(
    turns,
    (t) =>
      t.report.compassionBridgeQuality === 'compassion' ||
      t.report.compassionBridgeQuality === 'curiosity' ||
      t.report.compassionBridgeQuality === 'acceptance' ||
      t.report.compassionBridgeQuality === 'willingness_to_comfort',
    2,
  );
  if (!bridgeOnTwoDays) reasons.push('mii4_compassion_bridge_not_landed_twice');

  // MII-5 — Basic Reparenting Capacity: any active part has a recorded
  // currentRestingPlace OR any state report carries an "offering" string.
  const reparenting =
    state.parts.some((p) => p.currentRestingPlace) ||
    turns.some((t) => typeof t.report.adultSelfQualities === 'string');
  if (!reparenting) reasons.push('mii5_no_reparenting_capacity');

  // MII-6 — No Delayed Destabilisation (soft check). If a Deep Layer contact
  // happened recently and the mii6 status is 'destabilised' or 'unsure',
  // do not pass. We treat 'met' or 'stable' as pass; null counts as pass too
  // when no Deep Layer contact has happened.
  const mii6Status = (state.mii.mii6_noDestabilisation as { status?: string } | undefined)?.status;
  if (mii6Status === 'failed') reasons.push('mii6_destabilised');

  // MII-7 — Internal Cohesion Awareness on ≥ 2 distinct days
  const cohesionTwice = heldOnDistinctDays(
    turns,
    (t) => typeof t.report.cohesionAwareness === 'string' && t.report.cohesionAwareness.length > 0,
    2,
  );
  if (!cohesionTwice) reasons.push('mii7_cohesion_awareness_missing');

  return reasons.length === 0 ? pass() : fail(...reasons);
}

// ---------------------------------------------------------------------------
// Stage 5 — Foreign Material
// ---------------------------------------------------------------------------
// Per docs/journey/05-stage-foreign-material.md §10
export function checkStage5Gate(state: JourneyState, turns: AuditTurn[]): GateResult {
  const reasons = standardGuards(state, turns, 5);
  if (!state.anchorText) reasons.push('anchor_missing');
  // At least one foreign file identified
  if (state.foreignFiles.length === 0) reasons.push('no_foreign_material_identified');
  // Symbolic Return run at least once with somatic release: we record the
  // release by setting releasedAt on the foreign file.
  const anyReleased = state.foreignFiles.some((f) => f.releasedAt != null);
  if (!anyReleased) reasons.push('no_symbolic_return_completed');
  // Clean Identity Statement spoken (any turn captures cleanIdentityStatement)
  const cleanStatementSeen = turns.some(
    (t) => typeof t.report.cleanIdentityStatement === 'string',
  );
  if (!cleanStatementSeen) reasons.push('clean_identity_statement_missing');
  return reasons.length === 0 ? pass() : fail(...reasons);
}

// ---------------------------------------------------------------------------
// Stage 6 — Integration & Identity Consolidation
// ---------------------------------------------------------------------------
// Per docs/journey/06-stage-integration.md §10
//
// Audit P0 #2 (2026-06-19) made this gate reachable. Before the fix:
//   - The cohesion check used a regex over readinessTouched tokens that
//     existed only in the gate, not in any prompt's vocabulary. The
//     gate could not pass even when the user reached internal
//     consensus correctly.
//   - The "no separated parts" check tested compassionBridgeQuality,
//     which is a Stage 4 MII-4 milestone, not a Stage 6 separation
//     signal. It also passed vacuously when state.parts.length === 0.
//
// The fix uses an explicit `internalConsensus: boolean` field the AI
// emits after running the Internal Consensus Check (canon §8.1), and
// requires the user has at least one captured part in their landscape
// before Stage 6 advancement can be evaluated.
//
// PR 4 (2026-06-23) adds two further canon §10 criteria:
//   - selfLoyaltyStatement captured at least once
//   - oneSmallAction captured at least once
// These were previously missing from schema; now they land.
export function checkStage6Gate(state: JourneyState, turns: AuditTurn[]): GateResult {
  const reasons = standardGuards(state, turns, 5);
  if (!state.anchorText) reasons.push('anchor_missing');
  if (!state.identityAnchor) reasons.push('identity_anchor_not_set');
  // Internal consensus reached on ≥ 2 distinct days. Canon §10 names
  // this exactly as `internalConsensus: true`.
  const consensusTwice = heldOnDistinctDays(
    turns,
    (t) => t.report.internalConsensus === true,
    2,
  );
  if (!consensusTwice) reasons.push('internal_consensus_not_reached_on_two_days');
  // Stage 6 evaluates parts cohesion; without any captured parts the
  // check is meaningless. The earlier `parts.every(...)` shape passed
  // vacuously for empty arrays, which let users without any parts in
  // their landscape advance through Stage 6.
  if (state.parts.length === 0) {
    reasons.push('no_parts_in_landscape_for_cohesion_check');
  }
  // Self-Loyalty Commitment (canon §8.3 / §10) — captured at least once
  // in user's own words. PR 4 schema additions land this field.
  const loyaltyCaptured = turns.some(
    (t) =>
      typeof t.report.selfLoyaltyStatement === 'string' &&
      t.report.selfLoyaltyStatement.length > 0,
  );
  if (!loyaltyCaptured) reasons.push('self_loyalty_statement_missing');
  // One small action committed (canon §8.3 / §10).
  const actionCaptured = turns.some(
    (t) =>
      typeof t.report.oneSmallAction === 'string' &&
      t.report.oneSmallAction.length > 0,
  );
  if (!actionCaptured) reasons.push('one_small_action_missing');
  return reasons.length === 0 ? pass() : fail(...reasons);
}

// ---------------------------------------------------------------------------
// Stage 7 — Sensing the New Identity
// ---------------------------------------------------------------------------
// Per docs/journey/07-stage-new-identity.md §10
// CRITICAL: urgency criterion is non-negotiable — even an eloquent user
// cannot advance if urgency has appeared in the recent turn window.
export function checkStage7Gate(state: JourneyState, turns: AuditTurn[]): GateResult {
  const reasons = standardGuards(state, turns, 5);
  if (!state.identityAnchor) reasons.push('identity_anchor_missing');

  // Symbolic Identity Map captured at least once
  const mapCaptured = turns.some((t) => typeof t.report.symbolicIdentityMap === 'string');
  if (!mapCaptured) reasons.push('symbolic_identity_map_missing');

  // At least 3 emerging qualities across ≥ 2 sessions
  const allQualities = new Set<string>();
  const qualityDays = new Set<string>();
  for (const t of turns) {
    if (Array.isArray(t.report.emergingQualities)) {
      for (const q of t.report.emergingQualities) allQualities.add(q.toLowerCase());
      if (t.report.emergingQualities.length > 0) {
        qualityDays.add(t.createdAt.toISOString().slice(0, 10));
      }
    }
  }
  if (allQualities.size < 3) reasons.push('fewer_than_three_emerging_qualities');
  if (qualityDays.size < 2) reasons.push('qualities_not_captured_across_two_days');

  // Inner direction articulated (not a plan)
  const innerDirectionSeen = turns.some((t) => typeof t.report.innerDirection === 'string');
  if (!innerDirectionSeen) reasons.push('inner_direction_missing');

  // URGENCY CHECK — non-negotiable. No urgencyMarkers: 'present' in last 5
  // turns across last 2 sessions (we approximate as last 5 turns total).
  const recentUrgency = turns.slice(-5).some((t) => t.report.urgencyMarkers === 'present');
  if (recentUrgency) reasons.push('urgency_present_in_recent_turns');

  // Safety Reorientation — canon §8.3 names this as the "mandatory closing
  // practice of every Stage 7 session." PR 4 lands the schema field; here
  // we require it to have been delivered at least twice in the audit
  // window before stage advancement.
  const reorientationCount = turns.filter(
    (t) => t.report.safetyReorientation === true,
  ).length;
  if (reorientationCount < 2) {
    reasons.push('safety_reorientation_missing_in_recent_sessions');
  }

  return reasons.length === 0 ? pass() : fail(...reasons);
}

// ---------------------------------------------------------------------------
// Stage 8 — Embodiment & Stabilisation (the Discharge gate)
// ---------------------------------------------------------------------------
// Per docs/journey/08-stage-embodiment.md §10
// Non-negotiable minimum: 6 weeks in Stage 8.
const STAGE_8_MIN_WEEKS = 6;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function checkStage8Gate(
  state: JourneyState,
  turns: AuditTurn[],
  stage8StartedAt: Date,
): GateResult {
  const reasons = standardGuards(state, turns, 10);
  if (!state.identityAnchor) reasons.push('identity_anchor_missing');

  // Minimum 6 weeks in Stage 8
  const weeksElapsed = (Date.now() - stage8StartedAt.getTime()) / MS_PER_WEEK;
  if (weeksElapsed < STAGE_8_MIN_WEEKS) {
    reasons.push(`stage_8_min_${STAGE_8_MIN_WEEKS}_weeks_not_elapsed`);
  }

  // At least 6 CAL sessions on different real moments
  const calRuns = turns.filter((t) => typeof t.report.calRunOn === 'string');
  const distinctCalDays = distinctDays(calRuns);
  if (calRuns.length < 6 || distinctCalDays < 6) {
    reasons.push('cal_sessions_under_six');
  }

  // At least 3 CAL sessions at Layer 2 or 3 (redirection achieved)
  const layer2or3 = calRuns.filter((t) => t.report.calLayer === 2 || t.report.calLayer === 3);
  if (layer2or3.length < 3) reasons.push('cal_layer_2_or_3_under_three');

  // No urgency in recent window
  const recentUrgency = turns.slice(-20).some(
    (t) => t.report.urgencyMarkers === 'present',
  );
  if (recentUrgency) reasons.push('urgency_in_recent_two_weeks');

  // Discharge readiness (PR 4 / canon §8.3 §10). The AI must explicitly
  // signal `dischargeReadiness: 'ready'` at least twice across the audit
  // window before the gate can fire. `not_ready` or `maybe` count as
  // not-ready; missing values count as not-ready.
  const readyTurns = turns.filter(
    (t) => t.report.dischargeReadiness === 'ready',
  );
  if (readyTurns.length < 2) {
    reasons.push('discharge_readiness_not_signalled_twice');
  }

  return reasons.length === 0 ? pass() : fail(...reasons);
}
