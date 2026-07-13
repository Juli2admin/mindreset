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
