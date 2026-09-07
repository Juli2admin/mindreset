// The boundary trigger is the ACTION move only (2026-09-05) — a live false
// positive, and the third variant of "machinery ends a session that should
// have continued".
//
// WHAT HAPPENED, from the live session of 2026-09-05 21:29–21:41. The user
// had destabilised (intensity 6 from 21:32 to 21:37) and was mid-flow: the
// Clinician's visible reply was an OPEN investigative question — «Работа —
// это конкретный замок на конкретной двери. Расскажи мне про поиск. Что ты
// ищешь, что пробовала, где застряло?» — with `recommendedAction: "stay"`
// and `universal.investigate_gather` as the move. But the model's StateReport
// also carried a record-level closure capability claim (`cycleCanClose:
// true`, proven by the archived gate outcome `blocked`, which
// evaluateClosureGate returns only when claimsClosure held; the persisted
// `false` is withBlockedGate's rewrite). The boundary counted that claim as
// "this turn ends the session", appended the stability question to a reply
// that was continuing the conversation, orchestrator §3 then swallowed the
// user's substantive answer (finance job search, the 10-year gap) with a
// canned re-ask, and her «10» closed a session nobody asked to end.
//
// THE CONFLATION, named. `claimsClosure` — `cycleCanClose === true ||
// cycleStatus === 'closed'` — reads a CAPABILITY assessment ("the cycle
// could close now") as an ACTION ("I am closing this turn"). Where it was
// born, policing the persisted RECORD, that reading is right: an unmeasured
// capability claim deserves downgrading, and it got it. As the trigger for a
// USER-VISIBLE intervention it is a false-positive surface.
//
// THE FIX. `closeBoundaryApplies` and the route branch fire only on
// `claimsVisibleClose` — `universal.session_close`, the model's explicit
// statement that it performed a close, present on BOTH failing turns of the
// original 2026-08-17 defect this boundary was built for. Record-level
// claims still reach applyClosureGate unchanged: the persisted record is
// corrected, the user sees nothing.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: {
      update: () => Promise.resolve({}),
    },
  },
}));

import { closeBoundaryApplies, claimsVisibleClose } from './close-guard';
import {
  applyClosureGate,
  claimsClosure,
  evaluateClosureGate,
  STABILITY_CLOSE_THRESHOLD,
  type ClosureTurn,
} from './guard';
import { runClosureOrchestration } from './orchestrator';
import { CLOSURE_PROCESS_NONE, transitionClosureProcess } from './process';
import { STABILITY_QUESTION_RU } from './stability-question';
import type { StateReport } from '../stateReport/schema';

// Clock-relative (#364): the session-boundary walk measures against NOW.
const NOW = new Date(Date.now());
const min = (n: number) => new Date(NOW.getTime() - n * 60_000);

/** The live 2026-09-05 intensity ladder: 4, 6, 6, 6, 6, 4 — destabilised. */
const DESTABILISED: ClosureTurn[] = [4, 6, 6, 6, 6, 4].map((intensity, i) => ({
  n: i + 1,
  createdAt: min(12 - i * 2),
  intensity,
  safetyFlag: 'none',
  cycleStatus: null,
}));

function report(over: Partial<StateReport> = {}): StateReport {
  return {
    intensity: 4,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    ...over,
  } as StateReport;
}

/**
 * The exact production shape of the 21:39:41 turn: an investigative visible
 * reply, `stay`, `investigate_gather` — and the record-level capability claim
 * that armed the old trigger.
 */
const PRODUCTION_SHAPE = report({
  recommendedAction: 'stay',
  channel: 'cognitive',
  moveJustPerformed: ['universal.investigate_gather'],
  cycleStatus: 'open',
  cycleCanClose: true,
} as Partial<StateReport>);

/** The original 2026-08-17 failing shape: an actual session_close move. */
const GENUINE_CLOSE = report({
  moveJustPerformed: ['universal.witness_and_reflect', 'universal.session_close'],
  cycleCanClose: true,
  cycleStatus: 'closing',
  presentingRequestStatus: 'parked',
} as Partial<StateReport>);

// ---------------------------------------------------------------------------
// 1. The exact production shape no longer fires the visible boundary
// ---------------------------------------------------------------------------

describe('ACCEPTANCE — the live 2026-09-05 false positive', () => {
  it('an investigative turn with a record-level capability claim is left alone', () => {
    expect(claimsVisibleClose(PRODUCTION_SHAPE)).toBe(false);
    expect(claimsClosure(PRODUCTION_SHAPE)).toBe(true); // what armed the old trigger
    expect(
      closeBoundaryApplies({
        report: PRODUCTION_SHAPE,
        sessionTurns: DESTABILISED,
        observedAt: NOW,
        captured: null,
      }),
    ).toBe(false);
  });

  it('so no canonical Scale question would have been appended mid-investigation', () => {
    // The question the user received at 21:39 came only from the boundary
    // branch acting on `true`; with `false` the reply streams and ends as the
    // model wrote it — the open question about her job search stands alone.
    expect(STABILITY_QUESTION_RU).toContain('По шкале от 1 до 10');
  });
});

// ---------------------------------------------------------------------------
// 2-3. Record-level claims alone never trigger a visible intervention —
//      and the record gate still corrects them
// ---------------------------------------------------------------------------

describe('record-level claims are record business, not user-visible business', () => {
  it('cycleCanClose: true alone → no visible boundary', () => {
    const capability = report({ cycleCanClose: true } as Partial<StateReport>);
    expect(
      closeBoundaryApplies({ report: capability, sessionTurns: DESTABILISED, observedAt: NOW }),
    ).toBe(false);
  });

  it('cycleStatus: closed without session_close → no visible boundary', () => {
    const recordClosed = report({
      cycleStatus: 'closed',
      moveJustPerformed: ['universal.witness_and_reflect'],
    } as Partial<StateReport>);
    expect(claimsVisibleClose(recordClosed)).toBe(false);
    expect(
      closeBoundaryApplies({ report: recordClosed, sessionTurns: DESTABILISED, observedAt: NOW }),
    ).toBe(false);
  });

  it('...but applyClosureGate still downgrades both in the persisted record', () => {
    // Exactly what production did at 21:39:41: the record was corrected —
    // cycleCanClose false, gate archived as blocked — while (now) nothing is
    // shown to the user. The record path is byte-for-byte untouched.
    const recordClosed = report({
      cycleStatus: 'closed',
      cycleCanClose: true,
      moveJustPerformed: ['universal.investigate_gather'],
    } as Partial<StateReport>);
    const { report: corrected, gate } = applyClosureGate(
      recordClosed,
      DESTABILISED,
      NOW,
      null,
    );
    expect(gate.outcome).toBe('blocked');
    expect(gate.reasons).toContain('no_stability_measurement');
    expect(corrected.cycleCanClose).toBe(false);
    expect(corrected.cycleStatus).toBe('open');
  });
});

// ---------------------------------------------------------------------------
// 4-5. The original #384 behaviour on a genuine session_close is preserved
// ---------------------------------------------------------------------------

describe('a genuine universal.session_close keeps the full #384 behaviour', () => {
  it('destabilised + no measurement → the boundary still fires', () => {
    expect(claimsVisibleClose(GENUINE_CLOSE)).toBe(true);
    expect(
      closeBoundaryApplies({ report: GENUINE_CLOSE, sessionTurns: DESTABILISED, observedAt: NOW }),
    ).toBe(true);
    // Including the visible-only pause shape (2026-08-17 turn 22): no record
    // claim at all, action move alone — the case the narrowing must not lose.
    const pause = report({
      moveJustPerformed: ['universal.session_close'],
      presentingRequestStatus: 'parked',
    } as Partial<StateReport>);
    expect(claimsClosure(pause)).toBe(false);
    expect(
      closeBoundaryApplies({ report: pause, sessionTurns: DESTABILISED, observedAt: NOW }),
    ).toBe(true);
  });

  it('with a valid measurement → normal close, boundary silent', () => {
    const measured = report({
      ...GENUINE_CLOSE,
      stabilityCheck: {
        score: STABILITY_CLOSE_THRESHOLD,
        scale: 'stability',
        source: 'user_reported',
        observedAt: NOW.toISOString(),
      },
    } as Partial<StateReport>);
    expect(evaluateClosureGate(measured, DESTABILISED, NOW, null).outcome).toBe('passed');
    expect(
      closeBoundaryApplies({ report: measured, sessionTurns: DESTABILISED, observedAt: NOW }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. After a GENUINE Scale, a substantive answer keeps its existing handling
// ---------------------------------------------------------------------------

describe('§3 behaviour after a genuine boundary entry is unchanged', () => {
  // The process as a legitimate boundary entry leaves it: AWAITING_INITIAL_SCORE.
  const awaiting = (() => {
    const t = transitionClosureProcess(CLOSURE_PROCESS_NONE, 'AWAITING_INITIAL_SCORE', {
      now: min(3),
    });
    expect(t.ok).toBe(true);
    return t.ok ? t.process : CLOSURE_PROCESS_NONE;
  })();

  it('a substantive (non-score) answer is re-asked the question, exactly as before', async () => {
    const d = await runClosureOrchestration('user_test_trigger_narrowing', {
      current: awaiting,
      userMessage: 'Ну и ищу работу в сфере финансов. У меня был 10 лет назад небольшой опыт.',
      locale: 'ru',
      loadSessionTurns: async () => DESTABILISED,
      countUserMessagesSince: async () => 1, // the question has been asked once
      now: NOW,
    });
    expect(d.kind).toBe('deliver');
    if (d.kind === 'deliver') {
      expect(d.step).toBe('stability_question_reask');
      expect(d.text).toBe(STABILITY_QUESTION_RU);
    }
  });

  it('a numeric score is captured, exactly as before', async () => {
    const d = await runClosureOrchestration('user_test_trigger_narrowing', {
      current: awaiting,
      userMessage: '10',
      locale: 'ru',
      loadSessionTurns: async () => DESTABILISED,
      countUserMessagesSince: async () => 1,
      now: NOW,
    });
    // ≥ threshold: the process moves on and the model turn runs constrained —
    // the post-score path this change explicitly does not touch.
    expect(d.kind).not.toBe('deliver');
  });
});

// ---------------------------------------------------------------------------
// Source-level: the narrowing is real, and only where it should be
// ---------------------------------------------------------------------------

describe('the trigger is narrowed at both call sites, and nowhere else', () => {
  const route = readFileSync(
    path.join(process.cwd(), 'app/api/journey/turn/route.ts'),
    'utf8',
  );
  const guard = readFileSync(
    path.join(process.cwd(), 'lib/journey/closure/close-guard.ts'),
    'utf8',
  );

  it('the route boundary branch reads only the action move', () => {
    expect(route).toContain(
      "preParsed !== null &&\n          claimsVisibleClose(preParsed.report)\n        ) {",
    );
    expect(route).not.toContain('claimsClosure(preParsed.report)');
  });

  it('closeBoundaryApplies reads only the action move', () => {
    expect(guard).toContain('if (!claimsVisibleClose(report)) return false;');
    // claimsClosure is no longer even imported by close-guard.ts.
    expect(guard).not.toMatch(/import\s*\{[^}]*claimsClosure[^}]*\}/);
  });

  it('the record gate in finaliseTurn still keys on claimsClosure, untouched', () => {
    expect(route).toContain('if (claimsClosure(parsedReport)) {');
  });

  it('claimsClosure itself is unchanged — capability OR closed status', () => {
    const guardModule = readFileSync(
      path.join(process.cwd(), 'lib/journey/closure/guard.ts'),
      'utf8',
    );
    expect(guardModule).toContain(
      "return report.cycleCanClose === true || report.cycleStatus === 'closed';",
    );
  });
});
