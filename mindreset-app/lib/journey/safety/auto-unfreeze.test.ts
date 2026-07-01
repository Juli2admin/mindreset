// Unit tests for the pure auto-unfreeze decision function.
// The route (`/api/journey/request-review`) wires this together with fetch /
// decrypt / verifier / DB update / email — those aren't covered here, but the
// safety decisions are, so a future contributor can't silently permit an
// auto-unfreeze the design says shouldn't happen.

import { describe, it, expect } from 'vitest';
import { evaluateAutoUnfreeze, extractSource } from './auto-unfreeze';

describe('extractSource — parses freeze.ts:composeReason strings', () => {
  it('extracts the source from a normal reason string', () => {
    expect(extractSource('source:keyword_scan | type:suicidal')).toBe('keyword_scan');
    expect(
      extractSource('source:verifier | type:suicidal | r:direct plan'),
    ).toBe('verifier');
    expect(extractSource('source:state_report | type:panic_severe')).toBe('state_report');
    expect(extractSource('source:manual')).toBe('manual');
  });

  it('returns unknown for null / empty / mangled input', () => {
    expect(extractSource(null)).toBe('unknown');
    expect(extractSource(undefined)).toBe('unknown');
    expect(extractSource('')).toBe('unknown');
    expect(extractSource('freeze me now')).toBe('unknown');
    expect(extractSource('source:something_unexpected')).toBe('unknown');
  });
});

describe('evaluateAutoUnfreeze — safety-critical decisions', () => {
  // ELIGIBLE SOURCES + clear_safe → auto_unfreeze
  it('auto-unfreezes on keyword_scan + clear_safe', () => {
    const d = evaluateAutoUnfreeze('source:keyword_scan | type:suicidal', 'clear_safe');
    expect(d.action).toBe('auto_unfreeze');
    expect(d.reason).toContain('keyword_scan');
  });

  it('auto-unfreezes on state_report + clear_safe', () => {
    const d = evaluateAutoUnfreeze('source:state_report | type:suicidal', 'clear_safe');
    expect(d.action).toBe('auto_unfreeze');
    expect(d.reason).toContain('state_report');
  });

  // ELIGIBLE SOURCES + not-clear_safe → human_review (fail closed)
  it('does NOT auto-unfreeze on keyword_scan + ambiguous', () => {
    const d = evaluateAutoUnfreeze('source:keyword_scan | type:suicidal', 'ambiguous');
    expect(d.action).toBe('human_review');
    expect(d.reason).toContain('ambiguous');
  });

  it('does NOT auto-unfreeze on keyword_scan + clear_crisis', () => {
    const d = evaluateAutoUnfreeze('source:keyword_scan | type:suicidal', 'clear_crisis');
    expect(d.action).toBe('human_review');
    expect(d.reason).toContain('clear_crisis');
  });

  it('does NOT auto-unfreeze on state_report + ambiguous', () => {
    const d = evaluateAutoUnfreeze('source:state_report', 'ambiguous');
    expect(d.action).toBe('human_review');
  });

  it('does NOT auto-unfreeze on any source when verifier is unavailable (fail closed)', () => {
    expect(
      evaluateAutoUnfreeze('source:keyword_scan', 'unavailable').action,
    ).toBe('human_review');
    expect(
      evaluateAutoUnfreeze('source:state_report', 'unavailable').action,
    ).toBe('human_review');
  });

  // INELIGIBLE SOURCES — never auto-unfreeze regardless of verdict
  it('NEVER auto-unfreezes on verifier-source freeze (any verdict)', () => {
    // Even if verifier now says clear_safe, that's a "reroll" of its own past
    // decision. Not permitted.
    for (const outcome of ['clear_safe', 'ambiguous', 'clear_crisis', 'unavailable'] as const) {
      const d = evaluateAutoUnfreeze('source:verifier | type:suicidal', outcome);
      expect(d.action).toBe('human_review');
      expect(d.reason).toBe('freeze_source_verifier_not_auto_recoverable');
    }
  });

  it('NEVER auto-unfreezes on manual-source freeze (any verdict)', () => {
    for (const outcome of ['clear_safe', 'ambiguous', 'clear_crisis', 'unavailable'] as const) {
      const d = evaluateAutoUnfreeze('source:manual', outcome);
      expect(d.action).toBe('human_review');
      expect(d.reason).toBe('freeze_source_manual_not_auto_recoverable');
    }
  });

  it('NEVER auto-unfreezes when source is unknown / reason is missing', () => {
    for (const outcome of ['clear_safe', 'ambiguous', 'clear_crisis', 'unavailable'] as const) {
      expect(evaluateAutoUnfreeze(null, outcome).action).toBe('human_review');
      expect(evaluateAutoUnfreeze('mangled', outcome).action).toBe('human_review');
      expect(
        evaluateAutoUnfreeze('source:some_new_source', outcome).action,
      ).toBe('human_review');
    }
  });
});
