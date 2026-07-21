// Fixture scripted-state -> production JourneyState. Dates from ISO; everything
// the renderer reads is populated. Deterministic across variants by construction.

import type { JourneyState, JourneyChannel } from '../../../lib/journey/state/types';
import type { FixtureTurnState } from './types';

const d = (s: string | null | undefined): Date | null => (s ? new Date(s) : null);

export function toJourneyState(fs: FixtureTurnState, sessionStartIso: string): JourneyState {
  return {
    userId: 'eval-harness',
    currentStage: fs.currentStage,
    currentDepth: fs.currentDepth,
    startedAt: new Date(sessionStartIso),
    lastActivityAt: new Date(sessionStartIso),
    dischargedAt: null,
    anchorText: fs.anchorText,
    anchorSetAt: d(fs.anchorSetAt),
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: (fs.processingChannel as JourneyChannel) ?? null,
    adultSelfQualities: null,
    lastIntensity: fs.lastIntensity,
    lastIntensityAt: fs.lastIntensity != null ? new Date(sessionStartIso) : null,
    lastDeepLayerContactAt: null,
    mii: {},
    stage8WeeksElapsed: 0,
    frozenForReview: false,
    frozenAt: null,
    frozenReason: null,
    continuityNote: fs.continuityNote,
    parts: fs.parts.map((p, i) => ({
      id: `part-${i}`,
      userDescription: p.userDescription,
      channel: (p.channel as JourneyChannel) ?? null,
      safeDistance: p.safeDistance ?? null,
      compassionBridgeQuality: null,
      currentRestingPlace: null,
      active: true,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.createdAt),
    })),
    foreignFiles: fs.foreignFiles.map((f, i) => ({
      id: `ff-${i}`,
      userDescription: f.userDescription,
      originDescription: f.originDescription ?? null,
      returnedTo: null,
      honouringPhrase: null,
      whatStaysAsMine: null,
      identifiedAt: d(f.identifiedAt ?? f.createdAt),
      releaseClaimedAt: d(f.releaseClaimedAt),
      releasedAt: d(f.releasedAt),
    })),
    signatureImages: fs.signatureImages.map((s, i) => ({
      id: `img-${i}`,
      userDescription: s.userDescription,
      context: null,
      createdAt: new Date(sessionStartIso),
    })),
    patterns: fs.patterns.map((p, i) => ({
      id: `pat-${i}`,
      category: p.category,
      userDescription: p.userDescription,
      firstObservedAt: new Date(p.lastConfirmedAt),
      lastConfirmedAt: new Date(p.lastConfirmedAt),
      active: true,
      context: null,
      daysSinceLastConfirmed: p.daysSinceLastConfirmed,
    })),
    sessionCount: fs.sessionCount,
    daysEngaged: fs.daysEngaged,
    thisSessionMessageCount: fs.thisSessionMessageCount,
    stageJustAdvanced: fs.stageJustAdvanced,
    hoursSinceLastTurn: fs.hoursSinceLastTurn,
    isSessionResume: fs.isSessionResume,
    hasOpenCycle: fs.hasOpenCycle,
    openCycleDescription: fs.openCycleDescription,
    sessionRejectedModalities: fs.sessionRejectedModalities as JourneyState['sessionRejectedModalities'],
    recentChannelShift: fs.recentChannelShift,
    taskContract: (fs.taskContract as JourneyState['taskContract']) ?? null,
    onboardingAnswers: null,
  };
}
