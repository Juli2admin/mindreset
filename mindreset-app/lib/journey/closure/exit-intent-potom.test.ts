// «потом» as a deferral marker (2026-08-23) — a live false positive.
//
// WHAT HAPPENED. In the session of 2026-08-23 the user was describing her
// marriage — the two extremes of her closeness with her husband, the
// depletion, the «ребёнок и мама» dynamic. It was the most productive turn of
// the session. She received a bare stability question in reply and then a
// goodbye, and the Clinician never saw the message at all: `detectExitIntent`
// returned `session_exit`, the orchestrator short-circuited to a canned
// response, and the model was never called. There is no JourneyTurn row for
// that message.
//
// WHY. Two over-broad markers met in one sentence:
//
//   P_CONTINUE  bare `общаться` — «если я всё-таки начинаю с ним общаться»
//   DEFERRAL    bare `потом`    — «а потом он это продолжает хотеть»
//
// and step 10 lifts `scope || deferral` to a session exit. In Russian «потом»
// is overwhelmingly the narrative connective "then / afterwards", so any
// sentence of the shape "…говорить… а потом…" ended the session — which in
// relational narrative is most of them.
//
// THE FIX, deliberately the smallest one: the bare token is replaced by whole
// deferral phrases, in both word orders because Russian orders freely. The
// P_CONTINUE list and the matcher logic are untouched — that is a separate
// decision, still open.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectExitIntent } from './exit-intent';

/** The exact sentence from the 2026-08-23 session. */
const PRODUCTION_SENTENCE =
  'если я всё-таки начинаю с ним общаться, а потом он это продолжает хотеть';

/** Her full message, as sent. */
const PRODUCTION_MESSAGE =
  'Ну это говорит о какой-то вот эмоциональной, видимо, нестабильности, что у меня нет ' +
  'однозначного эмоционального какого-то поведения и паттерна, который бы я от других ждала, ' +
  'и другие тоже это понимали. То есть у меня две крайности с ним. Либо я вообще с ним не ' +
  'разговариваю настолько, что мы живём как соседи дома, не общаясь вообще даже, ну ' +
  'элементарно не общаясь. либо если я все-таки начинаю с ним общаться, у нас настолько ' +
  'углубляются отношения, что мы прям вот вообще чуть ли не 24 на 7 хотим быть вместе ' +
  'сначала, а потом он это продолжает хотеть, а я уже этого не хочу, он меня все, как ' +
  'говорится, как его энергетически высасывает.';

// ---------------------------------------------------------------------------
// 1. The production failure
// ---------------------------------------------------------------------------

describe('ACCEPTANCE — the live 2026-08-23 false positive', () => {
  it('the exact sentence no longer resolves to session_exit', () => {
    expect(detectExitIntent(PRODUCTION_SENTENCE).intent).not.toBe('session_exit');
  });

  it('her full message no longer resolves to session_exit', () => {
    expect(detectExitIntent(PRODUCTION_MESSAGE).intent).not.toBe('session_exit');
  });

  it('and therefore the orchestrator would not have short-circuited the turn', () => {
    // orchestrator.ts §4 enters the closure process ONLY on `session_exit`;
    // anything else proceeds to the model. That is the whole difference
    // between the Clinician answering her and her getting a canned question.
    for (const text of [PRODUCTION_SENTENCE, PRODUCTION_MESSAGE]) {
      expect(detectExitIntent(text).intent === 'session_exit').toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. The other reproductions found alongside it
// ---------------------------------------------------------------------------

describe('the family of "…talking-verb… а потом…" false positives', () => {
  const CASES = [
    'мы много говорить любим, а потом он замолкает',
    'я продолжать не могла терпеть это, а потом всё стало хуже',
    'сначала мы разговаривать пробовали, а потом перестали',
    'я начинаю с ним общаться, а потом жалею',
    'мы поговорить не можем спокойно, а потом оба молчим неделями',
  ];

  it('none of them is a session exit any more', () => {
    for (const text of CASES) {
      expect(detectExitIntent(text).intent).not.toBe('session_exit');
    }
  });

  it('«потом» alone carries no exit weight at all', () => {
    for (const text of [
      'мы поругались, а потом я перечитала его сообщения',
      'сначала было хорошо, а потом стало плохо',
      'потом он уехал во Вьетнам',
      'я потом поняла, что это тот же круг',
    ]) {
      expect(detectExitIntent(text).intent).toBe('none');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Genuine deferral still ends the session
// ---------------------------------------------------------------------------

describe('real deferral is preserved', () => {
  // Verified before/after by replaying the old list: every one of these
  // returns the SAME verdict as it did with the bare token in place. The
  // fix removes false positives and nothing else.

  it('«давай потом» still ends the session', () => {
    for (const text of ['давай потом', 'давайте потом', 'слушай, давай потом, я устала']) {
      expect(detectExitIntent(text).intent).toBe('session_exit');
    }
  });

  it('«потом продолжим» still ends the session, in either word order', () => {
    for (const text of ['потом продолжим', 'продолжим потом', 'давай потом продолжим']) {
      expect(detectExitIntent(text).intent).toBe('session_exit');
    }
  });

  it('«потом поговорим» carries deferral, and lands where every pure deferral marker lands', () => {
    // Unchanged by this fix: a deferral marker with no predicate needs a
    // cooperative proposal to become an exit (orchestrator §6). This is the
    // pre-existing contract — «в следующий раз» behaves identically — and it
    // is asserted here so the phrase is on record as carrying the marker.
    expect(detectExitIntent('в следующий раз').intent).toBe('none');
    expect(detectExitIntent('потом поговорим').intent).toBe('none');
    expect(detectExitIntent('поговорим потом').intent).toBe('none');
    // ...and with the cooperative proposal, both are exits.
    expect(detectExitIntent('давай в следующий раз').intent).toBe('session_exit');
    expect(detectExitIntent('давай потом поговорим').intent).toBe('session_exit');
  });

  it('the deferral markers that were never in question still work', () => {
    for (const text of ['давай завтра', 'давай в другой раз', "let's pick this up tomorrow"]) {
      expect(detectExitIntent(text).intent).toBe('session_exit');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Nothing else moved
// ---------------------------------------------------------------------------

describe('the rest of the detector is unchanged', () => {
  it('an explicit close is still a session exit', () => {
    for (const text of ['давай закончим на сегодня', 'на сегодня хватит']) {
      expect(detectExitIntent(text).intent).toBe('session_exit');
    }
  });

  it('exhaustion is still ambiguous, not an exit', () => {
    expect(detectExitIntent('я больше не могу').intent).toBe('ambiguous');
  });

  it('topic-level stops are still activity_stop', () => {
    expect(detectExitIntent('не хочу про это говорить').intent).toBe('activity_stop');
  });

  it('an empty or signal-less message is still none', () => {
    for (const text of ['', '   ', '5']) {
      expect(detectExitIntent(text).intent).toBe('none');
    }
  });

  it('P_CONTINUE is untouched — a bare talking-verb still reaches activity level', () => {
    // Deliberately NOT changed in this fix: `общаться` still matches as a
    // continue predicate. Without a deferral marker it lands at activity
    // level, which does not enter the closure process. Asserted so the
    // still-open P_CONTINUE decision is visible rather than assumed.
    expect(detectExitIntent('если я начинаю с ним общаться, он это продолжает хотеть').intent)
      .toBe('activity_stop');
  });

  it('the bare token is gone from the source, not merely shadowed', () => {
    const src = readFileSync(path.join(process.cwd(), 'lib/journey/closure/exit-intent.ts'), 'utf8');
    const list = src.slice(src.indexOf('const DEFERRAL'), src.indexOf('];', src.indexOf('const DEFERRAL')));
    expect(list).not.toContain("\n  'потом',");
    for (const phrase of ['давай потом', 'потом поговорим', 'потом продолжим']) {
      expect(list).toContain(`'${phrase}'`);
    }
  });
});
