// CLI entry for the Journey golden harness.
//
//   npx tsx eval/journey/run.ts --fixture=julia-2026-07-21 --variant=recorded
//   npx tsx eval/journey/run.ts --fixture=julia-2026-07-21 --variant=baseline --reps=3   (live; needs ANTHROPIC_API_KEY)
//   npx tsx eval/journey/run.ts --fixture=julia-2026-07-21 --variant=think-budget-1024 --reps=3
//
// Read-only against production runtime. Never writes to the DB or calls the route.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { Fixture, Variant } from './lib/types';
import { runRecorded, runLive } from './lib/runner';
import { computeMetrics } from './lib/metrics';
import { writeRun } from './lib/report';

const HERE = __dirname;
const FIXTURES = join(HERE, 'fixtures');
const RUNS = join(HERE, 'runs');

const VARIANTS: Record<string, Variant> = {
  // recorded: no API — scores the captured production replies (true baseline).
  recorded: { name: 'recorded', thinking: null, effort: null, maxTokens: null, model: null },
  // live arms (require ANTHROPIC_API_KEY):
  baseline: { name: 'baseline', thinking: null, effort: null, maxTokens: null, model: null },
  'think-budget-1024': { name: 'think-budget-1024', thinking: { type: 'enabled', budget_tokens: 1024 }, effort: null, maxTokens: 3524, model: null },
  'think-budget-2048': { name: 'think-budget-2048', thinking: { type: 'enabled', budget_tokens: 2048 }, effort: null, maxTokens: 4548, model: null },
  'think-adaptive-low': { name: 'think-adaptive-low', thinking: { type: 'adaptive' }, effort: 'low', maxTokens: 4096, model: null },
};

function arg(name: string, def?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
}

async function main() {
  const fixtureId = arg('fixture', 'julia-2026-07-21')!;
  const variantName = arg('variant', 'recorded')!;
  const reps = Number(arg('reps', '1'));
  // --maxTurns=N trims the fixture to its first N turns. Used for the short
  // smoke test that validates the live path before the full-session run.
  const maxTurnsArg = arg('maxTurns');
  const maxTurns = maxTurnsArg ? Number(maxTurnsArg) : null;
  const variant = VARIANTS[variantName];
  if (!variant) { console.error(`unknown variant "${variantName}". Known: ${Object.keys(VARIANTS).join(', ')}`); process.exit(2); }

  const fpath = join(FIXTURES, `${fixtureId}.json`);
  if (!existsSync(fpath)) { console.error(`fixture not found: ${fpath}`); process.exit(2); }
  const fixtureRaw: Fixture = JSON.parse(readFileSync(fpath, 'utf8'));
  const fixture: Fixture =
    maxTurns && maxTurns > 0
      ? { ...fixtureRaw, turns: fixtureRaw.turns.slice(0, maxTurns) }
      : fixtureRaw;

  let gitSha = 'unknown';
  try { gitSha = execSync('git rev-parse --short HEAD', { cwd: HERE }).toString().trim(); } catch { /* ignore */ }
  const startedAtIso = new Date().toISOString();
  const model = variant.model ?? fixture.model;
  const mode: 'recorded' | 'live' = variantName === 'recorded' ? 'recorded' : 'live';
  const outDir = join(RUNS, `${variantName}__${startedAtIso.slice(0, 19).replace(/[:T]/g, '-')}`);

  console.log(`[harness] fixture=${fixtureId} variant=${variantName} mode=${mode} reps=${reps} turns=${fixture.turns.length}${maxTurns ? ` (maxTurns=${maxTurns})` : ''} model=${model} git=${gitSha}`);
  if (mode === 'live' && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error('[harness] live mode needs ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN — neither set. Run `--variant=recorded` for the offline baseline, or export a credential.');
    process.exit(3);
  }

  for (let rep = 1; rep <= reps; rep++) {
    const results = mode === 'recorded' ? runRecorded(fixture) : await runLive(fixture, variant);
    const metrics = computeMetrics(fixture, results, `${variantName}#${rep}`);
    const meta = { runName: `${variantName}#${rep}`, fixtureId, variant, mode, rep, gitSha, startedAtIso, model };
    const p = writeRun(outDir, meta, results, metrics);
    const t = metrics.totals;
    console.log(`[rep ${rep}] echo=${t.meanEcho} stock=${t.stockPhraseTotal} body-q=${t.bodyQuestionTotal} rep-q=${t.repeatedQuestionTotal} anchor=${t.anchorInvocationTotal} practice=${t.practiceTurns}(prem ${t.prematurePractices}) reportOK=${t.reportCompleteRate} → ${p}`);
  }
  console.log(`[harness] done → ${outDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
