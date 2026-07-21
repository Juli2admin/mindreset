// Replay engine. Two modes:
//   recorded — no API. Uses the fixture's own production replies + emitted
//              reports as the run result. This is the TRUE baseline of the
//              current runtime for a captured session (what actually happened).
//   live     — assembles the production prompt, calls the Anthropic Messages
//              API with streaming, and drives the SAME production streaming
//              processor + parser the route uses. Requires ANTHROPIC_API_KEY.
//
// Both modes emit identical TurnResult shape, so metrics run identically.
// The dynamic state block actually used is captured per turn (was-it-live guard).

import { createHash } from 'crypto';
import { assembleSystemPromptBlocks } from '../../../lib/journey/prompts/assemble';
import { appendEmissionReminder } from '../../../lib/journey/prompts/emission-reminder';
import { createProcessorState, ingestChunk, finaliseStream } from '../../../lib/journey/streaming/reply-processor';
import { splitReplyAndReport, parseStateReport } from '../../../lib/journey/stateReport/parse';
import type { Fixture, Variant, TurnResult } from './types';
import { toJourneyState } from './state';

const sha8 = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 8);

type Msg = { role: 'user' | 'assistant'; content: string };

function assemble(fixture: Fixture, turnIndex: number) {
  const ft = fixture.turns[turnIndex];
  const sessionStart = fixture.turns[0].ts ?? new Date().toISOString();
  const state = toJourneyState(ft.state, sessionStart);
  const blocks = assembleSystemPromptBlocks(state);
  const block3 = blocks[2]?.text ?? '';
  return {
    blocks,
    block3,
    blockSha: { b1: sha8(blocks[0].text), b2: sha8(blocks[1].text), b3: sha8(block3), b4: sha8(blocks[3]?.text ?? '') },
  };
}

// ---- recorded mode: score what production actually produced ----
export function runRecorded(fixture: Fixture): TurnResult[] {
  return fixture.turns.map((ft, i) => {
    const { block3, blockSha } = assemble(fixture, i);
    // The fixture stores the emitted report object; re-serialise then run it
    // through the production parser so parse/fallback behaviour is identical.
    const rawJson = JSON.stringify(ft.report);
    const parsed = parseStateReport(rawJson);
    return {
      n: ft.n,
      user: ft.user,
      visibleReply: ft.recordedReply,
      rawReportJson: rawJson,
      parsedReport: parsed,
      parseFellBackToDefault: '_raw' in parsed,
      stopReason: null,
      thinkingChars: 0,
      timings: null,
      usage: null,
      blockSha,
      block3Text: block3,
    };
  });
}

// ---- live mode ----
type StreamEvent = {
  type: string;
  delta?: { type: string; text?: string; thinking?: string };
  content_block?: { type: string };
};

export async function runLive(fixture: Fixture, variant: Variant): Promise<TurnResult[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!key && !authToken) {
    throw new Error('live mode requires ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN');
  }
  // Lazy import so recorded mode never needs the SDK present/keyed.
  const AnthropicMod = await import('@anthropic-ai/sdk');
  const Anthropic = AnthropicMod.default;
  // Two auth paths: a standard sk-ant-api key (x-api-key), or a Bearer token
  // (ANTHROPIC_AUTH_TOKEN) for environments that only expose an OAuth/session
  // token — e.g. a managed runner. Bearer uses the oauth beta header the CLI
  // uses. The token is read from the env; it is never written to disk or logs.
  const client = key
    ? new Anthropic({ apiKey: key })
    : new Anthropic({
        authToken: authToken as string,
        defaultHeaders: { 'anthropic-beta': 'oauth-2025-04-20' },
      });
  const model = variant.model ?? fixture.model;
  const maxTokens = variant.maxTokens ?? 2500; // production MAX_TOKENS

  const history: Msg[] = [];
  const results: TurnResult[] = [];

  for (let i = 0; i < fixture.turns.length; i++) {
    const ft = fixture.turns[i];
    const { blocks, block3, blockSha } = assemble(fixture, i);
    // History accumulates the model's OWN prior stripped replies (self-imitation
    // reproduced), exactly like production persistence. Fixed user turns.
    const outbound: Msg[] = appendEmissionReminder([...history, { role: 'user', content: ft.user }]);

    const params: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      system: blocks.map((b) => ({ type: 'text', text: b.text, ...(b.cache_control ? { cache_control: b.cache_control } : {}) })),
      messages: outbound,
    };
    if (variant.thinking) {
      params.thinking = variant.thinking;
      if (variant.effort) params.output_config = { effort: variant.effort };
    }

    const proc = createProcessorState();
    const t0 = Date.now();
    let firstThinking: number | null = null;
    let firstVisible: number | null = null;
    let thinkingChars = 0;
    let visible = '';

    const stream = client.messages.stream(params as never);
    for await (const ev of stream as AsyncIterable<StreamEvent>) {
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'thinking_delta') {
        if (firstThinking === null) firstThinking = Date.now() - t0;
        thinkingChars += (ev.delta.thinking ?? '').length;
        continue; // never enters the visible/report pipeline (V1 guard, mirrors prod loop shape)
      }
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
        const out = ingestChunk(proc, ev.delta.text ?? '');
        if (out.length > 0) {
          if (firstVisible === null) firstVisible = Date.now() - t0;
          visible += out;
        }
      }
    }
    const tail = finaliseStream(proc);
    if (tail.length > 0) visible += tail;
    const final = await stream.finalMessage();
    const totalMs = Date.now() - t0;

    const fullText = final.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
    const split = splitReplyAndReport(fullText);
    const parsed = parseStateReport(split.rawStateReport);
    const u = final.usage as unknown as Record<string, number | null> | undefined;

    results.push({
      n: ft.n,
      user: ft.user,
      visibleReply: visible,
      rawReportJson: split.rawStateReport,
      parsedReport: parsed,
      parseFellBackToDefault: '_raw' in parsed,
      stopReason: (final.stop_reason as string | null) ?? null,
      thinkingChars,
      timings: { requestStartMs: 0, firstThinkingMs: firstThinking, firstVisibleMs: firstVisible, totalMs },
      usage: {
        inputTokens: u?.input_tokens ?? null,
        cacheCreationTokens: u?.cache_creation_input_tokens ?? null,
        cacheReadTokens: u?.cache_read_input_tokens ?? null,
        outputTokens: u?.output_tokens ?? null,
      },
      blockSha,
      block3Text: block3,
    });

    // Persist the stripped visible reply into history (production semantics).
    history.push({ role: 'user', content: ft.user });
    history.push({ role: 'assistant', content: split.humanReply });
  }
  return results;
}
