// Middle Layer PR 7′ (2026-08-14) — the Rung-3 advancement-signal guard.
//
// WHAT THIS IS FOR. A user must not be advanced through a stage on the
// strength of Rung-3 work the evidence never licensed. MIDDLE_LAYER.md §6
// puts foreign-material release and identity-level work at Rung 3; §0's
// canonical rule says recognition never licenses intervention, and
// escalation requires the gate to be satisfied and persisted. Until PR 7′
// those signals reached the stage gates with no check at all.
//
// WHAT THIS IS NOT FOR. It refuses ADVANCEMENT CREDIT, nothing else.
//
//   * No report content is rewritten. The emission stays in the archived
//     JourneyTurn exactly as the model wrote it, and the Inspector still
//     shows it. What changes is only whether a gate may count it.
//   * No capture is refused — persistence is PR 8′'s job, deliberately not
//     this one. `releasedAt` is still stamped; it simply stops being an
//     advancement key while unlicensed.
//   * No user-response evidence is touched. `somaticRelease` and
//     `bodyConfirmation` are the USER's answers, not the Clinician's
//     licensing claim, and they keep working exactly as before.
//   * `releaseInvalidated` is nowhere in this file. Demotion is never
//     gated (owner ruling 3).
//   * `lastDeepLayerContactAt` is nowhere in this file. If unlicensed deep
//     work happened, the 48/72-hour aftercare check-in must still fire —
//     gating that would be fail-dangerous.
//   * `practiceRun.depth` is nowhere in this file. It is a stage-phase
//     label, not a rung, and is never a proxy for one.
//
// The allowlist is EXPLICIT and per-ID. Not `stage_N.*`, not stage number,
// not practice family, not generic parts work, not generic imagery, not
// foreign-material identification — every one of those spans Rung 2 and
// Rung 3 depending on clinical meaning, and code cannot tell them apart
// without reading prose.

import type { JourneyState } from '../state/types';

/**
 * Move IDs whose semantics are inherently Rung-3 work (owner-approved
 * 2026-08-14, each verified against CANONICAL_MOVES and its documented
 * meaning in journey-master.md):
 *
 *   stage_5.symbolic_return            — "symbolic return of the burden"
 *                                        = foreign-material release, §6's
 *                                        named Rung-3 exemplar
 *   stage_5.clean_identity_statement   — "this is mine; that is not mine"
 *                                        = identity-level
 *   stage_6.identity_anchoring_ritual  — "forging the Identity Anchor"
 *                                        = identity-level
 *   stage_7.symbolic_identity_map      — the symbolic map
 *                                        = identity-level
 *
 * Their siblings are deliberately absent. `stage_5.origin_voice_mapping` is
 * identification, `stage_4.first_contact` is meeting a part — both Rung-2
 * work that must keep counting.
 */
export const RUNG_3_MOVE_IDS: ReadonlySet<string> = new Set([
  'stage_5.symbolic_return',
  'stage_5.clean_identity_statement',
  'stage_6.identity_anchoring_ritual',
  'stage_7.symbolic_identity_map',
]);

/**
 * Is Rung-3 work licensed for this user?
 *
 * The ONLY licensing input is the PERSISTED rung — `state.middleLayer`,
 * read by PR 6 from the two server-owned columns PR 4's validator writes.
 * Nothing here recomputes sufficiency, and nothing here reads a
 * model-emitted status: a status the model emits is a claim, and this is a
 * permission check.
 */
export function rung3SignalsLicensed(state: JourneyState): boolean {
  return state.middleLayer.licensedRung >= 3;
}

/** Reason codes, so a refusal is visible in the router log rather than silent. */
export const RUNG3_REFUSED = {
  SYMBOLIC_RETURN: 'rung3_unlicensed:symbolic_return',
  CLEAN_IDENTITY_STATEMENT: 'rung3_unlicensed:clean_identity_statement',
  IDENTITY_ANCHOR: 'rung3_unlicensed:identity_anchor',
  SYMBOLIC_IDENTITY_MAP: 'rung3_unlicensed:symbolic_identity_map',
  MOVE_LANE: 'rung3_unlicensed:move_lane',
} as const;
