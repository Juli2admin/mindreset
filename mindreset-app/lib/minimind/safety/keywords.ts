// Synchronous keyword pre-screener for the Phase 3c safety scanner.
//
// Returns the highest-severity match found in `text`. Tiers are scanned in
// descending order (Sev 5 first, then 4, 3, 2); within a tier, the first
// listed phrase wins. The scanner is pure, fast (< 5 ms), and has no IO.
//
// IMPORTANT: this file contains policy text. The phrase lists are internal
// product knowledge. They MUST NOT be:
//   - rendered to any user-visible surface
//   - returned via any public API
//   - included in documentation files
// They live here only.
//
// Severity meanings (mirrored by the verifier; see Phase 3c instructions):
//   5 — imminent crisis. Intent + (method OR plan OR imminence OR active
//       danger). Triggers cooldown.
//   4 — likely crisis. Intent without specificity. Triggers canned response,
//       no cooldown.
//   3 — ambiguous. Silent log. MiniMind responds normally.
//   2 — soft signal. Silent log only.
//   1 — minimal signal. Produced only by the verifier downgrading a low-
//       confidence keyword hit; the scanner itself never returns Sev 1.

export type SafetyEventType =
  | 'suicidal_ideation'
  | 'self_harm'
  | 'imminent_harm_to_others'
  | 'psychosis_signal'
  | 'acute_medical'
  | 'substance_crisis'
  | 'other';

// Discriminated union: a non-match carries no severity/type fields.
// A match carries a non-Sev-1 severity (Sev 1 is verifier-only territory).
export type KeywordMatch =
  | { matched: false }
  | {
      matched: true;
      severity: 2 | 3 | 4 | 5;
      type: SafetyEventType;
      triggerExcerpt: string;
    };

type Entry = { phrase: string; type: SafetyEventType };

// ============================================================================
// SEVERITY 5 — imminent crisis (cooldown triggered)
// Intent + (method OR plan OR imminence OR active danger).
// Bias: high-confidence multi-word phrases. False negatives preferred over
// false positives at this tier — consequence is a full cooldown.
// ============================================================================
const SEVERITY_5: Entry[] = [
  // Suicidal ideation — intent with imminence or method
  { phrase: "i'm going to kill myself",         type: 'suicidal_ideation' },
  { phrase: 'im going to kill myself',          type: 'suicidal_ideation' },
  { phrase: 'i am going to kill myself',        type: 'suicidal_ideation' },
  { phrase: 'going to kill myself tonight',     type: 'suicidal_ideation' },
  { phrase: 'going to end my life',             type: 'suicidal_ideation' },
  { phrase: 'going to end my life tonight',     type: 'suicidal_ideation' },
  { phrase: "i'm going to end it tonight",      type: 'suicidal_ideation' },
  { phrase: 'want to die tonight',              type: 'suicidal_ideation' },
  { phrase: 'going to die tonight',             type: 'suicidal_ideation' },
  { phrase: "i'm going to overdose",            type: 'suicidal_ideation' },
  { phrase: "i'm going to hang myself",         type: 'suicidal_ideation' },
  { phrase: 'i have pills ready',               type: 'suicidal_ideation' },
  { phrase: 'i have the pills ready',           type: 'suicidal_ideation' },
  { phrase: 'loaded the gun',                   type: 'suicidal_ideation' },
  { phrase: 'i loaded the gun',                 type: 'suicidal_ideation' },
  { phrase: "i'm ready to die",                 type: 'suicidal_ideation' },

  // Self-harm — active in progress or just-completed
  { phrase: "i'm cutting right now",            type: 'self_harm' },
  { phrase: 'im cutting right now',             type: 'self_harm' },
  { phrase: "i'm cutting myself right now",     type: 'self_harm' },
  { phrase: 'i just cut myself',                type: 'self_harm' },
  { phrase: 'i overdosed',                      type: 'self_harm' },
  { phrase: 'i just overdosed',                 type: 'self_harm' },
  { phrase: 'took an overdose',                 type: 'self_harm' },
  { phrase: 'i just took a bunch of pills',     type: 'self_harm' },
  { phrase: 'i just swallowed the pills',       type: 'self_harm' },
  { phrase: "i'm bleeding right now",           type: 'self_harm' },

  // Psychosis signal — command hallucination
  { phrase: 'voices telling me to kill',        type: 'psychosis_signal' },
  { phrase: 'voices telling me to hurt',        type: 'psychosis_signal' },
  { phrase: 'voices are telling me to kill',    type: 'psychosis_signal' },
  { phrase: 'voices are telling me to hurt',    type: 'psychosis_signal' },

  // Acute medical — high specificity, low metaphor risk
  { phrase: 'crushing chest pain',              type: 'acute_medical' },
  { phrase: 'chest pain crushing',              type: 'acute_medical' },
  { phrase: 'having a heart attack',            type: 'acute_medical' },
  { phrase: "i think i'm having a heart attack", type: 'acute_medical' },

  // Imminent harm to others — "hurt" only ("kill X" removed per policy review
  // due to video-game/sports false-positive risk at Sev 5 consequence level)
  { phrase: "i'm going to hurt her",            type: 'imminent_harm_to_others' },
  { phrase: "i'm going to hurt him",            type: 'imminent_harm_to_others' },
  { phrase: "i'm going to hurt them",           type: 'imminent_harm_to_others' },

  // -----------------------------------------------------------------------
  // RU — authored by owner 2026-06-01. Feminine forms canonical
  // (CLAUDE.md). Multi-word for false-positive resistance.
  // -----------------------------------------------------------------------

  // Suicidal ideation — intent + plan/imminence
  { phrase: 'я сегодня покончу с собой',                type: 'suicidal_ideation' },
  { phrase: 'я сейчас покончу с собой',                 type: 'suicidal_ideation' },
  { phrase: 'я убью себя сегодня',                      type: 'suicidal_ideation' },
  { phrase: 'я собираюсь покончить с собой сегодня',    type: 'suicidal_ideation' },
  { phrase: 'я уже всё решила и сделаю это сегодня',    type: 'suicidal_ideation' },
  { phrase: 'я сегодня приму таблетки',                 type: 'suicidal_ideation' },
  { phrase: 'у меня готовы таблетки',                   type: 'suicidal_ideation' },
  { phrase: 'я сейчас выпью таблетки',                  type: 'suicidal_ideation' },
  { phrase: 'я уже выпила таблетки',                    type: 'suicidal_ideation' },
  { phrase: 'я уже приняла таблетки',                   type: 'suicidal_ideation' },
  { phrase: 'я нашла способ покончить с собой',         type: 'suicidal_ideation' },
  { phrase: 'у меня есть план покончить с собой',       type: 'suicidal_ideation' },
  { phrase: 'я сейчас выйду из окна',                   type: 'suicidal_ideation' },
  { phrase: 'я собираюсь прыгнуть',                     type: 'suicidal_ideation' },
  { phrase: 'я сейчас вскрою вены',                     type: 'suicidal_ideation' },

  // Self-harm in progress
  { phrase: 'я сейчас режусь',                          type: 'self_harm' },
  { phrase: 'я уже режу себя',                          type: 'self_harm' },
  { phrase: 'я только что порезалась',                  type: 'self_harm' },
  { phrase: 'я сейчас порежу себя',                     type: 'self_harm' },
  { phrase: 'я специально порезалась',                  type: 'self_harm' },
  { phrase: 'я приняла передозировку',                  type: 'self_harm' },
  { phrase: 'я выпила слишком много таблеток',          type: 'self_harm' },
  { phrase: 'я истекаю кровью',                         type: 'self_harm' },
  { phrase: 'я порезала себя и кровь не останавливается', type: 'self_harm' },
  { phrase: 'я сделала себе больно и не могу остановиться', type: 'self_harm' },

  // Psychosis — command hallucinations
  { phrase: 'голоса говорят мне убить себя',            type: 'psychosis_signal' },
  { phrase: 'голоса велят мне убить себя',              type: 'psychosis_signal' },
  { phrase: 'голоса приказывают мне покончить с собой', type: 'psychosis_signal' },
  { phrase: 'голоса говорят мне убить его',             type: 'psychosis_signal' },
  { phrase: 'голоса говорят мне убить её',              type: 'psychosis_signal' },
  { phrase: 'голоса велят мне причинить кому-то вред',  type: 'psychosis_signal' },

  // Acute medical
  { phrase: 'сильная боль в груди',                     type: 'acute_medical' },
  { phrase: 'давит в груди',                            type: 'acute_medical' },
  { phrase: 'у меня инфаркт',                           type: 'acute_medical' },
  { phrase: 'мне трудно дышать',                        type: 'acute_medical' },
  { phrase: 'я не могу дышать',                         type: 'acute_medical' },
  { phrase: 'я теряю сознание',                         type: 'acute_medical' },
  { phrase: 'у меня онемела рука и боль в груди',       type: 'acute_medical' },
  { phrase: 'у меня сильное кровотечение',              type: 'acute_medical' },

  // Imminent harm to others
  { phrase: 'я сейчас его ударю',                       type: 'imminent_harm_to_others' },
  { phrase: 'я сейчас её ударю',                        type: 'imminent_harm_to_others' },
  { phrase: 'я ему сейчас врежу',                       type: 'imminent_harm_to_others' },
  { phrase: 'я сейчас причиню ему вред',                type: 'imminent_harm_to_others' },
  { phrase: 'я сейчас причиню ей вред',                 type: 'imminent_harm_to_others' },
  { phrase: 'я боюсь, что сейчас кого-то ударю',        type: 'imminent_harm_to_others' },
];

// ============================================================================
// SEVERITY 4 — likely crisis (canned response delivered, NO cooldown)
// Intent without specificity / imminence.
// ============================================================================
const SEVERITY_4: Entry[] = [
  // Suicidal ideation — intent, no method/imminence
  { phrase: 'i want to die',                    type: 'suicidal_ideation' },
  { phrase: 'i wanna die',                      type: 'suicidal_ideation' },
  { phrase: 'wanna die',                        type: 'suicidal_ideation' },
  { phrase: 'i wish i was dead',                type: 'suicidal_ideation' },
  { phrase: 'i wish i were dead',               type: 'suicidal_ideation' },
  { phrase: 'i want to kill myself',            type: 'suicidal_ideation' },
  { phrase: 'want to kill myself',              type: 'suicidal_ideation' },
  { phrase: 'i wanna kill myself',              type: 'suicidal_ideation' },
  { phrase: 'wanna kill myself',                type: 'suicidal_ideation' },
  { phrase: 'want to end it all',               type: 'suicidal_ideation' },
  { phrase: 'i want to end it all',             type: 'suicidal_ideation' },
  { phrase: 'want to end my life',              type: 'suicidal_ideation' },
  { phrase: 'i want to be dead',                type: 'suicidal_ideation' },
  { phrase: 'want to be dead',                  type: 'suicidal_ideation' },
  { phrase: "i don't want to live",             type: 'suicidal_ideation' },
  { phrase: "i don't want to be alive",         type: 'suicidal_ideation' },
  { phrase: "i don't want to wake up",          type: 'suicidal_ideation' },
  { phrase: 'no reason to live',                type: 'suicidal_ideation' },
  { phrase: 'no reason to be alive',            type: 'suicidal_ideation' },
  { phrase: 'everyone would be better off without me', type: 'suicidal_ideation' },
  { phrase: 'world would be better off without me',    type: 'suicidal_ideation' },
  { phrase: "they'd be better off without me",  type: 'suicidal_ideation' },
  { phrase: 'tired of being alive',             type: 'suicidal_ideation' },

  // Self-harm — intent or active ideation
  { phrase: 'i want to cut',                    type: 'self_harm' },
  { phrase: 'i want to cut myself',             type: 'self_harm' },
  { phrase: 'i want to hurt myself',            type: 'self_harm' },
  { phrase: 'i want to harm myself',            type: 'self_harm' },
  { phrase: 'thinking about hurting myself',    type: 'self_harm' },
  { phrase: 'thinking about cutting myself',    type: 'self_harm' },

  // Other — hopelessness with escape language; "done with" variants
  { phrase: 'i see no way out',                 type: 'other' },
  { phrase: 'see no way out of this',           type: 'other' },
  { phrase: 'ready to give up on life',         type: 'other' },
  { phrase: "i'm done with everything",         type: 'other' },
  { phrase: 'im done with everything',          type: 'other' },
  { phrase: 'done with everything',             type: 'other' },
  { phrase: "i'm done with life",               type: 'other' },
  { phrase: 'im done with life',                type: 'other' },
  { phrase: 'done with life',                   type: 'other' },

  // -----------------------------------------------------------------------
  // RU — authored by owner 2026-06-01. Feminine forms canonical.
  // -----------------------------------------------------------------------

  // Suicidal ideation — intent without specificity
  { phrase: 'хочу умереть',                     type: 'suicidal_ideation' },
  { phrase: 'я хочу умереть',                   type: 'suicidal_ideation' },
  { phrase: 'я хочу покончить с собой',         type: 'suicidal_ideation' },
  { phrase: 'не хочу жить',                     type: 'suicidal_ideation' },
  { phrase: 'я не хочу жить',                   type: 'suicidal_ideation' },
  { phrase: 'не хочу больше жить',              type: 'suicidal_ideation' },
  { phrase: 'я больше не хочу жить',            type: 'suicidal_ideation' },
  { phrase: 'хочу убить себя',                  type: 'suicidal_ideation' },
  { phrase: 'я хочу убить себя',                type: 'suicidal_ideation' },
  { phrase: 'лучше бы я умерла',                type: 'suicidal_ideation' },
  { phrase: 'лучше бы меня не было',            type: 'suicidal_ideation' },
  { phrase: 'не хочу просыпаться',              type: 'suicidal_ideation' },
  { phrase: 'мне хочется не проснуться',        type: 'suicidal_ideation' },
  { phrase: 'нет смысла жить',                  type: 'suicidal_ideation' },
  { phrase: 'не вижу смысла жить',              type: 'suicidal_ideation' },
  { phrase: 'всем будет лучше без меня',        type: 'suicidal_ideation' },
  { phrase: 'устала жить',                      type: 'suicidal_ideation' },
  { phrase: 'хочу исчезнуть навсегда',          type: 'suicidal_ideation' },
  { phrase: 'хочу, чтобы меня не стало',        type: 'suicidal_ideation' },
  { phrase: 'я думаю о самоубийстве',           type: 'suicidal_ideation' },
  { phrase: 'думаю покончить с собой',          type: 'suicidal_ideation' },

  // Self-harm intent
  { phrase: 'хочу резать себя',                 type: 'self_harm' },
  { phrase: 'хочу причинить себе боль',         type: 'self_harm' },
  { phrase: 'я хочу причинить себе вред',       type: 'self_harm' },
  { phrase: 'думаю о том, чтобы порезаться',    type: 'self_harm' },
  { phrase: 'думаю причинить себе боль',        type: 'self_harm' },
  { phrase: 'меня тянет порезаться',            type: 'self_harm' },
  { phrase: 'я боюсь, что могу причинить себе вред', type: 'self_harm' },

  // Other — hopelessness with escape language
  { phrase: 'не вижу выхода',                   type: 'other' },
  { phrase: 'не вижу никакого выхода',          type: 'other' },
];

// ============================================================================
// SEVERITY 3 — ambiguous (silent log, MiniMind responds normally)
// Concerning intensity but not crisis intent. Logged for trend tracking.
// ============================================================================
const SEVERITY_3: Entry[] = [
  { phrase: "what's the point",                 type: 'other' },
  { phrase: 'whats the point',                  type: 'other' },
  { phrase: "what's the point of any of this",  type: 'other' },
  { phrase: "what's the point of living",       type: 'other' },
  { phrase: "what's the point of life",         type: 'other' },
  { phrase: "i can't keep going",               type: 'other' },
  { phrase: "i can't go on",                    type: 'other' },
  { phrase: "can't go on like this",            type: 'other' },
  { phrase: 'nothing matters anymore',          type: 'other' },
  { phrase: 'nothing matters',                  type: 'other' },
  { phrase: 'i feel nothing',                   type: 'other' },
  { phrase: 'feel nothing anymore',             type: 'other' },
  { phrase: "i'm not really here",              type: 'other' },
  { phrase: 'not really here anymore',          type: 'other' },
  { phrase: 'i lose hours',                     type: 'other' },
  { phrase: 'i lose time',                      type: 'other' },

  // -----------------------------------------------------------------------
  // RU — authored by owner 2026-06-01.
  // -----------------------------------------------------------------------
  { phrase: 'какой смысл',                      type: 'other' },
  { phrase: 'какой смысл во всём этом',         type: 'other' },
  { phrase: 'не могу больше',                   type: 'other' },
  { phrase: 'не могу так дальше',               type: 'other' },
  { phrase: 'ничто не имеет значения',          type: 'other' },
  { phrase: 'ничего не имеет значения',         type: 'other' },
  { phrase: 'ничего не чувствую',               type: 'other' },
  { phrase: 'меня здесь нет',                   type: 'other' },
  { phrase: 'я как будто не здесь',             type: 'other' },
  { phrase: 'я не справляюсь',                  type: 'other' },
  { phrase: 'я на пределе',                     type: 'other' },
  { phrase: 'я больше не выдерживаю',           type: 'other' },
  { phrase: 'всё слишком тяжело',               type: 'other' },
  { phrase: 'я не понимаю, зачем всё это',      type: 'other' },
  { phrase: 'я чувствую пустоту',               type: 'other' },
  { phrase: 'я будто исчезла',                  type: 'other' },
  { phrase: 'я как будто не существую',         type: 'other' },
  { phrase: 'готова сдаться',                   type: 'other' },
  { phrase: 'я со всем закончила',              type: 'other' },
];

// ============================================================================
// SEVERITY 2 — soft signal (silent log only)
// Trend-spotting. Deliberately narrow.
// ============================================================================
const SEVERITY_2: Entry[] = [
  { phrase: 'i feel hopeless',                  type: 'other' },
  { phrase: "i'm hopeless",                     type: 'other' },
  { phrase: 'completely hopeless',              type: 'other' },
  { phrase: 'i hate being alive',               type: 'other' },
  { phrase: "i'm so tired of life",             type: 'other' },
  { phrase: 'tired of being here',              type: 'other' },

  // -----------------------------------------------------------------------
  // RU — authored by owner 2026-06-01.
  // -----------------------------------------------------------------------
  { phrase: 'я безнадёжна',                     type: 'other' },
  { phrase: 'чувствую безнадёжность',           type: 'other' },
  { phrase: 'ненавижу свою жизнь',              type: 'other' },
  { phrase: 'так устала от жизни',              type: 'other' },
  { phrase: 'устала находиться здесь',          type: 'other' },
  { phrase: 'я устала от всего',                type: 'other' },
  { phrase: 'я больше ничего не хочу',          type: 'other' },
  { phrase: 'мне всё равно',                    type: 'other' },
  { phrase: 'я чувствую себя сломанной',        type: 'other' },
  { phrase: 'я потеряла себя',                  type: 'other' },
  { phrase: 'я не вижу будущего',               type: 'other' },
  { phrase: 'всё кажется бессмысленным',        type: 'other' },
];

const TIERS: ReadonlyArray<{ severity: 2 | 3 | 4 | 5; entries: Entry[] }> = [
  { severity: 5, entries: SEVERITY_5 },
  { severity: 4, entries: SEVERITY_4 },
  { severity: 3, entries: SEVERITY_3 },
  { severity: 2, entries: SEVERITY_2 },
];

const REGEX_META = /[.*+?^${}()|[\]\\]/g;
function escapeForRegex(s: string): string {
  return s.replace(REGEX_META, '\\$&');
}

// Normalize "smart" quotes so phrases authored with straight ASCII apostrophes
// (U+0027) still match input where the client/keyboard auto-converted them to
// curly quotes (U+2018 / U+2019). Same for double quotes (U+201C / U+201D).
// iOS keyboards, browsers with smart-quote settings, and rich-text paste all
// silently convert these — without this step, "what's the point" types as
// "what’s the point" and slips past every apostrophed phrase in the list.
function normalizeForScan(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

// Cyrillic Unicode block — distinguishes RU phrases from the EN ones so we
// can pick the right word-boundary semantics for each.
const CYRILLIC_RANGE = /[Ѐ-ӿ]/;

// Build a word-boundary regex appropriate for the phrase's script.
// EN phrases use JavaScript's native `\b`, which is ASCII-only (boundaries
// between [A-Za-z0-9_] and non-word). For Cyrillic phrases that fails:
// `\bхочу` in "я хочу умереть" produces no match because `х` is not in `\w`
// and the space-to-х transition doesn't fire `\b`.
//
// Fix: for Cyrillic phrases, use Unicode-aware lookarounds with `\p{L}`
// (any letter from any script) — phrase NOT adjacent to a letter on
// either side. The `u` flag enables Unicode property escapes. This also
// prevents the false-positive where a phrase appears as a substring of a
// longer word (e.g. phrase "умер" should NOT match inside "сумерек").
function makePhraseRegex(phrase: string): RegExp {
  const escaped = escapeForRegex(phrase);
  if (CYRILLIC_RANGE.test(phrase)) {
    return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'iu');
  }
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

export function scanForKeywords(text: string): KeywordMatch {
  if (!text || typeof text !== 'string') {
    return { matched: false };
  }
  const normalized = normalizeForScan(text);
  for (const tier of TIERS) {
    for (const entry of tier.entries) {
      const re = makePhraseRegex(entry.phrase);
      const m = normalized.match(re);
      if (m && typeof m.index === 'number') {
        return {
          matched: true,
          severity: tier.severity,
          type: entry.type,
          triggerExcerpt: m[0],
        };
      }
    }
  }
  return { matched: false };
}
