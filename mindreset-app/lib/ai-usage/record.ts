// Write one AiUsage row per Anthropic API call. Called fire-and-forget from
// every call site (Journey turn, MiniMind chat, both safety verifiers,
// MiniMind memory updater, support-ticket categorisation) so the user turn
// is never blocked by a telemetry write.
//
// The Anthropic SDK returns usage counts on both the non-streaming
// `messages.create` result AND the streaming `stream.finalMessage()`
// resolution. The shape is the same — see the `AnthropicUsageLike` type
// below. Callers pass the model they invoked plus the usage object plus
// their call-site label.

import prisma from '@/lib/prisma';
import { computeCostUsd } from './cost';

export type CallSite =
  | 'journey_turn'
  | 'minimind_chat'
  | 'verifier_journey'
  | 'verifier_minimind'
  | 'memory_updater'
  | 'support_categorise';

// The subset of Anthropic's Usage type we consume. Fields are camel_case
// exactly as the SDK returns them; we tolerate missing cache fields
// (older responses, non-cache-enabled calls) by defaulting to 0.
export type AnthropicUsageLike = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export type RecordArgs = {
  userId: string | null;
  callSite: CallSite;
  model: string;
  usage: AnthropicUsageLike;
  journeyTurnId?: string | null;
};

/**
 * Persist one AiUsage row. Silent on failure — the caller is a user-facing
 * hot path and must not be broken by a DB blip on telemetry.
 */
export async function recordAiUsage(args: RecordArgs): Promise<void> {
  const inputTokens = args.usage.input_tokens ?? 0;
  const outputTokens = args.usage.output_tokens ?? 0;
  const cacheReadTokens = args.usage.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = args.usage.cache_creation_input_tokens ?? 0;

  const costUsd = computeCostUsd(args.model, {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
  });

  try {
    await prisma.aiUsage.create({
      data: {
        userId: args.userId,
        callSite: args.callSite,
        model: args.model,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        costUsd,
        journeyTurnId: args.journeyTurnId ?? null,
      },
    });
  } catch (err) {
    console.error('[ai-usage] failed to record:', err);
  }
}
