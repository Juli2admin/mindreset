// PR 2 — "stop default poisoning". The fail-safe default is the single source
// of truth for "this turn carried no real state report", and every path that
// produces it marks the report `_defaulted: true`. The marker must also survive
// the audit persist→reload cycle (store JSON.stringify(report), decrypt, then
// parseStateReport again) so the gate windows can keep excluding the turn.

import { describe, it, expect } from 'vitest';
import { parseStateReport } from './parse';

const REAL = JSON.stringify({
  intensity: 4,
  safetyFlag: 'none',
  recommendedAction: 'advance',
  readinessTouched: ['anchor_identified'],
});

describe('parseStateReport — _defaulted marker', () => {
  it('marks a null (missing) report as defaulted', () => {
    const r = parseStateReport(null);
    expect(r._defaulted).toBe(true);
    expect(r.intensity).toBe(5);
    expect(r.safetyFlag).toBe('watch');
    expect(r.recommendedAction).toBe('stay');
  });

  it('marks unparseable JSON as defaulted (and keeps _raw)', () => {
    const r = parseStateReport('{ not valid json');
    expect(r._defaulted).toBe(true);
    expect(r._raw).toBe('{ not valid json');
  });

  it('marks non-object JSON (array) as defaulted', () => {
    const r = parseStateReport('[1,2,3]');
    expect(r._defaulted).toBe(true);
  });

  it('does NOT mark a real, well-formed report', () => {
    const r = parseStateReport(REAL);
    expect(r._defaulted).toBeUndefined();
    expect(r.recommendedAction).toBe('advance');
  });

  it('preserves the marker across the persist→reload cycle', () => {
    // A turn defaulted at emit time is stored as JSON.stringify(report).
    const emitted = parseStateReport(null); // { ..., _defaulted: true }
    const stored = JSON.stringify(emitted);
    const reloaded = parseStateReport(stored);
    // Valid JSON, so it takes the success path — but the marker is re-applied.
    expect(reloaded._defaulted).toBe(true);
  });

  it('does not invent the marker from a report that lacks it', () => {
    const stored = JSON.stringify({
      intensity: 3,
      safetyFlag: 'none',
      recommendedAction: 'stay',
    });
    const reloaded = parseStateReport(stored);
    expect(reloaded._defaulted).toBeUndefined();
  });
});
