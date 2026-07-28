# Run: test-f1-analytic-user · baseline · rep 1

- mode: **live** · model: claude-sonnet-4-6 · git 9dcf7e5 · 2026-07-28T10:19:00.424Z
- thinking: none · max_tokens 2500

## Aggregate metrics
| metric | value |
|---|---|
| mean echo (4-gram overlap) | 0.024 |
| restating openings | 0 / 3 |
| concession openings (follows-not-leads) | 0 / 3 |
| stock-phrase total | 0 |
| body-question total | 0 |
| repeated questions | 0 |
| anchor-formula invocations | 0 |
| practice turns | 0 (premature 0) |
| report-complete rate | 1 |
| parse-default fallback rate | 0 |
| mean reply chars | 1261 |

## Live telemetry
- first-visible latency: median 3232ms · p95 4178ms
- total turn latency: median 17774ms · p95 22040ms
- thinking tokens (est): 0 · output tokens: 1899 · cache-read tokens: 244686
- max_tokens truncations: 0 / 3
- **V4 cache check** (blocks 1-2 stable across turns): b1=STABLE b2=STABLE

## Per-turn
| # | echo | restate | stock | body-q | rep-q | anchor | practice | reportOK | replyChars |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.071 |  |  |  |  |  |  | Y | 445 |
| 2 | 0 |  |  |  |  |  |  | Y | 1335 |
| 3 | 0 |  |  |  |  |  |  | Y | 2003 |
