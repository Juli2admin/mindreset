// Tests for explicit exit-intent detection — Phase 2 (structural).
//
// The owner distinction under test: ending the SESSION is not the same as
// stopping the current ACTIVITY. Only session exit could ever enter closure;
// activity stop and ambiguity are recorded and never enter.
//
// Precision matters more than recall here — a false session_exit would
// interrupt a working session.

import { describe, expect, it } from 'vitest';
import { detectExitIntent } from './exit-intent';

const intentOf = (m: string) => detectExitIntent(m).intent;

describe('session_exit — the only class that could enter closure', () => {
  it.each([
    'I need to go',
    'I have to go',
    "I've got to go",
    'I should go now',
    "Let's stop here for today",
    "let's stop for today",
    'Can we stop here for today?',
    "That's enough for today",
    "I'm done for today",
    "I'm logging off",
    'Can we continue tomorrow?',
    'Can we pick this up later?',
    "Let's carry on another time",
    'Goodbye',
    'Bye for now',
    'See you tomorrow',
  ])('%s', (m) => expect(intentOf(m)).toBe('session_exit'));

  it('is case-insensitive and tolerates surrounding text', () => {
    expect(intentOf('Sorry, I NEED TO GO — my train is here')).toBe('session_exit');
  });
});

describe('activity_stop — stopping the work, not the session', () => {
  // Owner decision 2026-08-06: these are context-dependent and usually mean
  // the exercise, the topic or the emotional exploration.
  it.each([
    'I need to stop',
    'I want to stop',
    'Can we stop?',
    'can we stop',
    "Let's stop",
    'Can we talk about something else?',
    "I'd rather not go there",
  ])('%s', (m) => expect(intentOf(m)).toBe('activity_stop'));

  it('NONE of these enter closure', () => {
    for (const m of ['I need to stop', 'Can we stop?', "let's stop"]) {
      expect(intentOf(m)).not.toBe('session_exit');
    }
  });

  it('the same verb becomes a session exit only with a session-scope marker', () => {
    expect(intentOf("let's stop")).toBe('activity_stop');
    expect(intentOf("let's stop here for today")).toBe('session_exit');
  });
});

describe('ambiguous — recorded, never entering', () => {
  it.each([
    "I can't do this anymore",
    "I can't any more",
    "what's the point",
    "this isn't working",
    'I give up',
  ])('%s', (m) => expect(intentOf(m)).toBe('ambiguous'));

  it('bare "I\'m done" is ambiguous; "for today" makes it a session exit', () => {
    expect(intentOf("I'm done")).toBe('ambiguous');
    expect(intentOf("I'm done for today")).toBe('session_exit');
  });
});

describe('request vs deliberation — replaces the blanket "?" rule', () => {
  it('a request to end IS a session exit even as a question', () => {
    expect(intentOf('Can we stop here for today?')).toBe('session_exit');
    expect(intentOf('Could we stop here for today?')).toBe('session_exit');
  });

  it('deliberation about the self is NEVER a session exit', () => {
    expect(intentOf('Should I go?')).toBe('ambiguous');
    expect(intentOf('Do you think I should go now?')).toBe('ambiguous');
    expect(intentOf('Maybe I should go')).toBe('ambiguous');
  });

  it('deliberation outranks a session-exit phrase in the same message', () => {
    // "should i" is checked first precisely so this cannot read as a decision.
    expect(intentOf('Should I go now, or keep going?')).toBe('ambiguous');
  });
});

describe('negation guard', () => {
  it.each([
    "I don't want to stop",
    'I do not want to stop',
    "I don't need to go yet",
  ])('%s does not fire', (m) => expect(intentOf(m)).toBe('none'));
});

describe('deliberate exclusions', () => {
  it('future-contact statements are NOT exit intent', () => {
    // A user can say they will write later and keep talking. Including these
    // would import the AI-initiated case that is out of scope.
    expect(intentOf("I'll message you after the interview")).toBe('none');
    expect(intentOf('I will write to you later')).toBe('none');
  });

  it('ordinary conversation does not fire', () => {
    for (const m of [
      'I went to the garden today',
      'He is going to leave tomorrow',
      'That was a good session',
      'I feel lighter',
    ]) {
      expect(intentOf(m)).toBe('none');
    }
  });

  it('empty and non-string input is safe', () => {
    expect(intentOf('')).toBe('none');
    expect(intentOf('   ')).toBe('none');
    expect(detectExitIntent(null as unknown as string).intent).toBe('none');
  });
});

describe('audit trail', () => {
  it('returns the matched phrase for every non-none class', () => {
    for (const m of ['I need to go', 'I need to stop', 'I give up']) {
      const r = detectExitIntent(m);
      expect(r.matched).toBeTruthy();
    }
    expect(detectExitIntent('hello').matched).toBeNull();
  });
});
