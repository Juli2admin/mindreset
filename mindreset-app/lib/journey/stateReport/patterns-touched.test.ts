// Tests for patternsTouched — the structural pattern-notes field added
// in PR 5 (2026-07-04). Category is free-string snake_case owner-approved;
// parser enforces shape and normalises.

import { describe, expect, it } from 'vitest';
import { parseStateReport, parsePatternsTouched } from './parse';

const BASE = {
  intensity: 4,
  safetyFlag: 'none' as const,
  recommendedAction: 'stay' as const,
};

describe('parsePatternsTouched — pure helper', () => {
  it('returns undefined when input is not an array', () => {
    expect(parsePatternsTouched(undefined)).toBeUndefined();
    expect(parsePatternsTouched(null)).toBeUndefined();
    expect(parsePatternsTouched('fear_of_visibility')).toBeUndefined();
    expect(parsePatternsTouched({ category: 'x' })).toBeUndefined();
    expect(parsePatternsTouched(42)).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(parsePatternsTouched([])).toBeUndefined();
  });

  it('accepts a single well-formed entry', () => {
    expect(
      parsePatternsTouched([
        { category: 'fear_of_visibility', description: 'I hide when people watch' },
      ]),
    ).toEqual([
      { category: 'fear_of_visibility', description: 'I hide when people watch' },
    ]);
  });

  it('preserves order for multiple valid entries', () => {
    expect(
      parsePatternsTouched([
        { category: 'mother_voice', description: 'you should have asked me first' },
        { category: 'money_shame', description: 'money is not for me' },
      ]),
    ).toEqual([
      { category: 'mother_voice', description: 'you should have asked me first' },
      { category: 'money_shame', description: 'money is not for me' },
    ]);
  });

  it('rejects categories that are not snake_case', () => {
    expect(
      parsePatternsTouched([
        { category: 'Mother Voice', description: 'nope' },
        { category: 'FearOfVisibility', description: 'nope' },
        { category: 'fear-of-visibility', description: 'nope' },
        { category: '9_year_old', description: 'nope' }, // starts with digit
        { category: '', description: 'nope' },
      ]),
    ).toBeUndefined();
  });

  it('accepts snake_case with digits (not-first) and underscores', () => {
    expect(
      parsePatternsTouched([
        { category: 'inner_child_wound_age_9', description: 'small girl' },
      ]),
    ).toEqual([
      { category: 'inner_child_wound_age_9', description: 'small girl' },
    ]);
  });

  it('rejects entries with empty or non-string description', () => {
    expect(
      parsePatternsTouched([
        { category: 'body_shame', description: '' },
        { category: 'body_shame', description: '   ' },
        { category: 'body_shame', description: null },
        { category: 'body_shame' }, // description missing
      ]),
    ).toBeUndefined();
  });

  it('truncates category to 60 chars via regex + description to 200', () => {
    const longCategory = 'a'.repeat(120);
    const longDescription = 'x'.repeat(500);
    const r = parsePatternsTouched([
      { category: longCategory, description: longDescription },
    ]);
    // 120 chars > 60 → rejected by regex.
    expect(r).toBeUndefined();

    const acceptable = 'a'.repeat(59);
    const r2 = parsePatternsTouched([
      { category: acceptable, description: longDescription },
    ]);
    expect(r2).toEqual([
      { category: acceptable, description: 'x'.repeat(200) },
    ]);
  });

  it('deduplicates by category — later entries win the description', () => {
    expect(
      parsePatternsTouched([
        { category: 'mother_voice', description: 'first mention' },
        { category: 'mother_voice', description: 'deeper mention this turn' },
      ]),
    ).toEqual([
      { category: 'mother_voice', description: 'deeper mention this turn' },
    ]);
  });

  it('caps output at 10 entries per turn', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      category: `pattern_${i}`,
      description: 'x',
    }));
    const r = parsePatternsTouched(many);
    expect(r).toHaveLength(10);
    expect(r?.[0].category).toBe('pattern_0');
    expect(r?.[9].category).toBe('pattern_9');
  });

  it('captures a valid context object when present', () => {
    expect(
      parsePatternsTouched([
        {
          category: 'inner_child_wound',
          description: 'the nine year old',
          context: { ageTag: 9 },
        },
      ]),
    ).toEqual([
      {
        category: 'inner_child_wound',
        description: 'the nine year old',
        context: { ageTag: 9 },
      },
    ]);
  });

  it('drops non-object context (array, string, number)', () => {
    expect(
      parsePatternsTouched([
        {
          category: 'inner_child_wound',
          description: 'the nine year old',
          context: [9],
        },
        {
          category: 'money_shame',
          description: 'not for me',
          context: 'ageTag=9',
        },
        {
          category: 'body_shame',
          description: 'not mine',
          context: 42,
        },
      ]),
    ).toEqual([
      {
        category: 'inner_child_wound',
        description: 'the nine year old',
      },
      { category: 'money_shame', description: 'not for me' },
      { category: 'body_shame', description: 'not mine' },
    ]);
  });

  it('filters malformed items while keeping valid ones', () => {
    expect(
      parsePatternsTouched([
        { category: 'mother_voice', description: 'valid' },
        null,
        { junk: true },
        { category: 'Not Snake Case', description: 'invalid' },
        { category: 'father_voice', description: 'also valid' },
      ]),
    ).toEqual([
      { category: 'mother_voice', description: 'valid' },
      { category: 'father_voice', description: 'also valid' },
    ]);
  });

  it('trims surrounding whitespace on category and description', () => {
    expect(
      parsePatternsTouched([
        {
          category: '   mother_voice   ',
          description: '  the sharp tone she used  ',
        },
      ]),
    ).toEqual([
      {
        category: 'mother_voice',
        description: 'the sharp tone she used',
      },
    ]);
  });
});

describe('parseStateReport — patternsTouched integration', () => {
  it('parses patternsTouched onto the returned StateReport', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        patternsTouched: [
          { category: 'fear_of_visibility', description: 'I hide' },
          { category: 'mother_voice', description: 'you should have asked' },
        ],
      }),
    );
    expect(r.patternsTouched).toHaveLength(2);
    expect(r.patternsTouched?.[0].category).toBe('fear_of_visibility');
    expect(r.patternsTouched?.[1].category).toBe('mother_voice');
  });

  it('omits patternsTouched when the field is absent', () => {
    const r = parseStateReport(JSON.stringify({ ...BASE }));
    expect(r.patternsTouched).toBeUndefined();
  });

  it('omits patternsTouched when all entries are malformed', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, patternsTouched: [{ junk: true }] }),
    );
    expect(r.patternsTouched).toBeUndefined();
  });
});
