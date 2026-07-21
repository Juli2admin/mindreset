// Golden-session harness types. Read-only consumer of the production runtime
// (assembly, streaming processor, parser). Never touches DB or routes.

import type { StateReport } from '../../../lib/journey/stateReport/schema';

export type FixtureTurnState = {
  currentStage: number;
  currentDepth: 'surface' | 'middle' | 'deep';
  anchorText: string | null;
  anchorSetAt: string | null;
  processingChannel: string | null;
  lastIntensity: number | null;
  continuityNote: string | null;
  taskContract: Record<string, string> | null;
  patterns: { category: string; userDescription: string; lastConfirmedAt: string; daysSinceLastConfirmed: number }[];
  signatureImages: { userDescription: string }[];
  parts: { userDescription: string; channel?: string | null; safeDistance?: string | null; createdAt: string }[];
  foreignFiles: { userDescription: string; originDescription?: string | null; identifiedAt?: string | null; releaseClaimedAt: string | null; releasedAt: string | null; createdAt: string }[];
  hasOpenCycle: boolean;
  openCycleDescription: string | null;
  sessionRejectedModalities: string[];
  recentChannelShift: boolean;
  sessionCount: number;
  daysEngaged: number;
  thisSessionMessageCount: number;
  stageJustAdvanced: boolean;
  isSessionResume: boolean;
  hoursSinceLastTurn: number | null;
};

export type FixtureTurn = {
  n: number;
  ts: string | null;
  user: string;
  recordedReply: string;
  report: Record<string, unknown>; // the session's own emitted report (ground truth for recorded mode)
  state: FixtureTurnState;
};

export type Fixture = {
  id: string;
  locale: string;
  model: string;
  description: string;
  annotations: { userPush?: number[]; rupture?: number[]; correction?: number[]; deliveryGlitch?: number[] };
  sessionContractReference?: Record<string, string>;
  turns: FixtureTurn[];
};

export type VariantThinking =
  | { type: 'enabled'; budget_tokens: number }
  | { type: 'adaptive' };

export type Variant = {
  name: string;
  thinking: VariantThinking | null;
  effort: 'low' | 'medium' | 'high' | 'max' | null;
  maxTokens: number | null; // null = production 2500
  model: string | null;     // null = fixture/production model
};

export type TurnTimings = {
  requestStartMs: number;
  firstThinkingMs: number | null;
  firstVisibleMs: number | null;
  totalMs: number;
};

export type TurnUsage = {
  inputTokens: number | null;
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  outputTokens: number | null;
};

export type TurnResult = {
  n: number;
  user: string;
  visibleReply: string;
  rawReportJson: string | null;
  parsedReport: StateReport | null;
  parseFellBackToDefault: boolean;
  stopReason: string | null;
  thinkingChars: number;
  timings: TurnTimings | null; // null in recorded mode
  usage: TurnUsage | null;     // null in recorded mode
  blockSha: { b1: string; b2: string; b3: string; b4: string };
  block3Text: string;          // dynamic state block actually used (was-it-live guarantee)
};

export type RunMeta = {
  runName: string;
  fixtureId: string;
  variant: Variant;
  mode: 'recorded' | 'live';
  rep: number;
  gitSha: string;
  startedAtIso: string;
  model: string;
};
