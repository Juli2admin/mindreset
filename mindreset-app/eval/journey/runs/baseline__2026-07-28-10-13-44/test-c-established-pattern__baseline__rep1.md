# Run: test-c-established-pattern · baseline · rep 1

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:13:44.851Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0.076 |
| restating openings | 0 / 4 |
| concession openings (follows-not-leads) | 0 / 4 |
| stock-phrase total | 0 |
| body-question total | 0 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 0 (premature 0) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 512 |

## Live telemetry
- first-visible latency: median 2888ms · p95 13440ms
- total turn latency: median 20551ms · p95 26006ms
- thinking tokens (est): 0 · output tokens: 2605 · cache-read tokens: 326248
- max_tokens truncations: 0 / 4
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 |  |  |  |  |  |  | Y | 459 |
| 2 | 0 |  |  |  |  |  |  | Y | 272 |
| 3 | 0.083 |  |  |  |  |  |  | Y | 497 |
| 4 | 0.222 |  |  |  |  |  |  | Y | 818 |
