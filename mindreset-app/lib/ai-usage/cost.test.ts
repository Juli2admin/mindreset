import { describe, expect, it } from 'vitest';
import { computeCostUsd, getPricingForModel, MODEL_PRICING } from './cost';

describe('getPricingForModel', () => {
  it('returns Sonnet 4-6 pricing for a known Sonnet model', () => {
    expect(getPricingForModel('claude-sonnet-4-6')).toEqual(
      MODEL_PRICING['claude-sonnet-4-6'],
    );
  });

  it('returns Haiku pricing for the versioned Haiku ID', () => {
    expect(getPricingForModel('claude-haiku-4-5-20251001')).toEqual({
      input: 0.8,
      cacheRead: 0.08,
      cacheWrite: 1.0,
      output: 4,
    });
  });

  it('falls back to Sonnet 4-6 pricing for an unknown model', () => {
    expect(getPricingForModel('claude-future-model-9-x')).toEqual(
      MODEL_PRICING['claude-sonnet-4-6'],
    );
  });
});

describe('computeCostUsd', () => {
  it('computes zero cost when all buckets are zero', () => {
    const cost = computeCostUsd('claude-sonnet-4-6', {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
    expect(cost).toBe(0);
  });

  it('prices Sonnet output correctly: 1M output tokens = $15', () => {
    const cost = computeCostUsd('claude-sonnet-4-6', {
      inputTokens: 0,
      outputTokens: 1_000_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
    expect(cost).toBe(15);
  });

  it('prices Sonnet uncached input correctly: 1M tokens = $3', () => {
    const cost = computeCostUsd('claude-sonnet-4-6', {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
    expect(cost).toBe(3);
  });

  it('prices Sonnet cache reads correctly: 1M tokens = $0.30', () => {
    const cost = computeCostUsd('claude-sonnet-4-6', {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1_000_000,
      cacheCreationTokens: 0,
    });
    expect(cost).toBeCloseTo(0.3, 6);
  });

  it('prices Sonnet cache writes correctly: 1M tokens = $3.75', () => {
    const cost = computeCostUsd('claude-sonnet-4-6', {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 1_000_000,
    });
    expect(cost).toBe(3.75);
  });

  it('computes a realistic Journey warm turn ~= $0.03', () => {
    // Sonnet 4-6, cache-warm turn: ~26K cache reads, ~14K uncached input,
    // ~1K output. Rough real-world shape from the live PR δ instrumentation.
    const cost = computeCostUsd('claude-sonnet-4-6', {
      inputTokens: 14_000,
      outputTokens: 1_000,
      cacheReadTokens: 26_000,
      cacheCreationTokens: 0,
    });
    // 14K × $3/M + 1K × $15/M + 26K × $0.30/M = 0.042 + 0.015 + 0.0078
    expect(cost).toBeCloseTo(0.0648, 4);
  });

  it('computes a realistic Journey cold turn (cache write) ~= $0.15', () => {
    // First turn of a session — cache is written, all input is uncached
    // relative to a prior warm state.
    const cost = computeCostUsd('claude-sonnet-4-6', {
      inputTokens: 14_000,
      outputTokens: 1_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 26_000,
    });
    // 14K × $3/M + 1K × $15/M + 26K × $3.75/M = 0.042 + 0.015 + 0.0975
    expect(cost).toBeCloseTo(0.1545, 4);
  });

  it('computes a Haiku safety verifier call ~= a fraction of a cent', () => {
    // ~2K in, ~100 out, no cache — the safety verifier is a small Haiku
    // call. Should be well under $0.01 per invocation.
    const cost = computeCostUsd('claude-haiku-4-5-20251001', {
      inputTokens: 2_000,
      outputTokens: 100,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
    // 2K × $0.80/M + 100 × $4/M = 0.0016 + 0.0004
    expect(cost).toBeCloseTo(0.002, 4);
    expect(cost).toBeLessThan(0.01);
  });

  it('falls back to Sonnet pricing on an unknown model instead of returning 0', () => {
    const cost = computeCostUsd('claude-mystery-model', {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
    // Would be 0 if fallback wasn't there — we deliberately over-report on
    // unknown models rather than under-report.
    expect(cost).toBe(3);
  });
});
