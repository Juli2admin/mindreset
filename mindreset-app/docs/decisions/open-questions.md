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

### 1. Counter reset timing — ✅ LOCKED (confirmed by Julia 2026-05-21)

**Decision**: Stripe anniversary. Reset driven by `invoice.payment_succeeded`
webhook — no cron needed; auto-blocks on renewal failure.

### 2. Mid-cycle upgrade behaviour — ✅ LOCKED (confirmed by Julia 2026-05-21)

**Decision**: Counter persists; cap raises from 200 to 1,200. User is buying
headroom, not a fresh allowance.

### 3. Mid-cycle downgrade behaviour — ✅ LOCKED (confirmed by Julia 2026-05-21)

**Decision**: Next cycle boundary. Stripe Customer Portal scheduled-change —
user keeps Extended access until period end. No negative-cap edge case.

### 4. Webhook endpoint scope — ✅ LOCKED (confirmed by Julia 2026-05-21)

**Decision**: Production only — `https://mindreset.ai/api/webhooks/stripe`.
Local dev via `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### 5. Receipt VAT line wording — ✅ LOCKED (confirmed by Julia 2026-05-21)

**Decision**: Hide tax line entirely. `automatic_tax: { enabled: false }`,
no tax_id collection. Subtotal = total, no tax row.

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

### 9. Stripe Customer Portal feature toggles — ✅ RESOLVED (2026-05-22)

Configured in Stripe Dashboard with:
- View invoices ✅
- Update payment method ✅
- Update billing info ✅
- Cancel subscription ✅ (mode: "At end of billing period")
- Pause OFF

Tier-switch / interval-switch left at Stripe defaults. Owner can
revisit if needed but not blocking launch. **See locked decisions
#35, #36.**

## Pre-launch — open questions (non-Block-B)

### 10. `User.screeningResult` populate fix — ✅ RESOLVED (verified 2026-06-01)

The cookie-based screening row originally linked to the new User on
first `/account` visit, but `User.screeningResult` (denormalised
result field) was not written.

**Resolution**: verified in code, three paths now populate
`User.screeningResult`:

1. **Signed-in screening submission** —
   `app/api/screening/route.ts:87-98` writes `screeningResult` directly
   to the User row via `updateMany` immediately after creating the
   `ScreeningResponse`.
2. **Anonymous-then-signed-up flow (primary path)** —
   `app/[locale]/home/page.tsx:57-70` reads the `mr_screening` cookie
   on first /home visit, runs a transaction that both links the
   `ScreeningResponse` to the new userId AND writes
   `screeningResult` + `screeningResultAt` onto the User row.
3. **Cookie-linkage race fallback** —
   `app/[locale]/minimind/page.tsx:64-99` does the same transaction
   if the user reaches /minimind before /home (e.g. Clerk webhook
   timing race).

`app/api/minimind/chat/route.ts:157` enforces `screeningResult !== null`
as the chat gate — confirms the populate is the upstream contract.

No further work needed.

### 11. Welcome email cadence — ✅ RESOLVED (verified 2026-06-01)

Resend wired but no email sequence designed.

- Email 1: immediately after sign-up — welcome + Screening result
  context
- Email 2: 24 hours later if no MiniMind message sent — "ready when
  you are" nudge
- Email 3: 7 days later if Free taster < 5 used — "what's been
  coming up?"

**Resolution**: Email 1 only at launch (the locked recommendation).
Shipped as PR #33 via `lib/email/sendWelcome.ts` — idempotent via
`User.welcomeEmailSentAt` claim, fires from `/home` on first visit
via `waitUntil`. EN + RU bodies hand-curated.

Email 2 and Email 3 (onboarding drip) tracked as a separate PR
(`claude/onboarding-drip-emails`) when retention data justifies them.
Avoiding email-nag patterns at soft launch.

**Logged**: pre-existing. Closed 2026-06-01.

### 12. AI support email Pattern A — ✅ RESOLVED (2026-05-31)

Spec mentioned "AI support email Pattern A" as launch-critical but
the pattern wasn't fully defined.

**Resolution**: Pattern A shipped as PRs 2a + 2b. Inbound `SupportEmail`
table + AI categoriser (`lib/support/categorise.ts`) + Resend outbound
(`lib/email/sendSupportReply.ts`) + admin queue at `/admin/support`.
Rollout phases per `MindReset_PreLaunch_Plan.md` §4.1: Phase 1 (manual
review of every AI draft) is what shipped; Phases 2 (whitelist
auto-send) and 3 (threshold tuning) deferred until volume justifies.

Inbound webhook is held pending Resend Inbound beta access — see
new question below.

### 13. Russian audience for safety scanner — ✅ RESOLVED (2026-06-01)

Phase 3c keyword scanner was EN-only. RU users went through with no
keyword detection (LLM verifier still ran, with ~3s latency vs ~5ms
keyword instant cooldown — Sev-5 still fired but not as fast).

**Resolution**: owner-authored ~95 RU phrases across all four
severity tiers, shipped in `lib/minimind/safety/keywords.ts`.
Feminine grammatical forms canonical per CLAUDE.md. Multi-word
phrases preferred for false-positive resistance. Scanner upgraded
to handle Cyrillic word boundaries via Unicode-aware lookarounds
(`(?<!\p{L})…(?!\p{L})` with the `u` flag) — preserves existing EN
behaviour while extending the matcher to Cyrillic without
false-positive substring matches.

**Locale-policy decision (locked 2026-06-01)**: native keyword
phrases ship for EN + RU only. The 6 placeholder locales (fr, de,
es, it, pl, pt) rely on the AI verifier alone — acceptable because
those locales are also UI-placeholders (byte-identical to en.json
per CLAUDE.md), so a user on those locales is functionally on an
English experience. When a placeholder locale gets promoted to
native, author phrases for that locale in the same PR.

**Logged**: 2026-05-21. Closed 2026-06-01.

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

### 16. T&C duplication investigation — ✅ RESOLVED (verified 2026-06-01)

A pre-existing bug on `main` where T&C capture happened twice in the
signup flow. Carry-forward notes flagged two candidates:
1. `DisclaimerModal` firing twice across the chain
2. Overlap between screening step-5 `ConsentScreen` and `/sign-up`
   T&C+Privacy checkboxes

**Resolution**: both candidates were fixed in earlier PRs.
Confirmed by code audit + git history on 2026-06-01.

- **PR #46** (`fix(sign-up): show T&C checkboxes only on initial step`)
  gated the `/sign-up` checkboxes behind `isInitialStep =
  pathname.endsWith('/sign-up')` so they don't re-render on Clerk's
  `verify-email-address` sub-path. Killed the in-flow double T&C
  render. See `SignUpClient.tsx:83`.
- **PR #55** (`refactor(disclaimer): move modal from root layout to
  /minimind page tree`) removed the `DisclaimerGate` from
  `[locale]/layout.tsx` and mounted it only on
  `app/[locale]/minimind/page.tsx:236`. The modal can no longer fire
  on Landing, /screening, /sign-up, or /home because those pages no
  longer render the component.

The two consent surfaces that remain — screening's
`ScreeningResponse.consentItems` (trauma-screening attestations) and
`/sign-up`'s `User.tcAcceptedAt` (legal Terms agreement) — are
**intentionally distinct**: different DB columns, different legal
purposes. Not a duplication bug.

**Logged**: pre-existing. Closed 2026-06-01.

### 17. Vercel production deploys broken — ✅ RESOLVED (auto-resolved 2026-05-23, confirmed 2026-06-01)

**Reported by owner 2026-05-22.** After merging PR #26 (commit
`35d8338`) to `main` via GitHub MCP, no new Vercel deployment fired.
Owner saw no Vercel activity in 20+ hours despite the merge.

**Resolution**: auto-resolved within ~24 hours. Owner debugged the
Vercel-GitHub integration in their Vercel dashboard (likely
reconnected the integration or unpaused it). 19+ merges have shipped
since this was filed (PRs #27 through #93), every one of them
triggering a Vercel deploy on `main`. Integration is healthy.

**Logged**: 2026-05-22. Closed 2026-06-01.

### 18. `mindreset.ai` DNS connection — ✅ RESOLVED (2026-05-31)

Owner clarified 2026-05-22 that `mindreset.ai` was NOT yet connected
to Vercel. All testing happened on Vercel-provided URLs.

**Resolution**: connected 2026-05-31.
- Removed Namecheap URL Redirect (`@ → http://www.mindreset.ai/`)
  and CNAME (`www → parkingpage.namecheap.com`).
- Added A record `@ → 216.198.79.1` (Vercel's apex IP).
- Old `mindreset-kappa.vercel.app` auto-redirects to `mindreset.ai`
  with 307.
- Vercel status flipped to "Valid Configuration"; SSL cert
  auto-provisioned.
- Resend MX records (inbound + send subdomain) kept — separate DNS
  record type, no conflict.

Follow-ups still open (logged elsewhere):
- Clerk allowed-origins update for `mindreset.ai` — handled by
  Clerk's dev mode auto-allowlisting; will need explicit add when
  Clerk goes to production mode.
- Stripe webhook URL still uses the `?x-vercel-protection-bypass=...`
  query string — can be cleaned up post-Vercel-Protection-OFF
  verification.

**Logged**: 2026-05-22. Closed 2026-05-31.

### 19. Tier-downgrade edge case — `[non-blocking]`

Surfaced in PR #27 audit. When a subscriber cancels and
`currentTier` is set to `'free'`, the user inherits their cumulative
`lifetimeMessagesUsed`. If they have 50+ (likely, since they paid
for a tier), they land at-cap immediately on the free fallback.

Options:
- **A**: Leave on free with cumulative count — "you used your free
  trial during your paid period, no second taster". Clean, defensible,
  may feel punitive.
- **B**: Grant fresh 50 lifetime messages on downgrade — kinder, but
  abusable (subscribe-and-cancel loops for unlimited tasters).
- **C**: Set `lifetimeMessagesUsed = 0` ONLY if `subscriptionStartedAt`
  exists (proves they were a paying customer). Hybrid.

**Recommendation**: Option A — simplest, defensible, no abuse path.
Owner copy at cancel surface should hint at it.

**Logged**: 2026-05-22 (PR #27 audit).

### 20. Extended soft-cap notice — `[non-blocking]`

`isAtSoftCap()` helper exists in `lib/billing/limits.ts` but isn't
surfaced in UI. Should show a gentle "approaching limit" notice for
Extended users between 800 and 1,200 messages used.

**Recommendation**: small banner above chat input. Non-intrusive.
Schedule after Block B closes.

**Logged**: 2026-05-22 (PR #27 audit, out of scope).

### 21. PR 6 scope — top-up purchase flow — ✅ RESOLVED (2026-05-22)

PR 3's webhook already handles `checkout.session.completed` for
top-up, including idempotency via `Purchase.stripeSessionId` and the
`topUpMessagesRemaining += 200` credit. End-to-end tested live:
buy → webhook credits → top-up drains before cycle pool → resets on
billing anniversary. PR 6 is a no-op. Block B declared fully shipped.

**Logged**: 2026-05-22.

### 22. Voice input — mic button in MiniMind chat — ✅ LOCKED + SHIPPED (2026-05-26 — see locked-decisions.md #45)

Owner wants voice input comparable to ChatGPT voice mode. MindReset
is a deep self-help companion app where talking to the AI is a core
interaction pattern — typing-only is a UX gap.

**Decision**: Ship voice input **before launch**, using **Groq Whisper
API** (same underlying model as ChatGPT, ~10× cheaper than OpenAI
Whisper, sub-second response, multilingual — covers all 8 locales).

**Scope locked**:
- Mic button added to MiniMind chat input bar
- Tap to start recording → tap to stop → spinner → transcribed text
  fills textarea → user reviews/edits → sends normally
- Groq Whisper handles transcription server-side (Next.js API route)
- MiniMind prompt, model, safety scanner, and memory are **unchanged**
  — backend only ever receives text
- T&C and Privacy: one paragraph each covering transient audio
  processing (audio sent to Groq, not retained; only text saved)
- Julia to approve T&C wording before merge

**Rejected alternatives**:
- Browser-native `SpeechRecognition` — free and private but
  noticeably worse for emotional/halting speech and RU locale;
  poor iOS Safari support
- OpenAI Whisper API — same model, 10× more expensive, no advantage
- Post-launch deferral — owner preference is for voice at launch;
  omitting it would misrepresent the product's intended UX

**Logged**: 2026-05-22.

### 23. Resend Inbound replacement when access lands — ✅ RESOLVED (2026-06-01)

The Resend Inbound feature was thought unavailable on the account but
Resend support clarified on 2026-06-01 that *receiving is enabled at
the domain level* — the inbound webhook endpoint configuration lives on
the same Webhooks page as outbound delivery events, with `email.received`
as the dedicated event type.

**Resolution**: PR 2c (`claude/support-inbound-webhook`) shipped:
- `app/api/webhooks/email-inbound/route.ts` — svix-verified, same
  pattern as `webhooks/clerk`
- Ignores non-`email.received` events (the page is shared with
  outbound delivery webhooks; outbound events are no-op'd)
- Idempotent via `SupportEmail.resendInboundId` unique constraint
- AI categoriser fires via `waitUntil` so Resend gets a fast 200
- Removed the `AddTestEmailForm` from `/admin/support` — real emails
  to `support@mindreset.ai` now arrive automatically

Owner configured the Resend webhook endpoint and added
`RESEND_INBOUND_WEBHOOK_SECRET` to Vercel env vars.

**Logged**: 2026-05-31. Closed 2026-06-01.

### 24. Marketing-consent signup-time UI — ✅ RESOLVED (shipped 2026-05-31)

PR 3a added the `User.marketingConsent` schema field; PR 3b added the
admin compose + send page that filters recipients by that field. But
there was no UI for users to actually opt in — the field defaulted to
`false` and nothing flipped it, so the compose page audience count was 0
for every real signup.

**Options considered**:
- **A**: Checkbox on the Clerk sign-up page (requires customising the
  Clerk `<SignUp />` component with `unsafeMetadata` or a follow-up
  POST after sign-up).
- **B**: Post-signup banner on `/home` first visit asking for opt-in.
  Less form-y, more trauma-informed; can be dismissed without
  consenting.
- **C**: Profile-settings toggle (passive — relies on user discovering
  it).

**Resolution**: PR #89 (`316e778`) shipped Option B + C — a one-time
opt-in banner on first `/home` visit, plus a passive toggle in
Settings. Schema added `marketingConsentPromptedAt` so the banner
appears at most once per user. POST `/api/account/marketing-consent`
backs both surfaces.

**Logged**: 2026-05-31. Closed 2026-06-01.

### 25. Relationships-focused product gap — `[non-blocking]`

Recommendation-engine note (owner spec 2026-07-20). Onboarding offers
relationship-oriented answers (`why: relationships_not_working`,
`area: relationships`), but there is **no** Relationships State or Theme.
The Family theme is specifically "Parents and Family Scripts" — mapping a
romantic/peer relationship request onto it would be an *inferred diagnosis*,
which the stated-request engine explicitly forbids. So relationship answers
currently route to MiniMind, and to the Journey only when ≥2 independent
Journey signal categories are present from the user's OTHER answers.

**Gap**: a dedicated Relationships-focused Theme or module would give these
users a direct product match. **Not created in this scope** (recorded per the
engine spec's §7).

**Recommendation**: consider a "Relationships" Theme in a future Block C
content pass. Until then MiniMind is the honest, non-inferential entry point.

**Logged**: 2026-07-20.
