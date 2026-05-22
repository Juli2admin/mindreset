# Session handoff — 2026-05-22

This document is the canonical handoff for the next Claude Code session.
It supersedes any in-flight chat history. **Read this first.** Other
docs referenced from here are second-priority.

The session it was written from grew long, ran through a major debugging
detour around the Vercel deployment, and the owner asked for a clean
handoff before continuing.

---

## TL;DR — where we are

**Block B (Stripe billing) is ~95% shipped.**

- PRs 0 → 4 are merged to `main` (pricing copy, schema, checkout flow,
  webhook + active badge, Customer Portal + at-cap UI)
- **PR 5 (message counter integration) is OPEN at
  [PR #27](https://github.com/Juli2admin/mindreset/pull/27)** —
  approved, but NOT merged because production deployment is broken
  and we can't test it
- PR 6 (top-up purchase flow) — webhook already handles top-up; this
  PR may have been folded into earlier work. Verify before scoping.

**Current blocker: Vercel deployment broken.** The merge of PR #26
(35d8338) did not trigger a production deployment. Owner sees no
Vercel activity in 20+ hours despite the merge. **Do not merge PR #27
until production deploys are working** — there is no way to verify
the counter works otherwise.

---

## What is working (verified by owner this session)

| Surface | Status | Evidence |
|---|---|---|
| Account page tier rendering | ✅ | "Active" badge visible in page source after subscribing |
| Stripe Checkout — Essential monthly | ✅ | Owner tested all 5 buttons after env-var fix |
| Stripe Checkout — Essential annual | ✅ | Returns to correct origin |
| Stripe Checkout — Extended monthly | ✅ | Tested |
| Stripe Checkout — Extended annual | ✅ | Tested; webhook set `currentTier: 'extended'` |
| Stripe Checkout — Top-up one-off | ✅ | Tested |
| Webhook signature verification | ✅ | After Vercel Deployment Protection was disabled |
| Webhook handles 6 events | ✅ | checkout.session.completed, sub created/updated/deleted, invoice succeeded/failed |
| Customer Portal | ✅ | Owner clicked "Manage subscription" → portal → returned to /account |
| At-cap banner SSR | ⚠️ Code shipped to main, not deployed | merge commit 35d8338, awaiting Vercel build |

## What is broken / unverified

| Issue | Status | Notes |
|---|---|---|
| Vercel deployment of `main` after PR #26 merge | ❌ Broken | No Vercel activity in 20+ hours per owner |
| `mindreset.ai` custom domain | ❌ Not connected | Domain DNS not pointed at Vercel yet |
| MiniMind chat page reachable for testing | ❌ Blocked | Preview URLs fail Clerk auth; production not deployed |
| Message counter increment | ⚠️ Untested | Code in PR #27 only, not merged |
| At-cap 402 API gate | ⚠️ Untested | Code in PR #27 only, not merged |
| At-cap UI banner with reset date | ⚠️ Untested in production | Code merged in PR #26 but production not redeployed |

---

## Why production isn't deploying — debugging map

**Observed**: Merging PR #26 via GitHub MCP (commit `35d8338`) advanced
`origin/main`. Owner confirms git log. But owner reports Vercel
dashboard shows no new deployments in 20+ hours, and `mindreset.ai`
times out (it's not connected; not a real signal).

**Suspected causes, ranked by likelihood**:

1. **Vercel-GitHub integration paused or disconnected** — most likely.
   The integration may have been auto-paused after Stripe webhook
   debugging in this session (we disabled Vercel Deployment Protection;
   could have side-effect). Check **Vercel → Project Settings → Git**.
2. **Production branch misconfigured** — Vercel may be pointed at the
   wrong branch as "Production". Check **Vercel → Project Settings →
   Git → Production Branch** (should be `main`).
3. **Build silently failing** — but Vercel surfaces these as "Error"
   not "no deployment". Unlikely if the dashboard genuinely shows zero
   activity.
4. **Ignored Build Step returning skip** — there is an "Ignored Build
   Step" config option that can return shell-exit 0 to skip; check it.

**What to ask the owner**:
- Open Vercel → mindreset project → Deployments tab, **clear all
  filters**, paste top 3 rows
- Check Project Settings → Git: is GitHub still connected? What's
  the production branch?
- What's the **primary Vercel-provided URL** that's been serving as
  production (e.g. `mindreset-julialoya-s-projects.vercel.app` or
  similar) — that's the real production URL until DNS is wired

**Do not** attempt to fix this from code. It's a Vercel dashboard
issue.

---

## Open PR #27 — message counter

**Branch**: `claude/block-b-pr5-message-counter`
**URL**: https://github.com/Juli2admin/mindreset/pull/27
**Status**: Open, audit-approved by owner, **NOT merged**.

### What it does

Two files changed:

**`lib/billing/limits.ts`** — adds `consumeMessage(userId)` helper.
Top-up pool consumed before cycle allowance (mirrors `hasCapacity()`).
Two `updateMany` calls so the top-up decrement is conditional at the
DB level (no read-modify-write race). `lifetimeMessagesUsed` always
incremented.

**`app/api/minimind/chat/route.ts`** — adds:
- Gate at top of POST (after auth): returns `402 { error: 'at-cap' }`
  if `!hasCapacity(billingUser)`
- `consumeMessage(userId)` call in the stream's `finally` block,
  inside the `if (accumulated.length > 0)` branch (only meters
  successful turns)

### What is NOT metered (locked decision)

- Cooldown-within-floor (canned text, no AI call)
- Cooldown-past-floor (verifier + canned text — cheap, rare, charging
  users in crisis is unacceptable)
- Sev 4/5 keyword crisis (canned crisis text, no AI call)
- Zero-token stream failure (user message rolled back)

Crisis/cooldown branches return before reaching the meter. The 402
gate sits ABOVE these branches so at-cap users can't dump messages
through cooldown to bypass.

### Test plan (cannot execute until production deploys work)

1. Send a message as a subscriber → `messagesUsedThisCycle += 1`,
   `lifetimeMessagesUsed += 1`
2. Buy top-up, send a message → `topUpMessagesRemaining -= 1`,
   `messagesUsedThisCycle` unchanged, `lifetimeMessagesUsed += 1`
3. Manually set `messagesUsedThisCycle = 1200` for an extended user
   in Supabase → next chat POST returns 402; page reload shows
   `AtCapBanner`
4. Free taster up to 50 → at-cap
5. Trigger Sev 5 keyword (cooldown path) → meter does NOT increment

### Risks accepted by owner (do not relitigate)

- Parallel-tab overage ~1–2 msgs over cap. Same-conversation race
  blocked by existing "previous turn in progress" 409 guard.
- 402 client UX: existing generic stream-error fallback. Page reload
  shows the proper SSR banner. No bespoke 402 client handling.
- Tier-downgrade edge case (subscriber cancels → `currentTier='free'`
  → inherits high `lifetimeMessagesUsed` → at-cap on free).
  **Flagged for future PR, not blocking PR #27.**

---

## Files modified in this session

### Merged (PR #26, commit `35d8338`)

```
mindreset-app/app/[locale]/account/AccountClient.tsx
mindreset-app/app/[locale]/minimind/MiniMindClient.tsx
mindreset-app/app/[locale]/minimind/page.tsx
mindreset-app/app/api/stripe/portal/route.ts        (new)
mindreset-app/messages/de.json
mindreset-app/messages/en.json
mindreset-app/messages/es.json
mindreset-app/messages/fr.json
mindreset-app/messages/it.json
mindreset-app/messages/pl.json
mindreset-app/messages/pt.json
mindreset-app/messages/ru.json
```

### Open on `claude/block-b-pr5-message-counter` (PR #27)

```
mindreset-app/app/api/minimind/chat/route.ts
mindreset-app/lib/billing/limits.ts
```

### Handoff docs (this branch — `claude/session-handoff-2026-05-22`)

```
mindreset-app/docs/SESSION_HANDOFF.md                       (new)
mindreset-app/docs/implementation/progress.md               (updated)
mindreset-app/docs/implementation/next-steps.md             (updated)
mindreset-app/docs/decisions/locked-decisions.md            (updated)
mindreset-app/docs/decisions/open-questions.md              (updated)
CLAUDE.md                                                    (updated)
```

---

## Stripe state (current, working)

### Env vars in Vercel (verified clean — no tab characters)

```
STRIPE_PRICE_ESSENTIAL_MONTHLY = price_1TZUgCEnfIBDDBbc74twQ4TJ
STRIPE_PRICE_ESSENTIAL_ANNUAL  = price_1TZUhyEnfIBDDBbccoB42Lj5
STRIPE_PRICE_EXTENDED_MONTHLY  = price_1TZUiXEnfIBDDBbceoxOonTS
STRIPE_PRICE_EXTENDED_ANNUAL   = price_1TZUj5EnfIBDDBbczw40P5mj
STRIPE_PRICE_TOP_UP            = price_1TZUjeEnfIBDDBbctIlNAkKY
STRIPE_WEBHOOK_SECRET          = whsec_... (owner's real key)
```

### Stripe webhook configured

URL contains `?x-vercel-protection-bypass=TOKEN` because Vercel
Deployment Protection was previously blocking webhooks. **NOTE**:
the URL host is `mindreset.ai` (not connected yet) — this needs to
be either:
- Updated to the actual Vercel production URL the project is using, or
- Left as-is until DNS is wired

Check this with the owner. If the webhook is firing successfully (it
was, per session evidence — `currentTier: 'extended'` was set), then
the URL is somehow resolving — possibly to a redirect.

### Stripe Customer Portal configured

Settings saved in Stripe Dashboard:
- Cancel mode: **At end of billing period**
- Update payment method ✅
- Update billing info ✅
- View invoice history ✅
- Cancel subscriptions ✅

**Activate toggle was NOT enabled** — it's for shareable portal links,
not API sessions. `billingPortal.sessions.create()` works without it.
Owner verified the Manage subscription button works end-to-end.

### Vercel Deployment Protection

**Disabled at project level.** Was previously blocking webhooks with
401 SSO redirects. Owner disabled in Project Settings → Deployment
Protection. Do not re-enable.

---

## Architectural decisions locked this session

Add these to `docs/decisions/locked-decisions.md` if not already there:

1. **Cycle = billing period** (not "monthly" for annual subscribers).
   Counter resets on `invoice.payment_succeeded` for `billing_reason:
   subscription_cycle`. Annual subscribers get one reset per year.
2. **Crisis / cooldown branches do not meter messages.** Safety
   surfaces are not charged. Locked in PR #27 audit.
3. **At-cap API response: `402 { error: 'at-cap' }`.** No fancy client
   handling; SSR banner is the primary UX surface.
4. **Counter incremented post-stream-success only** — inside the
   stream's `finally` block, only when `accumulated.length > 0`.
   Zero-token failures are not metered (user message gets rolled back).
5. **Top-up pool consumed before cycle pool** — mirrors
   `hasCapacity()` priority. Both helpers must stay in sync.
6. **Top-up expires at billing-period reset.** Implemented in webhook:
   `invoice.payment_succeeded` zeros both `messagesUsedThisCycle` and
   `topUpMessagesRemaining`.
7. **Webhook uses `updateMany` not `update`** for subscription/invoice
   events, so a missing `stripeCustomerId` silently no-ops instead of
   throwing P2025 and triggering Stripe retries.
8. **Top-up idempotency via `Purchase.stripeSessionId` unique
   constraint** — webhook tries to create a Purchase row first; P2002
   means "already processed", skip the credit increment.
9. **`current_period_end` defensive read** — webhook reads from both
   `SubscriptionItem.current_period_end` (dahlia API) and
   `Subscription.current_period_end` (acacia API). SDK is on acacia
   but webhook events arrive on dahlia.
10. **Customer Portal "Activate" toggle is for shareable links only.**
    API-based portal sessions work without it.
11. **Vercel Deployment Protection must stay OFF** at project level.
    Stripe webhooks cannot bypass Vercel SSO without the bypass token,
    and even with it the URL gets ugly.

---

## What NOT to change

- **Webhook handler** (`app/api/stripe/webhook/route.ts`) — working,
  owner-verified. Do not refactor.
- **Account page tier badge logic** in `AccountClient.tsx` — verified
  rendering correctly. The conditional rendering for `currentTier ===
  'essential'` / `'extended'` is correct, do not "simplify".
- **`getPeriodEnd()` helper** in webhook — the dual-read pattern is
  deliberate, not over-engineering. SDK version mismatch is real.
- **`updateMany` everywhere in webhook** — deliberate. Do not change
  to `update` for "cleaner code".
- **MiniMind v2.3 system prompt** — dual source of truth rule.
  `lib/minimind/prompt.ts` and `docs/minimind/MiniMind_System_Prompt_v2.3.md`
  must be updated in the same commit. Do not touch either alone.
- **Brand language constraints on payment surfaces** — see CLAUDE.md.
  Forbidden: therapy, therapeutic, treatment, medical, mental illness,
  diagnosis, counseling, counselling, clinical intervention, unlimited.
- **Migration policy** — never run `prisma migrate dev/deploy/push`.
  Owner runs SQL manually in Supabase. All schema changes proposed as
  copy-pasteable SQL in PR body.
- **The `claude/session-handoff-2026-05-22` branch** — do not delete
  until next session has consumed it.

---

## Recommended next-session debug sequence

1. **Read this document end-to-end first.** Then read CLAUDE.md.
   Do not skim.
2. Ask the owner: *"Before I do anything, what's the status of the
   Vercel deployment from PR #26 merge? Did it deploy, or is it still
   broken?"*
3. **If Vercel deploys are broken**: do not write code. Help the owner
   debug Vercel dashboard:
   - Settings → Git: is repo connected? Production branch = `main`?
   - Deployments tab: filters cleared, show top 3 rows
   - Has the "Ignored Build Step" config been touched?
   - Was anything changed in Project Settings after disabling
     Deployment Protection?
   Stop and resolve this before merging PR #27.
4. **If Vercel deploys are working again**: merge PR #27. Then ask
   the owner to test the counter (see test plan above). Watch Supabase
   `User` row for `messagesUsedThisCycle`, `topUpMessagesRemaining`,
   `lifetimeMessagesUsed` after each test message.
5. **After PR #27 is verified live**: revisit PR 6 scoping. The Stripe
   webhook already handles top-up `checkout.session.completed` events
   (credits `topUpMessagesRemaining += 200`). What's actually left for
   PR 6? Possibly nothing — verify before scoping new work.
6. After Block B is fully verified live, update
   `docs/implementation/progress.md` and `next-steps.md` to mark
   Block B as fully shipped.

---

## Project constraints — must remain in effect

These are non-negotiable. See CLAUDE.md for the authoritative list.

- **Never push to `main`.** Open PRs; agent merges via GitHub MCP.
- **GitHub MCP owner** = `Juli2admin` (capital J).
- **Migrations run manually** by Julia in Supabase. Propose SQL in
  PR body.
- **`mindreset-app/scripts/` is gitignored.** Never `git add scripts/`.
- **Propose-and-pause** for copy and architectural decisions. Don't
  write to files until owner approves.
- **Brand language** on Stripe surfaces only — see CLAUDE.md.
- **Julia is NOT VAT-registered.** Stripe Tax OFF. UK-only.
- **MiniMind prompt is dual source of truth.**
- **No "unlimited" tier** — ever.

---

## Files to read first (in order)

1. `mindreset-app/docs/SESSION_HANDOFF.md` (this file)
2. `CLAUDE.md` (root) — persistent project rules
3. `mindreset-app/docs/decisions/locked-decisions.md` — what is locked
4. `mindreset-app/docs/implementation/progress.md` — what is shipped
5. `mindreset-app/docs/implementation/next-steps.md` — what is next
6. `mindreset-app/docs/decisions/open-questions.md` — what needs owner
   input
7. Only if working on Block B billing:
   - `mindreset-app/docs/implementation/block-b-stripe-plan.md`
   - `mindreset-app/lib/billing/limits.ts`
   - `mindreset-app/app/api/stripe/webhook/route.ts`
8. Only if working on MiniMind chat:
   - `mindreset-app/app/api/minimind/chat/route.ts`
   - `mindreset-app/docs/minimind/MiniMind_System_Prompt_v2.3.md`

---

## Warnings — context that could confuse a fresh session

1. **`mindreset.ai` is not connected to Vercel.** Don't tell the owner
   to test there. Use whatever Vercel-provided URL is the project's
   actual production URL. Ask the owner if unclear.
2. **PR #26 was merged this session.** Code is on `main` (commit
   `35d8338`) but production may not reflect it (Vercel deploy broken).
3. **PR #27 is open and approved but unmerged.** Do not merge until
   production deploys are confirmed working.
4. **The stop-hook commits work-in-progress automatically.** Don't be
   surprised by auto-commits on feature branches.
5. **Stripe webhook URL contains `?x-vercel-protection-bypass=TOKEN`.**
   This is intentional from a previous debug session. If the URL
   stops working, check whether Deployment Protection got re-enabled.
6. **Clerk auth only works on whitelisted domains.** Vercel preview
   URLs (`*-julialoya-s-projects.vercel.app`) are NOT whitelisted by
   default. Owner cannot test MiniMind on preview URLs. This is not
   a bug.
7. **The roadmap doc (`docs/roadmap/MindReset_Roadmap_v1.md`) is out
   of date.** Pricing especially. Authoritative pricing lives in
   `docs/product/tiers-and-pricing.md` and `docs/decisions/
   locked-decisions.md`.

---

## Next session startup checklist

Run through this BEFORE touching code:

- [ ] Read `mindreset-app/docs/SESSION_HANDOFF.md` end to end
- [ ] Read `CLAUDE.md`
- [ ] Confirm current branch is `main` (or wherever owner directs)
- [ ] Run `git log --oneline -5` — confirm `35d8338` is on `main`
- [ ] Check open PRs via GitHub MCP — PR #27 should still exist
- [ ] Read `docs/decisions/locked-decisions.md` and
  `docs/decisions/open-questions.md`
- [ ] Ask owner: *what's the Vercel deploy status of `main`?*
- [ ] Do NOT merge PR #27 until production deploys work
- [ ] Do NOT touch the webhook handler, account tier badge, or
  MiniMind prompt without explicit owner instruction
- [ ] If the owner wants to continue Block B, fix the Vercel pipeline
  first, then merge PR #27, then test the counter

---

*End of handoff. Good luck.*
