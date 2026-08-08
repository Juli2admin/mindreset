// Code-authored messages must follow the language the user is WRITING in.
// Regression tests for the live 2026-08-08 failure.
//
// The observed defect: a Russian-language Journey session received the
// code-authored stability question twice, in English, at 2/10 stability. The
// user was on an English-locale URL while writing Russian.
//
// The safety property this file pins: resolveConversationLocale can only ever
// CORRECT a wrong locale, never introduce one. Anything inconclusive returns
// the fallback unchanged, so no previously-correct case can regress.

import { describe, expect, it } from 'vitest';

import { resolveConversationLocale } from './conversation-locale';
import {
  STABILITY_QUESTION_EN,
  STABILITY_QUESTION_RU,
  getStabilityQuestionForLocale,
} from '../closure/stability-question';
import {
  CRISIS_RESPONSE_EN,
  CRISIS_RESPONSE_RU,
  getCrisisResponseForLocale,
  getCooldownLiftMessageForLocale,
  COOLDOWN_LIFT_MESSAGE_RU,
} from './keywords';

describe('ACCEPTANCE — the live 2026-08-08 failure', () => {
  // The two messages that actually triggered the code-authored question.
  const EXIT_1 = 'Ладно, не хочу больше с собой разговаривать, не знаешь ты ничего.';
  const EXIT_2 = 'Блин, и долго мне так лежать? Я все, я пошла, не хочу с тобой разговаривать.';

  it('a Russian message on an ENGLISH url locale resolves to ru', () => {
    expect(resolveConversationLocale(EXIT_1, 'en')).toBe('ru');
    expect(resolveConversationLocale(EXIT_2, 'en')).toBe('ru');
  });

  it('the stability question would now be asked in Russian', () => {
    // This is the exact assertion the live test failed.
    const locale = resolveConversationLocale(EXIT_1, 'en');
    expect(getStabilityQuestionForLocale(locale)).toBe(STABILITY_QUESTION_RU);
  });

  it('and the crisis response would be too — the highest-stakes instance', () => {
    const locale = resolveConversationLocale('я больше не хочу жить', 'en');
    expect(getCrisisResponseForLocale(locale)).toBe(CRISIS_RESPONSE_RU);
  });

  it('the cooldown-lift message follows the same source', () => {
    const locale = resolveConversationLocale('да, я в порядке', 'en');
    expect(getCooldownLiftMessageForLocale(locale)).toBe(COOLDOWN_LIFT_MESSAGE_RU);
  });
});

describe('English conversation is unchanged', () => {
  it('an English message on an English locale stays English', () => {
    const locale = resolveConversationLocale("I think I'm done for today", 'en');
    expect(locale).toBe('en');
    expect(getStabilityQuestionForLocale(locale)).toBe(STABILITY_QUESTION_EN);
    expect(getCrisisResponseForLocale(locale)).toBe(CRISIS_RESPONSE_EN);
  });

  it('an English message on a Russian locale keeps the ru fallback', () => {
    // Latin-only is NOT treated as evidence of English — a Russian speaker's
    // "ok" must not flip a Russian session to English.
    expect(resolveConversationLocale('ok', 'ru')).toBe('ru');
    expect(resolveConversationLocale('I am fine', 'ru')).toBe('ru');
  });
});

describe('fallback when the message carries no script signal', () => {
  it('a bare score returns the fallback', () => {
    // The live user answered "Two" and "five" — Latin, and in the RU case the
    // fallback must hold rather than flipping the session to English.
    expect(resolveConversationLocale('5', 'ru')).toBe('ru');
    expect(resolveConversationLocale('5', 'en')).toBe('en');
  });

  it('punctuation, emoji and whitespace return the fallback', () => {
    for (const text of ['...', '🙂', '   ', '???']) {
      expect(resolveConversationLocale(text, 'ru')).toBe('ru');
      expect(resolveConversationLocale(text, 'en')).toBe('en');
    }
  });

  it('an empty or absent message returns the fallback', () => {
    expect(resolveConversationLocale('', 'ru')).toBe('ru');
    expect(resolveConversationLocale(null, 'ru')).toBe('ru');
    expect(resolveConversationLocale(undefined, 'en')).toBe('en');
  });

  it('an unknown or missing fallback is preserved, not invented', () => {
    // Existing behaviour: unknown locales fall through to EN inside the
    // message helpers. This function must not pre-empt that decision.
    expect(resolveConversationLocale('hello', 'pl')).toBe('pl');
    expect(resolveConversationLocale('5', null)).toBeNull();
    expect(resolveConversationLocale(null, null)).toBeNull();
    expect(getStabilityQuestionForLocale(resolveConversationLocale('hello', 'pl')))
      .toBe(STABILITY_QUESTION_EN);
  });
});

describe('mixed script', () => {
  it('a Russian sentence containing a Latin fragment is still Russian', () => {
    // Cyrillic is the marked script: Latin fragments in Russian are routine,
    // Cyrillic in an English sentence is not.
    expect(resolveConversationLocale('я пошла в garden centre', 'en')).toBe('ru');
    expect(resolveConversationLocale('всё ок, пока', 'en')).toBe('ru');
    expect(resolveConversationLocale('посмотри https://mindreset.ai', 'en')).toBe('ru');
  });
});

describe('the fix can only correct, never introduce, a wrong locale', () => {
  it('never returns a locale the caller did not ask for unless it is ru', () => {
    const samples = ['hello', '5', '', '...', 'ok', null, undefined];
    for (const fallback of ['en', 'ru', 'pl', null]) {
      for (const text of samples) {
        const out = resolveConversationLocale(text, fallback);
        expect(out === fallback || out === 'ru').toBe(true);
      }
    }
  });
});
