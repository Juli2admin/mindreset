# Run: test-f2-emotional-user · baseline · rep 1

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:20:31.492Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0.03 |
| restating openings | 1 / 3 |
| concession openings (follows-not-leads) | 0 / 3 |
| stock-phrase total | 0 |
| body-question total | 0 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 0 (premature 0) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 130 |

## Live telemetry
- first-visible latency: median 2495ms · p95 2799ms
- total turn latency: median 8558ms · p95 11037ms
- thinking tokens (est): 0 · output tokens: 904 · cache-read tokens: 244686
- max_tokens truncations: 0 / 3
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.091 |  |  |  |  |  |  | Y | 188 |
| 2 | 0 | Y |  |  |  |  |  | Y | 149 |
| 3 | 0 |  |  |  |  |  |  | Y | 52 |
