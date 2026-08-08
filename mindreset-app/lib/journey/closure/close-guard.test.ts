// Regression tests for the live 2026-08-08 below-threshold visible close.
//
// THE FAILURE BEING REPRODUCED. User-reported stability 5, below the approved
// threshold of 6. One stabilisation round delivered, so the process re-entered
// DELIVERING_STABILISATION, whose note says verbatim "Do not close the session
// on this turn." The Clinician delivered the practice AND said goodbye:
//
//   «Иди делать дела. Серьёзно.» … «Сегодня достаточно.»
//
// and recorded `moveJustPerformed: [..., "universal.session_close"]` in its own
// state report. The backend was correct — cycleCanClose false — but the user
// was told the session was finished.
//
// What must NOT regress: a legitimate CLOSED and a legitimate INCOMPLETE are
// real outcomes and must never be corrected.

import { describe, expect, it } from 'vitest';

import {
  CLOSE_CORRECTION_EN,
  CLOSE_CORRECTION_RU,
  claimsVisibleClose,
  closeCorrectionFor,
  getCloseCorrectionForLocale,
} from './close-guard';
import type { ClosureNoteKind } from './state-notes';
import type { CanonicalMove, StateReport } from '../stateReport/schema';

function report(moves?: CanonicalMove[]): StateReport {
  return {
    intensity: 6,
    safetyFlag: 'watch',
    recommendedAction: 'stay',
    ...(moves ? { moveJustPerformed: moves } : {}),
  };
}

/** The state report from the live failing turn, 2026-08-08T14:10:15Z. */
const LIVE_FAILING_REPORT = report([
  'universal.rupture_receive',
  'universal.practice_regulation',
  'universal.session_close',
]);

describe('ACCEPTANCE — the live score-5 below-threshold close', () => {
  it('corrects the close when the state forbids it', () => {
    const out = closeCorrectionFor({
      note: 'stabilisation',
      report: LIVE_FAILING_REPORT,
      locale: 'ru',
    });
    expect(out).toBe(CLOSE_CORRECTION_RU);
  });

  it('uses the language the user is writing in', () => {
    // The same live session that received the stability question in English.
    expect(
      closeCorrectionFor({ note: 'stabilisation', report: LIVE_FAILING_REPORT, locale: 'en' }),
    ).toBe(CLOSE_CORRECTION_EN);
    expect(
      closeCorrectionFor({ note: 'stabilisation', report: LIVE_FAILING_REPORT, locale: null }),
    ).toBe(CLOSE_CORRECTION_EN);
  });

  it('the correction confirms the user may stop and claims no completion', () => {
    // The two things the approved copy must do, and the things it must not.
    for (const text of [CLOSE_CORRECTION_RU, CLOSE_CORRECTION_EN]) {
      expect(text).not.toContain('?');
    }
    expect(CLOSE_CORRECTION_RU).toContain('можем остановиться');
    expect(CLOSE_CORRECTION_EN).toContain('we can stop');
  });
});

describe('legitimate outcomes are never corrected', () => {
  it('a real CLOSED turn is left alone', () => {
    // Score at or above threshold. The close IS the correct outcome.
    expect(
      closeCorrectionFor({ note: 'closing', report: LIVE_FAILING_REPORT, locale: 'ru' }),
    ).toBeNull();
  });

  it('a real INCOMPLETE release is left alone', () => {
    // Rounds exhausted, or the approved one-re-ask-then-release path. The user
    // is being let go honestly; contradicting that would trap them.
    expect(
      closeCorrectionFor({ note: 'incomplete', report: LIVE_FAILING_REPORT, locale: 'ru' }),
    ).toBeNull();
  });

  it('an ordinary turn with no closure note is left alone', () => {
    // Production default: every process is NONE, so no note exists and this
    // branch can never fire on an ordinary session.
    expect(
      closeCorrectionFor({ note: null, report: LIVE_FAILING_REPORT, locale: 'ru' }),
    ).toBeNull();
  });

  it('exit intent alone never triggers it', () => {
    // The user asking to leave carries no note unless a stabilisation round is
    // actually owed, so condition 1 fails before the report is even read.
    for (const note of [null, 'closing', 'incomplete'] as (ClosureNoteKind | null)[]) {
      expect(closeCorrectionFor({ note, report: LIVE_FAILING_REPORT, locale: 'ru' })).toBeNull();
    }
  });
});

describe('the signal is structured, not prose', () => {
  it('a stabilisation turn that does NOT claim a close is left alone', () => {
    // The ordinary, correct DELIVERING_STABILISATION turn. This is the common
    // case and must stay untouched.
    expect(
      closeCorrectionFor({
        note: 'stabilisation',
        report: report(['universal.practice_regulation', 'universal.witness_and_reflect']),
        locale: 'ru',
      }),
    ).toBeNull();
  });

  it('a missing or malformed moveJustPerformed reads as no claim', () => {
    expect(claimsVisibleClose(report())).toBe(false);
    expect(claimsVisibleClose(report([]))).toBe(false);
    expect(
      claimsVisibleClose({ ...report(), moveJustPerformed: null as never }),
    ).toBe(false);
    expect(
      claimsVisibleClose({ ...report(), moveJustPerformed: 'session_close' as never }),
    ).toBe(false);
  });

  it('detects the claim wherever it sits in the move list', () => {
    expect(claimsVisibleClose(report(['universal.session_close']))).toBe(true);
    expect(claimsVisibleClose(LIVE_FAILING_REPORT)).toBe(true);
  });

  it('no wording is inspected — the same prose without the move is untouched', () => {
    // «Сегодня достаточно.» in the reply is irrelevant; only the structured
    // claim counts. This is what bounds the false-positive surface.
    expect(
      closeCorrectionFor({
        note: 'stabilisation',
        report: report(['universal.practice_somatic']),
        locale: 'ru',
      }),
    ).toBeNull();
  });
});

describe('locale selection', () => {
  it('ru for ru, en for everything else', () => {
    expect(getCloseCorrectionForLocale('ru')).toBe(CLOSE_CORRECTION_RU);
    for (const l of ['en', 'pl', 'de', null, undefined]) {
      expect(getCloseCorrectionForLocale(l)).toBe(CLOSE_CORRECTION_EN);
    }
  });
});
