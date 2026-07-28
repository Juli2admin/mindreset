# Run: test-e-correction · baseline · rep 2

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:17:15.995Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0 |
| restating openings | 0 / 4 |
| concession openings (follows-not-leads) | 0 / 4 |
| stock-phrase total | 1 |
| body-question total | 0 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 0 (premature 0) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 329 |

### Stock phrases by label
- en_that_sounds: 1

## Live telemetry
- first-visible latency: median 2688ms · p95 2832ms
- total turn latency: median 14575ms · p95 14886ms
- thinking tokens (est): 0 · output tokens: 1879 · cache-read tokens: 326248
- max_tokens truncations: 0 / 4
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 |  | 1 |  |  |  |  | Y | 311 |
| 2 | 0 |  |  |  |  |  |  | Y | 439 |
| 3 | 0 |  |  |  |  |  |  | Y | 443 |
| 4 | 0 |  |  |  |  |  |  | Y | 122 |
