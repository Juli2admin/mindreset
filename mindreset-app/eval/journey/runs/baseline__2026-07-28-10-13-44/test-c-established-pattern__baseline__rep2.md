# Run: test-c-established-pattern · baseline · rep 2

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:13:44.851Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0 |
| restating openings | 0 / 4 |
| concession openings (follows-not-leads) | 0 / 4 |
| stock-phrase total | 0 |
| body-question total | 0 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 0 (premature 0) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 364 |

## Live telemetry
- first-visible latency: median 2108ms · p95 2185ms
- total turn latency: median 15681ms · p95 16473ms
- thinking tokens (est): 0 · output tokens: 2267 · cache-read tokens: 326248
- max_tokens truncations: 0 / 4
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 |  |  |  |  |  |  | Y | 269 |
| 2 | 0 |  |  |  |  |  |  | Y | 344 |
| 3 | 0 |  |  |  |  |  |  | Y | 281 |
| 4 | 0 |  |  |  |  |  |  | Y | 563 |
