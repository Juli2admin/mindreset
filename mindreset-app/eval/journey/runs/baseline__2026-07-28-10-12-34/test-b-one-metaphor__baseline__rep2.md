# Run: test-b-one-metaphor · baseline · rep 2

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:12:34.608Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0.05 |
| restating openings | 0 / 3 |
| concession openings (follows-not-leads) | 0 / 3 |
| stock-phrase total | 0 |
| body-question total | 0 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 0 (premature 0) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 258 |

## Live telemetry
- first-visible latency: median 2179ms · p95 2541ms
- total turn latency: median 11707ms · p95 13609ms
- thinking tokens (est): 0 · output tokens: 1302 · cache-read tokens: 244686
- max_tokens truncations: 0 / 3
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.15 |  |  |  |  |  |  | Y | 259 |
| 2 | 0 |  |  |  |  |  |  | Y | 221 |
| 3 | 0 |  |  |  |  |  |  | Y | 294 |
