// Tests for the stabilising-before-closing protocol field added in PR 8
// (2026-06-26). The AI emits stabilityCheck when running an explicit
// 1-10 stability check on the user — typically before a session pause
// or close after destabilisation in-session.

import { describe, expect, it } from 'vitest';
import { parseStateReport } from './parse';

const BASE = {
  intensity: 4,
  safetyFlag: 'none' as const,
  recommendedAction: 'stay' as const,
};

describe('parseStateReport — stabilityCheck (PR 8)', () => {
  it('accepts a valid score with contextNote', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        stabilityCheck: { score: 8, contextNote: 'before_close' },
      }),
    );
    expect(r.stabilityCheck).toEqual({ score: 8, contextNote: 'before_close' });
  });

  it('accepts a numeric score in string form', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        stabilityCheck: { score: '6' },
      }),
    );
    expect(r.stabilityCheck?.score).toBe(6);
  });

  it('clamps scores below 1 to 1', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, stabilityCheck: { score: 0 } }),
    );
    expect(r.stabilityCheck?.score).toBe(1);
  });

  it('clamps scores above 10 to 10', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, stabilityCheck: { score: 15 } }),
    );
    expect(r.stabilityCheck?.score).toBe(10);
  });

  it('rounds non-integer scores', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, stabilityCheck: { score: 6.7 } }),
    );
    expect(r.stabilityCheck?.score).toBe(7);
  });

  it('truncates contextNote at 80 chars', () => {
    const longNote = 'a'.repeat(200);
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        stabilityCheck: { score: 5, contextNote: longNote },
      }),
    );
    expect(r.stabilityCheck?.contextNote?.length).toBe(80);
  });

  it('drops stabilityCheck when score is not numeric', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        stabilityCheck: { score: 'not_a_number' },
      }),
    );
    expect(r.stabilityCheck).toBeUndefined();
  });

  it('drops stabilityCheck when missing entirely', () => {
    const r = parseStateReport(JSON.stringify(BASE));
    expect(r.stabilityCheck).toBeUndefined();
  });

  it('drops stabilityCheck when not an object', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, stabilityCheck: 'just a string' }),
    );
    expect(r.stabilityCheck).toBeUndefined();
  });

  it('accepts known contextNote values from the protocol', () => {
    for (const note of [
      'before_close',
      'after_destabilisation',
      'periodic',
    ]) {
      const r = parseStateReport(
        JSON.stringify({
          ...BASE,
          stabilityCheck: { score: 7, contextNote: note },
        }),
      );
      expect(r.stabilityCheck?.contextNote).toBe(note);
    }
  });
});
