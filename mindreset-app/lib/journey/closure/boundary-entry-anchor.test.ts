// The boundary's closure-process entry anchor (2026-08-19).
//
// THE DEFECT, from the first live run of the stability boundary. It fired
// correctly, asked the approved Russian question, and the user answered "5" —
// and was then asked the same question again, because orchestrator §3
// re-delivered it. Her first numeric reply was never captured.
//
// §3 decides that with `countUserMessagesSince(transitionedAt)`, where `0`
// means "we have not asked yet". That reading is only correct when the entry
// timestamp precedes the user message that triggered it — which is true of the
// orchestrator's own entry purely by ordering:
//
//   orchestrator entry — transition at route.ts:399, THEN persistMessages at
//                        :440 writes the triggering message. Next turn: 1.
//   boundary entry     — the triggering message is persisted at :460 BEFORE
//                        the model call; the transition happens after the
//                        stream. Next turn: 0 -> the question is asked again.
//
// THE FIX. `boundaryEntryAnchor` puts the entry immediately before the message
// that triggered it, reproducing the ordering §3 already expects. §3 is
// unchanged, its counter keeps its existing meaning, and no other closure
// behaviour moves.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

type RpUpdateArgs = { where: unknown; data: Record<string, unknown> };
const rpUpdates: RpUpdateArgs[] = [];
vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: {
      update: (args: RpUpdateArgs) => {
        rpUpdates.push(args);
        return Promise.resolve({});
      },
    },
  },
}));

import { runClosureOrchestration } from './orchestrator';
import { boundaryEntryAnchor } from './close-guard';
import { STABILITY_CLOSE_THRESHOLD, type ClosureTurn } from './guard';
import { getStabilityQuestionForLocale } from './stability-question';
import {
  normaliseClosureProcess,
  transitionClosureProcess,
  type ClosureProcess,
} from './process';

const USER_ID = 'user_3EfVFP02L8njKj2T36EvDAB0Z07';

// ---------------------------------------------------------------------------
// The production sequence of 2026-08-19, to the millisecond where it matters.
// ---------------------------------------------------------------------------

/** The row as production held it: retained since 2026-08-13. */
const INCOMPLETE_ROW: ClosureProcess = normaliseClosureProcess({
  state: 'INCOMPLETE',
  route: 'ACTIVATED_CLOSE',
  enteredAt: new Date('2026-08-08T14:07:47.776Z'),
  transitionedAt: new Date('2026-08-13T11:41:43.365Z'),
  roundCount: 2,
  initialScore: 2,
  postScore: 5,
  freezeInterruptedAt: null,
} as never);

/** «Знаешь, что-то я не могу, у меня сил нет. Я хочу закончить...» */
const TRIGGERING_MESSAGE_AT = new Date('2026-08-19T12:43:10.000Z');
/** The turn ends; the report is parsed and the boundary fires. */
const BOUNDARY_OBSERVED_AT = new Date('2026-08-19T12:43:18.302Z');
/** The user replies "5" on the next turn. */
const REPLY_TURN_AT = new Date('2026-08-19T12:44:30.000Z');

/** The session, destabilised at 11:03 and still inside the 4h window. */
const SESSION: ClosureTurn[] = [
  ['2026-08-19T11:03:08.761Z', 8, 'watch'],
  ['2026-08-19T11:26:34.400Z', 5, 'watch'],
  ['2026-08-19T12:39:14.142Z', 4, 'none'],
  ['2026-08-19T12:42:39.098Z', 5, 'none'],
].map(([iso, i, f], n) => ({
  n: n + 1,
  createdAt: new Date(iso as string),
  intensity: i as number,
  safetyFlag: f as string,
  cycleStatus: null,
}));

/**
 * The user messages persisted at the moment the NEXT turn's orchestration
 * runs. Critically this does NOT include that turn's own message: route.ts
 * persists it at :460, after the hook at :399.
 */
const PERSISTED_USER_MESSAGES = [TRIGGERING_MESSAGE_AT];

const countSince = (since: Date): Promise<number> =>
  Promise.resolve(PERSISTED_USER_MESSAGES.filter((m) => m > since).length);

function replyTurn(current: ClosureProcess, userMessage: string) {
  return runClosureOrchestration(USER_ID, {
    current,
    userMessage,
    locale: 'ru',
    loadSessionTurns: async () => SESSION,
    countUserMessagesSince: countSince,
    now: REPLY_TURN_AT,
  });
}

beforeEach(() => {
  rpUpdates.length = 0;
});

// ---------------------------------------------------------------------------
// The regression, end to end
// ---------------------------------------------------------------------------

describe('INCOMPLETE -> boundary asks -> user replies "5" once', () => {
  /** Step 1: the boundary enters, anchored before the triggering message. */
  const entered = transitionClosureProcess(INCOMPLETE_ROW, 'AWAITING_INITIAL_SCORE', {
    now: boundaryEntryAnchor(TRIGGERING_MESSAGE_AT),
  });

  it('the entry is legal from INCOMPLETE and lands in AWAITING_INITIAL_SCORE', () => {
    expect(entered.ok).toBe(true);
    expect(entered.ok && entered.process.state).toBe('AWAITING_INITIAL_SCORE');
  });

  it('and it is anchored BEFORE the message that triggered it', () => {
    expect(entered.ok && entered.process.transitionedAt!.getTime()).toBeLessThan(
      TRIGGERING_MESSAGE_AT.getTime(),
    );
    // ...unlike the observedAt the boundary used before this fix.
    expect(BOUNDARY_OBSERVED_AT.getTime()).toBeGreaterThan(TRIGGERING_MESSAGE_AT.getTime());
  });

  it('so §3 sees the triggering message and knows the question was asked', async () => {
    const anchor = (entered.ok && entered.process.transitionedAt)!;
    await expect(countSince(anchor)).resolves.toBe(1);
  });

  it('the reply "5" is captured ONCE, with no duplicate question', async () => {
    const process = (entered.ok && entered.process)!;
    const decision = await replyTurn(process, '5');

    // NOT another stability question.
    expect(decision.kind).not.toBe('deliver');
    expect(decision).not.toMatchObject({ text: getStabilityQuestionForLocale('ru') });

    // The score is recorded exactly once, in the initial slot.
    const scoreWrites = rpUpdates.filter(
      (u) => u.data.closureInitialScore === 5 || u.data.closurePostScore === 5,
    );
    expect(scoreWrites.length).toBeGreaterThanOrEqual(1);
    expect(scoreWrites[0].data.closureInitialScore).toBe(5);
  });

  it('5 is below threshold, so the turn continues to stabilisation', async () => {
    const process = (entered.ok && entered.process)!;
    const decision = await replyTurn(process, '5');
    expect(5).toBeLessThan(STABILITY_CLOSE_THRESHOLD);
    expect(decision.kind).toBe('constrain');
    expect(decision).toMatchObject({ note: 'stabilisation' });
    expect(decision.process.state).toBe('DELIVERING_STABILISATION');
  });
});

// ---------------------------------------------------------------------------
// The bug itself, so the fix cannot be silently undone
// ---------------------------------------------------------------------------

describe('the old anchor reproduces the live duplicate', () => {
  it('anchoring at observedAt makes §3 re-deliver the question', async () => {
    const stale = transitionClosureProcess(INCOMPLETE_ROW, 'AWAITING_INITIAL_SCORE', {
      now: BOUNDARY_OBSERVED_AT, // what the boundary used before this fix
    });
    expect(stale.ok).toBe(true);
    const process = (stale.ok && stale.process)!;

    // The triggering message is now BEHIND the anchor, so nothing is counted.
    await expect(countSince(process.transitionedAt!)).resolves.toBe(0);

    const decision = await replyTurn(process, '5');
    expect(decision.kind).toBe('deliver');
    expect(decision).toMatchObject({
      step: 'stability_question',
      text: getStabilityQuestionForLocale('ru'),
    });
    // ...and the user's "5" was never captured.
    expect(rpUpdates.some((u) => u.data.closureInitialScore === 5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Blast radius
// ---------------------------------------------------------------------------

describe('nothing else moved', () => {
  it('the anchor shifts by exactly one millisecond', () => {
    const at = new Date('2026-08-19T12:43:10.000Z');
    expect(boundaryEntryAnchor(at).getTime()).toBe(at.getTime() - 1);
    // Which is all `countUserMessagesSince`'s `createdAt > since` needs:
    // anchoring AT the message would exclude it and reproduce the bug.
    expect(boundaryEntryAnchor(at).getTime()).toBeLessThan(at.getTime());
  });

  it('it is pure and does not mutate its input', () => {
    const at = new Date('2026-08-19T12:43:10.000Z');
    const before = at.getTime();
    boundaryEntryAnchor(at);
    expect(at.getTime()).toBe(before);
  });

  it('orchestrator §3 is untouched — the counter keeps its meaning', () => {
    const orch = readFileSync(
      path.join(process.cwd(), 'lib/journey/closure/orchestrator.ts'),
      'utf8',
    );
    expect(orch).toContain('const anchor = process.transitionedAt ?? process.enteredAt ?? now;');
    expect(orch).toContain('if (spoken === 0) {');
    // And §4's own entry condition is still its own.
    expect(orch).toContain("if (process.state === 'NONE') {");
  });

  it('the route anchors the entry on the persisted message, not on observedAt', () => {
    const route = readFileSync(
      path.join(process.cwd(), 'app/api/journey/turn/route.ts'),
      'utf8',
    );
    expect(route).toContain('{ now: boundaryEntryAnchor(userMessageRow.createdAt) }');
    expect(route).toContain('select: { createdAt: true },');
    // The gate and every measurement still run on the single trusted reading.
    expect(route).toContain('const observedAt = args.preParsed?.observedAt ?? new Date();');
  });
});
