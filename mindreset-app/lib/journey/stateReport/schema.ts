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

  // Stage-specific captures (named per the specs)
  anchorIdentified?: string; // Stage 1 — set once
  identityAnchor?: string; // Stage 6
  observerSeatTouched?: boolean; // Stage 3
  adultSelfQualities?: string; // Stage 3
  compassionBridgeQuality?: CompassionBridgeQuality; // Stage 4 — MII-4
  cohesionAwareness?: string; // Stage 4 — MII-7
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
