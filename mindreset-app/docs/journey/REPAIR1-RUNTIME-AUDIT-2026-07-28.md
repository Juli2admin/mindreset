# Repair 1 — runtime safety audit + targeted live validation

**Branch**: `claude/scale-semantics-closure-guard`
**Date**: 2026-07-28
**Scope**: audit items A1–A4, then targeted live validation (B), evidence (C), verdict (D).
**Not done**: no merge, no deploy, no PR, no production data touched.

---

## A1 — Timestamp trust boundary

### Where the timestamps originated (state BEFORE this audit)

| Question | Answer as the code stood at `930bc29` |
|---|---|
| Where does `stabilityCheck.measuredAt` come from? | The model's own JSON. `lib/journey/stateReport/parse.ts` read `sc.measuredAt` and stored it verbatim if `Date.parse` succeeded. |
| Where does `distressIntensity.measuredAt` come from? | Same — model JSON, accepted verbatim. |
| Is the timestamp model-generated? | **Yes.** |
| Is it accepted directly from model JSON? | **Yes**, with no validation beyond "is it a parseable date". |
| Was it validated against a server turn timestamp? | **No.** Nothing compared it to any server clock. |
| Could a MISSING timestamp satisfy the guard? | **Yes.** `guard.ts` used `sc.measuredAt ? Date.parse(sc.measuredAt) : now.getTime()` — absent meant "now", which always post-dates the destabilisation. |
| Could a FUTURE timestamp satisfy the guard? | **Yes.** Only `measuredAt < destabilisedAt` was rejected; anything later passed. |
| Could a FABRICATED timestamp satisfy the guard? | **Yes** — any plausible-looking ISO string later than the spike passed. |
| Could a COPIED (earlier-turn) timestamp satisfy the guard? | **Partly.** Copied from before the spike → blocked. Copied from any point after the spike → passed. |
| Could a MALFORMED timestamp satisfy the guard? | **Yes, silently** — the parser dropped it, so the guard fell back to `now` and passed. |

**Verdict on the original design**: the model-generated timestamp was the *sole* basis for the ordering
check. That is exactly what the owner's instruction forbids.

### What was changed

1. **Trusted server stamp assigned at parse.** `parseStateReport(raw, { observedAt })` now stamps
   `stabilityCheck.observedAt` and `distressIntensity.observedAt` from the **server clock** at the moment
   the runtime reads the report. The model cannot supply or overwrite it — the parser writes the field
   unconditionally and never reads a model-supplied `observedAt`.
   (`lib/journey/stateReport/parse.ts`)
2. **Ordering uses only the trusted stamp.** `evaluateClosureGate` compares `observedAt` against the
   destabilisation turn's server `createdAt`. If `observedAt` is absent (legacy row, or any path that
   bypassed the trusted parser) the guard blocks with `untrusted_timestamp` rather than assuming "now".
3. **The model claim is retained as untrusted metadata that can only tighten the guard.**
   `measuredAt` is kept for the record and can add — never remove — a block reason:
   - claimed before the destabilisation → `measurement_predates_destabilisation` (copy-forward)
   - claimed more than 2 min in the future → `implausible_timestamp` (fabricated)
   - claimed more than 30 min before this turn's server stamp → `stale_measurement`
4. **Malformed claims are recorded, not swallowed.** A `measuredAt` that will not parse sets
   `measuredAtRejected: true`; the Inspector prints `claimed(model) MALFORMED — ignored`.

### Tests added (`lib/journey/closure/guard.test.ts`, block "A1")

| Case | Expected | Result |
|---|---|---|
| Model tries to supply `observedAt` | parser overwrites it with the server stamp | pass |
| **Missing** model timestamp | closure still decided by the server stamp → may pass | pass |
| **Missing** server stamp | `untrusted_timestamp` → blocked | pass |
| **Future** model claim (> skew) | `implausible_timestamp` → blocked | pass |
| Small clock skew (30 s) | tolerated → passes | pass |
| **Stale** model claim (> 30 min old) | `stale_measurement` → blocked | pass |
| **Copied from earlier turn** (pre-spike) | `measurement_predates_destabilisation` → blocked | pass |
| **Malformed** model claim | flagged, ignored; validity rests on server stamp | pass |
| Server stamp itself predates the spike | blocked even with a helpful-looking model claim | pass |
| `distressIntensity` carries the same trust split | observed stamped, malformed claim flagged | pass |

**No case allows a model-generated timestamp to be the sole basis for validating a closure.**

---

## A2 — Guard failure behaviour

### Every error path, before and after

| Path | Before (`930bc29`) | After |
|---|---|---|
| `loadRecentTurns` throws (DB down, decrypt failure) | caught; log `using model claim`; **model's `cycleCanClose: true` / `cycleStatus: 'closed'` persisted verbatim** | `failSafeClosureGate(..., 'history_unavailable')` → cycle recorded open, reasons `['history_unavailable','closure_unverified']` |
| The gate itself throws | same fail-open catch | `failSafeClosureGate(..., 'guard_error')` → cycle recorded open, reasons `['guard_error','closure_unverified']` |
| History is not an array / undefined | would have thrown inside the guard → fail-open | guard returns `blocked` with `history_unavailable` |
| A prior turn's `createdAt` is malformed | silently ignored; ordering check quietly skipped | `closure_unverified` → blocked |
| `finaliseTurn` rejects for any other reason | unhandled promise rejection inside `waitUntil` | `.catch` logs it |

Fail-safe recording is `cycleCanClose: false`, `cycleStatus: 'closed' → 'open'`, and a `closureGate`
block carrying the reason. Nothing else in the report is modified.

### What is *not* affected

The guard runs inside `finaliseTurn`, which is invoked from `waitUntil(...)` **after** the reply has
finished streaming to the user (`app/api/journey/turn/route.ts`). It therefore cannot:

- delay or block the user's reply,
- prevent the user from leaving or ending the session,
- prevent the API turn from returning (the `NextResponse` is already returned before `finaliseTurn` runs).

It governs the **record only**, exactly as required.

### Tests added (block "A2")

| Case | Expected | Result |
|---|---|---|
| History load failure | blocked, `history_unavailable` + `closure_unverified`, cycle open | pass |
| Guard exception | blocked, `guard_error` + `closure_unverified`, cycle open | pass |
| Fail-safe never mutates the input report | input untouched | pass |
| Malformed history object (not an array) | blocked, not passed | pass |
| Malformed prior-turn timestamp | blocked, `closure_unverified` | pass |
| Turn that claims no closure | `not_applicable` — untouched by any of this | pass |

---

## A3 — Missing `presentingRequestStatus`

### Exact behaviour of the guard for each value

| Value | Parser | Guard effect |
|---|---|---|
| **absent** | field omitted | none — outcome decided purely by the stability evidence |
| `addressed` | stored | **none** — identical outcome to absent; cannot rescue a failing closure |
| `parked` | stored | **none** — identical outcome to absent |
| `unresolved` | stored | adds `presenting_request_unresolved` → blocks a *resolved* closure record |
| invalid (`"done"`, `42`, `true`, `null`, `{...}`) | **dropped** | none — never coerced to any status |

### Decision: **Option B**

> *State clearly that presenting-request completion is outside the scope of Repair 1, remove it from the
> protection claims, and ensure the field cannot give false confidence.*

**Justification.**

1. `presentingRequestStatus` is an **unverified model self-report**. There is no code-level evidence for
   "addressed" — no comparison against `taskContract.completionCriterion`, no user confirmation, nothing
   the runtime can check. Option A (treat missing as `unknown` and block on it) would convert an
   unverifiable claim into a gate, which is the same class of error Repair 1 exists to remove: it would
   make the *absence* of a model emission decisive, and the model's presence-or-absence of optional
   fields is exactly what Phase-2 validation showed to be unreliable.
2. Option A would also break proportionality. A mild session that destabilised once and recovered would
   be held open indefinitely because the model happened not to emit an optional field — a large
   behavioural change to closure, which the owner explicitly ruled out of this task ("do not broadly
   rewrite the clinical prompt").
3. Under Option B the field is **advisory-only and monotone**: it can only ever make the guard stricter.
   That is safe in both directions — it cannot manufacture confidence, and it cannot block a legitimate
   closure that the stability evidence supports.

**Therefore W4 (presenting-request completion at closure) is NOT claimed as solved by Repair 1.**
The runtime can distinguish `unresolved` from everything else, but it cannot reliably distinguish
`addressed` from `parked` from "the model didn't say". That distinction requires a behavioural repair —
recorded below as the next closure-behaviour task.

Visible consequence: the Inspector now renders the row on every closure turn as
`<value|not emitted> (advisory — model claim, not verified)` so it can never be read as evidence.

### Tests added (block "A3")

All five cases (absent / addressed / parked / unresolved / invalid) are asserted, including the
"cannot rescue a below-threshold closure" case.

---

## A4 — Real build verification

### Commands run and exit codes

| # | Command | Exit | Notes |
|---|---|---|---|
| 1 | `npm run test` (`vitest run`) | **0** | 57 files, **936 tests passed** (915 before this repair; +21 new). |
| 2 | `npm run build` (= `prebuild`: `npm run i18n:check && npm run test`, then `prisma generate && next build`) — **first attempt** | **1** | `✓ Compiled successfully`, then `Failed to compile` in the type-check phase. |
| 3 | `npm run build` — **after the tsconfig fix below** | **0** | Full production build, 250 static pages generated. |

### The first build failure, in full

```
./eval/journey/lib/metrics.ts:14:80
Type error: This regular expression flag is only available when targeting 'es6' or later.
> 14 |   { label: 'ru_slyshu', re: /(?<![а-яёa-z])(я слышу|слышу тебя)(?![а-яёa-z])/giu },
Next.js build worker exited with code: 1
```

**This is not dismissed as "just the eval harness."** Findings:

- The failure is in `eval/journey/lib/metrics.ts` — the Golden Harness, not application code.
- It is a **pre-existing** condition, not caused by Repair 1: the RU lookbehind regexes were written
  when the harness was built and are untouched by this branch.
- **Is the harness in CI?** There is **no CI**. `.github/workflows/` does not exist in this repository.
  The only automated gate is `prebuild` (`i18n:check` + `vitest`), which runs on Vercel before `next build`.
- **Is the harness in the deployment?** **No.** On `main` and on this branch the `eval/` tree is
  untracked (`git ls-files mindreset-app/eval` → 0 files; it is excluded via `.git/info/exclude`), so it
  never reaches Vercel. The audit branch `claude/session-handoff-tester-audit-iqukf3` *does* track 93
  `eval/` files — and it also carries `"exclude": ["node_modules", "eval"]` in `tsconfig.json`, which is
  why its build is unaffected.
- **Root cause of the local failure**: this repair branch was cut from `main`, which has neither the
  `eval/` files nor that tsconfig exclusion. The harness is present in the working tree (needed to run
  the live validation) and the root tsconfig's `include: ["**/*.ts"]` picks it up.

**Fix applied** (one line, no runtime effect): `mindreset-app/tsconfig.json` `exclude` is now
`["node_modules", "eval"]`, matching the audit branch and matching the comment already present in
`eval/journey/tsconfig.json` ("The root tsconfig now excludes `eval`…"). The harness keeps its own
`target: es2022` tsconfig for its own checking.

### Do the changed surfaces compile in the production build?

Yes — both appear in the successful build's route manifest:

```
├ ƒ /admin/journey-inspect                                372 B           157 kB
├ ƒ /api/journey/turn                                     0 B                0 B
```

`ƒ` = server-rendered on demand, which is correct for both.

---
