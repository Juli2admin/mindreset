// Middle Layer PR 4 (2026-08-13) — sufficiency validation and rung
// derivation, SHADOW MODE.
// Middle Layer PR 4b (2026-08-13) — evidence-backed promotion.
//
// Everything in this file is PURE. It computes what the Middle Layer would
// license, records that verdict, and licenses nothing. No caller gates depth,
// blocks a practice, changes a route, or alters the prompt on the strength of
// these values.
//
// ---------------------------------------------------------------------------
// WHAT MAKES A PROMOTION TRUSTWORTHY
// ---------------------------------------------------------------------------
//
// PR 4 established that §1's promotion conditions could not be decided from a
// model-authored blob, because every fact in it is a same-turn self-report.
// PR 4b fixes that at the source rather than by adding more self-reports:
// every load-bearing fact now comes from JourneyEvidenceExchange, where code
// stamps the times and the model has no write path.
//
// The asymmetry the whole gate rests on: the model writes its state report
// AFTER its reply, in the same call. It can claim anything about the present.
// It cannot manufacture the user's next turn. So every promotion condition is
// expressed as "the user answered this, on a turn later than the offer" — and
// code owns the clock.
//
// Three things code deliberately never does, all owner-ratified:
//
//   1. It never decides whether two wordings mean the same thing. Paraphrase,
//      refinement and rival-hypothesis are Clinician judgements (decision 4).
//      Contradictions are counted with max() across rows, which no rewording
//      escapes.
//   2. It never decides whether two corroborating instances are clinically
//      independent. Only the user can, so only a user-confirmed instance
//      counts one (decision 3). Turn counts, row counts and timestamps are
//      NOT used as proxies for independence.
//   3. It never treats a model self-report as a promotion. `level:
//      'working_formulation'` yields `leading`, never `established`.
//
// ---------------------------------------------------------------------------
// TARGET AND MECHANISM ARE NOT SYMMETRIC
// ---------------------------------------------------------------------------
//
// A mechanism is a CLAIM ABOUT the user — a causal explanation competing in a
// differential (§3b, §5). §1 treats the user's confirmation as evidence
// toward a threshold, never as the threshold: that is why it also demands
// corroboration and a won differential.
//
// A Target is the USER'S OWN ACCOUNT, ratified. §4.2 — "the user has
// recognised the core as theirs" — makes recognition CONSTITUTIVE, not
// evidential. There is no deeper fact the recognition is evidence for.
//
// Hence the two contradiction rules differ, by owner ruling and not by
// oversight:
//
//   Mechanism contradiction falsifies a rival claim → permanent record AND a
//   freshness bar: a newly user-confirmed instance is required afterwards.
//
//   Target contradiction withdraws a recognition → permanent record ONLY.
//   The repair is a better sentence, checked with the user. Requiring new
//   episodes to fix a wording problem would be a category error, and would
//   lock a user out of Rung 2 for saying "that's not quite me".

import type {
  TaskContract,
  TherapeuticTarget,
  MechanismCandidate,
} from '../stateReport/schema';
import type { EvidenceSet, EvidenceExchange, EvidenceKind } from './evidence';
import { EMPTY_EVIDENCE } from './evidence';

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

/**
 * Code's verdict on the Target. Distinct from the model's self-reported
 * `target.status` (`proposed | held`), which is a claim, not a finding.
 */
export const TARGET_VALIDATED_STATUSES = ['none', 'proposed', 'established'] as const;
export type TargetValidatedStatus = (typeof TARGET_VALIDATED_STATUSES)[number];

/**
 * Code's verdict on the mechanism differential.
 *
 *   none        — no differential represented
 *   candidate   — readings held, none self-reported as leading
 *   leading     — a reading SELF-REPORTS 'working_formulation'. The model's
 *                 claim, recorded for review. NOT a promotion.
 *   established — §3b met on code-owned evidence.
 */
export const MECHANISM_VALIDATED_STATUSES = [
  'none',
  'candidate',
  'leading',
  'established',
] as const;
export type MechanismValidatedStatus = (typeof MECHANISM_VALIDATED_STATUSES)[number];

/** The depth ladder of MIDDLE_LAYER.md §6. */
export type LicensedRung = 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Reason codes — a CLOSED set. No user content, no clinical free text.
// ---------------------------------------------------------------------------

export const SUFFICIENCY_REASONS = {
  // --- Target ---
  TARGET_ABSENT: 'TARGET_ABSENT',
  TARGET_PHENOMENON_MISSING: 'TARGET_PHENOMENON_MISSING',
  TARGET_IN_THEIR_TERMS_MISSING: 'TARGET_IN_THEIR_TERMS_MISSING',
  TARGET_DIRECTION_MISSING: 'TARGET_DIRECTION_MISSING',
  /** §1(4) — provenance absent. Unknown earns no credit. */
  TARGET_PROVENANCE_UNKNOWN: 'TARGET_PROVENANCE_UNKNOWN',
  /** §1(4) — clinician-supplied and unconfirmed; cannot be load-bearing. */
  TARGET_PROVENANCE_CLINICIAN_ONLY: 'TARGET_PROVENANCE_CLINICIAN_ONLY',
  /** §4.2 — no user-confirmed recognition exchange (owner decision 2). */
  TARGET_RECOGNITION_UNCONFIRMED: 'TARGET_RECOGNITION_UNCONFIRMED',
  /** §4.2 — recognition withdrawn; a fresh one is required. */
  TARGET_AWAITING_FRESH_RECOGNITION: 'TARGET_AWAITING_FRESH_RECOGNITION',
  /** §4.4 — fewer than two USER-CONFIRMED distinct instances. */
  TARGET_CORROBORATION_UNCONFIRMED: 'TARGET_CORROBORATION_UNCONFIRMED',
  TARGET_ESTABLISHED: 'TARGET_ESTABLISHED',

  // --- Mechanism ---
  MECHANISM_DIFFERENTIAL_ABSENT: 'MECHANISM_DIFFERENTIAL_ABSENT',
  MECHANISM_NONE_LEADING: 'MECHANISM_NONE_LEADING',
  MECHANISM_PROVENANCE_UNKNOWN: 'MECHANISM_PROVENANCE_UNKNOWN',
  MECHANISM_PROVENANCE_CLINICIAN_ONLY: 'MECHANISM_PROVENANCE_CLINICIAN_ONLY',
  /** §1(2) — never put to the user, or not yet answered on a later turn. */
  MECHANISM_OFFER_UNCONFIRMED: 'MECHANISM_OFFER_UNCONFIRMED',
  /** §1(2) — the user contradicted this reading. */
  MECHANISM_CANDIDATE_CONTRADICTED: 'MECHANISM_CANDIDATE_CONTRADICTED',
  /** §1(3) — fewer than two USER-CONFIRMED distinct instances. */
  MECHANISM_CORROBORATION_UNCONFIRMED: 'MECHANISM_CORROBORATION_UNCONFIRMED',
  /** §1(1) structural — a rival was never discriminated against on confirmed evidence. */
  MECHANISM_ALTERNATIVES_UNTESTED: 'MECHANISM_ALTERNATIVES_UNTESTED',
  /** §1(1) clinical — the model has not claimed this reading leads. */
  MECHANISM_NOT_CLAIMED_LEADING: 'MECHANISM_NOT_CLAIMED_LEADING',
  /** Owner decision 4 — a contradiction stands; new confirmed evidence required. */
  MECHANISM_AWAITING_POST_CONTRADICTION_EVIDENCE:
    'MECHANISM_AWAITING_POST_CONTRADICTION_EVIDENCE',
  MECHANISM_ESTABLISHED: 'MECHANISM_ESTABLISHED',
} as const;

export type SufficiencyReason =
  (typeof SUFFICIENCY_REASONS)[keyof typeof SUFFICIENCY_REASONS];

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

export type TargetVerdict = {
  status: TargetValidatedStatus;
  established: boolean;
  reasons: SufficiencyReason[];
  parts: {
    phenomenon: boolean;
    inTheirTerms: boolean;
    direction: boolean;
    /** USER-CONFIRMED instances only. Unresolved keys are not counted. */
    corroborationCount: number;
  };
};

export type MechanismVerdict = {
  status: MechanismValidatedStatus;
  established: boolean;
  reasons: SufficiencyReason[];
  candidateCount: number;
  /** Self-reporting 'working_formulation'. A claim, not a finding. */
  leadingCount: number;
  /** §1 conditions code could not decide. Empty since PR 4b. */
  undecidable: SufficiencyReason[];
};

export type SufficiencyVerdict = {
  target: TargetVerdict;
  mechanism: MechanismVerdict;
  licensedRung: LicensedRung;
  /**
   * Observability only (owner ruling): how many times a recognition has been
   * withdrawn. Repeated pressing for recognition is a clinical risk —
   * especially for a user whose Target is difficulty declining under pressure
   * — but any threshold would be an invented proxy, so this is logged and
   * NEVER gated on. The clinical guard belongs in the prompt.
   */
  recognitionContradictionCount: number;
};

/** §1(3) / §4.4 — one instance, however striking, is not enough. */
const MIN_CONFIRMED_INSTANCES = 2;

// ---------------------------------------------------------------------------
// Evidence helpers — all read-only over the code-stamped exchange set
// ---------------------------------------------------------------------------

function of(evidence: EvidenceSet, kind: EvidenceKind): EvidenceExchange[] {
  return evidence.exchanges.filter((e) => e.kind === kind);
}

/** Latest contradiction of a kind, or null. Rewording cannot escape a max(). */
function latestContradiction(
  evidence: EvidenceSet,
  kind: EvidenceKind,
): Date | null {
  let latest: Date | null = null;
  for (const e of of(evidence, kind)) {
    if (e.contradictedAt && (!latest || e.contradictedAt > latest)) {
      latest = e.contradictedAt;
    }
  }
  return latest;
}

/**
 * Owner clause 6 — the mechanism freshness bar keys off contradictions of
 * ANY kind, not just mechanism ones. §5 makes the mechanism an explanation OF
 * the Target ("Once a Target exists, the question becomes: why does this
 * pattern run"), so if the Target's recognition falls, a mechanism claim
 * about it must re-earn one fresh instance.
 */
function latestContradictionAnyKind(evidence: EvidenceSet): Date | null {
  let latest: Date | null = null;
  for (const e of evidence.exchanges) {
    if (e.contradictedAt && (!latest || e.contradictedAt > latest)) {
      latest = e.contradictedAt;
    }
  }
  return latest;
}

/** Confirmed, un-contradicted exchanges of a kind whose subject matches. */
function confirmedMatching(
  evidence: EvidenceSet,
  kind: EvidenceKind,
  subject: string,
): EvidenceExchange[] {
  return of(evidence, kind).filter(
    (e) => e.subject === subject && e.confirmedAt !== null && e.contradictedAt === null,
  );
}

/**
 * Resolve corroboration keys to USER-CONFIRMED instance exchanges.
 *
 * A key that resolves to nothing earns nothing — the model cannot corroborate
 * with an instance the user never confirmed as distinct. Distinctness is the
 * user's judgement, recorded per exchange; code only counts what came back.
 */
function resolveInstances(
  evidence: EvidenceSet,
  keys: string[] | undefined,
): EvidenceExchange[] {
  if (!keys || keys.length === 0) return [];
  const seen = new Set<string>();
  const out: EvidenceExchange[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    const match = confirmedMatching(evidence, 'instance', key)[0];
    if (match) {
      seen.add(key);
      out.push(match);
    }
  }
  return out;
}

/** §1(4). U and E carry weight; C does not, and absent earns nothing. */
function provenanceReason(
  provenance: string | undefined,
  unknownCode: SufficiencyReason,
  clinicianCode: SufficiencyReason,
): SufficiencyReason | null {
  if (provenance === 'user' || provenance === 'elicited') return null;
  if (provenance === 'clinician') return clinicianCode;
  return unknownCode;
}

// ---------------------------------------------------------------------------
// §3a — Target sufficiency
// ---------------------------------------------------------------------------

export function validateTargetSufficiency(
  target: TherapeuticTarget | undefined | null,
  evidence: EvidenceSet = EMPTY_EVIDENCE,
): TargetVerdict {
  if (!target) {
    return {
      status: 'none',
      established: false,
      reasons: [SUFFICIENCY_REASONS.TARGET_ABSENT],
      parts: { phenomenon: false, inTheirTerms: false, direction: false, corroborationCount: 0 },
    };
  }

  const confirmedInstances = resolveInstances(evidence, target.corroboration);
  const parts = {
    phenomenon: Boolean(target.phenomenon),
    inTheirTerms: Boolean(target.inTheirTerms),
    direction: Boolean(target.direction),
    corroborationCount: confirmedInstances.length,
  };

  const reasons: SufficiencyReason[] = [];
  if (!parts.phenomenon) reasons.push(SUFFICIENCY_REASONS.TARGET_PHENOMENON_MISSING);
  if (!parts.inTheirTerms) reasons.push(SUFFICIENCY_REASONS.TARGET_IN_THEIR_TERMS_MISSING);
  if (!parts.direction) reasons.push(SUFFICIENCY_REASONS.TARGET_DIRECTION_MISSING);
  if (parts.corroborationCount < MIN_CONFIRMED_INSTANCES) {
    reasons.push(SUFFICIENCY_REASONS.TARGET_CORROBORATION_UNCONFIRMED);
  }

  const provReason = provenanceReason(
    target.provenance,
    SUFFICIENCY_REASONS.TARGET_PROVENANCE_UNKNOWN,
    SUFFICIENCY_REASONS.TARGET_PROVENANCE_CLINICIAN_ONLY,
  );
  if (provReason) reasons.push(provReason);

  // §4.2 (owner decision 2) — recognition must be a code-observed event, not
  // a model report. Any wording satisfies this; only the ORDERING matters,
  // which is what keeps code out of semantic identity. A recognition
  // contradiction is permanent, so the fresh confirmation must come after the
  // latest one.
  const recognitionContradictedAt = latestContradiction(evidence, 'recognition');
  const freshRecognition = of(evidence, 'recognition').some(
    (e) =>
      e.confirmedAt !== null &&
      e.contradictedAt === null &&
      (!recognitionContradictedAt || e.confirmedAt > recognitionContradictedAt),
  );
  if (!freshRecognition) {
    reasons.push(
      recognitionContradictedAt
        ? SUFFICIENCY_REASONS.TARGET_AWAITING_FRESH_RECOGNITION
        : SUFFICIENCY_REASONS.TARGET_RECOGNITION_UNCONFIRMED,
    );
  }

  if (reasons.length > 0) {
    return { status: 'proposed', established: false, reasons, parts };
  }
  return {
    status: 'established',
    established: true,
    reasons: [SUFFICIENCY_REASONS.TARGET_ESTABLISHED],
    parts,
  };
}

// ---------------------------------------------------------------------------
// §3b — Mechanism sufficiency
// ---------------------------------------------------------------------------

function evaluateCandidate(
  candidate: MechanismCandidate,
  others: MechanismCandidate[],
  evidence: EvidenceSet,
  contradictionFloor: Date | null,
): SufficiencyReason[] {
  const reasons: SufficiencyReason[] = [];

  // §1(4) — provenance.
  const provReason = provenanceReason(
    candidate.provenance,
    SUFFICIENCY_REASONS.MECHANISM_PROVENANCE_UNKNOWN,
    SUFFICIENCY_REASONS.MECHANISM_PROVENANCE_CLINICIAN_ONLY,
  );
  if (provReason) reasons.push(provReason);

  // §1(1) clinical half — necessary, never sufficient.
  if (candidate.level !== 'working_formulation') {
    reasons.push(SUFFICIENCY_REASONS.MECHANISM_NOT_CLAIMED_LEADING);
  }

  // §1(2) — offered and confirmed on a later turn, and not contradicted.
  const contradicted = of(evidence, 'mechanism').some(
    (e) => e.subject === candidate.reading && e.contradictedAt !== null,
  );
  const confirmations = confirmedMatching(evidence, 'mechanism', candidate.reading);
  if (contradicted && confirmations.length === 0) {
    reasons.push(SUFFICIENCY_REASONS.MECHANISM_CANDIDATE_CONTRADICTED);
  }
  if (confirmations.length === 0) {
    reasons.push(SUFFICIENCY_REASONS.MECHANISM_OFFER_UNCONFIRMED);
  }

  // §1(3) — two user-confirmed distinct instances.
  const instances = resolveInstances(evidence, candidate.corroboration);
  if (instances.length < MIN_CONFIRMED_INSTANCES) {
    reasons.push(SUFFICIENCY_REASONS.MECHANISM_CORROBORATION_UNCONFIRMED);
  }

  // §1(1) structural half — every OTHER candidate must have been
  // discriminated against on evidence the user confirmed. This counts no
  // support strength; it encodes that the differential was actually worked
  // (§5.2). A one-candidate differential passes vacuously — the known,
  // irreducible residue: code cannot see an alternative that was never named.
  const untested = others.some(
    (o) => resolveInstances(evidence, o.countsAgainst).length === 0,
  );
  if (untested) reasons.push(SUFFICIENCY_REASONS.MECHANISM_ALTERNATIVES_UNTESTED);

  // Owner decision 4 — freshness after any contradiction.
  if (contradictionFloor) {
    const freshInstance = instances.some(
      (i) => i.confirmedAt !== null && i.confirmedAt > contradictionFloor,
    );
    const freshOffer = confirmations.some(
      (c) => c.confirmedAt !== null && c.confirmedAt > contradictionFloor,
    );
    if (!freshInstance || !freshOffer) {
      reasons.push(SUFFICIENCY_REASONS.MECHANISM_AWAITING_POST_CONTRADICTION_EVIDENCE);
    }
  }

  return reasons;
}

export function validateMechanismSufficiency(
  differential: MechanismCandidate[] | undefined | null,
  evidence: EvidenceSet = EMPTY_EVIDENCE,
): MechanismVerdict {
  if (!differential || differential.length === 0) {
    return {
      status: 'none',
      established: false,
      reasons: [SUFFICIENCY_REASONS.MECHANISM_DIFFERENTIAL_ABSENT],
      candidateCount: 0,
      leadingCount: 0,
      undecidable: [],
    };
  }

  const leading = differential.filter((c) => c.level === 'working_formulation');
  const contradictionFloor = latestContradictionAnyKind(evidence);

  let bestReasons: SufficiencyReason[] | null = null;
  for (const candidate of differential) {
    const others = differential.filter((c) => c !== candidate);
    const reasons = evaluateCandidate(candidate, others, evidence, contradictionFloor);
    if (reasons.length === 0) {
      return {
        status: 'established',
        established: true,
        reasons: [SUFFICIENCY_REASONS.MECHANISM_ESTABLISHED],
        candidateCount: differential.length,
        leadingCount: leading.length,
        undecidable: [],
      };
    }
    // Report the nearest miss — the most useful thing for a reviewer.
    if (bestReasons === null || reasons.length < bestReasons.length) {
      bestReasons = reasons;
    }
  }

  const reasons = bestReasons ?? [];
  if (leading.length === 0 && !reasons.includes(SUFFICIENCY_REASONS.MECHANISM_NONE_LEADING)) {
    reasons.push(SUFFICIENCY_REASONS.MECHANISM_NONE_LEADING);
  }

  return {
    status: leading.length > 0 ? 'leading' : 'candidate',
    established: false,
    reasons,
    candidateCount: differential.length,
    leadingCount: leading.length,
    undecidable: [],
  };
}

// ---------------------------------------------------------------------------
// §6 — the depth ladder
// ---------------------------------------------------------------------------

/**
 * Unchanged since PR 4.
 *
 *   Rung 1 — always available; no Target needed.
 *   Rung 2 — Target sufficiency (§3a) only.
 *   Rung 3 — Mechanism sufficiency (§3b). Nothing else opens it.
 */
export function deriveLicensedRung(
  targetEstablished: boolean,
  mechanismEstablished: boolean,
): LicensedRung {
  if (mechanismEstablished) return 3;
  if (targetEstablished) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Middle Layer PR 6 (2026-08-14) — reading the persisted verdict back
// ---------------------------------------------------------------------------

/**
 * The code-owned Middle Layer state, as the state block needs it.
 *
 * Read back from the two server-owned columns PR 4 writes. Deliberately NOT
 * recomputed: MIDDLE_LAYER.md §8 says "Permission derives from persisted
 * state", and the canonical rule requires the gate to be "independently
 * satisfied AND PERSISTED". Rendering a freshly recomputed verdict would
 * quietly replace persisted permission with in-flight permission.
 */
export type MiddleLayerState = {
  targetStatus: TargetValidatedStatus;
  mechanismStatus: MechanismValidatedStatus;
  /** Derived by deriveLicensedRung — never stored, never model-supplied. */
  licensedRung: LicensedRung;
  /** True when no evaluation has ever been persisted for this user. */
  neverEvaluated: boolean;
};

/** The conservative default: no evidence, Rung 1, which §6 always allows. */
export const MIDDLE_LAYER_STATE_NONE: MiddleLayerState = {
  targetStatus: 'none',
  mechanismStatus: 'none',
  licensedRung: 1,
  neverEvaluated: true,
};

/**
 * Normalise the two persisted columns into renderable state.
 *
 * Fail-safe in the same shape as normaliseClosureProcess: anything that is
 * not an exact member of the closed set — NULL from a legacy row, a value
 * written by a future version, corruption — becomes 'none', which derives
 * Rung 1. A user can never lose Rung 1 (§6 makes it unconditional), so the
 * conservative fallback costs them nothing.
 *
 * Contains NO sufficiency logic. It maps strings to unions and delegates the
 * one derivation to deriveLicensedRung, which is the same function PR 4's
 * shadow path uses. There is exactly one rung rule in this codebase.
 */
export function normaliseMiddleLayerState(raw: {
  targetStatus?: string | null;
  mechanismStatus?: string | null;
}): MiddleLayerState {
  const targetStatus = (TARGET_VALIDATED_STATUSES as readonly string[]).includes(
    raw.targetStatus ?? '',
  )
    ? (raw.targetStatus as TargetValidatedStatus)
    : 'none';
  const mechanismStatus = (MECHANISM_VALIDATED_STATUSES as readonly string[]).includes(
    raw.mechanismStatus ?? '',
  )
    ? (raw.mechanismStatus as MechanismValidatedStatus)
    : 'none';

  return {
    targetStatus,
    mechanismStatus,
    // 'established' is the ONLY status that licenses anything. 'leading' is
    // the model's own claim about a mechanism and buys nothing here.
    licensedRung: deriveLicensedRung(
      targetStatus === 'established',
      mechanismStatus === 'established',
    ),
    neverEvaluated: raw.targetStatus == null && raw.mechanismStatus == null,
  };
}

export function evaluateSufficiency(
  contract: TaskContract | null | undefined,
  evidence: EvidenceSet = EMPTY_EVIDENCE,
): SufficiencyVerdict {
  const target = validateTargetSufficiency(contract?.target, evidence);
  const mechanism = validateMechanismSufficiency(contract?.mechanismDifferential, evidence);
  return {
    target,
    mechanism,
    licensedRung: deriveLicensedRung(target.established, mechanism.established),
    recognitionContradictionCount: of(evidence, 'recognition').filter(
      (e) => e.contradictedAt !== null,
    ).length,
  };
}
