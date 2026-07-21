# Journey Golden-Session Harness

Read-only evaluation harness for the Journey runtime. It imports the PRODUCTION
assembly path (`assembleSystemPromptBlocks`), the production streaming processor
(`ingestChunk`/`finaliseStream`) and the production parser (`splitReplyAndReport`/
`parseStateReport`). It never writes to the database and never calls the API route.

## Modes

- **recorded** — no API key needed. Scores the replies and state reports a real
  captured session actually produced. This is the true baseline for that session.
- **live** — assembles the production prompt for each turn, calls the Anthropic
  Messages API with streaming, drives the same production processor + parser, and
  records latency / tokens / cost / hidden-ness / cache behaviour. Requires
  `ANTHROPIC_API_KEY`.

Both modes emit the same result shape, so the 9 mechanical metrics run identically.

## Run

```bash
# Offline baseline on the owner's real 2026-07-21 session (no key):
npx tsx eval/journey/run.ts --fixture=julia-2026-07-21 --variant=recorded

# Live baseline + thinking arms. Provide ONE credential:
export ANTHROPIC_API_KEY=sk-ant-...          # standard API key (x-api-key), OR
export ANTHROPIC_AUTH_TOKEN=...              # Bearer token (managed/OAuth runner)
npx tsx eval/journey/run.ts --fixture=julia-2026-07-21 --variant=baseline            --reps=3
npx tsx eval/journey/run.ts --fixture=julia-2026-07-21 --variant=think-budget-1024   --reps=3
npx tsx eval/journey/run.ts --fixture=julia-2026-07-21 --variant=think-budget-2048   --reps=3
npx tsx eval/journey/run.ts --fixture=julia-2026-07-21 --variant=think-adaptive-low  --reps=3

# Short smoke (first N turns per arm, to validate the live path before a full run):
npx tsx eval/journey/run.ts --fixture=julia-2026-07-21 --variant=think-budget-1024 --maxTurns=3
```

Auth: pass `ANTHROPIC_API_KEY` (sent as `x-api-key`) or `ANTHROPIC_AUTH_TOKEN`
(sent as `Authorization: Bearer` with the oauth beta header, for environments
that only expose a managed/session token). The token is read from the env and
never written to disk or logs.

Each run writes `runs/<variant>__<ts>/<fixture>__<variant>__repN.{json,md}`.
`runs/` is gitignored except the committed `baseline-recorded-2026-07-21/` snapshot.

## Variants

| name | thinking | max_tokens | needs key |
|---|---|---|---|
| recorded | — (scores captured replies) | — | no |
| baseline | none | 2500 (prod) | yes |
| think-budget-1024 | `enabled` budget 1024 (API minimum) | 3524 | yes |
| think-budget-2048 | `enabled` budget 2048 | 4548 | yes |
| think-adaptive-low | `adaptive` + effort low | 4096 | yes |

## Metrics (mechanical, EN+RU)

echo (4-gram overlap) · restating openings · **concession openings** (follows-not-
leads proxy) · stock phrases · body-question frequency · repeated questions ·
anchor-formula invocations · practices (+ premature) · report-complete rate ·
parse-default fallback rate · reply length. Live mode adds latency, tokens/cost,
hidden-ness, and the V4 cache-stability check.

Judged metrics (unsupported-hypothesis, conflation, contract-relevance, who-leads,
reply-quality) use an LLM judge and are added when a key is available — see
`../docs/journey/remediation-plan-2026-07-21/01-golden-harness-spec.md` §6.

## Fixtures

- `julia-2026-07-21.json` — owner's real production session, 25 turns, RU. User turns
  verbatim from the transcript; per-turn state derived deterministically from the
  session's own Inspector state reports (load.ts semantics). Committed.
- Six synthetic scenarios (cognitive/analytical, panic+intervention-worse, body/imagery
  refusal, unfinished parts, rupture, ordinary low-intensity) are DRAFT and pending owner
  sign-off before any run — see the scenarios doc in the remediation-plan folder.

## Boundaries

No DB writes, no route calls, no changes to `docs/journey/**` runtime sources, `lib/`,
`app/`, or `prisma/`. Runs only on explicit invocation.
