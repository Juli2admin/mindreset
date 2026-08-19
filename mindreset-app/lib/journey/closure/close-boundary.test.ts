// The stability boundary (2026-08-19) — the first HARD delivery boundary in
// The Journey.
//
// THE RULE, which is not new: journey-master.md:362 — "If the user has
// DESTABILISED in this session at any point (intensity >= 6 at any turn...),
// you do NOT close the session on vague reassurance. Before any session-pause
// or session-close move: 1. Run an explicit stability check."
//
// WHAT WAS BROKEN. In the live session of 2026-08-17 (25 turns, all Stage 3)
// intensity reached 7 four times, `stabilityCheck` was never emitted, and the
// Clinician emitted `universal.session_close` on turns 22 AND 23 and told the
// user the session was finished. The archived turn-23 row carries
// `closureGate: {outcome: "blocked", reasons: ["no_stability_measurement"]}` —
// every existing layer reached the right verdict, and every one of them ran
// after the words had gone. `closeCorrectionFor` could not help either: it
// requires a 'stabilisation' note, and the closure process was NONE because
// the process is entered by USER exit intent, and this close was the
// Clinician's own.
//
// WHAT THIS IS NOT. No new clinical rule, threshold, scale, copy, schema,
// validator, model call or architecture. `closeBoundaryApplies` composes three
// existing authorities — `claimsVisibleClose` / `claimsClosure`,
// `measurementRequired`, `evaluateClosureGate` — and the fallback is the
// owner-approved `getStabilityQuestionForLocale`, entered through the already
// legal `NONE -> AWAITING_INITIAL_SCORE` transition.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  closeBoundaryApplies,
  closeCorrectionFor,
  claimsVisibleClose,
} from './close-guard';
import {
  claimsClosure,
  evaluateClosureGate,
  DESTABILISATION_INTENSITY,
  STABILITY_CLOSE_THRESHOLD,
  type ClosureTurn,
} from './guard';
import { measurementRequired } from './orchestrator';
import { getStabilityQuestionForLocale } from './stability-question';
import {
  CLOSURE_PROCESS_NONE,
  isAllowedTransition,
  transitionClosureProcess,
  blocksProgression,
} from './process';
import { getStageFromTurnMoves } from '../router/move-based-advance';
import type { StateReport } from '../stateReport/schema';
import type { AuditTurn } from '../router/history';

const NOW = new Date('2026-08-17T09:03:22.098Z');
const min = (n: number) => new Date(NOW.getTime() - n * 60_000);

/** A session that reached intensity 7, mirroring the live 2026-08-17 shape. */
const DESTABILISED: ClosureTurn[] = [
  { n: 1, createdAt: min(52), intensity: 4, safetyFlag: 'none', cycleStatus: null },
  { n: 2, createdAt: min(45), intensity: 6, safetyFlag: 'none', cycleStatus: null },
  { n: 3, createdAt: min(42), intensity: 7, safetyFlag: 'none', cycleStatus: null },
  { n: 4, createdAt: min(20), intensity: 6, safetyFlag: 'none', cycleStatus: null },
  { n: 5, createdAt: min(4), intensity: 5, safetyFlag: 'none', cycleStatus: null },
];

/** The same session length and cadence, never above 5. */
const CALM: ClosureTurn[] = DESTABILISED.map((t, i) => ({
  ...t,
  intensity: [4, 5, 4, 5, 4][i],
}));

function report(over: Partial<StateReport> = {}): StateReport {
  return {
    intensity: 4,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    ...over,
  } as StateReport;
}

/** Turn 23's shape: the Clinician closes and claims the cycle can close. */
const CLOSING = report({
  moveJustPerformed: ['universal.witness_and_reflect', 'universal.session_close'],
  cycleCanClose: true,
  cycleStatus: 'closing',
  presentingRequestStatus: 'parked',
} as Partial<StateReport>);

/** Turn 22's shape: a visible close/park with NO record-level claim. */
const PAUSING = report({
  intensity: 5,
  moveJustPerformed: ['universal.witness_and_reflect', 'universal.session_close'],
  presentingRequestStatus: 'parked',
} as Partial<StateReport>);

const ORDINARY = report({
  intensity: 5,
  moveJustPerformed: ['universal.witness_and_reflect', 'universal.investigate_deepen'],
} as Partial<StateReport>);

// ---------------------------------------------------------------------------
// 1-2. The boundary fires on the two shapes that failed live
// ---------------------------------------------------------------------------

describe('destabilised + no measurement + close', () => {
  it('withholds: the boundary applies', () => {
    expect(closeBoundaryApplies({ report: CLOSING, sessionTurns: DESTABILISED, observedAt: NOW })).toBe(
      true,
    );
  });

  it('for the reason the existing guard already gives', () => {
    // The verdict is not this function's own judgement — it is the gate's.
    const gate = evaluateClosureGate(CLOSING, DESTABILISED, NOW, null);
    expect(gate.outcome).toBe('blocked');
    expect(gate.reasons).toContain('no_stability_measurement');
  });

  it('the delivered fallback is the existing owner-approved question', () => {
    // Both locales, from the one existing source. No new copy exists.
    expect(getStabilityQuestionForLocale('ru')).toContain('По шкале от 1 до 10');
    expect(getStabilityQuestionForLocale('en')).toContain('On a scale of 1 to 10');
    expect(getStabilityQuestionForLocale(null)).toBe(getStabilityQuestionForLocale('en'));
  });
});

describe('the live session of 2026-08-17, replayed', () => {
  // The real intensity ladder, turns 1-23, from the Inspector export. No user
  // content — only the numbers the boundary actually reads.
  const LIVE: ClosureTurn[] = [
    4, 5, 5, 6, 6, 6, 6, 7, 7, 6, 6, 5, 5, 5, 5, 6, 7, 7, 6, 6, 6, 5,
  ].map((intensity, i) => ({
    n: i + 1,
    createdAt: new Date(NOW.getTime() - (52 - i * 2) * 60_000),
    intensity,
    safetyFlag: 'none',
    cycleStatus: null,
  }));

  it('reproduces the verdict archived on turn 23', () => {
    const gate = evaluateClosureGate(CLOSING, LIVE, NOW, null);
    expect(gate.outcome).toBe('blocked');
    expect(gate.reasons).toEqual(['no_stability_measurement']);
  });

  it('and would have withheld the goodbye on turns 22 AND 23', () => {
    expect(closeBoundaryApplies({ report: PAUSING, sessionTurns: LIVE, observedAt: NOW })).toBe(true);
    expect(closeBoundaryApplies({ report: CLOSING, sessionTurns: LIVE, observedAt: NOW })).toBe(true);
  });

  it('while leaving the other 21 turns of that session untouched', () => {
    expect(closeBoundaryApplies({ report: ORDINARY, sessionTurns: LIVE, observedAt: NOW })).toBe(false);
  });
});

describe('destabilised + no measurement + pause', () => {
  it('withholds even though the record claims nothing', () => {
    // This is the turn-22 shape. `claimsClosure` is false, so the gate alone
    // would return not_applicable and see nothing.
    expect(claimsClosure(PAUSING)).toBe(false);
    expect(evaluateClosureGate(PAUSING, DESTABILISED, NOW, null).outcome).toBe('not_applicable');
    // The model's own canonical move is what catches it.
    expect(claimsVisibleClose(PAUSING)).toBe(true);
    expect(closeBoundaryApplies({ report: PAUSING, sessionTurns: DESTABILISED, observedAt: NOW })).toBe(
      true,
    );
  });

  it('journey-master.md:362 covers a pause, not only a close', () => {
    const master = readFileSync(
      path.join(process.cwd(), 'docs/journey/runtime/journey-master.md'),
      'utf8',
    );
    expect(master).toContain('Before any session-pause or session-close move');
  });
});

// ---------------------------------------------------------------------------
// 3. A completed valid measurement — the boundary must not fire
// ---------------------------------------------------------------------------

describe('a completed, valid stability measurement clears the boundary', () => {
  it('does not fire when the user reported at or above threshold', () => {
    const measured = report({
      ...CLOSING,
      stabilityCheck: {
        score: STABILITY_CLOSE_THRESHOLD,
        scale: 'stability',
        source: 'user_reported',
        observedAt: NOW.toISOString(),
      },
    } as Partial<StateReport>);
    expect(evaluateClosureGate(measured, DESTABILISED, NOW, null).outcome).toBe('passed');
    expect(closeBoundaryApplies({ report: measured, sessionTurns: DESTABILISED, observedAt: NOW })).toBe(
      false,
    );
  });

  it('does not fire on the code-captured measurement path either', () => {
    expect(
      closeBoundaryApplies({
        report: CLOSING,
        sessionTurns: DESTABILISED,
        observedAt: NOW,
        captured: { score: 8, at: min(2).toISOString() },
      }),
    ).toBe(false);
  });

  it('DOES fire on a below-threshold reading — the gate decides, not this', () => {
    const low = report({
      ...CLOSING,
      stabilityCheck: {
        score: STABILITY_CLOSE_THRESHOLD - 1,
        scale: 'stability',
        source: 'user_reported',
        observedAt: NOW.toISOString(),
      },
    } as Partial<StateReport>);
    expect(evaluateClosureGate(low, DESTABILISED, NOW, null).reasons).toContain('below_threshold');
    expect(closeBoundaryApplies({ report: low, sessionTurns: DESTABILISED, observedAt: NOW })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. A session that never destabilised is none of the boundary's business
// ---------------------------------------------------------------------------

describe('a session that never reached intensity 6', () => {
  it('measurementRequired is false, so a normal close is untouched', () => {
    expect(DESTABILISATION_INTENSITY).toBe(6);
    expect(Math.max(...CALM.map((t) => t.intensity ?? 0))).toBeLessThan(DESTABILISATION_INTENSITY);
    expect(measurementRequired(CALM, NOW)).toBe(false);
    expect(closeBoundaryApplies({ report: CLOSING, sessionTurns: CALM, observedAt: NOW })).toBe(false);
    expect(closeBoundaryApplies({ report: PAUSING, sessionTurns: CALM, observedAt: NOW })).toBe(false);
  });

  it('a spike in a PREVIOUS session does not arm it', () => {
    // Same window, but the destabilisation sits the far side of a 4h gap.
    const lastSession: ClosureTurn[] = [
      { n: 0, createdAt: new Date(NOW.getTime() - 26 * 3600_000), intensity: 8, safetyFlag: 'none', cycleStatus: null },
      ...CALM,
    ];
    expect(measurementRequired(lastSession, NOW)).toBe(false);
    expect(closeBoundaryApplies({ report: CLOSING, sessionTurns: lastSession, observedAt: NOW })).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Ordinary turns
// ---------------------------------------------------------------------------

describe('ordinary turns are never withheld', () => {
  it('a non-close turn in a destabilised session delivers normally', () => {
    expect(measurementRequired(DESTABILISED, NOW)).toBe(true); // armed...
    expect(closeBoundaryApplies({ report: ORDINARY, sessionTurns: DESTABILISED, observedAt: NOW })).toBe(
      false, // ...but nothing is withheld.
    );
  });

  it('a missing or unparseable state report never costs the user their reply', () => {
    // The defensive default parseStateReport returns when the model emitted
    // nothing: no close claim, so the boundary fails open on delivery.
    expect(closeBoundaryApplies({ report: report(), sessionTurns: DESTABILISED, observedAt: NOW })).toBe(
      false,
    );
  });

  it('no prose is inspected — only structured fields decide', () => {
    const chatty = report({
      ...ORDINARY,
      clinicalRead: 'Closing gently. Session complete. Goodbye for today, rest well.',
      continuityNote: 'Session closed and finished.',
    } as Partial<StateReport>);
    expect(closeBoundaryApplies({ report: chatty, sessionTurns: DESTABILISED, observedAt: NOW })).toBe(
      false,
    );
  });
});

describe('the streaming path for an unarmed turn is unchanged', () => {
  const route = readFileSync(
    path.join(process.cwd(), 'app/api/journey/turn/route.ts'),
    'utf8',
  );

  it('an unarmed turn still enqueues inside the loop, chunk by chunk', () => {
    expect(route).toContain(
      'if (boundaryArmed) held.push(visible);\n              else controller.enqueue(encoder.encode(visible));',
    );
    expect(route).toContain(
      'if (boundaryArmed) held.push(tail);\n          else controller.enqueue(encoder.encode(tail));',
    );
  });

  it('the whole boundary is inside one conditional, so an unarmed turn skips it', () => {
    const start = route.indexOf('if (armedSessionTurns !== null) {');
    expect(start).toBeGreaterThan(-1);
    // Nothing about the boundary sits outside that guard: the only other
    // mentions are the declarations and the error-path flush.
    expect(route.split('closeBoundaryApplies(').length - 1).toBe(1);
    expect(route.split('getStabilityQuestionForLocale(').length - 1).toBe(1);
  });

  it('a stream that fails mid-reply still delivers what it had', () => {
    // A dead stream emitted no state report, so the boundary cannot evaluate
    // it. Flushing keeps a failed armed turn identical to a failed ordinary
    // turn rather than silently swallowing the partial reply.
    expect(route).toContain('if (!heldSettled) {');
    expect(route).toContain('[Connection interrupted. Please try again.]');
  });

  it('no extra model call is made', () => {
    expect(route.split('anthropic.messages.stream(').length - 1).toBe(1);
    expect(route).not.toContain('anthropic.messages.create');
  });
});

// ---------------------------------------------------------------------------
// 6. One parse, one clock
// ---------------------------------------------------------------------------

describe('one authoritative observedAt', () => {
  const route = readFileSync(
    path.join(process.cwd(), 'app/api/journey/turn/route.ts'),
    'utf8',
  );

  it('the boundary block parses the report exactly once, with its own clock', () => {
    const block = route.slice(
      route.indexOf('if (armedSessionTurns !== null) {'),
      route.indexOf('} catch (err) {', route.indexOf('if (armedSessionTurns !== null) {')),
    );
    expect(block).toContain('const observedAt = new Date();');
    expect(block).toContain('parseStateReport(split.rawStateReport, { observedAt })');
    expect(block.split('parseStateReport').length - 1).toBe(1);
  });

  it('finaliseTurn reuses that pair instead of taking a second reading', () => {
    expect(route).toContain('const observedAt = args.preParsed?.observedAt ?? new Date();');
    expect(route).toContain(
      "args.preParsed?.report ?? parseStateReport(split.rawStateReport, { observedAt })",
    );
  });

  it('the same instant is what enters the closure process', () => {
    expect(route).toContain('{ now: preParsed?.observedAt ?? new Date() }');
  });

  it('the gate is still handed that one reading, as finding B2 requires', () => {
    // Unchanged line — asserted so the boundary cannot quietly detach it.
    expect(route).toContain('// loadRecentTurns has no session filter; the guard narrows the');
    expect(route).toContain('        observedAt,');
  });
});

// ---------------------------------------------------------------------------
// 7. No duplicate correction, persistence, advancement or routing
// ---------------------------------------------------------------------------

describe('nothing is duplicated', () => {
  const route = readFileSync(
    path.join(process.cwd(), 'app/api/journey/turn/route.ts'),
    'utf8',
  );
  /** The body of finaliseTurn alone, without the helpers that follow it. */
  const finaliseTurnSource = (): string => {
    const start = route.indexOf('async function finaliseTurn');
    const end = route.indexOf('async function advanceAfterStabilisation', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return route.slice(start, end);
  };

  it('the close-guard correction still requires a stabilisation note', () => {
    // The boundary only arms when the orchestration chose `proceed`, which
    // carries no note — so the two can never both fire on one turn.
    expect(route).toContain("if (closureNote === 'stabilisation') {");
    expect(route).toContain("closureOrchestration.kind === 'proceed' && state.closureProcess.state === 'NONE'");
    expect(
      closeCorrectionFor({ note: null, report: CLOSING, locale: 'ru' }),
    ).toBeNull();
  });

  it('the boundary adds no message write of its own', () => {
    // Five writes, exactly as before this change: cooldown-lift overwrite,
    // the pre-LLM user message, finaliseTurn's assistant row, and the two
    // inside persistMessages. The withheld turn reuses finaliseTurn's row —
    // it does not persist the question separately, which is what would have
    // produced a duplicate assistant bubble.
    expect(route.split('prisma.journeyMessage.create').length - 1).toBe(5);
    expect(route).toContain('args.deliveredInstead ??');
    expect(finaliseTurnSource().split('prisma.journeyMessage.create').length - 1).toBe(1);
    // And the boundary block itself writes no message.
    const block = route.slice(route.indexOf('if (withhold) {'), route.indexOf('} else {', route.indexOf('if (withhold) {')));
    expect(block).not.toContain('journeyMessage');
  });

  it('progress, audit and routing each run exactly once in finaliseTurn', () => {
    const fin = finaliseTurnSource();
    expect(fin.split('applyStateReportToProgress(').length - 1).toBe(1);
    expect(fin.split('writeAuditTurn({').length - 1).toBe(1);
    expect(fin.split('decideRoute(').length - 1).toBe(1);
    expect(fin.split('applyRouteDecision(').length - 1).toBe(1);
  });

  it('the withheld turn earns no advancement — session_close is a universal move', () => {
    const turn = {
      id: 't', createdAt: NOW, stageAtTurn: 3, depthAtTurn: 'surface',
      intensityReported: 4, safetyFlag: 'none', recommendedAction: 'stay',
      report: CLOSING,
    } as AuditTurn;
    expect(getStageFromTurnMoves(turn, true)).toBeNull();
  });

  it('it does not touch the stabilisation lane', () => {
    // advanceAfterStabilisation fires only from DELIVERING_STABILISATION;
    // the boundary enters AWAITING_INITIAL_SCORE, so the two never collide.
    expect(route).toContain("if (args.closureProcess.state === 'DELIVERING_STABILISATION') {");
    expect(route).toContain("'AWAITING_INITIAL_SCORE',");
  });
});

// ---------------------------------------------------------------------------
// 8. The entry it uses is the one that already existed
// ---------------------------------------------------------------------------

describe('the closure path entered is the existing one', () => {
  it('NONE -> AWAITING_INITIAL_SCORE is already a legal transition', () => {
    expect(isAllowedTransition('NONE', 'AWAITING_INITIAL_SCORE')).toBe(true);
    const entered = transitionClosureProcess(CLOSURE_PROCESS_NONE, 'AWAITING_INITIAL_SCORE', {
      now: NOW,
    });
    expect(entered.ok).toBe(true);
  });

  it('the state it enters holds stage progression, as it already does', () => {
    // Not a new behaviour: this is what AWAITING_INITIAL_SCORE has always
    // meant, and it is the correct posture on a turn whose close was refused.
    expect(blocksProgression('AWAITING_INITIAL_SCORE')).toBe(true);
    expect(blocksProgression('NONE')).toBe(false);
  });

  it('no new clinical copy was introduced', () => {
    const guard = readFileSync(path.join(process.cwd(), 'lib/journey/closure/close-guard.ts'), 'utf8');
    const added = guard.slice(guard.indexOf('The stability boundary (2026-08-19)'));
    // The only user-facing string on this path comes from stability-question.ts.
    expect(added).not.toMatch(/^\s*(export )?const [A-Z_]+ =\s*$/m);
    expect(added).not.toContain("'On a scale");
    expect(added).not.toContain('По шкале');
  });
});
