// BP-D (2026-08-08) — a report that was never emitted must not become a
// clinical reading.
//
// When the model emits no readable <state-report>, parseStateReport returns
// its defensive default (intensity 5 / safetyFlag watch). finaliseTurn then
// persists JSON.stringify(report), so the audit row holds well-formed JSON
// that is indistinguishable from a genuine "5 / watch" turn on re-read. The
// marker records the provenance so downstream readers can exclude it.
//
// The round-trip test is the one that protects the whole fix: without the
// copy-through, the marker is lost the first time a stored blob is re-parsed.

import { describe, it, expect } from 'vitest';
import { parseStateReport } from './parse';

describe('BP-D — defaulted-report marker', () => {
  it('marks a null raw report', () => {
    const r = parseStateReport(null);
    expect(r._defaultedReport).toBe(true);
    // Fail-safe values themselves are unchanged.
    expect(r.intensity).toBe(5);
    expect(r.safetyFlag).toBe('watch');
    expect(r.recommendedAction).toBe('stay');
  });

  it('marks unparseable JSON', () => {
    const r = parseStateReport('{not json');
    expect(r._defaultedReport).toBe(true);
    expect(r._raw).toBe('{not json');
  });

  it('marks JSON that is not an object', () => {
    expect(parseStateReport('[1,2,3]')._defaultedReport).toBe(true);
    expect(parseStateReport('"a string"')._defaultedReport).toBe(true);
  });

  it('does NOT mark a genuine report', () => {
    const r = parseStateReport(
      JSON.stringify({ intensity: 8, safetyFlag: 'none', recommendedAction: 'stay' }),
    );
    expect(r._defaultedReport).toBeUndefined();
    expect(r.intensity).toBe(8);
  });

  it('does NOT mark a genuine report that happens to say 5 / watch', () => {
    const r = parseStateReport(
      JSON.stringify({ intensity: 5, safetyFlag: 'watch', recommendedAction: 'stay' }),
    );
    expect(r._defaultedReport).toBeUndefined();
  });

  it('survives the persist round-trip — stringify then re-parse', () => {
    // What finaliseTurn does: parse (fails) → stringify → store.
    const written = parseStateReport(null);
    const stored = JSON.stringify(written);
    // What a later turn does: decrypt → parse.
    const reread = parseStateReport(stored);
    expect(reread._defaultedReport).toBe(true);
    expect(reread.intensity).toBe(5);
  });

  it('does not resurrect the marker from a report that never had it', () => {
    const genuine = JSON.stringify({ intensity: 7, safetyFlag: 'none', recommendedAction: 'stay' });
    expect(parseStateReport(JSON.stringify(parseStateReport(genuine)))._defaultedReport).toBeUndefined();
  });

  it('ignores a non-true value in the stored blob', () => {
    const r = parseStateReport(
      JSON.stringify({ intensity: 7, safetyFlag: 'none', recommendedAction: 'stay', _defaultedReport: 'yes' }),
    );
    expect(r._defaultedReport).toBeUndefined();
  });
});
