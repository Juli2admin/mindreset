// PR 2 — "stop default poisoning". A turn whose state report was missing at
// emit time is stored with the fail-safe default (intensity 5 / watch / stay)
// and marked `_defaulted: true`. These pure window helpers must EXCLUDE such
// turns from the intensity/safety gate windows — a fabricated 'watch' or '5'
// must not silently block (or mask) a real advance decision on later turns —
// while a REAL 'watch', and a verifier-set 'red_flag' on a defaulted turn,
// still block. Day/session counting is unaffected (the turn really happened).

import { describe, expect, it } from 'vitest';
import {
  lastTwoIntensities,
  safetyNoneForLast,
  noRedFlagInLast,
  distinctDays,
  type AuditTurn,
} from './history';
import type { StateReport } from '../stateReport/schema';

function makeTurn(daysAgo: number, report: Partial<StateReport> = {}): AuditTurn {
  const d = new Date('2026-06-30T12:00:00Z');
  d.setDate(d.getDate() - daysAgo);
  const fullReport: StateReport = {
    intensity: 4,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    ...report,
  };
  return {
    id: `turn_${daysAgo}_${fullReport.safetyFlag}_${String(fullReport._defaulted)}`,
    createdAt: d,
    stageAtTurn: 2,
    depthAtTurn: 'surface',
    intensityReported: fullReport.intensity,
    safetyFlag: fullReport.safetyFlag,
    recommendedAction: fullReport.recommendedAction,
    report: fullReport,
  };
}

// A defaulted turn as the loader/parser produces it: fabricated 5 / watch /
// stay carried on both the columns and the report, plus the marker.
function makeDefaultedTurn(daysAgo: number, extra: Partial<StateReport> = {}): AuditTurn {
  return makeTurn(daysAgo, {
    intensity: 5,
    safetyFlag: 'watch',
    recommendedAction: 'stay',
    _defaulted: true,
    ...extra,
  });
}

describe('lastTwoIntensities — excludes defaulted turns', () => {
  it('skips the fabricated 5 and surfaces the two real readings', () => {
    const turns = [
      makeTurn(4, { intensity: 7 }),
      makeTurn(3, { intensity: 3 }),
      makeDefaultedTurn(2), // fabricated 5 — must be skipped
      makeDefaultedTurn(1), // fabricated 5 — must be skipped
    ];
    // Without the fix this would be [5, 5]; with it, the two real reads.
    expect(lastTwoIntensities(turns)).toEqual([3, 7]);
  });

  it('reports fewer than two when there are not two real readings', () => {
    const turns = [makeDefaultedTurn(2), makeTurn(1, { intensity: 4 })];
    expect(lastTwoIntensities(turns)).toEqual([4]);
  });

  it('is unchanged for a window of real turns', () => {
    const turns = [makeTurn(2, { intensity: 2 }), makeTurn(1, { intensity: 5 })];
    expect(lastTwoIntensities(turns)).toEqual([5, 2]);
  });
});

describe('safetyNoneForLast — excludes fabricated watch only', () => {
  it('a fabricated-watch turn does not block when the real turns are none', () => {
    const turns = [
      makeTurn(4, { safetyFlag: 'none' }),
      makeTurn(3, { safetyFlag: 'none' }),
      makeDefaultedTurn(2), // fabricated 'watch' — excused
      makeTurn(1, { safetyFlag: 'none' }),
    ];
    // 3 real 'none' turns exist after excusing the fabricated watch.
    expect(safetyNoneForLast(turns, 3)).toBe(true);
  });

  it('a REAL watch still blocks', () => {
    const turns = [
      makeTurn(3, { safetyFlag: 'none' }),
      makeTurn(2, { safetyFlag: 'watch' }), // genuine watch, not defaulted
      makeTurn(1, { safetyFlag: 'none' }),
    ];
    expect(safetyNoneForLast(turns, 3)).toBe(false);
  });

  it('a defaulted turn upgraded to red_flag by the verifier still blocks', () => {
    const turns = [
      makeTurn(3, { safetyFlag: 'none' }),
      makeTurn(2, { safetyFlag: 'none' }),
      makeDefaultedTurn(1, { safetyFlag: 'red_flag' }), // not a fabricated watch
    ];
    expect(safetyNoneForLast(turns, 3)).toBe(false);
  });

  it('requires N real (non-fabricated) turns to exist', () => {
    const turns = [
      makeDefaultedTurn(3),
      makeDefaultedTurn(2),
      makeTurn(1, { safetyFlag: 'none' }),
    ];
    // Only one real turn — cannot satisfy a 3-turn clean window.
    expect(safetyNoneForLast(turns, 3)).toBe(false);
  });
});

describe('noRedFlagInLast — still catches a red_flag on a defaulted turn', () => {
  it('a verifier red_flag on a defaulted turn is NOT excused', () => {
    const turns = [
      makeTurn(3, { safetyFlag: 'none' }),
      makeDefaultedTurn(2, { safetyFlag: 'red_flag' }),
      makeTurn(1, { safetyFlag: 'none' }),
    ];
    expect(noRedFlagInLast(turns, 3)).toBe(false);
  });

  it('fabricated watch does not trip it', () => {
    const turns = [makeDefaultedTurn(2), makeTurn(1, { safetyFlag: 'none' })];
    expect(noRedFlagInLast(turns, 3)).toBe(true);
  });
});

describe('day counting is unaffected by the marker', () => {
  it('a defaulted turn still counts toward distinct days', () => {
    const turns = [
      makeTurn(2, {}),
      makeDefaultedTurn(1),
      makeDefaultedTurn(0),
    ];
    // Three different calendar days — the defaulted turns still happened.
    expect(distinctDays(turns)).toBe(3);
  });
});
