// Freshness bound for a clinical measurement. Extracted 2026-08-08.
//
// WHY THIS FILE EXISTS. The constant's home is closure/guard.ts, and it still
// reads as guard policy — but guard.ts imports SESSION_BOUNDARY_MS from
// state/load.ts, so state/load.ts cannot import back from guard.ts without
// closing a cycle. The working-memory projection in state/load.ts needs the
// same bound to decide whether a stability reading is still current.
//
// Same fix, same reason, same shape as state/session-boundary.ts: one
// constant, one meaning, its own module, re-exported from guard.ts so every
// existing import site keeps working unchanged.

/**
 * How far a clinical measurement may lag the server clock before it stops
 * counting as current. Used by the closure guard against a model-claimed
 * `measuredAt`, and by the working-memory projection to drop a stability
 * reading rather than present a stale one as if it were fresh.
 */
export const MAX_MEASUREMENT_AGE_MS = 30 * 60 * 1000; // 30 minutes
