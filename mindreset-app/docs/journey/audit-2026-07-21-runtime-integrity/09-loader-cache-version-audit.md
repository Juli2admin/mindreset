# Loader / Cache / Version Cleanliness — Journey Runtime (2026-07-21, code-verified)

## 1. File inventory (docs/journey + runtime/)

| File | Loaded in production? | How / why not |
|---|---|---|
| `00-shared-core.md` (16.4 KB) | YES | `sharedCore()` → canon block (`load-spec.ts:37`, `assemble.ts:622`) |
| `PRACTICE_GENERATION_ALGORITHM.md` (9.2 KB) | YES | canon block (`load-spec.ts:48-49`); also reused by Themes (`lib/themes/prompts/shame.ts:18,392`) |
| `01`–`08-stage-*.md` (18–33 KB each) | YES — ALL 8 every turn | `allStageSpecs()` (`assemble.ts:532-544`) |
| `runtime/journey-master.md` (87.7 KB) | YES | blocks 2+4, split at state token (`load-spec.ts:115-127`, `assemble.ts:598-602`) |
| **`CLINICAL_MANUAL.md` (81.3 KB)** | **NO** | zero code references — the file that declares "If code and manual disagree, this manual is right" **never reaches the model**; unrevised since 2026-07-01 (still contains 3 "your anchor" spoken lines) |
| `runtime/stage-01.md`, `stage-02.md` (25–27 KB) | NO (on disk, deprecated) | only caller is dead code (§2); stage-01 still contains pre-2026-07-02 "That's your anchor" language — dead but reactivatable if master went missing |
| `runtime/stage-03..08.md` | do not exist | — |
| audit-*.md, design-vs-delivery, execution-rebuild-plan, prompt export | NO | human docs; bundled by the over-inclusive glob but read by nothing |

## 2. Fallback paths (all of them, with triggers)

| # | Fallback | Trigger | Actual behaviour |
|---|---|---|---|
| 1 | Master-missing "legacy single-block" (`assemble.ts:590-593`) | `journey-master.md` absent (`existsSync` false, `load-spec.ts:118`) | **NOT a graceful degrade — infinite mutual recursion → stack-overflow crash.** `assembleSystemPromptBlocks` ↔ `assembleSystemPrompt` call each other unboundedly (blocks array is never empty, so `assembleSystemPrompt:677-679` always recurses). The comment's claimed legacy behaviour does not exist. Untested (no `existsSync` mock in `assemble.test.ts`). |
| 2 | Engineered-stage fallback + SharedCore+single-spec concat (`assemble.ts:683,689-694`) | never — `blocks.length > 0` is an invariant | **Dead code.** |
| 3 | Crisis-response locale (`keywords.ts:205-208`) | locale ≠ `'ru'` | English crisis text served to fr/de/es/it/pl/pt — **6 of 8 locales get EN**. Shared Core's "Localised crisis numbers are loaded per language at runtime" (`00-shared-core.md:215`) is a real mechanism with an overstated scope claim. |
| 4 | Verifier fail-closed (`verifier.ts:59-66,404-428`) | empty/invalid LLM response, 8s timeout, any throw | `{verdict:'ambiguous'}` — normal mode: no freeze; cooldown-lift mode: freeze holds. |
| 5 | Report parse default (`parse.ts:91-95,162-172`) | missing/truncated/unparseable `<state-report>` | `{intensity:5, safetyFlag:'watch', recommendedAction:'stay'}` — silently records a hold-biased turn. |
| 6 | Frozen short-circuit (`route.ts:223-306`) | `frozenForReview` | canned response; zero LLM turn calls while frozen. |
| 7 | Keyword pre-scan (`route.ts:310-334`) | regex hit on user msg | canned crisis response; no assembly, no LLM. |

## 3. Module caches & deployment staleness

- `load-spec.ts:25,103-104`: three module-level singletons (`cache` Map, `runtimeCache`,
  `masterCache`) — populated at first use, **never invalidated** (no TTL, no bust hook).
- `assemble.ts` itself recomputes per call (no cache); bytes come from the singletons.
- All Journey routes are `dynamic = 'force-dynamic'`, Node runtime, no edge/ISR layer
  (`turn/route.ts:59`, `start/route.ts:9`, themes/states equivalents).
- **Staleness window:** within one warm serverless process, a docs-only edit is not picked
  up until the process recycles; a new deployment = new bundle = fresh reads. No mechanism
  for a *new* deployment to serve *old* prompt content. Risk bounded to warm-instance
  lifetime on the SAME deployment — normal platform behaviour, no code defect.

## 4. Anthropic prompt cache

Blocks 1–2 are `cache_control:{type:'ephemeral'}` (default 5-min TTL) and are **pure
concatenations of file bytes + const string headers** (`assemble.ts:473-558,618-635` —
no per-user interpolation). Cache key = exact byte prefix → **any content edit is a
guaranteed cache miss and fresh write; the provider cache cannot serve superseded
instructions.** Canon block far exceeds Sonnet's 2,048-token caching minimum, so caching
is live. Verdict: provider-side stale-prompt risk **does not exist**; prompt-source changes
always change the cache key.

## 5. Historical loader integrity incident (verified, not just the comment)

`extractCodeBlock` closed the outer fence at the FIRST inner ``` fence; the Sensitivity
Layer (2026-07-09) legitimately contains inner fences → **~6,101 chars silently truncated
from the production prompt** (five silent questions, ALL hard behaviour rules, the worked
failure-mode example) until the 2026-07-19 fix (`load-spec.ts:80-98`), regression-pinned
by `loader-fence-extraction.test.ts` (exists, tests `loadMasterJourneyPrompt` output).
**Production ran without the Sensitivity Layer's enforcement tail 2026-07-09 → 2026-07-19.**

## 6. Variants / flags / env

- **`body.modelOverride`** (`route.ts:105,361`; `model.ts:19-21`): client-supplied string,
  **no allowlist, no admin gate** — any authenticated user with Journey access can set the
  model for their turn. Intended for `scripts/journey-smoke.mjs`, which is **not present**
  in this checkout (`scripts/` gitignored) — parity of the test harness with production
  assembly is NOT PROVEN.
- `STAGE_MODEL_OVERRIDES` empty; no feature-flag/env-var system gates assembly; the only
  branch is `existsSync(journey-master.md)`.
- No `NODE_ENV`/`VERCEL_ENV`/region branching in `assemble.ts` or `load-spec.ts`.

## 7. Bundle parity (verified empirically from `.next` build of 2026-07-20)

`route.js.nft.json` traces list **17** `docs/journey/*.md` files — the complete on-disk
set at build time, matching `outputFileTracingIncludes` globs (`next.config.mjs:19-27`).
Glob is directory-wide → **over-inclusive** (bundles never-read audit docs & CLINICAL_MANUAL)
but not under-inclusive; new files are picked up on next build. No missing-file risk found.
**However:** `loadSpec()` has **no existsSync guard** (`load-spec.ts:27-34`) — a missing
canon file would hard-crash (uncaught ENOENT), and the master-missing path crashes via
recursion (§2). **No graceful degrade exists for any missing prompt file.**

## 8. Does production use exactly the exported prompt?

The export (`audit-2026-07-21-runtime-prompt-export.md`) was generated through the same
`assembleSystemPromptBlocks` path with a reconstructed `JourneyState`. Static blocks
(1, 2, 4) are byte-deterministic from the files verified above → parity holds for them.
Block 3 varies per turn/user by construction. Live-production byte capture was not
possible from this environment → exact-turn parity NOT PROVEN, deterministic-assembly
parity PROVEN.

*Read-only audit. Facts only.*
