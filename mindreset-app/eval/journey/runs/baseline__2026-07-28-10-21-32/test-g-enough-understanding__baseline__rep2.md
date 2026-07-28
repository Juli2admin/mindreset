# Run: test-g-enough-understanding · baseline · rep 2

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:21:32.848Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0 |
| restating openings | 1 / 3 |
| concession openings (follows-not-leads) | 0 / 3 |
| stock-phrase total | 1 |
| body-question total | 1 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 0 (premature 0) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 283 |

### Stock phrases by label
- en_curious_wondering: 1

## Live telemetry
- first-visible latency: median 2005ms · p95 2265ms
- total turn latency: median 13177ms · p95 16470ms
- thinking tokens (est): 0 · output tokens: 1323 · cache-read tokens: 244686
- max_tokens truncations: 0 / 3
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | Y | 1 |  |  |  |  | Y | 343 |
| 2 | 0 |  |  |  |  |  |  | Y | 195 |
| 3 | 0 |  |  | 1 |  |  |  | Y | 312 |
