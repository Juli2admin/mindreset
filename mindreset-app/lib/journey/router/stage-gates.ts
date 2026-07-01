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
  countSessions,
  distinctDays,
  groupSessions,
  heldOnDistinctDays,
  lastNSessionsTurns,
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
  expectedAction: 'advance' | 'discharge' = 'advance',
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
  if (last?.report.recommendedAction !== expectedAction) {
    reasons.push(
      expectedAction === 'discharge'
        ? 'ai_did_not_recommend_discharge'
        : 'ai_did_not_recommend_advance',
    );
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
//
// CANON-ALIGNED (2026-06-27 audit). Before alignment, MII-5 fell back to
// reading `adultSelfQualities` — a Stage 3 capture (the user's words for
// the Adult Self itself), NOT a reparenting offering to a part. That meant
// any Stage 4 user who had reached Stage 3 already passed MII-5 by default
// without ever offering anything to a part. Canon §10 names the field
// exactly: `adultSelfOfferingToPart: "..."` captured at least once in the
// user's words. The schema field that carries it is
// `partSecured.adultSelfOffering` (see schema.ts §72), which save.ts
// writes into the part's `currentRestingPlace` column. This PR makes the
// MII-5 fallback read the right report field.
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

  // MII-5 — Basic Reparenting Capacity. Canon §10: "adultSelfOfferingToPart
  // captured at least once in the user's words." The schema carries this as
  // `partSecured.adultSelfOffering` (save.ts writes it into the part's
  // currentRestingPlace). Pass if any active part has a recorded resting
  // place OR any audit turn carried an explicit adultSelfOffering string.
  const reparenting =
    state.parts.some((p) => p.currentRestingPlace) ||
    turns.some((t) =>
      typeof t.report.partSecured?.adultSelfOffering === 'string' &&
      t.report.partSecured.adultSelfOffering.length > 0,
    );
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
//
// CANON-ALIGNED (2026-06-27 audit). Before alignment, this gate accepted
// two release signals on softer evidence than canon:
//   - "Symbolic Return completed" was inferred from `releasedAt != null`
//     on any foreign file, but save.ts sets that timestamp whenever
//     `foreignFileReleased` lands — regardless of whether the release
//     actually settled in the body. Canon §10 names the field exactly:
//     `somaticRelease: true` must be confirmed for the Symbolic Return
//     to count.
//   - "Clean Identity Statement" was accepted on `cleanIdentityStatement`
//     alone. Canon §10 also requires `bodyConfirmation` — the user's own
//     words for the felt sense after declaring what stays and what was
//     released. Without body confirmation the statement is head-only and
//     canon explicitly does not count it.
//
// PR 4 (Bundle B) landed both schema fields (`somaticRelease`,
// `bodyConfirmation`) but never wired them to the gate. This PR wires
// them.
export function checkStage5Gate(state: JourneyState, turns: AuditTurn[]): GateResult {
  const reasons = standardGuards(state, turns, 5);
  if (!state.anchorText) reasons.push('anchor_missing');
  // At least one foreign file identified
  if (state.foreignFiles.length === 0) reasons.push('no_foreign_material_identified');
  // Symbolic Return run at least once with somatic release: we record the
  // release by setting releasedAt on the foreign file.
  const anyReleased = state.foreignFiles.some((f) => f.releasedAt != null);
  if (!anyReleased) reasons.push('no_symbolic_return_completed');
  // Canon §10: somaticRelease: true must be confirmed at least once.
  // Without this, the release was head-only.
  const somaticConfirmed = turns.some((t) => t.report.somaticRelease === true);
  if (!somaticConfirmed) reasons.push('somatic_release_not_confirmed');
  // Clean Identity Statement spoken (any turn captures cleanIdentityStatement)
  const cleanStatementSeen = turns.some(
    (t) =>
      typeof t.report.cleanIdentityStatement === 'string' &&
      t.report.cleanIdentityStatement.length > 0,
  );
  if (!cleanStatementSeen) reasons.push('clean_identity_statement_missing');
  // Canon §10: the statement must be confirmed in the body, captured as
  // bodyConfirmation in the user's own words.
  const bodyConfirmed = turns.some(
    (t) =>
      typeof t.report.bodyConfirmation === 'string' &&
      t.report.bodyConfirmation.length > 0,
  );
  if (!bodyConfirmed) reasons.push('clean_identity_statement_not_body_confirmed');
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
//
// CANON-ALIGNED (2026-06-27 audit). Canon §10 also requires:
//   "The Adult Self has been present (`adultSelfPresent: true`) across
//    ≥ 70% of turns in the last 3 sessions."
// This is the same MII-1 reproducibility check Stage 4 enforces, applied
// to Stage 6's longer window. Without it, a user can drift away from
// Adult Self late in Stage 6 and still advance because earlier internal
// consensus moments survive in the audit. This PR wires the check using
// the new session-aware lastNSessionsTurns helper (4-hour boundary,
// matches state/load.ts).
//
// Note on the remaining canon §10 items still not gated:
//   - "I feel like myself" reported on ≥ 2 different days — no schema
//     field exists; deferred to a later PR that adds the field.
//   - "No part has surfaced as separate, angry, or unseen in last 3
//     sessions" — implicitly enforced by the internalConsensus = true
//     requirement on ≥ 2 distinct days, since the consensus check's
//     definition (per schema doc) is "all parts present, aligned with
//     the Adult Self, and not in conflict."
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
  // Canon §10: Adult Self present ≥ 70% of turns in the last 3 sessions.
  // Same shape as Stage 4 MII-1; the 70% threshold is the canon ratio.
  // We need ≥ 3 actual sessions of history — without them the
  // reproducibility canon mandates can't be evaluated.
  if (countSessions(turns) < 3) {
    reasons.push('insufficient_history_for_adult_self_stability');
  } else {
    const last3Sessions = lastNSessionsTurns(turns, 3);
    const adultPresent = last3Sessions.filter(
      (t) => t.report.adultSelfPresent === true,
    ).length;
    const ratio = adultPresent / last3Sessions.length;
    if (ratio < 0.7) reasons.push('adult_self_below_70_percent_across_last_3_sessions');
  }
  return reasons.length === 0 ? pass() : fail(...reasons);
}

// ---------------------------------------------------------------------------
// Stage 7 — Sensing the New Identity
// ---------------------------------------------------------------------------
// Per docs/journey/07-stage-new-identity.md §10
// CRITICAL: urgency criterion is non-negotiable — even an eloquent user
// cannot advance if urgency has appeared in the recent turn window.
//
// CANON-ALIGNED (2026-06-27 audit). Before alignment:
//   - Adult Self stability across last 3 sessions was not gated. Canon §10:
//     "Adult Self stable (`adultSelfPresent: true` in ≥ 70% of turns across
//      last 3 sessions)."
//   - Safety Reorientation was checked as "at least twice in window."
//     Canon §10: "delivered at the close of every Stage 7 session (no
//     exceptions)." The looser check let a user advance with one
//     reorientation skipped — exactly the failure mode the canon names.
// This PR uses the session-aware helpers (lastNSessionsTurns / groupSessions
// / countSessions, 4-hour boundary) to enforce both canon properly.
//
// Still NOT gated (deferred):
//   - "Identity Anchor recalled at least once per session" — no per-turn
//     emit field exists yet; would require an `identityAnchorRecalled`
//     schema addition.
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

  // Canon §10: Safety Reorientation delivered in EVERY Stage 7 session
  // (no exceptions). We check that the last 2 sessions in the audit window
  // each have at least one turn with safetyReorientation: true. We pick 2
  // sessions because canon §10 elsewhere frames the urgency-window the
  // same way ("last 5 turns of the most recent 2 sessions"); requiring
  // every session forever would mean a single missed close would block
  // advancement permanently, which is not the design.
  if (countSessions(turns) < 2) {
    reasons.push('insufficient_history_for_safety_reorientation_check');
  } else {
    const sessions = groupSessions(turns);
    const last2 = sessions.slice(-2);
    const allHaveReorientation = last2.every((s) =>
      s.some((t) => t.report.safetyReorientation === true),
    );
    if (!allHaveReorientation) {
      reasons.push('safety_reorientation_missing_in_at_least_one_recent_session');
    }
  }

  // Canon §10: Adult Self present ≥ 70% of turns across the last 3 sessions.
  // Same shape as Stage 6 (same canon ratio).
  if (countSessions(turns) < 3) {
    reasons.push('insufficient_history_for_adult_self_stability');
  } else {
    const last3Sessions = lastNSessionsTurns(turns, 3);
    const adultPresent = last3Sessions.filter(
      (t) => t.report.adultSelfPresent === true,
    ).length;
    const ratio = adultPresent / last3Sessions.length;
    if (ratio < 0.7) reasons.push('adult_self_below_70_percent_across_last_3_sessions');
  }

  return reasons.length === 0 ? pass() : fail(...reasons);
}

// ---------------------------------------------------------------------------
// Stage 8 — Embodiment & Stabilisation (the Discharge gate)
// ---------------------------------------------------------------------------
// Per docs/journey/08-stage-embodiment.md §10
// Non-negotiable minimum: 6 weeks in Stage 8.
//
// CANON-ALIGNED (2026-06-27 audit). Added the Identity Reinforcement
// Check-In requirement — canon §10:
//   "The Identity Reinforcement Check-In has been completed at the start
//    of every Stage 8 session for the last 4 sessions, with the Adult
//    Self reported as 'close / steady' (not faint, not distant) in at
//    least 3 of them."
// Schema field: `adultSelfThisWeek` (string, user's words). We require it
// to be captured in EACH of the last 4 sessions (the check-in happened)
// AND ≥ 3 of those captures match /close|steady/i (the canon qualitative
// requirement). The keyword match is intentionally lenient — Russian /
// other-locale variants will land in follow-up if needed; English close /
// steady covers the AI's actual emit vocabulary today.
//
// Still NOT gated (deferred, need new schema fields):
//   - Identity Anchor used ≥ 1× / week between sessions (no per-week field)
//   - "I feel like myself, and I know how to live from here" on ≥ 2 days
//   - No active foreign material reactivation
//   - No part flagged as separate / unseen in last 4 sessions
//   - User has not pushed back at the suggestion of discharge (the
//     dischargeReadiness = 'ready' check covers this implicitly: a
//     pushed-back user won't be flagged as ready by the AI)
const STAGE_8_MIN_WEEKS = 6;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function checkStage8Gate(
  state: JourneyState,
  turns: AuditTurn[],
  stage8StartedAt: Date,
): GateResult {
  // Stage 8 expects the AI to emit `recommendedAction: 'discharge'`, not
  // 'advance'. The previous standardGuards default forced 'advance' which
  // made the gate unreachable — the router checks the gate first, then
  // the action, so the gate is consulted with whatever the AI emitted.
  const reasons = standardGuards(state, turns, 10, 'discharge');
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

  // Canon §10 — Identity Reinforcement Check-In:
  //   - Completed at start of every session for the last 4 sessions
  //     (each of those 4 sessions has at least one turn with
  //     adultSelfThisWeek captured).
  //   - At least 3 of those 4 captures report the Adult Self as "close"
  //     or "steady" (substring match on the user's reported text).
  if (countSessions(turns) < 4) {
    reasons.push('insufficient_history_for_identity_reinforcement_check_in');
  } else {
    const sessions = groupSessions(turns);
    const last4 = sessions.slice(-4);
    const captures: string[] = [];
    for (const s of last4) {
      const cap = s
        .map((t) => t.report.adultSelfThisWeek)
        .find((v) => typeof v === 'string' && v.length > 0);
      if (cap == null) {
        // Missing in this session — gate fails the per-session requirement.
        reasons.push('identity_reinforcement_check_in_missing_in_recent_session');
        break;
      }
      captures.push(cap);
    }
    if (captures.length === last4.length) {
      const closeOrSteady = captures.filter((c) => /close|steady/i.test(c)).length;
      if (closeOrSteady < 3) {
        reasons.push('adult_self_not_close_or_steady_in_three_of_last_four_sessions');
      }
    }
  }

  return reasons.length === 0 ? pass() : fail(...reasons);
}

// ---------------------------------------------------------------------------
// Readiness loop (PR 3) — surface the CURRENT stage's outstanding completion
// criteria back to the AI, in plain clinical language, so it can steer toward
// them each turn instead of circling. This runs the same gate the router runs,
// but read-only: it maps the failing reason codes to human-readable milestones.
//
// The code gate stays the sole authority on advancement. This surface is a
// mirror of it, not a second gate. Two classes of reason are NOT surfaced:
//   - advisory/procedural (this turn's own recommendedAction; needing more
//     history/time) — nothing the AI can DO about them this turn;
//   - settledness (intensity/safety windows) — the AI reads the user's state
//     directly and shouldn't chase a number.
// Keep CRITERION_TEXT keys in sync with the reason codes pushed above.
// ---------------------------------------------------------------------------

const ADVISORY_REASON_CODES = new Set<string>([
  'frozen_for_review',
  'insufficient_intensity_history',
  'recent_intensity_above_5',
  'red_flag_in_last_3_turns',
  'ai_did_not_recommend_advance',
  'ai_did_not_recommend_discharge',
  'insufficient_history_for_adult_self_stability',
  'insufficient_history_for_safety_reorientation_check',
  'insufficient_history_for_identity_reinforcement_check_in',
  'stage_8_min_6_weeks_not_elapsed',
]);

// safety_not_clean_for_last_<N>_turns is dynamic (N varies by stage); matched
// by prefix so every variant is treated as advisory/settledness.
const SAFETY_WINDOW_PREFIX = 'safety_not_clean_for_last_';

const CRITERION_TEXT: Record<string, string> = {
  // Stage 1
  anchor_not_set:
    'A Personal Anchor is captured — a real, specific safe place or image in the user’s own words.',
  anchor_identified_token_missing:
    'The Personal Anchor has actually been identified WITH the user (not just mentioned).',
  no_emotion_or_body_state_named:
    'The user has named one emotion, or located one body-state, in their own words.',
  orientation_not_present:
    'The user is oriented to what this space is and how it works.',
  // Stages 2–6 (anchor still accessible)
  anchor_missing: 'The Personal Anchor is still accessible to the user.',
  // Stage 2
  emotion_not_named: 'At least one emotion named by the user in their own words.',
  emotion_not_located_in_body: 'That emotion located as a felt sense in the body.',
  soft_why_not_asked_or_answered:
    'The Soft Why has been asked and the user has responded (“I don’t know” counts).',
  // Stage 3
  observer_seat_not_touched:
    'The user has touched the observer seat — seeing their experience from a small step back.',
  adult_self_qualities_not_captured:
    'The user has described the steadier adult presence in their own words.',
  adult_self_not_reproducible_across_days:
    'The adult presence has been reachable on at least two different days.',
  adult_self_not_linked_to_anchor:
    'The adult presence has been linked to the Personal Anchor at least once.',
  emotion_not_held_in_adult_self:
    'The user has held a named emotion inside that adult presence at least once.',
  // Stage 4 (MII)
  mii1_adult_self_unstable:
    'The adult presence is steady — present across most of the recent turns.',
  mii2_no_parts_recognised: 'At least one inner part has been clearly recognised.',
  mii3_recent_overwhelm:
    'Recent deep contact has stayed within the window (no overwhelm).',
  mii4_compassion_bridge_not_landed_twice:
    'A compassion bridge to a part has landed on two different days.',
  mii5_no_reparenting_capacity:
    'The adult presence has offered something to a part (a soothing word, a resting place).',
  mii6_destabilised: 'No delayed destabilisation after recent deep contact.',
  mii7_cohesion_awareness_missing:
    'The user has sensed inner cohesion on two different days.',
  // Stage 5
  no_foreign_material_identified:
    'At least one piece of foreign material has been identified.',
  no_symbolic_return_completed: 'A Symbolic Return of the burden has been carried out.',
  somatic_release_not_confirmed:
    'The release was confirmed in the body, not only in words.',
  clean_identity_statement_missing:
    'A Clean Identity Statement (what is mine / what is not) has been spoken.',
  clean_identity_statement_not_body_confirmed:
    'That statement was confirmed as a felt sense in the body.',
  // Stage 6
  identity_anchor_not_set: 'A small, portable Identity Anchor has been established.',
  internal_consensus_not_reached_on_two_days:
    'Internal consensus reached on two different days.',
  no_parts_in_landscape_for_cohesion_check:
    'There are parts in the landscape to check cohesion across.',
  self_loyalty_statement_missing:
    'A Self-Loyalty commitment has been spoken in the user’s words.',
  one_small_action_missing: 'One small, concrete action has been committed to.',
  adult_self_below_70_percent_across_last_3_sessions:
    'The adult presence has stayed steady across the last few sessions.',
  // Stage 7
  identity_anchor_missing: 'The Identity Anchor is established and accessible.',
  symbolic_identity_map_missing:
    'A symbolic map of the new identity has been captured.',
  fewer_than_three_emerging_qualities:
    'At least three emerging qualities have surfaced.',
  qualities_not_captured_across_two_days:
    'Those qualities have appeared across two different days.',
  inner_direction_missing:
    'An inner direction (a felt orientation, not a plan) has been articulated.',
  urgency_present_in_recent_turns:
    'No urgency to make big external changes in recent turns.',
  safety_reorientation_missing_in_at_least_one_recent_session:
    'Safety Reorientation delivered at the close of every recent session.',
  // Stage 8
  cal_sessions_under_six:
    'At least six CAL practice sessions across different real moments.',
  cal_layer_2_or_3_under_three:
    'At least three of those reached redirection (Layer 2–3).',
  urgency_in_recent_two_weeks:
    'No urgency to make big external changes recently.',
  discharge_readiness_not_signalled_twice:
    'The user has been assessed as genuinely ready for discharge more than once.',
  identity_reinforcement_check_in_missing_in_recent_session:
    'The Identity Reinforcement Check-In has opened each recent session.',
  adult_self_not_close_or_steady_in_three_of_last_four_sessions:
    'The adult presence has been close / steady in most recent sessions.',
};

function humaniseReason(code: string): string {
  const s = code.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Run the current stage's gate read-only (no side effects). */
function readonlyStageGate(
  stage: number,
  state: JourneyState,
  turns: AuditTurn[],
): GateResult {
  switch (stage) {
    case 1: return checkStage1Gate(state, turns);
    case 2: return checkStage2Gate(state, turns);
    case 3: return checkStage3Gate(state, turns);
    case 4: return checkStage4Gate(state, turns);
    case 5: return checkStage5Gate(state, turns);
    case 6: return checkStage6Gate(state, turns);
    case 7: return checkStage7Gate(state, turns);
    // Stage 8's weeks check needs a start date, but the weeks reason is
    // advisory (dropped below), so state.startedAt is a safe stand-in here.
    case 8: return checkStage8Gate(state, turns, state.startedAt);
    default: return { passed: false, reasons: [] };
  }
}

/**
 * The CURRENT stage's outstanding completion criteria, as plain-language
 * milestones the AI can work toward, with advisory/settledness reasons
 * filtered out. Returns [] when every tracked content criterion is met (the
 * caller renders an "you may recommend advancing if the user is steady"
 * nudge). Pure — safe to call before the turn's own report exists.
 */
export function outstandingStageCriteria(
  stage: number,
  state: JourneyState,
  turns: AuditTurn[],
): string[] {
  const gate = readonlyStageGate(stage, state, turns);
  const out: string[] = [];
  for (const code of gate.reasons) {
    if (ADVISORY_REASON_CODES.has(code)) continue;
    if (code.startsWith(SAFETY_WINDOW_PREFIX)) continue;
    const text = CRITERION_TEXT[code] ?? humaniseReason(code);
    if (!out.includes(text)) out.push(text);
  }
  return out;
}
