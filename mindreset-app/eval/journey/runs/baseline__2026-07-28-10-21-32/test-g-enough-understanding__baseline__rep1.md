# Run: test-g-enough-understanding · baseline · rep 1

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:21:32.848Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0 |
| restating openings | 0 / 3 |
| concession openings (follows-not-leads) | 0 / 3 |
| stock-phrase total | 0 |
| body-question total | 1 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 0 (premature 0) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 285 |

## Live telemetry
- first-visible latency: median 1967ms · p95 2002ms
- total turn latency: median 13566ms · p95 16525ms
- thinking tokens (est): 0 · output tokens: 1570 · cache-read tokens: 244686
- max_tokens truncations: 0 / 3
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 |  |  |  |  |  |  | Y | 330 |
| 2 | 0 |  |  |  |  |  |  | Y | 201 |
| 3 | 0 |  |  | 1 |  |  |  | Y | 323 |
