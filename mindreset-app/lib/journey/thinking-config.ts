// Native pre-response deliberation for the Journey Clinician (2026-08-13).
//
// WHAT THIS RESTORES. The old `<assessment>` block gave the Clinician a place
// to reason BEFORE writing its visible reply. It was removed in PR β (see
// route.ts) because buffering it cost 20–30s to first byte. Nothing replaced
// the function: `clinicalRead` is emitted AFTER the reply (output order is
// reply-first), so it records reasoning rather than shaping it.
//
// `claude-sonnet-4-6` — the model the Clinician already runs on — supports
// native adaptive thinking. The model reasons before it writes, the thinking
// never enters the visible stream, and there is no buffering of visible text.
// This module decides, from one env flag, whether a turn requests it.
//
// FLAG OFF ⇒ PRODUCTION-IDENTICAL. With JOURNEY_THINKING unset (the default)
// this returns `{ maxTokens: baseMaxTokens }` and nothing else, so the route
// builds byte-identical request params to today's production. Pinned by test.
//
// SCOPE. Journey only. MiniMind, States, Themes and the safety verifier build
// their own request objects and are not touched.
//
// SDK NOTE. The installed @anthropic-ai/sdk (0.30.1) predates these request
// params, so the route casts them onto the request. This is safe rather than a
// type hack, and the reasons were verified against the installed code before
// shipping — see the SDK section of the PR body:
//   - the client serialises the request body and forwards unknown fields;
//   - `messages.stream()`'s accumulator pushes unknown content blocks verbatim
//     (`content_block_start` → `snapshot.content.push(...)`) and ignores
//     unknown deltas, so a `thinking` block cannot throw;
//   - nothing downstream indexes `finalMessage().content` — the route reads
//     only `usage`, `model` and `stop_reason`.

/** Adaptive thinking. `budget_tokens` is deprecated on 4.6 and deliberately unsupported here. */
export type ThinkingParam = {
  type: 'adaptive';
  /** Omitted when the caller asks for the model default. */
  display?: 'omitted' | 'summarized';
};

export type ThinkingEffort = 'low' | 'medium' | 'high' | 'max';

export type ThinkingConfig = {
  /** Present only when the flag is on. Cast onto the request by the route. */
  thinking?: ThinkingParam;
  /** Present only when an effort level is resolved. Cast onto the request. */
  output_config?: { effort: ThinkingEffort };
  /** max_tokens the route MUST use for this call. */
  maxTokens: number;
  /** For the telemetry line. */
  mode: 'off' | 'adaptive';
  detail: Record<string, unknown>;
};

/**
 * Headroom added to the reply/report ceiling when thinking is on.
 *
 * Thinking tokens count against `max_tokens`, so without this the reply or the
 * `<state-report>` JSON could be truncated mid-emission — which would break the
 * turn for the user, not just cost money. Raising the ceiling is FREE: max_tokens
 * bounds spend, it does not cause it. Sized well above what medium-effort
 * deliberation uses so truncation is not a live-test failure mode.
 */
const ADAPTIVE_HEADROOM = 8000;

/**
 * Effort when the flag is on and JOURNEY_THINKING_EFFORT is unset.
 *
 * Production today sends no `output_config`, so it already runs at the API
 * default of `high` — with thinking off, where effort has little to spend on.
 * `medium` is the deliberate starting point: it bounds what deliberation costs
 * while still engaging it. `low` was rejected because adaptive thinking may
 * barely engage there, and a null result that cannot distinguish "deliberation
 * does not help" from "there was not enough deliberation to test" would waste
 * the live test. See the PR body.
 */
const DEFAULT_EFFORT: ThinkingEffort = 'medium';

const EFFORTS: readonly ThinkingEffort[] = ['low', 'medium', 'high', 'max'];

function normEffort(raw: string | undefined): ThinkingEffort {
  const v = (raw ?? '').trim().toLowerCase();
  return (EFFORTS as readonly string[]).includes(v)
    ? (v as ThinkingEffort)
    : DEFAULT_EFFORT;
}

/**
 * Resolve the thinking display setting.
 *
 * Default `omitted`: on Sonnet 4.6 the API default is `summarized`, which would
 * generate readable thinking summaries and stream them as `thinking_delta`
 * events. The route's stream guard already drops those, but on a clinical
 * surface the stronger position is that the summaries are never produced at
 * all — two independent barriers rather than one. Billing is unaffected:
 * display controls visibility only, thinking is billed the same either way.
 *
 * `JOURNEY_THINKING_DISPLAY=unset` drops the field entirely, so a rollback path
 * exists if the parameter is ever rejected for this model without needing a
 * redeploy.
 */
function resolveDisplay(raw: string | undefined): 'omitted' | 'summarized' | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'unset') return null;
  if (v === 'summarized') return 'summarized';
  return 'omitted';
}

/**
 * @param baseMaxTokens the route's normal reply+report ceiling (MAX_TOKENS).
 */
export function resolveThinkingConfig(
  baseMaxTokens: number,
  env: Record<string, string | undefined> = process.env,
): ThinkingConfig {
  const flag = (env.JOURNEY_THINKING ?? '').trim().toLowerCase();
  const on = flag === 'on' || flag === 'adaptive' || flag === 'enabled' || flag === 'true';

  if (!on) {
    // Production default. No thinking, no output_config, unchanged ceiling.
    return { maxTokens: baseMaxTokens, mode: 'off', detail: {} };
  }

  const effort = normEffort(env.JOURNEY_THINKING_EFFORT);
  const display = resolveDisplay(env.JOURNEY_THINKING_DISPLAY);

  return {
    thinking: { type: 'adaptive', ...(display ? { display } : {}) },
    output_config: { effort },
    maxTokens: baseMaxTokens + ADAPTIVE_HEADROOM,
    mode: 'adaptive',
    detail: { effort, display: display ?? 'model-default', baseMaxTokens },
  };
}

/** Delta types that carry hidden reasoning and must never reach the user. */
const HIDDEN_DELTA_TYPES = new Set(['thinking_delta', 'signature_delta']);

/**
 * Is this a hidden-reasoning delta?
 *
 * Read loosely on purpose: SDK 0.30.1's delta union predates these variants, so
 * narrowing against it would not compile. Typed as a widening read of a string
 * field rather than an assertion about the value's shape.
 */
export function isHiddenReasoningDelta(delta: unknown): boolean {
  if (typeof delta !== 'object' || delta === null) return false;
  const type = (delta as { type?: unknown }).type;
  return typeof type === 'string' && HIDDEN_DELTA_TYPES.has(type);
}
