// Tests for server-owned stability-score capture — Phase 2 (structural).
//
// The rule under test is STRUCTURAL, never length-based (owner correction
// 2026-08-06): a message yields a score only if it decomposes entirely into
// one score token plus recognised filler. One unrecognised token rejects.
//
// The bias is deliberate — a missed capture produces no transition; a FALSE
// capture writes a fabricated clinical number.

import { describe, expect, it } from 'vitest';
import { captureStabilityScore } from './score-capture';

const score = (m: string) => {
  const r = captureStabilityScore(m);
  return r.found ? r.score : null;
};
const reason = (m: string): string | null => {
  const r = captureStabilityScore(m);
  return 'reason' in r ? r.reason : null;
};

describe('accepted forms', () => {
  it('bare integer', () => {
    expect(score('4')).toBe(4);
    expect(score('10')).toBe(10);
    expect(score('1')).toBe(1);
  });

  it('integer with recognised filler', () => {
    expect(score('about 4')).toBe(4);
    expect(score('about a 4')).toBe(4);
    expect(score('maybe a 7')).toBe(7);
    expect(score("i'd say 6")).toBe(6);
    expect(score('I think 5')).toBe(5);
  });

  it('out-of-ten forms', () => {
    expect(score('4/10')).toBe(4);
    expect(score('4 out of 10')).toBe(4);
    expect(score('4 out of ten')).toBe(4);
  });

  it('word numerals', () => {
    expect(score('four')).toBe(4);
    expect(score('seven')).toBe(7);
    expect(score('ten')).toBe(10);
  });

  it('trailing punctuation is irrelevant', () => {
    expect(score('4.')).toBe(4);
    expect(score('Four!')).toBe(4);
  });
});

describe('LENGTH IS NEVER A CRITERION', () => {
  it('accepts a long message that is entirely filler plus one score', () => {
    // 25 characters longer than the rejected fixture below — length plays no
    // part; only structure does.
    expect(score('i feel like a 4 right now')).toBe(4);
    expect(score('well ok i think about a 4 today')).toBe(4);
  });

  it('rejects a SHORT message containing unrecognised content', () => {
    expect(score('4 hours')).toBeNull();
    expect(reason('4 hours')).toBe('unrecognised_content');
  });
});

describe('rejections', () => {
  it('the real-world trap: a number attached to a unit', () => {
    // From the 2026-08-06 session: "4 часа сна", "через 15 минут",
    // "собеседование через 4 часа". A naive parser fabricates a score here.
    expect(score('4 hours of sleep and the interview is at 2')).toBeNull();
    expect(score('4 hours of sleep')).toBeNull();
    expect(score('in 15 minutes')).toBeNull();
  });

  it('non-Latin text is preserved as unrecognised, not stripped', () => {
    // If tokenisation stripped Cyrillic, "4 часа сна" would reduce to "4"
    // and be accepted. It must reject.
    expect(score('4 часа сна')).toBeNull();
    expect(reason('4 часа сна')).toBe('unrecognised_content');
    expect(score('четыре')).toBeNull();
  });

  it('multiple candidates are ambiguous, never guessed', () => {
    expect(reason('3-4')).toBe('multiple_score_tokens');
    expect(reason('between 4 and 5')).toBe('multiple_score_tokens');
    expect(reason('4 or 5')).toBe('multiple_score_tokens');
  });

  it('out of range is rejected, NEVER clamped', () => {
    expect(reason('0')).toBe('out_of_range');
    expect(reason('11')).toBe('out_of_range');
    expect(reason('100')).toBe('out_of_range');
    // Clamping would invent a clinical value the user did not give.
    expect(score('0')).toBeNull();
    expect(score('11')).toBeNull();
  });

  it('negation rejects automatically — "not" is not filler', () => {
    expect(score('not 4')).toBeNull();
    expect(reason('not 4')).toBe('unrecognised_content');
  });

  it('no number at all', () => {
    expect(reason('i don\'t know')).toBe('no_score_token');
    expect(reason('bad')).toBe('no_score_token');
    expect(reason('')).toBe('no_score_token');
    expect(captureStabilityScore(null as unknown as string).found).toBe(false);
  });

  it('a score buried in real conversation rejects', () => {
    expect(score('I slept 4 hours and I have an interview at 2 today')).toBeNull();
    expect(score('my son is 4 years old')).toBeNull();
  });
});

describe('what a captured score means', () => {
  it('every accepted value is on the 1-10 stability scale', () => {
    for (let n = 1; n <= 10; n++) {
      expect(score(String(n))).toBe(n);
    }
  });

  it('a stored value is always a number the user actually gave', () => {
    // No path produces a score the user did not type: out-of-range rejects,
    // ambiguity rejects, and unrecognised content rejects.
    const fabricationAttempts = ['0', '11', '3-4', '4 hours', 'about', ''];
    for (const m of fabricationAttempts) {
      expect(captureStabilityScore(m).found).toBe(false);
    }
  });
});
