// Tests for deriveSensitivitySignals — the pure helper extracted during
// the PR α code-review pass (2026-07-09). Exercises the walk-back /
// session-boundary logic, edge cases, and every ordering rule.

import { describe, expect, it } from 'vitest';
import {
  deriveSensitivitySignals,
  SESSION_BOUNDARY_MS,
  type SensitivityInputRow,
  type StateReportForSensitivity,
} from './load';

const NOW = new Date('2026-07-09T12:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;

function row(
  hoursAgo: number,
  report: StateReportForSensitivity | null,
): SensitivityInputRow {
  return { createdAtMs: NOW - hoursAgo * HOUR, report };
}

describe('deriveSensitivitySignals — empty and edge cases', () => {
  it('returns empty defaults when there are no rows', () => {
    const r = deriveSensitivitySignals([], false, NOW);
    expect(r).toEqual({
      hasOpenCycle: false,
      openCycleDescription: null,
      sessionRejectedModalities: [],
      recentChannelShift: false,
    });
  });

  it('returns empty defaults when isSessionResume=true regardless of history', () => {
    // Even if the LAST session had an open cycle, a session-resume turn
    // wipes the slate — the AI decides whether to re-open.
    const rows = [
      row(0.1, { cycleStatus: 'open', clinicalRead: 'still active' }),
    ];
    const r = deriveSensitivitySignals(rows, true, NOW);
    expect(r.hasOpenCycle).toBe(false);
    expect(r.openCycleDescription).toBeNull();
    expect(r.sessionRejectedModalities).toEqual([]);
    expect(r.recentChannelShift).toBe(false);
  });

  it('handles a single-row session', () => {
    const rows = [
      row(0.05, {
        cycleStatus: 'open',
        clinicalRead: 'somatic release in progress',
      }),
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.hasOpenCycle).toBe(true);
    expect(r.openCycleDescription).toBe('somatic release in progress');
  });

  it('skips rows whose report is null (decrypt or parse failed)', () => {
    const rows = [
      row(0.05, null),
      row(0.5, {
        cycleStatus: 'open',
        clinicalRead: 'still visible below the null',
      }),
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.hasOpenCycle).toBe(true);
    expect(r.openCycleDescription).toBe('still visible below the null');
  });
});

describe('deriveSensitivitySignals — session-boundary walk-back', () => {
  it('includes rows within the current session (all gaps < 4h)', () => {
    const rows = [
      row(0.5, { cycleStatus: 'open', clinicalRead: 'most recent' }),
      row(1.5, { modalityRejected: ['body'] }),
      row(2.5, { channelShiftDetected: true }),
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.hasOpenCycle).toBe(true);
    expect(r.openCycleDescription).toBe('most recent');
    expect(r.sessionRejectedModalities).toEqual(['body']);
    expect(r.recentChannelShift).toBe(true);
  });

  it('EXCLUDES rows before a >=4h gap (they belong to a prior session)', () => {
    // Most recent turn is at 0.1h ago. Then a 5h gap to older material
    // that had an open cycle — that older cycle must NOT surface.
    const rows = [
      row(0.1, { cycleStatus: 'closed', clinicalRead: 'today' }),
      row(0.5, {}),
      row(5.5, {
        cycleStatus: 'open',
        clinicalRead: 'yesterday session',
      }),
      row(6.5, { modalityRejected: ['body', 'breathing'] }),
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.hasOpenCycle).toBe(false);
    expect(r.openCycleDescription).toBeNull();
    expect(r.sessionRejectedModalities).toEqual([]);
  });

  it('honours >=4h boundary at exact equality (>=, not >)', () => {
    // Row exactly 4h before the newest row of the current session.
    // Boundary logic uses >=, so this row is EXCLUDED.
    const rows = [
      row(0, {
        cycleStatus: 'closed',
        clinicalRead: 'fresh',
      }),
      {
        createdAtMs: NOW - SESSION_BOUNDARY_MS,
        report: {
          cycleStatus: 'open' as const,
          clinicalRead: 'exactly at boundary',
        },
      },
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.hasOpenCycle).toBe(false);
  });

  it('honours session boundary between now and the most-recent row', () => {
    // The most recent row is > 4h in the past — no rows are in "the
    // current session" from the router's perspective.
    const rows = [
      row(5, { cycleStatus: 'open', clinicalRead: 'stale' }),
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.hasOpenCycle).toBe(false);
  });
});

describe('deriveSensitivitySignals — cycle status precedence', () => {
  it('most recent cycleStatus wins', () => {
    const rows = [
      row(0.1, { cycleStatus: 'closed', clinicalRead: 'closed now' }),
      row(0.5, { cycleStatus: 'open', clinicalRead: 'was open earlier' }),
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    // A cycle that CLOSED at the most recent turn is not "open" — the
    // helper only surfaces open/closing.
    expect(r.hasOpenCycle).toBe(false);
    expect(r.openCycleDescription).toBeNull();
  });

  it('surfaces the OLDEST open-cycle description if newer turns lack cycleStatus', () => {
    const rows = [
      row(0.1, { channelShiftDetected: true }), // no cycleStatus
      row(0.5, { cycleStatus: 'open', clinicalRead: 'the open one' }),
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.hasOpenCycle).toBe(true);
    expect(r.openCycleDescription).toBe('the open one');
  });

  it('treats cycleStatus: "closing" as still open (not closed)', () => {
    const rows = [
      row(0.1, {
        cycleStatus: 'closing',
        clinicalRead: 'wrapping up',
      }),
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.hasOpenCycle).toBe(true);
    expect(r.openCycleDescription).toBe('wrapping up');
  });
});

describe('deriveSensitivitySignals — modality accumulation', () => {
  it('accumulates modalityRejected across all rows in the session', () => {
    const rows = [
      row(0.1, { modalityRejected: ['body'] }),
      row(0.5, { modalityRejected: ['breathing'] }),
      row(1.0, { modalityRejected: ['body'] }), // duplicate — deduped
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.sessionRejectedModalities.sort()).toEqual(
      ['body', 'breathing'].sort(),
    );
  });

  it("drops 'none' from the accumulator", () => {
    const rows = [
      row(0.1, { modalityRejected: ['none'] }),
      row(0.5, { modalityRejected: ['body'] }),
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.sessionRejectedModalities).toEqual(['body']);
  });

  it('handles empty modalityRejected arrays cleanly', () => {
    const rows = [
      row(0.1, { modalityRejected: [] }),
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.sessionRejectedModalities).toEqual([]);
  });
});

describe('deriveSensitivitySignals — channel shift scan window', () => {
  it('true when any of the last 3 turns had channelShiftDetected: true', () => {
    const rows = [
      row(0.1, { channelShiftDetected: false }),
      row(0.5, { channelShiftDetected: true }),
      row(1.0, {}),
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.recentChannelShift).toBe(true);
  });

  it('false when only turns OUTSIDE the last-3 window flagged a shift', () => {
    const rows = [
      row(0.1, { channelShiftDetected: false }),
      row(0.5, { channelShiftDetected: false }),
      row(1.0, { channelShiftDetected: false }),
      row(1.5, { channelShiftDetected: true }), // 4th turn — outside window
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.recentChannelShift).toBe(false);
  });

  it('false when no turn has flagged a shift', () => {
    const rows = [
      row(0.1, { channelShiftDetected: false }),
      row(0.5, {}),
    ];
    const r = deriveSensitivitySignals(rows, false, NOW);
    expect(r.recentChannelShift).toBe(false);
  });
});
