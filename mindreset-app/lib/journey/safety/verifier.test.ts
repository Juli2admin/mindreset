// Verifier output-parsing guards.
//
// The two helpers under test are the boundary between the LLM's raw
// response and our pipeline's decision logic. If they ever stop
// fail-closing on malformed input, a real crisis could classify as
// clear_safe with no visible failure. These tests pin the contract.

import { describe, expect, it } from 'vitest';
import { parseResult, stripCodeFences } from './verifier';

describe('stripCodeFences', () => {
  it('passes plain JSON through unchanged', () => {
    expect(stripCodeFences('{"verdict":"clear_safe"}')).toBe('{"verdict":"clear_safe"}');
  });

  it('strips bare ``` fences', () => {
    expect(stripCodeFences('```\n{"verdict":"clear_safe"}\n```')).toBe(
      '{"verdict":"clear_safe"}',
    );
  });

  it('strips ```json fences', () => {
    expect(stripCodeFences('```json\n{"verdict":"clear_safe"}\n```')).toBe(
      '{"verdict":"clear_safe"}',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(stripCodeFences('   {"verdict":"clear_safe"}   ')).toBe(
      '{"verdict":"clear_safe"}',
    );
  });
});

describe('parseResult — happy path', () => {
  it('accepts a valid clear_crisis Sev 5 with redFlagType', () => {
    const r = parseResult({
      verdict: 'clear_crisis',
      severity: 5,
      redFlagType: 'suicidal',
      reasoning: 'Stated plan with method and tonight imminence.',
    });
    expect(r).toEqual({
      verdict: 'clear_crisis',
      severity: 5,
      redFlagType: 'suicidal',
      reasoning: 'Stated plan with method and tonight imminence.',
    });
  });

  it('accepts a valid clear_crisis Sev 4', () => {
    const r = parseResult({
      verdict: 'clear_crisis',
      severity: 4,
      redFlagType: 'self-harm',
      reasoning: 'Intent without imminence.',
    });
    expect(r?.verdict).toBe('clear_crisis');
    expect(r?.severity).toBe(4);
  });

  it('forces severity 3 on ambiguous regardless of input', () => {
    const r = parseResult({
      verdict: 'ambiguous',
      severity: 5, // model sent a wrong number; we override
      redFlagType: 'suicidal',
      reasoning: 'Concerning but not crisis-shaped.',
    });
    expect(r?.severity).toBe(3);
  });

  it('forces severity 2 on clear_safe regardless of input', () => {
    const r = parseResult({
      verdict: 'clear_safe',
      severity: 4,
      redFlagType: null,
      reasoning: 'Normal Journey work.',
    });
    expect(r?.severity).toBe(2);
    expect(r?.redFlagType).toBeNull();
  });

  it('truncates reasoning past the 200-char cap', () => {
    const long = 'x'.repeat(500);
    const r = parseResult({
      verdict: 'clear_safe',
      severity: 2,
      redFlagType: null,
      reasoning: long,
    });
    expect(r?.reasoning.length).toBe(200);
  });
});

describe('parseResult — fail-closed guards', () => {
  it('rejects non-object input', () => {
    expect(parseResult(null)).toBeNull();
    expect(parseResult(undefined)).toBeNull();
    expect(parseResult('clear_safe')).toBeNull();
    expect(parseResult(42)).toBeNull();
  });

  it('rejects unknown verdict strings', () => {
    expect(
      parseResult({
        verdict: 'mostly_safe',
        severity: 2,
        redFlagType: null,
        reasoning: '',
      }),
    ).toBeNull();
  });

  it('rejects missing verdict', () => {
    expect(
      parseResult({ severity: 2, redFlagType: null, reasoning: '' }),
    ).toBeNull();
  });

  it('rejects clear_crisis without a redFlagType', () => {
    expect(
      parseResult({
        verdict: 'clear_crisis',
        severity: 5,
        redFlagType: null,
        reasoning: 'Plan stated.',
      }),
    ).toBeNull();
  });

  it('rejects clear_crisis with an out-of-range severity', () => {
    expect(
      parseResult({
        verdict: 'clear_crisis',
        severity: 3, // crisis must be 4 or 5
        redFlagType: 'suicidal',
        reasoning: '',
      }),
    ).toBeNull();
    expect(
      parseResult({
        verdict: 'clear_crisis',
        severity: 2,
        redFlagType: 'suicidal',
        reasoning: '',
      }),
    ).toBeNull();
  });

  it('silently drops an unknown redFlagType to null on non-crisis', () => {
    const r = parseResult({
      verdict: 'ambiguous',
      severity: 3,
      redFlagType: 'malaise',
      reasoning: '',
    });
    expect(r?.redFlagType).toBeNull();
  });

  it('rejects clear_crisis with an unknown redFlagType', () => {
    // Unknown redFlagType falls through to null, then the crisis-needs-flag
    // guard rejects.
    expect(
      parseResult({
        verdict: 'clear_crisis',
        severity: 5,
        redFlagType: 'malaise',
        reasoning: '',
      }),
    ).toBeNull();
  });

  it('coerces missing reasoning to empty string', () => {
    const r = parseResult({
      verdict: 'clear_safe',
      severity: 2,
      redFlagType: null,
    });
    expect(r?.reasoning).toBe('');
  });
});
