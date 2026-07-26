# MEMORY-DRIFT EXPERIMENT — RUNBOOK

**Purpose:** separate the three competing explanations for the Journey's
degradation — (1) accumulated memory content, (2) server-side model drift,
(3) tester-state/conversation content — none of which the repository can
distinguish (Forensic Health Report §6, Q1–Q3).

**Design status:** everything is prepared; the ONLY missing input is an
`ANTHROPIC_API_KEY` in the environment that runs the commands.

**Branch:** `claude/session-handoff-tester-audit-iqukf3` (the harness and both
fixtures live here; do NOT merge anything to run this).

---

## 1. The three arms

| Arm | Fixture | Mode | What it isolates |
|---|---|---|---|
| A (done) | `julia-2026-07-21` | recorded | The good session's true baseline. Already run: `practice 13/25, body-q 4, anchor 5, echo 0.011, stock 3` |
| B | `julia-2026-07-21` | live ×3 reps | Same turns, same original state, **today's model**. B vs A = model drift + sampling variance |
| C | `julia-2026-07-21-driftstate` | live ×3 reps | Same turns, same model, **memory content replaced with the tester's accumulated 26-07 state** (continuityNote, 5 drifted patterns, девочка part, drifted taskContract — all other state per-turn identical). C vs B = **pure memory-content effect** |

The tester-state explanation (3) is addressed by the design itself: user turns
are identical in every arm, so anything that differs between arms cannot be
caused by what the user said.

## 2. Commands

From `mindreset-app/` on the audit branch, with the key exported:

```bash
# 0. Smoke test first — 3 turns, one arm, ~1 minute, pennies:
npx tsx eval/journey/run.ts --fixture=julia-2026-07-21 --variant=baseline --maxTurns=3

# 1. Arm B — model-drift arm:
npx tsx eval/journey/run.ts --fixture=julia-2026-07-21 --variant=baseline --reps=3

# 2. Arm C — memory-drift arm:
npx tsx eval/journey/run.ts --fixture=julia-2026-07-21-driftstate --variant=baseline --reps=3
```

Outputs land in `eval/journey/runs/<timestamp>/` as JSON + Markdown per rep.
Auth: `export ANTHROPIC_API_KEY=sk-ant-…` (or `ANTHROPIC_AUTH_TOKEN` for a
managed token). The key is read from env only; never written to disk or logs.

**Cost estimate:** ~150 calls total (25 turns × 3 reps × 2 arms), each ~84k
input tokens with ~74k cache-read after the first turn, ~700 output tokens.
Rough order: **$10–25 total.** The smoke test first confirms auth and spend
shape before committing to the full runs.

## 3. How to read the result

Compare the nine mechanical metrics (practice turns, body-q, anchor
invocations, stock phrases, repeated questions, echo, concession openings,
premature practices, report completeness) across arms:

| Observation | Conclusion |
|---|---|
| B ≈ A, C degrades (practice rate drops, body-q → 0, breath-only) | **Memory content is the cause.** The drifted dossier alone reproduces the degradation. |
| B already degrades vs A | **Model drift is a cause** (possibly alongside memory). |
| B ≈ A and C ≈ A | Neither memory nor model — the degradation lives in the *new* conversations' content/tester state, not in the system. |
| B degrades AND C degrades further | Both effects are real; the deltas quantify each share. |

Variance guard: 3 reps per arm; treat a metric shift as real only if it clears
the spread across reps.

## 4. Two ways to provision the key (owner's choice)

**Option 1 — recommended: add it to the Claude Code cloud environment, the
agent runs everything.**
1. On claude.ai → Code → your environment settings → **Environment variables**.
2. Add `ANTHROPIC_API_KEY` = your key (mark sensitive). You already hold this
   key — it is the same one stored in Vercel env as `ANTHROPIC_API_KEY`.
3. Start a **new** session (env vars apply at container start) and say:
   *"run the experiment runbook"*. The session reads this file and executes
   §2, then reports the §3 comparison. Total hands-on time: ~2 minutes.

**Option 2 — run locally on your machine.**
```bash
git clone https://github.com/Juli2admin/mindreset && cd mindreset
git checkout claude/session-handoff-tester-audit-iqukf3
cd mindreset-app && npm install
set ANTHROPIC_API_KEY=sk-ant-...        # Windows cmd; PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-..."
npx tsx eval/journey/run.ts --fixture=julia-2026-07-21 --variant=baseline --maxTurns=3
```
Then the full §2 commands; send back the `eval/journey/runs/` folder (or push
the branch) for analysis.

## 5. Guard-rails

- Read-only with respect to production: the harness never touches the
  database or the API route; it calls the Anthropic API directly with the
  production-assembled prompt.
- Nothing merges to `main` for this; the prompt on `main` stays frozen
  byte-identical to `c26fb80` per the forensic report's §5.4 constraints.
- The drift fixture encodes the tester's accumulated state **as evidence
  snapshot**; it must not be edited once runs begin, or arms stop being
  comparable.
