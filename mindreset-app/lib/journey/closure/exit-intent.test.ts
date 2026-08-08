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

// ---------------------------------------------------------------------------
// Russian (owner decision 2026-08-06). Note JavaScript's \b is ASCII-only —
// /\bмне\b/ does not match "мне пора" at all — so the matcher is space-padded.
// These tests exist to prove the Russian list actually fires.
// ---------------------------------------------------------------------------
describe('Russian — session_exit', () => {
  it.each([
    'мне пора',
    'мне нужно идти',
    'мне надо идти',
    'я пойду',
    'давай закончим на сегодня',
    'на сегодня хватит',
    'продолжим завтра',
    'давай в следующий раз',
    'до свидания',
    'до завтра',
  ])('%s', (m) => expect(intentOf(m)).toBe('session_exit'));
});

describe('Russian — activity_stop never enters closure', () => {
  it.each([
    'мне нужно остановиться',
    'я хочу остановиться',
    'давай остановимся',
    'я хочу закончить',
    'хватит',
    'стоп',
    'давай о другом',
  ])('%s', (m) => {
    expect(intentOf(m)).toBe('activity_stop');
    expect(intentOf(m)).not.toBe('session_exit');
  });
});

describe('Russian — ambiguous and deliberation', () => {
  it.each(['я больше не могу', 'какой смысл', 'я сдаюсь', 'это не работает'])(
    '%s is ambiguous',
    (m) => expect(intentOf(m)).toBe('ambiguous'),
  );

  it('deliberation about the self never enters', () => {
    expect(intentOf('мне стоит пойти?')).toBe('ambiguous');
    expect(intentOf('может мне уже закончить?')).toBe('ambiguous');
  });
});

describe('Russian — precision', () => {
  it('ordinary conversation does not fire', () => {
    for (const m of [
      'я пошла в сад',
      'он уехал вчера',
      'мне было хорошо сегодня',
      'я хочу разобраться в этом',
    ]) {
      expect(intentOf(m)).toBe('none');
    }
  });

  it('negation guard works in Russian', () => {
    expect(intentOf('не хватит')).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Compositional detection (rebuilt 2026-08-08).
//
// The four cases below are the owner-pinned acceptance set. The first is the
// verified live failure: on 2026-08-08 at 08:49 the user wrote «Я, наверное,
// больше не хочу разговаривать», the flat-list implementation returned `none`,
// and the session closed with no stability measurement.
// ---------------------------------------------------------------------------

describe('acceptance — the verified live failure and its neighbours', () => {
  it('«Я, наверное, больше не хочу разговаривать» is a session exit', () => {
    expect(intentOf('Я, наверное, больше не хочу разговаривать')).toBe('session_exit');
  });

  it('«не хочу об этом разговаривать» stays an activity stop', () => {
    expect(intentOf('не хочу об этом разговаривать')).toBe('activity_stop');
  });

  it('«я больше не могу» stays ambiguous — capability, not volition', () => {
    expect(intentOf('я больше не могу')).toBe('ambiguous');
  });

  it('«я не хочу останавливаться» does not fire — negation suppresses', () => {
    expect(intentOf('я не хочу останавливаться')).toBe('none');
  });
});

describe('compositional — negation role', () => {
  it('negating a CONTINUATION predicate forms the intent', () => {
    expect(intentOf('больше не хочу говорить')).toBe('session_exit');
    expect(intentOf("i don't want to talk any more for today")).toBe('session_exit');
  });

  it('negating a STOP or DEPART predicate suppresses', () => {
    for (const m of [
      'я не хочу останавливаться',
      'я не хочу заканчивать',
      "i don't want to stop",
      "i don't need to go yet",
    ]) {
      expect(intentOf(m)).toBe('none');
    }
  });
});

describe('compositional — volition vs capability', () => {
  it('volition negation can exit; capability negation never does', () => {
    expect(intentOf('больше не хочу разговаривать')).toBe('session_exit');
    expect(intentOf('больше не могу разговаривать')).toBe('ambiguous');
    expect(intentOf("i can't talk any more")).toBe('ambiguous');
  });
});

describe('compositional — scope decides session vs activity', () => {
  it('topic restriction keeps it at activity level', () => {
    for (const m of [
      'не хочу об этом разговаривать',
      'не хочу про это говорить',
      'can we talk about something else',
    ]) {
      expect(intentOf(m)).toBe('activity_stop');
    }
  });

  it('session scope lifts the same predicate to a session exit', () => {
    expect(intentOf('давай закончим на сегодня')).toBe('session_exit');
    expect(intentOf('давай закончим')).toBe('activity_stop');
  });

  it('a bare intent with no scope marker stays conservative', () => {
    expect(intentOf('не хочу разговаривать')).toBe('activity_stop');
  });
});

describe('compositional — precision guards', () => {
  it('a scope marker alone never fires', () => {
    for (const m of [
      'мне было хорошо сегодня',
      'i went to the garden today',
      'завтра у меня интервью',
    ]) {
      expect(intentOf(m)).not.toBe('session_exit');
    }
  });

  // Formerly pinned as a "known limit". Once the detector went live that limit
  // became a real false positive that could enter Closing, so the rule was
  // tightened: a sign-off must BE the utterance, not appear inside one.
  it('a sign-off talked ABOUT is not a sign-off', () => {
    expect(intentOf('до завтра ещё далеко')).not.toBe('session_exit');
  });

  it('a third party leaving is not the user leaving', () => {
    expect(intentOf('He is going to leave tomorrow')).toBe('none');
    expect(intentOf('она уйдёт завтра')).toBe('none');
  });

  it('future contact is still excluded', () => {
    expect(intentOf("I'll message you after the interview")).toBe('none');
    expect(intentOf('I will write to you later')).toBe('none');
  });

  it('the Russian numeric traps from score capture do not fire here', () => {
    for (const m of ['4 часа сна', 'через 15 минут', 'интервью через 4 часа']) {
      expect(intentOf(m)).toBe('none');
    }
  });

  it('every non-none result carries an audit token', () => {
    for (const m of [
      'Я, наверное, больше не хочу разговаривать',
      'не хочу об этом разговаривать',
      'я больше не могу',
      'давай в следующий раз',
    ]) {
      expect(detectExitIntent(m).matched).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Live-detector precision corrections (2026-08-08).
//
// Reducing the original whole-phrase lists to bare predicates broadened
// matching and introduced false positives that would have entered Closing.
// Every case below must NOT be a session exit.
// ---------------------------------------------------------------------------

describe('precision — departure verbs carrying a complement are not exits', () => {
  it.each([
    'I want to go deeper',
    "let's go back to that",
    'I want to go through it again',
    'я хочу уйти от него',
    'я ухожу в себя',
    'мне нужно идти дальше',
  ])('%s', (m) => expect(intentOf(m)).not.toBe('session_exit'));
});

describe('precision — a departure verb needs obligation or terminal position', () => {
  it('«пора что-то менять» is reflection, not leaving', () => {
    expect(intentOf('пора что-то менять')).not.toBe('session_exit');
  });

  it('the accepted true exits still fire', () => {
    for (const m of [
      'I need to go',
      'I have to go',
      "I've got to go",
      'I should go now',
      'Sorry, I NEED TO GO — my train is here',
      'мне пора',
      'мне пора идти',
      'мне нужно идти',
      'мне надо идти',
      'я пойду',
      "I'm logging off",
    ]) {
      expect(intentOf(m)).toBe('session_exit');
    }
  });
});

describe('precision — sign-offs must be the utterance', () => {
  it.each([
    'до завтра ещё далеко',
    'I never said goodbye to my father',
    'я не сказала ему до свидания',
    'он сказал увидимся завтра',
  ])('%s', (m) => expect(intentOf(m)).not.toBe('session_exit'));

  it('standalone sign-offs still fire, with tolerated filler', () => {
    for (const m of ['Goodbye', 'Bye for now', 'See you tomorrow', 'до свидания', 'до завтра', 'ок, до свидания']) {
      expect(intentOf(m)).toBe('session_exit');
    }
  });
});
