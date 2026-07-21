// Unit tests for the extended-thinking experiment flag resolver.
//
// The load-bearing guarantee under test: with the flag unset (production
// default) the resolver returns NO thinking / output_config and leaves
// max_tokens exactly at the base ceiling — so the route request is
// byte-identical to today's production. Everything else is opt-in.

import { describe, it, expect } from 'vitest';
import { resolveThinkingConfig } from './thinking-config';

const BASE = 2500; // production MAX_TOKENS

describe('resolveThinkingConfig', () => {
  it('defaults to OFF when the flag is unset (production-identical request)', () => {
    const cfg = resolveThinkingConfig(BASE, {});
    expect(cfg.mode).toBe('off');
    expect(cfg.thinking).toBeUndefined();
    expect(cfg.output_config).toBeUndefined();
    expect(cfg.maxTokens).toBe(BASE);
  });

  it('treats an unknown flag value as OFF (fail-safe)', () => {
    const cfg = resolveThinkingConfig(BASE, { JOURNEY_THINKING: 'yes-please' });
    expect(cfg.mode).toBe('off');
    expect(cfg.thinking).toBeUndefined();
    expect(cfg.maxTokens).toBe(BASE);
  });

  it('enabled mode uses the requested budget and adds it on top of the ceiling', () => {
    const cfg = resolveThinkingConfig(BASE, {
      JOURNEY_THINKING: 'enabled',
      JOURNEY_THINKING_BUDGET: '2048',
    });
    expect(cfg.mode).toBe('enabled');
    expect(cfg.thinking).toEqual({ type: 'enabled', budget_tokens: 2048 });
    expect(cfg.output_config).toBeUndefined();
    // visible reply/report keep the full base ceiling; thinking is additive.
    expect(cfg.maxTokens).toBe(BASE + 2048);
  });

  it('enabled mode clamps a below-minimum budget UP to 1024 (never sends an invalid request)', () => {
    const cfg = resolveThinkingConfig(BASE, {
      JOURNEY_THINKING: 'enabled',
      JOURNEY_THINKING_BUDGET: '500',
    });
    expect(cfg.thinking).toEqual({ type: 'enabled', budget_tokens: 1024 });
    expect(cfg.maxTokens).toBe(BASE + 1024);
    expect(cfg.detail.requested).toBe(500);
  });

  it('enabled mode falls back to the 1024 minimum when no budget is provided', () => {
    const cfg = resolveThinkingConfig(BASE, { JOURNEY_THINKING: 'enabled' });
    expect(cfg.thinking).toEqual({ type: 'enabled', budget_tokens: 1024 });
    expect(cfg.maxTokens).toBe(BASE + 1024);
  });

  it('enabled mode ignores a non-numeric budget and uses the minimum', () => {
    const cfg = resolveThinkingConfig(BASE, {
      JOURNEY_THINKING: 'enabled',
      JOURNEY_THINKING_BUDGET: 'abc',
    });
    expect(cfg.thinking).toEqual({ type: 'enabled', budget_tokens: 1024 });
  });

  it('adaptive mode sets thinking + output_config effort and pads the ceiling', () => {
    const cfg = resolveThinkingConfig(BASE, {
      JOURNEY_THINKING: 'adaptive',
      JOURNEY_THINKING_EFFORT: 'high',
    });
    expect(cfg.mode).toBe('adaptive');
    expect(cfg.thinking).toEqual({ type: 'adaptive' });
    expect(cfg.output_config).toEqual({ effort: 'high' });
    expect(cfg.maxTokens).toBe(BASE + 2048);
  });

  it('adaptive mode defaults effort to low and normalises unknown effort to low', () => {
    expect(resolveThinkingConfig(BASE, { JOURNEY_THINKING: 'adaptive' }).output_config).toEqual({
      effort: 'low',
    });
    expect(
      resolveThinkingConfig(BASE, { JOURNEY_THINKING: 'adaptive', JOURNEY_THINKING_EFFORT: 'ultra' })
        .output_config,
    ).toEqual({ effort: 'low' });
  });

  it('is case-insensitive on the flag value', () => {
    expect(resolveThinkingConfig(BASE, { JOURNEY_THINKING: 'ENABLED' }).mode).toBe('enabled');
    expect(resolveThinkingConfig(BASE, { JOURNEY_THINKING: 'Adaptive' }).mode).toBe('adaptive');
  });
});
