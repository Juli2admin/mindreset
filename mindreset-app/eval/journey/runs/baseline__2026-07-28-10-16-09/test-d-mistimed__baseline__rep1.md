# Run: test-d-mistimed · baseline · rep 1

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:16:09.547Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0 |
| restating openings | 1 / 3 |
| concession openings (follows-not-leads) | 0 / 3 |
| stock-phrase total | 1 |
| body-question total | 0 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 2 (premature 2) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 144 |

### Stock phrases by label
- en_i_hear: 1

## Live telemetry
- first-visible latency: median 2165ms · p95 2411ms
- total turn latency: median 10694ms · p95 11728ms
- thinking tokens (est): 0 · output tokens: 1218 · cache-read tokens: 244686
- max_tokens truncations: 0 / 3
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 |  |  |  |  |  | Y | Y | 252 |
| 2 | 0 |  | 1 |  |  |  | Y | Y | 143 |
| 3 | 0 | Y |  |  |  |  |  | Y | 38 |
