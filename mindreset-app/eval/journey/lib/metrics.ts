// Mechanical metrics (EN + RU). Deterministic, no API. Run identically on
// recorded production replies and on live variant replies.

import type { Fixture, TurnResult } from './types';

const STOCK_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'en_i_hear', re: /\bI hear (you|that)\b/gi },
  { label: 'en_that_sounds', re: /\bThat sounds\b/gi },
  { label: 'en_real_place', re: /That'?s a real place\b/gi },
  { label: 'en_curious_wondering', re: /\bI'?m (curious|wondering)\b/gi },
  { label: 'en_stay_with_that', re: /\bLet'?s stay with (that|this)\b/gi },
  // NOTE: JS \b is ASCII-only and does NOT bound Cyrillic — RU patterns use
  // explicit non-letter delimiters (?<![а-яёa-z]) / (?![а-яёa-z]) instead.
  { label: 'ru_slyshu', re: /(?<![а-яёa-z])(я слышу|слышу тебя)(?![а-яёa-z])/giu },
  { label: 'ru_eto_normalno', re: /(?<![а-яёa-z])это нормально(?![а-яёa-z])/giu },
  { label: 'ru_imeet_smysl', re: /(?<![а-яёa-z])имеет смысл(?![а-яёa-z])/giu },
  { label: 'ru_pohozhe_chto', re: /(?<![а-яёa-z])похоже,? что(?![а-яёa-z])/giu },
  { label: 'ru_pobud_s_etim', re: /(?<![а-яёa-z])побудь с (этим|ним|ней)(?![а-яёa-z])/giu },
  { label: 'ru_eto_vazhno', re: /(?<![а-яёa-z])это важно(?![а-яёa-z])/giu },
];

const BODY_QUESTION = /((где|что).{0,40}(в теле|в твоём теле|телесно)|в теле\s*\?|где ты (это )?чувствуешь|what.{0,30}in your body|where do you feel)/giu;

// Concession opening: the reply OPENS by conceding the user was right / it erred /
// apologising. A mechanical proxy for "the user is leading and the AI is following"
// (the exact defect the owner described). Checked on the reply's first ~60 chars.
const CONCESSION_OPEN = /^(\s*)(ты права|ты прав|прости|извини|да,?\s*(ты права|верно|точно)|хорошо,?\s*ты права|я смешал|моя ошибка|виновата|you'?re right|my mistake|sorry|you'?re correct)/iu;

const tokenize = (s: string): string[] =>
  (s.toLowerCase().match(/[a-zа-яё]{2,}/giu) ?? []).map((w) => w.normalize('NFC'));

function ngrams(tokens: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) out.add(tokens.slice(i, i + n).join(' '));
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let hit = 0;
  for (const x of a) if (b.has(x)) hit++;
  return hit / a.size;
}

function questions(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n/)
    .map((s) => s.trim())
    .filter((s) => s.endsWith('?') && tokenize(s).length >= 3);
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const uni = new Set([...a, ...b]).size;
  return uni === 0 ? 0 : inter / uni;
}

export type TurnMetrics = {
  n: number;
  echoScore: number;            // 4-gram overlap of reply vs this turn's user message
  opensByRestating: boolean;    // reply's first 12 tokens ≥50% drawn from user msg tokens
  concessionOpening: boolean;   // reply opens by conceding/apologising (follows, not leads)
  stockPhrases: { label: string; count: number }[];
  stockPhraseTotal: number;
  bodyQuestions: number;
  repeatedQuestions: number;    // questions ≥0.6 jaccard vs any earlier AI question
  anchorInvocations: number;    // anchor-formula fragments in reply (when anchor set)
  practiceRun: boolean;
  reportRequiredComplete: boolean; // intensity+safety+action+channel+clinicalRead+moves
  fellBackToDefault: boolean;
  replyChars: number;
};

export type FixtureMetrics = {
  fixtureId: string;
  runName: string;
  turns: TurnMetrics[];
  totals: {
    meanEcho: number;
    restatingOpenings: number;
    concessionOpenings: number;
    stockPhraseTotal: number;
    stockByLabel: Record<string, number>;
    bodyQuestionTotal: number;
    repeatedQuestionTotal: number;
    anchorInvocationTotal: number;
    practiceTurns: number;
    prematurePractices: number; // practices in turns 1-3 with no confirmed formulation
    reportCompleteRate: number;
    defaultFallbackRate: number;
    meanReplyChars: number;
  };
};

export function computeMetrics(fixture: Fixture, results: TurnResult[], runName: string): FixtureMetrics {
  const priorQuestions: string[][] = [];
  const anchorFrags = ['рука на груди', 'твоя комната', 'моя комната', 'моё пространство'];
  const turns: TurnMetrics[] = results.map((r) => {
    const ft = fixture.turns[r.n - 1];
    const userTok = tokenize(ft.user);
    const replyTok = tokenize(r.visibleReply);
    const echo = overlap(ngrams(userTok, 4), ngrams(replyTok, 4));
    const head = replyTok.slice(0, 12);
    const userSet = new Set(userTok);
    const restating = head.length >= 6 && head.filter((t) => userSet.has(t)).length / head.length >= 0.5;
    const stock = STOCK_PATTERNS.map((p) => ({ label: p.label, count: (r.visibleReply.match(p.re) ?? []).length })).filter((s) => s.count > 0);
    const qs = questions(r.visibleReply).map(tokenize);
    let repeated = 0;
    for (const q of qs) for (const prev of priorQuestions) { if (jaccard(q, prev) >= 0.6) { repeated++; break; } }
    priorQuestions.push(...qs);
    const anchorSet = !!ft.state.anchorText;
    const low = r.visibleReply.toLowerCase();
    const anchorInv = anchorSet ? anchorFrags.reduce((acc, f) => acc + (low.split(f).length - 1), 0) : 0;
    const rep = r.parsedReport as Record<string, unknown> | null;
    const required = !!rep && ['intensity', 'safetyFlag', 'recommendedAction'].every((k) => rep[k] != null)
      && rep['channel'] != null && rep['clinicalRead'] != null && Array.isArray(rep['moveJustPerformed']);
    return {
      n: r.n,
      echoScore: Math.round(echo * 1000) / 1000,
      opensByRestating: restating,
      concessionOpening: CONCESSION_OPEN.test(r.visibleReply.trim()),
      stockPhrases: stock,
      stockPhraseTotal: stock.reduce((a, s) => a + s.count, 0),
      bodyQuestions: (r.visibleReply.match(BODY_QUESTION) ?? []).length,
      repeatedQuestions: repeated,
      anchorInvocations: anchorInv,
      practiceRun: !!(rep && rep['practiceRun']),
      reportRequiredComplete: required,
      fellBackToDefault: r.parseFellBackToDefault,
      replyChars: r.visibleReply.length,
    };
  });

  const stockByLabel: Record<string, number> = {};
  for (const t of turns) for (const s of t.stockPhrases) stockByLabel[s.label] = (stockByLabel[s.label] ?? 0) + s.count;
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    fixtureId: fixture.id,
    runName,
    turns,
    totals: {
      meanEcho: Math.round(mean(turns.map((t) => t.echoScore)) * 1000) / 1000,
      restatingOpenings: turns.filter((t) => t.opensByRestating).length,
      concessionOpenings: turns.filter((t) => t.concessionOpening).length,
      stockPhraseTotal: turns.reduce((a, t) => a + t.stockPhraseTotal, 0),
      stockByLabel,
      bodyQuestionTotal: turns.reduce((a, t) => a + t.bodyQuestions, 0),
      repeatedQuestionTotal: turns.reduce((a, t) => a + t.repeatedQuestions, 0),
      anchorInvocationTotal: turns.reduce((a, t) => a + t.anchorInvocations, 0),
      practiceTurns: turns.filter((t) => t.practiceRun).length,
      prematurePractices: turns.filter((t) => t.practiceRun && t.n <= 3).length,
      reportCompleteRate: Math.round((turns.filter((t) => t.reportRequiredComplete).length / turns.length) * 1000) / 1000,
      defaultFallbackRate: Math.round((turns.filter((t) => t.fellBackToDefault).length / turns.length) * 1000) / 1000,
      meanReplyChars: Math.round(mean(turns.map((t) => t.replyChars))),
    },
  };
}
