// Middle Layer PR 4 (2026-08-13) — sufficiency validation and rung
// derivation, SHADOW MODE.
//
// Everything in this file is PURE and READ-ONLY with respect to clinical
// behaviour. It computes what the Middle Layer would license, records that
// verdict, and licenses nothing. No caller gates depth, blocks a practice,
// changes a route, or alters the prompt on the strength of these values.
//
// ---------------------------------------------------------------------------
// WHAT CODE CAN ACTUALLY PROVE
// ---------------------------------------------------------------------------
//
// The approved standard is docs/journey/MIDDLE_LAYER.md: §3a Target
// sufficiency (the four parts of §4) and §3b Mechanism sufficiency (one
// reading at WORKING FORMULATION under §1's four conditions, against its own
// differential). PRs 2 and 3 persist a specific, limited set of evidence.
// The gap between the standard and the evidence is the whole story of this
// file, and it is deliberately NOT papered over:
//
//   TARGET (§4) — 3 parts fully checkable, 1 partially:
//     §4.1 phenomenon          — presence is checkable.
//     §4.2 in their terms      — presence IS checkable, and §4.2's
//                                "(E-provenance)" is checkable too: PR 2's
//                                union tells us whether the user said it or
//                                confirmed it. 'clinician' and NULL fail.
//     §4.3 direction           — presence is checkable.
//     §4.4 corroborated pattern— the COUNT of corroborating sources is
//                                checkable. Their INDEPENDENCE is not: two
//                                strings cannot be shown by code to come
//                                from genuinely separate episodes. So a
//                                count of >= 2 is treated as NECESSARY, not
//                                sufficient, and every established Target
//                                carries an explicit residual reason code
//                                saying so. Code never claims it verified
//                                independence.
//
//   MECHANISM (§1's four conditions) — 1 of 4 checkable:
//     §1(1) better supported than each realistic alternative
//           — NOT DERIVABLE. We hold supports[]/countsAgainst[] as free
//             text. Counting them would measure verbosity, not support.
//     §1(2) survived a genuine opportunity for the user to correct it
//           — NOT DERIVABLE. The closest evidence is provenance
//             'elicited', but PR 2 defines that as "the clinician offered
//             it and the user confirmed OR CORRECTED it". A corrected
//             reading has precisely NOT survived, and the stored value
//             cannot distinguish the two cases.
//     §1(3) independent corroboration
//           — NOT REPRESENTED AT ALL. MechanismCandidate has no
//             corroboration field; PR 3 put that field on the Target only.
//     §1(4) core claims are U or E; a C link cannot be load-bearing
//           — FULLY DERIVABLE from PR 2's provenance.
//
// Three of four mechanism conditions therefore cannot be decided from the
// evidence that exists. This validator does NOT invent proxies for them.
// It runs the check it can run, records the three it cannot, and FAILS
// CLOSED: mechanism sufficiency is never met, so Rung 3 is never derived.
// That is a true statement about the current system, not a limitation of
// the code — and closing the gap is a representation question for a later
// PR, not something this one may quietly assume away.

import type {
  TaskContract,
  TherapeuticTarget,
  MechanismCandidate,
} from '../stateReport/schema';

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

/**
 * Code's verdict on the Target. Distinct from the model's self-reported
 * `target.status` (`proposed | held`), which is a claim, not a finding.
 *
 *   none        — no Target represented at all
 *   proposed    — a Target exists but has not met §3a
 *   established — §3a met, to the extent code can verify it
 */
export const TARGET_VALIDATED_STATUSES = ['none', 'proposed', 'established'] as const;
export type TargetValidatedStatus = (typeof TARGET_VALIDATED_STATUSES)[number];

/**
 * Code's verdict on the mechanism differential.
 *
 *   none        — no differential represented
 *   candidate   — one or more readings held, none self-reported as leading
 *   leading     — a reading SELF-REPORTS level 'working_formulation'. This is
 *                 the model's claim, recorded for review. It is explicitly
 *                 NOT a validated promotion — see 'established'.
 *   established — §3b met. Currently unreachable; see the header.
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
  /** §4.4 — fewer than two corroborating sources recorded. */
  TARGET_CORROBORATION_INSUFFICIENT: 'TARGET_CORROBORATION_INSUFFICIENT',
  /** §1(4) — provenance absent. Unknown earns no credit. */
  TARGET_PROVENANCE_UNKNOWN: 'TARGET_PROVENANCE_UNKNOWN',
  /** §1(4) — clinician-supplied and unconfirmed; cannot be load-bearing. */
  TARGET_PROVENANCE_CLINICIAN_ONLY: 'TARGET_PROVENANCE_CLINICIAN_ONLY',
  TARGET_ESTABLISHED: 'TARGET_ESTABLISHED',
  /**
   * Residual attached to EVERY established Target: the corroboration count
   * was met, but code cannot verify the sources are genuinely independent
   * (§1's corroboration standard). Recorded so the shadow log never reads
   * as a stronger claim than it is.
   */
  TARGET_INDEPENDENCE_NOT_CODE_VERIFIABLE: 'TARGET_INDEPENDENCE_NOT_CODE_VERIFIABLE',

  // --- Mechanism ---
  MECHANISM_DIFFERENTIAL_ABSENT: 'MECHANISM_DIFFERENTIAL_ABSENT',
  /** No candidate self-reports level 'working_formulation'. */
  MECHANISM_NONE_LEADING: 'MECHANISM_NONE_LEADING',
  /** §1(4) — the leading candidate is clinician-supplied or unattributed. */
  MECHANISM_PROVENANCE_UNKNOWN: 'MECHANISM_PROVENANCE_UNKNOWN',
  MECHANISM_PROVENANCE_CLINICIAN_ONLY: 'MECHANISM_PROVENANCE_CLINICIAN_ONLY',
  /** §1(4) satisfied by the leading candidate. */
  MECHANISM_PROVENANCE_OK: 'MECHANISM_PROVENANCE_OK',
  /** §1(1) — not derivable from free-text evidence lists. */
  MECHANISM_COMPARATIVE_SUPPORT_NOT_DERIVABLE:
    'MECHANISM_COMPARATIVE_SUPPORT_NOT_DERIVABLE',
  /** §1(2) — 'elicited' conflates confirmed with corrected. */
  MECHANISM_CORRECTION_SURVIVAL_NOT_DERIVABLE:
    'MECHANISM_CORRECTION_SURVIVAL_NOT_DERIVABLE',
  /** §1(3) — MechanismCandidate has no corroboration field. */
  MECHANISM_INDEPENDENT_CORROBORATION_NOT_REPRESENTED:
    'MECHANISM_INDEPENDENT_CORROBORATION_NOT_REPRESENTED',
  /**
   * Terminal: mechanism sufficiency cannot be decided from the persisted
   * evidence, so it is refused. Present on EVERY evaluation.
   */
  MECHANISM_FAIL_CLOSED: 'MECHANISM_FAIL_CLOSED',
} as const;

export type SufficiencyReason =
  (typeof SUFFICIENCY_REASONS)[keyof typeof SUFFICIENCY_REASONS];

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

export type TargetVerdict = {
  status: TargetValidatedStatus;
  /** True only for status 'established'. */
  established: boolean;
  reasons: SufficiencyReason[];
  /** Which §4 parts are present. Structural, no clinical claim. */
  parts: {
    phenomenon: boolean;
    inTheirTerms: boolean;
    direction: boolean;
    corroborationCount: number;
  };
};

export type MechanismVerdict = {
  status: MechanismValidatedStatus;
  /** Always false in PR 4 — see the header. */
  established: boolean;
  reasons: SufficiencyReason[];
  candidateCount: number;
  /** Count self-reporting level 'working_formulation'. A claim, not a finding. */
  leadingCount: number;
  /** §1 conditions code could not decide. Always non-empty when a candidate exists. */
  undecidable: SufficiencyReason[];
};

export type SufficiencyVerdict = {
  target: TargetVerdict;
  mechanism: MechanismVerdict;
  licensedRung: LicensedRung;
};

/** §4.4 — the minimum number of corroborating sources. §1 rejects one. */
const MIN_CORROBORATION_SOURCES = 2;

/**
 * §1(4). U and E carry evidentiary weight; C does not, and NULL/absent
 * earns nothing. This is the one promotion condition that is fully
 * enforceable from the persisted evidence today.
 */
function provenanceReason(
  provenance: string | undefined,
  unknownCode: SufficiencyReason,
  clinicianCode: SufficiencyReason,
): SufficiencyReason | null {
  if (provenance === 'user' || provenance === 'elicited') return null;
  if (provenance === 'clinician') return clinicianCode;
  return unknownCode; // absent — unknown earns no credit
}

/**
 * §3a Target sufficiency — the four parts of §4.
 *
 * Establishes only when all four hold AND §1(4)'s provenance rule is
 * satisfied. Every established verdict also carries the independence
 * residual, so the log never overstates what was checked.
 */
export function validateTargetSufficiency(
  target: TherapeuticTarget | undefined | null,
): TargetVerdict {
  if (!target) {
    return {
      status: 'none',
      established: false,
      reasons: [SUFFICIENCY_REASONS.TARGET_ABSENT],
      parts: { phenomenon: false, inTheirTerms: false, direction: false, corroborationCount: 0 },
    };
  }

  const parts = {
    phenomenon: Boolean(target.phenomenon),
    inTheirTerms: Boolean(target.inTheirTerms),
    direction: Boolean(target.direction),
    corroborationCount: target.corroboration?.length ?? 0,
  };

  const reasons: SufficiencyReason[] = [];
  if (!parts.phenomenon) reasons.push(SUFFICIENCY_REASONS.TARGET_PHENOMENON_MISSING);
  if (!parts.inTheirTerms) reasons.push(SUFFICIENCY_REASONS.TARGET_IN_THEIR_TERMS_MISSING);
  if (!parts.direction) reasons.push(SUFFICIENCY_REASONS.TARGET_DIRECTION_MISSING);
  if (parts.corroborationCount < MIN_CORROBORATION_SOURCES) {
    reasons.push(SUFFICIENCY_REASONS.TARGET_CORROBORATION_INSUFFICIENT);
  }
  const provReason = provenanceReason(
    target.provenance,
    SUFFICIENCY_REASONS.TARGET_PROVENANCE_UNKNOWN,
    SUFFICIENCY_REASONS.TARGET_PROVENANCE_CLINICIAN_ONLY,
  );
  if (provReason) reasons.push(provReason);

  if (reasons.length > 0) {
    return { status: 'proposed', established: false, reasons, parts };
  }

  return {
    status: 'established',
    established: true,
    reasons: [
      SUFFICIENCY_REASONS.TARGET_ESTABLISHED,
      // Never dropped: the count was met, independence was not verified.
      SUFFICIENCY_REASONS.TARGET_INDEPENDENCE_NOT_CODE_VERIFIABLE,
    ],
    parts,
  };
}

/**
 * §3b Mechanism sufficiency — §1's four conditions against the differential.
 *
 * FAILS CLOSED. Three of the four conditions cannot be decided from the
 * persisted evidence (see the header), so no reading is ever promoted. The
 * verdict still reports what IS checkable — how many candidates are held,
 * how many the model claims are leading, and whether §1(4) is satisfied —
 * because that is exactly the material a reviewer needs to see.
 */
export function validateMechanismSufficiency(
  differential: MechanismCandidate[] | undefined | null,
): MechanismVerdict {
  // The §1 conditions that cannot be decided from what PR 3 persists.
  const undecidable: SufficiencyReason[] = [
    SUFFICIENCY_REASONS.MECHANISM_COMPARATIVE_SUPPORT_NOT_DERIVABLE,
    SUFFICIENCY_REASONS.MECHANISM_CORRECTION_SURVIVAL_NOT_DERIVABLE,
    SUFFICIENCY_REASONS.MECHANISM_INDEPENDENT_CORROBORATION_NOT_REPRESENTED,
  ];

  if (!differential || differential.length === 0) {
    return {
      status: 'none',
      established: false,
      reasons: [
        SUFFICIENCY_REASONS.MECHANISM_DIFFERENTIAL_ABSENT,
        SUFFICIENCY_REASONS.MECHANISM_FAIL_CLOSED,
      ],
      candidateCount: 0,
      leadingCount: 0,
      undecidable: [],
    };
  }

  const leading = differential.filter((c) => c.level === 'working_formulation');
  const reasons: SufficiencyReason[] = [];

  if (leading.length === 0) {
    reasons.push(SUFFICIENCY_REASONS.MECHANISM_NONE_LEADING);
  } else {
    // §1(4) is checkable even though the rest are not. A leading candidate
    // that fails it would be refused on that ground alone; report it, so a
    // reviewer can see the difference between "refused because unprovable"
    // and "refused because the provenance rule actually failed".
    const anyProvenanceOk = leading.some(
      (c) =>
        provenanceReason(
          c.provenance,
          SUFFICIENCY_REASONS.MECHANISM_PROVENANCE_UNKNOWN,
          SUFFICIENCY_REASONS.MECHANISM_PROVENANCE_CLINICIAN_ONLY,
        ) === null,
    );
    if (anyProvenanceOk) {
      reasons.push(SUFFICIENCY_REASONS.MECHANISM_PROVENANCE_OK);
    } else {
      const first = leading[0];
      reasons.push(
        provenanceReason(
          first.provenance,
          SUFFICIENCY_REASONS.MECHANISM_PROVENANCE_UNKNOWN,
          SUFFICIENCY_REASONS.MECHANISM_PROVENANCE_CLINICIAN_ONLY,
        ) ?? SUFFICIENCY_REASONS.MECHANISM_PROVENANCE_UNKNOWN,
      );
    }
  }

  reasons.push(...undecidable);
  reasons.push(SUFFICIENCY_REASONS.MECHANISM_FAIL_CLOSED);

  return {
    // 'leading' records the model's claim. It is NOT a promotion.
    status: leading.length > 0 ? 'leading' : 'candidate',
    established: false,
    reasons,
    candidateCount: differential.length,
    leadingCount: leading.length,
    undecidable,
  };
}

/**
 * §6's depth ladder, as a pure function of the two sufficiencies.
 *
 *   Rung 1 — always available; no Target needed.
 *   Rung 2 — Target sufficiency (§3a) only.
 *   Rung 3 — Mechanism sufficiency (§3b). Nothing else opens it.
 *
 * Note the asymmetry, which is §3b's point: an established mechanism
 * without an established Target still yields Rung 3 by the letter of §6,
 * but that state is not reachable in practice — and it is not reachable at
 * all today, because mechanism sufficiency fails closed.
 */
export function deriveLicensedRung(
  targetEstablished: boolean,
  mechanismEstablished: boolean,
): LicensedRung {
  if (mechanismEstablished) return 3;
  if (targetEstablished) return 2;
  return 1;
}

/**
 * Full shadow evaluation of a stored task contract.
 *
 * A legacy contract — or none at all — yields Rung 1, which is correct
 * rather than merely safe: §6 makes Rung 1 unconditionally available, so a
 * user with no Middle Layer data loses nothing.
 */
export function evaluateSufficiency(
  contract: TaskContract | null | undefined,
): SufficiencyVerdict {
  const target = validateTargetSufficiency(contract?.target);
  const mechanism = validateMechanismSufficiency(contract?.mechanismDifferential);
  return {
    target,
    mechanism,
    licensedRung: deriveLicensedRung(target.established, mechanism.established),
  };
}
