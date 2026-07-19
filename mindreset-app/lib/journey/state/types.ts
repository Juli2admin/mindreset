// TypeScript types for the persistent inner landscape of The Journey.
// These describe the *decrypted* shape in memory; storage at rest is
// encrypted per UK GDPR Article 9. See lib/encrypt.ts.

import type {
  ModalityRejected,
  TaskContract,
  WorkingPreferenceKind,
  PracticeOutcome,
} from '../stateReport/schema';

// Journey remediation 2026-07-19 — durable working preference as persisted
// (adds notedAt to the emission shape). Revisable, not a personality label.
export type StoredWorkingPreference = {
  text: string;
  kind: WorkingPreferenceKind;
  notedAt: string; // ISO timestamp
};

// Journey remediation 2026-07-19 — one line of the practice-history block
// rendered into the clinician context (derived from JourneyPracticeRun).
export type PracticeHistoryEntry = {
  name: string;
  family: string | null;
  status: string;
  outcome: PracticeOutcome | null;
  daysAgo: number;
};

export type JourneyChannel =
  | 'visual'
  | 'kinesthetic'
  | 'emotional'
  | 'cognitive'
  | 'verbal'
  | 'mixed';

export type JourneyDepth = 'surface' | 'middle' | 'deep';

export type SafetyFlag = 'none' | 'watch' | 'red_flag';

export type RecommendedAction =
  | 'stay'
  | 'advance'
  | 'regress_to_grounding'
  | 'regress_to_parts'
  | 'red_flag'
  | 'discharge';

export type CompassionBridgeQuality =
  | 'compassion'
  | 'curiosity'
  | 'acceptance'
  | 'willingness_to_comfort';

export type MiiCriterionStatus = 'met' | 'pending' | 'failed';

// The MII (MindReset Integration Index) — 7 criteria stored as one JSON blob
// on RecodeProgress.mii so they are visible in one place for clinical review.
export type MiiState = {
  mii1_adultSelfStability?: {
    status: MiiCriterionStatus;
    lastChecked?: string;
    score?: number; // 0..1
  };
  mii2_partRecognition?: {
    status: MiiCriterionStatus;
    partInUserWords?: string; // captured for review (decrypted at read time)
  };
  mii3_noOverwhelm?: {
    status: MiiCriterionStatus;
    lastOverwhelmAt?: string | null;
  };
  mii4_safeRelationship?: {
    status: MiiCriterionStatus;
    quality?: CompassionBridgeQuality;
  };
  mii5_reparentingCapacity?: {
    status: MiiCriterionStatus;
    offeringInUserWords?: string;
  };
  mii6_noDestabilisation?: {
    status: MiiCriterionStatus;
    lastCheckedAt?: string;
  };
  mii7_internalCohesion?: {
    status: MiiCriterionStatus;
    userWords?: string;
  };
};

export type JourneyPart = {
  id: string;
  userDescription: string; // decrypted
  channel: JourneyChannel | null;
  safeDistance: string | null;
  compassionBridgeQuality: CompassionBridgeQuality | null;
  currentRestingPlace: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type JourneyForeignFile = {
  id: string;
  userDescription: string; // decrypted
  originDescription: string | null;
  returnedTo: string | null;
  honouringPhrase: string | null;
  whatStaysAsMine: string | null;
  identifiedAt: Date | null;
  // Journey remediation 2026-07-19: releaseClaimedAt = provisional (AI
  // reported a release); releasedAt = confirmed by the user across time.
  releaseClaimedAt: Date | null;
  releasedAt: Date | null;
};

export type JourneySignatureImage = {
  id: string;
  userDescription: string; // decrypted
  context: string | null;
  createdAt: Date;
};

// Journey polish PR 5 (2026-07-04). Structural note the AI keeps on an
// unresolved psychological pattern — "fear_of_visibility", "mother_voice",
// "money_shame", etc. category is snake_case plaintext (safe to key on);
// userDescription is the user's exact words about the pattern (decrypted
// at read time). lastConfirmedAt bumps every time the pattern surfaces
// in a state report — PR 6 uses it to flag staleness.
//
// daysSinceLastConfirmed (Journey polish PR 6, 2026-07-04) is derived
// in load.ts from `now - lastConfirmedAt`. The state block renders a
// "— last seen N days ago" tail from 7 days onward, and a soft
// reconfirmation directive from 14 days onward when the session is
// resuming (see assemble.ts).
export type JourneyPattern = {
  id: string;
  category: string;
  userDescription: string; // decrypted
  firstObservedAt: Date;
  lastConfirmedAt: Date;
  active: boolean;
  context: Record<string, unknown> | null;
  daysSinceLastConfirmed: number;
};

export type JourneyState = {
  userId: string;
  // Stage + depth
  currentStage: number; // 1..8
  currentDepth: JourneyDepth;
  // Lifecycle
  startedAt: Date;
  lastActivityAt: Date;
  dischargedAt: Date | null;
  // Anchors + channel + Adult Self
  anchorText: string | null; // decrypted
  anchorSetAt: Date | null;
  identityAnchor: string | null; // decrypted (Stage 6+)
  identityAnchorSetAt: Date | null;
  processingChannel: JourneyChannel | null;
  adultSelfQualities: string | null; // decrypted, user's words
  // Intensity / safety / settling-time
  lastIntensity: number | null;
  lastIntensityAt: Date | null;
  lastDeepLayerContactAt: Date | null;
  // MII (7 criteria)
  mii: MiiState;
  // Stage 8
  stage8WeeksElapsed: number;
  // Frozen-for-review
  frozenForReview: boolean;
  frozenAt: Date | null;
  frozenReason: string | null;
  // Rolling 2–4 sentence continuity note (decrypted)
  continuityNote: string | null;
  // Persistent landscape
  parts: JourneyPart[];
  foreignFiles: JourneyForeignFile[];
  signatureImages: JourneySignatureImage[];
  // Journey polish PR 5 — active unresolved patterns the AI has noticed.
  // Rendered in the state block so the AI recognises them next session.
  patterns: JourneyPattern[];
  // Continuity signals (PR 5, Bundle C) — temporal context the AI needs
  // to honour the canon's "two different days" requirements and to know
  // when a stage has just advanced. All four are derived per-turn in
  // load.ts from the JourneyTurn audit log.
  //
  // sessionCount: distinct sessions to date. A new session begins when
  //   ≥ 4 hours have passed since the prior turn.
  // daysEngaged: distinct calendar dates on which the user has had any
  //   turn — informs the "two different days" reproducibility gates.
  // thisSessionMessageCount: turns in the current session (1 on first
  //   message of a session, 2 on the second, etc.).
  // stageJustAdvanced: true on the FIRST turn after the code-side stage
  //   advancement. Derived by comparing currentStage with the most recent
  //   JourneyTurn.stageAtTurn. The AI uses this to run the new stage's
  //   session-open ritual (e.g. Stage 8 Identity Reinforcement Check-In)
  //   when the gate fires.
  sessionCount: number;
  daysEngaged: number;
  thisSessionMessageCount: number;
  stageJustAdvanced: boolean;
  // Time-awareness signals (Journey polish PR 1). The prior audit-log
  // continuity fields tell the AI HOW MANY sessions / days there have
  // been; these tell it HOW MUCH TIME has passed since the last turn.
  //
  // hoursSinceLastTurn: fractional hours since the most recent
  //   JourneyTurn. null on a first-ever turn. Rendered as a coarse
  //   bucket string (see formatTimeSinceLastTurnBucket) so the model
  //   can distinguish "you came back in 2 hours" from "in 2 months"
  //   instead of fabricating.
  // isSessionResume: true when the gap exceeds SESSION_BOUNDARY_MS
  //   AND there is at least one prior turn. Gates session-open
  //   behaviours (re-anchor before deeper work). False on a first-ever
  //   turn — that's a start, not a resume.
  hoursSinceLastTurn: number | null;
  isSessionResume: boolean;

  // Therapeutic Sensitivity Layer signals — PR α (2026-07-09). Derived
  // in load.ts from the AI's own state reports across the current
  // session. Rendered in the state block so the next turn can honour
  // continuity (open cycles, refused modalities, channel shifts).
  //
  // hasOpenCycle: true if the most-recent cycleStatus in this session
  //   was 'open' or 'closing'. The AI must NOT close a session while
  //   this is true (see Sensitivity Layer §7 in journey-master.md).
  // openCycleDescription: the clinicalRead from the turn where the
  //   open cycle was last observed — brief narrative continuity.
  // sessionRejectedModalities: modalities the user has explicitly
  //   refused this session (accumulated from prior turns' modality-
  //   Rejected arrays). The AI must not re-offer these.
  // recentChannelShift: true if a channel shift was flagged in any of
  //   the last 3 turns — the AI should track whether it's stabilised or
  //   still moving.
  hasOpenCycle: boolean;
  openCycleDescription: string | null;
  sessionRejectedModalities: ModalityRejected[];
  recentChannelShift: boolean;

  // Journey remediation 2026-07-19 (RC2) — session task contract, persisted
  // on RecodeProgress and merged field-wise per turn. Null until first
  // inferred.
  taskContract: TaskContract | null;

  // Journey remediation 2026-07-19 (RC4/A7) — durable working preferences
  // and refusals. Survive session boundaries; revisable via
  // workingPreferenceCleared.
  workingPreferences: StoredWorkingPreference[];

  // Journey remediation 2026-07-19 — recent practice/intervention history
  // (most recent first), rendered into the clinician context so the AI can
  // see what it already tried and how the user responded.
  practiceHistory: PracticeHistoryEntry[];
};
