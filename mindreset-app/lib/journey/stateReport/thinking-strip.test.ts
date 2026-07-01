// The model sometimes externalises reasoning in a <thinking> block. It must
// NEVER reach the user (it exposes stage numbers, advance decisions, the whole
// method) and, unbounded, it eats the token budget so no reply is left. These
// tests pin that <thinking> is stripped from the displayed + persisted reply,
// and held back (never streamed) while it is still forming.

import { describe, it, expect } from 'vitest';
import { splitReplyAndReport, displayableReply } from './parse';

const R = '<state-report>{"intensity":4,"safetyFlag":"none","recommendedAction":"advance"}</state-report>';

describe('splitReplyAndReport — strips <thinking>', () => {
  it('drops a leading closed thinking block before report + reply', () => {
    const s = splitReplyAndReport(`<thinking>lots of reasoning</thinking>${R}\nHello there.`);
    expect(s.humanReply).toBe('Hello there.');
    expect(s.rawStateReport).toContain('"recommendedAction":"advance"');
    expect(s.humanReply).not.toContain('reasoning');
  });

  it('drops thinking when there is no report at all', () => {
    const s = splitReplyAndReport('<thinking>internal</thinking>Just the warm reply.');
    expect(s.humanReply).toBe('Just the warm reply.');
    expect(s.rawStateReport).toBeNull();
  });

  it('drops a trailing UNCLOSED thinking block (truncated mid-thought)', () => {
    // This is the leak we saw: the model dumped reasoning and ran out of tokens.
    const s = splitReplyAndReport('Here is your reply.<thinking>and then it kept going and never closed');
    expect(s.humanReply).toBe('Here is your reply.');
    expect(s.humanReply).not.toContain('kept going');
  });

  it('a turn that is ONLY unclosed thinking yields no reply (no leak)', () => {
    const s = splitReplyAndReport('<thinking>The user is asking what next. Active internal stage: 2/8...');
    expect(s.humanReply).toBe('');
  });
});

describe('displayableReply — never streams <thinking>', () => {
  it('returns null while inside an unclosed leading thinking block', () => {
    expect(displayableReply('<thinking>The user is', false)).toBeNull();
    expect(displayableReply('<thinking>', false)).toBeNull();
  });

  it('returns null for a forming <thinking> open tag', () => {
    expect(displayableReply('<thi', false)).toBeNull();
    expect(displayableReply('<thinkin', false)).toBeNull();
  });

  it('shows the reply after a closed thinking block', () => {
    expect(displayableReply('<thinking>x</thinking>Hello there, friend.', true)).toBe(
      'Hello there, friend.',
    );
  });

  it('shows the reply after thinking + report (report-first, final)', () => {
    expect(displayableReply(`<thinking>x</thinking>${R}\nHello there, friend.`, true)).toBe(
      'Hello there, friend.',
    );
  });

  it('a whole-turn unclosed thinking block shows nothing (→ route re-ask)', () => {
    const d = displayableReply('<thinking>huge reasoning that never closes this turn', true);
    // null or empty — either way route.ts emits the soft re-ask, not the leak.
    expect(d === null || d.trim() === '').toBe(true);
  });

  it('does not strip an innocent reply that merely mentions the word thinking', () => {
    expect(displayableReply('I was thinking about the garden today.', true)).toBe(
      'I was thinking about the garden today.',
    );
  });
});
