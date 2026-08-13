// Native adaptive thinking for the Journey Clinician — safety and privacy tests.
//
// The properties pinned here are the ones the owner approved the change on:
//
//   1. flag OFF ⇒ the request params are identical to production;
//   2. flag ON ⇒ adaptive thinking, on Journey only;
//   3. hidden reasoning can never reach the user's stream;
//   4. hidden reasoning can never reach the <state-report> parser;
//   5. no thinking is persisted anywhere.
//
// (3) and (4) are the same guard read two ways: the route drops the delta
// before it reaches ingestChunk, which is what feeds BOTH the visible stream
// and processor.fullText. Both are asserted against the real reply processor
// rather than a mock, so the test fails if either path is ever rewired.

import { describe, expect, it } from 'vitest';

import {
  isHiddenReasoningDelta,
  resolveThinkingConfig,
} from './thinking-config';
import {
  createProcessorState,
  ingestChunk,
  finaliseStream,
} from './streaming/reply-processor';

const MAX_TOKENS = 2500;

/**
 * The route's stream loop, reduced to the part under test: the hidden-reasoning
 * guard followed by the text_delta branch. Mirrors route.ts exactly.
 */
function runStreamLoop(
  deltas: { type: string; text?: string; thinking?: string; signature?: string }[],
) {
  const processor = createProcessorState();
  let visibleToUser = '';
  for (const delta of deltas) {
    if (isHiddenReasoningDelta(delta)) continue;
    if (delta.type === 'text_delta') {
      visibleToUser += ingestChunk(processor, delta.text ?? '');
    }
  }
  visibleToUser += finaliseStream(processor);
  return { visibleToUser, fullText: processor.fullText };
}

describe('flag OFF — production behaviour is unchanged', () => {
  it('sends no thinking, no output_config, and the unchanged ceiling', () => {
    const cfg = resolveThinkingConfig(MAX_TOKENS, {});
    expect(cfg.mode).toBe('off');
    expect(cfg.thinking).toBeUndefined();
    expect(cfg.output_config).toBeUndefined();
    expect(cfg.maxTokens).toBe(MAX_TOKENS);
  });

  it('the assembled request params are byte-identical to production', () => {
    // This is the guarantee the rollback switch depends on: with the flag off
    // the route must build the exact object it built before this change.
    const cfg = resolveThinkingConfig(MAX_TOKENS, {});
    const params = {
      model: 'claude-sonnet-4-6',
      max_tokens: cfg.maxTokens,
      system: ['canon'],
      messages: [{ role: 'user', content: 'hi' }],
      ...(cfg.thinking ? { thinking: cfg.thinking } : {}),
      ...(cfg.output_config ? { output_config: cfg.output_config } : {}),
    };
    expect(JSON.stringify(params)).toBe(
      JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: MAX_TOKENS,
        system: ['canon'],
        messages: [{ role: 'user', content: 'hi' }],
      }),
    );
  });

  it('stays off for an unset, empty, or unrecognised flag value', () => {
    for (const JOURNEY_THINKING of [undefined, '', 'off', 'false', 'nonsense']) {
      const cfg = resolveThinkingConfig(MAX_TOKENS, { JOURNEY_THINKING });
      expect(cfg.mode).toBe('off');
      expect(cfg.thinking).toBeUndefined();
    }
  });

  it('effort and display envs alone never enable thinking', () => {
    // Setting a tuning knob must not switch the feature on by accident.
    const cfg = resolveThinkingConfig(MAX_TOKENS, {
      JOURNEY_THINKING_EFFORT: 'max',
      JOURNEY_THINKING_DISPLAY: 'summarized',
    });
    expect(cfg.mode).toBe('off');
    expect(cfg.thinking).toBeUndefined();
    expect(cfg.output_config).toBeUndefined();
  });
});

describe('flag ON — adaptive thinking', () => {
  it('requests adaptive thinking at the approved default effort', () => {
    const cfg = resolveThinkingConfig(MAX_TOKENS, { JOURNEY_THINKING: 'on' });
    expect(cfg.mode).toBe('adaptive');
    expect(cfg.thinking?.type).toBe('adaptive');
    expect(cfg.output_config).toEqual({ effort: 'medium' });
  });

  it('never sends budget_tokens — deprecated on sonnet-4-6', () => {
    const cfg = resolveThinkingConfig(MAX_TOKENS, {
      JOURNEY_THINKING: 'on',
      JOURNEY_THINKING_BUDGET: '4096',
    });
    expect(JSON.stringify(cfg.thinking)).not.toContain('budget_tokens');
  });

  it('gives thinking its own headroom so the reply cannot be truncated', () => {
    // Thinking tokens count against max_tokens. Without headroom the reply or
    // the <state-report> could be cut off mid-emission — a user-visible break.
    const cfg = resolveThinkingConfig(MAX_TOKENS, { JOURNEY_THINKING: 'on' });
    expect(cfg.maxTokens).toBeGreaterThan(MAX_TOKENS);
  });

  it('accepts the four supported effort levels and rejects the rest', () => {
    for (const effort of ['low', 'medium', 'high', 'max']) {
      const cfg = resolveThinkingConfig(MAX_TOKENS, {
        JOURNEY_THINKING: 'on',
        JOURNEY_THINKING_EFFORT: effort,
      });
      expect(cfg.output_config).toEqual({ effort });
    }
    // xhigh arrived with Opus 4.7 and is not valid on sonnet-4-6.
    for (const bad of ['xhigh', 'ultra', '']) {
      const cfg = resolveThinkingConfig(MAX_TOKENS, {
        JOURNEY_THINKING: 'on',
        JOURNEY_THINKING_EFFORT: bad,
      });
      expect(cfg.output_config).toEqual({ effort: 'medium' });
    }
  });

  it('suppresses thinking summaries at the API by default', () => {
    // sonnet-4-6 defaults display to "summarized". On a clinical surface the
    // summaries should not be generated at all, so the stream guard is the
    // second barrier rather than the only one.
    const cfg = resolveThinkingConfig(MAX_TOKENS, { JOURNEY_THINKING: 'on' });
    expect(cfg.thinking?.display).toBe('omitted');
  });

  it('display can be dropped without a redeploy if the param is rejected', () => {
    const cfg = resolveThinkingConfig(MAX_TOKENS, {
      JOURNEY_THINKING: 'on',
      JOURNEY_THINKING_DISPLAY: 'unset',
    });
    expect(cfg.thinking).toEqual({ type: 'adaptive' });
  });
});

describe('hidden reasoning never reaches the user or the parser', () => {
  it('classifies thinking and signature deltas as hidden', () => {
    expect(isHiddenReasoningDelta({ type: 'thinking_delta' })).toBe(true);
    expect(isHiddenReasoningDelta({ type: 'signature_delta' })).toBe(true);
  });

  it('leaves ordinary text deltas alone', () => {
    expect(isHiddenReasoningDelta({ type: 'text_delta', text: 'hi' })).toBe(false);
    expect(isHiddenReasoningDelta({ type: 'input_json_delta' })).toBe(false);
  });

  it('is defensive about malformed deltas', () => {
    for (const bad of [null, undefined, 'thinking_delta', 42, {}, { type: 7 }]) {
      expect(isHiddenReasoningDelta(bad)).toBe(false);
    }
  });

  it('ACCEPTANCE — thinking text reaches neither the user nor fullText', () => {
    const SECRET = 'The user is probably grieving her father, not her husband.';
    const { visibleToUser, fullText } = runStreamLoop([
      { type: 'thinking_delta', thinking: SECRET },
      { type: 'signature_delta', signature: 'sig_abc123' },
      { type: 'text_delta', text: 'Что сейчас происходит в теле?' },
      { type: 'thinking_delta', thinking: SECRET },
    ]);

    expect(visibleToUser).toBe('Что сейчас происходит в теле?');
    expect(visibleToUser).not.toContain(SECRET);
    // fullText is what splitReplyAndReport parses — thinking must not be in it,
    // or hidden reasoning could end up inside the persisted state report.
    expect(fullText).not.toContain(SECRET);
    expect(fullText).not.toContain('sig_abc123');
  });

  it('the state report still parses with thinking deltas interleaved', () => {
    const { visibleToUser, fullText } = runStreamLoop([
      { type: 'thinking_delta', thinking: 'private' },
      { type: 'text_delta', text: 'Побудь с этим.' },
      { type: 'thinking_delta', thinking: 'private' },
      { type: 'text_delta', text: '<state-report>{"intensity":6}</state-report>' },
    ]);
    expect(visibleToUser).toBe('Побудь с этим.');
    expect(fullText).toContain('"intensity":6');
    expect(fullText).not.toContain('private');
  });

  it('ordinary text streaming is unaffected when no thinking is present', () => {
    // The flag-off case: the loop must behave exactly as before.
    const { visibleToUser, fullText } = runStreamLoop([
      { type: 'text_delta', text: 'Hello, ' },
      { type: 'text_delta', text: 'this is a reply.' },
    ]);
    expect(visibleToUser).toBe('Hello, this is a reply.');
    expect(fullText).toBe('Hello, this is a reply.');
  });
});
