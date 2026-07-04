// Parse the hidden JSON state report from the AI's reply.
// Fail-safe: any parse failure returns a defensive default (intensity 5,
// safetyFlag 'watch', recommendedAction 'stay') so the system errs on
// gentleness rather than advancement.

import type {
  StateReport,
  PracticeRun,
  PracticeFamily,
  PracticeRunStatus,
  CanonicalMove,
} from './schema';
import {
  CANONICAL_MOVES_SET,
  MOVE_NONE,
  MAX_MOVES_PER_TURN,
} from './schema';
import type {
  JourneyChannel,
  JourneyDepth,
  SafetyFlag,
  RecommendedAction,
  CompassionBridgeQuality,
} from '../state/types';

const STATE_REPORT_OPEN = '<state-report>';
const STATE_REPORT_CLOSE = '</state-report>';

const DEFENSIVE_DEFAULT: StateReport = {
  intensity: 5,
  safetyFlag: 'watch',
  recommendedAction: 'stay',
};

// Allowed enums — anything else is dropped to a safer default.
const CHANNELS: JourneyChannel[] = [
  'visual', 'kinesthetic', 'emotional', 'cognitive', 'verbal', 'mixed',
];
const DEPTHS: JourneyDepth[] = ['surface', 'middle', 'deep'];
const SAFETY_FLAGS: SafetyFlag[] = ['none', 'watch', 'red_flag'];
const ACTIONS: RecommendedAction[] = [
  'stay', 'advance', 'regress_to_grounding', 'regress_to_parts', 'red_flag', 'discharge',
];
const BRIDGE_QUALITIES: CompassionBridgeQuality[] = [
  'compassion', 'curiosity', 'acceptance', 'willingness_to_comfort',
];
const MII6_CHECKS = [
  'stable', 'destabilised', 'unsure', 'destabilised_then_recovered',
] as const;
type Mii6CheckValue = (typeof MII6_CHECKS)[number];
const PRACTICE_FAMILIES: PracticeFamily[] = [
  'regulation', 'somatic', 'landscape', 'narrative', 'compassion', 'none',
];
const PRACTICE_STATUSES: PracticeRunStatus[] = [
  'started', 'mid', 'completed', 'aborted_user_request', 'aborted_overwhelm',
];

// ---------------------------------------------------------------------------
// Top-level: split the AI's full reply into (human reply, raw state report).
// ---------------------------------------------------------------------------

export type SplitReply = {
  humanReply: string;
  rawStateReport: string | null;
};

export function splitReplyAndReport(fullReply: string): SplitReply {
  const openIdx = fullReply.indexOf(STATE_REPORT_OPEN);
  if (openIdx < 0) {
    return { humanReply: fullReply.trim(), rawStateReport: null };
  }
  const closeIdx = fullReply.indexOf(STATE_REPORT_CLOSE, openIdx);
  const human = fullReply.slice(0, openIdx).trim();
  if (closeIdx < 0) {
    // Open tag found but no close — strip from human reply, treat report as missing.
    return { humanReply: human, rawStateReport: null };
  }
  const raw = fullReply.slice(openIdx + STATE_REPORT_OPEN.length, closeIdx).trim();
  return { humanReply: human, rawStateReport: raw };
}

// ---------------------------------------------------------------------------
// Parse + validate the raw JSON into a StateReport, falling back defensively.
// ---------------------------------------------------------------------------

export function parseStateReport(raw: string | null): StateReport {
  if (!raw) return { ...DEFENSIVE_DEFAULT };
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ...DEFENSIVE_DEFAULT, _raw: raw };
    }
  } catch {
    return { ...DEFENSIVE_DEFAULT, _raw: raw };
  }

  const intensity = clamp(toNumber(obj.intensity, 5), 0, 10);
  const safetyFlag = pickEnum(obj.safetyFlag, SAFETY_FLAGS, 'watch');
  const recommendedAction = pickEnum(obj.recommendedAction, ACTIONS, 'stay');

  const report: StateReport = {
    intensity,
    safetyFlag,
    recommendedAction,
  };

  const channel = pickEnumOptional(obj.channel, CHANNELS);
  if (channel) report.channel = channel;

  if (typeof obj.adultSelfPresent === 'boolean') {
    report.adultSelfPresent = obj.adultSelfPresent;
  }

  if (Array.isArray(obj.readinessTouched)) {
    report.readinessTouched = obj.readinessTouched.filter((v): v is string => typeof v === 'string');
  }

  if (typeof obj.redFlagType === 'string') report.redFlagType = obj.redFlagType;

  const pr = parsePracticeRun(obj.practiceRun);
  if (pr) report.practiceRun = pr;

  if (Array.isArray(obj.userImagesCaptured)) {
    report.userImagesCaptured = obj.userImagesCaptured.filter((v): v is string => typeof v === 'string');
  }

  if (Array.isArray(obj.partsTouched)) {
    report.partsTouched = obj.partsTouched.flatMap(parsePartTouched);
  }

  if (Array.isArray(obj.foreignFilesTouched)) {
    report.foreignFilesTouched = obj.foreignFilesTouched.flatMap((p) => {
      if (p && typeof p === 'object' && typeof (p as Record<string, unknown>).description === 'string') {
        return [{ description: (p as Record<string, unknown>).description as string }];
      }
      return [];
    });
  }

  // Stage 4 MII-5 — Adult Self offering to part / part secured at resting place
  const ps = obj.partSecured;
  if (ps && typeof ps === 'object') {
    const psObj = ps as Record<string, unknown>;
    if (typeof psObj.partDescription === 'string' && psObj.partDescription.length > 0) {
      report.partSecured = {
        partDescription: psObj.partDescription,
        restingPlace: typeof psObj.restingPlace === 'string' ? psObj.restingPlace : undefined,
        adultSelfOffering: typeof psObj.adultSelfOffering === 'string' ? psObj.adultSelfOffering : undefined,
      };
    }
  }

  // Stage 5 — Symbolic Return of the Burden
  const ffr = obj.foreignFileReleased;
  if (ffr && typeof ffr === 'object') {
    const ffrObj = ffr as Record<string, unknown>;
    if (typeof ffrObj.description === 'string' && ffrObj.description.length > 0) {
      report.foreignFileReleased = {
        description: ffrObj.description,
        returnedTo: typeof ffrObj.returnedTo === 'string' ? ffrObj.returnedTo : undefined,
        honouringPhrase: typeof ffrObj.honouringPhrase === 'string' ? ffrObj.honouringPhrase : undefined,
        whatStaysAsMine: typeof ffrObj.whatStaysAsMine === 'string' ? ffrObj.whatStaysAsMine : undefined,
      };
    }
  }

  copyStringField(obj, 'anchorIdentified', report);
  copyStringField(obj, 'identityAnchor', report);
  if (typeof obj.observerSeatTouched === 'boolean') {
    report.observerSeatTouched = obj.observerSeatTouched;
  }
  copyStringField(obj, 'adultSelfQualities', report);
  // Stage 3 — Adult Self Co-Creation captures (audit P3 #6 of 11).
  if (typeof obj.adultSelfAnchorLinked === 'boolean') {
    report.adultSelfAnchorLinked = obj.adultSelfAnchorLinked;
  }
  if (typeof obj.heldEmotionInAdultSelf === 'boolean') {
    report.heldEmotionInAdultSelf = obj.heldEmotionInAdultSelf;
  }

  const bridge = pickEnumOptional(obj.compassionBridgeQuality, BRIDGE_QUALITIES);
  if (bridge) report.compassionBridgeQuality = bridge;
  // Stage 4 — Compassion Bridge timestamp + Securing the Part captures.
  copyStringField(obj, 'bridgeAchievedAt', report);
  if (typeof obj.userGrounded === 'boolean') {
    report.userGrounded = obj.userGrounded;
  }

  copyStringField(obj, 'cohesionAwareness', report);
  const mii6 = pickEnumOptional(obj.mii6Check, MII6_CHECKS as unknown as Mii6CheckValue[]);
  if (mii6) report.mii6Check = mii6;
  // Stage 5 — Origin Voice Mapping + Symbolic Return + Clean Identity
  // Statement captures.
  copyStringField(obj, 'originIdentified', report);
  if (typeof obj.somaticRelease === 'boolean') {
    report.somaticRelease = obj.somaticRelease;
  }
  copyStringField(obj, 'bodyConfirmation', report);
  if (typeof obj.internalConsensus === 'boolean') {
    report.internalConsensus = obj.internalConsensus;
  }
  // Stage 6 — Self-Loyalty Commitment captures.
  copyStringField(obj, 'selfLoyaltyStatement', report);
  copyStringField(obj, 'oneSmallAction', report);
  copyStringField(obj, 'cleanIdentityStatement', report);
  copyStringField(obj, 'whatStaysAsMine', report);
  copyStringField(obj, 'symbolicIdentityMap', report);

  if (Array.isArray(obj.emergingQualities)) {
    report.emergingQualities = obj.emergingQualities.filter((v): v is string => typeof v === 'string');
  }
  copyStringField(obj, 'innerDirection', report);
  if (obj.urgencyMarkers === 'present' || obj.urgencyMarkers === 'absent') {
    report.urgencyMarkers = obj.urgencyMarkers;
  }
  // Stage 7 — Safety Reorientation mandatory session-close capture.
  if (typeof obj.safetyReorientation === 'boolean') {
    report.safetyReorientation = obj.safetyReorientation;
  }
  copyStringField(obj, 'calRunOn', report);
  if (obj.calLayer === 1 || obj.calLayer === 2 || obj.calLayer === 3) {
    report.calLayer = obj.calLayer;
  }
  if (
    typeof obj.userReportedRedirection === 'boolean' ||
    obj.userReportedRedirection === 'partial'
  ) {
    report.userReportedRedirection = obj.userReportedRedirection;
  }
  copyStringField(obj, 'adultSelfThisWeek', report);
  if (Array.isArray(obj.feltAligned)) {
    report.feltAligned = obj.feltAligned.filter((v): v is string => typeof v === 'string');
  }
  if (Array.isArray(obj.feltOld)) {
    report.feltOld = obj.feltOld.filter((v): v is string => typeof v === 'string');
  }
  // Stage 8 — Discharge Protocol readiness enum.
  if (
    obj.dischargeReadiness === 'not_ready' ||
    obj.dischargeReadiness === 'maybe' ||
    obj.dischargeReadiness === 'ready'
  ) {
    report.dischargeReadiness = obj.dischargeReadiness;
  }
  // Stabilising-before-closing protocol (PR 8). Captures the user's
  // 1-10 stability score + brief context. Accept score in any numeric
  // form clamped to [1, 10]; reject non-numeric. Truncate contextNote
  // to 80 chars.
  if (obj.stabilityCheck && typeof obj.stabilityCheck === 'object') {
    const sc = obj.stabilityCheck as Record<string, unknown>;
    const rawScore = sc.score;
    let parsedScore: number | undefined;
    if (typeof rawScore === 'number' && Number.isFinite(rawScore)) {
      parsedScore = Math.max(1, Math.min(10, Math.round(rawScore)));
    } else if (typeof rawScore === 'string') {
      const n = Number(rawScore);
      if (Number.isFinite(n)) parsedScore = Math.max(1, Math.min(10, Math.round(n)));
    }
    if (parsedScore !== undefined) {
      const check: { score: number; contextNote?: string } = { score: parsedScore };
      if (typeof sc.contextNote === 'string') {
        check.contextNote = sc.contextNote.slice(0, 80);
      }
      report.stabilityCheck = check;
    }
  }
  // Journey polish PR 4a — clinical-move naming for data collection.
  // Array of 1..3 canonical move IDs, primary first. Router does NOT
  // consume this yet.
  const moves = parseMoveJustPerformed(obj.moveJustPerformed);
  if (moves) report.moveJustPerformed = moves;

  copyStringField(obj, 'continuityNote', report);

  return report;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function toNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function pickEnum<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function pickEnumOptional<T extends string>(v: unknown, allowed: T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

function copyStringField<K extends keyof StateReport>(
  src: Record<string, unknown>,
  key: K & string,
  dst: StateReport,
): void {
  const v = src[key];
  if (typeof v === 'string' && v.length > 0) {
    // The shape allows these to be string fields; narrow check above is sufficient.
    (dst as Record<string, unknown>)[key] = v;
  }
}

function parsePracticeRun(v: unknown): PracticeRun | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const obj = v as Record<string, unknown>;
  const kind = pickEnumOptional(obj.kind, ['canonical', 'generated', 'none']);
  if (!kind) return undefined;
  const status = pickEnumOptional(obj.status, PRACTICE_STATUSES);
  if (!status) return undefined;

  const run: PracticeRun = { kind, status };
  if (typeof obj.name === 'string') run.name = obj.name;
  const family = pickEnumOptional(obj.family, PRACTICE_FAMILIES);
  if (family) run.family = family;
  if (typeof obj.triggeredBy === 'string') run.triggeredBy = obj.triggeredBy;
  if (typeof obj.userImages === 'string') run.userImages = obj.userImages;
  const depth = pickEnumOptional(obj.depth, DEPTHS);
  if (depth) run.depth = depth;
  if (
    obj.modalitySwitched &&
    typeof obj.modalitySwitched === 'object' &&
    typeof (obj.modalitySwitched as Record<string, unknown>).from === 'string' &&
    typeof (obj.modalitySwitched as Record<string, unknown>).to === 'string'
  ) {
    run.modalitySwitched = {
      from: (obj.modalitySwitched as Record<string, unknown>).from as string,
      to: (obj.modalitySwitched as Record<string, unknown>).to as string,
    };
  }
  return run;
}

// Journey polish PR 4a. Parse and normalise the LLM's clinical-move
// naming for this turn.
//
// Owner rules (2026-07-04):
//   - 1..3 IDs per turn, primary first. Cap at 3 by slicing tail off.
//   - Unknown IDs are silently dropped (fail-soft; the router doesn't
//     read this yet).
//   - universal.none is used ONLY when the turn had no clinical move.
//     It MUST NOT combine with other IDs. If the LLM emits it alongside
//     real moves, the real moves win — that's the honest read of the
//     turn (something clinical happened, so "none" was wrong).
//   - Duplicates are collapsed, preserving primary-first order.
//   - Return undefined if the array is missing, not an array, empty, or
//     contains no known IDs — the field is optional and absent means
//     "AI didn't emit it this turn."
export function parseMoveJustPerformed(v: unknown): CanonicalMove[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const knownInOrder: CanonicalMove[] = [];
  for (const item of v) {
    if (typeof item === 'string' && CANONICAL_MOVES_SET.has(item)) {
      knownInOrder.push(item as CanonicalMove);
    }
  }
  if (knownInOrder.length === 0) return undefined;
  // Dedup preserving order (primary first stays first).
  const seen = new Set<CanonicalMove>();
  const deduped: CanonicalMove[] = [];
  for (const m of knownInOrder) {
    if (!seen.has(m)) {
      seen.add(m);
      deduped.push(m);
    }
  }
  // universal.none exclusivity: if any real move is present, drop none.
  // If ONLY none is present, keep it — that's the "no clinical move"
  // signal the schema wants.
  const nonNone = deduped.filter((m) => m !== MOVE_NONE);
  const normalised = nonNone.length > 0 ? nonNone : [MOVE_NONE];
  return normalised.slice(0, MAX_MOVES_PER_TURN);
}

function parsePartTouched(v: unknown): Array<{
  description: string;
  channel?: JourneyChannel;
  safeDistance?: string;
}> {
  if (!v || typeof v !== 'object') return [];
  const obj = v as Record<string, unknown>;
  if (typeof obj.description !== 'string' || obj.description.length === 0) return [];
  const result: { description: string; channel?: JourneyChannel; safeDistance?: string } = {
    description: obj.description,
  };
  const channel = pickEnumOptional(obj.channel, CHANNELS);
  if (channel) result.channel = channel;
  if (typeof obj.safeDistance === 'string') result.safeDistance = obj.safeDistance;
  return [result];
}
