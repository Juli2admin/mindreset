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
  // foreign file. Code marks releasedAt on the matching JourneyForeignFile row.
  foreignFileReleased?: {
    description: string;     // user's exact words — matches an existing JourneyForeignFile
    returnedTo?: string;     // user's exact words
    honouringPhrase?: string;// user's exact words
    whatStaysAsMine?: string;// user's exact words
  };

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
  // Stage 4 — Compassion Bridge §8.2 timestamp of the bridge moment.
  // Captured when one of the four allowed qualities lands. Used by the
  // gate to verify the bridge held across two distinct days (canon §10).
  bridgeAchievedAt?: string; // ISO timestamp
  // Stage 4 — Securing the Part §8.3 close-of-session ritual marker.
  // userGrounded: true when the closing return-to-anchor has landed
  // and the user is verifiably grounded before session end. Canon §10
  // requires this for every Stage 4 session close.
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
    /** User's reported stability, 1 (overwhelmed) to 10 (fully grounded). */
    score: number;
    /**
     * Brief reason / context. Suggested values:
     *   "before_close"           — asking before session pause/close
     *   "after_destabilisation"  — asking after a wobble in-session
     *   "periodic"               — proactive check during deep work
     *   free text up to 80 chars also accepted (truncated by parser)
     */
    contextNote?: string;
  };

  // Rolling continuity for cross-session
  continuityNote?: string; // 2–4 sentences the AI writes for itself

  // Raw shape if parse partially failed
  _raw?: string;
};
