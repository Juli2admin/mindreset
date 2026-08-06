// The Journey session-boundary constant, in a leaf module of its own.
//
// PR 5 / Bundle C — session boundary heuristic. Aligns with the 4-hour
// threshold delayedCheck/signal.ts already uses for the soft check-in
// trigger; the same threshold marks a new session.
//
// It lives here rather than in state/load.ts because closure/process.ts needs
// it too, and load.ts now imports closure/process.ts — importing the constant
// straight from load.ts would form a cycle and leave it in the temporal dead
// zone at module-init time. state/load.ts re-exports it, so every existing
// import site is unchanged.
export const SESSION_BOUNDARY_MS = 4 * 60 * 60 * 1000;
