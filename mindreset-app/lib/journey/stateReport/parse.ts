// Parse the hidden JSON state report from the AI's reply.
// Fail-safe: any parse failure returns a defensive default (intensity 5,
// safetyFlag 'watch', recommendedAction 'stay') so the system errs on
// gentleness rather than advancement.

import type {
  StateReport,
  PracticeRun,
  PracticeFamily,
  PracticeRunStatus,
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

  const bridge = pickEnumOptional(obj.compassionBridgeQuality, BRIDGE_QUALITIES);
  if (bridge) report.compassionBridgeQuality = bridge;

  copyStringField(obj, 'cohesionAwareness', report);
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
