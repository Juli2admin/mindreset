// The hidden JSON state report the AI emits after every turn.
// Schema is documented in Shared Core §9 + each stage spec.
// Never shown to the user. Code parses and acts on it.

import type {
  JourneyChannel,
  JourneyDepth,
  SafetyFlag,
  RecommendedAction,
  CompassionBridgeQuality,
} from '../state/types';

// Journey polish PR 4a (2026-07-04). Canonical clinical-move vocabulary
// extracted from the 8 stage docs + Shared Core + PRACTICE_GENERATION_ALGORITHM.md
// and the master prompt. Each ID names a discrete clinical move the AI can
// perform in a turn. The LLM emits `moveJustPerformed` in the state report
// as an array of 1-3 of these IDs (primary first). The move-based advance
// lane reads this field (move-based-advance.ts) — PR 4b wired it into stage
// advancement.
//
// Rules the LLM must follow (enforced or normalised by the parser):
//   - 1..3 IDs per turn, primary first (slice caps at 3).
//   - universal.none is used ONLY when the turn contained no clinical
//     move (pure witness, small talk, conversation) — and it MUST NOT be
//     combined with other IDs. Parser strips other IDs if none is present.
//   - Unknown IDs are silently dropped (fail-soft; the router doesn't
//     read this yet so a mistake here is a data-collection nit, not a
//     clinical error).
//
// Vocabulary chosen with owner sign-off 2026-07-04:
//   16 universal moves (any stage) + 22 stage-scoped moves = 38 total.
//   safety_reorientation and post_deep_check_in promoted from stage-scoped
//   to universal because they cross ≥2 stages in the docs.
export const CANONICAL_MOVES = [
  // Universal — apply at any stage
  'universal.none',
  'universal.session_open',
  'universal.witness_and_reflect',
  'universal.anchor_recall',
  'universal.practice_regulation',
  'universal.practice_somatic',
  'universal.practice_landscape',
  'universal.practice_narrative',
  'universal.practice_compassion',
  'universal.stability_check',
  'universal.modality_switch',
  'universal.safety_reorientation',
  'universal.post_deep_check_in',
  'universal.session_close',
  'universal.red_flag_response',
  'universal.rupture_receive',
  // Middle Layer PR 5 (2026-08-14) — the six investigative moves of
  // MIDDLE_LAYER.md §2. Each investigative turn does exactly one of these.
  //
  // Deliberately `universal.*`: investigation is not a stage, and
  // move-based-advance.ts counts only `stage_N.*` moves toward
  // advancement. Naming what you are investigating with must never, by
  // itself, push a user through a stage.
  'universal.investigate_gather',
  'universal.investigate_deepen',
  'universal.investigate_compare',
  'universal.investigate_discriminate',
  'universal.investigate_check',
  'universal.investigate_hold',
  // Stage 1 — Stabilisation
  'stage_1.assessment_gather',
  'stage_1.anchor_capture',
  'stage_1.formulation_share_back',
  // Stage 2 — Pain
  'stage_2.affect_labelling_and_somatic_mapping',
  'stage_2.soft_why_inquiry',
  // Stage 3 — Adult Self
  'stage_3.observer_seat',
  'stage_3.adult_self_cocreation',
  // Stage 4 — Parts
  'stage_4.first_contact',
  'stage_4.compassion_bridge',
  'stage_4.reparenting_offering',
  'stage_4.securing_the_part',
  // Stage 5 — Foreign Material
  'stage_5.origin_voice_mapping',
  'stage_5.symbolic_return',
  'stage_5.clean_identity_statement',
  // Stage 6 — Integration
  'stage_6.internal_consensus_check',
  'stage_6.identity_anchoring_ritual',
  'stage_6.self_loyalty_commitment',
  // Stage 7 — New Identity
  'stage_7.qualities_inventory',
  'stage_7.symbolic_identity_map',
  // Stage 8 — Embodiment
  'stage_8.cal_run',
  'stage_8.identity_reinforcement_check_in',
  'stage_8.discharge_protocol',
] as const;

export type CanonicalMove = (typeof CANONICAL_MOVES)[number];
export const CANONICAL_MOVES_SET: ReadonlySet<string> = new Set(CANONICAL_MOVES);
export const MOVE_NONE: CanonicalMove = 'universal.none';
export const MAX_MOVES_PER_TURN = 3;

// Therapeutic Sensitivity Layer — PR α (2026-07-09).
//
// Structured fields the AI emits after silently reasoning through the 5
// clinical questions in an <assessment>...</assessment> block that
// precedes the reply. Data collection for now — no code enforcement in
// this PR. Future PRs (β, γ) will use these fields to (a) surface open
// cycles across sessions, (b) refuse close-adjacent replies when
// cycleStatus is open + stabilityCheck.score < 6, (c) block repeated
// use of a rejected modality.
//
// Enums intentionally match Julia's spec verbatim so we can trace
// design decisions back to the source document.
export const THERAPEUTIC_MODES = [
  'imagery',
  'somatic',
  'emotional_discharge',
  'cognitive',
  'parts_work',
  'integration',
  'stabilisation',
  'closure',
] as const;
export type TherapeuticMode = (typeof THERAPEUTIC_MODES)[number];

// Middle Layer PR 2 (2026-08-13). Evidentiary provenance of a pattern claim.
//
//   user      — the user said it, unprompted, in their own words
//   elicited  — the clinician offered it and the user confirmed or corrected it
//   clinician — the clinician supplied it; the user has not confirmed it
//
// Deliberately has NO 'unknown' member. Absence *is* unknown, represented by
// the field being absent and the DB column being NULL — so no value in this
// union can ever be mistaken for a positive claim, and an absent provenance
// can never be silently coerced into 'user'.
//
// Representation only: nothing consumes this for gating yet (Middle Layer
// PR 2 is a no-behaviour-change PR). See docs/journey/MIDDLE_LAYER.md §1(4).
export const PATTERN_PROVENANCES = ['user', 'elicited', 'clinician'] as const;
export type PatternProvenance = (typeof PATTERN_PROVENANCES)[number];
export const PATTERN_PROVENANCE_SET: ReadonlySet<string> = new Set(
  PATTERN_PROVENANCES,
);

export const MODALITIES_REJECTED = [
  'body',
  'imagery',
  'breathing',
  'grounding',
  'none',
] as const;
export type ModalityRejected = (typeof MODALITIES_REJECTED)[number];

export const CYCLE_STATUSES = ['open', 'closing', 'closed'] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const NEXT_BEST_MODES = [
  'continue_imagery',
  'switch_to_somatic',
  'switch_to_imagery',
  'use_narrative',
  'use_compassion',
  'allow_discharge',
  'integrate',
  'stabilise',
  'close',
] as const;
export type NextBestMode = (typeof NEXT_BEST_MODES)[number];

// Journey P3 (2026-07-19, audit RC2) — lightweight session task contract,
// inferred from the user's own language. presentingRequest is the original
// ask; currentFocus tracks where the work actually is right now (emerging
// material may become the focus WITHOUT silently replacing the presenting
// request). All fields optional per turn — the save layer merges field-wise
// and never lets an empty/generic emission erase a valid value.
export type TaskContract = {
  presentingRequest?: string; // what the user is asking for — their words
  expectedHelp?: string; // what they expect from this conversation
  currentFocus?: string; // where the work actually is right now
  completionCriterion?: string; // what "addressed" would look like — their words

  // ---- Middle Layer PR 3 (2026-08-13) — representation only ----
  // Both fields below are OPTIONAL and are read by NOTHING: no gate, no
  // router, no depth, no rung, no state block. They are stored so that a
  // later PR can validate them. Their presence must never change any
  // runtime behaviour, which is why the state-block renderer gates on the
  // legacy fields alone (see prompts/assemble.ts).
  target?: TherapeuticTarget;
  mechanismDifferential?: MechanismCandidate[];
};

// Middle Layer PR 3 (2026-08-13) — the epistemic ladder of
// docs/journey/MIDDLE_LAYER.md §1, minus its top rung.
//
//   observation          — noticed once; most observations should lapse
//   hypothesis           — a candidate explanation, living in a differential
//   working_formulation  — the leading explanation, promoted under §1's four
//                          conditions
//
// THERAPEUTIC TARGET is deliberately NOT a member. In the canon it is the
// ladder's top rung, but it is a rung for the *pattern*, not for a causal
// reading (§3b, §4.4) — so a mechanism candidate can never legally hold it,
// and giving the enum a value no mechanism may take would invite exactly the
// welding of cause into Target that §4.4 was rewritten to prevent.
export const EPISTEMIC_LEVELS = [
  'observation',
  'hypothesis',
  'working_formulation',
] as const;
export type EpistemicLevel = (typeof EPISTEMIC_LEVELS)[number];
export const EPISTEMIC_LEVEL_SET: ReadonlySet<string> = new Set(EPISTEMIC_LEVELS);

// Middle Layer PR 3 — how settled the Target is, AS SELF-REPORTED by the
// clinician. NOT authoritative, and nothing derives permission from it.
//
//   proposed — offered, not yet recognised by the user in their own terms
//   held     — the user has recognised the core as theirs
//
// Target *sufficiency* (§3a) is a separate, derived judgement that this
// field does not and must not stand in for: a model that emits
// status:'held' has claimed something, not established it. The validator
// that decides whether the claim is earned arrives in PR 4.
export const TARGET_STATUSES = ['proposed', 'held'] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];
export const TARGET_STATUS_SET: ReadonlySet<string> = new Set(TARGET_STATUSES);

// Middle Layer PR 3 — a Therapeutic Target (docs/journey/MIDDLE_LAYER.md §4).
// "A statement, not a category" — mechanism-free, four parts. Every part is
// optional here because this is a representation of work in progress: a
// partially assembled Target is the normal mid-investigation state, and the
// shape must be able to hold it without either lying or refusing it.
//
// The mechanism deliberately does NOT live here. §4.4 was re-scoped to the
// pattern level precisely so the causal explanation stays out of the Target;
// it lives in mechanismDifferential, beside this, never inside it.
export type TherapeuticTarget = {
  /** §4.1 — the phenomenon: a specific, present-tense thing that happens. */
  phenomenon?: string;
  /** §4.2 — in their terms: the user's own words for the core of it. */
  inTheirTerms?: string;
  /** §4.3 — the direction: what the user wants to be different. */
  direction?: string;
  /**
   * §4.4 — corroboration: the independent sources establishing the pattern
   * as recurring and real. A list because §1's standard is explicitly that
   * one vivid instance is not enough, however striking.
   */
  corroboration?: string[];
  /** Where the Target's core claim came from. Shares PR 2's union. */
  provenance?: PatternProvenance;
  /** Self-reported settledness. Not authoritative — see TARGET_STATUSES. */
  status?: TargetStatus;
};

// Middle Layer PR 3 — one member of the mechanism differential
// (docs/journey/MIDDLE_LAYER.md §1 HYPOTHESIS, §3b, §5.1).
//
// The differential holds the realistic competing causal readings, MindReset
// and ordinary alike — "she was a prospective employer" is a legitimate
// member. `reading` is the only required field: a candidate that cannot be
// stated is not a candidate.
export type MechanismCandidate = {
  /** The causal reading itself, in one statement. */
  reading: string;
  /** §1 — what supports this reading. Scratchpad; licenses nothing. */
  supports?: string[];
  /**
   * §1(3) — Middle Layer PR 4b. Corroborating INSTANCE KEYS, each resolved
   * by code against a user-confirmed `instance` exchange. Not free evidence
   * text: a key that resolves to nothing earns nothing, because only the
   * user can say two instances are distinct (owner decision 3).
   */
  corroboration?: string[];
  /**
   * §1 — what counts against this reading. Evidence already in hand, not
   * the prospective test; the question that would discriminate is §2's
   * DISCRIMINATE move and is not represented here.
   */
  countsAgainst?: string[];
  /** Where this candidate sits on the ladder. Self-reported, not derived. */
  level?: EpistemicLevel;
  /** Where the reading came from. Shares PR 2's union. */
  provenance?: PatternProvenance;
};

export type PracticeFamily =
  | 'regulation'
  | 'somatic'
  | 'landscape'
  | 'narrative'
  | 'compassion'
  | 'none';

export type PracticeRunStatus =
  | 'started'
  | 'mid'
  | 'completed'
  | 'aborted_user_request'
  | 'aborted_overwhelm';

export type PracticeRun = {
  kind: 'canonical' | 'generated' | 'none';
  name?: string;
  family?: PracticeFamily;
  triggeredBy?: string;
  userImages?: string;
  depth?: JourneyDepth;
  status: PracticeRunStatus;
  modalitySwitched?: { from: string; to: string };
};

// Full state report — most fields optional, only the safety-critical core
// is required. Fail-safe defaults applied where missing (see parse.ts).
export type StateReport = {
  // Required (with defaults if absent)
  intensity: number; // 0..10
  safetyFlag: SafetyFlag;
  recommendedAction: RecommendedAction;

  // Common operational fields
  channel?: JourneyChannel;
  adultSelfPresent?: boolean;
  readinessTouched?: string[];
  redFlagType?: string;

  // Practice running
  practiceRun?: PracticeRun;

  // Landscape additions (the AI surfaces these for code to persist)
  userImagesCaptured?: string[];
  partsTouched?: Array<{
    description: string;
    channel?: JourneyChannel;
    safeDistance?: string;
  }>;
  foreignFilesTouched?: Array<{ description: string }>;

  // Journey polish PR 5 (2026-07-04). Structural storage for unresolved
  // psychological patterns — "working notes, not diagnosis." The AI emits
  // one entry per pattern it noticed this turn; the save layer upserts
  // to JourneyPattern rows keyed by (userId, category). category is a
  // snake_case identifier the AI invents (fear_of_visibility, mother_voice,
  // money_shame, body_shame, self_abandonment, not_allowed_to_want, etc.);
  // owner decision was to keep it free-string for now and let the taxonomy
  // emerge from real usage. description is the user's exact words. context
  // is an optional structured JSON blob (e.g. { ageTag: 9 } for inner-child
  // variants); parser normalises to a plain object.
  patternsTouched?: Array<{
    category: string;
    description: string;
    context?: Record<string, unknown>;
    /**
     * Middle Layer PR 2 — evidentiary provenance. Optional; absent means
     * unknown, and unknown earns NO evidentiary credit. Never defaulted.
     */
    provenance?: PatternProvenance;
  }>;

  // Landscape updates (mutate existing rows rather than insert new ones)
  // Stage 4 MII-5 — the Adult Self's offering / part's resting place. The AI
  // emits this when the Adult Self has given something to a known part
  // (a soothing phrase, a gesture, an intention to protect, a resting place).
  partSecured?: {
    partDescription: string; // user's exact words for which part — matches an existing JourneyPart
    restingPlace?: string;   // user's exact words for where the part now rests
    adultSelfOffering?: string; // user's exact words for what the Adult Self offered
  };
  // Stage 5 — Symbolic Return of the Burden. Released a previously-identified
  // foreign file. Journey P1 (2026-07-19, audit A8): this emission is a
  // PROVISIONAL claim — code stamps releaseClaimedAt, NOT releasedAt. The
  // release becomes confirmed (releasedAt — what the Stage 5 gate counts)
  // only via releaseConfirmed below, on a later turn.
  foreignFileReleased?: {
    description: string;     // user's exact words — matches an existing JourneyForeignFile
    returnedTo?: string;     // user's exact words
    honouringPhrase?: string;// user's exact words
    whatStaysAsMine?: string;// user's exact words
  };
  // Journey P1 (2026-07-19, audit A8/B6) — release confirmation and
  // invalidation. releaseConfirmed: emit ONLY when the user has confirmed
  // the release held across time (relief persisted, stable check-in) —
  // never on the same turn as the release itself; code also enforces the
  // same-turn rule. releaseInvalidated: emit the moment the user's response
  // contradicts a claimed or confirmed release (feels worse, material
  // reactivated) — code reopens the file (clears claim + confirmation) so
  // the next user response can always invalidate the release hypothesis.
  releaseConfirmed?: { description: string };
  releaseInvalidated?: { description: string; reason?: string };

  // ---- Middle Layer PR 4b (2026-08-13) — evidence exchanges ----
  // Seven emissions, three lifecycles, all mirroring the release trio above:
  // the model OFFERS, and only a LATER turn can confirm or contradict. Every
  // one of these is a CLAIM. The code-stamped outcome in
  // JourneyEvidenceExchange is the finding.
  //
  // The model must never emit offeredAt / confirmedAt / contradictedAt —
  // the parser strips them if it tries. That strip is the integrity boundary
  // of the whole Middle Layer gate.
  //
  // §1(2) — a causal reading put to the user, and what came back.
  mechanismOffered?: { reading: string };
  mechanismConfirmed?: { reading: string };
  mechanismContradicted?: { reading: string };
  // §1(3) — a corroborating instance put to the user AS DISTINCT from the
  // others. Code cannot tell one life episode from two (owner decision 3);
  // only the user can, so only the user's confirmation counts one.
  instanceOffered?: { instance: string };
  instanceConfirmed?: { instance: string };
  // §4.2 — the Target's wording put to the user as theirs. Recognition is
  // CONSTITUTIVE here, not evidential: a Target the user recognises as
  // theirs IS in their terms. recognitionContradicted covers rejection,
  // correction and narrowing alike — all three require the same fresh
  // recognition, so code never has to tell them apart (owner ruling,
  // 2026-08-13).
  recognitionOffered?: { recognition: string };
  recognitionConfirmed?: { recognition: string };
  recognitionContradicted?: { recognition: string };

  // Stage-specific captures (named per the specs)
  anchorIdentified?: string; // Stage 1 — set once
  identityAnchor?: string; // Stage 6
  observerSeatTouched?: boolean; // Stage 3
  adultSelfQualities?: string; // Stage 3
  // Stage 3 — Adult Self Co-Creation §8.2 captures.
  // adultSelfAnchorLinked: true when the Adult Self has been linked to
  // the Stage 1 Personal Anchor in the user's felt experience (the
  // pairing canon §10 calls "permanent"). heldEmotionInAdultSelf: true
  // when an emotion identified in Stage 2 has been held / met inside
  // the Adult Self's capacity (the test of MII-1 readiness).
  adultSelfAnchorLinked?: boolean;
  heldEmotionInAdultSelf?: boolean;
  compassionBridgeQuality?: CompassionBridgeQuality; // Stage 4 — MII-4
  // Stage 4 — Compassion Bridge §8.2 timestamp of the bridge moment,
  // captured when one of the four allowed qualities lands. Audit/telemetry
  // only — no gate reads this (Stage 4 MII-4 gates on compassionBridgeQuality
  // across two distinct days, not on this timestamp).
  bridgeAchievedAt?: string; // ISO timestamp
  // Stage 4 — Securing the Part §8.3 close-of-session ritual marker.
  // userGrounded: true when the closing return-to-anchor has landed. Audit/
  // telemetry only — no gate reads this.
  userGrounded?: boolean;
  cohesionAwareness?: string; // Stage 4 — MII-7
  // Stage 4 — MII-6, the 48-hour soft check-in result. The AI emits this
  // ONLY when the soft check-in instruction was injected this turn (i.e.
  // a Deep Layer practice ran last session). `stable` = nothing unusual
  // surfaced. `destabilised` = real settling difficulty (sleep, intrusive
  // material, distress beyond baseline) — fails the MII-6 gate so the
  // Stage 4→5 advance is held. `destabilised_then_recovered` = the user
  // had a wobble but is grounded now — counts as met. `unsure` = code
  // logs but does not fail the gate.
  mii6Check?: 'stable' | 'destabilised' | 'unsure' | 'destabilised_then_recovered';
  // Stage 5 — Origin Voice Mapping §8.1 captures the user's identification
  // of the origin of the foreign material in their own words ("my mother",
  // "the boys at school", "the man who taught me at fifteen"). Distinct
  // from foreignFileReleased.returnedTo, which is the destination of the
  // symbolic return practice.
  originIdentified?: string;
  // Stage 5 — Symbolic Return of the Burden §8.2 body confirmation that
  // the release landed somatically (not just verbally). Per canon §10,
  // somaticRelease: true is required for the stage-close gate. The AI
  // sets this when the user describes a clear body change after release
  // (lighter, more room, settled, an exhale that landed).
  somaticRelease?: boolean;
  // Stage 5 — Clean Identity Statement §8.3 body sense after the both-
  // halves statement has been spoken. The AI captures the user's own
  // words for the felt sense after declaring what stays and what was
  // released. Confirms the statement landed in the body, not only the head.
  bodyConfirmation?: string;
  cleanIdentityStatement?: string; // Stage 5
  whatStaysAsMine?: string; // Stage 5 / 6
  // Stage 6 — Internal Consensus Check verdict for this turn. Per
  // 06-stage-integration.md §10, advancement requires this to be true
  // on at least two different days. The AI sets `true` only after
  // running the four cohesion questions (§8.1) and the user has
  // confirmed all parts present, aligned with the Adult Self, and not
  // in conflict. False / unset = consensus not reached this turn.
  internalConsensus?: boolean;
  // Stage 6 — Self-Loyalty Commitment §8.3. The user's own words for
  // their commitment to themselves at the close of Stage 6, plus one
  // concrete small action they will carry. Canon §10 requires both to
  // be set for the Stage 6 → 7 advancement.
  selfLoyaltyStatement?: string;
  oneSmallAction?: string;
  symbolicIdentityMap?: string; // Stage 7
  emergingQualities?: string[]; // Stage 7
  innerDirection?: string; // Stage 7
  urgencyMarkers?: 'present' | 'absent'; // Stage 7
  // Stage 7 — Safety Reorientation §8.3 mandatory session-close ritual.
  // Canon §10 names this as "the mandatory closing practice of every
  // Stage 7 session." The AI sets `true` only when the reorientation has
  // been delivered ("we're not making any major external decisions from
  // here — months, not days"). Without this, the Stage 7 → 8 advancement
  // is held.
  safetyReorientation?: boolean;
  calRunOn?: string; // Stage 8
  calLayer?: 1 | 2 | 3; // Stage 8 TLSM
  userReportedRedirection?: boolean | 'partial'; // Stage 8
  adultSelfThisWeek?: string; // Stage 8 — Identity Reinforcement Check-In
  feltAligned?: string[]; // Stage 8
  feltOld?: string[]; // Stage 8
  // Stage 8 — Discharge Protocol §8.3 readiness signal. The AI assesses
  // whether the user is genuinely ready for discharge per the canonical
  // 6-step protocol criteria. `not_ready` and `maybe` keep the user in
  // Stage 8. `ready` is required (with the router's own discharge gate)
  // before `recommendedAction: "discharge"` is honoured.
  dischargeReadiness?: 'not_ready' | 'maybe' | 'ready';

  // Stabilising-before-closing protocol (PR 8, 2026-06-26).
  // The AI emits this when it runs an explicit 1-10 stability check on
  // the user — typically before a session pause/close, after destabil-
  // isation in-session, or periodically when the user has been in the
  // body for a sustained period. The check is mandated by the master
  // prompt's stabilising-before-closing rule: "the number is the
  // discipline. 'Are you OK?' / 'Is the dizziness easing?' is not
  // enough." A score below 6 means the AI must NOT close on this turn
  // and must run another grounding/micro-movement practice before
  // asking again.
  stabilityCheck?: {
    /**
     * STABILITY scale — 1 = overwhelmed / ungrounded, 10 = fully grounded.
     * HIGH IS GOOD. This is the INVERSE of `intensity` (distress), where
     * high is bad. Never copy an unqualified user number into this field:
     * users usually volunteer a DISTRESS number ("it's an 8", "down to a
     * 3"). See `distressIntensity` for that, and `scale` below.
     */
    score: number;
    /**
     * Which scale the number was actually given on. Repair 2026-07-28:
     * validation found panic recorded as stability 9 and calm recorded as
     * stability 3 — the model was copying distress numbers verbatim.
     *   'stability'  — the user answered the explicit stability question
     *                  ("10 = fully grounded"); closure-valid.
     *   'ambiguous'  — a number was given but the scale was not
     *                  established; NOT closure-valid, must be clarified.
     * Absent (legacy rows written before this repair) is treated as
     * 'ambiguous' by the closure guard — never as a validated reading.
     */
    scale?: 'stability' | 'ambiguous';
    /** Who produced the number. */
    source?: 'user_reported' | 'clinician_assessed';
    /**
     * UNTRUSTED — model-supplied. Repair A1 (2026-07-28): this is whatever
     * the model wrote in its JSON. It is never the basis on which a closure
     * is validated; it can only make the closure guard STRICTER (a claim
     * that predates the destabilisation, sits in the future, or is far
     * older than this turn is treated as evidence against the closure).
     * See `observedAt` for the trusted ordering timestamp.
     */
    measuredAt?: string;
    /**
     * TRUSTED — server-assigned. Stamped by `parseStateReport` at the moment
     * the runtime read this report, from the server clock. The model cannot
     * influence it. The closure guard uses THIS for ordering against the
     * destabilisation turn's server `createdAt`.
     */
    observedAt?: string;
    /**
     * True when the model supplied a `measuredAt` that was not a parseable
     * date. Recorded so a malformed claim is visible in the Inspector rather
     * than silently indistinguishable from "no claim".
     */
    measuredAtRejected?: boolean;
    /**
     * Brief reason / context. Suggested values:
     *   "before_close"           — asking before session pause/close
     *   "after_destabilisation"  — asking after a wobble in-session
     *   "periodic"               — proactive check during deep work
     *   free text up to 80 chars also accepted (truncated by parser)
     */
    contextNote?: string;
  };

  /**
   * DISTRESS scale — 1 = minimal distress, 10 = extreme distress.
   * HIGH IS BAD. This is where a volunteered user number ("it's an 8")
   * belongs. Distinct from `intensity` (the clinician's own 0–10 read):
   * this field records an explicitly-scaled distress measurement and its
   * provenance. It is NEVER closure-valid on its own — distress and
   * stability are not assumed to be mathematical inverses (no 11-x).
   */
  distressIntensity?: {
    score: number;
    source?: 'user_reported' | 'clinician_inferred';
    /** UNTRUSTED — model-supplied. See stabilityCheck.measuredAt. */
    measuredAt?: string;
    /** TRUSTED — server-assigned at parse time. See stabilityCheck.observedAt. */
    observedAt?: string;
    /** True when the model supplied an unparseable `measuredAt`. */
    measuredAtRejected?: boolean;
    contextNote?: string;
  };

  /**
   * Whether the presenting request has been dealt with at close.
   * 'addressed' | 'parked' (explicitly agreed with the user) are honest
   * closures; 'unresolved' blocks a *resolved* closure record but never
   * blocks the user from leaving.
   */
  presentingRequestStatus?: 'addressed' | 'parked' | 'unresolved';

  /**
   * Result of the code-level closure guard (lib/journey/closure/guard.ts).
   * Written by the runtime, never by the model. Present only on turns
   * where a closure was claimed.
   */
  closureGate?: {
    outcome: 'not_applicable' | 'passed' | 'blocked';
    reasons: string[];
    detail: string;
    destabilisedAt: string | null;
  };

  // Journey polish PR 4a. Array of 1..3 canonical clinical-move IDs the AI
  // performed this turn, primary first. See CANONICAL_MOVES for the
  // vocabulary. Read by the move-based advance lane (move-based-advance.ts).
  moveJustPerformed?: CanonicalMove[];

  // Therapeutic Sensitivity Layer — PR α (2026-07-09).
  // The AI silently assesses these BEFORE writing its reply (enforced
  // by the <assessment>...</assessment> block that must precede the
  // reply text in the AI's output — see docs/journey/runtime/
  // journey-master.md). Data collection only in this PR — future PRs
  // will enforce protocol rules based on these fields.
  //
  // therapeuticMode: which of the 8 modes is dominant this turn.
  // channelShiftDetected: true when the AI notices the user has moved
  //   from one processing channel to another mid-session (e.g. imagery
  //   → somatic). Distinct from `channel` which only reports the
  //   current one, no history.
  // modalityRejected: the user has EXPLICITLY refused these modalities
  //   in the current session ("leave my body alone", "I can't
  //   visualise"). Empty array (or omitted) if none rejected.
  // cycleStatus: is a therapeutic work-cycle open, closing, or closed?
  //   Load-bearing for the "do not close mid-cycle" enforcement in
  //   later PRs.
  // cycleCanClose: derived boolean the AI sets to false when any of
  //   the six not-close conditions from the sensitivity layer hold.
  // nextBestMode: the AI's recommendation for its own next turn's
  //   intervention family. Advisory, not enforced.
  therapeuticMode?: TherapeuticMode;
  channelShiftDetected?: boolean;
  modalityRejected?: ModalityRejected[];
  cycleStatus?: CycleStatus;
  cycleCanClose?: boolean;
  nextBestMode?: NextBestMode;

  // The AI's internal clinical read of this turn — one or two sentences
  // capturing the working hypothesis. Referenced by the master prompt
  // and the sensitivity layer as a scratchpad for the reasoning that
  // happens in the <assessment> block. The load-side signals
  // (openCycleDescription, etc.) surface this on the next turn for
  // narrative continuity across the current session.
  //
  // Distinct from continuityNote (which is a running cross-session
  // formulation). clinicalRead is per-turn.
  clinicalRead?: string;

  // Rolling continuity for cross-session
  continuityNote?: string; // 2–4 sentences the AI writes for itself

  // Journey P3 (2026-07-19, audit RC2) — session task contract.
  // Sparse per-turn emission; merged field-wise by the save layer.
  taskContract?: TaskContract;

  // Raw shape if parse partially failed
  _raw?: string;

  /**
   * BP-D marker (2026-08-08). True when the three required fields in THIS
   * report are parser defaults rather than model output — i.e. the model
   * emitted no readable `<state-report>` at all and `parseStateReport`
   * returned its defensive default (`intensity: 5`, `safetyFlag: 'watch'`,
   * `recommendedAction: 'stay'`).
   *
   * WHY IT HAS TO BE PERSISTED, NOT RECOMPUTED. `finaliseTurn` stores
   * `JSON.stringify(report)`, so a defaulted turn is written to the audit log
   * as perfectly well-formed JSON. Re-parsing it on a later turn takes the
   * happy path and the defaults become indistinguishable from a genuine
   * clinical reading. The marker travels inside the stored blob so the
   * distinction survives; `parseStateReport` copies it back out on re-read.
   *
   * Consumers must treat a marked report's intensity/safetyFlag as ABSENT,
   * never as measurements. Underscore-prefixed like `_raw` /
   * `_deliveredBeforeFreeze`: a runtime annotation, not part of the model's
   * schema, and never emitted by the model.
   */
  _defaultedReport?: true;
};
