// Per-stage model selection for The Journey.
//
// Default for v1 is Sonnet 4.6 across all stages — proven, cost-effective, and
// the same model MiniMind uses. Stage-specific overrides live in
// `STAGE_MODEL_OVERRIDES`; per the engineering plan we may upgrade Stage 4
// (parts work) to Opus after prompt-fidelity testing shows where Sonnet
// falls short.
//
// The harness in `scripts/journey-smoke.mjs` can run the same fixtures
// through multiple models in parallel by passing `modelOverride` directly.

export const DEFAULT_JOURNEY_MODEL = 'claude-sonnet-4-6';

const STAGE_MODEL_OVERRIDES: Partial<Record<number, string>> = {
  // No overrides for v1. Add entries here after fidelity testing.
  // Example: 4: 'claude-opus-4-8',
};

export function getModelForStage(stage: number, override?: string): string {
  if (override) return override;
  return STAGE_MODEL_OVERRIDES[stage] ?? DEFAULT_JOURNEY_MODEL;
}
