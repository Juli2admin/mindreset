# Run: test-a-practical · baseline · rep 1

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:11:41.999Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0 |
| restating openings | 0 / 2 |
| concession openings (follows-not-leads) | 0 / 2 |
| stock-phrase total | 0 |
| body-question total | 0 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 0 (premature 0) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 600 |

## Live telemetry
- first-visible latency: median 8258ms · p95 8258ms
- total turn latency: median 17416ms · p95 17416ms
- thinking tokens (est): 0 · output tokens: 742 · cache-read tokens: 163124
- max_tokens truncations: 0 / 2
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 |  |  |  |  |  |  | Y | 295 |
| 2 | 0 |  |  |  |  |  |  | Y | 905 |
