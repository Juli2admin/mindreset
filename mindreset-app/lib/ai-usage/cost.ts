// Per-model Anthropic pricing and cost derivation.
// Prices are in USD per 1,000,000 tokens, per the public pricing page. Kept
// as a small hard-coded map here so the app doesn't need a runtime pricing
// fetch; when Anthropic raises prices we update this table and every
// AiUsage row written after that point picks up the new number.
//
// The four token types Anthropic reports per response:
//   input           — regular uncached input tokens
//   cacheRead       — cached input tokens read from cache ($0.30/M for Sonnet)
//   cacheCreation   — tokens written to the cache on this call ($3.75/M)
//   output          — model output tokens
//
// Fallback: unknown model IDs are priced at Sonnet 4-6 rates. This is
// deliberately conservative — costs won't be under-reported for a new
// Anthropic model that ships before we update the table.

export type ModelPricingUsdPerMillion = {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
};

// Public pricing snapshot (2026-07-10). Verify with
// https://www.anthropic.com/pricing before any large business decision.
export const MODEL_PRICING: Record<string, ModelPricingUsdPerMillion> = {
  // Sonnet family — Journey main + MiniMind main.
  'claude-sonnet-4-6': { input: 3, cacheRead: 0.3, cacheWrite: 3.75, output: 15 },
  'claude-sonnet-4-5': { input: 3, cacheRead: 0.3, cacheWrite: 3.75, output: 15 },
  'claude-sonnet-5': { input: 3, cacheRead: 0.3, cacheWrite: 3.75, output: 15 },
  // Opus family — reserved but not currently wired into Journey.
  'claude-opus-4-7': { input: 15, cacheRead: 1.5, cacheWrite: 18.75, output: 75 },
  'claude-opus-4-8': { input: 15, cacheRead: 1.5, cacheWrite: 18.75, output: 75 },
  // Haiku family — safety verifier, memory updater, support categorise.
  'claude-haiku-4-5-20251001': {
    input: 0.8,
    cacheRead: 0.08,
    cacheWrite: 1.0,
    output: 4,
  },
  'claude-haiku-4-5': { input: 0.8, cacheRead: 0.08, cacheWrite: 1.0, output: 4 },
};

const FALLBACK_PRICING = MODEL_PRICING['claude-sonnet-4-6'];

export function getPricingForModel(model: string): ModelPricingUsdPerMillion {
  return MODEL_PRICING[model] ?? FALLBACK_PRICING;
}

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

/**
 * Compute the USD cost of one Anthropic call given its token usage. Returns
 * a plain number in dollars — sums the four token buckets against the
 * per-model pricing.
 */
export function computeCostUsd(model: string, usage: TokenUsage): number {
  const p = getPricingForModel(model);
  return (
    (usage.inputTokens * p.input +
      usage.cacheReadTokens * p.cacheRead +
      usage.cacheCreationTokens * p.cacheWrite +
      usage.outputTokens * p.output) /
    1_000_000
  );
}
