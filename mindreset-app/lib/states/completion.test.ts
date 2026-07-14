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
    expect(r.suggestedModule).toBe(null);
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

describe('detectCompletion — suggested next module (PR ψ4 / χ3)', () => {
  it('extracts a valid State moduleId + returns kind=state', () => {
    const raw =
      'You noticed the flat under the anxiety. When you have some room, our Apathy module holds space for that shape.\n[[SUGGEST:apathy]]\n[[SESSION_COMPLETE:stabilised]]';
    const r = detectCompletion(raw);
    expect(r.completed).toBe(true);
    if (r.completed) {
      expect(r.reason).toBe('stabilised');
      expect(r.suggestedModule).toEqual({ kind: 'state', moduleId: 'apathy' });
      expect(r.visibleText).not.toContain('SUGGEST');
      expect(r.visibleText).not.toContain('SESSION_COMPLETE');
    }
  });

  it('extracts a valid Theme moduleId + returns kind=theme (PR χ3)', () => {
    const raw =
      'The shame under your anxiety deserves its own arc.\n[[SUGGEST:shame]]\n[[SESSION_COMPLETE:stabilised]]';
    const r = detectCompletion(raw);
    expect(r.completed).toBe(true);
    if (r.completed) {
      expect(r.suggestedModule).toEqual({ kind: 'theme', moduleId: 'shame' });
    }
  });

  it('recognises all 4 State slugs', () => {
    for (const slug of ['anxiety', 'apathy', 'loss_of_self', 'inner_emptiness']) {
      const r = detectCompletion(
        `Close.\n[[SUGGEST:${slug}]]\n[[SESSION_COMPLETE:stabilised]]`,
      );
      expect(r.completed).toBe(true);
      if (r.completed) {
        expect(r.suggestedModule).toEqual({ kind: 'state', moduleId: slug });
      }
    }
  });

  it('recognises all 5 Theme slugs (PR χ3)', () => {
    for (const slug of ['shame', 'money', 'body', 'family', 'self_realisation']) {
      const r = detectCompletion(
        `Close.\n[[SUGGEST:${slug}]]\n[[SESSION_COMPLETE:stabilised]]`,
      );
      expect(r.completed).toBe(true);
      if (r.completed) {
        expect(r.suggestedModule).toEqual({ kind: 'theme', moduleId: slug });
      }
    }
  });

  it('rejects an unknown / malformed slug', () => {
    const r = detectCompletion(
      'Close.\n[[SUGGEST:not_a_module]]\n[[SESSION_COMPLETE:stabilised]]',
    );
    if (r.completed) expect(r.suggestedModule).toBe(null);
  });

  it('returns null suggestion when the SUGGEST marker is absent', () => {
    const raw = 'Warm close.\n[[SESSION_COMPLETE:stabilised]]';
    const r = detectCompletion(raw);
    if (r.completed) expect(r.suggestedModule).toBe(null);
  });

  it('does not activate a suggestion mid-session even if AI appends the marker prematurely', () => {
    const raw = 'Just a thought.\n[[SUGGEST:apathy]]';
    const r = detectCompletion(raw);
    expect(r.completed).toBe(false);
    expect(r.suggestedModule).toEqual({ kind: 'state', moduleId: 'apathy' });
    expect(r.visibleText).not.toContain('SUGGEST');
  });

  it('strips the SUGGEST marker even when the slug is invalid', () => {
    const r = detectCompletion(
      'Close.\n[[SUGGEST:bogus]]\n[[SESSION_COMPLETE:stabilised]]',
    );
    expect(r.visibleText).not.toContain('SUGGEST');
  });
});
