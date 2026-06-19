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
  compassionBridgeQuality?: CompassionBridgeQuality; // Stage 4 — MII-4
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
  cleanIdentityStatement?: string; // Stage 5
  whatStaysAsMine?: string; // Stage 5 / 6
  symbolicIdentityMap?: string; // Stage 7
  emergingQualities?: string[]; // Stage 7
  innerDirection?: string; // Stage 7
  urgencyMarkers?: 'present' | 'absent'; // Stage 7
  calRunOn?: string; // Stage 8
  calLayer?: 1 | 2 | 3; // Stage 8 TLSM
  userReportedRedirection?: boolean | 'partial'; // Stage 8
  adultSelfThisWeek?: string; // Stage 8 — Identity Reinforcement Check-In
  feltAligned?: string[]; // Stage 8
  feltOld?: string[]; // Stage 8

  // Rolling continuity for cross-session
  continuityNote?: string; // 2–4 sentences the AI writes for itself

  // Raw shape if parse partially failed
  _raw?: string;
};
