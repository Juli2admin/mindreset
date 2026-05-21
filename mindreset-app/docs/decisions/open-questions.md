# Open questions — running log

Decisions that are pending owner input. Each entry has a recommendation
where the answer feels obvious; the agent should not act on the
recommendation without explicit owner approval. New entries go at the
bottom with a date and tag.

Tags:

- `[blocker:PR-N]` — blocks a specific PR; resolve before that PR
  starts
- `[blocker:launch]` — blocks public launch
- `[non-blocking]` — can be answered later

## Block B — open questions

### 1. Counter reset timing — `[blocker:PR-3]`

When does `messagesUsedThisCycle` reset?

- **Option A**: Midnight UTC on cycle anniversary. Predictable for
  users; cron-friendly.
- **Option B**: Exact Stripe subscription anniversary timestamp.
  Aligns with Stripe invoice timing exactly.

**Recommendation**: Option B — reset is driven by the
`invoice.payment_succeeded` webhook, so timing is automatically
aligned to Stripe. No separate cron needed. If a renewal fails, the
user is auto-blocked at the cycle boundary.

**Logged**: 2026-05-21.

### 2. Mid-cycle upgrade behaviour — `[blocker:PR-3]`

User upgrades Essential → Extended in the middle of their cycle.
Stripe prorates the bill automatically. What happens to the counter?

- **Option A**: Counter persists. They keep the count of messages
  used and just get the higher cap (1,200 instead of 200).
- **Option B**: Counter resets. They effectively get a fresh 1,200
  for the rest of the cycle.

**Recommendation**: Option A. Cleaner UX, matches user expectation
("I'm not buying a fresh allowance, I'm buying more headroom"), and
the proration math on Stripe's side already accounts for partial
cycle.

**Logged**: 2026-05-21.

### 3. Mid-cycle downgrade behaviour — `[blocker:PR-4]`

User downgrades Extended → Essential. Cap drops from 1,200 to 200.
If they've already used 250, do they go over-cap immediately?

- **Option A**: Downgrade takes effect at next cycle boundary
  (Stripe Customer Portal native behaviour). Until then they keep the
  Extended cap.
- **Option B**: Downgrade is immediate. They're over-cap and chat is
  blocked until top-up or next cycle.

**Recommendation**: Option A. Use Stripe's native scheduled-change
behaviour. Less complexity in our webhook handler; no negative-cap
edge case to handle.

**Logged**: 2026-05-21.

### 4. Webhook endpoint scope — `[blocker:PR-3]`

Stripe webhook URL — production-only, or also a Vercel preview /
staging endpoint?

- **Option A**: Production only. `https://mindreset.ai/api/webhooks/stripe`
  configured in Stripe live dashboard. Test mode webhook fires to a
  test-mode endpoint (could be the same URL, since the env var
  determines which Stripe secret is used).
- **Option B**: Production + preview. Each Vercel preview deploy gets
  a unique URL — would require a wildcard webhook subscription, which
  Stripe doesn't natively support. Would need a relay.

**Recommendation**: Option A — production only. For testing during
PR development, use Stripe CLI's `stripe listen --forward-to
localhost:3000/api/webhooks/stripe` which proxies test-mode events to
the local dev server.

**Logged**: 2026-05-21.

### 5. Receipt VAT line wording — `[blocker:PR-2]`

Stripe receipts show a tax line. Since Julia is not VAT-registered,
what does this line say?

- **Option A**: Hide the tax line entirely. Stripe Checkout config:
  `automatic_tax: { enabled: false }` and no tax_id collection.
  Receipts show subtotal = total, no tax row.
- **Option B**: Show a line "VAT not applicable" or similar. Requires
  a custom Stripe Tax setup. Probably overkill.

**Recommendation**: Option A. Default Stripe behaviour with tax
disabled hides the tax line. Cleanest, no risk of misleading users.

**Logged**: 2026-05-21.

### 6. Promo code rollout — `[non-blocking]`

Per the spec, Stripe Coupon with `duration: 'once'` for "50% off
first month". When does this go live?

- **Option A**: At launch — anyone with the code gets the discount
  from day one.
- **Option B**: Day 30 or after first 100 sign-ups — used as a
  re-engagement nudge for users who didn't subscribe.
- **Option C**: Friend-of-Julia code only at launch; broader rollout
  later.

**Recommendation**: Option C. Lower-risk, learn from early users
before opening promo to all. The Stripe Coupon exists day one; only
the code distribution is gated.

**Logged**: 2026-05-21.

### 7. Annual savings copy precision — `[non-blocking]`

Current copy: "Annual billing saves around 28%" (Essential) and
"around 30%" (Extended).

- Essential: £179.88/yr monthly = £129/yr annual → 28.3% saving
- Extended: £299.88/yr monthly = £209/yr annual → 30.3% saving

Both rounded down to 28% / 30% in the copy. Is this the wording you
want, or do you prefer:

- "Save £50 by paying annually" (exact pound figure)
- "Save 2 months when you pay annually" (months-saved framing —
  Essential = 1.66 months, rounds to ~2)
- Skip the savings call-out entirely — show only the two prices

**Recommendation**: Keep as is. The percentage framing is honest and
removes the question of "why isn't it exactly 1/12?".

**Logged**: 2026-05-21.

### 8. Free-taster end-of-cap UX detail — `[non-blocking]`

When a Free taster user hits message 20, the banner says "You've
used your 20 free messages. Subscribe to MiniMind to continue."
Below it are two buttons: Essential (£14.99/mo) and Extended
(£24.99/mo).

Do we ALSO show the top-up button to free users? Top-up is
technically a one-off Stripe charge, so we could allow it without a
subscription. But the spec language implies top-up = adds to current
billing cycle, which a free user doesn't have.

**Recommendation**: Hide top-up for free users — only show Essential
and Extended subscribe buttons. Top-up appears only for users with
an active subscription. Avoids the awkward edge case of "what does
'current cycle' mean for a free user".

**Logged**: 2026-05-21.

### 9. Stripe Customer Portal feature toggles — `[blocker:PR-4]`

Stripe Customer Portal can be configured to allow:

- View invoices ✅ (default)
- Update payment method ✅ (default)
- Cancel subscription ✅ (default)
- Switch tier (Essential ↔ Extended) — toggle TBD
- Switch interval (monthly ↔ annual) — toggle TBD
- Pause subscription — already locked OFF

**Recommendation**: All defaults ON. Tier-switch and interval-switch
both enabled. Pause stays OFF.

**Logged**: 2026-05-21.

## Pre-launch — open questions (non-Block-B)

### 10. `User.screeningResult` populate fix — `[blocker:launch]`

The cookie-based screening row links to the new User on first
`/account` visit, but `User.screeningResult` (denormalised result
field) is not currently written. Implementation sketch in
`docs/carry-forward.md`. Pick a phase to fix it.

**Recommendation**: Fold into the next non-Block-B PR after Block B
ships, before launch.

**Logged**: pre-existing (carried forward from earlier sessions).

### 11. Welcome email cadence — `[blocker:launch]`

Resend wired but no email sequence designed.

- Email 1: immediately after sign-up — welcome + Screening result
  context
- Email 2: 24 hours later if no MiniMind message sent — "ready when
  you are" nudge
- Email 3: 7 days later if Free taster < 5 used — "what's been
  coming up?"

Or simpler: just Email 1.

**Recommendation**: Email 1 only at launch. Add Email 2/3 if data
suggests retention drop. Avoid email-nag patterns from the start.

**Logged**: pre-existing.

### 12. AI support email Pattern A — `[blocker:launch]`

Spec mentions "AI support email Pattern A" as launch-critical but
the pattern isn't fully defined. What is it?

**Logged**: 2026-05-21 — needs spec.

### 13. Russian audience for safety scanner — `[blocker:launch]`

Phase 3c keyword scanner is EN-only. RU users go through with no
keyword detection (LLM verifier still runs but doesn't get a
keyword-fired flag).

**Recommendation**: Add RU phrases to the keyword list before public
launch. Reuse the EN structure; populate Russian crisis phrases (e.g.
"больше не могу", "хочу умереть"). Owner-authored as a sensitive
list.

**Logged**: 2026-05-21.

## Process / longer-horizon — open questions

### 14. Roadmap v2 refresh — `[non-blocking]`

`docs/roadmap/MindReset_Roadmap_v1.md` (15 May 2026) is now
out of date in several places (pricing especially). When to refresh
to v2?

**Recommendation**: After Block B ships. The v2 should capture the
new tiered pricing structure as the official roadmap pricing, and
mark Block C with the deferred pricing.

**Logged**: 2026-05-21.

### 15. Block C — prompt design — `[non-blocking]`

9 State/Theme module prompts + 8 Journey block prompts not yet
designed. Significant clinical-voice work. Schedule for post-launch.

**Logged**: 2026-05-21.

### 16. T&C duplication investigation — `[blocker:launch]`

A pre-existing bug on `main` where T&C capture happens twice in the
signup flow. See `docs/carry-forward.md`.

**Logged**: pre-existing.
