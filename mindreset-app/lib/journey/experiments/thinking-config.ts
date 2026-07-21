// EXPERIMENT ONLY — feature-flagged, NEVER merged to main by default.
//
// Resolves whether a Journey turn should request Anthropic extended thinking,
// entirely from environment variables. When the flag is unset (production
// default) this returns `{ maxTokens: baseMaxTokens }` and NOTHING else, so
// the route builds a byte-identical Messages request to today's production.
//
// Owner constraint (2026-07-21): "Do not assume that budget_tokens: 1500 is
// the correct setting." Budget and effort are therefore env-driven, not
// hardcoded — the A/B can sweep them without a code change or redeploy of the
// route logic itself.
//
// The installed SDK (@anthropic-ai/sdk 0.30.1) predates the thinking / adaptive
// / output_config params, so the route casts these fields onto the request.
// The shapes here match the current Messages API:
//   enabled:  thinking: { type: 'enabled', budget_tokens: N }   (N >= 1024)
//   adaptive: thinking: { type: 'adaptive' } + output_config: { effort }

export type ThinkingParam =
  | { type: 'enabled'; budget_tokens: number }
  | { type: 'adaptive' };

export type ThinkingConfig = {
  /** Present only when thinking is enabled. Cast onto the request by the route. */
  thinking?: ThinkingParam;
  /** Present only in adaptive mode. Cast onto the request by the route. */
  output_config?: { effort: 'low' | 'medium' | 'high' };
  /** max_tokens the route MUST use for this call. */
  maxTokens: number;
  /** Human-readable mode for logging: 'off' | 'enabled' | 'adaptive'. */
  mode: 'off' | 'enabled' | 'adaptive';
  /** Echoed for the telemetry line. */
  detail: Record<string, unknown>;
};

// Anthropic minimum for `type: 'enabled'` thinking on sonnet-4-6. A budget
// below this is rejected by the API. We clamp UP to it rather than silently
// disabling, so a mis-set env still runs a valid (if minimal) thinking arm.
const MIN_ENABLED_BUDGET = 1024;

// Extra headroom given to adaptive mode on top of the reply/report ceiling.
// Adaptive manages its own thinking allocation; this is only the visible-output
// ceiling padding. Kept modest and separate from the enabled path.
const ADAPTIVE_HEADROOM = 2048;

function normEffort(v: string | undefined): 'low' | 'medium' | 'high' {
  const e = (v ?? 'low').trim().toLowerCase();
  return e === 'medium' || e === 'high' ? e : 'low';
}

/**
 * @param baseMaxTokens the route's normal reply+report ceiling (production
 *   MAX_TOKENS). When thinking is on, the thinking budget is added ON TOP of
 *   this so the visible reply + state report never lose room to thinking
 *   tokens (thinking tokens count against max_tokens).
 */
export function resolveThinkingConfig(
  baseMaxTokens: number,
  env: Record<string, string | undefined> = process.env,
): ThinkingConfig {
  const mode = (env.JOURNEY_THINKING ?? 'off').trim().toLowerCase();

  if (mode === 'enabled') {
    const raw = Number.parseInt(env.JOURNEY_THINKING_BUDGET ?? '', 10);
    const requested = Number.isFinite(raw) ? raw : MIN_ENABLED_BUDGET;
    const budget = Math.max(MIN_ENABLED_BUDGET, requested);
    return {
      thinking: { type: 'enabled', budget_tokens: budget },
      maxTokens: baseMaxTokens + budget,
      mode: 'enabled',
      detail: { budget_tokens: budget, requested, baseMaxTokens },
    };
  }

  if (mode === 'adaptive') {
    const effort = normEffort(env.JOURNEY_THINKING_EFFORT);
    return {
      thinking: { type: 'adaptive' },
      output_config: { effort },
      maxTokens: baseMaxTokens + ADAPTIVE_HEADROOM,
      mode: 'adaptive',
      detail: { effort, baseMaxTokens },
    };
  }

  // off / unknown → no thinking, production ceiling unchanged.
  return { maxTokens: baseMaxTokens, mode: 'off', detail: {} };
}
