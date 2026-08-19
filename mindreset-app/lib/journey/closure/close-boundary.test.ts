// The stability boundary (2026-08-19) — the first HARD delivery boundary in
// The Journey.
//
// THE RULE, which is not new: journey-master.md:362 — "If the user has
// DESTABILISED in this session at any point (intensity >= 6 at any turn...),
// you do NOT close the session on vague reassurance. Before any session-pause
// or session-close move: 1. Run an explicit stability check."
//
// WHAT THIS ENFORCES, PRECISELY. The session STATE and PROCESS, not the words.
// The boundary is evaluated after the reply has streamed, so the Clinician's
// closing prose has already reached the user and is not taken back. What
// changes is that the close is NOT ACCEPTED: the turn enters the existing
// AWAITING_INITIAL_SCORE state and the approved stability question is appended
// before the response closes, turning an invalid close into the stability
// check the protocol required. Corrective enforcement, not suppression — and
// no turn is buffered, so streaming is production-identical everywhere.
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
  it('the boundary applies: the close is not valid', () => {
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

  it('and would have refused the close on turns 22 AND 23', () => {
    expect(closeBoundaryApplies({ report: PAUSING, sessionTurns: LIVE, observedAt: NOW })).toBe(true);
    expect(closeBoundaryApplies({ report: CLOSING, sessionTurns: LIVE, observedAt: NOW })).toBe(true);
  });

  it('while leaving the other 21 turns of that session untouched', () => {
    expect(closeBoundaryApplies({ report: ORDINARY, sessionTurns: LIVE, observedAt: NOW })).toBe(false);
  });
});

describe('destabilised + no measurement + pause', () => {
  it('applies even though the record claims nothing', () => {
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

describe('ordinary turns are never touched', () => {
  it('a non-close turn in a destabilised session is left alone', () => {
    expect(measurementRequired(DESTABILISED, NOW)).toBe(true); // measurement owed...
    expect(closeBoundaryApplies({ report: ORDINARY, sessionTurns: DESTABILISED, observedAt: NOW })).toBe(
      false, // ...but this turn claims no close, so nothing happens.
    );
  });

  it('a missing or unparseable state report changes nothing about the turn', () => {
    // The defensive default parseStateReport returns when the model emitted
    // nothing: no close claim, so no violation can be established.
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

describe('streaming is exactly production, on every turn', () => {
  const route = readFileSync(
    path.join(process.cwd(), 'app/api/journey/turn/route.ts'),
    'utf8',
  );

  it('every chunk still goes straight out inside the loop', () => {
    // Unconditional. No hold, no buffer, no flag between the processor and
    // the controller — byte-identical to production before this change.
    expect(route).toContain(
      'const visible = ingestChunk(processor, event.delta.text);\n            if (visible.length > 0) {\n              controller.enqueue(encoder.encode(visible));\n            }',
    );
    expect(route).toContain(
      'const tail = finaliseStream(processor);\n        if (tail.length > 0) {\n          controller.enqueue(encoder.encode(tail));\n        }',
    );
  });

  it('no buffering machinery exists at all', () => {
    for (const gone of ['held.push(', 'boundaryArmed', 'heldSettled', 'armedSessionTurns']) {
      expect(route).not.toContain(gone);
    }
  });

  it('the error path is untouched', () => {
    expect(route).toContain(
      "console.error('[journey/turn] stream error', err);\n        controller.enqueue(encoder.encode('\\n\\n[Connection interrupted. Please try again.]'));",
    );
  });

  it('the history read happens only on a turn that claims a close', () => {
    // The one added query sits INSIDE the close-claim conditional, so an
    // ordinary turn pays nothing for the boundary — not even a query.
    const guardIdx = route.indexOf(
      '(claimsVisibleClose(preParsed.report) || claimsClosure(preParsed.report))',
    );
    expect(guardIdx).toBeGreaterThan(-1);
    const queryIdx = route.indexOf('select: { createdAt: true, intensityReported: true, safetyFlag: true }');
    expect(queryIdx).toBeGreaterThan(guardIdx);
    // ...and it is the only place that query shape appears.
    expect(
      route.split('select: { createdAt: true, intensityReported: true, safetyFlag: true }').length - 1,
    ).toBe(1);
  });

  it('the boundary is reached only from an idle, unconstrained turn', () => {
    expect(route).toContain(
      "closureOrchestration.kind === 'proceed' &&\n          state.closureProcess.state === 'NONE' &&",
    );
  });

  it('no extra model call is made', () => {
    expect(route.split('anthropic.messages.stream(').length - 1).toBe(1);
    expect(route).not.toContain('anthropic.messages.create');
  });
});

describe('the correction is an append, before the response closes', () => {
  const route = readFileSync(
    path.join(process.cwd(), 'app/api/journey/turn/route.ts'),
    'utf8',
  );

  it('the question is appended to the reply, not substituted for it', () => {
    expect(route).toContain('controller.enqueue(encoder.encode(`\\n\\n${question}`));');
  });

  it('it is enqueued before controller.close(), the last point anything can reach the user', () => {
    const q = route.indexOf('encoder.encode(`\\n\\n${question}`)');
    const close = route.indexOf('controller.close();');
    expect(q).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(q);
  });

  it('the stored transcript carries what the user saw: prose then question', () => {
    expect(route).toContain('const persistedReply = args.appendedToReply');
    expect(route).toContain('? `${baseReply}\\n\\n${args.appendedToReply}`');
    expect(route).toContain(': baseReply;');
  });

  it('the close is refused in state via the existing transition', () => {
    expect(route).toContain("'AWAITING_INITIAL_SCORE',");
    expect(route).toContain("'clinician_close_without_measurement',");
    expect(route).toContain('state.closureProcess = written.process;');
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

  it('the turn parses the report exactly once, in the request path', () => {
    // Two parseStateReport call sites remain in the whole file: the hoisted
    // one, and finaliseTurn's `??` fallback for when the hoisted one threw.
    expect(route.split('parseStateReport(split.rawStateReport').length - 1).toBe(2);
    expect(route).toContain(
      'const observedAt = new Date();\n          const split = splitReplyAndReport(processor.fullText);\n          preParsed = {\n            report: parseStateReport(split.rawStateReport, { observedAt }),\n            observedAt,\n          };',
    );
  });

  it('the close-guard correction reuses that parse instead of taking its own', () => {
    // Previously this block called splitReplyAndReport + parseStateReport a
    // second time with a second `new Date()`. Behaviour is unchanged; the
    // second clock reading is gone.
    expect(route).toContain("if (closureNote === 'stabilisation' && preParsed !== null) {");
    expect(route).toContain('report: preParsed.report,');
  });

  it('finaliseTurn reuses that pair instead of taking a second reading', () => {
    expect(route).toContain('const observedAt = args.preParsed?.observedAt ?? new Date();');
    expect(route).toContain(
      "args.preParsed?.report ?? parseStateReport(split.rawStateReport, { observedAt })",
    );
  });

  it('the same instant is what enters the closure process', () => {
    expect(route).toContain("'AWAITING_INITIAL_SCORE',\n                { now: observedAt },");
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

  it('the close-guard correction and the boundary can never both fire', () => {
    // The correction requires a 'stabilisation' note; the boundary requires
    // `proceed`, which carries no note at all. Mutually exclusive by
    // construction, so a turn can never receive two appended sentences.
    expect(route).toContain("if (closureNote === 'stabilisation' && preParsed !== null) {");
    expect(route).toContain("closureOrchestration.kind === 'proceed' &&");
    expect(
      closeCorrectionFor({ note: null, report: CLOSING, locale: 'ru' }),
    ).toBeNull();
  });

  it('the boundary adds no message write of its own', () => {
    // Five writes, exactly as before this change: cooldown-lift overwrite,
    // the pre-LLM user message, finaliseTurn's assistant row, and the two
    // inside persistMessages. A boundary turn reuses finaliseTurn's row — it
    // does not persist the question separately, which is what would have
    // produced a duplicate assistant bubble.
    expect(route.split('prisma.journeyMessage.create').length - 1).toBe(5);
    expect(route).toContain('const persistedReply = args.appendedToReply');
    expect(finaliseTurnSource().split('prisma.journeyMessage.create').length - 1).toBe(1);
    // And the boundary block itself writes no message.
    const start = route.indexOf('[journey/stability-boundary]');
    const block = route.slice(route.indexOf('closeBoundaryApplies({'), start);
    expect(block).not.toContain('journeyMessage');
  });

  it('progress, audit and routing each run exactly once in finaliseTurn', () => {
    const fin = finaliseTurnSource();
    expect(fin.split('applyStateReportToProgress(').length - 1).toBe(1);
    expect(fin.split('writeAuditTurn({').length - 1).toBe(1);
    expect(fin.split('decideRoute(').length - 1).toBe(1);
    expect(fin.split('applyRouteDecision(').length - 1).toBe(1);
  });

  it('the refused turn earns no advancement — session_close is a universal move', () => {
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
