// Session locale inheritance (2026-08-19) — Defect B.
//
// THE DEFECT, from the live session of 2026-08-19. The stability boundary
// asked «По шкале от 1 до 10...» in Russian, correctly. The user answered
// «5». That reply is language-neutral BY CONSTRUCTION — the question we ask
// invites a bare number — so `resolveConversationLocale('5', 'en')` returned
// 'en', and the next two code-authored strings landed in English inside a
// Russian session, at 5/10 stability, mid-close:
//
//   "On a scale of 1 to 10, how stable do you feel right now? ..."
//   "If you want to stop now, we can stop. But based on your current
//    stability rating, I'm not treating this session as stably completed yet."
//
// THE FIX. When THIS turn's message carries no script signal, the recent
// conversation is consulted before the URL locale. Only Russian is ever
// detectable (Latin is never read as evidence of English), so inheritance can
// move the answer toward 'ru' and never away from a Russian fallback — the
// safety property the module was built on is untouched.
//
// This file covers the closure path from the real production sequence AND the
// crisis / cooldown paths, which share the same resolver.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  resolveConversationLocale,
  messageLocaleSignal,
} from './conversation-locale';
import {
  CRISIS_RESPONSE_EN,
  CRISIS_RESPONSE_RU,
  COOLDOWN_LIFT_MESSAGE_RU,
  getCrisisResponseForLocale,
  getCooldownLiftMessageForLocale,
} from './keywords';
import {
  STABILITY_QUESTION_EN,
  STABILITY_QUESTION_RU,
  getStabilityQuestionForLocale,
} from '../closure/stability-question';
import {
  CLOSE_CORRECTION_EN,
  CLOSE_CORRECTION_RU,
  getCloseCorrectionForLocale,
} from '../closure/close-guard';

/** The user's own recent messages, newest first, from the live session. */
const RUSSIAN_SESSION = [
  'Знаешь, что-то я не могу, у меня сил нет. Я хочу закончить всё-таки разговаривать.',
  'застряла в отношениях из-за финансов.',
  'всё сразу это у меня. И злость, и обида, и разочарование.',
];

const ENGLISH_SESSION = [
  "I think I'm done for today",
  'it feels heavy but ok',
  'thanks',
];

// ---------------------------------------------------------------------------
// 1. The production sequence
// ---------------------------------------------------------------------------

describe('ACCEPTANCE — the live 2026-08-19 failure', () => {
  it('BEFORE: a bare "5" on an en-locale URL resolved to English', () => {
    // The two-argument form is untouched, so this is still exactly what the
    // old code did — and exactly what went wrong.
    expect(resolveConversationLocale('5', 'en')).toBe('en');
    expect(getStabilityQuestionForLocale(resolveConversationLocale('5', 'en')))
      .toBe(STABILITY_QUESTION_EN);
  });

  it('AFTER: the same "5" inherits the Russian the session has been running in', () => {
    const locale = resolveConversationLocale('5', 'en', RUSSIAN_SESSION);
    expect(locale).toBe('ru');
    expect(getStabilityQuestionForLocale(locale)).toBe(STABILITY_QUESTION_RU);
    expect(getCloseCorrectionForLocale(locale)).toBe(CLOSE_CORRECTION_RU);
  });

  it('every score the question can elicit inherits, not just "5"', () => {
    for (const score of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', ' 7 ', '7/10']) {
      expect(messageLocaleSignal(score)).toBeNull();
      expect(resolveConversationLocale(score, 'en', RUSSIAN_SESSION)).toBe('ru');
    }
  });

  it('and so do the other language-neutral replies a close invites', () => {
    for (const neutral of ['ok', 'ок', '👍', '...', '+', 'ага'] as const) {
      // 'ок' and 'ага' are Cyrillic and decide on their own; the rest inherit.
      expect(resolveConversationLocale(neutral, 'en', RUSSIAN_SESSION)).toBe('ru');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. A clear signal in THIS message still wins
// ---------------------------------------------------------------------------

describe('this turn`s own message is still the first authority', () => {
  it('Russian text decides regardless of history', () => {
    expect(resolveConversationLocale('мне тяжело', 'en', ENGLISH_SESSION)).toBe('ru');
    expect(resolveConversationLocale('я пошла в garden centre', 'en', ENGLISH_SESSION)).toBe('ru');
  });

  it('history is not consulted when the message already decided', () => {
    // If history were consulted here it could not change the answer, but the
    // ordering matters for the route: `messageLocaleSignal` is what gates the
    // extra read, so a decided message must never pay for one.
    expect(messageLocaleSignal('мне тяжело')).toBe('ru');
    expect(messageLocaleSignal('I am fine')).toBeNull();
    expect(messageLocaleSignal('5')).toBeNull();
  });

  it('an English session with a neutral reply still resolves English', () => {
    const locale = resolveConversationLocale('5', 'en', ENGLISH_SESSION);
    expect(locale).toBe('en');
    expect(getStabilityQuestionForLocale(locale)).toBe(STABILITY_QUESTION_EN);
    expect(getCloseCorrectionForLocale(locale)).toBe(CLOSE_CORRECTION_EN);
  });
});

// ---------------------------------------------------------------------------
// 3. Crisis and cooldown — the shared paths must not regress
// ---------------------------------------------------------------------------

describe('crisis and cooldown paths do not regress', () => {
  it('a Russian crisis message still gets the Russian crisis response', () => {
    const locale = resolveConversationLocale('я больше не хочу жить', 'en', ENGLISH_SESSION);
    expect(locale).toBe('ru');
    expect(getCrisisResponseForLocale(locale)).toBe(CRISIS_RESPONSE_RU);
  });

  it('an English crisis message still gets the English crisis response', () => {
    const locale = resolveConversationLocale("I don't want to be here anymore", 'en', ENGLISH_SESSION);
    expect(locale).toBe('en');
    expect(getCrisisResponseForLocale(locale)).toBe(CRISIS_RESPONSE_EN);
  });

  it('the cooldown-lift message follows the session for a bare "ok"', () => {
    // The exact shape of a lift reply: short, language-neutral, after a
    // Russian conversation. Previously English; now Russian.
    const locale = resolveConversationLocale('ok', 'en', RUSSIAN_SESSION);
    expect(getCooldownLiftMessageForLocale(locale)).toBe(COOLDOWN_LIFT_MESSAGE_RU);
  });

  it('a Russian fallback is never turned into English by history', () => {
    // The property the original module was built on, extended to the new
    // parameter: inheritance can only ever reach 'ru'.
    expect(resolveConversationLocale('5', 'ru', ENGLISH_SESSION)).toBe('ru');
    expect(resolveConversationLocale('ok', 'ru', ENGLISH_SESSION)).toBe('ru');
    expect(getCrisisResponseForLocale(resolveConversationLocale('5', 'ru', ENGLISH_SESSION)))
      .toBe(CRISIS_RESPONSE_RU);
  });

  it('a crisis turn is never left without SOME canned response', () => {
    for (const locale of [
      resolveConversationLocale('5', null, []),
      resolveConversationLocale(null, null, undefined),
      resolveConversationLocale('...', 'pl', ENGLISH_SESSION),
    ]) {
      expect(getCrisisResponseForLocale(locale).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. The safety property, restated over the new parameter
// ---------------------------------------------------------------------------

describe('inheritance can only correct, never introduce, a wrong locale', () => {
  it('the result is always the fallback or "ru", for every combination', () => {
    const samples = ['hello', '5', '', '...', 'ok', '👍', null, undefined];
    const histories = [undefined, [], ENGLISH_SESSION, RUSSIAN_SESSION, [null, undefined, '']];
    for (const fallback of ['en', 'ru', 'pl', null]) {
      for (const text of samples) {
        for (const history of histories) {
          const out = resolveConversationLocale(text, fallback, history);
          expect(out === fallback || out === 'ru').toBe(true);
        }
      }
    }
  });

  it('omitting the parameter is byte-for-byte the shipped behaviour', () => {
    const samples = ['hello', '5', '', '...', 'ok', 'мне тяжело', 'я пошла в garden centre', null];
    for (const fallback of ['en', 'ru', 'pl', null]) {
      for (const text of samples) {
        expect(resolveConversationLocale(text, fallback, undefined)).toBe(
          resolveConversationLocale(text, fallback),
        );
        // An empty history is likewise a no-op.
        expect(resolveConversationLocale(text, fallback, [])).toBe(
          resolveConversationLocale(text, fallback),
        );
      }
    }
  });

  it('unreadable history entries are skipped, not treated as signal', () => {
    // The route maps a failed decrypt to null rather than dropping the row.
    expect(resolveConversationLocale('5', 'en', [null, undefined, ''])).toBe('en');
    expect(resolveConversationLocale('5', 'en', [null, 'мне тяжело'])).toBe('ru');
  });

  it('the first Russian message found decides; order does not break it', () => {
    expect(resolveConversationLocale('5', 'en', ['ok', 'thanks', 'мне тяжело'])).toBe('ru');
    expect(resolveConversationLocale('5', 'en', ['мне тяжело', 'ok', 'thanks'])).toBe('ru');
  });
});

// ---------------------------------------------------------------------------
// 5. The route pays for the read only when it can change the answer
// ---------------------------------------------------------------------------

describe('the extra history read is gated', () => {
  it('messageLocaleSignal is the gate, and it decides on ordinary sentences', () => {
    // Ordinary turns — the overwhelming majority — never reach the query.
    for (const decided of ['мне тяжело', 'я устала', 'всё ок, пока']) {
      expect(messageLocaleSignal(decided)).toBe('ru');
    }
    // Only inconclusive messages fall through to it.
    for (const inconclusive of ['5', 'ok', '👍', '...', '', null, undefined]) {
      expect(messageLocaleSignal(inconclusive)).toBeNull();
    }
  });

  it('the route gates the lookup on exactly that predicate', () => {
    const route = readFileSync(
      path.join(process.cwd(), 'app/api/journey/turn/route.ts'),
      'utf8',
    );
    expect(route).toContain('if (messageLocaleSignal(userMessage) === null) {');
    expect(route).toContain('take: LOCALE_LOOKBACK_MESSAGES,');
    expect(route).toContain("where: { userId, role: 'user' },");
    // Non-fatal: a failed lookup must never cost a user their crisis response.
    expect(route).toContain(
      "console.error('[journey/turn] locale history lookup failed; using fallback locale'",
    );
  });

  it('nothing else in the closure path changed', () => {
    const route = readFileSync(
      path.join(process.cwd(), 'app/api/journey/turn/route.ts'),
      'utf8',
    );
    // Orchestrator §4 untouched; the boundary and its anchor untouched.
    expect(route).toContain('{ now: boundaryEntryAnchor(userMessageRow.createdAt) }');
    const orch = readFileSync(
      path.join(process.cwd(), 'lib/journey/closure/orchestrator.ts'),
      'utf8',
    );
    expect(orch).toContain("if (process.state === 'NONE') {");
  });
});
