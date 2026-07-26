# Journey Regression Timeline & Reversal Point — 2026-07-26 (wider audit, part 2)

> **Trigger:** owner decision — *"it was working before we started cleaning.
> Find a point to reverse it."*
>
> Companion to `audit-2026-07-26-journey-health-audit.md` (same day). This
> document extends that audit with full git forensics, corrects one of its
> claims, identifies the reversal point, and records the prepared restore
> branch. Read-only apart from the separately-pushed restore branch.

---

## 1. The reversal point

**`c26fb80` — PR #339, merged 2026-07-20 20:30 UTC.**

Why this commit and not another:

1. It is the last state of `main` before the canon-cleanup series began
   (#340 merged 2026-07-22 06:37).
2. **The golden fixture `julia-2026-07-21.json` was recorded on 2026-07-21 —
   from a real session running exactly this runtime.** The known-good baseline
   the eval harness pins is, by construction, `main@#339`. "It was working" has
   a commit hash.
3. The degraded 25-turn session (2026-07-24 → 07-26, documented in part 1)
   ran entirely on post-cleaning runtimes.

The degradation window is therefore exactly: **#340–#347 (2026-07-22) +
#354 (2026-07-25)** — the cleaning, and only the cleaning. Everything merged
before #340 was already in the runtime the golden fixture certified as good.

## 2. What sits inside the degradation window

| PR | Merged | Surface | What it removed/changed |
|---|---|---|---|
| #340 A0 | 07-22 06:37 | code | dead loaders/fallback (behaviour-preserving; tests) |
| #341 B1a | 07-22 11:02 | `01-stage-stabilisation.md` | anchor naming/capture claims |
| #342 B1b | 07-22 11:36 | `02-stage-pain.md` | automatic anchor recall/soothe/closure |
| #343 B1b | 07-22 12:07 | `03-stage-adult-self.md` | same, Stage 3 |
| #344 B2a | 07-22 20:44 | `runtime/journey-master.md` | three "stock wrapper" worked-example passages |
| #345 B1b | 07-22 21:15 | `04-stage-parts.md` | same, Stage 4 |
| #346 | 07-22 21:35 | `04-stage-parts.md` | de-anchored three worked examples |
| #347 B1b | 07-22 22:05 | `05-stage-foreign-material.md` | same, Stage 5 |
| #354 Unit1 | 07-25 15:20 | `00-shared-core.md` | §6 anchor rewrite + §3 token |

All are prompt-content changes. None had a behavioural before/after (the
harness was never merged or run). Cumulatively they removed the AI's
*containment repertoire* — the recall/soothe/closure passages and the
worked examples it patterns its replies on — which matches the degraded
session's measured profile: 1 practice in 25 turns, near-zero soothing,
imagery pushed instead of settling moves, sustained intensity 5–8.

Not in the window (kept by the restore): P1–P3 (#325–327), emission
reminder (#328), comms register (#329), M1 (#322) — all were already live
in the good 07-21 baseline. Cap/telemetry/UX (#348–351) — ops, unrelated
surface.

## 3. Correction to part 1, and the deeper seal history

Part 1 called the Stage-2 gate "mathematically impossible." Two refinements
after full forensics:

**(a) The seal predates the cleaning and exists at #339 too.** The full
history of the `soft_why` token:

- **#178 (06-28):** Stage-2 gate aligned with canon §10 — began requiring a
  `soft_why`-shaped `readinessTouched` token.
- **#195 (07-01):** *"unblock Stage 2 — give the AI the soft_why /
  emotion_located tokens."* Added `"soft_why"` + `"emotion_located"` to the
  master-prompt vocabulary, taught the emission, **and added
  `stage2-vocab-contract.test.ts`** — a contract test guarding exactly this.
- **#197 (07-01, hours later):** emergency *"restore trusted baseline"*
  (fixing the reasoning-leak incident) reverted the master prompt wholesale.
  **The Stage-2 unblock was collateral damage — and the revert also deleted
  the contract test, so the guard died with the fix.** Never re-applied.

So Stage 2 has been sealed on the gate lane since 2026-07-01, including in
the "good" baseline. It is a real, separate defect — but it is **not** the
degradation the owner reported, because the good sessions happened while it
was sealed too.

**(b) There is a second advance lane** (`move-based-advance.ts`, PR 4b
07-07): advances without the gate when ≥3 recent turns each show
higher-stage moves at intensity ≤5 **with `adultSelfPresent` in ≥50% of the
window**. For a Stage-2 user with no Adult Self work, this is unreachable by
design. Practical conclusion unchanged — Stage 2 has no realistic exit — but
"sealed gate lane + unreachable move lane" is the accurate statement.

Interpretation that reconciles everything: **the stage label being stuck did
not by itself degrade the felt experience** — the Gen-C master prompt lets
the AI work recursively across the whole map regardless of label, and on
07-21 it did (the good session did deep pattern/foreign-material work while
labelled Stage 2). What broke the *feel* was the cleaning removing the
soothing/containment/exemplar text. The seal is a chronic condition; the
cleaning was the acute injury.

## 4. The prepared reversal

Branch **`claude/journey-restore-pre-cleaning`** (pushed, no PR opened):

- Restores the 7 loaded prompt files **byte-identical** to `c26fb80`
  (residual diff: 0 lines): `00-shared-core.md`, `01`–`05` stage specs,
  `runtime/journey-master.md`.
- Touches zero code. Keeps A0, P1–P3, #328/#329, M1, #348–351, all platform
  work. Dead Gen-B files (`runtime/stage-01/02.md`) stay deleted — they are
  not loaded, restoring them would change nothing.
- Full suite on the branch: **863/863 green** — no test pins the cleaned
  wording, so the revert is mechanically safe.
- Diff vs `main`: 7 files, +83/−116.

Effect on open work: reverting `00-shared-core.md` un-does Unit 1 (#354).
The Personal-Anchor architectural direction (Architectural Update, merged
canon decisions) remains the owner's stated intent — but per this audit it
must be re-applied only behind a behavioural before/after (harness), after
the baseline feel is recovered. Unit 2 stays parked. PR #353 (the
architectural-update doc itself) is unaffected — it is a reference document,
not prompt content.

## 5. What the restore does NOT fix (known chronic defects at #339)

1. **Stage-2 seal** — gate lane needs a token the prompt never authorises
   (since #197). Fix is small and known: re-apply #195's vocabulary lines +
   resurrect `stage2-vocab-contract.test.ts`; generalise to a per-gate
   contract test (every gate passable using only prompt-authorised tokens).
2. **Adult-Self depth rule unenforced in code** — the prompt text (lines
   380/392) is identical before and after the cleaning; the 07-26 session
   shows the model can still violate it (stage_4/5 moves at
   `adultSelfPresent: false`). A code-side guard remains warranted.
3. **Golden Harness not on `main`** — merge it, and make a recorded-mode
   parity check + (when a key is available) a live before/after mandatory
   for any prompt/gate change.

Recommended order after the restore merges: (1) verify feel recovers with
the tester; (2) merge harness; (3) Stage-2 token fix with contract tests;
(4) Adult-Self code guard; (5) only then, harness-guarded, resume the
anchor architecture work.

## 6. One-line answer

The Journey's good behaviour has a commit hash — `c26fb80` (#339,
2026-07-20), certified by the 07-21 golden fixture. The cleaning
(#340–#347, #354) is the only thing between it and today's prompt, the
restore branch returns the prompt surface to it byte-identically, and the
separately-discovered Stage-2 seal is older than both the good and the bad
sessions and needs its own small fix.
