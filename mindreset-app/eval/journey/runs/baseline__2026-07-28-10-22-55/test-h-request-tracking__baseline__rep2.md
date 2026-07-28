# Run: test-h-request-tracking · baseline · rep 2

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:22:55.350Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0 |
| restating openings | 3 / 5 |
| concession openings (follows-not-leads) | 0 / 5 |
| stock-phrase total | 0 |
| body-question total | 0 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 0 (premature 0) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 221 |

## Live telemetry
- first-visible latency: median 2064ms · p95 2999ms
- total turn latency: median 12167ms · p95 16499ms
- thinking tokens (est): 0 · output tokens: 2054 · cache-read tokens: 407810
- max_tokens truncations: 0 / 5
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 |  |  |  |  |  |  | Y | 145 |
| 2 | 0 | Y |  |  |  |  |  | Y | 234 |
| 3 | 0 | Y |  |  |  |  |  | Y | 270 |
| 4 | 0 | Y |  |  |  |  |  | Y | 246 |
| 5 | 0 |  |  |  |  |  |  | Y | 210 |
