// Quoted deferral in the no-predicate branch (2026-08-24) — a live false
// positive.
//
// WHAT HAPPENED. In the session of 2026-08-24 the user was describing her
// childhood — how her wishes were dismissed. Her message quoted the
// dismissals themselves: «Либо, ой, ну давай в другой раз». The words her
// MOTHER used matched DEFERRAL (`в другой раз`) and COOPERATIVE (`давай`),
// the message carried no predicate token, and step 6 lifted the pair to
// `session_exit`. The false exit entered the closure machinery, her next
// score («6», ≥ threshold) was captured as a stability measurement, the
// process went CLOSED, and the Clinician said goodbye mid-breakthrough. She
// had to override it: «я не хочу, чтобы мы останавливались… продолжаем
// работать».
//
// WHY THE FIX IS STRUCTURAL, NOT A TOKEN EDIT. Unlike bare «потом»
// (2026-08-23), «в другой раз» is a genuine deferral phrase — the problem is
// attribution and position, not the token. The no-predicate branch now
// requires the pair to be a DIRECT proposal:
//
//   1. SHORT — ≤ MAX_DIRECT_PROPOSAL_TOKENS (10) tokens. The longest pinned
//      genuine exit on this branch is 5 tokens; the production message ~48.
//   2. NOT REPORTED — neither marker governed by REPORTED_SPEECH
//      (THIRD_PERSON plus the past-tense speech verbs that introduce a
//      quote), within the existing GOVERN_WINDOW.
//
// Both guards are suppressive-only: they can turn a would-be exit into
// `none` — where the Clinician sees the message and responds — never create
// a new exit. The predicate path (steps 7–11), P_CONTINUE, the topic branch,
// and THIRD_PERSON as used by step 7 are untouched.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectExitIntent } from './exit-intent';

const intentOf = (m: string) => detectExitIntent(m).intent;

/** Her message from the 2026-08-24 session, as sent. */
const PRODUCTION_MESSAGE =
  'но мне было грустно и одиноко. Я не могла сказать про свои желания, ' +
  'потому что мои желания как бы... Либо говорили, ой, ну мы не можем это ' +
  'сделать, у нас денежек нету. Либо, ой, ну давай в другой раз. Либо, ну ' +
  'ты же понимаешь, я всё время должна всех понять.';

// ---------------------------------------------------------------------------
// 1. The production failure
// ---------------------------------------------------------------------------

describe('ACCEPTANCE — the live 2026-08-24 false positive', () => {
  it('the exact production message no longer resolves to session_exit', () => {
    expect(intentOf(PRODUCTION_MESSAGE)).not.toBe('session_exit');
  });

  it('and therefore the closure machinery would not have been entered', () => {
    // orchestrator.ts §4 enters the closure process ONLY on `session_exit`.
    // This is the whole difference between the Clinician receiving her
    // childhood material and her getting «Мы не закончили. Но сейчас можно
    // остановиться» in the middle of it.
    expect(intentOf(PRODUCTION_MESSAGE)).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// 2. Reported speech — short quotes the length guard cannot catch
// ---------------------------------------------------------------------------

describe('attributed deferrals are not the user leaving', () => {
  it.each([
    'она говорила: ну давай в другой раз',
    'мама говорила: давай в другой раз',
    'он сказал: давай завтра',
    'они сказали: давай в следующий раз',
    "she said let's do it another time",
  ])('%s', (m) => expect(intentOf(m)).not.toBe('session_exit'));
});

// ---------------------------------------------------------------------------
// 3. Narrative — unattributed markers buried in long messages
// ---------------------------------------------------------------------------

describe('a marker buried in narrative is not a proposal', () => {
  it('an unattributed narrative fails the length guard', () => {
    expect(
      intentOf(
        'я всё думаю про эти её слова, ну давай в другой раз, и как они на ' +
          'меня действовали все эти годы',
      ),
    ).not.toBe('session_exit');
  });
});

// ---------------------------------------------------------------------------
// 4. Every pinned genuine exit on this branch still fires
// ---------------------------------------------------------------------------

describe('direct deferral proposals are preserved', () => {
  it.each([
    'давай потом',
    'давайте потом',
    'давай завтра',
    'давай потом поговорим',
    'давай в другой раз',
    'давай в следующий раз',
    'слушай, давай потом, я устала',
    // Filler-led and short-reason variants stay inside the token cap.
    'ну ладно, давай в другой раз',
    'давай в другой раз, я устала',
  ])('%s', (m) => expect(intentOf(m)).toBe('session_exit'));
});

// ---------------------------------------------------------------------------
// 5. Nothing else moved
// ---------------------------------------------------------------------------

describe('the rest of the detector is unchanged', () => {
  it('a pure deferral marker with no cooperative proposal is still none', () => {
    for (const m of ['потом поговорим', 'в следующий раз', 'поговорим потом']) {
      expect(intentOf(m)).toBe('none');
    }
  });

  it('the topic branch is untouched', () => {
    expect(intentOf('давай о другом')).toBe('activity_stop');
  });

  it('the predicate path is untouched — length does NOT gate it', () => {
    // These all carry a predicate and exit via step 10 / step 11, where the
    // new guards deliberately do not apply.
    for (const m of [
      'давай закончим на сегодня',
      'Can we continue tomorrow?',
      'Can we pick this up later?',
      'Sorry, I NEED TO GO — my train is here',
    ]) {
      expect(intentOf(m)).toBe('session_exit');
    }
  });

  it('the 2026-08-23 потом fixtures are unaffected', () => {
    expect(intentOf('если я всё-таки начинаю с ним общаться, а потом он это продолжает хотеть'))
      .not.toBe('session_exit');
    expect(intentOf('давай потом продолжим')).toBe('session_exit');
  });

  it('REPORTED_SPEECH is a separate constant — THIRD_PERSON itself is unchanged', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'lib/journey/closure/exit-intent.ts'),
      'utf8',
    );
    const third = src.slice(
      src.indexOf('const THIRD_PERSON'),
      src.indexOf('];', src.indexOf('const THIRD_PERSON')),
    );
    // The speech verbs live ONLY in REPORTED_SPEECH, so the predicate path
    // (step 7) keeps its exact pre-fix behaviour.
    for (const verb of ["' говорила '", "' говорили '", "' сказали '", "' говорил '"]) {
      expect(third).not.toContain(verb);
    }
    const reported = src.slice(
      src.indexOf('const REPORTED_SPEECH'),
      src.indexOf('];', src.indexOf('const REPORTED_SPEECH')),
    );
    expect(reported).toContain('...THIRD_PERSON');
    for (const verb of ["' говорила '", "' говорили '", "' сказали '", "' говорил '"]) {
      expect(reported).toContain(verb);
    }
  });
});
