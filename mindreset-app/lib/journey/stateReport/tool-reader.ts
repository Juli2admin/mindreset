// Read a strict `emit_state_report` tool_use block's input and produce the
// same StateReport shape the current text-based parser produces.
//
// PR η (2026-07-10). Because Anthropic's strict tool use validates the
// input against `stateReportInputSchema` BEFORE it delivers the block, most
// of the validation the text parser does (enum checks, type checks,
// required-3 defaults) is already guaranteed by the API. This reader's job
// is:
//   1. Handle the (defensive) case where the input is missing / malformed
//      — return the same DEFENSIVE_DEFAULT the text parser returns.
//   2. Copy through the fields, applying the parser's normalization steps
//      that go BEYOND schema validation (dedup on modalityRejected, `none`
//      handling, contextNote truncation to 80 chars, moveJustPerformed
//      cap at 3 + universal.none uniqueness).
//   3. Preserve backwards compatibility with the existing StateReport
//      consumer contract — downstream code (state-save, router, admin
//      inspector) is unchanged.

import type { StateReport } from './schema';
import { parseModalityRejected } from './parse';

// Kept in sync with parse.ts::DEFENSIVE_DEFAULT.
const DEFENSIVE_DEFAULT: StateReport = {
  intensity: 5,
  safetyFlag: 'watch',
  recommendedAction: 'stay',
};

/**
 * Read a tool_use block's `input` field and produce a StateReport.
 *
 * With strict tool use enforcement, most fields arrive pre-validated:
 * enums are guaranteed to be in-range, required fields are guaranteed
 * present, additionalProperties are guaranteed absent. This function is
 * therefore mostly a typed copy with a handful of parser-side
 * normalizations that JSON Schema can't express.
 *
 * Returns the DEFENSIVE_DEFAULT (matches parseStateReport) if `input` is
 * null / not an object — this shouldn't happen with a forced tool_choice
 * but defends against a stream failure between the API and this function.
 */
export function readStateReportFromToolInput(input: unknown): StateReport {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...DEFENSIVE_DEFAULT };
  }
  const obj = input as Record<string, unknown>;

  // The three fields JSON Schema `required` guarantees are present. We
  // still fall back defensively in case the caller passed a mistyped
  // object (e.g. from a manual test fixture) — matches parser semantics.
  const intensity =
    typeof obj.intensity === 'number'
      ? Math.max(0, Math.min(10, Math.round(obj.intensity)))
      : DEFENSIVE_DEFAULT.intensity;
  const safetyFlag =
    typeof obj.safetyFlag === 'string' &&
    ['none', 'watch', 'red_flag'].includes(obj.safetyFlag)
      ? (obj.safetyFlag as StateReport['safetyFlag'])
      : DEFENSIVE_DEFAULT.safetyFlag;
  const recommendedAction =
    typeof obj.recommendedAction === 'string' &&
    [
      'stay',
      'advance',
      'regress_to_grounding',
      'regress_to_parts',
      'red_flag',
      'discharge',
    ].includes(obj.recommendedAction)
      ? (obj.recommendedAction as StateReport['recommendedAction'])
      : DEFENSIVE_DEFAULT.recommendedAction;

  const report: StateReport = {
    intensity,
    safetyFlag,
    recommendedAction,
  };

  // PR γ required-on-substantive-turn tier — schema also requires these,
  // so we just copy through when present with correct types.
  if (typeof obj.channel === 'string') report.channel = obj.channel as any;
  if (typeof obj.clinicalRead === 'string' && obj.clinicalRead.length > 0) {
    report.clinicalRead = obj.clinicalRead;
  }
  if (Array.isArray(obj.moveJustPerformed)) {
    const filtered = obj.moveJustPerformed.filter(
      (v): v is string => typeof v === 'string',
    );
    // Parser normalisation: cap at 3, and if `universal.none` appears with
    // other IDs, drop the others (parser rule from schema.ts:26-27).
    const capped = filtered.slice(0, 3);
    if (capped.includes('universal.none') && capped.length > 1) {
      report.moveJustPerformed = ['universal.none'] as any;
    } else if (capped.length > 0) {
      report.moveJustPerformed = capped as any;
    }
  }

  // Optional universal.
  if (typeof obj.adultSelfPresent === 'boolean') {
    report.adultSelfPresent = obj.adultSelfPresent;
  }
  if (Array.isArray(obj.readinessTouched)) {
    report.readinessTouched = obj.readinessTouched.filter(
      (v): v is string => typeof v === 'string',
    );
  }
  if (typeof obj.redFlagType === 'string') {
    report.redFlagType = obj.redFlagType;
  }

  // Practice run — nested object.
  if (obj.practiceRun && typeof obj.practiceRun === 'object') {
    const pr = obj.practiceRun as Record<string, unknown>;
    if (typeof pr.kind === 'string' && typeof pr.status === 'string') {
      report.practiceRun = {
        kind: pr.kind as any,
        status: pr.status as any,
        name: typeof pr.name === 'string' ? pr.name : undefined,
        family: typeof pr.family === 'string' ? (pr.family as any) : undefined,
        triggeredBy:
          typeof pr.triggeredBy === 'string' ? pr.triggeredBy : undefined,
        userImages:
          typeof pr.userImages === 'string' ? pr.userImages : undefined,
        depth: typeof pr.depth === 'string' ? (pr.depth as any) : undefined,
        modalitySwitched:
          pr.modalitySwitched &&
          typeof pr.modalitySwitched === 'object' &&
          typeof (pr.modalitySwitched as any).from === 'string' &&
          typeof (pr.modalitySwitched as any).to === 'string'
            ? {
                from: (pr.modalitySwitched as any).from,
                to: (pr.modalitySwitched as any).to,
              }
            : undefined,
      };
    }
  }

  // Landscape additions.
  if (Array.isArray(obj.userImagesCaptured)) {
    report.userImagesCaptured = obj.userImagesCaptured.filter(
      (v): v is string => typeof v === 'string',
    );
  }
  if (Array.isArray(obj.partsTouched)) {
    report.partsTouched = obj.partsTouched.flatMap((p) => {
      if (!p || typeof p !== 'object') return [];
      const pp = p as Record<string, unknown>;
      if (typeof pp.description !== 'string') return [];
      return [
        {
          description: pp.description,
          channel:
            typeof pp.channel === 'string' ? (pp.channel as any) : undefined,
          safeDistance:
            typeof pp.safeDistance === 'string' ? pp.safeDistance : undefined,
        },
      ];
    });
  }
  if (Array.isArray(obj.foreignFilesTouched)) {
    report.foreignFilesTouched = obj.foreignFilesTouched.flatMap((p) => {
      if (!p || typeof p !== 'object') return [];
      const pp = p as Record<string, unknown>;
      if (typeof pp.description !== 'string') return [];
      return [{ description: pp.description }];
    });
  }
  if (Array.isArray(obj.patternsTouched)) {
    report.patternsTouched = obj.patternsTouched.flatMap((p) => {
      if (!p || typeof p !== 'object') return [];
      const pp = p as Record<string, unknown>;
      if (
        typeof pp.category !== 'string' ||
        typeof pp.description !== 'string'
      )
        return [];
      const entry: {
        category: string;
        description: string;
        context?: Record<string, unknown>;
      } = { category: pp.category, description: pp.description };
      if (pp.context && typeof pp.context === 'object' && !Array.isArray(pp.context)) {
        entry.context = pp.context as Record<string, unknown>;
      }
      return [entry];
    });
  }

  // Landscape updates.
  if (obj.partSecured && typeof obj.partSecured === 'object') {
    const ps = obj.partSecured as Record<string, unknown>;
    if (typeof ps.partDescription === 'string' && ps.partDescription.length > 0) {
      report.partSecured = {
        partDescription: ps.partDescription,
        restingPlace:
          typeof ps.restingPlace === 'string' ? ps.restingPlace : undefined,
        adultSelfOffering:
          typeof ps.adultSelfOffering === 'string'
            ? ps.adultSelfOffering
            : undefined,
      };
    }
  }
  if (obj.foreignFileReleased && typeof obj.foreignFileReleased === 'object') {
    const ff = obj.foreignFileReleased as Record<string, unknown>;
    if (typeof ff.description === 'string' && ff.description.length > 0) {
      report.foreignFileReleased = {
        description: ff.description,
        returnedTo:
          typeof ff.returnedTo === 'string' ? ff.returnedTo : undefined,
        honouringPhrase:
          typeof ff.honouringPhrase === 'string' ? ff.honouringPhrase : undefined,
        whatStaysAsMine:
          typeof ff.whatStaysAsMine === 'string'
            ? ff.whatStaysAsMine
            : undefined,
      };
    }
  }

  // Simple string / boolean stage captures. copyIf helper for brevity.
  const copyIfString = <K extends keyof StateReport & string>(k: K) => {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) {
      (report as any)[k] = v;
    }
  };
  const copyIfBool = <K extends keyof StateReport & string>(k: K) => {
    const v = obj[k];
    if (typeof v === 'boolean') (report as any)[k] = v;
  };
  copyIfString('anchorIdentified');
  copyIfString('identityAnchor');
  copyIfBool('observerSeatTouched');
  copyIfString('adultSelfQualities');
  copyIfBool('adultSelfAnchorLinked');
  copyIfBool('heldEmotionInAdultSelf');
  if (typeof obj.compassionBridgeQuality === 'string') {
    report.compassionBridgeQuality = obj.compassionBridgeQuality as any;
  }
  copyIfString('bridgeAchievedAt');
  copyIfBool('userGrounded');
  copyIfString('cohesionAwareness');
  if (typeof obj.mii6Check === 'string') {
    report.mii6Check = obj.mii6Check as any;
  }
  copyIfString('originIdentified');
  copyIfBool('somaticRelease');
  copyIfString('bodyConfirmation');
  copyIfBool('internalConsensus');
  copyIfString('selfLoyaltyStatement');
  copyIfString('oneSmallAction');
  copyIfString('cleanIdentityStatement');
  copyIfString('whatStaysAsMine');
  copyIfString('symbolicIdentityMap');
  if (Array.isArray(obj.emergingQualities)) {
    report.emergingQualities = obj.emergingQualities.filter(
      (v): v is string => typeof v === 'string',
    );
  }
  copyIfString('innerDirection');
  if (obj.urgencyMarkers === 'present' || obj.urgencyMarkers === 'absent') {
    report.urgencyMarkers = obj.urgencyMarkers;
  }
  copyIfBool('safetyReorientation');
  copyIfString('calRunOn');
  if (obj.calLayer === 1 || obj.calLayer === 2 || obj.calLayer === 3) {
    report.calLayer = obj.calLayer;
  }
  if (
    typeof obj.userReportedRedirection === 'boolean' ||
    obj.userReportedRedirection === 'partial'
  ) {
    report.userReportedRedirection = obj.userReportedRedirection;
  }
  copyIfString('adultSelfThisWeek');
  if (Array.isArray(obj.feltAligned)) {
    report.feltAligned = obj.feltAligned.filter(
      (v): v is string => typeof v === 'string',
    );
  }
  if (Array.isArray(obj.feltOld)) {
    report.feltOld = obj.feltOld.filter(
      (v): v is string => typeof v === 'string',
    );
  }
  if (typeof obj.dischargeReadiness === 'string') {
    report.dischargeReadiness = obj.dischargeReadiness as any;
  }

  // Stability check — normalise contextNote to 80 chars.
  if (obj.stabilityCheck && typeof obj.stabilityCheck === 'object') {
    const sc = obj.stabilityCheck as Record<string, unknown>;
    if (typeof sc.score === 'number' && Number.isFinite(sc.score)) {
      const score = Math.max(1, Math.min(10, Math.round(sc.score)));
      report.stabilityCheck = { score };
      if (typeof sc.contextNote === 'string') {
        report.stabilityCheck.contextNote = sc.contextNote.slice(0, 80);
      }
    }
  }

  // Therapeutic Sensitivity Layer.
  if (typeof obj.therapeuticMode === 'string') {
    report.therapeuticMode = obj.therapeuticMode as any;
  }
  if (typeof obj.channelShiftDetected === 'boolean') {
    report.channelShiftDetected = obj.channelShiftDetected;
  }
  // modalityRejected: use existing parser helper so its dedup/`none` rules
  // stay in one place. Schema restricts item enum too, so this is
  // belt-and-braces.
  const modalities = parseModalityRejected(obj.modalityRejected);
  if (modalities) report.modalityRejected = modalities;
  if (typeof obj.cycleStatus === 'string') {
    report.cycleStatus = obj.cycleStatus as any;
  }
  if (typeof obj.cycleCanClose === 'boolean') {
    report.cycleCanClose = obj.cycleCanClose;
  }
  if (typeof obj.nextBestMode === 'string') {
    report.nextBestMode = obj.nextBestMode as any;
  }

  // Continuity.
  copyIfString('continuityNote');

  return report;
}
