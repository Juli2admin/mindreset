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
  isActiveProcessState,
  isAllowedTransition,
  isTerminalProcessState,
  normaliseClosureProcess,
  resolveClosureProcessForTurn,
  transitionClosureProcess,
  type ClosureProcess,
  type ClosureProcessState,
} from './process';
import { SESSION_BOUNDARY_MS } from '../state/session-boundary';

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
  it('cannot skip from entry straight to CLOSED', () => {
    const p = makeProcess({ state: 'AWAITING_INITIAL_SCORE', route: 'ACTIVATED_CLOSE' });
    const r = transitionClosureProcess(p, 'CLOSED', { now: NOW });
    expect(r).toEqual({ ok: false, reason: 'invalid_transition', process: p });
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

  it('requires a route when entering a sequence', () => {
    const r = transitionClosureProcess(makeProcess(), 'AWAITING_INITIAL_SCORE', {
      now: NOW,
    });
    expect(r).toMatchObject({ ok: false, reason: 'route_required' });
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
