// Tests for the state-report emission reminder (2026-07-19).
//
// Diagnosed failure: mid-session turns drop to reply-only output (42–160
// tokens vs 444–789 healthy) because the model's own report-stripped
// history out-teaches the cached system prompt. The reminder rides on the
// final user message of the outbound call — never persisted, never shown.
// These tests pin the helper's contract so a refactor can't silently
// stop the reminder reaching the model or start corrupting history.

import { describe, expect, it } from 'vitest';
import {
  appendEmissionReminder,
  STATE_REPORT_REMINDER,
  type SimpleMessage,
} from './emission-reminder';

function history(): SimpleMessage[] {
  return [
    { role: 'user', content: 'I keep choosing the same kind of relationship.' },
    { role: 'assistant', content: 'That takes honesty to say out loud.' },
    { role: 'user', content: 'The divorce process is the loudest part.' },
  ];
}

describe('appendEmissionReminder', () => {
  it('appends the reminder to the final user message, preserving its content', () => {
    const out = appendEmissionReminder(history());
    const last = out[out.length - 1];
    expect(last.role).toBe('user');
    expect(last.content.startsWith('The divorce process is the loudest part.')).toBe(true);
    expect(last.content.endsWith(STATE_REPORT_REMINDER)).toBe(true);
  });

  it('leaves every earlier message untouched', () => {
    const input = history();
    const out = appendEmissionReminder(input);
    expect(out.slice(0, -1)).toEqual(input.slice(0, -1));
  });

  it('does not mutate the input array or its messages', () => {
    const input = history();
    const snapshot = JSON.parse(JSON.stringify(input));
    appendEmissionReminder(input);
    expect(input).toEqual(snapshot);
  });

  it('returns the input unchanged when the last message is an assistant turn', () => {
    const input: SimpleMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    expect(appendEmissionReminder(input)).toEqual(input);
  });

  it('returns an empty array unchanged', () => {
    expect(appendEmissionReminder([])).toEqual([]);
  });

  it('reminder identifies itself as platform-origin, demands the report every turn, and stays hidden', () => {
    // The note must be unmistakably not-the-user's-words, name the
    // <state-report> block and the every-turn requirement, and instruct
    // the model not to surface it — the user must never feel a third
    // party in the room.
    expect(STATE_REPORT_REMINDER).toContain('from the platform, not the user');
    expect(STATE_REPORT_REMINDER).toContain('<state-report>');
    expect(STATE_REPORT_REMINDER).toContain('REQUIRED every turn');
    expect(STATE_REPORT_REMINDER).toContain('Do not reference this note in your reply');
  });

  it('reminder names the three every-turn fields the router depends on', () => {
    expect(STATE_REPORT_REMINDER).toContain('channel');
    expect(STATE_REPORT_REMINDER).toContain('clinicalRead');
    expect(STATE_REPORT_REMINDER).toContain('moveJustPerformed');
  });
});
