// The VERIFY half of constrain-then-verify — Phase 2 (2026-08-08).
//
// DELIVERING_STABILISATION is the one live closure state whose action is
// clinical and cannot be code-authored. The pre-LLM note ASKS for it; this
// module decides whether it actually happened. An instruction alone is what
// failed on 2026-08-08, so the state must not advance on the clinician's
// say-so.
//
// Direction of error is deliberate: a miss holds the process and the note is
// delivered again next turn. A false positive would advance a user who was
// never stabilised, so every ambiguous case must read as "not delivered".

import { describe, expect, it } from 'vitest';

import { stabilisationDelivered } from './stabilisation-evidence';
import type { PracticeRun, StateReport } from '../stateReport/schema';

function report(practiceRun?: PracticeRun): StateReport {
  return {
    intensity: 5,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    ...(practiceRun ? { practiceRun } : {}),
  };
}

describe('a stabilising practice was delivered', () => {
  it('a completed regulation practice counts', () => {
    const e = stabilisationDelivered(
      report({ kind: 'canonical', name: 'Box breathing', family: 'regulation', status: 'completed' }),
    );
    expect(e.delivered).toBe(true);
    if (e.delivered !== true) return;
    expect(e.family).toBe('regulation');
    expect(e.name).toBe('Box breathing');
  });

  it('a completed somatic practice counts', () => {
    // journey-master.md:309 names both families; micro-movement is somatic.
    const e = stabilisationDelivered(
      report({ kind: 'generated', family: 'somatic', status: 'completed' }),
    );
    expect(e.delivered).toBe(true);
    if (e.delivered !== true) return;
    expect(e.family).toBe('somatic');
    expect(e.name).toBeNull();
  });
});

describe('it was NOT delivered', () => {
  it('no practiceRun at all', () => {
    expect(stabilisationDelivered(report())).toEqual({
      delivered: false,
      reason: 'no_practice_run',
    });
  });

  it('an explicit kind:none', () => {
    expect(
      stabilisationDelivered(report({ kind: 'none', status: 'completed' })),
    ).toEqual({ delivered: false, reason: 'no_practice_run' });
  });

  it('a practice with no family recorded', () => {
    expect(
      stabilisationDelivered(report({ kind: 'generated', status: 'completed' })),
    ).toEqual({ delivered: false, reason: 'wrong_family' });
  });

  it('a completed practice from a non-stabilising family', () => {
    // Real clinical work, but not what this state requires.
    for (const family of ['landscape', 'narrative', 'compassion', 'none'] as const) {
      expect(
        stabilisationDelivered(report({ kind: 'canonical', family, status: 'completed' })),
      ).toEqual({ delivered: false, reason: 'wrong_family' });
    }
  });

  it('a stabilising practice still in flight', () => {
    for (const status of ['started', 'mid'] as const) {
      expect(
        stabilisationDelivered(report({ kind: 'canonical', family: 'regulation', status })),
      ).toEqual({ delivered: false, reason: 'not_completed' });
    }
  });

  it('a stabilising practice that was aborted', () => {
    for (const status of ['aborted_user_request', 'aborted_overwhelm'] as const) {
      expect(
        stabilisationDelivered(report({ kind: 'generated', family: 'somatic', status })),
      ).toEqual({ delivered: false, reason: 'not_completed' });
    }
  });
});
