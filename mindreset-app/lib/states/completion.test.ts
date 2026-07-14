// Tests for the State-module completion detector.

import { describe, it, expect } from 'vitest';
import { detectCompletion } from './completion';

describe('detectCompletion', () => {
  it('returns not-completed for a normal mid-session message', () => {
    const r = detectCompletion(
      "Let's try one cycle of the 4-7-8 breath. Notice how it lands.",
    );
    expect(r.completed).toBe(false);
    expect(r.visibleText).toBe(
      "Let's try one cycle of the 4-7-8 breath. Notice how it lands.",
    );
    expect(r.suggestedModuleId).toBe(null);
  });

  it('detects stabilised completion + strips the marker', () => {
    const raw =
      "You've done real work here. The practices are yours to come back to any time.\n\n[[SESSION_COMPLETE:stabilised]]";
    const r = detectCompletion(raw);
    expect(r.completed).toBe(true);
    if (r.completed) {
      expect(r.reason).toBe('stabilised');
      expect(r.visibleText).toBe(
        "You've done real work here. The practices are yours to come back to any time.",
      );
      expect(r.visibleText).not.toContain('SESSION_COMPLETE');
    }
  });

  it('detects red_flag completion after crisis response', () => {
    const raw =
      'In the UK you can call Samaritans on 116 123. Take care of yourself.\n\n[[SESSION_COMPLETE:red_flag]]';
    const r = detectCompletion(raw);
    expect(r.completed).toBe(true);
    if (r.completed) {
      expect(r.reason).toBe('red_flag');
      expect(r.visibleText).not.toContain('SESSION_COMPLETE');
    }
  });

  it('detects not_settled_close after ~3 practices without settling', () => {
    const raw =
      "This one hasn't fully softened today, and that's honest. Come back tomorrow.\n[[SESSION_COMPLETE:not_settled_close]]";
    const r = detectCompletion(raw);
    expect(r.completed).toBe(true);
    if (r.completed) {
      expect(r.reason).toBe('not_settled_close');
    }
  });

  it('is case-insensitive on the reason token (defensive)', () => {
    const r = detectCompletion('Warm close.\n[[SESSION_COMPLETE:Stabilised]]');
    expect(r.completed).toBe(true);
    if (r.completed) expect(r.reason).toBe('stabilised');
  });

  it('trims trailing whitespace left behind after the marker is stripped', () => {
    const raw = 'Close warmly.\n\n[[SESSION_COMPLETE:stabilised]]\n\n';
    const r = detectCompletion(raw);
    expect(r.completed).toBe(true);
    if (r.completed) {
      // No trailing newline — the reader shouldn't see a blank line at the end.
      expect(r.visibleText.endsWith('\n')).toBe(false);
      expect(r.visibleText).toBe('Close warmly.');
    }
  });

  it('ignores an unknown reason token (falls through as no marker)', () => {
    // The regex is anchored to the three known reasons — any other token
    // shouldn't match at all, so the message is treated as mid-session.
    const raw = 'Something.\n[[SESSION_COMPLETE:mystery]]';
    const r = detectCompletion(raw);
    expect(r.completed).toBe(false);
    expect(r.visibleText).toBe(raw);
  });
});

describe('detectCompletion — suggested next module (PR ψ4)', () => {
  it('extracts a valid State moduleId from the SUGGEST marker + strips it', () => {
    const raw =
      'You noticed the flat under the anxiety. When you have some room, our Apathy module holds space for that shape.\n[[SUGGEST:apathy]]\n[[SESSION_COMPLETE:stabilised]]';
    const r = detectCompletion(raw);
    expect(r.completed).toBe(true);
    if (r.completed) {
      expect(r.reason).toBe('stabilised');
      expect(r.suggestedModuleId).toBe('apathy');
      expect(r.visibleText).not.toContain('SUGGEST');
      expect(r.visibleText).not.toContain('SESSION_COMPLETE');
    }
  });

  it('accepts loss_of_self as a suggestion', () => {
    const raw =
      'The unreal feeling under the emptiness deserves its own care.\n[[SUGGEST:loss_of_self]]\n[[SESSION_COMPLETE:stabilised]]';
    const r = detectCompletion(raw);
    if (r.completed) expect(r.suggestedModuleId).toBe('loss_of_self');
  });

  it('rejects a Theme slug that does not correspond to a live module', () => {
    // Themes ship later — hallucinated theme_money slug must be ignored.
    const raw =
      'Money worries came up today.\n[[SUGGEST:theme_money]]\n[[SESSION_COMPLETE:stabilised]]';
    const r = detectCompletion(raw);
    expect(r.completed).toBe(true);
    if (r.completed) {
      expect(r.suggestedModuleId).toBe(null);
      // The marker is stripped even when rejected, so the reader never
      // sees stray suggestion markup.
      expect(r.visibleText).not.toContain('SUGGEST');
    }
  });

  it('rejects an unknown / malformed slug', () => {
    const raw = 'Close.\n[[SUGGEST:not_a_module]]\n[[SESSION_COMPLETE:stabilised]]';
    const r = detectCompletion(raw);
    if (r.completed) expect(r.suggestedModuleId).toBe(null);
  });

  it('returns null suggestion when the SUGGEST marker is absent', () => {
    const raw = 'Warm close.\n[[SESSION_COMPLETE:stabilised]]';
    const r = detectCompletion(raw);
    if (r.completed) expect(r.suggestedModuleId).toBe(null);
  });

  it('does not activate a suggestion mid-session even if AI appends the marker prematurely', () => {
    // Absence of SESSION_COMPLETE means the session is NOT ending —
    // whatever the AI did with the SUGGEST marker, the reader isn't
    // done yet. We still surface the suggestion (client may want to
    // preview) but completed is false.
    const raw = 'Just a thought.\n[[SUGGEST:apathy]]';
    const r = detectCompletion(raw);
    expect(r.completed).toBe(false);
    expect(r.suggestedModuleId).toBe('apathy');
    expect(r.visibleText).not.toContain('SUGGEST');
  });
});
