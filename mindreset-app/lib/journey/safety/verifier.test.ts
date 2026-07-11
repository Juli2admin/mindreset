// Verifier output-parsing guards.
//
// The two helpers under test are the boundary between the LLM's raw
// response and our pipeline's decision logic. If they ever stop
// fail-closing on malformed input, a real crisis could classify as
// clear_safe with no visible failure. These tests pin the contract.

import { describe, expect, it } from 'vitest';
import { parseResult, stripCodeFences, SYSTEM_PROMPT } from './verifier';

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

// PR ι (2026-07-11) — post-release phenomenology awareness.
//
// Julia's live session did beautiful foreign-material release work (dark
// gemstone / meteorite image, sealed with "don't touch me", released to a
// jewelry-maker's hands, integration with a residual hole). The AI then
// asked "what does the hole feel like now?" and the user answered with
// somatic residue: "chest gone down and squeezed my lungs. I can't
// breathe." The keyword scanner froze the Journey on "I can't breathe"
// (fixed separately in keywords.ts). The verifier's SYSTEM_PROMPT
// previously told it to ignore context; if the sync scan had not caught
// it, the verifier would have made the same false-positive classification.
//
// These tests lock in the new SYSTEM_PROMPT sections so a future edit
// can't silently regress them.

describe('verifier SYSTEM_PROMPT — post-release phenomenology awareness (PR ι)', () => {
  it('CONTEXT VS CLASSIFICATION section acknowledges context for disambiguation', () => {
    expect(SYSTEM_PROMPT).toContain('CONTEXT VS CLASSIFICATION');
    // The revised rule explicitly names the ambiguous phrase family.
    expect(SYSTEM_PROMPT).toContain('disambiguate somatic phenomenology from medical crisis');
    expect(SYSTEM_PROMPT).toContain('"I can\'t breathe"');
    expect(SYSTEM_PROMPT).toContain('"chest is heavy"');
  });

  it('has a POST-RELEASE PHENOMENOLOGY IS NOT PANIC section', () => {
    expect(SYSTEM_PROMPT).toContain('POST-RELEASE PHENOMENOLOGY IS NOT PANIC');
  });

  it("post-release section explicitly reclassifies 'I can't breathe' after guided somatic work as clear_safe", () => {
    // The exact rule that would have prevented the freeze.
    const idx = SYSTEM_PROMPT.indexOf('POST-RELEASE PHENOMENOLOGY IS NOT PANIC');
    expect(idx).toBeGreaterThan(-1);
    const section = SYSTEM_PROMPT.slice(idx, idx + 2000);
    expect(section).toContain("I can't breathe");
    expect(section).toContain('clear_safe');
    expect(section).toContain('NOT panic_severe');
  });

  it('post-release section names other body-report phrases (chest heavy, hole, empty)', () => {
    const idx = SYSTEM_PROMPT.indexOf('POST-RELEASE PHENOMENOLOGY IS NOT PANIC');
    const section = SYSTEM_PROMPT.slice(idx, idx + 2000);
    expect(section).toContain('My chest is heavy');
    expect(section).toContain('hole in my chest');
    expect(section).toContain('I feel empty');
  });

  it('post-release section names the emergency-signalling criteria that WOULD still fire panic_severe', () => {
    // The safety net stays — real emergencies still classify correctly.
    const idx = SYSTEM_PROMPT.indexOf('POST-RELEASE PHENOMENOLOGY IS NOT PANIC');
    const section = SYSTEM_PROMPT.slice(idx, idx + 2000);
    expect(section).toContain('help-seeking');
    expect(section).toContain('pass out');
    expect(section).toContain('emergency');
  });

  it("acknowledges 'no, I'm fine, I'm just describing' should be believed", () => {
    // The exact wall Julia hit — she said "No, I'm okay, I'm just
    // describing you the picture" three times and got canned responses
    // each time (because the freeze had already fired). The verifier
    // guidance now says to believe the user on a safety-check response.
    expect(SYSTEM_PROMPT).toContain("no, I'm fine");
    expect(SYSTEM_PROMPT).toContain("just describing");
    expect(SYSTEM_PROMPT).toContain('believe them');
  });

  it('panic_severe definition updated to require emergency-signalling in Journey sessions', () => {
    // Old definition matched the bare phrase. New definition requires
    // co-occurring emergency markers alongside the symptom language.
    expect(SYSTEM_PROMPT).toContain('ACTIVE panic attack');
    expect(SYSTEM_PROMPT).toContain('emergency signalling');
  });
});
