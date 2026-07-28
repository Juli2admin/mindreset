# Run: test-d-mistimed · baseline · rep 2

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:16:09.547Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0 |
| restating openings | 0 / 3 |
| concession openings (follows-not-leads) | 0 / 3 |
| stock-phrase total | 0 |
| body-question total | 0 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 1 (premature 1) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 194 |

## Live telemetry
- first-visible latency: median 2391ms · p95 2828ms
- total turn latency: median 11982ms · p95 11986ms
- thinking tokens (est): 0 · output tokens: 1159 · cache-read tokens: 244686
- max_tokens truncations: 0 / 3
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 |  |  |  |  |  | Y | Y | 247 |
| 2 | 0 |  |  |  |  |  |  | Y | 251 |
| 3 | 0 |  |  |  |  |  |  | Y | 85 |
