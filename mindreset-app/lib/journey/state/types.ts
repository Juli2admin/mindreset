// TypeScript types for the persistent inner landscape of The Journey.
// These describe the *decrypted* shape in memory; storage at rest is
// encrypted per UK GDPR Article 9. See lib/encrypt.ts.

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
  releasedAt: Date | null;
};

export type JourneySignatureImage = {
  id: string;
  userDescription: string; // decrypted
  context: string | null;
  createdAt: Date;
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
};
