# Run: test-h-request-tracking · baseline · rep 1

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:22:55.350Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0 |
| restating openings | 0 / 5 |
| concession openings (follows-not-leads) | 0 / 5 |
| stock-phrase total | 0 |
| body-question total | 0 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 0 (premature 0) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 220 |

## Live telemetry
- first-visible latency: median 1983ms · p95 3020ms
- total turn latency: median 12933ms · p95 15138ms
- thinking tokens (est): 0 · output tokens: 2215 · cache-read tokens: 407810
- max_tokens truncations: 0 / 5
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 |  |  |  |  |  |  | Y | 77 |
| 2 | 0 |  |  |  |  |  |  | Y | 158 |
| 3 | 0 |  |  |  |  |  |  | Y | 222 |
| 4 | 0 |  |  |  |  |  |  | Y | 268 |
| 5 | 0 |  |  |  |  |  |  | Y | 374 |
