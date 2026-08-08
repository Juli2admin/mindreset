// Tests for the Activated Closure transition model — Phase 1 (2026-08-05).
//
// This module is the SINGLE source of truth for closure process transitions.
// The rules under test are the approved process semantics:
//
//   * CLOSED means one Activated Closure sequence completed. It does NOT mean
//     the chat is permanently closed — a new substantive turn returns the
//     process to NONE.
//   * An unfinished sequence the user leaves for more than four hours is
//     RETAINED as INCOMPLETE. Nothing from it is reused; the record survives.
//   * Only the transitions listed in ALLOWED_TRANSITIONS are legal.
//   * The stabilisation round cap is enforced as a field constraint.
//
// Everything here is pure — no Prisma, no clock reads, no model output.

import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  CLOSURE_PROCESS_NONE,
  CLOSURE_PROCESS_STATES,
  INTERRUPTED_PROCESS_MS,
  MAX_STABILISATION_ROUNDS,
  blocksProgression,
  computeScoreChange,
  decideClosureOutcome,
  isActiveProcessState,
  isAllowedTransition,
  isTerminalProcessState,
  recordCapturedScore,
  normaliseClosureProcess,
  resolveClosureProcessForTurn,
  transitionClosureProcess,
  type ClosureProcess,
  type ClosureProcessState,
} from './process';
import { SESSION_BOUNDARY_MS } from '../state/session-boundary';
// Imported here, not into process.ts: guard.ts -> state/load.ts ->
// closure/process.ts, so a process.ts import of guard would close a cycle.
// decideClosureOutcome therefore takes `threshold` as a parameter and the
// pure module holds no opinion about its value.
import { STABILITY_CLOSE_THRESHOLD } from './guard';

const NOW = new Date('2026-08-05T12:00:00.000Z');
const at = (msAgo: number) => new Date(NOW.getTime() - msAgo);

function makeProcess(overrides: Partial<ClosureProcess> = {}): ClosureProcess {
  return { ...CLOSURE_PROCESS_NONE, ...overrides };
}

// ---------------------------------------------------------------------------
// Default state for existing users
// ---------------------------------------------------------------------------
describe('default process state', () => {
  it('is NONE with no route, no timestamps and no rounds', () => {
    expect(CLOSURE_PROCESS_NONE).toEqual({
      state: 'NONE',
      route: null,
      enteredAt: null,
      transitionedAt: null,
      roundCount: 0,
      completedAt: null,
      incompleteAt: null,
      initialScore: null,
      initialScoreAt: null,
      postScore: null,
      postScoreAt: null,
      freezeInterruptedAt: null,
    });
  });

  it('an existing user with no closure columns set normalises to NONE', () => {
    // Exactly what a pre-migration row looks like once the additive migration
    // has defaulted it: state 'NONE', everything else null/0.
    expect(
      normaliseClosureProcess({
        state: 'NONE',
        route: null,
        enteredAt: null,
        transitionedAt: null,
        roundCount: 0,
        completedAt: null,
        incompleteAt: null,
      }),
    ).toEqual(CLOSURE_PROCESS_NONE);
  });

  it('NONE never blocks progression', () => {
    expect(blocksProgression('NONE')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Terminal / active meanings
// ---------------------------------------------------------------------------
describe('terminal and non-terminal meanings', () => {
  it('CLOSED and INCOMPLETE are terminal and never block progression', () => {
    for (const s of ['CLOSED', 'INCOMPLETE'] as ClosureProcessState[]) {
      expect(isTerminalProcessState(s)).toBe(true);
      expect(isActiveProcessState(s)).toBe(false);
      expect(blocksProgression(s)).toBe(false);
    }
  });

  it('NONE is neither terminal nor active', () => {
    expect(isTerminalProcessState('NONE')).toBe(false);
    expect(isActiveProcessState('NONE')).toBe(false);
  });

  it('every mid-sequence state is active and blocks progression', () => {
    const active: ClosureProcessState[] = [
      'AWAITING_INITIAL_SCORE',
      'DELIVERING_STABILISATION',
      'AWAITING_POST_SCORE',
      'AWAITING_CLOSE_CONFIRMATION',
      'HUMAN_SUPPORT',
    ];
    for (const s of active) {
      expect(isActiveProcessState(s)).toBe(true);
      expect(isTerminalProcessState(s)).toBe(false);
      expect(blocksProgression(s)).toBe(true);
    }
  });

  it('classifies all eight states exactly once', () => {
    for (const s of CLOSURE_PROCESS_STATES) {
      const buckets = [
        s === 'NONE',
        isActiveProcessState(s),
        isTerminalProcessState(s),
      ].filter(Boolean);
      expect(buckets).toHaveLength(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Allowed transitions
// ---------------------------------------------------------------------------
describe('allowed transitions', () => {
  it('walks the full ACTIVATED_CLOSE sequence', () => {
    let p = makeProcess();
    const path: ClosureProcessState[] = [
      'AWAITING_INITIAL_SCORE',
      'DELIVERING_STABILISATION',
      'AWAITING_POST_SCORE',
      'AWAITING_CLOSE_CONFIRMATION',
      'CLOSED',
    ];
    for (const to of path) {
      const r = transitionClosureProcess(p, to, { now: NOW, route: 'ACTIVATED_CLOSE' });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      p = r.process;
      expect(p.state).toBe(to);
    }
    expect(p.route).toBe('ACTIVATED_CLOSE');
    expect(p.completedAt).toEqual(NOW);
  });

  it('entry stamps route, enteredAt and a fresh round counter', () => {
    const r = transitionClosureProcess(makeProcess(), 'AWAITING_INITIAL_SCORE', {
      now: NOW,
      route: 'ACTIVATED_CLOSE',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.process).toMatchObject({
      state: 'AWAITING_INITIAL_SCORE',
      route: 'ACTIVATED_CLOSE',
      enteredAt: NOW,
      transitionedAt: NOW,
      roundCount: 0,
    });
  });

  it('NORMAL_CLOSE may complete straight from NONE', () => {
    const r = transitionClosureProcess(makeProcess(), 'CLOSED', {
      now: NOW,
      route: 'NORMAL_CLOSE',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.process.state).toBe('CLOSED');
    expect(r.process.route).toBe('NORMAL_CLOSE');
    expect(r.process.completedAt).toEqual(NOW);
  });

  it('every state can be left — no dead ends in the graph', () => {
    for (const s of CLOSURE_PROCESS_STATES) {
      expect(ALLOWED_TRANSITIONS[s].length).toBeGreaterThan(0);
    }
  });

  it('an interrupted sequence can be abandoned from any active state', () => {
    for (const s of CLOSURE_PROCESS_STATES.filter(isActiveProcessState)) {
      expect(isAllowedTransition(s, 'INCOMPLETE')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Rejected invalid transitions
// ---------------------------------------------------------------------------
describe('rejected invalid transitions', () => {
  // Product simplification 2026-08-08: entry -> CLOSED is now the CORRECT path
  // when the initial score clears the threshold. The old pin asserted the
  // opposite and is replaced by the measurement-first case below.
  it('may go from entry straight to CLOSED when the score suffices', () => {
    const p = makeProcess({ state: 'AWAITING_INITIAL_SCORE' });
    const r = transitionClosureProcess(p, 'CLOSED', { now: NOW, route: 'NORMAL_CLOSE' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.process.state).toBe('CLOSED');
    expect(r.process.route).toBe('NORMAL_CLOSE');
    expect(r.process.roundCount).toBe(0);
  });

  it('cannot go backwards from AWAITING_POST_SCORE to AWAITING_INITIAL_SCORE', () => {
    const p = makeProcess({ state: 'AWAITING_POST_SCORE', route: 'ACTIVATED_CLOSE' });
    const r = transitionClosureProcess(p, 'AWAITING_INITIAL_SCORE', {
      now: NOW,
      route: 'ACTIVATED_CLOSE',
    });
    expect(r.ok).toBe(false);
  });

  it('rejects self-transitions', () => {
    for (const s of CLOSURE_PROCESS_STATES) {
      expect(isAllowedTransition(s, s)).toBe(false);
    }
  });

  it('cannot re-enter a sequence directly from CLOSED — it must reset first', () => {
    expect(isAllowedTransition('CLOSED', 'AWAITING_INITIAL_SCORE')).toBe(false);
    expect(isAllowedTransition('CLOSED', 'NONE')).toBe(true);
  });

  it('rejects a rejected transition without mutating the record', () => {
    const p = makeProcess({ state: 'CLOSED', completedAt: at(1000) });
    const r = transitionClosureProcess(p, 'HUMAN_SUPPORT', { now: NOW });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.process).toBe(p);
  });

  // Measurement-first correction (owner decision 2026-08-08). This replaces the
  // former "requires a route when entering a sequence" pin. Entry now means only
  // "a current stability measurement is required before this session may close";
  // which route it turns out to be is decided by the user's own score.
  it('enters WITHOUT a route — the route is not yet knowable at entry', () => {
    const r = transitionClosureProcess(makeProcess(), 'AWAITING_INITIAL_SCORE', {
      now: NOW,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.process.state).toBe('AWAITING_INITIAL_SCORE');
    expect(r.process.route).toBeNull();
  });

  it('does not inherit a route from a previous attempt on re-entry', () => {
    const prior = makeProcess({
      state: 'INCOMPLETE',
      route: 'ACTIVATED_CLOSE',
      incompleteAt: at(1000),
    });
    const r = transitionClosureProcess(prior, 'AWAITING_INITIAL_SCORE', { now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.process.route).toBeNull();
  });

  it('still requires a route on the direct NONE -> CLOSED ordinary close', () => {
    const r = transitionClosureProcess(makeProcess(), 'CLOSED', { now: NOW });
    expect(r).toMatchObject({ ok: false, reason: 'route_required' });
  });
});

// ---------------------------------------------------------------------------
// Measurement-first: the initial score can end the sequence
// ---------------------------------------------------------------------------

describe('measurement-first — route resolves from the initial score', () => {
  it('allows AWAITING_INITIAL_SCORE -> CLOSED', () => {
    expect(isAllowedTransition('AWAITING_INITIAL_SCORE', 'CLOSED')).toBe(true);
  });

  it('allows AWAITING_POST_SCORE -> CLOSED', () => {
    expect(isAllowedTransition('AWAITING_POST_SCORE', 'CLOSED')).toBe(true);
  });

  it('records NORMAL_CLOSE when the initial score cleared the threshold', () => {
    const entered = transitionClosureProcess(makeProcess(), 'AWAITING_INITIAL_SCORE', {
      now: NOW,
    });
    expect(entered.ok).toBe(true);
    if (!entered.ok) return;

    const r = transitionClosureProcess(entered.process, 'CLOSED', {
      now: NOW,
      route: 'NORMAL_CLOSE',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.process.route).toBe('NORMAL_CLOSE');
    // No stabilisation ever ran.
    expect(r.process.roundCount).toBe(0);
  });

  it('records ACTIVATED_CLOSE when stabilisation is required', () => {
    const entered = transitionClosureProcess(makeProcess(), 'AWAITING_INITIAL_SCORE', {
      now: NOW,
    });
    expect(entered.ok).toBe(true);
    if (!entered.ok) return;

    const r = transitionClosureProcess(entered.process, 'DELIVERING_STABILISATION', {
      now: NOW,
      route: 'ACTIVATED_CLOSE',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.process.route).toBe('ACTIVATED_CLOSE');
    expect(r.process.roundCount).toBe(1);
  });

  it('keeps a stored route when a later transition supplies none', () => {
    const p = makeProcess({
      state: 'DELIVERING_STABILISATION',
      route: 'ACTIVATED_CLOSE',
      roundCount: 1,
    });
    const r = transitionClosureProcess(p, 'AWAITING_POST_SCORE', { now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.process.route).toBe('ACTIVATED_CLOSE');
  });
});

// ---------------------------------------------------------------------------
// Round-count field constraint
// ---------------------------------------------------------------------------
describe('stabilisation round field constraint', () => {
  it('counts rounds as stabilisation is re-delivered', () => {
    let p = makeProcess({ state: 'AWAITING_INITIAL_SCORE', route: 'ACTIVATED_CLOSE' });
    const first = transitionClosureProcess(p, 'DELIVERING_STABILISATION', { now: NOW });
    expect(first.ok && first.process.roundCount).toBe(1);
    if (!first.ok) return;

    p = transitionClosureProcess(first.process, 'AWAITING_POST_SCORE', { now: NOW })
      .process;
    const second = transitionClosureProcess(p, 'DELIVERING_STABILISATION', { now: NOW });
    expect(second.ok && second.process.roundCount).toBe(MAX_STABILISATION_ROUNDS);
  });

  it('rejects a round beyond the cap', () => {
    const p = makeProcess({
      state: 'AWAITING_POST_SCORE',
      route: 'ACTIVATED_CLOSE',
      roundCount: MAX_STABILISATION_ROUNDS,
    });
    const r = transitionClosureProcess(p, 'DELIVERING_STABILISATION', { now: NOW });
    expect(r).toMatchObject({ ok: false, reason: 'round_limit_exceeded' });
  });
});

// ---------------------------------------------------------------------------
// Deterioration during AWAITING_CLOSE_CONFIRMATION (owner decision 2026-08-05)
// ---------------------------------------------------------------------------
describe('deterioration during AWAITING_CLOSE_CONFIRMATION', () => {
  it('allows a return to AWAITING_POST_SCORE', () => {
    expect(isAllowedTransition('AWAITING_CLOSE_CONFIRMATION', 'AWAITING_POST_SCORE'))
      .toBe(true);
  });

  it('does NOT consume a stabilisation round — only delivery does', () => {
    const p = makeProcess({
      state: 'AWAITING_CLOSE_CONFIRMATION',
      route: 'ACTIVATED_CLOSE',
      roundCount: 1,
    });
    const r = transitionClosureProcess(p, 'AWAITING_POST_SCORE', { now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.process.state).toBe('AWAITING_POST_SCORE');
    expect(r.process.roundCount).toBe(1);
    expect(r.process.transitionedAt).toEqual(NOW);
  });

  it('leaves the cap reachable — one delivered round still remains after a fall-back', () => {
    // Round 1 delivered, close proposed, user deteriorates, fresh score asked
    // for. The second DELIVERED round must still be available.
    let p = makeProcess({
      state: 'AWAITING_CLOSE_CONFIRMATION',
      route: 'ACTIVATED_CLOSE',
      roundCount: 1,
    });
    p = transitionClosureProcess(p, 'AWAITING_POST_SCORE', { now: NOW }).process;
    const second = transitionClosureProcess(p, 'DELIVERING_STABILISATION', {
      now: NOW,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.process.roundCount).toBe(MAX_STABILISATION_ROUNDS);
  });

  it('a fall-back after two delivered rounds cannot start a third', () => {
    // The Phase 2 rule routes this case to HUMAN_SUPPORT; Phase 1 only has to
    // guarantee the field constraint holds.
    let p = makeProcess({
      state: 'AWAITING_CLOSE_CONFIRMATION',
      route: 'ACTIVATED_CLOSE',
      roundCount: MAX_STABILISATION_ROUNDS,
    });
    p = transitionClosureProcess(p, 'AWAITING_POST_SCORE', { now: NOW }).process;
    expect(p.roundCount).toBe(MAX_STABILISATION_ROUNDS);
    expect(
      transitionClosureProcess(p, 'DELIVERING_STABILISATION', { now: NOW }),
    ).toMatchObject({ ok: false, reason: 'round_limit_exceeded' });
    // ...and escalation stays reachable from there.
    expect(isAllowedTransition('AWAITING_POST_SCORE', 'HUMAN_SUPPORT')).toBe(true);
  });

  it('the fall-back is one-way — AWAITING_POST_SCORE cannot jump back to confirmation without a decision', () => {
    // AWAITING_POST_SCORE → AWAITING_CLOSE_CONFIRMATION IS allowed (that is the
    // "acceptable fresh score" path). What must not exist is a route that skips
    // the score entirely.
    expect(isAllowedTransition('AWAITING_POST_SCORE', 'AWAITING_CLOSE_CONFIRMATION'))
      .toBe(true);
    expect(isAllowedTransition('AWAITING_CLOSE_CONFIRMATION', 'DELIVERING_STABILISATION'))
      .toBe(false);
  });

  it('still permits the ordinary exits from AWAITING_CLOSE_CONFIRMATION', () => {
    for (const to of ['CLOSED', 'HUMAN_SUPPORT', 'INCOMPLETE'] as const) {
      expect(isAllowedTransition('AWAITING_CLOSE_CONFIRMATION', to)).toBe(true);
    }
  });
});

describe('HUMAN_SUPPORT — active human-handoff state', () => {
  it('is active, not terminal', () => {
    expect(isActiveProcessState('HUMAN_SUPPORT')).toBe(true);
    expect(isTerminalProcessState('HUMAN_SUPPORT')).toBe(false);
    expect(blocksProgression('HUMAN_SUPPORT')).toBe(true);
  });

  it('exits only to CLOSED (confirmed handoff) or INCOMPLETE (no handoff)', () => {
    expect([...ALLOWED_TRANSITIONS.HUMAN_SUPPORT].sort()).toEqual([
      'CLOSED',
      'INCOMPLETE',
    ]);
  });

  it('is reachable from every point in the sequence where escalation can arise', () => {
    for (const from of [
      'AWAITING_INITIAL_SCORE',
      'DELIVERING_STABILISATION',
      'AWAITING_POST_SCORE',
      'AWAITING_CLOSE_CONFIRMATION',
    ] as ClosureProcessState[]) {
      expect(isAllowedTransition(from, 'HUMAN_SUPPORT')).toBe(true);
    }
  });

  it('records a confirmed handoff as a completed sequence', () => {
    const p = makeProcess({
      state: 'HUMAN_SUPPORT',
      route: 'ACTIVATED_CLOSE',
      enteredAt: at(600_000),
      roundCount: 2,
    });
    const r = transitionClosureProcess(p, 'CLOSED', { now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.process.state).toBe('CLOSED');
    expect(r.process.completedAt).toEqual(NOW);
    // CLOSED here means "completed through a confirmed human handoff", not
    // "the AI independently stabilised the user". Phase 1 stores no outcome
    // field to tell those apart — see the note in process.ts.
    expect(r.process.route).toBe('ACTIVATED_CLOSE');
  });

  it('records an unconfirmed handoff as INCOMPLETE, keeping the attempt', () => {
    const enteredAt = at(600_000);
    const p = makeProcess({
      state: 'HUMAN_SUPPORT',
      route: 'ACTIVATED_CLOSE',
      enteredAt,
      roundCount: 2,
    });
    const r = transitionClosureProcess(p, 'INCOMPLETE', { now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.process.state).toBe('INCOMPLETE');
    expect(r.process.incompleteAt).toEqual(NOW);
    expect(r.process.enteredAt).toEqual(enteredAt);
    expect(r.process.roundCount).toBe(2);
  });

  it('is not re-enterable without going through a reset', () => {
    expect(isAllowedTransition('HUMAN_SUPPORT', 'AWAITING_INITIAL_SCORE')).toBe(false);
    expect(isAllowedTransition('HUMAN_SUPPORT', 'DELIVERING_STABILISATION')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Four-hour interrupted-process behaviour
// ---------------------------------------------------------------------------
describe('interrupted process → INCOMPLETE', () => {
  it('uses the same four-hour boundary as the rest of the runtime', () => {
    expect(INTERRUPTED_PROCESS_MS).toBe(SESSION_BOUNDARY_MS);
    expect(INTERRUPTED_PROCESS_MS).toBe(4 * 60 * 60 * 1000);
  });

  it('converts an unfinished sequence abandoned for over four hours', () => {
    const p = makeProcess({
      state: 'AWAITING_POST_SCORE',
      route: 'ACTIVATED_CLOSE',
      enteredAt: at(INTERRUPTED_PROCESS_MS + 60_000),
      transitionedAt: at(INTERRUPTED_PROCESS_MS + 1),
      roundCount: 1,
    });
    const r = resolveClosureProcessForTurn(p, NOW);
    expect(r.changed).toBe(true);
    expect(r.reason).toBe('interrupted_process_expired');
    expect(r.process.state).toBe('INCOMPLETE');
    expect(r.process.incompleteAt).toEqual(NOW);
  });

  it('converts exactly at the boundary', () => {
    const p = makeProcess({
      state: 'DELIVERING_STABILISATION',
      route: 'ACTIVATED_CLOSE',
      transitionedAt: at(INTERRUPTED_PROCESS_MS),
    });
    expect(resolveClosureProcessForTurn(p, NOW).process.state).toBe('INCOMPLETE');
  });

  it('leaves a sequence inside the boundary running', () => {
    const p = makeProcess({
      state: 'DELIVERING_STABILISATION',
      route: 'ACTIVATED_CLOSE',
      transitionedAt: at(INTERRUPTED_PROCESS_MS - 1),
      roundCount: 1,
    });
    const r = resolveClosureProcessForTurn(p, NOW);
    expect(r.changed).toBe(false);
    expect(r.process).toBe(p);
  });

  it('preserves the record of the abandoned attempt', () => {
    const enteredAt = at(INTERRUPTED_PROCESS_MS + 600_000);
    const p = makeProcess({
      state: 'AWAITING_POST_SCORE',
      route: 'ACTIVATED_CLOSE',
      enteredAt,
      transitionedAt: at(INTERRUPTED_PROCESS_MS + 1),
      roundCount: 2,
    });
    const { process } = resolveClosureProcessForTurn(p, NOW);
    // Route, entry time and round count are RETAINED — the approved semantics
    // keep the earlier attempt on record rather than erasing it.
    expect(process.route).toBe('ACTIVATED_CLOSE');
    expect(process.enteredAt).toEqual(enteredAt);
    expect(process.roundCount).toBe(2);
  });

  it('INCOMPLETE is retained, not silently re-armed, on the next turn', () => {
    const p = makeProcess({
      state: 'INCOMPLETE',
      route: 'ACTIVATED_CLOSE',
      enteredAt: at(INTERRUPTED_PROCESS_MS * 3),
      transitionedAt: at(INTERRUPTED_PROCESS_MS * 2),
      incompleteAt: at(INTERRUPTED_PROCESS_MS * 2),
      roundCount: 1,
    });
    const r = resolveClosureProcessForTurn(p, NOW);
    expect(r.changed).toBe(false);
    expect(r.process.state).toBe('INCOMPLETE');
  });

  it('a fresh attempt after INCOMPLETE reuses nothing from the old one', () => {
    const p = makeProcess({
      state: 'INCOMPLETE',
      route: 'ACTIVATED_CLOSE',
      enteredAt: at(INTERRUPTED_PROCESS_MS * 3),
      incompleteAt: at(INTERRUPTED_PROCESS_MS * 2),
      roundCount: 2,
    });
    const r = transitionClosureProcess(p, 'AWAITING_INITIAL_SCORE', {
      now: NOW,
      route: 'ACTIVATED_CLOSE',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.process.roundCount).toBe(0);
    expect(r.process.enteredAt).toEqual(NOW);
    // The historical marker survives as the record of the earlier attempt.
    expect(r.process.incompleteAt).toEqual(p.incompleteAt);
  });
});

// ---------------------------------------------------------------------------
// CLOSED → NONE on a new substantive turn
// ---------------------------------------------------------------------------
describe('CLOSED re-arm', () => {
  it('returns to NONE on the next substantive turn', () => {
    const completedAt = at(60_000);
    const p = makeProcess({
      state: 'CLOSED',
      route: 'ACTIVATED_CLOSE',
      enteredAt: at(600_000),
      transitionedAt: completedAt,
      completedAt,
      roundCount: 2,
    });
    const r = resolveClosureProcessForTurn(p, NOW);
    expect(r.changed).toBe(true);
    expect(r.reason).toBe('closed_reset_on_new_turn');
    expect(r.process.state).toBe('NONE');
  });

  it('clears the operational fields but keeps the completion marker', () => {
    const completedAt = at(60_000);
    const p = makeProcess({
      state: 'CLOSED',
      route: 'ACTIVATED_CLOSE',
      enteredAt: at(600_000),
      completedAt,
      roundCount: 2,
    });
    const { process } = resolveClosureProcessForTurn(p, NOW);
    expect(process.route).toBeNull();
    expect(process.enteredAt).toBeNull();
    expect(process.roundCount).toBe(0);
    expect(process.completedAt).toEqual(completedAt);
  });

  it('re-arms regardless of how long ago the sequence closed', () => {
    const old = makeProcess({
      state: 'CLOSED',
      transitionedAt: at(INTERRUPTED_PROCESS_MS * 10),
      completedAt: at(INTERRUPTED_PROCESS_MS * 10),
    });
    expect(resolveClosureProcessForTurn(old, NOW).process.state).toBe('NONE');
  });

  it('does not block progression while CLOSED, before or after the re-arm', () => {
    expect(blocksProgression('CLOSED')).toBe(false);
    expect(blocksProgression('NONE')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Defensive read of the persisted columns
// ---------------------------------------------------------------------------
describe('normaliseClosureProcess', () => {
  it('degrades an unrecognised state to NONE rather than trapping the user', () => {
    const p = normaliseClosureProcess({ state: 'SOMETHING_ELSE', roundCount: 5 });
    expect(p.state).toBe('NONE');
    expect(blocksProgression(p.state)).toBe(false);
  });

  it('treats a null state as NONE', () => {
    expect(normaliseClosureProcess({ state: null }).state).toBe('NONE');
    expect(normaliseClosureProcess({}).state).toBe('NONE');
  });

  it('keeps historical markers when degrading to NONE', () => {
    const completedAt = at(1000);
    const p = normaliseClosureProcess({ state: 'NONE', completedAt });
    expect(p.completedAt).toEqual(completedAt);
  });

  it('keeps an active state but drops an unreadable route — blocking is the safe side', () => {
    const p = normaliseClosureProcess({
      state: 'AWAITING_POST_SCORE',
      route: 'NOT_A_ROUTE',
    });
    expect(p.state).toBe('AWAITING_POST_SCORE');
    expect(p.route).toBeNull();
    expect(blocksProgression(p.state)).toBe(true);
  });

  it('clamps the round counter into range', () => {
    expect(
      normaliseClosureProcess({ state: 'AWAITING_POST_SCORE', roundCount: 99 })
        .roundCount,
    ).toBe(MAX_STABILISATION_ROUNDS);
    expect(
      normaliseClosureProcess({ state: 'AWAITING_POST_SCORE', roundCount: -3 })
        .roundCount,
    ).toBe(0);
    expect(
      normaliseClosureProcess({ state: 'AWAITING_POST_SCORE', roundCount: NaN })
        .roundCount,
    ).toBe(0);
  });

  it('round-trips every legal state', () => {
    for (const s of CLOSURE_PROCESS_STATES) {
      expect(normaliseClosureProcess({ state: s }).state).toBe(s);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 2 — score handling and the closure decision
// ---------------------------------------------------------------------------
describe('computeScoreChange', () => {
  it('is null until both scores exist', () => {
    expect(computeScoreChange(makeProcess())).toBeNull();
    expect(computeScoreChange(makeProcess({ initialScore: 4 }))).toBeNull();
    expect(computeScoreChange(makeProcess({ postScore: 7 }))).toBeNull();
  });

  it('is positive for improvement — the scale runs 1 overwhelmed to 10 grounded', () => {
    expect(computeScoreChange(makeProcess({ initialScore: 4, postScore: 7 }))).toBe(3);
  });

  it('is negative for deterioration', () => {
    expect(computeScoreChange(makeProcess({ initialScore: 9, postScore: 7 }))).toBe(-2);
  });

  it('is zero for no movement', () => {
    expect(computeScoreChange(makeProcess({ initialScore: 5, postScore: 5 }))).toBe(0);
  });
});

describe('decideClosureOutcome', () => {
  const T = STABILITY_CLOSE_THRESHOLD;

  // Product simplification 2026-08-08: a sufficient score CLOSES. The user's
  // explicit session_exit was already the consent, so there is no second
  // confirmation step to propose.
  it('at or above threshold closes', () => {
    for (const s of [T, T + 1, 10]) {
      expect(
        decideClosureOutcome({ postScore: s, roundsDelivered: 0, threshold: T }),
      ).toEqual({
        outcome: 'CLOSED',
        reason: 'score_at_or_above_threshold',
      });
    }
  });

  it('below threshold with rounds remaining stabilises again', () => {
    for (const r of [0, 1]) {
      expect(
        decideClosureOutcome({ postScore: T - 1, roundsDelivered: r, threshold: T }),
      ).toMatchObject({ outcome: 'DELIVERING_STABILISATION' });
    }
  });

  // Product simplification 2026-08-08: MindReset is self-help and provides no
  // human-support service, so the bounded rounds terminate in INCOMPLETE — the
  // honest record. The user is released, no score is fabricated, and nothing
  // claims the close completed. Crisis handling is a separate mechanism.
  it('below threshold with rounds exhausted records INCOMPLETE, never a handoff', () => {
    expect(
      decideClosureOutcome({
        postScore: T - 1,
        roundsDelivered: MAX_STABILISATION_ROUNDS,
        threshold: T,
      }),
    ).toEqual({
      outcome: 'INCOMPLETE',
      reason: 'below_threshold_rounds_exhausted',
    });
  });

  it('never produces HUMAN_SUPPORT or AWAITING_CLOSE_CONFIRMATION — legacy states', () => {
    for (const score of [1, 3, T - 1, T, 10]) {
      for (const rounds of [0, 1, MAX_STABILISATION_ROUNDS]) {
        const { outcome } = decideClosureOutcome({
          postScore: score,
          roundsDelivered: rounds,
          threshold: T,
        });
        expect(outcome).not.toBe('HUMAN_SUPPORT');
        expect(outcome).not.toBe('AWAITING_CLOSE_CONFIRMATION');
      }
    }
  });

  it('reuses the existing Repair 1 threshold rather than inventing one', () => {
    expect(STABILITY_CLOSE_THRESHOLD).toBe(6);
  });

  it('every outcome it returns is a legal transition from AWAITING_POST_SCORE', () => {
    const outcomes = [
      decideClosureOutcome({ postScore: 8, roundsDelivered: 0, threshold: T }).outcome,
      decideClosureOutcome({ postScore: 3, roundsDelivered: 0, threshold: T }).outcome,
      decideClosureOutcome({ postScore: 3, roundsDelivered: 2, threshold: T }).outcome,
    ];
    for (const o of outcomes) {
      expect(isAllowedTransition('AWAITING_POST_SCORE', o)).toBe(true);
    }
  });

  it('does NOT act on deterioration — deliberately unresolved, raised not defaulted', () => {
    // A 9 -> 7 fall is deterioration but 7 is above threshold. Whether that
    // escalates is not settled by the approved wording, so the decision
    // function does not consider it; computeScoreChange exposes the delta.
    expect(
      decideClosureOutcome({ postScore: 7, roundsDelivered: 0, threshold: T }).outcome,
    ).toBe('CLOSED');
    expect(computeScoreChange(makeProcess({ initialScore: 9, postScore: 7 }))).toBe(-2);
  });
});

describe('recordCapturedScore', () => {
  const awaitingInitial = makeProcess({
    state: 'AWAITING_INITIAL_SCORE',
    route: 'ACTIVATED_CLOSE',
  });
  const awaitingPost = makeProcess({
    state: 'AWAITING_POST_SCORE',
    route: 'ACTIVATED_CLOSE',
    initialScore: 3,
    roundCount: 1,
  });

  it('fills the initial slot while awaiting the initial score', () => {
    const r = recordCapturedScore(awaitingInitial, 4, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.slot).toBe('initial');
    expect(r.process.initialScore).toBe(4);
    expect(r.process.initialScoreAt).toEqual(NOW);
    expect(r.process.postScore).toBeNull();
  });

  it('fills the post slot while awaiting the post score, leaving the initial intact', () => {
    const r = recordCapturedScore(awaitingPost, 7, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.slot).toBe('post');
    expect(r.process.postScore).toBe(7);
    expect(r.process.postScoreAt).toEqual(NOW);
    expect(r.process.initialScore).toBe(3);
  });

  it('does NOT advance the state — that is a transition', () => {
    const r = recordCapturedScore(awaitingInitial, 4, NOW);
    expect(r.ok && r.process.state).toBe('AWAITING_INITIAL_SCORE');
  });

  it('rejects in any state that is not waiting for a score', () => {
    for (const state of CLOSURE_PROCESS_STATES.filter(
      (s) => s !== 'AWAITING_INITIAL_SCORE' && s !== 'AWAITING_POST_SCORE',
    )) {
      expect(recordCapturedScore(makeProcess({ state }), 5, NOW)).toEqual({
        ok: false,
        reason: 'not_awaiting_a_score',
      });
    }
  });

  it('rejects out-of-range rather than clamping', () => {
    for (const bad of [0, 11, -1, 100, 4.5, NaN]) {
      expect(recordCapturedScore(awaitingInitial, bad, NOW)).toEqual({
        ok: false,
        reason: 'score_out_of_range',
      });
    }
  });

  it('feeds computeScoreChange once both slots are filled', () => {
    const first = recordCapturedScore(awaitingInitial, 3, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const moved = { ...first.process, state: 'AWAITING_POST_SCORE' as const };
    const second = recordCapturedScore(moved, 8, NOW);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(computeScoreChange(second.process)).toBe(5);
  });
});
