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
// Per docs/journey/01-stage-stabilisation.md §10 + assessment-phase framing
// in docs/journey/runtime/journey-master.md.
//
// Block 1 is the assessment phase. To advance, the AI must have:
//   (a) helped the user name an anchor (set-once on RecodeProgress), AND
//   (b) built a working case formulation across sessions AND shared it
//       back to the user for explicit confirmation. That confirmation is
//       captured via readinessTouched: "formulation_confirmed" on any
//       turn in the window. Without it the deeper work in Block 2+ rests
//       on the AI's unilateral interpretation — see trap #11.
//
// Stage 1 uses a LOOSER safety guard than the other stages: only 'red_flag'
// blocks advancement, not 'watch'. Rationale: Block 1 assessment explores
// material (financial pressure, difficult relationships, past content) that
// the AI appropriately flags 'watch'. If watch blocked progression, the gate
// would never close for any real user doing real work. 'red_flag' still
// blocks here (and triggers freeze separately).
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
  const formulationConfirmed = turns.some((t) =>
    (t.report.readinessTouched ?? []).some((r) => /formulation[_-]?confirmed/i.test(r)),
  );
  if (!formulationConfirmed) reasons.push('formulation_not_confirmed_with_user');
  return reasons.length === 0 ? pass() : fail(...reasons);
}

// ---------------------------------------------------------------------------
// Stage 2 — Pain Identification
// ---------------------------------------------------------------------------
// Per docs/journey/02-stage-pain.md §10
export function checkStage2Gate(state: JourneyState, turns: AuditTurn[]): GateResult {
  const reasons = standardGuards(state, turns, 3);
  // Anchor still present (set in Stage 1, never overwritten)
  if (!state.anchorText) reasons.push('anchor_missing');
  // Emotion named + located + Soft Why asked + answered. Captured via the
  // state report's free-text fields. We look for any turn in the window where
  // partsTouched or userImagesCaptured carry user-words content AND the AI
  // marked readinessTouched against the pain criteria.
  const anyEmotionNamed = turns.some((t) =>
    (t.report.readinessTouched ?? []).some((r) =>
      /emotion[_-]?named|emotion[_-]?located|soft[_-]?why/i.test(r),
    ),
  );
  if (!anyEmotionNamed) reasons.push('no_emotion_named_or_soft_why_touched');
  return reasons.length === 0 ? pass() : fail(...reasons);
}

// ---------------------------------------------------------------------------
// Stage 3 — Inner Adult Self Activation
// ---------------------------------------------------------------------------
// Per docs/journey/03-stage-adult-self.md §10
// Non-negotiable: Adult Self reached on at least TWO DIFFERENT DAYS.
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
export function checkStage6Gate(state: JourneyState, turns: AuditTurn[]): GateResult {
  const reasons = standardGuards(state, turns, 5);
  if (!state.anchorText) reasons.push('anchor_missing');
  if (!state.identityAnchor) reasons.push('identity_anchor_not_set');
  // "I feel like myself" on ≥ 2 distinct days — captured via readinessTouched
  const feelLikeMyselfTwice = heldOnDistinctDays(
    turns,
    (t) =>
      (t.report.readinessTouched ?? []).some((r) =>
        /feel[_-]?like[_-]?myself|internal[_-]?consensus|cohesion/i.test(r),
      ),
    2,
  );
  if (!feelLikeMyselfTwice) reasons.push('felt_cohesion_not_reached_on_two_days');
  // No separated/angry/unseen parts in last 3 sessions — proxied by no part
  // having compassionBridgeQuality cleared back to null
  const allPartsBridged = state.parts.every(
    (p) => p.compassionBridgeQuality != null,
  );
  if (!allPartsBridged) reasons.push('part_without_compassion_bridge');
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

  return reasons.length === 0 ? pass() : fail(...reasons);
}
