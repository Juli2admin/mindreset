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
  TherapeuticMode,
  ModalityRejected,
  CycleStatus,
  NextBestMode,
  TaskContract,
} from './schema';
import {
  CANONICAL_MOVES_SET,
  MOVE_NONE,
  MAX_MOVES_PER_TURN,
  THERAPEUTIC_MODES,
  MODALITIES_REJECTED,
  CYCLE_STATUSES,
  NEXT_BEST_MODES,
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
// Therapeutic Sensitivity Layer — PR α (2026-07-09). The AI's clinical
// reasoning lives in an <assessment>...</assessment> block that
// immediately precedes the reply. It MUST NEVER reach the user, not on
// the live stream (handled by lib/journey/streaming/reply-processor.ts)
// and not on page reload from the persisted message (handled here in
// splitReplyAndReport).
const ASSESSMENT_OPEN = '<assessment>';
const ASSESSMENT_CLOSE = '</assessment>';
// PR ζ (2026-07-10) — `<thinking>` is Claude's default reasoning shape.
// The model reached for it after PR γ tightened state-report requirements
// and leaked private clinical reasoning into a real user's chat. Strip
// identically to `<assessment>` from the persisted humanReply.
const THINKING_OPEN = '<thinking>';
const THINKING_CLOSE = '</thinking>';
const PRIVATE_TAG_PAIRS: ReadonlyArray<{ open: string; close: string }> = [
  { open: ASSESSMENT_OPEN, close: ASSESSMENT_CLOSE },
  { open: THINKING_OPEN, close: THINKING_CLOSE },
];

// Iteratively strip every private-tag pair from a string. Handles multiple
// occurrences of either tag anywhere in the input. On an unclosed tag
// (open with no matching close), truncates everything from the open
// onwards — safer to lose the tail than to leak reasoning that a future
// page reload would render.
//
// M6 (2026-07-11). Also strip any orphan CLOSING tag left behind after
// the balanced-pair sweep. Nested tags of the same name (e.g.
// `<assessment>a<assessment>b</assessment>c</assessment>`) match the
// first close greedily, so the outer close survives and would render
// literally in the user's message pane. Not a security risk (the payload
// wasn't sensitive), just a visible tag string — the extra sweep keeps
// output clean under any nesting the model might emit.
function stripPrivateTags(text: string): string {
  let result = text;
  for (const pair of PRIVATE_TAG_PAIRS) {
    while (true) {
      const openIdx = result.indexOf(pair.open);
      if (openIdx < 0) break;
      const closeIdx = result.indexOf(pair.close, openIdx);
      if (closeIdx < 0) {
        result = result.slice(0, openIdx);
        break;
      }
      result = result.slice(0, openIdx) + result.slice(closeIdx + pair.close.length);
    }
    while (true) {
      const orphan = result.indexOf(pair.close);
      if (orphan < 0) break;
      result = result.slice(0, orphan) + result.slice(orphan + pair.close.length);
    }
  }
  return result;
}

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
  // Cut at the state-report boundary first, then strip every private-tag
  // pair from the human body. This handles:
  //   - `<assessment>...</assessment>` at the start of the reply (PR α)
  //   - `<thinking>...</thinking>` anywhere in the reply (PR ζ)
  //   - Multiple occurrences of either
  //   - Unclosed tags (truncate from the open — never leak)
  // humanReply is what gets persisted as the assistant JourneyMessage and
  // rendered from history on every page reload. The streaming processor
  // strips these from the live stream too, but this layer is the one that
  // matters for future reloads.
  const openIdx = fullReply.indexOf(STATE_REPORT_OPEN);
  let humanBody: string;
  let rawStateReport: string | null;
  if (openIdx < 0) {
    humanBody = fullReply;
    rawStateReport = null;
  } else {
    const closeIdx = fullReply.indexOf(STATE_REPORT_CLOSE, openIdx);
    humanBody = fullReply.slice(0, openIdx);
    rawStateReport =
      closeIdx < 0
        ? null
        : fullReply.slice(openIdx + STATE_REPORT_OPEN.length, closeIdx).trim();
  }
  const humanReply = stripPrivateTags(humanBody).trim();
  return { humanReply, rawStateReport };
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

  // Journey polish PR 5. patternsTouched — array of structural pattern
  // observations. Validated + normalised in a dedicated helper.
  const patterns = parsePatternsTouched(obj.patternsTouched);
  if (patterns) report.patternsTouched = patterns;

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

  // Therapeutic Sensitivity Layer — PR α (2026-07-09). Data collection
  // only. Later PRs will use these fields for close-refusal, cycle
  // continuity across sessions, and modality-rejection enforcement.
  const tm = pickEnumOptional(obj.therapeuticMode, THERAPEUTIC_MODES as unknown as TherapeuticMode[]);
  if (tm) report.therapeuticMode = tm;

  if (typeof obj.channelShiftDetected === 'boolean') {
    report.channelShiftDetected = obj.channelShiftDetected;
  }

  const modalities = parseModalityRejected(obj.modalityRejected);
  if (modalities) report.modalityRejected = modalities;

  const cs = pickEnumOptional(obj.cycleStatus, CYCLE_STATUSES as unknown as CycleStatus[]);
  if (cs) report.cycleStatus = cs;

  if (typeof obj.cycleCanClose === 'boolean') {
    report.cycleCanClose = obj.cycleCanClose;
  }

  const nbm = pickEnumOptional(obj.nextBestMode, NEXT_BEST_MODES as unknown as NextBestMode[]);
  if (nbm) report.nextBestMode = nbm;

  // Per-turn clinical scratchpad. Referenced by the sensitivity layer
  // and the master prompt as the AI's working hypothesis for this turn.
  // Distinct from continuityNote (which is cross-session).
  copyStringField(obj, 'clinicalRead', report);

  copyStringField(obj, 'continuityNote', report);

  // Journey P3 (2026-07-19) — session task contract (RC2).
  const contract = parseTaskContract(obj.taskContract);
  if (contract) report.taskContract = contract;

  // Journey P1 (2026-07-19) — release confirmation / invalidation (A8).
  const rc = obj.releaseConfirmed;
  if (rc && typeof rc === 'object') {
    const d = (rc as Record<string, unknown>).description;
    if (typeof d === 'string' && d.trim().length > 0) {
      report.releaseConfirmed = { description: d.trim() };
    }
  }
  const ri = obj.releaseInvalidated;
  if (ri && typeof ri === 'object') {
    const d = (ri as Record<string, unknown>).description;
    if (typeof d === 'string' && d.trim().length > 0) {
      const entry: { description: string; reason?: string } = {
        description: d.trim(),
      };
      const reason = (ri as Record<string, unknown>).reason;
      if (typeof reason === 'string' && reason.trim().length > 0) {
        entry.reason = reason.trim().slice(0, 200);
      }
      report.releaseInvalidated = entry;
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// Journey P3 (2026-07-19) — task-contract validation (RC2).
//
// Rules:
//   - Each field must be a non-empty string of 3..300 chars after trim
//     (truncated at 300, not rejected).
//   - Generic/placeholder values are DROPPED so they can never overwrite a
//     valid stored contract at merge time ("none", "n/a", "unknown",
//     "not clear yet", "tbd", "-", "...").
//   - Returns undefined when no field survives — absent field, not an empty
//     object, so the save-layer merge is a no-op.
// ---------------------------------------------------------------------------
const TASK_CONTRACT_FIELDS = [
  'presentingRequest',
  'expectedHelp',
  'currentFocus',
  'completionCriterion',
] as const;
const GENERIC_CONTRACT_VALUE_RE =
  /^(none|n\/a|na|unknown|unclear|not\s+(yet\s+)?(clear|known|sure)(\s+yet)?|tbd|todo|-+|\.+|\?+|null|nothing)$/i;
const MAX_CONTRACT_FIELD_CHARS = 300;

export function parseTaskContract(v: unknown): TaskContract | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const obj = v as Record<string, unknown>;
  const out: TaskContract = {};
  for (const field of TASK_CONTRACT_FIELDS) {
    const raw = obj[field];
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed.length < 3) continue;
    if (GENERIC_CONTRACT_VALUE_RE.test(trimmed)) continue;
    out[field] = trimmed.slice(0, MAX_CONTRACT_FIELD_CHARS);
  }
  return Object.keys(out).length > 0 ? out : undefined;
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
// Therapeutic Sensitivity Layer — parse the modalityRejected array.
// Julia's spec makes this a session-level record of what the user has
// refused. Kept as an array (not single value) because a single turn can
// carry multiple rejections ("no more body, no more breathing").
// Returns undefined for missing / non-array / all-invalid inputs so the
// field is simply absent from the parsed report — matches the pattern
// used elsewhere in this file.
export function parseModalityRejected(
  v: unknown,
): ModalityRejected[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const set = new Set<ModalityRejected>();
  for (const item of v) {
    if (typeof item !== 'string') continue;
    if ((MODALITIES_REJECTED as readonly string[]).includes(item)) {
      set.add(item as ModalityRejected);
    }
  }
  if (set.size === 0) return undefined;
  // 'none' is a signal of "no rejection" — if the AI emits it alongside
  // other real values, the real values win. Same discipline as
  // parseMoveJustPerformed's universal.none handling.
  const real = Array.from(set).filter((v) => v !== 'none');
  return real.length > 0 ? real : ['none'];
}

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

// Journey polish PR 5. Parse and normalise patternsTouched — the AI's
// structural notes on unresolved psychological patterns.
//
// Rules (owner-approved 2026-07-04):
//   - `category` must be snake_case: [a-z][a-z0-9_]*. Anything else is
//     silently dropped — the taxonomy is free-string but we still enforce
//     shape so downstream code can rely on it as a stable key.
//   - `description` must be a non-empty string.
//   - `context` must be a plain non-array object; anything else is
//     dropped and the entry is kept without context.
//   - Category is truncated to 60 chars, description to 200 chars.
//   - Deduplicated by category — later entries win (keeps the most
//     recent description if the AI names the same pattern twice in one
//     turn).
//   - Cap array length at 10 entries per turn (defensive — the AI
//     should never need more).
//   - Return undefined if input isn't an array, is empty, or yields
//     zero valid entries.
const PATTERN_CATEGORY_RE = /^[a-z][a-z0-9_]{0,59}$/;
const MAX_PATTERNS_PER_TURN = 10;
const MAX_PATTERN_DESCRIPTION = 200;

export function parsePatternsTouched(
  v: unknown,
): Array<{ category: string; description: string; context?: Record<string, unknown> }> | undefined {
  if (!Array.isArray(v)) return undefined;
  const byCategory = new Map<
    string,
    { category: string; description: string; context?: Record<string, unknown> }
  >();
  for (const item of v) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;
    const category = typeof obj.category === 'string' ? obj.category.trim() : '';
    const description = typeof obj.description === 'string' ? obj.description.trim() : '';
    if (!PATTERN_CATEGORY_RE.test(category)) continue;
    if (description.length === 0) continue;
    const entry: {
      category: string;
      description: string;
      context?: Record<string, unknown>;
    } = {
      category,
      description: description.slice(0, MAX_PATTERN_DESCRIPTION),
    };
    if (
      obj.context &&
      typeof obj.context === 'object' &&
      !Array.isArray(obj.context)
    ) {
      entry.context = obj.context as Record<string, unknown>;
    }
    byCategory.set(category, entry);
  }
  if (byCategory.size === 0) return undefined;
  return Array.from(byCategory.values()).slice(0, MAX_PATTERNS_PER_TURN);
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
