// Middle Layer PR 8′ (2026-08-14) — the Rung-3 persistence guard.
//
// PR 7′ stopped unlicensed Rung-3 signals earning ADVANCEMENT credit. This
// stops the same class of work becoming AUTHORITATIVE PERSISTED STATE —
// memory the Clinician reads back next turn as established fact.
//
// The two are separate because the audit found a Rung-3 emission reaches
// downstream systems by two independent routes: the archived state report
// (which history.ts re-parses for the stage gates) and persisted DB rows.
// Closing one never closed the other.
//
// WHAT THIS REFUSES. Three persistence paths, and only three:
//
//   foreignFileReleased  → releaseClaimedAt   (a claimed symbolic return)
//   releaseConfirmed     → releasedAt         (the authoritative release)
//   identityAnchor       → identityAnchorEncrypted + identityAnchorSetAt
//
// `cleanIdentityStatement` and `symbolicIdentityMap` are deliberately
// absent: they are never persisted to any row. They reach the stage gates
// only through the archived report, so PR 7′ already owns them entirely and
// there is nothing here to refuse.
//
// WHAT IT NEVER TOUCHES — permanent exemptions, owner-ratified:
//
//   * `releaseInvalidated`. Demotion and correction must work at every rung.
//     A user whose release failed must always be able to reopen it; refusing
//     that would trap them in a state they have already disowned.
//   * `lastDeepLayerContactAt`. If unlicensed deep work happened, the
//     48/72-hour aftercare check-in must still fire. Suppressing it would
//     remove care from precisely the session that most needs it — a
//     fail-dangerous refusal.
//   * `practiceRun.depth`. A stage-phase label, never a rung proxy.
//   * The archived state report. Nothing here rewrites or deletes it; the
//     claim stays visible in the Inspector exactly as the model wrote it.
//
// NOT GATED, deliberately: `partsTouched`, generic `practiceRun` and family,
// `foreignFilesTouched` (identification, not release), generic imagery, the
// Personal Anchor. Each spans Rung 2 and Rung 3 depending on clinical
// meaning, and gating them by field name would refuse Rung-2 work.

import { normaliseMiddleLayerState } from './sufficiency';

/** Closed set of refusal codes. No user content, no clinical free text. */
export const RUNG3_PERSISTENCE_REFUSED = {
  FOREIGN_FILE_RELEASED: 'foreignFileReleased',
  RELEASE_CONFIRMED: 'releaseConfirmed',
  IDENTITY_ANCHOR: 'identityAnchor',
} as const;

export type Rung3PersistenceField =
  (typeof RUNG3_PERSISTENCE_REFUSED)[keyof typeof RUNG3_PERSISTENCE_REFUSED];

/**
 * Is Rung-3 work licensed, given the two SERVER-OWNED columns PR 4's
 * validator writes?
 *
 * PURE — it takes the row the save layer has already fetched rather than
 * querying again, so the guard adds no round-trip to the hot path. The rung
 * comes from the same normaliser PR 6 uses: one rung rule in the codebase,
 * no recomputation, no model-emitted status.
 *
 * FAILS CLOSED. A missing row, a NULL column, a value from some future
 * version — all normalise to Rung 1 and refuse. Refusing to persist is the
 * safe direction, and Rung 1 is unconditionally available (§6), so a user
 * loses nothing they were entitled to.
 */
export function isRung3Licensed(
  row: {
    middleLayerTargetStatus?: string | null;
    middleLayerMechanismStatus?: string | null;
  } | null,
): boolean {
  if (!row) return false;
  return (
    normaliseMiddleLayerState({
      targetStatus: row.middleLayerTargetStatus,
      mechanismStatus: row.middleLayerMechanismStatus,
    }).licensedRung >= 3
  );
}

/**
 * Record a refusal. `console.info`, not `warn` or `error`: an unlicensed
 * Rung-3 claim is the system working as designed, not a fault.
 *
 * Codes and the userId only — the claim's content stays in the encrypted
 * archived report, where it belongs.
 */
export function logRung3PersistenceRefusal(
  userId: string,
  field: Rung3PersistenceField,
): void {
  console.info('[journey/middle-layer] rung3 persistence refused', {
    userId,
    field,
    reason: 'licensed_rung_below_3',
  });
}
