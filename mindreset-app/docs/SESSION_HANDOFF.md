# Session handoff — 2026-05-25

**Next session reads this first**, before CLAUDE.md and before next-steps.md.
This doc supersedes the previous handoff dated 2026-05-22.

---

## Starting point for next session

**Task:** Revise the already-built app + map next steps before any new build.

The owner (Julia) wants the architecture restored to "one working system"
after a long stretch of patching. Three subagents now exist to enforce
discipline:

- `product-gate` — first gate, decides IF a feature should be built + the
  smallest version. Cuts overbuild.
- `architecture-guardian` — second gate, decides HOW it fits, surfaces
  patterns to reuse, flags cross-cutting impact.
- `code-reviewer` — final gate, reviews the diff before commit.

**Default invocation rule:**
- Before proposing any new feature → auto-invoke `product-gate`
- After approval → auto-invoke `architecture-guardian` before writing
- After writing code → auto-invoke `code-reviewer` before showing diff to Julia
- Owner approves diff → commit + push to feature branch + PR + pause
- Owner says "merge" → squash-merge via GitHub MCP

---

## What just shipped (2026-05-25 session)

| PR | Scope | Status |
|---|---|---|
| #46 | Sign-up T&C checkboxes on initial step only | ✅ merged |
| #47 | Three subagent definitions in `.claude/agents/` | ✅ merged |

---

## Architectural map — established this session

A combined audit was done using the Explore agent (code structure) and
architecture-guardian (run via general-purpose since agents weren't yet
loaded). Key findings the next session should treat as the baseline.

### Drift between docs and code (stale docs to fix)

| Doc | Stale claim | Reality |
|---|---|---|
| `ai-behavior.md:171` | Model `claude-opus-4-7` | Code uses `claude-sonnet-4-6` |
| `overview.md:91-93` + `onboarding-flow.md:35-45` | `User.screeningResult` never populated | Populated in two paths now |
| `onboarding-flow.md:31` | Free cap is 20 messages | Free cap is 50 (locked decision #25) |
| `architecture.md:25,104` + `ai-behavior.md` (5 lines) | Sensor model called "DiagnosticProfile" | Schema name is `WellbeingSnapshot` |
| `communication-system.md:36,40` | Chat + screening rate limiting MISSING | Both have Upstash rate limiting |
| `architecture.md:102` | "Run migrations — `prisma migrate dev`" | Violates manual-SQL policy; section is stale future-tense |

### Dead code identified

- `lib/billing/messageCounter.ts` — exports `consumeMessage` but no file
  imports it. The used version is `lib/billing/limits.ts:82`. Safe to delete.

### Invariants ranked by severity

1. `MESSAGE_ENCRYPTION_KEY` set + never rotated without backfill
   (decrypt fails open = serves garbled ciphertext)
2. `inCrisisCooldown` checked before any Anthropic call
3. `Purchase.stripeSessionId` unique constraint for Stripe idempotency
4. RLS + REVOKE ALL on every new Prisma table (manual, no enforcement)
5. `hasCapacity()` fires before Anthropic + `consumeMessage()`

### Architectural debt (in priority order)

1. **Disclaimer gate lives in root layout** — should be MiniMind-only.
   Touched 6 times in PRs 39–46. Single biggest cleanup opportunity.
2. **Three product names** — Recode (code/schema), Reset 8 Blocks
   (methodology), The Journey (user-facing). Intentional, defer post-launch.
3. **`User.screeningResult` has 2 write paths** — works, would prefer one.
4. **Roadmap v1** stale (pricing wrong, "unlimited" tier mentioned).
5. **README.md** outdated (.jsx instead of .tsx, no i18n mention).

---

## Pending work (approved but not yet built)

### Doc cleanup PR — approved inline, not yet written

Branch: `claude/doc-cleanup`. Scope:

1. `ai-behavior.md` — model name `claude-sonnet-4-6`; rename
   DiagnosticProfile → WellbeingSnapshot (4 lines: 90, 94, 102, 128)
2. `overview.md:77` — rename DiagnosticProfile → WellbeingSnapshot.
   `overview.md:91-93` — remove the stale `screeningResult` caveat;
   replace with one sentence describing the actual flow.
3. `onboarding-flow.md:31` — 20-message cap → 50.
   `onboarding-flow.md:35-45` — **Option C agreed**: delete the
   "User.screeningResult is never populated" subsection from "Known gaps"
   AND add a new subsection elsewhere documenting how screeningResult
   actually gets populated (signed-in via `/api/screening`; anonymous
   backfill via cookie at first `/minimind` load).
4. `architecture.md:25,104` — DiagnosticProfile → WellbeingSnapshot.
5. `communication-system.md:36,40,89` — rate-limit status updates +
   DiagnosticProfile rename.
6. Delete `lib/billing/messageCounter.ts` (verified dead).

**Out of scope for this PR** (flagged separately):
- `architecture.md:102` says `prisma migrate dev` — violates CLAUDE.md
  policy. The whole "How to get started" section (lines 100–105) is
  stale future-tense. Separate cleanup needed.

---

## Canonical launch checklist (from earlier audit)

| # | Item | Status |
|---|---|---|
| 1 | Welcome email | Built; waiting on RESEND_API_KEY + DNS propagation |
| 2 | Remove FAQ link from welcome email | Discussed; not done |
| 3 | `User.screeningResult` backfill | ✅ Built (already!) — doc says it isn't |
| 4 | Voice input (Groq Whisper) | Locked, not built; needs T&C audio paragraph |
| 5 | T&C duplication fix on sign-up | ✅ Fixed in PR #46 |
| 6 | Auth-page i18n | Not built; scope unclear |
| 7 | `/account` LanguagePicker | Not built |
| 8 | RU safety scanner phrases | Owner-authored list needed |
| 9 | `support@` mailbox works | External (Julia chose Option A = Pattern A) |
| 10 | Native translation pass (6 placeholder locales) | After all EN copy locked |
| 11 | Mobile responsiveness audit | Not done |
| 12 | Disclaimer architecture cleanup (move to MiniMind only) | Identified debt, not done |

**Note:** Item 3 is already done — that's part of the doc-cleanup PR
(removing the stale claim that it isn't).

---

## External state (Julia's work)

- Resend account created; DNS records added to Namecheap; **propagation
  in progress** (1–6 hours typical)
- `RESEND_API_KEY` to add to Vercel once Resend issues it
- `mindreset.ai` domain not yet connected to Vercel (Block F1)
- Clerk still on dev keys (Block F2)

---

## Decisions locked this session

| # | Decision | Note |
|---|---|---|
| 39 | Support@ inbound = Option A (Resend Inbound + Pattern A) | Post-launch build (Block D) |
| 40 | Marketing emails at launch = transactional only | PECR-safe |
| 41 | FAQ page = remove link from welcome email, no static page | Build skipped |
| 42 | Stripe sends successful-payment receipt automatically | No app-side receipt template needed |
| 43 | Subagent workflow: product-gate → architecture-guardian → code-reviewer | Auto-invoke per agent's trigger |

To be added to `docs/decisions/locked-decisions.md` next session.

---

## What NOT to do in the next session

- Do not start building lifecycle emails, EmailLog table, send.ts wrapper,
  or any communication system expansion. The decision is: welcome email
  only at launch, Stripe receipts cover billing, Customer Portal UI covers
  cancellation acknowledgment. Pattern A is post-launch.
- Do not propose `prisma migrate dev/deploy/push` for any change.
- Do not push to `main`.
- Do not push to any branch without explicit "go" from Julia.
- Do not merge a PR without explicit "merge" from Julia.

---

## First message for next session

Julia will likely say something like:
> "Continue from handover. Start with the doc cleanup PR."

Expected response:
1. Read this handover doc first.
2. Run `product-gate` on the doc cleanup PR to confirm scope.
3. Run `architecture-guardian` to confirm no cross-cutting impact.
4. Write the doc edits + delete `messageCounter.ts` in one batch.
5. Run `code-reviewer` on the resulting diff.
6. Show diff inline, pause for "go".
7. Commit + push to `claude/doc-cleanup`, open PR, pause.
8. Wait for "merge".

After doc cleanup merges, the next item to discuss is the **canonical
launch checklist** above — which items to keep, drop, or sequence.
