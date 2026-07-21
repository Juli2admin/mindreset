// Per-run JSON + a compact markdown summary. Variant-vs-baseline diffing is
// done by comparing two runs' `totals` blocks (report-compare.ts / by hand).

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { FixtureMetrics } from './metrics';
import type { RunMeta, TurnResult } from './types';

export function writeRun(
  outDir: string,
  meta: RunMeta,
  results: TurnResult[],
  metrics: FixtureMetrics,
): string {
  mkdirSync(outDir, { recursive: true });
  const base = `${meta.fixtureId}__${meta.variant.name}__rep${meta.rep}`;
  const jsonPath = join(outDir, `${base}.json`);
  writeFileSync(jsonPath, JSON.stringify({ meta, metrics, results }, null, 1));
  writeFileSync(join(outDir, `${base}.md`), renderMd(meta, metrics, results));
  return jsonPath;
}

function renderMd(meta: RunMeta, m: FixtureMetrics, results: TurnResult[]): string {
  const t = m.totals;
  const L: string[] = [];
  L.push(`# Run: ${meta.fixtureId} · ${meta.variant.name} · rep ${meta.rep}`);
  L.push('');
  L.push(`- mode: **${meta.mode}** · model: ${meta.model} · git ${meta.gitSha} · ${meta.startedAtIso}`);
  L.push(`- thinking: ${meta.variant.thinking ? JSON.stringify(meta.variant.thinking) : 'none'}${meta.variant.effort ? ` · effort ${meta.variant.effort}` : ''} · max_tokens ${meta.variant.maxTokens ?? 2500}`);
  L.push('');
  L.push('## Aggregate metrics');
  L.push('| metric | value |');
  L.push('|---|---|');
  L.push(`| mean echo (4-gram overlap) | ${t.meanEcho} |`);
  L.push(`| restating openings | ${t.restatingOpenings} / ${m.turns.length} |`);
  L.push(`| concession openings (follows-not-leads) | ${t.concessionOpenings} / ${m.turns.length} |`);
  L.push(`| stock-phrase total | ${t.stockPhraseTotal} |`);
  L.push(`| body-question total | ${t.bodyQuestionTotal} |`);
  L.push(`| repeated questions | ${t.repeatedQuestionTotal} |`);
  L.push(`| anchor-formula invocations | ${t.anchorInvocationTotal} |`);
  L.push(`| practice turns | ${t.practiceTurns} (premature ${t.prematurePractices}) |`);
  L.push(`| report-complete rate | ${t.reportCompleteRate} |`);
  L.push(`| parse-default fallback rate | ${t.defaultFallbackRate} |`);
  L.push(`| mean reply chars | ${t.meanReplyChars} |`);
  const stock = Object.entries(t.stockByLabel).sort((a, b) => b[1] - a[1]);
  if (stock.length) { L.push(''); L.push('### Stock phrases by label'); for (const [k, v] of stock) L.push(`- ${k}: ${v}`); }
  if (meta.mode === 'live') {
    const tt = results.map((r) => r.timings?.totalMs ?? 0).sort((a, b) => a - b);
    const fv = results.map((r) => r.timings?.firstVisibleMs ?? 0).sort((a, b) => a - b);
    const med = (xs: number[]) => xs[Math.floor(xs.length / 2)] ?? 0;
    const p95 = (xs: number[]) => xs[Math.floor(xs.length * 0.95)] ?? 0;
    const thinkTok = results.reduce((a, r) => a + Math.round(r.thinkingChars / 3.7), 0);
    const outTok = results.reduce((a, r) => a + (r.usage?.outputTokens ?? 0), 0);
    const cacheRead = results.reduce((a, r) => a + (r.usage?.cacheReadTokens ?? 0), 0);
    const maxStops = results.filter((r) => r.stopReason === 'max_tokens').length;
    L.push('');
    L.push('## Live telemetry');
    L.push(`- first-visible latency: median ${med(fv)}ms · p95 ${p95(fv)}ms`);
    L.push(`- total turn latency: median ${med(tt)}ms · p95 ${p95(tt)}ms`);
    L.push(`- thinking tokens (est): ${thinkTok} · output tokens: ${outTok} · cache-read tokens: ${cacheRead}`);
    L.push(`- max_tokens truncations: ${maxStops} / ${results.length}`);
    L.push(`- **V4 cache check** (blocks 1-2 stable across turns): b1=${new Set(results.map((r) => r.blockSha.b1)).size === 1 ? 'STABLE' : 'CHANGED'} b2=${new Set(results.map((r) => r.blockSha.b2)).size === 1 ? 'STABLE' : 'CHANGED'}`);
  }
  L.push('');
  L.push('## Per-turn');
  L.push('| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const tm of m.turns) {
    L.push(`| ${tm.n} | ${tm.echoScore} | ${tm.opensByRestating ? 'Y' : ''} | ${tm.stockPhraseTotal || ''} | ${tm.bodyQuestions || ''} | ${tm.repeatedQuestions || ''} | ${tm.anchorInvocations || ''} | ${tm.practiceRun ? 'Y' : ''} | ${tm.reportRequiredComplete ? 'Y' : 'FALLBACK'} | ${tm.replyChars} |`);
  }
  return L.join('\n') + '\n';
}
