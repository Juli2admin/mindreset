// Tests for deriveWorkingMemory — the Clinician Working Memory projection
// (2026-08-08). Pure function, `nowMs` injected.
//
// Timestamps here are RELATIVE to a fixed synthetic NOW that is itself
// relative to the real clock. Never pin an absolute date near "now": the
// session-boundary walk measures against the value passed in, and an absolute
// date passes on the day it is written and breaks the build the next day
// (this took production builds down on 2026-08-06, #364).

import { describe, it, expect } from 'vitest';
import {
  deriveWorkingMemory,
  SESSION_BOUNDARY_MS,
  type SensitivityInputRow,
  type StateReportForSensitivity,
} from './load';
import { MAX_MEASUREMENT_AGE_MS } from '../closure/measurement-age';

const NOW = Date.now();
const MIN = 60 * 1000;

/** Newest-first rows, as the loader supplies them. `minsAgo` counts back. */
function row(minsAgo: number, report: StateReportForSensitivity | null): SensitivityInputRow {
  return { createdAtMs: NOW - minsAgo * MIN, report };
}

describe('deriveWorkingMemory — empty and session scoping', () => {
  it('returns null with no rows', () => {
    expect(deriveWorkingMemory([], false, NOW, null)).toBeNull();
  });

  it('returns null on a session resume — a new session has no session memory', () => {
    const rows = [row(1, { intensity: 4 }), row(2, { intensity: 8 })];
    expect(deriveWorkingMemory(rows, true, NOW, null)).toBeNull();
  });

  it('returns null when rows carry nothing usable', () => {
    expect(deriveWorkingMemory([row(1, {}), row(2, null)], false, NOW, null)).toBeNull();
  });

  it('excludes turns beyond the session boundary from the trajectory', () => {
    const rows = [
      row(1, { intensity: 7 }),
      row(2, { intensity: 6 }),
      // Older than SESSION_BOUNDARY_MS before the row above → previous session.
      row(2 + SESSION_BOUNDARY_MS / MIN + 1, { intensity: 1 }),
    ];
    const wm = deriveWorkingMemory(rows, false, NOW, null);
    expect(wm?.activation?.readings).toEqual([6, 7]);
  });
});

describe('deriveWorkingMemory — activation trajectory', () => {
  it('orders readings oldest-first and reports direction and maximum', () => {
    const rows = [row(1, { intensity: 8 }), row(5, { intensity: 5 }), row(9, { intensity: 3 })];
    const wm = deriveWorkingMemory(rows, false, NOW, null);
    expect(wm?.activation).toEqual({ readings: [3, 5, 8], max: 8, direction: 'rising' });
  });

  it('reports falling and steady directions from first vs last', () => {
    const falling = deriveWorkingMemory(
      [row(1, { intensity: 2 }), row(5, { intensity: 9 })],
      false,
      NOW,
      null,
    );
    expect(falling?.activation?.direction).toBe('falling');

    const steady = deriveWorkingMemory(
      [row(1, { intensity: 5 }), row(5, { intensity: 7 }), row(9, { intensity: 5 })],
      false,
      NOW,
      null,
    );
    expect(steady?.activation?.direction).toBe('steady');
    expect(steady?.activation?.max).toBe(7);
  });

  it('is null below two readings — one point is not a trajectory', () => {
    const wm = deriveWorkingMemory([row(1, { intensity: 6, cycleStatus: 'open' })], false, NOW, null);
    expect(wm?.activation).toBeNull();
  });

  // BP-D
  it('excludes defaulted reports — a parser default is not a reading', () => {
    const rows = [
      row(1, { intensity: 8 }),
      row(3, { intensity: 5, safetyFlag: 'watch', _defaultedReport: true }),
      row(5, { intensity: 3 }),
    ];
    const wm = deriveWorkingMemory(rows, false, NOW, null);
    expect(wm?.activation?.readings).toEqual([3, 8]);
    expect(wm?.activation?.max).toBe(8);
  });

  it('is null when the only readings came from defaulted reports', () => {
    const rows = [
      row(1, { intensity: 5, safetyFlag: 'watch', _defaultedReport: true }),
      row(3, { intensity: 5, safetyFlag: 'watch', _defaultedReport: true }),
    ];
    // Nothing usable survives the BP-D exclusion, so there is no projection
    // at all — not a projection full of nulls.
    expect(deriveWorkingMemory(rows, false, NOW, null)).toBeNull();
  });
});

describe('deriveWorkingMemory — safety status', () => {
  it('reports the latest flag and the session worst', () => {
    const rows = [
      row(1, { safetyFlag: 'none' }),
      row(4, { safetyFlag: 'watch' }),
      row(8, { safetyFlag: 'none' }),
    ];
    const wm = deriveWorkingMemory(rows, false, NOW, null);
    expect(wm?.safety).toEqual({ current: 'none', sessionWorst: 'watch' });
  });

  it('ranks red_flag above watch', () => {
    const rows = [row(1, { safetyFlag: 'watch' }), row(4, { safetyFlag: 'red_flag' })];
    expect(deriveWorkingMemory(rows, false, NOW, null)?.safety?.sessionWorst).toBe('red_flag');
  });

  // BP-D
  it('ignores the synthetic watch from a defaulted report', () => {
    const rows = [
      row(1, { safetyFlag: 'none' }),
      row(3, { intensity: 5, safetyFlag: 'watch', _defaultedReport: true }),
      row(5, { safetyFlag: 'none' }),
    ];
    const wm = deriveWorkingMemory(rows, false, NOW, null);
    expect(wm?.safety).toEqual({ current: 'none', sessionWorst: 'none' });
  });
});

describe('deriveWorkingMemory — practices', () => {
  const run = (
    name: string,
    status: 'completed' | 'aborted_overwhelm',
  ): StateReportForSensitivity => ({
    practiceRun: { kind: 'generated', name, family: 'somatic', status },
  });

  it('collects this session, most recent first', () => {
    const rows = [row(1, run('B', 'aborted_overwhelm')), row(5, run('A', 'completed'))];
    const wm = deriveWorkingMemory(rows, false, NOW, null);
    expect(wm?.practices.map((p) => p.name)).toEqual(['B', 'A']);
    expect(wm?.practices[0].status).toBe('aborted_overwhelm');
    expect(wm?.practices[0].family).toBe('somatic');
  });

  it('applies no separate cap — the report window is the only bound', () => {
    // One practiceRun per report, so the hard ceiling is the existing take:10
    // read window, narrowed to the current session. Eight in-session runs all
    // come back.
    const rows = Array.from({ length: 8 }, (_, i) => row(i + 1, run(`P${i}`, 'completed')));
    expect(deriveWorkingMemory(rows, false, NOW, null)?.practices).toHaveLength(8);
  });

  it("skips kind 'none'", () => {
    const rows = [row(1, { practiceRun: { kind: 'none', status: 'completed' } })];
    expect(deriveWorkingMemory(rows, false, NOW, null)).toBeNull();
  });

  it('carries a modality switch when one was recorded', () => {
    const rows = [
      row(1, {
        practiceRun: {
          kind: 'generated',
          name: 'X',
          family: 'somatic',
          status: 'completed',
          modalitySwitched: { from: 'imagery', to: 'somatic' },
        },
      }),
    ];
    expect(deriveWorkingMemory(rows, false, NOW, null)?.practices[0].modalitySwitched).toEqual({
      from: 'imagery',
      to: 'somatic',
    });
  });
});

describe('deriveWorkingMemory — formulation deltas', () => {
  it('takes at most three, newest first, tagged by turnsAgo', () => {
    const rows = [
      row(1, { clinicalRead: 'one' }),
      row(2, { clinicalRead: 'two' }),
      row(3, { clinicalRead: 'three' }),
      row(4, { clinicalRead: 'four' }),
    ];
    const wm = deriveWorkingMemory(rows, false, NOW, null);
    expect(wm?.formulationDeltas).toEqual([
      { turnsAgo: 1, text: 'one' },
      { turnsAgo: 2, text: 'two' },
      { turnsAgo: 3, text: 'three' },
    ]);
  });

  it('truncates each delta at 240 characters', () => {
    const long = 'x'.repeat(400);
    const wm = deriveWorkingMemory([row(1, { clinicalRead: long })], false, NOW, null);
    expect(wm?.formulationDeltas[0].text).toHaveLength(240);
  });

  it('skips the read already rendering as openCycleDescription', () => {
    const rows = [row(1, { clinicalRead: 'shown in the cycle block' }), row(2, { clinicalRead: 'fresh' })];
    const wm = deriveWorkingMemory(rows, false, NOW, 'shown in the cycle block');
    expect(wm?.formulationDeltas).toEqual([{ turnsAgo: 2, text: 'fresh' }]);
  });

  it('ignores blank reads', () => {
    expect(deriveWorkingMemory([row(1, { clinicalRead: '   ' })], false, NOW, null)).toBeNull();
  });
});

describe('deriveWorkingMemory — newest recorded value wins', () => {
  it('takes the most recent request status, cycle status and Adult Self reading', () => {
    const rows = [
      row(1, { cycleStatus: 'closing' }),
      row(3, { presentingRequestStatus: 'unresolved', adultSelfPresent: true }),
      row(6, { cycleStatus: 'open', presentingRequestStatus: 'parked', adultSelfPresent: false }),
    ];
    const wm = deriveWorkingMemory(rows, false, NOW, null);
    expect(wm?.cycleStatus).toBe('closing');
    expect(wm?.requestStatus).toBe('unresolved');
    expect(wm?.adultSelf).toEqual({ present: true, turnsAgo: 2 });
  });

  it("keeps 'closing' distinct from 'open'", () => {
    const open = deriveWorkingMemory([row(1, { cycleStatus: 'open' })], false, NOW, null);
    const closing = deriveWorkingMemory([row(1, { cycleStatus: 'closing' })], false, NOW, null);
    expect(open?.cycleStatus).toBe('open');
    expect(closing?.cycleStatus).toBe('closing');
  });
});

describe('deriveWorkingMemory — grounding readings', () => {
  const at = (minsAgo: number) => new Date(NOW - minsAgo * MIN).toISOString();

  it('carries score, scale, source and age', () => {
    const rows = [
      row(2, {
        stabilityCheck: {
          score: 7,
          scale: 'stability',
          source: 'user_reported',
          observedAt: at(2),
        },
      }),
    ];
    expect(deriveWorkingMemory(rows, false, NOW, null)?.stability).toEqual({
      score: 7,
      scale: 'stability',
      source: 'user_reported',
      ageMinutes: 2,
    });
  });

  it('drops a reading past the measurement-age bound rather than showing it stale', () => {
    const staleMins = MAX_MEASUREMENT_AGE_MS / MIN + 5;
    const rows = [
      row(staleMins, {
        stabilityCheck: { score: 9, scale: 'stability', source: 'user_reported', observedAt: at(staleMins) },
      }),
    ];
    // Still inside the session window, but too old to count as current.
    expect(deriveWorkingMemory(rows, false, NOW, null)).toBeNull();
  });

  it('treats a missing scale as ambiguous, never as a stability reading', () => {
    const rows = [row(1, { stabilityCheck: { score: 8, source: 'user_reported', observedAt: at(1) } })];
    expect(deriveWorkingMemory(rows, false, NOW, null)?.stability?.scale).toBe('ambiguous');
  });

  it('keeps distress separate and unscaled', () => {
    const rows = [
      row(1, { distressIntensity: { score: 6, source: 'user_reported', observedAt: at(1) } }),
    ];
    const wm = deriveWorkingMemory(rows, false, NOW, null);
    expect(wm?.distress).toEqual({ score: 6, scale: null, source: 'user_reported', ageMinutes: 1 });
    expect(wm?.stability).toBeNull();
  });

  it('ignores a reading with no server observedAt', () => {
    const rows = [row(1, { stabilityCheck: { score: 8, scale: 'stability' } })];
    expect(deriveWorkingMemory(rows, false, NOW, null)).toBeNull();
  });
});
